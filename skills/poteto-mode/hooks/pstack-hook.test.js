import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseEvent, respond, serialize } from "./pstack-hook.mjs";
import { loadCatalog } from "./catalog.mjs";
import { readClaudeTrace } from "./trace.mjs";

const HOOK = path.join(import.meta.dirname, "pstack-hook.mjs");
const SKILLS = "C:/Users/me/.claude/skills";
const PLAYBOOK = `${SKILLS}/poteto-mode/playbooks/feature.md`;
const catalog = loadCatalog(path.join(import.meta.dirname, "fixtures", "skills"));
const real = loadCatalog(path.join(import.meta.dirname, "..", ".."));

const deps = (over = {}) => ({
  skills: SKILLS,
  models: () => ({ path: "C:/Users/me/.claude/pstack-models.md", text: "# pstack model configuration\n# budget: medium\nfeature, refactoring: opus\nhow explorer: sonnet\n" }),
  catalog: () => catalog,
  raw: (p) => fs.readFileSync(p, "utf8"),
  trace: readClaudeTrace,
  gate: "enforce",
  mark: () => {},
  log: () => {},
  fs: { inRepo: () => false },
  skips: () => ({ user: null, project: null }),
  ...over,
});
const realDeps = (models = "hillclimb: opus\nbug-fix: opus\n") => deps({ catalog: () => real, models: () => ({ path: "C:/Users/me/.claude/pstack-models.md", text: models }) });

const MOST_MISSED = [
  "- Keep each task item's state current, in_progress when you start it and completed when it is done.",
  "- Write a skipped step's `skip: <reason>` on its task item, not only in narration.",
  "- For a fix or a verification, read `C:/Users/me/.claude/skills/poteto-mode/principles/prove-it-works.md` in full.",
  "- Every claim carries its evidence or its label in the same sentence. Measured, inferred, or guess.",
  "- For a bug fix, paste the failing output and then the passing output verbatim.",
  "- Use no long dash and no mid-sentence colon connector in any visible text.",
];
const REMINDER = `# pstack reminders
Poteto mode is live in this session. Before the next reply:

- Name each principle that shaped a decision and the choice it changed. Read \`C:/Users/me/.claude/skills/poteto-mode/principles/<slug>.md\` in full before citing it.
- A trigger that names a skill (the **how** skill, \`/architect\`, \`interrogate\`, \`swarm\`) means read that skill's \`SKILL.md\` in full and carry it out. Skimming it does not satisfy the trigger. Choosing not to run it is a \`skip: <reason>\` line in the step list.
- Open a task list with TaskCreate (a deferred tool, loaded through ToolSearch) whose first items are the matched playbook's steps, verbatim, each with its state. Where no task tool exists, carry them as a verbatim list in the reply.

Rules most often missed:
${MOST_MISSED.join("\n")}

A casual turn, or the user opting out, cancels all of this.
`;
const ENTRY_REMINDER = REMINDER;
const STEP_AWAY_REMINDER = REMINDER.replace(
  "\n\nRules most often missed",
  "\n- This request reads as work the user reviews after stepping away, so route it through figure-it-out.\n\nRules most often missed",
);

const LEDGER_INTRO =
  "Carry these steps verbatim with a state each, as TaskCreate items before other work, or as a list in your reply where no task tool exists. A step you do not run keeps its line with `skip: <reason>`.";
const BUG_FIX = `# pstack step ledger: Bug fix

${LEDGER_INTRO}

${real.playbooks["bug-fix"].steps.map((s) => s.line).join("\n")}
`;

const prompt = (text) => ({ type: "user", message: { role: "user", content: text } });
const slash = (args) => prompt(`<command-message>poteto-mode</command-message>\n<command-name>/poteto-mode</command-name>\n<command-args>${args}</command-args>`);
const tool = (id, name, input, result = "ok", error = false) => [
  { type: "assistant", message: { model: "claude-opus-5-5", content: [{ type: "tool_use", id, name, input }] } },
  { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: result, ...(error ? { is_error: true } : {}) }] } },
];
const read = (id, file) => tool(id, "Read", { file_path: file });
// A session that already met its one-shot route ask, so a test sees only the ask it names.
const ROUTE_MET = tool("r0", "Bash", { command: "ls" }, "PreToolUse:Bash hook error: poteto-mode routes every task through a playbook. [pstack:route:37a0025a]", true);
const reply = (text) => ({ type: "assistant", message: { model: "claude-opus-5-5", stop_reason: "end_turn", content: [{ type: "text", text }] } });

