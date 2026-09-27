# Step ledger

When an in-mode session reads a playbook, the hook hands back its numbered steps with their indented sub-items, verbatim, as a `# pstack step ledger: <title>` attachment, so the agent carries the steps it just read. A delegate spawned with a `Playbook: <title>` line gets the same ledger appended to its brief by the `PreToolUse` hook on `Agent`.

## How to get to it (user POV)

Under `/poteto-mode`, give a task that matches a playbook. The agent reads the playbook, and the ledger lands right after that read.

## Driving it with drive.sh

The mode session (opus) gets a bug in a seeded scratch repo and no playbook name. The judge finds the first read of a `playbooks/<name>.md` file, by the Read tool or by a Bash command, and asserts a ledger attachment follows it.

## Gotchas

- The hook is registered for `PostToolUse` on `Read` and on `Bash`. The `Bash` registration starts Node only when the payload names a path under `poteto-mode` and `playbooks`, and the hook then finds the playbooks the command reads the same way the audit does. A command that reads several playbooks gets one ledger per playbook.
- The playbook has to come from `~/.claude/skills`. A copy anywhere else is not the installed tree.
