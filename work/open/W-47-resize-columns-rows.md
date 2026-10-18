---
type: Handoff
name: W-47
description: "Arpit, 2026-10-18: make columns wider and rows taller. Drag a header edge with a guide and a size tip, double-click to fit, resize several at once, a menu route for the keyboard, and per-row heights honouring the file's heights and wrapped text. Sizes are a view setting, like zoom."
item: W-47
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-47 — Resize columns and rows: drag a header edge, double-click to fit, several at once

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Drag the edge of a column header or a row header, with a guide line and the size shown while you drag | cut-off text can be read | ⬜ |
| 2 | Double-click that edge to fit the column to its widest text, or the row to its tallest wrapped text | one gesture, no guessing | ⬜ |
| 3 | Select several columns or rows (W-46) and resize them together | the same gesture works on many | ⬜ |
| 4 | Right-click a header (or Shift+F10): Fit to data · Column width… · Reset | a keyboard route, and a way back | ⬜ |
| 5 | Give rows their own heights, honouring the file's row heights and wrapped text | a taller row shows more | ⬜ |
| 6 | Sizes are a view setting, like zoom: not a change and not in the download; the host can save and restore them | resizing never makes a file "changed" | ⬜ |
| 7 | Rewrite SR-GRID decision 11 in the same change | the spec says what ships | ⬜ |

**Arpit, 2026-10-18:** *"Can we increase the height and width of columns and rows? File a work item for this. Research and then file it with the best user experience."*

**Model:** Opus. Per-row heights change the geometry under the virtualiser, and the scroll budget has to be re-measured.

## Today

This is what the code does, read on 2026-10-18:

- **Column widths are fixed.** They come from the file (`charsToPx`), or from a guess over a CSV's first 200 rows. Nothing changes them afterwards.
- **Every row is 28 px.** `ROW_H` is fixed, and it is exported from `@sheetpane/grid`.
- **File row heights and wrapping are ignored.** `@sheetpane/import` reads `rowHeights` (`customHeight`) and `wrapText`, but the grid uses neither: every cell is `white-space: nowrap`.
- **Fixed row height is a closed decision.** It is [grid-rendering](../compare/grid-rendering.compare.md) decision 1 ("row height is fixed per sheet"). **Arpit's ask on 2026-10-18 supersedes it** for per-row heights. That decision's 16 ms scroll budget (decision 5) stays the test.

## What the best grids do (research, 2026-10-18)

