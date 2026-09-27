import assert from "node:assert/strict";
import { test } from "node:test";
import { consensus, parseVerdicts, requestUnits } from "./judge.mjs";
import { neutralPaths, render } from "./packet.mjs";

const trace = {
  actor: "main",
  actorId: "s",
  turns: [
    {
      index: 0,
      prompt: "/poteto-mode fix the discount",
      command: { name: "poteto-mode", args: "fix the discount" },
      injected: [],
      models: ["claude-opus-5-5"],
      reply: "1. Reproduce it yourself. done",
      actions: [
        { kind: "read", doc: "playbook:bug-fix", path: "C:/pp-parity/s1/r/r01/home/.claude/skills/poteto-mode/playbooks/bug-fix.md", full: true, ok: true },
        { kind: "spawn", agentType: "poteto-agent", model: "sonnet", prompt: "Fix C:\\pp-parity\\s1\\r\\r01\\shop-cart\\src\\cart.js", background: true, childId: "k1" },
        { kind: "say", text: "1. Reproduce it yourself. done" },
      ],
    },
  ],
  children: [
    {
      actor: "poteto-agent",
      actorId: "k1",
      children: [],
      turns: [{ index: 0, prompt: "Fix it", command: null, injected: [], models: [], reply: "done", actions: [{ kind: "write", path: "C:/pp-parity/s1/r/r01/shop-cart/src/cart.js" }, { kind: "say", text: "done" }] }],
    },
  ],
};

const roots = { workspace: "C:/pp-parity/s1/r/r01/shop-cart", skills: ["C:/pp-parity/s1/r/r01/home/.claude/skills"], home: "C:/pp-parity/s1/r/r01/home", sandbox: "C:/pp-parity/s1" };

const task = {
  id: "t",
  seed: "cart",
  expect: { delegates: true, readonlyDelegates: false },
  turns: [{ index: 0, prompt: "/poteto-mode fix the discount", expect: { mode: "on", playbook: "bug-fix", triggers: ["how"] } }],
};

test("the packet hides the harness: neutral verbs, <pstack> and <repo> paths, model tiers, delegate sections", () => {
  const p = render(trace, roots);
  assert.equal(
    p.text,
    [
      "=== turn t0 ===",
      "e1 [main] USER: /poteto-mode fix the discount",
      "e2 [main] read <pstack>/poteto-mode/playbooks/bug-fix.md (full)",
      "e3 [main] spawn poteto-agent delegate, model tier mid, background. Brief: Fix <repo>/src/cart.js",
      "e4 [main] REPLY TO USER:\n1. Reproduce it yourself. done",
      "",
      "--- delegate d1 (poteto-agent, spawned at e3) ---",
      "e5 [d1] BRIEF RECEIVED: Fix it",
      "e6 [d1] edit <repo>/src/cart.js",
      "e7 [d1] FINAL MESSAGE TO PARENT:\ndone",
      "--- end of delegate d1 ---",
    ].join("\n"),
  );
  assert.deepEqual(p.delegates, [{ id: "d1", turn: 0, role: "poteto-agent", spawnedAt: "e3" }]);
});

test("upstream's principle layout is rewritten to the port's", () => {
  assert.equal(
    neutralPaths("read C:\\pp-parity\\s1\\trees\\up\\skills\\principle-prove-it-works\\SKILL.md", { ...roots, skills: ["C:/pp-parity/s1/trees/up/skills"] }),
    "read <pstack>/poteto-mode/principles/prove-it-works.md",
  );
});

