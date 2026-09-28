# Parity round s5 (pre-registered, written before any run)

## Arms (all workers Opus 5.5 at medium effort, same five sealed tasks t01 to t05)

- B: this port (Claude Code), private main.
- E: michael-denyer/pstack-claude (645 stars on 2026-09-27, the most-starred pstack port for Claude Code, MIT), installed as its Claude Code plugin, pinned to one commit recorded in plan.json.
- N: Claude Code with no pstack. Control for the Claude side.
- A: Cursor with upstream pstack v0.15.2. Runs reused from s4 and re-judged.
- C: Cursor with no pstack. Runs reused from s4 and re-judged.

Reps: 3 per task for B, E and N. A and C keep their 2.

## Gates

- V1-claude: max(B, E) minus N is at least 0.30, averaged over the scored behaviors.
- V1-cursor: A minus C is at least 0.30 (the existing gate).
- The judge calibration, sealing and validity gates from s4 still apply.

## Decision rules

- Claim 1, "better than the leading Claude Code port": B minus E is at least +0.10, averaged over the scored behaviors, and V1-claude passes. If B minus E is within 0.10 either way, the result is a tie. Below -0.10 is a loss.
- Claim 2, "on par with or better than pstack on Cursor": B minus A is at least -0.05, and V1-cursor passes. If V1-cursor fails, claim 2 is reported as not certified, with the per-behavior table.

The README states each claim only as the rule above resolves it.

## Amendment 1 (2026-09-28, before any s5 score was computed or read)

- Run t02-delegated-feature.B.2 read `unslop/SKILL.md` from the real home, outside its sandbox. The seal rule above would fail the whole round.
- The user chose to treat a run whose own actions break the seal as an invalid run instead. It is marked failed with the reason "seal breach", excluded from scoring, and counted toward the inconclusive-runs cap, like a timeout.
- This applies to any run in s5 whose own actions break the seal, in every arm. A seal breach the harness causes (an install leak or a shared home) still fails the round.