function transcript(records, dir = fs.mkdtempSync(path.join(os.tmpdir(), "pstack-hook-"))) {
  const file = path.join(dir, "session.jsonl");
  fs.writeFileSync(file, records.flat().map((r) => JSON.stringify(r)).join("\n") + "\n");
  return file;
}

const SUBAGENT_ONLY_MESSAGE = "Your parent receives only this final message, so reply again with your complete final report, with the findings fixed and no mention of this gate.";
const LONG_DASH_BLOCK = (id, closing, line = "Fixed [U+2014] mostly.") => ({
  kind: "block",
  reason: `pstack gate. Before you stop:\n- The reply contains the long dash (U+2014), first in "${line}". Rewrite those sentences without it. [pstack:long-dash:${id}]\nThe gate names each finding once.\n${closing}`,
});
test("SessionStart context stays under the 2 KB preview and carries the model table without its comment lines", () => {
  const out = respond({ event: "SessionStart", transcript: "C:\\Users\\me\\.claude\\projects\\C--repo\\s.jsonl" }, deps());
  assert.ok(Buffer.byteLength(out.text) < 2000, `${Buffer.byteLength(out.text)} bytes`);
  assert.equal(out.text.split("\n")[2], "pstack skills directory (`<skills>` below): `C:/Users/me/.claude/skills`");
  assert.match(out.text.split("\n")[3], /^Transcript directory for this workspace: `C:\/Users\/me\/\.claude\/projects\/C--repo` \(/);
  assert.ok(out.text.endsWith("## Model configuration (from `C:/Users/me/.claude/pstack-models.md`)\n\nfeature, refactoring: opus\nhow explorer: sonnet\n"));
});

test("a judge set below the parent in the live table ends the context with a flag, and a clean table adds nothing", () => {
  const context = (text) => respond({ event: "SessionStart", transcript: null }, deps({ models: () => ({ path: "C:/Users/me/.claude/pstack-models.md", text }) })).text;
  assert.ok(
    context("feature, refactoring: sonnet\narena cross-judge pool: inherit-parent, sonnet\n").endsWith(
      "arena cross-judge pool: inherit-parent, sonnet\n\n`arena cross-judge pool: sonnet` is below the judge floor. Spawn that judge with model omitted.\n",
    ),
  );
  assert.ok(context("feature, refactoring: sonnet\narena cross-judge pool: inherit-parent\n").endsWith("\n\nfeature, refactoring: sonnet\narena cross-judge pool: inherit-parent\n"));
});

test("the transcript directory comes out right for a Windows and a POSIX transcript path on any OS", () => {
  const dir = (transcriptPath) => respond({ event: "SessionStart", transcript: transcriptPath }, deps()).text.split("\n")[3].match(/`([^`]*)`/)[1];
  assert.deepEqual(
    [dir("C:\\Users\\me\\.claude\\projects\\C--repo\\s.jsonl"), dir("/home/me/.claude/projects/-home-me-repo/s.jsonl"), dir(null)],
    ["C:/Users/me/.claude/projects/C--repo", "/home/me/.claude/projects/-home-me-repo", "~/.claude/projects/<slug>/"],
  );
});

test("SubagentStart appends the mode reminder for poteto-agent and pstack-reader only", () => {
  const context = respond({ event: "SessionStart", transcript: null }, deps()).text;
  const start = (agentType) => respond({ event: "SubagentStart", transcript: null, agentType }, deps()).text;
  assert.deepEqual(
    [start("poteto-agent"), start("pstack-reader"), start("general-purpose")],
    [`${context}\n${REMINDER}`, `${context}\n${REMINDER}`, context],
  );
});

test("the reminder comes with the prompt that enters the mode, stays on, and stops after /poteto-mode off", () => {
  const ups = (records, text) => respond({ event: "UserPromptSubmit", transcript: transcript(records), prompt: text }, deps())?.text ?? null;
  assert.deepEqual(
    [
      ups([prompt("hello")], "fix the cart"),
      ups([prompt("hello")], "/poteto-mode fix the cart"),
      ups([slash("fix the cart"), reply("done")], "now the tests"),
      ups([slash("fix the cart"), reply("done")], "/poteto-mode off"),
      ups([slash("fix the cart"), reply("done"), slash("off"), reply("ok")], "thanks"),
      ups([prompt("hello"), ...read("r1", `${SKILLS}/poteto-mode/SKILL.md`), reply("read")], "go on"),
    ],
    [null, ENTRY_REMINDER, REMINDER, null, null, null],
  );
});

test("the reminder carries the most-missed checklist from the scored sessions in 16 lines", () => {
  const text = respond({ event: "UserPromptSubmit", transcript: transcript([slash("fix the cart"), reply("done")]), prompt: "now the tests" }, deps()).text;
  const lines = text.trimEnd().split("\n");
  assert.deepEqual([MOST_MISSED.filter((l) => !lines.includes(l)), lines.length], [[], 16]);
});

test("a task notification in the mode gets no reminder, while the next real prompt does", () => {
  const records = [slash("climb it"), reply("Waiting on the H1 subagent.")];
  // The UserPromptSubmit payload's prompt when a background agent finishes, measured on 2.1.281.
  const notification =
    "<task-notification>\n<task-id>a78bb3cf71a21f39e</task-id>\n<tool-use-id>toolu_01Pn2ZTveSYyo8kEowac81Bo</tool-use-id>\n<output-file>C:\\Users\\me\\AppData\\Local\\Temp\\claude\\tasks\\a78bb3cf71a21f39e.output</output-file>\n<status>completed</status>\n<summary>Agent \"Echo brief\" completed</summary>\n</task-notification>";
  const ups = (text) => respond({ event: "UserPromptSubmit", transcript: transcript(records), prompt: text }, deps())?.text ?? null;
  assert.deepEqual([ups(notification), ups("how is it going?")], [null, REMINDER]);
});

test("the prompt that enters the mode for step-away work also asks to route it through figure-it-out", () => {
  const ups = (text) => respond({ event: "UserPromptSubmit", transcript: transcript([prompt("hello")]), prompt: text }, deps()).text;
  assert.deepEqual([ups("/poteto-mode fix the cart overnight, I'm going to bed"), ups("/poteto-mode a bounded run on the cart")], [STEP_AWAY_REMINDER, ENTRY_REMINDER]);
});

test("a playbook Read in the mode hands back its numbered step lines as the ledger", () => {
  const post = (records, filePath, agentType = null) =>
    respond(parseEvent({ hook_event_name: "PostToolUse", transcript_path: transcript(records), agent_type: agentType ?? undefined, tool_name: "Read", tool_input: { file_path: filePath } }), deps())?.text ?? null;
  const LEDGER = `# pstack step ledger: Feature

${LEDGER_INTRO}

1. \`how\` over the affected subsystem.
2. Write the throughput checkpoint.
   - **Blocking first steps.** Gates run before fan-out.
3. Verify on the matching surface.
`;
  assert.deepEqual(
    [
      post([slash("x")], PLAYBOOK),
      post([slash("x")], "C:\\Users\\me\\.claude\\skills\\poteto-mode\\playbooks\\feature.md"),
      post([prompt("x")], PLAYBOOK),
      post([prompt("x")], PLAYBOOK, "poteto-agent"),
      post([slash("x")], PLAYBOOK, "general-purpose"),
      post([slash("x")], "C:/src/pstack-for-cc/skills/poteto-mode/playbooks/feature.md"),
      post([slash("x")], `${SKILLS}/how/SKILL.md`),
    ],
    [LEDGER, LEDGER, null, LEDGER, null, null, null],
  );
});

