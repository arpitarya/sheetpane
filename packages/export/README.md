# @sheetpane/export

**A plain JavaScript object in, an `.xlsx` or `.csv` file out.** No runtime
dependencies. Runs in evergreen browsers and Node 20+. Used by
`@sheetpane/grid`'s Export button; usable on its own.

```sh
pnpm add @sheetpane/export      # or npm / yarn
```

## The object

```ts
type Cell = string | number | boolean | null;
interface Sheet { name: string; rows: Cell[][]; merges?: string[]; columnWidths?: number[]; hidden?: boolean }
interface Workbook { sheets: Sheet[] }
interface Change { sheet: string; ref: string; value: Cell }
```

`rows[0][0]` is A1. `merges` are ranges like `'A1:J1'` — the top-left cell is
centred, the one format sheetpane keeps. `columnWidths` are Excel character
widths.

## Build a new `.xlsx`

```ts
import { toXlsx } from '@sheetpane/export';

const bytes = await toXlsx({
  sheets: [{ name: 'Sales', rows: [['Region', 'Total'], ['North', 1200], ['South', 950.5]], columnWidths: [14, 10] }],
});
```

Text is written as inline strings, numbers and booleans typed. `{ compression:
'store' }` gives byte-identical output on every engine (larger; the audit
mode); the default compresses with `CompressionStream` / `zlib`.

## Patch the uploaded `.xlsx` — keep everything else

```ts
import { patchXlsx } from '@sheetpane/export';

const out = await patchXlsx(originalBytes, [
  { sheet: 'Holdings', ref: 'G6', value: 268.4 },
  { sheet: 'Holdings', ref: 'A7', value: 'AC-10044' },
]);
```

Only the changed cells are rewritten (their style is kept); every other part
of the file — charts, pivot tables, comments, names, styles — is copied byte
for byte. Excel is asked to recalculate formulas on open, and pivot tables
whose source changed to refresh.

## Write CSV

```ts
import { toCsv } from '@sheetpane/export';

const { text, guarded } = toCsv(sheet);                 // comma, CRLF, UTF-8 BOM
const semi = toCsv(sheet, { delimiter: ';', bom: false });
```

**Formula injection guard — on by default.** A text cell that starts with `=`
`+` `-` `@`, a tab or a carriage return gets a leading `'`, so a spreadsheet
shows it instead of running it. Plain numerals such as `-150` are left alone.
**This changes the data**; `guarded` lists the cells it touched (`['A1', …]`)
so your app can say so. Turn it off with `{ guardFormulas: false }`.

`toCsv` writes one sheet; for a multi-sheet workbook, pick the one you mean.

## Errors

Every refusal is an `ExportError` with a `code` and the `sheet` / `ref` it is
about: a bad sheet name (1–31 characters, none of `[ ] : * ? / \`, unique
ignoring case), more than 1,048,576 rows or 16,384 columns, `NaN` or
`Infinity`, text over 32,767 characters, overlapping merges.

## Save the file — `download(data, filename, options?)`

One call turns export output into a file the browser saves. `.xlsx` and
`.csv` only; the bytes are never changed. The spec is
[SR-DOWNLOAD](../../records/0101_DOWNLOAD.md).

```ts
import { toXlsx, toCsv, download } from '@sheetpane/export';

download(await toXlsx(book), 'sales.xlsx');                 // 1 · bytes → sales.xlsx
download(toCsv(sheet, { bom: true }).text, 'sales.csv');    // 2 · text, BOM kept: Excel shows "José"
download(new Blob([bytes]), 'report.xlsx');                 // 3 · a Blob you already have
download(await toXlsx(book), 'Q3 report');                  // 4 · → Q3 report.xlsx (text → .csv)
download(bytes, 'FY26: North/South?.xlsx');                 // 5 · → FY26_ North_South_.xlsx
download(text, 'data.csv', { type: 'text/csv;charset=utf-8;header=present' }); // 6 · your own type
```

**7 · Errors are explicit, never silent.** Each names the file:

```ts
download(bytes, 'sales.pdf');            // ✗ "sales.pdf" — sheetpane saves .xlsx or .csv only
download(new Blob([bytes]), 'mystery');  // ✗ "mystery" — add .xlsx or .csv; the type can't be told from this Blob
download('a,b', 'sales.xlsx');           // ✗ "sales.xlsx" — text can't be saved as .xlsx; use .csv
download(bytes, 'sales.xlsx');           // in Node or a worker:
                                         // ✗ download() needs a browser page (no document); write the bytes yourself
```

**8 · After an `await` in a click handler** works — tested in Chromium and WebKit:

```ts
button.addEventListener('click', async () => download(await toXlsx(book), 'sales.xlsx'));
```

**9 · With the grid,** `<sheetpane-excel>`'s Export button calls `download` for you.

**10 · Inside an iframe** the host must allow downloads, or the browser blocks
the save silently:

```html
<iframe src="app.html" sandbox="allow-scripts allow-downloads"></iframe>
```

The spec is the record [SR-EXPORT](../../records/0103_EXPORT.md).
