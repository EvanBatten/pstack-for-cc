# Task tools

`install.json` sets `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`, which gives a session `TaskCreate` and `TaskUpdate`, so a playbook's steps open as a task list.

## How to get to it (user POV)

Any session. The tools are deferred, so the agent loads them through ToolSearch.

## Driving it with drive.sh

The mode session (opus) runs with `--output-format stream-json --verbose`. The judge asserts the stream's `init` record lists `TaskCreate`, and notes whether the session used it.

## Gotchas

- The tool list is in the stream, not the transcript.
