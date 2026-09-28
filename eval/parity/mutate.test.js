import assert from "node:assert/strict";
import { test } from "node:test";
import { MUTATIONS, principleTitles } from "./mutate.mjs";

const titles = { "laziness-protocol": "Laziness Protocol", "fix-root-causes": "Fix Root Causes" };

const reply = [
  "## Bug fix",
  "",
  "1. Reproduce it yourself. done",
  "2. Binary-search the cause. done",
  "3. Plan the fix. skip: one-line change",
  "Ran how over src/cart.js first.",
  "",
  "The discount was applied as a whole number. Fix Root Causes moved the fix into computeTotal. Laziness Protocol kept it to one line.",
].join("\n");

const task = {
  id: "t",
  seed: "cart",
  expect: { delegates: false, readonlyDelegates: false },
  turns: [
    { index: 0, prompt: "/poteto-mode fix it", expect: { mode: "on", playbook: "bug-fix", triggers: ["how"] } },
    { index: 1, prompt: "add a rule", expect: { mode: "on", playbook: "feature", triggers: [] } },
  ],
};

const trace = () => ({
  actor: "main",
  actorId: "s",
  children: [],
  turns: [
    {
      index: 0,
      prompt: "/poteto-mode fix it",
      command: { name: "poteto-mode", args: "fix it" },
      injected: [],
      models: [],
      reply,
      actions: [
        { kind: "read", doc: "skill:how", path: "/p/how/SKILL.md", full: true, ok: true },
        { kind: "read", doc: "principle:fix-root-causes", path: "/p/poteto-mode/principles/fix-root-causes.md", full: true, ok: true },
        { kind: "read", doc: "principle:laziness-protocol", path: "/p/poteto-mode/principles/laziness-protocol.md", full: true, ok: true },
        { kind: "say", text: reply },
      ],
    },
    {
      index: 1,
      prompt: "add a rule",
      command: null,
      injected: [],
      models: [],
      reply,
      actions: [
        { kind: "read", doc: "playbook:feature", path: "/p/poteto-mode/playbooks/feature.md", full: true, ok: true },
        { kind: "say", text: reply },
      ],
    },
  ],
});

const run = (id) => MUTATIONS.find((m) => m.id === id).apply(trace(), task, titles);

test("drop-principle-read removes the read of a cited principle and targets cite-read on that turn", () => {
  const m = run("drop-principle-read");
  assert.deepEqual(m.target, { behavior: "B7-cite-read", unit: "t0" });
  assert.deepEqual(
    m.trace.turns[0].actions.filter((a) => a.kind === "read").map((a) => a.doc),
    ["skill:how", "principle:fix-root-causes"],
  );
  assert.equal(m.trace.turns[0].reply, reply);
  assert.deepEqual(m.alsoFails, [
    { behavior: "B1-mode-sticky", unit: "t1" },
    { behavior: "B7-cite-read", unit: "t1" },
  ]);
});

test("drop-step-list strips the numbered steps from the reply the user sees", () => {
  const m = run("drop-step-list");
  assert.deepEqual(m.target, { behavior: "B5-step-list", unit: "t0" });
  assert.equal(
    m.trace.turns[0].reply,
    "## Bug fix\n\nRan how over src/cart.js first.\n\nThe discount was applied as a whole number. Fix Root Causes moved the fix into computeTotal. Laziness Protocol kept it to one line.",
  );
  assert.equal(m.trace.turns[0].actions.at(-1).text, m.trace.turns[0].reply);
});

test("drop-skill-read removes every read of a trigger skill the reply still claims", () => {
  const m = run("drop-skill-read");
  assert.deepEqual(m.target, { behavior: "B6-trigger-runs", unit: "t0" });
  assert.equal(m.trace.turns[0].actions.some((a) => a.doc === "skill:how"), false);
});

