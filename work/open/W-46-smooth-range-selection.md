---
type: Handoff
name: W-46
description: "Arpit, 2026-10-18: selecting several cells should feel smooth. One selection layer instead of a re-render per pointer move, a drag that follows the pointer and autoscrolls, whole rows and columns, Excel's keys, and copy, delete and totals over the range."
item: W-46
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-46 — Make range selection smooth: one selection layer, a drag that follows the pointer, whole rows and columns, range copy

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Draw the selection as one box over the cells (a soft fill and one border) instead of re-drawing every cell on each pointer move | dragging stays smooth on big sheets, and the range reads as one shape | ⬜ |
| 2 | Keep the drag going outside the grid, and scroll when the pointer reaches an edge | you can select more than is on screen | ⬜ |
| 3 | Click a column header, row header or the corner to select it whole; drag or Shift-click headers for several | Excel's gestures work | ⬜ |
| 4 | Add the missing keys: Ctrl+Shift+arrows, Ctrl+Space, Shift+Space, Ctrl+A | big ranges without the mouse | ⬜ |
| 5 | Copy, Delete and paste act on the whole range | the selection does something, not just shows | ⬜ |
| 6 | Show Count · Sum · Average of the selected numbers in the status line | a reviewer checks a total without a formula | ⬜ |
| 7 | Rewrite SR-GRID decisions 9, 11a, 12 and 13 in the same change | the spec says what ships | ⬜ |

**Arpit, 2026-10-18:** *"Can there be a smoother selection of multiple cells? File a work item for this. … Research and then file it with the best user experience."*

**Model:** Opus. It changes the render path that the scroll budget is measured on (grid-rendering decision 5).

## Why it is not smooth today

This is what the code does, read from `packages/grid/src/excel/element.ts` on 2026-10-18:

- **Every pointer move redraws the grid.** Each move onto a new cell calls `store.select`. That rebuilds the visible window with `q.rows.innerHTML = body`, about 60 rows × every rendered column. The errors panel is re-rendered too, because selection is shared (L7).
- **The range is drawn cell by cell.** It is a 60 % `.inrange::before` tint on each cell. Gridlines cut through it, there is no border round the range, and the active cell looks the same as a single selection.
- **The drag is tied to the scroller.** It uses `mousedown` and `mousemove` on the scroller. Leaving the grid or reaching its edge stops the drag, nothing autoscrolls, and touch and pen do nothing.
- **Missing gestures and keys.** There is no header or corner selection. Ctrl+Space, Shift+Space, Ctrl+A and Ctrl+arrow / Ctrl+Shift+arrow are not handled.
- **Only the active cell is acted on.** Ctrl/⌘+C copies only the active cell's value, and Delete clears only the active cell.

## What the best grids do (research, 2026-10-18)

