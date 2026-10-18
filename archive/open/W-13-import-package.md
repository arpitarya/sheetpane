---
type: Handoff
name: W-13
description: "Arpit asked on 2026-10-18 for a new package that imports .xlsx or .csv files and gives back JavaScript objects for @sheetpane/grid to use. The reader moves out of grid into it."
item: W-13
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-13 — Build the import package: `.xlsx` or `.csv` in, a JavaScript object out

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Create `packages/import` → `@sheetpane/import` (working name) | a reader anyone can use, with or without the UI | ✅ |
| 2 | Move the reader there, as the reading verdict designs it (ZIP walk, inflate, XML; a CSV state machine) | the grid stops parsing files and only displays them | ✅ |
| 3 | Return the same `Workbook` object `@sheetpane/export` takes in | import → edit → export round-trips with one shape | ✅ |
| 4 | Prove it on real files from Excel, Google Sheets, LibreOffice and Numbers | trust that real uploads open | ✅ ExcelJS + hand-written XML · ⏳ files from Excel, Sheets, LibreOffice, Numbers (Arpit) |

**Arpit, 2026-10-18:** *"Create a work item to create a new package to import
Excel or CSV files and give JS objects which will be used by grid package."*

**Model:** Opus — real-world files are messy, and "every fixture opens with
the right values" is a judgment no single unit test settles.

## Goal

A third package, `@sheetpane/import`, that turns an uploaded `.xlsx` or `.csv`
into a plain JavaScript object. `@sheetpane/grid` calls it to load a file, and
a host can call it on its own.

**This overrides decision 5 of the reading verdict**
([`xlsx-csv-reading.compare.md`](../compare/xlsx-csv-reading.compare.md)):
the reader leaves `packages/grid/src/read/` for its own package. Decisions 1–4
and 6 (own code, display text, CSV rules, refusals, hidden sheets) still hold,
and they move into this package unchanged.

