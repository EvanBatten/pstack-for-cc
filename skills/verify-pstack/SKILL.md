---
name: verify-pstack
description: Drive the pstack agent harness the way a session experiences it and prove its behaviors with evidence. Use for /verify-pstack, after editing anything under poteto-mode or its hook, or when a session seems to have lost poteto mode.
---

# Verify pstack

pstack is not an app with a port. Its surface is what a Claude Code session receives from the hook and the skills, so proof means starting real headless sessions and reading what landed in their transcripts. Every check below runs the real thing and asserts on the artifact. Nothing reads the source of what it verifies.

The tree under test is the checkout this skill lives in. `~/.claude/skills` symlinks into it, so a headless session run from anywhere sees the checkout's current files; to verify a branch, check that branch out in the main checkout or point the hook probe at a worktree's copy with `HOOK=<path>`.

## Launch

Nothing to start. A drive spawns its own sessions and they exit when their turn ends.

## Doctor

Answers "is this tree worth driving?" in under a minute. Run from the repo root.

```
node home/.agents/skills/poteto-mode/scripts/check-port.mjs home/.agents/skills
node --test home/.agents/skills/poteto-mode/scripts/port.test.js home/.agents/skills/poteto-mode/scripts/check-plan.test.js
node -e 'const j=require(process.env.HOME+"/.claude/settings.json");for(const e of ["SessionStart","SubagentStart","UserPromptSubmit"])console.log(e, j.hooks[e]?.some(m=>m.hooks.some(h=>h.command.includes("session-context.mjs")))?"registered":"MISSING")'
readlink -f ~/.claude/skills/poteto-mode/SKILL.md
```

The check prints `0 findings`, every test is `ok`, all three events print `registered`, and the symlink resolves into this repo. Anything else, fix before driving; a drive on a broken base teaches wrong steps.

## Drive

`scripts/drive.sh` runs two headless sessions and reads their transcripts. It takes about two minutes and spends a few thousand tokens.

```
bash home/.agents/skills/verify-pstack/scripts/drive.sh
```

Turn one reads `poteto-mode/SKILL.md`, which is how a session enters the mode without the slash command. Turn two, resumed on the same session, asks an investigation question. A control session never touches pstack. The script then reads the three transcripts under `~/.claude/projects/` and prints one verdict per feature in `features/`.

## Evidence

Everything lands under `%TEMP%\pstack-verify\<UTC timestamp>\`: the JSON result of each turn, the three transcripts copied in full, and `verdicts.txt`. The verdict lines name the transcript line that proves each claim. A verdict is VERIFIED, NOT VERIFIED, or INCONCLUSIVE, and INCONCLUSIVE is not a pass.

## Cleanup

The drive creates three throwaway project directories under `~/.claude/projects/` whose names end in `-pstack-verify-<timestamp>-mode`, `-control`. `drive.sh --clean <timestamp>` removes exactly those three and nothing else. The evidence directory stays.

## Helpers

`scripts/drive.sh` is the only helper. Its invocation is above, and it is executable.
