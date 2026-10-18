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
| Accept or change the dark `--sp-*` values (`work/reference/design/boards/sp-plugins.css`, `.spx-dark`) and say whether dark follows the computer's setting by default (W-29 DoD 1) | 2026-10-18 | 0 days |
| ↳ **blocks:** W-29 | | |
| Comments: keep an on/off "Write review as Excel comments" line in Export ▾ — an extension point beyond the six slots, the plugins verdict's reopen-trigger — or always write them, as W-22 is filed? (board Plugin-Comments) | 2026-10-18 | 0 days |
| ↳ **blocks:** W-22 (the Export line only) | | |

---

## Open items

### build

- 🔴 **W-22** `agent` · Build `@sheetpane/comments`: notes and threads into the error pane; the review exported as threaded comments — blocked on the decider's Export-line ruling. Filed by Arpit (Cowork). [detail](open/W-22-comments.md)
- 🔴 **W-29** `agent` · Dark theme for the grid and the `--sp-*` tokens the plugin slots draw with — blocked on the decider's dark-values ruling. Filed by Arpit (Cowork). [detail](open/W-29-dark-theme-and-slot-tokens.md)
- 🟢 **W-09** `agent` · Demo apps — React and plain `index.html` — that take `@sheetpane/grid` as a dependency. Filed by Arpit (Cowork). [detail](open/W-09-demo-apps.md)
- 🟢 **W-15** `agent` · Build `@sheetpane/numfmt`: every Excel number format through the `numfmt` library, format dropdown. Filed by Arpit (Cowork). [detail](open/W-15-numfmt.md)
- 🟢 **W-16** `agent` · Build `@sheetpane/formulas`: live recalculation through IronCalc (WASM, lazy), `fx` cell bar, status sums. Filed by Arpit (Cowork). [detail](open/W-16-formulas.md)
- 🟢 **W-17** `agent` · Build `@sheetpane/styles`: fill, weight, colour, borders, alignment rendered and edited; the format row. Filed by Arpit (Cowork). [detail](open/W-17-styles.md)
- 🟢 **W-18** `agent` · Build `@sheetpane/validation`: the workbook's data-validation rules flagged in the error pane; list dropdowns. Filed by Arpit (Cowork). [detail](open/W-18-validation.md)
- 🟡 **W-19** `agent` · Build `@sheetpane/condfmt`: conditional formatting rendered after styles; expression rules via formulas — waiting on W-17. Filed by Arpit (Cowork). [detail](open/W-19-condfmt.md)
- 🟢 **W-20** `agent` · Build `@sheetpane/images`: anchored pictures drawn in sheet space, view only. Filed by Arpit (Cowork). [detail](open/W-20-images.md)
- 🟡 **W-21** `agent` · Build `@sheetpane/charts`: frame + title + Show source cells, then own SVG for five chart types — waiting on W-20. Filed by Arpit (Cowork). [detail](open/W-21-charts.md)
- 🟢 **W-26** `agent` · Editing and position events: edit start, typing, before-save (cancellable), cancel, sheet switch; column title on every event. Filed by Arpit (Cowork). [detail](open/W-26-edit-events.md)
- 🟡 **W-27** `agent` · Column rules by header title (`columns`, `validate`, flag or block) feeding the error list — waiting on W-26. Filed by Arpit (Cowork). [detail](open/W-27-host-column-rules.md)
- 🟡 **W-28** `agent` · React hooks — selection, typing, changes, errors, events, column rules — as recipes in the README and React demo — waiting on W-26. Filed by Arpit (Cowork). [detail](open/W-28-react-hooks.md)

### testing

- 🟢 **W-30** `arpit` · Save one tiny sheet from Excel, Google Sheets, LibreOffice and Numbers; an agent then tests `@sheetpane/import` on them (split from W-13). Filed by Arpit (Cowork). [detail](open/W-30-real-app-fixtures.md)

### record update

### research



---
