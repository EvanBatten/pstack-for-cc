# Starting a repo with hard rules

An agent forgets instructions. It cannot forget a type error or a red build. Her talk puts enforcement in two tiers: CI and static analysis "make CI red", while "for rules and skills and bogbot, your agents can still forget" ([~44:55](https://www.youtube.com/watch?v=PaPpyQocMww)). So the first work in a new repo is moving as many rules as possible into the first tier.

## Pick the strongest mechanism

From [principle-encode-lessons-in-structure](../../skills/poteto-mode/principles/encode-lessons-in-structure.md), strongest first:

1. A state that cannot compile.
2. A lint rule or banned API that fails CI.
3. A canonical helper everyone calls.
4. A runtime check.
5. Written instruction, only when the rule needs judgment.

Agents copy what the surrounding code does, so a weak guard becomes the template for the next one. When a structural fix exists, use only that and delete the instruction.

## Day-one checklist

The examples are TypeScript. The layers carry over to any typed language.

| Layer | What to set up |
|---|---|
| Compiler | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`. Parse external data at the boundary, brand primitives, model states as discriminated unions. See [principle-type-system-discipline](../../skills/poteto-mode/principles/type-system-discipline.md) and [typescript-best-practices](../../skills/typescript-best-practices/SKILL.md) |
| Lint | typescript-eslint `strict-type-checked` with `--max-warnings 0`. Ban `any`, `as`, non-null assertions and floating promises. Ban comments outside a short allowlist of directives |
| Custom rules | [ast-grep](https://ast-grep.github.io/) rules in YAML. An agent can write one in a minute, which is what makes it practical to convert a review comment into a rule |
| Architecture | [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) or eslint-plugin-boundaries to enforce which directory may import which. [knip](https://knip.dev/) for dead code and unused exports |
| Tests | Behavior tests that call the code the way its users do. A flaky test counts as a failing test |
| CI | One `check` script that runs typecheck, lint, boundaries and tests, identical locally and in CI. Required status checks and branch protection on `main`. A merge queue once agents open PRs in parallel |

## Enforcement inside the agent session

CI catches a violation after the push. Claude Code hooks catch it while the agent is still working, which saves a round trip.

| Hook | Job |
|---|---|
| PostToolUse on `Edit` and `Write` | Lint the edited file and return the errors to the agent |
| Stop | Run `check` and refuse to let the agent finish while it is red |
| PreToolUse on `Bash` | Reject `--no-verify` and other ways around the checks |

A sketch for `.claude/settings.json`. It is untested here, so check exit-code behavior against the [hooks reference](https://code.claude.com/docs/en/hooks) before relying on it. In that reference, exit code 2 is the blocking code, and its stderr goes back to the agent.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "node .claude/hooks/lint-edited.mjs" }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "npm run check 1>&2 || exit 2" }]
      }
    ]
  }
}
```

An agent under pressure to go green will sometimes weaken the rule. Protect the rule files themselves: add permission deny rules for the lint config, `tsconfig.json` and `.github/workflows/`, and list the same paths in `CODEOWNERS` so a change to them needs your review.

## Turning corrections into rules

> "instead of me commenting on the PR, how do I turn this into a hard rule... a lint rule... a CI failure" (talk, ~46:59)

1. You correct the agent, or leave a review comment, for the second time.
2. Ask which mechanism from the list above can hold the rule.
3. Have the agent write it, with one failing fixture that proves the rule fires.
4. Delete the written instruction it replaces.

The plugin has two helpers for this. [`/no-comments`](../../skills/no-comments/SKILL.md) runs the Comment Sicko subagent over a diff, and for each comment that claims a constraint it offers to encode the constraint in code. [`/reflect`](../../skills/reflect/SKILL.md) reviews a finished session and routes each lesson to a concrete edit.

## Making this repeatable

`/hard-rules` does this for a repo. It is a personal skill, not part of pstack or this repo. It builds the one `check` command, wires it into CI and the Claude hooks, and proves each rule with a seeded violation. Run it when a project starts, before the first feature. Greenfield work is where she sees the most risk (talk, ~32:01), and rules added after the code exists arrive with a backlog of violations.

It stays out of the verification skill's job. `check` covers what can be known without running the app. `verify-<app>` drives the running app and returns evidence. See [verification.md](verification.md).

After setup, [principle-encode-lessons-in-structure](../../skills/poteto-mode/principles/encode-lessons-in-structure.md) keeps the gate growing: each repeated correction becomes one more rule with a failing fixture.
