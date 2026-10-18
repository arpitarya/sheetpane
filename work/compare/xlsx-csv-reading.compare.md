---
type: Compare
title: How sheetpane reads .xlsx and .csv
description: "Own reader on browser APIs, or a library; what a typed cell shows; where the reader lives. Verdict for W-01 (closes W-05)."
status: decided
decided: 2026-10-18
decided_by: "Arpit (Cowork, claude-fable-5-1) — ruling 'resolve all the blockers', 2026-10-18; verdict drafted by the session, open to override"
---

# How sheetpane reads `.xlsx` and `.csv`

> **Verdict:** decided · **write our own reader on browser APIs** — ZIP walk +
> `DecompressionStream('deflate-raw')` + `DOMParser` for `.xlsx`, a hand-written
> state machine for `.csv`; **display typed cells through a small number-format
> subset** (dates, times, percent, fixed decimals, thousands); **the reader
> lives inside `@sheetpane/grid`** as `src/read/`, with the ZIP and CRC code in
> `@sheetpane/export` and imported from there · confidence **high** on the
> reader and the home, **medium** on the format subset · **reopen if** the
> reader fails on a real file that a library opens correctly and the fix is
> not a bounded bug, or if the format subset misreads more than one cell in a
> hundred on the fixture set.

## Context

W-01 needs the uploaded file in memory as plain-text sheets. The laws fix the
field: only `.xlsx` and `.csv` (L3), every dependency FOSS (L2), zero runtime
dependencies as the house default, nothing leaves the browser (L6, L9).
Arpit's ruling of 2026-10-18 is "plain text, as stored; formulas show their
saved value; merge-and-centre is the only formatting".

## Options

### 1 · Own reader on browser APIs — **chosen**

- **ZIP:** central-directory walk (see
  [`zip-subset-notes.md`](../reference/specs/zip/zip-subset-notes.md)); sizes from
  the central directory, never the local header; ZIP64 refused.
- **Inflate:** `new DecompressionStream('deflate-raw')` — in every evergreen
  browser since 2023 (Chrome 103, Safari 16.4, Firefox 113).
- **XML:** `DOMParser` over `workbook.xml`, `sharedStrings.xml`, `styles.xml`,
  each `worksheets/sheetN.xml`. It never fetches external entities.
- **CSV:** one pass, RFC 4180 quoting, auto-detected delimiter.
- Cost: ~1,200 lines we own and test. Benefit: zero dependencies, auditable,
  nothing parses what L3 forbids.

### 2 · SheetJS Community Edition — rejected

Reads everything, including the formats L3 forbids, which cannot be tree-shaken
away. The npm `xlsx` package has not been updated since 0.18.5 (2022); the
current CE ships from the vendor's own registry, which complicates L2's "exact
version resolved" check. ~400 KB minified.

### 3 · ExcelJS — rejected

MIT, well maintained, but Node-first (streams, Buffer polyfills), ~250 KB, and
carries writing, styles, images and charts sheetpane will never use.

### 4 · `fflate` for ZIP + own XML — rejected, kept as the fallback

MIT, 8 KB, excellent. Only worth it if `DecompressionStream` proves missing
somewhere sheetpane must run. **This is the reopen path:** if the trigger
fires on inflate, adopt `fflate` for inflate only.

## Matrix

| | own | SheetJS CE | ExcelJS | fflate + own XML |
|---|---|---|---|---|
| runtime deps | 0 | 1 | 1 (+polyfills) | 1 |
| L2 clean | yes | awkward | yes | yes |
| L3 clean (no other formats) | yes | no | no | yes |
| bundle cost | ~15 KB | ~400 KB | ~250 KB | ~25 KB |
| real-file robustness today | to prove (DoD 13 fixtures) | high | high | to prove |
| auditability | full | low | medium | high |

## Decisions

1. **Reader = own code**, option 1. `fflate` is the named fallback for inflate only.
2. **A cell's display text** is computed once at load:
   - `t="s"` / `t="inlineStr"` → the string; `t="b"` → `TRUE`/`FALSE`;
     `t="e"` → the error text; `<f>` present → **the cached `<v>`**, never evaluated.
   - a numeric `<v>` with a number format in the **supported subset** → formatted:
     built-in ids 0–4, 9–22, 37–40, 45–49, and custom formats whose tokens are
     only `0 # , . % y m d h s AM/PM / - : space "literal"`; the 1904 date
     system honoured.
   - any other format → the raw stored text. The raw value is kept beside the
     display text, so export writes what was stored.
   - **Overridden when a plugin is installed (Arpit, 2026-10-18, plugins
     verdict decision 9):** with `@sheetpane/numfmt` every format is
     formatted; with `@sheetpane/formulas` a formula cell is evaluated, not
     read from `<v>`. Without them this decision stands unchanged.
3. **CSV:** delimiter auto-detected from the first 20 lines among `,` `;` `\t`
   (B-011 ruling: variants inside a `.csv` are read; a `.tsv` extension is still
   refused under L3); UTF-8 with or without BOM; CRLF, LF and CR; quotes per
   RFC 4180; a `.csv` is one sheet named after the file.
4. **Refusals** (L3): extension and magic bytes both checked. OLE/CFB header
   (`D0 CF 11 E0`) → "password-protected or legacy `.xls`"; a ZIP without
   `xl/workbook.xml` → "not a workbook"; ZIP64 → refused; inflated size capped
   at 512 MB per part and 1 GB per file; sheets over 1,048,576 rows or 16,384
   columns refused with the size named.
5. **Home:** ~~`packages/grid/src/read/`~~ — **overridden by Arpit,
   2026-10-18: the reader is its own package, `@sheetpane/import` (W-13).**
   Was: `packages/grid/src/read/` (xlsx, csv, formats). The ZIP
   writer and CRC-32 live in `@sheetpane/export`; the reader imports CRC-32
   from there so there is one implementation.
6. **Hidden sheets** are read and marked; hidden rows and columns are read and
   shown (sheetpane shows what is stored).

## Consequences

- W-01 DoD 2 and 3 are fully specified; the format subset is a module with its
  own fixture table.
- The 1/100 misread trigger needs the fixture set from DoD 13 (Excel, Google
  Sheets, LibreOffice saves) — the measurement is written into W-01.
- A number format outside the subset shows raw — a visible, honest fallback.

## References

- [`work/reference/README.md`](../reference/README.md) §SpreadsheetML, §ZIP, §Web platform.
- [`work/reference/specs/spreadsheetml/structure-of-a-spreadsheetml-document.md`](../reference/specs/spreadsheetml/structure-of-a-spreadsheetml-document.md),
  [`working-with-the-shared-string-table.md`](../reference/specs/spreadsheetml/working-with-the-shared-string-table.md),
  [`working-with-formulas.md`](../reference/specs/spreadsheetml/working-with-formulas.md).
- [`work/reference/specs/web/mdn-decompressionstream-constructor.md`](../reference/specs/web/mdn-decompressionstream-constructor.md).
- [`work/reference/specs/csv/rfc4180-summary.md`](../reference/specs/csv/rfc4180-summary.md).
- Laws: [SR-LAW-2](../../records/0004_LAW-2-foss-dependencies.md), [SR-LAW-3](../../records/0005_LAW-3-xlsx-and-csv-only.md).

## Reopen-trigger

A real `.xlsx` from Excel, Google Sheets or LibreOffice that sheetpane refuses
or misreads **and** that is not a bounded bug; or the format subset misreading
more than 1 in 100 numeric cells across the W-01 fixture set.
**Check:** `just test-grid -- read` once W-01 lands.
