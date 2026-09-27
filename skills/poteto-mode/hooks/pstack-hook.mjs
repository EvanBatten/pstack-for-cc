#!/usr/bin/env node
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { check, note, spanOf } from "./asks.mjs";
import { judgeFloor, ledger, list, loadCatalog, modelsFile, modelTable, playbookRead, skipsFileLines, STANDING_WAIVABLE } from "./catalog.mjs";
import { blockText, gate, previousStop, retryUnmet, stopView } from "./gate.mjs";
import { baseName, GIT_WRITES, gitBashPath, inRepo, isIgnored, MODEL_TIERS, READER_WRAPPERS, WRITE_COMMANDS } from "./kinds.mjs";
import { modeOf, NOT_A_PROMPT, readClaudeTrace, toAction } from "./trace.mjs";
import { cachedParse, prune } from "./trace-cache.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const MODE_COMMAND = "<command-name>/poteto-mode</command-name>";
const STOP_BUDGET_MS = 1500;
// A sixth of the 30 s hook timeout, so a slow run shows in the log long before Claude Code cancels one.
export const HOOK_BUDGET_MS = 5000;
const TRACE_CACHE = join(homedir(), ".claude", "pstack", "trace-cache");
const TRACE_CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
// In `claude -p` and for a parent agent only the last message arrives, so the
// reply to a block must be the whole answer again, not a note to the hook.
const BLOCK_CLOSING = {
  Stop: "Then reply again with your complete final answer, with the findings fixed and no mention of this gate.",
  SubagentStop: "Your parent receives only this final message, so reply again with your complete final report, with the findings fixed and no mention of this gate.",
};

/**
 * @typedef {{ sessionId: string | null, cwd: string | null } & (
 *   | { event: "SessionStart", transcript: string | null }
 *   | { event: "SessionEnd" }
 *   | { event: "SubagentStart", transcript: string | null, agentType: string }
 *   | { event: "UserPromptSubmit", transcript: string | null, prompt: string }
 *   | { event: "PreToolUse" | "PostToolUse", transcript: string | null, agentType: string | null, agentId: string | null, action: import("./trace.mjs").Action, input: any }
 *   | { event: "Stop" | "SubagentStop", transcript: string, agentType: string | null, backgroundTasks: { id: string, type: string }[] | null, stopHookActive: boolean }
 * )} HookEvent
 *
 * @typedef {(
 *   | { kind: "context", event: string, text: string, notice?: string }
 *   | { kind: "block", reason: string }
 *   | { kind: "observe", reason: string }
 *   | { kind: "deny", reason: string }
 *   | { kind: "rewrite", input: any }
 * )} HookOutput
 *
 * @typedef {{
 *   skills: string,
 *   models: () => { path: string, text: string },
 *   catalog: () => import("./catalog.mjs").Catalog,
 *   raw: (path: string) => string,
 *   trace: typeof readClaudeTrace,
 *   gate: "enforce" | "observe" | "off",
 *   mark: (sessionId: string, on: boolean) => void,
 *   log: (file: string, line: string) => void,
 *   fs: import("./asks.mjs").Disk,
 *   skips: (cwd: string | null) => { user: SkipsFile | null, project: SkipsFile | null },
 * }} Deps
 * @typedef {{ path: string, bytes: Uint8Array }} SkipsFile
 */

