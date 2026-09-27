#!/usr/bin/env node
// Stands in for the two always-on pieces pstack has upstream: the
// `pstack-models.mdc` alwaysApply rule and the system prompt naming the
// transcript directory. Register it for SessionStart, SubagentStart and
// UserPromptSubmit in ~/.claude/settings.json.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const skills = join(homedir(), ".claude", "skills").replaceAll("\\", "/");
const here = dirname(fileURLToPath(import.meta.url));

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  input = {};
}

const event = input.hook_event_name || "SessionStart";

const emit = (additionalContext) =>
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: event, additionalContext },
    }),
  );

// Upstream holds poteto mode open across turns through `mode: true` and the
// skill's `reminder:` field, which Claude Code ignores. Without this branch
// the non-negotiables a 2026-09-21 transcript showed going quiet decay after
// the single injection at session start.
const MODE_MARKERS = [
  "<command-name>/poteto-mode</command-name>",
  "The Principles section below grounds every trigger",
];

if (event === "UserPromptSubmit") {
  const path = input.transcript_path;
  const transcript =
    path && existsSync(path) ? readFileSync(path, "utf8") : "";
  if (!MODE_MARKERS.some((m) => transcript.includes(m))) {
    process.exit(0);
  }
  emit(`# pstack reminders

Poteto mode is live in this session. Before the next reply:

- Name each principle that shaped a decision and the choice it changed. Read \`${skills}/poteto-mode/principles/<slug>.md\` in full before citing it.
- A trigger that names a skill (the **how** skill, \`/architect\`, \`interrogate\`, \`swarm\`) means read that skill's \`SKILL.md\` in full and carry it out. Skimming it does not satisfy the trigger. Choosing not to run it is a \`skip: <reason>\` line in the step list.
- Carry the matched playbook's steps as a verbatim list in the reply, each with its state. This harness has no todo-list tool.

A casual turn, or the user opting out, cancels all of this.
`);
  process.exit(0);
}

// The last entry is the table beside this file, so a fresh clone or a CI
// runner with no ~/.claude at all still gets a table.
const modelsPath = [
  process.env.PSTACK_MODELS_FILE,
  join(homedir(), ".claude", "pstack-models.md"),
  join(skills, "poteto-mode", "pstack-models.md"),
  join(here, "..", "pstack-models.md"),
].find((p) => p && existsSync(p));
const models = readFileSync(modelsPath, "utf8").trim();

const transcripts = input.transcript_path
  ? dirname(input.transcript_path).replaceAll("\\", "/")
  : "~/.claude/projects/<slug>/";

emit(`# pstack session context

pstack skills directory: \`${skills}\`
Transcript directory for this workspace: \`${transcripts}\` (one \`<session-id>.jsonl\` per chat, subagents under \`<session-id>/subagents/\`).
Orchestrate store root: \`~/.claude/orchestrate/\`. A program keeps its store at \`<root>/<project-slug>\` and passes it as \`orch --store\`.

## Resolving pstack skills

Most pstack skills are user-invoked, so the Skill tool refuses them. When a pstack skill or playbook names another pstack skill (the **how** skill, \`/architect\`, \`control-ui\`), open \`${skills}/<name>/SKILL.md\` with Read, read it in full, and carry out its steps. A trigger that names a skill is an instruction to run it, not a pointer to skim. A name that starts with \`principle-\` is a file, not a skill: open \`${skills}/poteto-mode/principles/<rest-of-name>.md\`. Relative paths inside a skill (\`playbooks/\`, \`references/\`, \`scripts/\`) resolve against that skill's own directory. Subagents get this same context.

## Tool mapping

- A \`Task\` or subagent spawn is the Agent tool. \`poteto-agent\` is \`subagent_type: "poteto-agent"\` and Comment Sicko is \`subagent_type: "comment-sicko"\`.
- Model values below are Agent \`model\` aliases (\`fable\`, \`opus\`, \`sonnet\`, \`haiku\`). \`inherit-parent\` or \`auto\` means omit \`model\`.
- Once \`/poteto-mode\` has been invoked in this session: new task with a playbook match or rigor needed, apply it again. Casual turn or the user opts out, don't.

## Model configuration (from \`${modelsPath.replaceAll("\\", "/")}\`)

${models}
`);
