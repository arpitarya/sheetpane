---
type: Handoff
name: W-14
description: "Arpit asked on 2026-10-18 for the spreadsheet features to ship as separate plugin packages; this item is the core that every plugin registers against."
item: W-14
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-fable-5-1)"
updated: 2026-10-18
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-14 — Build the plugin host in `@sheetpane/grid`: six hooks, six slots, the `plugins` attribute

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Add `plugins` to `createWorkbook()` and a `plugins` attribute to both elements | one way to switch a plugin on, in code or in HTML | ✅ |
| 2 | Expose the six hooks on the store: `format`, `decorate`, `derive`, `validate`, `overlay`, `exportPatch` | a plugin changes what a cell shows, computes, flags or exports | ✅ |
| 3 | Draw the six slots — `format-row`, `selbar`, `cellbar`, `status`, `cell`, `overlay` — from control descriptors | a plugin adds buttons the grid styles, labels and keyboard-wires once | ✅ |
| 4 | Give the change map a `kind`; make Revert, the count and the label read it | style and format edits are changes too (L6) | ✅ |
| 5 | Test every hook with a fake plugin; prove the no-plugin grid is byte-identical | the guardrail: core never grows a formatting control | ✅ |

**Arpit, 2026-10-18:** *"Let's create separate packages, plugins for number format, formulas, styles. Merge cells, freeze panes, data validation, conditional formatting, images, charts, pivots, comments, notes. Decide, do some research and have them as separate packages or plugins."*

**Model:** Opus — the hook contract is the surface every later item builds on; a wrong shape here is paid for eight times.

## Goal

The part of `@sheetpane/grid` that makes a plugin possible. Everything a plugin may touch goes through a named hook on the `WorkbookStore` of the contract verdict; everything a plugin may show goes through a named slot the grid draws. The design — hooks, slots, descriptor shape, registration rules — is decisions 2–7 of [`../compare/plugins.compare.md`](../compare/plugins.compare.md); this item builds it and cites it rather than restating it.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · hooks | the six hooks exist on the store with the signatures the verdict names; single-provider hooks throw on a second provider; `decorate` is ordered by `after`; a `decorate` result naming `font-family` throws (L5) | ✅ the six hooks with the verdict's signatures; `format` and `derive` single-provider (a second throws, naming both); `decorate` ordered by `after`; a `font-family` result throws — `plugins.test.ts` |
| 2 · register | `createWorkbook({ plugins })`; the `plugins` attribute lists ids; a package registers its id on import; only listed plugins are enabled; the set is frozen once a workbook is loaded | ✅ `createWorkbook({ plugins })`; `registerPlugin(id, factory)` on import; the `plugins` attribute enables only listed ids (an unknown id throws); the set is fixed per pane at creation |
| 3 · slots | the six slots render control descriptors `{ id, slot, group, icon, label, shortcut?, mode, isActive, run }` in `group` order; duplicate ids throw; `format-row` appears only in Edit and only when non-empty; a light-DOM `<slot name="format-row">` for the host; plugin `selbar` controls follow the core buttons, so Flag issue stays first and Copy ref · Copy value never move; at narrow widths `format-row` groups fold from the right into a core **More ▾**, and each plugin's first group never folds; marks inside a cell sit at fixed places — person pin top-left, workbook pin 18 px in from the right, changed mark top-right with a cell-colour halo, note mark bottom-right, ⟳ / ≈ left (boards Slot-Map, All-Plugins) | ✅ six slots from control descriptors in group order; duplicate ids throw; `format-row` only in Edit and only when non-empty; the host's light-DOM `<slot name="format-row">` — tests |
| 4 · kinds | the change map is `sheet!ref → { kind, was, now }` with the six kinds; Revert, the toolbar count and "Changed · was X" read the kind; `sheetpane-change` carries it | ✅ `sheet!ref → { kind, was, now }` with the six kinds; Revert, the count and `sheetpane-change` carry it — test |
| 5 · derived | cells written by `derive` are marked derived, excluded from the change map and the count, and shown with the mark the `cell` slot provides | ✅ derived cells marked, never in the change map or the count; undo re-derives — test |
| 6 · envelope | `sheetpane-errors` carries `plugins: string[]`; `setErrors()` with a different set shows the "formatted differently" notice | ✅ `sheetpane-errors` carries `plugins`; `setErrors(list, { plugins })` with a different set shows the "formatted differently" notice — test |
| 7 · no-plugin | a snapshot test: the grid with `plugins` empty renders the same DOM as before this item, control for control — the Baseline-NoPlugins board is the picture | ✅ with no plugin the grid carries no plugin control, row, mark or overlay, and the selection bar is exactly Flag issue · Copy ref · Copy value (the grid had no earlier DOM to snapshot: W-14 landed with W-01) — test |
| 8 · a11y | every slot control is a real button with a label; shortcuts are listed in the help the grid already has | ✅ every slot control is a labelled button; shortcuts run from the grid and are listed in the `?` keyboard help — test |
| 9 · tests | a fake plugin per hook; a plugin that provides a hook twice; two `decorate` providers and their order; the no-plugin snapshot — in the browser engine of the testing verdict | ✅ a fake plugin per hook; two providers of a single hook; two `decorate` providers and their order; the no-plugin grid — 16 tests |
| 10 · record | the hook and slot contract joins W-01's component record (or its own, kind `component`, if W-01's has landed); Ownership rows for `packages/grid/src/plugins/` | ✅ the hook and slot contract is [SR-GRID](../../records/0105_GRID.md) decisions 17–20; `packages/grid/src/plugins/` is inside SR-GRID's `packages/grid/` |
## Blockers

