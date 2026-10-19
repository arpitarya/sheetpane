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
*Empty since 2026-10-19 — W-44 closed: 0.3.0 published from CI. Next gate: W-30 and W-48, the decider's own hands-on runs (testing).*

---

## Open items

### build

- 🟢 **W-50** `agent` · **G1** · Pass and not-checked marks: show what is right, not only what is wrong. Filed by Arpit (Cowork). [detail](open/W-50-pass-and-not-checked.md)

- 🟢 **W-51** `agent` · **G1** · Review layers: several sets of errors in one pane, switched without losing any. Filed by Arpit (Cowork). [detail](open/W-51-review-layers.md)

- 🟢 **W-52** `agent` · **G1** · Insert and delete rows and columns in Edit, with every reference shifted. Filed by Arpit (Cowork). [detail](open/W-52-insert-delete-rows-columns.md)

- 🟢 **W-53** `agent` · **G1** · Rich text: keep a cell's formatted runs (one word in italic) on import and draw them. Filed by Arpit (Cowork). [detail](open/W-53-rich-text-runs.md)

- 🟢 **W-54** `agent` · **G1** · Run the rules file, column rules and the workbook's validation in Node, with no page. Filed by Arpit (Cowork). [detail](open/W-54-checks-in-node.md)

- 🟢 **W-56** `agent` · **G1** · A hover event and a host highlight that does not move the selection. Filed by Arpit (Cowork). [detail](open/W-56-hover-and-highlight.md)

- 🟢 **W-57** `agent` · **G2** · Export writes data validation and conditional formatting. Filed by Arpit (Cowork). [detail](open/W-57-export-writes-validation-and-conditional-formats.md)

- 🟡 **W-58** `agent` · **G2** · Write the rules file into the download as Excel's own dropdowns and checks. Waiting on W-57. Filed by Arpit (Cowork). [detail](open/W-58-rules-file-as-excel-dropdowns.md)

- 🟢 **W-60** `agent` · **G2** · Dependent dropdowns: a list that changes with another cell (`INDIRECT`). Filed by Arpit (Cowork). [detail](open/W-60-dependent-dropdowns.md)

- 🟢 **W-61** `agent` · **G2** · Excel Tables: read them by name, resolve `Table[Column]`, and a `@sheetpane/tables` plugin to draw them. Filed by Arpit (Cowork). [detail](open/W-61-excel-tables.md)

- 🟢 **W-62** `agent` · **G2** · Locked cells and sheet protection honoured in Edit. Filed by Arpit (Cowork). [detail](open/W-62-locked-cells-and-protection.md)

- 🟡 **W-63** `agent` · **G3** · New plugin `@sheetpane/compare`: what changed between two versions of a workbook. Waiting on W-51. Filed by Arpit (Cowork). [detail](open/W-63-compare-plugin.md)

- 🟢 **W-64** `agent` · **G3** · An *Edits* view in the errors panel: every change, before → after, revert one. Filed by Arpit (Cowork). [detail](open/W-64-edits-view.md)

- 🟢 **W-65** `agent` · **G3** · The file's SHA-256 on load and on export. Filed by Arpit (Cowork). [detail](open/W-65-file-fingerprint.md)

- 🟢 **W-66** `agent` · **G3** · Open straight at a cell: a `ref` attribute and opt-in links in the URL. Filed by Arpit (Cowork). [detail](open/W-66-link-to-a-cell.md)

- 🟡 **W-67** `agent` · **G3** · A static HTML snippet of a range with its marks, made in Node. Waiting on W-54. Filed by Arpit (Cowork). [detail](open/W-67-static-html-render.md)

### testing

- 🟢 **W-30** `arpit` · Save one tiny sheet from Excel, Google Sheets, LibreOffice and Numbers; an agent then tests `@sheetpane/import` on them (split from W-13). Filed by Arpit (Cowork). [detail](open/W-30-real-app-fixtures.md)

- 🟢 **W-48** `arpit` · Try the skills package in Claude Code, Kiro and Codex: install from the tarballs into a scratch host, one real prompt each, note the result (split from W-35 DoD 8). Filed by Arpit (Cowork). [detail](open/W-48-try-skills-in-each-tool.md)

### record update

### research

---
