import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const REPORT = path.join(ROOT, "eval", "parity", "results", "s5", "report.json");

function renderToTemp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chart-"));
  const out = path.join(dir, "nested", "head-to-head.svg");
  execFileSync(process.execPath, [path.join(ROOT, "scripts", "chart.mjs"), REPORT, out], { cwd: ROOT });
  const svg = fs.readFileSync(out, "utf8");
  fs.rmSync(dir, { recursive: true, force: true });
  return svg;
}

const svg = renderToTemp();

function rowText(label) {
  const start = svg.indexOf(`>${label}</text>`);
  assert.notEqual(start, -1, `row "${label}" is drawn`);
  const next = svg.indexOf('font-size="14"', start + 1);
  return svg.slice(start, next === -1 ? undefined : next);
}

const values = (row) => [...row.matchAll(/class="value"[^>]*>([^<]+)</g)].map((m) => m[1]);

test("the chart carries its title and subtitle", () => {
  assert.ok(svg.includes(">Same model, same sealed tasks</text>"));
  assert.ok(svg.includes(">Passing units over graded units, parity round s5</text>"));
  assert.ok(svg.includes(">This port (Claude Code)</text>"));
  assert.ok(svg.includes(">pstack-claude (Claude Code)</text>"));
  assert.ok(svg.includes(">pstack on Cursor</text>"));
});

test("each behavior shows this port, then pstack-claude, then Cursor as k/n", () => {
  assert.deepEqual(values(rowText("stays in mode")), ["10/10", "0/13", "2/10"]);
  assert.deepEqual(values(rowText("reads what it cites")), ["21/22", "9/28", "5/20"]);
  assert.deepEqual(values(rowText("picks the right playbook")), ["21/21", "15/25", "11/18"]);
  assert.deepEqual(values(rowText("runs named skills")), ["16/20", "4/26", "4/17"]);
  assert.deepEqual(values(rowText("carries the step list")), ["12/21", "3/27", "3/17"]);
  assert.deepEqual(values(rowText("delegates follow the mode")), ["4/10", "7/12", "0/7"]);
  assert.deepEqual(values(rowText("delegated")), ["6/12", "8/15", "6/10"]);
  assert.deepEqual(values(rowText("claim labels")), ["5/21", "3/21", "5/19"]);
});

test("a missing cell fails loudly instead of drawing zero", () => {
  const report = JSON.parse(fs.readFileSync(REPORT, "utf8"));
  report.result.cells = report.result.cells.filter((c) => !(c.behavior === "B9-delegated" && c.arm === "A"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chart-"));
  const broken = path.join(dir, "report.json");
  fs.writeFileSync(broken, JSON.stringify(report));
  assert.throws(
    () => execFileSync(process.execPath, [path.join(ROOT, "scripts", "chart.mjs"), broken, path.join(dir, "out.svg")], { stdio: "pipe" }),
    (err) => err.stderr.toString().includes("B9-delegated"),
  );
  assert.equal(fs.existsSync(path.join(dir, "out.svg")), false);
  fs.rmSync(dir, { recursive: true, force: true });
});
