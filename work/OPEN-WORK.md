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
| **W-35 DoD 8** — try the skills: install from `demo-packed`'s tarballs into a scratch host and give one real prompt per tool (Claude Code, Kiro, Codex), e.g. *"embed sheetpane in a React tab with an errors panel"*; write the prompt, tool version and result in [W-35](open/W-35-agent-skills-package.md) | 2026-10-18 | 0 d |

*The iPhone download check is backlog B-031; the real-app files are W-30 (`arpit` lane).*

---

## Open items

### build

- 🟡 **W-35** `agent` · New package `@sheetpane/skills` — 23 agent skills plus Claude, Kiro and Codex entry files, an installer, a drift check; every package depends on it. Built: all 23 skills, entry files, installer (with the MCP entry), drift check (SR-SKILLS); DoD 8 (a prompt in each tool) is the decider's. Filed by Arpit (Cowork). [detail](open/W-35-agent-skills-package.md)

- 🟢 **W-43** `agent` · `npm create sheetpane` scaffolds a working host (vanilla, React, Next.js, Vue, Angular, Svelte): grid + errors in a tab, sample and rules files, one test, skills installed; CI builds every template. Filed by Arpit (Cowork). [detail](open/W-43-create-sheetpane.md)

- 🟢 **W-44** `agent` · Deploy the demo gallery to GitHub Pages on every release; an Open-in-StackBlitz link per starter template; linked from every README. Filed by Arpit (Cowork). [detail](open/W-44-live-playground.md)

- 🟡 **W-45** `agent` · Invocable commands (`/sheetpane-embed`, `/sheetpane-rules`, `/sheetpane-test`), hooks that check a rules file on save (Claude Code, Kiro), and the agent set as a Claude Code plugin + marketplace. — waiting on W-35. Filed by Arpit (Cowork). [detail](open/W-45-agent-commands-hooks-plugin.md)

- 🟢 **W-46** `agent` · Smooth range selection: one bordered selection layer (no redraw per pointer move), autoscroll, whole rows/columns, Ctrl+Shift+arrows, range copy and Delete, Count·Sum·Average. Filed by Arpit (Cowork). [detail](open/W-46-smooth-range-selection.md)

- 🟡 **W-47** `agent` · Resize columns and rows: drag a header edge, double-click to fit, several at once, a header menu for keys; per-row heights and wrapped text from the file. — waiting on W-46. Filed by Arpit (Cowork). [detail](open/W-47-resize-columns-rows.md)

### testing

- 🟢 **W-30** `arpit` · Save one tiny sheet from Excel, Google Sheets, LibreOffice and Numbers; an agent then tests `@sheetpane/import` on them (split from W-13). Filed by Arpit (Cowork). [detail](open/W-30-real-app-fixtures.md)

### record update

### research

---