/** @param {any} raw @returns {HookEvent | null} */
export function parseEvent(raw) {
  const transcript = typeof raw.transcript_path === "string" && raw.transcript_path ? raw.transcript_path : null;
  const agentType = typeof raw.agent_type === "string" ? raw.agent_type : null;
  const sessionId = typeof raw.session_id === "string" && raw.session_id ? raw.session_id : null;
  const cwd = typeof raw.cwd === "string" && raw.cwd ? raw.cwd : null;
  const event = raw.hook_event_name ?? "SessionStart";
  if (event === "SessionStart") return { event, sessionId, cwd, transcript };
  if (event === "SessionEnd") return { event, sessionId, cwd };
  if (event === "SubagentStart") return { event, sessionId, cwd, transcript, agentType: agentType ?? "" };
  if (event === "UserPromptSubmit") return { event, sessionId, cwd, transcript, prompt: String(raw.prompt ?? "") };
  if (event === "PreToolUse" || event === "PostToolUse") {
    const action = toAction({ id: String(raw.tool_use_id ?? ""), name: String(raw.tool_name ?? ""), input: raw.tool_input });
    const agentId = typeof raw.agent_id === "string" ? raw.agent_id : null;
    const located = action.kind === "shell" && cwd ? { ...action, cwd } : action;
    return { event, sessionId, cwd, transcript, agentType, agentId, action: { ...located, ok: event === "PostToolUse" ? true : null }, input: raw.tool_input };
  }
  if (event === "Stop" || event === "SubagentStop") {
    const path = event === "Stop" ? transcript : raw.agent_transcript_path;
    if (!path) return null;
    return { event, sessionId, cwd, transcript: path, agentType, backgroundTasks: Array.isArray(raw.background_tasks) ? raw.background_tasks : null, stopHookActive: raw.stop_hook_active === true };
  }
  return null;
}

const slashed = (p) => p.replaceAll("\\", "/").replace(/(?<=.)\/+$/, "");

const rootKey = (p) => gitBashPath(slashed(p)).replace(/^\/([A-Za-z])(?=\/|$)/, (_, d) => `/${d.toLowerCase()}`);

/**
 * @typedef {{
 *   active: { name: string, reason: string, from: string }[],
 *   ignored: { name: string, from: string, why: "not waivable" }[],
 *   untrusted: { path: string, sha256: string, trustLine: string }[],
 * }} Standing
 * @param {string | null} cwd @param {Deps} deps @returns {Standing}
 */
function standingOf(cwd, deps) {
  const { user, project } = deps.skips(cwd);
  const decode = (bytes) => new TextDecoder().decode(bytes);
  const own = user ? skipsFileLines(decode(user.bytes)) : { skips: [], trusts: [] };
  const counted = user ? [{ from: slashed(user.path), skips: own.skips }] : [];
  const untrusted = [];
  const theirs = project && cwd ? skipsFileLines(decode(project.bytes)).skips : [];
  if (theirs.length) {
    const sha256 = createHash("sha256").update(project.bytes).digest("hex");
    if (own.trusts.some((t) => rootKey(t.root) === rootKey(cwd) && t.sha256 === sha256)) counted.push({ from: slashed(project.path), skips: theirs });
    else untrusted.push({ path: slashed(project.path), sha256, trustLine: `trust ${slashed(cwd)} ${sha256}` });
  }
  const named = counted.flatMap(({ from, skips }) => skips.map((s) => ({ ...s, name: s.name.toLowerCase(), from })));
  return {
    active: named.filter((s) => STANDING_WAIVABLE.includes(s.name)),
    ignored: named.filter((s) => !STANDING_WAIVABLE.includes(s.name)).map(({ name, from }) => ({ name, from, why: "not waivable" })),
    untrusted,
  };
}

const isEmpty = (standing) => !standing.active.length && !standing.ignored.length && !standing.untrusted.length;

const standingLines = (standing) =>
  [
    ...(standing.active.length ? ["Active in every mode span, by name alone:", ...standing.active.map((s) => `- \`skip ${s.name}: ${s.reason}\` from \`${s.from}\``)] : []),
    ...(standing.ignored.length
      ? [`Ignored, since a standing skip may waive only ${list(STANDING_WAIVABLE)}:`, ...standing.ignored.map((s) => `- \`skip ${s.name}:\` from \`${s.from}\``)]
      : []),
    ...(standing.untrusted.length
      ? [
          "Not trusted, so none of its lines count:",
          ...standing.untrusted.map((u) => `- \`${u.path}\`. To trust this version, add this line to \`~/.claude/pstack-skips.md\`: \`${u.trustLine}\``),
        ]
      : []),
    "",
  ].join("\n");

const standingSection = (standing) =>
  isEmpty(standing) ? "None. The user's `~/.claude/pstack-skips.md` and the project's `.claude/pstack-skips.md` hold none.\n" : standingLines(standing);

