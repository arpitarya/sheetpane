# @sheetpane/numfmt

**Excel number formats for sheetpane — currency, dates, fractions, elapsed time, conditional sections, locales — as a plugin on the `format` hook.**

A plugin: it registers against the one in-memory workbook of `@sheetpane/grid`
(`createWorkbook({ plugins: [...] })`, or `plugins="numfmt"` on the element), so
`<sheetpane-excel>` and `<sheetpane-errors>` both see its effect. Versioned in
lockstep with `@sheetpane/grid`.

- `@sheetpane/numfmt` — the headless plugin.
- `@sheetpane/numfmt/ui` — the controls it adds to the grid's slots; opt-in.

Engine: [`numfmt`](https://www.npmjs.com/package/numfmt) 4.0.1 (MIT, zero dependencies), pinned.

**Status: not built.** Spec: [`work/open/W-15-numfmt.md`](../../work/open/W-15-numfmt.md).
How plugins plug in: [`work/compare/plugins.compare.md`](../../work/compare/plugins.compare.md).