test("a verdict survives only when its quote is in a cited event of its own unit", () => {
  const p = render(trace, roots);
  const units = requestUnits(task, p);
  assert.deepEqual(
    units.map((u) => `${u.behavior} ${u.unit}`),
    ["B3-delegate-mode d1", "B5-step-list t0", "B6-trigger-runs t0", "B7-cite-read t0", "B13b-claim-labels t0", "B15-playbook-choice t0"],
  );
  const raw = `Here you go:\n${JSON.stringify([
    { behavior: "B5-step-list", unit: "t0", verdict: "pass", evidence: [{ event: "e4", quote: "Reproduce it yourself. done" }], why: "listed" },
    { behavior: "B7-cite-read", unit: "t0", verdict: "fail", evidence: [{ event: "e4", quote: "Laziness Protocol" }], why: "invented quote" },
    { behavior: "B3-delegate-mode", unit: "d1", verdict: "fail", evidence: [{ event: "e2", quote: "bug-fix.md" }], why: "wrong unit" },
    { behavior: "B15-playbook-choice", unit: "t0", verdict: "pass", evidence: [{ event: "e2", quote: "playbooks/bug-fix.md" }], why: "read it" },
    { behavior: "B13b-claim-labels", unit: "t0", verdict: "n/a", evidence: [], why: "no prose" },
    { behavior: "B9-delegated", unit: "t0", verdict: "pass", evidence: [{ event: "e3", quote: "spawn" }], why: "not requested" },
  ])}`;
  const { verdicts, dropped } = parseVerdicts(raw, p, units);
  assert.deepEqual(
    verdicts.map((v) => `${v.behavior} ${v.unit} ${v.verdict}`),
    ["B5-step-list t0 pass", "B15-playbook-choice t0 pass", "B13b-claim-labels t0 n/a"],
  );
  assert.deepEqual(
    dropped.map((d) => d.reason),
    ["no quote found in a cited event of the unit", "no quote found in a cited event of the unit", "pair not requested"],
  );
});

test("output with no JSON array keeps nothing", () => {
  const p = render(trace, roots);
  assert.deepEqual(parseVerdicts("I could not grade this.", p, requestUnits(task, p)).verdicts, []);
});

test("J1 and J2 agreeing settle a pair; a disagreement waits for J3", () => {
  const units = [
    { behavior: "B5-step-list", unit: "t0" },
    { behavior: "B7-cite-read", unit: "t0" },
  ];
  const v = (behavior, verdict) => ({ behavior, unit: "t0", verdict, evidence: [], why: "" });
  const j1 = [v("B5-step-list", "pass"), v("B7-cite-read", "fail")];
  const j2 = [v("B5-step-list", "pass"), v("B7-cite-read", "pass")];
  const before = consensus(units, { J1: j1, J2: j2 });
  assert.deepEqual(before.final.map((f) => `${f.behavior} ${f.verdict} ${f.source}`), ["B5-step-list pass J1+J2", "B7-cite-read unresolved none"]);
  assert.deepEqual(before.needsTiebreak, [{ behavior: "B7-cite-read", unit: "t0" }]);
  const after = consensus(units, { J1: j1, J2: j2, J3: [v("B7-cite-read", "fail")] });
  assert.equal(after.final[1].verdict, "fail");
  assert.equal(after.final[1].source, "J3");
});

test("a unit no judge graded is ungraded, and a one-sided drop is still unresolved", () => {
  const units = [
    { behavior: "B5-step-list", unit: "t0" },
    { behavior: "B7-cite-read", unit: "t0" },
  ];
  const r = consensus(units, { J1: [{ behavior: "B7-cite-read", unit: "t0", verdict: "pass", evidence: [], why: "" }], J2: [] });
  assert.deepEqual(r.final.map((f) => `${f.behavior} ${f.verdict} ${f.source}`), ["B5-step-list ungraded none", "B7-cite-read unresolved none"]);
  assert.deepEqual(r.needsTiebreak, units);
});

test("a J1 and J3 pair with J2 excluded ignores J2 and leaves a split unresolved", () => {
  const units = [
    { behavior: "B5-step-list", unit: "t0" },
    { behavior: "B7-cite-read", unit: "t0" },
  ];
  const v = (behavior, verdict) => ({ behavior, unit: "t0", verdict, evidence: [], why: "" });
  const set = { pair: ["J1", "J3"], tiebreak: null, excluded: { J2: "false flags" } };
  const r = consensus(units, { J1: [v("B5-step-list", "pass"), v("B7-cite-read", "fail")], J2: [v("B7-cite-read", "fail")], J3: [v("B5-step-list", "pass"), v("B7-cite-read", "pass")] }, set);
  assert.deepEqual(r.final.map((f) => `${f.behavior} ${f.verdict} ${f.source}`), ["B5-step-list pass J1+J3", "B7-cite-read unresolved none"]);
  assert.deepEqual(r.needsTiebreak, []);
});
