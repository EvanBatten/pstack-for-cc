/**
 * @typedef {"pass" | "fail" | "n/a" | "unresolved" | "ungraded"} Verdict
 * @typedef {{ arm: string, run: string, behavior: string, unit: string, verdict: Verdict, source: string, graders?: string[] }} Observation
 * @typedef {{ behavior: string, arm: string, pass: number, applicable: number, unresolved: number, fraction: number | null, wilson95: [number, number] | null }} Cell
 * @typedef {{ detect: number, falseFlag: number, mutants: number, pairs: number }} JudgeCalibration
 * @typedef {{ reference: string, treatment: string, gate: string }} Pairing
 * @typedef {{ id: string, treatments: string[], control: string }} Control
 * @typedef {{ min: number, resolution: string }} Band
 * @typedef {{ id: string, statement: string, treatment: string, reference: string, gate: string, bands: Band[] }} Claim
 * @typedef {{ id: string, statement: string, treatment: string, reference: string, diff: number | null, behaviors: number, gate: string, resolution: string, certified: boolean }} ClaimResult
 * @typedef {{
 *   observations: Observation[],
 *   controls: Control[],
 *   controlExclude: string[],
 *   comparisons: Pairing[],
 *   claims: Claim[],
 *   seal: { run: string, why: string }[],
 *   consensusJudges: string[],
 *   calibration: Record<string, JudgeCalibration> | null,
 *   runs: { total: number, inconclusive: number },
 *   judged: { kept: number, dropped: number },
 * }} ScoreInput
 * @typedef {{ id: string, pass: boolean, detail: string }} Gate
 * @typedef {{ behavior: string, reference: Cell, treatment: Cell, verdict: "ok" | "short" | "inconclusive" }} BehaviorComparison
 * @typedef {Pairing & { outcome: "PARITY" | "GAP" | "INCONCLUSIVE", behaviors: BehaviorComparison[] }} Comparison
 * @typedef {{ gates: Gate[], failedGates: string[], cells: Cell[], comparisons: Comparison[], claims: ClaimResult[] }} Result
 */

export const DELTA = 0.1;
export const MIN_UNITS = 4;
export const CONTROL_MARGIN = 0.3;
export const DETECT_MIN = 0.9;
export const FALSE_FLAG_MAX = 0.1;
export const MAX_INCONCLUSIVE_RUNS = 0.1;
export const MAX_DROPPED_VERDICTS = 0.05;

/**
 * The pre-registered claims. Each resolves to the first band whose `min` its treatment-minus-reference mean reaches.
 * @type {Claim[]}
 */
export const CLAIMS = [
  {
    id: "claim-1",
    statement: "better than the leading Claude Code port",
    treatment: "B",
    reference: "E",
    gate: "V1-claude",
    bands: [
      { min: 0.1, resolution: "better than the leading Claude Code port" },
      { min: -0.1, resolution: "a tie with the leading Claude Code port" },
      { min: -Infinity, resolution: "a loss to the leading Claude Code port" },
    ],
  },
  {
    id: "claim-2",
    statement: "on par with or better than pstack on Cursor",
    treatment: "B",
    reference: "A",
    gate: "V1-cursor",
    bands: [
      { min: -0.05, resolution: "on par with or better than pstack on Cursor" },
      { min: -Infinity, resolution: "not on par with pstack on Cursor" },
    ],
  },
];

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

// Rounded so a difference of fractions such as 0.6 minus 0.5 lands on its band's boundary, not beside it.
const settle = (x) => Math.round(x * 1e9) / 1e9;

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
  const named = [
    ...input.controls.flatMap((c) => [...c.treatments, c.control]),
    ...input.comparisons.flatMap((c) => [c.reference, c.treatment]),
    ...input.claims.flatMap((c) => [c.reference, c.treatment]),
  ];
  const armIds = [...new Set([...obs.map((o) => o.arm), ...named])].sort();
  const cells = behaviors.flatMap((b) => armIds.map((a) => cell(obs, b, a)));
  const at = (b, a) => cells.find((c) => c.behavior === b && c.arm === a);
  /** Mean of `treatment` minus mean of `reference` over the behaviors both graded, less `exclude`. */
  const gap = (treatment, reference, exclude = []) => {
    const shared = behaviors.filter((b) => !exclude.includes(b) && at(b, treatment).applicable && at(b, reference).applicable);
    return { shared: shared.length, diff: shared.length ? mean(shared.map((b) => at(b, treatment).fraction)) - mean(shared.map((b) => at(b, reference).fraction)) : null };
  };

  const notCounted = input.controlExclude.length ? `; not counted: ${input.controlExclude.join(", ")}` : "";
  /** @type {Gate[]} */
  const controlGates = input.controls.map(({ id, treatments, control }) => {
    const lifts = treatments.map((t) => ({ t, ...gap(t, control, input.controlExclude) }));
    const scored = lifts.filter((l) => l.diff !== null);
    if (!scored.length) return { id, pass: false, detail: `no behavior observed in both ${treatments.join(" or ")} and ${control}` };
    const best = Math.max(...scored.map((l) => l.diff));
    const over = (l) => (l.diff === null ? "not observed" : `${l.diff.toFixed(2)} over ${l.shared} behaviors`);
    const lift =
      treatments.length === 1
        ? `${treatments[0]} minus ${control} = ${over(lifts[0])}`
        : `max(${treatments.join(", ")}) minus ${control} = ${best.toFixed(2)} (${lifts.map((l) => `${l.t} ${over(l)}`).join(", ")})`;
    return { id, pass: best >= CONTROL_MARGIN, detail: `${lift} (need >= ${CONTROL_MARGIN})${notCounted}` };
  });

  /** @type {Gate[]} */
  const common = [
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
  const gates = [...controlGates, ...common];
  const failedGates = gates.filter((g) => !g.pass).map((g) => g.id);
  /** Why a result that rests on `gate` is not backed: that gate failed or was not scored, or a common gate failed. */
  const blockers = (gate) => {
    const own = controlGates.find((g) => g.id === gate);
    return [...(!own ? [`${gate} not scored`] : own.pass ? [] : [`${gate} failed`]), ...common.filter((g) => !g.pass).map((g) => `${g.id} failed`)];
  };

  /** @type {Comparison[]} */
  const comparisons = input.comparisons.map(({ reference, treatment, gate }) => {
    const rows = behaviors.map((b) => {
      const r = at(b, reference);
      const t = at(b, treatment);
      return { behavior: b, reference: r, treatment: t, verdict: compareCells(r, t) };
    });
    const outcome = blockers(gate).length || rows.every((r) => r.verdict === "inconclusive") ? "INCONCLUSIVE" : rows.some((r) => r.verdict === "short") ? "GAP" : "PARITY";
    return { reference, treatment, gate, outcome, behaviors: rows };
  });

  /** @type {ClaimResult[]} */
  const claims = input.claims.map(({ id, statement, treatment, reference, gate, bands }) => {
    const { shared, diff: raw } = gap(treatment, reference);
    const diff = raw === null ? null : settle(raw);
    const why = [...blockers(gate), ...(diff === null ? ["no behavior graded on both arms"] : [])];
    const resolution = why.length ? `not certified: ${why.join(", ")}` : bands.find((b) => b.min <= diff).resolution;
    return { id, statement, treatment, reference, diff, behaviors: shared, gate, resolution, certified: why.length === 0 };
  });

  return { gates, failedGates, cells, comparisons, claims };
}
