// Tests for the pstack port: the skills tree carries no Cursor affordance an
// agent would act on.
//
// Every case runs the real script and asserts on what comes back. Nothing
// here reads the source of the thing it is testing.
import { test } from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPTS = import.meta.dirname;

function run(script, args, input, env = {}) {
  const r = spawnSync(process.execPath, [script, ...args], { input, encoding: "utf8", env: { ...process.env, ...env } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function writeTree(dir, files) {
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
}

test("the skills and agents trees carry no Cursor affordance an agent would act on", () => {
  const r = run(path.join(SCRIPTS, "check-port.mjs"), []);
  assert.strictEqual(r.code, 0, r.out);
  assert.match(r.out, /^0 findings$/m);
});

test("the check catches each class it exists for", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "port-check-"));
  const skill = path.join(dir, "tdd");
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
    "- read-only: say so in the prompt",
    "Prefer a judge from a different model family.",
    "Spawn the explainer on fable.",
    "- `model`: your configured how-explainer model (default `fable`)",
    "Use the current diff against the base branch, default `main`.",
    "",
  ].join("\n"));
  fs.writeFileSync(path.join(skill, "pstack-models.md"), [
    "# budget: medium",
    "feature, refactoring: sonnet",
    "reflect judgment, divergent, synthesizer: inherit-parent",
    "arena cross-judge pool: inherit-parent, sonnet",
    "interrogate reviewers: opus, auto",
    "swarm workers: fable",
    "# Opus 5.5 is the top tier; fable is not used.",
    "",
  ].join("\n"));
  const agents = path.join(dir, "agents");
  fs.mkdirSync(agents);
  fs.writeFileSync(path.join(agents, "poteto-agent.md"), "---\nname: poteto-agent\nis_background: true\n---\n");
  fs.mkdirSync(path.join(skill, "fixtures", "repos", "cli"), { recursive: true });
  fs.writeFileSync(path.join(skill, "fixtures", "repos", "cli", "package.json"), '{ "scripts": { "clean": "rm -rf /tmp/cli" } }\n');
  const r = run(path.join(SCRIPTS, "check-port.mjs"), [dir, agents]);
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /^tdd\/pstack-models\.md:4: judge-floor: arena cross-judge pool lists sonnet; /m, "expected the judge-floor rule to fire on a sonnet judge");
  assert.doesNotMatch(r.out, /pstack-models\.md:[1235]:/, "a code role on sonnet and judges on inherit-parent, auto or opus pass the judge floor");
  assert.doesNotMatch(r.out, /pstack-models\.md:7:/, "a header comment that names fable fires nothing");
  assert.match(r.out, /^tdd\/pstack-models\.md:6: model-default:/m, "expected the model-default rule to fire on a fable value in the model table");
  assert.match(r.out, /^tdd\/SKILL\.md:12: model-default:/m, "expected the model-default rule to fire on a fable skill default");
  assert.doesNotMatch(r.out, /SKILL\.md:1[13]:/, "prose that names fable and a default that is no model fire nothing");
  for (const id of ["paths-frontmatter", "todo", "goal", "trunk-reread", "vendored-path", "readonly", "run-in-background", "tmp", "cursor", "cloud-agent", "allow-multiple", "reader-spawn", "model-family"]) {
    assert.match(r.out, new RegExp(`tdd/SKILL\\.md:\\d+: ${id}:`), `expected the ${id} rule to fire`);
  }
  assert.match(r.out, /^poteto-agent\.md:3: is-background:/m, "expected the is-background rule to fire on an agent");
  assert.doesNotMatch(r.out, /SKILL\.md:7:/, "a macOS-labelled line passes the platform rule");
  assert.doesNotMatch(r.out, /SKILL\.md:8:/, "an allow-marked line is skipped");
  assert.doesNotMatch(r.out, /fixtures\/repos\//, "a public-repo snapshot is another project's text and is skipped");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the check reads only the skill directories and agent files install.json lists, and everything under a listed skill", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "port-check-"));
  const line = "Open a Cursor cloud agent.\n";
  writeTree(dir, {
    "skills/tdd/SKILL.md": line,
    "skills/tdd/fixtures/skills/other/SKILL.md": line,
    "skills/api-design/SKILL.md": line,
    "skills/api-design/notes.md": line,
    "skills/synced/abc/docs/SKILL.md": line,
    "skills/synced/abc/docs/reference.md": line,
    "skills/synced/abc/manifest.json": line,
    "agents/poteto-agent.md": "---\nis_background: true\n---\n",
    "agents/database-reviewer.md": "---\nis_background: true\n---\n",
  });
  const r = run(path.join(SCRIPTS, "check-port.mjs"), [path.join(dir, "skills"), path.join(dir, "agents")]);
  fs.rmSync(dir, { recursive: true, force: true });
  assert.deepEqual([...new Set(r.out.split(/\r?\n/).filter((l) => l.includes(": ")).map((l) => l.split(":")[0]))], [
    "poteto-agent.md",
    "tdd/SKILL.md",
    "tdd/fixtures/skills/other/SKILL.md",
  ]);
});

