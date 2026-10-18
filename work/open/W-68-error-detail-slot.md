---
type: Handoff
name: W-68
description: "Arpit, 2026-10-19: an error can carry host data (`meta`) and the host can render extra detail — a PDF crop, measured vs expected — in the card and list row — Group 3 of the features pdfsuite's spec work needs from sheetpane."
item: W-68
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-68 — Room in the error card for the host: `meta` on an error and a `renderDetail` hook

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | `SheetpaneError.meta` — JSON, round-tripped by save/restore, never written into the file | host data travels with the error | ⏳ |
| 2 | `renderDetail(error) → Node | string` on both elements; strings are text, Nodes are the host's own | the host decides what shows | ⏳ |
| 3 | Placed in a `part="detail"` region, focus order after the message | styled and reachable | ⏳ |

**Arpit, 2026-10-19:** *"look at PDF suite and think about what all features could be needed just from Excel point of view that can be added into sheet pane … consider it built and consider it published. What else?"* — then *"do some research. What can be created as plugin? What should be part of existing packages? Classify it into those and create work items for all of these. Group 1, Group 2, and Group 3."*

**Group 3 — a workbook's life over time.** **Where it lives:** **Existing package — core `@sheetpane/grid` (both elements).**

**Model:** Sonnet: one property and one field.

## Goal

An error can carry host data (`meta`) and the host can render extra detail — a PDF crop, measured vs expected — in the card and list row.

**Why a host needs it:** pdfsuite (arpitarya/pdf-testing-suite): a failed cell's card should show the PDF crop and *"the PDF measures 6.63 in, outside ± 0.06 in"* beside the cell's value.

**Why here and not elsewhere:** The card and list row are inside the elements' shadow roots; only the core can open a place in them.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · schema | `meta` typed; size cap with SP code | ⏳ |
| 2 · render | card and list row; re-render on error change | ⏳ |
| 3 · a11y | focus order, axe | ⏳ |
| 4 · tests · docs | SR-ERRORS; skill `sheetpane-errors`; CHANGELOG | ⏳ |

## Blockers

None.

## Record affected

SR-ERRORS · SR-GRID · SR-CODES.

## Hazards

- A host Node is trusted host code; a string is never parsed as HTML.

## Reference

- The classification and grouping: this item's siblings W-50 – W-69, filed together on 2026-10-19.
- The host's side: pdfsuite (arpitarya/pdf-testing-suite) — `work/open/W-46-sheet-viewer.md`, `work/open/W-47-sheet-editor.md`, `records/0101_SPEC-intake.md`, `work/design/Spec-*.dc.html`, `Sheet-Editor.dc.html`.
- The plugin contract: `packages/grid/src/plugins/types.ts` (six hooks, six slots).

## The prompt to paste

```text
Build W-68 in arpitarya/sheetpane. Read CLAUDE.md, work/INTERVIEW.md, then
work/open/W-68-error-detail-slot.md and every record it names. Work through the
Definition of done in order, with a test before each next row. Update the
records, OPEN-WORK.md, IMPLEMENTATION.md, CHANGELOG.md, WORKLOG.md and NOW.md
in the same change. Close by moving the file to archive/open/.
```
