import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { HOOK_BUDGET_MS } from "../skills/poteto-mode/hooks/pstack-hook.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "install.json"), "utf8"));

test("each installed skill is a skill named after its link", () => {
  for (const path of manifest.skills.paths) {
    const skill = join(root, path, "SKILL.md");
    assert.ok(existsSync(skill), `${path} has no SKILL.md`);
    const name = readFileSync(skill, "utf8").match(/^name:\s*(.+?)\s*$/m)?.[1];
    assert.equal(name, basename(path), `${path}/SKILL.md names itself ${name}`);
  }
});

test("each installed agent is a markdown file", () => {
  for (const path of manifest.agents.paths) {
    assert.ok(path.endsWith(".md") && statSync(join(root, path)).isFile(), `${path} is not an agent file`);
  }
});

test("the default install links skills only where Claude Code reads them, and each opt-in directory names who reads it", () => {
  assert.deepEqual(manifest.skills.into, ["~/.claude/skills"]);
  assert.deepEqual(Object.keys(manifest.skills.optIn), ["~/.agents/skills"]);
  for (const [into, reader] of Object.entries(manifest.skills.optIn)) {
    assert.ok(!manifest.skills.into.includes(into), `${into} is linked by default and also opt-in`);
    assert.match(reader, /\S/, `${into} names no reader`);
  }
});

test("no two items claim the same link", () => {
  for (const { paths } of [manifest.skills, manifest.agents]) {
    const names = paths.map((p) => basename(p));
    assert.deepEqual(names.filter((n, i) => names.indexOf(n) !== i), []);
  }
});

// A main session in poteto mode, for the spawn whose model its playbook role refuses.
const IN_MODE = join(mkdtempSync(join(tmpdir(), "install-session-")), "session.jsonl");
writeFileSync(IN_MODE, `${JSON.stringify({ type: "user", message: { role: "user", content: "<command-name>/poteto-mode</command-name>\n<command-args>fix it</command-args>" } })}\n`);

const PAYLOADS = {
  SessionStart: { hook_event_name: "SessionStart" },
  SessionEnd: { hook_event_name: "SessionEnd", session_id: "s1" },
  SubagentStart: { hook_event_name: "SubagentStart", agent_type: "poteto-agent" },
  UserPromptSubmit: { hook_event_name: "UserPromptSubmit", prompt: "/poteto-mode build it" },
  "PreToolUse Bash|PowerShell|Edit|Write|MultiEdit|NotebookEdit|TaskCreate|TaskUpdate|TodoWrite|mcp__.*": { hook_event_name: "PreToolUse", agent_type: "pstack-reader", tool_name: "Bash", tool_input: { command: "rm -rf build" } },
  "PreToolUse Agent|Task": {
    hook_event_name: "PreToolUse",
    transcript_path: IN_MODE,
    tool_use_id: "toolu_S1",
    tool_name: "Agent",
    tool_input: { description: "Fix the parser", subagent_type: "poteto-agent", model: "haiku", prompt: "Playbook: Bug fix; carry its steps with states." },
  },
  "PostToolUse Read": { hook_event_name: "PostToolUse", tool_name: "Read", tool_input: { file_path: "README.md" } },
  "PostToolUse Bash|PowerShell": {
    hook_event_name: "PostToolUse",
    agent_type: "poteto-agent",
    tool_name: "Bash",
    tool_input: { command: "cat ~/.claude/skills/poteto-mode/playbooks/bug-fix.md" },
  },
  Stop: { hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: "done" },
  SubagentStop: { hook_event_name: "SubagentStop", stop_hook_active: false, last_assistant_message: "done" },
};
const CONTEXT = {
  SessionStart: "# pstack session context",
  SubagentStart: "# pstack session context",
  UserPromptSubmit: "# pstack reminders",
  "PreToolUse Bash|PowerShell|Edit|Write|MultiEdit|NotebookEdit|TaskCreate|TaskUpdate|TodoWrite|mcp__.*": "deny",
  "PreToolUse Agent|Task": "deny",
  "PostToolUse Bash|PowerShell": "# pstack step ledger: Bug fix",
};

