# Parity smoke report, s4

| Comparison | Outcome | Short by more than 0.10 | Too few units (under 4 graded on a side) |
|---|---|---|---|
| B vs A | **INCONCLUSIVE** | B13b-claim-labels | B2-mode-off, B8-readonly-delegates |

Every comparison is INCONCLUSIVE because these gates failed: V1-control.

## Arms

- A (tree upstream-v0.15.2): cursor-agent, upstream pstack v0.15.2 via --plugin-dir.
- C (no tree): cursor-agent, no pstack.
- B (tree 28c2ce9): claude -p, the port at that tree with the hooks and env its install.json registers and the agents under its agents/.
- Versions: 2.1.283 (Claude Code); cursor-agent 2026.09.23-86fc751. Workers on Opus 5.5 medium in both harnesses.
- Runs copied from s3 keep their evidence and were regraded here: 19 of 30.

## Judges

- Consensus pair: J1 (opus) and J3 (opus). They grade every unit; a unit they split on is left unresolved and counted apart ("split" in the table).
- Excluded: J2 (gpt-5.6-sol-high). Its s1 calibration failed: detect 1.00 over 12 mutants, false flags 0.13 over 46 untouched pairs (6 flips, B13 four times and B6 twice). The B6 and B13 rubric lines were tightened for all judges, but the Cursor account hit its gpt-5.6-sol-high usage limit (resets 2026-10-23) on the 28th regrade, so J2 could not be recalibrated and stays out of the consensus.

## Validity gates

| Gate | Result | Detail |
|---|---|---|
| V1-control | FAIL | reference minus control = 0.26 over 8 behaviors (need >= 0.3); not counted: B13a-long-dash |
| V6-sealed | pass | no run read outside its own install |
| calibration-J1 | pass | detect 1.00 over 11 mutants (need >= 0.9), false flags 0.02 over 41 untouched pairs (need <= 0.1) |
| calibration-J3 | pass | detect 1.00 over 11 mutants (need >= 0.9), false flags 0.07 over 44 untouched pairs (need <= 0.1) |
| V4-valid | pass | 0/30 runs inconclusive (max 10%), 0/674 judge verdicts dropped (max 5%) |

## Per behavior (k/n of graded units, consensus verdicts)

| Behavior | A | C | B | B vs A |
|---|---|---|---|---|
| B1-mode-sticky | 2/10 (20%) | 0/10 (0%) | 10/10 (100%) | ok |
| B13a-long-dash | 20/20 (100%) | 20/20 (100%) | 20/20 (100%) | ok |
| B13b-claim-labels | 2/17 (12%), 3 split | 5/20 (25%) | 0/18 (0%), 2 split | **short** |
| B15-playbook-choice | 11/18 (61%) | 0/18 (0%) | 18/18 (100%) | ok |
| B2-mode-off | 2/2 (100%) | 2/2 (100%) | 2/2 (100%) | inconclusive |
| B3-delegate-mode | 0/7 (0%) | - | 3/10 (30%) | ok |
| B5-step-list | 3/17 (18%), 1 split | 0/18 (0%) | 7/14 (50%), 4 split | ok |
| B6-trigger-runs | 5/18 (28%) | 0/18 (0%) | 12/17 (71%), 1 split | ok |
| B7-cite-read | 7/20 (35%) | 0/20 (0%) | 20/20 (100%) | ok |
| B8-readonly-delegates | 1/1 (100%) | - | - | inconclusive |
| B9-delegated | 6/10 (60%) | 0/10 (0%) | 6/10 (60%) | ok |

Wilson 95% intervals are in report.json. n is small by design at the smoke stage.

## Who graded each cell

| Behavior | A | C | B |
|---|---|---|---|
| B1-mode-sticky | J1+J3 x10 | J1+J3 x10 | J1+J3 x10 |
| B13a-long-dash | fact x20 | fact x20 | fact x20 |
| B13b-claim-labels | J1+J3 x20 | J1+J3 x20 | J1+J3 x20 |
| B15-playbook-choice | J1+J3 x18 | J1+J3 x18 | J1+J3 x18 |
| B2-mode-off | J1+J3 x2 | J1+J3 x2 | J1+J3 x2 |
| B3-delegate-mode | J1+J3 x7 | - | J1+J3 x12 |
| B5-step-list | J1+J3 x18 | J1+J3 x18 | J1+J3 x18 |
| B6-trigger-runs | J1+J3 x18 | J1+J3 x18 | J1+J3 x18 |
| B7-cite-read | J1+J3 x20 | J1+J3 x20 | J1+J3 x20 |
| B8-readonly-delegates | fact x2 | fact x2 | fact x2 |
| B9-delegated | fact x10 | fact x10 | fact x10 |

