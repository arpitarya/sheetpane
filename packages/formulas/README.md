# @sheetpane/formulas

**Formula recalculation for sheetpane — edit a cell and every dependent formula updates — as a plugin on the `derive` hook, backed by IronCalc (WASM, lazy-loaded).**

A plugin: it registers against the one in-memory workbook of `@sheetpane/grid`
(`createWorkbook({ plugins: [...] })`, or `plugins="formulas"` on the element), so
`<sheetpane-excel>` and `<sheetpane-errors>` both see its effect. Versioned in
lockstep with `@sheetpane/grid`.

- `@sheetpane/formulas` — the headless plugin.
- `@sheetpane/formulas/ui` — the controls it adds to the grid's slots; opt-in.

Engine: [`@ironcalc/wasm`](https://github.com/ironcalc/IronCalc) 0.9.0 (MIT / Apache-2.0), a 2 MB `.wasm` loaded on first use. The JavaScript workbook stays the source of truth; IronCalc is a derived cache (SR-LAW-9).

**Status: not built.** Spec: [`work/open/W-16-formulas.md`](../../work/open/W-16-formulas.md).
How plugins plug in: [`work/compare/plugins.compare.md`](../../work/compare/plugins.compare.md).
