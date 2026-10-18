---
type: Handoff
name: W-34
description: "Arpit, 2026-10-18: the Download button should not be blue — it should match the toolbar — default to the uploaded format, and offer .xlsx or .csv from a ▾ menu beside it."
item: W-34
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-34 — Make Download a neutral split button: the upload's format by default, ▾ for .xlsx or .csv

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Restyle Download like the other toolbar buttons — not the blue primary | it matches the rest of the grid in light and dark | ✅ |
| 2 | The main part downloads in the format that was uploaded | one click does the expected thing | ✅ |
| 3 | A ▾ part opens "Download as .xlsx" and "Download as .csv" | either format, from either upload | ✅ |
| 4 | Rewrite SR-GRID decisions 9 and 10 in the same change | the spec says what ships | ✅ |

**Arpit, 2026-10-18:** *"The download XLSX button, I don't want it to be in blue color. It should match the theme. It should be like rest of the application, maybe black and white theme, whatever it is. And the default should be whatever format is uploaded. And then on right hand side, maybe like a down arrow, if we click on it, we get a drop down in, we, in which we get both the options. Download it as XLSX or as CSV."*

**Model:** Sonnet — one control in `<sheetpane-excel>`'s toolbar plus a CSV/XLSX conversion the export package already has.

## Goal

Replace W-31's blue `btn btn-p export` with a split button drawn like the toolbar's neutral buttons (`--sp-surface` ground, `--sp-line-strong` border, `--sp-ink` text). The main part keeps W-31's behaviour in the upload's format; the ▾ part offers both formats. Drawn on the boards [`Sheetpane`](../reference/design/boards/Sheetpane.dc.html) (interactive — click ▾) and [`Selection-And-Download`](../reference/design/boards/Selection-And-Download.dc.html).

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · style | the Download control uses the neutral button style, never the accent fill; the change count stays on the main part as a neutral badge; correct in light and dark (W-29 tokens) | ✅ the neutral `.btn` (surface ground, `line-strong` border, `ink` text) — no accent class; the count is a neutral badge (`sunken` / `ink`), themed light and dark by W-29's tokens — test |
| 2 · main part | label `Download .<uploaded kind>`; unchanged workbook → the original bytes; changed → `export()` with every change — W-31's behaviour, untouched | ✅ `Download .<upload's kind>`; untouched → the original bytes; changed → `export()` — W-31's behaviour — test |
| 3 · ▾ part | a separate button (`aria-label="Choose download format"`, `aria-haspopup="menu"`) opening a `role="menu"` with **Download as .xlsx** and **Download as .csv**, the upload's format first and marked *default*; each item downloads at once; arrows move, Enter runs, Esc closes and returns focus to ▾ | ✅ a separate button (`aria-label="Choose download format"`, `aria-haspopup="menu"`, `aria-expanded`) opening a `role="menu"`: Download as .xlsx / .csv, the upload's first and marked *default*; each item downloads at once; arrows, Enter, Esc back to ▾; a press elsewhere closes it — tests in View and Edit |
| 4 · conversion | from an `.xlsx`, CSV = the current sheet's latest values (`toCsv`), with a line under the item saying so; from a `.csv`, XLSX = one sheet (`toXlsx`) with the latest values; file name keeps the upload's base name with the new extension | ✅ `.xlsx` → `.csv`: the current sheet's `latestRows()` (changes, typed formulas and recalculated cells as values), with the line "The current sheet only — values as shown now, no formatting"; `.csv` → `.xlsx`: one sheet, numeric text as numbers, reads back equal; the base name kept — tests |
| 5 · events | `sheetpane-export` fires as today and its detail gains `format` and `converted: boolean`; cancelling it still prevents the download | ✅ `sheetpane-export` gains `format` and `converted`; cancelling still prevents the download — tests |
| 6 · plugins | export options a plugin adds (comments' "Write review as Excel comments") sit in the same menu under a separator, after the two formats | ✅ `Plugin.exportOptions` (`{ key, label, default }`) shown under a separator as `menuitemcheckbox`es, reaching `exportPatch` as `ctx.exportOptions[key]`; comments declares "Write review as Excel comments" — test |
| 7 · tests | neutral style (no accent class); default follows the upload for .xlsx and .csv; both menu items in both modes; xlsx→csv is the current sheet; csv→xlsx reads back equal; the event detail | ✅ `actions.test.ts` W-34 block (4): neutral style, default per upload, both items in both modes, xlsx→csv the current sheet, csv→xlsx read back, the event detail, a plugin option |
| 8 · record | SR-GRID decisions 9 (event detail) and 10 (toolbar) rewritten; CHANGELOG notes the new menu | ✅ SR-GRID decisions 9, 10, 13, 17; SR-COMMENTS 6; grid README; CHANGELOG |
## Blockers

None.

## Record affected

**[SR-GRID](../../records/0105_GRID.md)** decisions 9, 10, 17; [SR-COMMENTS](../../records/0112_COMMENTS.md) decision 6.

## Hazards

- **CSV holds one sheet and no formatting.** The menu says so; never silently drop sheets without the line under the item.
- **Concurrent sessions** edit this repo; re-derive `git status` before staging.

## Reference

- Design: [`../reference/design/boards/Selection-And-Download.dc.html`](../reference/design/boards/Selection-And-Download.dc.html) — the Download row; [`Sheetpane.dc.html`](../reference/design/boards/Sheetpane.dc.html) — try ▾
- W-31 (archived) — the one-button behaviour this keeps
- [`../../packages/grid/src/excel/element.ts`](../../packages/grid/src/excel/element.ts) — `downloadFile()`
- [`../../records/0105_GRID.md`](../../records/0105_GRID.md) decisions 9, 10

## Prompt — paste into Claude Code

```text
You are building W-34 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, records/0105_GRID.md (decisions 9, 10),
   packages/grid/src/excel/element.ts (downloadFile and the toolbar) and this file.
   Open work/reference/design/boards/Selection-And-Download.dc.html for the target.
2. Plan the split button, the menu and the conversion before writing code.
3. Implement in packages/grid/src/excel/ (element.ts, styles.ts); conversions through @sheetpane/export.
4. Verify: just check; every DoD row above. Then do what SR-WORK-DOCS decision 10 says every task owes.
```
