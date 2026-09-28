import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const PARITY = join(dirname(fileURLToPath(import.meta.url)), "parity.mjs");
const slash = (p) => p.replaceAll("\\", "/");
const root = slash(mkdtempSync(join(tmpdir(), "parity-retrace-")));
const out = `${root}/out`;
const sandbox = `${root}/sb`;
const E = `${out}/s9`;
const PROMPTS = [
  "/poteto-mode npm test fails on the 10% discount case in the cart. Fix it.",
  "thanks, looks good",
  "Add a free-shipping rule: orders over 50 after the discount ship free. Include it in the cart total.",
];

const put = (path, body) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, typeof body === "string" ? body : JSON.stringify(body, null, 2));
};
const jsonl = (path, events) => put(path, `${events.map((e) => JSON.stringify(e)).join("\n")}\n`);
const bareTrace = { actor: "main", actorId: "old", turns: PROMPTS.map((prompt, index) => ({ index, prompt, command: null, actions: [], reply: "", injected: [], models: [] })), children: [] };
const doneRun = (key, extra = {}) => {
  put(`${E}/runs/${key}/DONE`, "2026-09-20T00:00:00Z");
  put(`${E}/runs/${key}/trace.json`, bareTrace);
  put(`${E}/runs/${key}/judge-J1.json`, { verdicts: [] });
  put(`${E}/runs/${key}/judge-J1.jsonl`, "");
  for (const [file, body] of Object.entries(extra)) put(`${E}/runs/${key}/${file}`, body);
};

const home = `${sandbox}/r/r01/home`;
const principle = `${home}/.claude/skills/poteto-mode/principles/fix-root-causes.md`;
const claudeTurn = (text, i) => [
  i === 0
    ? { type: "user", message: { role: "user", content: `<command-message>poteto-mode</command-message>\n<command-name>/poteto-mode</command-name>\n<command-args>${text.slice(13)}</command-args>` } }
    : { type: "user", message: { role: "user", content: text } },
  ...(i === 0
    ? [
        { type: "assistant", cwd: `${sandbox}/r/r01/shop-cart`, message: { id: "m0", model: "claude-opus-5-5", content: [{ type: "tool_use", id: "c0", name: "Bash", input: { command: `cat ${principle}` } }] } },
        { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "c0", content: "ok" }] } },
      ]
    : []),
  { type: "assistant", message: { id: `r${i}`, model: "claude-opus-5-5", stop_reason: "end_turn", content: [{ type: "text", text: `reply ${i}` }] } },
];
jsonl(`${E}/runs/t01-long-session.B.1/transcript/main.jsonl`, PROMPTS.flatMap(claudeTurn));
doneRun("t01-long-session.B.1", { "seal.json": ["B home has plugins stray, expected none"] });

jsonl(`${E}/runs/t01-long-session.N.1/transcript/main.jsonl`, PROMPTS.flatMap(claudeTurn));
doneRun("t01-long-session.N.1", { "seal.json": ["N home has .claude/skills"] });
put(`${sandbox}/r/r04/home/.claude/settings.json`, {});
mkdirSync(`${sandbox}/r/r04/home/.claude/skills/synced/org_account/pdf`, { recursive: true });

