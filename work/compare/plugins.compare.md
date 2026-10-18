---
type: Compare
title: Which spreadsheet features are core, which are plugins, and how a plugin plugs in
description: "Number formats, formulas, styles, merged cells, freeze panes, data validation, conditional formatting, images, charts, pivots, comments and notes — core or a separate package; the hooks and slots the grid exposes; the engines. Verdict for W-14–W-24."
status: decided
decided: 2026-10-18
decided_by: "Arpit (Cowork, claude-fable-5-1) — ruling 'decide, do some research and have them as separate packages or plugins', 2026-10-18; verdict drafted by the session, open to override"
---

# Which spreadsheet features are core, which are plugins, and how a plugin plugs in

> **Verdict:** decided · **eight plugin packages** — `numfmt`, `formulas`,
> `styles`, `validation`, `condfmt`, `images`, `charts`, `comments` — each a
> separate npm package that registers against the one in-memory workbook
> through **six named hooks**, and contributes controls to **six named slots**
> the grid draws; **merged cells and freeze panes stay core**; **pivots are
> not built** (cached cells show; export asks Excel to refresh) · the grid
> with no plugin installed is unchanged — a plain review tool · confidence
> **high** on the split, **medium** on the engines (numfmt, IronCalc) until
> the fixtures run · **reopen if** a plugin needs a hook this doc does not
> name, or the no-plugin grid grows a formatting control.

## Context

Arpit asked on 2026-10-18 for every feature Excel has and sheetpane does not
to be decided one by one — core, a plugin, or not built — after the
comparison against SheetJS, ExcelJS, Handsontable, Univer, IronCalc and
Quadratic. The laws fix the field: FOSS and no copyleft at runtime (L2), two
formats (L3), web components with a DOM-only contract (L4), the host's font
(L5), changes in memory and export carries them (L6), every component on the
one workbook (L7), lockstep npm packages (L8), memory is JavaScript objects
(L9). The product is **review** — flag what is wrong, say what it should be,
export — not authoring; every decision below protects that.

## Options — the shape

| | one big grid | feature flags in the grid | **separate packages (plugins)** |
|---|---|---|---|
| no-plugin bundle | grows every release | grows (flags are not tree-shaken) | **unchanged** |
| L2 audit | one tree | one tree | **per package — a WASM engine only where it is wanted** |
| a host that wants only review | pays for everything | pays for everything | **pays nothing** |
| determinism | n/a | flag interplay | **one provider per capability, duplicates throw** |

**Chosen: separate packages.** Univer's plugin-per-capability shape is the
model; its DI container and lazy-loading are not — a plugin here is a plain
object with named hooks.

## The verdict, feature by feature