const STEP_AWAY = /\b(going to bed|overnight|autonomous(ly)?|unattended|until done|run until|review (it |this |them )?later|while i'?m (away|out|gone)|when i'?m back|step(ping)? away)\b/i;
const STEP_AWAY_REMINDER = "- This request reads as work the user reviews after stepping away, so route it through figure-it-out.\n";

// The rules the scored sessions broke most, in poteto-mode's words where it has them.
const mostMissed = (skills) => `- Keep each task item's state current, in_progress when you start it and completed when it is done.
- Write a skipped step's \`skip: <reason>\` on its task item, not only in narration.
- For a fix or a verification, read \`${skills}/poteto-mode/principles/prove-it-works.md\` in full.
- Every claim carries its evidence or its label in the same sentence. Measured, inferred, or guess.
- For a bug fix, paste the failing output and then the passing output verbatim.
- Use no long dash and no mid-sentence colon connector in any visible text.
`;

/** @param {string | null} entry the `/poteto-mode` arguments on the prompt that enters the mode */
const reminder = (skills, entry = null) => `# pstack reminders
Poteto mode is live in this session. Before the next reply:

- Name each principle that shaped a decision and the choice it changed. Read \`${skills}/poteto-mode/principles/<slug>.md\` in full before citing it.
- A trigger that names a skill (the **how** skill, \`/architect\`, \`interrogate\`, \`swarm\`) means read that skill's \`SKILL.md\` in full and carry it out. Skimming it does not satisfy the trigger. Choosing not to run it is a \`skip: <reason>\` line in the step list.
- Open a task list with TaskCreate (a deferred tool, loaded through ToolSearch) whose first items are the matched playbook's steps, verbatim, each with its state. Where no task tool exists, carry them as a verbatim list in the reply.
${entry !== null && STEP_AWAY.test(entry) ? STEP_AWAY_REMINDER : ""}
Rules most often missed:
${mostMissed(skills)}
A casual turn, or the user opting out, cancels all of this.
`;

function sessionContext(transcript, standing, deps) {
  const models = deps.models();
  // win32 splits on both separators, so a Windows or a POSIX path parses on any OS.
  const transcripts = transcript ? win32.dirname(transcript).replaceAll("\\", "/") : "~/.claude/projects/<slug>/";
  const table = models.text
    .split(/\r?\n/)
    .filter((l) => !l.startsWith("#"))
    .join("\n")
    .trim();
  const flags = judgeFloor(models.text).map((f) => `\`${f.role}: ${f.value}\` is below the judge floor. Spawn that judge with model omitted.\n`);
  const belowFloor = flags.length ? `\n${flags.join("")}` : "";
  return `# pstack session context

pstack skills directory (\`<skills>\` below): \`${deps.skills}\`
Transcript directory for this workspace: \`${transcripts}\` (one \`<session-id>.jsonl\` per chat, subagents under \`<session-id>/subagents/\`).
Orchestrate store root: \`~/.claude/orchestrate/\`. A program keeps its store at \`<root>/<project-slug>\` and passes it as \`orch --store\`.

## Resolving pstack skills

Most pstack skills are user-invoked, so the Skill tool refuses them. When a pstack skill or playbook names another (the **how** skill, \`/architect\`, \`control-ui\`), Read \`<skills>/<name>/SKILL.md\` in full and carry out its steps. A trigger that names a skill is an instruction to run it, not a pointer to skim. \`principle-<slug>\` is the file \`<skills>/poteto-mode/principles/<slug>.md\`. Relative paths inside a skill resolve against its own directory. Subagents get this same context.

## Tool mapping

- A \`Task\` or subagent spawn is the Agent tool. \`poteto-agent\` is \`subagent_type: "poteto-agent"\` and Comment Sicko is \`subagent_type: "comment-sicko"\`.
- Model values below are Agent \`model\` aliases. pstack's tiers, strongest first, are ${list(MODEL_TIERS.map((t) => `\`${t}\``))}. \`inherit-parent\` or \`auto\` omits \`model\`.

## Standing skips

${standingSection(standing)}
## Model configuration (from \`${models.path.replaceAll("\\", "/")}\`)

${table}
${belowFloor}`;
}

