---
type: Handoff
name: W-59
description: "Arpit, 2026-10-19: a new plugin that adds a *Review* sheet listing every error with a link to its cell, and optionally fills each flagged cell by severity — Group 2 of the features pdfsuite's spec work needs from sheetpane."
item: W-59
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-59 — New plugin `@sheetpane/review`: the review written into the download as its own sheet, flagged cells coloured

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Add a sheet (name configurable, unique) with id, sheet, cell (an internal hyperlink `#'Sheet'!B4`), severity, type, found, expected, message, author, status | a reviewer works the list inside Excel | ⏳ |
| 2 | Optional fill per flagged cell by severity, cloning each cell's `xf` so its own formatting stays | the problems are visible in the grid | ⏳ |
| 3 | Download menu options *Add a Review sheet* and *Colour flagged cells*; layers and severities chosen by option (W-51, W-50) | the host decides what is written | ⏳ |

**Arpit, 2026-10-19:** *"look at PDF suite and think about what all features could be needed just from Excel point of view that can be added into sheet pane … consider it built and consider it published. What else?"* — then *"do some research. What can be created as plugin? What should be part of existing packages? Classify it into those and create work items for all of these. Group 1, Group 2, and Group 3."*

**Group 2 — writing the files a host hands back.** **Where it lives:** **New plugin — `@sheetpane/review`.**

**Model:** Sonnet: a new export-only plugin on the existing `exportPatch` context.

## Goal

A new plugin that adds a *Review* sheet listing every error with a link to its cell, and optionally fills each flagged cell by severity.

**Why a host needs it:** pdfsuite (arpitarya/pdf-testing-suite) SR-SPEC-INTAKE decision 14: the *annotated workbook* — every error cell filled red and a *Validation* sheet listing them, to fix in Excel and re-upload.

**Why here and not elsewhere:** Purely additive, optional output. The `exportPatch` context already lets a plugin write a part, add a relationship and set a content type — everything this needs. It sits beside `@sheetpane/comments`, which writes the same review as comments.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · package | `packages/review` scaffold, README, skill, demo (L10), new record SR-REVIEW | ⏳ |
| 2 · sheet | workbook.xml, rels, content types, shared strings or inline strings; hyperlinks work in Excel | ⏳ |
| 3 · fills | cloned xfs; untouched cells byte-identical; sheet-level errors (W-55) listed, not coloured | ⏳ |
| 4 · tests · docs | round-trip via `@sheetpane/import`; `@sheetpane/testing` reads the Review sheet back; CHANGELOG | ⏳ |

## Blockers

None.

## Record affected

new SR-REVIEW · SR-EXPORT (no change expected — the context suffices; confirm) · SR-BUILD (a new package).

## What W-50 hands this item (closed 2026-10-19)

- `severity` has two results, `pass` and `skipped` (not checked); `isResult(e)` from `@sheetpane/grid` tells them from problems.
- **Follow `@sheetpane/comments`:** leave results out of the Review sheet and the fills unless `ctx.exportOptions.includeResults === true` (SR-COMMENTS decision 3) — a downloaded review stays a list of problems. Results never get a fill (SR-GRID decision 23: a result never tints a cell).
- If the Review sheet lists results, list them after the problems in `SEVERITY_ORDER` (error › warning › note › skipped › pass).

## Hazards

- Sheet name collision with the user's own sheet: suffix, never overwrite.
- Re-upload of an annotated file: the Review sheet must be recognisable and skippable by the host (a defined name marks it).

## Reference

- The classification and grouping: this item's siblings W-50 – W-69, filed together on 2026-10-19.
- The host's side: pdfsuite (arpitarya/pdf-testing-suite) — `work/open/W-46-sheet-viewer.md`, `work/open/W-47-sheet-editor.md`, `records/0101_SPEC-intake.md`, `work/design/Spec-*.dc.html`, `Sheet-Editor.dc.html`.
- The plugin contract: `packages/grid/src/plugins/types.ts` (six hooks, six slots).

## The prompt to paste

```text
Build W-59 in arpitarya/sheetpane. Read CLAUDE.md, work/INTERVIEW.md, then
work/open/W-59-review-sheet-plugin.md and every record it names. Work through the
Definition of done in order, with a test before each next row. Update the
records, OPEN-WORK.md, IMPLEMENTATION.md, CHANGELOG.md, WORKLOG.md and NOW.md
in the same change. Close by moving the file to archive/open/.
```
