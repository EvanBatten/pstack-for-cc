# About porting Benny to Claude Code

Benny is two Cursor automations that watch one Slack channel for issue reports. `triage-issue-reports` posts one verdict per report and files clear bugs in a tracker. `reproduce-and-fix-issues` waits for the verdict, reproduces the bug through the app's real UI, and may open a draft pull request. `setup-benny` copies the pack into a target repository and creates both automations with Cursor's built-in `/automate` skill.

Every file in this directory except this one is byte for byte from pstack v0.15.2. The reference port copied the pack unchanged, and this repo does the same. `install.json` does not name the pack, so none of it is linked into `~/.claude/skills`. Upstream never registered these files as skills either. Each automation prompt reads its `SKILL.md` by path.

Each claim below carries one of three labels:

- **Verified** means a command in this repo on 2026-09-23 showed it.
- **Docs** means the Claude Code documentation says it, and nobody has run it.
- **Inferred** means it follows from the two above, and nobody has tested it.

## What already works on this port

- **Verified.** Every pstack skill that Benny names exists here: `how`, `why`, `tdd`, `unslop`, and the six principles `separate-before-serializing-shared-state`, `minimize-reader-load`, `guard-the-context-window`, `sequence-verifiable-units`, `fix-root-causes`, and `prove-it-works` under `skills/poteto-mode/principles/`.
- **Verified.** `control-ui` and `control-cli` exist here. Either one can be the base for the control adapter that `references/control-adapter.md` specifies.
- **Verified.** `node skills/poteto-mode/scripts/check-port.mjs automations/benny` reports 8 findings. Six are the word `Cursor` in `setup-benny/SKILL.md` (lines 11, 13, 112, 136, 246) and `reproduce-and-fix-issues/SKILL.md` (line 122). Two are "principle skills" in `FOR_AGENTS.md` (lines 32, 79).
- **Verified.** The check misses most of the coupling, because its rules are case-sensitive and it skips `.yaml` files. A wider search finds 58 Cursor-specific references across 10 files, such as `.cursor/` paths, `/automate`, "cursor actions", and `/tmp/benny-artifacts`. `setup-benny/SKILL.md` has 25 and `FOR_AGENTS.md` has 15. `triage-issue-reports/SKILL.md` has none.

The two operational skills port with a few line edits. The setup skill and the templates need a rewrite, because they drive Cursor's automation editor.

## How each Cursor piece maps

| Benny needs | Claude Code counterpart | Label |
|---|---|---|
| Start a run on each new top-level Slack message | Nothing starts on a plain Slack message. Claude in Slack and Claude Tag answer only an `@Claude` mention in a channel they were invited to. A routine starts on a schedule, an API call, or a GitHub pull request or release event. | Docs |
| Slack thread read and reply | A routine can use the Slack connector. It posts as the routine owner, not as a bot. | Docs |
| Linear or another tracker | A routine can use the Linear connector. `gh issue` covers GitHub Issues. | Docs |
| Repository, history, and a draft pull request | A routine clones the repository and pushes to `claude/` branches. The routines page gives a draft pull request as an example outcome. Commits and pull requests carry the routine owner's GitHub user. | Docs |
| `/automate` and the Automations editor | `/schedule` creates a scheduled routine. API and GitHub triggers are added on claude.ai/code/routines. | Docs |
| Pack at `.cursor/automations/benny/` | `.claude/automations/benny/` in the target repository. A routine reads it from the clone. | Inferred |
| pstack enabled in `.cursor/settings.json` | A routine uses skills committed to the cloned repository. It does not use `~/.claude/skills`. The target repository must either commit the shared skills or clone this repo in the environment's setup script and link what `install.json` names. This repo is private, so the second choice needs a GitHub token in the environment. | Docs, then Inferred |
| Principle names such as `principle-prove-it-works` | The session hook resolves these names. A cloud session runs it only if the target repository's `.claude/settings.json` registers it. Otherwise the operational skills must name the principle file paths. | Inferred |
| Workers never write to Slack | A subagent inherits the session's tools. The prompt ban stays, and an agent definition with `disallowedTools` for the Slack connector enforces it. | Inferred |
| Model slugs | Agent `model` aliases, or the routine's model selector. | Docs |
| Control adapter drives the real UI | A cloud environment is a Linux sandbox. A web app can run there under `control-ui` with a headless browser that the setup script installs. A desktop app needs a self-hosted environment. | Inferred |

## Recommended port

Keep Slack as the intake and run both halves as routines. The trigger is the only piece with no direct counterpart, and a routine has the Slack and Linear connectors that Benny already assumes.

1. Move the pack to `.claude/automations/benny/` in the target repository. Replace `.cursor/` paths, Cursor Slack actions, and `/tmp/benny-artifacts` in the operational skills. Leave their safety rules as they are.
2. Create the triage routine with an API trigger. A Slack workflow that starts on each new channel message sends the channel ID and message timestamp to the routine's `/fire` endpoint. The payload arrives marked untrusted, and step 1 of the triage skill already checks the coordinates against configuration before it acts. The Slack workflow step is Inferred, because nobody has checked that Slack Workflow Builder can call the endpoint with the bearer token.
3. If the Slack workflow cannot call the endpoint, run triage hourly instead, the shortest schedule a routine allows. Each run reads top-level messages since the last run and skips any thread that already has a verdict. The dedupe step in the triage skill already requires that check.
4. Run reproduce as a second routine every hour. Each run looks for threads with a `[benny:bug]` or `[benny:performance]` marker and no repro status, then follows `reproduce-and-fix-issues/SKILL.md` from step 3. That replaces the Slack wait in step 2.
5. Change the trusted triage identity. A routine posts as its owner, so the marker comes from a person's account. The repro routine must also require the triage routine's exact marker format in a reply under the frozen root, because the owner can post a marker by hand.
6. Rewrite `setup-benny/SKILL.md` around `/schedule` and the routines page, and keep its seven thread-safety checks as the gate before either routine runs on real traffic.

The GitHub Action, `anthropics/claude-code-action`, fits a team that files reports as GitHub issues instead. With a `prompt` input it runs in automation mode on any GitHub event, such as `issues: opened`, and needs no mention (Docs). Triage can write a label in place of the Slack marker, and reproduce can run on `issues: labeled` (Inferred). The action rejects an event from a bot unless the workflow lists it in `allowed_bots`, so a label that the triage run adds starts reproduce only with that setting (Docs). The action gets no claude.ai connectors. A Slack or Linear server needs its own `--mcp-config` entry and token in `claude_args` (Docs, then Inferred).

Claude Tag, or Claude in Slack on a personal plan, fits only a version with a person in the loop. Someone tags `@Claude` on a report, and Claude runs the triage skill in a cloud session. It keeps Slack and gives up the automatic start that Benny exists to provide.

## Not done here

Nothing in this directory runs. No routine, workflow, or Slack app was created, and no step above has run end to end. The first live test must be the seven thread-safety checks in `setup-benny/SKILL.md`, run in a test channel.

Sources: [Routines](https://code.claude.com/docs/en/routines.md), [Claude Code in Slack](https://code.claude.com/docs/en/slack.md), [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions.md).
