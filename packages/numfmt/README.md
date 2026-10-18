# @sheetpane/numfmt

**Excel number formats for sheetpane — currency, dates, fractions, elapsed time, conditional sections, locales — as a plugin on the `format` hook.**

A plugin: it registers against the one in-memory workbook of `@sheetpane/grid`
(`createWorkbook({ plugins: [...] })`, or `plugins="numfmt"` on the element), so
`<sheetpane-excel>` and `<sheetpane-errors>` both see its effect. Versioned in
lockstep with `@sheetpane/grid`. Without it, the grid shows the small number-format
subset it ships with; with it, every format Excel can store.

- `@sheetpane/numfmt` — the headless plugin. Safe to import in Node (no DOM at import).
- `@sheetpane/numfmt/ui` — the controls it adds to the grid's `format-row`: a number-format dropdown and ± decimals. Opt-in.

Engine: [`numfmt`](https://www.npmjs.com/package/numfmt) 4.0.1 (MIT, zero dependencies), pinned.

## Install

```bash
npm install @sheetpane/grid @sheetpane/numfmt
```

## Use

By attribute — importing the package registers it under the id `numfmt`:

```html
<script type="module">
  import '@sheetpane/grid';
  import '@sheetpane/numfmt/ui'; // the format plugin *and* its controls; import '@sheetpane/numfmt' for the format alone
</script>
<sheetpane-excel plugins="numfmt" mode="edit"></sheetpane-excel>
```

By code:

```ts
import { createWorkbook } from '@sheetpane/grid';
import { numfmt } from '@sheetpane/numfmt';
import { ui } from '@sheetpane/numfmt/ui';

const workbook = createWorkbook({ plugins: [numfmt(), ui()] });
element.workbook = workbook;               // the element and <sheetpane-errors> share it
await workbook.load(bytes, 'holdings.xlsx');
workbook.text('Holdings', 'G3');           // '$1,234.50 '
```

`numfmt({ locale })` pins a locale; `ui({ locale, ask })` does the same for the controls and lets a host replace the
`window.prompt` that "Custom…" uses (return the code, or `null` to cancel).

## What it does

- **Display.** Every numeric cell's text comes from the library for every built-in id (0–49) and every custom code in the
  file's `<numFmts>`. `General` follows Excel's rule (11 characters, then scientific). A cell with no `s` uses xf 0.
- **1904.** `<workbookPr date1904>` is honoured: the library has no 1904 mode, so a date format's serial is shifted by 1,462
  days first. Elapsed-time formats (`[h]:mm`) are not dates and are not shifted.
- **Dates out of range** show `########`, as Excel does, not the bare number.
- **Fallback.** If the library rejects a code, the plugin says nothing and the core subset shows its text for that cell.
  `plugin.fallbacks()` lists those cells (`['Sheet1!B4']`).
- **Padding.** Accounting and `?` formats pad with spaces; the plugin also provides `decorate` with `white-space: pre` on
  those cells so HTML does not collapse them. It sets no font (SR-LAW-5).
- **Edits.** A format chosen in the UI is a change of kind `numFmt` (key `sheet!ref`, `now` = the code, `was` = the
  file's code). Choosing the file's own code again removes the change. Undo and redo work.
- **Export.** `exportPatch` appends the new `<numFmt>` entries and `<xf>` rows to `xl/styles.xml` — deduplicated, the base
  xf's font, fill, border and alignment kept — and repoints each changed cell's `s`. An en-US built-in code is written as its id.
  Cells nobody touched keep their `s`. A CSV has no styles; its export carries values only.

## The controls

`format-row`, Edit mode only:

- **Dropdown** — General · Number · Currency · Accounting · Date · Time · Percentage · Fraction · Scientific · Text · Custom…
  Number is `0.00`, Percentage `0.00%`, Fraction `# ?/?`, Scientific `0.00E+00`; Currency, Accounting, Date and Time are the
  locale's (`$#,##0.00_);($#,##0.00)` in English, `#,##0.00 €;-#,##0.00 €` in German).
- **Decrease / Increase decimals** — one `0` fewer or more after the point in every section of the code; on `General` it
  starts from the decimals the value shows. Dates, times, fractions and text are left alone.

A selection range applies to every **numeric** cell in it, within the sheet's data. Blank and text cells are skipped. So are
cells with a pending **value** edit: the grid keeps one change per cell, and a format would replace the edit. At most 10,000
cells are changed in one go (each is one change and one undo step) — the plugin warns when it stops.

The cell bar keeps showing the raw value (`1234.5`) while the cell shows the formatted text.

## Locales

The locale is `numfmt({ locale })`, else the page's `<html lang>`, read when a cell is formatted (a cell's text is cached
until it changes, so set `lang` before loading). An unknown tag means English. Tags may be written `de-DE` or `de_DE`.

- `de-DE`: `1.234.567,89`, `15 März 2023`, `12,3%`, `General` 1234,5; built-in ids 14–22 and 5–8, 41–44 become the locale's
  (id 14 → `15.03.2023`), as they do in Excel.
- `en-IN`: Indian grouping, `12,34,567.89` (any `-IN` territory).
- The library's other locales (about 70) are available by tag.

Note: a format that names its own locale, `[$€-407]#,##0.00`, is formatted with that locale's separators by the library
(`€1.234,50`). Excel may keep the reader's; this is unverified (see the record).

## Tests

`pnpm exec vitest run --project numfmt` — a real browser. The fixture table (`test/fixtures/table.ts`) holds the expected text
for every built-in id and 50 custom codes. **It was written from Excel's documented behaviour, not captured from Excel** —
there is no Excel on the build machine; regenerating the `expected` column with `TEXT()` is owed.

Spec: [`work/open/W-15-numfmt.md`](../../work/open/W-15-numfmt.md).
How plugins plug in: [`work/compare/plugins.compare.md`](../../work/compare/plugins.compare.md).
