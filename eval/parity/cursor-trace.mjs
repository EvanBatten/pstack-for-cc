import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { shellReads, showsBody } from "./shell-reads.mjs";

/**
 * @typedef {import("./claude-trace.mjs").Trace} Trace
 * @typedef {import("./claude-trace.mjs").Turn} Turn
 * @typedef {import("./claude-trace.mjs").Action} Action
 * @typedef {import("./claude-trace.mjs").DocId} DocId
 */

const slash = (p) => String(p ?? "").replaceAll("\\", "/");

/**
 * @param {string} path @returns {DocId | null}
 */
export function docOf(path) {
  const p = slash(path);
  let m = p.match(/\/poteto-mode\/principles\/([\w-]+)\.md$/i) ?? p.match(/\/principle-([\w-]+)\/SKILL\.md$/i);
  if (m) return `principle:${m[1]}`;
  if ((m = p.match(/\/poteto-mode\/playbooks\/([\w-]+)\.md$/i))) return `playbook:${m[1]}`;
  if ((m = p.match(/\/skills\/([\w:-]+)\/SKILL\.md$/i))) return `skill:${m[1]}`;
  return null;
}

/** The document a Skill tool load opens, named like a read of that skill's file. @param {string} name @returns {DocId} */
export function skillDoc(name) {
  const slug = name.match(/^principle-([\w-]+)$/)?.[1];
  return slug ? `principle:${slug}` : `skill:${name}`;
}

/** The document an action opened: a read's, or a Skill load's when it was not refused. @param {Action} a @returns {DocId | null} */
export const openedDoc = (a) => (a.kind === "read" ? a.doc : a.kind === "skill" && !a.refused ? a.doc : null);

const REDIRECT = /(?:^|[^\d&>])>>?\s*("[^"]+"|'[^']+'|[^\s|&;<>]+)/g;

