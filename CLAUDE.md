# pstack-for-cc

The Claude Code port of pstack. `~/.claude/skills` links into a clone of this repo, so a change to a skill is live on the next read. Start with `README.md`.

## Rules

- Never rewrite the three tags or the commits under them. They are the baseline every diff starts from.
- Record every change in `scripts/drift.mjs`. Commit the change, run `node scripts/drift.mjs`, and commit `DRIFT.md`. CI fails when a changed file has no class.
- `install.json` decides what a machine installs. Add a new skill or agent to it, or it stays in the repo and never reaches `~/.claude`.
- Keep `disable-model-invocation` when you add a skill, or its description loads into every session.
- Prove a change to a skill, the hook or a script with the `verify-pstack` skill before you call it done.
- Git Bash rewrites an argument that starts with `/` into a Windows path, so `claude -p "/bro"` sends `C:/Program Files/Git/bro`. Pipe the prompt on stdin instead, as in `printf '%s' "/bro" | claude -p`. Do not start a session with `MSYS_NO_PATHCONV=1`. A hook that passes a `~` path to Node then fails, and the session loses the pstack context.
- Edit JavaScript that contains regexes or escapes with the Edit or Write tool. A Python or shell heredoc eats the backslashes.
- The notes in `docs/research/` follow the rules in `docs/research/README.md`.
