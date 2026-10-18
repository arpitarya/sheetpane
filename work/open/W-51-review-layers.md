---
type: Handoff
name: W-51
description: "Arpit, 2026-10-19: named layers of errors (e.g. validation and a PDF check) in one pane, each kept whole, the host or user choosing which are shown — Group 1 of the features pdfsuite's spec work needs from sheetpane."
item: W-51
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-51 — Review layers: several sets of errors in one pane, switched without losing any

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | A `layer` field on every error (default `review`); `setErrors(list, { layer })` replaces one layer only; `getErrors({ layer })` | two result sets live side by side | ⏳ |
| 2 | A `layers` property and attribute naming the visible layers; a segmented switch in the errors header when more than one exists | the user flips between them | ⏳ |
| 3 | Cell marks, tab counts, *Show in sheet* and undo follow the visible layers; edits never move an error between layers | every surface shows the same thing (L7) | ⏳ |
| 4 | The saved review envelope carries layers; an old envelope loads into `review` | a restored review is the review that was saved | ⏳ |

**Arpit, 2026-10-19:** *"look at PDF suite and think about what all features could be needed just from Excel point of view that can be added into sheet pane … consider it built and consider it published. What else?"* — then *"do some research. What can be created as plugin? What should be part of existing packages? Classify it into those and create work items for all of these. Group 1, Group 2, and Group 3."*

**Group 1 — the host's review flow cannot work without it.** **Where it lives:** **Existing package — core `@sheetpane/grid`** (the pane store and `<sheetpane-errors>`).

**Model:** Opus: it changes the pane store's shape, the save/restore envelope and what every surface shows (L7).

## Goal

Named layers of errors (e.g. validation and a PDF check) in one pane, each kept whole, the host or user choosing which are shown.

**Why a host needs it:** pdfsuite (arpitarya/pdf-testing-suite)'s Specification tab has a *Validation · PDF check* switch over the same workbook: two result sets that must both survive a switch. Today `setErrors()` replaces the whole review.

**Why here and not elsewhere:** Errors live in the pane's one store (L7, L9). Layers partition that store; a plugin cannot own or partition the store.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · API | `layer` on `SheetpaneError` and `ErrorDraft`; `setErrors`/`getErrors` take a layer; `sheetpane-errors` detail names the layer that changed | ⏳ |
| 2 · switch | `layers` attribute/property; the switch renders only with ≥ 2 layers; keyboard and axe clean | ⏳ |
| 3 · plugins | plugin-written errors land in `review` unless the plugin names a layer; validation and comments keep theirs | ⏳ |
| 4 · export | comments write the visible layers by default, any named set by option | ⏳ |
| 5 · envelope | save → restore round-trip with three layers; a pre-layers envelope restores | ⏳ |
| 6 · tests · docs | store, element and round-trip tests; skills `sheetpane-errors`, `sheetpane-backend`; CHANGELOG | ⏳ |

## Blockers

None.

## Record affected

SR-ERRORS · SR-GRID (the store) · SR-COMMENTS (what export writes).

## Hazards

- Undo across layers: an edit that resolves an error in a hidden layer must still undo cleanly.
- Restore compatibility — the envelope version must bump and old files must load.

## Reference

- The classification and grouping: this item's siblings W-50 – W-69, filed together on 2026-10-19.
- The host's side: pdfsuite (arpitarya/pdf-testing-suite) — `work/open/W-46-sheet-viewer.md`, `work/open/W-47-sheet-editor.md`, `records/0101_SPEC-intake.md`, `work/design/Spec-*.dc.html`, `Sheet-Editor.dc.html`.
- The plugin contract: `packages/grid/src/plugins/types.ts` (six hooks, six slots).

## The prompt to paste

```text
Build W-51 in arpitarya/sheetpane. Read CLAUDE.md, work/INTERVIEW.md, then
work/open/W-51-review-layers.md and every record it names. Work through the
Definition of done in order, with a test before each next row. Update the
records, OPEN-WORK.md, IMPLEMENTATION.md, CHANGELOG.md, WORKLOG.md and NOW.md
in the same change. Close by moving the file to archive/open/.
```
