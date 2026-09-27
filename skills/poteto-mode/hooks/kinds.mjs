import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { posix } from "node:path";

const unquote = (w) => w.replace(/^["']|["']$/g, "");

export const gitBashPath = (p) =>
  unquote(p)
    .replaceAll("\\", "/")
    .replace(/^([A-Za-z]):\//, (_, d) => `/${d.toLowerCase()}/`)
    .replace(/^(\.\/)+/, "");

export const baseName = (path) => path.split(/[\\/]/).pop();

export const MODEL_TIERS = ["opus", "sonnet", "haiku"];

export const READER_WRAPPERS = ["sudo", "command", "env", "xargs", "nohup", "time"];
export const WRITE_COMMANDS = ["tee", "rm", "rmdir", "mv", "cp", "mkdir", "touch", "dd", "install", "ln", "truncate", "chmod", "chown"];
export const GIT_WRITES = ["commit", "push", "checkout", "reset", "switch", "restore", "merge", "rebase", "cherry-pick", "revert", "clean", "am", "apply", "add", "rm", "mv", "pull", "init", "clone"];

const COMMAND_PREFIXES = ["sudo", "command", "env", "exec", "nohup", "time", "timeout"];

/** A file is code unless its name says it is a doc, config, data or asset file, so a language no list names still counts. */
const NOT_CODE = [
  /^((LICEN[CS]E|NOTICE)(\.(txt|md|markdown|rst|adoc|org|html?))?|go\.sum|CHANGELOG\.md|Package\.resolved)$/i,
  /^(go\.mod|CMakeLists\.txt|requirements[\w.-]*\.txt|py\.typed|pom\.xml|AndroidManifest\.xml)$/i,
  /\.(dist|sample|example|license)$/i,
  /^\.[\w.-]+$/,
  /^[^.]*$/,
  /^[^.]+\.[1-9]$/,
  /\.(md|mdx|markdown|rst|adoc|asciidoc|txt|org)$/i,
  /\.(json|jsonc|json5|ya?ml|toml|ini|cfg|conf|env|properties|plist|lock|lockb|lockfile|\w*proj|sln|xcconfig|props|targets|nuspec|entitlements|neon|cff|xctestplan|runsettings)$/i,
  /\.(csv|tsv|jsonl|ndjson|parquet|xml|sqlite|db|log|snap|map|pot?|mo|arb|pem|crt|key|stderr|stdout|golden|ent)$/i,
  /\.(png|jpe?g|gif|webp|ico|icns|bmp|svg|woff2?|ttf|otf|eot|mp[34]|mov|avi|wav|pdf|zip|tar|gz|tgz|7z)$/i,
];

/**
 * The source-code extensions. A shell command's output file (`> run.console`, `> times`) is code only by one of these,
 * since a redirect more often captures output than writes a program. An Edit or Write keeps `fileKind`'s wider rule.
 */
const SOURCE_EXTENSIONS =
  /\.(m?js|cjs|jsx|m?ts|cts|tsx|py|pyi|rb|go|rs|java|kts?|scala|swift|c|h|cc|cpp|cxx|hpp|hh|m|mm|cs|fs|vb|php|pl|pm|lua|sh|bash|zsh|fish|ps1|psm1|r|jl|dart|exs?|erl|hrl|clj[sc]?|elm|hs|mli?|nim|zig|sql|vue|svelte|astro|groovy|gradle|tf|bat|cmd)$/i;
export const isSource = (raw) => SOURCE_EXTENSIONS.test(baseName(raw));

const GENERATED = /(^|\/)(node_modules|vendor|dist|build|out|target|\.next|\.venv|venv|__pycache__|obj)\//;

/**
 * A test, spec, fixture or benchmark file, by its name or its directory: `src/androidTest/`, `Shop.Tests/`, `testdata/`,
 * `conftest.py`, `cart_spec.rb`. It is the harness around the code, not the code a playbook hands off or a reader doc.
 */
export const isHarness = (raw) => {
  const path = gitBashPath(raw);
  return (
    /(^|\/)(tests?|__tests__|testdata|specs?|bench(es|marks?)?|fixtures?)\//i.test(path) ||
    /(^|\/)src\/[a-z]\w*Test\//.test(path) ||
    /\.Tests?\//.test(path) ||
    /\.(test|spec)\.|_(test|spec)\.|^test_|^conftest\.py$|(^|[-_.])bench(es)?([-_.]|$)/i.test(baseName(path))
  );
};

const TMP = posix.normalize(gitBashPath(tmpdir())).toLowerCase();

// Scratch is a whole directory name, so `temp_sensor.py` is code. A `tmp` directory directly under a source
// directory, such as `src/tmp/`, is code the project keeps, and `temp` is too common a module name to count at all.
const SOURCE_DIRS = /(^|\/)(src|lib|app|pkg|internal|packages|source)\/(\.?tmp)\//i;
const isScratch = (path) =>
  path.startsWith("/tmp/") || // port-check: allow
  path.toLowerCase().startsWith(`${TMP}/`) ||
  /(^|\/)(scratch|\.scratch|scratchpad)\//i.test(path) ||
  (/(^|\/)\.?tmp\//i.test(path) && !SOURCE_DIRS.test(path));

// Any markdown file inside a skill's directory is prose an agent reads, like its SKILL.md.
const SKILL_DOC = /(^|\/)skills\/[^/]+\/(.+\/)?[^/]+\.md$|(^|\/)(\.claude|plugins\/[^/]+)\/agents\/[^/]+\.md$/;
const DECISION_LOG = /^decisions?([-_.]log)?\.(tsv|csv|md|jsonl)$/i;
// An ADR-style decisions.md is a document; a log is a table or lines of records, or sits in an .audit directory.
const isDecisionLog = (path, name) => (DECISION_LOG.test(name) && (/\.(tsv|jsonl)$/i.test(name) || /(^|\/)\.audit\//.test(path))) || /(^|\/)\.audit\/[^/]+\.tsv$/.test(path);
// The file's whole name, so `design-notes.md` and `src/Support.md` are not reader docs.
const READER_NAMES = /^(README|CONTRIBUTING|ARCHITECTURE|CLAUDE|AGENTS)(\.[\w-]+)?\.(md|mdx|markdown|rst|adoc|asciidoc|txt)$/i;
const CODE_NAMES = /^(GNUmakefile|[Mm]akefile|Dockerfile|Containerfile|Justfile|Rakefile|Vagrantfile)(\..+)?$/;

/** @typedef {"code" | "skill-doc" | "reader-doc" | "trail" | "other"} FileKind */

/**
 * What an edited file is, by its path's shape alone: no manifest, no file existence, no repository root. Scratch is
 * "other" whatever its extension, and so are a test fixture's skill documents.
 * @param {string} raw @returns {FileKind}
 */
export function fileKind(raw) {
  const path = posix.normalize(gitBashPath(raw));
  const name = baseName(path);
  if (isScratch(path)) return "other";
  if (SKILL_DOC.test(path)) return isHarness(path) ? "other" : "skill-doc";
  if (isDecisionLog(path, name)) return "trail";
  if (GENERATED.test(path)) return "other";
  const doc = /\.(md|mdx|markdown|rst|adoc|asciidoc|txt)$/i.test(name) && !NOT_CODE[0].test(name);
  if (doc && (READER_NAMES.test(name) || /(^|\/)docs?\//i.test(path) || /\.(rst|adoc|asciidoc)$/i.test(name)) && !isHarness(path)) return "reader-doc";
  if (CODE_NAMES.test(name) || /(^|\/)bin\/[^/.]+$/.test(path)) return "code";
  return NOT_CODE.some((re) => re.test(name.replace(/(.)\.in$/, "$1"))) ? "other" : "code";
}

const VCS = { git: ["commit"], hg: ["commit", "ci"], sl: ["commit", "ci"], jj: ["commit"], svn: ["commit", "ci"] };

/** Azure completes a PR through `az repos pr update --status completed`, which no word sequence tells from another update. */
const FORGES = {
  gh: { open: [["pr", "create"], ["pr", "ready"]], merge: [["pr", "merge"]], draft: [["--draft"], ["-d"]] },
  origin: { open: [["pr", "create"], ["pr", "ready"]], merge: [["pr", "merge"]], draft: [["--status", "draft"]] },
  glab: { open: [["mr", "create"]], merge: [["mr", "merge"]], draft: [["--draft"]] },
  tea: { open: [["pr", "create"], ["pulls", "create"]], merge: [["pr", "merge"], ["pulls", "merge"]], draft: [] },
  az: { open: [["repos", "pr", "create"]], merge: [], draft: [["--draft"]] },
};

export const MCP_PR = { open: /^mcp__.+__create_?(pull|merge)_?request$/i, merge: /^mcp__.+__merge_?(pull|merge)_?request$/i };

const HEREDOC = /<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2[ \t]*(?=\n|$)/g;

// The directories each tool in the VCS verb table keeps at a repository's root.
const REPO_MARKERS = Object.keys(VCS).map((tool) => `.${tool}`);

/** @type {WeakMap<(path: string) => boolean, Map<string, boolean>>} per probe function, what each directory resolved to */
const memo = new WeakMap();

/** A UNC path's share root, `//host/share`, is as high as the walk may probe. */
const shareRoot = (path) => path.match(/^\/\/[^/]+\/[^/]+/)?.[0] ?? null;

/**
 * Whether a file sits inside a repository: some directory above it, up to its share root on a UNC path, holds a VCS
 * directory, or a `.git` file in a linked worktree. The only filesystem read an ask makes. A probe that throws reads
 * as no repository, and the walk stops there.
 * @param {string} file @param {(path: string) => boolean} [exists] @returns {boolean}
 */
export function inRepo(file, exists = existsSync) {
  if (!memo.has(exists)) memo.set(exists, new Map());
  const known = memo.get(exists);
  const path = file.replaceAll("\\", "/");
  const top = shareRoot(path);
  const seen = [];
  let answer = false;
  for (let dir = posix.dirname(path); ; dir = posix.dirname(dir)) {
    if (known.has(dir)) {
      answer = known.get(dir);
      break;
    }
    seen.push(dir);
    let hit;
    try {
      hit = REPO_MARKERS.some((marker) => exists(`${dir}/${marker}`));
    } catch {
      break;
    }
    if (hit) {
      answer = true;
      break;
    }
    // A root such as `/` or `C:`, a share root, or the working directory `.` of a relative path ends the walk.
    if (dir === top || [dir, "."].includes(posix.dirname(dir))) break;
  }
  for (const dir of seen) known.set(dir, answer);
  return answer;
}

// A git that does not answer this fast is treated as saying no, so a slow or broken repository never blocks a call.
const IGNORE_TIMEOUT_MS = 1500;
const ignoredMemo = new Map();

/**
 * Whether git ignores a file, a worker's own scratch under the repository such as `.verify/`, which is not product
 * code. Git answers from the nearest directory that exists, so a file not yet written is judged too. A path outside a
 * repository, a missing git, an error or a timeout all read as not ignored. One git runs per path per hook process.
 * @param {string} file
 */
export function isIgnored(file) {
  const path = file.replaceAll("\\", "/");
  if (!ignoredMemo.has(path)) ignoredMemo.set(path, inRepo(path) && checkIgnore(path));
  return ignoredMemo.get(path);
}

/** @param {string} path */
function checkIgnore(path) {
  let dir = posix.dirname(path);
  while (!existsSync(dir) && posix.dirname(dir) !== dir) dir = posix.dirname(dir);
  const run = spawnSync("git", ["check-ignore", "-q", "--", path], { cwd: dir, timeout: IGNORE_TIMEOUT_MS, stdio: "ignore", windowsHide: true });
  return run.status === 0;
}

/**
 * The file paths a shell command spells out as words: no variable expanded, no quoted text or heredoc body read.
 * @param {string} command @returns {string[]}
 */
export const namedPaths = (command) =>
  command
    .replace(HEREDOC, "")
    .replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, " ")
    .split(/[\s;&|()<>]+/)
    .filter((w) => w && !w.startsWith("-") && !w.includes("$") && /[./\\]/.test(w) && /[\w-]\.\w+$|[\\/][^\\/.]+$/.test(w));

const LITERAL = (w) => Boolean(w) && !/[$`'"*?{}]/.test(w);
export const ABSOLUTE = /^([A-Za-z]:|[\\/~])/;
const DEV_NULL = /^(\/dev\/null|nul)$/i;
const REDIRECT = /(?<![\d&>=-])>>?\|?\s*([^\s;&|<>()]+)/g;
const ANY_REDIRECT = /(?:\d|&)?>>?\|?&?\s*[^\s;&|<>()]*|<\s*[^\s;&|<>()]*/g;
const HAS_EXTENSION = /[^/\\]\.\w+$/;

/** The positional words of a script tool's arguments, and whether an `-e`/`-f` option gave the script instead. */
const positionals = (args, valued) => {
  const out = [];
  let script = false;
  for (let i = 0; i < args.length; i++) {
    if (valued.includes(args[i])) {
      script ||= /^-(e|f)$|^--(expression|file)$/.test(args[i]);
      i++;
    } else if (!args[i].startsWith("-")) out.push(args[i]);
  }
  return { out, script };
};

/**
 * The files a shell command writes, from the literal words of each statement: the target of `>` or `>>` (not a
 * numbered or `&` redirect, `>&2`, or /dev/null), the file arguments of `tee`, of `sed -i` and of `perl -i`, and the
 * destination of `cp`, `mv` or `install`. A word with `$`, a glob or a quote, and a heredoc body, name nothing certain,
 * so a Python or Node script that writes a file is not seen. A relative path joins `cwd` and any literal `cd` before it.
 * @param {string} command @param {string | null} cwd @returns {string[]}
 */
export function shellWrites(command, cwd = null) {
  const bare = command.replace(HEREDOC, "").replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, "''");
  let dir = cwd;
  const at = (p) => (ABSOLUTE.test(p) ? p : dir === null ? p : `${dir.replace(/[\\/]+$/, "")}/${p.replace(/^\.\//, "")}`);
  const out = [];
  const add = (p) => LITERAL(p) && !DEV_NULL.test(p) && !out.includes(at(p)) && out.push(at(p));
  // A variable the command sets to a literal path, as `W=/c/repo; sed -i ... $W/a.md` does, stands for that path.
  const vars = new Map();
  for (const raw of bare.split(/&&|\|\||[;\n|]/)) {
    const statement = raw
      .trim()
      .replace(/^(do|then|else)\s+/, "")
      .replace(/\$\{?(\w+)\}?/g, (ref, name) => vars.get(name) ?? ref);
    const assign = statement.match(/^(?:export\s+)?(\w+)=([^\s$`'"]+)$/);
    if (assign) vars.set(assign[1], assign[2]);
    for (const m of statement.matchAll(REDIRECT)) add(m[1]);
    let words = statement.replace(ANY_REDIRECT, " ").split(/\s+/).filter(Boolean);
    while (words.length && (/^\w+=/.test(words[0]) || COMMAND_PREFIXES.includes(words[0]))) words = words.slice(1);
    const [tool, ...args] = [baseName(words[0] ?? "").replace(/\.exe$/i, ""), ...words.slice(1)];
    if (tool === "cd") dir = LITERAL(args[0]) ? at(args[0]) : null;
    if (tool === "tee") args.filter((w) => !w.startsWith("-")).forEach(add);
    if (tool === "sed" && args.some((w) => /^-[a-zA-Z]*i|^--in-place/.test(w))) {
      const { out: files, script } = positionals(args, ["-e", "-f", "--expression", "--file"]);
      (script ? files : files.slice(1)).forEach(add);
    }
    if (tool === "perl" && args.some((w) => /^-\w*i/.test(w))) {
      const { out: files, script } = positionals(args, ["-e", "-E", "-I", "-M", "-m"]);
      (script || args.some((w) => /^-\w*e$/.test(w)) ? files : files.slice(1)).forEach(add);
    }
    if (["cp", "mv", "install"].includes(tool) && !args.some((w) => /^-(t|d)$|^--target-directory/.test(w))) {
      const { out: files } = positionals(args, ["-m", "-o", "-g", "-S", "--mode", "--owner", "--group", "--suffix"]);
      const dest = files.at(-1);
      if (files.length >= 2 && HAS_EXTENSION.test(dest)) add(dest);
    }
  }
  return out;
}

/**
 * Whether a statement of the command runs a script: the script is the statement's tool, or the first operand of `bash`
 * or `sh`. A variable the command itself sets to a literal, as `L=.../log.sh; bash "$L"` does, stands for its value.
 * @param {string} command @param {RegExp} script
 */
export function runsScript(command, script) {
  const vars = new Map();
  const expand = (w) => unquote(w).replace(/\$\{?(\w+)\}?/g, (ref, name) => vars.get(name) ?? ref);
  for (const raw of command.replace(HEREDOC, "").split(/&&|\|\||[;|\n]/)) {
    const statement = raw.trim().replace(/^(do|then|else)\s+/, "");
    const assign = statement.match(/^(?:export\s+)?(\w+)=["']?([^"'\s;&|]*)["']?$/);
    if (assign) {
      vars.set(assign[1], expand(assign[2]));
      continue;
    }
    let words = statement.split(/\s+/).filter(Boolean);
    while (words.length && (/^\w+=/.test(words[0]) || COMMAND_PREFIXES.includes(words[0]))) words = words.slice(1);
    const head = expand(words[0] ?? "");
    const operand = words.slice(1).find((w) => !w.startsWith("-"));
    if (script.test(head) || (["bash", "sh"].includes(baseName(head)) && operand !== undefined && script.test(expand(operand)))) return true;
  }
  return false;
}

/** @typedef {{ verb: "commit" } | { verb: "pr-open", draft: boolean } | { verb: "pr-merge" }} VcsVerb */

/**
 * Each statement of a shell command as its tool, arguments and, for a VCS tool, the subcommand after its options. A
 * heredoc body and a quoted string are text, not commands.
 * @returns {{ tool: string, args: string[], sub: string }[]}
 */
function commandsIn(command) {
  const bare = command.replace(HEREDOC, "").replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, "''");
  return bare.split(/&&|\|\||[;|\n&()`]|\$\(/).map((statement) => {
    let words = statement.trim().split(/\s+/).filter(Boolean);
    while (words.length && (/^\w+=/.test(words[0]) || /^\d+[smh]?$/.test(words[0]) || COMMAND_PREFIXES.includes(words[0]))) words = words.slice(1);
    const tool = baseName(words[0] ?? "").replace(/\.exe$/i, "");
    const args = words.slice(1);
    let i = 0;
    while (tool === "git" && i < args.length && args[i].startsWith("-")) i += /^-[Cc]$/.test(args[i]) ? 2 : 1;
    return { tool, args, sub: args.slice(i).find((w) => !w.startsWith("-")) ?? "" };
  });
}

// The init and clone options that take a value, so the value is not read as the repository's directory.
const GIT_VALUED = new Set(["-b", "--branch", "--initial-branch", "--template", "--separate-git-dir", "-o", "--origin", "--depth", "-c", "--config", "--reference", "-u", "--upload-pack", "--object-format"]);

/**
 * The repositories a command makes with `git init` or `git clone`, and the directory each of its commits runs in. A
 * variable the command sets, as `R="$TEMP/probe"` does, stands for its value; `cd` and `git -C` move where a statement runs.
 * @param {string} command @param {string} cwd
 * @returns {{ made: string[], inits: string[], clones: { from: string, to: string }[], commits: { dir: string, afterMade: string | null }[] }}
 */
function repoWork(command, cwd = "") {
  const made = [];
  const inits = [];
  const clones = [];
  const commits = [];
  const vars = new Map();
  const expand = (text) => text.replace(/\$\{?(\w+)\}?/g, (ref, name) => vars.get(name) ?? ref);
  for (const raw of command.replace(HEREDOC, "").split(/&&|\|\||[;|\n]/)) {
    // A loop or branch body's first statement follows `do`, `then` or `else`.
    const statement = raw.trim().replace(/^(do|then|else)\s+/, "");
    const assign = statement.match(/^(?:export\s+)?(\w+)=["']?([^"'\s;&|]*)["']?$/);
    if (assign) vars.set(assign[1], expand(assign[2]));
    const words = statement.split(/\s+/).filter((w) => w && !/^\d*>|^&>/.test(w)).map((w) => expand(unquote(w)));
    const within = (dir) => (!dir ? cwd : /^([/~$]|[A-Za-z]:)/.test(dir) ? dir : `${cwd}/${dir}`);
    if (words[0] === "cd" && words[1]) cwd = within(words[1]);
    const { tool, sub } = commandsIn(statement)[0] ?? {};
    // `git -C <dir>` runs in that directory, so an init there with no operand makes the repository at <dir>.
    const at = words[0] === "git" ? words.indexOf("-C") : -1;
    const base = at >= 0 ? within(words[at + 1] ?? "") : cwd;
    const inside = (dir) => (!dir ? base : /^([/~$]|[A-Za-z]:)/.test(dir) ? dir : `${base}/${dir}`);
    const operands = [];
    for (let i = words.indexOf(sub) + 1; tool === "git" && i > 0 && i < words.length; i++) {
      if (GIT_VALUED.has(words[i])) i++;
      else if (!words[i].startsWith("-")) operands.push(words[i]);
    }
    if (tool === "git" && sub === "init") {
      made.push(inside(operands[0]));
      inits.push(made.at(-1));
    }
    if (tool === "git" && sub === "clone") {
      made.push(inside(operands[1] ?? baseName(operands[0] ?? "").replace(/\.git$/, "")));
      clones.push({ from: inside(operands[0]), to: made.at(-1) });
    }
    if (Object.hasOwn(VCS, tool) && VCS[tool].includes(sub)) commits.push({ dir: base, afterMade: made.at(-1) ?? null });
  }
  return { made, inits, clones, commits };
}

const under = (dir, root) => {
  const [d, r] = [dir, root].map((p) => posix.normalize(gitBashPath(p)).replace(/\/+$/, "").toLowerCase());
  return d === r || d.startsWith(`${r}/`);
};

/**
 * The throwaway repositories a span's commands make, for a later commit to be judged by: a `git init` under a temp or
 * scratch directory, and a clone there of such a repository, as `git init --bare` then `git clone` sets up a fixture. A
 * clone of a real remote into a scratch directory is real work, so it is not one.
 * @param {readonly string[]} commands in order
 */
export function throwawayRepos(commands) {
  const out = [];
  for (const command of commands) {
    const { inits, clones } = repoWork(command);
    out.push(...inits.filter(isTemp));
    for (const c of clones) if (isTemp(c.to) && out.some((root) => under(c.from, root))) out.push(c.to);
  }
  return out;
}

/**
 * Whether a command's commit goes into a throwaway repository: one the same command made with `git init` or
 * `git clone` under a temp or scratch directory, or one an earlier command made, which the commit runs inside.
 * @param {string} command @param {readonly string[]} earlier the throwaway repositories earlier commands made
 */
export function initsRepo(command, earlier = []) {
  return repoWork(command).commits.some((c) => (c.afterMade !== null ? isTemp(c.afterMade) : earlier.some((root) => c.dir && under(c.dir, root))));
}

// A directory under the OS temp dir, a temp variable, or a scratch directory holds a throwaway repository.
const isTemp = (dir) => /(^|\/)\$\{?(TEMP|TMP|TMPDIR)\b|%TEMP%|\$\(mktemp/i.test(dir) || isScratch(`${posix.normalize(gitBashPath(dir || "."))}/`);

/**
 * The VCS and forge verbs a shell command runs, from one fixed table. It splits the command into statements, drops
 * leading `VAR=x` words and the prefixes that run the next command, and reads the verb after the tool and its options.
 * It expands no variable, loop or substitution; a heredoc body and a quoted string are text, not commands.
 * @param {string} command @returns {VcsVerb[]}
 */
export function vcsVerbs(command) {
  const out = [];
  for (const { tool, args, sub } of commandsIn(command)) {
    if (Object.hasOwn(VCS, tool) && VCS[tool].includes(sub)) out.push({ verb: "commit" });
    if (!Object.hasOwn(FORGES, tool)) continue;
    const has = (sequences) => sequences.some((seq) => args.some((_, i) => seq.every((s, k) => args[i + k] === s)));
    // `pr ready --undo` turns a PR back into a draft.
    if (has(FORGES[tool].open) && !args.includes("--undo")) out.push({ verb: "pr-open", draft: has(FORGES[tool].draft) });
    if (has(FORGES[tool].merge)) out.push({ verb: "pr-merge" });
  }
  return out;
}
