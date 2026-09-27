# Port clean

The skills tree carries no Cursor affordance an agent would act on, every test passes, and `DRIFT.md` is current.

## How to get to it (user POV)

Run the three repo checks in the Doctor. CI runs the same ones.

## Driving it with drive.sh

The drive runs `check-port.mjs` over `skills` and `agents`, `node --test` over every tracked `*.test.js`, and `drift.mjs --check`, and saves each output beside the transcripts.

## Gotchas

- The check reads only what `install.json` links: under an agents root, the agent files it lists, and under any other root, the skill directories it lists and everything inside them. A root such as `~/.claude/skills` also holds skills from other places, and the check skips them. `make-bot-ui` must say it is not ported.
- A line that must keep a matched word carries `port-check: allow`. Use it for text that explains the substitution, never for text an agent would act on.
