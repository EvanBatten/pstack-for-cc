import { test } from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPT = path.join(import.meta.dirname, "audit-transcripts.mjs");

function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

const jsonl = (records) => records.map((r) => JSON.stringify(r)).join("\n") + "\n";
const context = (text) => ({ type: "attachment", attachment: { type: "hook_additional_context", content: [text] } });
const tool = (id, name, input, model = "claude-opus-5-5") => ({
  type: "assistant",
  message: { model, stop_reason: "tool_use", content: [{ type: "tool_use", id, name, input }] },
});
const result = (id, isError = false) => ({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, is_error: isError, content: isError ? "error" : "ok" }] } });
const reply = (text, model = "claude-opus-5-5") => ({ type: "assistant", message: { model, stop_reason: "end_turn", content: [{ type: "text", text }] } });
const slash = { type: "user", message: { role: "user", content: "<command-name>/poteto-mode</command-name>" } };
// A fresh machine: no ~/.claude/pstack-models.md and no $PSTACK_MODELS_FILE.
const freshHome = () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "audit-home-"));
  return { ...process.env, HOME: home, USERPROFILE: home, PSTACK_MODELS_FILE: "" };
};

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "audit-"));
  const skills = path.join(root, "skills");
  const principle = (slug, title) => write(path.join(skills, "poteto-mode", "principles", `${slug}.md`), `# ${title}\n`);
  write(path.join(skills, "poteto-mode", "SKILL.md"), "# Poteto mode\n");
  principle("build-the-lever", "Build the Lever");
  principle("prove-it-works", "Prove It Works");
  principle("laziness-protocol", "Laziness Protocol\n" + "Bias to deletion.\n".repeat(9));
  principle("fix-root-causes", "Fix Root Causes");
  write(
    path.join(skills, "poteto-mode", "playbooks", "investigation.md"),
    [
      "### Investigation",
      "",
      "1. Route through the **how** skill. For motivation questions, also route through the **why** skill.",
      "2. Apply the **unslop** skill to the reply.",
      "3. If the design is contested, run the **interrogate** skill.",
      "4. Produce the `how`-shaped output.",
      "",
    ].join("\n"),
  );
  write(path.join(skills, "poteto-mode", "playbooks", "opening-a-pr.md"), "### Opening a PR\n\nRun `/deslop` before commit. Run `/no-comments` before review. Write the body with `/technical-writing`, then apply `/unslop`. A subagent that opens a PR runs `interrogate`.\n");
  write(path.join(skills, "poteto-mode", "playbooks", "feature.md"), "### Feature\n\n1. `how` over the affected subsystem.\n");
  for (const s of ["how", "why", "unslop", "interrogate", "deslop", "no-comments", "technical-writing"]) write(path.join(skills, s, "SKILL.md"), `# ${s}\n`);

  const project = path.join(root, "project");
  write(
    path.join(project, "s1.jsonl"),
    jsonl([
      context("# pstack session context\n\nOrchestrate store root"),
      slash,
      tool("t1", "Bash", { command: "cd ~/.claude/skills/poteto-mode && LC_ALL=C cat principles/build-the-lever.md" }),
      result("t1"),
      tool("t2", "Bash", { command: "export D=~/.claude/skills/poteto-mode/principles; cat $D/laziness-protocol.md | head -5" }),
      result("t2"),
      tool("t3", "Read", { file_path: "C:\\Users\\me\\.claude\\skills\\poteto-mode\\principles\\prove-it-works.md" }),
      result("t3", true),
      tool("t4", "Read", { file_path: "C:\\Users\\me\\.claude\\skills\\poteto-mode\\playbooks\\investigation.md" }),
      result("t4"),
      tool("t5", "Bash", { command: "cat ~/.claude/skills/poteto-mode/playbooks/opening-a-pr.md" }),
      result("t5"),
      tool("t5b", "Bash", { command: "head -50 ~/.claude/skills/how/SKILL.md" }),
      result("t5b"),
      tool("t6", "Skill", { skill: "how" }),
      result("t6", true),
      tool("t7", "Agent", { subagent_type: "poteto-agent", model: "sonnet", description: "tidy the reply", prompt: "Apply the unslop skill to REPLY.md." }),
      result("t7"),
      context("# pstack reminders\n\nPoteto mode is live"),
      reply(
        [
          "Playbook (Investigation).",
          "1. Route through the **how** skill. skip: one file answers it",
          "2. Unslop the reply.",
          "3. Nothing contested.",
          "4. Opening a PR. Skipped, the repo has no remote.",
          "",
          "**Build the Lever.** shaped the script. **Prove It Works.** shaped the check. principle-laziness-protocol kept it small. We should fix root causes here.",
        ].join("\n"),
      ),
    ]),
  );
  const sub = path.join(project, "s1", "subagents", "agent-x1");
  write(`${sub}.meta.json`, JSON.stringify({ agentType: "poteto-agent", toolUseId: "t7", description: "tidy the reply" }));
  write(`${sub}.jsonl`, jsonl([context("# pstack session context\n\nOrchestrate store root"), tool("u1", "Read", { file_path: "/home/me/.claude/skills/unslop/SKILL.md" }), result("u1"), reply("done")]));
  write(
    path.join(project, "s2.jsonl"),
    jsonl([
      { type: "user", message: { role: "user", content: [{ type: "text", text: "Base directory for this skill: C:\\Users\\me\\.claude\\skills\\poteto-mode\n\n# Poteto mode" }] } },
      tool("w1", "Write", { file_path: "/home/me/app/.claude/skills/verify-app/SKILL.md", content: "# verify-app" }),
      result("w1"),
    ]),
  );
  write(
    path.join(project, "s3.jsonl"),
    jsonl([
      slash,
      tool("v1", "Read", { file_path: "/home/me/.claude/skills/poteto-mode/playbooks/feature.md" }),
      result("v1"),
      tool("v2", "Edit", { file_path: "/home/me/pstack-for-cc/skills/poteto-mode/playbooks/feature.md", old_string: "a", new_string: "b" }),
      result("v2"),
      reply("Feature playbook edited. **Fix Root Causes.**"),
    ]),
  );
  return { skills, project };
}

