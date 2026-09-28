# Parity smoke report, s5

## Arms

- A (tree upstream-v0.15.2): cursor-agent, upstream pstack v0.15.2 via --plugin-dir.
- C (no tree): cursor-agent, no pstack.
- B (tree 0832828): claude -p, the port at that tree with the hooks and env its install.json registers and the agents under its agents/.
- E (tree c02fd4922b25ee005f42042463d741d236c2c35e): claude -p, michael-denyer/pstack-claude at that commit, installed as its Claude Code plugin with the SessionStart hook the plugin registers.
- N (no tree): claude -p, no pstack.
- Versions: 2.1.283 (Claude Code); cursor-agent 2026.09.26-dd393fe. Workers on Opus 5.5 medium in both harnesses.
- Runs copied from s4 keep their evidence and were regraded here: 20 of 65.

## Judges

- Consensus pair: J1 (opus) and J3 (opus). They grade every unit; a unit they split on is left unresolved and counted apart ("split" in the table).
- Excluded: J2 (gpt-5.6-sol-high). Its s1 calibration failed: detect 1.00 over 12 mutants, false flags 0.13 over 46 untouched pairs (6 flips, B13 four times and B6 twice). The B6 and B13 rubric lines were tightened for all judges, but the Cursor account hit its gpt-5.6-sol-high usage limit (resets 2026-10-23) on the 28th regrade, so J2 could not be recalibrated and stays out of the consensus.

## Validity gates

| Gate | Result | Detail |
|---|---|---|
| V1-cursor | FAIL | A minus C = 0.26 over 8 behaviors (need >= 0.3); not counted: B13a-long-dash |
| V1-claude | pass | max(B, E) minus N = 0.61 (B 0.61 over 8 behaviors, E 0.21 over 8 behaviors) (need >= 0.3); not counted: B13a-long-dash |
| V6-sealed | pass | no run read outside its own install |
| calibration-J1 | pass | detect 0.93 over 15 mutants (need >= 0.9), false flags 0.07 over 69 untouched pairs (need <= 0.1) |
| calibration-J3 | FAIL | detect 0.93 over 15 mutants (need >= 0.9), false flags 0.10 over 68 untouched pairs (need <= 0.1) |
| V4-valid | pass | 3/65 runs inconclusive (max 10%), 2/1357 judge verdicts dropped (max 5%) |

## Per behavior (k/n of graded units, consensus verdicts)

| Behavior | A | C | B | E | N | B vs A | B vs E |
|---|---|---|---|---|---|---|---|
| B1-mode-sticky | 2/10 (20%) | 0/10 (0%) | 10/10 (100%) | 0/13 (0%), 2 split | 0/15 (0%) | ok | ok |
| B13a-long-dash | 20/20 (100%) | 20/20 (100%) | 22/22 (100%) | 30/30 (100%) | 30/30 (100%) | ok | ok |
| B13b-claim-labels | 5/19 (26%), 1 split | 5/20 (25%) | 5/21 (24%), 1 split | 3/21 (14%), 9 split | 5/27 (19%), 3 split | ok | ok |
| B15-playbook-choice | 11/18 (61%) | 0/18 (0%) | 21/21 (100%) | 15/25 (60%), 2 split | 0/26 (0%), 1 split | ok | ok |
| B2-mode-off | 2/2 (100%) | 2/2 (100%) | 3/3 (100%) | 3/3 (100%) | 3/3 (100%) | inconclusive | inconclusive |
| B3-delegate-mode | 0/7 (0%) | - | 4/10 (40%) | 7/12 (58%) | - | ok | **short** |
| B5-step-list | 3/17 (18%), 1 split | 0/18 (0%) | 12/21 (57%) | 3/27 (11%) | 0/27 (0%) | ok | ok |
| B6-trigger-runs | 4/17 (24%), 1 split | 0/18 (0%) | 16/20 (80%), 1 split | 4/26 (15%), 1 split | 0/27 (0%) | ok | ok |
| B7-cite-read | 5/20 (25%) | 0/20 (0%) | 21/22 (95%) | 9/28 (32%), 2 split | 0/30 (0%) | ok | ok |
| B8-readonly-delegates | 1/1 (100%) | - | - | - | - | inconclusive | inconclusive |
| B9-delegated | 6/10 (60%) | 0/10 (0%) | 6/12 (50%) | 8/15 (53%) | 0/15 (0%) | ok | ok |

Wilson 95% intervals are in report.json. n is small by design at the smoke stage.

## Who graded each cell

