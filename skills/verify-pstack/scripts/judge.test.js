import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const JUDGE = path.join(import.meta.dirname, "judge.mjs");
const FIXTURES = path.join(import.meta.dirname, "fixtures");
const run = (fixture) => execFileSync("node", [JUDGE, path.join(FIXTURES, fixture)], { encoding: "utf8" });

const runTimedOut = (fixture, timeouts) => {
  const ev = fs.mkdtempSync(path.join(os.tmpdir(), "judge-"));
  fs.cpSync(path.join(FIXTURES, fixture), ev, { recursive: true });
  for (const [role, seconds] of Object.entries(timeouts)) fs.writeFileSync(path.join(ev, `${role}.timeout`), `${seconds}\n`);
  const out = execFileSync("node", [JUDGE, ev], { encoding: "utf8" });
  fs.rmSync(ev, { recursive: true, force: true });
  return out;
};
const gateLine = (output) => output.split("\n").find((l) => / gate /.test(l));
const actionGateLine = (output) => output.split("\n").find((l) => / action-gate /.test(l));

test("the action gate is verified by a design deny, then a shape line, then a source write, and each missing link says which", () => {
  assert.deepEqual(
    ["action-gate-verified", "action-gate-no-shape", "action-gate-no-deny", "action-gate-no-write"].map((f) => actionGateLine(run(f))),
    [
      "VERIFIED      action-gate    design deny at mode.jsonl:3, shape line at mode.jsonl:4, source write at mode.jsonl:5",
      "NOT VERIFIED  action-gate    design deny at mode.jsonl:3 with no shape line after it",
      "NOT VERIFIED  action-gate    source write at mode.jsonl:4 with no design deny before it",
      "INCONCLUSIVE  action-gate    the mode session never wrote a source file, so nothing was put to the design ask",
    ],
  );
});

test("a shell write of a source file after the shape line verifies the action gate, as the hook counts it", () => {
  assert.equal(actionGateLine(run("action-gate-shell-write")), "VERIFIED      action-gate    design deny at mode.jsonl:3, shape line at mode.jsonl:4, source write at mode.jsonl:5");
});

test("the action gate reads the shape line the way the hook does, so the words data shape in prose do not verify it", () => {
  assert.equal(actionGateLine(run("action-gate-shape-words")), "NOT VERIFIED  action-gate    design deny at mode.jsonl:3 with no shape line after it");
});

test("a Stop block recorded three ways counts once, and a later reply that fixes its only finding verifies the turn", () => {
  const line = gateLine(run("gate-verified"));
  assert.match(line, /^VERIFIED\s+gate\s+6 ledger steps carried across 2 replies; Stop block at mode\.jsonl:5, each fixed by a later reply$/);
});

test("a routing finding is fixed by a later reply that names the route, and stays unresolved without one", () => {
  assert.match(gateLine(run("gate-routing-fixed")), /^VERIFIED\s+gate\s+6 ledger steps carried across 2 replies; Stop block at mode\.jsonl:5, each fixed by a later reply$/);
  assert.match(gateLine(run("gate-routing-unresolved")), /^NOT VERIFIED\s+gate\s+Stop block at mode\.jsonl:5 unresolved$/);
});

test("unslop and design findings are fixed by skip lines naming the skills and a data shape line, and stay unresolved without the shape", () => {
  assert.match(gateLine(run("gate-design-fixed")), /^VERIFIED\s+gate\s+6 ledger steps carried across 2 replies; Stop block at mode\.jsonl:5, each fixed by a later reply$/);
  assert.match(gateLine(run("gate-design-unresolved")), /^NOT VERIFIED\s+gate\s+Stop block at mode\.jsonl:5 unresolved$/);
});

test("a tagged Stop block counts as fixed when the gate's own rules, run again at the turn's last stop, no longer find a tag it named", () => {
  assert.deepEqual(
    [gateLine(run("gate-tag-cleared")), gateLine(run("gate-tag-uncleared"))],
    [
      "VERIFIED      gate           6 ledger steps carried across 2 replies; Stop block at mode.jsonl:10, each fixed by a later reply",
      "NOT VERIFIED  gate           Stop block at mode.jsonl:10 unresolved",
    ],
  );
});

