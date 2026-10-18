---
type: Queue
description: "The single live work queue, three lanes, plus the Blocked-on-the-decider inbox. The list only — its rules live in the record below."
governed_by: SR-WORK-OPEN-QUEUE
governed_by_path: records/0051_WORK-open-queue.md
---

# OPEN-WORK — what is still open

**This file is the LIST, plus the legend below.** Everything else — what the
queue is, an item's lifecycle, the shape of a row, ball precedence, ordering,
how the inbox works, and what every session owes — is stated once in
**[SR-WORK-OPEN-QUEUE](../records/0051_WORK-open-queue.md)** and is not repeated
here. Read that record before changing anything below it.

**A ball on every row, always one:** 🔴 blocked on the decider, directly or through another item · 🟣 gated on a named date, directly or through another item · 🟡 waiting on another item · 🟢 no blockers.
**Optional, after the ball:** 🧨 broken or getting worse · 🔺 do first (the decider only). Full legend: [SR-WORK-OPEN-QUEUE](../records/0051_WORK-open-queue.md) rules 20–34.

---

## Blocked on the decider

| what the decider decides | filed | age |
|---|---|---|

*Empty since 2026-10-18 — nothing waits on a ruling; the next gate is W-04 DoD 8 (publishing) or W-03 DoD 8 (Arpit opens the sample in Excel).*

---

## Open items

### build

- 🟢 **W-04** `agent` · Make the monorepo build and test — skeleton and pnpm/just landed; build, tests, CI and lockstep publishing are left. Filed by Arpit (Cowork). [detail](open/W-04-monorepo-toolchain.md)
- 🟡 **W-03** `agent` · Build `@sheetpane/export`: `toXlsx`, `patchXlsx`, `toCsv`, `download`, no runtime dependencies — waiting on W-04. Filed by Arpit (Cowork). [detail](open/W-03-export-package.md)
- 🟡 **W-12** `agent` · Build the downloader SR-DOWNLOAD specifies, in `@sheetpane/export`: `download(data, filename)` saves export output as `.xlsx` or `.csv` — waiting on W-04. Filed by Arpit (Cowork). [detail](open/W-12-downloader.md)
- 🟡 **W-13** `agent` · Build `@sheetpane/import`: `.xlsx` or `.csv` in, the JavaScript `Workbook` object out, for `@sheetpane/grid` — waiting on W-04, W-03. Filed by Arpit (Cowork). [detail](open/W-13-import-package.md)
- 🟡 **W-01** `agent` · Build the `<sheetpane-excel>` web component and its in-memory workbook: read, View/Edit, edits, flag, export — waiting on W-04, W-03, W-13. Filed by Arpit (Cowork). [detail](open/W-01-sheetpane-excel.md)
- 🟡 **W-02** `agent` · Build the `<sheetpane-errors>` web component: list, form, resolve, Show in sheet, always in sync — waiting on W-01. Filed by Arpit (Cowork). [detail](open/W-02-sheetpane-errors.md)
- 🟡 **W-09** `agent` · Demo apps — React and plain `index.html` — that take `@sheetpane/grid` as a dependency — waiting on W-01, W-02. Filed by Arpit (Cowork). [detail](open/W-09-demo-apps.md)
- 🟡 **W-14** `agent` · Build the plugin host in `@sheetpane/grid`: six hooks, six slots, the `plugins` attribute, change kinds — waiting on W-01, W-04. Filed by Arpit (Cowork). [detail](open/W-14-plugin-host.md)
- 🟡 **W-24** `agent` · Freeze panes in core: read `<pane>`, sticky rows and columns, Freeze/Unfreeze, export — waiting on W-01, W-13, W-03. Filed by Arpit (Cowork). [detail](open/W-24-freeze-panes.md)
- 🟡 **W-23** `agent` · Undo / redo over every change and error, one stack per pane (B-027 promoted) — waiting on W-01. Filed by Arpit (Cowork). [detail](open/W-23-undo-redo.md)
- 🟡 **W-15** `agent` · Build `@sheetpane/numfmt`: every Excel number format through the `numfmt` library, format dropdown — waiting on W-14, W-13. Filed by Arpit (Cowork). [detail](open/W-15-numfmt.md)
- 🟡 **W-16** `agent` · Build `@sheetpane/formulas`: live recalculation through IronCalc (WASM, lazy), `fx` cell bar, status sums — waiting on W-14, W-13. Filed by Arpit (Cowork). [detail](open/W-16-formulas.md)
- 🟡 **W-17** `agent` · Build `@sheetpane/styles`: fill, weight, colour, borders, alignment rendered and edited; the format row — waiting on W-14, W-13, W-23. Filed by Arpit (Cowork). [detail](open/W-17-styles.md)
- 🟡 **W-18** `agent` · Build `@sheetpane/validation`: the workbook's data-validation rules flagged in the error pane; list dropdowns — waiting on W-14, W-13, W-02. Filed by Arpit (Cowork). [detail](open/W-18-validation.md)
- 🟡 **W-19** `agent` · Build `@sheetpane/condfmt`: conditional formatting rendered after styles; expression rules via formulas — waiting on W-17. Filed by Arpit (Cowork). [detail](open/W-19-condfmt.md)
- 🟡 **W-20** `agent` · Build `@sheetpane/images`: anchored pictures drawn in sheet space, view only — waiting on W-14, W-13. Filed by Arpit (Cowork). [detail](open/W-20-images.md)
- 🟡 **W-21** `agent` · Build `@sheetpane/charts`: frame + title + Show source cells, then own SVG for five chart types — waiting on W-20. Filed by Arpit (Cowork). [detail](open/W-21-charts.md)
- 🟡 **W-22** `agent` · Build `@sheetpane/comments`: notes and threads into the error pane; the review exported as threaded comments — waiting on W-14, W-13, W-02, W-03. Filed by Arpit (Cowork). [detail](open/W-22-comments.md)

### testing

### record update

### research


---
