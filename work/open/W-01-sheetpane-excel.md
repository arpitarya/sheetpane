---
type: Handoff
name: W-01
description: "Arpit asked on 2026-10-18 for the Excel component — <sheetpane-excel>, the view-and-edit web component of the sheetpane package, and the in-memory workbook it shares with <sheetpane-errors>."
item: W-01
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-01 — Build the Excel component, `<sheetpane-excel>`

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Settle how files are read, how the grid draws, and how the components share one workbook | the three choices this build rests on | ✅ verdicts in `work/compare/` |
| 2 | Read an `.xlsx` or `.csv` into the in-memory workbook | the file on screen, nothing uploaded | ⏳ |
| 3 | Draw the sheet: tabs, merged-and-centred cells, find, zoom, View and Edit | the view and edit components, in a tab or a pop-up | ⏳ |
| 4 | Edit: type into a cell, flag a wrong value, pins and callouts | changes and errors in memory, in sync with the error component | ⏳ |
| 5 | Export every change through `@sheetpane/export` | the edited file back out | ⏳ W-03 |

**Arpit, 2026-10-18:** *"First one, to build out the Excel component … create
one more work item which can accept a JavaScript object and emit an Excel or
CSV file. This package will be a dependency to Excel component."*

**Model:** Opus — the deliverable is UI behaviour and feel that no test fully
catches (selection, callout placement, keyboard model); close to Sonnet only
because most of the DoD below is checkable.

## Goal

The sheet of the `@sheetpane/grid` package: **a custom element** (L4) a host page
drops into a tab or a pop-up — from plain HTML or any framework. The user sees
the uploaded workbook as stored, switches to Edit, changes values (held in
memory, L6 and L9), flags wrong values, and exports every change. The view and
edit components are this element's two modes; the error component is W-02's
element. All three read and write **one in-memory workbook** (L7).

**Package name: `@sheetpane/grid`** (`packages/grid/`) — Arpit's ruling,
2026-10-18; SR-LAW-8 owes the name to the record that owns `package.json`,
so it moves into this item's component record (DoD 14).

**The three verdicts this item builds from** (each has a reopen-trigger):

