import { createHash } from "node:crypto";
import { posix } from "node:path";
import { briefLedger, briefPlaybook, citedPrinciples, docsIn, ledgersIn, list, modelRole, norm, OMIT_MODEL, playbookRead, stepNeeds, stepOf, stepRange } from "./catalog.mjs";
import { ABSOLUTE, fileKind, gitBashPath, inRepo, initsRepo, isHarness, isIgnored, isSource, MCP_PR, namedPaths, runsScript, shellWrites, throwawayRepos, vcsVerbs } from "./kinds.mjs";
import { modeOf } from "./trace.mjs";

/** @typedef {import("./trace.mjs").Action} Action */
/** @typedef {import("./trace.mjs").Trace} Trace */
/** @typedef {import("./trace.mjs").TaskItem} TaskItem */
/** @typedef {import("./trace.mjs").AskId} AskId */
/** @typedef {import("./catalog.mjs").Catalog} Catalog */
/** @typedef {import("./catalog.mjs").DocId} DocId */
/** @typedef {ReturnType<typeof import("./catalog.mjs").modelTable>} Models */

/**
 * What one call does, from its structured input alone. A `change` is an edit of code or a doc, a commit, or a
 * poteto-agent spawn: the calls a playbook should shape.
 * @typedef {(
 *   | { kind: "work" }
 *   | { kind: "change", file?: string | null, spawn?: Extract<Action, { kind: "spawn" }> }
 *   | { kind: "code-edit", path: string, file?: string | null, inRepo?: boolean }
 *   | { kind: "skill-edit" | "doc-edit", path: string }
 *   | { kind: "trail-write" }
 *   | { kind: "commit", command: string }
 *   | { kind: "pr-open", draft: boolean }
 *   | { kind: "pr-merge" }
 *   | { kind: "task-create" | "task-complete", item: TaskItem }
 *   | { kind: "spawn", spawn: Extract<Action, { kind: "spawn" }> }
 * )} Trigger
 */

