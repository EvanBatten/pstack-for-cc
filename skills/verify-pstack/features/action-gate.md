# Action gate

In a poteto-mode session the `PreToolUse` hook asks `asks.mjs` what the pending call owes before it runs. `triggersOf` reads the call's structured input alone: an edit tool's path, a task tool's items, a spawn's brief, an MCP tool name, or a VCS or forge verb from one fixed table. Each rule in `RULES` on that trigger raises an ask when a doc it names is unread, when it names no doc, or when it asks for a line no check can verify. The asks one call raises merge into one deny, and each ask ends with its own `[pstack:<key>:<hash>]` tag, where the hash is 8 hex digits of the ask's target. The deny lands in the transcript as the call's errored tool_result, and the hook reads the tags back from there.

An ask is one-shot. Its tag, once in the transcript, lets every later call with the same tag through in that mode span, with no check of whether the worker complied. A worker that decides an ask does not apply writes a `skip <name>: <reason>` line for the user and retries. Three asks are hard, because their answer is literal in the next call: a task subject that spans a step range, a delegate off its role's model, and a draft PR. A hard ask denies again while the call still does what it refuses, 3 times in all per tag.

The first source edit of each turn, for example, is asked for a `**Shape.**` line alone, written in the reply before the edit is retried unchanged. The next code edit after that deny is asked, once per mode span, to read `principles/model-the-domain.md` if it is unread, and that deny says to read architect first when the change crosses a function boundary. Under a playbook with a delegation step, a first code edit inside a repository with no subagent spawned since the playbook was read is first asked to spawn one on the playbook's role model. Walking up to a VCS directory is the only filesystem read an ask makes, and the hook takes it from its deps, so a test injects it. Each deny asks for one thing, because a deny that asked for the line and the read together got the read 5 times out of 5 and the line none. Other asks cover the task ledger, a merged task item, a completed step whose skill is unread, skill-document and documentation edits, the decision log, commits, PR open and merge, and a brief that cites an unread principle.

Outside the mode the filtered registrations source `hooks/in-mode.sh`, which reads the payload with the `read` builtin and exits before Node starts unless `~/.claude/pstack/live/<session_id>` exists or the payload names `poteto-agent`, `pstack-reader` or a playbook path. Node re-derives mode from the transcript on every event it sees and writes or removes that marker to match.

## How to get to it (user POV)

Under `/poteto-mode`, ask for a code fix. The first edit is refused with a reason that asks for the data shape and the principle read. The agent names the shape and retries. The next edit asks for the principle read, and after the read the edit goes through.

## Driving it with drive.sh

Read from the mode session (opus), whose seeded task fixes `total.js`. The drive seeds that repository under `~/.claude/pstack/verify/`, not the temp directory, because the design ask treats anything under the temp directory as scratch and would never deny an edit there. VERIFIED needs an errored tool_result carrying a `[pstack:design:` tag, then an assistant text matching the data-shape pattern after it, then an ok Edit or Write of a code file after that text, in the mode session or in one of its subagent transcripts. A deny with no shape text after it, or a shape text with no source write after it, is NOT VERIFIED. A source write with no design deny before it is NOT VERIFIED, unless the shape was named before that write, which is INCONCLUSIVE. A session that wrote no source file is INCONCLUSIVE.

## Gotchas

- `drive.sh --settings` layers the branch hooks beside the live ones. The live checkout's hooks still run, so a branch's deny comes from the branch registration only when the live checkout predates the one-shot asks.
- A write through the shell, such as `sed -i`, raises no edit ask. The drive's source write must be an Edit or Write.
- `judge.test.js` holds four hand-made `action-gate-*` fixtures, one per verdict path: deny then shape then write (VERIFIED), deny with no shape after it, a write with no deny, and no write at all. The no-deny fixture also reads a file whose text carries the tag, which is not a deny.
- `hooks/asks.test.js` holds one row per rule with its literal deny and the retry verdicts, and replays a recorded deny and its retry from a transcript. `node scripts/replay-demands.mjs <transcript.jsonl>...` replays the asks over any transcript as one markdown row per ask, with its tag.
