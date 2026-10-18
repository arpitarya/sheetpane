# @sheetpane/condfmt

**Conditional formatting for sheetpane — cellIs, containsText, duplicates, top10, colour scales, data bars — rendered through the `decorate` hook after @sheetpane/styles.**

A plugin: it registers against the one in-memory workbook of `@sheetpane/grid`
(`createWorkbook({ plugins: [...] })`, or `plugins="condfmt"` on the element), so
`<sheetpane-excel>` and `<sheetpane-errors>` both see its effect. Versioned in
lockstep with `@sheetpane/grid`.

- `@sheetpane/condfmt` — the headless plugin.

No runtime dependencies.

**Status: not built.** Spec: [`work/open/W-19-condfmt.md`](../../work/open/W-19-condfmt.md).
How plugins plug in: [`work/compare/plugins.compare.md`](../../work/compare/plugins.compare.md).
