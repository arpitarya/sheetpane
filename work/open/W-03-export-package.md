---
type: Handoff
name: W-03
description: "Arpit asked on 2026-10-18 for a package that accepts a JavaScript object and emits an .xlsx or .csv file — @sheetpane/export, a dependency of the Excel component."
item: W-03
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-03 — Build the export package, `@sheetpane/export`

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Settle the input shape, compression and CSV defaults | one agreed contract | ✅ [`export-shape.compare.md`](../compare/export-shape.compare.md) |
| 2 | Write CSV from the object | `.csv` out, safe to open in Excel | ✅ |
| 3 | Write `.xlsx` two ways — build from the object, or patch the uploaded file so charts and styles survive | `.xlsx` out, no dependency | ✅ |
| 4 | Prove it: read every file back with an independent reader, and open it in Excel | trust in the output | ✅ three independent readers · ⏳ Excel itself (DoD 8, Arpit) |

**Arpit, 2026-10-18:** *"Create one more work item which can accept a
JavaScript object and emit an Excel or CSV file. This package will be a
dependency to Excel component."*

**Model:** Opus — close to Sonnet, because the checks below are mechanical;
Opus because "Excel opens it without a repair prompt" is the real bar and no
unit test catches a near-miss.

## Goal

A standalone package, `packages/export` → `@sheetpane/export`, with **no
runtime dependencies**: a plain JavaScript object in, `.xlsx` bytes or `.csv`
text out. `@sheetpane/grid`'s Export button calls it with the in-memory values.

**The shape — decided** in [`export-shape.compare.md`](../compare/export-shape.compare.md):

```ts
type Cell = string | number | boolean | null;
interface Sheet { name: string; rows: Cell[][]; merges?: string[]; columnWidths?: number[]; hidden?: boolean }
interface Workbook { sheets: Sheet[] }
interface Change { sheet: string; ref: string; value: Cell }

toXlsx(book: Workbook, o?: { compression?: 'deflate' | 'store' }): Promise<Uint8Array>;
patchXlsx(original: Uint8Array, changes: Change[], o?): Promise<Uint8Array>;   // keeps everything else
toCsv(sheet: Sheet, o?: { delimiter?: ',' | ';' | '\t'; bom?: boolean; eol?: '\r\n' | '\n'; guardFormulas?: boolean }): { text: string; guarded: string[] };
```

