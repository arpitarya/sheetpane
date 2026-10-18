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



- 🟢 **W-35** `agent` · New package `@sheetpane/skills` — 23 agent skills plus Claude, Kiro and Codex entry files, an installer, a drift check; every package depends on it. Filed by Arpit (Cowork). [detail](open/W-35-agent-skills-package.md)

- 🟢 **W-36** `agent` · Every public export documented with TSDoc (summary, params, events, one `@example`, a link to its record); a test fails on any undocumented export. Filed by Arpit (Cowork). [detail](open/W-36-tsdoc-public-api.md)

- 🟢 **W-37** `agent` · Ship `custom-elements.json` for the elements; generate VS Code / JetBrains editor data and React, Vue, Svelte, Solid typings from it; a test keeps the manifest equal to the code. Filed by Arpit (Cowork). [detail](open/W-37-custom-elements-manifest.md)

- 🟢 **W-38** `agent` · Generate `llms.txt` (index) and `llms-full.txt` (everything) from the READMEs, records and skills; ship them in the repo and in `@sheetpane/grid`; a test fails when they are stale. Filed by Arpit (Cowork). [detail](open/W-38-llms-txt.md)

- 🟡 **W-39** `agent` · New package `@sheetpane/mcp`: a stdio MCP server with deterministic tools (describe the API, inspect a workbook, draft and check rules, explain an error code); registered for Claude, Kiro and Codex by the skills installer. — waiting on W-37. Filed by Arpit (Cowork). [detail](open/W-39-mcp-server.md)


- 🟢 **W-43** `agent` · `npm create sheetpane` scaffolds a working host (vanilla, React, Next.js, Vue, Angular, Svelte): grid + errors in a tab, sample and rules files, one test, skills installed; CI builds every template. Filed by Arpit (Cowork). [detail](open/W-43-create-sheetpane.md)

- 🟢 **W-44** `agent` · Deploy the demo gallery to GitHub Pages on every release; an Open-in-StackBlitz link per starter template; linked from every README. Filed by Arpit (Cowork). [detail](open/W-44-live-playground.md)

- 🟡 **W-45** `agent` · Invocable commands (`/sheetpane-embed`, `/sheetpane-rules`, `/sheetpane-test`), hooks that check a rules file on save (Claude Code, Kiro), and the agent set as a Claude Code plugin + marketplace. — waiting on W-35. Filed by Arpit (Cowork). [detail](open/W-45-agent-commands-hooks-plugin.md)

### testing

- 🟢 **W-30** `arpit` · Save one tiny sheet from Excel, Google Sheets, LibreOffice and Numbers; an agent then tests `@sheetpane/import` on them (split from W-13). Filed by Arpit (Cowork). [detail](open/W-30-real-app-fixtures.md)

- 🟢 **W-41** `agent` · New package `@sheetpane/testing`: Playwright and Vitest-browser helpers — cell and error-row locators, `waitForLoad`, `edit`, `readDownload` (parses the .xlsx/.csv) — so hosts can test their integration. Filed by Arpit (Cowork). [detail](open/W-41-testing-package.md)


### record update

### research



---