test("each hook command runs from a shell that leaves paths unconverted", () => {
  // Git Bash expands `~` to `/c/Users/...`. With MSYS_NO_PATHCONV=1 Node gets
  // that path as-is and reads it as `C:\c\Users\...`.
  const ran = [];
  for (const [hookEvent, groups] of Object.entries(manifest.hooks)) {
    for (const { matcher, command } of groups.flatMap((g) => g.hooks.map((h) => ({ matcher: g.matcher, command: h.command })))) {
      const event = `${hookEvent} ${matcher}` in PAYLOADS ? `${hookEvent} ${matcher}` : hookEvent;
      ran.push(event);
      const home = mkdtempSync(join(tmpdir(), "install-home-"));
      for (const path of manifest.skills.paths) cpSync(join(root, path), join(home, ".claude", "skills", basename(path)), { recursive: true });
      const r = spawnSync("bash", ["-c", command], {
        input: JSON.stringify(PAYLOADS[event]),
        encoding: "utf8",
        env: { ...process.env, HOME: home, USERPROFILE: home, MSYS_NO_PATHCONV: "1", PSTACK_MODELS_FILE: "" },
      });
      const errors = join(home, ".claude", "pstack", "hook-errors.log");
      const logged = existsSync(errors) ? readFileSync(errors, "utf8") : "";
      rmSync(home, { recursive: true, force: true });
      assert.equal(r.status, 0, `${event}: ${command} failed: ${r.stderr}`);
      assert.equal(logged, "", `${event} logged an error`);
      const out = r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null;
      assert.equal(out?.additionalContext?.split("\n")[0] ?? out?.permissionDecision ?? null, CONTEXT[event] ?? null, event);
    }
  }
  assert.deepEqual(ran.sort(), Object.keys(PAYLOADS).sort(), "each payload runs through exactly one registered command");
});

// A reader's PreToolUse ran 11611 ms on the loaded verify drive 20260926T062156Z, and Claude Code cancels a hook past its timeout and lets the call through.
const LOADED_RUN_MS = 11611;

test("each hook's timeout is at least twice the PreToolUse run a loaded drive measured, and the over-budget log fires at a third of the shortest one or sooner", () => {
  const timeouts = Object.values(manifest.hooks).flatMap((groups) => groups.flatMap((g) => g.hooks.map((h) => h.timeout * 1000)));
  assert.deepEqual(
    { short: timeouts.filter((t) => t < 2 * LOADED_RUN_MS), logsLate: HOOK_BUDGET_MS > Math.min(...timeouts) / 3 },
    { short: [], logsLate: false },
  );
});

test("each hook command runs a file inside an installed skill", () => {
  const installed = new Map(manifest.skills.paths.map((p) => [basename(p), p]));
  const commands = Object.values(manifest.hooks).flatMap((groups) => groups.flatMap((g) => g.hooks.map((h) => h.command)));
  assert.ok(commands.length > 0, "install.json registers no hook");
  for (const command of commands) {
    const [, skill, path] = command.match(/~\/\.claude\/skills\/([^/]+)\/(\S+)/) ?? [];
    const script = command.match(/\bnode (\S+\.mjs)\b/)?.[1];
    const file = join(root, installed.get(skill) ?? "", path, script ?? "");
    assert.ok(installed.has(skill), `${command} runs from ${skill}, which install.json does not link`);
    assert.ok(existsSync(file) && statSync(file).isFile(), `${command} names a missing file`);
  }
});

test("each tool the hook judges reaches a registered command, and a tool it does not judge reaches none", () => {
  const reaches = (event, tool) => manifest.hooks[event].some((g) => new RegExp(`^(?:${g.matcher})$`).test(tool));
  assert.deepEqual(
    [
      ...["Bash", "PowerShell", "Edit", "Write", "NotebookEdit", "TaskCreate", "TaskUpdate", "TodoWrite", "Agent", "mcp__github__create_pull_request", "Read", "Glob", "Monitor"].map((t) =>
        reaches("PreToolUse", t),
      ),
      ...["Bash", "PowerShell", "Read", "Edit"].map((t) => reaches("PostToolUse", t)),
    ],
    [true, true, true, true, true, true, true, true, true, true, false, false, false, true, true, true, false],
  );
});

const PSTACK = "cd ~/.claude/skills/poteto-mode/hooks && node pstack-hook.mjs";
const escape = (s) => s.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
const lines = (out) => out.trim().split(/\r?\n/);

