#!/usr/bin/env node
// Stands in for the two always-on pieces pstack has in Cursor: the
// `pstack-models.mdc` alwaysApply rule and the system prompt naming the
// transcript directory. Runs on SessionStart and SubagentStart.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..").replaceAll("\\", "/");

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  input = {};
}

const modelsPath = [
  process.env.PSTACK_MODELS_FILE,
  join(homedir(), ".claude", "pstack-models.md"),
  join(root, "pstack-models.md"),
].find((p) => p && existsSync(p));
const models = readFileSync(modelsPath, "utf8").trim();

const transcripts = input.transcript_path
  ? dirname(input.transcript_path).replaceAll("\\", "/")
  : "~/.claude/projects/<slug>/";

const context = `# pstack session context (Claude Code port)

pstack plugin root: \`${root}\`
Transcript directory for this workspace: \`${transcripts}\` (one \`<session-id>.jsonl\` per chat, subagents under \`<session-id>/subagents/\`).

## Resolving pstack skills

pstack skills are user-invoked, so the Skill tool refuses them. When a pstack skill, playbook, or principle names another pstack skill (the **how** skill, \`/unslop\`, **principle-prove-it-works**, \`control-ui\`), open \`${root}/skills/<name>/SKILL.md\` with Read and follow it. Relative paths inside a skill (\`playbooks/\`, \`references/\`, \`scripts/\`) resolve against that skill's own directory. Subagents get this same context.

## Tool mapping

- A \`Task\` or subagent spawn is the Agent tool. \`poteto-agent\` is \`subagent_type: "pstack:poteto-agent"\` and Comment Sicko is \`subagent_type: "pstack:comment-sicko"\`.
- \`readonly: true\` has no Agent parameter. Say "read-only, change no files" in the subagent prompt instead. \`run_in_background\` is implicit.
- Model values below are Agent \`model\` aliases (\`fable\`, \`opus\`, \`sonnet\`, \`haiku\`). \`inherit-parent\` or \`auto\` means omit \`model\`.
- Once \`/pstack:poteto-mode\` has been invoked in this session: new task with a playbook match or rigor needed, apply it again. Casual turn or the user opts out, don't.

## Model configuration (from \`${modelsPath.replaceAll("\\", "/")}\`)

${models}
`;

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: input.hook_event_name || "SessionStart",
      additionalContext: context,
    },
  }),
);
