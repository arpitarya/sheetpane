---
name: sheetpane-file-work-item
description: Use when contributing to the sheetpane repo and filing a new work item W-nn - the next free id, the item file, its OPEN-WORK row and ball, the worklog and NOW. Not for host apps that use sheetpane.
license: MIT
metadata:
  audience: contributor
---

# Filing a work item (contributors)

The rules live in [SR-WORK-OPEN-QUEUE](https://github.com/arpitarya/sheetpane/blob/main/records/0051_WORK-open-queue.md) and
[SR-WORK-SESSION](https://github.com/arpitarya/sheetpane/blob/main/records/0054_WORK-session.md); this is the checklist.

1. **Re-derive `git status`** — concurrent sessions file items too.
2. **The next id:** the highest `W-nn` in `work/open/`, `archive/open/` and
   `work/OPEN-WORK.md`, plus one. Never reuse an id.
3. **The file** `work/open/W-nn-<slug>.md`, following
   [`work/open/README.md`](https://github.com/arpitarya/sheetpane/blob/main/work/open/README.md): frontmatter (`type:
   Handoff`, `item`, `filed`, `filed_by`, `ball`), At a glance, Goal,
   Definition of done (a table, every row `⏳`), Blockers, Record affected,
   Hazards, Reference, and the prompt to paste.
4. **The OPEN-WORK row**, in the right lane, with one ball: 🔴 blocked on
   the decider · 🟣 gated on a date · 🟡 waiting on another item · 🟢 no
   blockers.
5. **The worklog** entry and the one-line `work/NOW.md`, in the same change.
6. **Commit** with explicit pathspecs: `git add <paths> && git commit` —
   never through a pipe (the commit hook refuses a rename-only commit).

## Pitfalls

- A blocker on the decider is a file (`work/BLOCKED.json`) and stops the
  session ([SR-WORK-BLOCKERS](https://github.com/arpitarya/sheetpane/blob/main/records/0056_WORK-blockers.md)).
- An item that changes a rule names the record it will update.

## Related

[sheetpane-records](../sheetpane-records/SKILL.md)
