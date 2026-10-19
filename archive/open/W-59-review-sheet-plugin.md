---
type: Handoff
name: W-59
description: "Arpit, 2026-10-19: a new plugin that adds a *Review* sheet listing every error with a link to its cell, and optionally fills each flagged cell by severity — Group 2 of the features pdfsuite's spec work needs from sheetpane."
item: W-59
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Claude Code (claude-opus-5-5), lane h"
ball: agent
closed: 2026-10-19
closed_by: "Claude Code (claude-opus-5-5), lane h"
---

# W-59 — New plugin `@sheetpane/review`: the review written into the download as its own sheet, flagged cells coloured

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Add a sheet (name configurable, unique) with id, sheet, cell (an internal hyperlink `#'Sheet'!B4`), severity, type, found, expected, message, author, status | a reviewer works the list inside Excel | ✅ |
| 2 | Optional fill per flagged cell by severity, cloning each cell's `xf` so its own formatting stays | the problems are visible in the grid | ✅ |
| 3 | Download menu options *Add a Review sheet* and *Colour flagged cells*; layers and severities chosen by option (W-51, W-50) | the host decides what is written | ✅ |

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
| 1 · package | `packages/review` scaffold, README, skill, demo (L10), new record SR-REVIEW | ✅ `packages/review`, SR-REVIEW (0123), the *sheetpane-plugins* and *sheetpane-errors* skills, the gallery tab *Review sheet* in both demos and its demo-check step; `package.test.ts` |
| 2 · sheet | workbook.xml, rels, content types, shared strings or inline strings; hyperlinks work in Excel | ✅ the part, its relationship and content type, `<sheet>`, inline strings, internal hyperlinks, the marker name, `Review (2)` beside a user's sheet, rewritten in place when exported again (`sheet.test.ts`). Hyperlinks in real Excel → **W-30** DoD 3 |
| 3 · fills | cloned xfs; untouched cells byte-identical; sheet-level errors (W-55) listed, not coloured | ✅ `fills.test.ts`: clones keep format, font, border and alignment; every other cell byte-identical; `no-cell` for whole-sheet and workbook errors; SP-5903, SP-5904. Opened in real Excel → **W-30** DoD 3 |
| 4 · tests · docs | round-trip via `@sheetpane/import`; `@sheetpane/testing` reads the Review sheet back; CHANGELOG | ✅ `sheet.test.ts` (`read`, `reviewSheetOf`, `readFile`, `valueAt`), `roundtrip.test.ts` (showcase and exceljs fixtures, with comments); README, `docs/ERRORS.md` (SP-5901 – SP-5905), CHANGELOG |
| 5 · accepted (W-69) | an error with `status: 'accepted'` is listed with its status and *Accepted: <reason>* (who — `acceptedBy` — and when — `acceptedAt`), never filled as a problem nor counted with the open ones; SR-ERRORS decision 14, SR-GRID 5c | ✅ Status *Accepted*, *Accepted: <reason>*, who, when (UTC); never filled; `lastExport.counts` keeps them apart (`sheet.test.ts`, `fills.test.ts`) |

## Blockers

None.

## Closed — 2026-10-19

- **W-50 / W-51 not yet merged on this lane's base.** `severities` is `readonly string[]` (default `error`, `warning`, `note`; `pass` / `skipped` only when listed) and `layers` filters on `e.layer`, read as `(e as { layer?: string }).layer ?? 'review'` in `packages/review/src/rows.ts` (`layerOf`) — and the severity name falls back to a capitalised id. The orchestrator tightens these types after W-50 and W-51 merge.
- **SR-EXPORT:** no change — the `exportPatch` context sufficed (confirmed).
- **Not built:** an autoFilter on the header row; a summary line of counts in the sheet (`lastExport.counts` carries them).

## Record affected

new SR-REVIEW · SR-EXPORT (no change expected — the context suffices; confirm) · SR-BUILD (a new package).

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
