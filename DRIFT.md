# Drift from upstream

Every file in this repo that differs from pstack v0.15.2, layer by layer, grouped by why it differs. `scripts/drift.mjs` writes this file from `git diff` between the tags, and CI fails when a changed file has no class or this file is stale. To record a change, add or extend a class in that script and run `node scripts/drift.mjs`.

A class marked "Not recorded" is drift that no record at the time explained. The reason given for it was read from the diff afterwards.

| Layer | From | To | Files | Added | Modified | Deleted | Renamed | Not recorded |
|---|---|---|---|---|---|---|---|---|
| Upstream to the reference port | `upstream-v0.15.2` | `port-reference` | 55 | 6 | 40 | 9 | 0 | 7 |
| Reference port to the live install | `port-reference` | `live-2026-09-23` | 119 | 13 | 51 | 29 | 26 | 0 |
| Live install to this repo | `live-2026-09-23` | main | 560 | 523 | 32 | 3 | 2 | 0 |

## Upstream to the reference port

`git diff -M upstream-v0.15.2 port-reference`. The mechanical port in `pstack-test/pstack-cc`. Its `PATCHES.md` froze the substitution counts per file at the fork, and its `PORT.md` explains the wiring.

### Cursor plugin packaging replaced by a Claude Code plugin

Claude Code loads a plugin from `.claude-plugin/plugin.json`. The Cursor manifest, the marketplace logo and upstream's `.gitignore` only served Cursor packaging.

- added `.claude-plugin/plugin.json`
- deleted `.cursor-plugin/plugin.json`
- deleted `.gitignore`
- deleted `assets/logo.png`

### Session hook for Cursor's always-on pieces

Upstream keeps the model table in an always-applied rule and expects the system prompt to name the transcript directory. The hook injects both at `SessionStart` and `SubagentStart`, and `pstack-models.md` is the default table it reads.

- added `hooks/hooks.json`
- added `hooks/session-context.mjs`
- added `pstack-models.md`

### Port records

`PORT.md` explains the wiring and `PATCHES.md` freezes the per-file substitution counts.

- added `PATCHES.md`
- added `PORT.md`

### Guide images dropped

Not recorded. The guide pages still link these images, so they render broken in the reference. This repo restores them from upstream.

- deleted `docs/guide/images/design.jpg`
- deleted `docs/guide/images/overnight.jpg`
- deleted `docs/guide/images/recipes.jpg`
- deleted `docs/guide/images/router.jpg`
- deleted `docs/guide/images/understanding.jpg`
- deleted `docs/guide/images/verification.jpg`

### setup-pstack rewritten

A Cursor budget lowers a reasoning-effort token, and the Agent tool has none. Here a budget picks the model tier per role and the length of each panel.

- modified `skills/setup-pstack/SKILL.md`

### make-bot-ui name normalized

Not recorded. `PATCHES.md` leaves the file out and `PORT.md` calls the skill verbatim, but its `name:` changed from `Make Bot UI` to `make-bot-ui`, the lowercase form Claude Code expects.

- modified `skills/make-bot-ui/SKILL.md`

### Mechanical substitutions

The rule table in `PATCHES.md`: Cursor model slugs to Agent model aliases, `.cursor/` paths to `.claude/`, `AskQuestion` to `AskUserQuestion`, `generalPurpose` to `general-purpose`, `Task` to `Agent`, `environment: "cloud"` to `isolation: "worktree"`, `create-skill` to `skill-creator`, Cursor transcript paths to Claude Code's layout, and the `cursor-team-kit` mentions removed.

- modified `agents/comment-sicko.md`
- modified `agents/poteto-agent.md`
- modified `skills/architect/SKILL.md`
- modified `skills/arena/SKILL.md`
- modified `skills/automate-me/SKILL.md`
- modified `skills/create-verification-skill/SKILL.md`
- modified `skills/how/SKILL.md`
- modified `skills/interrogate/SKILL.md`
- modified `skills/maintain-verification-skill/SKILL.md`
- modified `skills/no-comments/SKILL.md`
- modified `skills/poteto-mode/SKILL.md`
- modified `skills/poteto-mode/playbooks/authoring-a-skill.md`
- modified `skills/poteto-mode/playbooks/autonomous-run.md`
- modified `skills/poteto-mode/playbooks/autopilot-full.md`
- modified `skills/poteto-mode/playbooks/autopilot-stack.md`
- modified `skills/poteto-mode/playbooks/bug-fix.md`
- modified `skills/poteto-mode/playbooks/eval.md`
- modified `skills/poteto-mode/playbooks/feature.md`
- modified `skills/poteto-mode/playbooks/hillclimb.md`
- modified `skills/poteto-mode/playbooks/multi-phase-plan.md`
- modified `skills/poteto-mode/playbooks/opening-a-pr.md`
- modified `skills/poteto-mode/playbooks/orchestrate.md`
- modified `skills/poteto-mode/playbooks/perf-issue.md`
- modified `skills/poteto-mode/playbooks/refactoring.md`
- modified `skills/poteto-mode/playbooks/session-pickup.md`
- modified `skills/poteto-mode/playbooks/shipping.md`
- modified `skills/poteto-mode/playbooks/worktree-cleanup.md`
- modified `skills/poteto-mode/scripts/check-plan.mjs`
- modified `skills/poteto-mode/scripts/worktree-audit.sh`
- modified `skills/recall/SKILL.md`
- modified `skills/reflect/SKILL.md`
- modified `skills/reflect/references/divergent-reviewer.md`
- modified `skills/reflect/references/judgment-reviewer.md`
- modified `skills/reflect/references/synthesizer.md`
- modified `skills/reflect/references/tooling-reviewer.md`
- modified `skills/show-me-your-work/SKILL.md`
- modified `skills/swarm/SKILL.md`
- modified `skills/why/SKILL.md`

## Reference port to the live install

`git diff -M port-reference live-2026-09-23`. The copies that an earlier setup repo installed as personal skills on 2026-09-21 and then fixed in place. Their provenance note, `skills/poteto-mode/UPSTREAM.md` at this tag, recorded most of the reasons.

### Plugin packaging removed

The skills are installed one by one into `~/.claude/skills` as personal skills, so they are `/how` and not `/pstack:how`. The hook is registered in `~/.claude/settings.json` instead of `hooks/hooks.json`. `UPSTREAM.md` replaced `PORT.md` and `PATCHES.md`.

- deleted `.claude-plugin/plugin.json`
- deleted `PATCHES.md`
- deleted `PORT.md`
- deleted `docs/UPSTREAM-README.md`
- deleted `hooks/hooks.json`

### Not installed

Benny needs an automation trigger from Slack that has no counterpart here, and the guide is reading material, not a skill.

- deleted `automations/benny/FOR_AGENTS.md`
- deleted `automations/benny/README.md`
- deleted `automations/benny/skills/reproduce-and-fix-issues/SKILL.md`
- deleted `automations/benny/skills/reproduce-and-fix-issues/references/control-adapter.md`
- deleted `automations/benny/skills/reproduce-and-fix-issues/references/feature-map.example.md`
- deleted `automations/benny/skills/reproduce-and-fix-issues/references/verify-existing-fix.md`
- deleted `automations/benny/skills/setup-benny/SKILL.md`
- deleted `automations/benny/skills/triage-issue-reports/SKILL.md`
- deleted `automations/benny/skills/triage-issue-reports/references/routing.example.md`
- deleted `automations/benny/templates/configuration.example.yaml`
- deleted `automations/benny/templates/reproduce-automation-prompt.md`
- deleted `automations/benny/templates/triage-automation-prompt.md`
- deleted `docs/guide/01-setup.md`
- deleted `docs/guide/02-poteto-mode.md`
- deleted `docs/guide/03-understand.md`
- deleted `docs/guide/04-design.md`
- deleted `docs/guide/05-build-and-clean.md`
- deleted `docs/guide/06-verify-and-ship.md`
- deleted `docs/guide/07-overnight.md`
- deleted `docs/guide/08-principles.md`
- deleted `docs/guide/09-make-it-yours.md`
- deleted `docs/guide/10-recipes-and-pitfalls.md`
- deleted `docs/guide/README.md`

### Principles folded into poteto-mode

The 23 principles are files under `poteto-mode/principles/` instead of skills. Their frontmatter is gone and their cross-links point at the sibling file. Every skill names one as `**principle-<slug>**`, which the session hook resolves to that file.

- renamed `skills/principle-attack-the-premise/SKILL.md` to `skills/poteto-mode/principles/attack-the-premise.md`
- renamed `skills/principle-boundary-discipline/SKILL.md` to `skills/poteto-mode/principles/boundary-discipline.md`
- renamed `skills/principle-build-the-lever/SKILL.md` to `skills/poteto-mode/principles/build-the-lever.md`
- renamed `skills/principle-encode-lessons-in-structure/SKILL.md` to `skills/poteto-mode/principles/encode-lessons-in-structure.md`
- renamed `skills/principle-exhaust-the-design-space/SKILL.md` to `skills/poteto-mode/principles/exhaust-the-design-space.md`
- renamed `skills/principle-experience-first/SKILL.md` to `skills/poteto-mode/principles/experience-first.md`
- renamed `skills/principle-fix-root-causes/SKILL.md` to `skills/poteto-mode/principles/fix-root-causes.md`
- renamed `skills/principle-foundational-thinking/SKILL.md` to `skills/poteto-mode/principles/foundational-thinking.md`
- renamed `skills/principle-guard-the-context-window/SKILL.md` to `skills/poteto-mode/principles/guard-the-context-window.md`
- renamed `skills/principle-laziness-protocol/SKILL.md` to `skills/poteto-mode/principles/laziness-protocol.md`
- renamed `skills/principle-make-operations-idempotent/SKILL.md` to `skills/poteto-mode/principles/make-operations-idempotent.md`
- renamed `skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md` to `skills/poteto-mode/principles/migrate-callers-then-delete-legacy-apis.md`
- renamed `skills/principle-minimize-reader-load/SKILL.md` to `skills/poteto-mode/principles/minimize-reader-load.md`
- renamed `skills/principle-model-the-domain/SKILL.md` to `skills/poteto-mode/principles/model-the-domain.md`
- renamed `skills/principle-never-block-on-the-human/SKILL.md` to `skills/poteto-mode/principles/never-block-on-the-human.md`
- renamed `skills/principle-outcome-oriented-execution/SKILL.md` to `skills/poteto-mode/principles/outcome-oriented-execution.md`
- renamed `skills/principle-prove-it-works/SKILL.md` to `skills/poteto-mode/principles/prove-it-works.md`
- renamed `skills/principle-redesign-from-first-principles/SKILL.md` to `skills/poteto-mode/principles/redesign-from-first-principles.md`
- renamed `skills/principle-separate-before-serializing-shared-state/SKILL.md` to `skills/poteto-mode/principles/separate-before-serializing-shared-state.md`
- renamed `skills/principle-sequence-verifiable-units/SKILL.md` to `skills/poteto-mode/principles/sequence-verifiable-units.md`
- renamed `skills/principle-subtract-before-you-add/SKILL.md` to `skills/poteto-mode/principles/subtract-before-you-add.md`
- renamed `skills/principle-test-behavior-not-implementation/SKILL.md` to `skills/poteto-mode/principles/test-behavior-not-implementation.md`
- renamed `skills/principle-type-system-discipline/SKILL.md` to `skills/poteto-mode/principles/type-system-discipline.md`

