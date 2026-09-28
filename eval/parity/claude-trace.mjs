import { basename } from "node:path";
import { readClaudeTrace as readSession } from "../../skills/poteto-mode/hooks/trace.mjs";
import { docOf, shellActions, skillDoc } from "./cursor-trace.mjs";

/**
 * @typedef {"skill" | "playbook" | "principle"} DocKind
 * @typedef {`${DocKind}:${string}`} DocId
 * @typedef {(
 *   | { kind: "read"; doc: DocId | null; path: string; full: boolean; ok: boolean }
 *   | { kind: "write"; path: string }
 *   | { kind: "shell"; command: string; writes: string[] }
 *   | { kind: "spawn"; agentType: string; model: string | null; prompt: string; background: boolean; childId: string | null }
 *   | { kind: "todo"; op: "create" | "update"; items: { subject: string; status: "pending" | "in_progress" | "completed" | "skipped" }[] }
 *   | { kind: "skill"; name: string; refused: boolean; doc: DocId }
 *   | { kind: "say"; text: string }
 *   | { kind: "other"; tool: string }
 * )} Action
 * @typedef {{ index: number, prompt: string, command: { name: string, args: string } | null, actions: Action[], reply: string, injected: string[], models: string[] }} Turn
 * @typedef {{ actor: string, actorId: string, turns: Turn[], children: Trace[] }} Trace
 * @typedef {import("../../skills/poteto-mode/hooks/trace.mjs").Trace} SessionTrace
 * @typedef {import("../../skills/poteto-mode/hooks/trace.mjs").Action} SessionAction
 */

const slash = (p) => p.replaceAll("\\", "/");

const actorId = (session) => basename(session.path, ".jsonl").replace(/^agent-/, "");

/** @param {SessionAction} a @param {Map<string, string>} children @param {string | null} workspace @returns {Action | Action[] | null} */
function actionOf(a, children, workspace) {
  switch (a.kind) {
    case "read":
      return { kind: "read", doc: docOf(a.file.path), path: slash(a.file.path), full: a.showedAll ?? a.file.shows === "all", ok: a.ok !== false };
    case "write":
      return { kind: "write", path: slash(a.path) };
    case "shell":
      return shellActions(a.command, a.cwd ?? workspace, a.ok !== false);
    case "spawn":
      return { kind: "spawn", agentType: a.agentType, model: a.model, prompt: a.prompt, background: a.background, childId: children.get(a.id) ?? null };
    case "todo":
      return {
        kind: "todo",
        op: a.op === "create" ? "create" : "update",
        items: a.items.map((i) =>
          a.op === "create"
            ? { subject: i.subject ?? "", status: "pending" }
            : { subject: i.subject ?? String(i.id ?? ""), status: i.status === "deleted" ? "skipped" : (i.status ?? "pending") },
        ),
      };
    case "skill":
      return a.source === "tool" ? { kind: "skill", name: a.name, refused: a.ok === false, doc: skillDoc(a.name) } : null;
    case "other":
      return { kind: "other", tool: a.tool };
  }
}

/** @param {SessionTrace["turns"][number]} t @param {Map<string, string>} children @param {string | null} workspace @returns {Action[]} */
function actionsOf(t, children, workspace) {
  const says = t.texts.filter((x) => x.text.trim());
  const out = [];
  t.actions.forEach((a, i) => {
    for (const x of says.filter((x) => x.at === i)) out.push({ kind: "say", text: x.text });
    const action = actionOf(a, children, workspace);
    if (action) out.push(...[action].flat());
  });
  for (const x of says.filter((x) => x.at === t.actions.length)) out.push({ kind: "say", text: x.text });
  return out;
}

/** @param {SessionTrace} session @param {string} actor @param {string | null} workspace @returns {Trace} */
function fromSession(session, actor, workspace) {
  const children = new Map(session.children.map((c) => [c.sub.spawnId, actorId(c)]));
  const spawned = session.turns.flatMap((t) => t.actions.flatMap((a) => (a.kind === "spawn" && children.has(a.id) ? [children.get(a.id)] : [])));
  const rank = (kid) => (spawned.includes(kid.actorId) ? spawned.indexOf(kid.actorId) : spawned.length);
  const kids = session.children.map((c) => fromSession(c, c.sub.agentType ?? "delegate", workspace)).sort((a, b) => rank(a) - rank(b));
  const [first, ...rest] = session.turns;
  const carried = first?.prompt === null ? first.injected : [];
  const turns = (first?.prompt === null ? rest : session.turns).map((t, index) => {
    const actions = actionsOf(t, children, workspace);
    // A plugin's command is recorded as `/pstack:poteto-mode`; the task sent `/poteto-mode`.
    const command = t.command && { ...t.command, name: t.command.name.replace(/^.*:/, "") };
    return {
      index,
      prompt: command ? `/${command.name}${command.args ? ` ${command.args}` : ""}` : t.prompt,
      command,
      actions,
      reply: actions.filter((a) => a.kind === "say").at(-1)?.text ?? "",
      injected: index === 0 ? [...carried, ...t.injected] : t.injected,
      models: [...new Set(t.models.filter((m) => !m.startsWith("<")))],
    };
  });
  return { actor, actorId: actorId(session), turns, children: kids };
}

/**
 * A Claude Code session in the eval's harness-neutral shape.
 * @param {string} path @param {string | null} [workspace] where a shell call with no recorded directory ran
 * @returns {Trace}
 */
export const readClaudeTrace = (path, workspace = null) => fromSession(readSession(path), "main", workspace);
