import { existsSync } from "node:fs";
import { join } from "node:path";
import { skillDoc } from "./cursor-trace.mjs";

/**
 * @typedef {import("./claude-trace.mjs").Trace} Trace
 * @typedef {import("./claude-trace.mjs").Action} Action
 * @typedef {{ id: string, turn: number, actor: string, text: string }} PacketEvent
 * @typedef {{ id: string, turn: number, role: string, spawnedAt: string }} DelegateUnit
 * @typedef {{ workspace: string, skills: string[], home: string, sandbox: string }} Roots
 * @typedef {{ text: string, events: PacketEvent[], delegates: DelegateUnit[], turns: number[] }} Packet
 */

const INTERIM_CHARS = 1500;
const REPLY_CHARS = 12000;
const PROMPT_CHARS = 800;
const COMMAND_CHARS = 400;

const clip = (s, n) => (s.length > n ? `${s.slice(0, n)} [...${s.length - n} more chars]` : s);

/**
 * @param {string} text @param {Roots} roots
 */
export function neutralPaths(text, roots) {
  let out = String(text ?? "");
  const forms = (p) => {
    const f = p.replaceAll("\\", "/");
    return [f, f.replaceAll("/", "\\"), f.replaceAll("/", "\\\\"), f.replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`)];
  };
  const swap = (from, to) => {
    for (const f of forms(from)) out = out.split(f).join(to);
  };
  swap(roots.workspace, "<repo>");
  for (const root of roots.skills) swap(root, "<pstack>");
  swap(roots.home, "<home>");
  swap(roots.sandbox, "<sandbox>");
  out = out.replace(/<pstack>[\\/]+principle-([\w-]+)[\\/]+SKILL\.md/g, "<pstack>/poteto-mode/principles/$1.md");
  out = out.replace(/<pstack>[\\/]+([^\s"'`]*)/g, (m) => m.replaceAll("\\", "/"));
  out = out.replace(/<repo>[\\/]+([^\s"'`]*)/g, (m) => m.replaceAll("\\", "/"));
  return out.replace(/co-authored-by:[^\n"]*/gi, "Co-authored-by: <agent>");
}

export function tier(model) {
  if (!model) return "inherit";
  const m = model.toLowerCase();
  if (/opus|fable/.test(m)) return "top";
  if (/sonnet/.test(m)) return "mid";
  if (/haiku|flash|mini/.test(m)) return "fast";
  return "other-family";
}

export function role(agentType) {
  const t = String(agentType ?? "").toLowerCase();
  if (t === "poteto-agent") return "poteto-agent";
  if (/explore|reader|readonly/.test(t)) return "explorer";
  if (/general|default|delegate/.test(t)) return "general";
  return "other";
}

const STATUS = { completed: "done", in_progress: "doing", pending: "todo", skipped: "skipped" };

/** Where a port install keeps the document a pstack Skill load opens, or null for a skill no pstack root holds. @param {Action & { kind: "skill" }} a @param {Roots} roots */
function loadedPath(a, roots) {
  if (a.refused || !roots.skills.some((root) => existsSync(join(root, a.name, "SKILL.md")))) return null;
  const [kind, name] = skillDoc(a.name).split(":");
  return kind === "principle" ? `<pstack>/poteto-mode/principles/${name}.md` : `<pstack>/${name}/SKILL.md`;
}

/** @param {Action} a @param {(s: string) => string} p @param {Roots} roots */
function describe(a, p, roots) {
  switch (a.kind) {
    case "read":
      return `read ${p(a.path)} (${a.full ? "full" : "partial"}${a.ok ? "" : ", failed"})`;
    case "write":
      return `edit ${p(a.path)}`;
    case "shell":
      return `run: ${clip(p(a.command), COMMAND_CHARS)}`;
    case "spawn":
      return `spawn ${role(a.agentType)} delegate, model tier ${tier(a.model)}, ${a.background ? "background" : "foreground"}. Brief: ${clip(p(a.prompt), PROMPT_CHARS)}`;
    case "todo":
      return `task list ${a.op}: ${a.items.map((i) => `[${STATUS[i.status] ?? i.status}] ${p(i.subject)}`).join("; ")}`;
    case "skill": {
      const loads = loadedPath(a, roots);
      return `invoke skill ${a.name}${a.refused ? " (refused)" : ""}${loads ? `, which loads ${loads} in full` : ""}`;
    }
    case "other":
      return "other tool call";
    default:
      return "";
  }
}

/**
 * @param {Trace} trace
 * @param {Roots} roots
 * @returns {Packet}
 */
export function render(trace, roots) {
  const p = (s) => neutralPaths(s, roots);
  /** @type {PacketEvent[]} */
  const events = [];
  /** @type {DelegateUnit[]} */
  const delegates = [];
  const lines = [];
  const emit = (turn, actor, text) => {
    const id = `e${events.length + 1}`;
    events.push({ id, turn, actor, text });
    lines.push(`${id} [${actor}] ${text}`);
    return id;
  };

  const walk = (t, turnIndex, actor) => {
    for (const u of t.turns) {
      const ti = actor === "main" ? u.index : turnIndex;
      const says = u.actions.filter((a) => a.kind === "say");
      const last = says.at(-1);
      if (actor === "main") {
        lines.push("", `=== turn t${u.index} ===`);
        emit(ti, actor, `USER: ${p(u.prompt)}`);
      } else {
        emit(ti, actor, `BRIEF RECEIVED: ${clip(p(u.prompt), PROMPT_CHARS)}`);
      }
      const spawned = [];
      for (const a of u.actions) {
        if (a.kind === "say") {
          const final = a === last;
          const who = actor === "main" ? "REPLY TO USER" : "FINAL MESSAGE TO PARENT";
          emit(ti, actor, final ? `${who}:\n${clip(p(a.text), REPLY_CHARS)}` : `says (interim): ${clip(p(a.text), INTERIM_CHARS)}`);
          continue;
        }
        const id = emit(ti, actor, describe(a, p, roots));
        if (a.kind === "spawn") spawned.push({ a, id });
      }
      for (const { a, id } of spawned) {
        const child = t.children.find((c) => c.actorId === a.childId);
        if (child) renderChild(child, ti, id, a.agentType);
      }
    }
  };

  const renderChild = (child, turnIndex, spawnedAt, agentType) => {
    const d = { id: `d${delegates.length + 1}`, turn: turnIndex, role: role(agentType ?? child.actor), spawnedAt };
    delegates.push(d);
    lines.push("", `--- delegate ${d.id} (${d.role}, spawned at ${spawnedAt}) ---`);
    walk(child, turnIndex, d.id);
    lines.push(`--- end of delegate ${d.id} ---`);
  };

  walk(trace, 0, "main");
  const linked = new Set(trace.turns.flatMap((u) => u.actions).filter((a) => a.kind === "spawn").map((a) => a.childId));
  for (const child of trace.children.filter((c) => !linked.has(c.actorId))) renderChild(child, trace.turns.length - 1, "unknown", child.actor);

  return { text: lines.join("\n").trim(), events, delegates, turns: trace.turns.map((u) => u.index) };
}