### Session hook moved into poteto-mode and extended

The hook resolves skills under `~/.claude/skills` and names the orchestrate store root. It also answers `UserPromptSubmit` with a short reminder once the transcript shows the mode was entered, because Claude Code ignores the `mode:` and `reminder:` fields that hold the mode open upstream. A session audited on 2026-09-21 cited no principle in 26 replies. The hook falls back to the model table beside it when the home has none.

- deleted `hooks/session-context.mjs`
- added `skills/poteto-mode/hooks/session-context.mjs`

### Model table moved and set to the medium budget

The table sits beside the hook in `poteto-mode/`. It ships the `medium` budget: judgment roles on the session model, code roles on `sonnet`, panels two wide.

- renamed `pstack-models.md` to `skills/poteto-mode/pstack-models.md`

### License files moved into poteto-mode

A personal skill directory was the only place the copies had to keep them.

- renamed `LICENSE` to `skills/poteto-mode/licenses/LICENSE-pstack`
- renamed `LICENSES/cursor-team-kit.txt` to `skills/poteto-mode/licenses/cursor-team-kit.txt`

### Provenance note

`UPSTREAM.md` listed the skills and how the live copies differed from the reference.

- added `skills/poteto-mode/UPSTREAM.md`

### Port gate

The reference's substitutions caught the quoted form of each Cursor affordance and missed the prose. On 2026-09-22 `check-port.mjs` found 151 sites in 20 classes. `port-codemod.mjs` rewrote the four mechanical classes, and `port.test.js` runs the check in CI so an upstream merge cannot bring any of them back.

- added `skills/poteto-mode/scripts/check-port.mjs`
- added `skills/poteto-mode/scripts/port-codemod.mjs`
- added `skills/poteto-mode/scripts/port.test.js`

### Plan gate accepts the Claude Code form

`check-plan.mjs` wants `orch standing` and a re-read from `~/.claude/skills` where upstream wants `/goal` and `git show origin/main:`. `check-plan.test.js` proves a plan in each form.

- modified `skills/poteto-mode/scripts/check-plan.mjs`
- added `skills/poteto-mode/scripts/check-plan.test.js`

### Worktree audit matches Windows transcript paths

Transcripts store a cwd as JSON, so on Windows the path has doubled backslashes. The reference's scan never matched them and marked live worktrees safe.

- modified `skills/poteto-mode/scripts/worktree-audit.sh`

### verify-pstack added

Not from pstack. It drives the harness through real headless sessions and reads their transcripts, and it is the proof for the rest of this layer.

- added `skills/verify-pstack/SKILL.md`
- added `skills/verify-pstack/features/README.md`
- added `skills/verify-pstack/features/hook-context.md`
- added `skills/verify-pstack/features/mode-reminder.md`
- added `skills/verify-pstack/features/playbook-run.md`
- added `skills/verify-pstack/features/port-clean.md`
- added `skills/verify-pstack/scripts/drive.sh`

### Prose skills invocable by the model

The live install dropped upstream's `disable-model-invocation: true` from `unslop` and `technical-writing`, so the model could load them in any session. It did so for one user's global instructions, which route outward-facing prose through both. This repo puts the flag back.

- modified `skills/technical-writing/SKILL.md`
- modified `skills/unslop/SKILL.md`

### PR titles in the voice of COMMITS.md

The reference mandates Conventional Commits, which `~/COMMITS.md` forbids. The line about cloud-agent PR tools that default to draft went with the Cursor affordances.

- modified `skills/poteto-mode/playbooks/opening-a-pr.md`

### make-bot-ui marked not ported

It drives Cursor routines and webhook automations that have no counterpart here, so it opens by saying so.

- modified `skills/make-bot-ui/SKILL.md`

### Verification skills isolate by worktree

Agents here run in parallel git worktrees of one repo, not in cloud machines, so a generated verify skill derives its ports, data dirs and compose project names from the worktree.

- modified `skills/create-verification-skill/SKILL.md`

### typescript-best-practices triggers on its description

Cursor's `paths:` frontmatter has no equivalent, so the field is gone and the skill is left invocable so its description can trigger it.

- modified `skills/typescript-best-practices/SKILL.md`

### Claude Code and Windows adaptations

The setup repo that installed the port before this one made these changes when it swept the prose that `check-port.mjs` flagged. `UPSTREAM.md` never listed them, so each note names that repo's commit and the finding it answered. Each file also carries the Cursor affordance sweep below.

- modified `skills/automate-me/SKILL.md`: 9aa9708 answered the `allow-multiple` finding with `multiSelect` and cut each question to 2 to 4 options, because `AskUserQuestion` takes at most 4
- modified `skills/control-cli/SKILL.md`: 9aa9708 answered the `tmp` finding at line 107, and the rewritten paragraph names a Windows driver, a terminal multiplexer's pane or a `child_process` pipe, where `tmux`, `expect` and `pty` are absent
- modified `skills/poteto-mode/playbooks/babysit.md`: ccc651c answered the `cursor` and `loop-vocabulary` findings. It removed the line that routed away from Cursor's built-in babysit skill, made `/loop` self-paced, and counts passes from the review comments because the watcher's counter reads only Bugbot
- modified `skills/poteto-mode/playbooks/multi-phase-plan.md`: ccc651c replaced `/goal` with `orch standing add`, trunk re-reads with reads from disk and `/tmp` with the scratchpad, and turned the lane VM video into a screen recording or screenshot sequence and the operator's click into a confirmation
- modified `skills/poteto-mode/playbooks/orchestrate.md`: ccc651c dropped the liveness probe through `ListAgents`, which no harness build here exposes, for a read of a cloud session's PR and branch, and says that a `SendMessage` resume hands an agent new work
- modified `skills/poteto-mode/playbooks/worktree-cleanup.md`: ccc651c answered the `cursor` and `macos-ungated` findings at line 10. It dropped Cursor's own cache and put the Windows reclaimers (`%LOCALAPPDATA%\Temp`, a worktree pool) beside the macOS ones
- modified `skills/poteto-mode/scripts/orch/orch.test.ts`: 3b37efc made the fake `gt` work on Windows with the PATH delimiter, `pwd -W` and a `gt.cmd` shim. The fake was POSIX-only, so two tests ran the real binary
- modified `skills/teach/SKILL.md`: 9aa9708 replaced Cursor's image-generation tool with an inline SVG drawn through the Artifact tool

### Cursor affordance sweep

The rewrites `check-port.mjs` demands, one per class: a principle is `**principle-<slug>**`; a todolist is a step list carried in the reply; `pstack/skills/` paths and `git show origin/main:` re-reads become reads from `~/.claude/skills`; `/goal` becomes `orch standing`; `readonly` and `run_in_background` are not Agent parameters, so a read-only delegate is told so in its prompt; `/tmp` is the scratchpad directory the system prompt names; a Cursor cloud agent is a cloud session; `skill-creator` is `anthropic-skills:skill-creator`; `allow_multiple` is `multiSelect`; `/loop` takes an interval or self-paces; macOS-only steps name their platform. `poteto-mode/SKILL.md` also gains the rule for resolving skills and principles by path.

- modified `agents/poteto-agent.md`
- modified `skills/architect/SKILL.md`
- modified `skills/architect/references/runner-prompt.md`
- modified `skills/arena/SKILL.md`
- modified `skills/control-ui/SKILL.md`
- modified `skills/create-verification-skill/references/feature-map-example/README.md`
- modified `skills/figure-it-out/SKILL.md`
- modified `skills/how/SKILL.md`
- modified `skills/interrogate/SKILL.md`
- modified `skills/no-comments/SKILL.md`
- modified `skills/poteto-mode/SKILL.md`
- modified `skills/poteto-mode/playbooks/authoring-a-skill.md`
- modified `skills/poteto-mode/playbooks/autonomous-run.md`
- modified `skills/poteto-mode/playbooks/autopilot-full.md`
- modified `skills/poteto-mode/playbooks/autopilot-stack.md`
- modified `skills/poteto-mode/playbooks/bug-fix.md`
- modified `skills/poteto-mode/playbooks/feature.md`
- modified `skills/poteto-mode/playbooks/hillclimb.md`
- modified `skills/poteto-mode/playbooks/pause-safely.md`
- modified `skills/poteto-mode/playbooks/perf-issue.md`
- modified `skills/poteto-mode/playbooks/prototype.md`
- modified `skills/poteto-mode/playbooks/refactoring.md`
- modified `skills/poteto-mode/playbooks/runtime-forensics.md`
- modified `skills/poteto-mode/playbooks/session-pickup.md`
- modified `skills/poteto-mode/playbooks/shipping.md`
- modified `skills/poteto-mode/playbooks/trace-forensics.md`
- modified `skills/poteto-mode/playbooks/visual-parity.md`
- modified `skills/reflect/SKILL.md`
- modified `skills/reflect/references/synthesizer.md`
- modified `skills/setup-pstack/SKILL.md`
- modified `skills/show-me-your-work/SKILL.md`
- modified `skills/swarm/SKILL.md`
- modified `skills/typescript-best-practices/references/patterns.md`
- modified `skills/verify-this/SKILL.md`
- modified `skills/why/SKILL.md`

## Live install to this repo

`git diff -M live-2026-09-23 main`. What this repo changed after it took over from dotfiles. Record a new class here for every later change.

The repo carries every upstream and reference file that still has a use, and `install.json` decides what a machine installs. Five kinds of removed file stay out, because a file here replaces each one. The 23 `principle-*` skills are the files under `skills/poteto-mode/principles/`. The reference's `hooks/session-context.mjs` became `skills/poteto-mode/hooks/pstack-hook.mjs`, and its root `pstack-models.md` is the copy under `skills/poteto-mode/`. The Cursor manifest `.cursor-plugin/plugin.json`, its marketplace logo `assets/logo.png`, the reference's `.claude-plugin/plugin.json` and its `hooks/hooks.json` all described a plugin install, and `install.json` describes the personal-skill install that replaced it. The Claude Code plugin manifest has no logo field, so the logo has no reader.

### Ignored files

Not from pstack. `.gitignore` keeps `node_modules/`, macOS folder files, logs, a local `.cache/` and an owner's `.port-check-terms` out of the repo.

- added `.gitignore`

### Upstream reading material restored

