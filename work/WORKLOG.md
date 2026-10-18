---
type: Log
description: "Append-only per-session trail, date-grouped, newest first."
---

# WORKLOG — the append-only session log

Every session appends **one entry before it ends** — a chat-only session
counts. **Never edit a past entry; append only, newest on top.** A wrong old
entry is corrected by a new one. Distinct from `INTERVIEW.md`, which is the
*current* state of play. Rules: [SR-WORK-SESSION](../records/0054_WORK-session.md).

**Entry format:**

```
## YYYY-MM-DD — <one-line title>  ·  <surface> (<model>)

- **Asked:** *<the ask>*
- **Done:** <what landed, with commit shas where they exist>
- **Decided / left open:** <rulings taken in-session; forks put to the decider>
- **Mistakes:** <what went wrong and what was done about it, or "none">
- **Next:** <the single next step>
```

---

## 2026-10-18 — the work system set up from WORK-SYSTEM.md  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *set up the work system from WORK-SYSTEM.md, for sheetpane.*
- **Done:** records 0001–0003 and 0051–0060, `work/`, `archive/`, `scripts/`, `.claude/` hooks, `CLAUDE.md`, `.gitignore`; WORK-SYSTEM.md placed at `archive/bootstrap/` (it was never at the root of this repo).
- **Decided / left open:** tests deferred — backlog rows B-001–B-005. The repo had no commits and no code, so the code roots are `scripts/` and `.claude/hooks/` and no `W-01` was opened.
- **Mistakes:** the bootstrap's B-003 and B-004 cited locations that do not exist (`decision 11`, `veto 7`); both now cite the record's Consequences, which names them. The register said the queue has eight rule groups; it has ten.
- **Next:** the decider installs the commit-msg guard; the first `W-nn` is filed from the first real ask.
