#!/usr/bin/env bash
# Drives the pstack harness through real headless sessions and reads what
# landed in their transcripts. One verdict per feature in ../features/.
# Usage: drive.sh            run a drive
#        drive.sh --clean TS remove the three project dirs a drive named TS made
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
projects="$HOME/.claude/projects"
tmp=${TEMP:-/tmp}

if [ "${1:-}" = "--clean" ]; then
	ts=${2:?timestamp}
	for d in "$projects"/*-pstack-verify-"$ts"-mode "$projects"/*-pstack-verify-"$ts"-control; do
		[ -d "$d" ] && rm -rf "$d" && echo "removed $(basename "$d")"
	done
	exit 0
fi

ts=$(date -u +%Y%m%dT%H%M%SZ)
ev="$tmp/pstack-verify/$ts"
mkdir -p "$ev"
verdicts="$ev/verdicts.txt"
: > "$verdicts"
verdict() { printf '%-14s %s  %s\n' "$1" "$2" "$3" | tee -a "$verdicts"; }

# Each session runs from its own scratch dir so its transcript has its own
# project dir, found by the slug Claude Code derives from the path.
mode_dir="$tmp/pstack-verify-$ts-mode"
control_dir="$tmp/pstack-verify-$ts-control"
mkdir -p "$mode_dir" "$control_dir"

run() { # dir model prompt out [resume-id]
	local dir=$1 model=$2 prompt=$3 out=$4 resume=${5:-}
	(cd "$dir" && env -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT timeout 300 claude -p ${resume:+--resume "$resume"} "$prompt" \
		--model "$model" --dangerously-skip-permissions --setting-sources user --output-format json > "$out" 2>"$out.err") || true
	node -e 'const j=require(process.argv[1]);process.stdout.write(j.session_id||"")' "$out"
}
transcript_of() { ls -t "$projects"/*"$(basename "$1")"/"$2".jsonl 2>/dev/null | head -1; }

echo "drive $ts"
echo "== mode session, turn 1: enter the mode by reading the skill"
sid=$(run "$mode_dir" haiku "Read $HOME/.claude/skills/poteto-mode/SKILL.md in full and then reply with only the word ready." "$ev/mode-turn1.json")
echo "== mode session, turn 2: an investigation under the mode"
run "$mode_dir" opus "Under poteto mode, treat this as an Investigation playbook task and answer from the file alone: what does $HOME/.claude/skills/poteto-mode/scripts/check-port.mjs check? Carry the playbook's steps as a list in your reply with each step's state, and include the throughput checkpoint line the playbook names." "$ev/mode-turn2.json" "$sid" > /dev/null
echo "== control session: never touches pstack"
csid=$(run "$control_dir" haiku "Reply with only the word one." "$ev/control-turn1.json")
run "$control_dir" haiku "Reply with only the word two." "$ev/control-turn2.json" "$csid" > /dev/null

mt=$(transcript_of "$mode_dir" "$sid"); ct=$(transcript_of "$control_dir" "$csid")
[ -f "$mt" ] && cp "$mt" "$ev/mode.jsonl"; [ -f "$ct" ] && cp "$ct" "$ev/control.jsonl"
reply2=$(node -e 'const j=require(process.argv[1]);process.stdout.write(String(j.result||""))' "$ev/mode-turn2.json")
printf '%s\n' "$reply2" > "$ev/mode-turn2-reply.txt"

echo "== verdicts"
# hook-context: SessionStart context in both transcripts, with the three paths.
if [ -f "$mt" ] && grep -q '# pstack session context' "$mt" && grep -q 'Orchestrate store root' "$mt" && grep -q '# pstack session context' "$ct"; then
	verdict VERIFIED hook-context "mode.jsonl line $(grep -n -m1 '# pstack session context' "$mt" | cut -d: -f1), control.jsonl line $(grep -n -m1 '# pstack session context' "$ct" | cut -d: -f1)"
else verdict "NOT VERIFIED" hook-context "no session context attachment in $ev/mode.jsonl or control.jsonl"; fi

# mode-reminder: the reminder attachment appears in the mode session after turn 1 and never in the control.
# grep -c prints 0 and exits 1 on no match. Keep the printed count and swallow
# the exit, or set -e ends the drive on the control transcript, which has none.
mr=$(grep -c '# pstack reminders' "$mt" 2>/dev/null || true); mr=${mr:-0}
cr=$(grep -c '# pstack reminders' "$ct" 2>/dev/null || true); cr=${cr:-0}
if [ "$mr" -ge 1 ] && [ "$cr" -eq 0 ]; then
	verdict VERIFIED mode-reminder "mode.jsonl line $(grep -n -m1 '# pstack reminders' "$mt" | cut -d: -f1) carries it, control.jsonl has none"
elif [ -z "$mt" ] || [ -z "$ct" ]; then verdict INCONCLUSIVE mode-reminder "a transcript is missing"
else verdict "NOT VERIFIED" mode-reminder "mode=$mr reminders, control=$cr"; fi

# playbook-run: the turn-2 reply carries the Investigation playbook's mandatory line and a step list.
if printf '%s' "$reply2" | grep -qi 'throughput checkpoint' && printf '%s' "$reply2" | grep -qE '^[[:space:]]*([0-9]+\.|-)'; then
	verdict VERIFIED playbook-run "$ev/mode-turn2-reply.txt"
elif [ -z "$reply2" ]; then verdict INCONCLUSIVE playbook-run "turn 2 returned no reply, see $ev/mode-turn2.json.err"
else verdict "NOT VERIFIED" playbook-run "$ev/mode-turn2-reply.txt lacks the checkpoint line or a step list"; fi

# port-clean: the tree passes its own check and tests. The skills tree is two
# levels up from this scripts directory.
root=$(cd "$here/../.." && { pwd -W 2>/dev/null || pwd; })
if node "$root/poteto-mode/scripts/check-port.mjs" "$root" > "$ev/check-port.txt" 2>&1 && node --test "$root/poteto-mode/scripts/port.test.js" "$root/poteto-mode/scripts/check-plan.test.js" > "$ev/node-test.txt" 2>&1; then
	verdict VERIFIED port-clean "$ev/check-port.txt, $ev/node-test.txt"
else verdict "NOT VERIFIED" port-clean "$ev/check-port.txt or $ev/node-test.txt"; fi

echo "evidence: $ev"
echo "cleanup:  bash $0 --clean $ts"
grep -q 'NOT VERIFIED\|INCONCLUSIVE' "$verdicts" && exit 1 || exit 0