The guide and upstream's README, byte for byte from upstream. The reference port had dropped the guide's images while its pages still link them.

- added `docs/UPSTREAM-README.md`
- added `docs/guide/01-setup.md`
- added `docs/guide/02-poteto-mode.md`
- added `docs/guide/03-understand.md`
- added `docs/guide/04-design.md`
- added `docs/guide/05-build-and-clean.md`
- added `docs/guide/06-verify-and-ship.md`
- added `docs/guide/07-overnight.md`
- added `docs/guide/08-principles.md`
- added `docs/guide/09-make-it-yours.md`
- added `docs/guide/10-recipes-and-pitfalls.md`
- added `docs/guide/README.md`
- added `docs/guide/images/design.jpg`
- added `docs/guide/images/overnight.jpg`
- added `docs/guide/images/recipes.jpg`
- added `docs/guide/images/router.jpg`
- added `docs/guide/images/understanding.jpg`
- added `docs/guide/images/verification.jpg`

### License files back at the root

The repository is the copy that ships, so the MIT notices sit at its root.

- renamed `skills/poteto-mode/licenses/LICENSE-pstack` to `LICENSE`
- renamed `skills/poteto-mode/licenses/cursor-team-kit.txt` to `LICENSES/cursor-team-kit.txt`

### Runtime reference

Not from pstack. The README keeps the install and a short account of the hook, and `docs/runtime.md` holds the full list of hook events, asks and stop findings.

- added `docs/runtime.md`

### README structure check

Not from pstack. `scripts/readme.test.js` fails when a README heading repeats or starts in the middle of a line, because a scripted edit once passed a dollar sign and a backtick through `String.prototype.replace`, which pasted the whole README into its own hook section.

- added `scripts/readme.test.js`

### Tracked path length check

Not from pstack. `scripts/paths.test.js` fails on a tracked path longer than 100 characters, because Git for Windows leaves `core.longpaths` off and a clone into a deep directory failed on a 126-character fixture path. That fixture's child chat now goes by the first segment of its id.

- added `scripts/paths.test.js`

### README chart and social preview

Not from pstack. `scripts/chart.mjs` draws `docs/assets/head-to-head.svg` from the parity round's `report.json`, so the README's chart shows only counts the report holds, and `scripts/chart.test.js` checks its labels. `scripts/brand.mjs` draws the social preview and the README banners from the same report and one palette, and `scripts/brand.test.js` checks their numbers and colors. `docs/assets/icons/` holds the README's feature icons.

- added `docs/assets/banner-dark.svg`
- added `docs/assets/banner-light.svg`
- added `docs/assets/head-to-head.svg`
- added `docs/assets/icons/diff.svg`
- added `docs/assets/icons/pull.svg`
- added `docs/assets/icons/retry.svg`
- added `docs/assets/icons/shield.svg`
- added `docs/assets/icons/terminal.svg`
- added `docs/assets/icons/transcript.svg`
- added `docs/assets/social-preview.html`
- added `docs/assets/social-preview.png`
- added `scripts/brand.mjs`
- added `scripts/brand.test.js`
- added `scripts/chart.mjs`
- added `scripts/chart.test.js`

### Provenance note replaced

`README.md` and this file carry what `UPSTREAM.md` said, so the note is gone from the skill directory.

- deleted `skills/poteto-mode/UPSTREAM.md`

### verify-pstack proves the pstack hook runtime

The skill named paths inside dotfiles and now names paths in this repo. Its drive entered the mode by reading `SKILL.md`, which no longer turns the mode on. `doctor.mjs` checks each hook registration, the `env` key, the agent links and the hook error log against `install.json`. The drive pipes `/poteto-mode` on stdin with a bug that needs a playbook, runs a control session and a `pstack-reader` write, and `judge.mjs` reads the transcripts for one verdict per feature: hook context, mode reminder, step ledger, gate, action gate, reader, task tools and port clean. The action gate verdict needs an errored tool_result carrying a `[pstack:design:` tag, then a data-shape line, then an ok Edit or Write of a code file. The gate verdict counts a routing finding fixed when a later reply names a route, a skill finding fixed by a read of the skill or a `skip` line that names the skill, and a data shape finding fixed by a line that names the data shape. It counts a read with `docsIn` from `hooks/catalog.mjs`, so a shell read counts exactly as the hook counts it, because its own Read-only count left a block unresolved after the model read unslop with `cat`. `drive.sh --settings FILE` adds a branch's hook registrations to every session, so a branch drives without parking the live checkout. The user settings stay loaded because they carry the skills and agents, so the live hooks fire beside the branch's. The seeded repos live under `~/.claude/pstack/verify/`, which pstack already owns, because a directory of their own under the home directory needed a `home-ref` exemption on every line that named it. Each session runs under `timeout`, `gtimeout` or `scripts/deadline.mjs`, since macOS ships no `timeout`, and a session that hits the deadline makes the judge report the features read from it INCONCLUSIVE instead of judging its partial transcript. When `~/.claude/skills/poteto-mode` is a copy rather than a link, `doctor.mjs` takes its own checkout as the served one and accepts an agent that is a byte-identical copy of the served file, because `scripts/install.mjs --copy` installs copies on a file system without links. The judge counts a tagged Stop block fixed when the gate's own rules, grading the turn's last stop with no tag counted, no longer find a tag the block named, because the gate names each finding once and a stop after a block passes with the finding still open. A block from before the tags is left to the text checks.

- modified `skills/verify-pstack/SKILL.md`
- modified `skills/verify-pstack/features/README.md`
- added `skills/verify-pstack/features/action-gate.md`
- added `skills/verify-pstack/features/gate.md`
- modified `skills/verify-pstack/features/hook-context.md`
- modified `skills/verify-pstack/features/mode-reminder.md`
- deleted `skills/verify-pstack/features/playbook-run.md`
- modified `skills/verify-pstack/features/port-clean.md`
- added `skills/verify-pstack/features/reader.md`
- added `skills/verify-pstack/features/step-ledger.md`
- added `skills/verify-pstack/features/task-tools.md`
- added `skills/verify-pstack/scripts/deadline.mjs`
- added `skills/verify-pstack/scripts/deadline.test.js`
- added `skills/verify-pstack/scripts/doctor.mjs`
- modified `skills/verify-pstack/scripts/drive.sh`
- added `skills/verify-pstack/scripts/fixtures/action-gate-no-deny/mode.jsonl`
- added `skills/verify-pstack/scripts/fixtures/action-gate-no-deny/reader-target.txt`
- added `skills/verify-pstack/scripts/fixtures/action-gate-no-shape/mode.jsonl`
- added `skills/verify-pstack/scripts/fixtures/action-gate-no-shape/reader-target.txt`
- added `skills/verify-pstack/scripts/fixtures/action-gate-no-write/mode.jsonl`
- added `skills/verify-pstack/scripts/fixtures/action-gate-no-write/reader-target.txt`
- added `skills/verify-pstack/scripts/fixtures/action-gate-shape-words/mode.jsonl`
- added `skills/verify-pstack/scripts/fixtures/action-gate-shape-words/reader-target.txt`
- added `skills/verify-pstack/scripts/fixtures/action-gate-shell-write/mode.jsonl`
- added `skills/verify-pstack/scripts/fixtures/action-gate-shell-write/reader-target.txt`
- added `skills/verify-pstack/scripts/fixtures/action-gate-verified/mode.jsonl`
- added `skills/verify-pstack/scripts/fixtures/action-gate-verified/reader-target.txt`
- added `skills/verify-pstack/scripts/fixtures/gate-block-unresolved/mode.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-block-unresolved/mode.stream.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-block-unresolved/reader-target.txt`
- added `skills/verify-pstack/scripts/fixtures/gate-design-fixed/mode.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-design-fixed/mode.stream.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-design-fixed/reader-target.txt`
- added `skills/verify-pstack/scripts/fixtures/gate-design-unresolved/mode.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-design-unresolved/mode.stream.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-design-unresolved/reader-target.txt`
- added `skills/verify-pstack/scripts/fixtures/gate-drive-skip-per-skill/mode.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-drive-skip-per-skill/mode.stream.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-drive-skip-per-skill/reader-target.txt`
- added `skills/verify-pstack/scripts/fixtures/gate-drive-skip-why-dropped/mode.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-drive-skip-why-dropped/mode.stream.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-drive-skip-why-dropped/reader-target.txt`
- added `skills/verify-pstack/scripts/fixtures/gate-drive-taskupdate-fixed/mode.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-drive-taskupdate-fixed/mode.stream.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-drive-taskupdate-fixed/reader-target.txt`
- added `skills/verify-pstack/scripts/fixtures/gate-routing-fixed/mode.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-routing-fixed/mode.stream.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-routing-fixed/reader-target.txt`
- added `skills/verify-pstack/scripts/fixtures/gate-routing-unresolved/mode.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-routing-unresolved/mode.stream.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-routing-unresolved/reader-target.txt`
- added `skills/verify-pstack/scripts/fixtures/gate-steps-missing/mode.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-steps-missing/mode.stream.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-steps-missing/reader-target.txt`
- added `skills/verify-pstack/scripts/fixtures/gate-tag-cleared/mode.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-tag-cleared/mode.stream.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-tag-cleared/reader-target.txt`
- added `skills/verify-pstack/scripts/fixtures/gate-tag-uncleared/mode.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-tag-uncleared/mode.stream.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-tag-uncleared/reader-target.txt`
- added `skills/verify-pstack/scripts/fixtures/gate-verified/mode.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-verified/mode.stream.jsonl`
- added `skills/verify-pstack/scripts/fixtures/gate-verified/reader-target.txt`
- added `skills/verify-pstack/scripts/fixtures/step-ledger-relative-read/mode.jsonl`
- added `skills/verify-pstack/scripts/fixtures/step-ledger-relative-read/mode.stream.jsonl`
- added `skills/verify-pstack/scripts/fixtures/step-ledger-relative-read/reader-target.txt`
- added `skills/verify-pstack/scripts/judge.mjs`
- added `skills/verify-pstack/scripts/judge.test.js`

### Paths follow this repo