| source | what we take |
|---|---|
| Excel | **Gestures:** drag a header border, with the tip *"Width: 15.00 (110 pixels)"*; double-click a border to autofit. **Several at once:** with several columns or rows selected, one drag or double-click applies to all ([TechRepublic](https://www.techrepublic.com/article/best-shortcuts-rows-columns-excel/)). **Dialogs:** Format › Column Width / Row Height for an exact size. **Autofit:** ignores merged cells. |
| Google Sheets | Drag a border; double-click it to fit. Right-click › *Resize columns…* offers an exact size or *Fit to data*. |
| [MUI X Data Grid](https://mui.com/x/react-data-grid/column-dimensions/) | **Handle:** a separator on the header edge, with a `minWidth` floor (50 px by default). **Autosize:** double-click autosizes, with options to include the header and to ignore outliers. **Events:** one fires during the drag (`onColumnResize`) and another after it (`onColumnWidthChange`). |
| [MESCIUS keyboard resizing](https://developer.mescius.com/blogs/how-to-resize-javascript-datagrid-columns-using-your-keyboard) | **Keyboard:** + and − on a focused header resize the column. **Shortcuts:** listed in one help place rather than announced on every header. **Fit all:** an *AutoSize all columns* action. |
| [APG grid pattern](../reference/specs/a11y/apg-grid-pattern.html) | Headers are not focusable under `aria-activedescendant`, so the keyboard route here is a menu, not a focusable separator. |

## Decisions taken in this item

1. **A view setting, in View and Edit.** A size is not a change: the change count means data, and an untouched file still downloads as its original bytes (SR-GRID decision 13). View users need to read cut-off text too. **Alternative:** in Edit, a change kind `size` exported as `<col customWidth>` and `<row customHeight>`. **Reopen** if a host or a reviewer asks for sizes in the download.
2. **Not undoable,** because it is not a change. Esc cancels a drag, and *Reset* in the header menu restores the file's size.
3. **The keyboard route is a menu, not a new global shortcut.** Alt+Shift+arrows mean *group* in Sheets, and headers are not focusable (APG, above).

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · drag | **Hit zone:** 8 px, centred on each column header's right edge and each row header's bottom edge; `col-resize` / `row-resize` cursor, with a 2 px accent line on hover. **While dragging:** a guide line across the grid and a tip, *"Width 120 px"* or *"Height 40 px"*. The size updates live, once per frame, and pointer capture keeps the drag going past the grid's edge. **Ending:** release commits; Esc cancels. **Limits:** columns 16–1,200 px, rows 12–600 px, stored at 100 % and scaled by zoom. **Frozen panes:** frozen columns and rows resize and the pane follows. **Clicks:** a click on the edge with no movement selects nothing. | ⬜ |
| 2 · fit | **Column:** double-click fits the widest display text in the column, in each cell's own size and weight, padding included. It is measured with canvas `measureText` over every row up to 20,000; past that, the first 20,000 plus the rendered rows. **Limits:** at least the default width, at most 480 px; merged cells are ignored, as in Excel. **Row:** fits the tallest wrapped text at the current column widths, at least 28 px. | ⬜ |
| 3 · several | **Selected headers:** when the edge belongs to a whole-column selection (W-46), a drag sets every selected column to the new width and a double-click fits each one; rows work the same way. **Touch (coarse pointer):** a selected header shows a visible 24 px grip at its edge. | ⬜ |
| 4 · menu | **Opening it:** right-click a column or row header, or press Shift+F10 / the Menu key with a whole column or row selected. **Items:** a `role="menu"` with *Fit to data*, *Column width…* (or *Row height…*) and *Reset to the file's size*. **Exact size:** *Column width…* opens a small popover with a px number field: arrows ±1, Shift+arrows ±10, Enter applies to every selected column, Esc cancels. **Help:** listed in the keyboard help. | ⬜ |
| 5 · rows | **Geometry:** row tops become a prefix array, with `rowAt` as a binary search; the virtualiser, find, PageUp/PageDown, frozen rows and W-46's selection layer use it. **File heights:** the file's `customHeight` rows are drawn (points × 96 / 72). **Wrapping:** cells styled `wrapText` wrap and are clipped by their row. **Alignment:** vertical alignment comes from the file, else centred. **Overlays:** pictures, charts and pins follow through `Geometry.rowY` / `rowHeight`. | ⬜ |
| 6 · view setting | **Where sizes live:** per element and per sheet, in memory (L9). They are not counted, not undone and not in the download, and a new file resets them. **For hosts:** `el.sizes` (get and set: `{ [sheet]: { cols: { B: 120 }, rows: { 4: 40 } } }`, px at 100 %) and `sheetpane-resize` (detail `{ sheet, axis, indexes, px, via: 'drag' \| 'fit' \| 'menu' \| 'reset' }`, fired on release, not during the drag) let a host save and restore them. | ⬜ |
| 7 · speed | On the 250,000-row fixture, a column-edge drag gives no frame over 16 ms. The 5 s wheel scroll (grid-rendering decision 5) is re-measured with per-row heights. Both are recorded here with the machine named. | ⬜ |
| 8 · a11y | **Announcement:** on release, a polite live region says *"Column C, 120 pixels"*. **Menu:** every item and the popover's field are labelled. **No mouse needed:** every size is reachable without a pointer. | ⬜ |
| 9 · tests | **Drag:** live size, Esc cancel, the limits. **Fit:** long text, numbers, bold, and a merge ignored. **Several and keyboard:** several columns at once, and the menu and popover by keyboard. **Rows:** file row heights and wrapping drawn. **`rowAt`:** with mixed heights, a fast-check property against a linear scan. **Hosts:** overlays follow, the `sizes` round-trip and the event detail. **Download:** unchanged after a resize. | ⬜ |
| 10 · record | **SR-GRID:** decision 11 (widths from the file, then the user's; per-row heights; wrapping), decision 9 (`sizes` and `sheetpane-resize`) and decision 12 (keyboard help). **Compare doc:** [grid-rendering](../compare/grid-rendering.compare.md) decision 1 marked superseded by SR-GRID, with the date. **Also:** the grid README and the CHANGELOG. | ⬜ |

## Blockers

**Waiting on W-46** for whole-column and whole-row selection (DoD 3 and 4). DoD 1, 2 and 5 do not need it.

## Out of scope

- **Hidden rows and columns.** The import reads `hiddenRows` and `hiddenCols`, but the grid shows them. Hiding them, with Excel's double-line marker to drag them open, is a separate item if wanted.
- **Sizes in the download** (decision 1's alternative).
- **Text rotation and shrink-to-fit.**

## Record affected

**[SR-GRID](../../records/0105_GRID.md)** decisions 9, 11 and 12, plus [`work/compare/grid-rendering.compare.md`](../compare/grid-rendering.compare.md) decision 1 (superseded).

## Hazards

- **`ROW_H` is assumed in about ten places** (`geometry.ts`, `element.ts`), and it is a public export from `index.ts`. Keep the export as the default height; never remove it.
- **The scroll budget.** A prefix array over 250,000 rows is 2 MB, which is fine, but measure it.
- **Header hit zones.** The 8 px edge must not swallow W-46's click-to-select-column.
- **Concurrent sessions** edit this repo; re-derive `git status` before staging.

## Reference

- [`../../packages/grid/src/excel/geometry.ts`](../../packages/grid/src/excel/geometry.ts): `sheetGeometry`, `colAt`, `ROW_H`.
- [`../../packages/grid/src/plugins/types.ts`](../../packages/grid/src/plugins/types.ts): `Geometry`, which already has `rowY` and `rowHeight`.
- [`../../packages/import/src/xlsx.ts`](../../packages/import/src/xlsx.ts): `rowHeights`, `customHeight`.
- W-46: whole-column and whole-row selection.

## Prompt — paste into Claude Code

```text
You are building W-47 in the sheetpane monorepo. W-46 (range selection) must be closed first.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, records/0105_GRID.md (decisions 9, 11, 12),
   work/compare/grid-rendering.compare.md, packages/grid/src/excel/geometry.ts,
   packages/grid/src/excel/element.ts and this file. Grep every use of ROW_H.
2. Plan per-row geometry first (prefix array, rowAt) and measure the scroll before and after.
3. Implement the header edges, fit, the menu and popover, sizes and the event in packages/grid/src/excel/.
4. Verify: just check; every DoD row above; both measurements written here with the machine named.
   Then do what SR-WORK-DOCS decision 10 says every task owes.
```