/** The delegates an actor spawned in its mode span, whose reads count as its own. */
const spanSpawns = (root) => {
  const { on, since } = modeOf(root);
  return new Set(on ? root.turns.filter((t) => t.index >= since).flatMap((t) => t.actions.flatMap((a) => (a.kind === "spawn" ? [a.id] : []))) : []);
};

function traceInMode(transcript, deps, spawns = () => new Set()) {
  const text = transcript ? deps.raw(transcript) : "";
  if (!text.includes(MODE_COMMAND)) return null;
  const trace = deps.trace(transcript, { spawns, text });
  return modeOf(trace).on ? trace : null;
}

// Inside a subagent the payload names the parent session and the agent's id (measured on 2.1.281).
function actorInMode(ev, deps) {
  if (!ev.agentType) return traceInMode(ev.transcript, deps, spanSpawns);
  if (ev.agentType !== "poteto-agent") return null;
  // With no agent id the hook cannot find the transcript that holds its tags, so an ask could never be spent.
  if (!ev.agentId || !ev.transcript) return null;
  const path = join(dirname(ev.transcript), basename(ev.transcript, ".jsonl"), "subagents", `agent-${ev.agentId}.jsonl`);
  return deps.trace(path, { spawns: spanSpawns, text: deps.raw(path) });
}

const MODE_PROMPT = /^\s*\/poteto-mode(?:\s+([\s\S]*))?$/;

const SKIPS_FILE = "pstack-skips.md";
const SKIPS_OWNED =
  "Standing skips are the user's to write. `pstack-skips.md` waives pstack's asks in every mode span, so an agent that writes it excuses itself. Ask the user to add the `skip <name>: <reason>` line.";

const HARMLESS_REDIRECT = /[0-9&]?>>?\s*\/dev\/null\b|[0-9]?>&[0-9-]/g;

export function writeShaped(command) {
  const bare = command.replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, "''");
  if (bare.replace(HARMLESS_REDIRECT, "").includes(">")) return "a redirect writes a file";
  for (const statement of bare.split(/&&|\|\||[;|\n&]/)) {
    let words = statement.trim().split(/\s+/).filter(Boolean);
    while (words.length && (/^\w+=/.test(words[0]) || READER_WRAPPERS.includes(words[0]))) words = words.slice(1);
    const [verb = "", ...rest] = words;
    if (WRITE_COMMANDS.includes(verb)) return `\`${verb}\` changes files`;
    if (verb === "sed" && rest.some((w) => /^-[a-zA-Z]*i/.test(w) || w === "--in-place")) return "`sed -i` edits files in place";
    if (verb === "git") {
      const sub = rest.find((w, i) => !w.startsWith("-") && !/^-[Cc]$/.test(rest[i - 1] ?? ""));
      if (sub && GIT_WRITES.includes(sub)) return `\`git ${sub}\` changes the repository`;
    }
  }
  return null;
}

/** A write into a standing-skips file: an edit tool on its path, or a shell command that names it and writes. */
const writesSkips = (action) =>
  action.kind === "write"
    ? baseName(action.path).toLowerCase() === SKIPS_FILE
    : action.kind === "shell" && action.command.toLowerCase().includes(SKIPS_FILE) && Boolean(writeShaped(action.command));

/**
 * @param {HookEvent} ev
 * @param {Deps} deps
 * @returns {HookOutput | null}
 */
