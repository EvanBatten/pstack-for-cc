# Playbook run

A task under poteto mode is matched to a playbook, and the reply carries that playbook's steps as a list with each step's state, plus whatever artifact the playbook's reply section requires. Reading a playbook and dropping it is the failure this guards against.

## Sub-features

- The step list, copied in verbatim, with `skip: <reason>` on any step not taken.
- The playbook's required artifact. For Investigation it is the one-line throughput checkpoint; for Feature it is the four-line throughput checkpoint.

## How to get to it (user POV)

Under the mode, ask a question the Investigation playbook matches, such as "how does X work". The reply lists the four Investigation steps with their state and includes `throughput checkpoint: n/a, read-only investigation`.

## Driving it with drive.sh

Turn two of the mode session asks an investigation question and names the playbook. The drive asserts the reply contains the phrase `throughput checkpoint` and at least one numbered or bulleted line.

## Gotchas

- This is the one behavior that depends on the model following the skill. A `NOT VERIFIED` here with a green mode-reminder verdict means the reminder reached the model and the model still dropped the playbook; read the reply before deciding whether the skill text or the model is at fault.
- Turn two runs on the session's default model rather than the cheapest one, because a small model drops the playbook far more often.
