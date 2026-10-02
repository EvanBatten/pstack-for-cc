<div align="center">

<p>
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/banner-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/banner-light.svg">
  <img alt="pstack for Claude Code. pstack's skills, playbooks and principles, with a hook that checks each step." src="docs/assets/banner-light.svg" width="100%">
</picture>
</p>

<p>
  <a href="https://github.com/EvanBatten/pstack-for-cc/actions/workflows/check.yml"><img alt="check" src="https://github.com/EvanBatten/pstack-for-cc/actions/workflows/check.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <a href="https://docs.anthropic.com/en/docs/claude-code"><img alt="for Claude Code" src="https://img.shields.io/badge/for-Claude%20Code-d97757.svg"></a>
  <a href="https://github.com/EvanBatten/pstack-for-cc/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/EvanBatten/pstack-for-cc"></a>
  <a href="https://github.com/EvanBatten/pstack-for-cc/commits"><img alt="Last commit" src="https://img.shields.io/github/last-commit/EvanBatten/pstack-for-cc"></a>
</p>

<p>
  <a href="#install">Install</a> ·
  <a href="#results">Results</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="docs/guide/README.md">Docs</a> ·
  <a href="#credits">Credits</a>
</p>

<p>pstack is the work of <a href="https://x.com/poteto">Lauren Tan (poteto)</a>, published in <a href="https://github.com/cursor/plugins/tree/032be146865d973682535de75f2287da438550bf/pstack">cursor/plugins</a> under the MIT license.</p>

</div>

## Install

With Claude Code, git and Node.js installed, run this in a macOS or Linux shell, or in Git Bash on Windows:

```sh
git clone https://github.com/EvanBatten/pstack-for-cc.git ~/pstack-for-cc
node ~/pstack-for-cc/scripts/install.mjs
node ~/pstack-for-cc/skills/verify-pstack/scripts/doctor.mjs
```

Every doctor line starts with `ok`. Start a session and type `/poteto-mode <task>`.

<details>
<summary><b>What the installer does, and installing by hand</b></summary>

`scripts/install.mjs` reads [`install.json`](install.json). `skills` and `agents` list the repo paths to link and the directories to link them into. `hooks` and `env` have the same shape as the keys of the same name in `~/.claude/settings.json`.

- It links each path on its own, named after its last segment, so skills and agents from other places stay beside them. It tries a symbolic link first. On Windows without the right to make one, it makes a directory junction for a skill and copies an item it cannot link. `--copy` copies every item.
- It replaces a link that points somewhere else. It leaves a real file or directory it did not make, reports the conflict and exits 1.
- It merges `hooks` and `env` into `~/.claude/settings.json`. It removes only the hook entries that run `pstack-hook.mjs` or the older `session-context.mjs`, appends the groups from `install.json` and sets each `env` variable. Before it writes, it copies the old file to `settings.json.bak-<time>`.
- `--dry-run` prints each change prefixed with `would ` and writes nothing.
- `--opt-in agents` also links the skills into `~/.agents/skills`, which Codex and other agents read.

Run `/setup-pstack` once to choose the models each role uses. To update, run `git pull` in the clone. The links point into it, so a changed skill is live on its next read. Run the installer again when `install.json` changes. A second run changes nothing that is already in place.

To install by hand on macOS, Linux or Git Bash:

```sh
repo=~/pstack-for-cc
paths() { (cd "$repo" && node -p "require('./install.json').$1.paths.join(' ')"); }
mkdir -p ~/.claude/skills ~/.claude/agents
for p in $(paths skills); do ln -s "$repo/$p" ~/.claude/skills/; done
for p in $(paths agents); do ln -s "$repo/$p" ~/.claude/agents/; done
```

In PowerShell, which needs Developer Mode or an administrator shell to make a symbolic link:

