---
type: Handoff
name: W-61
description: "Arpit, 2026-10-19: Excel's tables (ListObjects) read on import, their structured references resolved for list sources, and a new plugin drawing their header and banding — Group 2 of the features pdfsuite's spec work needs from sheetpane."
item: W-61
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-61 — Excel Tables: read them by name, resolve `Table[Column]`, and a `@sheetpane/tables` plugin to draw them

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Import: `ImportedSheet.tables` — name, ref, header/totals rows, columns, style name and flags | a host can find *Units* by name | ✅ |
| 2 | Resolve `Units[Name]` and `Units[[#Data],[Name]]` to a range, used by validation lists (and W-60) | dropdowns follow the table | ✅ |
| 3 | `@sheetpane/tables`: header row, banded rows/columns and totals row from a subset of built-in table styles | tables look like tables | ✅ |
| 4 | Export keeps table parts; W-52 shifts their `ref` | nothing breaks on download | ✅ kept (a test); the shift → W-52 |

**Arpit, 2026-10-19:** *"look at PDF suite and think about what all features could be needed just from Excel point of view that can be added into sheet pane … consider it built and consider it published. What else?"* — then *"do some research. What can be created as plugin? What should be part of existing packages? Classify it into those and create work items for all of these. Group 1, Group 2, and Group 3."*

**Group 2 — writing the files a host hands back.** **Where it lives:** **Existing package `@sheetpane/import` (read) + new plugin `@sheetpane/tables` (draw)**; the structured-reference resolver goes in `@sheetpane/export`'s ref utilities.

**Model:** Sonnet: a reader addition, a reference resolver and a draw-only plugin.

## Goal

Excel's tables (ListObjects) read on import, their structured references resolved for list sources, and a new plugin drawing their header and banding.

**Why a host needs it:** pdfsuite (arpitarya/pdf-testing-suite)'s Lists sheet holds vocabularies (units, parameters, colours) that grow; a table keeps a dropdown's source right when rows are added, where a fixed range goes stale.

**Why here and not elsewhere:** Reading parts is the reader's job. Drawing a table style is optional decoration through `decorate`, which is what plugins are for.

## Research (2026-10-19)

A table is its own part (`xl/tables/tableN.xml`) linked from the worksheet's `<tableParts>`, with `name`, `ref`, header and totals row counts, `<tableColumns>` and a `tableStyleInfo` (Microsoft Learn, *Working with tables*).

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · import | parts read; the built-in XML reader matches | ✅ `ImportedSheet.tables` (`name` = displayName, `id`, `ref`, header/totals counts, columns with totals label/function, `style`, `autoFilter?`, `path`), in `<tableParts>` order, a missing part skipped; CSV `[]`; minixml parity — `packages/import/test/tables.test.ts` (5), `minixml.test.ts` |
| 2 · refs | resolver in `@sheetpane/export` with unit tests | ✅ `resolveStructuredRef(formula, sheets)` in `refs.ts` (columns, spans, `#Data/#Headers/#Totals/#All`, escapes, `Table[]`, bare name; `#This Row` and unions → undefined) — `structured.test.ts` (7); validation list sources resolve it directly and through a defined name, re-exported by the grid — `validate.test.ts` (3 new) |
| 3 · plugin | `packages/tables`, README, skill, demo (L10), new record SR-TABLES | ✅ `@sheetpane/tables` (`tables()`, `tableAt`, `findTable`, `tableCss`, `paletteOf`, `TABLE_STYLES`) — Light/Medium 1–7 from the theme, else a bold header; styles and condfmt draw over it; `tables.test.ts` (12); the `sheetpane-plugins` skill row; gallery tab "Tables" in both demos with a demo-check step (53 ✓); SR-TABLES (0122) |
| 4 · tests · docs | fixture with two tables; SR-IMPORT, SR-VALIDATION; CHANGELOG | ✅ the showcase's Tables sheet (Units, Readings with a totals row, a list over `Units[Unit]` via `UnitList`); SR-IMPORT 11, SR-VALIDATION 3–4, SR-EXPORT 9a, SR-GRID 19, SR-STYLES 1, SR-CONDFMT 1, SR-FIXTURES 2, SR-MCP, SR-TESTING, SR-SKILLS 1, SR-BUILD 11a; CHANGELOG. **Not done:** a table workbook saved by Excel and a download opened in Excel — W-30 DoD 6 |

## Blockers

None.

## Record affected

SR-IMPORT · SR-VALIDATION · SR-EXPORT (ref utilities) · new SR-TABLES.

## Hazards

- Table styles are many; ship a named subset and fall back to header-bold only, listed in the record.

## Reference

- The classification and grouping: this item's siblings W-50 – W-69, filed together on 2026-10-19.
- The host's side: pdfsuite (arpitarya/pdf-testing-suite) — `work/open/W-46-sheet-viewer.md`, `work/open/W-47-sheet-editor.md`, `records/0101_SPEC-intake.md`, `work/design/Spec-*.dc.html`, `Sheet-Editor.dc.html`.
- The plugin contract: `packages/grid/src/plugins/types.ts` (six hooks, six slots).

## The prompt to paste

```text
Build W-61 in arpitarya/sheetpane. Read CLAUDE.md, work/INTERVIEW.md, then
work/open/W-61-excel-tables.md and every record it names. Work through the
Definition of done in order, with a test before each next row. Update the
records, OPEN-WORK.md, IMPLEMENTATION.md, CHANGELOG.md, WORKLOG.md and NOW.md
in the same change. Close by moving the file to archive/open/.
```
