---
type: Handoff
name: W-63
description: "Arpit, 2026-10-19: a new plugin with a headless `diffWorkbooks(a, b)` and a view that marks every added, removed and changed sheet, row and cell — Group 3 of the features pdfsuite's spec work needs from sheetpane."
item: W-63
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Claude Code (claude-opus-5-5), the integration merge"
ball: agent
closed: 2026-10-19
closed_by: "Claude Code (claude-opus-5-5), the integration merge"
---

# W-63 — New plugin `@sheetpane/compare`: what changed between two versions of a workbook

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | `diffWorkbooks(a, b, { key })`: sheets matched by name (renames by content similarity), rows by key columns when given, else aligned by longest common subsequence; cells by value, text and formula; merges, hidden state and rule counts | a precise list of differences, in Node or the browser | ✅ |
| 2 | `/ui`: load a base file; changes become a `compare` layer (W-51) with was → now, and `decorate` tints changed cells | the reader sees the changes on the sheet | ✅ tints, and the changes as the `compare` layer |
| 3 | Summary in the `status` slot: *n sheets · n rows · n cells changed* | the size of the change at a glance | ✅ |
| 4 | An MCP tool `diff_workbooks` on the same function | agents can ask too | ✅ |

**Arpit, 2026-10-19:** *"look at PDF suite and think about what all features could be needed just from Excel point of view that can be added into sheet pane … consider it built and consider it published. What else?"* — then *"do some research. What can be created as plugin? What should be part of existing packages? Classify it into those and create work items for all of these. Group 1, Group 2, and Group 3."*

**Group 3 — a workbook's life over time.** **Where it lives:** **New plugin — `@sheetpane/compare`** (a headless diff at its root, a `/ui` plugin that shows it).

**Model:** Opus: row alignment and sheet matching are real algorithms with property tests and a performance budget.

## Goal

A new plugin with a headless `diffWorkbooks(a, b)` and a view that marks every added, removed and changed sheet, row and cell.

**Why a host needs it:** pdfsuite (arpitarya/pdf-testing-suite): reviewers change the PDF template from the spec workbook, so *"what changed since the last approved spec"* tells them which PDF pages to re-test.

**Why here and not elsewhere:** It reads two imported workbooks and writes errors and decorations — all through existing hooks — and most hosts never need it.

## Research (2026-10-19)

Excel's own *Spreadsheet Compare* runs only on Windows with certain enterprise Office editions (Microsoft Support). `daff` (MIT) diffs tables row by row with a highlighter format — a good reference for row alignment, but it knows nothing of sheets or merges, so sheetpane writes its own.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · diff | pure function, typed result; property tests (diff of x with x is empty; applying the diff to a gives b's values) | ✅ `diff.node.test.ts` (4 fast-check properties, 12 cases) |
| 2 · ui | layer, decorations, status; keyboard to next/previous change | ✅ decorations, status, Alt+F5 / Alt+Shift+F5 (`compare.test.ts`); the changes are the `compare` layer — `publishChanges` calls `setErrors(list, { layer: 'compare' })` with only its entries, the review and undo kept (`compare.test.ts`); `@sheetpane/comments` leaves the layer out of a download unless named (`write.test.ts`) — SR-COMPARE 12, SR-COMMENTS 3 |
| 3 · perf | budget on 50,000 rows recorded on a named machine | ✅ 500 ms budget; 120 / 119 / 138 ms (unkeyed / keyed / every row changed) on an Apple M4, load average 14–17 (`perf.node.test.ts`, SR-COMPARE 7) |
| 4 · package | `packages/compare`, README, skill, demo (L10), new record SR-COMPARE | ✅ SR-COMPARE (0124); `sheetpane-plugins` skill row; gallery tab *Compare* in both demos, demo-check 53 ✓ |
| 5 · tests · docs | fixtures pair; CHANGELOG | ✅ `@sheetpane/fixtures` `compare/base.xlsx` · `compare/now.xlsx` (`fixtures.node.test.ts`, the MCP golden); CHANGELOG |

## Blockers

None. (W-51's layers landed in the integration merge; the `compare` layer was wired there.)

## Record affected

new SR-COMPARE · SR-MCP · SR-BUILD (a new package).

## Hazards

- Row alignment on reordered sheets is ambiguous without a key — say *moved* only when certain, otherwise added + removed.

## Reference

- The classification and grouping: this item's siblings W-50 – W-69, filed together on 2026-10-19.
- The host's side: pdfsuite (arpitarya/pdf-testing-suite) — `work/open/W-46-sheet-viewer.md`, `work/open/W-47-sheet-editor.md`, `records/0101_SPEC-intake.md`, `work/design/Spec-*.dc.html`, `Sheet-Editor.dc.html`.
- The plugin contract: `packages/grid/src/plugins/types.ts` (six hooks, six slots).

## The prompt to paste

```text
Build W-63 in arpitarya/sheetpane. Read CLAUDE.md, work/INTERVIEW.md, then
work/open/W-63-compare-plugin.md and every record it names. Work through the
Definition of done in order, with a test before each next row. Update the
records, OPEN-WORK.md, IMPLEMENTATION.md, CHANGELOG.md, WORKLOG.md and NOW.md
in the same change. Close by moving the file to archive/open/.
```
