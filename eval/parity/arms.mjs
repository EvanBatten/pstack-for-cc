import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @typedef {"cursor-plugin" | "port" | "claude-plugin" | "none"} InstallKind
 * @typedef {{ repo: string, marketplace: string, name: string, dir: string }} PluginSource
 * @typedef {{
 *   id: "A" | "B" | "C" | "D" | "E" | "N",
 *   role: "reference" | "control" | "treatment",
 *   harness: "cursor" | "claude",
 *   install: InstallKind,
 *   tree: string | null,
 *   plugin?: PluginSource,
 *   note: string,
 * }} Arm
 * @typedef {null | { kind: "port", tree: string } | { kind: "claude-plugin", src: string, arm: Arm }} ClaudeInstall
 */

/** @type {Arm[]} */
export const ARMS = [
  { id: "A", role: "reference", harness: "cursor", install: "cursor-plugin", tree: "upstream-v0.15.2", note: "cursor-agent, upstream pstack v0.15.2 via --plugin-dir" },
  { id: "C", role: "control", harness: "cursor", install: "none", tree: null, note: "cursor-agent, no pstack" },
  { id: "D", role: "treatment", harness: "claude", install: "port", tree: "cf5b727", note: "claude -p, the port at that tree with its three-event hook" },
  {
    id: "B",
    role: "treatment",
    harness: "claude",
    install: "port",
    tree: "3ced788",
    note: "claude -p, the port at that tree with the hooks and env its install.json registers and the agents under its agents/",
  },
  {
    id: "E",
    role: "treatment",
    harness: "claude",
    install: "claude-plugin",
    tree: "c02fd4922b25ee005f42042463d741d236c2c35e",
    plugin: { repo: "https://github.com/michael-denyer/pstack-claude.git", marketplace: "pstack-claude", name: "pstack", dir: "plugins/pstack" },
    note: "claude -p, michael-denyer/pstack-claude at that commit, installed as its Claude Code plugin with the SessionStart hook the plugin registers",
  },
  { id: "N", role: "control", harness: "claude", install: "none", tree: null, note: "claude -p, no pstack" },
];

export const armById = Object.fromEntries(ARMS.map((a) => [a.id, a]));

/** @typedef {Record<string, string | null>} Trees */

// A plan.json written before plans recorded trees ran at these.
export const LEGACY_TREES = Object.freeze({ A: "upstream-v0.15.2", C: null, D: "cf5b727", B: "3970322" });

/** @param {string[]} argv @param {string[]} armIds @returns {Record<string, string>} */
export function parseTreeOverrides(argv, armIds) {
  const out = {};
  argv.forEach((a, i) => {
    if (a !== "--tree") return;
    const m = /^([^=]+)=(.+)$/.exec(argv[i + 1] ?? "");
    if (!m) throw new Error(`--tree takes ID=ref, got ${JSON.stringify(argv[i + 1] ?? "")}`);
    const [, id, ref] = m;
    if (!armIds.includes(id)) throw new Error(`--tree ${id}: not one of the planned arms ${armIds.join(",")}`);
    if (id in out) throw new Error(`--tree ${id} given twice`);
    if (!armById[id].tree) throw new Error(`--tree ${id}: the control runs with no tree`);
    out[id] = ref;
  });
  return out;
}

/** @param {string[]} armIds @param {Record<string, string>} overrides @returns {Trees} */
export const planTrees = (armIds, overrides) => Object.fromEntries(armIds.map((id) => [id, overrides[id] ?? armById[id].tree]));

/** @param {{ trees?: Trees }} plan @returns {Trees} */
export const treesOf = (plan) => plan.trees ?? LEGACY_TREES;

/** @param {{ trees?: Trees }} sourcePlan @param {Trees} targetTrees @param {string} armId */
export const copyable = (sourcePlan, targetTrees, armId) => treesOf(sourcePlan)[armId] === targetTrees[armId];

/** @param {Arm} arm @param {Trees} trees @returns {Arm} */
export const withTree = (arm, trees) => ({ ...arm, tree: trees[arm.id] });

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
export const REAL_HOME = homedir().replaceAll("\\", "/");

export const WORKER_MODEL = { claude: ["--model", "opus", "--effort", "medium"], cursor: ["--model", "claude-opus-5-5-medium"] };

