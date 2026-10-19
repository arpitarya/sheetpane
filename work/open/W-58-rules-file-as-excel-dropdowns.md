---
type: Handoff
name: W-58
description: "Arpit, 2026-10-19: an export option that turns a host's JSON rules file into the workbook's own data validation, so people working in Excel see the same rules — Group 2 of the features pdfsuite's spec work needs from sheetpane."
item: W-58
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-58 — Write the rules file into the download as Excel's own dropdowns and checks

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Map rules to validation: `valid` lists → list rule; numeric bounds → whole/decimal; dates → date; regex and anything inexpressible → skipped and listed | one rules file, two places it works | ⏳ |
| 2 | Download menu option *Write rules as Excel dropdowns* (`exportOptions.rulesAsValidation`) | the host or user chooses | ⏳ |
| 3 | Parity: export with rules → re-import → the validation plugin flags the same cells the rules engine flags | Excel and sheetpane agree | ⏳ |

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
| 1 · mapping | a table in SR-VALIDATION of what maps and what is skipped, with SP codes | ⏳ |
| 2 · option | export option; the skipped list on the console and status line (B-032: plugins cannot add to event details) | ⏳ |
| 3 · parity | on the fixtures' rules sample | ⏳ |
| 4 · tests · docs | skill `sheetpane-rules-file`; CHANGELOG | ⏳ |

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
