# @sheetpane/import

**An `.xlsx` or `.csv` in, a plain JavaScript workbook out** — the same
`Workbook` shape [`@sheetpane/export`](../export/README.md) writes, so a file
round-trips: `toXlsx(await read(file))`. No runtime dependency but
`@sheetpane/export`. `@sheetpane/grid` reads every file through it; a host can
use it on its own.

```ts
import { read } from '@sheetpane/import';

const book = await read(file);            // a File, Blob, ArrayBuffer or Uint8Array
book.sheets[0].rows;                      // raw values: [['Account ID', …], ['AC-10021', 1200, 268.4, …]]
book.sheets[0].text;                      // display text: [['Account ID', …], ['AC-10021', '1,200', '268.40', …]]
```

## What you get

| field | what it is |
|---|---|
| `rows` | the stored values — text, numbers, booleans, `null`. Export writes these back. A formula cell holds its **saved** value. |
| `text` | what a cell shows: numbers through a small number-format subset (dates, times, percent, fixed decimals, thousands); anything outside it shows the raw stored text |
| `merges`, `columnWidths` | as `@sheetpane/export` takes them |
| `state` | `'visible'`, `'hidden'` or `'veryHidden'` (`<sheet state>`); `hidden` is kept as `state !== 'visible'` but is deprecated |
| `hiddenRows`, `hiddenCols` | 0-based, sorted; a zero height or width counts as hidden |
| `rowOutline`, `colOutline`, `outline`, `autoFilter` | outline levels per row and column (sparse `{ level, collapsed? }`), the deepest levels and summary placement, and the filter range |
| `formulas`, `styleIndex`, `freeze`, `rowHeights` | per sheet, for the grid and the plugins |
| `dataValidations`, `conditionalFormats`, `drawings`, `notes`, `threadedComments`, `pivotTables` | per sheet, parsed, for the plugins |
| `styles`, `themeColors`, `persons`, `definedNames`, `date1904` | per workbook |
| `part(path)` | any part of the package (a picture, a chart) without re-reading the ZIP |
| `sha256` | from `read()`: the SHA-256 of the bytes opened, 64 lowercase hex digits — which file this is. Absent on a page without Web Crypto (not `https` or `localhost`), with a console warning `SP-1009`; never a substitute hash. `sha256(bytes)` is exported for hashing anything else |

## CSV

```ts
import { fromCsv } from '@sheetpane/import';
const book = await fromCsv(text, { name: 'sales.csv' });   // delimiter , ; or tab detected; book.delimiter says which
```

UTF-8 with or without a BOM; CRLF, LF or CR; RFC 4180 quotes. Every cell is
text, as stored. The one sheet is named after the file.

## What it refuses

Every refusal is an `ImportError` with a `code`:

| code | when |
|---|---|
| `unsupported-format` | any other extension — `.xls`, `.xlsm`, `.xlsb`, `.ods`, `.numbers`, `.tsv`…; a macro-enabled workbook renamed `.xlsx`; a ZIP named `.csv` |
| `password-or-legacy` | an OLE compound file: a password-protected `.xlsx` or a legacy `.xls` |
| `not-workbook` | a ZIP without `xl/workbook.xml`, or bytes named `.xlsx` that are not a ZIP |
| `too-large` | ZIP64; more than 512 MB inflated in one part or 1 GB in all; past 1,048,576 rows or 16,384 columns |
| `corrupt` | broken DEFLATE, a CRC mismatch, XML that does not parse |

The spec is the record [SR-IMPORT](../../records/0104_IMPORT.md).

**Using an AI coding agent?** `npx sheetpane-skills install` puts sheetpane's skills for Claude Code, Kiro and Codex into your repository.
