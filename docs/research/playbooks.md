# Playbooks

`/pstack:poteto-mode` matches your request to one of 23 playbooks in [pstack-cc/skills/poteto-mode/playbooks](../../skills/poteto-mode/playbooks). You do not name the playbook. A goal and a checkable outcome are enough for routing. The full router is [poteto-mode/SKILL.md](../../skills/poteto-mode/SKILL.md).

## Understand and diagnose

| Playbook | Use when |
|---|---|
| [Investigation](../../skills/poteto-mode/playbooks/investigation.md) | A read-only question: how does X work, why was Y built this way, should we do X or Y |
| [Runtime forensics](../../skills/poteto-mode/playbooks/runtime-forensics.md) | A live symptom such as a leak or an idle CPU spin. The deliverable is a diagnosis |
| [Trace forensics](../../skills/poteto-mode/playbooks/trace-forensics.md) | A captured profile, trace or heap snapshot handed over after the fact. The deliverable is a diagnosis |

## Change code

| Playbook | Use when |
|---|---|
| [Bug fix](../../skills/poteto-mode/playbooks/bug-fix.md) | A reported defect. Reproduce, find the root cause, fix, show runtime evidence |
| [Feature](../../skills/poteto-mode/playbooks/feature.md) | New or changed behavior, built from a named data shape |
| [Refactoring](../../skills/poteto-mode/playbooks/refactoring.md) | A change to structure that preserves behavior |
| [Perf issue](../../skills/poteto-mode/playbooks/perf-issue.md) | One measured slowness to trace and improve against a baseline |
| [Hillclimb](../../skills/poteto-mode/playbooks/hillclimb.md) | Sustained work on one metric: hypotheses, before and after measurement, one commit per accepted win |
| [Prototype](../../skills/poteto-mode/playbooks/prototype.md) | A throwaway sketch that settles a design question by observing it |
| [Visual parity](../../skills/poteto-mode/playbooks/visual-parity.md) | Pixel-exact UI equivalence, such as a styling-system migration |

## Ship

| Playbook | Use when |
|---|---|
| [Opening a PR](../../skills/poteto-mode/playbooks/opening-a-pr.md) | The end of every other playbook. Small ordered commits from a worktree, evidence in the description |
| [Babysit](../../skills/poteto-mode/playbooks/babysit.md) | "check on PR X", "get it green". Takes conflicts, then review threads, then CI. Stops at merge-ready |
| [Shipping](../../skills/poteto-mode/playbooks/shipping.md) | "land the stack". A fresh agent verifies each PR, then the contiguous verified run lands from the bottom |
| [Multi-phase plan](../../skills/poteto-mode/playbooks/multi-phase-plan.md) | Work that spans phases or stacked PRs |

## Long and unattended work

| Playbook | Use when |
|---|---|
| [Autonomous run](../../skills/poteto-mode/playbooks/autonomous-run.md) | One long task driven to a finish condition: "run until done", "/loop until X" |
| [Autopilot-full](../../skills/poteto-mode/playbooks/autopilot-full.md) | A queue of independent PRs, each with one owner agent, run to merged |
| [Autopilot-stack](../../skills/poteto-mode/playbooks/autopilot-stack.md) | The same queue built and verified as one stack that you land yourself |
| [Orchestrate](../../skills/poteto-mode/playbooks/orchestrate.md) | A multi-day program under one coordinator chat that never writes code |
| [Pause safely](../../skills/poteto-mode/playbooks/pause-safely.md) | Suspending work before a restart, going offline, or context compaction |
| [Session pickup](../../skills/poteto-mode/playbooks/session-pickup.md) | Resuming a prior agent's work from a transcript, a cloud session or a pushed branch |

When no playbook fits, or the work is large and you will review it after stepping away, `poteto-mode` routes to [figure-it-out](../../skills/figure-it-out/SKILL.md), which designs a playbook for that one task.

## Skills and housekeeping

| Playbook | Use when |
|---|---|
| [Authoring a skill](../../skills/poteto-mode/playbooks/authoring-a-skill.md) | Writing or editing any `SKILL.md` |
| [Eval](../../skills/poteto-mode/playbooks/eval.md) | Testing how a skill or prompt change affects agent behavior, with the agents kept blind |
| [Worktree cleanup](../../skills/poteto-mode/playbooks/worktree-cleanup.md) | Reclaiming disk from merged or abandoned worktrees |

## Rules that apply in every playbook

| Rule | Detail |
|---|---|
| Observe before asking | A question an experiment could answer goes to the Prototype playbook. Questions to you are for product and preference calls |
| Shape first | Name the data shape before writing logic. Code that crosses a function boundary goes through [architect](../../skills/architect/SKILL.md) first |
| Reversible work proceeds | The agent acts, shows the result and lets you correct course |
| Irreversible work pauses | Force-push to shared branches, deploys, data deletion, customer messages |
| Session overrides | "going to bed", "don't stop", "run until done" and "be fully autonomous" switch off the asking |
| Candor | "No" is an acceptable answer. A recommendation is a judgment |
| Before commit and review | [deslop](../../skills/deslop/SKILL.md) before commit, [no-comments](../../skills/no-comments/SKILL.md) before review, [unslop](../../skills/unslop/SKILL.md) on every prose surface |
| Evidence in the reply | Every claim is labeled measured, inferred or guess. The reply names each principle that changed a decision |