test("a playbook read through the shell in the mode hands back the same ledger, one per playbook the command names", () => {
  const bash = (records, command) =>
    respond(parseEvent({ hook_event_name: "PostToolUse", transcript_path: transcript(records), tool_name: "Bash", tool_input: { command } }), realDeps())?.text ?? null;
  const drive = `cd "C:/Users/me/AppData/Local/Temp/pstack-verify-mode" && ls -la && cat total.js && node total.js 2 3; cat "${SKILLS}/poteto-mode/playbooks/bug-fix.md"`;
  const both = `cat ${SKILLS}/poteto-mode/playbooks/bug-fix.md ${SKILLS}/poteto-mode/playbooks/feature.md`;
  assert.deepEqual(
    [
      bash([slash("x")], drive),
      bash([prompt("x")], drive),
      bash([slash("x")], "cat skills/poteto-mode/playbooks/bug-fix.md"),
      bash([slash("x")], `ls ${SKILLS}/poteto-mode/playbooks`),
      bash([slash("x")], both)?.match(/^# pstack step ledger: .+$/gm),
    ],
    [BUG_FIX, null, null, null, ["# pstack step ledger: Bug fix", "# pstack step ledger: Feature"]],
  );
});

test("an in-mode call is denied once with its tagged ask, and the retry after that deny goes through", () => {
  const edit = { file_path: "C:/src/shop/src/cart.js", old_string: "a", new_string: "b" };
  const pre = (records, id) =>
    respond(parseEvent({ hook_event_name: "PreToolUse", transcript_path: transcript(records), tool_name: "Edit", tool_input: edit, tool_use_id: id }), realDeps());
  const call = (id) => ({ type: "assistant", message: { model: "claude-opus-5-5", content: [{ type: "tool_use", id, name: "Edit", input: edit }] } });
  const first = pre([slash("fix the cart"), ROUTE_MET, call("e1")], "e1");
  const refused = { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "e1", is_error: true, content: `PreToolUse:Edit hook error: ${first.reason}` }] } };
  const principle = read("p", `${SKILLS}/poteto-mode/principles/model-the-domain.md`);
  assert.deepEqual(
    [
      first.kind,
      first.reason.split("\n")[0],
      pre([slash("fix the cart"), ROUTE_MET, call("e1"), refused, call("e2")], "e2")?.reason.split("\n")[0],
      pre([slash("fix the cart"), ROUTE_MET, principle, call("e1"), refused, call("e2")], "e2"),
      pre([prompt("fix the cart"), call("e1")], "e1"),
    ],
    [
      "deny",
      "Before editing source, write a line `**Shape.** <the data this change touches and how it is organized>` in your reply, then retry this call unchanged. If you already wrote the Shape line this turn, retry unchanged. [pstack:design:c08ec9e0]",
      "Before this edit, read principles/model-the-domain.md in full, then retry this call unchanged. [pstack:design-read:37a0025a]",
      null,
      null,
    ],
  );
});

