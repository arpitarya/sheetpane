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
| 🔴 **W-44** — **no `NPM_TOKEN`** (the decider, 2026-10-19): publish `0.1.0` **once** from a terminal (`npm login`, then `pnpm -r publish --access public` from a green, tagged tree); an agent then adds a *trusted publisher* (GitHub Actions · `arpitarya/sheetpane` · `release.yml`) to each package on npmjs.com and switches `release.yml` to OIDC. Pages is **on** (source *GitHub Actions*, `github-pages` environment exists). CI must be green first. An agent then checks npm, the playground and the starters load and closes W-44 | 2026-10-18 | 1 d |
| ↳ **blocks:** W-44 (closing only — everything is built) | | |

---

## Open items

### build

- 🟡 **W-44** `agent` · Deploy the demo gallery to GitHub Pages on every release; an Open-in-StackBlitz link per starter template; linked from every README. Built: the Pages job, the starters with their StackBlitz links, the links in every README, `llms.txt` and the setup skill (SR-BUILD 8, 8b). — and the release pipeline (`release.yml`, SR-BUILD 9); `v0.1.0` tagged. Waiting on the decider: the `NPM_TOKEN` secret and Pages enabled, the tag's runs re-run, then an agent checks npm, the playground and the starters load. Filed by Arpit (Cowork). [detail](open/W-44-live-playground.md)

### testing

- 🟢 **W-30** `arpit` · Save one tiny sheet from Excel, Google Sheets, LibreOffice and Numbers; an agent then tests `@sheetpane/import` on them (split from W-13). Filed by Arpit (Cowork). [detail](open/W-30-real-app-fixtures.md)

- 🟢 **W-48** `arpit` · Try the skills package in Claude Code, Kiro and Codex: install from the tarballs into a scratch host, one real prompt each, note the result (split from W-35 DoD 8). Filed by Arpit (Cowork). [detail](open/W-48-try-skills-in-each-tool.md)

### record update

### research

---
