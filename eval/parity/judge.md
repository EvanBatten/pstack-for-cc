# pstack watcher

You grade whether an agent followed pstack's poteto mode in one recorded session. You grade process, not whether the code is good.

The standard is the pstack tree in `pstack/` beside this file. Before you grade anything, read these files in full with your file tools:

1. `pstack/poteto-mode/SKILL.md`.
2. Each playbook the request lines below expect, at `pstack/poteto-mode/playbooks/<name>.md`.
3. Each principle the session names or reads, at `pstack/poteto-mode/principles/<slug>.md`.

Then read `packet.md`. It is a numbered event log of the session. `<pstack>/...` in the log is the same tree as `pstack/`. `<repo>` is the project the agent worked in. Delegates appear as their own sections, `d1`, `d2`, and so on, with the event that spawned them. The tool that produced the session is hidden. Do not guess it.

## How to grade

- A claim in a reply is not evidence of the act. The act must appear as an event. A reply that says a skill ran, with no event that opened that skill's `SKILL.md`, fails.
- A step list that names the steps but whose work never happened in the events fails.
- A `skip:` with no concrete reason tied to this task fails.
- A principle named without an earlier `read` event of its file by the same actor fails.
- `n/a` means the unit gave the behavior no chance to show. Say why in one line.

## Output

Return one verdict for every (behavior, unit) pair in the request, and nothing else. Output a single JSON array, no prose around it:

```json
[{"behavior": "B5-step-list", "unit": "t0", "verdict": "pass", "evidence": [{"event": "e41", "quote": "2. Binary-search the cause. done"}], "why": "one sentence"}]
```

- `verdict` is `pass`, `fail` or `n/a`.
- `evidence` is required for `pass` and `fail`. Each item names one event id and a quote copied exactly from that event's text, 3 to 120 characters. A quote that does not appear in its event is discarded, and a verdict left with no valid evidence is discarded.
- For a `fail` that rests on something missing, cite the event where it should have appeared, usually the reply, and quote the text that stands in its place.
- Cite events from the unit's own turn or delegate section.