| decided | where |
|---|---|
| own reader on browser APIs; number-format subset for display; reader in `src/read/` | [`xlsx-csv-reading.compare.md`](../compare/xlsx-csv-reading.compare.md) |
| DOM + own virtualiser in a shadow root; plain DOM internals; `--sp-*` tokens, no font | [`grid-rendering.compare.md`](../compare/grid-rendering.compare.md) |
| workbook registry by `pane`; selection syncs; error schema; the full DOM contract (names, events, methods) | [`workbook-and-error-contract.compare.md`](../compare/workbook-and-error-contract.compare.md) |

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · element | `customElements.define` registers `<sheetpane-excel>`; importing the package is enough; **no UI framework is a peer dependency**; the contract is attributes, properties, methods and DOM events only (L4) | ⏳ |
| 2 · read | `.xlsx` (every sheet, shared and inline strings, a formula cell's **saved value only**, merged ranges, column widths, hidden sheets marked) and `.csv` (`,` `;` tab auto-detected) from a `File`, `Blob`, URL, base64 string or `ArrayBuffer`; the element turns a URL or base64 into bytes, and **all parsing goes through `@sheetpane/import` (W-13)** — no reader inside this package; typed cells shown through the number-format subset, raw otherwise | ⏳ — `@sheetpane/import` landed (W-13) and `packages/grid/package.json` depends on it |
| 3 · refuse | any other format — `.xls`, `.xlsm`, `.xlsb`, `.ods`, `.numbers` — gets the "Can't open this file" state, no partial parse (L3); a password-protected `.xlsx` gets the password state; ZIP64 or over-limit files get a clear message | ⏳ |
| 4 · view | matches the boards `Sheetpane`, `Host-Tab-View`, `Host-Popup-View`: toolbar, View/Edit switch, cell bar, row and column headers, **merged-and-centred cells**, sheet tabs (`.xlsx` only), find, zoom, download original, status line | ⏳ |
| 5 · placement | `display="tab"` fills its container; `display="popup"` opens over the page (`open` property, `sheetpane-close` event; Esc closes, focus trapped and returned) | ⏳ |
| 6 · font | **no font ships** and no `font-family` is named; the host's font reaches every part, form controls included, and a change of the host's font shows without recreating the element (L5) | ⏳ |
| 7 · edit in memory | in Edit, the cell bar is a text box for the selected cell; every change is held in the in-memory workbook (L6, L9), survives View↔Edit and sheet switches, shows a corner mark and "Changed · was X" with **Revert**; typing the original value back clears it; the toolbar counts changes | ⏳ |
| 8 · export | Export calls `patchXlsx(original, changes)` for an `.xlsx` source and `toCsv(activeSheet)` for a `.csv` source, so **every change is applied and everything else survives** (L6); the original is never modified; `export()` returns the same `Blob`; a `beforeunload` warning while changes are held | ⏳ W-03 |
| 9 · flag | selection bar with **Flag issue** (and `F`); numbered pins on flagged cells, row glyphs ✕ ! i, the callout (Found → Should be, Resolve, Delete, previous/next) | ⏳ |
| 10 · in sync | with a `<sheetpane-errors>` on the same `pane`, every change, error and selection made in either shows in the other at once, whichever mounts first (L7); the store, schema and events exactly as the contract verdict states | ⏳ |
| 11 · scale | the 250,000-row CSV fixture: no frame over 16 ms in a 5-second wheel scroll in Chrome on Arpit's MacBook; the measurement and the machine written into this file | ⏳ |
| 12 · access | the grid follows the APG grid keyboard model; every icon button has a label; no meaning carried by colour alone | ⏳ |
| 13 · tests | reader unit tests over fixtures (the design's sample workbook, built with `@sheetpane/export`, plus files saved by Excel, Google Sheets and LibreOffice); workbook-store tests; element tests for DoD 4–10 in a real browser engine | ⏳ |
| 14 · record | a component record written from `records/TEMPLATE.md` (next free number from `0101`); the Ownership rows for `packages/grid/` moved from W-01 to it | ⏳ |
| 15 · stale marks | without `@sheetpane/formulas`, a formula cell that depends on a changed cell shows a "may be stale" mark, and a pivot table's range shows a read-only badge "pivot table — refreshes in Excel"; export asks Excel to recompute both (W-03 DoD 11; plugins verdict decision 10) | ⏳ |

## Blockers

None. The toolchain (W-04), the writers (W-03) and the reader (W-13) have
landed.

## Record affected

**A new component record on completion** (DoD 14). Until then this item owns
`packages/grid/` (except `src/errors/`, owned by W-02) in the register's
Ownership table.

## Hazards

- **Every question this build touches is ruled** (2026-10-18): delimiters
  (SR-LAW-3), internals and wrappers (SR-LAW-4), workbook fonts (SR-LAW-5),
  reload and fidelity (SR-LAW-6), selection and matching edits (SR-LAW-7),
  server-side import (SR-LAW-8). Read the Consequences of each before coding;
  if one proves wrong in practice, its reopen-trigger is in the compare doc.
- **The design snapshot predates L4 and L5.** Its React API and its IBM Plex
  font are superseded; take layout, behaviour and colour from it, not those.
- **Dates and percents.** A date cell is stored as a serial number (46295);
  the number-format subset turns it into text once at load. Keep raw and
  display apart: export writes the raw value.
- **Found stays the original.** An error's `found` is the uploaded value.
- **Hostile files.** ZIP bombs (cap inflated size), huge shared-string tables.
- **Merged cells and virtual rows.** A merge can start above the visible window.

## Reference

- The design: [`../reference/design/README.md`](../reference/design/README.md) — boards
  `Sheetpane`, `Host-*`, `View-Upload`.
- Reading `.xlsx`: [`../reference/README.md`](../reference/README.md) §SpreadsheetML and
  [`../reference/specs/zip/zip-subset-notes.md`](../reference/specs/zip/zip-subset-notes.md).
- Custom elements: [`../reference/specs/web/mdn-using-custom-elements.md`](../reference/specs/web/mdn-using-custom-elements.md).
- Grid accessibility: [`../reference/specs/a11y/`](../reference/specs/a11y/).
- The laws: [SR-LAW-3](../../records/0005_LAW-3-xlsx-and-csv-only.md) ·
  [SR-LAW-4](../../records/0006_LAW-4-web-component.md) ·
  [SR-LAW-5](../../records/0007_LAW-5-host-font.md) ·
  [SR-LAW-6](../../records/0008_LAW-6-edits-in-memory-export-with-changes.md) ·
  [SR-LAW-7](../../records/0009_LAW-7-surfaces-always-in-sync.md) ·
  [SR-LAW-9](../../records/0011_LAW-9-memory-is-a-javascript-object.md).

## Prompt — paste into Claude Code once the blockers close

```text
You are building W-01 in the sheetpane monorepo: the <sheetpane-excel> web
component and the in-memory workbook it shares.

1. Explore. Read CLAUDE.md and every law record it lists, work/INTERVIEW.md,
   work/OPEN-WORK.md, this file (work/open/W-01-sheetpane-excel.md), the
   three compare docs named in this file, and work/reference/README.md. Read the design boards Sheetpane, Host-Tab-View,
   Host-Tab-Edit, Host-Popup-View and View-Upload as source
   (work/reference/design/boards/) — renderVals() holds the sample data and
   the behaviour. Ignore the boards' React API and IBM Plex font (L4, L5).
2. Plan. Write the module layout under packages/grid/src/ (reader,
   workbook store, excel element) and the order you will build DoD 1–14 in.
   Put the plan in this file's body before writing code.
3. Implement, one DoD row at a time, with its tests. Use @sheetpane/export
   for Export. Every dependency FOSS (L2); none the verdicts did not allow.
4. Verify. just check from the repo root (W-10 defines it); open the
   fixtures in a real browser; tick each DoD row only with its evidence.
   Then do what SR-WORK-DOCS decision 10 says every task owes.
```