/** The newest cursor-agent build; the .cmd shim goes through PowerShell, so run its node directly. */
export function cursorAgent() {
  const root = join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "cursor-agent", "versions");
  const version = readdirSync(root)
    .filter((v) => /^\d{4}\.\d+\.\d+/.test(v))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .at(-1);
  return { version, exe: join(root, version, "node.exe"), script: join(root, version, "index.js") };
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 }).trim();

/** Unpacks `ref` of the repository at `gitDir` into `dir` once. */
function unpack(gitDir, ref, dir) {
  if (existsSync(join(dir, ".complete"))) return dir;
  mkdirSync(dir, { recursive: true });
  const tar = execFileSync("git", ["-C", gitDir, "archive", "--format=tar", ref], { maxBuffer: 1 << 28 });
  execFileSync("tar", ["-x", "-C", dir.replaceAll("\\", "/")], { input: tar });
  writeFileSync(join(dir, ".complete"), ref);
  return dir;
}

export const treeDir = (sandbox, ref) => join(sandbox, "trees", ref.replace(/[^\w.-]/g, "_"));

/** @returns {string} */
export const extractTree = (sandbox, ref) => unpack(REPO, ref, treeDir(sandbox, ref));

const pluginGitDir = (sandbox, arm) => join(sandbox, "sources", `${arm.plugin.marketplace}.git`);

/**
 * Keeps a bare clone of the arm's plugin repository in the sandbox and resolves `ref` in it to a full commit. Only
 * `--init` calls it, so a run never reaches the network.
 * @param {string} sandbox @param {Arm} arm @param {string} ref @returns {string}
 */
export function ensurePluginSource(sandbox, arm, ref) {
  const bare = pluginGitDir(sandbox, arm);
  if (!existsSync(bare)) {
    mkdirSync(dirname(bare), { recursive: true });
    git("clone", "--bare", "--quiet", arm.plugin.repo, bare);
  }
  const commit = () => git("-C", bare, "rev-parse", "--verify", "--quiet", `${ref}^{commit}`);
  try {
    return commit();
  } catch {
    git("-C", bare, "fetch", "--quiet", "origin", "+refs/heads/*:refs/heads/*", "+refs/tags/*:refs/tags/*");
    return commit();
  }
}

export const pluginSrcDir = (sandbox, arm, sha) => join(sandbox, "plugin-src", `${arm.plugin.marketplace}-${sha.slice(0, 12)}`);

/** @param {string} sandbox @param {Arm} arm @param {string} sha @returns {string} */
export const extractPluginTree = (sandbox, arm, sha) => unpack(pluginGitDir(sandbox, arm), sha, pluginSrcDir(sandbox, arm, sha));

export function judgeTree(sandbox) {
  const dir = join(sandbox, "judge-tree", "pstack");
  if (existsSync(join(dir, ".complete"))) return dir;
  const upstream = join(extractTree(sandbox, "upstream-v0.15.2"), "skills");
  for (const name of readdirSync(upstream)) {
    const slug = name.match(/^principle-(.+)$/)?.[1];
    if (slug) {
      mkdirSync(join(dir, "poteto-mode", "principles"), { recursive: true });
      copyFileSync(join(upstream, name, "SKILL.md"), join(dir, "poteto-mode", "principles", `${slug}.md`));
    } else cpSync(join(upstream, name), join(dir, name), { recursive: true });
  }
  writeFileSync(join(dir, ".complete"), "upstream-v0.15.2");
  return dir;
}

const link = (target, path) => {
  if (!existsSync(path)) symlinkSync(target, path, "junction");
};

const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(CLAUDE|ANTHROPIC_|CURSOR_)/.test(k)));

const readJson = (path) => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null);
const pluginId = (plugin) => `${plugin.name}@${plugin.marketplace}`;
const installedPlugins = (config) => readJson(join(config, "plugins", "installed_plugins.json"))?.plugins ?? {};
const writeSettings = (config, settings) => writeFileSync(join(config, "settings.json"), JSON.stringify(settings, null, 2));

const portRoots = (arm, sandbox, home) => [join(home, ".claude", "skills"), ...(arm.tree ? [join(treeDir(sandbox, arm.tree), "skills")] : [])];
const seesNothing = { skills: false, agents: false, hooks: false, plugins: () => [] };

