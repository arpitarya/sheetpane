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

## Save the file

`download(data, filename)` — see below.

The spec is the record [SR-EXPORT](../../records/0103_EXPORT.md).