/** @param {string} command */
export function shellWrites(command) {
  const out = [];
  for (const m of command.matchAll(REDIRECT)) {
    const target = m[1].replace(/^["']|["']$/g, "");
    if (!/^(\/dev\/null|nul|&\d)$/i.test(target)) out.push(target);
  }
  for (const m of command.matchAll(/\btee\s+(?:-a\s+)?("[^"]+"|[^\s|&;]+)/g)) out.push(m[1].replace(/"/g, ""));
  return out;
}

/** A shell call, then a read of each pstack document it printed. @returns {Action[]} */
export const shellActions = (command, cwd, ok) => [
  { kind: "shell", command, writes: shellWrites(command) },
  ...shellReads(command, cwd).flatMap(({ path, full, lines }) => {
    const doc = docOf(path);
    return doc ? [{ kind: "read", doc, path, full: full || (lines !== undefined && showsBody(path, lines)), ok }] : [];
  }),
];

const readAction = (path, full) => ({ kind: "read", doc: docOf(path), path: slash(path), full, ok: true });

export const STREAM_TOOLS = {
  readToolCall: ({ args, result }) => {
    const ok = result?.success;
    const full = ok ? ok.readRange?.startLine === 1 && ok.readRange?.endLine >= ok.totalLines : !args.offset && !args.limit;
    return { ...readAction(args.path, Boolean(full)), ok: Boolean(ok) || !result };
  },
  shellToolCall: ({ args, result }, workspace) => shellActions(args.command, args.workingDirectory || workspace, !result || (Boolean(result.success) && !result.success.exitCode)),
  editToolCall: ({ args }) => ({ kind: "write", path: slash(args.path) }),
  deleteToolCall: ({ args }) => ({ kind: "write", path: slash(args.path) }),
  taskToolCall: ({ args, result }) => ({
    kind: "spawn",
    agentType: args.subagentType?.custom?.name ?? Object.keys(args.subagentType ?? { default: 1 })[0],
    model: args.model && args.model !== "default" ? args.model : null,
    prompt: args.prompt ?? "",
    background: Boolean(result?.success?.isBackground),
    childId: result?.success?.agentId ?? null,
  }),
  updateTodosToolCall: ({ args }) => ({
    kind: "todo",
    op: "update",
    items: (args.todos ?? []).map((t) => ({ subject: t.content ?? t.subject ?? "", status: todoStatus(t.status) })),
  }),
};

const todoStatus = (s) =>
  ({ TODO_STATUS_COMPLETED: "completed", completed: "completed", TODO_STATUS_IN_PROGRESS: "in_progress", in_progress: "in_progress", cancelled: "skipped", TODO_STATUS_CANCELLED: "skipped" })[s] ??
  "pending";

export const CHILD_TOOLS = {
  Read: (i) => readAction(i.path, !i.offset && !i.limit),
  Shell: (i, workspace) => shellActions(i.command, workspace, true),
  StrReplace: (i) => ({ kind: "write", path: slash(i.path) }),
  Write: (i) => ({ kind: "write", path: slash(i.path) }),
  Delete: (i) => ({ kind: "write", path: slash(i.path) }),
  EditNotebook: (i) => ({ kind: "write", path: slash(i.target_notebook ?? i.path) }),
  Task: (i) => ({ kind: "spawn", agentType: i.subagent_type ?? "default", model: i.model ?? null, prompt: i.prompt ?? "", background: Boolean(i.run_in_background), childId: null }),
  TodoWrite: (i) => ({ kind: "todo", op: "update", items: (i.todos ?? []).map((t) => ({ subject: t.content ?? "", status: todoStatus(t.status) })) }),
};

const jsonl = (path) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .flatMap((l) => {
      try {
        return [JSON.parse(l)];
      } catch {
        return [];
      }
    });

const textOf = (content) => (content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");

/** @returns {Turn} */
const newTurn = (index, prompt) => ({ index, prompt, command: commandOf(prompt), actions: [], reply: "", injected: [], models: [] });

const commandOf = (prompt) => {
  const m = prompt.match(/^\/([\w:-]+)(?:\s+([\s\S]*))?$/);
  return m ? { name: m[1], args: (m[2] ?? "").trim() } : null;
};

const closeTurn = (turn) => {
  const says = turn.actions.filter((a) => a.kind === "say");
  turn.reply = says.at(-1)?.text ?? "";
  return turn;
};

/**
 * @param {string} streamPath @param {number} index @returns {{ turn: Turn, sessionId: string | null }}
 */
function streamTurn(streamPath, index, workspace) {
  const events = jsonl(streamPath);
  const init = events.find((e) => e.type === "system" && e.subtype === "init");
  const user = events.find((e) => e.type === "user");
  const turn = newTurn(index, textOf(user?.message?.content));
  if (init?.model) turn.models.push(init.model);
  for (const e of events) {
    if (e.type === "assistant") {
      const text = textOf(e.message?.content);
      if (text.trim()) turn.actions.push({ kind: "say", text });
    } else if (e.type === "tool_call" && e.subtype === "completed") {
      const [kind, call] = Object.entries(e.tool_call).find(([k]) => k.endsWith("ToolCall")) ?? ["unknown", {}];
      const toAction = STREAM_TOOLS[kind];
      turn.actions.push(...[toAction ? toAction(call, workspace) : { kind: "other", tool: kind }].flat());
    }
  }
  return { turn: closeTurn(turn), sessionId: init?.session_id ?? null };
}

/** @param {string} path @param {string} actorId @param {string | null} workspace @returns {Trace} */
function childTrace(path, actorId, workspace) {
  const lines = jsonl(path);
  const first = lines.find((l) => l.role === "user");
  const turn = newTurn(0, textOf(first?.message?.content));
  for (const l of lines) {
    if (l.role !== "assistant") continue;
    for (const b of l.message?.content ?? []) {
      if (b.type === "text" && b.text.trim()) turn.actions.push({ kind: "say", text: b.text });
      if (b.type === "tool_use") turn.actions.push(...[CHILD_TOOLS[b.name]?.(b.input ?? {}, workspace) ?? { kind: "other", tool: b.name }].flat());
    }
  }
  return { actor: "delegate", actorId, turns: [closeTurn(turn)], children: [] };
}

/**
 * @param {string[]} streamPaths
 * @param {string | null} transcriptsDir
 * @param {string | null} [workspace] where a shell call with no directory of its own ran
 * @returns {Trace}
 */
export function readCursorTrace(streamPaths, transcriptsDir, workspace = null) {
  const parsed = streamPaths.map((p, i) => streamTurn(p, i, workspace));
  const turns = parsed.map((p) => p.turn);
  const mainIds = new Set(parsed.map((p) => p.sessionId).filter(Boolean));
  const children = [];
  const linked = new Set();
  for (const a of turns.flatMap((t) => t.actions)) {
    if (a.kind !== "spawn" || !a.childId || !transcriptsDir) continue;
    const file = join(transcriptsDir, a.childId, `${a.childId}.jsonl`);
    if (!existsSync(file)) continue;
    const child = childTrace(file, a.childId, workspace);
    child.actor = a.agentType;
    children.push(child);
    linked.add(a.childId);
  }
  if (transcriptsDir && existsSync(transcriptsDir))
    for (const id of readdirSync(transcriptsDir)) {
      const file = join(transcriptsDir, id, `${id}.jsonl`);
      if (!mainIds.has(id) && !linked.has(id) && existsSync(file)) children.push(childTrace(file, id, workspace));
    }
  return { actor: "main", actorId: [...mainIds][0] ?? "main", turns, children };
}
