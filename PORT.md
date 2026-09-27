# pstack for Claude Code

This directory is a Claude Code plugin that started as a port of Lauren Tan's pstack v0.15.2 at [cursor/plugins@032be14](https://github.com/cursor/plugins/tree/032be146865d973682535de75f2287da438550bf/pstack).
It also bundles the four `cursor-team-kit` skills pstack leans on but does not ship: `control-cli`, `control-ui`, `deslop` and `verify-this`.
Both upstreams are MIT licensed. Their license files are in `LICENSE` and `LICENSES/`.

The files here are edited by hand. `PATCHES.md` records every file that differed from upstream at the fork and how many substitutions each one took. To pick up a newer pstack, diff upstream between `032be14` and its latest commit and apply what you want.

## Using it

```sh
claude --plugin-dir pstack-cc                            # alongside your own setup
claude --plugin-dir pstack-cc --setting-sources project  # pstack only, none of your user-level config
```

Start a task with `/pstack:poteto-mode <what you want>`. The other skills are reachable the same way, for example `/pstack:how` or `/pstack:interrogate`.

Run `/pstack:setup-pstack` to choose a model budget. It writes `~/.claude/pstack-models.md`. Until then the defaults in `pstack-models.md` apply.

## What the port changed

Upstream marks 46 of its 51 skills `disable-model-invocation`, and Cursor still lets one skill open another by name. Claude Code's Skill tool refuses those skills. The port keeps the flag, so nothing loads unless you ask for it, and a session hook tells the agent to open a named skill's `SKILL.md` by path instead. One useful side effect is that every skill, playbook and principle the agent consults shows up in the transcript as a `Read` of a file under this directory.

`hooks/session-context.mjs` stands in for two things Cursor provides. It injects the model configuration that upstream keeps in an always-applied rule, and it names the transcript directory that upstream expects the system prompt to name. It also carries a short tool mapping (`Task` is the Agent tool, `readonly: true` becomes a line in the subagent prompt).

The text substitutions were mechanical: Cursor model slugs to Agent model aliases, `.cursor/` paths to `.claude/`, `AskQuestion` to `AskUserQuestion`, `create-skill` to `skill-creator`, Cursor transcript paths to Claude Code's layout.
`setup-pstack` is rewritten, because a Cursor budget lowers a reasoning-effort token and the Agent tool has none. Here a budget picks the model tier per role and the length of each panel.
`worktree-audit.sh` is patched for Claude Code's transcript layout and for GNU `stat` and `date`.

## Open work

- Panels span Claude tiers. Upstream panels for `arena`, `architect` and `interrogate` span three model families, and Claude Code reaches only Claude models, so panels here use `fable`, `opus` and `sonnet`.
- Cloud workers are not wired in yet. The port turned every `environment: "cloud"` into `isolation: "worktree"`. Claude Code can run cloud sessions with `claude --cloud`, and the `orchestrate` and `autopilot` playbooks should offer it for workers that outlive the session. `notes/cloud-agents.md` in the repo root has the mapping.
- The triage rubric in `references/bugbot-triage.md` applies to any review bot. The Bugbot pass counting in `watch-pr` needs another source.
- `orch` and `watch-pr` need Bun, and `orch frontier set` needs Graphite's `gt`. Their test suites are POSIX only.
- For skill authoring, `reflect`, `automate-me` and the authoring playbook hand off to Anthropic's `skill-creator`, which must be installed separately.
- Benny and `make-bot-ui` are copied verbatim. Benny needs an automation trigger from Slack, and `make-bot-ui` targets a different runtime.
- The session hook is also registered for `SubagentStart` so subagents can resolve skills. That path has not been observed firing yet.
