---
type: Handoff
name: W-50
description: "Arpit, 2026-10-19: results as well as faults — a passed cell and a not-checked cell marked in the sheet and listed apart from the problems — Group 1 of the features pdfsuite's spec work needs from sheetpane."
item: W-50
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Arpit (Cowork, claude-opus-5-5) — the look: quiet and optional"
ball: agent
---

# W-50 — Pass and not-checked marks: show what is right, not only what is wrong

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Add two severities, `pass` and `skipped` (not checked), to the error schema; `v: 1` files stay valid | a host can report results, not only faults | ⏳ |
| 2 | Keep results quiet and optional: three levels — **off**, **summary** (the default: one line of counts, nothing on the sheet) and **on the sheet** (a 9 px ✓ or — in the cell's bottom-left corner), chosen by the host, with one *On sheet* switch for the reviewer | results are there when wanted and invisible when not | ⏳ |
| 3 | Errors list: *Problems · Passed · Not checked* chips, Problems by default; passes **grouped by check**, not-checked **grouped by reason**; tab counts and the Download badge count problems only | five failures are not buried under two thousand passes | ⏳ |
| 4 | `@sheetpane/comments` writes `pass` / `skipped` into the file only when the host asks | a downloaded review stays a list of problems | ⏳ |

**Arpit, 2026-10-19:** *"look at PDF suite and think about what all features could be needed just from Excel point of view that can be added into sheet pane … consider it built and consider it published. What else?"* — then *"do some research. What can be created as plugin? What should be part of existing packages? Classify it into those and create work items for all of these. Group 1, Group 2, and Group 3."*

**Group 1 — the host's review flow cannot work without it.** **Where it lives:** **Existing package — core `@sheetpane/grid`** (the pane's error schema, the cell marks, `<sheetpane-errors>`).

**Model:** Sonnet: an additive schema change plus marks and filters, all inside existing code paths.

## Goal

Results as well as faults — a passed cell and a not-checked cell marked in the sheet and listed apart from the problems.

**Why a host needs it:** pdfsuite (arpitarya/pdf-testing-suite) W-46 DoD 4 shows a spec check's pass/fail on the cells (its *Spec-Results* board: *"6 failures · 186 of 214 rows checked"*). Today `Severity` is `error · warning · note`, so a pass has nowhere to go.

**Why here and not elsewhere:** A severity is part of `SheetpaneError` and of the errors list's filters. A plugin's `validate` hook can only write the severities that already exist, so it cannot add one.

## How it looks

Drawn on the board [`Results-Pass-NotChecked`](../reference/design/boards/Results-Pass-NotChecked.dc.html) (canvas v51, 2026-10-19). **Arpit, 2026-10-19:** *"what will be the best design — shouldn't be very overwhelming and should be optional."*

**Three levels.** The host sets the starting level with a `results` attribute on either element. The level is pane-wide, so both elements follow (L7). The reviewer can move between *summary* and *on the sheet*. Neither move is a change or undoable; the level lives in the pane's store while the pane lives.

| `results=` | errors panel | sheet |
|---|---|---|
| `off` | as today: pass and skipped entries are dropped on arrival | as today |
| `summary` **(default)** | one line under the header: **6 problems · ✓ 180 passed · — 28 not checked · On sheet ◯**; *Passed* and *Not checked* chips appear only when results exist; the list opens on *Problems* | no result marks; the status line says **186 of 214 checked** |
| `marks` (or the *On sheet* switch) | the same, switch on | a ✓ or — on each result cell |

**The mark.**
- **Where:** a 9 px glyph in the cell's **bottom-left corner**, the one corner W-14 leaves free. The person pin is top-left, the corner mark and ⚠ pin are top-right, the note mark is bottom-right.
- **Colour:** ✓ in `--sp-pass`, — in a new `--sp-skip` (= `ink-3`), each at least 3:1 against the cell in light and dark (W-29).
- **Nothing else:** no fill, no border, no pin, and nothing in the row header. The row header keeps ✕ ! i for problems only.
- **A problem always wins:** a cell with a problem never shows ✓ or —.
- **Label:** `aria-label="Passed: <check>"` or `"Not checked: <reason>"`.
- **Selecting a result cell:** a chip in the cell bar names its check, for example *"✓ Passed · Fee rate 0.00%–2.00%"*. This is the one place the mark is explained in words.

