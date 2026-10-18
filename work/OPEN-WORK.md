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


- 🟢 **W-33** `agent` · A rules file (JSON, per sheet / column / cell) checked on render; failures only in the errors panel; `flagging="off"` hides Flag issue and pop-ups; a Rules file demo tab. Its demo tab goes into W-32's gallery. Filed by Arpit (Cowork). [detail](open/W-33-rules-file.md)

- 🟢 **W-35** `agent` · New package `@sheetpane/skills` — 16 agent skills plus Claude, Kiro and Codex entry files, an installer, a drift check; every package depends on it. Filed by Arpit (Cowork). [detail](open/W-35-agent-skills-package.md)

### testing

- 🟢 **W-30** `arpit` · Save one tiny sheet from Excel, Google Sheets, LibreOffice and Numbers; an agent then tests `@sheetpane/import` on them (split from W-13). Filed by Arpit (Cowork). [detail](open/W-30-real-app-fixtures.md)

### record update

### research



---
