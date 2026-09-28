import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { armById, copyable, ensurePluginSource, extractPluginTree, homeViolations, parseTreeOverrides, planTrees, sealViolations, skillRoots } from "./arms.mjs";

const ALL = ["A", "C", "D", "B", "E", "N"];

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
  assert.throws(() => parseTreeOverrides(["--tree", "N=abc"], ALL), /--tree N: the control runs with no tree/);
});

test("planTrees fills each arm without an override from its default", () => {
  assert.deepEqual(planTrees(ALL, { B: "abc1234" }), { A: "upstream-v0.15.2", C: null, D: "cf5b727", B: "abc1234", E: "c02fd4922b25ee005f42042463d741d236c2c35e", N: null });
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

const traceOf = (...actions) => ({ turns: [{ actions, injected: [] }], children: [] });
const withInjected = (trace, ...injected) => ({ ...trace, children: [{ turns: [{ actions: [], injected }], children: [] }] });
const PORT_CONTEXT = "# pstack session context\n\npstack skills directory: ...";
const PLUGIN_CONTEXT = "<EXTREMELY_IMPORTANT>\nInvoke the `pstack:poteto-mode` skill before any response.\n</EXTREMELY_IMPORTANT>";
const H = "/sb/r/r01/home";
const CACHE = `${H}/.claude/plugins/cache/pstack-claude/pstack/0.9.45/skills`;

test("sealViolations flags a read under a POSIX home, and not one under a sibling that shares its prefix", () => {
  const trace = traceOf({ kind: "read", path: "/home/someone/.ssh/id_rsa" }, { kind: "read", path: "/home/someonex/a" });
  assert.deepEqual(sealViolations(armById.B, trace, "/home/someone"), ["touched the real home: /home/someone/.ssh/id_rsa"]);
});

test("sealViolations flags a Windows home in its drive form and its Git Bash form, in any case", () => {
  const trace = traceOf({ kind: "shell", command: String.raw`cat C:\Users\someone\notes.txt` }, { kind: "shell", command: "ls /c/users/someone/x" }, { kind: "shell", command: "ls /c/users/someone2" });
  assert.deepEqual(sealViolations(armById.B, trace, String.raw`C:\Users\someone`), ["touched the real home: cat C:/Users/someone/notes.txt", "touched the real home: ls /c/users/someone/x"]);
});

test("sealViolations flags an E run that touches this port's install or sees its hook context", () => {
  const trace = traceOf(
    { kind: "read", path: `${CACHE}/poteto-mode/SKILL.md`, doc: "skill:poteto-mode" },
    { kind: "skill", name: "principle-model-the-domain", refused: false, doc: "principle:model-the-domain" },
    { kind: "shell", command: "cat /sb/plugin-src/pstack-claude-c02fd4922b25/README.md" },
    { kind: "read", path: "/sb/trees/3ced788/skills/how/SKILL.md", doc: "skill:how" },
    { kind: "shell", command: `ls ${H}/.claude/skills` },
  );
  assert.deepEqual(sealViolations(armById.E, withInjected(traceOf(...trace.turns[0].actions.slice(0, 3)), PLUGIN_CONTEXT), "/home/someone"), []);
  assert.deepEqual(sealViolations(armById.E, withInjected(trace, PLUGIN_CONTEXT, PORT_CONTEXT), "/home/someone"), [
    "E arm touched the port install: /sb/trees/3ced788/skills/how/SKILL.md",
    `E arm touched the port install: ls ${H}/.claude/skills`,
    "E arm saw the port session context",
  ]);
});

test("sealViolations leaves a project .claude under the run's workspace alone and still flags the home's", () => {
  const ws = String.raw`C:\sb\r\r07\shop-cart`;
  const trace = traceOf(
    { kind: "read", path: "C:/sb/r/r07/shop-cart/.claude/skills/verify/SKILL.md", doc: "skill:verify" },
    { kind: "shell", command: "ls /c/sb/r/r07/Shop-Cart/.claude/skills" },
    { kind: "shell", command: "ls C:/sb/r/r07/shop-cart/.claude/skills && ls C:/sb/r/r07/home/.claude/skills" },
    { kind: "shell", command: "ls C:/sb/r/r07/shop-cart2/.claude/skills" },
  );
  assert.deepEqual(sealViolations(armById.E, trace, "/home/someone", ws), [
    "E arm touched the port install: ls C:/sb/r/r07/shop-cart/.claude/skills && ls C:/sb/r/r07/home/.claude/skills",
    "E arm touched the port install: ls C:/sb/r/r07/shop-cart2/.claude/skills",
  ]);
});

test("sealViolations flags a B run that touches the plugin install or sees its session context", () => {
  const own = [
    { kind: "read", path: `${H}/.claude/skills/poteto-mode/SKILL.md`, doc: "skill:poteto-mode" },
    { kind: "read", path: "/sb/trees/3ced788/skills/how/SKILL.md", doc: "skill:how" },
  ];
  assert.deepEqual(sealViolations(armById.B, withInjected(traceOf(...own), PORT_CONTEXT), "/home/someone"), []);
  const trace = withInjected(traceOf(...own, { kind: "read", path: `${CACHE}/how/SKILL.md`, doc: "skill:how" }), PORT_CONTEXT, PLUGIN_CONTEXT);
  assert.deepEqual(sealViolations(armById.B, trace, "/home/someone"), [`B arm touched the claude-plugin install: ${CACHE}/how/SKILL.md`, "B arm saw the claude-plugin session context"]);
});

test("sealViolations flags an N run that touches either install or loads a pstack skill", () => {
  const clean = [
    { kind: "read", path: "/sb/r/r01/shop-cart/src/cart.js", doc: null },
    { kind: "skill", name: "simplify", refused: false, doc: "skill:simplify" },
    { kind: "skill", name: "why", refused: true, doc: "skill:why" },
  ];
  assert.deepEqual(sealViolations(armById.N, traceOf(...clean), "/home/someone"), []);
  const trace = traceOf(
    ...clean,
    { kind: "skill", name: "principle-model-the-domain", refused: false, doc: "principle:model-the-domain" },
    { kind: "skill", name: "how", refused: false, doc: "skill:how" },
    { kind: "shell", command: `ls ${H}/.claude/plugins` },
    { kind: "read", path: `${H}/.claude/skills/how/SKILL.md`, doc: "skill:how" },
  );
  assert.deepEqual(sealViolations(armById.N, withInjected(trace, PORT_CONTEXT, PLUGIN_CONTEXT), "/home/someone"), [
    "control arm loaded a pstack skill: principle-model-the-domain",
    "control arm loaded a pstack skill: how",
    `N arm touched the claude-plugin install: ls ${H}/.claude/plugins`,
    `N arm touched the port install: ${H}/.claude/skills/how/SKILL.md`,
    `control arm read a pstack document: ${H}/.claude/skills/how/SKILL.md`,
    "N arm saw the port session context",
    "N arm saw the claude-plugin session context",
  ]);
});

const writeJson = (path, v) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(v));
};

