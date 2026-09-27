#!/usr/bin/env node
// pstack was ported from a Cursor plugin, and the port's substitutions caught
// the quoted forms of each affordance and missed the prose. Every rule below
// is one class that survived. Run it over the tree; it prints file:line and
// the reason, and exits 1 on any hit. port.test.js runs it in CI.
//
// A line that must keep a matched word carries `port-check: allow` and is
// skipped. Use that for text that explains the substitution, never for text
// an agent would act on.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { judgeFloor, OMIT_MODEL, roleLines } from "../hooks/catalog.mjs";
import { MODEL_TIERS } from "../hooks/kinds.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const roots = process.argv.length > 2 ? process.argv.slice(2) : [join(here, "..", ".."), join(here, "..", "..", "..", "agents")];

const DESCRIBES_THE_PORT = [
  /verify-pstack/,
  /poteto-mode[\\/]scripts[\\/](check-port|port-codemod)\.mjs$/,
  /poteto-mode[\\/]scripts[\\/]port\.test\.js$/,
];
// Node realpaths this script through the ~/.claude/skills link, so `here` is inside the repo.
const install = JSON.parse(readFileSync(join(here, "..", "..", "..", "install.json"), "utf8"));
const LISTED_SKILLS = new Set(install.skills.paths.map((p) => basename(p)));
const LISTED_AGENTS = new Set(install.agents.paths.map((p) => basename(p)));
const SNAPSHOTS = /[\\/]fixtures[\\/]repos[\\/]/;
const SKIP = [/[\\/]node_modules[\\/]/, SNAPSHOTS];
const PORT_TEXT = (p) => /\.(md|mjs|ts|sh|json)$/.test(p) && !DESCRIBES_THE_PORT.some((re) => re.test(p));
const SHIPPED = (p) => !/\.test\.[cm]?[jt]s$|[\\/](fixtures|tests?)[\\/]/.test(p);