test("respond reads the repository check from its deps, so the delegate ask follows the injected filesystem", () => {
  const edit = { file_path: "C:/src/shop/src/cart.js", old_string: "a", new_string: "b" };
  const records = [slash("fix the cart"), ...read("p", `${SKILLS}/poteto-mode/playbooks/bug-fix.md`), ...tool("t", "TaskCreate", { subject: "1. Reproduce it." })];
  const pre = (inRepo) =>
    respond(parseEvent({ hook_event_name: "PreToolUse", transcript_path: transcript(records), tool_name: "Edit", tool_input: edit, tool_use_id: "e1" }), { ...realDeps(), fs: { inRepo } })
      .reason.match(/\[pstack:([\w-]+):/)[1];
  assert.deepEqual([pre(() => true), pre(() => false)], ["delegate", "design"]);
});

test("a standing skip waives the asks it names at PreToolUse, and only for the user who wrote it", () => {
  const readme = { file_path: "C:/src/shop/README.md", old_string: "a", new_string: "b" };
  const pre = (user) =>
    respond(
      parseEvent({ hook_event_name: "PreToolUse", transcript_path: transcript([slash("fix the docs"), ROUTE_MET]), cwd: "C:/src/shop", tool_name: "Edit", tool_input: readme, tool_use_id: "e1" }),
      { ...realDeps(), skips: () => ({ user: user === null ? null : { path: "C:/Users/me/.claude/pstack-skips.md", bytes: Buffer.from(user) }, project: null }) },
    )?.kind ?? null;
  assert.deepEqual(
    [pre(null), pre("skip docs-prose: the docs are a changelog.\n"), pre("skip technical-writing: house style.\nskip unslop: house style.\n"), pre("skip ledger: tasks slow me down.\n")],
    ["deny", null, null, "deny"],
  );
});

test("an in-mode Agent call on the wrong model for its playbook is denied before it runs, and one on the right model gets the playbook's steps", () => {
  const opus = deps({ catalog: () => real, models: () => ({ path: "C:/Users/me/.claude/pstack-models.md", text: "bug-fix: opus\n" }) });
  const brief = "Resolution rules: a pstack skill is <skills>/<name>/SKILL.md. Playbook: Bug fix; carry its steps with states.\n\nFix the parser.";
  // The payload Claude Code 2.1 sends for an Agent call, measured with a probe.
  const pre = (records, model, agentType) =>
    respond(
      parseEvent({
        hook_event_name: "PreToolUse",
        transcript_path: transcript(records),
        ...(agentType ? { agent_type: agentType } : {}),
        tool_name: "Agent",
        tool_input: { description: "Fix the parser", prompt: brief, subagent_type: "poteto-agent", model },
        tool_use_id: "toolu_01Jr1Hvu5J5cSBEGbhyTJUKg",
      }),
      opus,
    );
  const deny = {
    kind: "deny",
    reason:
      'The Bug fix delegate "Fix the parser" would run on sonnet, but pstack-models.md sets bug-fix to opus. Spawn Bug fix delegates with model "opus". [pstack:model-role:0f1548ad]\nThe call is refused until it changes, at most 3 times.',
  };
  assert.deepEqual(
    [pre([slash("fix it"), ROUTE_MET], "sonnet"), pre([slash("fix it"), ROUTE_MET], "opus"), pre([prompt("fix it")], "sonnet"), pre([prompt("x")], "sonnet", "general-purpose")],
    [deny, { kind: "rewrite", input: { description: "Fix the parser", prompt: `${brief}\n\n${BUG_FIX}`, subagent_type: "poteto-agent", model: "opus" } }, null, null],
  );
  // No permissionDecision, so the user's own permission rules still decide whether the spawn runs.
  assert.equal(
    serialize({ kind: "rewrite", input: { prompt: "p", subagent_type: "poteto-agent" } }),
    '{"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{"prompt":"p","subagent_type":"poteto-agent"}}}',
  );
});

test("a pstack-reader's write-shaped shell commands are denied, and its reads and other agents' writes pass", () => {
  const pre = (command, agentType = "pstack-reader") =>
    respond(parseEvent({ hook_event_name: "PreToolUse", ...(agentType ? { agent_type: agentType } : {}), tool_name: "Bash", tool_input: { command } }), deps())?.reason ?? null;
  assert.deepEqual(
    ["echo hi > notes.txt", "cat a >> b", "rm -rf build", "git -C repo commit -m x", "sed -i 's/a/b/' f.txt", "mkdir out", "ls | xargs touch", "npm test 2>&1 | tee log"].map((c) => pre(c)),
    [
      "pstack-reader is read-only: a redirect writes a file. Report what you would change instead.",
      "pstack-reader is read-only: a redirect writes a file. Report what you would change instead.",
      "pstack-reader is read-only: `rm` changes files. Report what you would change instead.",
      "pstack-reader is read-only: `git commit` changes the repository. Report what you would change instead.",
      "pstack-reader is read-only: `sed -i` edits files in place. Report what you would change instead.",
      "pstack-reader is read-only: `mkdir` changes files. Report what you would change instead.",
      "pstack-reader is read-only: `touch` changes files. Report what you would change instead.",
      "pstack-reader is read-only: `tee` changes files. Report what you would change instead.",
    ],
  );
  assert.deepEqual(
    ["git -C repo log --oneline -5", "grep -rn 'a > b' src 2>/dev/null", "ls > /dev/null 2>&1", "sed -n 1,20p f.txt", "git status --short", "git branch -a"].map((c) => pre(c)),
    [null, null, null, null, null, null],
  );
  assert.deepEqual([pre("rm -rf build", "general-purpose"), pre("rm -rf build", null)], [null, null]);
});

test("a poteto-agent call whose payload names no agent id goes through, since its transcript cannot be read back", () => {
  const main = transcript([slash("x")]);
  const agent = path.join(path.dirname(main), "session", "subagents", "agent-a1.jsonl");
  fs.mkdirSync(path.dirname(agent), { recursive: true });
  fs.writeFileSync(agent, `${JSON.stringify(prompt("Fix the docs."))}\n`);
  const pre = (extra) =>
    respond(
      parseEvent({ hook_event_name: "PreToolUse", agent_type: "poteto-agent", transcript_path: main, tool_name: "Edit", tool_input: { file_path: "C:/src/shop/README.md" }, tool_use_id: "e1", ...extra }),
      realDeps(),
    );
  assert.deepEqual([pre({}), pre({ agent_id: "a1" })?.kind], [null, "deny"]);
});

test("any agent's write into a standing-skips file is refused, in the mode or out of it, and a read of one is not", () => {
  const pre = (name, input) => respond(parseEvent({ hook_event_name: "PreToolUse", tool_name: name, tool_input: input }), deps())?.reason.split(".")[0] ?? null;
  assert.deepEqual(
    [
      pre("Write", { file_path: "C:\\Users\\me\\.claude\\PSTACK-SKIPS.md", content: "skip ledger: x" }),
      pre("Bash", { command: "echo 'skip ledger: x' >> ~/.claude/pstack-skips.md" }),
      pre("Bash", { command: "cp notes.md .claude/pstack-skips.md" }),
      pre("Bash", { command: "cat ~/.claude/pstack-skips.md" }),
      pre("Edit", { file_path: "C:/src/shop/notes.md", old_string: "a", new_string: "b" }),
    ],
    ["Standing skips are the user's to write", "Standing skips are the user's to write", "Standing skips are the user's to write", null, null],
  );
});

test("SubagentStop gates a poteto-agent on its own transcript, and its reason says the parent sees only the final message", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pstack-hook-"));
  const sub = path.join(dir, "agent-a1.jsonl");
  fs.writeFileSync(sub, [prompt("tidy"), ...read("x", `${SKILLS}/how/SKILL.md`), reply("Tidied \u2014 done.")].map((r) => JSON.stringify(r)).join("\n") + "\n");
  fs.writeFileSync(path.join(dir, "agent-a1.meta.json"), JSON.stringify({ agentType: "poteto-agent", toolUseId: "toolu_A1" }));
  const subStop = (agentType) => respond({ event: "SubagentStop", transcript: sub, agentType, backgroundTasks: null }, deps());
  assert.deepEqual([subStop("poteto-agent"), subStop("general-purpose")], [LONG_DASH_BLOCK("c08ec9e0", SUBAGENT_ONLY_MESSAGE, "Tidied [U+2014] done."), null]);
  fs.writeFileSync(path.join(dir, "agent-a1.meta.json"), JSON.stringify({ agentType: "general-purpose", toolUseId: "toolu_A1" }));
  assert.equal(subStop("poteto-agent"), null);
});

