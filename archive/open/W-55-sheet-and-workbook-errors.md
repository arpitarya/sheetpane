---
type: Handoff
name: W-55
description: "Arpit, 2026-10-19: an error with no cell — sheet-level or workbook-level — listed at the top, counted on its tab, never forced onto A1 — Group 1 of the features pdfsuite's spec work needs from sheetpane."
item: W-55
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
closed: 2026-10-19
closed_by: "Claude Code (claude-opus-5-5), lane a"
---

# W-55 — Errors that belong to a whole sheet or the whole workbook, not a cell

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | `range: ''` means the whole sheet; `sheet: ''` and `range: ''` mean the workbook | every finding has an honest home | ✅ |
| 2 | List: a *Workbook* group, then each sheet's sheet-level errors, above the cell errors; *Show in sheet* opens the tab or is disabled | the biggest problems are read first | ✅ |
| 3 | Comments plugin skips them (no cell to attach to) and says so; W-59's review sheet lists them | nothing is dropped silently | ✅ comments · → W-59 |

**Arpit, 2026-10-19:** *"look at PDF suite and think about what all features could be needed just from Excel point of view that can be added into sheet pane … consider it built and consider it published. What else?"* — then *"do some research. What can be created as plugin? What should be part of existing packages? Classify it into those and create work items for all of these. Group 1, Group 2, and Group 3."*

**Group 1 — the host's review flow cannot work without it.** **Where it lives:** **Existing package — core `@sheetpane/grid` (`<sheetpane-errors>` and the schema).**

**Model:** Sonnet: a schema relaxation and two list groups.

## Goal

An error with no cell — sheet-level or workbook-level — listed at the top, counted on its tab, never forced onto A1.

**Why a host needs it:** pdfsuite (arpitarya/pdf-testing-suite) SR-SPEC-INTAKE decision 13: *"no Pages List"* and *"a listed tab with no sheet"* belong to the workbook, not to a cell.

**Why here and not elsewhere:** `range` is required in the error schema today; only the schema owner can relax it.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · schema | types and docs; existing errors unaffected | ✅ `errorScope` / `ErrorScope`; `found` `''`, never stale, nothing written for "Also change the cell"; whole-sheet `validate` drafts resolve themselves — `store.test.ts` |
| 2 · list | groups, counts, keyboard order, axe | ✅ Workbook → each sheet's *whole sheet* → *Cells*; tab count (its label names the whole-sheet ones); Show in sheet opens the tab / disabled with a reason; no pin, no mark; stepping skips them — `errors.test.ts` (5) |
| 3 · export | comments skip with an SP code note; listed in the review sheet when W-59 exists | ✅ `lastExport.skipped` `{ reason: 'no-cell', code: 'SP-5804' }` — `write.test.ts`; the review sheet → W-59 (its DoD 3 already lists them) |
| 4 · tests · docs | unit + browser; skill `sheetpane-errors`; CHANGELOG | ✅ skill, grid README, `docs/ERRORS.md`, CHANGELOG *Added* / *Changed* |

## Blockers

None.

## Record affected

SR-ERRORS · SR-COMMENTS · SR-CODES.

## Hazards

- Hosts that parse `range` as A1 must handle `''` — CHANGELOG *Changed*.

## Reference

- The classification and grouping: this item's siblings W-50 – W-69, filed together on 2026-10-19.
- The host's side: pdfsuite (arpitarya/pdf-testing-suite) — `work/open/W-46-sheet-viewer.md`, `work/open/W-47-sheet-editor.md`, `records/0101_SPEC-intake.md`, `work/design/Spec-*.dc.html`, `Sheet-Editor.dc.html`.
- The plugin contract: `packages/grid/src/plugins/types.ts` (six hooks, six slots).

## The prompt to paste

```text
Build W-55 in arpitarya/sheetpane. Read CLAUDE.md, work/INTERVIEW.md, then
work/open/W-55-sheet-and-workbook-errors.md and every record it names. Work through the
Definition of done in order, with a test before each next row. Update the
records, OPEN-WORK.md, IMPLEMENTATION.md, CHANGELOG.md, WORKLOG.md and NOW.md
in the same change. Close by moving the file to archive/open/.
```
