---
name: sheetpane-performance
description: Use when a host deals with large workbooks - what loads fast, how rule checks are sliced, lazy-mounting several sheets, what to measure on your own machine and data. Not for small files, which need nothing special.
license: MIT
metadata:
  audience: host
---

# Large files

What is measured (Arpit's MacBook, headless Chromium; see each record's
"Measured" line):

| case | result | record |
|---|---|---|
| a 250,000-row CSV, read and drawn | ~0.2 s; scrolling paints every frame | [SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) Consequences |
| 250,000 rows × four column rules | checked in ~1.3 s, longest frame gap 44 ms | [SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) 22b |
| 250,000 rows × a rules file | ~0.7–0.9 s, longest frame gap 18 ms | [SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) 22d |
| 250,000 rows + 10,000 formulas | the formulas plugin adds ~0.4 s to the read | [SR-FORMULAS](https://github.com/arpitarya/sheetpane/blob/main/records/0111_FORMULAS.md) |

## How the grid stays responsive

- Only visible rows (±20) are drawn, and past 60 columns only visible
  columns ([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) decision 11).
- Rule checks run in idle-time slices with progress in the status line; wait
  for `workbook.ruleProgress` to be undefined before reading rule errors.
- The formula engine's WASM loads only on the first formula.

## What the host can do

- **Several sheets:** create a tab's `<sheetpane-excel>` when the tab is
  first opened, not all at once (the demos' plugin gallery does this).
- **Enable only the plugins you need** per pane.
- **Measure your own files** — `.xlsx` reading is slower than CSV (the zip
  and XML), and memory for very large files is not yet measured (backlog
  B-026).

## Related

[sheetpane-column-rules](../sheetpane-column-rules/SKILL.md) · [sheetpane-plugins](../sheetpane-plugins/SKILL.md)
