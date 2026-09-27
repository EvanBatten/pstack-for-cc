import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

/**
 * @typedef {{ path: string } & ({ shows: "all" } | { shows: "head", lines: number } | { shows: "range", from: number, to: number | null })} FileShown
 *
 * @typedef {(
 *   | { kind: "read", id: string, file: FileShown, ok: boolean | null, showedAll: boolean | null }
 *   | { kind: "write", id: string, tool: string, path: string, ok: boolean | null }
 *   | { kind: "shell", id: string, command: string, cwd?: string, ok: boolean | null }
 *   | { kind: "spawn", id: string, agentType: string, model: string | null, description: string, prompt: string, background: boolean, ok: boolean | null }
 *   | { kind: "todo", id: string, op: "write" | "create" | "update", items: TaskItem[], ok: boolean | null }
 *   | { kind: "skill", id: string | null, source: "tool" | "harness", name: string, ok: boolean | null, error: string | null }
 *   | { kind: "compact", id: null, ok: true }
 *   | { kind: "other", id: string, tool: string, input: any, ok: boolean | null }
 * )} Action
 * A shell action is its command text only: nothing reads its writes, reads or test results. A tool call also carries
 * `msg`, the id of the assistant message that made it, when the record has one, so parallel calls can be grouped, and
 * a shell call carries its record's `cwd`, so a relative path it writes resolves.
 *
 * @typedef {{ id: string | null, subject: string | null, description: string | null, status: string | null }} TaskItem
 *
 * @typedef {`${string}:${string}`} AskId
 * `<rule key>:<8-hex hash of the target>`, as a `[pstack:<AskId>]` tag in a deny, a gate block or a note renders it.
 *
 * @typedef {{
 *   index: number,
 *   prompt: string | null,
 *   command: { name: string, args: string } | null,
 *   actions: Action[],
 *   texts: { text: string, at: number }[],
 *   stops: { reply: string, actions: number, texts: number }[],
 *   asked: { id: AskId, at: number, call: string | null }[],
 *   injected: string[],
 *   models: string[],
 * }} Turn
 * An ask's `at` is the number of the turn's actions when its tag reached the transcript, and `call` the tool call a deny
 * refused. The trace records no narration.
 *
 * `entrypoint` is how the session was started, as its records name it (`cli`, or `sdk-cli` for `claude -p`).
 * @typedef {{
 *   id: string,
 *   path: string,
 *   sub: { agentType: string | null, spawnId: string | null, description: string | null, model: string | null } | null,
 *   entrypoint: string | null,
 *   turns: Turn[],
 *   children: Trace[],
 * }} Trace
 */

