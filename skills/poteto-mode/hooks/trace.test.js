import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { modeOf, readClaudeTrace } from "./trace.mjs";

const FIXTURE = path.join(import.meta.dirname, "fixtures", "session.jsonl");
const SUBAGENTS = path.join(import.meta.dirname, "fixtures", "session", "subagents");

// Each fixture turn ends on its one reply, after all of the turn's actions.
const turn = (index, prompt, command, actions, replies, models, injected = []) => ({
  index,
  prompt,
  command,
  actions,
  texts: replies.map((text) => ({ text, at: actions.length })),
  stops: replies.map((reply) => ({ reply, actions: actions.length, texts: 1 })),
  asked: [],
  injected,
  models,
});
const slash = (args) => `<command-message>poteto-mode</command-message>\n<command-name>/poteto-mode</command-name>\n<command-args>${args}</command-args>`;
const fable = (n) => Array(n).fill("claude-fable-5-1");

function prefix(records) {
  const lines = fs.readFileSync(FIXTURE, "utf8").split("\n");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-"));
  const file = path.join(dir, "session.jsonl");
  fs.writeFileSync(file, lines.slice(0, records).join("\n") + "\n" + (lines[records] ?? "").slice(0, 20));
  return file;
}

test("a session parses into turns opened by real prompts, with its subagent tree", () => {
  assert.deepStrictEqual(readClaudeTrace(FIXTURE), {
    id: "session",
    path: FIXTURE,
    sub: null,
    entrypoint: null,
    turns: [
      turn(0, null, null, [], [], [], ["# pstack session context\n\nstripped"]),
      turn(
        1,
        "read the skill file",
        null,
        [{ kind: "read", id: "toolu_R1", file: { path: "C:\\Users\\me\\.claude\\skills\\poteto-mode\\SKILL.md", shows: "all" }, ok: true, showedAll: null }],
        ["It is the poteto-mode skill."],
        fable(2),
      ),
      turn(
        2,
        slash("fix the cart"),
        { name: "poteto-mode", args: "fix the cart" },
        [
          { kind: "skill", id: null, source: "harness", name: "poteto-mode", ok: true, error: null },
          { kind: "spawn", id: "toolu_A1", agentType: "poteto-agent", model: "opus", description: "tidy", prompt: "Apply the unslop skill.", background: true, ok: true },
          { kind: "shell", id: "toolu_B1", command: "head -5 ~/.claude/skills/poteto-mode/playbooks/bug-fix.md", ok: false },
        ],
        ["1. Reproduce. done"],
        fable(4),
      ),
      turn(3, slash("off"), { name: "poteto-mode", args: "off" }, [], ["Mode off."], fable(1)),
    ],
    children: [
      {
        id: "agent-a1",
        path: path.join(SUBAGENTS, "agent-a1.jsonl"),
        sub: { agentType: "poteto-agent", spawnId: "toolu_A1", description: "tidy", model: "opus" },
        entrypoint: null,
        turns: [
          turn(
            0,
            "Apply the unslop skill.",
            null,
            [{ kind: "spawn", id: "toolu_S1", agentType: "general-purpose", model: null, description: "look", prompt: "Find the cart code.", background: false, ok: true }],
            ["done"],
            ["claude-opus-5"],
          ),
        ],
        children: [
          {
            id: "agent-a2",
            path: path.join(SUBAGENTS, "agent-a2.jsonl"),
            sub: { agentType: "general-purpose", spawnId: "toolu_S1", description: "look", model: null },
            entrypoint: null,
            turns: [turn(0, "Find the cart code.", null, [], ["found"], [])],
            children: [],
          },
        ],
      },
    ],
  });
});

test("mode turns on at the /poteto-mode command and off at /poteto-mode off, never from a read of SKILL.md", () => {
  assert.deepStrictEqual(
    [6, 14, 17].map((records) => modeOf(readClaudeTrace(prefix(records)))),
    [
      { on: false, since: null },
      { on: true, since: 2 },
      { on: false, since: null },
    ],
  );
});

test("mode is on for a poteto-agent subagent and off for the general-purpose agent it spawned", () => {
  const [potetoAgent] = readClaudeTrace(FIXTURE).children;
  const alone = readClaudeTrace(path.join(SUBAGENTS, "agent-a1.jsonl"));
  assert.deepStrictEqual(
    [modeOf(potetoAgent), modeOf(potetoAgent.children[0]), modeOf(alone), alone.children.map((c) => c.id)],
    [{ on: true, since: 0 }, { on: false, since: null }, { on: true, since: 0 }, ["agent-a2"]],
  );
});

