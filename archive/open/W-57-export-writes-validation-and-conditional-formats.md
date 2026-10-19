---
type: Handoff
name: W-57
description: "Arpit, 2026-10-19: `@sheetpane/export` writes dropdown/validation rules and conditional formats into a new workbook and into a patched upload — Group 2 of the features pdfsuite's spec work needs from sheetpane."
item: W-57
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Claude Code (claude-opus-5-5), closed"
ball: agent
---

# W-57 — Export writes data validation and conditional formatting

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | `Sheet.dataValidations?` and `Sheet.conditionalFormats?`, the same shapes `@sheetpane/import` reads, written by the `.xlsx` writer (dxfs into `styles.xml`) | a generated template has its dropdowns and red cells | ✅ |
| 2 | `patchXlsx` options `dataValidations` and `conditionalFormats`, whole-block rewrites per sheet, like `merges` | an upload can gain or lose rules | ✅ |
| 3 | Round-trip: `import(export(x))` equals `x` for both tables | what is written is what is read | ✅ |

**Arpit, 2026-10-19:** *"look at PDF suite and think about what all features could be needed just from Excel point of view that can be added into sheet pane … consider it built and consider it published. What else?"* — then *"do some research. What can be created as plugin? What should be part of existing packages? Classify it into those and create work items for all of these. Group 1, Group 2, and Group 3."*

**Group 2 — writing the files a host hands back.** **Where it lives:** **Existing package — `@sheetpane/export`.**

**Model:** Sonnet: two XML writers with a fixed schema order and a round-trip test.

## Goal

`@sheetpane/export` writes dropdown/validation rules and conditional formats into a new workbook and into a patched upload.

**Why a host needs it:** pdfsuite (arpitarya/pdf-testing-suite) SR-SPEC-INTAKE decision 7: Template v2 carries its own guard rails — dropdowns from the Lists sheet and conditional formatting that turns a missing Unit red. pdfsuite (arpitarya/pdf-testing-suite) W-37 generates those workbooks in TypeScript; today export cannot write either.

**Why here and not elsewhere:** Export owns every byte sheetpane writes and has no runtime dependency; a writer elsewhere would be a second writer.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · writer | both blocks in schema order (`conditionalFormatting` before `dataValidations`, after `mergeCells`); dxfs appended | ✅ `Sheet.dataValidations?`, `Sheet.conditionalFormats?`, `Workbook.dxfs?` — import's shapes, now defined in export and re-exported by import; `toXlsx` writes one `<conditionalFormatting>` per format then `<dataValidations>` after `<mergeCells>`, the dxfs as `<dxfs>` after `<cellStyles>`; `showInputMessage` with a prompt; checked first, SP-2015 (`bad-rule`) on what Excel would repair; no rules → bytes as before (SR-EXPORT 1, 2, 6) |
| 2 · patch | options rewrite or remove each block; other sheets untouched | ✅ `patchXlsx` options `dataValidations: [{ sheet, rules }]`, `conditionalFormats: [{ sheet, formats }]`, `dxfs` (appended; a rule's `dxfId` counts the file's first); whole-block rewrite in schema position, `[]` removes, `x14:` rules in `extLst` kept, prefixed namespaces, a package with no style sheet gets one; untouched parts byte for byte; `setDataValidations` / `setConditionalFormats` exported for an `exportPatch` hook (SR-EXPORT 3) |
| 3 · round-trip | fast-check property over generated rules | ✅ `import(toXlsx(x))` and `import(patchXlsx(upload, x))` give the validation, conditional-format and dxf tables back — every rule type, scales, bars, icon sets, dxf fonts, fills (pattern and gradient), borders, number formats, alignment; through DOMParser (`rules.test.ts`) and the built-in XML reader (`rules.node.test.ts`) |
| 4 · real apps | a generated file opens with working dropdowns and formats in Excel and LibreOffice (decider's check) | → W-30 (DoD 3) |
| 5 · tests · docs | SR-EXPORT; README; CHANGELOG | ✅ `packages/export/test/rules.test.ts` (14), `packages/import/test/rules.test.ts` + `rules.node.test.ts` (100 + 100 generated workbooks each); SR-EXPORT 1, 2, 3, 6; SR-IMPORT 2; SR-CODES (SP-2015); docs/ERRORS.md; the export and import READMEs; `llms-full.txt`; CHANGELOG |

## Blockers

None.

## Record affected

SR-EXPORT.

## Hazards

- Schema validation against ECMA-376 is still B-033; structure tests only until it graduates.

## Reference

- The classification and grouping: this item's siblings W-50 – W-69, filed together on 2026-10-19.
- The host's side: pdfsuite (arpitarya/pdf-testing-suite) — `work/open/W-46-sheet-viewer.md`, `work/open/W-47-sheet-editor.md`, `records/0101_SPEC-intake.md`, `work/design/Spec-*.dc.html`, `Sheet-Editor.dc.html`.
- The plugin contract: `packages/grid/src/plugins/types.ts` (six hooks, six slots).

## The prompt to paste

```text
Build W-57 in arpitarya/sheetpane. Read CLAUDE.md, work/INTERVIEW.md, then
work/open/W-57-export-writes-validation-and-conditional-formats.md and every record it names. Work through the
Definition of done in order, with a test before each next row. Update the
records, OPEN-WORK.md, IMPLEMENTATION.md, CHANGELOG.md, WORKLOG.md and NOW.md
in the same change. Close by moving the file to archive/open/.
```
