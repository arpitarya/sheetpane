#!/usr/bin/env bash
# rename-only-guard — refuse a commit made only of pure renames unless its
# message says so. Twice (aae714d, 42a3769) a `git add` failed on an item file
# that `close` had already moved, the failure was not seen, and the commit ran
# with nothing but the move under the full message (work/LESSONS.md). This is
# SR-WORK-SESSION decision 13's gate for that failure class; the commit-msg
# hook (scripts/sr-guard.sh) runs it first.
#
# Escape hatch, on its own line of the commit message:
#     rename only
set -euo pipefail

msg_file="${1:?rename-only-guard.sh needs the commit message file as \$1}"
[ -f "$msg_file" ] || exit 0
status="$(git --no-optional-locks diff --cached --name-status -M)"
[ -n "$status" ] || exit 0
# any entry that is not a 100 % rename means the commit carries content
if printf '%s\n' "$status" | grep -qvE '^R100[[:space:]]'; then exit 0; fi
if grep -qiE '^[[:space:]]*rename[ -]only[[:space:]]*$' "$msg_file"; then exit 0; fi

{
  echo
  echo "  rename guard: this commit holds only renames — did a \`git add\` fail?"
  echo
  printf '%s\n' "$status" | sed 's/^/      /'
  echo
  echo "  Stage the content (name a moved file by its new path), or, if a pure"
  echo "  rename is what you mean, say so on its own line of the message:"
  echo
  echo "      rename only"
  echo
} >&2
exit 1