export function respond(ev, deps) {
  // A subagent's payload carries its parent's session id, so only the session's own events move the marker.
  const mark = (on) => {
    if (ev.sessionId && !("agentType" in ev && ev.agentType)) deps.mark(ev.sessionId, typeof on === "function" ? on() : on);
  };
  const waived = () => new Set(standingOf(ev.cwd, deps).active.map((s) => s.name));
  switch (ev.event) {
    case "SessionStart": {
      mark(() => Boolean(traceInMode(ev.transcript, deps)));
      const standing = standingOf(ev.cwd, deps);
      // A systemMessage reaches the user and not the model (probe fact 13), which is who must see what waives pstack.
      const notice = isEmpty(standing) ? {} : { notice: `pstack standing skips\n${standingLines(standing)}` };
      return { kind: "context", event: ev.event, text: sessionContext(ev.transcript, standing, deps), ...notice };
    }
    case "SessionEnd":
      mark(false);
      return null;
    case "SubagentStart": {
      const text = sessionContext(ev.transcript, standingOf(ev.cwd, deps), deps);
      const resident = ev.agentType === "poteto-agent" || ev.agentType === "pstack-reader";
      return { kind: "context", event: ev.event, text: resident ? `${text}\n${reminder(deps.skills)}` : text };
    }
    case "UserPromptSubmit": {
      if (NOT_A_PROMPT.test(ev.prompt)) return null;
      const command = ev.prompt.match(MODE_PROMPT);
      const on = command ? (command[1] ?? "").trim().toLowerCase() !== "off" : Boolean(traceInMode(ev.transcript, deps));
      mark(on);
      return on ? { kind: "context", event: ev.event, text: reminder(deps.skills, command ? (command[1] ?? "") : null) } : null;
    }
    case "PostToolUse": {
      const catalog = deps.catalog();
      const names = playbookRead(ev.action, catalog);
      if (ev.action.kind !== "shell" && !names.length) return null;
      const actor = actorInMode(ev, deps);
      mark(Boolean(actor));
      // A poteto-agent is always in the mode, so it gets the ledger even when its transcript cannot be found.
      if (!actor && ev.agentType !== "poteto-agent") return null;
      const noted = actor && ev.action.kind === "shell" ? note(spanOf(actor, ev.action.id || null, waived(), catalog), ev.action, catalog, modelTable(deps.models()), deps.fs) : null;
      const text = [...names.map((n) => ledger(n, catalog)), ...(noted ? [noted.text] : [])].join("\n");
      return text ? { kind: "context", event: ev.event, text } : null;
    }
    case "Stop":
    case "SubagentStop": {
      if (deps.gate === "off") return null;
      if (ev.event === "SubagentStop" && ev.agentType !== "poteto-agent") return null;
      const actor = ev.event === "Stop" ? traceInMode(ev.transcript, deps, spanSpawns) : deps.trace(ev.transcript, { spawns: spanSpawns });
      if (ev.event === "Stop") mark(Boolean(actor));
      const view = actor && modeOf(actor).on ? stopView(actor) : null;
      if (!view) return null;
      const catalog = deps.catalog();
      const models = modelTable(deps.models());
      const span = spanOf(actor, null, waived(), catalog);
      for (const line of retryUnmet(actor, span, catalog, models, deps.fs)) deps.log("retry-unmet.log", `${ev.transcript} ${line}`);
      const found = gate(span, view, catalog, ev.backgroundTasks);
      // A stop the hook re-entered passes on the tags its previous stop would have blocked, whether or not that block reached the transcript.
      const before = ev.stopHookActive && found.length ? previousStop(actor) : null;
      // With nothing to compare against, a re-entered stop passes, since the same block could repeat with no cap.
      if (ev.stopHookActive && found.length && !before) return null;
      const again = before ? gate(spanOf(before, null, waived(), catalog), stopView(before), catalog, ev.backgroundTasks).map((f) => f.id) : [];
      const findings = found.filter((f) => !again.includes(f.id));
      if (!findings.length) return null;
      return { kind: deps.gate === "observe" ? "observe" : "block", reason: `${blockText(findings)}\n${BLOCK_CLOSING[ev.event]}` };
    }
    case "PreToolUse": {
      // Agent frontmatter hooks do not fire for agent files (measured on
      // 2.1.281), so the reader's guard is this global registration.
      const why = ev.action.kind === "shell" && ev.agentType === "pstack-reader" && writeShaped(ev.action.command);
      if (why) return { kind: "deny", reason: `pstack-reader is read-only: ${why}. Report what you would change instead.` };
      if (writesSkips(ev.action)) return { kind: "deny", reason: SKIPS_OWNED };
      const actor = actorInMode(ev, deps);
      mark(Boolean(actor));
      if (!actor) return null;
      const catalog = deps.catalog();
      const verdict = check(spanOf(actor, ev.action.id || null, waived(), catalog), ev.action, catalog, modelTable(deps.models()), deps.fs);
      if (verdict.kind === "deny") return { kind: "deny", reason: verdict.reason };
      if (verdict.kind === "rewrite") return { kind: "rewrite", input: { ...ev.input, prompt: verdict.prompt } };
      return null;
    }
  }
  return null;
}

