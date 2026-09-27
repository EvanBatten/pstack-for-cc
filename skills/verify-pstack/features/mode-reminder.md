# Mode reminder

Once a session has entered poteto mode, every later prompt carries a four-line reminder of the non-negotiables that decay otherwise: cite principles, run a named skill rather than skim it, carry the playbook's steps as a list. A session that never entered the mode gets nothing.

## Sub-features

- Entering the mode by the slash command `/poteto-mode`.
- Entering the mode by reading `poteto-mode/SKILL.md`, which is how a delegate or a `-p` session gets there.
- Silence in every other session.

## How to get to it (user POV)

Invoke `/poteto-mode <task>`, then send any second prompt. The reminder is in context for that prompt and every one after.

## Driving it with drive.sh

Turn one of the mode session reads the skill file, which plants the marker the hook matches on. Turn two is a second prompt on the same session. The drive asserts the mode transcript holds at least one `# pstack reminders` attachment and the control transcript holds none.

## Gotchas

- The prompt that enters the mode does not itself get the reminder; the marker is not in the transcript yet when the hook runs. The next prompt does.
- The hook reads the whole transcript on each prompt. A very large transcript costs milliseconds, not seconds.
