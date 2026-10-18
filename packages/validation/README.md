# @sheetpane/validation

**Data validation for sheetpane — the workbook's own `<dataValidations>` rules checked on load and on every edit, landing in <sheetpane-errors> — as a plugin on the `validate` hook.**

A plugin: it registers against the one in-memory workbook of `@sheetpane/grid`
(`createWorkbook({ plugins: [...] })`, or `plugins="validation"` on the element), so
`<sheetpane-excel>` and `<sheetpane-errors>` both see its effect. Versioned in
lockstep with `@sheetpane/grid`.

- `@sheetpane/validation` — the headless plugin.
- `@sheetpane/validation/ui` — the controls it adds to the grid's slots; opt-in.

No runtime dependencies.

**Status: not built.** Spec: [`work/open/W-18-validation.md`](../../work/open/W-18-validation.md).
How plugins plug in: [`work/compare/plugins.compare.md`](../../work/compare/plugins.compare.md).