const LOG_SCRIPT = /show-me-your-work[\\/]scripts[\\/]log\.sh/;
/** A `>>` append straight into a decision log, as `printf ... >> .audit/climb/decisions.tsv` writes a row. */
const appendsLog = (command) => [...command.matchAll(/>>\s*["']?([^\s"';&|]+)/g)].some((m) => fileKind(m[1]) === "trail");
const EDITS = { code: "code-edit", "skill-doc": "skill-edit", "reader-doc": "doc-edit" };
const WORK = /** @type {const} */ ({ kind: "work" });
const CHANGE = /** @type {const} */ ({ kind: "change" });
/** A literal Shape line with content after it, in visible text, names the data a code change touches. */
export const DATA_SHAPE = /\*\*Shape\.\*\*\s*\S/;
/** A visible `skip design: <reason>` line declines the Shape line and the model-the-domain read for its turn. */
export const SKIPS_DESIGN = /^\s*skip design:\s*\S/im;

/** What writing one file raises: a change and its edit trigger for code or a doc, a trail write for a decision log. */
const fileWrite = (raw, file, shell = false) => {
  // A shell target is code only by a source extension; captured output such as `> run.console` is not a program.
  const kind = shell && fileKind(raw) === "code" && !isSource(raw) ? "other" : fileKind(raw);
  const path = posix.normalize(gitBashPath(raw));
  return [
    ...(kind in EDITS ? [kind === "code" ? { ...CHANGE, file } : CHANGE, { kind: EDITS[kind], path, ...(kind === "code" ? { file } : {}) }] : []),
    ...(kind === "trail" ? [{ kind: "trail-write" }] : []),
  ];
};

/** @param {Action} action @returns {Trigger[]} */
export function triggersOf(action) {
  switch (action.kind) {
    case "todo":
      return [
        ...(action.op === "update" ? [] : action.items.filter((item) => item.subject).map((item) => ({ kind: "task-create", item }))),
        ...(action.op === "create" ? [] : action.items.filter((item) => item.status === "completed").map((item) => ({ kind: "task-complete", item }))),
      ];
    case "write":
      return [WORK, ...fileWrite(action.path, action.path)];
    case "shell":
      return [
        WORK,
        // A relative target with no known directory is still classified, but names no file the repository check can find.
        ...shellWrites(action.command, action.cwd ?? null).flatMap((p) => fileWrite(p, ABSOLUTE.test(p) ? p : null, true)),
        ...vcsVerbs(action.command).flatMap((v) => (v.verb === "pr-open" ? [{ kind: "pr-open", draft: v.draft }] : v.verb === "commit" ? [CHANGE, { kind: "commit", command: action.command }] : [{ kind: v.verb }])),
        ...(runsScript(action.command, LOG_SCRIPT) || appendsLog(action.command) ? [{ kind: "trail-write" }] : []),
      ];
    case "other":
      return [
        WORK,
        ...(MCP_PR.open.test(action.tool) ? [{ kind: "pr-open", draft: action.input?.draft === true }] : []),
        ...(MCP_PR.merge.test(action.tool) ? [{ kind: "pr-merge" }] : []),
      ];
    case "spawn":
      return [WORK, ...(action.agentType === "poteto-agent" ? [{ kind: "change", spawn: action }] : []), { kind: "spawn", spawn: action }];
    default:
      return [];
  }
}

/**
 * What an actor's mode span shows before the pending call. It holds no reply and no narration, so no check before a call
 * can read either. `shaped` is whether a visible text of the current turn, before the call, holds a Shape line, and
 * `designSkipped` whether one holds a `skip design:` line.
 * @typedef {{
 *   main: boolean,
 *   turn: number,
 *   actions: readonly Action[],
 *   reads: ReadonlySet<DocId>,
 *   playbooks: readonly string[],
 *   playbookReadAt: Readonly<Record<string, number>>,
 *   unlisted: readonly string[],
 *   tasks: readonly TaskItem[],
 *   commits: number,
 *   spawnTypes: readonly string[],
 *   trail: boolean,
 *   asked: ReadonlyMap<AskId, number>,
 *   shaped: boolean,
 *   designSkipped: boolean,
 *   siblings: readonly Action[],
 *   standing: ReadonlySet<string>,
 * }} Span
 * `reads` are the actor's catalog reads since its last compaction, plus every read in the subtree of a delegate it
 * spawned in the span. `unlisted` are the live playbooks read since the task list last opened. `asked` counts each tag.
 * `siblings` are the calls of the pending call's assistant message that come before it.
 */

const isListOp = (a) => a.kind === "todo" && a.op !== "update" && a.ok !== false;

/**
 * The calls of the pending call's assistant message that come before it. A later sibling's record can reach the
 * transcript after the pending call's result, so only an earlier one is certain to be there at PreToolUse.
 */
const siblingsOf = (turn, before) => {
  const at = turn ? turn.actions.findIndex((a) => a.id === before) : -1;
  const msg = at >= 0 ? turn.actions[at].msg : undefined;
  return msg ? turn.actions.slice(0, at).filter((a) => a.msg === msg) : [];
};
const subtree = (x) => [x, ...x.children.flatMap(subtree)];

/**
 * @param {Trace} trace @param {string | null} before the pending call's id, or null at Stop
 * @param {ReadonlySet<string>} standing @returns {Span}
 */
export function spanOf(trace, before, standing, catalog) {
  const mode = modeOf(trace);
  const since = mode.on ? mode.since : trace.turns.length;
  const at = before ? trace.turns.findLast((t) => t.actions.some((a) => a.id === before)) : undefined;
  const last = at ?? trace.turns.at(-1);
  const cutOf = (t) => (t === at ? t.actions.findIndex((a) => a.id === before) : t.actions.length);
  const turns = last ? trace.turns.slice(0, last.index + 1) : [];
  const all = turns.flatMap((t) => t.actions.slice(0, cutOf(t)));
  const spanTurns = turns.filter((t) => t.index >= since);
  const actions = spanTurns.flatMap((t) => t.actions.slice(0, cutOf(t)));
  const spawned = new Set(actions.flatMap((a) => (a.kind === "spawn" && a.ok !== false ? [a.id] : [])));
  const delegates = trace.children.filter((c) => spawned.has(c.sub?.spawnId)).flatMap(subtree);
  const delegated = delegates.flatMap((x) => x.turns.flatMap((t) => t.actions));
  const readable = all.slice(all.findLastIndex((a) => a.kind === "compact") + 1);
  const reads = new Set([...readable, ...delegated].filter((a) => a.ok).flatMap((a) => docsIn(a, catalog).map((r) => r.doc)));
  const playbookAt = [
    ...spanTurns.flatMap((t) => ledgersIn(t.prompt ?? "", catalog)).map((name) => ({ name, at: -1 })),
    ...actions.flatMap((a, i) => (a.ok ? playbookRead(a, catalog).map((name) => ({ name, at: i })) : [])),
  ];
  const listedAt = actions.findLastIndex(isListOp);
  const asked = new Map();
  for (const t of spanTurns) for (const a of t.asked) if (t !== at || a.at <= cutOf(t)) asked.set(a.id, (asked.get(a.id) ?? 0) + 1);
  const did = (kind) => (a) => a.ok !== false && triggersOf(a).some((t) => t.kind === kind);
  const turnSays = (re) => (last ? last.texts.some((x) => (last !== at || x.at <= cutOf(last)) && re.test(x.text)) : false);
  return {
    main: !trace.sub,
    turn: last?.index ?? 0,
    actions,
    reads,
    playbooks: [...new Set(playbookAt.map((p) => p.name))],
    playbookReadAt: Object.fromEntries([...playbookAt].reverse().map((p) => [p.name, p.at])),
    unlisted: [...new Set(playbookAt.filter((p) => listedAt < 0 || p.at > listedAt).map((p) => p.name))],
    tasks: tasksOf(actions),
    commits: actions.filter(did("commit")).length,
    spawnTypes: actions.flatMap((a) => (a.kind === "spawn" && a.ok !== false ? [a.agentType] : [])),
    trail: [...actions, ...delegated].some(did("trail-write")),
    asked,
    shaped: turnSays(DATA_SHAPE),
    designSkipped: turnSays(SKIPS_DESIGN),
    siblings: siblingsOf(at, before),
    standing,
  };
}

/** The task list as it stands: created items, each with its latest status and description. */
function tasksOf(actions) {
  const items = actions.flatMap((a) => (isListOp(a) ? a.items : []));
  for (const a of actions)
    if (a.kind === "todo" && a.op === "update")
      for (const u of a.items) {
        const i = items.findIndex((t) => t.id !== null && t.id === u.id);
        if (i >= 0) items[i] = { ...items[i], status: u.status ?? items[i].status, description: u.description ?? items[i].description };
      }
  return items;
}

/** @param {Span} span @param {DocId} doc */
export const isRead = (span, doc) => span.reads.has(doc) || (doc.startsWith("skill:") && span.standing.has(doc.slice("skill:".length)));

/** A doc an ask names, or several of which any one answers it. @typedef {DocId | DocId[]} DocAsk */

const DOC_PATHS = { skill: (name) => `${name}/SKILL.md`, playbook: (name) => `poteto-mode/playbooks/${name}.md`, principle: (name) => `principles/${name}.md` };

/** @param {DocAsk} d */
export const docPath = (d) =>
  [d]
    .flat()
    .map((doc) => {
      const [kind, name] = doc.split(":");
      return DOC_PATHS[kind](name);
    })
    .join(" or ");

const paths = (docs) => list(docs.map(docPath));

/**
 * @typedef {{
 *   key: string,
 *   on: Trigger["kind"],
 *   mode: "ask" | "hard" | "note",
 *   scope: "main" | "any",
 *   cites: string,
 *   when?: (t: any, s: Span, c: Catalog, models: Models) => boolean,
 *   target: (t: any, s: Span, c: Catalog) => string,
 *   docs: (t: any, s: Span, c: Catalog) => DocAsk[],
 *   say: (t: any, s: Span, c: Catalog, unread: DocAsk[], models: Models) => string,
 * }} Rule
 * An `ask` denies once per tag in a mode span, and its retry goes through. A `hard` ask's answer is literal in the next
 * call, so it denies until the call changes, at most HARD_CAP times per tag. A `note` is context after the call, once per
 * tag. A rule is raised when it applies and either names a doc the span has not read or names no doc at all.
 */

const HARD_CAP = 3;

const titles = (names, c) => list(names.map((n) => c.playbooks[n].title));

/** The live playbook whose step range a new item's subject spans, when the subject opens with its title or shares two of those steps' words. */
function mergedRange(item, s, c) {
  const range = stepRange(item.subject);
  if (!range) return null;
  const words = new Set(norm(`${item.subject} ${item.description ?? ""}`).split(" "));
  const merges = s.playbooks.some((n) => {
    const spanned = c.playbooks[n].steps.filter((st) => st.n >= range[0] && st.n <= range[1]);
    const shared = new Set(spanned.flatMap((st) => st.words).filter((w) => words.has(w)));
    return spanned.length > 0 && (` ${norm(item.subject)}`.startsWith(` ${norm(c.playbooks[n].title)} `) || shared.size >= 2);
  });
  return merges ? range : null;
}

/** The step a completed item carries and the skills that step names, when it names any. */
function completedStep(item, s, c) {
  const listed = s.tasks.find((t) => t.id !== null && t.id === item.id);
  const subject = item.subject ?? listed?.subject ?? null;
  const found = subject ? stepOf(subject, s.playbooks, c) : null;
  // The item and the call that completes it are verbatim tool input, so a skip or a note of earlier work there is certain.
  // A sentence copied from the step's own line is the playbook's text, not the worker's answer, so it is dropped first.
  const step = found ? norm(found.step.line) : "";
  const said = [subject, item.description, listed?.description]
    .filter(Boolean)
    .join("\n")
    .split(/\r?\n|(?<=[.!?])\s+/)
    .filter((sentence) => !(step && norm(sentence).length > 0 && step.includes(norm(sentence).replace(/^\d+ /, ""))))
    .join("\n");
  const skipped = (skill) => said.split(/\r?\n/).some((l) => /\bskip/i.test(l) && new RegExp(`(?<![\\w-])${skill}(?![\\w-])`, "i").test(l));
  // pstack declines a step with `skip: <reason>`, so a reasoned skip in the worker's own words answers the whole step.
  const declined = /\bskip:\s*[\w`]/i.test(said);
  const needs = found && !declined && !PRIOR_SESSION.test(said) ? stepNeeds(found.step).filter((need) => !need.skills.some(skipped)) : [];
  return needs.length ? { ...found, needs } : null;
}

// A prior session answers a step only beside a word that says the step was done there.
const PRIOR_SESSION = /\b(done|completed?|finished)\b[^.]{0,40}\b(prior|previous|earlier) sessions?\b|\b(prior|previous|earlier) sessions?\b[^.]{0,40}\b(done|completed?|finished)\b/i;

const citedIn = (t, c) =>citedPrinciples(t.spawn.prompt, c).sort();

const ROUTE_DOC = (doc) => doc.startsWith("playbook:") || doc === "skill:figure-it-out";
const readsRoute = (a, c) => docsIn(a, c).some((r) => ROUTE_DOC(r.doc));
/**
 * Whether the span still owes a route: no playbook ledger, and no playbook or figure-it-out read in the span or in an
 * earlier call of the pending call's message.
 * @param {Span} s
 */
const unrouted = (s, c) => s.playbooks.length === 0 && ![...s.reads].some(ROUTE_DOC) && !s.siblings.some((a) => readsRoute(a, c));

/** A spawn brief names a playbook on a `Playbook:` line, by a catalog playbook's path, or as "<title> playbook" in prose. */
const namesPlaybook = (prompt, c) =>
  briefPlaybook(prompt, c) !== null ||
  [...prompt.matchAll(/playbooks[\\/]([\w-]+)\.md/g)].some((m) => m[1] in c.playbooks) ||
  Object.values(c.playbooks).some((p) => new RegExp(`(?<![\\w-])${escapeRe(p.title)} playbook\\b`, "i").test(prompt));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The order a call's owed asks are asked in, one per deny: route, ledger, delegate, design, design-read, then the rest. */
/** @type {readonly Rule[]} */
export const RULES = [
  {
    // A session that never reads a playbook meets no ledger, step or delegate ask, so its first change asks for one.
    key: "route",
    on: "change",
    mode: "ask",
    // A subagent works one step of its parent's task, and the parent owns routing.
    scope: "main",
    cites: "Match the task to a playbook below, open its file, and copy its steps in verbatim.",
    when: (t, s, c) => !(t.spawn && namesPlaybook(t.spawn.prompt, c)) && unrouted(s, c),
    target: () => "span",
    docs: () => [],
    say: () =>
      "poteto-mode routes every task through a playbook: read the matching `playbooks/<name>.md` (or figure-it-out for large or stepped-away work), open its task list, then retry; or write the visible line `skip route: <reason>`.",
  },
  {
    key: "ledger",
    on: "work",
    mode: "ask",
    scope: "main",
    cites: "Open a task list with TaskCreate",
    when: (t, s) => s.unlisted.length > 0,
    target: (t, s) => s.unlisted.join(","),
    docs: () => [],
    say: (t, s, c) =>
      `Before other work, open the task list: one TaskCreate per step of the ${titles(s.unlisted, c)} playbook${s.unlisted.length > 1 ? "s" : ""}, its subject copied from the step line.`,
  },
  {
    key: "delegate",
    on: "code-edit",
    mode: "ask",
    scope: "main",
    cites: "Delegate code-writing to a subagent",
    // Only code in a repository is the implementation a playbook hands off; a harness or probe outside one is not.
    when: (t, s, c) => undelegated(t, s, c) !== undefined,
    target: (t, s, c) => undelegated(t, s, c).target,
    docs: () => [],
    say: (t, s, c, unread, models) => {
      const { name, spawns } = undelegated(t, s, c);
      const step = delegationStep(name, c);
      const skip = step.line.includes("no skip-with-reason escape") ? "" : ", or write the visible line `skip delegate: <reason>`";
      const title = c.playbooks[name].title;
      return spawns
        ? `The ${title} playbook hands the fix to a subagent: send this change back to the delegate${skip}, then retry.`
        : `The ${title} playbook hands the implementation to a subagent in step ${step.n}: spawn \`poteto-agent\` with ${roleModel(name, c, models)} and a tight brief${skip}, then retry.`;
    },
  },
  {
    key: "design",
    on: "code-edit",
    mode: "ask",
    scope: "main",
    cites: "Any code → name the data shape first",
    // A Shape line or a `skip design:` line already in this turn's text answers it.
    when: (t, s) => !s.shaped && !s.designSkipped,
    target: (t, s) => `turn ${s.turn}`,
    docs: () => [],
    say: () =>
      "Before editing source, write a line `**Shape.** <the data this change touches and how it is organized>` in your reply, then retry this call unchanged. If you already wrote the Shape line this turn, retry unchanged.",
  },
  {
    // A deny that asks for two things gets one of them done, so the principle read waits until the Shape ask was seen.
    key: "design-read",
    on: "code-edit",
    mode: "ask",
    scope: "main",
    cites: "choose its organizing structure per **principle-model-the-domain**",
    when: (t, s) => s.asked.has(askId("design", `turn ${s.turn}`)) && !s.designSkipped,
    target: () => "span",
    docs: () => ["principle:model-the-domain"],
    say: (t, s, c, unread) => `Before this edit, read ${paths(unread)} in full, then retry this call unchanged.`,
  },
  {
    key: "task-merged",
    on: "task-create",
    mode: "hard",
    scope: "any",
    cites: "whose first items are the matched playbook's steps, copied in verbatim",
    when: (t, s, c) => mergedRange(t.item, s, c) !== null,
    target: (t) => t.item.subject,
    docs: () => [],
    say: (t, s, c) => {
      const [a, b] = mergedRange(t.item, s, c);
      return `One TaskCreate per step: this subject spans steps ${a}-${b}, so it carries none of them. Create each step as its own item.`;
    },
  },
  {
    key: "step-done",
    on: "task-complete",
    mode: "ask",
    scope: "main",
    cites: "A step you choose not to do stays in the list with a one-line `skip: <reason>`.",
    when: (t, s, c) => completedStep(t.item, s, c) !== null,
    target: (t, s, c) => {
      const { name, step } = completedStep(t.item, s, c);
      return `${name}#${step.n}`;
    },
    docs: (t, s, c) => completedStep(t.item, s, c).needs.map((need) => need.skills.map((skill) => `skill:${skill}`)),
    say: (t, s, c, unread) => {
      const { name, step, needs } = completedStep(t.item, s, c);
      const named = needs.map((need) => need.name);
      return `${c.playbooks[name].title} step ${step.n} names the ${list(named)} skill${named.length > 1 ? "s" : ""}. Before you mark it completed, read ${paths(unread)} in full and run ${unread.length > 1 ? "each" : "it"}.`;
    },
  },
  {
    key: "skill-edit",
    on: "skill-edit",
    mode: "ask",
    scope: "any",
    cites: "Writing or editing a SKILL.md.",
    // One ask per skill: the files of one skill directory, or one agent definition.
    target: (t) => t.path.match(/^(.*?(?:^|\/)skills\/[^/]+\/)/)?.[1] ?? t.path,
    docs: () => ["playbook:authoring-a-skill", "skill:unslop"],
    say: (t, s, c, unread) => `Before editing a skill document, read ${paths(unread)} in full.`,
  },
  {
    key: "docs-prose",
    on: "doc-edit",
    mode: "ask",
    scope: "any",
    cites: "Docs, RFCs, readmes, PR descriptions, or commit messages → the **technical-writing** skill",
    target: () => "span",
    docs: () => ["skill:technical-writing", "skill:unslop"],
    say: (t, s, c, unread) => `Before editing documentation, read ${paths(unread)} in full.`,
  },
  {
    key: "decision-log",
    on: "trail-write",
    mode: "ask",
    scope: "any",
    cites: "a decision trail via the **show-me-your-work** skill",
    target: () => "span",
    docs: () => ["skill:show-me-your-work"],
    say: (t, s, c, unread) => `Before writing the decision log, read ${paths(unread)} in full.`,
  },
  {
    key: "deslop",
    on: "commit",
    mode: "ask",
    scope: "any",
    cites: "Before commit → the `deslop` skill",
    when: (t, s) => {
      const since = s.actions.findLastIndex((a) => a.ok !== false && triggersOf(a).some((x) => x.kind === "commit"));
      // The playbooks hand code to a poteto-agent, so its spawn counts as a code edit.
      const edited = s.actions
        .slice(since + 1)
        .some((a) => a.ok !== false && ((a.kind === "spawn" && a.agentType === "poteto-agent") || triggersOf(a).some((x) => x.kind === "code-edit")));
      // A commit into a repository this command or an earlier one made in a temp directory is a throwaway, not the work.
      const throwaways = throwawayRepos(s.actions.flatMap((a) => (a.kind === "shell" ? [a.command] : [])));
      return !initsRepo(t.command, throwaways) && (edited || namedPaths(t.command).some((p) => fileKind(p) === "code"));
    },
    // Owed once per commit that carries new code, so reading the skill for an earlier commit does not answer a later one.
    target: (t, s) => `commit ${s.commits}`,
    docs: () => [],
    say: (t, s) =>
      isRead(s, "skill:deslop") ? "Before committing, run the deslop skill on the staged diff." : `Before committing, read ${paths(["skill:deslop"])} in full and run it on the staged diff.`,
  },
  {
    key: "pr-draft",
    on: "pr-open",
    mode: "hard",
    scope: "any",
    cites: "Open every PR ready, never as a draft.",
    when: (t) => t.draft,
    target: () => "span",
    docs: () => [],
    say: () => "Open every PR ready, never as a draft. Drop the draft flag.",
  },
  {
    key: "review",
    on: "pr-open",
    mode: "ask",
    scope: "any",
    cites: "Before review → the **no-comments** skill",
    when: (t, s) => !s.spawnTypes.includes("comment-sicko"),
    target: () => "span",
    docs: () => ["skill:no-comments"],
    say: (t, s, c, unread) => `Before this PR opens, read ${paths(unread)} in full and run it on the diff, or spawn \`comment-sicko\` on it.`,
  },
  {
    key: "pr-prose",
    on: "pr-open",
    mode: "ask",
    scope: "any",
    cites: "Write every PR title, PR description, and commit body with `/technical-writing`, then apply `/unslop`.",
    target: () => "span",
    docs: () => ["skill:technical-writing", "skill:unslop"],
    say: (t, s, c, unread) => `Before this PR opens, read ${paths(unread)} in full and write its title and body with them.`,
  },
  {
    key: "shipping",
    on: "pr-merge",
    mode: "ask",
    scope: "any",
    cites: "Asked to land or ship a green stack → the **Shipping** playbook",
    target: () => "span",
    docs: () => ["playbook:shipping"],
    say: (t, s, c, unread) => `Before this merge, read ${paths(unread)} in full and run its independent per-PR verdict.`,
  },
  {
    key: "model-role",
    on: "spawn",
    mode: "hard",
    scope: "any",
    cites: "explicit model per role",
    when: (t, s, c, models) => modelRole(t.spawn, c, models) !== null,
    target: (t, s, c) => `${t.spawn.agentType} ${briefPlaybook(t.spawn.prompt, c)}`,
    docs: () => [],
    say: (t, s, c, unread, models) => modelRole(t.spawn, c, models),
  },
  {
    key: "spawn-cites",
    on: "spawn",
    mode: "ask",
    scope: "any",
    cites: "Cite only principles whose file you read this session.",
    when: (t, s, c) => citedIn(t, c).length > 0,
    target: (t, s, c) => citedIn(t, c).join(","),
    docs: (t, s, c) => citedIn(t, c).map((slug) => `principle:${slug}`),
    say: (t, s, c, unread) => `This brief cites a principle you have not read. Read ${paths(unread)} in full, or drop the citation.`,
  },
  {
    key: "tasks-stale",
    on: "commit",
    mode: "note",
    scope: "any",
    cites: "each with its state",
    when: (t, s) => {
      const opened = s.actions.findIndex(isListOp);
      return opened >= 0 && !s.actions.slice(opened + 1).some((a) => a.kind === "todo" && a.ok !== false && (a.op === "write" || a.items.some((i) => i.status)));
    },
    target: () => "span",
    docs: () => [],
    say: () => "You committed with every task item still in its first state. Update the items this commit closes with TaskUpdate.",
  },
];

const delegationStep = (name, c) => {
  const { role, steps } = c.playbooks[name];
  return steps.find((st) => st.line.includes(`configured ${role.name} model`));
};

/**
 * The delegate ask a code edit owes: the first live playbook with a delegation step whose ask for its current spawn count
 * this span has not given. Before any poteto-agent spawn it asks for one; after each, the parent's first edit is asked
 * once to send the change back. An edit outside a repository, or to a test or harness file, owes none.
 * @param {Span} s @returns {{ name: string, spawns: number, target: string } | undefined}
 */
function undelegated(t, s, c) {
  if (!t.inRepo || isHarness(t.path)) return undefined;
  for (const name of s.playbooks) {
    if (!c.playbooks[name].role || !delegationStep(name, c)) continue;
    // Only a poteto-agent is the delegate a playbook hands code to; an explorer, reader or reviewer spawn is not.
    const spawns = s.actions.slice(s.playbookReadAt[name] + 1).filter((a) => a.kind === "spawn" && a.agentType === "poteto-agent" && a.ok !== false).length;
    const target = spawns ? `${name} after spawn ${spawns}` : name;
    if (!s.asked.has(askId("delegate", target))) return { name, spawns, target };
  }
  return undefined;
}

const roleModel = (name, c, models) => {
  const { role } = c.playbooks[name];
  const value = models.roles.get(role.name) ?? role.fallback;
  return OMIT_MODEL.has(value) ? "model omitted" : `model \`${value}\``;
};

const SURFACE = "If this change ships a UI, CLI or IDE surface, drive it with control-ui or control-cli first.";

/** Sentences a deny on this trigger carries for the asks no certain check can raise. @type {Partial<Record<Trigger["kind"], (s: Span, c: Catalog, models: Models) => string[]>>} */
const HINTS = {
  "design-read": (s) => (isRead(s, "skill:architect") ? [] : ["If this change crosses a function boundary, read architect/SKILL.md first."]),
  deslop: (s) => [SURFACE, ...(s.playbooks.includes("hillclimb") ? ["Hillclimb commits only a kept attempt, after a passing gate run and its verdict row in the decision log."] : [])],
  "pr-draft": () => [SURFACE],
  review: () => [SURFACE],
  "pr-prose": () => [SURFACE],
};

export const askId = (key, target) => /** @type {AskId} */ (`${key}:${createHash("sha256").update(target).digest("hex").slice(0, 8)}`);

export const tag = (id) => `[pstack:${id}]`;

/** @typedef {{ id: AskId, rule: Rule, trigger: Trigger, text: string }} Ask */

/** @typedef {{ inRepo: (file: string) => boolean, ignored?: (file: string) => boolean }} Disk */
const DISK = { inRepo, ignored: isIgnored };

/**
 * A code edit carries whether its file sits in a git repository, the one filesystem read an ask makes.
 * @param {Action} action @param {Disk} fs @returns {Trigger[]}
 */
// The written file as the call named it is asked, since the normalized trigger path is not one the filesystem reads on every OS.
// A code file git ignores is the worker's own scratch, such as a profiling script under `.verify/`, so it changes nothing.
const placed = (action, fs) =>
  triggersOf(action)
    .filter((t) => !((t.kind === "code-edit" || t.kind === "change") && t.file && fs.ignored?.(t.file)))
    .map((t) => (t.kind === "code-edit" ? { ...t, inRepo: t.file ? fs.inRepo(t.file) : false } : t));

/** @param {Span} span @param {Action} action @param {"pre" | "post"} event @param {Disk} fs @returns {Ask[]} */
function raised(span, action, catalog, models, event, fs) {
  const out = [];
  for (const t of placed(action, fs))
    for (const r of RULES) {
      if (r.on !== t.kind || (r.mode === "note") !== (event === "post")) continue;
      if ((r.scope === "main" && !span.main) || span.standing.has(r.key) || (r.when && !r.when(t, span, catalog, models))) continue;
      const docs = r.docs(t, span, catalog);
      const unread = docs.filter((d) => ![d].flat().some((doc) => isRead(span, doc)));
      if (docs.length && !unread.length) continue;
      const id = askId(r.key, r.target(t, span, catalog));
      if ((span.asked.get(id) ?? 0) >= (r.mode === "hard" ? HARD_CAP : 1) || out.some((a) => a.id === id)) continue;
      out.push({ id, rule: r, trigger: t, text: r.say(t, span, catalog, unread, models) });
    }
  // A deny that asks for two things gets one of them done, so a call is asked only the first it owes, in table order.
  // Its retry raises the next, so N owed asks take N retries, plus a hard ask's re-denies.
  return event === "pre" ? out.sort((a, b) => RULES.indexOf(a.rule) - RULES.indexOf(b.rule)).slice(0, 1) : out;
}

/**
 * The docs a tagged ask still names as unread in `now`, with its target taken from the span `at` the refused call.
 * @param {Span} at @param {Span} now @param {Action} action @returns {DocAsk[]}
 */
export function stillUnread(at, now, action, id, catalog, models, fs = DISK) {
  for (const t of placed(action, fs))
    for (const r of RULES) {
      if (r.on !== t.kind || (r.when && !r.when(t, at, catalog, models)) || askId(r.key, r.target(t, at, catalog)) !== id) continue;
      return r.docs(t, at, catalog).filter((d) => ![d].flat().some((doc) => isRead(now, doc)));
    }
  return [];
}

/** @param {Ask[]} asks */
function render(asks, span, catalog, models) {
  const hints = [...new Set(asks.flatMap((a) => HINTS[a.rule.key]?.(span, catalog, models) ?? []))];
  const closing = [
    ...(asks.some((a) => a.rule.mode === "ask") ? ["Do what applies, then retry the call. Where an ask does not apply, say why in a `skip <name>: <reason>` line for the user, then retry."] : []),
    ...(asks.some((a) => a.rule.mode === "hard") ? [`The call is refused until it changes, at most ${HARD_CAP} times.`] : []),
  ];
  return [...asks.map((a) => `${a.text} ${tag(a.id)}`), ...hints, ...closing].join("\n");
}

/**
 * @typedef {{ kind: "allow" } | { kind: "deny", reason: string, ids: AskId[] } | { kind: "rewrite", prompt: string }} Verdict
 * @param {Span} span @param {Action} action @param {Models} models @returns {Verdict}
 */
export function check(span, action, catalog, models, fs = DISK) {
  const asks = raised(span, action, catalog, models, "pre", fs);
  if (asks.length) return { kind: "deny", reason: render(asks, span, catalog, models), ids: asks.map((a) => a.id) };
  const steps = action.kind === "spawn" ? briefLedger(action.prompt, catalog) : null;
  return steps ? { kind: "rewrite", prompt: `${action.prompt}\n\n${steps}` } : { kind: "allow" };
}

/** The context a finished call earns, once per tag. @returns {{ text: string, ids: AskId[] } | null} */
export function note(span, action, catalog, models, fs = DISK) {
  const asks = raised(span, action, catalog, models, "post", fs);
  return asks.length ? { text: asks.map((a) => `${a.text} ${tag(a.id)}`).join("\n"), ids: asks.map((a) => a.id) } : null;
}
