# pstack behaviors

One file per behavior a session can observe. `scripts/drive.sh` prints one verdict per file here, by the file's name.

- [Hook context](./hook-context.md) - every session and subagent receives the pstack session context with the three paths and the model table
- [Mode reminder](./mode-reminder.md) - once a session has entered poteto mode, each later prompt carries the reminder, and a session that never entered it gets none
- [Playbook run](./playbook-run.md) - a task under the mode is carried as the matched playbook's steps, with the artifact the playbook requires in the reply
- [Port clean](./port-clean.md) - the skills tree carries no Cursor affordance an agent would act on, and the gates written for Claude Code pass
