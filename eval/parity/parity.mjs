#!/usr/bin/env node
// The parity eval, driven in bounded ticks. Every stage is keyed by a file in
// the evidence directory, so a tick that ends, crashes or is rerun picks up
// where the last one stopped and never redoes a finished turn or judgment.
//
// It runs only on Windows. The Cursor arms run the cursor-agent build its Windows installer puts under
// %LOCALAPPDATA%\cursor-agent\versions, calling that build's node.exe because the .cmd shim goes through PowerShell,
// and no other platform installs cursor-agent in that layout.
//
//   node eval/parity/parity.mjs --init --stamp S [--from S0] [--tasks t01,t02,t03,t04,t05] [--arms A,C,D,B] [--reps 2] [--tree B=<ref>]...
//   node eval/parity/parity.mjs --tick --stamp S [--budget 585]   run work on both lanes until the budget would be exceeded
//   node eval/parity/parity.mjs --status --stamp S
//   node eval/parity/parity.mjs --rejudge --stamp S               drop every verdict and calibration result; later ticks regrade the saved runs
//   node eval/parity/parity.mjs --judges J1,J3 --exclude J2 --why "..." --stamp S   change the consensus pair; later ticks grade what it lacks
//   node eval/parity/parity.mjs --report --stamp S                rescore and rewrite report.md from saved evidence, no model calls

