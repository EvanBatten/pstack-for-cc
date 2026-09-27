import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPT = path.join(import.meta.dirname, "replay-demands.mjs");
const RUN = path.join(import.meta.dirname, "..", "skills", "poteto-mode", "hooks", "fixtures", "run-records.jsonl");

const rowsOf = (stdout) =>
  stdout
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.startsWith("| ") && !l.startsWith("| transcript "))
    .map((r) => r.split(" | ").slice(1, 4));

test("replaying a recorded run prints one row per ask with its tag, in the order the calls met them, and the count line", () => {
  const run = spawnSync(process.execPath, [SCRIPT, RUN], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(rowsOf(run.stdout), [
    ["4", "main", "`[pstack:ledger:4ee90abd]`"],
    ["6", "main", "`[pstack:task-merged:24107430]`"],
    // Line 11 writes src/checkout.js through a heredoc, a code write the Shape ask meets.
    ["11", "main", "`[pstack:design:c08ec9e0]`"],
    // The retry of line 11 meets the ask the deny held back.
    ["11", "main", "`[pstack:design-read:37a0025a]`"],
    ["13", "main", "`[pstack:decision-log:37a0025a]`"],
    ["15", "main", "`[pstack:skill-edit:00389a3b]`"],
    ["17", "main", "`[pstack:deslop:077a459b]`"],
  ]);
  assert.equal(run.stdout.trim().split(/\r?\n/).at(-1), "1 transcripts, 7 in-mode calls, 7 asks");
});

test("--offline is accepted and changes nothing, since the replay reads nothing from disk but the transcripts", () => {
  const plain = spawnSync(process.execPath, [SCRIPT, RUN], { encoding: "utf8" });
  const offline = spawnSync(process.execPath, [SCRIPT, "--offline", RUN], { encoding: "utf8" });
  assert.deepEqual([offline.status, offline.stdout], [0, plain.stdout]);
});

test("a hard ask the calls keep meeting is asked three times, and each one-shot ask after it on its own retry", () => {
  const call = (id, name, input) => ({ type: "assistant", message: { model: "claude-opus-5-5", content: [{ type: "tool_use", id, name, input }] } });
  const ok = (id) => ({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: "ok" }] } });
  const draft = (id) => [call(id, "Bash", { command: "gh pr create --draft --title x" }), ok(id)];
  const records = [
    { type: "user", message: { role: "user", content: "<command-name>/poteto-mode</command-name>\n<command-args>open it</command-args>" } },
    ...[1, 2, 3, 4].flatMap((n) => draft(`p${n}`)),
  ];
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "replay-")), "s.jsonl");
  fs.writeFileSync(file, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const run = spawnSync(process.execPath, [SCRIPT, file], { encoding: "utf8" });
  assert.deepEqual(
    rowsOf(run.stdout).map(([line, , tag]) => [line, tag]),
    [
      ["2", "`[pstack:pr-draft:37a0025a]`"],
      ["4", "`[pstack:pr-draft:37a0025a]`"],
      ["6", "`[pstack:pr-draft:37a0025a]`"],
      ["8", "`[pstack:review:37a0025a]`"],
      ["8", "`[pstack:pr-prose:37a0025a]`"],
    ],
  );
});
