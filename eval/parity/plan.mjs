/**
 * @typedef {{ key: string, task: string, arm: string, rep: number, rid: string, sandbox: string }} Run
 * @typedef {Record<string, { copied: number, new: number }>} Counts
 */

const ridOf = (n) => `r${String(n).padStart(2, "0")}`;

/**
 * Which runs a stamp holds. A source run of a planned task and arm is kept when `reusable` says so, with its rid and
 * sandbox. An arm that keeps any source run keeps the reps its source ran, so it is planned fresh only where a source
 * run was not reusable; an arm that keeps none is planned fresh at `reps`.
 * @param {{ sourceRuns: Run[], taskIds: string[], armIds: string[], reps: number, reusable: (run: Run) => boolean, sandbox: string }} input
 * @returns {{ runs: Run[], counts: Counts }}
 */
export function planRuns({ sourceRuns, taskIds, armIds, reps, reusable, sandbox }) {
  const candidates = sourceRuns.filter((r) => taskIds.includes(r.task) && armIds.includes(r.arm));
  const copied = candidates.filter(reusable);
  const repsOf = (arm) => (copied.some((r) => r.arm === arm) ? Math.max(...candidates.filter((r) => r.arm === arm).map((r) => r.rep)) : reps);
  const runs = [...copied];
  const rids = new Set(runs.map((r) => r.rid));
  let next = 1;
  const rid = () => {
    while (rids.has(ridOf(next))) next++;
    rids.add(ridOf(next));
    return ridOf(next);
  };
  for (const task of taskIds)
    for (let rep = 1; rep <= Math.max(...armIds.map(repsOf)); rep++)
      for (const arm of armIds) {
        const key = `${task}.${arm}.${rep}`;
        if (rep <= repsOf(arm) && !runs.some((r) => r.key === key)) runs.push({ key, task, arm, rep, rid: rid(), sandbox });
      }
  const counts = Object.fromEntries(armIds.map((arm) => [arm, { copied: copied.filter((r) => r.arm === arm).length, new: runs.filter((r) => r.arm === arm).length - copied.filter((r) => r.arm === arm).length }]));
  return { runs, counts };
}

/** @param {Counts} counts */
export const summary = (counts) =>
  Object.entries(counts)
    .map(([arm, c]) => `${arm} ${[c.copied && `${c.copied} copied`, c.new && `${c.new} new`].filter(Boolean).join(" + ") || "none"}`)
    .join(", ");
