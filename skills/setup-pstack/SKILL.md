---
name: setup-pstack
description: Configure which models pstack uses per role and at what budget. Writes the model configuration the pstack session hook loads into every session, overriding the skill defaults. Use for /setup-pstack, "configure pstack models", "pstack budget", or changing pstack's model choices.
---

# Setup pstack

Write `~/.claude/pstack-models.md`. The pstack SessionStart hook loads it into every session and subagent, and it overrides the skill defaults. When the file is missing the hook falls back to `~/.claude/skills/poteto-mode/pstack-models.md`. `PSTACK_MODELS_FILE` overrides both for one run.

This skill is rewritten for Claude Code. Upstream detects the editor's model slugs and lowers the reasoning-effort token per budget. The Agent tool takes a model alias and has no per-subagent effort, so here a budget picks the tier per role and the length of each panel.

## Steps

### 1. Detect available models

The values you can pass as Agent `model` are the aliases in the Agent tool's schema (`fable`, `opus`, `sonnet`, `haiku`). Never write an alias the schema does not list. `inherit-parent` and `auto` are always valid.

### 2. Load current state

If `~/.claude/pstack-models.md` exists, read it and treat its `# budget` line and its role values as the current choices. Otherwise start from `~/.claude/skills/poteto-mode/pstack-models.md`.

### 3. Budget, map, and confirm

**(a) Ask for a budget.** Prefer AskUserQuestion over free text. Offer these four options, and name the current budget when the file records one.

| Budget | Judgment roles | Code roles | Panels |
|---|---|---|---|
| `unlimited` | `fable` | `sonnet` | `fable, opus, sonnet` |
| `large` | `inherit-parent` | `sonnet` | `inherit-parent, opus, sonnet` |
| `medium` | `inherit-parent` | `sonnet` | `inherit-parent, sonnet` |
| `small` | `inherit-parent` | `haiku` | `inherit-parent, sonnet` |

Judgment roles are `judgment and prose`, `hardest tasks`, `how explainer`, `why synthesizer`, and the `reflect` judgment line. Code roles are `feature, refactoring`, `bug-fix`, `perf-issue`, `hillclimb`, `how explorer`, `why investigators`, `swarm workers`. Panels are `arena runners`, `arena cross-judge pool`, `architect runners`, `interrogate reviewers`. `reflect tooling` follows the judgment column except under `unlimited`, where it stays `opus`.

No panel drops below two entries. The **principle-exhaust-the-design-space** principle needs two structurally distinct candidates.

**(b) Apply it.** Build the working table from the budget row. On a re-run keep any role the user changed by hand.

**(c) Show the roles and confirm.** Show every role with its model. Ask whether to accept as-is or change specific roles. For panel roles the value is a list, and one subagent runs per entry, alias entries included, so the list length sets the count. `arena cross-judge pool` is also a list, but Arena selects one value from it.

### 4. Validate

Every alias written must be in the Agent tool's schema. `inherit-parent` and `auto` always pass.

### 5. Write the file

Write `~/.claude/pstack-models.md` in the same shape as `~/.claude/skills/poteto-mode/pstack-models.md`: the comment header, a `# budget:` line with the chosen label, and one line per role using the same labels poteto-mode uses. Overwrite the whole file so re-runs stay idempotent.

### 6. Confirm

Tell the user the file was written and that it applies to new sessions. Re-running this skill updates it.

### 7. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with /create-verification-skill." On yes, open the `create-verification-skill` skill and follow it. On no, move on without pushing.