**Likely shape** (this item's record confirms it):

```ts
import type { Workbook } from '@sheetpane/export';   // one shape for both directions

// sheets carry raw values in `rows` (what export writes back)
// and display text in `text` (what the grid shows, via the number-format subset)
type ImportedSheet = Workbook['sheets'][number] & { text: string[][] };
type ImportedWorkbook = { sheets: ImportedSheet[] };

read(source: File | Blob | ArrayBuffer | Uint8Array, o?: { name?: string }): Promise<ImportedWorkbook>;   // detects .xlsx or .csv
fromXlsx(data: ArrayBuffer | Uint8Array | Blob): Promise<ImportedWorkbook>;
fromCsv(text: string | Blob, o?: { name?: string; delimiter?: ',' | ';' | '\t' }): Promise<ImportedWorkbook>;
```

```ts
// how the grid uses it
const book = await read(file);       // the in-memory workbook starts from this
// … edits held in memory (L6, L9) …
await toXlsx(book);                  // or patchXlsx(original, changes) — the export verdict
```

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · package | `packages/import/` with manifest, `tsconfig.json`, README and `src/`; `@sheetpane/import`, `"sideEffects": false`, ESM with `.d.ts`; picked up by the pnpm workspace; versioned in lockstep with the other two (W-04) | ✅ `packages/import/` — manifest (`@sheetpane/import`, `sideEffects: false`, ESM + `.d.ts`, `publishConfig`), tsconfigs, README, `src/`; picked up by `packages/*`; lockstep `0.0.0`; packs clean (`just pack-check`) |
| 2 · zero-dep | no runtime dependency except `@sheetpane/export` through `workspace:` for the ZIP reader, CRC-32 and the `Workbook` type: one implementation of each, as the reading verdict's decision 5 requires | ✅ `dependencies: { "@sheetpane/export": "workspace:*" }` only — ZIP walk, inflate, CRC-32, A1 helpers, `shiftFormula` and the `Workbook` type all come from it |
| 3 · xlsx | every sheet; shared and inline strings; a formula cell's **saved value only**; merged ranges; column widths; hidden sheets marked; the 1904 date system — the reading verdict's decision 2 | ✅ `src/xlsx.ts`: every worksheet; shared and inline strings (phonetic runs dropped); a formula's cached value (+ `formulas`, shared ones expanded); merges; widths; hidden sheets; 1904 — `read.test.ts`, `edge.test.ts` |
| 4 · display | `text` per cell through the number-format subset; anything outside the subset shows the raw stored text; the raw value stays in `rows` | ✅ `src/numfmt.ts` — the subset; 35 cases against known Excel output (`numfmt.test.ts`); outside it `text` is the stored `<v>` (`[$€-407]…` → `1234.5`) |
| 5 · csv | the reading verdict's decision 3: delimiter detected among `,` `;` tab; UTF-8 with or without BOM; CRLF / LF / CR; RFC 4180 quotes; one sheet named after the file | ✅ `src/csv.ts` — `,` `;` tab detected, BOM, CRLF/LF/CR, RFC 4180 quotes, one sheet named after the file; round-trip property with `toCsv` (100 runs, seed 7) |
| 6 · refuse | the reading verdict's decision 4: extension and magic bytes both checked; legacy or password-protected files, non-workbook ZIPs, ZIP64 and over-limit sizes each throw a **typed error** the grid maps to its "Can't open" and password states (W-01 DoD 3) | ✅ `ImportError` codes `unsupported-format`, `password-or-legacy`, `not-workbook`, `too-large`, `corrupt`, `needs-dom` — every one exercised in `edge.test.ts` (incl. a macro-enabled workbook renamed `.xlsx`) |
| 7 · round-trip | `toXlsx(await read(file))` read back gives the same values, sheet names and merges, for every fixture (B-017's shape) | ✅ `toXlsx(read(file))` read again equals the first read — values, sheet names, merges, hidden — fast-check, 50 runs (seed 6); the design sample reads back cell for cell |
| 8 · grid uses it | `@sheetpane/grid` depends on `@sheetpane/import`; `packages/grid/src/read/` is never created; W-01 DoD 2 reads only through this package | ✅ `packages/grid/package.json` depends on `@sheetpane/import` (`workspace:*`); no `packages/grid/src/read/` exists; W-01 reads only through it |
| 9 · fixtures | files saved by Excel, Google Sheets, LibreOffice and Numbers, and the design's sample workbook built with `@sheetpane/export`; the 250,000-row CSV generated at test time; tests run where `DOMParser` and `DecompressionStream` are real (W-11's verdict) | ➡ moved to W-30 (Arpit, 2026-10-18: hold it; a separate testing item). ExcelJS-made fixtures, the design sample and the generated 250,000-row CSV are in |
| 10 · docs | `docs/ARCHITECTURE.md` diagram (`docs/architecture.svg`) redrawn with three packages; the README documents the API with examples | ✅ `docs/architecture.svg` redrawn with three packages (rendered in Chromium and checked); `docs/ARCHITECTURE.md` layout and order; the README documents the API |
| 11 · record | a component record (next free from `0101`); Ownership rows for `packages/import/` added to the register, owned by W-13 until then | ✅ [SR-IMPORT](../../records/0104_IMPORT.md) (0104); Ownership `packages/import/` → SR-IMPORT |
| 12 · for plugins | also exposed, as parsed objects, so no plugin re-reads the ZIP: each cell's style index `s`; `numFmts`, `cellXfs`, `fonts`, `fills`, `borders`, `dxfs` and `theme1.xml` colours; `<sheetView><pane>`; `<dataValidations>`; `<conditionalFormatting>`; drawing anchors, media and chart parts; comment, threaded-comment and person parts (plugins verdict Consequences) | ✅ `styleIndex`; `styles` (`numFmts`, `cellXfs`, `fonts`, `fills`, `borders`, `dxfs`, `indexedColors`); `themeColors`; `freeze`; `dataValidations` (incl. `x14`); `conditionalFormats`; `drawings` (anchors, media, chart paths) + `part(path)`; `notes`, `threadedComments`, `persons`; `pivotTables` — each asserted on a fixture |

## Blockers

None. **Closed 2026-10-18**: DoD 9 moved to W-30, every other row ✅; the live answer is [SR-IMPORT](../../records/0104_IMPORT.md).

## Record affected

**[SR-IMPORT](../../records/0104_IMPORT.md)** — written by this item.

## Hazards

- **The name is a working name.** `@sheetpane/import` mirrors
  `@sheetpane/export`; Arpit may rename it, e.g. `@sheetpane/read`. A rename
  before DoD 1 is free.
- **`import` depends on `export`** for the ZIP and CRC code. That keeps one
  implementation, but the names read oddly. If it grates, the alternative is a
  private shared module; it is not a fourth published package without
  Arpit's ruling.
- **Node.** `DOMParser` does not exist in Node, so reading `.xlsx` there needs
  a DOM. Importing the package in Node must not crash (L8); reading in Node is
  not promised unless Arpit rules it (B-024).
- **L3:** the reader never parses a format other than `.xlsx` or `.csv`, not
  even to give a better error message.
- **L6:** `rows` keeps the stored value, never the display text, so export
  writes back what was uploaded.

## Reference

- [`../compare/xlsx-csv-reading.compare.md`](../compare/xlsx-csv-reading.compare.md) — the reader's design (decision 5 overridden here)
- [`../compare/export-shape.compare.md`](../compare/export-shape.compare.md) — the `Workbook` type
- [`../../docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) · [W-01](W-01-sheetpane-excel.md) · [W-03](W-03-export-package.md)
- [`../reference/specs/zip/zip-subset-notes.md`](../reference/specs/zip/zip-subset-notes.md) · [`../reference/README.md`](../reference/README.md) §SpreadsheetML, §CSV

## Prompt — paste into Claude Code once the blockers close

```text
You are building W-13 in the sheetpane monorepo: @sheetpane/import.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, docs/ARCHITECTURE.md, this
   file (work/open/W-13-import-package.md), work/compare/xlsx-csv-reading.compare.md,
   work/compare/export-shape.compare.md and packages/export/src/zip/.
2. Plan the modules (xlsx, csv, formats, refuse) and the fixture list in this
   file's body before writing code.
3. Implement in packages/import/src/ with no runtime dependency but
   @sheetpane/export (workspace:). Wire @sheetpane/grid to it.
4. Verify: just check; the round-trip in DoD 7 over every fixture. Then do
   what SR-WORK-DOCS decision 10 says every task owes.
```
