# @sheetpane/export

**A plain JavaScript object in, an `.xlsx` or `.csv` file out.** No runtime
dependencies. Runs in evergreen browsers and Node 22+. Used by
`@sheetpane/grid`'s Export button; usable on its own.

```sh
pnpm add @sheetpane/export      # or npm / yarn
```

## The object

```ts
type Cell = string | number | boolean | null;
interface Sheet {
  name: string; rows: Cell[][]; merges?: string[]; columnWidths?: number[]; hidden?: boolean;
  freeze?: { rows: number; cols: number };
  dataValidations?: DataValidation[]; conditionalFormats?: ConditionalFormat[];
}
interface Workbook { sheets: Sheet[]; dxfs?: Dxf[] }
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

## Dropdowns and conditional formats

A sheet's `dataValidations` and `conditionalFormats` are written as Excel's
own rules — the same shapes `@sheetpane/import` reads, so a rule read from a
file can be written back unchanged. A conditional format's `dxfId` picks the
format it applies from the workbook's `dxfs`.

```ts
const bytes = await toXlsx({
  sheets: [
    {
      name: 'Spec', rows: [['Item', 'Unit'], ['Bolt', null]],
      dataValidations: [{
        sqref: ['B2:B200'], type: 'list', formula1: 'Lists!$A$2:$A$9',   // or a literal: '"kg,m,pcs"'
        allowBlank: true, showErrorMessage: true, showDropDown: false,   // false shows the arrow (OOXML's inverted flag)
        prompt: 'Pick a unit', error: 'Not a unit on the Lists sheet',
      }],
      conditionalFormats: [{
        sqref: ['B2:B200'],
        rules: [{ type: 'expression', priority: 1, stopIfTrue: false, formulas: ['AND($A2<>"",$B2="")'], dxfId: 0 }],
      }],
    },
    { name: 'Lists', rows: [['Unit'], ['kg'], ['m'], ['pcs']] },
  ],
  dxfs: [{ font: { color: { rgb: 'FF9C0006' } }, fill: { patternType: 'solid', bgColor: { rgb: 'FFFFC7CE' } } }],  // a dxf's solid fill is bgColor
});
```

A rule Excel would repair — an unknown type, a title over 32 or a message over
255 characters, a typed-out list over 255, a `dxfId` with no format — is
refused with `SP-2015`, naming the sheet and range.

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

Options also rewrite a sheet's frozen pane (`freeze`), its merged ranges
(`merges`), its rules (`dataValidations`, `conditionalFormats`, with new
formats in `dxfs`) and what it hides (`hidden`):

```ts
await patchXlsx(originalBytes, [], {
  hidden: [
    { sheet: 'Holdings', rows: [3, 4, 5], cols: [2], outline: { rows: { 3: 1, 4: 1, 5: 1 } } },
    { sheet: 'Workings', state: 'hidden' },   // 'visible' | 'hidden' | 'veryHidden'
  ],
});
```

Each `hidden` list is the sheet's **whole** set after the edit (0-based): the
listed rows and columns are hidden and every other one is shown. `<col>` spans
are split and merged so widths and styles stay put. When the active sheet is
hidden, the workbook opens on the first visible one. Hiding every sheet is
refused (`SP-2002`).

```ts
const book = await read(originalBytes);                 // @sheetpane/import
await patchXlsx(originalBytes, [], {
  dataValidations: [{ sheet: 'Spec', rules: [...book.sheets[0].dataValidations, unitRule] }],
  dxfs: [{ fill: { patternType: 'solid', bgColor: { rgb: 'FFFFC7CE' } } }],
  conditionalFormats: [{ sheet: 'Spec', formats: [{ sqref: ['B2:B200'], rules: [
    { type: 'containsBlanks', priority: 1, stopIfTrue: false, formulas: ['LEN(TRIM(B2))=0'], dxfId: book.styles.dxfs.length },
  ] }] }],
});
```

Each list is the sheet's **whole** set: `[]` removes the block. `dxfs` are
added after the file's own, so the first new one is `book.styles.dxfs.length`.
An `exportPatch` hook can do the same with `setDataValidations(xml, rules)`
and `setConditionalFormats(xml, formats, dxfCount)`.

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

## Table references — `resolveStructuredRef(formula, sheets)`

An Excel table's structured reference as plain cells, from the tables each sheet
carries (`@sheetpane/import` reads them):

```js
resolveStructuredRef('Units[Unit]', book.sheets);
// { sheet: 'Lists', table: 'Units', ref: 'A2:A5', range: { top: 1, left: 0, bottom: 4, right: 0 } }
```

`Table[Column]` and `Table[[#Data],[Column]]` are the column's data rows;
`#Headers`, `#Totals` and `#All` name those rows; `Table[[A]:[B]]` spans columns;
`Table[]` and the bare name are the data body. `[#This Row]` and anything that is
not one range give `undefined`. `patchXlsx` keeps a workbook's table parts as they are.

## Errors

Every refusal is an `ExportError` with a `code` and the `sheet` / `ref` it is
about: a bad sheet name (1–31 characters, none of `[ ] : * ? / \`, unique
ignoring case), more than 1,048,576 rows or 16,384 columns, `NaN` or
`Infinity`, text over 32,767 characters, overlapping merges, a `hidden`
option that would leave no sheet visible, a validation or conditional-format
rule Excel would repair (`SP-2015`).

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

**Using an AI coding agent?** `npx sheetpane-skills install` puts sheetpane's skills for Claude Code, Kiro and Codex into your repository.
