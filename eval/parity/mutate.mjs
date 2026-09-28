import { docOf, openedDoc } from "./cursor-trace.mjs";
import { shellReads } from "./shell-reads.mjs";

/**
 * @typedef {import("./claude-trace.mjs").Trace} Trace
 * @typedef {import("./claude-trace.mjs").Turn} Turn
 * @typedef {import("./behaviors.mjs").Task} Task
 * @typedef {{ behavior: string, unit: string }} UnitRef
 * @typedef {{ trace: Trace, target: UnitRef, alsoFails: UnitRef[] }} Mutant
 * @typedef {{ id: string, behavior: string, apply: (trace: Trace, task: Task, titles: Record<string, string>) => Mutant | null }} Mutation
 */

const STEP_LINE = /^\s*(?:[-*]\s*)?\d+\.\s.*$/gm;
const STEP_HEAD = /^\s*(?:[-*]\s*)?\d+\.\s/;

const all = (t) => [t, ...t.children.flatMap(all)];

// A shell call that printed a doc still shows it in the packet once the read it produced is gone.
const printed = (a) => (a.kind === "shell" ? shellReads(a.command, null).map((r) => docOf(r.path)).filter(Boolean) : []);
const touches = (a, doc) => ((a.kind === "read" || a.kind === "skill") && a.doc === doc) || printed(a).includes(doc);

const withReply = (turn, reply) => {
  const says = turn.actions.filter((a) => a.kind === "say");
  const last = says.at(-1);
  if (last) last.text = reply;
  turn.reply = reply;
};

export function citedPrinciples(reply, titles) {
  const text = reply.toLowerCase();
  return Object.entries(titles)
    .filter(([slug, title]) => text.includes(title.toLowerCase()) || text.includes(slug))
    .map(([slug]) => slug);
}

const onTurns = (task) => task.turns.filter((t) => t.expect.mode === "on");

const laterCiting = (task, trace, index, slugs, titles) =>
  onTurns(task)
    .filter((t) => t.index > index && citedPrinciples(trace.turns[t.index].reply, titles).some((s) => slugs.includes(s)))
    .flatMap((t) => ["B1-mode-sticky", "B7-cite-read"].map((behavior) => ({ behavior, unit: `t${t.index}` })));

const stickyToo = (index) => (index > 0 ? [{ behavior: "B1-mode-sticky", unit: `t${index}` }] : []);

/** @type {Mutation[]} */
export const MUTATIONS = [
  {
    id: "drop-principle-read",
    behavior: "B7-cite-read",
    apply(src, task, titles) {
      for (const spec of onTurns(task)) {
        const trace = structuredClone(src);
        const turn = trace.turns[spec.index];
        const readSlugs = new Set(
          trace.turns
            .slice(0, spec.index + 1)
            .flatMap((u) => u.actions)
            .map(openedDoc)
            .filter((doc) => doc?.startsWith("principle:"))
            .map((doc) => doc.slice("principle:".length)),
        );
        const slug = citedPrinciples(turn.reply, titles).find((s) => readSlugs.has(s));
        if (!slug) continue;
        for (const u of trace.turns) u.actions = u.actions.filter((a) => !touches(a, `principle:${slug}`));
        const unit = `t${spec.index}`;
        return { trace, target: { behavior: "B7-cite-read", unit }, alsoFails: [...stickyToo(spec.index), ...laterCiting(task, trace, spec.index, [slug], titles)] };
      }
      return null;
    },
  },
  {
    id: "drop-step-list",
    behavior: "B5-step-list",
    apply(src, task) {
      for (const spec of onTurns(task).filter((t) => t.expect.playbook)) {
        const trace = structuredClone(src);
        const turn = trace.turns[spec.index];
        const listed = (turn.reply.match(STEP_LINE) ?? []).length >= 3;
        if (!(listed || turn.actions.some((a) => a.kind === "todo"))) continue;
        withReply(turn, turn.reply.replace(STEP_LINE, "").replace(/\n{3,}/g, "\n\n"));
        turn.actions = turn.actions.filter((a) => a.kind !== "todo");
        return { trace, target: { behavior: "B5-step-list", unit: `t${spec.index}` }, alsoFails: stickyToo(spec.index) };
      }
      return null;
    },
  },
  {
    id: "drop-skill-read",
    behavior: "B6-trigger-runs",
    apply(src, task) {
      for (const spec of onTurns(task)) {
        for (const skill of spec.expect.triggers) {
          const trace = structuredClone(src);
          const turn = trace.turns[spec.index];
          const doc = `skill:${skill}`;
          const mentions = new RegExp(`\\b${skill}\\b`, "i");
          const lines = [
            ...turn.reply.split("\n"),
            ...turn.actions.filter((a) => a.kind === "todo").flatMap((a) => a.items.map((i) => i.subject)),
          ].filter((line) => mentions.test(line));
          const read = turn.actions.some((a) => openedDoc(a) === doc);
          if (!read || lines.length === 0 || lines.some((line) => /skip/i.test(line))) continue;
          for (const t of all(trace)) for (const u of t.turns) u.actions = u.actions.filter((a) => !touches(a, doc));
          return { trace, target: { behavior: "B6-trigger-runs", unit: `t${spec.index}` }, alsoFails: stickyToo(spec.index) };
        }
      }
      return null;
    },
  },
  {
    id: "unlabeled-claim",
    behavior: "B13b-claim-labels",
    apply(src, task) {
      const spec = onTurns(task).find((t) => src.turns[t.index]?.reply);
      if (!spec) return null;
      const trace = structuredClone(src);
      const turn = trace.turns[spec.index];
      withReply(turn, `${turn.reply}\n\nCheckout totals will now be right for every order customers place.`);
      return { trace, target: { behavior: "B13b-claim-labels", unit: `t${spec.index}` }, alsoFails: [] };
    },
  },
  {
    id: "mode-lapse",
    behavior: "B1-mode-sticky",
    apply(src, task, titles) {
      for (const spec of onTurns(task).filter((t) => t.index > 0 && t.expect.playbook)) {
        const trace = structuredClone(src);
        const turn = trace.turns[spec.index];
        const plain = turn.reply
          .split("\n")
          .filter((line) => !STEP_HEAD.test(line) && citedPrinciples(line, titles).length === 0 && !/principle|playbook|skip:/i.test(line))
          .join("\n");
        if (plain === turn.reply) continue;
        const dropped = turn.actions.map(openedDoc).filter((doc) => doc?.startsWith("principle:")).map((doc) => doc.slice("principle:".length));
        withReply(turn, plain);
        turn.actions = turn.actions.filter((a) => !openedDoc(a) && !printed(a).length && a.kind !== "todo");
        const unit = `t${spec.index}`;
        return {
          trace,
          target: { behavior: "B1-mode-sticky", unit },
          alsoFails: [
            ...["B5-step-list", "B6-trigger-runs", "B7-cite-read", "B15-playbook-choice"].map((behavior) => ({ behavior, unit })),
            ...laterCiting(task, trace, spec.index, dropped, titles),
          ],
        };
      }
      return null;
    },
  },
];

/**
 * @param {string} skillMd @returns {Record<string, string>}
 */
export function principleTitles(skillMd) {
  const out = {};
  for (const m of skillMd.matchAll(/\*\*([^*]+)\*\* \(\*\*principle-([\w-]+)\*\*\)/g)) out[m[2]] = m[1];
  return out;
}