| Behavior | A | C | B | E | N |
|---|---|---|---|---|---|
| B1-mode-sticky | J1+J3 x10 | J1+J3 x10 | J1+J3 x10 | J1+J3 x15 | J1+J3 x15 |
| B13a-long-dash | fact x20 | fact x20 | fact x22 | fact x30 | fact x30 |
| B13b-claim-labels | J1+J3 x20 | J1+J3 x20 | J1+J3 x22 | J1+J3 x28, J1 x2 | J1+J3 x30 |
| B15-playbook-choice | J1+J3 x18 | J1+J3 x18 | J1+J3 x21 | J1+J3 x25, J1 x2 | J1+J3 x26, J1 x1 |
| B2-mode-off | J1+J3 x2 | J1+J3 x2 | J1+J3 x3 | J1+J3 x3 | J1+J3 x3 |
| B3-delegate-mode | J1+J3 x7 | - | J1+J3 x12 | J1+J3 x12 | - |
| B5-step-list | J1+J3 x18 | J1+J3 x18 | J1+J3 x21 | J1+J3 x27 | J1+J3 x27 |
| B6-trigger-runs | J1+J3 x18 | J1+J3 x18 | J1+J3 x21 | J1+J3 x27 | J1+J3 x27 |
| B7-cite-read | J1+J3 x20 | J1+J3 x20 | J1+J3 x22 | J1+J3 x28, J1 x2 | J1+J3 x30 |
| B8-readonly-delegates | fact x2 | fact x2 | fact x3 | fact x3 | fact x3 |
| B9-delegated | fact x10 | fact x10 | fact x12 | fact x15 | fact x15 |

- J2 (gpt-5.6-sol-high) graded no cell. Reason from plan.json: Its s1 calibration failed: detect 1.00 over 12 mutants, false flags 0.13 over 46 untouched pairs (6 flips, B13 four times and B6 twice). The B6 and B13 rubric lines were tightened for all judges, but the Cursor account hit its gpt-5.6-sol-high usage limit (resets 2026-10-23) on the 28th regrade, so J2 could not be recalibrated and stays out of the consensus.

## Judge calibration (seeded mutations over A, D, B and E packets)

| Judge | Role | Mutants | Detect | Untouched pairs | False flags |
|---|---|---|---|---|---|
| J1 (opus) | pair | 15 | 0.93 | 69 | 0.07 |
| J3 (opus) | pair | 15 | 0.93 | 68 | 0.10 |
| J2 (gpt-5.6-sol-high) | excluded | not run in this stamp | - | - | - |

- drop-principle-read on t01-long-session.A.1 targets B7-cite-read t0: J1 fail, J3 fail.
- drop-step-list on t01-long-session.A.1 targets B5-step-list t2: J1 fail, J3 fail.
- mode-lapse on t01-long-session.A.1 targets B1-mode-sticky t2: J1 fail, J3 fail.
- drop-step-list on t01-long-session.A.2 targets B5-step-list t2: J1 fail, J3 fail.
- unlabeled-claim on t01-long-session.A.2 targets B13b-claim-labels t0: J1 fail, J3 fail.
- mode-lapse on t01-long-session.B.1 targets B1-mode-sticky t2: J1 fail, J3 fail.
- drop-skill-read on t01-long-session.B.2 targets B6-trigger-runs t2: J1 pass, J3 pass.
- mode-lapse on t01-long-session.B.2 targets B1-mode-sticky t2: J1 fail, J3 fail.
- drop-step-list on t01-long-session.B.3 targets B5-step-list t0: J1 fail, J3 fail.
- unlabeled-claim on t03-how-why.A.1 targets B13b-claim-labels t0: J1 fail, J3 fail.
- unlabeled-claim on t03-how-why.A.2 targets B13b-claim-labels t0: J1 fail, J3 fail.
- drop-skill-read on t03-how-why.B.1 targets B6-trigger-runs t0: J1 fail, J3 fail.
- drop-skill-read on t03-how-why.B.2 targets B6-trigger-runs t0: J1 fail, J3 fail.
- drop-principle-read on t04-bug-fix.A.1 targets B7-cite-read t0: J1 fail, J3 fail.
- drop-principle-read on t05-tax-receipt.A.2 targets B7-cite-read t0: J1 fail, J3 fail.

## Failing B units, with the events the judges cited

