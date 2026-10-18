---
type: Handoff
name: W-31
description: "Arpit tried the grid on 2026-10-18: the floating selection bar hides text on every click, and Export plus Download-the-original are two ways to one file. This item docks the actions in the cell bar and leaves one Download button."
item: W-31
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-31 — Dock the selection actions in the cell bar, and keep one Download button

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Remove the floating selection bar; put Flag issue, plugin buttons and a ⋯ menu (Copy ref, Copy value) at the right end of the cell bar | nothing ever covers the cells | ⏳ |
| 2 | Right-click, Shift+F10 or the Menu key on a cell opens the same actions just under it | the actions are where the pointer already is | ⏳ |
| 3 | Replace Export and Download-the-original with one Download button, in View and Edit | one way to get the file | ⏳ |
| 4 | Rewrite SR-GRID decisions 10 and 13 and the plugins verdict's `selbar` row in the same change | the spec says what ships | ⏳ |

**Arpit, 2026-10-18:** *"Whenever we click on a cell, there is always this bar, flag issue, copy ref, copy value. It's a bit annoying and it hides the text behind it. Is there an other way to display it? Then there are two ways to download the Excel or export the Excel. It should only be one, not two of them."*

**Model:** Sonnet — a layout move and a menu inside one element; the design is drawn.

## Goal

The selection actions stop floating over the grid: they live in a fixed place (the cell bar's right end) and on right-click. The toolbar has a single Download button whose result depends on whether anything changed. Drawn on the boards [`Selection-And-Download`](../reference/design/boards/Selection-And-Download.dc.html) and [`Sheetpane`](../reference/design/boards/Sheetpane.dc.html) (interactive).

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · no floating bar | the `.selbar` element and its CSS are gone; clicking or arrowing to a cell never draws anything over the grid except pins, the callout and an open menu | ⏳ |
| 2 · docked | at the right end of the cell bar, in this order: **Flag issue** with its `F` hint (Edit, a data cell with no error on it) · the `selbar` plugin controls (Edit) · **⋯** (View and Edit) opening Copy ref and Copy value; the group hides while the cell-bar draft is being edited and while composing | ⏳ |
| 3 · context menu | right-click, Shift+F10 and the Menu key on a cell select it and open a `role="menu"` just under it: Flag issue (Edit) · Copy ref · Copy value · then the `selbar` plugin controls as items; arrows move, Enter runs, Esc closes and returns focus to the grid; the browser's own menu is suppressed only on cells | ⏳ |
| 4 · slot | `selbar` keeps its id (no API break); a `selbar` descriptor renders as a button in the docked group and as an item in the context menu; at narrow widths plugin buttons fold into ⋯ before Flag issue moves | ⏳ |
| 5 · one download | one toolbar button, **Download .xlsx** (**Download .csv** for a CSV), in View and Edit: no changes → the original bytes, untouched; changes → `export()` with them, the change count on the button and in its tooltip; the download-original button and its code path removed; the events of SR-GRID decision 9 keep their names | ⏳ |
| 6 · a11y | every control a labelled button; tooltips name F, Ctrl/⌘+C and Shift+F10 | ⏳ |
| 7 · tests | after a click no `.selbar` exists; docked order in View and Edit; the context menu by mouse and by keyboard; one download control in both modes; unchanged workbook → byte-identical download | ⏳ |
| 8 · record | SR-GRID decisions 10 and 13 rewritten; `work/compare/plugins.compare.md` slot table row `selbar` reads "docked in the cell bar, and on right-click"; CHANGELOG notes the removed button | ⏳ |

## Blockers

None.

## Record affected

SR-GRID (`records/0105_GRID.md`) decisions 10 and 13.

## Hazards

- **A second session builds W-19 in `packages/condfmt/` and `examples/`.** This item touches `packages/grid/src/excel/`; re-derive `git status` before staging.
- **Clipboard** needs a secure context; Copy ref / Copy value fail quietly and say so in the status line when it is missing.
- **Right-click is the host's too.** Suppress the browser menu on grid cells only, never on the toolbar, the cell bar or the host page.

## Reference

- Design: [`../reference/design/boards/Selection-And-Download.dc.html`](../reference/design/boards/Selection-And-Download.dc.html) — before and after; [`Sheetpane.dc.html`](../reference/design/boards/Sheetpane.dc.html) — try it (right-click a cell, the ⋯ button, Download)
- [`../../records/0105_GRID.md`](../../records/0105_GRID.md) decisions 9, 10, 13
- [`../compare/plugins.compare.md`](../compare/plugins.compare.md) — the `selbar` slot
- [`../reference/specs/a11y/apg-toolbar-pattern.html`](../reference/specs/a11y/apg-toolbar-pattern.html)

## Prompt — paste into Claude Code

```text
You are building W-31 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, records/0105_GRID.md (decisions 9, 10, 13),
   packages/grid/src/excel/element.ts and this file (work/open/W-31-docked-actions-one-download.md).
   Open work/reference/design/boards/Selection-And-Download.dc.html for the target.
2. Plan the change to the toolbar, the cell bar and the selection rendering before writing code.
3. Implement in packages/grid/src/excel/ (element.ts, styles.ts); keep the selbar slot id.
4. Verify: just check; every DoD row above. Then do what SR-WORK-DOCS
   decision 10 says every task owes.
```
