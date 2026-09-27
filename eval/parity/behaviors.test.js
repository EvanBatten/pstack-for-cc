import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { BEHAVIORS, factVerdicts, promptsMatch } from "./behaviors.mjs";
import { requestUnits } from "./judge.mjs";

const LONG_DASH = String.fromCharCode(0x2014);
const loadTask = (file) => JSON.parse(readFileSync(new URL(`./tasks/${file}`, import.meta.url), "utf8"));

const on = { mode: "on", playbook: "feature", triggers: ["how"] };
const turn = (index, prompt, reply, actions = []) => ({ index, prompt, command: null, injected: [], models: [], reply, actions: [...actions, { kind: "say", text: reply }] });
const spawn = { kind: "spawn", agentType: "poteto-agent", model: "sonnet", prompt: "Write it", background: true, childId: "k1" };

const task = {
  id: "t",
  seed: "cart",
  expect: { delegates: true, readonlyDelegates: false },
  turns: [
    { index: 0, prompt: "/poteto-mode add coupons", expect: on },
    { index: 1, prompt: "make them expire", expect: on },
  ],
};

const trace = {
  actor: "main",
  actorId: "s",
  children: [],
  turns: [turn(0, "/poteto-mode add coupons", `Added coupons ${LONG_DASH} tests pass.`, [spawn]), turn(1, "make them expire", "Coupons now expire.")],
};

test("fact verdicts: delegation per run, the long dash per mode-on turn", () => {
  assert.deepEqual(factVerdicts(task, trace), [
    { behavior: "B9-delegated", unit: "run", verdict: "pass" },
    { behavior: "B13a-long-dash", unit: "t0", verdict: "fail" },
    { behavior: "B13a-long-dash", unit: "t1", verdict: "pass" },
  ]);
});

test("a mode-off turn has no long-dash unit, and a turn missing from the trace is n/a", () => {
  const offTask = { ...task, turns: [task.turns[0], { ...task.turns[1], expect: { mode: "off", playbook: null, triggers: [] } }] };
  assert.deepEqual(factVerdicts(offTask, trace), [
    { behavior: "B9-delegated", unit: "run", verdict: "pass" },
    { behavior: "B13a-long-dash", unit: "t0", verdict: "fail" },
  ]);
  assert.deepEqual(factVerdicts(task, { ...trace, turns: [trace.turns[0]] }).at(-1), { behavior: "B13a-long-dash", unit: "t1", verdict: "n/a" });
});

test("the old combined reply-style behavior is gone from the registry and from judge requests", () => {
  assert.deepEqual(
    BEHAVIORS.filter((b) => b.id.startsWith("B13")).map((b) => `${b.id} ${b.kind}`),
    ["B13b-claim-labels judged", "B13a-long-dash fact"],
  );
  const units = requestUnits(loadTask("t02-delegated-feature.json"), { delegates: [{ id: "d1" }] });
  assert.deepEqual(
    units.filter((u) => u.behavior.startsWith("B13")).map((u) => `${u.behavior} ${u.unit}`),
    ["B13b-claim-labels t0", "B13b-claim-labels t1", "B13b-claim-labels t2"],
  );
});

test("t05 plans every judged pair and fact unit for a two-delegate session", () => {
  const t05 = loadTask("t05-tax-receipt.json");
  assert.deepEqual(
    requestUnits(t05, { delegates: [{ id: "d1" }, { id: "d2" }] }).map((u) => `${u.behavior} ${u.unit}`),
    [
      "B1-mode-sticky t1",
      "B3-delegate-mode d1",
      "B3-delegate-mode d2",
      "B5-step-list t0",
      "B5-step-list t1",
      "B6-trigger-runs t0",
      "B6-trigger-runs t1",
      "B7-cite-read t0",
      "B7-cite-read t1",
      "B13b-claim-labels t0",
      "B13b-claim-labels t1",
      "B15-playbook-choice t0",
      "B15-playbook-choice t1",
    ],
  );
  const run = { ...trace, turns: t05.turns.map((t, i) => turn(t.index, t.prompt, "Done.", i === 0 ? [spawn] : [])) };
  assert.deepEqual(factVerdicts(t05, run), [
    { behavior: "B9-delegated", unit: "run", verdict: "pass" },
    { behavior: "B13a-long-dash", unit: "t0", verdict: "pass" },
    { behavior: "B13a-long-dash", unit: "t1", verdict: "pass" },
  ]);
});

test("a trace matches its task only when every turn's prompt is the task's current one", () => {
  const t02 = loadTask("t02-delegated-feature.json");
  const recorded = (prompts) => ({ ...trace, turns: prompts.map((p, i) => turn(i, p, "Done.")) });
  const current = t02.turns.map((t) => t.prompt);
  assert.equal(promptsMatch(t02, recorded(current)), true);
  assert.equal(promptsMatch(t02, recorded([current[0], "Customers type codes in lowercase too. Make codes case-insensitive.", current[2]])), false);
  assert.equal(promptsMatch(t02, recorded(current.slice(0, 2))), false);
});

test("the new prompts never name a playbook, skill or principle", () => {
  const named = /\b(feature|bug|investigation|playbook|skill|principle|how|why|architect|delegate|subagent|arena|swarm)\b/i;
  const prompts = [...loadTask("t05-tax-receipt.json").turns.map((t) => t.prompt), loadTask("t02-delegated-feature.json").turns[1].prompt];
  assert.equal(prompts.length, 3);
  assert.deepEqual(
    prompts.map((p) => p.replace(/^\/poteto-mode /, "")).filter((p) => named.test(p)),
    [],
  );
});
