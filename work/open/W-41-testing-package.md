---
type: Handoff
name: W-41
description: "Arpit, 2026-10-18: Playwright and Vitest helpers so a host can test its sheetpane integration — locate cells and error rows through the shadow DOM, wait for load, edit, flag, and read an exported file back."
item: W-41
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-41 — `@sheetpane/testing`: helpers for testing a host app

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Ship locators: `sheet(page, pane).cell('B7')`, `.errorRow(n)`, `.toolbar('Download')` | a host test reads like the UI | ⏳ |
| 2 | Ship actions and waits: `waitForLoad`, `edit(ref, value)`, `flag(ref, text)`, `download()` | no sleeps, no shadow-DOM spelunking | ⏳ |
| 3 | Ship `readDownload()` → the workbook as plain objects, via `@sheetpane/import` | assert what was exported, not that a file appeared | ⏳ |

**Arpit, 2026-10-18:** *"Other than codemods. File work item for everything else. Research and then file work items."* — answering the chat list (same session as [W-35](W-35-agent-skills-package.md)) of what helps a consumer beyond skills.

**Model:** Sonnet — wraps patterns already proven in `scripts/demo-check.mjs`.

## Goal

A host writes `await sp.edit('B2', '42'); expect(await sp.readDownload()).toHaveCell('Sheet1!B2', 42)` and it works in Playwright and Vitest browser mode.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · package | `packages/testing`; `@playwright/test` and `vitest` as optional peers; depends on `@sheetpane/import` | ⏳ |
| 2 · locators | sheet, cell by A1 ref, cell by column title + row, cell bar, toolbar button by name, error row by index or ref, the callout, the context menu — through open shadow roots | ⏳ |
| 3 · actions | `waitForLoad` (on `sheetpane-load`), `select`, `edit`, `paste`, `flag`, `resolve`, `undo`, `switchSheet`, `download()` | ⏳ |
| 4 · reading back | `readDownload()` / `readFile(bytes)` → sheets of values and the change set; matchers `toHaveCell`, `toHaveError` | ⏳ |
| 5 · stable hooks | helpers use roles, labels and `data-sp-*` attributes the grid commits to (listed in SR-GRID) — never CSS classes | ⏳ |
| 6 · dogfood | `scripts/demo-check.mjs` rewritten on these helpers; each starter template ([W-43](W-43-create-sheetpane.md)) ships one test using them | ⏳ |
| 7 · tests | each helper against the HTML demo in Chromium; WebKit and Firefox nightly | ⏳ |
| 8 · record | new record SR-TESTING; SR-GRID lists the committed test hooks | ⏳ |

## Blockers

None.

## Record affected

New **SR-TESTING** (next free number) · [SR-GRID](../../records/0105_GRID.md) (committed test attributes) · [SR-BUILD](../../records/0102_BUILD.md).

## Hazards

- **Test hooks become public API** — once a host relies on `data-sp-ref`, renaming it is breaking. List them in SR-GRID.
- **Playwright locators pierce open shadow roots** (CSS and role); Vitest browser mode differs — test both.

## Research

- Playwright's CSS and role locators pierce open shadow DOM by default; XPath does not.
- Proven patterns today: `scripts/demo-check.mjs` (edit, export read-back, pop-up, refusal) and `packages/*/test/helpers.ts`.

## Reference

- `scripts/demo-check.mjs` · [W-42](W-42-fixtures-package.md) · [W-43](W-43-create-sheetpane.md)

## Prompt — paste into Claude Code

```text
You are building W-41 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, scripts/demo-check.mjs, packages/grid/test/, records/0105_GRID.md and this file
   (work/open/W-41-testing-package.md). Check the state of: W-42, W-43.
2. Plan the helper API and the committed test attributes before writing code. Re-check the external formats linked under Research; note anything that changed.
3. Implement packages/testing and the demo-check rewrite.
4. Verify: just check; every DoD row above. Then do what SR-WORK-DOCS decision 10 says every task owes.
```