/** @param {HookOutput} out @returns {string} */
export function serialize(out) {
  if (out.kind === "context")
    return JSON.stringify({ ...(out.notice ? { systemMessage: out.notice } : {}), hookSpecificOutput: { hookEventName: out.event, additionalContext: out.text } });
  if (out.kind === "block") return JSON.stringify({ decision: "block", reason: out.reason });
  if (out.kind === "deny") return JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: out.reason } });
  if (out.kind === "rewrite") return JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", updatedInput: out.input } });
  return "";
}

const log = (file, line) => {
  const dir = join(homedir(), ".claude", "pstack");
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, file), `${new Date().toISOString()} ${line}\n`);
};

/** @returns {Deps} */
export function liveDeps() {
  const skills = join(homedir(), ".claude", "skills").replaceAll("\\", "/");
  const gateMode = process.env.PSTACK_GATE;
  let catalog;
  const parse = cachedParse(TRACE_CACHE);
  return {
    skills,
    models: () => modelsFile(join(skills, "poteto-mode", "pstack-models.md")),
    catalog: () => (catalog ??= loadCatalog(join(here, "..", ".."))),
    // The first UserPromptSubmit of a session fires before its transcript exists.
    raw: (path) => (existsSync(path) ? readFileSync(path, "utf8") : ""),
    trace: (path, options) => readClaudeTrace(path, { ...options, parse }),
    gate: gateMode === "observe" || gateMode === "off" ? gateMode : "enforce",
    log,
    fs: { inRepo: (file) => inRepo(file), ignored: (file) => isIgnored(file) },
    skips: (cwd) => {
      const file = (path) => {
        try {
          return { path, bytes: readFileSync(path) };
        } catch {
          return null;
        }
      };
      const user = join(homedir(), ".claude", SKIPS_FILE);
      const project = cwd ? join(cwd, ".claude", SKIPS_FILE) : null;
      return { user: file(user), project: project && project.toLowerCase() !== user.toLowerCase() ? file(project) : null };
    },
    mark: (sessionId, on) => {
      if (!/^[\w-]+$/.test(sessionId)) return;
      const marker = join(homedir(), ".claude", "pstack", "live", sessionId);
      if (!on) return rmSync(marker, { force: true });
      if (existsSync(marker)) return;
      mkdirSync(dirname(marker), { recursive: true });
      writeFileSync(marker, "");
    },
  };
}

function main() {
  const started = performance.now();
  let ev = null;
  try {
    ev = parseEvent(JSON.parse(readFileSync(0, "utf8") || "{}"));
    if (ev?.event === "SessionStart") prune(TRACE_CACHE, TRACE_CACHE_MAX_AGE_MS);
    const out = ev && respond(ev, liveDeps());
    const elapsed = Math.round(performance.now() - started);
    const budget = process.env.PSTACK_HOOK_BUDGET_MS ? Number(process.env.PSTACK_HOOK_BUDGET_MS) : HOOK_BUDGET_MS;
    if (out && (ev.event === "Stop" || ev.event === "SubagentStop") && elapsed > STOP_BUDGET_MS) {
      log("hook-errors.log", `${ev.event} over budget: ${elapsed} ms on ${ev.transcript}; gate skipped`);
    } else {
      if (ev && elapsed > budget) log("hook-errors.log", `${ev.event} over budget: ${elapsed} ms on ${ev.transcript ?? "no transcript"}`);
      if (out?.kind === "observe") log("gate-observe.log", `${ev.event} ${ev.transcript} ${JSON.stringify(out.reason)}`);
      else if (out) process.stdout.write(serialize(out));
    }
  } catch (e) {
    try {
      log("hook-errors.log", `${ev?.event ?? "?"} ${String(e?.stack ?? e).split("\n").slice(0, 2).join(" | ")}`);
    } catch {}
  }
  process.exit(0);
}

// The installed path reaches this file through the ~/.claude/skills link.
const invokedAsScript = () => Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));

if (invokedAsScript()) main();
