# Making it your own

`poteto-mode` is one person's style. The machinery under it (a router, playbooks, principles, model roles) works with anyone's. This note covers how the plugin is wired into Claude Code, where to edit, and what is still open. Her page on the same subject is [09-make-it-yours.md](../../docs/guide/09-make-it-yours.md).

## How the plugin is wired

| Piece | File | What it does |
|---|---|---|
| Manifest | [.claude-plugin/plugin.json](https://github.com/EvanBatten/pstack-for-cc/blob/port-reference/.claude-plugin/plugin.json) | Names the plugin `pstack`, which gives every skill its `/pstack:` prefix |
| Session hook | [hooks/session-context.mjs](https://github.com/EvanBatten/pstack-for-cc/blob/port-reference/hooks/session-context.mjs) | Runs on `SessionStart` and `SubagentStart`. Injects the plugin root, the transcript directory, a Cursor-to-Claude tool mapping and the model configuration |
| Skill resolution | The same hook | 46 of the 51 skills set `disable-model-invocation`, so the Skill tool refuses them. The hook tells the agent to `Read` `skills/<name>/SKILL.md` by path when one skill names another. Every skill the agent consults therefore shows up in the transcript as a `Read` |
| Model roles | [pstack-models.md](https://github.com/EvanBatten/pstack-for-cc/blob/port-reference/pstack-models.md) | One line per role. `~/.claude/pstack-models.md` overrides it, and `PSTACK_MODELS_FILE` overrides both |
| Subagents | [agents/](../../agents) | `poteto-agent` and `comment-sicko` |
| Scripts | [poteto-mode/scripts](../../skills/poteto-mode/scripts) | `orch` and `watch-pr` need Bun. `orch frontier set` needs Graphite's `gt`. `check-plan.mjs` and `worktree-audit.sh` run as they are |

[PORT.md](../port-audit/PORT.md) lists what changed from upstream, and [PATCHES.md](../port-audit/PATCHES.md) counts the substitutions per file. To compare against a newer pstack, diff upstream's `pstack/` directory at commit `032be14` against its latest, then apply the changes you want by hand.

## Plugin or personal skills

| | Plugin (`pstack-cc/`) | Personal skills |
|---|---|---|
| Listed as | `pstack:how`, `pstack:poteto-agent` | `how`, `poteto-agent` |
| Typed as | `/pstack:how`, or bare `/how` when no other command has that name | `/how` |
| Lives in | One directory with a manifest, enabled and updated as a unit | One folder per skill under `~/.claude/skills`, agents under `~/.claude/agents`, the hook in `settings.json` |
| Edits take effect | After `claude plugin update` | On the next session, because the folders are symlinks into a clone of this repo |
| Reaches cloud sessions | Yes, when a repo's `.claude/settings.json` declares it from a marketplace | No. Commit the skills into the repo's `.claude/skills/` instead |

This repo installs the personal form. The 23 principles are folded into `poteto-mode/principles/<slug>.md`, and a `principle-<slug>` name in any skill means that file. `poteto-mode/UPSTREAM.md` there lists how the copy differs from this reference. `pstack-cc/` here stays unmodified.

## Her tools for personalizing

| Tool | Use |
|---|---|
| `/pstack:automate-me` | Mines your recent transcripts for repeated preferences, asks which ones are really you, and drafts `<your-name>-mode`. Rerun it to update from history since the last edit |
| `/pstack:reflect` | After a session that taught you something. Three reviewers propose skill edits and a synthesizer sorts them into accepted, rejected and backlog for your approval |
| [Authoring a skill](../../skills/poteto-mode/playbooks/authoring-a-skill.md) | Writes a focused skill to a higher bar than freehand. It hands off to Anthropic's `skill-creator`, which you install separately |
| [Eval](../../skills/poteto-mode/playbooks/eval.md) | Tests a skill change on the same task with and without it. The agents stay blind: neutral paths, a prompt that looks organic, no mention of measurement |

Fix a misbehaving skill in its own PR. An edit tangled into feature work is invisible to review.

## A path to your own version

1. Use the plugin unchanged for a couple of weeks, so that your edits come from real friction.
2. Run `/pstack:automate-me` to generate your own mode skill. Keep `poteto-mode` next to it while you compare.
3. Rename the plugin in `plugin.json` when the router is yours. Skill prefixes and the `pstack:` subagent names in the hook change with it.
4. Trim the playbook list to the task types you do. Each playbook is one file plus one line in the router.
5. Replace the principles you disagree with. The router lists each one with the moment it applies, and the agent reads the full file only when it uses one.
6. Set the model roles to match your budget. See [cost-and-quality.md](cost-and-quality.md).

The port stays Claude only. Upstream panels span three model families. Here a judge runs on the parent model or opus, never below it, and `check-port.mjs` fails on a judgment role set lower.

## Open work

| Item | Detail |
|---|---|
| Cloud workers | The port rewrote every `environment: "cloud"` to `isolation: "worktree"`. Orchestrate and the two Autopilot playbooks should offer `claude --cloud` for workers that must outlive the session. See [cloud-agents.md](cloud-agents.md) |
| Review bot | [bugbot-triage.md](../../skills/poteto-mode/references/bugbot-triage.md) applies to any review bot. The Bugbot pass counting in `watch-pr` needs a replacement source |
| Benny | Copied from upstream unchanged. It needs a routine and a trigger as described in cloud-agents.md |
| `make-bot-ui` | Copied from upstream unchanged and targets a different runtime |
| Windows | The `orch` and `watch-pr` test suites are POSIX only |
| Subagent context | The hook is registered for `SubagentStart`, and that path has not been observed firing yet |
| Guide images | Her guide pages reference `images/*.jpg`, which were not copied |