test("a spawn filter parses only the named subagent trees", () => {
  const ids = (t) => t.children.map((c) => [c.id, c.children.map((g) => g.id)]);
  assert.deepStrictEqual(
    [
      ids(readClaudeTrace(FIXTURE, { spawns: () => new Set(["toolu_A1"]) })),
      ids(readClaudeTrace(FIXTURE, { spawns: () => new Set() })),
      ids(readClaudeTrace(FIXTURE, { spawns: () => new Set(["toolu_S1"]) })),
    ],
    [[["agent-a1", ["agent-a2"]]], [], [["agent-a2", []]]],
  );
});

test("a compact boundary is a harness action in its turn, in order between the calls around it", () => {
  const records = [
    { type: "user", message: { role: "user", content: "Read it." } },
    { type: "assistant", message: { content: [{ type: "tool_use", id: "r1", name: "Read", input: { file_path: "a.md" } }] } },
    { type: "system", subtype: "compact_boundary", content: "Conversation compacted", compactMetadata: { trigger: "auto" } },
    { type: "system", subtype: "informational", content: "not a boundary" },
    { type: "assistant", message: { content: [{ type: "tool_use", id: "r2", name: "Read", input: { file_path: "b.md" } }] } },
  ];
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pstack-trace-")), "s.jsonl");
  fs.writeFileSync(file, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
  assert.deepStrictEqual(
    readClaudeTrace(file).turns[0].actions.map((a) => [a.kind, a.id]),
    [
      ["read", "r1"],
      ["compact", null],
      ["read", "r2"],
    ],
  );
});

test("a tag counts from any errored tool result, a gate block or a note, and one deny may carry several", () => {
  const call = (id, command) => ({ type: "assistant", message: { model: "claude-opus-5-5", content: [{ type: "tool_use", id, name: "Bash", input: { command } }] } });
  const failed = (id, content) => ({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content, is_error: true }] } });
  const records = [
    { type: "user", message: { role: "user", content: "fix it" } },
    call("b1", "gh pr create --title x"),
    failed("b1", "PreToolUse:Bash hook error: Before this PR opens, read no-comments/SKILL.md in full. [pstack:review:37a0025a]\nBefore this PR opens, read unslop/SKILL.md in full. [pstack:pr-prose:37a0025a]"),
    call("b2", "node --test gate.test.js"),
    failed("b2", "Exit code 1\nexpected PreToolUse:Bash hook error: Before committing, read deslop/SKILL.md. [pstack:deslop:077a459b]"),
    { type: "attachment", attachment: { type: "hook_additional_context", content: ["You committed with every task item still in its first state. [pstack:tasks-stale:37a0025a]"] } },
    { type: "assistant", message: { model: "claude-opus-5-5", stop_reason: "end_turn", content: [{ type: "text", text: "Done." }] } },
    { type: "user", isMeta: true, message: { role: "user", content: "Stop hook feedback:\npstack gate. Before you stop:\n- The reply contains the long dash (U+2014). [pstack:long-dash:c08ec9e0]" } },
  ];
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "trace-")), "session.jsonl");
  fs.writeFileSync(file, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
  assert.deepStrictEqual(readClaudeTrace(file).turns[0].asked, [
    { id: "review:37a0025a", at: 1, call: "b1" },
    { id: "pr-prose:37a0025a", at: 1, call: "b1" },
    { id: "deslop:077a459b", at: 2, call: "b2" },
    { id: "tasks-stale:37a0025a", at: 2, call: null },
    { id: "long-dash:c08ec9e0", at: 2, call: null },
  ]);
});

test("only text that opens with the gate's block is gate feedback, so a prompt quoting an old block starts a turn and spends no tag", () => {
  const block = "pstack gate. Before you stop:\n- The reply contains the long dash (U+2014). [pstack:long-dash:c08ec9e0]";
  const records = [
    { type: "user", message: { role: "user", content: "fix it" } },
    { type: "assistant", message: { model: "claude-opus-5-5", stop_reason: "end_turn", content: [{ type: "text", text: "Done." }] } },
    { type: "user", message: { role: "user", content: `Stop hook feedback:\n${block}` } },
    { type: "user", message: { role: "user", content: `/poteto-mode why did you get this? ${block}` } },
  ];
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "trace-")), "session.jsonl");
  fs.writeFileSync(file, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const { turns } = readClaudeTrace(file);
  assert.deepEqual(
    turns.map((t) => [t.index, t.asked.map((a) => a.id)]),
    [
      [0, ["long-dash:c08ec9e0"]],
      [1, []],
    ],
  );
});
