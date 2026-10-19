---
type: Handoff
name: W-52
description: "Arpit, 2026-10-19: Insert row/column above, below, left, right and Delete in Edit mode, shifting everything that points at a cell, and written into the download — Group 1 of the features pdfsuite's spec work needs from sheetpane."
item: W-52
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-52 — Insert and delete rows and columns in Edit, with every reference shifted

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Store: `insertRows / deleteRows / insertCols / deleteCols` as one change kind, `structure`, one undo step each | an Excel-like edit that undoes | ✅ |
| 2 | Shift every in-memory table: merges, validations, conditional formats, notes, threaded comments, drawings, hidden and outline state, error ranges, change-map keys | nothing points at the wrong cell after a shift | ✅ |
| 3 | `derive` input `restructure` so `@sheetpane/formulas` shifts its model (`#REF!` for deleted targets); `@sheetpane/charts` shifts series refs | formulas and charts stay true | ✅ |
| 4 | Export: `patchXlsx` renumbers `<row>`/`<c>` and rewrites mergeCells, dataValidations, conditionalFormatting, hyperlinks, definedNames, autoFilter, tables, drawing anchors, comments and VML | Excel opens the download with everything where it belongs | ✅ (opened in Excel: → W-30) |
| 5 | UI: header menu and selection bar *Insert above / below / left / right*, *Delete*; Ctrl+Shift+= and Ctrl+−; a refusal (SP code) for a delete that splits a merge, a table or a pivot source | what Excel refuses, sheetpane refuses | ✅ |

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
| 1 · store | four operations, change kind `structure`, one undo/redo step; `sheetpane-change` carries `{ kind: 'structure', op, at, count }` | ✅ `insertRows` · `deleteRows` · `insertCols` · `deleteCols` (`at` 0-based, `count`), `structureRefusal(op)`, `structureOps()`; kind `structure` under `sheet!#structure` (the sheet's operations in order); one undo step that also restores the moved workbook, the derived values and the plugin-error index; one store event `{ kind: 'structure', op, at, count, ref: '3:4' or 'C:D' }`, fired by the element as `sheetpane-change` (typed in the manifest); undo fires the inverse. `packages/grid/src/pane/structure.ts` |
| 2 · shift | every table in `ImportedSheet` shifted; errors on deleted cells become `resolved` with message *"row deleted"* | ✅ `@sheetpane/import` `restructureWorkbook(book, op)` (a new object; the upload untouched): rows, text, styles, formulas on every sheet and the defined names, merges, freeze, hidden and outline, heights, widths, the autofilter, validations, conditional formats, drawings, notes, threads, pivots, and chart parts served moved by `part()`; `PivotTable.source` read. The store moves the change map (cells and their style / format slots, typed formulas everywhere, merges, freeze, hidden, outline), errors (deleted → `resolved`, "row deleted" / "column deleted", range kept), derived values, the plugin-error index (ids kept), the selection and the Flag form. **W-61 hook:** `shiftTables(sheet, op)` in `packages/import/src/shift.ts` (marked `W-61: shift ImportedSheet.tables`) returns the sheet unchanged until tables are read — wire the in-memory table shift there; the store's table refusal (`tablesOf` in `packages/grid/src/pane/structure.ts`) already reads `ImportedSheet.tables` when present |
| 3 · plugins | `DeriveInput` gains `restructure`; formulas and charts updated; other plugins verified by test to read shifted tables | ✅ `{ kind: 'restructure', sheet, op, at, count }` — the provider returns the whole derived set, as on a load; `@sheetpane/formulas` rebuilds from the moved workbook (`#REF!` for deleted inputs; undo back); `@sheetpane/charts` follows through the moved chart parts (no code change; anchor and series tested); validation and comments verified by test (`structure.test.ts` in each) |
| 4 · export | every part above rewritten; property test (fast-check): insert then delete the same span is a byte-stable round-trip of values, merges and rules | ✅ `patchXlsx(…, { structure })` (`packages/export/src/restructure.ts`; the shifts in `structure.ts`): rows and cells, every sheet's formulas (shared groups unshared when they name the sheet; array and data-table ranges), dimension, frozen pane and selections, column spans, merges, the autofilter and sort state, the existing validation and conditional-format blocks and their x14 twins (`restructureRuleBlocks`, its own function — W-57's whole-block options compose after it), hyperlinks, protected ranges, ignored errors, watches, page breaks, tables, drawing anchors, notes and VML, threaded comments, chart series, defined names; calcChain dropped, `fullCalcOnLoad`. Refused (SP-2016): a pivot or its source moved; an array formula, data table or table cut. Properties: insert then delete leaves **every part** byte for byte; `restructureWorkbook(read(f), ops)` reads the same as `read(patchXlsx(f, [], { structure: ops }))` |
| 5 · ui | menus, shortcuts, refusal codes in `docs/ERRORS.md`; CSV supports rows and columns (no other parts) | ✅ the cell menu and ⋯ menu: Insert row above / below, column left / right, Delete row / column (counts for a range); the header menu: its axis's three; a refused item greyed with its reason as the tooltip. Ctrl/⌘+Shift+= inserts (rows above; columns left for whole columns), Ctrl/⌘+− deletes whole rows or columns and otherwise asks for them. Edit only. SP-3022 (merge cut), SP-3023 (pivot moved), SP-3024 (cells off the sheet), SP-3025 (table cut, once W-61 reads tables) and SP-2016 in `docs/ERRORS.md`. W-47 sizes, W-49 reveals and W-56 highlights follow their rows. A CSV inserts and deletes rows and columns |
| 6 · real files | a workbook saved by Excel with every part above opens in Excel after a shift (decider's check, like W-30) | → W-30 (its DoD 8, the decider's) |
| 7 · tests · docs | store, export, browser, axe; skills `sheetpane-events`, `sheetpane-plugin-author`; CHANGELOG | ✅ export `structure.test.ts` (9) and `restructure.test.ts` (19); import `shift.test.ts` (7); grid `structure.test.ts` (9) and `structure-ui.test.ts` (6, axe); formulas (2), charts, validation, comments (1 each); SR-EXPORT 11, SR-IMPORT 14, SR-GRID 3, 6, 7, 17, 21d, SR-FORMULAS 4, SR-CHARTS 8, SR-CODES, SR-VALIDATION, SR-COMMENTS, SR-SKILLS, SR-MCP (a golden); both skills; the grid README; CHANGELOG |

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
