import assert from "node:assert/strict";
import { test } from "node:test";
import { score, wilson } from "./score.mjs";

const obs = (arm, behavior, verdicts) => verdicts.map((verdict, i) => ({ arm, run: `${arm}.${i}`, behavior, unit: `t${i}`, verdict, source: "J1+J2" }));

const calibrated = { J1: { detect: 1, falseFlag: 0, mutants: 6, pairs: 40 }, J2: { detect: 0.9, falseFlag: 0.1, mutants: 6, pairs: 40 } };

const base = (observations, over = {}) => ({
  observations,
  control: { reference: "A", control: "C", exclude: [] },
  comparisons: [{ reference: "A", treatment: "D" }],
  seal: [],
  consensusJudges: ["J1", "J2"],
  calibration: calibrated,
  runs: { total: 12, inconclusive: 0 },
  judged: { kept: 100, dropped: 2 },
  ...over,
});

const observations = [
  ...obs("A", "B5-step-list", ["pass", "pass", "pass", "fail"]),
  ...obs("C", "B5-step-list", ["fail", "fail", "fail", "fail"]),
  ...obs("D", "B5-step-list", ["pass", "fail", "fail", "fail", "n/a"]),
  ...obs("A", "B7-cite-read", ["pass", "pass", "pass", "pass"]),
  ...obs("C", "B7-cite-read", ["fail", "pass", "fail", "fail"]),
  ...obs("D", "B7-cite-read", ["pass", "pass", "pass", "pass"]),
];

const verdicts = (r, i = 0) => Object.fromEntries(r.comparisons[i].behaviors.map((b) => [b.behavior, b.verdict]));

test("a treatment trailing the reference by more than 0.10 is a GAP on that behavior only", () => {
  const r = score(base(observations));
  assert.equal(r.comparisons[0].outcome, "GAP");
  assert.deepEqual(verdicts(r), { "B5-step-list": "short", "B7-cite-read": "ok" });
  const d = r.cells.find((c) => c.behavior === "B5-step-list" && c.arm === "D");
  assert.deepEqual([d.pass, d.applicable], [1, 4]);
  assert.equal(r.gates.find((g) => g.id === "V1-control").detail, "reference minus control = 0.75 over 2 behaviors (need >= 0.3)");
});

test("a behavior with fewer than four graded units on either side is inconclusive, not parity", () => {
  const thin = [...observations, ...obs("A", "B2-mode-off", ["pass", "pass"]), ...obs("D", "B2-mode-off", ["fail", "fail", "fail", "fail"])];
  const r = score(base(thin));
  assert.equal(verdicts(r)["B2-mode-off"], "inconclusive");
  assert.equal(r.comparisons[0].outcome, "GAP");
});

test("unresolved units are counted apart and never graded", () => {
  const split = [...observations, ...obs("D", "B7-cite-read", ["unresolved", "unresolved"])];
  const d = score(base(split)).cells.find((c) => c.behavior === "B7-cite-read" && c.arm === "D");
  assert.deepEqual([d.pass, d.applicable, d.unresolved], [4, 4, 2]);
});

test("ungraded units are neither graded nor counted as split", () => {
  const silent = [...observations, ...obs("D", "B7-cite-read", ["ungraded", "ungraded", "ungraded"])];
  const d = score(base(silent)).cells.find((c) => c.behavior === "B7-cite-read" && c.arm === "D");
  assert.deepEqual([d.pass, d.applicable, d.unresolved], [4, 4, 0]);
});

test("a behavior excluded from the control lift does not dilute it", () => {
  const flat = [...observations, ...obs("A", "B13a-long-dash", ["pass", "pass", "pass", "pass"]), ...obs("C", "B13a-long-dash", ["pass", "pass", "pass", "pass"])];
  const detail = (exclude) => score(base(flat, { control: { reference: "A", control: "C", exclude } })).gates.find((g) => g.id === "V1-control").detail;
  assert.equal(detail([]), "reference minus control = 0.50 over 3 behaviors (need >= 0.3)");
  assert.equal(detail(["B13a-long-dash"]), "reference minus control = 0.75 over 2 behaviors (need >= 0.3); not counted: B13a-long-dash");
});

test("each comparison gets its own outcome", () => {
  const withB = [...observations, ...obs("B", "B5-step-list", ["pass", "pass", "pass", "pass"]), ...obs("B", "B7-cite-read", ["pass", "pass", "pass", "fail"])];
  const r = score(base(withB, { comparisons: [{ reference: "A", treatment: "B" }, { reference: "D", treatment: "B" }] }));
  assert.deepEqual(
    r.comparisons.map((c) => [c.reference, c.treatment, c.outcome]),
    [
      ["A", "B", "GAP"],
      ["D", "B", "GAP"],
    ],
  );
  assert.deepEqual(verdicts(r, 0), { "B5-step-list": "ok", "B7-cite-read": "short" });
});

test("a control arm as good as the reference makes every comparison INCONCLUSIVE, not a pass", () => {
  const flat = observations.map((o) => (o.arm === "C" ? { ...o, verdict: "pass" } : o));
  const r = score(base(flat));
  assert.equal(r.comparisons[0].outcome, "INCONCLUSIVE");
  assert.deepEqual(r.failedGates, ["V1-control"]);
});

test("a cross-install read or an uncalibrated consensus judge fails its gate", () => {
  const r = score(base(observations, { seal: [{ run: "t01.A.1", why: "cursor arm touched a Claude install" }], calibration: { J1: calibrated.J1 } }));
  assert.deepEqual(r.failedGates, ["V6-sealed", "calibration-J2"]);
});

test("a judge outside the consensus pair gates nothing, however it calibrated", () => {
  const cal = { ...calibrated, J2: { detect: 1, falseFlag: 0.13, mutants: 6, pairs: 40 }, J3: { detect: 1, falseFlag: 0.02, mutants: 6, pairs: 40 } };
  const r = score(base(observations, { consensusJudges: ["J1", "J3"], calibration: cal }));
  assert.deepEqual(r.failedGates, []);
  assert.deepEqual(
    r.gates.map((g) => g.id),
    ["V1-control", "V6-sealed", "calibration-J1", "calibration-J3", "V4-valid"],
  );
});

test("a judge that misses seeded violations fails calibration", () => {
  const r = score(base(observations, { calibration: { ...calibrated, J2: { detect: 0.5, falseFlag: 0, mutants: 6, pairs: 40 } } }));
  assert.deepEqual(r.failedGates, ["calibration-J2"]);
});

test("a treatment within the margin everywhere is PARITY", () => {
  const same = [...observations.filter((o) => o.arm !== "D"), ...observations.filter((o) => o.arm === "A").map((o) => ({ ...o, arm: "D" }))];
  assert.equal(score(base(same)).comparisons[0].outcome, "PARITY");
});

test("the Wilson interval matches the closed form", () => {
  const [lo, hi] = wilson(3, 4);
  assert.equal(lo.toFixed(3), "0.301");
  assert.equal(hi.toFixed(3), "0.954");
  assert.equal(wilson(0, 0), null);
});
