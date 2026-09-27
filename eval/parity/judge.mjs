import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BEHAVIORS, byId } from "./behaviors.mjs";

/**
 * @typedef {import("./packet.mjs").Packet} Packet
 * @typedef {import("./behaviors.mjs").Task} Task
 * @typedef {"J1" | "J2" | "J3"} JudgeId
 * @typedef {{ behavior: string, unit: string }} UnitRef
 * @typedef {{ behavior: string, unit: string, verdict: "pass" | "fail" | "n/a", evidence: { event: string, quote: string }[], why: string }} Verdict
 * @typedef {{ verdicts: Verdict[], dropped: { item: unknown, reason: string }[] }} Parsed
 */

/** @type {Record<JudgeId, { harness: "claude" | "cursor", model: string }>} */
export const JUDGES = {
  J1: { harness: "claude", model: "opus" },
  J2: { harness: "cursor", model: "gpt-5.6-sol-high" },
  J3: { harness: "claude", model: "opus" },
};

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * @param {Task} task @param {Packet} packet @returns {UnitRef[]}
 */
export function requestUnits(task, packet) {
  const out = [];
  for (const b of BEHAVIORS.filter((b) => b.kind === "judged")) {
    if (b.unit === "turn") for (const turn of task.turns) if (b.applies(task, turn)) out.push({ behavior: b.id, unit: `t${turn.index}` });
    if (b.unit === "delegate" && b.applies(task, task.turns[0])) for (const d of packet.delegates) out.push({ behavior: b.id, unit: d.id });
  }
  return out;
}

/** @param {Task} task @param {Packet} packet @param {UnitRef[]} units @returns {string} */
export function judgePrompt(task, packet, units) {
  const standard = readFileSync(join(HERE, "judge.md"), "utf8");
  const requests = task.turns.map(
    (t) =>
      `- t${t.index}: the user asked ${JSON.stringify(t.prompt)}. ${
        t.expect.playbook ? `Expected playbook: ${t.expect.playbook}. Skills its steps name: ${t.expect.triggers.join(", ") || "none"}.` : "No playbook applies to this turn."
      }`,
  );
  const behaviors = [...new Set(units.map((u) => u.behavior))].map((id) => `- ${id}: ${byId[id].rubric}`);
  const delegates = packet.delegates.map((d) => `- ${d.id}: ${d.role}, spawned in t${d.turn} at ${d.spawnedAt}`);
  return [
    standard,
    "## Request lines",
    ...requests,
    "",
    "## Delegates in this session",
    ...(delegates.length ? delegates : ["- none"]),
    "",
    "## Behaviors",
    ...behaviors,
    "",
    "## Grade exactly these pairs",
    ...units.map((u) => `- ${u.behavior} ${u.unit}`),
    "",
  ].join("\n");
}

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[*`_]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function arrayIn(raw) {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

const inUnit = (event, unit, packet) => {
  if (unit.startsWith("t")) return event.turn === Number(unit.slice(1));
  const d = packet.delegates.find((x) => x.id === unit);
  return event.actor === unit || event.id === d?.spawnedAt;
};

/**
 * @param {string} raw @param {Packet} packet @param {UnitRef[]} units @returns {Parsed}
 */
export function parseVerdicts(raw, packet, units) {
  const items = arrayIn(raw);
  if (!Array.isArray(items)) return { verdicts: [], dropped: [{ item: raw.slice(0, 200), reason: "no JSON array" }] };
  const wanted = new Set(units.map((u) => `${u.behavior} ${u.unit}`));
  const events = new Map(packet.events.map((e) => [e.id, e]));
  const seen = new Set();
  const verdicts = [];
  const dropped = [];
  for (const item of items) {
    const key = `${item?.behavior} ${item?.unit}`;
    if (!wanted.has(key)) {
      dropped.push({ item, reason: "pair not requested" });
      continue;
    }
    if (seen.has(key)) {
      dropped.push({ item, reason: "duplicate pair" });
      continue;
    }
    if (!["pass", "fail", "n/a"].includes(item.verdict)) {
      dropped.push({ item, reason: "bad verdict" });
      continue;
    }
    const evidence = (Array.isArray(item.evidence) ? item.evidence : []).filter((ev) => {
      const e = events.get(ev?.event);
      const q = norm(ev?.quote);
      return e && q.length >= 3 && norm(e.text).includes(q) && inUnit(e, item.unit, packet);
    });
    if (item.verdict !== "n/a" && evidence.length === 0) {
      dropped.push({ item, reason: "no quote found in a cited event of the unit" });
      continue;
    }
    seen.add(key);
    verdicts.push({ behavior: item.behavior, unit: item.unit, verdict: item.verdict, evidence, why: String(item.why ?? "") });
  }
  return { verdicts, dropped };
}

/**
 * @typedef {{ pair: [JudgeId, JudgeId], tiebreak: JudgeId | null, excluded: Partial<Record<JudgeId, string>> }} JudgeSet
 */

/** @type {JudgeSet} */
export const DEFAULT_JUDGE_SET = { pair: ["J1", "J2"], tiebreak: "J3", excluded: {} };

/**
 * The final verdict per pair of the request: the judge pair's when they agree,
 * the tiebreak judge's when they do not (a unit one of them dropped counts as
 * a disagreement), and unresolved when no tiebreak judge settles it. A unit no
 * deciding judge graded at all is ungraded, which is not a split.
 * @param {UnitRef[]} units
 * @param {Partial<Record<JudgeId, Verdict[]>>} byJudge
 * @param {JudgeSet} [set]
 * @returns {{ final: (UnitRef & { verdict: Verdict["verdict"] | "unresolved" | "ungraded", source: string })[], needsTiebreak: UnitRef[] }}
 */
export function consensus(units, byJudge, set = DEFAULT_JUDGE_SET) {
  const pick = (j, u) => (j ? byJudge[j]?.find((v) => v.behavior === u.behavior && v.unit === u.unit)?.verdict : undefined);
  const [first, second] = set.pair;
  const final = [];
  const needsTiebreak = [];
  for (const u of units) {
    const a = pick(first, u);
    const b = pick(second, u);
    if (a && a === b) {
      final.push({ ...u, verdict: a, source: `${first}+${second}` });
      continue;
    }
    if (set.tiebreak) needsTiebreak.push(u);
    const c = pick(set.tiebreak, u);
    if (c) final.push({ ...u, verdict: c, source: set.tiebreak });
    else final.push({ ...u, verdict: a || b ? "unresolved" : "ungraded", source: "none" });
  }
  return { final, needsTiebreak };
}