test("Stop blocks with the main session's closing, logs instead of blocking under PSTACK_GATE=observe, and stays out of the way when off", () => {
  const records = [slash("tidy"), ...read("x", `${SKILLS}/how/SKILL.md`), ...read("u", `${SKILLS}/unslop/SKILL.md`), reply("Route: Feature playbook. Tidied \u2014 done.")];
  const at = (gate) => respond({ event: "Stop", transcript: transcript(records), backgroundTasks: null }, deps({ gate, catalog: () => real }));
  const block = LONG_DASH_BLOCK("c08ec9e0", "Then reply again with your complete final answer, with the findings fixed and no mention of this gate.", "Route: Feature playbook. Tidied [U+2014] done.");
  assert.deepEqual([at("enforce"), at("observe"), at("off")], [block, { ...block, kind: "observe" }, null]);
});
const USER_SKIPS = "C:/Users/me/.claude/pstack-skips.md";
const PROJECT_SKIPS = "C:/src/shop/.claude/pstack-skips.md";
const skipsFiles =
  (user, project = null) =>
  (cwd) => ({
    user: user === null ? null : { path: USER_SKIPS, bytes: Buffer.from(user) },
    project: project === null || cwd !== "C:/src/shop" ? null : { path: PROJECT_SKIPS, bytes: Buffer.from(project) },
  });