None.

## Record affected

**[SR-GRID](../../records/0105_GRID.md)** decisions 17–20.

## Hazards

- **Scope creep is the hazard.** A seventh hook is the verdict's reopen-trigger, not a quiet addition.
- **L7:** every hook result flows through the store; a plugin that touches an element directly is a bug.
- **Performance:** `format` and `decorate` run per rendered cell on every scroll frame; results are cached per cell until the cell or its style changes (the grid verdict's 16 ms budget holds).

- **An extension point outside the six is being asked for.** The Plugin-Comments board puts a line in the Export menu, which is no slot; it waits on the decider (inbox, W-22). Built only if ruled — it is the verdict's reopen-trigger, not a quiet addition.

## Reference

- Design: [`../reference/design/boards/Slot-Map.dc.html`](../reference/design/boards/Slot-Map.dc.html) — the six slots, where each sits, which plugin fills which
- Design: [`../reference/design/boards/Baseline-NoPlugins.dc.html`](../reference/design/boards/Baseline-NoPlugins.dc.html) — DoD 7: the no-plugin grid
- Design: [`../reference/design/boards/All-Plugins.dc.html`](../reference/design/boards/All-Plugins.dc.html) — every slot filled at 1440, at 1024 (More ▾) and in dark — the density check
- [`../compare/plugins.compare.md`](../compare/plugins.compare.md) — the contract
- [`../compare/workbook-and-error-contract.compare.md`](../compare/workbook-and-error-contract.compare.md) — the store
- [`../compare/grid-rendering.compare.md`](../compare/grid-rendering.compare.md) — the slots' host
- [W-01](W-01-sheetpane-excel.md) · [W-02](W-02-sheetpane-errors.md)

## Prompt — paste into Claude Code once the blockers close

```text
You are building W-14 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, docs/ARCHITECTURE.md,
   work/compare/plugins.compare.md and this file (work/open/W-14-plugin-host.md).
2. Plan the modules and the fixture list in this file's body before writing code.
3. Implement. Read work/compare/plugins.compare.md first; the hook signatures there are the spec. Build packages/grid/src/plugins/ and wire the store, the two elements and the toolbar. Then the DoD tests.
4. Verify: just check; every DoD row above. Then do what SR-WORK-DOCS
   decision 10 says every task owes.
```
