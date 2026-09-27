import { askId, DATA_SHAPE, docPath, isRead, RULES, SKIPS_DESIGN, spanOf, stillUnread, tag, triggersOf } from "./asks.mjs";
import { citedPrinciples, list, norm } from "./catalog.mjs";
import { GATE_FEEDBACK } from "./trace.mjs";

/** @typedef {import("./asks.mjs").Span} Span */
/** @typedef {import("./catalog.mjs").Catalog} Catalog */
/** @typedef {import("./trace.mjs").Trace} Trace */
/** @typedef {import("./trace.mjs").AskId} AskId */
/** @typedef {{ id: string, type: string }} BackgroundTask */

/**
 * The stop being judged: the reply it ends on, the visible texts of its turn, whether the turn edited code or called a
 * tool, and whether the session runs headless. The transcript already holds those texts at Stop (measured on 2.1.281);
 * a narration block holds a paraphrase, so it is not among them.
 * @typedef {{ reply: string, texts: string[], codeEdited: boolean, workedThisTurn: boolean, headless: boolean }} StopView
 */

/** @param {Trace} trace @returns {StopView | null} */
export function stopView(trace) {
  const turn = trace.turns.at(-1);
  const stop = turn?.stops.at(-1);
  if (!stop) return null;
  return {
    reply: stop.reply,
    texts: turn.texts.slice(0, stop.texts).map((x) => x.text),
    codeEdited: turn.actions.slice(0, stop.actions).some((a) => a.ok !== false && triggersOf(a).some((t) => t.kind === "code-edit")),
    workedThisTurn: stop.actions > 0,
    headless: !trace.sub && trace.entrypoint === "sdk-cli",
  };
}

const TRAIL_PLAYBOOKS = ["autonomous-run", "orchestrate", "hillclimb", "multi-phase-plan"];

const LONG_DASH = String.fromCharCode(0x2014);
// Characters shown on each side of the first long dash, so the finding names the line without quoting a paragraph.
const DASH_CONTEXT = 60;
/** Worker text a finding quotes, with any `[pstack:` broken, so the tag parser never reads a spent tag from it. */
const quoted = (text) => text.replaceAll("[pstack:", "[pstack :");
const COPIED_CHARS = 50;

const edited = (a) => a.ok !== false && (a.kind === "write" || triggersOf(a).some((t) => t.kind === "commit"));
const changed = (a) => edited(a) || (a.ok !== false && a.kind === "spawn");
const isListOp = (a) => a.kind === "todo" && a.op !== "update" && a.ok !== false;
const moves = (a) => a.kind === "todo" && a.ok !== false && (a.op === "write" || (a.op === "update" && a.items.some((i) => i.status)));

/** A reply line copied from a playbook carries that playbook's citations, not the agent's. */
const copied = (line, catalog) => {
  const n = norm(line).replace(/^\d+ /, "").slice(0, COPIED_CHARS);
  return n.length === COPIED_CHARS && Object.values(catalog.playbooks).some((p) => p.text.includes(n));
};

/**
 * @typedef {{ target: string, message: string }} Found
 * @typedef {{
 *   key: string,
 *   scope: "main" | "any",
 *   idle?: true,
 *   cap?: number,
 *   find: (s: Span, v: StopView, c: Catalog, bg: BackgroundTask[] | null) => Found[],
 * }} StopRule
 * A finding blocks once per tag in a mode span, or `cap` times. Only an `idle` rule looks at a turn with no tool call.
 */