| source | what we take |
|---|---|
| Excel | Drag, Shift+click, header and corner clicks. Ctrl+Space selects the column and Shift+Space the row. Ctrl+Shift+arrow extends to the edge of the data. The name box shows `6R x 3C` while dragging. Sum, Average and Count appear in the status bar. One border goes round the range, and the active cell is left unfilled. A range that crosses a merge grows to cover it. |
| Google Sheets | The same gestures, plus round handles to extend a selection on touch. Copy pastes back as a grid into Excel and Sheets because it writes both TSV and HTML. |
| [APG grid pattern](../reference/specs/a11y/apg-grid-pattern.html) | Ctrl+Space selects the column, Shift+Space the row, Ctrl+A everything, and Shift+arrows extend. Selected cells carry `aria-selected="true"`. `aria-multiselectable` is already set. |
| [Glide Data Grid](https://docs.grid.glideapps.com/api/dataeditor/selection-handling) | The selection is a focus ring plus highlight regions painted as one layer, not as per-cell state. Rows and columns are selected separately from ranges. Several ranges are an opt-in mode. |
| [AG Grid fill handle](https://www.ag-grid.com/react-data-grid/cell-selection-fill-handle.md) | The fill handle is an opt-in feature layered on range selection, not part of it. That is why it is out of scope here. |

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · one layer | **Layer:** the selection is drawn by one overlay layer in sheet space. **Fill:** `--sp-accent-soft` over the range. **Active cell:** left unfilled, with a 2 px `--sp-accent` ring. **Border:** one 2 px accent border round the range. **Headers:** the headers of selected rows and columns are tinted, with an accent edge, so colour is never the only cue. **Frozen panes:** the layer splits correctly across them. **Stacking:** it sits above cell fills and conditional fills, and below pins, marks and pictures (W-20). **Removed:** the per-cell `.inrange` class. | ⬜ |
| 2 · no re-render | A selection change re-creates no `.c` node. Only the layer, the header tints, `aria-selected` on rendered cells, the cell bar and the status line change. Pointer moves are coalesced to one update per frame. The store is told at most once per frame during a drag and once on release. | ⬜ |
| 3 · pointer | **Events:** Pointer Events with `setPointerCapture`, so the drag survives leaving the grid and the window. **Autoscroll:** within 24 px of an edge, or past it, the grid scrolls, faster the further out. Frozen and scrolling panes act as one grid. **Merges:** a range that partly covers a merge grows to cover it. **Clicks stay clicks:** a press on a pin or mark, and a right-click, are not drags. **Touch:** a pan scrolls, a tap selects, and a selected range shows two round handles (top-left and bottom-right, 24 px hit area) to extend it. | ⬜ |
| 4 · headers | **Whole selections:** a click on a column header selects the column, a row header the row, and the corner the sheet. **Several:** dragging across headers or Shift+clicking extends the selection. **Active cell:** stays at the first visible cell of the range. **Copy ref:** gives `B:D`, `4:12`, or the sheet's name. | ⬜ |
| 5 · keys | **Jump:** Ctrl/⌘+arrow jumps to the edge of the data region; with Shift it extends there. **Rows and columns:** Ctrl+Space selects the column, Shift+Space the row. **Select all:** Ctrl/⌘+A selects the data region; a second press selects the sheet. **Collapse:** Shift+Backspace collapses to the active cell. **Inside a range:** Enter, Shift+Enter, Tab and Shift+Tab move the active cell within the range and wrap, as in Excel. **Cancel:** Esc during a drag restores the selection from before it. **Help:** every key is listed in the keyboard help. | ⬜ |
| 6 · copy | **Content:** Ctrl/⌘+C on a range writes `text/plain` TSV (display text, `\t` and `\n`) and a `text/html` `<table>`, so Excel and Sheets paste it as a grid. **Copied outline:** the copied range gets a dashed outline until Esc, an edit or the next copy. **Menu:** in the ⋯ and right-click menus, "Copy value" reads "Copy values" for a range. **Limit:** over 1,000,000 cells nothing is copied, and the status line says why. | ⬜ |
| 7 · range edits (Edit) | **Delete:** Delete or Backspace clears every cell in the range. Each cell goes through `sheetpane-beforechange`, refused cells are skipped, and the whole clear is one undo step (`store.setCells`). **Paste:** one value pasted over a range fills every cell; a block still pastes from the active cell, as today. | ⬜ |
| 8 · totals | **What shows:** with two or more cells selected, the status line shows `Count n · Sum x · Average y` over the numeric cells; Count is the non-empty cells, and only Count shows when no cell is a number. **Format:** the active cell's number format when numfmt is installed, else locale grouping. **When:** computed after the selection settles, never per frame. | ⬜ |
| 9 · a11y and sync | **aria-selected:** rendered cells in the range carry `aria-selected="true"`. **Announcement:** a polite live region says *"B3 to D8, 18 cells"* once when a drag or a key extension settles. **Cell bar:** shows `B3:D8`, and `6R × 3C` while dragging. **Event:** the `sheetpane-select` detail gains `range`. **Errors panel (L7):** it follows the settled selection, not every frame. | ⬜ |
| 10 · speed | On the 250,000-row fixture, dragging from A1 down past the bottom edge with autoscroll for 5 s gives no frame over 16 ms. Same method as grid-rendering decision 5, with the machine named in this file. | ⬜ |
| 11 · tests | **Layer geometry:** single cell, range, frozen split, and a merge growing the range. **No re-render:** a MutationObserver sees no `.c` node re-created on a selection change. **Autoscroll:** a synthetic pointer past the edge scrolls. **Gestures and keys:** header and corner clicks, each key, the copied TSV and HTML, a range Delete as one undo step, the totals and `aria-selected`. **axe:** on View and Edit with a range. | ⬜ |
| 12 · record | **SR-GRID:** decisions 9 (select detail), 11a (paste over a range), 12 (keys) and 13 (copy values), plus Consequences. **Also:** the grid README and the CHANGELOG. | ⬜ |

## Blockers

None.

## Out of scope

- **Several separate ranges (Ctrl/⌘+click).** `Selection` holds one range. This is a later item if wanted.
- **A fill handle (drag to fill a series).** SR-GRID decision 11a says there is no fill gesture yet.

## Record affected

**[SR-GRID](../../records/0105_GRID.md)** decisions 9, 11a, 12 and 13.

## Hazards

- **The scroll budget.** The layer must not add work to scrolling; measure it, don't assume it.
- **Shared selection (L7).** A per-frame store update must not make the errors panel re-render per frame.
- **Plugins.** `decorate` and the `cell` slot still render inside cells; the selection layer must not cover their controls (the `.mk` hit test).
- **Concurrent sessions** edit this repo; re-derive `git status` before staging.

## Reference

- [`../../packages/grid/src/excel/element.ts`](../../packages/grid/src/excel/element.ts): `onPointer`, `selectCell`, `move`, `onKey`, and the render that sets `.inrange`.
- [`../../packages/grid/src/pane/types.ts`](../../packages/grid/src/pane/types.ts): `Selection`.
- [`../reference/specs/a11y/apg-grid-pattern.html`](../reference/specs/a11y/apg-grid-pattern.html): the selection keys and `aria-selected`.
- [`../compare/grid-rendering.compare.md`](../compare/grid-rendering.compare.md): decision 5, the 16 ms budget.
- W-47: resizing uses this item's whole-column and whole-row selection.

## Prompt — paste into Claude Code

```text
You are building W-46 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, records/0105_GRID.md (decisions 9, 11, 11a, 12, 13),
   packages/grid/src/excel/element.ts (onPointer, selectCell, move, onKey, the render),
   packages/grid/src/excel/geometry.ts and this file.
2. Plan the selection layer and the fast path for a selection change before writing code.
   Measure the current drag on the 250,000-row fixture first, so the gain is a number.
3. Implement in packages/grid/src/excel/ (element.ts, styles.ts, a new selection module if it keeps element.ts readable).
4. Verify: just check; every DoD row above; the 16 ms measurement written in this file with the machine named.
   Then do what SR-WORK-DOCS decision 10 says every task owes.
```