| feature | where | package | approach / engine | depends on |
|---|---|---|---|---|
| number formats | **plugin** | `@sheetpane/numfmt` | [`numfmt`](https://www.npmjs.com/package/numfmt) 4.0.1 (MIT, zero deps) behind the `format` hook; the core subset stays the default when the plugin is absent | — |
| formulas | **plugin** | `@sheetpane/formulas` | [`@ironcalc/wasm`](https://github.com/ironcalc/IronCalc) 0.9.0 (MIT / Apache-2.0; 2 MB `.wasm`, lazy-loaded on first use) as a **derived model**: every cell is fed with `setUserInput` under `pauseEvaluation`, then `evaluate`; results read back with `getFormattedCellValue`; recalculated cells are *derived*, never the user's changes; the JavaScript workbook stays the only source of truth (L9) | — |
| styles | **plugin** | `@sheetpane/styles` | own `styles.xml` reader (`cellXfs`, `fonts`, `fills`, `borders`) → an allow-listed CSS subset through `decorate`; **`font-family` is never returned** (L5); merge / unmerge controls live in its UI | undo (W-23) before its format row ships |
| merged cells | **core** | — | already ruled: import reads `<mergeCells>`, the grid renders merge-and-centre, export writes it back | — |
| freeze panes | **core** | — | `<sheetView><pane>` read by import; sticky rows and columns in the virtualiser — a plugin cannot reach the virtualiser; Freeze / Unfreeze in Edit; `patchXlsx` writes `<pane>` (W-24) | — |
| data validation | **plugin** | `@sheetpane/validation` | `<dataValidations>` (list, whole, decimal, date, time, textLength, custom) → the `validate` hook → errors of type `validation`, severity `warning`, author `workbook`, so the workbook's own rules land in `<sheetpane-errors>` on load and on every edit; a `list` rule gives a dropdown in Edit; `custom` rules evaluate only when `formulas` is installed, otherwise they are skipped and counted | `formulas` (optional) |
| conditional formatting | **plugin** | `@sheetpane/condfmt` | `<conditionalFormatting>` + `dxf` → `decorate`, ordered after `styles`; v1: `cellIs`, `containsText`, `duplicateValues`, `top10`, `colorScale`, `dataBar`; `expression` rules only with `formulas`; render only, no authoring | `styles`; `formulas` (optional) |
| images | **plugin** | `@sheetpane/images` | drawing anchors (`oneCellAnchor`, `twoCellAnchor`) + `xl/media` → the `overlay` hook draws `<img>` in sheet space; view only; export (patch mode) keeps them as they were | — |
| charts | **plugin** | `@sheetpane/charts` | v1: a frame at the chart's anchor with its title and a **Show source cells** action that selects the plotted range; v2: own SVG for bar, column, line, pie and scatter — no chart library; export keeps the chart part untouched | `images` (anchors) |
| pivot tables | **not built** | — | the pivot's cached result is ordinary cells and already shows; export sets `refreshOnLoad="1"` on a pivot cache whose source range meets a changed cell, and `<calcPr fullCalcOnLoad="1"/>` whenever any cell changed (W-03); the view shows a read-only badge "pivot table — refreshes in Excel" on the range; live pivoting is a proposal, not a package | — |
| comments and notes | **plugin** | `@sheetpane/comments` | reads notes (`xl/comments*.xml`) and threaded comments (`xl/threadedComments/`) into the error store as severity `note` with origin `file`; on export writes every sheetpane error as a **threaded comment**, plus the legacy comment and VML parts Excel needs to show it, so the review travels inside the `.xlsx` | — |

## How a plugin plugs in

**The store, not the element.** `createWorkbook({ plugins })` takes the list;
every element on that `pane` sees the same formatted, styled, validated
values, so L7 holds with no extra work. In plain HTML the `plugins`
attribute names the enabled ones by id (`plugins="numfmt formulas"`); a
plugin package registers its id when imported, and **only listed plugins are
enabled** — import order never decides anything.

```ts
import { createWorkbook } from '@sheetpane/grid';
import { numfmt } from '@sheetpane/numfmt';
import { ui as numfmtUI } from '@sheetpane/numfmt/ui';
import { formulas } from '@sheetpane/formulas';
excel.workbook = errors.workbook = createWorkbook({ plugins: [numfmt(), numfmtUI(), formulas()] });
```

```html
<script type="module" src="/node_modules/@sheetpane/numfmt/dist/index.js"></script>
<sheetpane-excel pane="q3" plugins="numfmt"></sheetpane-excel>
```

**Six hooks** — each a narrow job; the core exposes exactly these (W-14):

| hook | signature | who | rule |
|---|---|---|---|
| `format` | `(cell, ctx) → string` | numfmt | one provider; the core subset is the fallback |
| `decorate` | `(cell, ctx) → StyleSubset` | styles, condfmt | ordered by a declared `after: [...]`; later wins per property; `font-family` rejected at registration |
| `derive` | `(change, ctx) → DerivedChange[]` | formulas | derived cells are marked, never entered in the user's change map |
| `validate` | `(sheet, ctx) → SheetpaneError[]` | validation | errors carry `author: "workbook"` and are re-run on every change |
| `overlay` | `(sheet, ctx) → OverlayItem[]` | images, charts | items positioned in sheet space; the grid places and scrolls them |
| `exportPatch` | `(ctx) → void` | formulas, styles, comments | runs inside `patchXlsx` after the core writes; may add parts and rels |

**Six slots** the grid draws — a plugin describes a control, the grid renders
it (host font, labels, roving tabindex, `--sp-*` tokens applied once):

| slot | where | shown |
|---|---|---|
| `format-row` | a row under the toolbar | Edit only, **and only if a plugin adds to it** |
| `selbar` | docked in the cell bar after Flag issue, and on right-click (W-31; the slot id is unchanged) | Edit |
| `cellbar` | the cell bar (`fx`, raw value) | both modes |
| `status` | the status line (Sum · Avg · Count) | both modes |
| `cell` | inside a rendered cell (a dropdown arrow, a "recalculated" mark) | both modes |
| `overlay` | the sheet-space layer pins and find-highlights already use | both modes |

A control descriptor: `{ id, slot, group, icon, label, shortcut?, mode, isActive(snap, sel), run(store, sel) }`.
The host gets one light-DOM `<slot name="format-row">` for its own buttons;
plugins never get that hatch.

## Decisions

1. **Split per the table above.** Eight packages, one scaffolded per feature
   under `packages/`; merged cells and freeze panes in core; pivots not built.
2. **A plugin is a plain object:** `{ id, provides: Hook[], after?: string[], ...hooks }`.
   Two plugins providing the same single-provider hook **throw at
   registration**; a duplicate control `id` throws; `decorate` returning
   `font-family` throws.
3. **The plugin set is fixed per `pane` at creation.** It cannot change while
   a workbook is loaded; saved reviews carry `plugins: string[]` in the
   `sheetpane-errors` envelope so a reload with a different set shows a
   "formatted differently" notice instead of false "stale" tags.
4. **UI is opt-in and separate:** every plugin with controls ships them at
   `@sheetpane/<name>/ui`; the headless entry never imports the UI.
5. **The core never grows a formatting control.** Only plugins add to
   `format-row`; the no-plugin grid stays the review tool the design boards
   show. (Guardrail against drifting into a mini-Excel.)
6. **The change map carries a kind:** `sheet!ref → { kind: 'value' | 'style' | 'numFmt' | 'formula' | 'merge' | 'freeze', was, now }`.
   Revert, the change count and "Changed · was X" read the kind.
7. **Versioning:** every plugin is versioned in lockstep with `@sheetpane/grid`
   (L8) and lists it as a `peerDependency` at the exact version.
8. **Engines:** `numfmt` 4.0.1 and `@ironcalc/wasm` 0.9.0 — both permissive,
   both pinned exactly; every other package has no runtime dependency.
   HyperFormula (`GPL-3.0-only`) is excluded by L2's copyleft ruling;
   formulajs is a function library without a parser; fast-formula-parser is
   unmaintained since 2023.
9. **Rulings read in as Arpit's, open to override** (the precedent of the
   2026-10-18 "resolve all the blockers" session):
   - "cells are plain text; merge-and-centre is the only format" becomes
     *"… unless a plugin decorates them"* — the no-plugin grid is unchanged.
   - "formulas show their saved value" becomes *"… unless `formulas` is
     installed, in which case they recalculate; the WASM model is a derived
     cache under L9, rebuilt from the JavaScript workbook"*.
   - L5: when `styles` is installed, a cell's **weight, style, size, colour
     and decoration** may follow the workbook; **family never does**.
   - B-027 (undo / redo) is promoted to W-23 — it ships before any
     formatting control does.
10. **Stale-value fix is core, plugin or not:** `patchXlsx` writes
    `<calcPr fullCalcOnLoad="1"/>` when any cell changed and
    `refreshOnLoad="1"` on affected pivot caches; the grid marks formula cells
    that depend on a changed cell "may be stale" when `formulas` is absent.

## Consequences

- W-14 (the plugin host in core) precedes every plugin; W-01's store and
  W-03's `patchXlsx` grow the hooks in the same items.
- `@sheetpane/import` exposes what plugins read: each cell's style index
  `s`, the `numFmts` / `cellXfs` / `fonts` / `fills` / `borders` / `dxfs`
  tables, `<pane>`, `<dataValidations>`, `<conditionalFormatting>`, drawing
  anchors, media, chart parts, comment parts — as parsed objects, so no
  plugin re-reads the ZIP (W-13 DoD 3 grows).
- The errors pane gains two authors it did not have: `workbook`
  (validation) and `file` (comments). Both are filterable.
- Build order: W-14 → W-15 numfmt → W-16 formulas → W-23 undo → W-17 styles
  → W-18 validation → W-19 condfmt → W-20 images → W-21 charts → W-22
  comments; W-24 freeze panes alongside W-01.
- Pivots: proposal [`../proposals/pivots.md`](../proposals/pivots.md), backlog B-028.

## References

- [`../reference/README.md`](../reference/README.md) §SpreadsheetML — `styles.xml`, `sheetView/pane`, `dataValidations`, `conditionalFormatting`, drawings, comments.
- [`workbook-and-error-contract.compare.md`](workbook-and-error-contract.compare.md) — the store the hooks attach to.
- [`export-shape.compare.md`](export-shape.compare.md) — `patchXlsx`, where `exportPatch` runs.
- [`xlsx-csv-reading.compare.md`](xlsx-csv-reading.compare.md) — decision 2, now "unless a plugin".
- Engines: [numfmt](https://github.com/borgar/numfmt) · [IronCalc](https://github.com/ironcalc/IronCalc) · [HyperFormula licensing](https://handsontable.com/docs/hyperformula/guide/licensing.md) (excluded).
- Shape: [Univer](https://github.com/dream-num/univer) — plugin per capability.
- Laws: [SR-LAW-2](../../records/0004_LAW-2-foss-dependencies.md), [SR-LAW-5](../../records/0007_LAW-5-host-font.md), [SR-LAW-6](../../records/0008_LAW-6-edits-in-memory-export-with-changes.md), [SR-LAW-7](../../records/0009_LAW-7-surfaces-always-in-sync.md), [SR-LAW-8](../../records/0010_LAW-8-npm-package.md), [SR-LAW-9](../../records/0011_LAW-9-memory-is-a-javascript-object.md).

## Reopen-trigger

A plugin that cannot be built on the six hooks and six slots without a
seventh; a formatting control appearing in the no-plugin grid; `numfmt`
misformatting more than 1 in 100 cells on the W-13 fixture set; IronCalc
disagreeing with Excel's cached value on more than 1 in 100 formula cells
across the fixtures. **Check:** the W-14 hook test and the W-15 / W-16
fixture comparisons once they land.
