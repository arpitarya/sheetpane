---
type: Handoff
name: W-52
description: "Arpit, 2026-10-19: Insert row/column above, below, left, right and Delete in Edit mode, shifting everything that points at a cell, and written into the download — Group 1 of the features pdfsuite's spec work needs from sheetpane."
item: W-52
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-52 — Insert and delete rows and columns in Edit, with every reference shifted

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Store: `insertRows / deleteRows / insertCols / deleteCols` as one change kind, `structure`, one undo step each | an Excel-like edit that undoes | ⏳ |
| 2 | Shift every in-memory table: merges, validations, conditional formats, notes, threaded comments, drawings, hidden and outline state, error ranges, change-map keys | nothing points at the wrong cell after a shift | ⏳ |
| 3 | `derive` input `restructure` so `@sheetpane/formulas` shifts its model (`#REF!` for deleted targets); `@sheetpane/charts` shifts series refs | formulas and charts stay true | ⏳ |
| 4 | Export: `patchXlsx` renumbers `<row>`/`<c>` and rewrites mergeCells, dataValidations, conditionalFormatting, hyperlinks, definedNames, autoFilter, tables, drawing anchors, comments and VML | Excel opens the download with everything where it belongs | ⏳ |
| 5 | UI: header menu and selection bar *Insert above / below / left / right*, *Delete*; Ctrl+Shift+= and Ctrl+−; a refusal (SP code) for a delete that splits a merge, a table or a pivot source | what Excel refuses, sheetpane refuses | ⏳ |

**Arpit, 2026-10-19:** *"look at PDF suite and think about what all features could be needed just from Excel point of view that can be added into sheet pane … consider it built and consider it published. What else?"* — then *"do some research. What can be created as plugin? What should be part of existing packages? Classify it into those and create work items for all of these. Group 1, Group 2, and Group 3."*

**Group 1 — the host's review flow cannot work without it.** **Where it lives:** **Existing packages — core `@sheetpane/grid` (store, menus), `@sheetpane/export` (`patchXlsx`), `@sheetpane/import` tables shifted in memory**; `@sheetpane/formulas` and `@sheetpane/charts` follow through their existing hooks.

**Model:** Opus: it moves every reference in the workbook and in every plugin's tables, and rewrites a dozen package parts on export.

## Goal

Insert row/column above, below, left, right and Delete in Edit mode, shifting everything that points at a cell, and written into the download.

**Why a host needs it:** pdfsuite (arpitarya/pdf-testing-suite)'s *Sheet-Editor* board has **Insert row** and **Delete row** in sheetpane's Edit mode, for adding a parameter row to a spec sheet.

**Why here and not elsewhere:** It changes geometry and every cell address. The plugin contract has no geometry hook (W-49's finding); the core owns the change map and the one undo stack. No seventh hook is added: the core shifts the imported tables every plugin reads, and `derive` gains an input kind, `restructure`.

## Research (2026-10-19)

Excel, on insert or delete, shifts cell references in formulas (deleted targets become `#REF!`), merged ranges, data-validation and conditional-format ranges, hyperlinks, defined names, the autofilter, tables, drawing anchors, comments and outline levels. Apache POI's `RowShifter` names the same list — merged regions, hyperlinks, formulas, conditional formatting, data validation — as what a shift must touch.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · store | four operations, change kind `structure`, one undo/redo step; `sheetpane-change` carries `{ kind: 'structure', op, at, count }` | ⏳ |
| 2 · shift | every table in `ImportedSheet` shifted; errors on deleted cells become `resolved` with message *"row deleted"* | ⏳ |
| 3 · plugins | `DeriveInput` gains `restructure`; formulas and charts updated; other plugins verified by test to read shifted tables | ⏳ |
| 4 · export | every part above rewritten; property test (fast-check): insert then delete the same span is a byte-stable round-trip of values, merges and rules | ⏳ |
| 5 · ui | menus, shortcuts, refusal codes in `docs/ERRORS.md`; CSV supports rows and columns (no other parts) | ⏳ |
| 6 · real files | a workbook saved by Excel with every part above opens in Excel after a shift (decider's check, like W-30) | ⏳ |
| 7 · tests · docs | store, export, browser, axe; skills `sheetpane-events`, `sheetpane-plugin-author`; CHANGELOG | ⏳ |

## Blockers

None.

## Record affected

SR-GRID · SR-EXPORT · SR-IMPORT · SR-FORMULAS · SR-CHARTS · SR-ERRORS · SR-CODES.

## Hazards

- The largest item here: plan the parts in the order import tables → store → export → plugins → UI, each with a test before the next.
- Pivot sources and external references are not rewritten — refuse, never corrupt.
- W-46's selection layer and W-47's sizes must shift with the rows they belong to.
- **From W-61 (closed 2026-10-19):** `ImportedSheet.tables` exists now (SR-IMPORT decision 13) — step 2 shifts each table's `ref` and `autoFilter` in memory, so `@sheetpane/tables` draws and `resolveStructuredRef` (SR-EXPORT 9a) resolves the moved cells; step 4 rewrites `ref` and `<autoFilter ref>` in each `xl/tables/tableN.xml`; an insert inside a table grows it, as in Excel; step 5's refusal covers a delete that takes a table's header row. W-61's own step 4 ("W-52 shifts their ref") is this item's.

## Reference

- The classification and grouping: this item's siblings W-50 – W-69, filed together on 2026-10-19.
- The host's side: pdfsuite (arpitarya/pdf-testing-suite) — `work/open/W-46-sheet-viewer.md`, `work/open/W-47-sheet-editor.md`, `records/0101_SPEC-intake.md`, `work/design/Spec-*.dc.html`, `Sheet-Editor.dc.html`.
- The plugin contract: `packages/grid/src/plugins/types.ts` (six hooks, six slots).

## The prompt to paste

```text
Build W-52 in arpitarya/sheetpane. Read CLAUDE.md, work/INTERVIEW.md, then
work/open/W-52-insert-delete-rows-columns.md and every record it names. Work through the
Definition of done in order, with a test before each next row. Update the
records, OPEN-WORK.md, IMPLEMENTATION.md, CHANGELOG.md, WORKLOG.md and NOW.md
in the same change. Close by moving the file to archive/open/.
```
