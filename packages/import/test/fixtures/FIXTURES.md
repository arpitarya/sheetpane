# Import fixtures — origin and licence

Testing verdict decision 3: every committed fixture names where it came from.
No third-party workbook is committed.

| file | made by | how | licence |
|---|---|---|---|
| `exceljs-features.xlsx` | ExcelJS 4.4.0 (MIT), by `make.mjs` | `node packages/import/test/fixtures/make.mjs` | MIT, this repo — data invented from the design board |
| `exceljs-1904.xlsx` | ExcelJS 4.4.0, by `make.mjs` | the same command (`… make.mjs date1904`) | MIT, this repo |
| `exceljs-freeze.xlsx` | ExcelJS 4.4.0, by `make.mjs` | `… make.mjs freezes` — sheets `rows`, `cols`, `both` frozen, `split` a split pane | MIT, this repo |

**Generated at test time, never committed:** the design's sample workbook
(`@sheetpane/export`'s `toXlsx`), hand-written edge-case packages (built with
fflate in `edge.test.ts`), the 250,000-row CSV.

**Owed by the decider (W-30):** small files saved by **Excel, Google
Sheets, LibreOffice and Numbers** — his own files, no third-party data — added
here with a row each. None of those applications is on the build machine.