The port scripts named paths inside dotfiles. They name paths in this repo, and `check-port.mjs` no longer skips the deleted `UPSTREAM.md`. `check-port.mjs` also scans `agents/`, flags Cursor's `is_background` and a read-only spawn that does not name `pstack-reader`, and `port.test.js` left the hook's tests to `pstack-hook.test.js`. Its `project-term` rule fails any shipped file under `skills/` or `agents/`, tests and fixtures aside, that names a project or tool this port was built around, because a generality review found such names in hook code and in skill text. It skips any public-repo snapshot under a `fixtures/repos/` directory, which holds other projects' manifests kept byte for byte. The `project-term` terms match whole words only. `home-path` fails a shipped file that names a home directory such as `C:/Users/<name>/` with a real name, and `home-ref` one that names a file under `~/` outside `~/.claude/`, because pstack runs in every user's home. `project-term` and `home-path` also read tests and fixtures, where a home path may name only the user `me`, because transcript fixtures cut from real sessions shipped the owner's home directory and project names. Those fixtures now hold neutral names with every signature and id kept byte for byte, and the `u6` fixtures are `run6`. `project-term` matches in any case and where `_` or `-` joins a term to another word, and it names the crew terms too, because fixtures still carried the owner's tooling as environment names, function prefixes and capitalized prose. `command-regex` fails hook code outside `kinds.mjs` that spells a command vocabulary as a start-anchored regex group of three or more bare words, because a hard-coded terminal-tool regex once decided an ask from the tool a session happened to use. It reads only the skill directories and agent files `install.json` lists, because `~/.claude/skills` and `~/.claude/agents` also hold items from other places, and the hand list of skills it skipped had fallen behind them.

- modified `skills/poteto-mode/scripts/check-plan.test.js`
- modified `skills/poteto-mode/scripts/check-port.mjs`
- modified `skills/poteto-mode/scripts/port-codemod.mjs`
- modified `skills/poteto-mode/scripts/port.test.js`
- modified `skills/recall/SKILL.md`

### Lines fitted to one user removed

Three lines carried one user's setup into every install: control-cli named a Windows terminal multiplexer as the way to drive a CLI, worktree-cleanup named one worktree tool's pool, and opening-a-pr pointed PR titles at the user's own `~/COMMITS.md`. control-cli now names a PTY wrapper or a child-process pipe, worktree-cleanup names any worktree pool the tooling keeps, and the opening-a-pr title rule is upstream v0.15.2's again, word for word. A user's own title voice belongs in their overlay.

- modified `skills/control-cli/SKILL.md`
- modified `skills/poteto-mode/playbooks/opening-a-pr.md`
- modified `skills/poteto-mode/playbooks/worktree-cleanup.md`

### Prose skills invoked by the user again

`unslop` and `technical-writing` carry upstream's `disable-model-invocation: true` again, so their descriptions stay out of every session that does not ask for them. They match upstream and the reference port byte for byte. A user who wants the model to invoke them sets that in their own overlay, not in the shipped skill.

- modified `skills/technical-writing/SKILL.md`
- modified `skills/unslop/SKILL.md`

### Repository docs and checks

The README, the script that writes this report, the research notes from pstack-test, the agent rules for this repo, and the CI workflow that runs the port gate and the drift check. This report leaves itself out, so it can be written after the change it describes is committed.

- added `.github/workflows/check.yml`
- added `CLAUDE.md`
- added `README.md`
- added `docs/research/README.md`
- added `docs/research/claude-code-setup.md`
- added `docs/research/cloud-agents.md`
- added `docs/research/cost-and-quality.md`
- added `docs/research/hard-rules.md`
- added `docs/research/make-it-yours.md`
- added `docs/research/method.md`
- added `docs/research/playbooks.md`
- added `docs/research/skills.md`
- added `docs/research/sources.md`
- added `docs/research/verification.md`
- added `scripts/drift.mjs`

### Benny carried, not installed

Byte for byte from upstream, as the reference port copied it. `install.json` leaves it out, and upstream never registered these files as skills. `automations/benny/PORT.md` is new: it maps each Cursor piece to Claude Code and recommends a port.

- added `automations/benny/FOR_AGENTS.md`
- added `automations/benny/PORT.md`
- added `automations/benny/README.md`
- added `automations/benny/skills/reproduce-and-fix-issues/SKILL.md`
- added `automations/benny/skills/reproduce-and-fix-issues/references/control-adapter.md`
- added `automations/benny/skills/reproduce-and-fix-issues/references/feature-map.example.md`
- added `automations/benny/skills/reproduce-and-fix-issues/references/verify-existing-fix.md`
- added `automations/benny/skills/setup-benny/SKILL.md`
- added `automations/benny/skills/triage-issue-reports/SKILL.md`
- added `automations/benny/skills/triage-issue-reports/references/routing.example.md`
- added `automations/benny/templates/configuration.example.yaml`
- added `automations/benny/templates/reproduce-automation-prompt.md`
- added `automations/benny/templates/triage-automation-prompt.md`

### Reference port records carried

The reference port's `PORT.md` and `PATCHES.md`, byte for byte, moved from the root into the port's decision trail. They describe the plugin install and the substitution counts at the fork, so they stay frozen.

- added `docs/port-audit/PATCHES.md`
- added `docs/port-audit/PORT.md`

### Install manifest

`install.json` lists the skills and agents a machine links and the hook events it registers, so the dotfiles installer reads the set instead of globbing `skills/`. `scripts/install.test.js` checks each entry. The hook command changes into the hook's directory before it starts Node, because a session started with `MSYS_NO_PATHCONV=1` hands Node the unconverted `/c/Users/...` path that Git Bash makes of `~`, and the test runs each command that way. The manifest registers the pstack hook for eight events, ten registrations with `PreToolUse` on `Bash|PowerShell|Edit|Write|MultiEdit|NotebookEdit|TaskCreate|mcp__.*` and on `Agent`, `PostToolUse` on both `Read` and `Bash|PowerShell`, and `SessionEnd`. The PowerShell tool is a shell like Bash, and an MCP tool can open or merge a pull request, so both reach the demands. The `PreToolUse` shell, file, task and MCP registration and the `PostToolUse` shell one source `hooks/in-mode.sh` before Node, so a session outside the mode starts no Node for them. It carries `env` keys for `CLAUDE_CODE_ENABLE_TODO_TOOLS` and `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`, and installs `pstack-reader`. The second key exists because `claude -p` killed a worker that ended its turn to wait on a background agent after 600 s, and the message it printed names `0` as the way to wait indefinitely. The test runs each registration with a payload of its own and fails when a payload has no registration. Skills link into `~/.claude/skills` only, and `skills.optIn` names `~/.agents/skills` for Codex and other agents that read it, because Claude Code reads only the first.

- added `install.json`
- added `scripts/install.test.js`

### One installer for every OS

Not from pstack. `scripts/install.mjs` carries out `install.json` with Node alone, because the install steps had been PowerShell in the README and in the dotfiles scripts, which a macOS or Linux machine cannot run. It links each item on its own with the first `LINK_METHODS` row that works, a symlink, then a junction for a Windows directory, then a copy, so a Windows box without symlink rights still installs, and `--copy` starts at the copy row. It classifies each link path once as missing, ours, our copy, another link or foreign, and a table maps each state to one action. A foreign file or directory is never touched and makes the run exit 1. Copies are listed in `~/.claude/pstack/install-copies.json`, so a later run refreshes them instead of reading them as foreign. The settings merge removes every hook entry that runs `pstack-hook.mjs` or the old `session-context.mjs`, drops a group only when that emptied it, and appends `install.json`'s groups, so a second run yields the same object and writes nothing. It writes `settings.json` only when the merged object differs, backs up the original bytes first, and writes through a symlinked `settings.json` to its target. `--dry-run` prints the same plan and writes nothing. `scripts/install.test.js` runs the script in a fresh home for each case.

- added `scripts/install.mjs`

### One transcript parser and one rules module

`hooks/trace.mjs` is the only code that parses a Claude Code transcript. It reads one into a `Trace`: turns opened by real user prompts, a closed union of actions, and the subagent tree. A shell action is its command text alone. Each turn lists the `[pstack:<key>:<hash>]` tags its hook denies, gate blocks and notes carried, with the call a deny refused, and the trace records no narration. It also derives poteto mode from the `/poteto-mode` command record, so a read of `SKILL.md` never turns the mode on. `hooks/catalog.mjs` reads the skills tree into a catalog: playbooks, their steps and the skills each step names, principles, the model table and the standing-skips file format. Both modules sit in the installed tree so the session hook can import them. `trace.test.js` checks the parser against a fixture trimmed from a real session. The parity eval reads Claude Code sessions through it too, so a turn keeps each text's place among its actions, a spawn keeps its `run_in_background` flag, and a read keeps whether its result held the whole file. The asks, the Stop gate and the audit count a doc read only after the actor's last compaction, because a compaction summarizes the read's content away. `trace-cache.mjs` keeps each subagent transcript's parsed turns under `~/.claude/pstack/trace-cache`, reused while the file keeps its size and modification time and the parser source is unchanged, and `SessionStart` prunes entries older than 14 days, because a commit check on a long session parsed 82 MB of finished delegate transcripts again on every call. `readClaudeTrace` returns before listing the subagents when no child can be kept.

- added `skills/poteto-mode/hooks/catalog.mjs`
- added `skills/poteto-mode/hooks/fixtures/bundled-deny.jsonl`
- added `skills/poteto-mode/hooks/fixtures/deny-retry.jsonl`
- added `skills/poteto-mode/hooks/fixtures/first-edit-two-playbooks.jsonl`
- added `skills/poteto-mode/hooks/fixtures/parent-edit-after-spawn.jsonl`
- added `skills/poteto-mode/hooks/fixtures/run-records.jsonl`
- added `skills/poteto-mode/hooks/fixtures/session.jsonl`
- added `skills/poteto-mode/hooks/fixtures/session/subagents/agent-a1.jsonl`
- added `skills/poteto-mode/hooks/fixtures/session/subagents/agent-a1.meta.json`
- added `skills/poteto-mode/hooks/fixtures/session/subagents/agent-a2.jsonl`
- added `skills/poteto-mode/hooks/fixtures/session/subagents/agent-a2.meta.json`
- added `skills/poteto-mode/hooks/fixtures/skills/figure-it-out/SKILL.md`
- added `skills/poteto-mode/hooks/fixtures/skills/how/SKILL.md`
- added `skills/poteto-mode/hooks/fixtures/skills/poteto-mode/playbooks/feature.md`
- added `skills/poteto-mode/hooks/fixtures/skills/poteto-mode/principles/prove-it-works.md`
- added `skills/poteto-mode/hooks/fixtures/skip-design-retry.jsonl`
- added `skills/poteto-mode/hooks/fixtures/unrouted-first-edit.jsonl`
- added `skills/poteto-mode/hooks/trace-cache.mjs`
- added `skills/poteto-mode/hooks/trace-cache.test.js`
- added `skills/poteto-mode/hooks/trace.mjs`
- added `skills/poteto-mode/hooks/trace.test.js`

### One pstack hook that holds the mode, hands over the steps and gates the stop