import { execFileSync, spawn } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { closeSync, cpSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, parse, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { armById, copyable, cursorAgent, judgeCommand, judgeTree, parseTreeOverrides, planTrees, sealViolations, transcriptSource, treeDir, treesOf, withTree, workerCommand } from "./arms.mjs";
import { CONTROL_EXCLUDED, factVerdicts, LEFT_ROWS, promptsMatch } from "./behaviors.mjs";
import { readClaudeTrace } from "./claude-trace.mjs";
import { readCursorTrace } from "./cursor-trace.mjs";
import { consensus, DEFAULT_JUDGE_SET, JUDGES, judgePrompt, parseVerdicts, requestUnits } from "./judge.mjs";
import { MUTATIONS, principleTitles } from "./mutate.mjs";
import { render } from "./packet.mjs";
import { score } from "./score.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
// A turn that waits on its background delegate runs past 500 s (t05, s3); 575 still fits one 585 s tick.
const TURN_TIMEOUT_S = 575;
const JUDGE_TIMEOUT_S = 300;
const MUTANTS_PER_MUTATION = 3;

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const OUT = opt("out", process.env.PARITY_OUT ?? join(tmpdir(), "pstack-parity"));
const SANDBOX_ROOT = opt("sandbox", join(parse(homedir()).root, "pp-parity"));
const stamp = opt("stamp", null);
if (!stamp) {
  console.error("--stamp is required");
  process.exit(2);
}
const E = join(OUT, stamp);
const S = join(SANDBOX_ROOT, stamp);

const readJson = (p, fallback = null) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback);
const writeJson = (p, v) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`);
};
const loadTask = (id) => readJson(join(HERE, "tasks", readdirSync(join(HERE, "tasks")).find((f) => f.startsWith(id))));

// ---------- plan ----------

/**
 * `--from <stamp>` starts from another stamp's finished runs: their evidence
 * is copied and each keeps the sandbox it ran in, so its packets and mutants
 * still rewrite its own paths. A run whose trace was recorded against other
 * prompts than the task file's is not copied, so it is planned fresh. Each
 * arm's tree is its default unless `--tree B=<ref>` names another, and
 * plan.json records it; a source run whose arm ran at a different tree is not
 * copied either. Runs for arms the source lacks are added, and the source's
 * judge set carries over.
 */
function init() {
  if (existsSync(join(E, "plan.json"))) {
    console.log(`plan exists: ${join(E, "plan.json")}`);
    return;
  }
  const taskIds = opt("tasks", "t01,t02,t03,t04,t05").split(",");
  const armIds = opt("arms", "A,C,D,B").split(",");
  const reps = Number(opt("reps", "2"));
  let trees;
  try {
    trees = planTrees(armIds, parseTreeOverrides(args, armIds));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const from = opt("from", null);
  const source = from ? readJson(join(OUT, from, "plan.json")) : null;
  const runs = [];
  let otherTree = 0;
  for (const r of source?.runs ?? []) {
    if (!taskIds.some((t) => r.task.startsWith(t)) || !armIds.includes(r.arm) || r.rep > reps) continue;
    if (!copyable(source, trees, r.arm)) {
      otherTree++;
      continue;
    }
    const trace = readJson(join(OUT, from, "runs", r.key, "trace.json"));
    if (!trace || !promptsMatch(loadTask(r.task), trace)) continue;
    // Verdicts stay behind: the rubric may have changed since the source graded them.
    cpSync(join(OUT, from, "runs", r.key), join(E, "runs", r.key), { recursive: true, filter: (p) => !parse(p).base.startsWith("judge-") });
    runs.push({ ...r, sandbox: r.sandbox ?? source.sandbox });
  }
  const rids = new Set(runs.map((r) => r.rid));
  let next = 1;
  const rid = () => {
    while (rids.has(`r${String(next).padStart(2, "0")}`)) next++;
    rids.add(`r${String(next).padStart(2, "0")}`);
    return `r${String(next).padStart(2, "0")}`;
  };
  for (const t of taskIds) {
    const task = loadTask(t);
    for (let rep = 1; rep <= reps; rep++)
      for (const arm of armIds) {
        const key = `${task.id}.${arm}.${rep}`;
        if (!runs.some((r) => r.key === key)) runs.push({ key, task: task.id, arm, rep, rid: rid(), sandbox: S });
      }
  }
  const claude = execFileSync("claude", ["--version"], { encoding: "utf8" }).trim();
  writeJson(join(E, "plan.json"), {
    stamp,
    sandbox: S,
    from,
    trees,
    runs,
    judges: source?.judges ?? DEFAULT_JUDGE_SET,
    versions: { claude, cursorAgent: cursorAgent().version, ...(source ? { [from]: source.versions } : {}) },
    created: new Date().toISOString(),
  });
  console.log(`planned ${runs.length} runs in ${E} (${runs.filter((r) => r.sandbox !== S).length} copied from ${from ?? "nothing"}, ${otherTree} skipped for a tree mismatch); sandbox ${S}`);
}

const plan = () => readJson(join(E, "plan.json")) ?? (console.error(`no plan at ${E}; run --init`), process.exit(2));
/** @returns {import("./judge.mjs").JudgeSet} */
const judgeSet = () => plan().judges ?? DEFAULT_JUDGE_SET;
const fullJudges = () => [...judgeSet().pair, ...Object.keys(judgeSet().excluded)];

const runDir = (run) => join(E, "runs", run.key);
const sandboxOf = (run) => {
  const root = run.sandbox ?? S;
  return { root, home: join(root, "r", run.rid, "home"), ws: join(root, "r", run.rid, "shop-cart") };
};
const state = (run) => {
  const dir = runDir(run);
  if (existsSync(join(dir, "DONE"))) return { status: "done" };
  if (existsSync(join(dir, "FAILED.json"))) return { status: "failed" };
  const task = loadTask(run.task);
  const next = task.turns.findIndex((t) => !existsSync(join(dir, `turn-${t.index}.json`)));
  return { status: next < 0 ? "finalize" : "turn", next };
};

function runProc(cmd, input, outPath, timeoutS) {
  mkdirSync(dirname(outPath), { recursive: true });
  const out = openSync(outPath, "w");
  const err = openSync(outPath.replace(/\.jsonl$/, ".err"), "w");
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(cmd.file, cmd.args, { cwd: cmd.cwd, env: cmd.env, stdio: ["pipe", out, err], windowsHide: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } catch {
        child.kill("SIGKILL");
      }
    }, timeoutS * 1000);
    child.stdin.end(input);
    const done = (exit) => {
      clearTimeout(timer);
      closeSync(out);
      closeSync(err);
      resolve({ exit, ms: Date.now() - started, timedOut, pid: child.pid });
    };
    child.on("error", () => done(-1));
    child.on("close", (code) => done(code));
  });
}

const streamEvents = (path) =>
  existsSync(path)
    ? readFileSync(path, "utf8")
        .split("\n")
        .flatMap((l) => {
          try {
            return l.trim() ? [JSON.parse(l)] : [];
          } catch {
            return [];
          }
        })
    : [];

const finalText = (path) => streamEvents(path).findLast((e) => e.type === "result")?.result ?? "";

function seedRepo(ws) {
  if (existsSync(join(ws, ".git"))) return;
  const { CART_COMMITS } = SEED;
  mkdirSync(ws, { recursive: true });
  const git = (...a) => execFileSync("git", ["-C", ws, ...a], { stdio: "ignore" });
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Dana Reyes");
  git("config", "user.email", "dana@shop.example");
  for (const [i, c] of CART_COMMITS.entries()) {
    for (const [path, body] of Object.entries(c.files)) {
      mkdirSync(dirname(join(ws, path)), { recursive: true });
      writeFileSync(join(ws, path), body);
    }
    git("add", "-A");
    const date = `2026-0${6 + i}-1${i}T10:00:00Z`;
    execFileSync("git", ["-C", ws, "commit", "-q", "-m", c.message, "--date", date], {
      stdio: "ignore",
      env: { ...process.env, GIT_COMMITTER_DATE: date },
    });
  }
}
const SEED = await import("./seeds/cart.mjs");

const armOf = (run) => withTree(armById[run.arm], treesOf(plan()));

async function turnJob(run, index) {
  const arm = armOf(run);
  const task = loadTask(run.task);
  const dir = runDir(run);
  const { root, home, ws } = sandboxOf(run);
  if (index > 0 && existsSync(join(dir, `turn-${index}.jsonl`))) {
    writeJson(join(dir, "FAILED.json"), { reason: `turn ${index} was torn by an earlier tick`, turn: index });
    return `${run.key} turn ${index}: torn, marked failed`;
  }
  if (index === 0) {
    rmSync(join(root, "r", run.rid), { recursive: true, force: true });
    seedRepo(ws);
  }
  const prev = index > 0 ? readJson(join(dir, `turn-${index - 1}.json`)) : null;
  const session = prev ? prev.session : arm.harness === "claude" ? randomUUID() : null;
  const cmd = workerCommand(arm, { sandbox: root, home, ws, session, first: index === 0 });
  const outPath = join(dir, `turn-${index}.jsonl`);
  const r = await runProc(cmd, task.turns[index].prompt, outPath, TURN_TIMEOUT_S);
  const events = streamEvents(outPath);
  const result = events.findLast((e) => e.type === "result");
  const sessionOut = result?.session_id ?? events.find((e) => e.type === "system" && e.subtype === "init")?.session_id ?? session;
  writeJson(join(dir, `turn-${index}.json`), { ...r, session: sessionOut, isError: Boolean(result?.is_error) });
  if (r.exit !== 0 || r.timedOut || !result || result.is_error)
    writeJson(join(dir, "FAILED.json"), { reason: r.timedOut ? `turn ${index} passed ${TURN_TIMEOUT_S}s` : `turn ${index} exit ${r.exit}${result?.is_error ? " (result is_error)" : ""}`, turn: index });
  else if (index === task.turns.length - 1) finalize(run);
  return `${run.key} turn ${index}: exit ${r.exit} in ${Math.round(r.ms / 1000)}s`;
}

function rootsOf(run) {
  const arm = armOf(run);
  const { root, home, ws } = sandboxOf(run);
  const skills = [join(home, ".claude", "skills"), ...(arm.tree ? [join(treeDir(root, arm.tree), "skills")] : [])];
  return { workspace: ws, skills, home, sandbox: root };
}

function finalize(run) {
  const arm = armOf(run);
  const task = loadTask(run.task);
  const dir = runDir(run);
  const { home, ws } = sandboxOf(run);
  const last = readJson(join(dir, `turn-${task.turns.length - 1}.json`));
  const src = transcriptSource(arm, home, ws, last.session);
  let trace;
  if (arm.harness === "claude") {
    if (!src) return writeJson(join(dir, "FAILED.json"), { reason: "no Claude transcript for the session" });
    cpSync(src.main, join(dir, "transcript", "main.jsonl"));
    if (existsSync(src.children)) cpSync(src.children, join(dir, "transcript", "main"), { recursive: true });
    trace = readClaudeTrace(join(dir, "transcript", "main.jsonl"));
  } else {
    if (src) cpSync(src.transcripts, join(dir, "agent-transcripts"), { recursive: true });
    const streams = task.turns.map((t) => join(dir, `turn-${t.index}.jsonl`));
    trace = readCursorTrace(streams, src ? join(dir, "agent-transcripts") : null);
  }
  if (trace.turns.length !== task.turns.length)
    return writeJson(join(dir, "FAILED.json"), { reason: `trace has ${trace.turns.length} turns, task has ${task.turns.length}` });
  writeJson(join(dir, "trace.json"), trace);
  writeJson(join(dir, "seal.json"), sealViolations(arm, trace));
  const packet = render(trace, rootsOf(run));
  writeFileSync(join(dir, "packet.md"), `${packet.text}\n`);
  writeJson(join(dir, "packet.json"), packet);
  writeFileSync(join(dir, "DONE"), new Date().toISOString());
}

const packetOf = (dir) => readJson(join(dir, "packet.json"));

async function judgeJob(dir, taskId, judge, only = null) {
  const task = loadTask(taskId);
  const packet = packetOf(dir);
  const units = only ?? requestUnits(task, packet);
  const { harness, model } = JUDGES[judge];
  const work = join(S, "j", `${createHash("sha1").update(dir).digest("hex").slice(0, 10)}-${judge}`);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  symlinkSync(judgeTree(S), join(work, "pstack"), "junction");
  writeFileSync(join(work, "packet.md"), readFileSync(join(dir, "packet.md")));
  const outPath = join(dir, `judge-${judge}.jsonl`);
  const r = await runProc(judgeCommand(harness, model, { sandbox: S, dir: work }), judgePrompt(task, packet, units), outPath, JUDGE_TIMEOUT_S);
  // A judge process that died (a quota error, a crash) graded nothing, so no
  // verdict file is written and a later tick retries it.
  if (r.exit !== 0 || r.timedOut) {
    writeJson(join(dir, `judge-${judge}.error.json`), { ...r, err: readFileSync(outPath.replace(/\.jsonl$/, ".err"), "utf8").slice(0, 400) });
    return `${relative(E, dir)} ${judge}: exit ${r.exit}${r.timedOut ? " (timed out)" : ""}, not recorded; see judge-${judge}.error.json`;
  }
  const parsed = parseVerdicts(finalText(outPath), packet, units);
  const readStandard = streamEvents(outPath).some((e) => JSON.stringify(e).includes("poteto-mode") && JSON.stringify(e).includes("SKILL.md") && /Read|readToolCall/.test(JSON.stringify(e)));
  writeJson(join(dir, `judge-${judge}.json`), { ...r, units, readStandard, ...parsed });
  return `${relative(E, dir)} ${judge}: exit ${r.exit}, ${parsed.verdicts.length} kept, ${parsed.dropped.length} dropped in ${Math.round(r.ms / 1000)}s`;
}

const verdictsOf = (dir, j) => readJson(join(dir, `judge-${j}.json`))?.verdicts;

function finalVerdicts(dir, taskId) {
  const set = judgeSet();
  const units = requestUnits(loadTask(taskId), packetOf(dir));
  if (set.pair.some((j) => !verdictsOf(dir, j))) return null;
  const c = consensus(units, Object.fromEntries(["J1", "J2", "J3"].map((j) => [j, verdictsOf(dir, j)])), set);
  return { ...c, pendingTiebreak: c.needsTiebreak.length > 0 && !existsSync(join(dir, `judge-${set.tiebreak}.json`)) };
}

function buildMutants() {
  const marker = join(E, "calib", "PLANNED");
  if (existsSync(marker)) return;
  const titles = principleTitles(readFileSync(join(judgeTree(S), "poteto-mode", "SKILL.md"), "utf8"));
  const made = Object.fromEntries(MUTATIONS.map((m) => [m.id, 0]));
  const keep = new Set();
  const pool = plan().runs.filter((r) => state(r).status === "done");
  for (const run of ["A", "D", "B"].flatMap((arm) => pool.filter((r) => r.arm === arm))) {
    const dir = runDir(run);
    const fin = finalVerdicts(dir, run.task);
    const task = loadTask(run.task);
    const trace = readJson(join(dir, "trace.json"));
    for (const m of MUTATIONS) {
      if (made[m.id] >= MUTANTS_PER_MUTATION) continue;
      const mutant = m.apply(trace, task, titles);
      if (!mutant) continue;
      const base = fin.final.find((f) => f.behavior === mutant.target.behavior && f.unit === mutant.target.unit);
      if (base?.verdict !== "pass") continue;
      const mdir = join(E, "calib", `${run.key}.${m.id}`);
      const packet = render(mutant.trace, rootsOf(run));
      const text = `${packet.text}\n`;
      if (existsSync(join(mdir, "packet.md")) && readFileSync(join(mdir, "packet.md"), "utf8") !== text)
        for (const f of readdirSync(mdir).filter((f) => f.startsWith("judge-"))) rmSync(join(mdir, f));
      mkdirSync(mdir, { recursive: true });
      writeFileSync(join(mdir, "packet.md"), text);
      writeJson(join(mdir, "packet.json"), packet);
      writeJson(join(mdir, "mutant.json"), { run: run.key, task: run.task, mutation: m.id, target: mutant.target, alsoFails: mutant.alsoFails });
      made[m.id]++;
      keep.add(mdir);
    }
  }
  for (const d of mutantDirs().filter((d) => !keep.has(d))) rmSync(d, { recursive: true, force: true });
  writeJson(marker, made);
}

const mutantDirs = () => (existsSync(join(E, "calib")) ? readdirSync(join(E, "calib")).filter((d) => d !== "PLANNED").map((d) => join(E, "calib", d)) : []);

function calibration() {
  const out = {};
  for (const j of fullJudges()) {
    let mutants = 0;
    let hits = 0;
    let pairs = 0;
    let flags = 0;
    for (const mdir of mutantDirs()) {
      const meta = readJson(join(mdir, "mutant.json"));
      const onMutant = verdictsOf(mdir, j);
      const onOriginal = verdictsOf(join(E, "runs", meta.run), j);
      if (!onMutant || !onOriginal) continue;
      mutants++;
      const at = (vs, u) => vs.find((v) => v.behavior === u.behavior && v.unit === u.unit)?.verdict;
      if (at(onMutant, meta.target) === "fail") hits++;
      const exempt = new Set([meta.target, ...meta.alsoFails].map((u) => `${u.behavior} ${u.unit}`));
      for (const v of onOriginal.filter((v) => v.verdict === "pass" && !exempt.has(`${v.behavior} ${v.unit}`))) {
        const now = at(onMutant, v);
        if (!now) continue;
        pairs++;
        if (now === "fail") flags++;
      }
    }
    out[j] = { mutants, detect: mutants ? hits / mutants : 0, pairs, falseFlag: pairs ? flags / pairs : 0 };
  }
  return out;
}

function* candidates(lane) {
  const runs = plan().runs;
  for (const run of runs) {
    if (armById[run.arm].harness !== lane) continue;
    const st = state(run);
    if (st.status === "turn") yield { key: `${run.key}#${st.next}`, timeout: TURN_TIMEOUT_S, go: () => turnJob(run, st.next) };
    if (st.status === "finalize") yield { key: `${run.key}#final`, timeout: 0, go: async () => (finalize(run), `${run.key} finalized`) };
  }
  const set = judgeSet();
  const onLane = (j) => j && JUDGES[j].harness === lane;
  const pair = set.pair.filter(onLane);
  const done = runs.filter((r) => state(r).status === "done");
  for (const run of done) {
    const dir = runDir(run);
    for (const j of pair)
      if (!existsSync(join(dir, `judge-${j}.json`))) yield { key: `${run.key}:${j}`, timeout: JUDGE_TIMEOUT_S, go: () => judgeJob(dir, run.task, j) };
    const fin = onLane(set.tiebreak) ? finalVerdicts(dir, run.task) : null;
    if (fin?.pendingTiebreak) yield { key: `${run.key}:${set.tiebreak}`, timeout: JUDGE_TIMEOUT_S, go: () => judgeJob(dir, run.task, set.tiebreak, fin.needsTiebreak) };
  }
  const unfinished = runs.some((r) => ["turn", "finalize"].includes(state(r).status));
  const allJudged = done.every((r) => finalVerdicts(runDir(r), r.task)?.pendingTiebreak === false);
  if (unfinished || !allJudged) return;
  buildMutants();
  for (const mdir of mutantDirs()) {
    const meta = readJson(join(mdir, "mutant.json"));
    for (const j of pair)
      if (!existsSync(join(mdir, `judge-${j}.json`))) yield { key: `${mdir}:${j}`, timeout: JUDGE_TIMEOUT_S, go: () => judgeJob(mdir, meta.task, j) };
  }
}

