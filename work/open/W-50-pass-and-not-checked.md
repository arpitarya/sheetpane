---
type: Handoff
name: W-50
description: "Arpit, 2026-10-19: results as well as faults — a passed cell and a not-checked cell marked in the sheet and listed apart from the problems — Group 1 of the features pdfsuite's spec work needs from sheetpane."
item: W-50
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-50 — Pass and not-checked marks: show what is right, not only what is wrong

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Add two severities, `pass` and `skipped` (not checked), to the error schema; `v: 1` files stay valid | a host can report results, not only faults | ⏳ |
| 2 | Draw them: a ✓ mark and a — mark on the cell, with their own tokens, glyph and label (never colour alone) | right and unchecked cells read at a glance | ⏳ |
| 3 | Errors list: *Problems · Passed · Not checked* filter chips, Problems by default; tab counts and the Download badge count problems only | five failures are not buried under two thousand passes | ⏳ |
| 4 | `@sheetpane/comments` writes `pass` / `skipped` into the file only when the host asks | a downloaded review stays a list of problems | ⏳ |

**Arpit, 2026-10-19:** *"look at PDF suite and think about what all features could be needed just from Excel point of view that can be added into sheet pane … consider it built and consider it published. What else?"* — then *"do some research. What can be created as plugin? What should be part of existing packages? Classify it into those and create work items for all of these. Group 1, Group 2, and Group 3."*

**Group 1 — the host's review flow cannot work without it.** **Where it lives:** **Existing package — core `@sheetpane/grid`** (the pane's error schema, the cell marks, `<sheetpane-errors>`).

**Model:** Sonnet: an additive schema change plus marks and filters, all inside existing code paths.

## Goal

Results as well as faults — a passed cell and a not-checked cell marked in the sheet and listed apart from the problems.

**Why a host needs it:** pdfsuite (arpitarya/pdf-testing-suite) W-46 DoD 4 shows a spec check's pass/fail on the cells (its *Spec-Results* board: *"6 failures · 186 of 214 rows checked"*). Today `Severity` is `error · warning · note`, so a pass has nowhere to go.

**Why here and not elsewhere:** A severity is part of `SheetpaneError` and of the errors list's filters. A plugin's `validate` hook can only write the severities that already exist, so it cannot add one.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · schema | `Severity` gains `pass` and `skipped`; types, `custom-elements.json`, `rules.schema.json` (if it names severities) and the backend envelope updated; a v1 file without them still loads | ⏳ |
| 2 · marks | `--sp-pass`, `--sp-skip` tokens in light and dark; glyph + `aria-label` on each mark; axe clean | ⏳ |
| 3 · counts | tab counts, the Download badge and `sheetpane-errors` problem counts exclude `pass` and `skipped` | ⏳ |
| 4 · list | filter chips; sort order error › warning › note › skipped › pass; *Show in sheet* works for all five | ⏳ |
| 5 · comments | export writes `pass` / `skipped` only with `exportOptions.includeResults` | ⏳ |
| 6 · tests · docs | unit + browser tests; skill `sheetpane-errors`; CHANGELOG *Changed*; `llms*.txt` rebuilt | ⏳ |

## Blockers

None.

## Record affected

SR-ERRORS (severities, filters) · SR-GRID (cell marks, counts) · SR-COMMENTS (what export writes).

## Hazards

- A host that switches exhaustively on `severity` meets two new values — CHANGELOG says so under *Changed*.
- Thousands of `pass` rows in one pane: the list must stay virtualised (sheetpane-performance).

## Reference

- The classification and grouping: this item's siblings W-50 – W-69, filed together on 2026-10-19.
- The host's side: pdfsuite (arpitarya/pdf-testing-suite) — `work/open/W-46-sheet-viewer.md`, `work/open/W-47-sheet-editor.md`, `records/0101_SPEC-intake.md`, `work/design/Spec-*.dc.html`, `Sheet-Editor.dc.html`.
- The plugin contract: `packages/grid/src/plugins/types.ts` (six hooks, six slots).

## The prompt to paste

```text
Build W-50 in arpitarya/sheetpane. Read CLAUDE.md, work/INTERVIEW.md, then
work/open/W-50-pass-and-not-checked.md and every record it names. Work through the
Definition of done in order, with a test before each next row. Update the
records, OPEN-WORK.md, IMPLEMENTATION.md, CHANGELOG.md, WORKLOG.md and NOW.md
in the same change. Close by moving the file to archive/open/.
```
