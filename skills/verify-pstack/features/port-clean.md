# Port clean

The skills tree carries no text that assumes a Cursor affordance an agent would act on, and the gates pstack ships pass in their Claude Code form.

## Sub-features

- `check-port.mjs` reports `0 findings` over the tree.
- `port.test.js` proves the check fires on each class it exists for, and that the hook emits the right thing for each event.
- `check-plan.test.js` proves a multi-phase plan written for Claude Code passes the plan gate and one still armed with Cursor's `/goal` fails.

## How to get to it (user POV)

Run the Doctor commands. CI runs the same tests on every push and pull request through the repo's `*.test.js` glob.

## Driving it with drive.sh

The drive runs the check and both test files at the end and records their output beside the transcripts.

## Gotchas

- The check skips the five skills that never came from pstack and `make-bot-ui`, which is marked not ported. A finding in a new skill means the rule set applies to it; add the skill to the skip list only when it was never a port.
- A line that must keep a matched word carries `port-check: allow`. Use it for text that explains the substitution, never for text an agent would act on.
