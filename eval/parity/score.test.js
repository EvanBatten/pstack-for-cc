import assert from "node:assert/strict";
import { test } from "node:test";
import { CLAIMS, score, wilson } from "./score.mjs";

const obs = (arm, behavior, verdicts) => verdicts.map((verdict, i) => ({ arm, run: `${arm}.${i}`, behavior, unit: `t${i}`, verdict, source: "J1+J2" }));
const passes = (arm, behavior, pass, n) => obs(arm, behavior, Array.from({ length: n }, (_, i) => (i < pass ? "pass" : "fail")));

const calibrated = { J1: { detect: 1, falseFlag: 0, mutants: 6, pairs: 40 }, J2: { detect: 0.9, falseFlag: 0.1, mutants: 6, pairs: 40 } };

const CURSOR = { id: "V1-cursor", treatments: ["A"], control: "C" };
const CLAUDE = { id: "V1-claude", treatments: ["B", "E"], control: "N" };

const base = (observations, over = {}) => ({
  observations,
  controls: [CURSOR],
  controlExclude: [],
  comparisons: [{ reference: "A", treatment: "D", gate: "V1-cursor" }],
  claims: [],
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
const gate = (r, id) => r.gates.find((g) => g.id === id);

test("a treatment trailing the reference by more than 0.10 is a GAP on that behavior only", () => {
  const r = score(base(observations));
  assert.equal(r.comparisons[0].outcome, "GAP");
  assert.deepEqual(verdicts(r), { "B5-step-list": "short", "B7-cite-read": "ok" });
  const d = r.cells.find((c) => c.behavior === "B5-step-list" && c.arm === "D");
  assert.deepEqual([d.pass, d.applicable], [1, 4]);
  assert.equal(gate(r, "V1-cursor").detail, "A minus C = 0.75 over 2 behaviors (need >= 0.3)");
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
  const detail = (controlExclude) => gate(score(base(flat, { controlExclude })), "V1-cursor").detail;
  assert.equal(detail([]), "A minus C = 0.50 over 3 behaviors (need >= 0.3)");
  assert.equal(detail(["B13a-long-dash"]), "A minus C = 0.75 over 2 behaviors (need >= 0.3); not counted: B13a-long-dash");
});

test("each comparison gets its own outcome", () => {
  const withB = [...observations, ...obs("B", "B5-step-list", ["pass", "pass", "pass", "pass"]), ...obs("B", "B7-cite-read", ["pass", "pass", "pass", "fail"])];
  const comparisons = [
    { reference: "A", treatment: "B", gate: "V1-cursor" },
    { reference: "D", treatment: "B", gate: "V1-cursor" },
  ];
  const r = score(base(withB, { comparisons }));
  assert.deepEqual(
    r.comparisons.map((c) => [c.reference, c.treatment, c.outcome]),
    [
      ["A", "B", "GAP"],
      ["D", "B", "GAP"],
    ],
  );
  assert.deepEqual(verdicts(r, 0), { "B5-step-list": "ok", "B7-cite-read": "short" });
});

test("a control arm as good as the reference makes its comparisons INCONCLUSIVE, not a pass", () => {
  const flat = observations.map((o) => (o.arm === "C" ? { ...o, verdict: "pass" } : o));
  const r = score(base(flat));
  assert.equal(r.comparisons[0].outcome, "INCONCLUSIVE");
  assert.deepEqual(r.failedGates, ["V1-cursor"]);
});

const claude = [
  ...passes("N", "B5-step-list", 0, 4),
  ...passes("N", "B7-cite-read", 1, 4),
  ...passes("B", "B5-step-list", 2, 4),
  ...passes("B", "B7-cite-read", 1, 4),
  ...passes("E", "B5-step-list", 4, 4),
  ...passes("E", "B7-cite-read", 1, 4),
];

test("V1-claude passes on the larger lift of its two treatments over the control", () => {
  const r = score(base(claude, { controls: [CLAUDE], comparisons: [{ reference: "E", treatment: "B", gate: "V1-claude" }] }));
  assert.deepEqual(gate(r, "V1-claude"), {
    id: "V1-claude",
    pass: true,
    detail: "max(B, E) minus N = 0.50 (B 0.25 over 2 behaviors, E 0.50 over 2 behaviors) (need >= 0.3)",
  });
  const lowE = [...claude.filter((o) => !(o.arm === "E" && o.behavior === "B5-step-list")), ...passes("E", "B5-step-list", 2, 4)];
  assert.equal(gate(score(base(lowE, { controls: [CLAUDE], comparisons: [] })), "V1-claude").pass, false);
});

test("B vs E stays conclusive when V1-cursor fails", () => {
  const flatCursor = observations.map((o) => (o.arm === "C" ? { ...o, verdict: "pass" } : o));
  const comparisons = [
    { reference: "A", treatment: "B", gate: "V1-cursor" },
    { reference: "E", treatment: "B", gate: "V1-claude" },
  ];
  const r = score(base([...flatCursor, ...claude], { controls: [CURSOR, CLAUDE], comparisons }));
  assert.deepEqual(r.failedGates, ["V1-cursor"]);
  assert.deepEqual(
    r.comparisons.map((c) => [c.treatment, c.reference, c.outcome]),
    [
      ["B", "A", "INCONCLUSIVE"],
      ["B", "E", "GAP"],
    ],
  );
});

test("a comparison whose gate was not scored is INCONCLUSIVE", () => {
  const r = score(base(claude, { controls: [], comparisons: [{ reference: "E", treatment: "B", gate: "V1-claude" }] }));
  assert.equal(r.comparisons[0].outcome, "INCONCLUSIVE");
});

/** One behavior graded pass/n on each arm, with both controls far below. */
const claimRun = (b, e, a, over = {}) =>
  score(
    base(
      [
        ...passes("B", "B7-cite-read", ...b),
        ...passes("E", "B7-cite-read", ...e),
        ...passes("A", "B7-cite-read", ...a),
        ...passes("N", "B7-cite-read", 0, 4),
        ...passes("C", "B7-cite-read", 0, 4),
      ],
      { controls: [CURSOR, CLAUDE], comparisons: [], claims: CLAIMS, ...over },
    ),
  ).claims;

const resolutions = (claims) => claims.map((c) => [c.id, c.diff, c.resolution]);

test("claim 1 resolves on B minus E, counting a float-prone +0.10 and -0.10 as their band", () => {
  assert.deepEqual(resolutions(claimRun([3, 5], [1, 2], [1, 1]))[0], ["claim-1", 0.1, "better than the leading Claude Code port"]);
  assert.deepEqual(resolutions(claimRun([7, 10], [4, 5], [1, 1]))[0], ["claim-1", -0.1, "a tie with the leading Claude Code port"]);
  assert.deepEqual(resolutions(claimRun([1, 2], [1, 2], [1, 1]))[0], ["claim-1", 0, "a tie with the leading Claude Code port"]);
  assert.deepEqual(resolutions(claimRun([1, 2], [7, 10], [1, 1]))[0], ["claim-1", -0.2, "a loss to the leading Claude Code port"]);
});

test("claim 2 resolves on B minus A, counting a float-prone -0.05 as on par", () => {
  assert.deepEqual(resolutions(claimRun([7, 20], [1, 1], [2, 5]))[1], ["claim-2", -0.05, "on par with or better than pstack on Cursor"]);
  assert.deepEqual(resolutions(claimRun([1, 10], [1, 1], [2, 5]))[1], ["claim-2", -0.3, "not on par with pstack on Cursor"]);
  assert.deepEqual(claimRun([7, 20], [1, 1], [2, 5])[1], {
    id: "claim-2",
    statement: "on par with or better than pstack on Cursor",
    treatment: "B",
    reference: "A",
    diff: -0.05,
    behaviors: 1,
    gate: "V1-cursor",
    resolution: "on par with or better than pstack on Cursor",
    certified: true,
  });
});

test("a claim is not certified when its gate or a common gate fails", () => {
  const cursorFails = claimRun([3, 5], [1, 2], [1, 1], { controls: [{ ...CURSOR, control: "A" }, CLAUDE] });
  assert.deepEqual(
    cursorFails.map((c) => [c.id, c.resolution, c.certified]),
    [
      ["claim-1", "better than the leading Claude Code port", true],
      ["claim-2", "not certified: V1-cursor failed", false],
    ],
  );
  const unsealed = claimRun([3, 5], [1, 2], [1, 1], { controls: [CLAUDE], seal: [{ run: "t01.E.1", why: "E arm saw the port session context" }] });
  assert.deepEqual(
    unsealed.map((c) => [c.id, c.resolution, c.certified]),
    [
      ["claim-1", "not certified: V6-sealed failed", false],
      ["claim-2", "not certified: V1-cursor not scored, V6-sealed failed", false],
    ],
  );
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
    ["V1-cursor", "V6-sealed", "calibration-J1", "calibration-J3", "V4-valid"],
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