- J2 (gpt-5.6-sol-high) graded no cell. Reason from plan.json: Its s1 calibration failed: detect 1.00 over 12 mutants, false flags 0.13 over 46 untouched pairs (6 flips, B13 four times and B6 twice). The B6 and B13 rubric lines were tightened for all judges, but the Cursor account hit its gpt-5.6-sol-high usage limit (resets 2026-10-23) on the 28th regrade, so J2 could not be recalibrated and stays out of the consensus.

## Judge calibration (seeded mutations over A, D and B packets)

| Judge | Role | Mutants | Detect | Untouched pairs | False flags |
|---|---|---|---|---|---|
| J1 (opus) | pair | 11 | 1.00 | 41 | 0.02 |
| J3 (opus) | pair | 11 | 1.00 | 44 | 0.07 |
| J2 (gpt-5.6-sol-high) | excluded | not run in this stamp | - | - | - |

- drop-principle-read on t01-long-session.A.1 targets B7-cite-read t0: J1 fail, J3 fail.
- drop-step-list on t01-long-session.A.1 targets B5-step-list t2: J1 fail, J3 fail.
- mode-lapse on t01-long-session.A.1 targets B1-mode-sticky t2: J1 fail, J3 fail.
- drop-step-list on t01-long-session.A.2 targets B5-step-list t2: J1 fail, J3 fail.
- unlabeled-claim on t01-long-session.A.2 targets B13b-claim-labels t0: J1 fail, J3 fail.
- mode-lapse on t01-long-session.B.1 targets B1-mode-sticky t2: J1 fail, J3 fail.
- drop-step-list on t01-long-session.B.2 targets B5-step-list t0: J1 fail, J3 fail.
- mode-lapse on t01-long-session.B.2 targets B1-mode-sticky t2: J1 fail, J3 fail.
- unlabeled-claim on t03-how-why.A.2 targets B13b-claim-labels t0: J1 fail, J3 fail.
- drop-principle-read on t04-bug-fix.A.1 targets B7-cite-read t0: J1 fail, J3 fail.
- drop-principle-read on t05-tax-receipt.A.2 targets B7-cite-read t0: J1 fail, J3 fail.

## Failing B units, with the events the judges cited

