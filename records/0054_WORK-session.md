---
type: Standing Record
kind: process
name: SR-WORK-SESSION
title: "SR-WORK-SESSION (0054) — what a session owes"
description: "The worklog entry, the interview kept current, the one-line NOW, transition markers, short answers, and the two-strikes rule."
status: accepted
date: 2026-10-18
feature: session continuity
owns: [.claude/hooks/require-progress.sh, scripts/rename-only-guard.sh]
laws: [L0]
timestamp: 2026-10-18T08:40:00Z
content_sha: ""
---

# SR-WORK-SESSION — what a session owes

## §1 — For humans

**A cold session must arrive warm.** Every session leaves a worklog entry,
keeps `work/INTERVIEW.md` true while it works, and overwrites the one line in
`work/NOW.md`.

**Transitions are one-line markers**, answers are short, and a failure seen
twice becomes a check in the same change.

```mermaid
flowchart LR
    S["read CLAUDE.md, INTERVIEW, OPEN-WORK"] --> N["announce: W-nn, write NOW.md"]
    N --> W["work; INTERVIEW kept current"]
    W --> E["WORKLOG entry; NOW.md idle"]
```

<details>
<summary><b>ASCII twin</b> — the same diagram, for terminals and diffs</summary>

```text
   read CLAUDE.md, INTERVIEW, OPEN-WORK -> announce W-nn, write NOW.md
       -> work (INTERVIEW kept current) -> WORKLOG entry, NOW.md idle
```

</details>

---

## §2 — For agents

### Context

Sessions end abruptly and share no memory; without these files the next
session re-derives the state, or guesses it.

### Decision — the session discipline (normative)

1. **Every session appends one worklog entry before it ends** —
   `work/WORKLOG.md`: asked, done, decided or left open, the single next step.
   A chat-only session counts.
2. The worklog is append-only, newest on top; a wrong old entry is corrected
   by a new one.
3. **`work/INTERVIEW.md` is kept current DURING the session.** Four
   maintained sections: state of play · in flight and the immediate next step ·
   standing constraints · lessons learned.
4. **`work/IMPLEMENTATION.md` is the evidence store** the queue reconciles
   against. A row is earned by landing, never by being planned.
5. **`work/NOW.md` carries one line, overwritten.** A session that dies
   mid-task leaves a note, not a mystery. `idle` when nothing is in flight.
6. **Announce every transition in one line — a marker, never a summary.**
   `→ W-12: building the parser` on start; `✓ W-12 · → W-13: …` on finish.
   A finish with no next is a stop, and a stop is its own sentence.
7. Keep a todo list for anything with more than two steps, current during the
   work.
8. **Ten lines or fewer unless more was asked for, and lead with the answer.**
9. Never summarise work you just did — the diff showed it. No closing offers.
10. **Concurrent sessions are real.** Re-derive `git status` right before
    staging; re-apply your `work/*.md` edits right before committing; commit
    with explicit pathspecs when the index carries another session's work.
11. **Ground truth over prose.** Before any status claim, check `git log`,
    the code, or a command that reproduces it.
12. Say what you are running, and when, to anyone sharing the machine.
13. 🔴 **Two strikes → a gate.** A failure class the worklog records twice
    becomes a check — a hook, a script, or (once tests exist) a test — **in the
    same change that records the second occurrence.**
14. The worklog is cut at each major release into `archive/worklog/`.

### Consequences

- **Enforced today:** decision 5, nudged once per turn by
  `.claude/hooks/require-progress.sh` when the tree changed and `work/NOW.md`
  did not. Decision 13's first gate: a commit holding only pure renames is
  refused unless its message says `rename only` — `scripts/rename-only-guard.sh`,
  run first by the commit-msg hook (`scripts/sr-guard.sh`); the class it
  closes is the worklog's twice-recorded "a failed `git add` let the commit
  run" (`aae714d`, `42a3769`).
- **Judgment today:** every other decision — the worklog entry (1), the
  interview (3), two strikes (13).

### Alternatives considered

- An end-of-session summary only — rejected: a session that dies mid-task
  leaves nothing (decision 5).
- Long narrative reports — rejected: decision 8.

### Reference (required)

- [`.claude/hooks/require-progress.sh`](../.claude/hooks/require-progress.sh) —
  decision 5's nudge.
- [`work/WORKLOG.md`](../work/WORKLOG.md) · [`work/INTERVIEW.md`](../work/INTERVIEW.md) · [`work/NOW.md`](../work/NOW.md)

### Veto condition

**Reopen this decision if:** the newest WORKLOG entry is older than the newest commit touching work/.

**How to check it:** `grep -m1 '^## 20' work/WORKLOG.md; git log -1 --format=%cs -- work/`

---

## References

*Every source this record cites, gathered in one place. An archived document
is never listed here.*

**Records** — [SR-WORK-DOCS](0055_WORK-docs.md) · [SR-WORK-OPEN-QUEUE](0051_WORK-open-queue.md)

**Code**

- [`.claude/hooks/require-progress.sh`](../.claude/hooks/require-progress.sh)

**Project docs**

- [`work/WORKLOG.md`](../work/WORKLOG.md) · [`work/INTERVIEW.md`](../work/INTERVIEW.md) · [`work/NOW.md`](../work/NOW.md) · [`work/IMPLEMENTATION.md`](../work/IMPLEMENTATION.md)
