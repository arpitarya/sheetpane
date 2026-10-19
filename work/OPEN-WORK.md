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

- 🟢 **W-62** `agent` · **G2** · Locked cells and sheet protection honoured in Edit. Filed by Arpit (Cowork). [detail](open/W-62-locked-cells-and-protection.md)

- 🟢 **W-67** `agent` · **G3** · A static HTML snippet of a range with its marks, made in Node. Filed by Arpit (Cowork). [detail](open/W-67-static-html-render.md)

### testing

- 🟢 **W-30** `arpit` · Save one tiny sheet from Excel, Google Sheets, LibreOffice and Numbers; an agent then tests `@sheetpane/import` on them (split from W-13). Filed by Arpit (Cowork). [detail](open/W-30-real-app-fixtures.md)

- 🟢 **W-48** `arpit` · Try the skills package in Claude Code, Kiro and Codex: install from the tarballs into a scratch host, one real prompt each, note the result (split from W-35 DoD 8). Filed by Arpit (Cowork). [detail](open/W-48-try-skills-in-each-tool.md)

### record update

### research

---
