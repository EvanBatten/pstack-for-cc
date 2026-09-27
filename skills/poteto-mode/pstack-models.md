# pstack model configuration (Claude Code port). One line per role. Delete a line to fall back to the skill default.
# Values are Agent `model` aliases: fable, opus, sonnet, haiku.
# `inherit-parent` or `auto` as a value: the role runs on the parent session model (omit Agent `model`). Alias entries in a panel list still count toward its fan-out.
# Upstream panels span three model families. Claude Code only reaches Claude models, so panels here span tiers instead.
# `/setup-pstack` writes ~/.claude/pstack-models.md, which overrides this file.
# budget: medium
feature, refactoring: sonnet
bug-fix: sonnet
perf-issue: sonnet
hillclimb: sonnet
judgment and prose: inherit-parent
hardest tasks: inherit-parent
how explorer: sonnet
how explainer: inherit-parent
why investigators: sonnet
why synthesizer: inherit-parent
reflect tooling: inherit-parent
reflect judgment, divergent, synthesizer: inherit-parent
arena runners: inherit-parent, sonnet
arena cross-judge pool: inherit-parent, sonnet
swarm workers: sonnet
architect runners: inherit-parent, sonnet
interrogate reviewers: inherit-parent, sonnet
