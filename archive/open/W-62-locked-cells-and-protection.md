---
type: Handoff
name: W-62
description: "Arpit, 2026-10-19: a protected sheet's locked cells refuse edits, its unlocked cells stay editable, and workbook structure protection blocks structural edits — Group 2 of the features pdfsuite's spec work needs from sheetpane."
item: W-62
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-62 — Locked cells and sheet protection honoured in Edit

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Import: `<sheetProtection>` flags per sheet, `<workbookProtection lockStructure>`, and each xf's `<protection locked hidden>` (default locked) | the file's intent is known | ✅ also row and column formats, so an unlocked column's empty cells stay open |
| 2 | Edit refuses typing, paste and Delete into locked cells of a protected sheet, with an SP code and *"Locked in the file"*; *hidden* formulas show their value only | the file's protection works here too | ✅ SP-3020 |
| 3 | Structure protection disables hide/unhide sheet and W-52's insert/delete | the workbook's shape stays as protected | ✅ hide/unhide; W-52's insert/delete honour `structureLocked()` — wired by the orchestrator at merge |
| 4 | `protection="ignore"` attribute for hosts that rule otherwise, documented as the host's decision | the host stays in charge | ✅ |

**Arpit, 2026-10-19:** *"look at PDF suite and think about what all features could be needed just from Excel point of view that can be added into sheet pane … consider it built and consider it published. What else?"* — then *"do some research. What can be created as plugin? What should be part of existing packages? Classify it into those and create work items for all of these. Group 1, Group 2, and Group 3."*

**Group 2 — writing the files a host hands back.** **Where it lives:** **Existing packages — `@sheetpane/import` (read protection) and core `@sheetpane/grid` (honour it in Edit).** Protect/unprotect editing is a later plugin, out of scope.

**Model:** Sonnet: read two attributes and refuse edits where the file says so.

## Goal

A protected sheet's locked cells refuse edits, its unlocked cells stay editable, and workbook structure protection blocks structural edits.

**Why a host needs it:** pdfsuite (arpitarya/pdf-testing-suite)'s spec workbook: Lists and Settings should not be edited in sheetpane by accident, while Value, Unit and Description stay open.

**Why here and not elsewhere:** Honouring what the file says is the core's job, as with merges, freeze and hidden state (W-49). A plugin has no hook that can refuse an edit.

## Research (2026-10-19)

In Excel every cell is *Locked* by default, and the setting only takes effect once the sheet is protected (Excel's protection guides). Passwords are stored as hashes; sheetpane never checks or removes them.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · import | flags and xf protection read | ✅ `SheetProtection`, `WorkbookProtection`, `CellXf.protection`, `rowStyles` / `colStyles`, `cellProtection()`; the password never read (`hasPassword`); SR-IMPORT 14 |
| 2 · edit | refusals with codes; `sheetpane-editcancel` with `reason: 'locked'` | ✅ typing, Enter/F2, Delete, paste and a range clear refused before `beforechange`, SP-3020; the store refuses too (`setCell`, `setCells`, "Also change the cell"); no value picker on a locked cell; hidden formulas (`input()`, the formulas plugin's `fx` and outlines); SR-GRID 21d |
| 3 · structure | menus disabled with `disabledReason` | ✅ Hide sheet and the banner's Unhide; `setSheetState` refused; `store.structureLocked()` / `structureLockedIn(snap)` is the one predicate — W-52's insert/delete honour `structureLocked()` — wired by the orchestrator at merge |
| 4 · tests · docs | fixture with a protected sheet; SR-IMPORT, SR-GRID, SR-CODES; skill `sheetpane-security`; CHANGELOG | ✅ `@sheetpane/fixtures` `protected.xlsx`; the export keeps `<sheetProtection>` byte for byte (import and grid tests); the Excel-saved check → W-30 DoD 8 |

## Blockers

None.

## Record affected

SR-IMPORT · SR-GRID · SR-CODES.

## Hazards

- Export must keep `<sheetProtection>` untouched — patch already preserves it; prove it with a test.

## Reference

- The classification and grouping: this item's siblings W-50 – W-69, filed together on 2026-10-19.
- The host's side: pdfsuite (arpitarya/pdf-testing-suite) — `work/open/W-46-sheet-viewer.md`, `work/open/W-47-sheet-editor.md`, `records/0101_SPEC-intake.md`, `work/design/Spec-*.dc.html`, `Sheet-Editor.dc.html`.
- The plugin contract: `packages/grid/src/plugins/types.ts` (six hooks, six slots).

## The prompt to paste

```text
Build W-62 in arpitarya/sheetpane. Read CLAUDE.md, work/INTERVIEW.md, then
work/open/W-62-locked-cells-and-protection.md and every record it names. Work through the
Definition of done in order, with a test before each next row. Update the
records, OPEN-WORK.md, IMPLEMENTATION.md, CHANGELOG.md, WORKLOG.md and NOW.md
in the same change. Close by moving the file to archive/open/.
```