test("the check flags an owner's project term in any file, tests and fixtures included, from a terms file kept out of the repo", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "port-check-"));
  const terms = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "port-terms-")), "terms.txt");
  fs.writeFileSync(terms, "# the owner's tools\nwidgetd\nacmepool\nwd-\\S+\nwd_[a-z][\\w-]*\nacme-bench\nx9[a-z]?\ncrewbot\nboss\\.md\n");
  writeTree(dir, {
    "tdd/SKILL.md": "Drive the pane with widgetd when it is installed.\nPrune the acmepool pool.\n",
    "tdd/scripts/run.js": "const home = '~/widgetd';\n",
    "tdd/scripts/watch": "#!/bin/sh\nexec wd-spawn \"$@\"\n",
    "verify-pstack/features/gate.md": "The oracle replays the x9d transcript.\n",
    "tdd/scripts/run.test.js": "const pane = 'widgetd';\n",
    "tdd/fixtures/session.jsonl": '{"cwd":"C:/src/acme-bench"}\n',
    "tdd/notes.md": "The widgetd name stays here on purpose. port-check: allow\n",
    "tdd/pins.md": "Pinned at a91x9c, beside the configwidgetds flag.\n",
    "tdd/fixtures/env.jsonl": [
      '{"text":"Widgetd runs the panes."}',
      '{"pane":"widgetd_pane_id"}',
      '{"env":"WD_TRACE_DIR=/x"}',
      '{"cmd":"wd_lock_try_create"}',
      '{"file":"data/boss.md"}',
      '{"text":"the crewbot replies"}',
      '{"text":"the boss decides, and the WDCG report stays"}',
      '{"cmd":"ls bin/wd-*.sh; echo wd-${id}"}',
    ].join("\n"),
  });
  const r = run(path.join(SCRIPTS, "check-port.mjs"), [dir], undefined, { PORT_CHECK_TERMS: terms });
  const off = run(path.join(SCRIPTS, "check-port.mjs"), [dir], undefined, { PORT_CHECK_TERMS: path.join(dir, "absent.txt") });
  assert.doesNotMatch(off.out, /project-term/, "with no terms file the rule is off");
  assert.strictEqual(r.code, 1);
  assert.doesNotMatch(r.out, /pins\.md/, "a term inside a longer word is not the term");
  assert.deepStrictEqual(
    r.out.split(/\r?\n/).filter((l) => l.includes("project-term")).map((l) => l.split(": ")[0]),
    [
      "tdd/SKILL.md:1",
      "tdd/SKILL.md:2",
      "tdd/fixtures/env.jsonl:1",
      "tdd/fixtures/env.jsonl:2",
      "tdd/fixtures/env.jsonl:3",
      "tdd/fixtures/env.jsonl:4",
      "tdd/fixtures/env.jsonl:5",
      "tdd/fixtures/env.jsonl:6",
      "tdd/fixtures/env.jsonl:8",
      "tdd/fixtures/session.jsonl:1",
      "tdd/scripts/run.js:1",
      "tdd/scripts/run.test.js:1",
      "tdd/scripts/watch:2",
      "verify-pstack/features/gate.md:1",
    ],
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

function hitsOf(id, files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "port-check-"));
  writeTree(dir, files);
  const r = run(path.join(SCRIPTS, "check-port.mjs"), [dir]);
  fs.rmSync(dir, { recursive: true, force: true });
  return r.out.split(/\r?\n/).filter((l) => l.includes(`: ${id}: `)).map((l) => l.split(": ")[0]);
}