const RULES = [
  ["vendored-path", /pstack\/skills\//, "skills are installed at ~/.claude/skills, not vendored in the work repo"],
  ["trunk-reread", /git show origin\/main:/, "re-read a skill from its file under ~/.claude/skills"],
  ["goal", /(^|[^\w/])\/goal\b/, "Cursor's standing objective; use `orch standing add` and `orch standing show`"],
  ["run-in-background", /\brun_in_background\b/, "not an Agent parameter; background is implicit"],
  ["readonly", /`readonly`|readonly:\s*(true|false)|\bAsk mode\b|\bagent mode\b/, "no Agent readonly parameter or chat modes; spawn `subagent_type: \"pstack-reader\"`"],
  ["environment", /`environment`|environment:\s*"/, "Agent takes `isolation`, not `environment`"],
  ["task-tool", /`Task`|\bTask (schema|tool|subagent)\b/, "the Agent tool"],
  ["paths-frontmatter", /^paths:/, "Cursor auto-attach field; Claude Code triggers a skill on its description"],
  ["mode-frontmatter", /^(mode: true|reminder:)/, "Cursor mode fields Claude Code ignores; the session hook holds the mode open"],
  ["cursor", /\bCursor\b/, "Cursor-specific text"],
  ["tmp", /(^|[^\w.])\/tmp\b/, "hard-coded /tmp; name the scratchpad directory the system prompt gives"],
  ["allow-multiple", /\ballow_multiple\b/, "AskUserQuestion takes `multiSelect`"],
  ["todo", /\btodolist\b|\btodo items?\b|\bopen todos\b/, "the task list is TaskCreate and TaskUpdate (deferred, through ToolSearch), with a list in the reply where no task tool exists"],
  ["is-background", /^is_background:/, "Cursor's agent field; Claude Code's is `background: true`"],
  ["reader-spawn", /^\s*-\s*read-only\b/i, "a read-only spawn is `subagent_type: \"pstack-reader\"`, which cannot write"],
  ["skill-creator", /(?<!anthropic-skills:)\bskill-creator\b/, "reach it as `anthropic-skills:skill-creator` through the Skill tool"],
  ["principle-skill", /\bprinciple skills?\b/, "principles are files; write **principle-<slug>**"],
  ["leaf-skill", /leaf SKILL\.md/, "principles are files under poteto-mode/principles/"],
  ["loop-vocabulary", /\bdynamic mode\b|output-notification sentinel|monitored-shell/, "Claude Code's /loop takes an interval or self-paces"],
  ["cloud-agent", /\bcloud (agents?|workers?)\b|\blane VM\b|Cursor dashboard/, "a cloud session is `isolation: \"remote\"` on Agent, or `claude --cloud`"],
  ["macos-ungated", /^(?!.*macOS).*(xcrun|simctl|Application Support)/, "macOS-only step; name the platform on the same line"],
  ["model-family", /\bmodel famil(y|ies)\b|\bcross-(family|model)\b|\bdifferent (model )?famil/i, "Claude Code reaches only Claude models; independence is a fresh context and blind labels"],
];

const SEP = String.raw`(?:\\{1,2}|/)`;

// The owner's own project and tool names, one regex per line, from a file kept out of the repo: `.port-check-terms` at
// the repo root, or the file `PORT_CHECK_TERMS` names. A term matches in any case, also where `_` or `-` joins it to
// another word. With no file, the rule is off.
const termsFile = process.env.PORT_CHECK_TERMS || join(here, "..", "..", "..", ".port-check-terms");
const terms = existsSync(termsFile)
  ? readFileSync(termsFile, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
  : [];
const PROJECT_TERM = terms.length
  ? ["project-term", new RegExp(`(?<![a-z0-9])(?:${terms.join("|")})(?![a-z0-9])`, "i"), "names one project or user's tooling; say what any project would have"]
  : null;
const homePath = (allowed) => [
  "home-path",
  new RegExp(String.raw`(?<![\w.])(?:[a-z]:|/[a-z](?=/))?${SEP}(?:users|home)${SEP}(?![<$%{]${allowed})[^\\/\s<>"'\x60*]+${SEP}`, "i"),
  "names one machine's home directory; write `~/.claude/...` or a placeholder segment such as `<name>`, or the user `me` in a test or fixture",
];

const SHIPPED_RULES = [
  ...(PROJECT_TERM ? [PROJECT_TERM] : []),
  homePath(""),
  ["home-ref", /(?<![\w.$~/-])~\/(?=[\w.-])(?!\.claude(?:[/`'")\s]|$))/, "names a file in one user's home; only `~/.claude/...` is on every install"],
];

// A test or fixture needs a concrete home, and `me` names no one's.
const TEST_RULES = [...(PROJECT_TERM ? [PROJECT_TERM] : []), homePath(String.raw`|me${SEP}`)];

const commandRegex = {
  test(line) {
    for (const m of line.matchAll(/\^\((?:\?:)?/g)) {
      const alternatives = [];
      let depth = 1;
      let start = m.index + m[0].length;
      let i = start;
      for (; i < line.length && depth > 0; i++) {
        if (line[i] === "\\") i++;
        else if (line[i] === "(") depth++;
        else if (line[i] === ")") depth--;
        else if (line[i] === "|" && depth === 1) {
          alternatives.push(line.slice(start, i));
          start = i + 1;
        }
      }
      if (depth === 0) alternatives.push(line.slice(start, i - 1));
      if (alternatives.filter((a) => /^[a-z][a-z0-9-]*$/.test(a)).length >= 3) return true;
    }
    return false;
  },
};

const MODEL_VALUES = [...MODEL_TIERS, ...OMIT_MODEL];
const MODEL_DEFAULT_WHY = `a shipped model default takes ${MODEL_VALUES.map((v) => `\`${v}\``).join(", ")}`;

function modelDefaults(line) {
  if (!/\b(configured|model)\b/i.test(line)) return [];
  return [...line.matchAll(/\bdefaults?\s+((?:`[^`]+`(?:,\s*|,?\s+and\s+)?)+)/gi)].flatMap((m) => [...m[1].matchAll(/`([^`]+)`/g)].map((v) => v[1]));
}

const HOOK_RULES = [["command-regex", commandRegex, "a command vocabulary in a regex; keep the words as data in hooks/kinds.mjs and build the test from it"]];
const HOOK_CODE = (p) => /\/hooks\/(?!kinds\.mjs$)[^/]+\.mjs$/.test(p);

const SCOPES = [
  [PORT_TEXT, RULES],
  [SHIPPED, SHIPPED_RULES],
  [(p) => !SHIPPED(p), TEST_RULES],
  [HOOK_CODE, HOOK_RULES],
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP.some((re) => re.test(p))) continue;
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

const listed = (root, name) => (basename(root) === "agents" ? !name.endsWith(".md") || LISTED_AGENTS.has(name) : LISTED_SKILLS.has(name));

function* pstackFiles(root) {
  for (const name of readdirSync(root)) {
    const p = join(root, name);
    if (!listed(root, name) || SKIP.some((re) => re.test(p))) continue;
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

const hits = [];
for (const root of roots) {
  for (const file of pstackFiles(root)) {
    const rel = relative(root, file).replaceAll("\\", "/");
    const rules = SCOPES.flatMap(([inScope, scoped]) => (inScope(`/${rel}`) ? scoped : []));
    if (!rules.length) continue;
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    const table = basename(file) === "pstack-models.md";
    const skillText = !table && rel.endsWith(".md") && PORT_TEXT(`/${rel}`);
    lines.forEach((line, i) => {
      if (line.includes("port-check: allow")) return;
      for (const [id, re, why] of rules) if (re.test(line)) hits.push(`${rel}:${i + 1}: ${id}: ${why}`);
      if (skillText)
        for (const value of modelDefaults(line)) if (!MODEL_VALUES.includes(value)) hits.push(`${rel}:${i + 1}: model-default: the default is ${value}; ${MODEL_DEFAULT_WHY}`);
    });
    if (table) {
      for (const r of roleLines(text))
        for (const value of r.values) if (!MODEL_VALUES.includes(value)) hits.push(`${rel}:${r.line}: model-default: ${r.label} lists ${value}; ${MODEL_DEFAULT_WHY}`);
      for (const f of judgeFloor(text))
        hits.push(`${rel}:${f.line}: judge-floor: ${f.role} lists ${f.value}; a judgment role takes inherit-parent, auto or ${MODEL_TIERS[0]}`);
    }
  }
}

// A skill that cannot be ported must say so where an agent will read it.
for (const root of roots) {
  try {
    if (!readFileSync(join(root, "make-bot-ui", "SKILL.md"), "utf8").includes("Not ported to Claude Code")) {
      hits.push("make-bot-ui/SKILL.md:1: not-ported: the skill targets Cursor routines and must open by saying it is not ported to Claude Code");
    }
  } catch {}
}

hits.sort();
for (const h of hits) console.log(h);
console.log(`${hits.length} finding${hits.length === 1 ? "" : "s"}`);
process.exit(hits.length ? 1 : 0);