`pstack-hook.mjs` replaced `session-context.mjs`. A pure `respond` holds the policy for eight events. `SessionStart` and `SubagentStart` inject the context, under the 2 KB preview, plus the mode reminder for `poteto-agent` and `pstack-reader`. `UserPromptSubmit` holds poteto mode from the `/poteto-mode` prompt itself until `/poteto-mode off`, reading the mode from the transcript, and skips the reminder on a task notification, whose payload `prompt` starts with `<task-notification>` (measured). The reminder on the entering prompt asks to route step-away work through figure-it-out, because the routing decision is made at the prompt. It no longer asks for a route line, since poteto-mode's `SKILL.md` never requires one and a Stop check of it was false in 6 of 6 judged samples. `PostToolUse` on `Read` hands back a playbook's numbered steps, with their indented sub-items, as a ledger, and so does `PostToolUse` on `Bash` when the command names a playbook path in the installed tree, because a verify-pstack drive caught opus reading `bug-fix.md` with `cat` and getting no ledger. `PreToolUse` runs the asks in `asks.mjs` and `Stop` and `SubagentStop` run the gate in `gate.mjs`, over the same span of the actor's transcript. Every block reason ends by asking for the complete final answer again with the findings fixed and no mention of the gate, because `claude -p` and a parent agent receive only the last message, and a parity run ended on a note to the hook with its real answer stranded earlier. `SubagentStop`'s wording says the parent sees only that message. `PreToolUse` on `Agent` returns `updatedInput` with the ledger of the playbook a brief's `Playbook: <title>` line names appended, which a probe showed reaching the subagent's first message. It sets no `permissionDecision`, so a user's `ask` rule on `Agent` still applies. A `poteto-agent` call whose payload names no agent id goes through, because the hook cannot find the transcript that holds its tags and an ask could never be spent. A `Stop` the hook re-entered, with `stop_hook_active` set, passes on every tag the previous stop would have blocked, and passes outright when its turn has no previous stop, so a block whose feedback never reached the transcript cannot repeat. The shipped model table is the last fallback wherever the hook or the audit looks one up, and the transcript directory is parsed with `win32.dirname` so a Windows path reads right on Linux CI. `PSTACK_GATE` switches the gate to `observe` or `off`. `PreToolUse` on `Bash` denies a `pstack-reader` subagent any write, because agent-file frontmatter hooks never fired in probes on Claude Code 2.1.281. `PreToolUse` refuses every actor, in the mode or out of it, an edit of a file named `pstack-skips.md` or a shell command that names one and writes, because a standing skip an agent writes waives its own asks. Any exception exits 0 and logs one line. `SessionStart`, `UserPromptSubmit`, `Stop` and every tool call Node sees write or remove the session's mode marker, and `SessionEnd` removes it. Every pstack hook registration gives the hook 30 s, because a `pstack-reader`'s PreToolUse ran 11.6 s on a verify drive under load against the old 10 s timeout, Claude Code cancelled it and the write went through. Any event that runs longer than 5 s, a sixth of that timeout, logs one line to `hook-errors.log`. `scripts/bench-hook.mjs` times each event in-process and as a whole process on any transcripts and splits the time by phase. On a 9 MB transcript it measured `respond` at 57 to 92 ms per event with the one-shot asks, against 113 to 204 ms for the demand table they replaced.

- added `scripts/bench-hook.mjs`
- added `skills/poteto-mode/hooks/pstack-hook.mjs`
- added `skills/poteto-mode/hooks/pstack-hook.test.js`
- deleted `skills/poteto-mode/hooks/session-context.mjs`

### One-shot asks at the action and a certain Stop gate

`hooks/asks.mjs` holds what a tool call owes in poteto mode, as one table of rules keyed by trigger. `triggersOf` reads a call's structured input alone: an edit tool's path, which `fileKind` in `hooks/kinds.mjs` sorts by its shape into code, a skill document, a reader document, a decision log or other; a task tool's items; a spawn's brief; an MCP tool name; and a commit, PR-open or PR-merge verb that `vcsVerbs` finds in a shell command from one fixed table. The runtime once guessed what a shell command wrote, read or tested, and whether the worker had answered each ask from narration and skip lines, and 17 of 18 reviews in one day broke on a new edge case of that premise while four modules grew by 934 lines. So an ask is now one-shot: `check` denies once per `[pstack:<key>:<hash>]` tag in a mode span, the hash taken from the ask's target, and the retry goes through with no check of the answer. A wrong trigger or a legitimate skip costs one retry and never a stuck session. A deny carries only the first ask the call owes, in `RULES` order, and the retry raises the next. Three asks whose answer is literal in the next call are hard and deny up to 3 times per tag: a merged task item, a delegate off its role's model and a draft PR. A tag counts from any errored tool result, since no Claude Code version promises the deny's wording. The first code edit of a turn is asked for the Shape line alone, and the next code edit after that deny for the model-the-domain read, because a replay of the merged deny got the read 5 of 5 times and the line 0 of 5, and one ask per deny got the line 3 of 3. A playbook with a delegation step asks at the first code edit inside a git repository with no spawn since its read, once per playbook and before the Shape line, because two scored sessions never delegated while the model hint rode only on a deny that did not fire. The repository check walks up to a `.git`, `.hg`, `.jj`, `.sl` or `.svn` entry, stops at a UNC share root, reads a failing probe as no repository, and reaches `respond` through its deps; it is the one filesystem read an ask makes, because measurement harnesses and probes outside any repository made 7 of 10 judged delegate asks false. A step-done ask leaves out a skill a step names under a condition or hands to another actor, since naming conditional skills made 6 of 13 judged asks false, and a `skip: <reason>` in the worker's own words answers the step. Any markdown file in a skill's directory is a skill document. Round 5 added certain checks from five scored sessions that plateaued: the Stop gate asks once per turn for a Shape line when the turn edited code and no visible text named the data shape; the delegate ask skips test files and, after each spawn, asks the parent's first repository edit once to send the change back, because a session edited product code after its delegate returned. Round 6 dropped the Stop rule that asked for measured, inferred or guess labels on a reply over 150 words, because 11 of 12 judged findings were replies that carried their evidence as quoted output and citations. It also dropped the round-5 ask for a step that went to completed without in_progress: 7 of 10 judged asks were resumed sessions catching their list up, and after passing items that said the step was met already, 6 of 8 were still false, because such items say so in words no narrow list holds. The Shape ask passes when a visible text earlier in the turn already names the data shape, because an edit the delegate ask held back was asked again for a line it had. Round 7 made the checks general. Only a literal `**Shape.**` line with content names the shape, and a `skip design: <reason>` line answers the Stop rule, so the sentence `No data shape changes here` no longer passes. Only a `poteto-agent` spawn counts toward the send-back ask, as it does for deslop, so an explorer or reviewer spawn opens no new ask. One exported predicate, `isHarness`, names test, spec, fixture and bench files for both the doc kinds and the delegate exemption, and it covers `conftest.py`, `*_spec.*`, `spec/`, `testdata/`, `fixtures/`, `src/*Test/` and `*.Tests/` layouts. Round 8 added a `route` ask, because a scored session that never read a playbook met no ledger or delegate ask and scored 3.5 of 8. It asks the main session once per mode span at its first change (an edit outside scratch, a commit, or a spawn whose brief names no playbook) while nothing in the span, or in a sibling call of the same message, read a playbook or figure-it-out. Asking at the first call that did work was false on 14 of 14 judged census asks: subagents, read-only shell calls, and a playbook read batched beside the asked call. On a code edit it goes before the Shape line. The long-dash Stop rule reads every visible text of the turn, not only the reply, and quotes the first line that holds the dash. The mode reminder ends with the six rules the scored sessions missed most. Round 9 closed a review of rounds 7 and 8. The route ask reads a `change` trigger (an edit of code, a skill doc or a reader doc, a commit, or a `poteto-agent` spawn whose brief names no playbook) and counts only a playbook read earlier in the same message, because a later sibling's record reached the transcript after the first call's result in about half of the measured cases. The ledger ask goes alone on a code edit and the delegate ask waits for the next one. A long dash only in earlier text of the turn asks not to use it again, since sent text cannot change, and any `[pstack:` in quoted worker text is broken so the parser never reads a spent tag from it. `poteto-mode/SKILL.md` now states the literal Shape line, `skip design: <reason>` and `skip route: <reason>`, so each convention the hook checks is written in the skill. Round 10 reads the files a shell command writes from its literal words (redirect targets, `tee`, `sed -i`, `perl -i`, and the destination of `cp`, `mv` or `install`) and raises the asks an Edit of each would, because a live drive edited `total.js` with `sed -i` and wrote a test through a heredoc and met no Shape ask. A Python or Node script's writes stay unseen. The Shape ask now also waits while a ledger ask is owed. A shell target counts as code only by a source extension, because a judged ask was a redirect into `ilv1.console`, and only a statement that runs `log.sh` is a trail write, because a `grep` of it drew a decision-log ask. A deny now carries one ask for every key, in one table order, replacing the pairwise waits, because a live drive's deny bundled the Shape and deslop asks and the worker did the deslop read and never wrote the Shape line. `judge.mjs` counts a source write the way the hook counts a code edit, shell writes included. Round 11 drops the code-edit and change triggers of a file git ignores, through `git check-ignore` on the same Disk seam as the repository check, because a scored session was asked to delegate and name a Shape for its own profiling scripts under a gitignored `.verify/`. A `skip design:` line in the turn answers `design-read` too, because the same session was asked for the read right after it declined the Shape line. Counting only test-named files as harness was tried and reverted: it rightly asked a fix to a helper library under `tests/verification/` to delegate, but it also asked two new `*.verify.sh` proof scripts, so 2 of 4 judged new asks were false. Round 12 expands a variable the command sets to a literal path before reading its shell writes, because a scored session edited a SKILL.md, AGENTS.md and a doc through `sed -i ... $W/...` and met no skill-edit ask. deslop is owed per commit that carries new code, not answered for the span by one read of the skill, because a later commit of new code went unasked. skill-edit asks once per skill directory, because one command writing eight files of a skill drew eight asks, and a commit into a clone of a bare repository made under a temp directory, in the same command or an earlier one, is a throwaway. deslop skips a commit into a repository the same command creates under a temp or scratch directory, and still asks a project's real first commit. Only text that opens with the gate's block counts as gate feedback, so a prompt that quotes an old block starts a turn and spends no tag. The principle-read deny, a commit's and a PR open's also carry the sentences no certain check can raise: architect for a change across a function boundary, a control skill for a shipped surface, and Hillclimb's kept-attempt rule. A shell command reads a doc only through a file-reader statement: one that names the doc's path, a principle's slug inside the principles directory or a glob of it, or `SKILL.md` after a `cd` into the skill, because a judged sample found 11 of 12 cited-unread findings false on loop and variable reads, and a review found a slug in a grep or a commit message counted as a read. A step-done ask is answered by a `skip` naming the step's skill, or a done word beside a prior session, in the item or the completing call, with the sentences it copies from the step's own line left out, deslop asks only after a code edit or a `poteto-agent` spawn since the last commit, and a shell `>>` append to a decision log is a trail write. `hooks/gate.mjs` holds the Stop rules that read only certain facts, without the routing rule, which was false in 6 of 6 judged samples, each blocking once per tag, and logs to `retry-unmet.log` each doc-read ask whose call went through with the doc still unread. The Span a PreToolUse check sees carries no reply or narration, so no check before a call can read either, and only whether a visible text of the turn named the data shape. `asks.test.js` and `gate.test.js` hold one row per rule with its literal deny or block and the retry verdicts, and replay a recorded deny and its retry from a transcript. `hooks/in-mode.sh` is sourced before Node on the filtered registrations and ends the hook outside the mode unless the session's marker under `~/.claude/pstack/live/` exists or the payload names `poteto-agent`, `pstack-reader`, a playbook path or a standing-skips file. `scripts/replay-demands.mjs` replays the asks over the in-mode calls of any transcripts, as a live session meets them, and prints one markdown row per ask with its tag.

