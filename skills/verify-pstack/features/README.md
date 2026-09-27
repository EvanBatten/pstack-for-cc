# pstack behaviors

One file per verdict `scripts/drive.sh` prints, by the file's name.

- [Hook context](./hook-context.md) - every session and subagent receives the pstack session context
- [Mode reminder](./mode-reminder.md) - `/poteto-mode` turns on the reminder from its own prompt, and a session without it gets none
- [Step ledger](./step-ledger.md) - reading a playbook in the mode hands back its steps
- [Gate](./gate.md) - an in-mode turn ends with the playbook's steps carried and each Stop block answered, and a finding blocks once
- [Action gate](./action-gate.md) - an in-mode source write is denied once with the data-shape ask, and goes through after the session answers it
- [Reader](./reader.md) - a `pstack-reader` subagent's shell write is denied
- [Task tools](./task-tools.md) - TaskCreate is in the session's tool list
- [Port clean](./port-clean.md) - check-port, the tests and the drift check pass
