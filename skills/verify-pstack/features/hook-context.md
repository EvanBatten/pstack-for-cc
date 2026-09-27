# Hook context

Every session, and every subagent, starts with the pstack session context in front of it: the skills directory, the transcript directory, the orchestrate store root, the skill-resolution rule, and the model table.

## Sub-features

- The `SessionStart` injection, once per session and again on resume.
- The `SubagentStart` injection, so a delegate can resolve a named skill.
- The model table comes from `~/.claude/pstack-models.md` when it exists, else the skill's default.

## How to get to it (user POV)

Start any session. There is nothing to click; the hook fires before the first prompt.

## Driving it with drive.sh

Both headless sessions the drive starts receive it. The drive reads each transcript for an `attachment` record whose content opens with `# pstack session context` and names `Orchestrate store root`.

## Gotchas

- The context is a `hook_additional_context` attachment in the transcript, not a user message, so a grep for the heading is the honest check.
- A session resumed with `--resume` gets a second injection. Two is normal.
