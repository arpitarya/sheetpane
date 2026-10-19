---
type: Handoff
name: W-67
description: "Arpit, 2026-10-19: `renderStatic(book, { sheet, range, errors })` returns a self-contained HTML table — formats, styles, merges and marks — for reports and email — Group 3 of the features pdfsuite's spec work needs from sheetpane."
item: W-67
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-67 — A static HTML snippet of a range with its marks, made in Node

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | `renderStatic` → one `<table>` string, inline CSS from the tokens, merges, hidden rows and columns honoured | a report shows the sheet | ⏳ |
| 2 | Runs `format` (numfmt) and `decorate` (styles, condfmt) hooks headlessly; marks with glyphs and labels | it looks like the grid | ⏳ |
| 3 | No script; every value escaped; light and dark | safe in any report or mail | ⏳ |

**Arpit, 2026-10-19:** *"look at PDF suite and think about what all features could be needed just from Excel point of view that can be added into sheet pane … consider it built and consider it published. What else?"* — then *"do some research. What can be created as plugin? What should be part of existing packages? Classify it into those and create work items for all of these. Group 1, Group 2, and Group 3."*

**Group 3 — a workbook's life over time.** **Where it lives:** **Existing package — core `@sheetpane/grid`, new sub-path `@sheetpane/grid/static`.**

**Model:** Opus: it runs the format and decorate hooks with no DOM and must match the grid's look.

## Goal

`renderStatic(book, { sheet, range, errors })` returns a self-contained HTML table — formats, styles, merges and marks — for reports and email.

**Why a host needs it:** pdfsuite (arpitarya/pdf-testing-suite) SR-REPORT-HTML: the CLI's report.html should show the sheet around each finding, the way the tab does (L3).

**Why here and not elsewhere:** It must apply the same `format` and `decorate` hooks and the same tokens as the live grid; a separate package would drift from it.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · entry | `@sheetpane/grid/static`, DOM-free (same import-graph test as W-54) | ⏳ |
| 2 · fidelity | snapshot tests against the grid's computed styles on the fixtures | ⏳ |
| 3 · safety | escaping fuzz test | ⏳ |
| 4 · tests · docs | SR-GRID; skill `sheetpane-backend`; CHANGELOG | ⏳ |

## Blockers

None. W-54 (the DOM-free split) closed on 2026-10-19: `@sheetpane/grid/check` and its import-graph test (`test/check-entries.test.ts`) are the pattern for `/static`.

## Record affected

SR-GRID · SR-BUILD (exports).

## Hazards

- Plugins that need the DOM (`overlay`: images, charts) are skipped and listed — static output says so.

## Reference

- The classification and grouping: this item's siblings W-50 – W-69, filed together on 2026-10-19.
- The host's side: pdfsuite (arpitarya/pdf-testing-suite) — `work/open/W-46-sheet-viewer.md`, `work/open/W-47-sheet-editor.md`, `records/0101_SPEC-intake.md`, `work/design/Spec-*.dc.html`, `Sheet-Editor.dc.html`.
- The plugin contract: `packages/grid/src/plugins/types.ts` (six hooks, six slots).

## The prompt to paste

```text
Build W-67 in arpitarya/sheetpane. Read CLAUDE.md, work/INTERVIEW.md, then
work/open/W-67-static-html-render.md and every record it names. Work through the
Definition of done in order, with a test before each next row. Update the
records, OPEN-WORK.md, IMPLEMENTATION.md, CHANGELOG.md, WORKLOG.md and NOW.md
in the same change. Close by moving the file to archive/open/.
```
