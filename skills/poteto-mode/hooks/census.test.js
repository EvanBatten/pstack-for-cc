import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { RULES } from "./asks.mjs";
import { DELEGATE_ACTORS, loadCatalog, PROSE_ROUTED, routedFile, sentencesOf } from "./catalog.mjs";
import { STOP_RULES } from "./gate.mjs";

const MODE = path.join(import.meta.dirname, "..");
const census = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "census.json"), "utf8"));
const catalog = loadCatalog(path.join(MODE, ".."));

const flat = (text) => text.replace(/\s+/g, " ");
const shipped = [path.join(MODE, "SKILL.md"), ...fs.readdirSync(path.join(MODE, "playbooks")).map((f) => path.join(MODE, "playbooks", f))]
  .map((f) => flat(fs.readFileSync(f, "utf8")))
  .join("\n");
const resolves = (line) => typeof line === "string" && line.length > 0 && shipped.includes(flat(line));

const triggerBullets = () => {
  const lines = fs.readFileSync(path.join(MODE, "SKILL.md"), "utf8").split(/\r?\n/);
  const start = lines.indexOf("Remaining triggers:");
  const end = lines.findIndex((l, i) => i > start && l.startsWith("#"));
  return lines.slice(start + 1, end).filter((l) => l.startsWith("- "));
};

const stepKeys = () =>
  Object.entries(catalog.playbooks).flatMap(([name, { steps }]) =>
    steps.flatMap((s) => [...Object.keys(s.skills), ...s.generic.map((g) => g.name)].map((skill) => `${name}#${s.n}:${skill}`)),
  );

const faults = (where, m) => {
  const kinds = ["ask", "stop", "watcher"].filter((k) => k in m);
  if (kinds.length !== 1) return [`${where}: names ${kinds.length} of ask, stop and watcher`];
  if (m.ask !== undefined) return RULES.some((r) => r.key === m.ask) ? [] : [`${where}: no ask rule ${m.ask}`];
  if (m.stop !== undefined)
    return [...(STOP_RULES.some((r) => r.key === m.stop) ? [] : [`${where}: no Stop rule ${m.stop}`]), ...(resolves(m.cites) ? [] : [`${where}: cites text no shipped doc holds`])];
  return /^[A-Z].{20,}\.$/s.test(m.watcher) ? [] : [`${where}: the watcher reason is not a sentence`];
};

test("each trigger bullet is matched by exactly one census anchor, and each anchor by exactly one bullet", () => {
  const bullets = triggerBullets();
  const anchors = Object.keys(census.triggers);
  assert.deepEqual(
    [
      ...bullets.flatMap((b) => {
        const n = anchors.filter((a) => b.includes(a)).length;
        return n === 1 ? [] : [`${n} anchors match: ${b.slice(0, 60)}`];
      }),
      ...anchors.flatMap((a) => {
        const n = bullets.filter((b) => b.includes(a)).length;
        return n === 1 ? [] : [`anchor matches ${n} bullets: ${a}`];
      }),
    ],
    [],
  );
});

test("each step skill the live catalog parses has a census entry, and each entry names a live step skill", () => {
  const live = stepKeys();
  const entries = Object.keys(census.steps);
  assert.deepEqual(
    [...live.filter((k) => !entries.includes(k)).map((k) => `unmapped: ${k}`), ...entries.filter((k) => !live.includes(k)).map((k) => `stale: ${k}`)],
    [],
  );
});

test("each census mapping names a live ask rule, a Stop rule with text a shipped doc holds, or a watcher reason", () => {
  assert.deepEqual(
    [...Object.entries(census.triggers).flatMap(([a, m]) => faults(`trigger ${a}`, m)), ...Object.entries(census.steps).flatMap(([k, m]) => faults(`step ${k}`, m))],
    [],
  );
});

test("the catalog reads each step skill as enforced or conditional from its step text", () => {
  const flags = Object.entries(catalog.playbooks).flatMap(([name, { steps }]) =>
    steps.flatMap((s) => [
      ...Object.entries(s.skills).map(([skill, conditional]) => `${name}#${s.n}:${skill} ${conditional ? "conditional" : "enforced"}`),
      ...s.generic.map((g) => `${name}#${s.n}:${g.name} one of ${g.oneOf.join(", ")} ${g.conditional ? "conditional" : "enforced"}`),
    ]),
  );
  assert.deepEqual(flags, [
    "autonomous-run#5:show-me-your-work enforced",
    "autopilot-full#2:deslop conditional",
    "autopilot-full#2:no-comments conditional",
    "autopilot-full#2:show-me-your-work enforced",
    "autopilot-full#4:swarm enforced",
    "autopilot-full#4:control one of control-cli, control-ui conditional",
    "autopilot-stack#1:deslop conditional",
    "autopilot-stack#1:no-comments conditional",
    "autopilot-stack#1:show-me-your-work enforced",
    "autopilot-stack#4:swarm enforced",
    "bug-fix#1:control one of control-cli, control-ui enforced",
    "bug-fix#2:how enforced",
    "bug-fix#2:why enforced",
    "bug-fix#3:architect conditional",
    "bug-fix#5:tdd conditional",
    "eval#4:arena enforced",
    "eval#5:arena enforced",
    "feature#1:how enforced",
    "feature#2:architect enforced",
    "feature#4:arena conditional",
    "feature#7:interrogate conditional",
    "hillclimb#1:how enforced",
    "hillclimb#3:show-me-your-work enforced",
    "investigation#1:how enforced",
    "investigation#1:why conditional",
    "investigation#4:unslop enforced",
    "multi-phase-plan#5:technical-writing enforced",
    "multi-phase-plan#5:unslop enforced",
    "perf-issue#1:control one of control-cli, control-ui enforced",
    "perf-issue#2:how enforced",
    "perf-issue#3:architect conditional",
    "prototype#5:control one of control-cli, control-ui conditional",
    "prototype#6:architect conditional",
    "refactoring#1:how enforced",
    "refactoring#3:architect conditional",
    "refactoring#6:control one of control-cli, control-ui conditional",
    "runtime-forensics#1:control one of control-cli, control-ui enforced",
    "shipping#1:control one of control-cli, control-ui conditional",
    "visual-parity#4:control one of control-cli, control-ui enforced",
  ]);
});

test("every DELEGATE_ACTORS phrasing matches a sentence of a playbook or a prose-routed doc the catalog reads", () => {
  const docs = [...fs.readdirSync(path.join(MODE, "playbooks")).filter((f) => f.endsWith(".md")).map((f) => path.join(MODE, "playbooks", f)), ...PROSE_ROUTED.map((d) => routedFile(catalog.dir, d))];
  const sentences = docs.flatMap((f) => sentencesOf(fs.readFileSync(f, "utf8")));
  assert.deepEqual(
    DELEGATE_ACTORS.filter((d) => !sentences.some((s) => d.re.test(s))).map((d) => d.re.source),
    [],
  );
});

test("every ask rule cites a line that poteto-mode's SKILL.md or one of its playbooks ships", () => {
  assert.deepEqual(
    RULES.filter((r) => !resolves(r.cites)).map((r) => r.key),
    [],
  );
});
