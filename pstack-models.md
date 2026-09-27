# pstack model configuration (Claude Code port). One line per role. Delete a line to fall back to the skill default.
# Values are Agent `model` aliases: fable, opus, sonnet, haiku.
# `inherit-parent` or `auto` as a value: the role runs on the parent session model (omit Agent `model`). Alias entries in a panel list still count toward its fan-out.
# Upstream panels span three model families. Claude Code only reaches Claude models, so panels here span tiers instead.
# budget: unlimited
feature, refactoring: sonnet
bug-fix: sonnet
perf-issue: sonnet
hillclimb: sonnet
judgment and prose: fable
hardest tasks: fable
how explorer: sonnet
how explainer: fable
why investigators: sonnet
why synthesizer: fable
reflect tooling: opus
reflect judgment, divergent, synthesizer: fable
arena runners: fable, opus, sonnet
arena cross-judge pool: fable, opus, sonnet
swarm workers: sonnet
architect runners: fable, opus, sonnet
interrogate reviewers: fable, opus, sonnet