```powershell
$repo = "$HOME/pstack-for-cc"
$manifest = Get-Content -Raw "$repo/install.json" | ConvertFrom-Json
foreach ($group in $manifest.skills, $manifest.agents) {
	foreach ($into in $group.into) {
		foreach ($path in $group.paths) {
			$link = Join-Path ($into -replace '^~', $HOME) (Split-Path $path -Leaf)
			New-Item -ItemType SymbolicLink -Path $link -Target (Join-Path $repo $path)
		}
	}
}
```

Then open `~/.claude/settings.json`, remove any hook entry that runs `pstack-hook.mjs`, and copy each event under `hooks` and each variable under `env` from `install.json` into it.

</details>

<details>
<summary><b>Uninstall</b></summary>

There's no `--uninstall` flag. To remove this by hand:

1. Delete the links this repo made: every entry under `~/.claude/skills` and `~/.claude/agents` (and `~/.agents/skills` if you passed `--opt-in agents`) that is a symlink or junction pointing back into your `pstack-for-cc` clone. If you installed with `--copy`, or on Windows without the right to make links, some entries are copies instead: `~/.claude/pstack/install-copies.json` lists them, so delete those too before step 3 removes that list.
2. Open `~/.claude/settings.json` and remove every hook entry whose command runs `pstack-hook.mjs` (or the older `session-context.mjs`). The installer also sets two env keys, `CLAUDE_CODE_ENABLE_TODO_TOOLS` and `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`; drop those too if you don't want them. If nothing else has touched `settings.json` since your first install, restoring the oldest `settings.json.bak-<time>` in `~/.claude` does the same thing. A later one may already hold these hooks, since each install that changes `settings.json` backs it up first.
3. Remove the state the hook wrote: `~/.claude/pstack/` (trace cache, live-session markers, logs), and `~/.claude/pstack-models.md` if you ran `/setup-pstack`.
4. Delete the clone.

</details>

## Results

**Scores higher than pstack on Cursor and the most-starred Claude Code port.**