test("the audit grades hook context, playbook steps, triggers, principles, refusals and subagent models", () => {
  const { skills, project } = fixture();
  const r = spawnSync(process.execPath, [SCRIPT, "--skills", skills, "--json", project], { encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
  const { summary, rows } = JSON.parse(r.stdout);
  const [main, sub, loaded, editing] = rows;

  assert.deepStrictEqual(
    {
      context: main.context,
      reminders: main.reminders,
      graded: main.graded,
      playbooks: main.playbooks,
      triggers: main.triggers,
      principles: main.principles,
      skillCalls: main.skillCalls.map((c) => [c.skill, c.refused]),
    },
    {
      context: 1,
      reminders: 1,
      graded: true,
      playbooks: { investigation: { steps: 4, carried: 1 }, "opening-a-pr": { steps: 0, carried: 0 } },
      triggers: [
        { from: "investigation#1", skill: "how", state: "fired" },
        { from: "investigation#1", skill: "why", state: "skipped-with-reason" },
        { from: "investigation#2", skill: "unslop", state: "delegated" },
        { from: "investigation#3", skill: "interrogate", state: "conditional-not-run" },
        { from: "opening-a-pr", skill: "deslop", state: "skipped-with-reason" },
        { from: "opening-a-pr", skill: "no-comments", state: "skipped-with-reason" },
        { from: "opening-a-pr", skill: "technical-writing", state: "skipped-with-reason" },
        { from: "opening-a-pr", skill: "unslop", state: "delegated" },
        { from: "opening-a-pr", skill: "interrogate", state: "skipped-with-reason" },
      ],
      principles: {
        cited: ["build-the-lever", "laziness-protocol", "prove-it-works"],
        read: ["build-the-lever", "laziness-protocol"],
        citedUnread: ["prove-it-works"],
      },
      skillCalls: [["how", true]],
    },
  );
  assert.deepStrictEqual(
    { id: sub.id, context: sub.context, modeEntered: sub.modeEntered, requestedModel: sub.requestedModel, modelMatches: sub.modelMatches },
    { id: "agent-x1", context: 1, modeEntered: false, requestedModel: "sonnet", modelMatches: false },
  );
  assert.deepStrictEqual([loaded.id, loaded.modeEntered, loaded.graded], ["s2", true, true]);
  assert.deepStrictEqual([editing.id, editing.modeEntered, editing.graded], ["s3", true, false]);
  assert.deepStrictEqual(
    [summary.graded, summary.stepsCarriedVerbatim, summary.principlesCitedUnread, summary.skillCallsRefused, summary.subagentsModelMismatch, summary.triggers.silent],
    [2, 1, 1, 1, 1, 0],
  );
});

test("the audit matches a subagent's model to its request by the family its model ID names", () => {
  const { skills } = fixture();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "audit-models-"));
  const runs = [
    ["f1", "fable", "claude-fable-5-1"],
    ["f2", "sonnet", "claude-3-5-sonnet-20241022"],
    ["f3", "opus", "us.anthropic.claude-opus-4-1-20250805-v1:0"],
    ["f4", "opus[1m]", "claude-opus-4-6[1m]"],
    ["f5", "fable", "claude-opus-5-5"],
    ["f6", "opus", "claude-2.1"],
  ];
  write(path.join(project, "s.jsonl"), jsonl(runs.flatMap(([id, model]) => [tool(id, "Agent", { subagent_type: "poteto-agent", model, description: id, prompt: "Tidy it." }), result(id)])));
  for (const [id, , ran] of runs) {
    const sub = path.join(project, "s", "subagents", `agent-${id}`);
    write(`${sub}.meta.json`, JSON.stringify({ agentType: "poteto-agent", toolUseId: id, description: id }));
    write(`${sub}.jsonl`, jsonl([reply("done", ran)]));
  }
  const r = spawnSync(process.execPath, [SCRIPT, "--skills", skills, "--json", project], { encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.deepStrictEqual(
    JSON.parse(r.stdout)
      .rows.filter((row) => row.kind === "subagent")
      .map((row) => [row.description, row.modelMatches])
      .sort(),
    [
      ["f1", true],
      ["f2", true],
      ["f3", true],
      ["f4", true],
      ["f5", false],
      ["f6", false],
    ],
  );
});

test("the audit counts a read of either control skill as the step's generic control reference fired", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "audit-"));
  const skills = path.join(root, "skills");
  write(path.join(skills, "poteto-mode", "SKILL.md"), "# Poteto mode\n");
  write(path.join(skills, "poteto-mode", "principles", "prove-it-works.md"), "# Prove It Works\n");
  write(path.join(skills, "poteto-mode", "playbooks", "bug-fix.md"), "### Bug fix\n\n1. Reproduce it on the matching surface via the control skill.\n2. Fix it.\n");
  for (const s of ["control-cli", "control-ui"]) write(path.join(skills, s, "SKILL.md"), `# ${s}\n`);
  const session = (id, reads) =>
    write(
      path.join(root, "project", `${id}.jsonl`),
      jsonl([
        slash,
        tool("p", "Read", { file_path: "/home/me/.claude/skills/poteto-mode/playbooks/bug-fix.md" }),
        result("p"),
        ...reads.flatMap((s, i) => [tool(`c${i}`, "Read", { file_path: `/home/me/.claude/skills/${s}/SKILL.md` }), result(`c${i}`)]),
        reply("Route: Bug fix playbook.\n1. Reproduce it on the matching surface via the control skill. done\n2. Fix it. done"),
      ]),
    );
  session("a", ["control-ui"]);
  session("b", []);
  const r = spawnSync(process.execPath, [SCRIPT, "--skills", skills, "--json", path.join(root, "project")], { encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.deepStrictEqual(
    JSON.parse(r.stdout).rows.map((row) => [row.id, row.triggers]),
    [
      ["a", [{ from: "bug-fix#1", skill: "control-cli or control-ui", state: "fired" }]],
      ["b", [{ from: "bug-fix#1", skill: "control-cli or control-ui", state: "silent" }]],
    ],
  );
});

test("the audit refuses a flag with no value", () => {
  const r = spawnSync(process.execPath, [SCRIPT, "--skills"], { encoding: "utf8" });
  assert.strictEqual(r.status, 2);
  assert.match(r.stderr, /--skills needs a value/);
});

test("the gate replay grades every stop of a turn, and a finding it already raised in the span does not block again", () => {
  const { skills } = fixture();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "replay-"));
  write(
    path.join(dir, "s.jsonl"),
    jsonl([
      slash,
      tool("p", "Read", { file_path: "C:/Users/me/.claude/skills/poteto-mode/playbooks/feature.md" }),
      result("p"),
      reply("No steps here."),
      { type: "user", message: { role: "user", content: "<task-notification>\n<task-id>a1</task-id>\n</task-notification>" } },
      tool("h", "Read", { file_path: "C:/Users/me/.claude/skills/how/SKILL.md" }),
      result("h"),
      reply("Read the how skill."),
    ]),
  );
  const r = spawnSync(process.execPath, [SCRIPT, "--skills", skills, "--gate-replay", "--json", dir], { encoding: "utf8", env: freshHome() });
  assert.strictEqual(r.status, 0, r.stderr);
  const { summary, blocked } = JSON.parse(r.stdout);
  assert.deepStrictEqual(
    [summary.Stop, blocked.map((b) => [b.turn, b.stop, b.reply, b.findings.map((f) => f.rule)])],
    [{ actors: 1, stops: 2, blocked: 1, byRule: { "unslop-unread": 1 } }, [[0, 0, "No steps here.", ["unslop-unread"]]]],
  );
});