/** A home laid out as claudeHome leaves it for the given install. */
function sealedHome(kind) {
  const home = mkdtempSync(join(tmpdir(), `parity-home-${kind}-`));
  const config = join(home, ".claude");
  if (kind === "port") {
    for (const d of ["skills", "agents"]) mkdirSync(join(config, d), { recursive: true });
    writeJson(join(config, "settings.json"), { hooks: { SessionStart: [] } });
  } else if (kind === "claude-plugin") {
    writeJson(join(config, "settings.json"), { enabledPlugins: { "pstack@pstack-claude": true } });
    writeJson(join(config, "plugins", "installed_plugins.json"), {
      version: 2,
      plugins: { "pstack@pstack-claude": [{ installPath: join(config, "plugins", "cache", "pstack-claude", "pstack", "0.9.45") }] },
    });
  } else writeJson(join(config, "settings.json"), {});
  return { home, config };
}

test("homeViolations accepts each sealed home and flags a foreign install", () => {
  const port = sealedHome("port");
  const plugin = sealedHome("claude-plugin");
  const none = sealedHome("none");
  assert.deepEqual(homeViolations(armById.B, port.home), []);
  assert.deepEqual(homeViolations(armById.E, plugin.home), []);
  assert.deepEqual(homeViolations(armById.N, none.home), []);
  assert.deepEqual(homeViolations(armById.A, plugin.home), []);

  writeJson(join(port.config, "plugins", "installed_plugins.json"), { version: 2, plugins: { "pstack@pstack-claude": [] } });
  assert.deepEqual(homeViolations(armById.B, port.home), ["B home has plugins pstack@pstack-claude, expected none"]);

  mkdirSync(join(plugin.config, "skills", "unslop"), { recursive: true });
  writeJson(join(plugin.config, "settings.json"), { hooks: { SessionStart: [] }, enabledPlugins: { "pstack@pstack-claude": true, "x@y": true } });
  assert.deepEqual(homeViolations(armById.E, plugin.home), [
    "E home has .claude/skills",
    "E home settings register hooks",
    "E home has plugins pstack@pstack-claude, x@y, expected pstack@pstack-claude",
  ]);

  writeJson(join(none.config, "agents", "poteto-agent.md"), {});
  writeJson(join(none.config, "settings.json"), { enabledPlugins: { "pstack@pstack-claude": true } });
  assert.deepEqual(homeViolations(armById.N, none.home), ["N home has .claude/agents", "N home has plugins pstack@pstack-claude, expected none"]);
});