**The list.**
- **Passed:** grouped by check (`type` + `message`): *"✓ Fee rate 0.00%–2.00% · 162 cells · H3:H214 · Show ▸"*.
- **Not checked:** grouped by reason, which is the host's message: *"— Blank in the source · 20 cells"*.
- **Opening a group:** shows its cells, virtualised, only when opened.
- **Show ▸:** selects the group's range and turns marks on for that range only, even at `summary`.

**What keeps it calm.**
- **Counts that ask for action ignore results:** tab counts, the Download badge and the panel header count problems only.
- **The download ignores results** unless `includeResults` is set (DoD 5).
- **Groups, not rows:** 180 passes are two list rows.
- **Off the sheet unless asked.**

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · schema | `Severity` gains `pass` and `skipped`; types, `custom-elements.json`, `rules.schema.json` (if it names severities) and the backend envelope updated; a v1 file without them still loads | ⏳ |
| 2 · marks | **Levels:** the `results` attribute (`off` · `summary` default · `marks`), pane-wide, plus the *On sheet* switch in the errors panel's summary line. **Mark:** a 9 px ✓ or — at the cell's bottom-left with no fill, border or pin, and a problem always wins. **Tokens:** `--sp-pass` and `--sp-skip` in light and dark, at least 3:1 against the cell. **Label:** `aria-label` naming the check or reason. **Cell bar:** a chip naming the check of the selected result cell. **Status line:** *n of m checked*. **axe:** clean. | ⏳ |
| 3 · counts | tab counts, the Download badge and `sheetpane-errors` problem counts exclude `pass` and `skipped` | ⏳ |
| 4 · list | **Summary line:** under the header at `summary` and `marks`. **Chips:** shown only when results exist; *Problems* is the default. **Groups:** passes grouped by check, not-checked by reason, each with a count, its range and *Show ▸* (selects the range and marks it, even at `summary`); a group opens to its cells, virtualised. **Order:** error › warning › note › skipped › pass. **Show in sheet:** works for all five severities. | ⏳ |
| 5 · comments | export writes `pass` / `skipped` only with `exportOptions.includeResults` | ⏳ |
| 6 · tests · docs | unit + browser tests; skill `sheetpane-errors`; CHANGELOG *Changed*; `llms*.txt` rebuilt | ⏳ |

## Blockers

None.

## Record affected

SR-ERRORS (severities, filters, the summary line, groups, `results`) · SR-GRID (cell marks, the `results` level, counts, the status line) · SR-COMMENTS (what export writes).

## Hazards

- A host that switches exhaustively on `severity` meets two new values — CHANGELOG says so under *Changed*.
- Thousands of `pass` rows in one pane: the list must stay virtualised (sheetpane-performance).

## Reference

- The classification and grouping: this item's siblings W-50 – W-69, filed together on 2026-10-19.
- The host's side: pdfsuite (arpitarya/pdf-testing-suite) — `work/open/W-46-sheet-viewer.md`, `work/open/W-47-sheet-editor.md`, `records/0101_SPEC-intake.md`, `work/design/Spec-*.dc.html`, `Sheet-Editor.dc.html`.
- Design: [`../reference/design/boards/Results-Pass-NotChecked.dc.html`](../reference/design/boards/Results-Pass-NotChecked.dc.html) — the three levels, the switch, the grouped lists, the mark.
- The plugin contract: `packages/grid/src/plugins/types.ts` (six hooks, six slots).

## The prompt to paste

```text
Build W-50 in arpitarya/sheetpane. Read CLAUDE.md, work/INTERVIEW.md, then
work/open/W-50-pass-and-not-checked.md and every record it names. Work through the
Definition of done in order, with a test before each next row. Update the
records, OPEN-WORK.md, IMPLEMENTATION.md, CHANGELOG.md, WORKLOG.md and NOW.md
in the same change. Close by moving the file to archive/open/.
```
