# @sheetpane/grid

**View and edit `.xlsx` and `.csv` files inside a single-page app.** One
package, two components the host places anywhere — always in sync through one
in-memory workbook. Both are web components (working names):

- `<sheetpane-excel>` — the sheet. View or Edit; every change stays in memory;
  Export writes the latest values (via [`@sheetpane/export`](../export/README.md)).
- `<sheetpane-errors>` — the errors flagged on the sheet: what's wrong, what it
  should be.

**Status: not built.** Specs:
[`W-01`](../../work/open/W-01-sheetpane-excel.md) (sheet and pane) ·
[`W-02`](../../work/open/W-02-sheetpane-errors.md) (errors). The design:
[`work/reference/design/`](../../work/reference/design/README.md).