test("the gate replay grades each in-mode turn's stop and lists the ones it would block", () => {
  const { skills } = fixture();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "replay-"));
  const playbook = tool("p", "Read", { file_path: "C:/Users/me/.claude/skills/poteto-mode/playbooks/feature.md" });
  write(
    path.join(dir, "s.jsonl"),
    jsonl([
      { type: "user", message: { role: "user", content: "before the mode" } },
      playbook,
      result("p"),
      reply("No steps here."),
      slash,
      playbook,
      result("p"),
      reply("No steps here either."),
      { type: "user", message: { role: "user", content: "and now" } },
      playbook,
      result("p"),
      tool("h", "Read", { file_path: "C:/Users/me/.claude/skills/how/SKILL.md" }),
      result("h"),
      reply("1. `how` over the affected subsystem. done"),
    ]),
  );
  const r = spawnSync(process.execPath, [SCRIPT, "--skills", skills, "--gate-replay", "--json", dir], { encoding: "utf8", env: freshHome() });
  assert.strictEqual(r.status, 0, r.stderr);
  const { summary, blocked } = JSON.parse(r.stdout);
  assert.deepStrictEqual(
    [summary.Stop, blocked.map((b) => [b.turn, b.findings.map((f) => f.rule)])],
    [{ actors: 1, stops: 2, blocked: 1, byRule: { "unslop-unread": 1 } }, [[1, ["unslop-unread"]]]],
  );
});

