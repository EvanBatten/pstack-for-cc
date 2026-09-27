# Overnight runs, cloud agents and automations

Once an agent can verify its own work, you can leave it alone with a hard task. She describes waking up to around 20 landed PRs and reviewing them on `main` ([talk, ~03:24](https://www.youtube.com/watch?v=PaPpyQocMww)). This note covers how her playbooks scale past one session and how each piece maps onto Claude Code. Her own page on this is [07-overnight.md](../../docs/guide/07-overnight.md).

## The overnight contract

```text
/pstack:poteto-mode im going to bed. migrate every caller to the new parser in a fresh worktree off <base>.
done means zero old callers, all parser fixtures pass, old api deleted.
keep a decision log. don't ask me before committing.
/loop until done. if you're truly stuck after a few hours, stop and write up why.
```

| Line | What it buys |
|---|---|
| "im going to bed" | A session override. The agent stops asking |
| "done means..." | A finish condition each iteration can check. A duration is not one |
| "fresh worktree off `<base>`" | No collisions with your other work |
| "don't ask me before committing" | Answers the permission question in advance |
| `/loop until done` | Claude Code's `/loop` re-checks the finish condition on a heartbeat |
| The escape hatch | Lets the agent stop at a real dead end and explain |

Each iteration makes one change, runs one check and writes one row to the decision log. In the morning, run `/pstack:show-me-your-work catch me up on what you did last night` and read its Attention section first.

## Scaling past one task

| Playbook | Shape |
|---|---|
| [Autopilot-full](../../skills/poteto-mode/playbooks/autopilot-full.md) | A queue of independent PRs. One owner agent per PR. Fresh verifiers check each merge-ready head, and only a clean verdict authorizes the merge |
| [Autopilot-stack](../../skills/poteto-mode/playbooks/autopilot-stack.md) | The same loop, delivered as one verified stack that you land |
| [Orchestrate](../../skills/poteto-mode/playbooks/orchestrate.md) | A multi-day program. One coordinator chat writes briefs, drains a queue of completions, keeps the lowest unmerged PR green and never edits code |

Orchestrate's three rules: completions are queue events, every spawn and resume carries the standing orders verbatim, and the brief is the product because a worker cannot ask a question. Every brief has the same fields:

```text
GOAL  SCOPE  CONTEXT  ACCEPTANCE  VERIFY  TIMEBOX  FORBIDDEN  REPORT  STANDING
```

A unit counts as done when its branch is pushed and its verdict is in the ledger, keyed by PR number and head SHA. Verdicts run from `live-ui-verified` down to `type-check-only`, and CI green is only an input to one. State lives in plain TSV and JSON files managed by the bundled [`orch`](../../skills/poteto-mode/scripts/orch) CLI.

## Mapping Cursor to Claude Code

Checked against the Claude Code docs and CLI 2.1.278 on 2026-09-20. [claude-code-setup.md](claude-code-setup.md) goes into detail on sandboxes, review bots and observability.

| In Cursor | In Claude Code |
|---|---|
| Cloud agent spawned from chat | `claude --cloud "<brief>"` from the coordinator's shell. Send follow-ups with `claude -p --cloud <session>`. Pull a session down with `claude --teleport` |
| Cloud environment | An environment configured at claude.ai/code with a setup script, env vars and a network policy. `--environment <id>` targets a self-hosted pool |
| Local background agent | `claude --bg`, listed with `claude agents`, or the Agent tool with `isolation: "worktree"` |
| Agent dashboard | The session list at claude.ai/code, `claude agents`, and Remote Control |
| Cursor Automations | [Routines](https://code.claude.com/docs/en/routines) through `/schedule`: cron, one-off runs, an API endpoint you can POST to, and GitHub event triggers |
| Bugbot review | [claude-code-action](https://code.claude.com/docs/en/github-actions) on `pull_request`, or `/code-review` |
| Babysit's PR watcher | The bundled `watch-pr` script, or `/autofix-pr`, which pushes fixes when CI fails or a reviewer comments |
| Auto-merge | GitHub itself: `gh pr merge --auto --squash` with required checks and a merge queue |

Three things to design around:

- A cloud session cannot message the coordinator back. Orchestrate already covers this case: reattach by PR and branch, and wake the drain with a `/loop` watcher that polls `gh`.
- Cloud sessions draw on the same subscription allowance as local ones. See [cost-and-quality.md](cost-and-quality.md).
- Auto-merge is only as safe as the required checks behind it, which is why [hard-rules.md](hard-rules.md) comes first.

## Benny

[Benny](../../automations/benny/README.md) is her pair of automations for issue reports that arrive in Slack. One triages each report. The other reproduces confirmed bugs and may prepare a small draft fix, using the Feature Map to find its way around the app. The pack is copied here from upstream unchanged, including its [triage](../../automations/benny/templates/triage-automation-prompt.md) and [reproduce](../../automations/benny/templates/reproduce-automation-prompt.md) prompts.

A Claude Code version needs a trigger and a place to run:

| Piece | Option |
|---|---|
| Trigger from Slack | Claude Tag on Team and Enterprise plans. On a personal plan, a Slack workflow that POSTs to a routine's API endpoint |
| Trigger from GitHub | Use issues as the inbox and run `claude-code-action` on `issues` events |
| Runtime | A routine in a cloud environment that has the repo's verification skill available |
| Daily upkeep | A scheduled routine that runs `/pstack:maintain-verification-skill` |
