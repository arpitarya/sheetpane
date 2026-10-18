---
type: Handoff
name: W-23
description: "Arpit's plugin decision of 2026-10-18 needs undo before any formatting control ships; B-027 is promoted into this item."
item: W-23
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-fable-5-1)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-fable-5-1)"
ball: agent
---

# W-23 — Build undo / redo for every change in the workbook (B-027 promoted)

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | A history stack on the `WorkbookStore`: every mutator records an inverse | Ctrl+Z / Ctrl+Y across values, styles, formats, merges, errors | ⏳ |
| 2 | One history per `pane`, so both elements undo the same thing | L7 holds for history too | ⏳ |
| 3 | Expose `undo()`, `redo()`, `canUndo`, `canRedo` and the toolbar buttons | a slip on 400 cells is one keystroke away from gone | ⏳ |

**Arpit, 2026-10-18:** *"Let's create separate packages, plugins for number format, formulas, styles. Merge cells, freeze panes, data validation, conditional formatting, images, charts, pivots, comments, notes. Decide, do some research and have them as separate packages or plugins."*

**Model:** Sonnet — a command stack over the store's mutators; the contract verdict already names what a change is.

## Goal

Undo and redo over the one in-memory workbook. The contract verdict parked it (B-027); the plugins verdict promotes it, because a format row without undo is dangerous. Every mutator — cell edit, style, number format, merge, freeze, error add / resolve / delete — records an inverse on one stack per `pane`.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · stack | a command stack on the store: `{ do, undo, kind, refs }`; coalescing for typing in one cell; a cap of 500 entries | ⏳ |
| 2 · scope | every change kind of the plugin host (W-14 DoD 4) and every error mutation; a plugin's `run` goes through the store, so it is covered without plugin code | ⏳ |
| 3 · sync | one stack per `pane`; undo from the errors pane reverts a cell edit made in the sheet, and the reverse | ⏳ |
| 4 · ui | toolbar Undo / Redo with `canUndo` / `canRedo`; Ctrl/Cmd+Z, Ctrl+Y and Cmd+Shift+Z; the cell's "Changed · was X" and Revert still work and are themselves undoable | ⏳ |
| 5 · derived | undo of a change re-runs `derive` so recalculated cells follow; derived cells are never undo entries themselves | ⏳ |
| 6 · tests | property test: any sequence of mutations then the same number of undos returns the snapshot; redo after undo; the cap | ⏳ |
| 7 · record | the contract verdict's decision 9 is rewritten; W-01's component record gains the stack; B-027 left the backlog when this item was filed (2026-10-18) | ⏳ |

## Blockers

Waiting on **W-01** (the store and its mutators).

## Record affected

W-01's component record (or SR-LAW-7's owning record) gains undo; the contract verdict's decision 9 is rewritten when this lands.

## Hazards

- **Error ids are never reused** (contract verdict): undoing an add keeps the id reserved; redo restores the same id.
- **`setErrors()` from the host** is not a user action and clears the stack, with a `sheetpane-history` event.

## Reference

- [`../compare/workbook-and-error-contract.compare.md`](../compare/workbook-and-error-contract.compare.md) decision 9 — the parked ruling
- [`../compare/plugins.compare.md`](../compare/plugins.compare.md) decision 9
- [W-01](W-01-sheetpane-excel.md) · [W-14](W-14-plugin-host.md)

## Prompt — paste into Claude Code once the blockers close

```text
You are building W-23 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, docs/ARCHITECTURE.md,
   work/compare/plugins.compare.md and this file (work/open/W-23-undo-redo.md).
2. Plan the modules and the fixture list in this file's body before writing code.
3. Implement. Implement the stack as a pure module over the store's mutators; the property test is the acceptance test.
4. Verify: just check; every DoD row above. Then do what SR-WORK-DOCS
   decision 10 says every task owes.
```