test("homeViolations ignores the account skills Claude Code syncs into every home", () => {
  const plugin = sealedHome("claude-plugin");
  const none = sealedHome("none");
  for (const { config } of [plugin, none]) mkdirSync(join(config, "skills", "synced", "org_account", "pdf"), { recursive: true });
  assert.deepEqual(homeViolations(armById.E, plugin.home), []);
  assert.deepEqual(homeViolations(armById.N, none.home), []);

  mkdirSync(join(none.config, "skills", "unslop"));
  assert.deepEqual(homeViolations(armById.N, none.home), ["N home has .claude/skills"]);
});

test("skillRoots names the directories each install shows as <pstack>", () => {
  const { home } = sealedHome("claude-plugin");
  assert.deepEqual(skillRoots(armById.E, "/sb", home), [
    join(home, ".claude", "plugins", "cache", "pstack-claude", "pstack", "0.9.45", "skills"),
    join("/sb", "plugin-src", "pstack-claude-c02fd4922b25", "plugins", "pstack", "skills"),
  ]);
  assert.deepEqual(skillRoots({ ...armById.B, tree: "3ced788" }, "/sb", "/h"), [join("/h", ".claude", "skills"), join("/sb", "trees", "3ced788", "skills")]);
  assert.deepEqual(skillRoots(armById.N, "/sb", "/h"), [join("/h", ".claude", "skills")]);
});

test("the plugin source is cloned once, resolved to a full commit and unpacked at it", () => {
  const origin = mkdtempSync(join(tmpdir(), "parity-origin-"));
  const git = (...a) => execFileSync("git", ["-C", origin, ...a], { encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main");
  writeJson(join(origin, ".claude-plugin", "marketplace.json"), { name: "pstack-claude" });
  git("add", "-A");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "one");
  const sha = git("rev-parse", "HEAD");
  const arm = { ...armById.E, plugin: { ...armById.E.plugin, repo: origin } };
  const sandbox = mkdtempSync(join(tmpdir(), "parity-sb-"));
  assert.equal(ensurePluginSource(sandbox, arm, "main"), sha);
  assert.equal(ensurePluginSource(sandbox, arm, sha.slice(0, 7)), sha);
  const dir = extractPluginTree(sandbox, arm, sha);
  assert.equal(dir, join(sandbox, "plugin-src", `pstack-claude-${sha.slice(0, 12)}`));
  assert.equal(readFileSync(join(dir, ".claude-plugin", "marketplace.json"), "utf8"), '{"name":"pstack-claude"}');
  assert.equal(existsSync(join(sandbox, "sources", "pstack-claude.git", "HEAD")), true);
});
