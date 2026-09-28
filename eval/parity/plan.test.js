import assert from "node:assert/strict";
import { test } from "node:test";
import { planRuns, summary } from "./plan.mjs";

const TASKS = ["t01-long-session", "t02-bug", "t03-feature", "t04-refactor", "t05-delegate"];

/** An s4-shaped source: A, C and B at two reps, B at a tree the new plan does not run. */
const s4 = TASKS.flatMap((task, t) =>
  [1, 2].flatMap((rep) => ["A", "C", "B"].map((arm, a) => ({ key: `${task}.${arm}.${rep}`, task, arm, rep, rid: `r${String(t * 6 + (rep - 1) * 3 + a + 1).padStart(2, "0")}`, sandbox: "C:\\pp\\s1" }))),
);

test("an s5 plan keeps A and C from s4 at their reps and plans B, E and N fresh at three", () => {
  const { runs, counts } = planRuns({ sourceRuns: s4, taskIds: TASKS, armIds: ["A", "C", "B", "E", "N"], reps: 3, reusable: (r) => r.arm !== "B", sandbox: "C:\\pp\\s5" });
  assert.deepEqual(counts, {
    A: { copied: 10, new: 0 },
    C: { copied: 10, new: 0 },
    B: { copied: 0, new: 15 },
    E: { copied: 0, new: 15 },
    N: { copied: 0, new: 15 },
  });
  assert.equal(summary(counts), "A 10 copied, C 10 copied, B 15 new, E 15 new, N 15 new");
  assert.equal(runs.length, 65);
  assert.equal(new Set(runs.map((r) => r.rid)).size, 65);
  assert.equal(new Set(runs.map((r) => r.key)).size, 65);
  assert.deepEqual(runs.find((r) => r.key === "t01-long-session.A.2"), { key: "t01-long-session.A.2", task: "t01-long-session", arm: "A", rep: 2, rid: "r04", sandbox: "C:\\pp\\s1" });
  assert.deepEqual(runs.find((r) => r.key === "t01-long-session.B.1"), { key: "t01-long-session.B.1", task: "t01-long-session", arm: "B", rep: 1, rid: "r03", sandbox: "C:\\pp\\s5" });
  assert.equal(runs.some((r) => r.arm === "A" && r.rep === 3), false);
});

test("an arm with some source runs not reusable replans only those, up to the reps its source ran", () => {
  const { runs, counts } = planRuns({ sourceRuns: s4, taskIds: TASKS.slice(0, 2), armIds: ["A"], reps: 3, reusable: (r) => r.key !== "t02-bug.A.2", sandbox: "C:\\pp\\s5" });
  assert.deepEqual(counts, { A: { copied: 3, new: 1 } });
  assert.equal(summary(counts), "A 3 copied + 1 new");
  assert.deepEqual(runs.find((r) => r.key === "t02-bug.A.2").sandbox, "C:\\pp\\s5");
});