function freshHome(t) {
  const home = mkdtempSync(join(tmpdir(), "install-home-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const run = (script, args) => spawnSync(process.execPath, [join(root, script), ...args], { encoding: "utf8", env });
  const skills = join(home, ".claude", "skills");
  const agents = join(home, ".claude", "agents");
  return {
    home,
    settings: join(home, ".claude", "settings.json"),
    links: [
      ...manifest.skills.paths.map((p) => ({ repo: join(root, p), at: join(skills, basename(p)) })),
      ...manifest.agents.paths.map((p) => ({ repo: join(root, p), at: join(agents, basename(p)) })),
    ],
    install: (...args) => run("scripts/install.mjs", args),
    doctor: () => run("skills/verify-pstack/scripts/doctor.mjs", []),
  };
}

function tree(dir) {
  if (!existsSync(dir)) return null;
  const out = {};
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = lstatSync(path);
    out[name] = st.isSymbolicLink() ? { link: readlinkSync(path) } : st.isDirectory() ? tree(path) : readFileSync(path, "utf8");
  }
  return out;
}

const backups = (home) => readdirSync(join(home, ".claude")).filter((n) => n.startsWith("settings.json.bak-"));

function doctorOk(h) {
  const d = h.doctor();
  assert.equal(d.status, 0, d.stdout + d.stderr);
  assert.doesNotMatch(d.stdout, /^FAIL/m);
  return d.stdout;
}

test("a fresh install links every item into the repo and registers install.json's hooks and env", (t) => {
  const h = freshHome(t);
  const r = h.install();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const { repo, at } of h.links) assert.equal(realpathSync(at), realpathSync(repo), at);
  assert.deepEqual(JSON.parse(readFileSync(h.settings, "utf8")), { hooks: manifest.hooks, env: manifest.env });
  const poteto = h.links.find(({ at }) => basename(at) === "poteto-mode");
  assert.match(r.stdout, new RegExp(`^link ${escape(poteto.at)} -> ${escape(poteto.repo)} \\((symlink|junction)\\)$`, "m"));
  assert.deepEqual(backups(h.home), []);
  assert.match(doctorOk(h), /^ok {3}agent poteto-agent\.md links into the served checkout$/m);
});

test("a second install changes nothing", (t) => {
  const h = freshHome(t);
  assert.equal(h.install().status, 0);
  const first = readFileSync(h.settings);
  const r = h.install();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(lines(r.stdout), [...h.links.map(({ at }) => `keep ${at}`), `keep ${h.settings}`]);
  assert.deepEqual(readFileSync(h.settings), first);
  assert.deepEqual(backups(h.home), []);
});

test("an install keeps foreign settings in order, appends pstack's groups, and backs up the original bytes", (t) => {
  const h = freshHome(t);
  const pre = { matcher: "Bash", hooks: [{ type: "command", command: "echo foreign" }] };
  const stop = { matcher: "", hooks: [{ type: "command", command: "echo stop" }] };
  const original = JSON.stringify({ permissions: { allow: ["Bash(ls:*)"] }, hooks: { PreToolUse: [pre], Stop: [stop] }, env: { FOREIGN: "1" } }, null, 4);
  mkdirSync(join(h.home, ".claude"));
  writeFileSync(h.settings, original);
  const r = h.install();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const m = manifest.hooks;
  const expected = {
    permissions: { allow: ["Bash(ls:*)"] },
    hooks: {
      PreToolUse: [pre, ...m.PreToolUse],
      Stop: [stop, ...m.Stop],
      SessionStart: m.SessionStart,
      SessionEnd: m.SessionEnd,
      SubagentStart: m.SubagentStart,
      UserPromptSubmit: m.UserPromptSubmit,
      PostToolUse: m.PostToolUse,
      SubagentStop: m.SubagentStop,
    },
    env: { FOREIGN: "1", CLAUDE_CODE_ENABLE_TODO_TOOLS: "1", CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS: "0" },
  };
  assert.equal(readFileSync(h.settings, "utf8"), JSON.stringify(expected, null, 2) + "\n");
  const [backup, ...more] = backups(h.home);
  assert.deepEqual(more, []);
  assert.equal(readFileSync(join(h.home, ".claude", backup), "utf8"), original);
  assert.match(r.stdout, new RegExp(`^back up ${escape(h.settings)} to ${escape(join(h.home, ".claude", backup))}$`, "m"));
});

