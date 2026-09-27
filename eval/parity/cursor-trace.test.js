import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { docOf, readCursorTrace, shellWrites } from "./cursor-trace.mjs";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

test("a real cursor-agent stream becomes one turn with the actions it took", () => {
  const trace = readCursorTrace([join(fixtures, "cursor-probe2.jsonl")], null);
  assert.equal(trace.actor, "main");
  assert.equal(trace.actorId, "f4219dfe-f2e6-4148-b908-38c55406f7eb");
  assert.equal(trace.turns.length, 1);
  const [turn] = trace.turns;
  assert.equal(turn.prompt, "/poteto-mode test_calc.py fails. fix the bug.");
  assert.deepEqual(turn.command, { name: "poteto-mode", args: "test_calc.py fails. fix the bug." });
  assert.deepEqual(turn.models, ["Claude Opus 5.5 300K Medium"]);
  assert.deepEqual(
    turn.actions.map((a) => a.kind),
    ["say", "read", "shell", "read", "read", "shell", "say", "read", "read", "write", "shell", "say"],
  );
  assert.deepEqual(turn.actions[1], {
    kind: "read",
    doc: "playbook:bug-fix",
    path: "C:/Users/me/.claude/skills/poteto-mode/playbooks/bug-fix.md",
    full: true,
    ok: true,
  });
  assert.deepEqual(
    turn.actions.filter((a) => a.doc?.startsWith("principle:")).map((a) => a.doc),
    ["principle:fix-root-causes", "principle:laziness-protocol"],
  );
  assert.equal(turn.actions[5].command, 'python test_calc.py; echo "exit=$?"');
  assert.match(turn.actions[9].path, /\/cursor-probe\/ws\/calc\.py$/);
  assert.match(turn.reply, /^I fixed it, and `test_calc.py` now passes\./);
});

test("a task call links to its child chat, which keeps its own reads", () => {
  const trace = readCursorTrace([join(fixtures, "cursor-probe1.jsonl")], join(fixtures, "cursor-probe1-transcripts"));
  const spawn = trace.turns[0].actions.find((a) => a.kind === "spawn");
  assert.equal(spawn.agentType, "poteto-agent");
  assert.equal(spawn.model, null);
  assert.equal(spawn.background, false);
  assert.equal(spawn.childId, "848c77a7");
  assert.equal(trace.children.length, 1);
  const [child] = trace.children;
  assert.equal(child.actor, "poteto-agent");
  assert.deepEqual(
    child.turns[0].actions.filter((a) => a.kind === "read" && a.doc).map((a) => a.doc),
    [
      "skill:poteto-mode",
      "playbook:bug-fix",
      "principle:fix-root-causes",
      "principle:prove-it-works",
      "principle:laziness-protocol",
      "principle:never-block-on-the-human",
      "principle:sequence-verifiable-units",
      "skill:unslop",
    ],
  );
  assert.equal(child.turns[0].actions.filter((a) => a.kind === "write").length, 1);
});

test("both install layouts name the same document", () => {
  assert.equal(docOf("C:\\x\\skills\\principle-laziness-protocol\\SKILL.md"), "principle:laziness-protocol");
  assert.equal(docOf("/h/.claude/skills/poteto-mode/principles/laziness-protocol.md"), "principle:laziness-protocol");
  assert.equal(docOf("/t/skills/how/SKILL.md"), "skill:how");
  assert.equal(docOf("/repo/src/cart.js"), null);
});

test("shell redirections and tee count as writes, fd and null redirections do not", () => {
  assert.deepEqual(shellWrites('node x.js > out.txt 2>&1; echo hi >> "log file.md" | tee -a t.log; ls > /dev/null'), [
    "out.txt",
    "log file.md",
    "t.log",
  ]);
});