async function tick() {
  const budget = Number(opt("budget", "585"));
  const started = Date.now();
  const taken = new Set();
  const busy = new Set();
  const fits = (lane, elapsed) => [...candidates(lane)].some((c) => !taken.has(c.key) && elapsed + c.timeout <= budget);
  const lane = async (name) => {
    const other = name === "cursor" ? "claude" : "cursor";
    for (;;) {
      const elapsed = (Date.now() - started) / 1000;
      const open = [...candidates(name)].filter((c) => !taken.has(c.key));
      const job = open.find((c) => elapsed + c.timeout <= budget);
      if (!job) {
        // Work the other lane is doing or about to start (a run to judge, a
        // judged run to tie-break) can unlock this lane, so an idle lane waits.
        if (open.length || (busy.size === 0 && !fits(other, elapsed))) return;
        await new Promise((r) => setTimeout(r, 15000));
        continue;
      }
      taken.add(job.key);
      busy.add(name);
      const line = await job.go().catch((e) => `${job.key} crashed: ${e.stack}`);
      busy.delete(name);
      console.log(`[${name} +${Math.round(elapsed)}s] ${line}`);
    }
  };
  await Promise.all([lane("cursor"), lane("claude")]);
  status();
}

function status() {
  const runs = plan().runs;
  const by = {};
  for (const r of runs) by[state(r).status] = (by[state(r).status] ?? 0) + 1;
  const judged = runs.filter((r) => state(r).status === "done" && finalVerdicts(runDir(r), r.task)?.pendingTiebreak === false).length;
  const mutants = mutantDirs();
  const mJudged = mutants.filter((m) => judgeSet().pair.every((j) => existsSync(join(m, `judge-${j}.json`)))).length;
  const complete = !runs.some((r) => ["turn", "finalize"].includes(state(r).status)) && judged === by.done && existsSync(join(E, "calib", "PLANNED")) && mJudged === mutants.length;
  console.log(`runs ${JSON.stringify(by)}; judged ${judged}/${by.done ?? 0}; mutants judged ${mJudged}/${mutants.length}${existsSync(join(E, "calib", "PLANNED")) ? "" : " (not planned)"}; ${complete ? "COMPLETE" : "PENDING"}`);
  return complete;
}

