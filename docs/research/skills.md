# Skills and principles

The plugin ships 28 workflow skills, 23 principles and two subagents. Invoke a skill as `/pstack:<name>`. Most of the time `poteto-mode` calls them for you, and you reach for one directly when you want only that step. Every skill lives at `pstack-cc/skills/<name>/SKILL.md`.

## Skills by phase

| Phase | Skill | What it does |
|---|---|---|
| Understand | [how](../../skills/how/SKILL.md) | Explains a subsystem's architecture and runtime flow, and answers where code should live |
| | [why](../../skills/why/SKILL.md) | Finds design rationale across source control, issues, docs and chat |
| | [teach](../../skills/teach/SKILL.md) | Runs `how` and `why`, then explains the result plainly |
| | [recall](../../skills/recall/SKILL.md) | Rebuilds your recent working context from your own transcripts and live state |
| | [bro](../../skills/bro/SKILL.md) | Restates the last message without jargon |
| Design | [architect](../../skills/architect/SKILL.md) | Sketches types, signatures and module structure before code |
| | [arena](../../skills/arena/SKILL.md) | Runs N candidates at one task, picks a base, grafts in the best parts of the rest |
| | [interrogate](../../skills/interrogate/SKILL.md) | Several reviewers challenge a change from independent angles |
| | [swarm](../../skills/swarm/SKILL.md) | Fans out N workers for coverage, races or exploration and returns one report |
| Build and clean | [tdd](../../skills/tdd/SKILL.md) | A failing test first, only when asked or when the target is cheap |
| | [typescript-best-practices](../../skills/typescript-best-practices/SKILL.md) | Applied when reading or editing `.ts` and `.tsx` |
| | [deslop](../../skills/deslop/SKILL.md) | Removes AI code slop before commit |
| | [no-comments](../../skills/no-comments/SKILL.md) | Runs Comment Sicko over the diff and offers to encode any constraint a comment claims |
| | [unslop](../../skills/unslop/SKILL.md) | Cuts AI tells from prose |
| | [technical-writing](../../skills/technical-writing/SKILL.md) | A layered standard for docs, RFCs, READMEs, PR descriptions and commit messages |
| Verify | [create-verification-skill](../../skills/create-verification-skill/SKILL.md) | Generates `verify-<app>` and its Feature Map |
| | [maintain-verification-skill](../../skills/maintain-verification-skill/SKILL.md) | Audits the verification skill against source and a live pass |
| | [control-cli](../../skills/control-cli/SKILL.md) | Builds a harness that drives a CLI or TUI |
| | [control-ui](../../skills/control-ui/SKILL.md) | Builds a browser and CDP harness for a web, IDE or Electron UI |
| | [verify-this](../../skills/verify-this/SKILL.md) | Tests one claim against fresh local evidence |
| | [blast-radius](../../skills/blast-radius/SKILL.md) | Finds what a change could break beyond the diff |
| Long runs | [figure-it-out](../../skills/figure-it-out/SKILL.md) | Designs an auditable playbook when no bundled one fits |
| | [show-me-your-work](../../skills/show-me-your-work/SKILL.md) | Keeps a TSV decision trail: what, why, evidence, result |
| Make it yours | [setup-pstack](../../skills/setup-pstack/SKILL.md) | Picks the model per role and the budget |
| | [automate-me](../../skills/automate-me/SKILL.md) | Mines your transcripts and drafts your own `-mode` skill |
| | [reflect](../../skills/reflect/SKILL.md) | Three reviewers read the session and route each lesson to a skill edit |
| | [make-bot-ui](../../skills/make-bot-ui/SKILL.md) | Copied from upstream unchanged. It targets a different runtime |

The router itself, [poteto-mode](../../skills/poteto-mode/SKILL.md), is the 28th. See [playbooks.md](playbooks.md).

## Subagents

| Agent | Role |
|---|---|
| [poteto-agent](../../agents/poteto-agent.md) | The default delegate for any subagent a playbook step spawns. Spawn it as `pstack:poteto-agent` |
| [comment-sicko](../../agents/comment-sicko.md) | Reviews code comments for `/no-comments`. Spawn it as `pstack:comment-sicko` |

## Principles

Say a principle's name mid-task to redirect the agent. Each one is a skill named `principle-<slug>`, and the agent reads the full file before applying it. Her [principles page](../../docs/guide/08-principles.md) has examples.

| Group | Principle | Applies when |
|---|---|---|
| Core | Laziness Protocol | Sizing a diff or tempted to add a layer. Prefer deletion and the smallest change |
| | Foundational Thinking | Before writing logic. Settle core types and what concurrent actors share |
| | Redesign from First Principles | A new requirement meets an old design. Redesign as if it had been there from day one |
| | Attack the Premise | Two fixes sharing one premise have failed. Question the premise |
| | Subtract Before You Add | Sequencing a change. Remove dead weight first |
| | Minimize Reader Load | Code is hard to trace. Count layers and hidden state, collapse one-caller wrappers |
| | Outcome-Oriented Execution | A planned migration. Converge on the target and skip throwaway compatibility states |
| | Experience First | A product or scope tradeoff. Choose user delight over implementation convenience |
| | Exhaust the Design Space | A decision with no precedent. Build two or three competing prototypes |
| | Build the Lever | Any non-trivial work. Build the tool that does or proves it |
| Architecture | Model the Domain | Logic that branches a lot. Encode the domain in a structure such as a state machine or a table |
| | Boundary Discipline | Wiring validation or adapters. Guard at system boundaries and trust internal types |
| | Type System Discipline | Designing types. Make illegal states unrepresentable |
| | Make Operations Idempotent | Steps that run amid crashes and retries. Converge to the same end state |
| | Migrate Callers Then Delete Legacy APIs | A new internal API with old callers. Migrate and delete in one wave |
| | Separate Before Serializing Shared State | Concurrent actors might write the same thing. Remove the sharing first |
| Verification | Prove It Works | Before declaring done. Check the real artifact |
| | Fix Root Causes | Debugging. Reproduce first, then ask why until you reach the cause |
| | Sequence Work into Verifiable Units | Multi-step work. Small units that each end in a check |
| | Test Behavior, Not Implementation | Writing a test. Call the code as users do and assert a literal expected value |
| Delegation | Guard the Context Window | Context is filling. Route bulk to subagents and keep summaries |
| | Never Block on the Human | Tempted to ask about reversible work. Proceed and present the result |
| Meta | Encode Lessons in Structure | Writing the same instruction twice. Make it a lint, a flag, a check or a script |