const NO_SKIPS = skipsFiles(null);
const UNTRUSTED_HASH = "879f90185bfa0d40e6d1268be7c80abc07bc64ca536ea2d5c554fd272ebea61c";
const STANDING_BODY = [
  "Active in every mode span, by name alone:",
  "- `skip technical-writing: commit messages follow COMMITS.md.` from `C:/Users/me/.claude/pstack-skips.md`",
  "Ignored, since a standing skip may waive only technical-writing, unslop, docs-prose, pr-prose and pr-draft:",
  "- `skip ledger:` from `C:/Users/me/.claude/pstack-skips.md`",
  "Not trusted, so none of its lines count:",
  `- \`C:/src/shop/.claude/pstack-skips.md\`. To trust this version, add this line to \`~/.claude/pstack-skips.md\`: \`trust C:/src/shop ${UNTRUSTED_HASH}\``,
  "",
].join("\n");

test("SessionStart shows the user and the model the active, ignored and untrusted standing skips, and a subagent sees only the context", () => {
  const skips = skipsFiles("# Mine\nskip technical-writing: commit messages follow COMMITS.md.\nskip ledger: tasks slow me down.\n", "skip unslop: one line.\n");
  const start = respond(parseEvent({ hook_event_name: "SessionStart", cwd: "C:/src/shop" }), deps({ skips }));
  const sub = respond(parseEvent({ hook_event_name: "SubagentStart", agent_type: "general-purpose", cwd: "C:/src/shop" }), deps({ skips }));
  const section = (text) => text.slice(text.indexOf("## Standing skips"), text.indexOf("## Model configuration"));
  const wire = JSON.parse(serialize(start));
  assert.deepEqual(
    [start.notice, section(start.text), Object.keys(wire), wire.hookSpecificOutput.additionalContext === start.text, sub.notice, section(sub.text), "systemMessage" in JSON.parse(serialize(sub))],
    [`pstack standing skips\n${STANDING_BODY}`, `## Standing skips\n\n${STANDING_BODY}\n`, ["systemMessage", "hookSpecificOutput"], true, undefined, `## Standing skips\n\n${STANDING_BODY}\n`, false],
  );
});

