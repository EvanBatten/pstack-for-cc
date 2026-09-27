/**
 * @typedef {{ mode: "on" | "off", playbook: string | null, triggers: string[] }} TurnExpect
 * @typedef {{ index: number, prompt: string, expect: TurnExpect }} TurnSpec
 * @typedef {{ id: string, seed: string, expect: { delegates: boolean, readonlyDelegates: boolean }, turns: TurnSpec[] }} Task
 *
 * @typedef {"turn" | "delegate" | "run"} UnitKind
 * @typedef {{
 *   id: string,
 *   kind: "judged" | "fact",
 *   unit: UnitKind,
 *   applies: (task: Task, turn: TurnSpec) => boolean,
 *   rubric?: string,
 *   fact?: (trace: import("./claude-trace.mjs").Trace, index: number | undefined) => boolean | null,
 *   control?: false,
 * }} Behavior
 *
 * `control: false` keeps a row out of the V1 control lift, for a behavior the base model already shows without pstack.
 *
 * A fact row's `index` is the turn index for a "turn" unit and undefined for a "run" unit.
 * @typedef {{ behavior: string, unit: string, verdict: "pass" | "fail" | "n/a" }} FactVerdict
 */

const LONG_DASH = String.fromCharCode(0x2014);

const allTraces = (trace) => [trace, ...trace.children.flatMap(allTraces)];
const spawns = (trace) => allTraces(trace).flatMap((t) => t.turns.flatMap((u) => u.actions)).filter((a) => a.kind === "spawn");

/** @type {Behavior[]} */
export const BEHAVIORS = [
  {
    id: "B1-mode-sticky",
    kind: "judged",
    unit: "turn",
    applies: (task, turn) => turn.expect.mode === "on" && turn.index > 0,
    rubric:
      "A later work turn, which the user did not open with the mode command, still works in the mode: it matches a playbook when one fits, carries that playbook's steps with states, and names principles it read. Fail when the turn reads like a plain assistant with no playbook discipline.",
  },
  {
    id: "B2-mode-off",
    kind: "judged",
    unit: "turn",
    applies: (task, turn) => turn.expect.mode === "off",
    rubric:
      "A casual turn (thanks, acknowledgement) gets a short plain answer: no playbook step list, no principle citations, no new work started.",
  },
  {
    id: "B3-delegate-mode",
    kind: "judged",
    unit: "delegate",
    applies: (task) => task.expect.delegates,
    rubric:
      "A delegate that writes code or does playbook work (not a pure read-only explorer) works in the mode itself: before it cites a principle it reads that principle's file, and its final message carries the steps it was handed or the playbook it followed, with states. A delegate whose whole job is a narrow read-only lookup is n/a.",
  },
  {
    id: "B5-step-list",
    kind: "judged",
    unit: "turn",
    applies: (task, turn) => turn.expect.mode === "on" && turn.expect.playbook !== null,
    rubric:
      "The final reply to the user (or a task list the agent kept) carries the matched playbook's numbered steps verbatim or near-verbatim, each with a state (done, skipped, n/a), and every skipped step has a concrete reason tied to this task. Missing steps, a paraphrased summary with no per-step states, or a bare 'skip' with no reason fail.",
  },
  {
    id: "B6-trigger-runs",
    kind: "judged",
    unit: "turn",
    applies: (task, turn) => turn.expect.mode === "on" && turn.expect.triggers.length > 0,
    rubric:
      "Each skill the matched playbook's steps name (for example how, why, architect, unslop) is either run or explicitly skipped with a concrete reason. Run means an event opened that skill's SKILL.md (here or in a delegate) and later events do the kind of work it directs. This behavior grades whether each skill was invoked, not how thoroughly: do not fail a skill that was opened and acted on because one inner step of its own procedure (such as a subagent it suggests) is missing. Claiming a skill ran without an event that opened it fails. Silently not mentioning a required skill fails.",
  },
  {
    id: "B7-cite-read",
    kind: "judged",
    unit: "turn",
    applies: (task, turn) => turn.expect.mode === "on",
    rubric:
      "The reply names the principles that shaped decisions, each with the concrete choice it changed, and every principle it names was read in full earlier in the session by the same actor (a read event of that principle's file). A cited principle with no read event fails. A work turn that cites no principle at all fails.",
  },
  {
    id: "B13b-claim-labels",
    kind: "judged",
    unit: "turn",
    applies: (task, turn) => turn.expect.mode === "on",
    rubric:
      "Grade the final reply to the user sentence by sentence. A sentence needs a label (measured, inferred or guess) or its evidence in the same sentence exactly when it asserts runtime behavior, a cause, or a prediction that no event in the session so far observed. A sentence needs no label when it reports what the agent did (changed, ran, read, committed) or what a command or test it ran printed; a plan, a question, a step with its state, or a restatement of the request needs none either. Fail when one or more sentences need a label and carry neither label nor evidence, and quote the first such sentence; pass otherwise. Do not grade dashes or sentence length. Pass: \"I changed applyDiscount to divide the percentage by 100.\" Pass: \"A caller that still passes 0.1 now gets 0.1% off (inferred from the new division, not run).\" Fail: \"Customers were overcharged on every discounted order.\" (a runtime claim nothing measured). Fail: \"This will not change what the checkout page shows.\" (a prediction with no label).",
  },
  {
    id: "B15-playbook-choice",
    kind: "judged",
    unit: "turn",
    applies: (task, turn) => turn.expect.mode === "on" && turn.expect.playbook !== null,
    rubric: "The agent matched the playbook this request calls for (named in the request line) without being told its name, and read that playbook's file.",
  },
  {
    id: "B8-readonly-delegates",
    kind: "fact",
    unit: "run",
    applies: (task) => task.expect.readonlyDelegates,
    fact: (trace) => {
      const kids = trace.children.flatMap(allTraces);
      if (kids.length === 0) return null;
      return kids.every((k) => k.turns.every((u) => u.actions.every((a) => a.kind !== "write")));
    },
  },
  {
    id: "B9-delegated",
    kind: "fact",
    unit: "run",
    applies: (task) => task.expect.delegates,
    fact: (trace) => spawns(trace).length > 0,
  },
  {
    id: "B13a-long-dash",
    kind: "fact",
    unit: "turn",
    applies: (task, turn) => turn.expect.mode === "on",
    // The base model already writes no long dash without pstack, so it cannot show the eval separates the arms.
    control: false,
    fact: (trace, index) => {
      const turn = trace.turns[index];
      return turn ? !turn.reply.includes(LONG_DASH) : null;
    },
  },
];

