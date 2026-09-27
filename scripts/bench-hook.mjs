#!/usr/bin/env node
// Usage: node scripts/bench-hook.mjs [--runs N] [--repo <dir>] [--root <checkout>]... [--json <out>] <transcript.jsonl>...
// Times the hook on each transcript for a commit claim, a plain Bash call and its PostToolUse, an Edit and a Stop,
// in-process through respond() and as the whole hook process, and splits the in-process time by phase.
// Each --root is a checkout whose hook is timed (default this one), sampled in turn so machine load hits each alike.
// Both columns run under a scratch HOME, so the hook's logs, markers and trace cache never reach ~/.claude.
// The in-process column starts the claim's git the way main() does when the checkout exports `prefetched`.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = join(dirname(fileURLToPath(import.meta.url)), "..").replaceAll("\\", "/");
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(name);
  return at < 0 ? fallback : args.splice(at, 2)[1];
};
const flags = (name) => {
  const out = [];
  for (let at = args.indexOf(name); at >= 0; at = args.indexOf(name)) out.push(args.splice(at, 2)[1]);
  return out;
};
const runs = Number(flag("--runs", "10"));
const claimRepo = flag("--repo", here);
const jsonOut = flag("--json", null);
const roots = flags("--root").map((r) => r.replaceAll("\\", "/"));
if (!roots.length) roots.push(here);
const transcripts = args;
if (!transcripts.length) throw new Error("name at least one transcript");

const hookOf = (root) => join(root, "skills", "poteto-mode", "hooks", "pstack-hook.mjs");
const load = async (root) => ({
  root,
  hook: await import(pathToFileURL(hookOf(root)).href),
  trace: await import(pathToFileURL(join(root, "skills", "poteto-mode", "hooks", "trace.mjs")).href),
});
const home = mkdtempSync(join(tmpdir(), "bench-hook-home-"));
// The hook fixes its cache and log paths from the home directory when it loads, so the home moves before it does.
process.env.HOME = home;
process.env.USERPROFILE = home;
const checkouts = await Promise.all(roots.map(load));
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const EVENTS = {
  commit: { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: `git -C ${claimRepo} commit -m "bench"` } },
  bash: { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: `ls ${claimRepo}` } },
  "bash-post": { hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: `ls ${claimRepo}` } },
  edit: { hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: `${claimRepo}/scripts/drift.mjs`, old_string: "a", new_string: "b" } },
  stop: { hook_event_name: "Stop" },
};

const payload = (name, transcript) => ({
  session_id: "bench-hook",
  transcript_path: transcript,
  cwd: dirname(claimRepo),
  tool_use_id: "toolu_bench",
  ...EVENTS[name],
});

const wall = (fn) => {
  const t = performance.now();
  fn();
  return performance.now() - t;
};

const timed = (phases, key, fn) => (...a) => {
  const t = performance.now();
  try {
    return fn(...a);
  } finally {
    phases[key] = (phases[key] ?? 0) + performance.now() - t;
  }
};

function inProcess({ hook }, name, transcript) {
  const phases = {};
  const nulls = { count: 0 };
  const t0 = performance.now();
  const ev = hook.parseEvent(payload(name, transcript));
  const live = hook.prefetched ? hook.liveDeps(hook.prefetched(ev)) : hook.liveDeps();
  const deps = {
    ...live,
    mark: () => {},
    raw: timed(phases, "read", live.raw),
    trace: timed(phases, "trace", live.trace),
    catalog: timed(phases, "catalog", live.catalog),
    models: timed(phases, "models", live.models),
    skips: timed(phases, "skips", live.skips),
    // A checkout from before the one-shot asks reads git and the project through `fs`; a later one has none.
    ...(live.fs && { fs: {
      ...live.fs,
      // A null answer comes from a dir outside any repo or from a git that missed its budget, which the surface check reads as nothing changed.
      changed: timed(phases, "git", (dir, scope) => {
        const paths = live.fs.changed(dir, scope);
        if (paths === null) nulls.count++;
        return paths;
      }),
      read: timed(phases, "fs", live.fs.read),
      list: timed(phases, "fs", live.fs.list),
      files: timed(phases, "fs", live.fs.files),
    } }),
  };
  const out = hook.respond(ev, deps);
  const total = performance.now() - t0;
  const accounted = Object.values(phases).reduce((a, b) => a + b, 0);
  return { total, phases: { ...phases, rules: total - accounted, "git null answers": nulls.count }, out: out?.kind ?? "none" };
}

const bareNode = () => wall(() => spawnSync(process.execPath, ["-e", "0"]));

// A bare `node -e 0` runs beside every hook process, because on a loaded machine process start alone swings by seconds.
function wholeProcess({ root }, name, transcript) {
  const start = bareNode();
  let r;
  const t = wall(() => {
    r = spawnSync(process.execPath, [hookOf(root)], { input: JSON.stringify(payload(name, transcript)), env: { ...process.env, HOME: home, USERPROFILE: home }, encoding: "utf8" });
  });
  if (r.status !== 0) throw new Error(`hook exited ${r.status}: ${r.stderr}`);
  return { wall: t, overStart: t - start };
}

const nodeStart = median(Array.from({ length: runs }, bareNode));

const rows = [];
for (const transcript of transcripts) {
  const text = checkouts[0].hook.liveDeps().raw(transcript);
  for (const name of Object.keys(EVENTS)) {
    const samples = checkouts.map(() => ({ respond: [], whole: [], main: [] }));
    for (let i = 0; i < runs; i++)
      checkouts.forEach((c, k) => {
        samples[k].respond.push(inProcess(c, name, transcript));
        samples[k].main.push(wall(() => c.trace.readClaudeTrace(transcript, { spawns: () => new Set(), text })));
        samples[k].whole.push(wholeProcess(c, name, transcript));
      });
    checkouts.forEach((c, k) => {
      const s = samples[k];
      const keys = [...new Set(s.respond.flatMap((x) => Object.keys(x.phases)))];
      const phases = Object.fromEntries(keys.map((key) => [key, median(s.respond.map((x) => x.phases[key] ?? 0))]));
      if (phases.trace !== undefined) phases["trace:main"] = Math.min(median(s.main), phases.trace);
      rows.push({
        root: c.root,
        transcript,
        event: name,
        out: s.respond[0].out,
        respond: median(s.respond.map((x) => x.total)),
        process: median(s.whole.map((w) => w.wall)),
        overStart: median(s.whole.map((w) => w.overStart)),
        phases,
      });
    });
  }
}

const ms = (x) => `${Math.round(x)}`;
console.log(`runs ${runs}, bare node start ${ms(nodeStart)} ms median, claim repo ${claimRepo}`);
console.log("trace:main is the part of trace spent on the transcript itself; the rest of trace reads subagent files.\n");
console.log("| checkout | transcript | event | out | process ms | process over node start ms | respond ms | phases (ms, median) |\n|---|---|---|---|---|---|---|---|");
for (const r of rows) {
  const phases = Object.entries(r.phases)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `${k} ${ms(v)}`)
    .join(", ");
  console.log(`| ${r.root.split("/").at(-1)} | ${r.transcript.replaceAll("\\", "/").split("/").at(-1)} | ${r.event} | ${r.out} | ${ms(r.process)} | ${ms(r.overStart)} | ${ms(r.respond)} | ${phases} |`);
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ runs, nodeStart, claimRepo, roots, rows }, null, 2));
