---
type: Compare
title: What @sheetpane/export takes in and gives out
description: "Input object, two writers (build and patch), cell types, compression, CSV defaults, runtimes. Verdict for W-03 (closes W-08; rules B-019, B-024)."
status: decided
decided: 2026-10-18
decided_by: "Arpit (Cowork, claude-fable-5-1) — ruling 'resolve all the blockers', 2026-10-18; verdict drafted by the session, open to override"
---

# What `@sheetpane/export` takes in and gives out

> **Verdict:** decided · **two writers**: `toXlsx(workbook)` builds a new file
> from a plain object, and `patchXlsx(original, changes)` rewrites only the
> changed cells inside the uploaded file so everything else survives (B-019
> ruled: export keeps what sheetpane does not show); `toCsv(sheet)` for CSV;
> **text as inline strings, numbers and booleans typed**; **deflate by default
> through `CompressionStream`, `store` as an option and the determinism test's
> mode**; **CSV: comma, CRLF, BOM on, formula-injection guard on and reported**;
> **browser and Node 20+** · confidence **high** · **reopen if** Excel shows a
> repair prompt on any fixture, or a host needs a cell type the object cannot
> carry.

## Context

Arpit asked for "a JavaScript object in, an Excel or CSV file out" as the
dependency of the Excel component. L6 says export carries every change and
never touches the original; L3 fixes the formats; L2 forbids non-FOSS
dependencies; the house default is zero runtime dependencies.

## Options — fidelity (B-019)

| | build from object only | patch the original | both |
|---|---|---|---|
| standalone use (any app) | yes | no | yes |
| keeps charts, comments, names, styles | no | yes | yes (patch path) |
| code | small | ZIP read + write | both |
| L6 "never modify the original" | yes | yes (new bytes) | yes |

**Chosen: both.** sheetpane's Export uses `patchXlsx` when the source was an
`.xlsx` and `toCsv` when it was a `.csv`; other apps use `toXlsx`.

## Decisions

### Input

```ts
type Cell = string | number | boolean | null;
interface Sheet { name: string; rows: Cell[][]; merges?: string[]; columnWidths?: number[]; hidden?: boolean }
interface Workbook { sheets: Sheet[] }
interface Change { sheet: string; ref: string; value: Cell }
```

1. `toXlsx(book: Workbook, o?: { compression?: 'deflate' | 'store' }): Promise<Uint8Array>`
2. `patchXlsx(original: Uint8Array, changes: Change[], o?): Promise<Uint8Array>` —
   re-serialises only the touched `<c>` elements; shared strings are left in
   place and new text goes in as inline strings; every other part is copied
   byte for byte.
3. `toCsv(sheet: Sheet, o?: { delimiter?: ',' | ';' | '\t'; bom?: boolean; eol?: '\r\n' | '\n'; guardFormulas?: boolean }): { text: string; guarded: string[] }`
4. **Output is `Uint8Array` / `string`.** **`download(data, filename)` also
   lives here** (W-12, [SR-DOWNLOAD](../../records/0101_DOWNLOAD.md)) — a host
   that only makes files should not need the UI package to save one. It
   touches `document` only when called; importing the package stays
   side-effect-free.

### Cell types

5. Strings → `t="inlineStr"` (no shared-string table to build; simpler,
   deterministic). Numbers → numeric `<v>`. Booleans → `t="b"`. `null` → no
   `<c>` element. A string that looks like a number stays a string.
6. Merges → `<mergeCells>`; the top-left cell gets a centred style — the one
   format sheetpane keeps. Column widths → `<cols>`. Hidden → `state="hidden"`.

### Determinism and compression

7. Default `deflate` via `CompressionStream('deflate-raw')` in the browser and
   `zlib.deflateRawSync` in Node (both built in, no dependency). Option
   `store` writes uncompressed and is **byte-identical everywhere**; the
   determinism test (W-03 DoD 6) runs in `store` mode; a second test proves
   `deflate` output round-trips. Fixed timestamp 1980-01-01, fixed entry order,
   no extra fields.

### CSV

8. Delimiter `,`; `\r\n`; UTF-8 BOM on (Excel needs it for accents); quoting per
   RFC 4180. **`guardFormulas` on by default:** a cell starting `=` `+` `-` `@`
   or a tab/CR gets a leading `'`; the guarded refs are returned so the host
   can tell the user. Multi-sheet to CSV: `toCsv` takes one sheet; sheetpane
   exports the active sheet and says so in the status line.

### Validation and runtimes

9. Sheet names 1–31 chars, none of `[ ] : * ? / \`, unique ignoring case; rows
   ≤ 1,048,576, columns ≤ 16,384 — errors name the sheet and the cell.
   XML-forbidden control characters are stripped and reported.
10. **Runs in browsers and Node 20+** (B-024 ruled: importing in Node must be
    safe). `@sheetpane/grid` registers its elements only when `customElements`
    exists; `@sheetpane/export` touches the DOM only inside `download()`, which
    throws a clear error where there is no `document`.

## Consequences

- W-03 DoD 2–7 and 9 are fully specified; `patchXlsx` adds a ZIP reader to
  the package, which W-01's reader then imports (one CRC-32, one ZIP walk).
- B-019 and B-024 leave the backlog; rulings written into SR-LAW-6 and SR-LAW-8.
- `store` mode doubles file size; it is the audit mode, not the default.

## References

- [`work/reference/specs/zip/zip-subset-notes.md`](../reference/specs/zip/zip-subset-notes.md).
- [`work/reference/specs/spreadsheetml/how-to-merge-two-adjacent-cells-in-a-spreadsheet.md`](../reference/specs/spreadsheetml/how-to-merge-two-adjacent-cells-in-a-spreadsheet.md),
  [`how-to-insert-text-into-a-cell-in-a-spreadsheet.md`](../reference/specs/spreadsheetml/how-to-insert-text-into-a-cell-in-a-spreadsheet.md).
- [`work/reference/specs/csv/owasp-csv-injection.md`](../reference/specs/csv/owasp-csv-injection.md), [`rfc4180-summary.md`](../reference/specs/csv/rfc4180-summary.md).
- [`work/reference/specs/web/mdn-compressionstream-constructor.md`](../reference/specs/web/mdn-compressionstream-constructor.md).
- Laws: [SR-LAW-3](../../records/0005_LAW-3-xlsx-and-csv-only.md), [SR-LAW-6](../../records/0008_LAW-6-edits-in-memory-export-with-changes.md), [SR-LAW-8](../../records/0010_LAW-8-npm-package.md).

## Reopen-trigger

Excel or LibreOffice showing a repair prompt on any W-03 fixture (DoD 8), or a
host needing a cell type the `Cell` union cannot carry.
**Check:** W-03 DoD 7 read-back and DoD 8.
