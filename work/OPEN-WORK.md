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
| Place the four `.github/` issue and PR templates — the path is protected from remote writes ([W-71](open/W-71-public-repo-docs.md)) | 2026-10-20 | 0 d |
| ↳ **blocks:** W-71 | | |

---

## Open items

### build

- 🟢 **W-70** `agent` · The nightly Firefox + WebKit run, green: it has never passed (paste and range Delete in Firefox, font-name quoting, fit-to-data widths, an axe rule in WebKit). Filed by Claude Code. [detail](open/W-70-nightly-cross-browser-green.md)

- 🔴 **W-71** `agent` · README, CONTRIBUTING, SECURITY and CODE_OF_CONDUCT landed; blocked on the decider placing the `.github/` templates. Filed by Arpit (Cowork). [detail](open/W-71-public-repo-docs.md)

### testing

- 🟢 **W-30** `arpit` · Save one tiny sheet from Excel, Google Sheets, LibreOffice and Numbers; an agent then tests `@sheetpane/import` on them (split from W-13); also the static HTML of W-67 opened in mail clients (DoD 10). Filed by Arpit (Cowork). [detail](open/W-30-real-app-fixtures.md)

- 🟢 **W-48** `arpit` · Try the skills package in Claude Code, Kiro and Codex: install from the tarballs into a scratch host, one real prompt each, note the result (split from W-35 DoD 8). Filed by Arpit (Cowork). [detail](open/W-48-try-skills-in-each-tool.md)

### record update

### research

---
