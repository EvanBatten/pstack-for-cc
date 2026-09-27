# Hook context

Every session and every subagent starts with the pstack session context: the skills directory, the transcript directory, the orchestrate store root, the skill-resolution rule, and the model table.

## Sub-features

- The `SessionStart` injection.
- The `SubagentStart` injection, so a delegate can resolve a named skill. `poteto-agent` and `pstack-reader` also get the mode reminder.
- The model table comes from `~/.claude/pstack-models.md` when it exists, else the skill's default.

## How to get to it (user POV)

Start any session. The hook fires before the first prompt.

## Driving it with drive.sh

The mode session (opus) and the control session (haiku) both receive it. The judge finds an `attachment` record in each transcript whose content opens with `# pstack session context` and names `Orchestrate store root`.

## Gotchas

- The context is a `hook_additional_context` attachment, not a user message.
- A session resumed with `--resume` gets a second injection. Two is normal.