- added `scripts/replay-demands.mjs`
- added `scripts/replay-demands.test.js`
- modified `skills/poteto-mode/SKILL.md`
- added `skills/poteto-mode/hooks/asks.mjs`
- added `skills/poteto-mode/hooks/asks.test.js`
- added `skills/poteto-mode/hooks/gate.mjs`
- added `skills/poteto-mode/hooks/gate.test.js`
- added `skills/poteto-mode/hooks/in-mode.sh`
- added `skills/poteto-mode/hooks/kinds.mjs`

### Standing skips belong to the user

Not from pstack. setup-pstack tells the user how to waive a writing convention in every session with `skip <name>: <reason>` lines in `~/.claude/pstack-skips.md` or a project's `.claude/pstack-skips.md`. The hook refuses any agent's write, copy or move into a file of that name, in the mode or out of it, because a line there excuses its writer in every span, so the skill hands the user the line to add instead of offering to add it. A standing skip waives only the names in `STANDING_WAIVABLE` (technical-writing, unslop, commit-prose, docs-prose, pr-prose, pr-draft), by its name alone, and a project's file counts only when a `trust <root> <sha256>` line in the user's file names its current contents, because a generality review found that a committed `.claude/pstack-skips.md` arriving by clone or pull could switch off the ledger, the delegate, the surface and deslop unseen. `SessionStart` shows the user the active, ignored and untrusted standing skips in a `systemMessage`, since that reaches the user and not the model.

- modified `skills/setup-pstack/SKILL.md`

### Every trigger and step skill has an enforcer on record

Not from pstack. `hooks/census.json` maps each trigger bullet in poteto-mode's `SKILL.md` and each skill a playbook step names to the ask rule, the Stop rule or the watcher entry that answers for it, and a watcher entry says in a sentence why nothing enforces it. `census.test.js` fails on a bullet or a step skill with no entry, on an entry nothing live matches, on an ask key `RULES` in `asks.mjs` lacks, on a Stop rule id `STOP_RULES` in `gate.mjs` lacks, and on a cited line no shipped doc holds. It checks that every ask rule cites a shipped line, so that check has one home. It also pins whether the catalog reads each step skill as enforced or conditional, because a list's `or` in Refactoring step 1 once made its how read optional; an `or` now conditions only the skill it offers an alternative to, and two skills joined by `or` are one need. A skill named in a sentence whose work a delegate does, by a `DELEGATE_ACTORS` phrasing in `catalog.mjs` such as "one cloud session per PR" or a step's lane list, stays conditional for the actor running the playbook, because the root of an autopilot or shipping run cannot read deslop or a control skill for its owners and verifiers. Each `DELEGATE_ACTORS` phrasing must match a sentence of a playbook or a prose-routed doc, so a phrasing the docs stop using fails by name. The decision-trail trigger maps to the `trail` Stop row, which blocks once per span while a long or unattended playbook is live and nothing wrote a trail.

- added `skills/poteto-mode/hooks/census.json`
- added `skills/poteto-mode/hooks/census.test.js`

### Read-only delegates are pstack-reader

`how`, `why` and `interrogate` spawned `general-purpose` subagents and asked them in the prompt not to write. They now spawn `pstack-reader`, which has no edit tools and whose shell writes the hook denies, while it keeps the session's MCP tools that `why` needs. `poteto-agent` takes Claude Code's `background: true` in place of Cursor's `is_background`.

- modified `agents/poteto-agent.md`
- added `agents/pstack-reader.md`
- modified `skills/how/SKILL.md`
- modified `skills/interrogate/SKILL.md`
- modified `skills/why/SKILL.md`

### Step lists open with TaskCreate

Upstream opens a todolist with the playbook's steps or the skill's phases. With `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` in `install.json`, Claude Code has `TaskCreate` and `TaskUpdate`, so these skills open the list there and fall back to a list in the reply where no task tool exists.

- modified `skills/architect/SKILL.md`
- modified `skills/arena/SKILL.md`
- modified `skills/figure-it-out/SKILL.md`
- modified `skills/swarm/SKILL.md`

### Verification of the port

`audit-transcripts.mjs` reads Claude Code transcripts and counts how sessions used the harness: hook context, playbook steps, skill triggers, principle citations and subagent models. `--gate-replay` also grades every in-mode spawn the way the `PreToolUse` hook would. `docs/verification/` holds each dated verification report.

- added `scripts/audit-transcripts.mjs`
- added `scripts/audit-transcripts.test.js`

### Parity eval harness

Not from pstack, and never installed. `eval/parity/` runs the same scripted sessions through cursor-agent with upstream v0.15.2 and through Claude Code with a port tree, each in a sealed home. Two judges grade the blinded transcripts against upstream's text, `opus` in Claude Code and `gpt-5.6-sol-high` in Cursor, and a second `opus` judge breaks ties. The two `opus` judges share a model and stay independent through fresh contexts and blind packets. The calibration on record (0.06 false flags for J1) was measured with J1 on fable, so the next run re-measures it on `opus`. The Cursor judge is the eval's only judge from another vendor. It stays because the eval compares a Claude Code arm with a Cursor arm and runs outside the installed skills, which are all the Claude-only rule covers. It guards against a Claude judge favoring the Claude arm. Nobody has measured its strength against the Opus 5.5 workers. It exists to prove the port behaves like the plugin, and to show where it does not. `claude-trace.mjs` maps a `hooks/trace.mjs` trace into the eval's shape rather than parse transcripts a second time. A shell command that prints a pstack document with `cat`, `Get-Content`, `head`, `tail` or `sed -n` also counts as a read of it, whole or partial, and the packet shows it as a Read-tool read of that document, because workers in every arm read pstack docs through the shell and the judges credited only Read-tool reads. A line range counts as whole when it skips only the YAML frontmatter of the file on disk and reaches its last line, because workers print a principle from the line after its frontmatter. `--retrace` rebuilds every done run's trace, seal and packet from the transcripts saved with it and drops its verdicts, so a change to how traces are read reaches runs already graded, copied ones included. A run whose saved transcripts are gone fails instead of keeping its old trace.