const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
const TODO_OPS = { TodoWrite: "write", TaskCreate: "create", TaskUpdate: "update" };
export const NOT_A_PROMPT = /^\s*(<(local-command-stdout|local-command-caveat|bash-stdout|bash-stderr|task-notification)>|\[Request interrupted by user)/;
const SKILL_LOADED = /^Base directory for this skill: [^\n]*?[\\/]([\w-]+)[ \t]*(\r?\n|$)/;

const contentText = (c) =>
  typeof c === "string" ? c : Array.isArray(c) ? c.map((b) => (typeof b === "string" ? b : b.text ?? contentText(b.content ?? ""))).join("\n") : "";

const userText = (c) => (typeof c === "string" ? c : Array.isArray(c) ? c.filter((b) => b.type === "text").map((b) => b.text).join("\n") : "");

/** @param {{ id: string, name: string, input?: any }} block @returns {Action} */
export function toAction(block) {
  const { id, name: tool } = block;
  const input = block.input ?? {};
  if (tool === "Read") {
    const file = input.offset > 1 ? { shows: "range", from: input.offset, to: input.limit != null ? input.offset + input.limit - 1 : null } : input.limit != null ? { shows: "head", lines: input.limit } : { shows: "all" };
    return { kind: "read", id, file: { path: input.file_path ?? "", ...file }, ok: null, showedAll: null };
  }
  if (tool === "Bash" || tool === "PowerShell") return { kind: "shell", id, command: input.command ?? "", ok: null };
  if (WRITE_TOOLS.has(tool)) return { kind: "write", id, tool, path: input.file_path ?? input.notebook_path ?? "", ok: null };
  if (tool === "Skill") return { kind: "skill", id, source: "tool", name: String(input.skill ?? "").replace(/^.*:/, ""), ok: null, error: null };
  if (tool === "Agent" || tool === "Task")
    return {
      kind: "spawn",
      id,
      agentType: input.subagent_type ?? "general-purpose",
      model: input.model ?? null,
      description: input.description ?? "",
      prompt: input.prompt ?? "",
      // Agents still pass this parameter the Agent tool lacks, and the eval reports it.
      background: [true, "true"].includes(input.run_in_background), // port-check: allow
      ok: null,
    };
  if (tool in TODO_OPS) {
    const items =
      tool === "TodoWrite"
        ? (input.todos ?? []).map((t) => ({ id: null, subject: t.content ?? null, description: null, status: t.status ?? null }))
        : [{ id: input.taskId ?? null, subject: input.subject ?? null, description: input.description ?? null, status: input.status ?? (tool === "TaskCreate" ? "pending" : null) }];
    return { kind: "todo", id, op: TODO_OPS[tool], items, ok: null };
  }
  return { kind: "other", id, tool, input, ok: null };
}

const isPrompt = (j, text) =>
  !j.isMeta &&
  !j.isCompactSummary &&
  j.origin?.kind !== "task-notification" &&
  !(Array.isArray(j.message?.content) && j.message.content.some((b) => b.type === "tool_result")) &&
  Boolean(text.trim()) &&
  !NOT_A_PROMPT.test(text) &&
  // Gate feedback can land as a plain user message, and it continues the turn it blocked.
  !FEEDBACK.test(text);

const commandOf = (prompt) => {
  if (!/^\s*<command-/.test(prompt)) return null;
  const name = prompt.match(/<command-name>\/?([\w:.-]+)<\/command-name>/);
  return name ? { name: name[1], args: prompt.match(/<command-args>([\s\S]*?)<\/command-args>/)?.[1].trim() ?? "" } : null;
};

const newTurn = (index, prompt) => ({ index, prompt, command: prompt === null ? null : commandOf(prompt), actions: [], texts: [], stops: [], asked: [], injected: [], models: [] });

export const GATE_FEEDBACK = "pstack gate. Before you stop:";
// Feedback opens with the block; a prompt that quotes an old block further in is a prompt.
const FEEDBACK = /^\s*(Stop hook feedback:\s*|SubagentStop hook feedback:\s*)?pstack gate\. Before you stop:/;

/** Every `[pstack:<AskId>]` tag in a text; one deny or block may carry several. @returns {AskId[]} */
export const tagsIn = (text) => [...text.matchAll(/\[pstack:([\w:-]+)\]/g)].map((m) => /** @type {AskId} */ (m[1]));

function parseTurns(text) {
  const turns = [];
  const actions = new Map();
  let entrypoint = null;
  const turn = () => turns.at(-1) ?? (turns.push(newTurn(0, null)), turns[0]);
  const ask = (t, text, call) => t.asked.push(...tagsIn(text).map((id) => ({ id, at: t.actions.length, call })));
  for (const line of text.split("\n")) {
    if (!line) continue;
    let j;
    try {
      j = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof j.entrypoint === "string") entrypoint = j.entrypoint;
    if (j.type === "attachment" && j.attachment?.type === "hook_additional_context") {
      const context = contentText(j.attachment.content);
      turn().injected.push(context);
      ask(turn(), context, null);
    }
    if (j.type === "system" && j.subtype === "compact_boundary") turn().actions.push({ kind: "compact", id: null, ok: true });
    if (j.type === "user") {
      const c = j.message?.content;
      const text = userText(c);
      if (isPrompt(j, text)) turns.push(newTurn(turns.length, text));
      if (FEEDBACK.test(text)) ask(turn(), text, null);
      const loaded = text.match(SKILL_LOADED);
      if (loaded) turn().actions.push({ kind: "skill", id: null, source: "harness", name: loaded[1], ok: true, error: null });
      if (Array.isArray(c))
        for (const b of c) {
          const action = b.type === "tool_result" && actions.get(b.tool_use_id);
          if (!action) continue;
          action.ok = !b.is_error;
          const result = contentText(b.content);
          // A deny reaches the transcript as an errored result whose wording no Claude Code version promises, so any errored result counts.
          if (b.is_error) ask(turn(), result, action.id);
          if (action.kind === "skill") action.error = b.is_error ? result.slice(0, 160) : null;
          if (action.kind === "todo" && action.op === "create" && action.ok && j.toolUseResult?.task?.id != null) action.items[0].id = String(j.toolUseResult.task.id);
          const file = j.toolUseResult?.file;
          if (action.kind === "read" && file?.totalLines) action.showedAll = file.startLine === 1 && file.numLines >= file.totalLines;
        }
    }
    if (j.type !== "assistant") continue;
    const t = turn();
    const model = j.message?.model;
    if (model && model !== "<synthetic>") t.models.push(model);
    let reply = "";
    for (const b of j.message?.content ?? []) {
      if (b.type === "text") {
        t.texts.push({ text: b.text, at: t.actions.length });
        reply += b.text;
      }
      if (b.type !== "tool_use") continue;
      const action = toAction(b);
      if (j.message?.id) action.msg = j.message.id;
      if (action.kind === "shell" && typeof j.cwd === "string" && j.cwd) action.cwd = j.cwd;
      actions.set(b.id, action);
      t.actions.push(action);
    }
    if (j.message?.stop_reason === "end_turn" && reply) t.stops.push({ reply, actions: t.actions.length, texts: t.texts.length });
  }
  return { turns, entrypoint };
}

const readMeta = (jsonl) => {
  try {
    return JSON.parse(readFileSync(jsonl.replace(/\.jsonl$/, ".meta.json"), "utf8"));
  } catch {
    return null;
  }
};

const subOf = (meta) => ({ agentType: meta.agentType ?? null, spawnId: meta.toolUseId ?? null, description: meta.description ?? null, model: meta.model ?? null });

/** @typedef {{ turns: Turn[], entrypoint: string | null }} Parsed */

/** @param {string} path @returns {Parsed} */
export const parseTranscript = (path) => parseTurns(readFileSync(path, "utf8"));

/**
 * `parse` reads each subagent file; the root is always parsed fresh.
 * @param {string} path
 * @param {{ spawns?: (root: Trace) => Set<string> | null, text?: string, parse?: (path: string) => Parsed }} [options]
 * @returns {Trace}
 */
export function readClaudeTrace(path, { spawns = () => null, text, parse = parseTranscript } = {}) {
  const meta = readMeta(path);
  const root = { id: basename(path, ".jsonl"), path, sub: meta && subOf(meta), ...parseTurns(text ?? readFileSync(path, "utf8")), children: [] };
  const subDir = meta ? dirname(path) : join(dirname(path), root.id, "subagents");
  const wanted = spawns(root);
  if (wanted?.size === 0 || !existsSync(subDir)) return root;
  const nodes = readdirSync(subDir)
    .filter((f) => f.endsWith(".jsonl") && f.slice(0, -6) !== root.id)
    .sort()
    .map((f) => {
      const p = join(subDir, f);
      const m = readMeta(p) ?? {};
      return { id: f.slice(0, -6), path: p, meta: m, parent: `agent-${m.parentAgentId}` };
    });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parentOf = (n) => (byId.has(n.parent) ? byId.get(n.parent) : n.parent === root.id || !meta ? root : null);
  const ancestry = (n) => {
    const chain = [];
    for (let x = n; x && x !== root && chain.length <= nodes.length; x = parentOf(x)) chain.push(x);
    return chain.length <= nodes.length && parentOf(chain.at(-1)) === root ? chain : null;
  };
  const kept = nodes.filter((n) => {
    const chain = ancestry(n);
    return chain && (!wanted || chain.some((x) => wanted.has(x.meta.toolUseId)));
  });
  const traces = new Map(kept.map((n) => [n, { id: n.id, path: n.path, sub: subOf(n.meta), ...parse(n.path), children: [] }]));
  for (const [n, s] of traces) (traces.get(parentOf(n)) ?? root).children.push(s);
  return root;
}

export const actorsOf = (trace) => {
  const all = [];
  const walk = (x) => (all.push(x), x.children.forEach(walk));
  walk(trace);
  const [root, ...subs] = all;
  return [root, ...subs.sort((a, b) => (basename(a.path) < basename(b.path) ? -1 : 1))];
};

export const spawnOf = (parent, child) =>
  parent.turns.flatMap((t) => t.actions).findLast((a) => a.kind === "spawn" && a.id === child.sub.spawnId) ?? null;

/**
 * @param {Trace} trace
 * @returns {{ on: boolean, since: number | null }}
 */
export function modeOf(trace) {
  if (trace.sub?.agentType === "poteto-agent") return { on: true, since: 0 };
  const last = trace.turns.findLast((t) => t.command?.name === "poteto-mode");
  return last && last.command.args.toLowerCase() !== "off" ? { on: true, since: last.index } : { on: false, since: null };
}