test("SessionStart with no standing skips gives no message, and the context says none is active", () => {
  const start = respond(parseEvent({ hook_event_name: "SessionStart", cwd: "C:/src/shop" }), deps({ skips: NO_SKIPS }));
  assert.deepEqual(
    [start.notice, start.text.slice(start.text.indexOf("## Standing skips"), start.text.indexOf("## Model configuration")), Object.keys(JSON.parse(serialize(start)))],
    [undefined, "## Standing skips\n\nNone. The user's `~/.claude/pstack-skips.md` and the project's `.claude/pstack-skips.md` hold none.\n\n", ["hookSpecificOutput"]],
  );
});

test("a project's standing-skips file counts once the user trusts its root and hash, however the root is spelled", () => {
  const PROJECT = "skip unslop: one line.\n";
  const activeFrom = (user) =>
    respond(parseEvent({ hook_event_name: "SessionStart", cwd: "C:\\src\\shop" }), deps({ skips: (cwd) => skipsFiles(user, PROJECT)(cwd.replaceAll("\\", "/")) })).notice.split("\n")[1];
  const ACTIVE = "Active in every mode span, by name alone:";
  const UNTRUSTED = "Not trusted, so none of its lines count:";
  assert.deepEqual(
    [
      `trust C:/src/shop ${UNTRUSTED_HASH}\n`,
      `trust /c/src/shop/ ${UNTRUSTED_HASH}\n`,
      `trust c:\\src\\shop ${UNTRUSTED_HASH.toUpperCase()}\n`,
      `trust C:/src/shop ${"0".repeat(64)}\n`,
      `trust C:/src/other ${UNTRUSTED_HASH}\n`,
    ].map((user) => respond(parseEvent({ hook_event_name: "SessionStart", cwd: "C:/src/shop" }), deps({ skips: skipsFiles(user, PROJECT) })).notice.split("\n")[1]),
    [ACTIVE, ACTIVE, ACTIVE, UNTRUSTED, UNTRUSTED],
  );
  assert.equal(activeFrom(`trust C:/src/shop ${UNTRUSTED_HASH}\n`), ACTIVE);
});
test("each output serializes to the shape Claude Code reads", () => {
  assert.deepEqual(
    [
      serialize({ kind: "context", event: "UserPromptSubmit", text: "x" }),
      serialize({ kind: "block", reason: "r" }),
      serialize({ kind: "deny", reason: "d" }),
      serialize({ kind: "observe", reason: "r" }),
    ],
    [
      '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"x"}}',
      '{"decision":"block","reason":"r"}',
      '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"d"}}',
      "",
    ],
  );
});

test("a hook that throws exits 0 with empty stdout and logs one line", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pstack-home-"));
  const notAFile = fs.mkdtempSync(path.join(os.tmpdir(), "pstack-dir-"));
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ hook_event_name: "Stop", transcript_path: notAFile, stop_hook_active: false, last_assistant_message: "x" }),
    encoding: "utf8",
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
  const log = fs.readFileSync(path.join(home, ".claude", "pstack", "hook-errors.log"), "utf8").trim().split("\n");
  assert.deepEqual([r.status, r.stdout, log.length, log[0].split(" ")[1]], [0, "", 1, "Stop"]);
  assert.match(log[0], /EISDIR/);
});

test("the script answers a real payload on stdout", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pstack-home-"));
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "/poteto-mode build it" }),
    encoding: "utf8",
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.additionalContext.split("\n")[0], "# pstack reminders");
});

test("a run over the hook budget still answers and logs one line naming the event, its elapsed ms and the transcript", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pstack-home-"));
  const transcriptPath = path.join(home, "s.jsonl");
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "/poteto-mode build it", transcript_path: transcriptPath }),
    encoding: "utf8",
    env: { ...process.env, HOME: home, USERPROFILE: home, PSTACK_HOOK_BUDGET_MS: "0" },
  });
  const logFile = path.join(home, ".claude", "pstack", "hook-errors.log");
  const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8").trim().split("\n") : [];
  const shape = log.map((l) => l.replace(/^\S+ /, "").replace(/: \d+ ms on /, ": N ms on "));
  assert.deepEqual(
    [r.status, JSON.parse(r.stdout).hookSpecificOutput.additionalContext.split("\n")[0], shape],
    [0, "# pstack reminders", [`UserPromptSubmit over budget: N ms on ${transcriptPath}`]],
  );
});

test("the first prompt of a session, before its transcript exists, passes without an error", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pstack-home-"));
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "hello", transcript_path: path.join(home, "not-yet.jsonl") }),
    encoding: "utf8",
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
  assert.deepEqual([r.status, r.stdout, fs.existsSync(path.join(home, ".claude", "pstack", "hook-errors.log"))], [0, "", false]);
});

