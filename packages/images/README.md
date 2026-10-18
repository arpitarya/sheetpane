# @sheetpane/images

**Images for sheetpane — pictures anchored in the sheet drawn in sheet space through the `overlay` hook; view only, kept on export.**

A plugin: it registers against the one in-memory workbook of `@sheetpane/grid`
(`createWorkbook({ plugins: [...] })`, or `plugins="images"` on the element), so
`<sheetpane-excel>` and `<sheetpane-errors>` both see its effect. Versioned in
lockstep with `@sheetpane/grid`.

- `@sheetpane/images` — the headless plugin.

No runtime dependencies.

**Status: not built.** Spec: [`work/open/W-20-images.md`](../../work/open/W-20-images.md).
How plugins plug in: [`work/compare/plugins.compare.md`](../../work/compare/plugins.compare.md).
