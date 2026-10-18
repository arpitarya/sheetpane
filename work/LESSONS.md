---
type: Log
description: "Dated lessons — what this project learned the hard way, newest first. A log, not a record: the date is part of the lesson."
---

# LESSONS — what this build learned the hard way

Newest first. A lesson whose remedy is a *rule* belongs in a record and is
named here only as the failure that produced it. A lesson whose remedy is
*judgment* lives here. ⚠ Nothing here is normative.

---

## 2026-10-18 — two Cowork sessions, one working tree

**What happened.** While one session resolved the research items, another
renamed the UI package, moved to pnpm and filed three items — twelve files
changed under the first session's feet. Its write-back would have overwritten
all twelve.

**What caught it.** The write refused files whose modification time had moved
since they were read. The session re-read the live tree, replayed its own
changes on top and resolved nine conflicts by hand.

**The lesson.** Before writing into a shared working tree, re-read every file
you are about to change — not just `git status` — and treat a refused write as
the normal case, not an error. The rule already exists for `work/*.md`
(SR-WORK-SESSION decision 10); it applies to every file.

