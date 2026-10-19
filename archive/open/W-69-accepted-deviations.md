---
type: Handoff
name: W-69
description: "Arpit, 2026-10-19: a third status, `accepted`, with who, when and a required reason; not counted as a problem; written into exports — Group 3 of the features pdfsuite's spec work needs from sheetpane."
item: W-69
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
closed: 2026-10-19
closed_by: "Claude Code (claude-opus-5-5), lane a"
---

# W-69 — Accepted deviations: an error accepted with a reason, kept in the review and the download

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | `status: 'accepted'` with `acceptedBy`, `acceptedAt`, `reason` (required) | an approval is recorded, not lost | ✅ |
| 2 | *Accept…* in the list (not in `readonly`); counts exclude accepted; a filter chip shows them | accepted items stop shouting | ✅ |
| 3 | Comments and W-59's review sheet write *Accepted: <reason>* | the download carries the decision | ✅ comments · → W-59 |

**Arpit, 2026-10-19:** *"look at PDF suite and think about what all features could be needed just from Excel point of view that can be added into sheet pane … consider it built and consider it published. What else?"* — then *"do some research. What can be created as plugin? What should be part of existing packages? Classify it into those and create work items for all of these. Group 1, Group 2, and Group 3."*

**Group 3 — a workbook's life over time.** **Where it lives:** **Existing package — core `@sheetpane/grid` (`<sheetpane-errors>`).**

**Model:** Sonnet: a status, a form field and its counts.

## Goal

A third status, `accepted`, with who, when and a required reason; not counted as a problem; written into exports.

**Why a host needs it:** pdfsuite (arpitarya/pdf-testing-suite): a known, approved difference between spec and PDF should stop failing every run without being deleted.

**Why here and not elsewhere:** Status is part of the error schema and the list. Workbook-authored errors (validation, comments) stay under B-029 and its proposal; this item covers host and user errors only.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · schema | status and fields; restore of old envelopes | ✅ `status: 'open' \| 'resolved' \| 'accepted'` (`ErrorStatus`) with `acceptedBy`, `acceptedAt`, `reason`; `acceptError(id, reason, { by })` and `updateError(…, { status: 'accepted', reason })` — one undo step, `acceptedAt` stamped, a blank reason or a `workbook` / `file` error refused with SP-3018; any other status drops the fields; `setErrors` keeps an old envelope as it was and brings an accepted error with no reason back `open` (SP-3018); a `host` rule's acceptance stands while it fails the same way — `store.test.ts` (6) |
| 2 · ui | form with required reason; undo | ✅ *Accept…* in an open row (not `readonly`, not rule rows): *Why is this accepted?*, Accept disabled while blank, Esc / Cancel / ⌘↵; the element's `author` as who; "n open", the severity chips and the sheet's counts leave accepted out; *Accepted n* chip; pin and badge **A**; who / when / why in the row and the sheet's card, Reopen; one undo step; axe — `errors.test.ts` (6) |
| 3 · export | comments and review sheet | ✅ `@sheetpane/comments`: a reply *Accepted: <reason>* by who accepted it, at that time, the thread done; dropped once reopened; skipped when read back — `write.test.ts` (2). Review sheet → W-59 (DoD 5 added there). Opening it in Excel → W-30 (DoD 3) |
| 4 · tests · docs | SR-ERRORS, SR-COMMENTS; skill `sheetpane-errors`; CHANGELOG | ✅ SR-GRID 5c, 13 and the codes line; SR-ERRORS 3, 7, 14, §1 and Consequences; SR-COMMENTS 3, 5 and Consequences; SR-CODES; the skill, the grid README, `docs/ERRORS.md`, CHANGELOG *Added* |

## Blockers

None.

## Record affected

SR-ERRORS · SR-COMMENTS.

## Hazards

- Overlap with B-029 (dismiss workbook-authored errors): keep them separate until B-029's proposal graduates.

## Reference

- The classification and grouping: this item's siblings W-50 – W-69, filed together on 2026-10-19.
- The host's side: pdfsuite (arpitarya/pdf-testing-suite) — `work/open/W-46-sheet-viewer.md`, `work/open/W-47-sheet-editor.md`, `records/0101_SPEC-intake.md`, `work/design/Spec-*.dc.html`, `Sheet-Editor.dc.html`.
- The plugin contract: `packages/grid/src/plugins/types.ts` (six hooks, six slots).

## The prompt to paste

```text
Build W-69 in arpitarya/sheetpane. Read CLAUDE.md, work/INTERVIEW.md, then
work/open/W-69-accepted-deviations.md and every record it names. Work through the
Definition of done in order, with a test before each next row. Update the
records, OPEN-WORK.md, IMPLEMENTATION.md, CHANGELOG.md, WORKLOG.md and NOW.md
in the same change. Close by moving the file to archive/open/.
```
