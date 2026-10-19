# @sheetpane/fixtures

**Known workbooks for testing a sheetpane host — and a manifest that says what is in each.**

```js
import { bytes, url, path, info, MANIFEST } from '@sheetpane/fixtures';

excel.file = new Blob([await bytes('showcase.xlsx')]);     // browser or Node
excel.src = url('showcase.xlsx').href;                     // a URL your bundler copies
fs.readFileSync(path('csv/semicolon.csv'));                // Node
info('showcase.rules.json').errors;                        // the cells the rules sample fails
```

| file | what it holds |
|---|---|
| `showcase.xlsx` | one sheet per plugin: Numbers, Styles, Formulas, Validation, CondFmt, Images, Charts, Comments |
| `showcase.rules.json` | a rules file (SR-GRID 22d) that fails six cells of the showcase |
| `dependent-lists.xlsx` | dependent dropdowns: a Unit list `=INDIRECT($A2)` over one defined name per parameter; one stale unit (`Readings!C6`) |
| `edge/*.xlsx` | an empty sheet, a hidden sheet, non-ASCII names, a merged range, the 1904 date system, cached formula errors |
| `edge/legacy.xls`, `edge/not-a-zip.xlsx` | files sheetpane refuses (SR-LAW-3) |
| `csv/*.csv` | comma, semicolon, tab, BOM, quoted fields with newlines, cells the formula guard escapes |

`hugeCsv(rows)` makes the 250,000-row case on demand — it is a generator, not a file.

Every file is **hand-built** by `scripts/make.mjs` (parts written as XML and
zipped by `@sheetpane/export`'s `writeZip`; `just fixtures` rewrites them,
byte for byte the same). Hand-built files prove behaviour, not Excel
compatibility: files saved by Excel, Google Sheets, LibreOffice and Numbers
join with the app named in `appSaved` (W-30). No dependencies.

The spec is the record [SR-FIXTURES](../../records/0115_FIXTURES.md).

**Using an AI coding agent?** `npx sheetpane-skills install` puts sheetpane's skills for Claude Code, Kiro and Codex into your repository.
