# Her method on one page

Lauren Tan reports shipping a thousand or more PRs a month to production with agents, many of them merged while she sleeps ([talk, ~03:24 and ~04:43](https://www.youtube.com/watch?v=PaPpyQocMww)). The plugin is one part of how. The rest is the repo she puts agents in and the order she builds trust in.

> "throughput without quality is not a goal i aspire to. if you want to go fast, go deep first." ([README](../../docs/UPSTREAM-README.md))

## The order

Each step makes the next one safe. Skipping ahead is how parallel agents end up writing slop faster.

1. Put the rules where an agent cannot forget them: the type system, lint, and CI. See [hard-rules.md](hard-rules.md).
2. Give the agent a scripted way to drive the real app and capture evidence. See [verification.md](verification.md).
3. Route every task through a playbook that demands that evidence. See [playbooks.md](playbooks.md).
4. Once one agent can verify its own work, run many: overnight loops, cloud workers, triggered automations. See [cloud-agents.md](cloud-agents.md).
5. When a correction repeats, turn it into a rule in step 1 and delete the instruction.

> "if an agent can't verify its own work, nothing else matters. You remain the bottleneck, and your whole day will be spent babysitting your agents." ([Guide Pt. 2](https://x.com/poteto/status/2097732320606507506))

## The daily loop

```text
/poteto-mode <goal>. <what done means>. show me the evidence.
```

1. State the goal and a finish condition that can pass or fail.
2. `poteto-mode` picks the playbook and copies its steps into the todo list. A skipped step stays listed with `skip: <reason>`.
3. The agent reproduces or sketches before it edits, names the data shape before it writes logic, and verifies against the real artifact before it says done.
4. The reply carries the commands it ran and what they printed. A confident reply with no evidence is a red flag.
5. Opening a PR, Babysit, and Shipping take the change to merged. Babysit stops at merge-ready. Shipping verifies each PR with a fresh agent before it lands anything.

## Habits worth copying

| Habit | Where she says it |
|---|---|
| Verification is the first skill to build. She treats the verification skill as infrastructure and suggests running its maintenance pass daily | [Guide Pt. 1](https://x.com/poteto/status/2094457600259842065) |
| Give agents tools before markdown. A small CLI that drives the app costs fewer tokens than a throwaway script and can be rerun by a reviewer | Guide Pt. 1, "Build the Lever" |
| Keep a Feature Map: what the app does and how a user reaches each feature. She calls it materialized memory | Guide Pt. 1 |
| The codebase is the memory. "Code is a projection of the decision making you and your team have made" | Guide Pt. 1 |
| A review comment is a code smell. Ask how to turn it into a lint rule or a CI failure | talk, ~46:59 |
| CI and static analysis make the build red. Rules, skills and bot review can still be forgotten | talk, ~44:55 |
| Ban code comments. Agents mostly write comments about history that no longer matters | talk, ~39:01 |
| Check the dependency graph in CI so one directory cannot import from another by accident | talk, ~41:54 |
| Hide evals from the agent under test, because agents change behavior when they can tell | talk, ~19:02 |
| Treat agents as new hires with no memory. What they need to know has to live in the repo | [How I Use Cursor](https://x.com/poteto/status/2058975157503570132) |
| Build trust before scale. She advises against jumping straight to hundreds of cloud agents | talk, ~26:37 |

## What the plugin adds

The plugin encodes the loop so you do not have to remember it: 23 playbooks for task types, 23 principles that steer decisions, and 28 workflow skills for understanding, designing, building, verifying and shipping. [skills.md](skills.md) lists them all.

Her stated aim is to "write less, but higher quality code" and to make "fearless parallelism" possible.