Text → inline strings; numbers and booleans typed; `deflate` by default via
`CompressionStream` / `zlib`, `store` for byte-identical output; CSV comma,
CRLF, BOM on, formula guard on and reported; browsers and Node 20+.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · zero-dep | `dependencies` is empty; dev dependencies only for tests, every one FOSS (L2) | ✅ `dependencies: {}`; dev-only: exceljs 4.4.0, papaparse 5.7.0, fflate 0.8.3 (all MIT), fast-check (MIT) — the package check in `test/packages.test.ts` holds it |
| 2 · csv | RFC 4180 quoting (quote on `,` `"` CR LF; double inner quotes); delimiter, BOM and line ending options; `guardFormulas` on by default, guarded refs returned | ✅ `src/csv.ts`; `csv.test.ts` — quoting, delimiter / BOM / EOL options, padding, the guard and its refs (numerals unguarded — SR-EXPORT decision 4), PapaParse round-trip property (200 runs, seed 3) |
| 3 · xlsx build | `toXlsx`: `[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, `xl/worksheets/sheetN.xml`, `xl/styles.xml`; text as inline strings, numbers and booleans typed | ✅ `src/xlsx.ts`; exactly the six parts; inline strings, typed numbers and booleans; ExcelJS reads back the sample and a 60-run property (seed 4) |
| 3a · xlsx patch | `patchXlsx`: ZIP read (central directory, sizes from it, ZIP64 refused), rewrite only the changed `<c>` elements in the touched sheets, copy every other part byte for byte; CRC-32 and ZIP walk exported for `@sheetpane/grid`'s reader | ✅ `src/patch.ts` + `src/zip.ts`: central-directory walk, ZIP64 refused, only the changed `<c>` rewritten (style kept), every other entry's compressed bytes copied — `patch.test.ts` compares raw entries; `crc32`, `readZip`, `inflateEntry` exported for the reader |
| 4 · merges | `merges: ['A1:J1']` writes `<mergeCells>` and a centred style on the merged cell — merge-and-centre is the one format sheetpane keeps | ✅ `<mergeCells>` + style 1 (centred) on the top-left; ExcelJS reads the merges and `alignment.horizontal = center` |
| 5 · rules | sheet names validated (1–31 characters, none of `[ ] : * ? / \`, unique ignoring case); over 1,048,576 rows or 16,384 columns is an error with the sheet and size named | ✅ `src/validate.ts`; the tests name `Big`/`A1048577`, `Wide`/`XFE2`, duplicates ignoring case, forbidden characters, apostrophes, NaN, over-long text, overlapping merges |
| 6 · deterministic | in `store` mode the same object gives the same bytes on every engine — a test proves it; `deflate` output round-trips through the reader | ✅ `store` output identical across runs and equal to the committed golden `test/fixtures/sheetpane-sample.store.xlsx` in **Node 24 and Chromium 156** (`engines.browser.test.ts`); deflate output read back by our reader and fflate in both |
| 7 · read back | an independent reader (dev dependency or a CI step) reads each test file back with the same values, sheet names and merges | ✅ ExcelJS (values, sheet names, merges, widths, hidden), PapaParse (CSV), fflate (ZIP) — every test file |
| 8 · opened | Arpit opens a sample `.xlsx` in Excel and LibreOffice with **no repair prompt**, and a `.csv` with the BOM shows accents correctly; the result is noted here | ⏳ 🔴 Arpit |
| 9 · runtimes | works in evergreen browsers (`CompressionStream('deflate-raw')`) and Node 20+ (`zlib.deflateRawSync`); no DOM touched; what was run is written here | ✅ run 2026-10-18 on Arpit's MacBook: Node 24.13.0 (`zlib`) and Chromium 156 headless (`CompressionStream('deflate-raw')`); CI on Node 22; no DOM touched (grep: no `document`/`window` outside `download/`) |
| 9a · download | `download()` is exported from this package's index — built by **W-12** inside `packages/export/src/download/`; W-03 leaves the export slot and the README section for it | ✅ W-12 landed `download()` in `packages/export/src/download/`, exported from the index; README §Save the file |
| 10 · record | a component record (next free from `0101`); the Ownership row for `packages/export/` moved from W-03 to it; `packages/export/README.md` documents the API | ✅ [SR-EXPORT](../../records/0103_EXPORT.md) (0103); Ownership `packages/export/` → SR-EXPORT; README documents the API |
| 11 · recalc on open | `patchXlsx` and `toXlsx` write `<calcPr fullCalcOnLoad="1"/>` whenever any cell changed, and set `refreshOnLoad="1"` on every pivot cache whose source range meets a changed cell, so Excel recomputes formulas and pivots the grid could not (plugins verdict decision 10) | ✅ `patchXlsx` writes `<calcPr fullCalcOnLoad="1"/>` in schema order when any cell changed, `refreshOnLoad="1"` on pivot caches whose source meets a change (tested); `toXlsx` takes no changes and writes no formulas, so it writes no `<calcPr>` (SR-EXPORT decision 2) |

## Blockers

None for the code. DoD 8 is the decider's: open
`packages/export/test/fixtures/sheetpane-sample.xlsx` in Excel and LibreOffice,
and `sheetpane-sample.csv` in Excel.

## Record affected

**[SR-EXPORT](../../records/0103_EXPORT.md)** — written by this item.

## Hazards

- **Ruled (2026-10-18):** fidelity through `patchXlsx` (SR-LAW-6); delimiter
  variants (SR-LAW-3); multi-sheet to CSV = the active sheet, said out loud.
- **Patching shared strings.** A changed text cell is written as an inline
  string; the old shared-string entry stays (harmless, keeps the patch small).
- **L2:** dev dependencies used to read files back must be FOSS too.
- **Formula injection.** The guard changes data (`'=SUM` instead of `=SUM`);
  `guarded` returns the refs so the host can say so. The README says it out loud.
- **DEFLATE is not byte-stable across engines.** That is why `store` exists and
  is the determinism test's mode.
- **XML escaping** of `&` `<` `>` `"` and characters XML forbids (control
  characters) — test them.

## Reference

- [`../reference/specs/zip/zip-subset-notes.md`](../reference/specs/zip/zip-subset-notes.md) — the container.
- [`../reference/README.md`](../reference/README.md) §SpreadsheetML — the parts,
  shared strings, merges; §CSV — RFC 4180 summary, W3C tabular model, OWASP CSV injection.
- [`../reference/specs/web/mdn-compressionstream-constructor.md`](../reference/specs/web/mdn-compressionstream-constructor.md) — `'deflate-raw'`.

## Prompt — paste into Claude Code once the blockers close

```text
You are building W-03 in the sheetpane monorepo: @sheetpane/export.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, this file
   (work/open/W-03-export-package.md), work/compare/export-shape.compare.md,
   work/reference/specs/zip/zip-subset-notes.md and the SpreadsheetML and
   CSV docs under work/reference/specs/.
2. Plan the modules (zip, crc32, xml, xlsx, csv) and the test list in this
   file's body before writing code.
3. Implement in packages/export/src/ (zip read+write, crc32, xml, xlsx build,
   xlsx patch, csv) with zero runtime dependencies. Make `store` output
   deterministic. Validate input with errors that name the sheet and cell.
4. Verify. just check; read every fixture back with an
   independent reader; write the sample workbook from
   work/reference/design/boards/Sheetpane.dc.html to a file for Arpit to open
   in Excel (DoD 8). Then do what SR-WORK-DOCS decision 10 says every task owes.
```
