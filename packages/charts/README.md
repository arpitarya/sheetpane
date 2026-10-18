# @sheetpane/charts

**Charts for sheetpane — a frame at the chart's anchor with its title and Show source cells; later, own SVG for bar, column, line, pie and scatter — through the `overlay` hook.**

A plugin: it registers against the one in-memory workbook of `@sheetpane/grid`
(`createWorkbook({ plugins: [...] })`, or `plugins="charts"` on the element), so
`<sheetpane-excel>` and `<sheetpane-errors>` both see its effect. Versioned in
lockstep with `@sheetpane/grid`.

- `@sheetpane/charts` — the headless plugin.
- `@sheetpane/charts/ui` — the controls it adds to the grid's slots; opt-in.

No runtime dependencies.

**Status: not built.** Spec: [`work/open/W-21-charts.md`](../../work/open/W-21-charts.md).
How plugins plug in: [`work/compare/plugins.compare.md`](../../work/compare/plugins.compare.md).
