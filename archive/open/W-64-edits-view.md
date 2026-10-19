---
type: Handoff
name: W-64
description: "Arpit, 2026-10-19: a tab beside the error list showing every edit in the session, each with its cell, before and after, and its own Revert — Group 3 of the features pdfsuite's spec work needs from sheetpane."
item: W-64
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
closed: 2026-10-19
closed_by: "Claude Code (claude-opus-5-5), lane f"
---

# W-64 — An *Edits* view in the errors panel: every change, before → after, revert one

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | *Edits (n)* tab: sheet!ref, kind, was → now, time; click selects the cell | the user sees what they changed | ✅ |
| 2 | Revert one edit (itself an undoable change) and *Revert all* | a mistake is one click to undo | ✅ |
| 3 | Each edit lists the errors it cleared or raised | the cause of a change in the review is visible | ✅ |

**Arpit, 2026-10-19:** *"look at PDF suite and think about what all features could be needed just from Excel point of view that can be added into sheet pane … consider it built and consider it published. What else?"* — then *"do some research. What can be created as plugin? What should be part of existing packages? Classify it into those and create work items for all of these. Group 1, Group 2, and Group 3."*

**Group 3 — a workbook's life over time.** **Where it lives:** **Existing package — core `@sheetpane/grid` (`<sheetpane-errors>`).**

**Model:** Sonnet: a second list view over the existing change map.

## Goal

A tab beside the error list showing every edit in the session, each with its cell, before and after, and its own Revert.

**Why a host needs it:** pdfsuite (arpitarya/pdf-testing-suite)'s *Sheet-Editor* board shows an *Edits 3* panel: *"Range replaced by one value 0.50–0.75 → 7.14 · F9 · error cleared"*.

**Why here and not elsewhere:** It reads the pane's change map. A fourth element would touch L7, which names the view, edit and error components; a view inside the error component keeps the law intact.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · view | tab, list, keyboard, axe; hidden in View mode with no edits | ✅ *Edits n* after Problems (and Passed / Not checked) in W-50's view switch — in Edit mode always, in View mode only while the pane holds edits; one row per change-map entry, newest first (`store.edits()`): `Sheet!B3 · Value`, was → now as the cell shows it, the time; picking selects the cell, a merge's range, or a whole-sheet edit's tab; ↓ ↑ Home End between rows; 100 rows a page, *Show more*; any other kind (W-52's `structure`) listed as one row by its name; axe clean in Edit and View — `edits.test.ts` |
| 2 · revert | per-row and all; undo stack consistent | ✅ `store.revertEdits(keys?)` — Revert on a row, Revert all in the bar — each one undo step through the one commit, `sheetpane-change` per entry on this element; undo brings the edits back with their times (kept by entry object); focus to the next row's Revert, else the Edits chip; not in View mode or `readonly` — `edits.test.ts` |
| 3 · links | cleared/raised errors per edit | ✅ `store.editEffects(key)` → `{ cleared, raised, matched }`, compared with before the cell first changed (rule, workbook and file errors resolved or gone / newly open; a person's suggestion matched); each a link that opens the error in Problems and selects its cell — `edits.test.ts` |
| 4 · tests · docs | SR-ERRORS; skill `sheetpane-errors`; CHANGELOG | ✅ SR-ERRORS 16, §1 and Consequences; SR-GRID 24 and 9a (`data-sp-edit`, `revert-edit`, `revert-all`); the skill, the grid README, CHANGELOG *Added*; `edits.test.ts` (13); errors / results tests updated for the chip |

## Blockers

None.

## Record affected

SR-ERRORS · SR-GRID (change map read).

## Hazards

- Structure edits (W-52) appear as one entry each, not one per shifted cell.

## Reference

- The classification and grouping: this item's siblings W-50 – W-69, filed together on 2026-10-19.
- The host's side: pdfsuite (arpitarya/pdf-testing-suite) — `work/open/W-46-sheet-viewer.md`, `work/open/W-47-sheet-editor.md`, `records/0101_SPEC-intake.md`, `work/design/Spec-*.dc.html`, `Sheet-Editor.dc.html`.
- The plugin contract: `packages/grid/src/plugins/types.ts` (six hooks, six slots).

## The prompt to paste

```text
Build W-64 in arpitarya/sheetpane. Read CLAUDE.md, work/INTERVIEW.md, then
work/open/W-64-edits-view.md and every record it names. Work through the
Definition of done in order, with a test before each next row. Update the
records, OPEN-WORK.md, IMPLEMENTATION.md, CHANGELOG.md, WORKLOG.md and NOW.md
in the same change. Close by moving the file to archive/open/.
```
