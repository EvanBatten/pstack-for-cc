/**
 * @typedef {"pass" | "fail" | "n/a" | "unresolved" | "ungraded"} Verdict
 * @typedef {{ arm: string, run: string, behavior: string, unit: string, verdict: Verdict, source: string, graders?: string[] }} Observation
 * @typedef {{ behavior: string, arm: string, pass: number, applicable: number, unresolved: number, fraction: number | null, wilson95: [number, number] | null }} Cell
 * @typedef {{ detect: number, falseFlag: number, mutants: number, pairs: number }} JudgeCalibration
 * @typedef {{ reference: string, treatment: string }} Pairing
 * @typedef {{
 *   observations: Observation[],
 *   control: { reference: string, control: string, exclude: string[] },
 *   comparisons: Pairing[],
 *   seal: { run: string, why: string }[],
 *   consensusJudges: string[],
 *   calibration: Record<string, JudgeCalibration> | null,
 *   runs: { total: number, inconclusive: number },
 *   judged: { kept: number, dropped: number },
 * }} ScoreInput
 * @typedef {{ id: string, pass: boolean, detail: string }} Gate
 * @typedef {{ behavior: string, reference: Cell, treatment: Cell, verdict: "ok" | "short" | "inconclusive" }} BehaviorComparison
 * @typedef {Pairing & { outcome: "PARITY" | "GAP" | "INCONCLUSIVE", behaviors: BehaviorComparison[] }} Comparison
 * @typedef {{ gates: Gate[], failedGates: string[], cells: Cell[], comparisons: Comparison[] }} Result
 */

export const DELTA = 0.1;
export const MIN_UNITS = 4;
export const CONTROL_MARGIN = 0.3;
export const DETECT_MIN = 0.9;
export const FALSE_FLAG_MAX = 0.1;
export const MAX_INCONCLUSIVE_RUNS = 0.1;
export const MAX_DROPPED_VERDICTS = 0.05;

/** @returns {[number, number] | null} */
export function wilson(pass, n) {
  if (n === 0) return null;
  const z = 1.96;
  const p = pass / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

/** @param {Observation[]} obs @param {string} behavior @param {string} arm @returns {Cell} */
export function cell(obs, behavior, arm) {
  const mine = obs.filter((o) => o.behavior === behavior && o.arm === arm);
  const graded = mine.filter((o) => o.verdict === "pass" || o.verdict === "fail");
  const pass = graded.filter((o) => o.verdict === "pass").length;
  const applicable = graded.length;
  const unresolved = mine.filter((o) => o.verdict === "unresolved").length;
  return { behavior, arm, pass, applicable, unresolved, fraction: applicable ? pass / applicable : null, wilson95: wilson(pass, applicable) };
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * @param {Cell} reference @param {Cell} treatment @returns {BehaviorComparison["verdict"]}
 */
export function compareCells(reference, treatment) {
  if (reference.applicable < MIN_UNITS || treatment.applicable < MIN_UNITS) return "inconclusive";
  return treatment.fraction < reference.fraction - DELTA ? "short" : "ok";
}

/** @param {ScoreInput} input @returns {Result} */
export function score(input) {
  const { observations: obs } = input;
  const behaviors = [...new Set(obs.map((o) => o.behavior))].sort();
  const named = [input.control.reference, input.control.control, ...input.comparisons.flatMap((c) => [c.reference, c.treatment])];
  const armIds = [...new Set([...obs.map((o) => o.arm), ...named])].sort();
  const cells = behaviors.flatMap((b) => armIds.map((a) => cell(obs, b, a)));
  const at = (b, a) => cells.find((c) => c.behavior === b && c.arm === a);

  const { reference: ref, control: ctl, exclude } = input.control;
  const shared = behaviors.filter((b) => !exclude.includes(b) && at(b, ref).applicable && at(b, ctl).applicable);
  const notCounted = exclude.length ? `; not counted: ${exclude.join(", ")}` : "";
  const lift = shared.length ? mean(shared.map((b) => at(b, ref).fraction)) - mean(shared.map((b) => at(b, ctl).fraction)) : null;

  /** @type {Gate[]} */
  const gates = [
    {
      id: "V1-control",
      pass: lift !== null && lift >= CONTROL_MARGIN,
      detail: lift === null ? "no behavior observed in both reference and control" : `reference minus control = ${lift.toFixed(2)} over ${shared.length} behaviors (need >= ${CONTROL_MARGIN})${notCounted}`,
    },
    {
      id: "V6-sealed",
      pass: input.seal.length === 0,
      detail: input.seal.length ? `${input.seal.length} cross-install reads: ${input.seal.map((s) => `${s.run} ${s.why}`).join("; ")}` : "no run read outside its own install",
    },
    ...input.consensusJudges.map((j) => {
      const c = input.calibration?.[j];
      return {
        id: `calibration-${j}`,
        pass: Boolean(c && c.mutants > 0 && c.detect >= DETECT_MIN && c.falseFlag <= FALSE_FLAG_MAX),
        detail: c ? `detect ${c.detect.toFixed(2)} over ${c.mutants} mutants (need >= ${DETECT_MIN}), false flags ${c.falseFlag.toFixed(2)} over ${c.pairs} untouched pairs (need <= ${FALSE_FLAG_MAX})` : "not calibrated",
      };
    }),
    {
      id: "V4-valid",
      pass:
        input.runs.total > 0 &&
        input.runs.inconclusive / input.runs.total <= MAX_INCONCLUSIVE_RUNS &&
        input.judged.dropped / Math.max(1, input.judged.kept + input.judged.dropped) <= MAX_DROPPED_VERDICTS,
      detail: `${input.runs.inconclusive}/${input.runs.total} runs inconclusive (max ${MAX_INCONCLUSIVE_RUNS * 100}%), ${input.judged.dropped}/${input.judged.kept + input.judged.dropped} judge verdicts dropped (max ${MAX_DROPPED_VERDICTS * 100}%)`,
    },
  ];
  const failedGates = gates.filter((g) => !g.pass).map((g) => g.id);

  /** @type {Comparison[]} */
  const comparisons = input.comparisons.map(({ reference, treatment }) => {
    const rows = behaviors.map((b) => {
      const r = at(b, reference);
      const t = at(b, treatment);
      return { behavior: b, reference: r, treatment: t, verdict: compareCells(r, t) };
    });
    const outcome = failedGates.length || rows.every((r) => r.verdict === "inconclusive") ? "INCONCLUSIVE" : rows.some((r) => r.verdict === "short") ? "GAP" : "PARITY";
    return { reference, treatment, outcome, behaviors: rows };
  });

  return { gates, failedGates, cells, comparisons };
}