test("the check flags an absolute home path in any file, and passes a placeholder segment and the user me in a test or fixture", () => {
  const skill = [
    "Read C:/Users/someone/notes.md first.", // port-check: allow
    "Or C:\\Users\\someone\\notes.md on Windows.", // port-check: allow
    "Or d:\\\\Users\\\\someone\\\\notes.md escaped in a string.",
    "Or /c/Users/someone/notes.md from Git Bash.", // port-check: allow
    "Or /Users/someone/notes.md on macOS.", // port-check: allow
    "Or /home/someone/notes.md on Linux.", // port-check: allow
    "The skills sit at C:/Users/<name>/.claude/skills.",
    "The docs sit at example.com/home/page/ on the web.",
  ].join("\n");
  const tests = {
    "tdd/scripts/run.test.js": "const home = 'C:/Users/me/x';\nconst other = 'C:/Users/someone/x';\n", // port-check: allow
    "tdd/fixtures/session.jsonl": '{"cwd":"C:\\\\Users\\\\me\\\\x"}\n{"cwd":"C:\\\\Users\\\\someone\\\\x"}\n',
    "tdd/notes.md": "Read C:/Users/me/notes.md first.\n",
  };
  assert.deepEqual(hitsOf("home-path", { "tdd/SKILL.md": skill, ...tests }), [
    "tdd/SKILL.md:1",
    "tdd/SKILL.md:2",
    "tdd/SKILL.md:3",
    "tdd/SKILL.md:4",
    "tdd/SKILL.md:5",
    "tdd/SKILL.md:6",
    "tdd/fixtures/session.jsonl:2",
    "tdd/notes.md:1",
    "tdd/scripts/run.test.js:2",
  ]);
});

test("the check flags a file under ~/ outside ~/.claude in a shipped file", () => {
  const skill = [
    "Read ~/COMMITS.md before a commit.",
    "The skills sit at `~/.claude/skills/`.",
    "The config is `~/.claude`.",
    "A path under `~/` resolves against the home directory.",
  ].join("\n");
  assert.deepEqual(hitsOf("home-ref", { "tdd/SKILL.md": skill }), ["tdd/SKILL.md:1"]);
});

test("the check flags a start-anchored command-word regex in hook code, outside kinds.mjs and tests", () => {
  const code = [
    "const TERMINAL_TOOL = /^(tmux|screen|zellij)\\b/;",
    "const SHELL = /^(ba|z)?sh$/;",
    "const OPTION = /^(-b|--branch|-o)$/;",
    "const WRITER = /^(?:echo|printf|write-output)$/i;",
  ].join("\n");
  assert.deepEqual(
    hitsOf("command-regex", {
      "tdd/hooks/gate.mjs": code,
      "tdd/hooks/kinds.mjs": code,
      "tdd/hooks/gate.test.js": code,
      "tdd/scripts/tool.mjs": code,
    }),
    ["tdd/hooks/gate.mjs:1", "tdd/hooks/gate.mjs:4"],
  );
});
