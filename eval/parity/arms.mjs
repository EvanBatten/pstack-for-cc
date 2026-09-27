import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @typedef {{
 *   id: "A" | "B" | "C" | "D",
 *   role: "reference" | "control" | "treatment",
 *   harness: "cursor" | "claude",
 *   tree: string | null,
 *   note: string,
 * }} Arm
 */

/** @type {Arm[]} */
export const ARMS = [
  { id: "A", role: "reference", harness: "cursor", tree: "upstream-v0.15.2", note: "cursor-agent, upstream pstack v0.15.2 via --plugin-dir" },
  { id: "C", role: "control", harness: "cursor", tree: null, note: "cursor-agent, no pstack" },
  { id: "D", role: "treatment", harness: "claude", tree: "cf5b727", note: "claude -p, the port at that tree with its three-event hook" },
  {
    id: "B",
    role: "treatment",
    harness: "claude",
    tree: "3ced788",
    note: "claude -p, the port at that tree with the hooks and env its install.json registers and the agents under its agents/",
  },
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

export const treeDir = (sandbox, ref) => join(sandbox, "trees", ref.replace(/[^\w.-]/g, "_"));

/** @returns {string} */
export function extractTree(sandbox, ref) {
  const dir = treeDir(sandbox, ref);
  if (existsSync(join(dir, ".complete"))) return dir;
  mkdirSync(dir, { recursive: true });
  const tar = execFileSync("git", ["-C", REPO, "archive", "--format=tar", ref], { maxBuffer: 1 << 28 });
  execFileSync("tar", ["-x", "-C", dir.replaceAll("\\", "/")], { input: tar });
  writeFileSync(join(dir, ".complete"), ref);
  return dir;
}

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

/**
 * The hook commands keep their `~/.claude` paths: the hook shell resolves `~`
 * from HOME, which is this home (measured: a witness SessionStart hook's
 * `pwd -P` printed the sealed tree).
 * @returns {Record<string, string>} env
 */
export function claudeHome(home, tree) {
  const config = join(home, ".claude");
  mkdirSync(config, { recursive: true });
  copyFileSync(join(homedir(), ".claude", ".credentials.json"), join(config, ".credentials.json"));
  let settings = {};
  if (tree) {
    link(join(tree, "skills"), join(config, "skills"));
    link(join(tree, "agents"), join(config, "agents"));
    const install = JSON.parse(readFileSync(join(tree, "install.json"), "utf8"));
    settings = { hooks: install.hooks, ...(install.env ? { env: install.env } : {}) };
  }
  writeFileSync(join(config, "settings.json"), JSON.stringify(settings, null, 2));
  return { ...cleanEnv(), CLAUDE_CONFIG_DIR: config, HOME: home, USERPROFILE: home };
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
    const tree = extractTree(run.sandbox, arm.tree);
    const env = claudeHome(run.home, tree);
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

const homePattern = (home) => {
  const h = home.replaceAll("\\", "/").replace(/\/+$/, "");
  const forms = [h, ...(/^[a-z]:\//i.test(h) ? [`/${h[0]}${h.slice(2)}`] : [])];
  return new RegExp(`(?<![\\w.-])(?:${forms.map(escapeRe).join("|")})(?![\\w.-])`, "i");
};

/**
 * @param {Arm} arm @param {import("./claude-trace.mjs").Trace} trace @param {string} [home] @returns {string[]}
 */
export function sealViolations(arm, trace, home = REAL_HOME) {
  const all = (t) => [t, ...t.children.flatMap(all)];
  const out = [];
  const inHome = homePattern(home);
  for (const a of all(trace).flatMap((t) => t.turns.flatMap((u) => u.actions))) {
    const text = (a.kind === "read" || a.kind === "write" ? a.path : a.kind === "shell" ? a.command : "").replaceAll("\\", "/");
    const lower = text.toLowerCase();
    if (!lower) continue;
    if (inHome.test(text)) out.push(`touched the real home: ${text.slice(0, 160)}`);
    if (arm.harness === "cursor" && /\/\.(claude|agents)\//.test(lower)) out.push(`cursor arm touched a Claude install: ${text.slice(0, 160)}`);
    if (arm.harness === "claude" && /\/\.cursor\//.test(lower)) out.push(`claude arm touched a Cursor install: ${text.slice(0, 160)}`);
    if (!arm.tree && a.kind === "read" && a.doc) out.push(`control arm read a pstack document: ${text.slice(0, 160)}`);
  }
  return out;
}
