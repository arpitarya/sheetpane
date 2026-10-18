---
type: Handoff
name: W-05
description: "Research filed 2026-10-18 for Arpit's Excel component (W-01): how sheetpane reads .xlsx and .csv in the browser, and where the reader lives."
item: W-05
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-fable-5-1)"
ball: cowork
---

# W-05 — Research: how we read `.xlsx` and `.csv`

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Compare writing our own reader with using a library | a reasoned choice, not a habit | ✅ |
| 2 | Decide how a date or a percentage is shown when cells are "plain text" | the sheet looks like Excel to the user | ✅ |
| 3 | Decide where the reader lives — inside `sheetpane`, or its own package | a clean package layout | ✅ |
| 4 | Arpit picks a shape from the compare doc | W-01 can start reading files | ✅ 2026-10-18 — "resolve all the blockers" |

**Arpit, 2026-10-18:** *"Create necessary research work items."*

**Model:** Cowork — a reading-and-weighing task with no code (SR-WORK-OPEN-QUEUE rule 37a).

**Closed 2026-10-18.** Verdict: [`work/compare/xlsx-csv-reading.compare.md`](../compare/xlsx-csv-reading.compare.md). Arpit ruled *"resolve all the blockers"*; the verdict was drafted in-session and is his to override — the reopen-trigger is in the doc.

## Goal

A compare doc, `work/compare/xlsx-csv-reading.compare.md`, with a verdict,
that W-01 builds the reader from.

## The questions

1. **Own reader or library?** Own: ZIP walk + `DecompressionStream('deflate-raw')`
   + `DOMParser` — no dependency, small, auditable. Library: SheetJS CE, ExcelJS,
   or `fflate` for ZIP plus our own XML. Weigh bundle size, correctness on real
   files, licence, maintenance and security.
2. **Display of typed cells.** Dates are serial numbers; percentages and
   currency are number formats. Options: show the raw stored value; apply a
   small subset of number formats (dates, %, fixed decimals); apply full
   formats. "Plain text, as stored" was the ruling — say what that means for
   a date.
3. **Real-world files.** What Excel, Google Sheets, LibreOffice and common
   generators actually write: data descriptors (bit 3), inline vs shared
   strings, the 1904 date system, `cols` widths, merges, hidden sheets.
4. **CSV dialects.** Quotes, BOM, line endings, encoding other than UTF-8.
   Semicolon CSV and TSV are **B-011 (`unruled`)** — lay out the cost of each
   answer for Arpit; do not assume one.
5. **Limits and safety.** Inflated-size cap (ZIP bombs), row/column caps,
   password-protected files (an encrypted OLE container, not a ZIP) — detect
   and message.
6. **Where it lives.** Inside `sheetpane`, a `@sheetpane/read` package, or a
   shared `@sheetpane/core` with the ZIP and CRC code that W-03 also needs.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · doc | the compare doc exists with verdict, options, matrix, consequences, references, reopen-trigger | ✅ |
| 2 · evidence | each claim about a library or a file format cites a source; at least three real files (Excel, Google Sheets, LibreOffice) inspected | ✅ |
| 3 · ruling | Arpit picks; the pick is written into W-01 and the compare doc | ✅ |

## Blockers

None.

## Record affected

**No SR affected** — the verdict feeds W-01's record.

## Hazards

- **L2: every dependency FOSS** — OSI-approved licence on the exact version, transitive ones included. SheetJS CE's terms changed over time; read the current ones. Copyleft is allowed today but B-010 is open.
- **L3: XLSX and CSV only** — a library that also reads `.xls` or `.ods` is fine only if those paths are unreachable.

## Reference

- [`../reference/README.md`](../reference/README.md) §SpreadsheetML, §ZIP, §CSV, §Web platform.
- [`../compare/README.md`](../compare/README.md) — the compare doc's shape.
