# @sheetpane/tables

**Excel tables in `<sheetpane-excel>`, drawn as their style draws them — header row, banded rows and columns, totals row.**

A table (a ListObject — *Insert › Table* in Excel) is read by `@sheetpane/import` whether or not
this plugin is on: every sheet carries its `tables` (name, range, header and totals rows, columns,
style). This plugin only draws them:

```js
import '@sheetpane/grid';
import '@sheetpane/tables'; // registers `tables`
excel.setAttribute('plugins', 'tables styles');
```

or `createWorkbook({ plugins: [tables()] })`.

| a table's | drawn |
|---|---|
| header row | bold; filled in the style's colour with light text (Medium), or a line under it (Light) |
| banded rows / columns | every other data row or column filled in a light tint of the style's colour |
| first / last column | bold, when the table turns it on |
| totals row | bold, under a double line |
| lines | Light: over and under the table; Medium: under every row |

- **Styles:** `TableStyleLight1`–`7` and `TableStyleMedium1`–`7`, in the workbook's theme colours
  (style 1 in the dark text colour, 2–7 in accents 1–6) — `TABLE_STYLES`. Any other style (Light
  8–21, Medium 8–28, Dark, a custom style) draws a bold header row only; a table with no style
  draws nothing, as Excel's *None*.
- **Order:** a cell's own format (`@sheetpane/styles`) and a conditional format
  (`@sheetpane/condfmt`) draw over the table's style, as in Excel, whatever order `plugins` lists
  them in.
- **Draw-only:** no control, no change, nothing written — a download keeps the file's table parts
  as they were.
- **Headless helpers:** `tableAt(sheet, row, col)`, `findTable(book, name)`, `tableCss(table, row,
  col, theme)`, `paletteOf(style, theme)`.

**Structured references** — `Units[Name]`, `Units[[#Data],[Name]]` — are resolved by
`@sheetpane/export`'s `resolveStructuredRef`, which `@sheetpane/validation` uses for list sources:
a dropdown over a table column reads the table's cells, with or without this plugin.

Spec: [SR-TABLES](../../records/0122_TABLES.md). MIT.
