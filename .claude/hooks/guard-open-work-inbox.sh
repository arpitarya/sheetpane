#!/usr/bin/env bash
# PostToolUse(Write|Edit|MultiEdit|NotebookEdit|Bash) — catches a malformed
# "Blocked on the decider" section the moment a session writes one. Bash is in the
# matcher because a session told to prefer the shell edits files that way.
# The rule is SR-WORK-OPEN-QUEUE rule 45a — stated once there, NOT here.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
[ -f work/OPEN-WORK.md ] || exit 0

REASON=$(python3 scripts/check-open-work-inbox.py 2>/dev/null)
[ -z "$REASON" ] && exit 0

jq -n --arg r "$REASON" '{hookSpecificOutput:{hookEventName:"PostToolUse",decision:"block",
  reason:($r + " — fix the section to match the record before continuing.")}}'
exit 0