// ---------- report ----------

const decidingJudges = (set) => [...set.pair, ...(set.tiebreak ? [set.tiebreak] : [])];

function observations() {
  const obs = [];
  const deciding = decidingJudges(judgeSet());
  for (const run of plan().runs.filter((r) => state(r).status === "done")) {
    const dir = runDir(run);
    const trace = readJson(join(dir, "trace.json"));
    for (const f of factVerdicts(loadTask(run.task), trace)) obs.push({ arm: run.arm, run: run.key, ...f, source: "fact", graders: ["fact"] });
    const kept = Object.fromEntries(deciding.map((j) => [j, verdictsOf(dir, j) ?? []]));
    const fin = finalVerdicts(dir, run.task);
    for (const f of fin?.final ?? []) {
      const graders = deciding.filter((j) => kept[j].some((v) => v.behavior === f.behavior && v.unit === f.unit));
      obs.push({ arm: run.arm, run: run.key, behavior: f.behavior, unit: f.unit, verdict: f.verdict, source: f.source, graders });
    }
  }
  return obs;
}

/** Distinct grader sets over one arm's observations of one behavior, with counts, like `J1+J3 x8`. */
function gradersCell(obs, behavior, arm) {
  const counts = new Map();
  for (const o of obs.filter((o) => o.behavior === behavior && o.arm === arm)) {
    const key = o.graders.length ? o.graders.join("+") : "nobody";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([k, n]) => `${k} x${n}`).join(", ") || "-";
}


