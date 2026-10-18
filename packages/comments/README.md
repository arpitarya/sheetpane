# @sheetpane/comments

**Comments and notes for sheetpane — the file's notes and threaded comments read into the error pane; every sheetpane error written back as a threaded comment on export.**

A plugin: it registers against the one in-memory workbook of `@sheetpane/grid`
(`createWorkbook({ plugins: [...] })`, or `plugins="comments"` on the element), so
`<sheetpane-excel>` and `<sheetpane-errors>` both see its effect. Versioned in
lockstep with `@sheetpane/grid`.

- `@sheetpane/comments` — the headless plugin.

No runtime dependencies.

**Status: not built.** Spec: [`work/open/W-22-comments.md`](../../work/open/W-22-comments.md).
How plugins plug in: [`work/compare/plugins.compare.md`](../../work/compare/plugins.compare.md).
