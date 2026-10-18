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

*Empty since 2026-10-18 — nothing waits on a ruling; the iPhone download check is backlog B-031, the real-app files are W-30 (`arpit` lane).*

---

## Open items

### build

- 🟢 **W-22** `agent` · Build `@sheetpane/comments`: notes and threads into the error pane; the review exported as threaded comments, on by default, host can switch off. Filed by Arpit (Cowork). [detail](open/W-22-comments.md)
- 🟢 **W-29** `agent` · Dark theme for the grid and the `--sp-*` tokens the plugin slots draw with; dark values accepted, `theme` defaults to light. Filed by Arpit (Cowork). [detail](open/W-29-dark-theme-and-slot-tokens.md)
- 🟢 **W-16** `agent` · Build `@sheetpane/formulas`: live recalculation through IronCalc (WASM, lazy), `fx` cell bar, status sums. Filed by Arpit (Cowork). [detail](open/W-16-formulas.md)
- 🟢 **W-17** `agent` · Build `@sheetpane/styles`: fill, weight, colour, borders, alignment rendered and edited; the format row. Filed by Arpit (Cowork). [detail](open/W-17-styles.md)
- 🟡 **W-19** `agent` · Build `@sheetpane/condfmt`: conditional formatting rendered after styles; expression rules via formulas — waiting on W-17. Filed by Arpit (Cowork). [detail](open/W-19-condfmt.md)
- 🟢 **W-21** `agent` · Build `@sheetpane/charts`: frame + title + Show source cells, then own SVG for five chart types. Filed by Arpit (Cowork). [detail](open/W-21-charts.md)
- 🟢 **W-27** `agent` · Column rules by header title (`columns`, `validate`, flag or block) feeding the error list. Filed by Arpit (Cowork). [detail](open/W-27-host-column-rules.md)
- 🟢 **W-28** `agent` · React hooks — selection, typing, changes, errors, events, column rules — as recipes in the README and React demo. Filed by Arpit (Cowork). [detail](open/W-28-react-hooks.md)

### testing

- 🟢 **W-30** `arpit` · Save one tiny sheet from Excel, Google Sheets, LibreOffice and Numbers; an agent then tests `@sheetpane/import` on them (split from W-13). Filed by Arpit (Cowork). [detail](open/W-30-real-app-fixtures.md)

### record update

### research



---