- added `eval/parity/arms.mjs`
- added `eval/parity/arms.test.js`
- added `eval/parity/behaviors.mjs`
- added `eval/parity/behaviors.test.js`
- added `eval/parity/claude-trace.mjs`
- added `eval/parity/claude-trace.test.js`
- added `eval/parity/cursor-trace.mjs`
- added `eval/parity/cursor-trace.test.js`
- added `eval/parity/fixtures/cursor-probe1-transcripts/848c77a7/848c77a7.jsonl`
- added `eval/parity/fixtures/cursor-probe1.jsonl`
- added `eval/parity/fixtures/cursor-probe2.jsonl`
- added `eval/parity/fixtures/pstack-models.mdc`
- added `eval/parity/fixtures/skills/principle-frontmatter/SKILL.md`
- added `eval/parity/judge.md`
- added `eval/parity/judge.mjs`
- added `eval/parity/judge.test.js`
- added `eval/parity/mutate.mjs`
- added `eval/parity/mutate.test.js`
- added `eval/parity/package.json`
- added `eval/parity/packet.mjs`
- added `eval/parity/parity.mjs`
- added `eval/parity/plan.mjs`
- added `eval/parity/plan.test.js`
- added `eval/parity/results/s4/report.json`
- added `eval/parity/results/s4/report.md`
- added `eval/parity/results/s5/calib/t01-long-session.A.1.drop-principle-read/judge-J1.json`
- added `eval/parity/results/s5/calib/t01-long-session.A.1.drop-principle-read/judge-J3.json`
- added `eval/parity/results/s5/calib/t01-long-session.A.1.drop-principle-read/mutant.json`
- added `eval/parity/results/s5/calib/t01-long-session.A.1.drop-principle-read/packet.md`
- added `eval/parity/results/s5/calib/t01-long-session.A.1.drop-step-list/judge-J1.json`
- added `eval/parity/results/s5/calib/t01-long-session.A.1.drop-step-list/judge-J3.json`
- added `eval/parity/results/s5/calib/t01-long-session.A.1.drop-step-list/mutant.json`
- added `eval/parity/results/s5/calib/t01-long-session.A.1.drop-step-list/packet.md`
- added `eval/parity/results/s5/calib/t01-long-session.A.1.mode-lapse/judge-J1.json`
- added `eval/parity/results/s5/calib/t01-long-session.A.1.mode-lapse/judge-J3.json`
- added `eval/parity/results/s5/calib/t01-long-session.A.1.mode-lapse/mutant.json`
- added `eval/parity/results/s5/calib/t01-long-session.A.1.mode-lapse/packet.md`
- added `eval/parity/results/s5/calib/t01-long-session.A.2.drop-step-list/judge-J1.json`
- added `eval/parity/results/s5/calib/t01-long-session.A.2.drop-step-list/judge-J3.json`
- added `eval/parity/results/s5/calib/t01-long-session.A.2.drop-step-list/mutant.json`
- added `eval/parity/results/s5/calib/t01-long-session.A.2.drop-step-list/packet.md`
- added `eval/parity/results/s5/calib/t01-long-session.A.2.unlabeled-claim/judge-J1.json`
- added `eval/parity/results/s5/calib/t01-long-session.A.2.unlabeled-claim/judge-J3.json`
- added `eval/parity/results/s5/calib/t01-long-session.A.2.unlabeled-claim/mutant.json`
- added `eval/parity/results/s5/calib/t01-long-session.A.2.unlabeled-claim/packet.md`
- added `eval/parity/results/s5/calib/t01-long-session.B.1.mode-lapse/judge-J1.json`
- added `eval/parity/results/s5/calib/t01-long-session.B.1.mode-lapse/judge-J3.json`
- added `eval/parity/results/s5/calib/t01-long-session.B.1.mode-lapse/mutant.json`
- added `eval/parity/results/s5/calib/t01-long-session.B.1.mode-lapse/packet.md`
- added `eval/parity/results/s5/calib/t01-long-session.B.2.drop-skill-read/judge-J1.json`
- added `eval/parity/results/s5/calib/t01-long-session.B.2.drop-skill-read/judge-J3.json`
- added `eval/parity/results/s5/calib/t01-long-session.B.2.drop-skill-read/mutant.json`
- added `eval/parity/results/s5/calib/t01-long-session.B.2.drop-skill-read/packet.md`
- added `eval/parity/results/s5/calib/t01-long-session.B.2.mode-lapse/judge-J1.json`
- added `eval/parity/results/s5/calib/t01-long-session.B.2.mode-lapse/judge-J3.json`
- added `eval/parity/results/s5/calib/t01-long-session.B.2.mode-lapse/mutant.json`
- added `eval/parity/results/s5/calib/t01-long-session.B.2.mode-lapse/packet.md`
- added `eval/parity/results/s5/calib/t01-long-session.B.3.drop-step-list/judge-J1.json`
- added `eval/parity/results/s5/calib/t01-long-session.B.3.drop-step-list/judge-J3.json`
- added `eval/parity/results/s5/calib/t01-long-session.B.3.drop-step-list/mutant.json`
- added `eval/parity/results/s5/calib/t01-long-session.B.3.drop-step-list/packet.md`
- added `eval/parity/results/s5/calib/t03-how-why.A.1.unlabeled-claim/judge-J1.json`
- added `eval/parity/results/s5/calib/t03-how-why.A.1.unlabeled-claim/judge-J3.json`
- added `eval/parity/results/s5/calib/t03-how-why.A.1.unlabeled-claim/mutant.json`
- added `eval/parity/results/s5/calib/t03-how-why.A.1.unlabeled-claim/packet.md`
- added `eval/parity/results/s5/calib/t03-how-why.A.2.unlabeled-claim/judge-J1.json`
- added `eval/parity/results/s5/calib/t03-how-why.A.2.unlabeled-claim/judge-J3.json`
- added `eval/parity/results/s5/calib/t03-how-why.A.2.unlabeled-claim/mutant.json`
- added `eval/parity/results/s5/calib/t03-how-why.A.2.unlabeled-claim/packet.md`
- added `eval/parity/results/s5/calib/t03-how-why.B.1.drop-skill-read/judge-J1.json`
- added `eval/parity/results/s5/calib/t03-how-why.B.1.drop-skill-read/judge-J3.json`
- added `eval/parity/results/s5/calib/t03-how-why.B.1.drop-skill-read/mutant.json`
- added `eval/parity/results/s5/calib/t03-how-why.B.1.drop-skill-read/packet.md`
- added `eval/parity/results/s5/calib/t03-how-why.B.2.drop-skill-read/judge-J1.json`
- added `eval/parity/results/s5/calib/t03-how-why.B.2.drop-skill-read/judge-J3.json`
- added `eval/parity/results/s5/calib/t03-how-why.B.2.drop-skill-read/mutant.json`
- added `eval/parity/results/s5/calib/t03-how-why.B.2.drop-skill-read/packet.md`
- added `eval/parity/results/s5/calib/t04-bug-fix.A.1.drop-principle-read/judge-J1.json`
- added `eval/parity/results/s5/calib/t04-bug-fix.A.1.drop-principle-read/judge-J3.json`
- added `eval/parity/results/s5/calib/t04-bug-fix.A.1.drop-principle-read/mutant.json`
- added `eval/parity/results/s5/calib/t04-bug-fix.A.1.drop-principle-read/packet.md`
- added `eval/parity/results/s5/calib/t05-tax-receipt.A.2.drop-principle-read/judge-J1.json`
- added `eval/parity/results/s5/calib/t05-tax-receipt.A.2.drop-principle-read/judge-J3.json`
- added `eval/parity/results/s5/calib/t05-tax-receipt.A.2.drop-principle-read/mutant.json`
- added `eval/parity/results/s5/calib/t05-tax-receipt.A.2.drop-principle-read/packet.md`
- added `eval/parity/results/s5/frame.md`
- added `eval/parity/results/s5/report.json`
- added `eval/parity/results/s5/report.md`
- added `eval/parity/results/s5/runs/t01-long-session.A.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t01-long-session.A.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t01-long-session.A.1/packet.md`
- added `eval/parity/results/s5/runs/t01-long-session.A.1/seal.json`
- added `eval/parity/results/s5/runs/t01-long-session.A.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t01-long-session.A.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t01-long-session.A.2/packet.md`
- added `eval/parity/results/s5/runs/t01-long-session.A.2/seal.json`
- added `eval/parity/results/s5/runs/t01-long-session.B.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t01-long-session.B.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t01-long-session.B.1/packet.md`
- added `eval/parity/results/s5/runs/t01-long-session.B.1/seal.json`
- added `eval/parity/results/s5/runs/t01-long-session.B.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t01-long-session.B.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t01-long-session.B.2/packet.md`
- added `eval/parity/results/s5/runs/t01-long-session.B.2/seal.json`
- added `eval/parity/results/s5/runs/t01-long-session.B.3/judge-J1.json`
- added `eval/parity/results/s5/runs/t01-long-session.B.3/judge-J3.json`
- added `eval/parity/results/s5/runs/t01-long-session.B.3/packet.md`
- added `eval/parity/results/s5/runs/t01-long-session.B.3/seal.json`
- added `eval/parity/results/s5/runs/t01-long-session.C.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t01-long-session.C.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t01-long-session.C.1/packet.md`
- added `eval/parity/results/s5/runs/t01-long-session.C.1/seal.json`
- added `eval/parity/results/s5/runs/t01-long-session.C.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t01-long-session.C.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t01-long-session.C.2/packet.md`
- added `eval/parity/results/s5/runs/t01-long-session.C.2/seal.json`
- added `eval/parity/results/s5/runs/t01-long-session.E.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t01-long-session.E.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t01-long-session.E.1/packet.md`
- added `eval/parity/results/s5/runs/t01-long-session.E.1/seal.json`
- added `eval/parity/results/s5/runs/t01-long-session.E.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t01-long-session.E.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t01-long-session.E.2/packet.md`
- added `eval/parity/results/s5/runs/t01-long-session.E.2/seal.json`
- added `eval/parity/results/s5/runs/t01-long-session.E.3/judge-J1.json`
- added `eval/parity/results/s5/runs/t01-long-session.E.3/judge-J3.json`
- added `eval/parity/results/s5/runs/t01-long-session.E.3/packet.md`
- added `eval/parity/results/s5/runs/t01-long-session.E.3/seal.json`
- added `eval/parity/results/s5/runs/t01-long-session.N.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t01-long-session.N.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t01-long-session.N.1/packet.md`
- added `eval/parity/results/s5/runs/t01-long-session.N.1/seal.json`
- added `eval/parity/results/s5/runs/t01-long-session.N.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t01-long-session.N.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t01-long-session.N.2/packet.md`
- added `eval/parity/results/s5/runs/t01-long-session.N.2/seal.json`
- added `eval/parity/results/s5/runs/t01-long-session.N.3/judge-J1.json`
- added `eval/parity/results/s5/runs/t01-long-session.N.3/judge-J3.json`
- added `eval/parity/results/s5/runs/t01-long-session.N.3/packet.md`
- added `eval/parity/results/s5/runs/t01-long-session.N.3/seal.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.A.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.A.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.A.1/packet.md`
- added `eval/parity/results/s5/runs/t02-delegated-feature.A.1/seal.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.A.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.A.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.A.2/packet.md`
- added `eval/parity/results/s5/runs/t02-delegated-feature.A.2/seal.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.B.1/FAILED.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.B.2/FAILED.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.B.2/packet.md`
- added `eval/parity/results/s5/runs/t02-delegated-feature.B.2/seal.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.B.3/judge-J1.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.B.3/judge-J3.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.B.3/packet.md`
- added `eval/parity/results/s5/runs/t02-delegated-feature.B.3/seal.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.C.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.C.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.C.1/packet.md`
- added `eval/parity/results/s5/runs/t02-delegated-feature.C.1/seal.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.C.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.C.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.C.2/packet.md`
- added `eval/parity/results/s5/runs/t02-delegated-feature.C.2/seal.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.E.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.E.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.E.1/packet.md`
- added `eval/parity/results/s5/runs/t02-delegated-feature.E.1/seal.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.E.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.E.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.E.2/packet.md`
- added `eval/parity/results/s5/runs/t02-delegated-feature.E.2/seal.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.E.3/judge-J1.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.E.3/judge-J3.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.E.3/packet.md`
- added `eval/parity/results/s5/runs/t02-delegated-feature.E.3/seal.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.N.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.N.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.N.1/packet.md`
- added `eval/parity/results/s5/runs/t02-delegated-feature.N.1/seal.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.N.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.N.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.N.2/packet.md`
- added `eval/parity/results/s5/runs/t02-delegated-feature.N.2/seal.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.N.3/judge-J1.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.N.3/judge-J3.json`
- added `eval/parity/results/s5/runs/t02-delegated-feature.N.3/packet.md`
- added `eval/parity/results/s5/runs/t02-delegated-feature.N.3/seal.json`
- added `eval/parity/results/s5/runs/t03-how-why.A.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t03-how-why.A.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t03-how-why.A.1/packet.md`
- added `eval/parity/results/s5/runs/t03-how-why.A.1/seal.json`
- added `eval/parity/results/s5/runs/t03-how-why.A.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t03-how-why.A.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t03-how-why.A.2/packet.md`
- added `eval/parity/results/s5/runs/t03-how-why.A.2/seal.json`
- added `eval/parity/results/s5/runs/t03-how-why.B.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t03-how-why.B.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t03-how-why.B.1/packet.md`
- added `eval/parity/results/s5/runs/t03-how-why.B.1/seal.json`
- added `eval/parity/results/s5/runs/t03-how-why.B.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t03-how-why.B.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t03-how-why.B.2/packet.md`
- added `eval/parity/results/s5/runs/t03-how-why.B.2/seal.json`
- added `eval/parity/results/s5/runs/t03-how-why.B.3/judge-J1.json`
- added `eval/parity/results/s5/runs/t03-how-why.B.3/judge-J3.json`
- added `eval/parity/results/s5/runs/t03-how-why.B.3/packet.md`
- added `eval/parity/results/s5/runs/t03-how-why.B.3/seal.json`
- added `eval/parity/results/s5/runs/t03-how-why.C.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t03-how-why.C.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t03-how-why.C.1/packet.md`
- added `eval/parity/results/s5/runs/t03-how-why.C.1/seal.json`
- added `eval/parity/results/s5/runs/t03-how-why.C.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t03-how-why.C.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t03-how-why.C.2/packet.md`
- added `eval/parity/results/s5/runs/t03-how-why.C.2/seal.json`
- added `eval/parity/results/s5/runs/t03-how-why.E.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t03-how-why.E.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t03-how-why.E.1/packet.md`
- added `eval/parity/results/s5/runs/t03-how-why.E.1/seal.json`
- added `eval/parity/results/s5/runs/t03-how-why.E.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t03-how-why.E.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t03-how-why.E.2/packet.md`
- added `eval/parity/results/s5/runs/t03-how-why.E.2/seal.json`
- added `eval/parity/results/s5/runs/t03-how-why.E.3/judge-J1.json`
- added `eval/parity/results/s5/runs/t03-how-why.E.3/judge-J3.json`
- added `eval/parity/results/s5/runs/t03-how-why.E.3/packet.md`
- added `eval/parity/results/s5/runs/t03-how-why.E.3/seal.json`
- added `eval/parity/results/s5/runs/t03-how-why.N.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t03-how-why.N.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t03-how-why.N.1/packet.md`
- added `eval/parity/results/s5/runs/t03-how-why.N.1/seal.json`
- added `eval/parity/results/s5/runs/t03-how-why.N.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t03-how-why.N.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t03-how-why.N.2/packet.md`
- added `eval/parity/results/s5/runs/t03-how-why.N.2/seal.json`
- added `eval/parity/results/s5/runs/t03-how-why.N.3/judge-J1.json`
- added `eval/parity/results/s5/runs/t03-how-why.N.3/judge-J3.json`
- added `eval/parity/results/s5/runs/t03-how-why.N.3/packet.md`
- added `eval/parity/results/s5/runs/t03-how-why.N.3/seal.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.A.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.A.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.A.1/packet.md`
- added `eval/parity/results/s5/runs/t04-bug-fix.A.1/seal.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.A.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.A.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.A.2/packet.md`
- added `eval/parity/results/s5/runs/t04-bug-fix.A.2/seal.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.B.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.B.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.B.1/packet.md`
- added `eval/parity/results/s5/runs/t04-bug-fix.B.1/seal.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.B.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.B.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.B.2/packet.md`
- added `eval/parity/results/s5/runs/t04-bug-fix.B.2/seal.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.B.3/judge-J1.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.B.3/judge-J3.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.B.3/packet.md`
- added `eval/parity/results/s5/runs/t04-bug-fix.B.3/seal.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.C.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.C.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.C.1/packet.md`
- added `eval/parity/results/s5/runs/t04-bug-fix.C.1/seal.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.C.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.C.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.C.2/packet.md`
- added `eval/parity/results/s5/runs/t04-bug-fix.C.2/seal.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.E.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.E.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.E.1/packet.md`
- added `eval/parity/results/s5/runs/t04-bug-fix.E.1/seal.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.E.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.E.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.E.2/packet.md`
- added `eval/parity/results/s5/runs/t04-bug-fix.E.2/seal.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.E.3/judge-J1.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.E.3/judge-J3.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.E.3/packet.md`
- added `eval/parity/results/s5/runs/t04-bug-fix.E.3/seal.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.N.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.N.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.N.1/packet.md`
- added `eval/parity/results/s5/runs/t04-bug-fix.N.1/seal.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.N.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.N.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.N.2/packet.md`
- added `eval/parity/results/s5/runs/t04-bug-fix.N.2/seal.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.N.3/judge-J1.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.N.3/judge-J3.json`
- added `eval/parity/results/s5/runs/t04-bug-fix.N.3/packet.md`
- added `eval/parity/results/s5/runs/t04-bug-fix.N.3/seal.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.A.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.A.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.A.1/packet.md`
- added `eval/parity/results/s5/runs/t05-tax-receipt.A.1/seal.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.A.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.A.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.A.2/packet.md`
- added `eval/parity/results/s5/runs/t05-tax-receipt.A.2/seal.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.B.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.B.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.B.1/packet.md`
- added `eval/parity/results/s5/runs/t05-tax-receipt.B.1/seal.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.B.2/FAILED.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.B.3/judge-J1.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.B.3/judge-J3.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.B.3/packet.md`
- added `eval/parity/results/s5/runs/t05-tax-receipt.B.3/seal.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.C.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.C.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.C.1/packet.md`
- added `eval/parity/results/s5/runs/t05-tax-receipt.C.1/seal.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.C.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.C.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.C.2/packet.md`
- added `eval/parity/results/s5/runs/t05-tax-receipt.C.2/seal.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.E.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.E.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.E.1/packet.md`
- added `eval/parity/results/s5/runs/t05-tax-receipt.E.1/seal.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.E.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.E.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.E.2/packet.md`
- added `eval/parity/results/s5/runs/t05-tax-receipt.E.2/seal.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.E.3/judge-J1.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.E.3/judge-J3.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.E.3/packet.md`
- added `eval/parity/results/s5/runs/t05-tax-receipt.E.3/seal.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.N.1/judge-J1.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.N.1/judge-J3.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.N.1/packet.md`
- added `eval/parity/results/s5/runs/t05-tax-receipt.N.1/seal.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.N.2/judge-J1.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.N.2/judge-J3.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.N.2/packet.md`
- added `eval/parity/results/s5/runs/t05-tax-receipt.N.2/seal.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.N.3/judge-J1.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.N.3/judge-J3.json`
- added `eval/parity/results/s5/runs/t05-tax-receipt.N.3/packet.md`
- added `eval/parity/results/s5/runs/t05-tax-receipt.N.3/seal.json`
- added `eval/parity/retrace.test.js`
- added `eval/parity/score.mjs`
- added `eval/parity/score.test.js`
- added `eval/parity/seeds/cart.mjs`
- added `eval/parity/shell-reads.mjs`
- added `eval/parity/shell-reads.test.js`
- added `eval/parity/tasks/t01-long-session.json`
- added `eval/parity/tasks/t02-delegated-feature.json`
- added `eval/parity/tasks/t03-how-why.json`
- added `eval/parity/tasks/t04-bug-fix.json`
- added `eval/parity/tasks/t05-tax-receipt.json`

