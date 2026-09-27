#!/usr/bin/env node
// Usage: node scripts/replay-demands.mjs <transcript.jsonl>... | --list <file of paths>
// Replays the PreToolUse asks over each in-mode call a registered matcher reaches, as a live session meets them: a tag
// the replay raised stays raised for the rest of the mode span, so a one-shot ask is asked once and a hard ask at most
// three times. A deny carries one ask, so a call is replayed again after each one-shot deny, as its retry would be. Nothing is read from disk but the transcripts, so a replay gives the same rows on any machine.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { check, RULES, spanOf } from "../skills/poteto-mode/hooks/asks.mjs";
import { loadCatalog, modelsFile, modelTable } from "../skills/poteto-mode/hooks/catalog.mjs";
import { actorsOf, modeOf, readClaudeTrace } from "../skills/poteto-mode/hooks/trace.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = loadCatalog(join(repo, "skills"));
const models = modelTable(modelsFile());
const manifest = JSON.parse(readFileSync(join(repo, "install.json"), "utf8"));
const reaches = (tool) => manifest.hooks.PreToolUse.some((g) => new RegExp(`^(?:${g.matcher})$`).test(tool));
const TOOLS = { read: "Read", write: "Edit", shell: "Bash", spawn: "Agent", todo: "TaskCreate", skill: "Skill" };
const HARD_KEYS = new Set(RULES.filter((r) => r.mode === "hard").map((r) => r.key));
// `--offline` was the old runtime's switch off disk reads. The asks read nothing but the transcripts, so it is accepted and changes nothing.
const args = process.argv.slice(2).filter((a) => a !== "--offline");
const paths = args[0] === "--list" ? readFileSync(args[1], "utf8").split(/\r?\n/).filter(Boolean) : args;

const summary = (a) => (a.kind === "shell" ? a.command : a.kind === "write" ? `${a.tool} ${a.path}` : a.kind === "todo" ? `${a.op} ${a.items[0]?.subject ?? ""}` : a.kind === "other" ? a.tool : a.kind).replace(/\s+/g, " ").slice(0, 90).replaceAll("|", "\\|");

console.log("| transcript | line | actor | tag | call |\n|---|---|---|---|---|");
let calls = 0;
let denies = 0;
for (const path of paths) {
  const trace = readClaudeTrace(path);
  for (const actor of actorsOf(trace)) {
    const mode = modeOf(actor);
    if (!mode.on) continue;
    const lines = readFileSync(actor.path, "utf8").split("\n");
    const lineOf = (id) => lines.findIndex((l) => l.includes(`"id":"${id}"`)) + 1;
    const raised = new Map();
    for (const turn of actor.turns.slice(mode.since))
      for (const action of turn.actions) {
        if (!action.id || !reaches(action.kind === "other" ? action.tool : TOOLS[action.kind])) continue;
        calls++;
        const span = spanOf(actor, action.id, new Set(), catalog);
        const asked = new Map(span.asked);
        for (const [id, n] of raised) asked.set(id, Math.max(asked.get(id) ?? 0, n));
        // A deny carries one ask, and the worker retries a one-shot ask unchanged, which meets the next owed ask. A hard
        // ask refuses the call until it changes, so the recording's next call is the retry.
        for (;;) {
          const verdict = check({ ...span, asked }, action, catalog, models);
          if (verdict.kind !== "deny") break;
          for (const id of verdict.ids) {
            raised.set(id, (raised.get(id) ?? 0) + 1);
            asked.set(id, (asked.get(id) ?? 0) + 1);
            denies++;
            console.log(`| ${actor.path === path ? path : `${path} > ${actor.id}`} | ${lineOf(action.id)} | ${actor.sub ? actor.sub.agentType : "main"} | \`[pstack:${id}]\` | \`${summary(action)}\` |`);
          }
          if (verdict.ids.some((id) => HARD_KEYS.has(id.slice(0, id.indexOf(":"))))) break;
        }
      }
  }
}
console.log(`\n${paths.length} transcripts, ${calls} in-mode calls, ${denies} asks`);
