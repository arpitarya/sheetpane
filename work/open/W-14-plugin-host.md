---
type: Handoff
name: W-14
description: "Arpit asked on 2026-10-18 for the spreadsheet features to ship as separate plugin packages; this item is the core that every plugin registers against."
item: W-14
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-fable-5-1)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-fable-5-1)"
ball: agent
---

# W-14 — Build the plugin host in `@sheetpane/grid`: six hooks, six slots, the `plugins` attribute

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Add `plugins` to `createWorkbook()` and a `plugins` attribute to both elements | one way to switch a plugin on, in code or in HTML | ⏳ |
| 2 | Expose the six hooks on the store: `format`, `decorate`, `derive`, `validate`, `overlay`, `exportPatch` | a plugin changes what a cell shows, computes, flags or exports | ⏳ |
| 3 | Draw the six slots — `format-row`, `selbar`, `cellbar`, `status`, `cell`, `overlay` — from control descriptors | a plugin adds buttons the grid styles, labels and keyboard-wires once | ⏳ |
| 4 | Give the change map a `kind`; make Revert, the count and the label read it | style and format edits are changes too (L6) | ⏳ |
| 5 | Test every hook with a fake plugin; prove the no-plugin grid is byte-identical | the guardrail: core never grows a formatting control | ⏳ |

**Arpit, 2026-10-18:** *"Let's create separate packages, plugins for number format, formulas, styles. Merge cells, freeze panes, data validation, conditional formatting, images, charts, pivots, comments, notes. Decide, do some research and have them as separate packages or plugins."*

**Model:** Opus — the hook contract is the surface every later item builds on; a wrong shape here is paid for eight times.

## Goal

The part of `@sheetpane/grid` that makes a plugin possible. Everything a plugin may touch goes through a named hook on the `WorkbookStore` of the contract verdict; everything a plugin may show goes through a named slot the grid draws. The design — hooks, slots, descriptor shape, registration rules — is decisions 2–7 of [`../compare/plugins.compare.md`](../compare/plugins.compare.md); this item builds it and cites it rather than restating it.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · hooks | the six hooks exist on the store with the signatures the verdict names; single-provider hooks throw on a second provider; `decorate` is ordered by `after`; a `decorate` result naming `font-family` throws (L5) | ⏳ |
| 2 · register | `createWorkbook({ plugins })`; the `plugins` attribute lists ids; a package registers its id on import; only listed plugins are enabled; the set is frozen once a workbook is loaded | ⏳ |
| 3 · slots | the six slots render control descriptors `{ id, slot, group, icon, label, shortcut?, mode, isActive, run }` in `group` order; duplicate ids throw; `format-row` appears only in Edit and only when non-empty; a light-DOM `<slot name="format-row">` for the host | ⏳ |
| 4 · kinds | the change map is `sheet!ref → { kind, was, now }` with the six kinds; Revert, the toolbar count and "Changed · was X" read the kind; `sheetpane-change` carries it | ⏳ |
| 5 · derived | cells written by `derive` are marked derived, excluded from the change map and the count, and shown with the mark the `cell` slot provides | ⏳ |
| 6 · envelope | `sheetpane-errors` carries `plugins: string[]`; `setErrors()` with a different set shows the "formatted differently" notice | ⏳ |
| 7 · no-plugin | a snapshot test: the grid with `plugins` empty renders the same DOM as before this item, control for control | ⏳ |
| 8 · a11y | every slot control is a real button with a label; shortcuts are listed in the help the grid already has | ⏳ |
| 9 · tests | a fake plugin per hook; a plugin that provides a hook twice; two `decorate` providers and their order; the no-plugin snapshot — in the browser engine of the testing verdict | ⏳ |
| 10 · record | the hook and slot contract joins W-01's component record (or its own, kind `component`, if W-01's has landed); Ownership rows for `packages/grid/src/plugins/` | ⏳ |

## Blockers

Waiting on **W-01** (the store the hooks attach to; may start once W-01's store exists, before its grid lands) and **W-04** (the toolchain).

## Record affected

W-01's component record gains the plugin contract; until then this item owns `packages/grid/src/plugins/`.

## Hazards

- **Scope creep is the hazard.** A seventh hook is the verdict's reopen-trigger, not a quiet addition.
- **L7:** every hook result flows through the store; a plugin that touches an element directly is a bug.
- **Performance:** `format` and `decorate` run per rendered cell on every scroll frame; results are cached per cell until the cell or its style changes (the grid verdict's 16 ms budget holds).

## Reference

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
