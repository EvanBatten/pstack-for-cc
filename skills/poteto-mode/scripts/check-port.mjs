#!/usr/bin/env node
// Finds text in the installed skills that still assumes a Cursor affordance.
// pstack was ported from a Cursor plugin, and the port's substitutions caught
// the quoted forms of each affordance and missed the prose. Every rule below
// is one class that survived. Run it over the tree; it prints file:line and
// the reason, and exits 1 on any hit. port.test.js runs it in CI.
//
// A line that must keep a matched word carries `port-check: allow` and is
// skipped. Use that for text that explains the substitution, never for text
// an agent would act on.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ?? join(here, "..", "..");

// Files that describe the port rather than instruct an agent (UPSTREAM.md and
// the verify-pstack skill), and the skills that were never part of it (they
// came from elsewhere and may say Cursor meaning a pagination cursor).
const SKIP = [
  /[\\/]node_modules[\\/]/,
  /poteto-mode[\\/]UPSTREAM\.md$/,
  /verify-pstack/,
  /poteto-mode[\\/]scripts[\\/](check-port|port-codemod)\.mjs$/,
  /poteto-mode[\\/]scripts[\\/]port\.test\.js$/,
  /[\\/](api-design|deep-research|documentation-lookup|search-first|security-review|hard-rules)[\\/]/,
];

const RULES = [
  ["vendored-path", /pstack\/skills\//, "skills are installed at ~/.claude/skills, not vendored in the work repo"],
  ["trunk-reread", /git show origin\/main:/, "re-read a skill from its file under ~/.claude/skills"],
  ["goal", /(^|[^\w/])\/goal\b/, "Cursor's standing objective; use `orch standing add` and `orch standing show`"],
  ["run-in-background", /\brun_in_background\b/, "not an Agent parameter; background is implicit"],
  ["readonly", /`readonly`|readonly:\s*(true|false)|\bAsk mode\b|\bagent mode\b/, "no Agent readonly parameter or chat modes; say \"read-only, change no files\" in the prompt"],
  ["environment", /`environment`|environment:\s*"/, "Agent takes `isolation`, not `environment`"],
  ["task-tool", /`Task`|\bTask (schema|tool|subagent)\b/, "the Agent tool"],
  ["paths-frontmatter", /^paths:/, "Cursor auto-attach field; Claude Code triggers a skill on its description"],
  ["mode-frontmatter", /^(mode: true|reminder:)/, "Cursor mode fields Claude Code ignores; the session hook holds the mode open"],
  ["cursor", /\bCursor\b/, "Cursor-specific text"],
  ["tmp", /(^|[^\w.])\/tmp\b/, "hard-coded /tmp; name the scratchpad directory the system prompt gives"],
  ["allow-multiple", /\ballow_multiple\b/, "AskUserQuestion takes `multiSelect`"],
  ["todo", /\btodolist\b|\btodo items?\b|\bopen todos\b/, "no todo tool; carry the step list in the reply"],
  ["skill-creator", /(?<!anthropic-skills:)\bskill-creator\b/, "reach it as `anthropic-skills:skill-creator` through the Skill tool"],
  ["principle-skill", /\bprinciple skills?\b/, "principles are files; write **principle-<slug>**"],
  ["leaf-skill", /leaf SKILL\.md/, "principles are files under poteto-mode/principles/"],
  ["loop-vocabulary", /\bdynamic mode\b|output-notification sentinel|monitored-shell/, "Claude Code's /loop takes an interval or self-paces"],
  ["cloud-agent", /\bcloud (agents?|workers?)\b|\blane VM\b|Cursor dashboard/, "a cloud session is `isolation: \"remote\"` on Agent, or `claude --cloud`"],
  ["macos-ungated", /^(?!.*macOS).*(xcrun|simctl|Application Support)/, "macOS-only step; name the platform on the same line"],
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP.some((re) => re.test(p))) continue;
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(md|mjs|ts|sh|json)$/.test(name)) yield p;
  }
}

const hits = [];
for (const file of walk(root)) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes("port-check: allow")) return;
    for (const [id, re, why] of RULES) {
      if (re.test(line)) hits.push(`${relative(root, file).replaceAll("\\", "/")}:${i + 1}: ${id}: ${why}`);
    }
  });
}

// A skill that cannot be ported must say so where an agent will read it.
const botUi = join(root, "make-bot-ui", "SKILL.md");
try {
  if (!readFileSync(botUi, "utf8").includes("Not ported to Claude Code")) {
    hits.push("make-bot-ui/SKILL.md:1: not-ported: the skill targets Cursor routines and must open by saying it is not ported to Claude Code");
  }
} catch {}

hits.sort();
for (const h of hits) console.log(h);
console.log(`${hits.length} finding${hits.length === 1 ? "" : "s"}`);
process.exit(hits.length ? 1 : 0);