/**
 * Everything that differs between installs, keyed by install kind. `sees` is what a sealed home may hold; a cursor
 * install has none because its home is not a Claude home.
 * @type {Record<InstallKind, {
 *   materialize?: (arm: Arm, sandbox: string) => ClaudeInstall,
 *   setup?: (config: string, install: ClaudeInstall, env: Record<string, string>) => void,
 *   roots: (arm: Arm, sandbox: string, home: string) => string[],
 *   sees: { skills: boolean, agents: boolean, hooks: boolean, plugins: (arm: Arm) => string[] } | null,
 * }>}
 */
const INSTALLS = {
  "cursor-plugin": { roots: portRoots, sees: null },
  port: {
    materialize: (arm, sandbox) => ({ kind: "port", tree: extractTree(sandbox, arm.tree) }),
    // The hook commands keep their `~/.claude` paths: the hook shell resolves `~` from HOME, which is this home
    // (measured: a witness SessionStart hook's `pwd -P` printed the sealed tree).
    setup: (config, { tree }) => {
      link(join(tree, "skills"), join(config, "skills"));
      link(join(tree, "agents"), join(config, "agents"));
      const install = JSON.parse(readFileSync(join(tree, "install.json"), "utf8"));
      writeSettings(config, { hooks: install.hooks, ...(install.env ? { env: install.env } : {}) });
    },
    roots: portRoots,
    sees: { skills: true, agents: true, hooks: true, plugins: () => [] },
  },
  "claude-plugin": {
    materialize: (arm, sandbox) => ({ kind: "claude-plugin", src: extractPluginTree(sandbox, arm, arm.tree), arm }),
    // Installed once through Claude Code itself, which then owns settings.json, so a later call never rewrites it.
    setup: (config, { src, arm }, env) => {
      const id = pluginId(arm.plugin);
      if (!installedPlugins(config)[id]) {
        writeSettings(config, {});
        const claude = (...args) => execFileSync("claude", ["plugin", ...args], { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
        claude("marketplace", "add", src);
        claude("install", id);
      }
      const { version } = JSON.parse(readFileSync(join(src, arm.plugin.dir, ".claude-plugin", "plugin.json"), "utf8"));
      const want = join(config, "plugins", "cache", arm.plugin.marketplace, arm.plugin.name, version);
      const got = installedPlugins(config)[id]?.[0]?.installPath;
      if (!got || resolve(got) !== resolve(want)) throw new Error(`${id} installed at ${got}, expected ${want}`);
    },
    roots: (arm, sandbox, home) => {
      const installed = installedPlugins(join(home, ".claude"))[pluginId(arm.plugin)]?.[0]?.installPath;
      return [...(installed ? [join(installed, "skills")] : []), join(pluginSrcDir(sandbox, arm, arm.tree), arm.plugin.dir, "skills")];
    },
    sees: { ...seesNothing, plugins: (arm) => [pluginId(arm.plugin)] },
  },
  none: {
    materialize: () => null,
    setup: (config) => writeSettings(config, {}),
    roots: (arm, sandbox, home) => [join(home, ".claude", "skills")],
    sees: seesNothing,
  },
};

/** @param {string} home @param {ClaudeInstall} install @returns {Record<string, string>} env */
export function claudeHome(home, install) {
  const config = join(home, ".claude");
  mkdirSync(config, { recursive: true });
  copyFileSync(join(homedir(), ".claude", ".credentials.json"), join(config, ".credentials.json"));
  const env = { ...cleanEnv(), CLAUDE_CONFIG_DIR: config, HOME: home, USERPROFILE: home };
  INSTALLS[install?.kind ?? "none"].setup(config, install, env);
  return env;
}

/** The directories a run's packet shows as `<pstack>`. @param {Arm} arm @param {string} sandbox @param {string} home */
export const skillRoots = (arm, sandbox, home) => INSTALLS[arm.install].roots(arm, sandbox, home);

/**
 * What a sealed Claude home held after the run, against what the arm's install puts there.
 * @param {Arm} arm @param {string} home @returns {string[]}
 */
export function homeViolations(arm, home) {
  const sees = INSTALLS[arm.install].sees;
  if (arm.harness !== "claude" || !sees) return [];
  const config = join(home, ".claude");
  const settings = readJson(join(config, "settings.json")) ?? {};
  const out = [];
  // Claude Code syncs the account's skills into skills/synced in every home, whatever the arm installs.
  const installed = (dir) => existsSync(join(config, dir)) && readdirSync(join(config, dir)).some((e) => !(dir === "skills" && e === "synced"));
  for (const dir of ["skills", "agents"]) if (!sees[dir] && installed(dir)) out.push(`${arm.id} home has .claude/${dir}`);
  if (!sees.hooks && settings.hooks) out.push(`${arm.id} home settings register hooks`);
  const plugins = [...new Set([...Object.keys(installedPlugins(config)), ...Object.keys(settings.enabledPlugins ?? {})])].sort();
  const expected = sees.plugins(arm);
  if (plugins.join() !== expected.join()) out.push(`${arm.id} home has plugins ${plugins.join(", ") || "none"}, expected ${expected.join(", ") || "none"}`);
  return out;
}

/**
 * The account's marketplace pstack would otherwise sync into any home on the
 * first turn (measured), so its cache path is taken by a plain file.
 * @returns {Record<string, string>} env
 */
export function cursorHome(home, rules) {
  const cache = join(home, ".cursor", "plugins", "cache", "cursor-public");
  mkdirSync(cache, { recursive: true });
  writeFileSync(join(cache, "pstack"), "The parity harness keeps the marketplace pstack out of this home.\n");
  if (rules) {
    mkdirSync(join(home, ".cursor", "rules"), { recursive: true });
    copyFileSync(rules, join(home, ".cursor", "rules", "pstack-models.mdc"));
  }
  return { ...cleanEnv(), HOME: home, USERPROFILE: home, CURSOR_INVOKED_AS: "cursor-agent" };
}

/**
 * @param {Arm} arm
 * @param {{ sandbox: string, home: string, ws: string, session: string | null, first: boolean }} run
 * @returns {{ file: string, args: string[], env: Record<string, string>, cwd: string }}
 */
export function workerCommand(arm, run) {
  if (arm.harness === "claude") {
    const env = claudeHome(run.home, INSTALLS[arm.install].materialize(arm, run.sandbox));
    const session = run.first ? ["--session-id", run.session] : ["--resume", run.session];
    return {
      file: "claude",
      args: ["-p", "--output-format", "stream-json", "--verbose", ...WORKER_MODEL.claude, "--permission-mode", "bypassPermissions", ...session],
      env,
      cwd: run.ws,
    };
  }
  const tree = arm.tree ? extractTree(run.sandbox, arm.tree) : null;
  const env = cursorHome(run.home, tree ? join(HERE, "fixtures", "pstack-models.mdc") : null);
  const agent = cursorAgent();
  return {
    file: agent.exe,
    args: [
      agent.script,
      "-p",
      "--output-format",
      "stream-json",
      ...WORKER_MODEL.cursor,
      "--trust",
      "--force",
      "--workspace",
      run.ws,
      ...(tree ? ["--plugin-dir", tree] : []),
      ...(run.first ? [] : ["--resume", run.session]),
    ],
    env,
    cwd: run.ws,
  };
}

/**
 * @param {"claude" | "cursor"} harness @param {string} model
 * @param {{ sandbox: string, dir: string }} job
 */
export function judgeCommand(harness, model, job) {
  if (harness === "claude") {
    const env = claudeHome(join(job.sandbox, "judge-home-claude"), null);
    return {
      file: "claude",
      args: ["-p", "--output-format", "stream-json", "--verbose", "--model", model, "--tools", "Read,Grep,Glob", "--permission-mode", "bypassPermissions"],
      env,
      cwd: job.dir,
    };
  }
  const env = cursorHome(join(job.sandbox, "judge-home-cursor"), null);
  const agent = cursorAgent();
  return {
    file: agent.exe,
    args: [agent.script, "-p", "--mode", "ask", "--output-format", "stream-json", "--model", model, "--trust", "--workspace", job.dir],
    env,
    cwd: job.dir,
  };
}

export function transcriptSource(arm, home, ws, session) {
  if (arm.harness === "claude") {
    const projects = join(home, ".claude", "projects");
    const dir = existsSync(projects) ? readdirSync(projects).find((d) => existsSync(join(projects, d, `${session}.jsonl`))) : null;
    return dir ? { main: join(projects, dir, `${session}.jsonl`), children: join(projects, dir, session) } : null;
  }
  const slug = ws.replaceAll("\\", "/").replace(/[:/.]+/g, "-").replace(/^-+|-+$/g, "");
  const dir = join(home, ".cursor", "projects", slug, "agent-transcripts");
  return existsSync(dir) ? { transcripts: dir } : null;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A directory in its slash form and, for a drive path, its Git Bash `/c/` form. */
const dirForms = (dir) => {
  const d = dir.replaceAll("\\", "/").replace(/\/+$/, "");
  return [d, ...(/^[a-z]:\//i.test(d) ? [`/${d[0]}${d.slice(2)}`] : [])].map(escapeRe).join("|");
};

const homePattern = (home) => new RegExp(`(?<![\\w.-])(?:${dirForms(home)})(?![\\w.-])`, "i");

/** A path under `dir`, the directory itself included, so it can be cut out of a command. */
const underPattern = (dir) => new RegExp(`(?<![\\w.-])(?:${dirForms(dir)})(?:/[^\\s"'\`;|&<>]*)?(?![\\w.-])`, "gi");

/**
 * What each Claude install leaves where a run can see it: the paths it lives under and the session context its hook
 * injects. A claude arm that touches or sees another install's footprint was not sealed.
 */
export const FOOTPRINTS = {
  port: { paths: /\/(?:\.claude\/(?:skills|agents)|trees)(?![\w.-])/i, context: /^# pstack (?:session context|reminders|step ledger)/m },
  "claude-plugin": { paths: /\/(?:\.claude\/plugins|plugin-src)(?![\w.-])/i, context: /Invoke the `pstack:poteto-mode` skill/ },
};

let repoSkills;
const isPstackSkill = (name) => /^principle-/.test(name) || (repoSkills ??= new Set(readdirSync(join(REPO, "skills")))).has(name);

/**
 * A project `.claude/` inside the run's workspace belongs to the project, so paths under `workspace` never count as
 * an install's footprint.
 * @param {Arm} arm @param {import("./claude-trace.mjs").Trace} trace @param {string} [home] @param {string | null} [workspace]
 * @returns {string[]}
 */
export function sealViolations(arm, trace, home = REAL_HOME, workspace = null) {
  const outsideWorkspace = workspace ? (text) => text.replace(underPattern(workspace), "") : (text) => text;
  const all = (t) => [t, ...t.children.flatMap(all)];
  const foreign = arm.harness === "claude" ? Object.entries(FOOTPRINTS).filter(([kind]) => kind !== arm.install) : [];
  const out = [];
  const inHome = homePattern(home);
  const turns = all(trace).flatMap((t) => t.turns);
  for (const a of turns.flatMap((u) => u.actions)) {
    if (arm.install === "none" && a.kind === "skill" && !a.refused && isPstackSkill(a.name)) out.push(`control arm loaded a pstack skill: ${a.name}`);
    const text = (a.kind === "read" || a.kind === "write" ? a.path : a.kind === "shell" ? a.command : "").replaceAll("\\", "/");
    const lower = text.toLowerCase();
    if (!lower) continue;
    if (inHome.test(text)) out.push(`touched the real home: ${text.slice(0, 160)}`);
    if (arm.harness === "cursor" && /\/\.(claude|agents)\//.test(lower)) out.push(`cursor arm touched a Claude install: ${text.slice(0, 160)}`);
    if (arm.harness === "claude" && /\/\.cursor\//.test(lower)) out.push(`claude arm touched a Cursor install: ${text.slice(0, 160)}`);
    for (const [kind, f] of foreign) if (f.paths.test(outsideWorkspace(text))) out.push(`${arm.id} arm touched the ${kind} install: ${text.slice(0, 160)}`);
    if (arm.install === "none" && a.kind === "read" && a.doc) out.push(`control arm read a pstack document: ${text.slice(0, 160)}`);
  }
  const injected = turns.flatMap((u) => u.injected);
  for (const [kind, f] of foreign) if (injected.some((s) => f.context.test(s))) out.push(`${arm.id} arm saw the ${kind} session context`);
  return out;
}
