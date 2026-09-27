# Replicating her setup in Claude Code

A piece-by-piece map from how she works in Cursor to what does the same job in Claude Code. Checked against the Claude Code docs, the Cursor docs and CLI 2.1.278 on 2026-09-21. Plan names matter here, because several pieces exist only on Team and Enterprise.

## Piece by piece

| Her piece | In Claude Code | Effort |
|---|---|---|
| pstack skills, playbooks, principles | The plugin in [pstack-cc](../port-audit/PORT.md) | Done |
| Always-on model rule | The plugin's session hook plus `~/.claude/pstack-models.md` | Done |
| Cloud agent with its own machine | A cloud session: `claude --cloud "<brief>"`. Each session is a separate Anthropic-hosted VM with its own clone of the repo | Built in. Pro, Max, Team, Enterprise |
| Cloud environment config | An environment at claude.ai/code: network level, env vars, API credentials, setup script. `/remote-env` picks the default | Built in |
| Spawning workers from a coordinator chat | The coordinator runs `claude --cloud` through Bash. Local workers use the Agent tool with `isolation: "worktree"` or `claude --bg` | Built in, with no completion callback from the cloud |
| Steering a running worker | `claude -p "<message>" --cloud <session>`. `claude --teleport <session>` pulls it into your terminal | Built in |
| Agent dashboard | The session list at claude.ai/code, `/tasks`, `claude agents` for local background sessions | Partial. No fleet view with cost per session |
| Bugbot | See [Replacing Bugbot](#replacing-bugbot) | One workflow file on Pro and Max. Managed on Team and Enterprise |
| Babysit a PR to green | The Babysit playbook with its `watch-pr` script, or `/autofix-pr`, which watches a PR from a cloud session and pushes fixes on CI failures and review comments | Built in. Needs the Claude GitHub App on the repo |
| Auto-merge | GitHub: `gh pr merge --auto --squash`, required checks, a merge queue | GitHub settings |
| Cursor Automations | [Routines](https://code.claude.com/docs/en/routines) through `/schedule`: cron, one-off, an API endpoint, GitHub events | Built in |
| Benny from Slack | Claude Tag on Team and Enterprise. Otherwise a Slack workflow that POSTs to a routine's endpoint, or GitHub issues as the inbox with `claude-code-action` | Some wiring |
| `/loop` wake-ups | `/loop` | Built in |
| Panels across three model families | Panels across Claude tiers, and the port stays Claude only. A judge runs on the parent model or opus, never below it, and gets its independence from a fresh context and blind labels. `check-port.mjs` enforces the floor | Decided |
| Evidence as video and screenshots | Playwright video, traces and screenshots, captured by the verify skill. Cloud sessions have no artifact store, so commit evidence to the branch or upload it | Some wiring |

## One sandbox per agent

A cloud session gives each agent its own machine, its own checkout, and room to run the whole app. It is a headless machine. A Cursor cloud agent also gets a desktop with computer use, a remote desktop you can take over, and video attached to the PR ([Cursor docs](https://cursor.com/docs/cloud-agent)). [What the agent can run](#what-the-agent-can-run) covers the difference. From the [cloud environments doc](https://code.claude.com/docs/en/cloud-environments):

| Property | Value |
|---|---|
| Machine | Ubuntu 24.04, 4 vCPUs, 16 GB of RAM, 30 GB of disk |
| Preinstalled | Docker with `docker compose`, PostgreSQL 16, Redis 7.0, Node 20 to 22 with npm, yarn, pnpm and chromedriver, plus the common language toolchains. `check-tools` lists versions |
| Services | Postgres and Redis are installed but stopped. Start them with `service postgresql start` and `service redis-server start`, or run your own stack with `docker compose up` |
| Setup script | Runs once per environment, before Claude starts. Keep it under about five minutes. Anthropic then snapshots the filesystem and reuses it for later sessions, so installed packages and pulled Docker images are already on disk. The snapshot expires after about seven days or when you change the script. Running processes are not kept |
| Network | `None`, `Trusted` (the default: package registries, Docker Hub, GitHub and similar), `Custom` (your own allowlist) or `Full` |
| Secrets | Anyone using the environment can read its env vars, the agent included. On Pro and Max, an API credential is attached by Anthropic's proxy after the request leaves the VM, so the agent never sees the key |
| Base image | Fixed. Add to it with the setup script, or run your own image next to Claude with `docker compose` |

Only what is committed reaches the VM. The repo's `CLAUDE.md`, `.claude/settings.json` hooks and permissions, `.claude/skills/`, `.claude/agents/`, `.mcp.json`, and plugins declared in `.claude/settings.json` all carry over. Your user-level `~/.claude` skills, hooks, MCP servers and plugins do not. This fits her view that the codebase is the memory, and it means the verification skill, the control CLI and the pstack plugin declaration all belong in the repo.

### Making a repo ready

1. Make the app start from nothing with one command. A `docker compose up -d --wait` plus a migrate and seed script is the usual shape. Seed with fake data and never give the VM production credentials.
2. Create an environment at claude.ai/code. Choose `Trusted`, or `Custom` if the app calls hosts outside the default list.
3. Put machine provisioning in the environment's setup script, so it lands in the snapshot:

   ```bash
   #!/bin/bash
   set -euo pipefail
   npx -y playwright install --with-deps chromium &
   docker compose pull &
   wait
   ```

4. Put project setup in a SessionStart hook in the repo's `.claude/settings.json`, scoped to the cloud with `CLAUDE_CODE_REMOTE`:

   ```bash
   #!/bin/bash
   # scripts/agent-up.sh
   [ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0
   npm ci
   docker compose up -d --wait
   npm run db:migrate && npm run db:seed
   ```

5. Generate the verification skill into the repo with `/pstack:create-verification-skill`, and commit the control CLI it drives. See [verification.md](verification.md).
6. Publish the plugin through a marketplace the VM can reach (a Git repo with a marketplace manifest works) and declare it in the repo's `.claude/settings.json`. See the [plugin marketplaces doc](https://code.claude.com/docs/en/plugin-marketplaces) for the exact keys.
7. Launch workers: `claude --cloud "<brief>"`, one per unit of work. The Orchestrate brief template in [cloud-agents.md](cloud-agents.md) is written for exactly this, since a cloud worker cannot ask questions.

The snippets above are sketches and have not been run. If Docker is not already running in a session, start `dockerd` first.

### What the agent can run

| App type | In a Claude Code cloud session | Otherwise |
|---|---|---|
| Web app, API, worker, database | Yes. Run the stack with `docker compose` and drive it with headless Playwright or CDP. Video, traces, HAR files and screenshots all record headless, and the agent can open a screenshot to look at it | |
| CLI or TUI | Yes, through a PTY or tmux harness. See [control-cli](../../skills/control-cli/SKILL.md) | |
| Electron or Linux desktop GUI | Likely, under `xvfb` with Playwright's Electron support. The docs do not cover it, so test it first | A container with a desktop, below |
| iOS | No. There is no macOS | A Mac you own. The desktop app has a local iOS Simulator integration |
| Android emulator | The docs do not mention KVM, so assume no | A self-hosted runner or your own machine |
| Windows desktop app | No | Your own machine |

Two things a Cursor cloud agent has that a cloud session lacks:

| Missing | Substitute |
|---|---|
| Computer use on a desktop. Claude Code's computer-use tool is CLI only, on macOS | Headless Playwright and CDP for anything in a browser. Locally on any OS, `claude --chrome` or a browser MCP server drives a real Chrome |
| A way for you to open the running app: no port forwarding, preview URL or remote desktop | A preview deployment per PR from your host (Vercel, Netlify, Fly and similar), or a tunnel such as `cloudflared` with the network level set to `Custom` or `Full` |

### A full computer per agent

When headless is not enough, build the machine yourself and run Claude Code inside it.

| Part | Choice |
|---|---|
| Image | Your app's toolchain plus `xvfb`, a window manager, noVNC for watching and taking over, and `ffmpeg` for recording the screen |
| Agent | `claude -p` with a subscription token from `claude setup-token`, or the Agent SDK with API billing. Both load the repo's `.claude/` config and the plugin the same way |
| Host | Anything that starts a container or VM per task: Fly Machines, E2B, Daytona, Modal, Codespaces, or your own box |
| First-party route | Self-hosted environments (`claude --cloud --environment <ccpool_...>`). Sessions run on your hosts and still appear at claude.ai/code. Beta, Team and Enterprise only |
| Hosted alternative | [Managed Agents](https://platform.claude.com/docs/en/managed-agents/overview) on the API. Beta, billed per token |

## Observability

The agent needs to see the app, and you need to see the agent.

| What | How |
|---|---|
| App logs | `docker compose logs`, or log files the control CLI can tail. Give the control CLI a `logs` subcommand so the agent does not improvise |
| App health | The verify skill's Doctor section: one read-only command that says whether this instance is worth driving |
| UI evidence | Playwright screenshots, `recordVideo`, traces and HAR files. Over CDP the [control-ui](../../skills/control-ui/SKILL.md) skill also captures console logs, network logs, CPU profiles and heap snapshots |
| App traces and metrics | Add an OpenTelemetry collector and a viewer such as Jaeger to the compose file, so the agent can query its own instance |
| Where the evidence goes | Commit it under a directory such as `evidence/` on the PR branch, or upload it with an API credential. A cloud session can read its own ID from `CLAUDE_CODE_REMOTE_SESSION_ID`, so have it put the transcript link `https://claude.ai/code/session_<id>` in the PR body |
| The agent itself | Claude Code exports OpenTelemetry. Set `CLAUDE_CODE_ENABLE_TELEMETRY=1`, `OTEL_METRICS_EXPORTER=otlp`, `OTEL_LOGS_EXPORTER=otlp` and `OTEL_EXPORTER_OTLP_ENDPOINT` in the environment's variables. Metrics include `claude_code.token.usage`, `claude_code.cost.usage` and `claude_code.pull_request.count`. Events include `claude_code.tool_result`. Spans per prompt, model request and tool call are in beta behind `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1`. See the [monitoring doc](https://code.claude.com/docs/en/monitoring-usage) |
| Decisions | The [show-me-your-work](../../skills/show-me-your-work/SKILL.md) TSV trail, committed when a reviewer needs it |

Pointing every session's telemetry at one collector is the closest thing to a fleet dashboard today. It gives tokens, cost and tool calls per session.

## Replacing Bugbot

Bugbot is an automatic reviewer that comments on every PR. It is a GitHub app, so it reviews a PR no matter which agent wrote it. Keeping it is the first option. The rest are Claude-side replacements, by plan:

| Option | Plans | What you get |
|---|---|---|
| Bugbot itself | A Cursor plan with Bugbot | No change from her setup. It also gives a second model family reviewing Claude's code, which the Claude-only panels lack |
| [Claude Code Review](https://code.claude.com/docs/en/code-review) | Team, Enterprise | The managed equivalent. Runs on PR open, on every push, or on `@claude review`. Inline comments and a check run with findings ranked by severity. A `REVIEW.md` in the repo holds review rules. Billed separately, and the docs put the average at $15 to $25 per review |
| [claude-code-action](https://code.claude.com/docs/en/github-actions) on `pull_request` | Any | One workflow file. Inline comments. Authenticate with an API key, or with a subscription token from `claude setup-token` stored as `CLAUDE_CODE_OAUTH_TOKEN`. `/install-github-app` writes the workflow and the secret for you |
| `/code-review` and `/code-review ultra` | Any with subscription auth for ultra | On demand from the terminal. `--comment` posts findings to the PR and `--fix` applies them. `ultra` runs a deeper multi-agent review in the cloud |

A sketch of the workflow for the middle option:

```yaml
name: review
on:
  pull_request:
    types: [opened, synchronize, ready_for_review]
jobs:
  review:
    if: github.event.pull_request.draft == false
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          prompt: |
            Review this pull request. Report only defects you can point to in the diff,
            each with a failure scenario. Leave inline comments. Skip style nits.
```

Her triage rubric in [bugbot-triage.md](../../skills/poteto-mode/references/bugbot-triage.md) applies to any of these reviewers: assess each finding, fix the real ones, dismiss noise with a concrete reason. Pair the reviewer with `/autofix-pr` and the loop she describes is closed: review comments arrive, the cloud session fixes them and replies in the thread.

## Cursor Automations and Grok Bot

[Cursor Automations](https://cursor.com/docs/cloud-agent/automations) start a cloud agent from an event. The Claude Code equivalent is a [routine](https://code.claude.com/docs/en/routines), which starts a cloud session in one of your environments.

| Cursor trigger | Claude Code |
|---|---|
| Schedule | Routine with a cron trigger |
| GitHub PR events | Routine with a GitHub trigger. It covers `pull_request` and `release` events, with filters on author, title, body, branches, labels, draft and merged. For any other GitHub event, `claude-code-action` in a workflow |
| GitLab, Bitbucket | A CI job that runs `claude -p` |
| Webhook | Routine with an API trigger: `POST https://api.anthropic.com/v1/claude_code/routines/<routine_id>/fire` with `Authorization: Bearer <token>` and an optional `{"text": "..."}` body that carries context into the run |
| Slack message or reaction | Claude Tag on Team and Enterprise. Otherwise a Slack workflow step that calls the API trigger |
| Linear, Sentry, PagerDuty | No first-party trigger. Point their outgoing webhooks at a small relay (a Cloudflare Worker, Pipedream, n8n) that reshapes the payload into `{"text": ...}` and calls the API trigger |

| Cursor automation tool | Claude Code |
|---|---|
| Open a PR, comment on a PR, request reviewers | Yes, through the GitHub proxy and `gh` |
| Send to Slack, read Slack, other MCP servers | Your connected MCP connectors are enabled in a routine by default |
| Memories across runs | No memory tool. Have the routine read and update a committed file, which suits her view that the codebase is the memory. Treat it with the same caution about untrusted input |
| Computer use | Not in cloud sessions. Headless Playwright, as above |

Routines have a daily run cap per account, and GitHub triggers have an hourly cap during the preview.

[Channels](https://code.claude.com/docs/en/channels) are the other direction: they push Telegram, Discord, iMessage or custom webhook events into a local session that is already running. They are a research preview and do not reach cloud sessions.

Grok Bot is SpaceXAI's persistent named agent. It works from a cloud computer with a browser, a terminal and a file manager, signs in to your apps through the browser, plugins or MCP servers, runs on schedules and keeps memory per bot ([Composio guide](https://composio.dev/content/guide-to-frok-bot)). It is a general work agent more than a coding tool, and access comes with SuperGrok Heavy, Cursor Ultra and eligible Cursor team plans. Claude Code has no single equivalent. The closest pieces are routines with connectors for scheduled work across your tools, Claude Tag for a teammate you message in Slack, and computer use in the CLI on macOS.

### Using them together

Every one of these tools meets on GitHub, so they compose without any integration work.

| Combination | How |
|---|---|
| Claude Code writes, Bugbot reviews | Install Bugbot on the repo. It reviews PRs from any author |
| Cursor cloud agent writes, Claude reviews | `claude-code-action` on `pull_request`, then `/autofix-pr` if you want Claude to act on the findings |
| Claude Code orchestrates, a Cursor cloud agent verifies on a desktop | Cursor cloud agents can be launched through its API. The coordinator calls it from Bash with a verification brief for the PR branch, and the agent's video lands on the PR. This also puts the verifier on a different model family, which Orchestrate asks for |
| A Cursor-style trigger, Claude Code works | Send the same source event to a routine's API trigger through a relay |
| Grok Bot alongside | Through shared surfaces only: GitHub, Slack, Linear. No API for it turned up in these sources |

## Working locally on Windows

| Tool | Isolation |
|---|---|
| `claude --worktree`, or the Agent tool's `isolation: "worktree"` | A separate checkout. Ports, databases and the network are still shared, so each worktree needs its own compose project name and port range |
| `claude --bg` with `claude agents` | Background sessions you can attach to, read logs from and stop |
| [Sandboxed Bash](https://code.claude.com/docs/en/sandboxing) through `/sandbox` | OS-level filesystem and network limits on every shell command. Runs on macOS, Linux and WSL2. Native Windows is not supported |
| A dev container | Full isolation on your own machine, at the cost of maintaining the image |

For a complete sandbox per agent, the cloud VM is less work than any local option on Windows.

### The setup in use: worktrees with a verification skill

The working setup on this machine, chosen 2026-09-21, is local: every parallel agent gets its own git worktree, and the repo's `verify-<app>` skill is what lets it prove its change. The port already maps every cloud worker to `isolation: "worktree"`, so the playbooks need no edits for this.

| Requirement | How it is met |
|---|---|
| One writer per checkout | The Agent tool's `isolation: "worktree"`, or `claude --worktree` for a session you start yourself |
| Instances that do not collide | `create-verification-skill` has the generated Launch section derive the port, data dir, browser profile, database name and compose project name from the worktree |
| The skill reaches every worktree | `verify-<app>` is committed under the repo's `.claude/skills/`, so each worktree checks it out |
| The app's dependencies | `docker compose` with a project name per worktree. The global `Bash(docker:*)` deny has to be lifted for this |
| Cleanup | The [Worktree cleanup](../../skills/poteto-mode/playbooks/worktree-cleanup.md) playbook, which audits before it prunes |

What this gives up against a cloud VM: the agents share one machine's CPU, memory and network, and nothing stops one from reading another's files.

## Gaps to design around

| Gap | Workaround |
|---|---|
| No desktop, computer use or remote desktop in a cloud session | Headless Playwright and CDP, a container with a desktop that you host, or a Cursor cloud agent as the verifier |
| No preview URL for the app a cloud session is running | A preview deployment per PR, or a tunnel |
| No triggers for Linear, Sentry or PagerDuty | A webhook relay into a routine's API trigger |
| A cloud session cannot notify the session that launched it | Poll `gh pr list` and branches from a `/loop` watcher, as Orchestrate already prescribes after a restart |
| No artifact store for screenshots and video | Commit evidence to the branch, or upload it |
| No fleet view with cost | One OpenTelemetry collector for every session |
| Cloud sessions share your subscription's rate limits | Two to four workers at once. See [cost-and-quality.md](cost-and-quality.md) |
| Self-hosted runner pools (`--environment`) are in beta for Team and Enterprise | On other plans, run `claude -p` or the Agent SDK in your own containers with API billing |
| The base image cannot be replaced | Run your image beside Claude with `docker compose` |