### Parity round s5 arms: the pstack-claude plugin and a no-pstack Claude control

Round s5 compares this port (arm B) with two more Claude Code arms. Arm E is michael-denyer/pstack-claude, the most-starred pstack port for Claude Code, pinned to one commit. `--init` keeps a bare clone of it in the sandbox and records the full commit in plan.json, so a run never reaches the network. Each E run unpacks that commit, adds it as a directory marketplace and installs the plugin through `claude plugin` inside the sealed home, then checks that Claude Code recorded the install path it expects. Arm N is Claude Code with no pstack, the control for the Claude side. Each arm names an install kind, and a table in `arms.mjs` keys everything that differs between installs by that kind: how a home is built, which directories a packet shows as `<pstack>`, and what a sealed home may hold. The seal proves each Claude arm saw only its own install. A run that touches another install's paths or receives another install's session context fails the seal. A `.claude/` inside the run's workspace belongs to the project, so paths under the workspace never count as an install. A run whose home holds another install's skills, agents, hooks or plugins fails it too. N also fails the seal when it loads a pstack skill. A principle the plugin loads through the Skill tool counts as a read of that principle in the packet, the mutations and the rubric, and the packet shows it at the path a port read shows. Each harness has its own control gate: V1-cursor needs A to beat C by 0.30, and V1-claude needs the better of B and E to beat N by 0.30. A comparison is inconclusive only when its own gate or a common gate fails. `score.mjs` resolves the two pre-registered claims from the mean gap over the behaviors both arms graded. Claim 1 is B against E: B is better at +0.10 or more, a tie within 0.10, and a loss below -0.10. Claim 2 is B against A: B is on par at -0.05 or more. A claim whose gate failed is reported as not certified. `plan.mjs` plans the runs. An arm reused from `--from` keeps the reps its source ran, and every other arm runs at `--reps`.

- added `eval/parity/arms.mjs`
- added `eval/parity/arms.test.js`
- added `eval/parity/behaviors.mjs`
- added `eval/parity/behaviors.test.js`
- added `eval/parity/claude-trace.mjs`
- added `eval/parity/claude-trace.test.js`
- added `eval/parity/cursor-trace.mjs`
- added `eval/parity/cursor-trace.test.js`
- added `eval/parity/mutate.mjs`
- added `eval/parity/mutate.test.js`
- added `eval/parity/packet.mjs`
- added `eval/parity/parity.mjs`
- added `eval/parity/plan.mjs`
- added `eval/parity/plan.test.js`
- added `eval/parity/score.mjs`
- added `eval/parity/score.test.js`

### Judges never run below the parent

Claude Code reaches only Claude models, so upstream's advice to judge on a different model family cannot be followed. A judgment role runs on the parent model or the top tier, never below it. `MODEL_TIERS` in `hooks/kinds.mjs` names pstack's tiers strongest first. The judge floor, the session context and `check-port.mjs` read the top tier from it, and `setup-pstack` writes its budget table in tier positions, so a lineup change is one edit. An account may name any alias the Agent tool lists in its own models file. The `model-default` rule in `check-port.mjs` fails a shipped model table value or a skill's model default outside those tiers, `inherit-parent` and `auto`, and passes prose that names another alias. The audit reads a subagent's family from its model ID with no list of families, so a run on a family outside the tiers still matches its request. A judge's independence comes from a fresh context, blind shuffled labels and evidence for each criterion. The shipped table drops sonnet from the cross-judge pool and the interrogate panel, and `setup-pstack` keeps judge tiers fixed across budgets. `check-port.mjs` flags family wording and any judgment role set below the parent, and the hook flags the same in the live table. A file keeps its first matching class, and this class is marked `also`, so `classify` lists the file here too, because these edits land in files that other classes already own.

- modified `skills/architect/SKILL.md`
- modified `skills/architect/references/runner-prompt.md`
- modified `skills/arena/SKILL.md`
- modified `skills/how/SKILL.md`
- modified `skills/interrogate/SKILL.md`
- modified `skills/poteto-mode/SKILL.md`
- added `skills/poteto-mode/hooks/pstack-hook.mjs`
- added `skills/poteto-mode/hooks/pstack-hook.test.js`
- modified `skills/poteto-mode/playbooks/eval.md`
- modified `skills/poteto-mode/playbooks/orchestrate.md`
- modified `skills/poteto-mode/pstack-models.md`
- modified `skills/poteto-mode/scripts/check-port.mjs`
- modified `skills/poteto-mode/scripts/port.test.js`
- modified `skills/reflect/SKILL.md`
- modified `skills/setup-pstack/SKILL.md`
- modified `skills/show-me-your-work/SKILL.md`
- modified `skills/why/SKILL.md`

### Carried over from dotfiles

dotfiles pinned LF endings for these scripts in its own `.gitattributes`, and this repo's `.gitattributes` pins them for every text file. `docs/port-audit/` holds the two `check-port.mjs` census runs from the 2026-09-22 port sweep. Its decision trail, a log of one maintainer's choices, is left out of the public tree.

- added `.gitattributes`
- added `docs/port-audit/census-after-codemod.txt`
- added `docs/port-audit/census-before.txt`
