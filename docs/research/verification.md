# Verification

> "The most critical skill to have in your toolbox is a high quality verification skill. This skill is so important to have and maintain that I think of it more like critical infrastructure rather than 'just' a skill." ([Guide Pt. 1](https://x.com/poteto/status/2094457600259842065))

Verification here means the agent drives the real app the way a user would and hands back evidence: a command and its output, a screenshot, a video, a row read back from storage. Passing unit tests and a clean compile are inputs to that, and the [Prove It Works](../../skills/poteto-mode/principles/prove-it-works.md) principle does not accept them as the result.

## The three parts

| Part | What it is | Plugin file |
|---|---|---|
| Control CLI | A small command-line tool that launches the app, drives it and captures evidence. Her "Build the Lever" principle: a tool costs fewer tokens per use than a throwaway script and a reviewer can rerun it | [control-cli](../../skills/control-cli/SKILL.md), [control-ui](../../skills/control-ui/SKILL.md) |
| Verification skill | Project-local instructions at `.claude/skills/verify-<app>/` with five sections: Launch, Doctor, Drive, Evidence, Cleanup | [create-verification-skill](../../skills/create-verification-skill/SKILL.md) |
| Feature Map | One file per user-facing feature under `features/`: what it is, how a user reaches it, what result proves it works | [feature-map-example](../../skills/create-verification-skill/references/feature-map-example/README.md) |

## Set it up

```text
/pstack:create-verification-skill
```

The generator reads the repo before it asks you anything. It works out what a user touches, how the app starts locally, what can drive it (an existing Playwright or PTY harness first, otherwise browser and CDP, a PTY, or plain HTTP), what evidence it can capture, and whether two instances can run side by side. It seeds the Feature Map with the top three to five features. Then it proves its own output once: launch, doctor, drive one feature, capture evidence, clean up. If that proof fails, discard the output.

## Keep it current

```text
/pstack:maintain-verification-skill
```

One read-only reader per feature checks the map against the source, then one live pass drives every mapped feature. The run ends as `clean`, `changed` (one PR of proven corrections, confined to the skill's directory) or `blocked`. It never edits product code. She recommends running it at least daily, and a scheduled cloud routine is a good fit for that (see [cloud-agents.md](cloud-agents.md)).

## Ask for evidence in the prompt

```text
/pstack:poteto-mode add json output to this command. text output stays byte-identical, the json parses, both run against the sample project. show me the evidence.
```

```text
/pstack:poteto-mode build. use the verify skill to check your changes and show me a video and screenshots as proof
```

Match the check to the change:

| Change | Check |
|---|---|
| CLI | Run the real command |
| UI | Walk the changed flow in the running app |
| Parser or migration | Replay a saved input |
| Performance | Compare before and after profiles |
| Storage | Read back the written value |

If a check could not run, a good reply says "inconclusive".

## Related skills

| Skill | Use |
|---|---|
| [verify-this](../../skills/verify-this/SKILL.md) | Test one claim: restate it so it can fail, capture a baseline and a treatment, return VERIFIED, NOT VERIFIED or INCONCLUSIVE |
| [blast-radius](../../skills/blast-radius/SKILL.md) | Find what a small diff could break elsewhere and prove the one fact that makes it safe by running code |
| [tdd](../../skills/tdd/SKILL.md) | A failing test first, when you ask for one or the test target is cheap and obvious |
| [swarm](../../skills/swarm/SKILL.md) | Split a full verification pass across Feature Map entries and return one report |
