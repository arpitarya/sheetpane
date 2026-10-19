---
type: Handoff
name: W-67
description: "Arpit, 2026-10-19: `renderStatic(book, { sheet, range, errors })` returns a self-contained HTML table — formats, styles, merges and marks — for reports and email — Group 3 of the features pdfsuite's spec work needs from sheetpane."
item: W-67
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Claude Code (claude-opus-5-5), lane d — closed"
ball: agent
---

# W-67 — A static HTML snippet of a range with its marks, made in Node

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | `renderStatic` → one `<table>` string, inline CSS from the tokens, merges, hidden rows and columns honoured | a report shows the sheet | ✅ |
| 2 | Runs `format` (numfmt) and `decorate` (styles, condfmt) hooks headlessly; marks with glyphs and labels | it looks like the grid | ✅ |
| 3 | No script; every value escaped; light and dark | safe in any report or mail | ✅ |

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
| 1 · entry | `@sheetpane/grid/static`, DOM-free (same import-graph test as W-54) | ✅ in `exports` and `publishConfig.exports`; `renderStatic(book, { sheet, range, errors, theme, headers })` with TSDoc and an `@example`; `loadWorkbook(bytes, options)` (on `/check` too: `check()` split into it plus the sort) gives the store; SP-3017 (not a loaded workbook), SP-3018 (unknown sheet, non-A1 range, > 200,000 cells). `test/check-entries.test.ts` walks `/static`'s graph (`excel/geometry.ts`, pure, the one `excel/` module allowed) and renders a CSV in Node; `smoke-built.mjs` renders with the built entry; `pack-check` ✓ |
| 2 · fidelity | snapshot tests against the grid's computed styles on the fixtures | ✅ `packages/fixtures/test/static.test.ts` (Chromium): 6 workbooks (showcase, merged, hidden-sheet, unicode-names, date1904, comma.csv), every sheet, light and dark, numfmt + styles + condfmt + validation + comments, the rules sample and one edit — every cell's text, colours, weight, style, size, alignment, borders, padding, mark ring and tint, changed corner, stale mark, width and height, and every header, equal the grid's computed style; `static.node.test.ts` renders the same in Node and both equal `golden/static.json`. `packages/grid/test/static.test.ts`: ranges, hidden rows/columns, merges, marks, themes, dropped decorate values, derived values, the overlay note, refusals. Mail clients by hand → W-30 (DoD 6) |
| 3 · safety | escaping fuzz test | ✅ fast-check, 150 runs (`packages/grid/test/static.test.ts`): a sheet name, cell text from a `format` hook, `decorate` values, an error's message and type — one `<table>`, allowed elements and attributes only, no URL, script, handler or font, every text read back unchanged; fails when `<` is left unescaped (checked by mutation) |
| 4 · tests · docs | SR-GRID; skill `sheetpane-backend`; CHANGELOG | ✅ SR-GRID 22g (and 22f: `loadWorkbook`); SR-BUILD 5a, 8; SR-FIXTURES 6a; SR-CODES 2; SR-SKILLS 2; skill `sheetpane-backend`; grid README; ARCHITECTURE; GLOSSARY (static table); ERRORS.md; CHANGELOG; `llms*.txt` and `plugins/sheetpane` regenerated |

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
