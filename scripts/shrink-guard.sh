#!/usr/bin/env bash
# shrink-guard — refuse a commit in which a text file loses more than half of its lines, unless the
# message says so. Twice a script that rewrote a file kept only part of it: the CHANGELOG lost every
# older entry in b0f7291, and a work file was emptied in the working tree on 2026-10-18 (work/LESSONS.md).
# This is SR-WORK-SESSION decision 13's gate for that failure class; the commit-msg hook
# (scripts/sr-guard.sh) runs it after the rename gate. Files under 20 lines, deletions, renames and
# generated bundles (llms*.txt) are not checked.
#
# Escape hatch, on its own line of the commit message:
#     shrink ok
set -euo pipefail

msg_file="${1:?shrink-guard.sh needs the commit message file as \$1}"
[ -f "$msg_file" ] || exit 0
if grep -qiE '^[[:space:]]*shrink ok[[:space:]]*$' "$msg_file"; then exit 0; fi
bad=""
while IFS=$'\t' read -r added removed path; do
  [ "$added" = "-" ] && continue                      # binary
  case "$path" in *.txt|*.json|*.lock|*.yaml) continue ;; esac
  before="$(git --no-optional-locks show "HEAD:$path" 2>/dev/null | wc -l | tr -d ' ')" || continue
  [ "${before:-0}" -ge 20 ] || continue
  after=$(( before + added - removed ))
  if [ $(( after * 2 )) -lt "$before" ]; then bad="$bad$path ($before → $after lines)"$'\n'; fi
done < <(git --no-optional-locks diff --cached --numstat --diff-filter=M)
[ -z "$bad" ] && exit 0
{
  echo
  echo "  shrink guard: a file lost more than half of its lines — did a script drop the rest?"
  echo
  printf '%s' "$bad" | sed 's/^/      /'
  echo
  echo "  Check \`git diff --cached --stat\`. If the cut is meant, say so on its own line:"
  echo
  echo "      shrink ok"
  echo
} >&2
exit 1
