# Research notes

Notes on pstack and on the way Lauren Tan works around it, compiled on 2026-09-20 from pstack v0.15.2.

The notes describe the plugin form of the port, where every skill has a `pstack:` prefix. The skills in this repo are installed as personal skills, so `/pstack:how` in a note is `/how` here. A link to a file that only the plugin form had goes to the `port-reference` tag.

| To do this | Read |
|---|---|
| Learn her method on one page | [method.md](method.md) |
| Start a repo with hard rules in the compiler, lint and CI | [hard-rules.md](hard-rules.md) |
| Give agents a way to prove their work | [verification.md](verification.md) |
| Pick a playbook | [playbooks.md](playbooks.md) |
| Look up a skill or a principle | [skills.md](skills.md) |
| Run work overnight, in the cloud, or on a trigger | [cloud-agents.md](cloud-agents.md) |
| Replicate her setup in Claude Code piece by piece: sandboxes, Bugbot, observability | [claude-code-setup.md](claude-code-setup.md) |
| Balance token cost against code quality | [cost-and-quality.md](cost-and-quality.md) |
| Fork the plugin into your own | [make-it-yours.md](make-it-yours.md) |
| Check where a claim came from | [sources.md](sources.md) |

Her own ten-page guide is in [docs/guide](../guide/README.md), unchanged from upstream.

## Rules for editing the notes

- Keep evaluation, benchmark results and critique out of the notes. The one exception is `cost-and-quality.md`, which covers the tradeoff between token cost and code quality and stays short.
- Keep each note to a screen or two. Link into the skills for the full text instead of copying it.
- Quote her verbatim and link the source. Every new claim about her workflow gets a row in `sources.md`.
- Tool mappings to Claude Code go stale. Check them against the current docs and `claude --help` before you edit `cloud-agents.md` or `claude-code-setup.md`, and update the "Checked against" line.
- Before you call a Claude Code feature the equivalent of a Cursor one, read the Cursor doc for that feature as well and list what it does that Claude Code does not. A capability counts as confirmed only when a doc states it or it has been run.