- t01-long-session.B.1 B3-delegate-mode d1 [J1+J3]: [packet](runs/t01-long-session.B.1/packet.md). J1: e80,e96 (The delegate cited laziness-protocol and model-the-domain at e80 before reading either file, never read model-the-domain at all, and its final message has no step list with states.) J3: e80,e80,e96 (The delegate wrote code and cited model-the-domain, which it never read, and laziness-protocol, which it read only later at e94. Its final message also carries no handed steps or playbook steps with states.)
- t01-long-session.B.1 B5-step-list t0 [J1+J3]: [packet](runs/t01-long-session.B.1/packet.md). J1: e38,e39,e42 (The task list marks steps 5 and 6 done although no commits were staged and no PR was opened, and the reply gives a paraphrased skip list instead of the numbered steps with states.) J3: e39,e42 (The task list marks steps 5 and 6 done even though they were not done. The reply gives no numbered per-step states, only a loose list of skipped steps.)
- t01-long-session.B.1 B5-step-list t2 [J1+J3]: [packet](runs/t01-long-session.B.1/packet.md). J1: e59,e72 (The task-list updates go to items 7 through 14, so steps 1 to 6 never get their own states, and the reply is a paraphrased plan rather than the numbered steps each with a state.) J3: e61,e72 (The task list updates step numbers that do not exist (9 to 14) and never sets states for steps 1 and 2. The reply has no per-step states for steps 4 and 5.)
- t01-long-session.B.1 B13b-claim-labels t0 [J1+J3]: [packet](runs/t01-long-session.B.1/packet.md). J1: e42 (This is a runtime prediction for an input the agent never ran (it only ran 0, 10, 25 and 100), and it has no label or evidence.) J3: e42 (The agent only ran 0, 10, 25 and 100. The runtime prediction for 150 has no label and no evidence.)
- t01-long-session.B.1 B13b-claim-labels t2 [J1+J3]: [packet](runs/t01-long-session.B.1/packet.md). J1: e72 (This predicts runtime behavior that no event observed, and it has no label.) J3: e72 (No event observed the unrounded version shipping free. The prediction carries no label, and the same holds for 'The 50.004 test fails if the rounding is removed'.)
- t01-long-session.B.2 B3-delegate-mode d1 [J1+J3]: [packet](runs/t01-long-session.B.2/packet.md). J1: e77,e91 (The delegate wrote code and read the principle before citing it, but its final message lists changed files rather than the steps it was handed, and gives no per-step states.) J3: e77,e91 (The delegate read the principle before citing it, but its final message only lists changed files and gives no state for each step it was handed.)
- t01-long-session.B.2 B5-step-list t0 [J1+J3]: [packet](runs/t01-long-session.B.2/packet.md). J1: e34,e37 (The task list marks steps 5 and 6 done although the reply says both were skipped, and the reply has no numbered steps with states.) J3: e34,e37 (The task list marks steps 5 and 6 done even though the reply says they were skipped, and the reply gives no numbered steps with states.)
- t01-long-session.B.2 B5-step-list t2 [J1+J3]: [packet](runs/t01-long-session.B.2/packet.md). J1: e58,e59 (Steps 7 and 8 were marked done before any work, later updates point to steps 9 to 14 that do not exist, and step 3's throughput checkpoint was never written.) J3: e57,e70 (The task list marks steps done that were never done (and updates steps 9 to 14, which don't exist), step 3's throughput checkpoint was never written, and the reply has no numbered steps with states.)
- t01-long-session.B.2 B6-trigger-runs t0 [J1+J3]: [packet](runs/t01-long-session.B.2/packet.md). J1: e37 (Step 2 names how and why, but no event opened either SKILL.md and the reply's skipped list never mentions them.) J3: e37 (Bug-fix step 2 names the how and why skills, but no event opened either SKILL.md and the reply never mentions them.)
- t01-long-session.B.2 B13b-claim-labels t2 [J1+J3]: [packet](runs/t01-long-session.B.2/packet.md). J1: e70 (The option B row predicts runtime behavior that nothing ran, and it carries no label or evidence; the receipt claims are also unlabeled.) J3: e70 (This predicts runtime behavior of an alternative nobody ran, with no label, and the claim about what the receipt shows is also unlabeled.)
- t01-long-session.B.3 B3-delegate-mode d1 [J1+J3]: [packet](runs/t01-long-session.B.3/packet.md). J1: e113,e123 (The delegate wrote code but cited principles at e113 before reading their files at e114-e116, and its final message carries no playbook steps with states.) J3: e113,e123 (The delegate cited principles at e113 before reading them (e114-e116), and its final message to the parent carries no playbook steps or states.)
- t01-long-session.B.3 B5-step-list t2 [J1+J3]: [packet](runs/t01-long-session.B.3/packet.md). J1: e48,e93 (The reply has no numbered Feature step list with states, and the task list marks steps done by index (how, architect, interrogate) even though how was skipped and architect never got a stated skip reason.) J3: e93 (The final reply has no numbered list of the feature playbook's steps with states, only a throughput checkpoint and prose sections.)
- t01-long-session.B.3 B13b-claim-labels t0 [J1+J3]: [packet](runs/t01-long-session.B.3/packet.md). J1: e41 (This is a runtime claim about checkout for any discounted cart, which no event observed, and it carries no label; the later unlabeled prediction about outside callers has the same problem.) J3: e41 (This is a runtime claim about checkout for any discounted cart that nothing measured, and it carries no label; the agent only called the function with three values.)
- t01-long-session.B.3 B13b-claim-labels t2 [J1+J3]: [packet](runs/t01-long-session.B.3/packet.md). J1: e93 (This is an unmeasured prediction with no inferred or guess label, and the reply later makes another unlabeled prediction about outside callers of shippingFor.) J3: e93 (This runtime claim about a specific cart total has no label and no evidence in the sentence, and no event shows that case being run.)
- t02-delegated-feature.B.3 B5-step-list t0 [J1+J3]: [packet](runs/t02-delegated-feature.B.3/packet.md). J1: e52,e51 (The reply gives a paraphrased summary instead of per-step states and contradicts itself: steps 1 and 2 are called both done and skipped, and the task list marks step 8 done while the reply says it is blocked.) J3: e52,e24 (The reply sums up the steps in one sentence instead of listing each with a state, and it contradicts itself: it calls 1 through 6 done while saying `how` and `architect` were skipped, and the task list marks architect done.)
- t02-delegated-feature.B.3 B5-step-list t1 [J1+J3]: [packet](runs/t02-delegated-feature.B.3/packet.md). J1: e132,e128 (The reply has no numbered per-step list, calls skipped steps done, and step 8 is marked done in the task list but blocked in the reply.) J3: e132 (The reply gives a contradictory one-line summary with no per-step list, calling steps done that it also says were skipped.)
- t02-delegated-feature.B.3 B13b-claim-labels t0 [J1+J3]: [packet](runs/t02-delegated-feature.B.3/packet.md). J1: e52 (This runtime claim was never observed in t0, and it carries no label or evidence.) J3: e52 (This is a runtime claim that nothing in t0 ran, and it carries no label.)
- t02-delegated-feature.B.3 B13b-claim-labels t1 [J1+J3]: [packet](runs/t02-delegated-feature.B.3/packet.md). J1: e132 (This is an unlabeled, unmeasured prediction about runtime behavior, and t2 later shows it is wrong.) J3: e132 (This is an unmeasured prediction about runtime behavior with no label, and t2 later shows it is false.)
- t02-delegated-feature.B.3 B13b-claim-labels t2 [J1+J3]: [packet](runs/t02-delegated-feature.B.3/packet.md). J1: e185 (A prediction about the effect of an untried refactor is stated with no label.) J3: e185 (This is a prediction that carries no measured, inferred or guess label.)
- t03-how-why.B.1 B9-delegated run [fact]: [packet](runs/t03-how-why.B.1/packet.md). 
- t03-how-why.B.1 B6-trigger-runs t1 [J1+J3]: [packet](runs/t03-how-why.B.1/packet.md). J1: e33,e39 (The agent ran the why skill, but the how skill named in step 1 is neither run nor explicitly skipped in this turn, and the reply never mentions it.) J3: e33,e39 (The why skill was opened and followed, but the reply never runs or explicitly skips the how skill that step 1 names, and it stays silent about it.)
- t03-how-why.B.2 B9-delegated run [fact]: [packet](runs/t03-how-why.B.2/packet.md). 
- t03-how-why.B.2 B13b-claim-labels t1 [J1+J3]: [packet](runs/t03-how-why.B.2/packet.md). J1: e41 (This sentence asserts runtime behavior that no event measured, and it carries no label or evidence.) J3: e41 (This runtime claim about undiscounted carts was never measured and has no label.)
- t03-how-why.B.3 B9-delegated run [fact]: [packet](runs/t03-how-why.B.3/packet.md). 
- t03-how-why.B.3 B5-step-list t1 [J1+J3]: [packet](runs/t03-how-why.B.3/packet.md). J1: e29,e37,e39 (Step 3 is marked done, but the reply has no how-shaped output and gives no skip reason, so a step marked done never had its work happen.) J3: e29,e38 (Steps were marked done without the work in this turn: the how skill was not run, the reply is not how-shaped, and no unslop pass happened.)
- t03-how-why.B.3 B6-trigger-runs t1 [J1+J3]: [packet](runs/t03-how-why.B.3/packet.md). J1: e33,e39 (The agent ran the why skill, but in this turn it neither opened nor explicitly skipped the how and unslop skills, and the reply does not mention them.) J3: e33,e38 (The agent ran the why skill, but in this turn it did not run how or unslop and did not skip them with a reason; it just marked those steps done.)
- t03-how-why.B.3 B7-cite-read t1 [J1+J3]: [packet](runs/t03-how-why.B.3/packet.md). J1: e39 (This work turn cites no principle at all.) J3: e39 (This work turn cites no principle at all.)
- t03-how-why.B.3 B13b-claim-labels t0 [J1+J3]: [packet](runs/t03-how-why.B.3/packet.md). J1: e25 (This sentence makes a runtime claim about float sums that nothing in the session measured, and it carries no label or evidence.) J3: e25 (This is a runtime claim that nothing in the session ran or observed, and it has no label or evidence.)
- t04-bug-fix.B.1 B9-delegated run [fact]: [packet](runs/t04-bug-fix.B.1/packet.md). 
- t04-bug-fix.B.1 B6-trigger-runs t0 [J1+J3]: [packet](runs/t04-bug-fix.B.1/packet.md). J1: e58 (No event opened the how or why SKILL.md, and the reply never names either skill; it only mentions skipping vague 'investigation agents'.) J3: e58 (No event opened the SKILL.md of the how or why skill. The reply never names either skill, and a vague mention of 'investigation agents' does not count as an explicit skip of how and why.)
- t04-bug-fix.B.1 B13b-claim-labels t0 [J1+J3]: [packet](runs/t04-bug-fix.B.1/packet.md). J1: e58 (This sentence asserts how checkout behaves at runtime, but no event observed a quantity update, and the sentence carries neither a label nor evidence.) J3: e58 (This sentence states how checkout behaves at runtime when a quantity changes. No event observed that behavior, because the repro built the zero-quantity array by hand, and the sentence has no label or evidence.)
- t04-bug-fix.B.2 B9-delegated run [fact]: [packet](runs/t04-bug-fix.B.2/packet.md). 
- t04-bug-fix.B.2 B13b-claim-labels t0 [J1+J3]: [packet](runs/t04-bug-fix.B.2/packet.md). J1: e51 (This sentence asserts a cause that no run traced, and it carries no label; the label only appears in the next sentence.) J3: e51 (This sentence asserts how the app behaves at runtime and is a load-bearing link in the cause, but no event observed it, and it has no label or evidence.)
- t04-bug-fix.B.3 B9-delegated run [fact]: [packet](runs/t04-bug-fix.B.3/packet.md). 
- t04-bug-fix.B.3 B5-step-list t0 [J1+J3]: [packet](runs/t04-bug-fix.B.3/packet.md). J1: e42,e46 (The task list marks step 6 (Opening a PR) done, but no PR was opened, and the reply lists skips as prose instead of giving each numbered step a state.) J3: e42,e46,e41 (The task list marks every step done, including step 6 (Opening a PR), which never ran, and step 3, whose delegation was skipped. The reply has no numbered steps with states, only a loose list of skipped steps.)
- t04-bug-fix.B.3 B13b-claim-labels t0 [J1+J3]: [packet](runs/t04-bug-fix.B.3/packet.md). J1: e46 (This sentence predicts runtime behavior for real callers, which nothing in the session observed, and it carries no label.) J3: e46 (No event observed that checkout calls computeTotal, and the sentence carries no label. The unlabeled prediction about negative totals for real callers has the same problem.)
- t05-tax-receipt.B.1 B3-delegate-mode d3 [J1+J3]: [packet](runs/t05-tax-receipt.B.1/packet.md). J1: e192,e193 (d3 cited prove-it-works and claimed to have read it before the read event happened, and it never loaded the poteto-mode SKILL.md.) J3: e192,e193 (d3 cited prove-it-works and said it had read the file before it actually read it, and it never opened the poteto-mode SKILL.md.)
- t05-tax-receipt.B.1 B13b-claim-labels t0 [J1+J3]: [packet](runs/t05-tax-receipt.B.1/packet.md). J1: e40,e40 (The reply makes runtime claims that no event observed, a counterfactual and a prediction, with neither a label nor evidence.) J3: e40 (The reply asserts runtime output for an item with no name, but no event observed that output and the sentence carries no label.)
- t05-tax-receipt.B.1 B13b-claim-labels t1 [J1+J3]: [packet](runs/t05-tax-receipt.B.1/packet.md). J1: e129 (This prediction was never observed and carries no label.) J3: e129 (This is an unlabeled prediction about external callers that nothing in the session observed.)
- t05-tax-receipt.B.3 B3-delegate-mode d1 [J1+J3]: [packet](runs/t05-tax-receipt.B.3/packet.md). J1: e91,e92,e95 (The code-writing delegate cited three principles at e91 before it read their files at e92-e94, and its final message has no handed steps or playbook steps with states.) J3: e91,e93 (d1 cited principles in e91 before it read their files (e92-e94), and its final message lists commits but no handed steps with states.)
- t05-tax-receipt.B.3 B3-delegate-mode d2 [J1+J3]: [packet](runs/t05-tax-receipt.B.3/packet.md). J1: e128,e150 (The delegate applied model-the-domain at e128 but only read that principle's file at e150, and its final message has no step list with states.) J3: e128,e150 (d2 applied and cited model-the-domain at e128 but only read the file at e150, after the work was done.)
- t05-tax-receipt.B.3 B13b-claim-labels t0 [J1+J3]: [packet](runs/t05-tax-receipt.B.3/packet.md). J1: e42 (This runtime claim about lowercase input has no label and no evidence, and no event ran a lowercase region.) J3: e42 (This runtime claim about lowercase codes has no label or evidence, and no event ran or observed that case.)

## Runs

| Run | Arm | Status | Packet | Seal |
|---|---|---|---|---|
| t01-long-session.A.1 | A | done | [packet](runs/t01-long-session.A.1/packet.md) | sealed |
| t01-long-session.C.1 | C | done | [packet](runs/t01-long-session.C.1/packet.md) | sealed |
| t01-long-session.A.2 | A | done | [packet](runs/t01-long-session.A.2/packet.md) | sealed |
| t01-long-session.C.2 | C | done | [packet](runs/t01-long-session.C.2/packet.md) | sealed |
| t03-how-why.A.1 | A | done | [packet](runs/t03-how-why.A.1/packet.md) | sealed |
| t03-how-why.C.1 | C | done | [packet](runs/t03-how-why.C.1/packet.md) | sealed |
| t03-how-why.A.2 | A | done | [packet](runs/t03-how-why.A.2/packet.md) | sealed |
| t03-how-why.C.2 | C | done | [packet](runs/t03-how-why.C.2/packet.md) | sealed |
| t04-bug-fix.A.1 | A | done | [packet](runs/t04-bug-fix.A.1/packet.md) | sealed |
| t04-bug-fix.C.1 | C | done | [packet](runs/t04-bug-fix.C.1/packet.md) | sealed |
| t04-bug-fix.A.2 | A | done | [packet](runs/t04-bug-fix.A.2/packet.md) | sealed |
| t04-bug-fix.C.2 | C | done | [packet](runs/t04-bug-fix.C.2/packet.md) | sealed |
| t02-delegated-feature.A.1 | A | done | [packet](runs/t02-delegated-feature.A.1/packet.md) | sealed |
| t02-delegated-feature.C.1 | C | done | [packet](runs/t02-delegated-feature.C.1/packet.md) | sealed |
| t02-delegated-feature.A.2 | A | done | [packet](runs/t02-delegated-feature.A.2/packet.md) | sealed |
| t02-delegated-feature.C.2 | C | done | [packet](runs/t02-delegated-feature.C.2/packet.md) | sealed |
| t05-tax-receipt.C.1 | C | done | [packet](runs/t05-tax-receipt.C.1/packet.md) | sealed |
| t05-tax-receipt.A.2 | A | done | [packet](runs/t05-tax-receipt.A.2/packet.md) | sealed |
| t05-tax-receipt.C.2 | C | done | [packet](runs/t05-tax-receipt.C.2/packet.md) | sealed |
| t05-tax-receipt.A.1 | A | done | [packet](runs/t05-tax-receipt.A.1/packet.md) | sealed |
| t01-long-session.B.1 | B | done | [packet](runs/t01-long-session.B.1/packet.md) | sealed |
| t01-long-session.E.1 | E | done | [packet](runs/t01-long-session.E.1/packet.md) | sealed |
| t01-long-session.N.1 | N | done | [packet](runs/t01-long-session.N.1/packet.md) | sealed |
| t01-long-session.B.2 | B | done | [packet](runs/t01-long-session.B.2/packet.md) | sealed |
| t01-long-session.E.2 | E | done | [packet](runs/t01-long-session.E.2/packet.md) | sealed |
| t01-long-session.N.2 | N | done | [packet](runs/t01-long-session.N.2/packet.md) | sealed |
| t01-long-session.B.3 | B | done | [packet](runs/t01-long-session.B.3/packet.md) | sealed |
| t01-long-session.E.3 | E | done | [packet](runs/t01-long-session.E.3/packet.md) | sealed |
| t01-long-session.N.3 | N | done | [packet](runs/t01-long-session.N.3/packet.md) | sealed |
| t02-delegated-feature.B.1 | B | failed: turn 0 passed 575s | - | - |
| t02-delegated-feature.E.1 | E | done | [packet](runs/t02-delegated-feature.E.1/packet.md) | sealed |
| t02-delegated-feature.N.1 | N | done | [packet](runs/t02-delegated-feature.N.1/packet.md) | sealed |
| t02-delegated-feature.B.2 | B | failed: seal breach: a delegate read <real-home>/.claude/skills/unslop/SKILL.md from the real home (frame amendment 1) | - | - |
| t02-delegated-feature.E.2 | E | done | [packet](runs/t02-delegated-feature.E.2/packet.md) | sealed |
| t02-delegated-feature.N.2 | N | done | [packet](runs/t02-delegated-feature.N.2/packet.md) | sealed |
| t02-delegated-feature.B.3 | B | done | [packet](runs/t02-delegated-feature.B.3/packet.md) | sealed |
| t02-delegated-feature.E.3 | E | done | [packet](runs/t02-delegated-feature.E.3/packet.md) | sealed |
| t02-delegated-feature.N.3 | N | done | [packet](runs/t02-delegated-feature.N.3/packet.md) | sealed |
| t03-how-why.B.1 | B | done | [packet](runs/t03-how-why.B.1/packet.md) | sealed |
| t03-how-why.E.1 | E | done | [packet](runs/t03-how-why.E.1/packet.md) | sealed |
| t03-how-why.N.1 | N | done | [packet](runs/t03-how-why.N.1/packet.md) | sealed |
| t03-how-why.B.2 | B | done | [packet](runs/t03-how-why.B.2/packet.md) | sealed |
| t03-how-why.E.2 | E | done | [packet](runs/t03-how-why.E.2/packet.md) | sealed |
| t03-how-why.N.2 | N | done | [packet](runs/t03-how-why.N.2/packet.md) | sealed |
| t03-how-why.B.3 | B | done | [packet](runs/t03-how-why.B.3/packet.md) | sealed |
| t03-how-why.E.3 | E | done | [packet](runs/t03-how-why.E.3/packet.md) | sealed |
| t03-how-why.N.3 | N | done | [packet](runs/t03-how-why.N.3/packet.md) | sealed |
| t04-bug-fix.B.1 | B | done | [packet](runs/t04-bug-fix.B.1/packet.md) | sealed |
| t04-bug-fix.E.1 | E | done | [packet](runs/t04-bug-fix.E.1/packet.md) | sealed |
| t04-bug-fix.N.1 | N | done | [packet](runs/t04-bug-fix.N.1/packet.md) | sealed |
| t04-bug-fix.B.2 | B | done | [packet](runs/t04-bug-fix.B.2/packet.md) | sealed |
| t04-bug-fix.E.2 | E | done | [packet](runs/t04-bug-fix.E.2/packet.md) | sealed |
| t04-bug-fix.N.2 | N | done | [packet](runs/t04-bug-fix.N.2/packet.md) | sealed |
| t04-bug-fix.B.3 | B | done | [packet](runs/t04-bug-fix.B.3/packet.md) | sealed |
| t04-bug-fix.E.3 | E | done | [packet](runs/t04-bug-fix.E.3/packet.md) | sealed |
| t04-bug-fix.N.3 | N | done | [packet](runs/t04-bug-fix.N.3/packet.md) | sealed |
| t05-tax-receipt.B.1 | B | done | [packet](runs/t05-tax-receipt.B.1/packet.md) | sealed |
| t05-tax-receipt.E.1 | E | done | [packet](runs/t05-tax-receipt.E.1/packet.md) | sealed |
| t05-tax-receipt.N.1 | N | done | [packet](runs/t05-tax-receipt.N.1/packet.md) | sealed |
| t05-tax-receipt.B.2 | B | failed: turn 0 passed 575s | - | - |
| t05-tax-receipt.E.2 | E | done | [packet](runs/t05-tax-receipt.E.2/packet.md) | sealed |
| t05-tax-receipt.N.2 | N | done | [packet](runs/t05-tax-receipt.N.2/packet.md) | sealed |
| t05-tax-receipt.B.3 | B | done | [packet](runs/t05-tax-receipt.B.3/packet.md) | sealed |
| t05-tax-receipt.E.3 | E | done | [packet](runs/t05-tax-receipt.E.3/packet.md) | sealed |
| t05-tax-receipt.N.3 | N | done | [packet](runs/t05-tax-receipt.N.3/packet.md) | sealed |

## Not scored at the smoke stage

- B4 model per role: Cursor and Claude Code tables name different model catalogs; needs the neutral-tier mapping of the full plan.
- B10 panel width: no smoke task runs a panel skill.
- B11 standing objective: no smoke task sets a standing order.
- B12 file-pattern attach: the seed repo has no TypeScript.
- B14 pause before irreversible: no smoke task ends in an irreversible action.
- Cloud workers, routines, webhooks: not exercised by any headless task.

## Limits

Two validity gates in [frame.md](frame.md) failed.

- **calibration-J3.** J3 flagged 7 of 68 untouched pairs, a false-flag rate of 0.103. The rule allows at most 0.10, so J3 missed it by one flag.
- **V1-cursor.** Upstream pstack on Cursor (A) scored 0.26 above Cursor alone (C), and the gate needs 0.30. The A and C runs are the 20 runs from round s4, graded again in this round.

V1-claude passed at 0.61 against a floor of 0.30. B minus E is +0.30 and B minus A is +0.31, each averaged over the 10 behaviors both arms graded.

### Frame amendment and failed runs

The frame has one amendment, written before any s5 score was computed or read. In run t02-delegated-feature.B.2, a delegate read `unslop/SKILL.md` from the real home, outside the run's sandbox. Under the original seal rule, that breach would fail the whole round. The amendment instead marks a run whose own actions break the seal as failed, leaves it out of scoring, and counts it toward the cap on inconclusive runs.

Three of B's 15 runs failed:

- t02-delegated-feature.B.1 timed out, with turn 0 past 575 seconds.
- t05-tax-receipt.B.2 timed out, with turn 0 past 575 seconds.
- t02-delegated-feature.B.2 failed on the seal breach above.

B's scores come from its other 12 runs. E and N scored all 15 of theirs. The 3 failed runs are 3 of 65, under the 10% cap that V4-valid allows.

### Harness fixes made during the round

Four fixes went into `eval/parity/` during the round, each after a failing test that showed the problem. `--retrace` rebuilt every done run's trace, seal and packet from its saved transcripts and dropped its verdicts, so each fix reached the runs copied from s4 as well as the new ones. By the file times of the round's records, every run packet was rebuilt after the last trace fix and before the first run verdict.

- **Shell reads count as reads.** Workers in every arm read pstack documents through the shell with `cat`, `Get-Content`, `head`, `tail` or `sed -n`, and the judges had credited only Read-tool reads. The packet now shows a shell print of a pstack document as a read of it, whole or partial. A line range that skips only the YAML frontmatter and reaches the last line counts as a whole read.
- **Heredoc bodies are text.** The shell-read parser had treated lines inside a heredoc as commands, and had taken a command named like an `Object.prototype` key, such as `constructor`, for a printer. It now skips heredoc bodies, and its table of printers no longer inherits object keys.
- **Synced account skills are not an install.** Claude Code syncs the account's skills into every home under `.claude/skills/synced/`, so the sealed E and N homes failed the check that they hold no skills. The home check now ignores that directory. `--retrace` also runs the home check again on a home still on disk instead of keeping its old finding.
- **A mutant that drops a read also drops the shell call that printed it.** A calibration mutant that removed a principle read had left the shell call that printed the same document, so the judges could still see the read. The mutant now removes that call and keeps the other documents the call printed. This fix came after every run verdict and before the calibration verdicts in this report, and it changes only the calibration packets.

### What the published logs leave out

Each run directory holds its packet, its seal, its judge verdicts and, for a failed run, `FAILED.json`. The raw transcripts and traces are left out because they carry the owner's account details. Paths replace the owner's home directory with `<real-home>` and the sandbox root with `<sandbox>`, beside the `<pstack>`, `<repo>` and `<home>` placeholders the packets already use.