/** Every comparison the report makes, reference first, among the arms planned. */
const COMPARISONS = [
  { reference: "A", treatment: "B" },
  { reference: "D", treatment: "B" },
  { reference: "A", treatment: "D" },
];

const pct = (c) => (c.fraction === null ? "-" : `${c.pass}/${c.applicable} (${Math.round(c.fraction * 100)}%)${c.unresolved ? `, ${c.unresolved} split` : ""}`);

function report() {
  const p = plan();
  const set = judgeSet();
  const runs = p.runs;
  const arms = ["A", "C", "D", "B"].filter((a) => runs.some((r) => r.arm === a));
  const pairings = COMPARISONS.filter((c) => arms.includes(c.reference) && arms.includes(c.treatment));
  const obs = observations();
  const seal = runs
    .filter((r) => state(r).status === "done")
    .flatMap((r) => (readJson(join(runDir(r), "seal.json")) ?? []).map((why) => ({ run: r.key, why })));
  const deciding = decidingJudges(set);
  const judgeFiles = runs.flatMap((r) => deciding.map((j) => readJson(join(runDir(r), `judge-${j}.json`))).filter(Boolean));
  const kept = judgeFiles.reduce((n, f) => n + f.verdicts.length, 0);
  const dropped = judgeFiles.reduce((n, f) => n + f.dropped.length, 0);
  const cal = calibration();
  const result = score({
    observations: obs,
    control: { reference: "A", control: "C", exclude: CONTROL_EXCLUDED },
    comparisons: pairings,
    seal,
    consensusJudges: set.pair,
    calibration: cal,
    runs: { total: runs.length, inconclusive: runs.filter((r) => state(r).status === "failed").length },
    judged: { kept, dropped },
  });
  writeJson(join(E, "report.json"), { judges: set, result, calibration: cal, observations: obs });

  const behaviors = [...new Set(obs.map((o) => o.behavior))].sort();
  const cellOf = (b, a) => result.cells.find((c) => c.behavior === b && c.arm === a);
  const name = (j) => `${j} (${JUDGES[j].model})`;
  const L = [];
  L.push(`# Parity smoke report, ${stamp}`, "");
  L.push("| Comparison | Outcome | Short by more than 0.10 | Too few units (under 4 graded on a side) |", "|---|---|---|---|");
  for (const c of result.comparisons) {
    const on = (v) => c.behaviors.filter((b) => b.verdict === v).map((b) => b.behavior).join(", ") || "none";
    L.push(`| ${c.treatment} vs ${c.reference} | **${c.outcome}** | ${on("short")} | ${on("inconclusive")} |`);
  }
  if (result.failedGates.length) L.push("", `Every comparison is INCONCLUSIVE because these gates failed: ${result.failedGates.join(", ")}.`);
  L.push("", "## Arms", "");
  const trees = treesOf(p);
  for (const a of arms) L.push(`- ${a} (${trees[a] ? `tree ${trees[a]}` : "no tree"}): ${armById[a].note}.`);
  L.push(`- Versions: ${p.versions.claude}; cursor-agent ${p.versions.cursorAgent}. Workers on Opus 5.5 medium in both harnesses.`);
  if (p.from) L.push(`- Runs copied from ${p.from} keep their evidence and were regraded here: ${runs.filter((r) => r.sandbox !== p.sandbox).length} of ${runs.length}.`);
  L.push("", "## Judges", "");
  L.push(`- Consensus pair: ${set.pair.map(name).join(" and ")}. They grade every unit; a unit they split on is ${set.tiebreak ? `settled by ${name(set.tiebreak)}` : "left unresolved and counted apart (\"split\" in the table)"}.`);
  for (const [j, why] of Object.entries(set.excluded)) L.push(`- Excluded: ${name(j)}. ${why}`);
  L.push("", "## Validity gates", "", "| Gate | Result | Detail |", "|---|---|---|");
  for (const g of result.gates) L.push(`| ${g.id} | ${g.pass ? "pass" : "FAIL"} | ${g.detail} |`);
  L.push("", "## Per behavior (k/n of graded units, consensus verdicts)", "");
  L.push(`| Behavior | ${arms.join(" | ")} | ${result.comparisons.map((c) => `${c.treatment} vs ${c.reference}`).join(" | ")} |`, `|---|${arms.map(() => "---|").join("")}${result.comparisons.map(() => "---|").join("")}`);
  for (const b of behaviors) {
    const verdicts = result.comparisons.map((c) => {
      const v = c.behaviors.find((x) => x.behavior === b).verdict;
      return v === "short" ? "**short**" : v;
    });
    L.push(`| ${b} | ${arms.map((a) => pct(cellOf(b, a))).join(" | ")} | ${verdicts.join(" | ")} |`);
  }
  L.push("", "Wilson 95% intervals are in report.json. n is small by design at the smoke stage.", "");
  L.push("## Who graded each cell", "", `| Behavior | ${arms.join(" | ")} |`, `|---|${arms.map(() => "---|").join("")}`);
  for (const b of behaviors) L.push(`| ${b} | ${arms.map((a) => gradersCell(obs, b, a)).join(" | ")} |`);
  L.push("");
  for (const [j, why] of Object.entries(set.excluded)) L.push(`- ${name(j)} graded no cell. Reason from plan.json: ${why}`);
  if (Object.keys(set.excluded).length) L.push("");
  L.push("## Judge calibration (seeded mutations over A, D and B packets)", "", "| Judge | Role | Mutants | Detect | Untouched pairs | False flags |", "|---|---|---|---|---|---|");
  for (const [j, c] of Object.entries(cal))
    L.push(
      c.mutants
        ? `| ${name(j)} | ${set.pair.includes(j) ? "pair" : "excluded"} | ${c.mutants} | ${c.detect.toFixed(2)} | ${c.pairs} | ${c.falseFlag.toFixed(2)} |`
        : `| ${name(j)} | ${set.pair.includes(j) ? "pair" : "excluded"} | not run in this stamp | - | - | - |`,
    );
  L.push("");
  for (const mdir of mutantDirs()) {
    const m = readJson(join(mdir, "mutant.json"));
    const got = fullJudges()
      .filter((j) => verdictsOf(mdir, j))
      .map((j) => `${j} ${verdictsOf(mdir, j).find((v) => v.behavior === m.target.behavior && v.unit === m.target.unit)?.verdict ?? "missing"}`);
    L.push(`- ${m.mutation} on ${m.run} targets ${m.target.behavior} ${m.target.unit}: ${got.join(", ")}.`);
  }
  for (const arm of ["B", "D"].filter((a) => arms.includes(a))) {
    L.push("", `## Failing ${arm} units, with the events the judges cited`, "");
    for (const o of obs.filter((o) => o.arm === arm && o.verdict === "fail")) {
      const dir = runDir(runs.find((r) => r.key === o.run));
      const cites = deciding.flatMap((j) => (verdictsOf(dir, j) ?? []).filter((v) => v.behavior === o.behavior && v.unit === o.unit && v.verdict === "fail").map((v) => `${j}: ${v.evidence.map((e) => e.event).join(",")} (${v.why})`));
      L.push(`- ${o.run} ${o.behavior} ${o.unit} [${o.source}]: [packet](runs/${o.run}/packet.md). ${cites.join(" ")}`);
    }
  }
  L.push("", "## Runs", "", "| Run | Arm | Status | Packet | Seal |", "|---|---|---|---|---|");
  for (const r of runs) {
    const st = state(r).status;
    const stale = st === "done" && !promptsMatch(loadTask(r.task), readJson(join(runDir(r), "trace.json")));
    const why = st === "failed" ? readJson(join(runDir(r), "FAILED.json")).reason : "";
    const sealN = (readJson(join(runDir(r), "seal.json")) ?? []).length;
    L.push(`| ${r.key} | ${r.arm} | ${stale ? "done (recorded against an earlier prompt)" : st}${why ? `: ${why}` : ""} | ${st === "done" ? `[packet](runs/${r.key}/packet.md)` : "-"} | ${st === "done" ? (sealN ? `${sealN} violations` : "sealed") : "-"} |`);
  }
  L.push("", "## Not scored at the smoke stage", "");
  for (const l of LEFT_ROWS) L.push(`- ${l.row}: ${l.why}.`);
  const review = join(E, "review.md");
  if (existsSync(review)) L.push("", readFileSync(review, "utf8").trim());
  writeFileSync(join(E, "report.md"), `${L.join("\n")}\n`);
  console.log(`wrote ${join(E, "report.md")}: ${result.comparisons.map((c) => `${c.treatment} vs ${c.reference} ${c.outcome}`).join("; ")}`);
  return result;
}

