# Port patch report

A frozen record of how this directory differed from upstream when it was forked. The build script that produced it has been removed, so later hand edits are not listed here.

Upstream: https://github.com/cursor/plugins.git at `032be146865d973682535de75f2287da438550bf` (pstack v0.15.2).

## Files changed from upstream

| File | Substitutions |
|---|---|
| `agents/comment-sicko.md` | 1 |
| `agents/poteto-agent.md` | 1 |
| `skills/architect/SKILL.md` | 4 |
| `skills/arena/SKILL.md` | 10 |
| `skills/automate-me/SKILL.md` | 18 |
| `skills/create-verification-skill/SKILL.md` | 3 |
| `skills/how/SKILL.md` | 8 |
| `skills/interrogate/SKILL.md` | 8 |
| `skills/maintain-verification-skill/SKILL.md` | 1 |
| `skills/no-comments/SKILL.md` | 2 |
| `skills/poteto-mode/SKILL.md` | 11 |
| `skills/poteto-mode/playbooks/authoring-a-skill.md` | 2 |
| `skills/poteto-mode/playbooks/autonomous-run.md` | 2 |
| `skills/poteto-mode/playbooks/autopilot-full.md` | 2 |
| `skills/poteto-mode/playbooks/autopilot-stack.md` | 1 |
| `skills/poteto-mode/playbooks/bug-fix.md` | 2 |
| `skills/poteto-mode/playbooks/eval.md` | 3 |
| `skills/poteto-mode/playbooks/feature.md` | 1 |
| `skills/poteto-mode/playbooks/hillclimb.md` | 1 |
| `skills/poteto-mode/playbooks/multi-phase-plan.md` | 5 |
| `skills/poteto-mode/playbooks/opening-a-pr.md` | 2 |
| `skills/poteto-mode/playbooks/orchestrate.md` | 4 |
| `skills/poteto-mode/playbooks/perf-issue.md` | 1 |
| `skills/poteto-mode/playbooks/refactoring.md` | 1 |
| `skills/poteto-mode/playbooks/session-pickup.md` | 3 |
| `skills/poteto-mode/playbooks/shipping.md` | 1 |
| `skills/poteto-mode/playbooks/worktree-cleanup.md` | 1 |
| `skills/poteto-mode/scripts/check-plan.mjs` | 1 |
| `skills/poteto-mode/scripts/worktree-audit.sh` | 2 |
| `skills/recall/SKILL.md` | 1 |
| `skills/reflect/SKILL.md` | 21 |
| `skills/reflect/references/divergent-reviewer.md` | 4 |
| `skills/reflect/references/judgment-reviewer.md` | 4 |
| `skills/reflect/references/synthesizer.md` | 3 |
| `skills/reflect/references/tooling-reviewer.md` | 4 |
| `skills/setup-pstack/SKILL.md` | 38 |
| `skills/show-me-your-work/SKILL.md` | 3 |
| `skills/swarm/SKILL.md` | 6 |
| `skills/why/SKILL.md` | 5 |

## Files added or replaced by the overlay

- `.claude-plugin/plugin.json`
- `hooks/hooks.json`
- `hooks/session-context.mjs`
- `PORT.md`
- `pstack-models.md`
- `skills/setup-pstack/SKILL.md`

## Rule hit counts

| Rule | Hits |
|---|---|
| `/claude-fable-5-1-thinking-max/g` to `fable` | 22 |
| `/claude-opus-5-thinking-xhigh/g` to `opus` | 8 |
| `/gpt-5\.6-sol-max/g` to `opus` | 10 |
| `/grok-4\.6-fast-xhigh/g` to `sonnet` | 28 |
| `/~\/\.cursor\/rules\/pstack-models\.mdc/g` to `~/.claude/pstack-models.md` | 7 |
| `/~\/\.cursor\/projects\/\*\//g` to `~/.claude/projects/*/` | 5 |
| `/~\/\.cursor\/(skills\|plugins)\//g` to `~/.claude/$1/` | 8 |
| `/(?<![~\w/])\.cursor\/skills\//g` to `.claude/skills/` | 11 |
| `/`agent-transcripts\/` directory/g` to `transcript directory` | 5 |
| `/`agent-transcripts\/`/g` to ``~/.claude/projects/<slug>/`` | 1 |
| `/<agent-transcripts>/g` to `<transcript-dir>` | 3 |
| `/([Tt])he system prompt names/g` to `$1he pstack session context names` | 5 |
| `/AskQuestion/g` to `AskUserQuestion` | 6 |
| `/generalPurpose/g` to `general-purpose` | 10 |
| `/`Task`/g` to ``Agent`` | 10 |
| `/\bTask (tool\|subagent)/g` to `Agent $1` | 5 |
| `/omit Task `model`/g` to `omit Agent `model`` | 2 |
| `/`environment: "cloud"`/g` to ``isolation: "worktree"`` | 2 |
| `/Cursor's built-in `create-skill`/g` to `Anthropic's `skill-creator`` | 3 |
| `/\(Cursor's built-in for authoring SKILL\.md files\)/g` to `(Anthropic's skill for authoring SKILL.md files)` | 2 |
| `/create-skill/g` to `skill-creator` | 13 |
| `/Cursor's `\/loop` command/g` to `Claude Code's `/loop` skill` | 2 |
| `/ from the `cursor-team-kit` plugin/g` to `(removed)` | 3 |
| `/ \(from `cursor-team-kit`\)/g` to `(removed)` | 1 |
| `/ from `cursor-team-kit`/g` to `(removed)` | 6 |
| `/`cursor-team-kit` publishes/g` to `This plugin bundles` | 1 |

## Cursor references left in ported files

None.
