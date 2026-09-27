// Tests for the pstack port: the skills tree carries no Cursor affordance an
// agent would act on, and the session hook that stands in for Cursor's
// always-on pieces emits what each Claude Code hook event needs.
//
// Every case runs the real script and asserts on what comes back. Nothing
// here reads the source of the thing it is testing.
//
// Run with: node --test home/.agents/skills/poteto-mode/scripts/port.test.js
import { test } from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPTS = import.meta.dirname;
const SKILLS = path.resolve(SCRIPTS, "..", "..");
const HOOK = path.join(SCRIPTS, "..", "hooks", "session-context.mjs");

function run(script, args, input) {
  const r = spawnSync(process.execPath, [script, ...args], { input, encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function hook(event, transcriptPath) {
  const payload = { hook_event_name: event };
  if (transcriptPath) payload.transcript_path = transcriptPath;
  const r = run(HOOK, [], JSON.stringify(payload));
  assert.strictEqual(r.code, 0, r.err);
  return r.out ? JSON.parse(r.out).hookSpecificOutput : null;
}

test("the skills tree carries no Cursor affordance an agent would act on", () => {
  const r = run(path.join(SCRIPTS, "check-port.mjs"), [SKILLS]);
  assert.strictEqual(r.code, 0, r.out);
  assert.match(r.out, /^0 findings$/m);
});

test("the check catches each class it exists for", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "port-check-"));
  const skill = path.join(dir, "sample");
  fs.mkdirSync(skill);
  fs.writeFileSync(path.join(skill, "SKILL.md"), [
    "---",
    'paths: ["**/*.ts"]',
    "---",
    "Open a todolist, then arm a /goal and read git show origin/main:pstack/skills/x.",
    "Spawn with readonly: true and run_in_background: true in agent mode.",
    "Keep it under /tmp. One Cursor cloud agent per PR. Use allow_multiple: true.",
    "This line names xcrun and stays fine because it says macOS.",
    "This one mentions Cursor on purpose. port-check: allow",
    "",
  ].join("\n"));
  const r = run(path.join(SCRIPTS, "check-port.mjs"), [dir]);
  assert.strictEqual(r.code, 1);
  for (const id of ["paths-frontmatter", "todo", "goal", "trunk-reread", "vendored-path", "readonly", "run-in-background", "tmp", "cursor", "cloud-agent", "allow-multiple"]) {
    assert.match(r.out, new RegExp(`sample/SKILL\\.md:\\d+: ${id}:`), `expected the ${id} rule to fire`);
  }
  assert.doesNotMatch(r.out, /SKILL\.md:7:/, "a macOS-labelled line passes the platform rule");
  assert.doesNotMatch(r.out, /SKILL\.md:8:/, "an allow-marked line is skipped");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("SessionStart emits the full pstack context with the skills directory and the model table", () => {
  const out = hook("SessionStart");
  assert.strictEqual(out.hookEventName, "SessionStart");
  assert.match(out.additionalContext, /^# pstack session context/);
  assert.match(out.additionalContext, /pstack skills directory: `.+skills`/);
  assert.match(out.additionalContext, /feature, refactoring: (fable|opus|sonnet|haiku|inherit-parent|auto)/);
});

test("the hook finds its own model table when the home has no ~/.claude at all", () => {
  // A fresh clone and a CI runner both look like this: no symlinks, no
  // pstack-models.md under the home. The table beside the hook must still load.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "port-home-"));
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ hook_event_name: "SessionStart" }),
    encoding: "utf8",
    env: { ...process.env, HOME: home, USERPROFILE: home, PSTACK_MODELS_FILE: "" },
  });
  fs.rmSync(home, { recursive: true, force: true });
  assert.strictEqual(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
  assert.match(out, /Model configuration \(from `.+poteto-mode[\\/]pstack-models\.md`\)/);
  assert.match(out, /feature, refactoring: sonnet/);
});

test("UserPromptSubmit stays silent until the transcript shows poteto mode was entered", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "port-hook-"));
  const quiet = path.join(dir, "quiet.jsonl");
  const live = path.join(dir, "live.jsonl");
  fs.writeFileSync(quiet, '{"type":"user","message":"hello"}\n');
  fs.writeFileSync(live, '{"content":"<command-name>/poteto-mode</command-name>"}\n');

  assert.strictEqual(hook("UserPromptSubmit", quiet), null, "no reminder before the mode is entered");
  const out = hook("UserPromptSubmit", live);
  assert.strictEqual(out.hookEventName, "UserPromptSubmit");
  assert.match(out.additionalContext, /^# pstack reminders/);
  assert.match(out.additionalContext, /step list/);
  fs.rmSync(dir, { recursive: true, force: true });
});
