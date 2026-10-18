---
type: Handoff
name: W-60
description: "Arpit, 2026-10-19: the validation plugin resolves `INDIRECT(<cell>)` list sources, so a Unit list follows the Parameter chosen — Group 2 of the features pdfsuite's spec work needs from sheetpane."
item: W-60
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-60 — Dependent dropdowns: a list that changes with another cell (`INDIRECT`)

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | `INDIRECT` of a cell (relative parts shift per row) or a quoted string, resolving the cell's text to a defined name, a table column (W-61) or an A1 range | the list arrow offers the right choices per row | ⏳ |
| 2 | When the parent cell changes, re-check the dependent cells; an orphaned child becomes a warning | a stale unit is caught | ⏳ |
| 3 | Anything else (`OFFSET`, concatenation) stays skipped with its reason | no guessing | ⏳ |

**Arpit, 2026-10-19:** *"look at PDF suite and think about what all features could be needed just from Excel point of view that can be added into sheet pane … consider it built and consider it published. What else?"* — then *"do some research. What can be created as plugin? What should be part of existing packages? Classify it into those and create work items for all of these. Group 1, Group 2, and Group 3."*

**Group 2 — writing the files a host hands back.** **Where it lives:** **Existing plugin — `@sheetpane/validation`.**

**Model:** Sonnet: an operand addition inside the validation plugin's evaluator.

## Goal

The validation plugin resolves `INDIRECT(<cell>)` list sources, so a Unit list follows the Parameter chosen.

**Why a host needs it:** pdfsuite (arpitarya/pdf-testing-suite) Template v2: the Lists sheet names each parameter's allowed units; Excel's standard pattern for *Unit depends on Parameter* is a defined name per parameter and `=INDIRECT($E2)` on the Unit column.

**Why here and not elsewhere:** List sources are parsed by the plugin's `parseOperand`; today `INDIRECT` is not a recognised operand, so such rules are skipped.

## Research (2026-10-19)

Excel's dependent drop-down lists are built with named ranges and `INDIRECT` in the data-validation source (Exceljet, Excel Easy).

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · operand | `INDIRECT` parsed, names case-insensitive, sheet-scoped names first | ⏳ |
| 2 · live | parent edit → child re-validated in the same frame | ⏳ |
| 3 · list arrow | the cell menu offers the resolved list | ⏳ |
| 4 · tests · docs | a fixture with names per parameter; SR-VALIDATION; CHANGELOG | ⏳ |

## Blockers

None.

## Record affected

SR-VALIDATION.

## Hazards

- Names with spaces are invalid in Excel; the usual workaround is `SUBSTITUTE` — listed as skipped, not emulated.

## Reference

- The classification and grouping: this item's siblings W-50 – W-69, filed together on 2026-10-19.
- The host's side: pdfsuite (arpitarya/pdf-testing-suite) — `work/open/W-46-sheet-viewer.md`, `work/open/W-47-sheet-editor.md`, `records/0101_SPEC-intake.md`, `work/design/Spec-*.dc.html`, `Sheet-Editor.dc.html`.
- The plugin contract: `packages/grid/src/plugins/types.ts` (six hooks, six slots).

## The prompt to paste

```text
Build W-60 in arpitarya/sheetpane. Read CLAUDE.md, work/INTERVIEW.md, then
work/open/W-60-dependent-dropdowns.md and every record it names. Work through the
Definition of done in order, with a test before each next row. Update the
records, OPEN-WORK.md, IMPLEMENTATION.md, CHANGELOG.md, WORKLOG.md and NOW.md
in the same change. Close by moving the file to archive/open/.
```
