# @sheetpane/formulas

**Formula recalculation for sheetpane — edit a cell and every dependent formula updates — as a plugin on the `derive` hook, backed by IronCalc (WASM, lazy-loaded).**

A plugin: it registers against the one in-memory workbook of `@sheetpane/grid`
(`createWorkbook({ plugins: [...] })`, or `plugins="formulas"` on the element), so
`<sheetpane-excel>` and `<sheetpane-errors>` both see its effect. Versioned in
lockstep with `@sheetpane/grid`.

- `@sheetpane/formulas` — the headless plugin (`derive`, `exportPatch`).
- `@sheetpane/formulas/ui` — the controls it adds to the grid's slots; opt-in.

```js
import '@sheetpane/grid';
import '@sheetpane/formulas/ui'; // registers "formulas" with its controls
// <sheetpane-excel plugins="formulas" src="book.xlsx"></sheetpane-excel>

// or, headless / your own store:
import { createWorkbook } from '@sheetpane/grid';
import { formulas } from '@sheetpane/formulas';
const store = createWorkbook({ plugins: [formulas({ preload: true })] });
```

## What it does

- **Live recalculation.** Edit B3 and every formula that reads it — on any
  sheet, through defined names — gets its new value. Recalculated cells are
  *derived*: drawn with a mark, never in the change map or the change count.
- **Typed formulas.** With the plugin installed, a value typed starting `=` is a
  change of kind `formula` (SR-GRID 21b); it evaluates, and export writes it as
  a real formula.
- **Errors as Excel shows them.** `#DIV/0!`, `#REF!`, `#N/A`, `#VALUE!` are
  values, never exceptions. A circular reference shows `0`, as Excel does, and
  is listed by `cycles()` (the UI names it in the status line).
- **Honest about gaps.** A formula from the file that IronCalc cannot calculate
  (`#NAME?` for a function it lacks, a parse error, `#SPILL!` over a legacy
  array formula) keeps the value Excel saved and is listed by `unsupported()`
  (the UI marks it `≈`); Excel recalculates it on open.
- **Export.** `exportPatch` writes `<f>` and a cached `<v>` for each typed
  formula, a new `<v>` for each recalculated formula cell (its `<f>` — shared
  or not — is kept as written), and keeps `fullCalcOnLoad="1"` so Excel
  re-verifies every value.

## The engine is a cache (SR-LAW-9)

The JavaScript workbook is the only source of truth. The IronCalc model is built
from it — the file's values and formulas overlaid with the user's changes — and
rebuilt whenever the workbook object changes. On a change the plugin reads the
cell's state from the store and writes it into the model; it never reads state
back out of the model, only computed values.

Only what formulas can reach goes into the model: every formula cell, plus the
cells its references (and the defined names') cover. A formula with `INDIRECT`
or `OFFSET` can reach anywhere, so then every cell goes in. A new formula over
cells not yet in the model feeds them on demand.

## Loading: nothing until a formula needs it

`@ironcalc/wasm` 0.9.0 (MIT / Apache-2.0) is a 2 MB `.wasm`. It is reached only
by a dynamic `import()` on the first `derive` that has a formula to calculate:

- importing the package (in Node too) touches no `WebAssembly`;
- a workbook with no formulas never loads it — until a formula is typed;
- `formulas({ preload: true })` warms it when the plugin is created;
- `formulas({ wasm })` says where the `.wasm` is (a URL, a `Response`, the bytes
  or a compiled module) — for a CDN, a strict CSP, or Node. By default the
  bundler emits it beside `@ironcalc/wasm`'s `wasm.js` (`new URL(…, import.meta.url)`;
  Vite, webpack 5, Rollup and esbuild handle it).

## The plugin's own API

| member | what |
|---|---|
| `ready()` | resolves when every queued recalculation is done and merged |
| `cycles()` | formula cells in a circular reference |
| `unsupported()` | file formula cells IronCalc cannot calculate (saved value kept) |
| `stateOf(sheet, ref)` | `'cycle'`, `'unsupported'` or `undefined` |
| `built()` | whether a model exists for the current workbook |

## The UI (`@sheetpane/formulas/ui`)

| slot | control |
|---|---|
| `cellbar` | View: `fx =B3*C3`, the selected cell's formula as read-only text. Edit: the grid's own cell input holds the formula, editable (retyping the file's formula restores the cell). A formula the file marks *Hidden* on a protected sheet shows neither |
| `status` | `Sum · Avg · Count` of the selection (formatted as the active cell); `⟳ N cells recalculated` (Edit); `Circular reference: B2` |
| `cell` | `⟳` recalculated · `↻` in a cycle · `≈` not calculable |
| `overlay` | in Edit, the ranges the selected formula reads, outlined and labelled in colour (`--sp-ref-1` … `--sp-ref-6`), following the formula as it is typed |

No font family is named anywhere (SR-LAW-5).

## Known limits (IronCalc 0.9.0)

- Values are read back at 15 significant digits (IronCalc has no raw-value
  getter); comparisons with Excel's 17-digit cache use a 1e-14 relative tolerance.
- The function probe in `test/parity.test.ts` lists where IronCalc disagrees
  with Excel: `AGGREGATE` (missing), `XLOOKUP` over array constants, and
  `TEXTJOIN` ignoring an empty *literal*.
- 1904-date workbooks: date functions over serial numbers are off by 1,462 days
  (IronCalc knows only the 1900 system).
- A half-typed formula evaluates to IronCalc's `#ERROR!`; Excel would refuse it.
- Typed formulas are exported as typed: a newer function needs Excel's `_xlfn.`
  prefix, which is not added.

Spec: [`work/open/W-16-formulas.md`](../../work/open/W-16-formulas.md).
How plugins plug in: [`work/compare/plugins.compare.md`](../../work/compare/plugins.compare.md).

**Using an AI coding agent?** `npx sheetpane-skills install` puts sheetpane's skills for Claude Code, Kiro and Codex into your repository.