const copied = "C:/elsewhere/s1";
const cursorTurn = (prompt, i) => [
  { type: "system", subtype: "init", session_id: "cur", model: "m" },
  { type: "user", message: { content: [{ type: "text", text: prompt }] } },
  ...(i === 0
    ? [
        {
          type: "tool_call",
          subtype: "completed",
          tool_call: { shellToolCall: { args: { command: `sed -n '5,200p' ${copied}/trees/upstream-v0.15.2/skills/principle-laziness-protocol/SKILL.md`, workingDirectory: "" }, result: { success: { exitCode: 0 } } } },
        },
      ]
    : []),
  { type: "assistant", message: { content: [{ type: "text", text: `reply ${i}` }] } },
];
PROMPTS.forEach((p, i) => jsonl(`${E}/runs/t01-long-session.A.1/turn-${i}.jsonl`, cursorTurn(p, i)));
doneRun("t01-long-session.A.1", { "seal.json": [] });
jsonl(`${E}/runs/t01-long-session.A.2/turn-0.jsonl`, cursorTurn(PROMPTS[0], 0));
doneRun("t01-long-session.A.2");
put(`${E}/calib/PLANNED`, {});
put(`${E}/plan.json`, {
  stamp: "s9",
  sandbox,
  trees: { A: "upstream-v0.15.2", C: null, B: "0832828", E: null, N: null },
  runs: [
    { key: "t01-long-session.B.1", task: "t01-long-session", arm: "B", rep: 1, rid: "r01", sandbox },
    { key: "t01-long-session.N.1", task: "t01-long-session", arm: "N", rep: 1, rid: "r04", sandbox },
    { key: "t01-long-session.A.1", task: "t01-long-session", arm: "A", rep: 1, rid: "r02", sandbox: copied },
    { key: "t01-long-session.A.2", task: "t01-long-session", arm: "A", rep: 2, rid: "r03", sandbox: copied },
  ],
});

const r = spawnSync(process.execPath, [PARITY, "--retrace", "--stamp", "s9", "--out", out, "--sandbox", sandbox], { encoding: "utf8" });
const run = (key) => `${E}/runs/${key}`;
const read = (key, file) => readFileSync(`${run(key)}/${file}`, "utf8");

test("retrace rebuilds a Claude run's trace and packet from its saved transcript and drops its verdicts", () => {
  const reads = JSON.parse(read("t01-long-session.B.1", "trace.json")).turns[0].actions.filter((a) => a.kind === "read");
  assert.deepEqual(reads, [{ kind: "read", doc: "principle:fix-root-causes", path: principle, full: true, ok: true }]);
  assert.ok(read("t01-long-session.B.1", "packet.md").includes("e3 [main] read <pstack>/poteto-mode/principles/fix-root-causes.md (full)"));
  const seal = JSON.parse(read("t01-long-session.B.1", "seal.json")).filter((v) => !v.startsWith("touched the real home"));
  assert.deepEqual(seal, ["B home has plugins stray, expected none"]);
  assert.deepEqual(["DONE", "judge-J1.json", "judge-J1.jsonl"].map((f) => existsSync(`${run("t01-long-session.B.1")}/${f}`)), [true, false, false]);
});

test("retrace rechecks a home still on disk under the current rule instead of keeping its old finding", () => {
  const seal = JSON.parse(read("t01-long-session.N.1", "seal.json"));
  assert.deepEqual(seal.filter((v) => v.includes(" home ")), []);
});

test("retrace rebuilds a run copied from another stamp against the sandbox it ran in", () => {
  const reads = JSON.parse(read("t01-long-session.A.1", "trace.json")).turns[0].actions.filter((a) => a.kind === "read");
  assert.deepEqual(reads, [
    { kind: "read", doc: "principle:laziness-protocol", path: `${copied}/trees/upstream-v0.15.2/skills/principle-laziness-protocol/SKILL.md`, full: false, ok: true },
  ]);
  assert.ok(read("t01-long-session.A.1", "packet.md").includes("e2 [main] run: sed -n '5,200p' <pstack>/poteto-mode/principles/laziness-protocol.md"));
});

test("retrace fails a run whose saved streams are gone instead of keeping its stale trace", () => {
  assert.equal(r.status, 1);
  assert.match(r.stderr, /t01-long-session\.A\.2: no saved turn-1\.jsonl/);
  assert.deepEqual(JSON.parse(read("t01-long-session.A.2", "FAILED.json")), { reason: "retrace: no saved turn-1.jsonl" });
  assert.deepEqual(["DONE", "trace.json", "judge-J1.json"].map((f) => existsSync(`${run("t01-long-session.A.2")}/${f}`)), [false, false, false]);
  assert.equal(existsSync(`${E}/calib/PLANNED`), false);
});
