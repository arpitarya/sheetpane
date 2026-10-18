---
type: Handoff
name: W-56
description: "Arpit, 2026-10-19: `sheetpane-hover` as the pointer crosses cells, and `highlight(ranges)` to outline cells from outside without selecting them — Group 1 of the features pdfsuite's spec work needs from sheetpane."
item: W-56
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-56 — A hover event and a host highlight that does not move the selection

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | `sheetpane-hover` `{ sheet, ref } | null`, throttled to one per frame, pointer only | a host can follow the pointer | ⏳ |
| 2 | `highlight(ranges, { tone, label })` / `clearHighlight()`: a pass-through outline on the overlay layer, not a change, not in undo, not exported | a host can point at cells | ⏳ |
| 3 | Scroll into view on request (`{ reveal: true }`) | the highlighted cell is visible | ⏳ |

**Arpit, 2026-10-19:** *"look at PDF suite and think about what all features could be needed just from Excel point of view that can be added into sheet pane … consider it built and consider it published. What else?"* — then *"do some research. What can be created as plugin? What should be part of existing packages? Classify it into those and create work items for all of these. Group 1, Group 2, and Group 3."*

**Group 1 — the host's review flow cannot work without it.** **Where it lives:** **Existing package — core `@sheetpane/grid`.**

**Model:** Sonnet: one event and one method on the existing overlay layer.

## Goal

`sheetpane-hover` as the pointer crosses cells, and `highlight(ranges)` to outline cells from outside without selecting them.

**Why a host needs it:** pdfsuite (arpitarya/pdf-testing-suite)'s *Spec-Results* board: *"select a cell or a box — the other follows"*. Hovering a PDF box should outline its cell, and hovering a cell its box, without stealing the selection.

**Why here and not elsewhere:** Events and element methods are the core's public surface. A host could draw outlines with its own overlay plugin, but it would re-implement geometry and redraw timing; one core method is smaller and testable.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · event | typed in `elements.d.ts` and the manifest; never fires on touch | ⏳ |
| 2 · method | tones `info · pass · fail`; several ranges; cleared on sheet switch unless pinned | ⏳ |
| 3 · a11y | the highlight's label is announced via the status line once | ⏳ |
| 4 · tests · docs | browser tests; skills `sheetpane-events`, `sheetpane-react`; CHANGELOG | ⏳ |

## Blockers

None.

## Record affected

SR-GRID.

## Hazards

- Throttle: a fast pointer over a 250,000-row sheet must not drop frames (W-46's budget).

## Reference

- The classification and grouping: this item's siblings W-50 – W-69, filed together on 2026-10-19.
- The host's side: pdfsuite (arpitarya/pdf-testing-suite) — `work/open/W-46-sheet-viewer.md`, `work/open/W-47-sheet-editor.md`, `records/0101_SPEC-intake.md`, `work/design/Spec-*.dc.html`, `Sheet-Editor.dc.html`.
- The plugin contract: `packages/grid/src/plugins/types.ts` (six hooks, six slots).

## The prompt to paste

```text
Build W-56 in arpitarya/sheetpane. Read CLAUDE.md, work/INTERVIEW.md, then
work/open/W-56-hover-and-highlight.md and every record it names. Work through the
Definition of done in order, with a test before each next row. Update the
records, OPEN-WORK.md, IMPLEMENTATION.md, CHANGELOG.md, WORKLOG.md and NOW.md
in the same change. Close by moving the file to archive/open/.
```