test("the gate replay also grades each in-mode spawn the way PreToolUse would, on what was read before it", () => {
  const { skills } = fixture();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "replay-"));
  const spawn = (id) => tool(id, "Agent", { description: "Fix it", subagent_type: "poteto-agent", model: "opus", prompt: "Playbook: Feature\n\nApply principle-fix-root-causes to the parser." });
  write(
    path.join(dir, "s.jsonl"),
    jsonl([
      slash,
      spawn("a1"),
      result("a1"),
      tool("r", "Read", { file_path: "C:/Users/me/.claude/skills/poteto-mode/principles/fix-root-causes.md" }),
      result("r"),
      spawn("a2"),
      result("a2"),
      reply("Route: Feature playbook. Spawned twice."),
    ]),
  );
  const r = spawnSync(process.execPath, [SCRIPT, "--skills", skills, "--gate-replay", "--json", dir], { encoding: "utf8", env: freshHome() });
  assert.strictEqual(r.status, 0, r.stderr);
  const { summary, blocked } = JSON.parse(r.stdout);
  assert.deepStrictEqual(
    [summary.PreToolUse, blocked.filter((b) => b.event === "PreToolUse").map((b) => [b.spawn, b.findings.map((f) => f.message)])],
    [
      { actors: 1, stops: 2, blocked: 1, byRule: { "spawn-cites": 1 } },
      [
        [
          "a1",
          [
            "This brief cites a principle you have not read. Read principles/fix-root-causes.md in full, or drop the citation. [pstack:spawn-cites:ef189ef0]",
          ],
        ],
      ],
    ],
  );
});
