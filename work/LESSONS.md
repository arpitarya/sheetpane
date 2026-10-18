---
type: Log
description: "Dated lessons — what this project learned the hard way, newest first. A log, not a record: the date is part of the lesson."
---

# LESSONS — what this build learned the hard way

Newest first. A lesson whose remedy is a *rule* belongs in a record and is
named here only as the failure that produced it. A lesson whose remedy is
*judgment* lives here. ⚠ Nothing here is normative.

---

## 2026-10-18 — an insert-by-script truncated CHANGELOG.md (`b0f7291`)

**What happened.** Adding W-46's entry, a Python one-off wrote
`s[:i] + entry` — the text before the insertion point and the new entry — and
dropped everything after it: every older CHANGELOG entry went, in a commit
whose message described an addition. Nothing failed; no test reads the
CHANGELOG.

**What caught it.** The next edit to the CHANGELOG looked for an anchor that
was no longer there (W-43's close, `7c9eada`, restored it from `9b28465`).

**The remedy (judgment).** An insertion is `s[:i] + new + s[i:]`, and a
script that rewrites a file checks it did not shrink unexpectedly — `git diff
--stat` on the file before staging: a "+12" that reads "+12 −60" is the tell.

**It happened again the same day.** Closing W-45, a helper wrote
`open(p, 'w').write(f(open(p).read()))`: Python opens — and empties — the file
for writing before it evaluates the argument, so the read got nothing, the edit
failed, and `work/IMPLEMENTATION.md` was left empty in the working tree, with
the Cowork session's uncommitted L10 row in it. The file was rebuilt from HEAD;
the L10 row from the 180 characters of it last seen (Cowork to confirm its
wording). Remedy: compute the new text first, write to `p + '.new'`, then
`os.replace`. Second strike → a gate: `scripts/shrink-guard.sh`
(SR-WORK-SESSION decision 13).

## 2026-10-18 — `git add -A <dir>` staged another agent's new files

**What happened.** Committing W-36, `git add -A -- packages/grid/src` swept in
`packages/grid/src/frameworks/*.d.ts`, created minutes earlier by the W-37 agent
working in the same tree. The SR guard refused the commit for an unrelated
reason, which is how the extra files showed up.

**The remedy (judgment).** With an agent working in the tree, stage named
files, not directories; when a file holds both sessions' edits, stage only
your hunk through the index (`git hash-object -w` + `git update-index
--cacheinfo`), as done for OPEN-WORK, the grid README and the lockfile this
day.

---

## 2026-10-18 — a failed `git add` still let the commit run (`aae714d`)

**What happened.** Closing W-17 and W-29, `git add` listed the item files
under `work/open/`, which `close.py` had already moved with `git mv`. The
pathspec failed, `git add` staged nothing, and the next command — chained with
`;`, not `&&` — committed and pushed only the two renames under the full
message. The content followed in `a5b6df5`.

**What caught it.** `git show --stat HEAD` after the push: two files, zero
lines.

**The remedy (judgment).** Chain `git add … && git commit …` so a failed
stage stops the commit, and name a moved item by its new path
(`archive/open/…`). Check `git diff --cached --stat` before committing.

**It happened again the same day (`42a3769`, W-34):** `git add … 2>&1 | grep …`
— the pipe's exit status was grep's, so the failed add was invisible and the
`&&` chain after it ran. Second strike → a gate (SR-WORK-SESSION decision
13): `scripts/rename-only-guard.sh` now refuses a commit of nothing but
renames unless its message says `rename only`. Never pipe `git add`.

---

## 2026-10-18 — `git add -A` committed another session's items

**What happened.** Claude Code committed W-03 with `git add -A` while a Cowork
session had just filed W-25–W-28. Their four item files, queue rows, WORKLOG,
INTERVIEW and GLOSSARY lines went into `206c093` under the W-03 message, and
`coverage/` and Vitest failure screenshots went in with them. Pushed before
anyone noticed.

**What caught it.** Four rows in `OPEN-WORK.md` that this session had not
written, and `git log -- work/open/W-25-…` naming the W-03 commit.

**The remedy.** The rule already exists — SR-WORK-SESSION decision 10:
commit with explicit pathspecs when the index can carry another session's
work. `coverage/` and `.vitest/` are now ignored. History was not rewritten;
the content is correct, only its commit message is wrong.



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