test("an install replaces the old pstack registrations and keeps a foreign entry that shared their group", (t) => {
  const h = freshHome(t);
  mkdirSync(join(h.home, ".claude"));
  const oldSession = { matcher: "", hooks: [{ type: "command", command: "cd ~/.claude/skills/poteto-mode/hooks && node session-context.mjs" }] };
  const mixed = { matcher: "Bash", hooks: [{ type: "command", command: "echo foreign" }, { type: "command", command: PSTACK, timeout: 5 }] };
  writeFileSync(h.settings, JSON.stringify({ hooks: { SessionStart: [oldSession], PreToolUse: [mixed] } }));
  const r = h.install();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const { hooks } = JSON.parse(readFileSync(h.settings, "utf8"));
  assert.deepEqual(hooks.SessionStart, manifest.hooks.SessionStart);
  assert.deepEqual(hooks.PreToolUse, [{ matcher: "Bash", hooks: [{ type: "command", command: "echo foreign" }] }, ...manifest.hooks.PreToolUse]);
  doctorOk(h);
});

test("a dry run prints the plan and writes nothing", (t) => {
  const h = freshHome(t);
  const r = h.install("--dry-run");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const plan = lines(r.stdout);
  assert.deepEqual(plan.filter((l) => !l.startsWith("would ")), []);
  assert.equal(plan.length, h.links.length + 1);
  assert.equal(plan[0], `would link ${h.links[0].at} -> ${h.links[0].repo} (symlink)`);
  assert.deepEqual(tree(h.home), {});
});

test("--opt-in links the skills into the opt-in directory, and only when asked", (t) => {
  const asked = freshHome(t);
  assert.equal(asked.install("--opt-in", "agents").status, 0);
  for (const p of manifest.skills.paths) assert.equal(realpathSync(join(asked.home, ".agents", "skills", basename(p))), realpathSync(join(root, p)));
  const byKey = freshHome(t);
  assert.equal(byKey.install("--opt-in", "~/.agents/skills").status, 0);
  assert.equal(readdirSync(join(byKey.home, ".agents", "skills")).length, manifest.skills.paths.length);
  const plain = freshHome(t);
  assert.equal(plain.install().status, 0);
  assert.equal(existsSync(join(plain.home, ".agents")), false);
  const bad = plain.install("--opt-in", "nope");
  assert.equal(bad.status, 2);
  assert.equal(bad.stderr.trim(), 'unknown opt-in "nope"; valid: agents (~/.agents/skills)');
});

test("a real directory at a link path is a conflict the install leaves untouched", (t) => {
  const h = freshHome(t);
  const mine = join(h.home, ".claude", "skills", "how");
  mkdirSync(join(mine, "notes"), { recursive: true });
  writeFileSync(join(mine, "SKILL.md"), "mine\n");
  writeFileSync(join(mine, "notes", "a.txt"), "a\n");
  const r = h.install();
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.ok(lines(r.stdout).includes(`conflict ${mine}: a real directory the installer did not make, left untouched`), r.stdout);
  assert.deepEqual(tree(mine), { "SKILL.md": "mine\n", notes: { "a.txt": "a\n" } });
  assert.equal(realpathSync(join(h.home, ".claude", "skills", "why")), realpathSync(join(root, "skills", "why")));
});

test("--copy installs copies, records them, refreshes them on the next run, and doctor accepts them", (t) => {
  const h = freshHome(t);
  const r = h.install("--copy");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const { repo, at } of h.links) {
    assert.equal(lstatSync(at).isSymbolicLink(), false, at);
    const file = statSync(repo).isDirectory() ? "SKILL.md" : "";
    assert.equal(readFileSync(join(at, file), "utf8"), readFileSync(join(repo, file), "utf8"), at);
  }
  const record = JSON.parse(readFileSync(join(h.home, ".claude", "pstack", "install-copies.json"), "utf8"));
  assert.deepEqual(record, h.links.map(({ at }) => at).sort());
  const again = h.install("--copy");
  assert.equal(again.status, 0, again.stdout + again.stderr);
  assert.deepEqual(lines(again.stdout), [...h.links.map(({ at }) => `refresh ${at} (copy)`), `keep ${h.settings}`]);
  assert.match(doctorOk(h), /^ok {3}agent poteto-agent\.md matches the served checkout \(copy\)$/m);
});
