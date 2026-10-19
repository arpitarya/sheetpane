---
type: Handoff
name: W-58
description: "Arpit, 2026-10-19: an export option that turns a host's JSON rules file into the workbook's own data validation, so people working in Excel see the same rules — Group 2 of the features pdfsuite's spec work needs from sheetpane."
item: W-58
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Claude Code (claude-opus-5-5), closed"
ball: agent
---

# W-58 — Write the rules file into the download as Excel's own dropdowns and checks

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Map rules to validation: `valid` lists → list rule; numeric bounds → whole/decimal; dates → date; regex and anything inexpressible → skipped and listed | one rules file, two places it works | ✅ |
| 2 | Download menu option *Write rules as Excel dropdowns* (`exportOptions.rulesAsValidation`) | the host or user chooses | ✅ |
| 3 | Parity: export with rules → re-import → the validation plugin flags the same cells the rules engine flags | Excel and sheetpane agree | ✅ (Excel itself → W-30) |

**Arpit, 2026-10-19:** *"look at PDF suite and think about what all features could be needed just from Excel point of view that can be added into sheet pane … consider it built and consider it published. What else?"* — then *"do some research. What can be created as plugin? What should be part of existing packages? Classify it into those and create work items for all of these. Group 1, Group 2, and Group 3."*

**Group 2 — writing the files a host hands back.** **Where it lives:** **Existing plugin — `@sheetpane/validation`** (it owns data validation), as an `exportPatch` export option.

**Model:** Sonnet: a mapping from one rule format to another, with a parity test.

## Goal

An export option that turns a host's JSON rules file into the workbook's own data validation, so people working in Excel see the same rules.

**Why a host needs it:** pdfsuite (arpitarya/pdf-testing-suite)'s spec workbook should stop mistakes before upload *and* after: one rules source for the browser check and the Excel dropdowns.

**Why here and not elsewhere:** It is a pure export-time addition through the `exportPatch` context, and validation is the plugin that already speaks `<dataValidations>`.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · mapping | a table in SR-VALIDATION of what maps and what is skipped, with SP codes | ✅ SR-VALIDATION decision 9's table; `validationOf(rule)` (`packages/validation/src/write.ts`): `oneOf` / `equals` → list, `integer` / `number` / bounds → whole / decimal, `date` → date (`DATE()` or a serial), lengths → textLength, `boolean` → TRUE, FALSE, `required` → blank not allowed; `pattern`, `noneOf`, `unique` SP-5401, two checks SP-5402, a list Excel cannot type out SP-5403, an unreadable bound SP-5404, a missing column or sheet SP-5405. `rulesAsValidations(store)` places them (a column from under its titles to the last row, a cell rule its range) and merges: the workbook's own rule keeps its cells (SP-5406, listed), the same check joins it instead of repeating; `x14` rules left in `extLst`; a sheet whose own rules export refuses keeps its block (SP-5407) |
| 2 · option | export option; the skipped list on the console and status line (B-032: plugins cannot add to event details) | ✅ `validation()` provides `exportPatch` with `exportOptions: [{ key: 'rulesAsValidation', label: 'Write rules as Excel dropdowns', default: false, applies }]` (`validation({ rulesAsValidation: true })` sets the default); the grid's new `ExportOption.applies(store)` hides the switch without rules and makes Download export an untouched workbook while it is on (SR-GRID 10, 17); one console warning per rule not written, with its code; `lastRulesWrite(book)`; the status line adds "k rules not written to Excel" (`export()` now re-renders) |
| 3 · parity | on the fixtures' rules sample | ✅ `showcase.xlsx` + `showcase.rules.json`, with edits: exported with the rules, re-opened with the validation plugin alone, it flags exactly the rules engine's cells but for Account's pattern (not written) — 7 cells on Validation and Formulas; Status joined the file's own list, Units kept the file's own `whole > 0` on C2:C5. Opening the file in Excel and LibreOffice → W-30 (DoD 3) |
| 4 · tests · docs | skill `sheetpane-rules-file`; CHANGELOG | ✅ `packages/validation/test/write.test.ts` (16); the `sheetpane-rules-file` and `sheetpane-plugin-author` skills; the validation README; SR-VALIDATION 1, 9; SR-GRID 10, 17; SR-CODES; docs/ERRORS.md (SP-5401 – SP-5407); `llms-full.txt`; CHANGELOG |

## Blockers

None. W-57 closed 2026-10-19: `patchXlsx`'s `dataValidations` option, and `setDataValidations(xml, rules)` for an `exportPatch` hook, write the rules (SR-EXPORT decision 3).

## Record affected

SR-VALIDATION · SR-GRID (rules file).

## Hazards

- Existing validation on the same cells: merge, never duplicate; the file's own rule wins and the conflict is listed.

## Reference

- The classification and grouping: this item's siblings W-50 – W-69, filed together on 2026-10-19.
- The host's side: pdfsuite (arpitarya/pdf-testing-suite) — `work/open/W-46-sheet-viewer.md`, `work/open/W-47-sheet-editor.md`, `records/0101_SPEC-intake.md`, `work/design/Spec-*.dc.html`, `Sheet-Editor.dc.html`.
- The plugin contract: `packages/grid/src/plugins/types.ts` (six hooks, six slots).

## The prompt to paste

```text
Build W-58 in arpitarya/sheetpane. Read CLAUDE.md, work/INTERVIEW.md, then
work/open/W-58-rules-file-as-excel-dropdowns.md and every record it names. Work through the
Definition of done in order, with a test before each next row. Update the
records, OPEN-WORK.md, IMPLEMENTATION.md, CHANGELOG.md, WORKLOG.md and NOW.md
in the same change. Close by moving the file to archive/open/.
```