test("the script finds its own model table when the home has no ~/.claude at all", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pstack-home-"));
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ hook_event_name: "SessionStart" }),
    encoding: "utf8",
    env: { ...process.env, HOME: home, USERPROFILE: home, PSTACK_MODELS_FILE: "" },
  });
  assert.equal(r.status, 0, r.stderr);
  const context = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
  assert.match(context, /Model configuration \(from `.+poteto-mode\/pstack-models\.md`\)\n\nfeature, refactoring: sonnet\n/);
});
test("the hook keeps the mode marker in step with the transcript and removes it when the session ends", () => {
  const marks = [];
  const d = { ...realDeps(), mark: (sid, on) => marks.push([sid, on]) };
  const ev = (raw) => respond(parseEvent({ session_id: "s1", ...raw }), d);
  ev({ hook_event_name: "UserPromptSubmit", prompt: "/poteto-mode fix the cart", transcript_path: transcript([prompt("hello")]) });
  ev({ hook_event_name: "UserPromptSubmit", prompt: "/poteto-mode off", transcript_path: transcript([slash("fix the cart"), reply("done")]) });
  ev({ hook_event_name: "SessionStart", transcript_path: transcript([slash("fix the cart"), reply("done")]) });
  ev({ hook_event_name: "PreToolUse", transcript_path: transcript([prompt("hello")]), tool_name: "Bash", tool_input: { command: "ls" }, tool_use_id: "b1" });
  ev({ hook_event_name: "PreToolUse", agent_type: "general-purpose", transcript_path: transcript([prompt("hello")]), tool_name: "Bash", tool_input: { command: "ls" }, tool_use_id: "b1" });
  ev({ hook_event_name: "SessionEnd", transcript_path: transcript([slash("fix the cart")]) });
  assert.deepEqual(marks, [
    ["s1", true],
    ["s1", false],
    ["s1", true],
    ["s1", false],
    ["s1", false],
  ]);
});

test("the script writes the marker file for an in-mode prompt and deletes it at SessionEnd", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pstack-home-"));
  const run = (payload) => spawnSync(process.execPath, [HOOK], { input: JSON.stringify(payload), encoding: "utf8", env: { ...process.env, HOME: home, USERPROFILE: home } });
  const marker = path.join(home, ".claude", "pstack", "live", "sess-9");
  run({ hook_event_name: "UserPromptSubmit", session_id: "sess-9", prompt: "/poteto-mode build it" });
  const during = fs.existsSync(marker);
  run({ hook_event_name: "SessionEnd", session_id: "sess-9" });
  assert.deepEqual([during, fs.existsSync(marker)], [true, false]);
});

test("the sourced prefilter passes a payload to node only for a marked session, a poteto-agent or reader, a playbook read, or a standing-skips file", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "pstack-home-"));
  fs.mkdirSync(path.join(home, ".claude", "pstack", "live"), { recursive: true });
  fs.writeFileSync(path.join(home, ".claude", "pstack", "live", "marked"), "");
  const passes = (payload) =>
    spawnSync("bash", ["-c", `. ./in-mode.sh; printf 'passed:%s' "$input"`], { cwd: import.meta.dirname, input: payload, encoding: "utf8", env: { ...process.env, HOME: home } }).stdout;
  assert.deepEqual(
    [
      '{"session_id":"marked","hook_event_name":"PreToolUse"}',
      '{"session_id": "marked", "hook_event_name": "PreToolUse"}',
      '{"session_id":"other","hook_event_name":"PreToolUse"}',
      '{"session_id":"other","agent_type":"poteto-agent"}',
      '{"session_id":"other","agent_type": "pstack-reader"}',
      '{"session_id":"other","tool_input":{"command":"cat ~/.claude/skills/poteto-mode/playbooks/bug-fix.md"}}',
      '{"session_id":"other","tool_input":{"file_path":"C:\\\\Users\\\\me\\\\.claude\\\\PSTACK-SKIPS.md"}}',
    ].map(passes),
    [
      'passed:{"session_id":"marked","hook_event_name":"PreToolUse"}',
      'passed:{"session_id": "marked", "hook_event_name": "PreToolUse"}',
      "",
      'passed:{"session_id":"other","agent_type":"poteto-agent"}',
      'passed:{"session_id":"other","agent_type": "pstack-reader"}',
      'passed:{"session_id":"other","tool_input":{"command":"cat ~/.claude/skills/poteto-mode/playbooks/bug-fix.md"}}',
      'passed:{"session_id":"other","tool_input":{"file_path":"C:\\\\Users\\\\me\\\\.claude\\\\PSTACK-SKIPS.md"}}',
    ],
  );
});