Each setup ran the same five bounded tasks in sealed sessions. This port came out ahead or about even on 9 of 10 behaviors against both [michael-denyer/pstack-claude](https://github.com/michael-denyer/pstack-claude) and upstream pstack on Cursor. [Full report and logs](eval/parity/results/s5/report.md).

<img alt="This port against pstack-claude and pstack on Cursor, passing units over graded units for eight behaviors" src="docs/assets/head-to-head.svg" width="100%">

<details>
<summary><b>The full comparison</b></summary>

The harness is `eval/parity`. It runs five synthetic tasks in sealed sandboxes, with every worker on Opus 5.5 at medium effort, across five arms:

- **B.** Claude Code with this port, three runs per task. The runs used an earlier commit whose installed files differ from this tree only in the `check-port.mjs` maintenance script and in test files and fixtures.
- **E.** Claude Code with [michael-denyer/pstack-claude](https://github.com/michael-denyer/pstack-claude) at commit `c02fd49`, installed as its Claude Code plugin, three runs per task. It had 645 stars on 2026-09-27.
- **A.** Cursor with upstream pstack v0.15.2, two runs per task.
- **N.** Claude Code with no pstack, three runs per task.
- **C.** Cursor with no pstack, two runs per task.

Two judges grade each reply against a written rubric for each behavior, and a script decides the behaviors that are plain facts. Each cell is the passing units over the graded units. "Split" counts the units the two judges disagreed on, which are left out of the count. A dash means the arm had no unit to grade.

| Behavior | What it measures | B, this port | E, pstack-claude | A, Cursor with pstack | N, Claude Code alone | C, Cursor alone |
|---|---|---|---|---|---|---|
| Mode stays on | A later turn that the user did not open with `/poteto-mode` still matches a playbook, carries its steps with states, and names the principles it read | 10/10 (100%) | 0/13 (0%), 2 split | 2/10 (20%) | 0/15 (0%) | 0/10 (0%) |
| No long dash | The reply contains no long dash | 22/22 (100%) | 30/30 (100%) | 20/20 (100%) | 30/30 (100%) | 20/20 (100%) |
| Claim labels | Each sentence that claims runtime behavior, a cause or a prediction that nothing in the session observed carries a measured, inferred or guess label, or its evidence | 5/21 (24%), 1 split | 3/21 (14%), 9 split | 5/19 (26%), 1 split | 5/27 (19%), 3 split | 5/20 (25%) |
| Playbook choice | The agent picks the playbook the request calls for without being told its name, and reads that playbook's file | 21/21 (100%) | 15/25 (60%), 2 split | 11/18 (61%) | 0/26 (0%), 1 split | 0/18 (0%) |
| Mode off | A casual turn, such as a thank-you, gets a short plain answer with no step list or new work | 3/3 (100%) | 3/3 (100%) | 2/2 (100%) | 3/3 (100%) | 2/2 (100%) |
| Delegates work in the mode | A delegate that writes code reads each principle before citing it, and its final message carries its steps with states | 4/10 (40%) | 7/12 (58%) | 0/7 (0%) | - | - |
| Step list | The reply or the task list carries the playbook's steps, each with a state, and each skipped step with a reason | 12/21 (57%) | 3/27 (11%) | 3/17 (18%), 1 split | 0/27 (0%) | 0/18 (0%) |
| Named skills run | Each skill a step names is run, or skipped with a reason | 16/20 (80%), 1 split | 4/26 (15%), 1 split | 4/17 (24%), 1 split | 0/27 (0%) | 0/18 (0%) |
| Cited principles read | Every principle the reply names was read in full earlier in the session | 21/22 (95%) | 9/28 (32%), 2 split | 5/20 (25%) | 0/30 (0%) | 0/20 (0%) |
| Read-only delegates | On a read-only task, no delegate writes a file | - | - | 1/1 (100%) | - | - |
| Delegated | On a task that calls for a delegate, the run spawns at least one | 6/12 (50%) | 8/15 (53%) | 6/10 (60%) | 0/15 (0%) | 0/10 (0%) |

The raw counts and intervals are in [`report.json`](eval/parity/results/s5/report.json). `node scripts/chart.mjs` draws the chart from it. Each run's judge packet, seal and verdicts are under [`eval/parity/results/s5/runs/`](eval/parity/results/s5/runs/).

To run the comparison again, you need Windows with `cursor-agent` installed by its Windows installer, Claude Code, and Cursor usage for the Cursor arms. `--init` clones pstack-claude once, so it needs the network. Run the tick until `--status` shows every run and judgment done:

```sh
node eval/parity/parity.mjs --init --stamp s5 --tree B=HEAD --tree E=c02fd4922b25ee005f42042463d741d236c2c35e
node eval/parity/parity.mjs --tick --stamp s5
node eval/parity/parity.mjs --status --stamp s5
node eval/parity/parity.mjs --report --stamp s5
```

`--report` writes `report.md` and `report.json` under `pstack-parity/s5` in the temp directory.

</details>

## What you get

<table>
  <tr>
    <td width="33%" valign="top">
      <img src="docs/assets/icons/shield.svg" width="28" height="28" alt=""><br>
      <b>Rules checked at each action</b><br>
      Before each edit, shell command, task list, spawn or commit, the hook asks for the step it owes.
    </td>
    <td width="33%" valign="top">
      <img src="docs/assets/icons/retry.svg" width="28" height="28" alt=""><br>
      <b>One ask per deny</b><br>
      The hook never judges the answer, so once an ask's tag is in the transcript, the retry goes through.
    </td>
    <td width="33%" valign="top">
      <img src="docs/assets/icons/terminal.svg" width="28" height="28" alt=""><br>
      <b>Shell writes count as edits</b><br>
      A <code>sed -i</code>, a redirect, <code>tee</code>, <code>cp</code> or <code>mv</code> into a source file meets the same asks as an Edit.
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <img src="docs/assets/icons/transcript.svg" width="28" height="28" alt=""><br>
      <b>Reads tracked from the transcript</b><br>
      The hook counts what the agent read, so a cited principle it never opened blocks the stop.
    </td>
    <td width="33%" valign="top">
      <img src="docs/assets/icons/diff.svg" width="28" height="28" alt=""><br>
      <b>Every upstream change kept</b><br>
      <a href="DRIFT.md">DRIFT.md</a> lists each file that differs from pstack v0.15.2 and why, and CI fails on a change with no reason.
    </td>
    <td width="33%" valign="top">
      <img src="docs/assets/icons/pull.svg" width="28" height="28" alt=""><br>
      <b>Updates with <code>git pull</code></b><br>
      The installer links into the clone, so a pulled change to a skill is live on its next read.
    </td>
  </tr>
</table>

## What it looks like

The agent edits code before it names the data shape. The hook denies the edit once, and the retry goes through:

```text
● Read(~/.claude/skills/poteto-mode/principles/model-the-domain.md)

● Edit(src/cart.js)
  ⎿ Before editing source, write a line `**Shape.** <the data this change touches and how it is organized>` in your reply, then retry this call unchanged. If you already wrote the Shape line this turn, retry unchanged. [pstack:design:c08ec9e0]
    Do what applies, then retry the call. Where an ask does not apply, say why in a `skip <name>: <reason>` line for the user, then retry.

● **Shape.** A cart is a list of line items, each a product and a quantity.

● Edit(src/cart.js)
  ⎿ Updated src/cart.js
```

## How it works

Every hook event runs one script. A shell filter keeps Node from starting for tool calls outside poteto mode.

```mermaid
%%{init: {'theme': 'neutral'}}%%
flowchart TB
  T["PreToolUse on shell,<br/>edit, task, MCP<br/>PostToolUse on shell"] --> F["in-mode.sh<br/>is the session<br/>in poteto mode?"]
  O["SessionStart,<br/>UserPromptSubmit, Read,<br/>Agent, Stop and the rest"] --> H
  F -- no --> X["exit 0, the call runs"]
  F -- yes --> H["pstack-hook.mjs<br/>respond()"]
```

Before a call runs, `kinds.mjs` classifies it, and the first row of the `RULES` table that the call owes becomes one deny.

```mermaid
%%{init: {'theme': 'neutral'}}%%
flowchart TB
  C["Edit src/cart.js"] --> K["kinds.mjs<br/>fileKind(): code"]
  K --> T["asks.mjs<br/>triggersOf(): code-edit"]
  T --> R["RULES in order<br/>route, ledger, delegate,<br/>design, ..."]
  R --> D["deny<br/>[pstack:design:c08ec9e0]"]
  D -. "tag in the transcript" .-> P["retry runs"]
```

When the turn ends, `gate.mjs` blocks the stop once for each finding it can see for certain.

```mermaid
%%{init: {'theme': 'neutral'}}%%
flowchart LR
  S["Stop"] --> G["gate.mjs gate()<br/>STOP_RULES"]
  G -- "no finding" --> E["turn ends"]
  G -- "finding, tag not yet spent" --> B["block once<br/>cited-unread, long-dash,<br/>shape-unstated, ..."]
  B -. "agent fixes it<br/>and replies again" .-> S
```

[docs/runtime.md](docs/runtime.md) lists every hook event, every ask and every stop finding.

<details>
<summary><b>Layout</b></summary>

[`install.json`](install.json) decides what a machine installs, so a file can sit in the repo without reaching `~/.claude`.

| Path | What it holds | Installed |
|---|---|---|
| `skills/` | 29 skills: 24 from pstack, 4 from `cursor-team-kit`, and `verify-pstack`, which this port adds | Each skill `install.json` names |
| `skills/poteto-mode/playbooks/` | The 23 playbooks that `/poteto-mode` matches a task to | With `poteto-mode` |
| `skills/poteto-mode/principles/` | pstack's 23 principles, one file each | With `poteto-mode` |
| `skills/poteto-mode/hooks/` | The hook: `pstack-hook.mjs` answers the events, `trace.mjs` parses transcripts, `asks.mjs` and `gate.mjs` hold the rules, `kinds.mjs` classifies files and commands, and `catalog.mjs` reads the skills | Registered from `install.json` |
| `agents/` | `poteto-agent`, `comment-sicko`, and `pstack-reader`, the read-only delegate that `how`, `why` and `interrogate` spawn | Each agent `install.json` names |
| `automations/benny/` | Benny, two issue-report automations from upstream, with [`PORT.md`](automations/benny/PORT.md) mapping it to Claude Code | No |
| `docs/guide/` | Lauren Tan's guide to pstack | No |
| `docs/research/` | Notes on pstack's method, skills and playbooks | No |
| `docs/port-audit/` | The earlier reference port's `PORT.md` and `PATCHES.md`, and the `check-port.mjs` census runs from the port sweep | No |
| `eval/parity/` | The eval behind the chart, and its round s4 and s5 results | No |
| `scripts/` | The installer, the drift map, the chart, the transcript audit and replay, and their tests | No |

</details>

<details>
<summary><b>Checking a change</b></summary>

Run these from the repo root:

```sh
node --test $(git ls-files '*.test.js')
node skills/poteto-mode/scripts/check-port.mjs skills agents
node scripts/drift.mjs --check
```

The first runs every test, the second prints `0 findings`, and the third prints `DRIFT.md is current`.

- `check-port.mjs` fails on text that still assumes a feature of the plugin's original host, such as a todolist, `/goal`, `readonly` or `/tmp`, and on a shipped model default outside the known tiers. An owner can list their own project names, one regex per line, in `.port-check-terms` at the repo root, and the check then flags any file that names one. The file is ignored by git.
- `drift.mjs --check` compares each file against the three history tags. It fails when a changed file has no drift class in `scripts/drift.mjs` or when `DRIFT.md` is stale. It needs those tags in the clone.
- `.github/workflows/check.yml` runs all three on every pull request, with the Bun tests for the `orch` and `watch-pr` scripts.

To prove the hook in real sessions, run `bash skills/verify-pstack/scripts/drive.sh` after installing. It starts three headless sessions and prints eight verdicts: hook-context, mode-reminder, step-ledger, gate, action-gate, reader, task-tools and port-clean. It exits 0 only when all eight read VERIFIED. [skills/verify-pstack/SKILL.md](skills/verify-pstack/SKILL.md) says what each verdict checks.

`node scripts/audit-transcripts.mjs --skills ~/.claude/skills <session.jsonl>` reports how a recorded session used pstack. `node scripts/replay-demands.mjs <session.jsonl>` prints each ask the hook would raise over a recorded session.

</details>

<details>
<summary><b>History tags</b></summary>

The history starts with three tagged layers, and every later change sits on top of them.

| Tag | Content |
|---|---|
| `upstream-v0.15.2` | pstack v0.15.2 and the `cursor-team-kit` skills `control-cli`, `control-ui`, `deslop` and `verify-this`, byte for byte from cursor/plugins@032be14 |
| `port-reference` | The first mechanical Claude Code port |
| `live-2026-09-23` | The installed copies the port grew from |

[DRIFT.md](DRIFT.md) lists every file that changed from upstream, by layer, with the reason for each change. To record a new change, add a class to the last layer in `scripts/drift.mjs`, commit, run `node scripts/drift.mjs`, and commit `DRIFT.md`.

</details>

<details>
<summary><b>Updating from upstream</b></summary>

Diff `pstack/` in cursor/plugins from `032be14` to the new commit and apply the changes you want under the same paths. Then run `node skills/poteto-mode/scripts/port-codemod.mjs` for the mechanical rewrites, fix what `check-port.mjs` still reports, and record the drift.

</details>

## Credits

pstack's skills, playbooks, principles, guide and Benny automation are Lauren Tan's work, MIT licensed. Her README is in [docs/UPSTREAM-README.md](docs/UPSTREAM-README.md) and her guide is in [docs/guide/](docs/guide/README.md). The `cursor-team-kit` skills are Cursor's, MIT licensed. Their notices are in [LICENSE](LICENSE) and [LICENSES/cursor-team-kit.txt](LICENSES/cursor-team-kit.txt).