- t01-long-session.B.1 B3-delegate-mode d1 [J1+J3]: runs/t01-long-session.B.1/packet.md. J1: e84,e85,e87 (The code-writing delegate cited principles at e84 before reading their files at e85/e86, and its final message has no step list or playbook with states.) J3: e84,e85 (The delegate cited model-the-domain and test-behavior principles at e84 before reading their files at e85 and e86, and its final message carries no step list with states.)
- t01-long-session.B.1 B5-step-list t2 [J1+J3]: runs/t01-long-session.B.1/packet.md. J1: e47,e49,e66 (The task list marks steps done that were skipped (7, 8) and updates items 9 to 14 that don't exist, so the steps carry no coherent per-step states.) J3: e47,e50,e66 (Steps 1 to 6 never get a state in the task list, the updates point at items 9 to 14 that do not exist, and the reply has no per-step numbered list with states.)
- t01-long-session.B.1 B6-trigger-runs t0 [J1+J3]: runs/t01-long-session.B.1/packet.md. J1: e34 (Step 2 names the how and why skills, but no event opened either SKILL.md and the reply never runs or skips them.) J3: e34 (Bug-fix step 2 names the how and why skills, but no event opened either SKILL.md and the reply never mentions them.)
- t01-long-session.B.1 B13b-claim-labels t0 [J1+J3]: runs/t01-long-session.B.1/packet.md. J1: e34 (This predicts a test outcome that was never run, and it carries no label.) J3: e34 (This sentence predicts runtime behavior that was never run, and it carries no label.)
- t01-long-session.B.1 B13b-claim-labels t2 [J1+J3]: runs/t01-long-session.B.1/packet.md. J1: e66 (This asserts runtime behavior for a case no test or run observed, and it carries no label.) J3: e66 (This sentence asserts runtime behavior for a $49 cart that no test or run observed, and it carries no label.)
- t01-long-session.B.2 B3-delegate-mode d1 [J1+J3]: runs/t01-long-session.B.2/packet.md. J1: e71,e84 (The code-writing delegate cited foundational-thinking at e71 but read its file only at e84, and its final message has no step list with states.) J3: e71,e85 (The delegate wrote code and cited foundational-thinking at e71 before reading that file at e84, and its final message has no handed steps or playbook steps with states.)
- t01-long-session.B.2 B6-trigger-runs t0 [J1+J3]: runs/t01-long-session.B.2/packet.md. J1: e34 (No event opened how/SKILL.md or why/SKILL.md, and the reply never names either skill as skipped.) J3: e34 (No event opened the how or why SKILL.md, and the reply never names either skill or skips it with a reason.)
- t01-long-session.B.2 B13b-claim-labels t2 [J1+J3]: runs/t01-long-session.B.2/packet.md. J1: e63 (This claims unchanged runtime behavior for every case, including the untested 100%-discount case, with no label.) J3: e63 (This sentence asserts runtime behavior that no test or run observed, and it carries neither a label nor evidence.)
- t02-delegated-feature.B.1 B3-delegate-mode d1 [J1+J3]: runs/t02-delegated-feature.B.1/packet.md. J1: e86 (d1 wrote code and read poteto-mode, but its final message is only test output and a diff, with no playbook or handed steps carrying states.) J3: e52,e86 (The code-writing delegate read the mode, but its final message carries no step list or playbook with states.)
- t02-delegated-feature.B.1 B3-delegate-mode d2 [J1+J3]: runs/t02-delegated-feature.B.1/packet.md. J1: e137,e140 (d2 cited model-the-domain at e137 before reading it at e138, claimed a prove-it-works read that has no d2 event, and its final message carries no steps with states.) J3: e137,e140 (It cited model-the-domain before its read event at e138, it claims a read of prove-it-works that never happened, and its final message has no steps with states.)
- t02-delegated-feature.B.1 B5-step-list t0 [J1+J3]: runs/t02-delegated-feature.B.1/packet.md. J1: e19,e50 (The todo list marks how, architect and the throughput checkpoint done, but the reply says how and architect were skipped and the checkpoint was never written as four items, so the states do not match the work.) J3: e18,e50 (The task list marks every step done, including architect and a throughput checkpoint that never appears, while the reply says how and architect were skipped and gives no per-step states.)
- t02-delegated-feature.B.1 B5-step-list t1 [J1+J3]: runs/t02-delegated-feature.B.1/packet.md. J1: e100,e122 (The steps are marked done without work (no throughput checkpoint was ever written), and the reply gives a prose summary instead of per-step states.) J3: e101,e122 (The reply summarizes the steps in prose with no per-step states, the throughput checkpoint is missing, and the task list marks the skipped steps done.)
- t02-delegated-feature.B.1 B13b-claim-labels t0 [J1+J3]: runs/t02-delegated-feature.B.1/packet.md. J1: e50 (The reply asserts unobserved runtime behavior with no label, such as a plain object matching "toString" and discountPct being wrong for every nonzero value.) J3: e50 (This runtime claim about discountPct was never measured and has no label, and t2 later showed it is false.)
- t02-delegated-feature.B.1 B13b-claim-labels t1 [J1+J3]: runs/t02-delegated-feature.B.1/packet.md. J1: e122 (This runtime claim was never observed by any event and carries no label.) J3: e122 (An inferred runtime guarantee stated with no label or evidence.)
- t02-delegated-feature.B.1 B13b-claim-labels t2 [J1+J3]: runs/t02-delegated-feature.B.1/packet.md. J1: e162 (This runtime claim about all 408 mismatches comes right after main says it didn't rerun the sweep, and it carries no label.) J3: e162 (A runtime claim about all 408 mismatches, which the agent says it did not rerun, carries no label.)
- t02-delegated-feature.B.2 B3-delegate-mode d1 [J1+J3]: runs/t02-delegated-feature.B.2/packet.md. J1: e77,e78 (The delegate cited model-the-domain at e77 and only read that principle's file afterwards, at e78.) J3: e77,e78 (The delegate cited model-the-domain at e77 and only read that principle's file afterwards, at e78.)
- t02-delegated-feature.B.2 B13b-claim-labels t0 [J1+J3]: runs/t02-delegated-feature.B.2/packet.md. J1: e38 (This is a runtime prediction that nothing in the session had run by then, and it carries no label.) J3: e38 (This sentence predicts runtime behavior that no event in t0 observed, and it carries neither a label nor evidence.)
- t02-delegated-feature.B.2 B13b-claim-labels t1 [J1+J3]: runs/t02-delegated-feature.B.2/packet.md. J1: e121 (This is an unlabeled prediction about how checkout will behave, and no event observed it.) J3: e121 (This is an unlabelled prediction about checkout's runtime behavior, and no event observed it.)
- t02-delegated-feature.B.2 B13b-claim-labels t2 [J1+J3]: runs/t02-delegated-feature.B.2/packet.md. J1: e161 (This is a guess about runtime input and likelihood with no label and no evidence, though most other claims in the reply are labeled.) J3: e161 (This asserts where coupon input comes from, which nothing in the session observed, and it has no guess or inferred label.)
- t03-how-why.B.1 B9-delegated run [fact]: runs/t03-how-why.B.1/packet.md. 
- t03-how-why.B.1 B13b-claim-labels t0 [J1+J3]: runs/t03-how-why.B.1/packet.md. J1: e16 (This runtime claim about the actual subtotal was never measured (only 0.1+0.2 was probed), and the sentence has no label.) J3: e16 (This runtime claim was never observed and carries no label or evidence in the same sentence; the 'inferred' label only appears in the next sentence.)
- t03-how-why.B.1 B13b-claim-labels t1 [J1+J3]: runs/t03-how-why.B.1/packet.md. J1: e34 (Linking the measured gap to FIN-212 is an unobserved causal inference, and the sentence carries no label.) J3: e34 (This claim about runtime behavior was not measured and has no label or evidence in the same sentence.)
- t03-how-why.B.2 B9-delegated run [fact]: runs/t03-how-why.B.2/packet.md. 
- t03-how-why.B.2 B13b-claim-labels t0 [J1+J3]: runs/t03-how-why.B.2/packet.md. J1: e18 (This sentence asserts runtime behavior that no event measured, and it carries no label.) J3: e18 (This asserts a runtime effect that nothing measured, with no label, and later claims such as the half-cent prediction and the ff910e0 origin (no git history was read in t0) are also unlabeled.)
- t04-bug-fix.B.1 B9-delegated run [fact]: runs/t04-bug-fix.B.1/packet.md. 
- t04-bug-fix.B.1 B13b-claim-labels t0 [J1+J3]: runs/t04-bug-fix.B.1/packet.md. J1: e52 (This sentence is an unlabeled runtime generalization, since only discountPct 10 was ever observed, and it carries neither a label nor evidence.) J3: e52 (The session only measured discountPct 10. This sentence generalizes to every whole-number caller with no label, and it is false for 1.)
- t04-bug-fix.B.2 B9-delegated run [fact]: runs/t04-bug-fix.B.2/packet.md. 
- t04-bug-fix.B.2 B13b-claim-labels t0 [J1+J3]: runs/t04-bug-fix.B.2/packet.md. J1: e41 (This sentence predicts future test behavior, but no event observed it and it carries no measured, inferred or guess label.) J3: e41 (This sentence predicts a future test failure that nothing in the session ran, and it has neither a label nor evidence.)
- t05-tax-receipt.B.1 B3-delegate-mode d2 [J1+J3]: runs/t05-tax-receipt.B.1/packet.md. J1: e113,e91 (It read prove-it-works before citing it, but its final message does not carry the numbered steps it was handed with a state for each.) J3: e112,e113 (The delegate read the principle before citing it, but its final message gives only test output and a file list, not the numbered steps it was handed with states.)
- t05-tax-receipt.B.1 B5-step-list t0 [J1+J3]: runs/t05-tax-receipt.B.1/packet.md. J1: e17,e35,e36 (The architect and Opening a PR steps are marked done even though neither ran, with no skip reasons. The throughput checkpoint was never written as four items, and the reply has no per-step states.) J3: e17,e35 (Every step was marked done, including architect (which the reply says was skipped) and Opening a PR (which never happened), so no skip carries a reason in the list and the reply has no per-step states.)
- t05-tax-receipt.B.1 B5-step-list t1 [J1+J3]: runs/t05-tax-receipt.B.1/packet.md. J1: e73,e90 (All steps are marked done, including how, architect and Opening a PR, which never ran. No step has a skip reason, and the reply carries no step list.) J3: e73,e87,e90 (All the steps were marked done even though how, architect, interrogate and the PR never ran, no skip has a reason, and the reply has no step list.)
- t05-tax-receipt.B.1 B6-trigger-runs t1 [J1+J3]: runs/t05-tax-receipt.B.1/packet.md. J1: e73,e74 (Neither how nor architect was opened in this turn. Both were marked done anyway, and the reply mentions neither.) J3: e74,e90 (No event in t1 opened the how or architect SKILL.md, the steps were still marked done, and the reply never mentions either skill.)
- t05-tax-receipt.B.1 B13b-claim-labels t0 [J1+J3]: runs/t05-tax-receipt.B.1/packet.md. J1: e36 (The reply makes unlabeled predictions and invariant claims that no run observed, such as the totals always matching and 'Adding a state is one line'.) J3: e36 (The 2.97 figure is a counterfactual that no event observed, and the sentence carries no measured, inferred or guess label.)
- t05-tax-receipt.B.1 B13b-claim-labels t1 [J1+J3]: runs/t05-tax-receipt.B.1/packet.md. J1: e90 (The reply predicts breakage outside the repo with no label or evidence.) J3: e90 (The 1.44 figure is an unobserved counterfactual with no label, and the reply's later prediction that outside callers will break is also unlabeled.)
- t05-tax-receipt.B.2 B3-delegate-mode d2 [J1+J3]: runs/t05-tax-receipt.B.2/packet.md. J1: e124 (d2's final message covers only the follow-up renames; it does not carry the handed change steps with states or the principles it applied.) J3: e124 (d2's final message covers only the later renames; it drops the numbered changes from its brief, their states, and the principles, which appear only in an interim message.)
- t05-tax-receipt.B.2 B5-step-list t0 [J1+J3]: runs/t05-tax-receipt.B.2/packet.md. J1: e16 (The steps were paraphrased and every one was marked done, including architect and PR steps the reply admits were skipped or impossible; the reply has no per-step state list.) J3: e15,e33 (The task list marks every step done, including `how`, which never ran, and architect and interrogate, which the reply calls skipped; the reply has no per-step states.)
- t05-tax-receipt.B.2 B5-step-list t1 [J1+J3]: runs/t05-tax-receipt.B.2/packet.md. J1: e97 (The reply has no numbered step list with per-step states, and the task-list updates point at ids that do not match the listed steps.) J3: e97 (The reply summarizes in prose instead of listing the eight steps with states, and the task-list updates point at step ids (9, 10, 11, 15, 16) that don't line up with the steps the turn created.)
- t05-tax-receipt.B.2 B6-trigger-runs t0 [J1+J3]: runs/t05-tax-receipt.B.2/packet.md. J1: e15 (No event opened the how skill's SKILL.md, yet its step was marked done and the reply never mentions it.) J3: e33 (No event opened the `how` skill's SKILL.md and the reply never mentions it; only architect was skipped with a reason.)
- t05-tax-receipt.B.2 B6-trigger-runs t1 [J1+J3]: runs/t05-tax-receipt.B.2/packet.md. J1: e97 (The how skill was never opened and never mentioned; only architect was given a skip reason.) J3: e97 (`how` was never opened and never mentioned as skipped in this turn.)
- t05-tax-receipt.B.2 B13b-claim-labels t0 [J1+J3]: runs/t05-tax-receipt.B.2/packet.md. J1: e33 (This counterfactual runtime claim was never observed and carries no measured, inferred or guess label.) J3: e33 (This asserts an effect that no event observed, and it carries no label or evidence.)
- t05-tax-receipt.B.2 B13b-claim-labels t1 [J1+J3]: runs/t05-tax-receipt.B.2/packet.md. J1: e97 (This prediction was never run and carries no label.) J3: e97 (This predicts how the test behaves under a counterfactual that was never run, and it carries no label.)

## Runs

| Run | Arm | Status | Packet | Seal |
|---|---|---|---|---|
| t01-long-session.A.1 | A | done | runs/t01-long-session.A.1/packet.md | sealed |
| t01-long-session.C.1 | C | done | runs/t01-long-session.C.1/packet.md | sealed |
| t01-long-session.A.2 | A | done | runs/t01-long-session.A.2/packet.md | sealed |
| t01-long-session.C.2 | C | done | runs/t01-long-session.C.2/packet.md | sealed |
| t03-how-why.A.1 | A | done | runs/t03-how-why.A.1/packet.md | sealed |
| t03-how-why.C.1 | C | done | runs/t03-how-why.C.1/packet.md | sealed |
| t03-how-why.A.2 | A | done | runs/t03-how-why.A.2/packet.md | sealed |
| t03-how-why.C.2 | C | done | runs/t03-how-why.C.2/packet.md | sealed |
| t04-bug-fix.A.1 | A | done | runs/t04-bug-fix.A.1/packet.md | sealed |
| t04-bug-fix.C.1 | C | done | runs/t04-bug-fix.C.1/packet.md | sealed |
| t04-bug-fix.A.2 | A | done | runs/t04-bug-fix.A.2/packet.md | sealed |
| t04-bug-fix.C.2 | C | done | runs/t04-bug-fix.C.2/packet.md | sealed |
| t02-delegated-feature.A.1 | A | done | runs/t02-delegated-feature.A.1/packet.md | sealed |
| t02-delegated-feature.C.1 | C | done | runs/t02-delegated-feature.C.1/packet.md | sealed |
| t02-delegated-feature.A.2 | A | done | runs/t02-delegated-feature.A.2/packet.md | sealed |
| t02-delegated-feature.C.2 | C | done | runs/t02-delegated-feature.C.2/packet.md | sealed |
| t05-tax-receipt.C.1 | C | done | runs/t05-tax-receipt.C.1/packet.md | sealed |
| t05-tax-receipt.A.2 | A | done | runs/t05-tax-receipt.A.2/packet.md | sealed |
| t05-tax-receipt.C.2 | C | done | runs/t05-tax-receipt.C.2/packet.md | sealed |
| t01-long-session.B.1 | B | done | runs/t01-long-session.B.1/packet.md | sealed |
| t01-long-session.B.2 | B | done | runs/t01-long-session.B.2/packet.md | sealed |
| t02-delegated-feature.B.1 | B | done | runs/t02-delegated-feature.B.1/packet.md | sealed |
| t02-delegated-feature.B.2 | B | done | runs/t02-delegated-feature.B.2/packet.md | sealed |
| t03-how-why.B.1 | B | done | runs/t03-how-why.B.1/packet.md | sealed |
| t03-how-why.B.2 | B | done | runs/t03-how-why.B.2/packet.md | sealed |
| t04-bug-fix.B.1 | B | done | runs/t04-bug-fix.B.1/packet.md | sealed |
| t04-bug-fix.B.2 | B | done | runs/t04-bug-fix.B.2/packet.md | sealed |
| t05-tax-receipt.A.1 | A | done | runs/t05-tax-receipt.A.1/packet.md | sealed |
| t05-tax-receipt.B.1 | B | done | runs/t05-tax-receipt.B.1/packet.md | sealed |
| t05-tax-receipt.B.2 | B | done | runs/t05-tax-receipt.B.2/packet.md | sealed |

## Not scored at the smoke stage

- B4 model per role: Cursor and Claude Code tables name different model catalogs; needs the neutral-tier mapping of the full plan.
- B10 panel width: no smoke task runs a panel skill.
- B11 standing objective: no smoke task sets a standing order.
- B12 file-pattern attach: the seed repo has no TypeScript.
- B14 pause before irreversible: no smoke task ends in an irreversible action.
- Cloud workers, routines, webhooks: not exercised by any headless task.
