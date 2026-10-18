---
type: Handoff
description: "Cold-start state of play for a successor session: in-flight work, constraints, lessons."
---

# Model handoff — the agent-succession record

*The departing model answers for the record, so whatever succeeds it inherits
the judgment and not just the files.*

**Standing instruction to every future model reading this: you are now the
maintainer of this document. When the project's direction, decisions or state
change, update it in the same change. Leave it better.**

## How to use this file

A state-of-play doc, not an end-of-session report. Keep it current **during**
the session. Write it for a different model arriving with zero other context,
mid-task. The four sections below are maintained; anything after them is
history. **A stale INTERVIEW at handoff is as serious as a missing worklog
entry.**

---

## 1 · State of play

*Updated 2026-10-18.* The work system is set up; no feature work has started. sheetpane — an Excel (xlsx) viewer and editor for single-page apps, published to npm — has no code yet.
**Ground it before you edit it** — `git log`, the queue, the code.

## 2 · In flight, and the immediate next step

Nothing in flight. Next: the decider (`git config user.name`) installs `scripts/sr-guard.sh` as the
`commit-msg` hook; the first item is filed from the first real ask.

## 3 · Standing constraints

- The laws: L0 (records are the only source; links, never restatements), L1
  (retired records are archived). See `records/0001_LAWS.md`.
- The queue is the list; a blocker is a file; nothing closed is deleted.
- Tests are not yet in place (`BACKLOG.md` B-001–B-005); the hooks and the
  commit guard are the only mechanical enforcement.

## 4 · Lessons learned

- None yet. The first lesson goes here and in `LESSONS.md`.
