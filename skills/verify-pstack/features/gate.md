# Gate

The Stop hook blocks an in-mode stop on a finding one of the rules in `gate.mjs` can see for certain. The reply cites a principle whose file was never read, or a visible text of the turn carries the long dash. The session worked and never read the unslop skill. It edited files or committed and read no principle. It opened task items, kept working, and never updated one. A trail playbook is live and nothing wrote a decision trail, where a shell append to a decision log, a `log.sh` run or a `skip show-me-your-work:` line in the reply counts. A `claude -p` session is about to end while a background shell runs and no Monitor or background agent keeps it open. Each finding ends with a `[pstack:<rule>:<hash>]` tag and blocks once per mode span, so the stop after a block passes. The headless finding blocks up to 3 times per background task. A block holds every finding at once. A stop the hook re-entered, with `stop_hook_active` set, passes on every tag its previous stop would have blocked, and passes outright when its turn has no previous stop, so a block whose feedback never reached the transcript cannot repeat. The model gets the reason as `Stop hook feedback`, which ends by asking for the complete final answer again, and replies again.

The Stop hook also logs, without blocking, each doc-read ask refused since the turn's previous stop whose call then went through with the doc still unread. The line goes to `~/.claude/pstack/retry-unmet.log`, which keeps the rate of retries that skip the read visible.

## How to get to it (user POV)

Under `/poteto-mode`, finish a playbook task with a reply that uses the long dash or cites a principle it never read. The turn does not end, and the agent comes back with the reply fixed.

## Driving it with drive.sh

Read from the mode session (opus). The steps come from the ledger, or from the playbook file the session read when no ledger arrived. A blocked Stop does not end the turn, so the judge grades every assistant reply since the entering prompt, in order: a later reply's mention of a step number replaces an earlier one, and the turn passes when the merged replies (or the session's TaskCreate items) carry every step with a state and the last reply has no long dash. The hook's feedback for one block lands three times in the transcript (a meta user message, then an attachment, then a system summary), and the judge keys on the user record so one block counts once. VERIFIED also requires each block to be answered. Either a later reply addresses each finding it named (the named file is read, a `skip` line names the skill, a line names the route, or the long dash is gone), or the gate's own rules, run again at the turn's last stop with no tag counted, no longer find a tag it named. A block with neither is NOT VERIFIED.

## Gotchas

- A reply that is clean on the first try needs no block, so a pass often shows no block at all. The drive proves the reply ends right, and `gate.test.js` proves each rule blocks once with its literal text.
- The gate no longer checks the step list. The ledger ask opens the task list at the first call after a playbook read, and the step-done ask meets a completed step whose skill is unread.
- Opus is needed here. A small model rarely reads a playbook without being told to.
- `judge.test.js` fixtures real blocked-then-fixed turns from before the tags, which the text checks judge, and two tagged turns built from the gate's own block text, where a principle read after the block clears it and its absence leaves it unresolved.