function rejudge() {
  for (const run of plan().runs) for (const j of ["J1", "J2", "J3"]) for (const ext of ["json", "jsonl", "err"]) rmSync(join(runDir(run), `judge-${j}.${ext}`), { force: true });
  rmSync(join(E, "calib"), { recursive: true, force: true });
  console.log("dropped every verdict and the calibration set; the next ticks regrade the saved runs");
}

function setJudges() {
  const p = plan();
  const before = p.judges ?? DEFAULT_JUDGE_SET;
  const pair = opt("judges", "").split(",");
  const out = opt("exclude", null);
  if (pair.length !== 2 || !pair.every((j) => j in JUDGES) || (out && !(out in JUDGES))) {
    console.error("--judges takes two of J1,J2,J3; --exclude takes one");
    process.exit(2);
  }
  const next = { pair, tiebreak: opt("tiebreak", null), excluded: out ? { ...before.excluded, [out]: opt("why", "excluded") } : before.excluded };
  for (const j of pair.filter((j) => j === before.tiebreak))
    for (const d of [...p.runs.map(runDir), ...mutantDirs()]) for (const ext of ["json", "jsonl", "err"]) rmSync(join(d, `judge-${j}.${ext}`), { force: true });
  rmSync(join(E, "calib", "PLANNED"), { force: true });
  writeJson(join(E, "plan.json"), { ...p, judges: next });
  console.log(`judges now ${JSON.stringify(next)}`);
}

if (flag("init")) init();
else if (flag("tick")) await tick();
else if (flag("status")) status();
else if (flag("rejudge")) rejudge();
else if (flag("judges")) setJudges();
else if (flag("report")) report();
else console.error("one of --init, --tick, --status, --rejudge, --judges, --report");