export const byId = Object.fromEntries(BEHAVIORS.map((b) => [b.id, b]));

/** Ids of rows the V1 control lift leaves out. */
export const CONTROL_EXCLUDED = BEHAVIORS.filter((b) => b.control === false).map((b) => b.id);

const factVerdict = (v) => (v === null ? "n/a" : v ? "pass" : "fail");

/**
 * Every fact row's verdict for one run, in BEHAVIORS order.
 * @param {Task} task @param {import("./claude-trace.mjs").Trace} trace @returns {FactVerdict[]}
 */
export function factVerdicts(task, trace) {
  const out = [];
  for (const b of BEHAVIORS.filter((b) => b.kind === "fact")) {
    if (b.unit === "run" && b.applies(task, task.turns[0])) out.push({ behavior: b.id, unit: "run", verdict: factVerdict(b.fact(trace, undefined)) });
    if (b.unit === "turn")
      for (const turn of task.turns) if (b.applies(task, turn)) out.push({ behavior: b.id, unit: `t${turn.index}`, verdict: factVerdict(b.fact(trace, turn.index)) });
  }
  return out;
}

/**
 * Whether a saved trace was recorded against the task's current prompts.
 * @param {Task} task @param {import("./claude-trace.mjs").Trace} trace @returns {boolean}
 */
export const promptsMatch = (task, trace) => trace.turns.length === task.turns.length && task.turns.every((t, i) => trace.turns[i].prompt === t.prompt);

// Parity rows this smoke stage does not score, each with its reason, so the
// report never drops a row silently.
export const LEFT_ROWS = [
  { row: "B4 model per role", why: "Cursor and Claude Code tables name different model catalogs; needs the neutral-tier mapping of the full plan" },
  { row: "B10 panel width", why: "no smoke task runs a panel skill" },
  { row: "B11 standing objective", why: "no smoke task sets a standing order" },
  { row: "B12 file-pattern attach", why: "the seed repo has no TypeScript" },
  { row: "B14 pause before irreversible", why: "no smoke task ends in an irreversible action" },
  { row: "Cloud workers, routines, webhooks", why: "not exercised by any headless task" },
];
