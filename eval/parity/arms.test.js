import assert from "node:assert/strict";
import { test } from "node:test";
import { armById, copyable, parseTreeOverrides, planTrees, sealViolations } from "./arms.mjs";

const ALL = ["A", "C", "D", "B"];

test("parseTreeOverrides reads each --tree pair among other flags", () => {
  assert.deepEqual(parseTreeOverrides(["--init", "--tree", "B=3ced788", "--stamp", "s3"], ALL), { B: "3ced788" });
  assert.deepEqual(parseTreeOverrides(["--tree", "B=x", "--tree", "D=y"], ALL), { B: "x", D: "y" });
});

test("parseTreeOverrides rejects a malformed, unknown, repeated or control override", () => {
  assert.throws(() => parseTreeOverrides(["--tree", "B"], ALL), /ID=ref/);
  assert.throws(() => parseTreeOverrides(["--tree", "Z=abc"], ALL), /Z/);
  assert.throws(() => parseTreeOverrides(["--tree", "B="], ALL), /ID=ref/);
  assert.throws(() => parseTreeOverrides(["--tree", "B=x", "--tree", "B=y"], ALL), /twice/);
  assert.throws(() => parseTreeOverrides(["--tree", "C=abc"], ALL), /no tree/);
});

test("planTrees fills each arm without an override from its default", () => {
  assert.deepEqual(planTrees(ALL, { B: "abc1234" }), { A: "upstream-v0.15.2", C: null, D: "cf5b727", B: "abc1234" });
});

test("copyable reads a plan with no trees as the trees such plans ran at", () => {
  const legacy = { runs: [] };
  const target = { A: "upstream-v0.15.2", C: null, D: "cf5b727", B: "3ced788" };
  assert.equal(copyable(legacy, target, "B"), false);
  for (const arm of ["A", "C", "D"]) assert.equal(copyable(legacy, target, arm), true, arm);
  assert.equal(copyable(legacy, { ...target, B: "3970322" }, "B"), true);
});

test("copyable compares a plan's recorded tree with the target's", () => {
  const source = { trees: { B: "3ced788" } };
  assert.equal(copyable(source, { B: "3ced788" }, "B"), true);
  assert.equal(copyable(source, { B: "3970322" }, "B"), false);
});

const traceOf = (...actions) => ({ turns: [{ actions }], children: [] });

test("sealViolations flags a read under a POSIX home, and not one under a sibling that shares its prefix", () => {
  const trace = traceOf({ kind: "read", path: "/home/someone/.ssh/id_rsa" }, { kind: "read", path: "/home/someonex/a" });
  assert.deepEqual(sealViolations(armById.B, trace, "/home/someone"), ["touched the real home: /home/someone/.ssh/id_rsa"]);
});

test("sealViolations flags a Windows home in its drive form and its Git Bash form, in any case", () => {
  const trace = traceOf({ kind: "shell", command: String.raw`cat C:\Users\someone\notes.txt` }, { kind: "shell", command: "ls /c/users/someone/x" }, { kind: "shell", command: "ls /c/users/someone2" });
  assert.deepEqual(sealViolations(armById.B, trace, String.raw`C:\Users\someone`), ["touched the real home: cat C:/Users/someone/notes.txt", "touched the real home: ls /c/users/someone/x"]);
});
