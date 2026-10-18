---
type: Handoff
name: W-24
description: "Arpit's plugin decision of 2026-10-18 put freeze panes in core, not a plugin; this item adds them across import, grid and export."
item: W-24
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-fable-5-1)"
updated: 2026-10-18
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-24 — Freeze panes in core: read, render sticky rows and columns, toggle, export

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Read `<sheetView><pane>` per sheet | which rows and columns the author froze | ✅ |
| 2 | Keep frozen rows and columns pinned while the rest scrolls | headers stay visible on a 250,000-row file | ✅ |
| 3 | Freeze / Unfreeze at the selection in Edit; write `<pane>` on export | a reviewer can pin a header the author forgot | ✅ |

**Arpit, 2026-10-18:** *"Let's create separate packages, plugins for number format, formulas, styles. Merge cells, freeze panes, data validation, conditional formatting, images, charts, pivots, comments, notes. Decide, do some research and have them as separate packages or plugins."*

**Model:** Sonnet — a sheet-view property through three packages; the virtualiser change is the only delicate part.

## Goal

Freeze panes as part of the core grid. It is view state, not formatting, and the virtualiser must know about it, so it cannot be a plugin (plugins verdict). Three packages change: the reader exposes it, the grid renders and toggles it, export writes it.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · read | `@sheetpane/import` exposes `freeze: { rows, cols }` per sheet from `<pane xSplit ySplit topLeftCell state="frozen">`; `split` state is read as unfrozen | ✅ `freeze: { rows, cols }` per sheet from `<pane state="frozen">` (and `frozenSplit`); a `split` pane reads as unfrozen — `exceljs-freeze.xlsx` test |
| 2 · render | frozen rows and columns stay fixed in the four-quadrant layout; virtualisation applies to the scrolling quadrant only; merged cells crossing the freeze line render once; the 16 ms budget holds on the 250,000-row fixture with two frozen rows | ✅ frozen rows and columns are sticky quadrants; only the scrolling quadrant is virtualised; merges render once; 250,000 rows with two frozen rows: 301 frames in 5 s, 0 dropped (headless Chromium, Arpit's MacBook) — tests |
| 3 · toggle | Freeze at selection / Unfreeze in the toolbar in Edit, a change of kind `freeze` with its own undo entry; not a `format-row` control (the no-plugin guardrail) | ✅ Freeze / Unfreeze in the Edit toolbar (rows above and columns left of the selection), a change of kind `freeze` with its own undo entry; not a format-row control — test |
| 4 · export | `patchXlsx` and `toXlsx` write `<pane>` for a changed freeze; an unchanged one is untouched | ✅ `patchXlsx(…, { freeze })` and `toXlsx` (`Sheet.freeze`) write `<pane>` with `topLeftCell`; other sheets byte for byte; `0, 0` removes it; ExcelJS reads it back frozen — tests |
| 5 · a11y | the APG grid model is unchanged: arrow keys move through frozen and scrolling cells as one grid | ✅ one grid: arrows move from a scrolling cell into the frozen row and column — test |
| 6 · tests | fixtures with row-only, column-only and both freezes from Excel; the render test in the browser engine; the round-trip | ✅ row-only, column-only, both and split freezes (ExcelJS), the render test, the round-trip; **the same from Excel moved to W-30** (its DoD 3 now checks freezes) |
| 7 · record | W-01's component record gains freeze; W-13's and W-03's records gain the property | ✅ [SR-GRID](../../records/0105_GRID.md) decision 21; [SR-IMPORT](../../records/0104_IMPORT.md) decision 2 (`freeze`); [SR-EXPORT](../../records/0103_EXPORT.md) decisions 1 and 3 |
## Blockers

None. Excel-saved freezes are W-30.

## Record affected

**[SR-GRID](../../records/0105_GRID.md)** decision 21, SR-IMPORT and SR-EXPORT.

## Hazards

- **Four quadrants multiply the DOM.** Keep one virtualiser with two offsets, not four grids.
- **`topLeftCell`** must be written as well as `xSplit`/`ySplit`, or Excel ignores the pane.

## Reference

- Design: [`../reference/design/boards/Core-FreezePanes.dc.html`](../reference/design/boards/Core-FreezePanes.dc.html) — Freeze ▾ in Edit, the 2 px dividers, scrolled with headers held, View without the menu
- [`../compare/plugins.compare.md`](../compare/plugins.compare.md) — freeze panes row
- [`../compare/grid-rendering.compare.md`](../compare/grid-rendering.compare.md) — the virtualiser
- [W-01](W-01-sheetpane-excel.md) · W-13 (closed — [SR-IMPORT](../../records/0104_IMPORT.md)) · W-03 (closed — [SR-EXPORT](../../records/0103_EXPORT.md))

## Prompt — paste into Claude Code once the blockers close

```text
You are building W-24 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, docs/ARCHITECTURE.md,
   work/compare/plugins.compare.md and this file (work/open/W-24-freeze-panes.md).
2. Plan the modules and the fixture list in this file's body before writing code.
3. Implement. Change the virtualiser last; land read and export first with the fixture round-trip.
4. Verify: just check; every DoD row above. Then do what SR-WORK-DOCS
   decision 10 says every task owes.
```