test("an untagged Stop block from before the tags counts as fixed by a skip in a TaskUpdate description, as the task-list skips at mode.jsonl:113 and :120 did", () => {
  const ev = fs.mkdtempSync(path.join(os.tmpdir(), "judge-"));
  fs.cpSync(path.join(FIXTURES, "gate-drive-taskupdate-fixed"), ev, { recursive: true });
  const mode = path.join(ev, "mode.jsonl");
  const lines = fs.readFileSync(mode, "utf8").split("\n");
  const skip = "skip: control-cli harness not needed, because total.js is a non-interactive one-shot CLI";
  assert.equal(lines[119].includes(skip), true);
  lines[119] = lines[119].replace(skip, "control-cli harness not needed, because total.js is a non-interactive one-shot CLI");
  fs.writeFileSync(mode, lines.join("\n"));
  const unskipped = gateLine(execFileSync("node", [JUDGE, ev], { encoding: "utf8" }));
  fs.rmSync(ev, { recursive: true, force: true });
  assert.deepEqual(
    [gateLine(run("gate-drive-taskupdate-fixed")), unskipped],
    [
      "VERIFIED      gate           6 ledger steps carried across 7 replies and TaskCreate items; Stop blocks at mode.jsonl:103, mode.jsonl:117, each fixed by a later reply",
      "NOT VERIFIED  gate           Stop block at mode.jsonl:117 unresolved",
    ],
  );
});

test("a Stop block with no corrective reply after it stays unresolved", () => {
  const line = gateLine(run("gate-block-unresolved"));
  assert.match(line, /^NOT VERIFIED\s+gate\s+Stop block at mode\.jsonl:5 unresolved$/);
});

test("a turn whose only surviving reply carries one step out of six is not verified", () => {
  const line = gateLine(run("gate-steps-missing"));
  assert.match(line, /^NOT VERIFIED\s+gate\s+the turn lacks steps 1, 3, 4, 5, 6$/);
});

test("the verify drive's Stop block is fixed by a reply that skips how and why by name and a shell read of unslop, and stays unresolved once the why skip is gone", () => {
  assert.match(gateLine(run("gate-drive-skip-per-skill")), /^VERIFIED\s+gate\s+6 ledger steps carried across 2 replies; Stop block at mode\.jsonl:50, each fixed by a later reply$/);
  assert.match(gateLine(run("gate-drive-skip-why-dropped")), /^NOT VERIFIED\s+gate\s+Stop block at mode\.jsonl:50 unresolved$/);
});

test("a playbook read through a path relative to a cd counts as the hook counts it, so the ledger and the gate are judged", () => {
  const out = run("step-ledger-relative-read").split("\n");
  assert.deepEqual(
    out.filter((l) => / (step-ledger|gate) /.test(l)),
    [
      "VERIFIED      step-ledger    bug-fix read by Bash at mode.jsonl:28, ledger at mode.jsonl:31",
      "VERIFIED      gate           6 ledger steps carried across 6 replies and TaskCreate items; Stop blocks at mode.jsonl:116, mode.jsonl:118, each fixed by a later reply",
    ],
  );
});

test("a feature read from a session that hit the deadline is inconclusive, and a feature read only from clean sessions is judged", () => {
  assert.deepEqual(runTimedOut("action-gate-verified", { control: 540 }).trim().split("\n"), [
    "INCONCLUSIVE  hook-context   control session timed out after 540 s",
    "INCONCLUSIVE  mode-reminder  control session timed out after 540 s",
    "INCONCLUSIVE  step-ledger    the mode session never read a playbook file",
    "INCONCLUSIVE  gate           no playbook read, so no steps to hold the reply to",
    "VERIFIED      action-gate    design deny at mode.jsonl:3, shape line at mode.jsonl:4, source write at mode.jsonl:5",
    "INCONCLUSIVE  reader         reader.jsonl has no Agent call with subagent_type pstack-reader",
    "INCONCLUSIVE  task-tools     mode.stream.jsonl has no init record",
  ]);
  assert.deepEqual(runTimedOut("action-gate-verified", { mode: 540 }).trim().split("\n").filter((l) => / (action-gate|task-tools|reader) /.test(l)), [
    "INCONCLUSIVE  action-gate    mode session timed out after 540 s",
    "INCONCLUSIVE  reader         reader.jsonl has no Agent call with subagent_type pstack-reader",
    "INCONCLUSIVE  task-tools     mode session timed out after 540 s",
  ]);
});