/** @type {readonly StopRule[]} */
export const STOP_RULES = [
  {
    key: "cited-unread",
    scope: "any",
    find: (s, v, c) =>
      [...new Set(v.reply.split(/\r?\n/).filter((l) => !copied(l, c)).flatMap((l) => citedPrinciples(l, c)))]
        .filter((slug) => !isRead(s, `principle:${slug}`))
        .map((slug) => ({ target: slug, message: `You cited ${c.principles[slug]} without reading principles/${slug}.md in full. Read it or drop the citation.` })),
  },
  {
    key: "long-dash",
    scope: "any",
    // Text already sent cannot be rewritten, so a dash only in the turn's earlier text asks not to use it again.
    find: (s, v) => {
      const first = (texts) => texts.flatMap((text) => text.split(/\r?\n/)).find((l) => l.includes(LONG_DASH));
      const inReply = first([v.reply]);
      const line = inReply ?? first(v.texts);
      if (line === undefined) return [];
      const at = line.indexOf(LONG_DASH);
      const shown = quoted(line.slice(Math.max(0, at - DASH_CONTEXT), at + DASH_CONTEXT).trim().replaceAll(LONG_DASH, "[U+2014]"));
      const message =
        inReply !== undefined
          ? `The reply contains the long dash (U+2014), first in "${shown}". Rewrite those sentences without it.`
          : `Earlier text this turn used the long dash. Do not use it again; the reply needs no change. It was in "${shown}".`;
      return [{ target: `turn ${s.turn}`, message }];
    },
  },
  {
    key: "unslop-unread",
    scope: "any",
    find: (s, v, c) =>
      c.skills.includes("unslop") && !isRead(s, "skill:unslop")
        ? [{ target: "span", message: "Your reply is a prose surface, and you have not read the unslop skill this session. Read unslop/SKILL.md in full and apply it to this reply." }]
        : [],
  },
  {
    key: "principles-unread",
    scope: "any",
    find: (s) =>
      s.actions.some(edited) && ![...s.reads].some((d) => d.startsWith("principle:"))
        ? [
            {
              target: "span",
              message: "You changed files this session without reading any principle in full. Read the principle files that shaped the change (principles/<slug>.md) and name each one in your reply.",
            },
          ]
        : [],
  },
  {
    key: "tasks-stale",
    scope: "any",
    find: (s) => {
      const opened = s.actions.findIndex(isListOp);
      const after = opened < 0 ? [] : s.actions.slice(opened + 1);
      return after.some(changed) && !after.some(moves)
        ? [{ target: "span", message: "You opened task items, kept working, and never updated one. Update each item's state with TaskUpdate before you stop." }]
        : [];
    },
  },
  {
    key: "trail",
    scope: "any",
    find: (s, v, c) => {
      const live = s.playbooks.filter((p) => TRAIL_PLAYBOOKS.includes(p)).map((p) => c.playbooks[p].title);
      if (!live.length || s.trail || isRead(s, "skill:show-me-your-work") || /\bskip show-me-your-work:/i.test(v.reply)) return [];
      return [
        {
          target: "span",
          message: `The ${list(live)} playbook${live.length > 1 ? "s are" : " is"} live and nothing in this span wrote a decision trail. Start one per show-me-your-work/SKILL.md.`,
        },
      ];
    },
  },
  {
    key: "shape-unstated",
    scope: "main",
    find: (s, v) =>
      v.codeEdited && ![...v.texts, v.reply].some((text) => DATA_SHAPE.test(text) || SKIPS_DESIGN.test(text))
        ? [{ target: `turn ${s.turn}`, message: "This turn edited code without naming its data shape. State it in the reply: `**Shape.** <the data this change touches and how it is organized>`." }]
        : [],
  },
  {
    // `claude -p` keeps the session open for a live Monitor or background agent and stops a background shell when the
    // turn ends. Stop's `background_tasks` lists only live tasks (both measured on 2.1.281).
    key: "headless-pending",
    scope: "main",
    idle: true,
    cap: 3,
    find: (s, v, c, bg) => {
      if (!v.headless || !bg || bg.some((t) => t.type !== "shell")) return [];
      const shell = bg.find((t) => t.type === "shell");
      return shell
        ? [
            {
              target: shell.id,
              message:
                "This session runs headless, so ending this turn ends the session and kills the pending work. Wait for it in the foreground (a Monitor until-loop or a blocking Bash call), then write the final status reply.",
            },
          ]
        : [];
    },
  },
];

/** @typedef {{ id: AskId, message: string }} Finding */

/**
 * The findings a stop blocks on: each rule's, minus those whose tag already blocked as often as the rule allows.
 * @param {Span} span @param {StopView} view @param {BackgroundTask[] | null} backgroundTasks @returns {Finding[]}
 */
export function gate(span, view, catalog, backgroundTasks) {
  return STOP_RULES.filter((r) => (r.scope === "any" || span.main) && !span.standing.has(r.key) && (view.workedThisTurn || r.idle)).flatMap((r) =>
    r
      .find(span, view, catalog, backgroundTasks)
      .map((f) => ({ id: askId(r.key, f.target), message: f.message }))
      .filter((f) => (span.asked.get(f.id) ?? 0) < (r.cap ?? 1)),
  );
}

/**
 * The actor as it stood at its turn's previous stop, or null when the turn has had one stop. A stop the hook re-entered
 * is compared with it, so a block whose feedback never reached the transcript cannot repeat.
 * @param {Trace} trace @returns {Trace | null}
 */
export function previousStop(trace) {
  const turn = trace.turns.at(-1);
  const stop = turn?.stops.at(-2);
  if (!stop) return null;
  const cut = { ...turn, actions: turn.actions.slice(0, stop.actions), texts: turn.texts.slice(0, stop.texts), stops: turn.stops.slice(0, -1), asked: turn.asked.filter((a) => a.at <= stop.actions) };
  return { ...trace, turns: [...trace.turns.slice(0, -1), cut] };
}

/** @param {Finding[]} findings */
export const blockText = (findings) => `${GATE_FEEDBACK}\n${findings.map((f) => `- ${f.message} ${tag(f.id)}`).join("\n")}\nThe gate names each finding once.`;

/**
 * The doc-read asks refused since the turn's previous stop whose call then went through with the doc still unread. They
 * are logged, never blocked: getting past an ask is the design, and the log keeps its rate visible.
 * @param {Trace} trace @param {Span} span @returns {string[]}
 */
export function retryUnmet(trace, span, catalog, models, fs) {
  const turn = trace.turns.at(-1);
  const since = turn?.stops.at(-2)?.actions ?? 0;
  const actions = turn?.actions ?? [];
  return (turn?.asked ?? []).flatMap(({ id, call }) => {
    const at = actions.findIndex((a) => a.id === call);
    const rule = RULES.find((r) => id.startsWith(`${r.key}:`));
    if (at < since || !rule || rule.mode !== "ask") return [];
    const passed = actions.slice(at + 1).some((a) => a.ok === true && triggersOf(a).some((t) => t.kind === rule.on));
    const unread = passed ? stillUnread(spanOf(trace, call, span.standing, catalog), span, actions[at], id, catalog, models, fs) : [];
    return unread.length ? [`${id} went through with ${list(unread.map(docPath))} unread`] : [];
  });
}