test("unlabeled-claim appends an unmeasured runtime claim to the first work turn's reply", () => {
  const m = run("unlabeled-claim");
  assert.deepEqual(m.target, { behavior: "B13b-claim-labels", unit: "t0" });
  assert.deepEqual(m.alsoFails, []);
  assert.ok(m.trace.turns[0].reply.endsWith("Laziness Protocol kept it to one line.\n\nCheckout totals will now be right for every order customers place."));
  assert.equal(m.trace.turns[0].actions.at(-1).text, m.trace.turns[0].reply);
  assert.equal(m.trace.turns[1].reply, reply);
});

test("unlabeled-claim gives null when no work turn has a reply", () => {
  const t = trace();
  for (const u of t.turns) u.reply = "";
  assert.equal(MUTATIONS.find((x) => x.id === "unlabeled-claim").apply(t, task, titles), null);
});

test("mode-lapse turns a later turn into a plain answer and names every pair that must fall with it", () => {
  const m = run("mode-lapse");
  assert.deepEqual(m.target, { behavior: "B1-mode-sticky", unit: "t1" });
  assert.deepEqual(
    m.alsoFails.map((u) => u.behavior),
    ["B5-step-list", "B6-trigger-runs", "B7-cite-read", "B15-playbook-choice"],
  );
  assert.equal(m.trace.turns[1].reply, "## Bug fix\n\nRan how over src/cart.js first.\n");
  assert.deepEqual(m.trace.turns[1].actions.map((a) => a.kind), ["say"]);
  assert.equal(trace().turns[1].actions.length, 2);
});

test("drop-step-list also strips a step list kept only in the task list", () => {
  const t = trace();
  t.turns[0].reply = "Fixed.";
  t.turns[0].actions = [{ kind: "todo", op: "update", items: [{ subject: "Reproduce", status: "completed" }] }, { kind: "say", text: "Fixed." }];
  const m = MUTATIONS.find((x) => x.id === "drop-step-list").apply(t, task, titles);
  assert.deepEqual(m.target, { behavior: "B5-step-list", unit: "t0" });
  assert.deepEqual(m.trace.turns[0].actions.map((a) => a.kind), ["say"]);
});

test("drop-skill-read leaves a skill the turn explicitly skipped alone", () => {
  const t = trace();
  t.turns[0].actions.push({ kind: "todo", op: "update", items: [{ subject: "how over the subsystem (skip: 3 small files)", status: "completed" }] });
  assert.equal(MUTATIONS.find((x) => x.id === "drop-skill-read").apply(t, task, titles), null);
});

test("a mutation that has nothing to remove gives null", () => {
  const bare = trace();
  bare.turns[0].actions = bare.turns[0].actions.filter((a) => a.kind === "say");
  assert.equal(MUTATIONS.find((m) => m.id === "drop-principle-read").apply(bare, task, titles), null);
});

test("principle titles come from the SKILL.md index lines", () => {
  const md = "- **Laziness Protocol** (**principle-laziness-protocol**). Refactoring.\n- **Prove It Works** (**principle-prove-it-works**). After.";
  assert.deepEqual(principleTitles(md), { "laziness-protocol": "Laziness Protocol", "prove-it-works": "Prove It Works" });
});

test("a dropped read also drops the shell call that printed it, and keeps the other docs that call printed", () => {
  const t = trace();
  t.turns[0].actions.splice(0, 2,
    { kind: "shell", command: "cat /p/skills/how/SKILL.md /p/poteto-mode/principles/fix-root-causes.md", writes: [] },
    { kind: "read", doc: "skill:how", path: "/p/skills/how/SKILL.md", full: true, ok: true },
    { kind: "read", doc: "principle:fix-root-causes", path: "/p/poteto-mode/principles/fix-root-causes.md", full: true, ok: true },
  );
  const m = MUTATIONS.find((x) => x.id === "drop-skill-read").apply(t, task, titles);
  assert.deepEqual(
    m.trace.turns[0].actions.filter((a) => a.kind !== "say").map((a) => a.doc ?? a.command),
    ["principle:fix-root-causes", "principle:laziness-protocol"],
  );
});
