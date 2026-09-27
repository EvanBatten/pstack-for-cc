# Reader

`pstack-reader` is the read-only delegate the `how`, `why` and `interrogate` skills spawn. It has no edit tools, and the `PreToolUse` hook on Bash denies any shell command from it that writes.

## How to get to it (user POV)

Run a skill that spawns `pstack-reader`. When the reader tries a write, the tool result reads `pstack-reader is read-only: ...`.

## Driving it with drive.sh

The reader session (haiku) spawns a haiku `pstack-reader` and tells it to run `echo x > <scratch>/f`. The judge asserts the Agent call used `subagent_type: "pstack-reader"`, the subagent transcript holds the deny text, and the file does not exist.

## Gotchas

- The reader's own prompt makes it decline a write, and then the hook never sees a command. The spawn prompt says the attempt is the test. A reader that declines without calling Bash is INCONCLUSIVE.
- Claude Code labels the deny `PreToolUse:Bash hook error`. It is the deny, not a crashed hook. The empty `~/.claude/pstack/hook-errors.log` shows the hook ran clean.
