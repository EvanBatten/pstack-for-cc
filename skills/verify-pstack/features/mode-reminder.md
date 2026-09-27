# Mode reminder

The `/poteto-mode` command turns the mode on, and every prompt from that one on carries the `# pstack reminders` block until `/poteto-mode off`. A task notification is not a prompt and gets none. When the entering prompt reads as work the user reviews after stepping away, its reminder also asks to route it through figure-it-out. Reading `poteto-mode/SKILL.md` does not turn it on. A session that never ran the command gets nothing.

## How to get to it (user POV)

Type `/poteto-mode <task>`. The reminder is in context for that prompt and every later one.

## Driving it with drive.sh

The mode session (opus) pipes `/poteto-mode <task>` to `claude -p` on stdin. The judge asserts the transcript holds the `<command-name>/poteto-mode</command-name>` record, a `# pstack reminders` attachment before the first assistant record, and that the control session (haiku, no slash command) holds none.

## Gotchas

- The command goes on stdin. Git Bash rewrites a leading `/` in an argument into a Windows path, so `claude -p "/poteto-mode ..."` sends a path, not the command.
- No command record means the slash command never reached the session. The judge calls that INCONCLUSIVE, not a pass.
