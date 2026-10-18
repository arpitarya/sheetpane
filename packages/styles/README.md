# @sheetpane/styles

**Cell styles for sheetpane — fill, bold, italic, underline, colour, borders, alignment, wrap — as a plugin on the `decorate` hook. Never a font family (SR-LAW-5).**

A plugin: it registers against the one in-memory workbook of `@sheetpane/grid`
(`createWorkbook({ plugins: [...] })`, or `plugins="styles"` on the element), so
`<sheetpane-excel>` and `<sheetpane-errors>` both see its effect. Versioned in
lockstep with `@sheetpane/grid`.

- `@sheetpane/styles` — the headless plugin.
- `@sheetpane/styles/ui` — the controls it adds to the grid's slots; opt-in.

No runtime dependencies.

**Status: not built.** Spec: [`work/open/W-17-styles.md`](../../work/open/W-17-styles.md).
How plugins plug in: [`work/compare/plugins.compare.md`](../../work/compare/plugins.compare.md).
