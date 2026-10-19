---
type: Reference
description: "Every SP code sheetpane raises — what it means, the likely cause, the fix, and the record it comes from."
---

# Error codes

**Every message sheetpane shows a host carries a stable code.** A thrown
error, a console line, a rules-file note, a refused load or a blocked edit
reads `SP-3012: Plugin derive failed — … (…/ERRORS.md#sp-3012)`.

**A code is permanent.** It is never renumbered and never reused. A code no
longer raised stays in the registry, marked *retired*.

**The registry is code.** `CODES` in
[`packages/export/src/codes.ts`](../packages/export/src/codes.ts) holds each
code's title and severity; this page holds the long text. The repo test
`test/error-codes.test.ts` fails when the two disagree.

## Where the code is

| surface | where to read it |
|---|---|
| a thrown error | `err.spCode` on every one; `err.code` too, except on `ExportError` and `ImportError`, whose `code` stays the typed reason (`corrupt`, `password-or-legacy`, …) |
| a console warning or error | the text starts with the code and ends with the link to this page |
| a rules-engine note (`SheetpaneError`) | `error.code` — optional, so a v1 error without it stays valid |
| `sheetpane-load` with `status: 'error'` | `detail.spCode` (`detail.code` stays the reader's reason) |
| `sheetpane-editcancel` with `reason: 'blocked'` | `detail.code` |
| anything above | `codeOf(x)` from `@sheetpane/export` (or `@sheetpane/grid`) returns the code, or `undefined` |

## Ranges

| range | package |
|---|---|
| 1xxx | `@sheetpane/import` — reading a file |
| 2xxx | `@sheetpane/export` — writing a file, the ZIP walk, `download()` (21xx) |
| 3xxx | `@sheetpane/grid` — the store, the plugin host, `<sheetpane-excel>` |
| 4xxx | `<sheetpane-errors>` — none raised yet |
| 5xxx | plugins — 5100 numfmt · 5200 formulas · 5300 styles · 5400 validation · 5500 condfmt · 5600 images · 5700 charts · 5800 comments · 5900 review |
| 6xxx | column rules and the rules file |
| 7xxx | `@sheetpane/mcp` — reserved |

## Index

<!-- index:start — generated from CODES by test/error-codes.test.ts; run `SP_WRITE_ERRORS_DOC=1 pnpm exec vitest run --project repo` to rewrite it -->
| code | title | severity |
|---|---|---|
| [SP-1001](#sp-1001) | Not an .xlsx or .csv file | error |
| [SP-1002](#sp-1002) | Password-protected workbook | error |
| [SP-1003](#sp-1003) | Legacy .xls workbook | error |
| [SP-1004](#sp-1004) | Encrypted or OLE file | error |
| [SP-1005](#sp-1005) | Not a workbook | error |
| [SP-1006](#sp-1006) | File too large | error |
| [SP-1007](#sp-1007) | Damaged file | error |
| [SP-1008](#sp-1008) | Reading .xlsx needs a DOM (retired) | error |
| [SP-1009](#sp-1009) | No SHA-256 without Web Crypto | warning |
| [SP-2001](#sp-2001) | Invalid sheet name | error |
| [SP-2002](#sp-2002) | No visible sheet | error |
| [SP-2003](#sp-2003) | Sheet past Excel’s limits | error |
| [SP-2004](#sp-2004) | Not a cell reference | error |
| [SP-2005](#sp-2005) | Value a workbook cannot store | error |
| [SP-2006](#sp-2006) | No such sheet | error |
| [SP-2007](#sp-2007) | Invalid merge | error |
| [SP-2008](#sp-2008) | Not a ZIP archive | error |
| [SP-2009](#sp-2009) | ZIP64 archive refused | error |
| [SP-2010](#sp-2010) | Encrypted ZIP entry | error |
| [SP-2011](#sp-2011) | Unsupported ZIP compression | error |
| [SP-2012](#sp-2012) | Damaged archive | error |
| [SP-2013](#sp-2013) | Archive over the size limit | error |
| [SP-2014](#sp-2014) | Not a workbook package | error |
| [SP-2015](#sp-2015) | Invalid validation or conditional-format rule | error |
| [SP-2016](#sp-2016) | Insert or delete refused | error |
| [SP-2101](#sp-2101) | download() needs a file name | error |
| [SP-2102](#sp-2102) | Only .xlsx or .csv can be saved | error |
| [SP-2103](#sp-2103) | File type cannot be told | error |
| [SP-2104](#sp-2104) | Text cannot be saved as .xlsx | error |
| [SP-2105](#sp-2105) | File name is empty once cleaned | error |
| [SP-2106](#sp-2106) | download() needs a browser page | error |
| [SP-2107](#sp-2107) | download() data type not accepted | error |
| [SP-3001](#sp-3001) | Nothing is loaded to export | error |
| [SP-3002](#sp-3002) | Unknown plugin | error |
| [SP-3003](#sp-3003) | Not a plugin | error |
| [SP-3004](#sp-3004) | Plugin listed twice | error |
| [SP-3005](#sp-3005) | Plugin hook without its function | error |
| [SP-3006](#sp-3006) | Hook has one provider per pane | error |
| [SP-3007](#sp-3007) | Duplicate control id | error |
| [SP-3008](#sp-3008) | Unknown control slot | error |
| [SP-3009](#sp-3009) | Decorate order loops | error |
| [SP-3010](#sp-3010) | Plugin set a font family | error |
| [SP-3011](#sp-3011) | Plugin set fixed per pane | warning |
| [SP-3012](#sp-3012) | Plugin derive failed | error |
| [SP-3013](#sp-3013) | Plugin validate failed | error |
| [SP-3014](#sp-3014) | Plugin overlay failed | error |
| [SP-3015](#sp-3015) | Source could not be read | error |
| [SP-3016](#sp-3016) | Error meta dropped | warning |
| [SP-3017](#sp-3017) | renderDetail failed | error |
| [SP-3018](#sp-3018) | Error not accepted | warning |
| [SP-3019](#sp-3019) | Cell to open at not found | warning |
| [SP-3020](#sp-3020) | Nothing to check | error |
| [SP-3021](#sp-3021) | Layer name not valid | warning |
| [SP-3022](#sp-3022) | Delete would split a merged range | warning |
| [SP-3023](#sp-3023) | Insert or delete would move a pivot table | warning |
| [SP-3024](#sp-3024) | Insert would push cells off the sheet | warning |
| [SP-3025](#sp-3025) | Insert or delete would cut a table | warning |
| [SP-5001](#sp-5001) | Review sheet not written | error |
| [SP-5002](#sp-5002) | Flagged cells not coloured on a sheet | error |
| [SP-5003](#sp-5003) | Range too large to colour whole | note |
| [SP-5004](#sp-5004) | No styles part to colour cells | note |
| [SP-5005](#sp-5005) | Review fill is not a colour | error |
| [SP-5101](#sp-5101) | Selection too large to format | warning |
| [SP-5102](#sp-5102) | Not a style sheet | error |
| [SP-5103](#sp-5103) | Workbook has no style sheet | error |
| [SP-5201](#sp-5201) | Recalculation failed | error |
| [SP-5202](#sp-5202) | Formula engine did not load | error |
| [SP-5401](#sp-5401) | Rule check Excel validation cannot hold | warning |
| [SP-5402](#sp-5402) | Rule checks one Excel rule cannot combine | warning |
| [SP-5403](#sp-5403) | List Excel cannot type out | warning |
| [SP-5404](#sp-5404) | Rule bound Excel cannot read | warning |
| [SP-5405](#sp-5405) | No column or sheet for a rule to write | warning |
| [SP-5406](#sp-5406) | Cells keep the rule they already have | warning |
| [SP-5407](#sp-5407) | Sheet rules could not be rewritten | warning |
| [SP-5701](#sp-5701) | Chart part is not well-formed XML | error |
| [SP-5702](#sp-5702) | Chart part holds no chart | error |
| [SP-5801](#sp-5801) | Comment part has no container | error |
| [SP-5802](#sp-5802) | Not a worksheet | error |
| [SP-5803](#sp-5803) | Comments not written for a sheet | error |
| [SP-5804](#sp-5804) | Error with no cell not written as a comment | note |
| [SP-5901](#sp-5901) | Compare key is not a column | error |
| [SP-6001](#sp-6001) | Column rule pattern is not a regular expression | error |
| [SP-6002](#sp-6002) | Column-rules validate function failed | error |
| [SP-6003](#sp-6003) | Value refused by a rule | warning |
| [SP-6010](#sp-6010) | Rules file is not a JSON object | note |
| [SP-6011](#sp-6011) | Rules file could not be read | note |
| [SP-6012](#sp-6012) | Unknown rules file version | note |
| [SP-6013](#sp-6013) | Unknown key in the rules file | note |
| [SP-6014](#sp-6014) | Rules file has no sheets | note |
| [SP-6015](#sp-6015) | Rule is not an object | note |
| [SP-6016](#sp-6016) | Unknown rule word | note |
| [SP-6017](#sp-6017) | Unknown rule type | note |
| [SP-6018](#sp-6018) | Rules file pattern is not a regular expression | note |
| [SP-6019](#sp-6019) | Rule list is not a list | note |
| [SP-6020](#sp-6020) | Header row is not a row number | note |
| [SP-6021](#sp-6021) | Not a cell or a range | note |
| [SP-6022](#sp-6022) | Rules name a missing sheet | note |
| [SP-6023](#sp-6023) | No column has this title | note |
| [SP-6024](#sp-6024) | Two columns share a title | note |
| [SP-6025](#sp-6025) | Rules file rule replaces the element’s | note |
| [SP-7001](#sp-7001) | Tool input is missing or malformed | error |
| [SP-7002](#sp-7002) | No file at that path | error |
| [SP-7003](#sp-7003) | File too large for the tool | error |
| [SP-7004](#sp-7004) | Workbook could not be read | error |
| [SP-7005](#sp-7005) | No sheet by that name | error |
| [SP-7006](#sp-7006) | Not a sheetpane code | error |
| [SP-7007](#sp-7007) | Server data file missing | error |
<!-- index:end -->

---

## 1xxx · import

Raised by `read()`, `fromXlsx()` and `fromCsv()` as an `ImportError`; the
grid shows it as "Can't open this file" (or the password state) and fires
`sheetpane-load` with `status: 'error'`.

### SP-1001

**Not an .xlsx or .csv file** · error · [SR-IMPORT](../records/0104_IMPORT.md) · [SR-LAW-3](../records/0005_LAW-3-xlsx-and-csv-only.md) · `code: 'unsupported-format'`

- **Meaning:** sheetpane opens `.xlsx` and `.csv` only, and this file is neither.
- **Likely cause:** a `.xls`, `.xlsm`, `.xlsb`, `.ods`, `.numbers` or `.tsv` file; a ZIP named `.csv`; binary bytes with no name.
- **Fix:** save the file as `.xlsx` or `.csv` in the program that made it, then open it again.

### SP-1002

**Password-protected workbook** · error · [SR-IMPORT](../records/0104_IMPORT.md) · `code: 'password-or-legacy'`, `detail: 'password'`

- **Meaning:** the file is an encrypted `.xlsx` (an OLE file holding an `EncryptedPackage`).
- **Likely cause:** the workbook was saved with a password to open.
- **Fix:** remove the password in Excel (File → Info → Protect Workbook), save, and open it again.

### SP-1003

**Legacy .xls workbook** · error · [SR-IMPORT](../records/0104_IMPORT.md) · `code: 'password-or-legacy'`, `detail: 'legacy'`

- **Meaning:** the file is an OLE compound file without an encrypted package — the pre-2007 `.xls` format.
- **Likely cause:** an old workbook, or a `.xls` renamed to `.xlsx`.
- **Fix:** open it in Excel and save it as `.xlsx` or `.csv`.

### SP-1004

**Encrypted or OLE file** · error · [SR-IMPORT](../records/0104_IMPORT.md) · `code: 'password-or-legacy'`

- **Meaning:** the file is encrypted, but which kind cannot be told.
- **Likely cause:** a ZIP whose entries are encrypted (ZIP-level password).
- **Fix:** remove the password and save the workbook as a plain `.xlsx`.

### SP-1005

**Not a workbook** · error · [SR-IMPORT](../records/0104_IMPORT.md) · `code: 'not-workbook'`

- **Meaning:** the bytes are not an `.xlsx` workbook.
- **Likely cause:** a ZIP with no `xl/workbook.xml`, text named `.xlsx`, a workbook with no worksheets, or a file cut short in transfer.
- **Fix:** check the file opens in Excel; re-download or re-export it.

### SP-1006

**File too large** · error · [SR-IMPORT](../records/0104_IMPORT.md) · `code: 'too-large'`

- **Meaning:** the file is past a limit the reader keeps.
- **Likely cause:** a ZIP64 archive; a part over 512 MB or 1 GB in all inflated; more than 1,048,576 rows or 16,384 columns (Excel's own limits).
- **Fix:** split the workbook, or remove unused rows and columns, and save it again.

### SP-1007

**Damaged file** · error · [SR-IMPORT](../records/0104_IMPORT.md) · `code: 'corrupt'`

- **Meaning:** the file is a workbook, but part of it cannot be read.
- **Likely cause:** bad DEFLATE data, a CRC mismatch, XML that is not well-formed, a sheet pointing at a missing part.
- **Fix:** open and re-save it in Excel, which repairs most damage; then open it again.

### SP-1008

**Reading .xlsx needs a DOM** · error · **retired** · [SR-IMPORT](../records/0104_IMPORT.md) decision 8

- **Meaning:** no longer raised. `.xlsx` once needed `DOMParser`; since W-39 the reader carries its own XML parser for runtimes without one, so `.xlsx` reads in Node, workers and server renders.
- **Likely cause:** an older `@sheetpane/import`.
- **Fix:** upgrade `@sheetpane/import`. The code is kept so it is never reused.

### SP-1009

**No SHA-256 without Web Crypto** · warning · [SR-IMPORT](../records/0104_IMPORT.md) decision 11 · a console warning, not an `ImportError`

- **Meaning:** the file opened (or was exported) but has no fingerprint: `read()`'s `sha256`, and the `sha256` of `sheetpane-load` and `sheetpane-export`, are `undefined`. sheetpane never puts a substitute hash in its place.
- **Likely cause:** `crypto.subtle` is missing — the page is not a secure context (plain `http://` other than `localhost`, some embedded webviews), or a runtime without Web Crypto (Node before 20); rarely, `crypto.subtle.digest` itself failed.
- **Fix:** serve the page over `https://` (or from `localhost`); in Node, use version 20 or later.

---

## 2xxx · export

Raised by `toXlsx()`, `patchXlsx()`, `toCsv()` and the ZIP walk as an
`ExportError` (`sheet` and `ref` name where); `download()` errors (21xx) are
plain `Error`s or `TypeError`s.

### SP-2001

**Invalid sheet name** · error · [SR-EXPORT](../records/0103_EXPORT.md) · `code: 'sheet-name'`

- **Meaning:** a sheet name breaks Excel's rules.
- **Likely cause:** empty or over 31 characters; contains `[ ] : * ? / \`; starts or ends with `'`; used twice (case is ignored).
- **Fix:** rename the sheet; `checkSheetName()` tells you before you export.

### SP-2002

**No visible sheet** · error · [SR-EXPORT](../records/0103_EXPORT.md) · `code: 'sheet-count'`

- **Meaning:** a workbook needs at least one sheet, and at least one visible.
- **Likely cause:** `sheets: []`, or every sheet `hidden: true`; or a `patchXlsx` `hidden` option that would leave no sheet `visible`.
- **Fix:** add a sheet, or un-hide one.

### SP-2003

**Sheet past Excel’s limits** · error · [SR-EXPORT](../records/0103_EXPORT.md) · `code: 'too-large'`

- **Meaning:** a sheet has more than 1,048,576 rows or a row more than 16,384 columns.
- **Likely cause:** data larger than a worksheet holds; `ref` names the first cell past the limit.
- **Fix:** split the data across sheets, or export CSV.

### SP-2004

**Not a cell reference** · error · [SR-EXPORT](../records/0103_EXPORT.md) · `code: 'bad-ref'`

- **Meaning:** a change names a `ref` that is not an A1 cell.
- **Likely cause:** `A0`, a range, or a typo in a `patchXlsx` change; or a `patchXlsx` `hidden` row or column index that is not a whole number from 0 to 1,048,575 (rows) or 16,383 (columns).
- **Fix:** pass one A1 cell per change (`B7`).

### SP-2005

**Value a workbook cannot store** · error · [SR-EXPORT](../records/0103_EXPORT.md) · `code: 'bad-value'`

- **Meaning:** a cell holds something a workbook cell cannot.
- **Likely cause:** `NaN` or `Infinity`; text over 32,767 characters; an object or `undefined`; `rows` not an array of arrays; a `patchXlsx` `hidden` outline level outside 0–7 or a `state` other than `visible`, `hidden`, `veryHidden`.
- **Fix:** store text, a finite number, a boolean or `null`; the message names the cell.

### SP-2006

**No such sheet** · error · [SR-EXPORT](../records/0103_EXPORT.md) · `code: 'no-sheet'`

- **Meaning:** a change, merge or freeze names a sheet the workbook lacks.
- **Likely cause:** a renamed sheet, or a typo in the sheet name.
- **Fix:** use the exact sheet name from the workbook.

### SP-2007

**Invalid merge** · error · [SR-EXPORT](../records/0103_EXPORT.md) · `code: 'bad-merge'`

- **Meaning:** a merge is not a range of two or more cells, or overlaps another merge.
- **Likely cause:** a single cell given as a merge; two merges that share a cell.
- **Fix:** give `A1:C1`-style ranges that do not overlap.

### SP-2008

**Not a ZIP archive** · error · [SR-EXPORT](../records/0103_EXPORT.md) · `code: 'not-zip'`

- **Meaning:** no end-of-central-directory record was found.
- **Likely cause:** the bytes are not a ZIP (not an `.xlsx`), or were cut short.
- **Fix:** pass the original `.xlsx` bytes, unmodified.

### SP-2009

**ZIP64 archive refused** · error · [SR-EXPORT](../records/0103_EXPORT.md) · `code: 'zip64'`

- **Meaning:** the archive uses ZIP64, which sheetpane does not read.
- **Likely cause:** a package over 4 GB or 65,534 entries, or a tool that always writes ZIP64.
- **Fix:** re-save the workbook in Excel, which writes plain ZIP for normal sizes.

### SP-2010

**Encrypted ZIP entry** · error · [SR-EXPORT](../records/0103_EXPORT.md) · `code: 'encrypted'`

- **Meaning:** a ZIP entry is encrypted.
- **Likely cause:** the package was zipped with a password.
- **Fix:** re-save the workbook without a password.

### SP-2011

**Unsupported ZIP compression** · error · [SR-EXPORT](../records/0103_EXPORT.md) · `code: 'unsupported-compression'`

- **Meaning:** an entry uses a method other than store or DEFLATE.
- **Likely cause:** a tool that re-zipped the package with BZIP2, LZMA or similar.
- **Fix:** re-save the workbook in Excel.

### SP-2012

**Damaged archive** · error · [SR-EXPORT](../records/0103_EXPORT.md) · `code: 'corrupt'`

- **Meaning:** the archive or a part in it is damaged.
- **Likely cause:** a broken central directory or local header, an entry past the end, bad DEFLATE data, a CRC-32 mismatch, an unclosed row or `<sheetData>`.
- **Fix:** re-save the workbook in Excel; re-download it if it came over a network.

### SP-2013

**Archive over the size limit** · error · [SR-EXPORT](../records/0103_EXPORT.md) · `code: 'over-limit'`

- **Meaning:** reading would inflate past a cap, or writing would need ZIP64.
- **Likely cause:** a part over `maxEntrySize` (512 MB) or the whole over `maxTotalSize` (1 GB); a written archive over 4 GB or 65,534 entries.
- **Fix:** split the workbook; when calling `readZip` / `inflateEntry` yourself, raise their `limits` only for files you trust.

### SP-2014

**Not a workbook package** · error · [SR-EXPORT](../records/0103_EXPORT.md) · `code: 'not-workbook'`

- **Meaning:** `patchXlsx` was given a ZIP with no `xl/workbook.xml`.
- **Likely cause:** the upload was not an `.xlsx`, or the wrong bytes were passed.
- **Fix:** pass the original workbook's bytes.

### SP-2015

**Invalid validation or conditional-format rule** · error · [SR-EXPORT](../records/0103_EXPORT.md) · `code: 'bad-rule'`

- **Meaning:** a data-validation rule, conditional format or differential format given to `toXlsx` or `patchXlsx` cannot be written as Excel reads it (W-57).
- **Likely cause:** an empty or malformed `sqref`; an unknown `type`, `operator`, `errorStyle`, `timePeriod`, cfvo type or icon set; a title over 32 or a message over 255 characters; a quoted list over 255 characters; a conditional format with no rule; a `dxfId` the workbook has no format for; a colour scale, data bar or icon set without the thresholds or colour it needs.
- **Fix:** correct the rule the message names. Put a long list on a sheet and point `formula1` at the range; add the format to `dxfs` before naming its `dxfId`.

### SP-2016

**Insert or delete refused** · error · [SR-EXPORT](../records/0103_EXPORT.md) decision 11 · `code: 'bad-structure'`

- **Meaning:** `patchXlsx`'s `structure` option would have to move something it does not rewrite — a pivot table or its source range — or cut something Excel keeps whole: an array formula, a data table, or a table (all of it, its header or totals row, every data row, or columns inserted inside it). Nothing is written; the file is left as it was. Also thrown for an operation that is not an insert or delete of whole rows or columns.
- **Likely cause:** the grid's store refuses these first (SP-3022 to SP-3025); a host calling `patchXlsx` directly, or a table the store could not see, reaches this.
- **Fix:** insert or delete elsewhere — below a pivot's source, outside the table — or change the pivot or the table in Excel first.

### SP-2101

**download() needs a file name** · error · [SR-DOWNLOAD](../records/0101_DOWNLOAD.md) · `TypeError`

- **Meaning:** the second argument of `download()` is not a string.
- **Likely cause:** `download(bytes)` with no name.
- **Fix:** `download(bytes, 'report.xlsx')`.

### SP-2102

**Only .xlsx or .csv can be saved** · error · [SR-DOWNLOAD](../records/0101_DOWNLOAD.md) · [SR-LAW-3](../records/0005_LAW-3-xlsx-and-csv-only.md)

- **Meaning:** the file name ends in an extension other than `.xlsx` or `.csv`.
- **Likely cause:** `report.pdf`, `data.xls`.
- **Fix:** name the file `.xlsx` or `.csv`, or leave the extension off.

### SP-2103

**File type cannot be told** · error · [SR-DOWNLOAD](../records/0101_DOWNLOAD.md)

- **Meaning:** no extension was given and the Blob's type is neither `.xlsx` nor CSV.
- **Likely cause:** a Blob made without a `type`.
- **Fix:** add `.xlsx` or `.csv` to the name.

### SP-2104

**Text cannot be saved as .xlsx** · error · [SR-DOWNLOAD](../records/0101_DOWNLOAD.md)

- **Meaning:** a string was passed with an `.xlsx` name.
- **Likely cause:** `toCsv()` output saved under an `.xlsx` name.
- **Fix:** save text as `.csv`, or pass `toXlsx()` bytes.

### SP-2105

**File name is empty once cleaned** · error · [SR-DOWNLOAD](../records/0101_DOWNLOAD.md)

- **Meaning:** removing unsafe characters, spaces and dots left no name.
- **Likely cause:** a name like `  .xlsx`.
- **Fix:** give a name with letters or digits.

### SP-2106

**download() needs a browser page** · error · [SR-DOWNLOAD](../records/0101_DOWNLOAD.md)

- **Meaning:** there is no `document` to click a download link in.
- **Likely cause:** `download()` called in Node, a worker or a server render.
- **Fix:** write the bytes yourself there (`fs.writeFile`); call `download()` only in a page.

### SP-2107

**download() data type not accepted** · error · [SR-DOWNLOAD](../records/0101_DOWNLOAD.md) · `TypeError`

- **Meaning:** the first argument is not a `Uint8Array`, a `Blob` or a string.
- **Likely cause:** an `ArrayBuffer`, a number, or a `Promise` not awaited.
- **Fix:** pass `await toXlsx(…)`, `toCsv(…).text`, or a `Blob`.

---

## 3xxx · grid

The store, the plugin host and `<sheetpane-excel>`.

### SP-3001

**Nothing is loaded to export** · error · [SR-GRID](../records/0105_GRID.md) decision 6

- **Meaning:** `exportFile()` (or the element's `export()`) ran with no workbook in the pane.
- **Likely cause:** export called before `load()` settled, or after a refused load.
- **Fix:** wait for `sheetpane-load` with `status: 'ready'` before exporting.

### SP-3002

**Unknown plugin** · error · [SR-GRID](../records/0105_GRID.md) decision 18

- **Meaning:** the `plugins` attribute names an id no package has registered.
- **Likely cause:** the plugin's package was not imported, or was imported after the element connected; a typo in the id.
- **Fix:** `import '@sheetpane/<plugin>'` before the element is in the page.

### SP-3003

**Not a plugin** · error · [SR-GRID](../records/0105_GRID.md) decision 17

- **Meaning:** an entry in the plugin list is not `{ id, provides: [...] }`.
- **Likely cause:** a factory called twice, a missing `provides` array, `undefined` in the list.
- **Fix:** pass plugin objects — `numfmt()`, not `numfmt`.

### SP-3004

**Plugin listed twice** · error · [SR-GRID](../records/0105_GRID.md) decision 17

- **Meaning:** two plugins in one pane share an id.
- **Likely cause:** the same plugin passed twice to `createWorkbook({ plugins })`.
- **Fix:** list each plugin once.

### SP-3005

**Plugin hook without its function** · error · [SR-GRID](../records/0105_GRID.md) decision 17

- **Meaning:** a plugin's `provides` names a hook it does not implement.
- **Likely cause:** `provides: ['format']` with no `format()` method.
- **Fix:** implement the hook, or remove it from `provides`.

### SP-3006

**Hook has one provider per pane** · error · [SR-GRID](../records/0105_GRID.md) decision 17

- **Meaning:** two plugins provide `format` or `derive`, which have one provider per pane.
- **Likely cause:** two number-format or two formula plugins in one pane.
- **Fix:** keep one; the message names both.

### SP-3007

**Duplicate control id** · error · [SR-GRID](../records/0105_GRID.md) decision 19

- **Meaning:** two controls in one pane share an id.
- **Likely cause:** two plugins (or one plugin listed twice) adding the same control.
- **Fix:** give each control a unique id.

### SP-3008

**Unknown control slot** · error · [SR-GRID](../records/0105_GRID.md) decision 19

- **Meaning:** a control names a slot the grid does not have.
- **Likely cause:** a typo, or a slot from a newer grid.
- **Fix:** use one of `SLOTS` (`format-row`, `selbar`, `cellbar`, `status`, `cell`, `overlay`).

### SP-3009

**Decorate order loops** · error · [SR-GRID](../records/0105_GRID.md) decision 17

- **Meaning:** the `after` lists of `decorate` plugins form a cycle.
- **Likely cause:** plugin A runs after B and B after A.
- **Fix:** break the cycle in one plugin's `after`; the message shows the loop.

### SP-3010

**Plugin set a font family** · error · [SR-LAW-5](../records/0007_LAW-5-host-font.md) · [SR-GRID](../records/0105_GRID.md) decision 17

- **Meaning:** a `decorate` result named `font-family`; the host's font is the font.
- **Likely cause:** a plugin copying a workbook's font into the cell style.
- **Fix:** drop `font-family` from the plugin's `decorate` result.

### SP-3011

**Plugin set fixed per pane** · warning · [SR-GRID](../records/0105_GRID.md) decision 18

- **Meaning:** a later element named a different plugin set for a pane that already exists; it is ignored.
- **Likely cause:** `<sheetpane-errors pane="q3" plugins="…">` disagreeing with the sheet's `plugins`.
- **Fix:** give every element of one pane the same `plugins`, or set it on the first only.

### SP-3012

**Plugin derive failed** · error · [SR-GRID](../records/0105_GRID.md) decision 17

- **Meaning:** a plugin's `derive` threw or rejected; derived values were not updated.
- **Likely cause:** a bug in the plugin, or a cell it did not expect.
- **Fix:** read the error logged after this line; report it to the plugin's author.

### SP-3013

**Plugin validate failed** · error · [SR-GRID](../records/0105_GRID.md) decision 17

- **Meaning:** a plugin's `validate` threw for a sheet; that sheet's errors from it were not updated.
- **Likely cause:** a bug in the plugin, or a rule it cannot read.
- **Fix:** read the error logged after this line; report it to the plugin's author.

### SP-3014

**Plugin overlay failed** · error · [SR-GRID](../records/0105_GRID.md) decision 19a

- **Meaning:** a plugin's `overlay` threw; its items are not drawn.
- **Likely cause:** a bug in the plugin, or a drawing it cannot place.
- **Fix:** read the error logged after this line; report it to the plugin's author.

### SP-3015

**Source could not be read** · error · [SR-GRID](../records/0105_GRID.md) decision 9 · `code: 'unreadable'`

- **Meaning:** the `src` URL (or `load(url)`) could not be fetched; the pane shows "Can't open this file".
- **Likely cause:** a 404 or 403; a cross-origin URL without CORS; invalid base64.
- **Fix:** check the URL opens in the browser and is same-origin or CORS-enabled.

### SP-3016

**Error meta dropped** · warning · [SR-GRID](../records/0105_GRID.md) decision 5b

- **Meaning:** an error's `meta` (W-68) was not kept: it is not JSON (a cycle, a BigInt, a function on its own), or its JSON text is over 64 KiB (`ERROR_META_MAX`). The error itself is kept, without it; `updateError` leaves the error's own `meta` as it was.
- **Likely cause:** an image's pixels, a whole PDF page or a DOM node put in `meta`.
- **Fix:** keep a reference in `meta` — a page number, a box, an id the host resolves — and draw the picture in `renderDetail`.

### SP-3017

**renderDetail failed** · error · [SR-ERRORS](../records/0106_ERRORS.md) decision 13

- **Meaning:** the host's `renderDetail` threw for an error; nothing is shown in that card or row, and the rest of it works.
- **Likely cause:** a bug in the host's hook, or an error whose `meta` it did not expect (an older review, an error without one).
- **Fix:** read the error logged after this line; make the hook return `null` when it has nothing to show.

### SP-3018

**Error not accepted** · warning · [SR-GRID](../records/0105_GRID.md) decision 5c

- **Meaning:** an acceptance (W-69) did not stand. `acceptError` or `updateError(id, { status: 'accepted' })` changed nothing; or `setErrors` restored an `accepted` error as `open`.
- **Likely cause:** no reason was given, or only spaces; or the error is the workbook's own (author `workbook` or `file` — a validation rule or a file comment), which is not accepted this way.
- **Fix:** pass the reason the deviation was approved, e.g. `acceptError(id, 'Approved by the customer on 18 Oct', { by: 'Ravi' })`; keep `reason` when saving a review.

### SP-3019

**Cell to open at not found** · warning · [SR-GRID](../records/0105_GRID.md) decision 11d

- **Meaning:** the `ref` attribute, or the `#sheetpane=` link in the URL (`link="hash"`), names no cell of this workbook; the sheet opens where it would have (a bad link falls back to `ref`, a bad `ref` to A1).
- **Likely cause:** a typo (`B` or `4B` is not a cell), a sheet name the file does not have (names match exactly, case included), or a link saved for another file.
- **Fix:** write a cell or range as `B4`, `Data!B4` or `'Q3 data'!B4:D8`, and check the sheet's name in its tab.

### SP-3020

**Nothing to check** · error · [SR-GRID](../records/0105_GRID.md) decision 22f · `TypeError`

- **Meaning:** `check()` from `@sheetpane/grid/check` (or `@sheetpane/validation/check`) was given something that is not a file's bytes.
- **Likely cause:** a path or a parsed workbook passed instead of the bytes; an unresolved promise (`readFile` without `await`).
- **Fix:** pass the bytes — `await readFile(path)` in Node, a `File` or `Blob` in a page — and the file's `name` in the options.

### SP-3021

**Layer name not valid** · warning · [SR-GRID](../records/0105_GRID.md) decision 5d

- **Meaning:** a review layer (W-51) was named with something that is not a name: not a string, empty, over 64 characters, or holding a space. `setErrors(list, { layer })`, `getErrors({ layer })` and the `layers` property change nothing; an error restored or written with such a `layer` goes into `review`.
- **Likely cause:** a display label used as the name (`'PDF check'`), or a layer read from a file that was never set.
- **Fix:** name layers with short ids — `validation`, `pdf` — and give `<sheetpane-errors>` the words to show in `layerNames` (`{ pdf: 'PDF check' }`).

### SP-3022

**Delete would split a merged range** · warning · [SR-GRID](../records/0105_GRID.md) decision 21d

- **Meaning:** deleting these rows or columns would remove part of a merged range but not all of it; nothing is deleted. The menu item is greyed with this reason; `insertRows` and the other store methods return `false`.
- **Likely cause:** the selection crosses a merged block (a title row, a merged label).
- **Fix:** unmerge the range first, or delete every row (column) of it.

### SP-3023

**Insert or delete would move a pivot table** · warning · [SR-GRID](../records/0105_GRID.md) decision 21d

- **Meaning:** the operation would move a pivot table on this sheet, or the worksheet range a pivot table summarises; sheetpane does not rewrite pivots, so nothing changes.
- **Likely cause:** rows or columns inserted or deleted above, left of, or inside a pivot table or its source.
- **Fix:** insert or delete below and right of them, or change the pivot in Excel.

### SP-3024

**Insert would push cells off the sheet** · warning · [SR-GRID](../records/0105_GRID.md) decision 21d

- **Meaning:** the sheet already uses its last row (1,048,576) or column (XFD) — inserting would push those cells off the end; nothing is inserted, as Excel refuses.
- **Likely cause:** a value or formula at the sheet's edge.
- **Fix:** clear the cells at the edge first.

### SP-3025

**Insert or delete would cut a table** · warning · [SR-GRID](../records/0105_GRID.md) decision 21d

- **Meaning:** an Excel table cannot follow the operation — it would delete all of the table, its header or totals row, or every data row, or insert columns inside it; nothing changes.
- **Likely cause:** whole rows or columns selected across a table's edge.
- **Fix:** delete body rows or whole columns of the table, or change the table in Excel. Raised once the reader reads tables (W-61); until then a download that would cut a table is refused with SP-2016.

---

## 4xxx · the errors element

`<sheetpane-errors>` raises no code yet; the range is held for it.

---

## 5xxx · plugins

### SP-5001

**Review sheet not written** · error · [SR-REVIEW](../records/0123_REVIEW.md) decision 9

- **Meaning:** the workbook part could not be read or extended, so no Review sheet was added; the export goes on, with any fills already written. `lastExport.sheet` is `undefined`.
- **Likely cause:** a damaged `xl/workbook.xml`, or one with no `<sheets>`.
- **Fix:** read the error logged after this line; re-save the workbook in Excel and export again.

### SP-5002

**Flagged cells not coloured on a sheet** · error · [SR-REVIEW](../records/0123_REVIEW.md) decision 9

- **Meaning:** a sheet part (or the styles part) could not be read, so that sheet's flagged cells were left exactly as they were. Each error is in `lastExport.skipped` with `reason: 'unreadable-part'` and this code.
- **Likely cause:** a sheet part with no `<sheetData>`, a chart sheet, or a damaged part.
- **Fix:** read the error logged after this line; the Review sheet still lists the errors.

### SP-5003

**Range too large to colour whole** · note · [SR-REVIEW](../records/0123_REVIEW.md) decision 9

- **Meaning:** an error's range covers more than 10,000 cells (`MAX_FILL_CELLS`), so only the cells the file already has inside it were coloured; no empty cells were added. It is in `lastExport.skipped` with `reason: 'range-capped'` and this code, and in `filled`.
- **Likely cause:** an error raised on whole columns or a very large block.
- **Fix:** nothing to fix; narrow the error's range if every cell should be coloured.

### SP-5004

**No styles part to colour cells** · note · [SR-REVIEW](../records/0123_REVIEW.md) decision 9

- **Meaning:** the file has no readable styles part, so no cell was coloured; the Review sheet is still written, with an unstyled header. Each error is in `lastExport.skipped` with `reason: 'no-styles'` and this code.
- **Likely cause:** a minimal workbook written by a script.
- **Fix:** re-save the workbook in Excel, which adds the part.

### SP-5005

**Review fill is not a colour** · error · [SR-REVIEW](../records/0123_REVIEW.md) decision 8 · `TypeError`

- **Meaning:** `review({ fills })` was given a value that is not a hex colour; the plugin is not created.
- **Likely cause:** a colour name (`'red'`) or a short hex (`'#f00'`).
- **Fix:** pass `#RRGGBB`, `RRGGBB` or ARGB `AARRGGBB`, or `null` to colour none.

### SP-5101

**Selection too large to format** · warning · [SR-NUMFMT](../records/0109_NUMFMT.md)

- **Meaning:** a number-format action reached its cell cap; only the first cells were formatted.
- **Likely cause:** a format applied to whole columns or a very large range.
- **Fix:** select the cells that hold data, and apply again.

### SP-5102

**Not a style sheet** · error · [SR-NUMFMT](../records/0109_NUMFMT.md)

- **Meaning:** `xl/styles.xml` holds no `<styleSheet>`, so number formats cannot be written.
- **Likely cause:** a damaged workbook, or a tool that wrote an empty styles part.
- **Fix:** re-save the workbook in Excel and export again.

### SP-5103

**Workbook has no style sheet** · error · [SR-NUMFMT](../records/0109_NUMFMT.md)

- **Meaning:** the package lacks its styles part, so number formats cannot be written.
- **Likely cause:** a minimal workbook written by a script.
- **Fix:** re-save the workbook in Excel, which adds the part.

### SP-5201

**Recalculation failed** · error · [SR-FORMULAS](../records/0111_FORMULAS.md)

- **Meaning:** the formula engine failed while recalculating; the saved values stay until the next workbook.
- **Likely cause:** a formula or function the engine cannot evaluate.
- **Fix:** read the error logged after this line; reload the workbook.

### SP-5202

**Formula engine did not load** · error · [SR-FORMULAS](../records/0111_FORMULAS.md)

- **Meaning:** the WASM engine could not be fetched or started (with `preload`).
- **Likely cause:** the `.wasm` file is not served, a wrong `wasm` option, or a CSP blocking WebAssembly.
- **Fix:** serve the engine's `.wasm`, pass its URL as `wasm`, and allow `wasm-unsafe-eval` in the CSP.

### SP-5401

**Rule check Excel validation cannot hold** · warning · [SR-VALIDATION](../records/0108_VALIDATION.md)

- **Meaning:** writing the host's rules into the download (`rulesAsValidation`, W-58), a rule uses a check Excel's data validation has none of; the rule is not written and stays checked in sheetpane.
- **Likely cause:** the rule has a `pattern` (no regular expressions in Excel), a `noneOf` list, or `unique`.
- **Fix:** nothing to do for sheetpane. For Excel, add a `custom` rule by hand (`COUNTIF` for unique), or split the rule so its other checks are written.

### SP-5402

**Rule checks one Excel rule cannot combine** · warning · [SR-VALIDATION](../records/0108_VALIDATION.md)

- **Meaning:** a rule holds two checks — a list with `min` or `max`, a number with a length, `equals` with `oneOf`, a list whose values do not fit its `type` — and one Excel rule holds one; it is not written.
- **Likely cause:** a rule that asks for more than one thing.
- **Fix:** keep the check Excel users need most in the rule for that column, and move the other to a cell rule or leave it to sheetpane.

### SP-5403

**List Excel cannot type out** · warning · [SR-VALIDATION](../records/0108_VALIDATION.md)

- **Meaning:** a `oneOf` (or `equals`) list cannot be written as Excel's typed-out list, so it is not written.
- **Likely cause:** a value holds a comma (Excel splits the list on commas), the list is empty, or it is longer than 255 characters.
- **Fix:** shorten the list, or drop the commas from its values. A long list belongs on a sheet, with a list rule pointing at its range, written in the workbook itself.

### SP-5404

**Rule bound Excel cannot read** · warning · [SR-VALIDATION](../records/0108_VALIDATION.md)

- **Meaning:** a rule's `min`, `max`, `minLength` or `maxLength` cannot be written as an Excel operand; the rule is not written.
- **Likely cause:** a number bound that is not a number, a date bound not written as `2026-01-31` or a serial, a length that is not a whole number from 0, or a lower bound above the upper.
- **Fix:** write the bound as a number, an ISO date (`2026-01-31`) or a date serial.

### SP-5405

**No column or sheet for a rule to write** · warning · [SR-VALIDATION](../records/0108_VALIDATION.md)

- **Meaning:** a rule names a column title no sheet has in its title row, or a sheet the workbook lacks; it is not written.
- **Likely cause:** a renamed or misspelt column title or sheet name, or a `headerRow` that points at the wrong row. The rules engine says the same with SP-6022 or SP-6023.
- **Fix:** correct the title, the sheet name or `headerRow` in the rules file.

### SP-5406

**Cells keep the rule they already have** · warning · [SR-VALIDATION](../records/0108_VALIDATION.md)

- **Meaning:** a rule written into the download reaches cells that already hold a different rule — the workbook's own data validation, which always wins, or a stronger rule from the rules file (a cell rule over a column rule, a named sheet's over `"*"`'s). Excel holds one rule per cell, so the written rule leaves those cells. A rule that checks the same thing as the workbook's own joins it instead, and is not reported.
- **Likely cause:** the workbook was saved with its own rule on the column, or a cell rule sits inside a ruled column.
- **Fix:** nothing, if the workbook's own rule is the one wanted; otherwise remove it from the workbook, or make the two rules agree.

### SP-5407

**Sheet rules could not be rewritten** · warning · [SR-VALIDATION](../records/0108_VALIDATION.md)

- **Meaning:** a sheet's own `<dataValidations>` could not be rewritten with the host's rules added, so that sheet keeps its block as it was and none of the host's rules are written to it.
- **Likely cause:** the sheet's own rules include one `@sheetpane/export` refuses to write (SP-2015: an unknown type, a title over 32 characters, an `sqref` like `B:B`), or the sheet has no worksheet part.
- **Fix:** resave the workbook in Excel so its rules are in Excel's own form, or correct the rule the message names.

### SP-5701

**Chart part is not well-formed XML** · error · [SR-CHARTS](../records/0113_CHARTS.md)

- **Meaning:** a chart part cannot be parsed; the chart is not drawn.
- **Likely cause:** a damaged workbook.
- **Fix:** re-save the workbook in Excel.

### SP-5702

**Chart part holds no chart** · error · [SR-CHARTS](../records/0113_CHARTS.md)

- **Meaning:** a chart part has no `c:chart` element; the chart is not drawn.
- **Likely cause:** a chart type sheetpane does not read, or a damaged part.
- **Fix:** re-save the workbook in Excel; check the chart opens there.

### SP-5801

**Comment part has no container** · error · [SR-COMMENTS](../records/0112_COMMENTS.md)

- **Meaning:** a comments part the file already has lacks its root element, so it cannot be extended.
- **Likely cause:** a damaged comments or threaded-comments part.
- **Fix:** re-save the workbook in Excel; that sheet's comments are skipped (`unreadable-part`).

### SP-5802

**Not a worksheet** · error · [SR-COMMENTS](../records/0112_COMMENTS.md)

- **Meaning:** a sheet part has no `<worksheet>`, so comments cannot be anchored in it.
- **Likely cause:** a chart sheet or a damaged sheet part.
- **Fix:** comments live on worksheets only; that sheet's comments are skipped.

### SP-5803

**Comments not written for a sheet** · error · [SR-COMMENTS](../records/0112_COMMENTS.md)

- **Meaning:** writing one sheet's comments failed; the export goes on without them.
- **Likely cause:** SP-5801 or SP-5802 on that sheet, or an unexpected part.
- **Fix:** read the error logged after this line; the export report lists the skipped ids.

### SP-5804

**Error with no cell not written as a comment** · note · [SR-COMMENTS](../records/0112_COMMENTS.md) decision 3

- **Meaning:** an error about a whole sheet (`range: ""`) or the whole workbook (`sheet: ""`, W-55) is not written as an Excel comment — a comment needs a cell, and sheetpane never puts it on A1. It is listed in `lastExport.skipped` with `reason: 'no-cell'` and this code.
- **Likely cause:** the host or a rule raised a sheet- or workbook-level finding ("no Pages List", "a listed tab has no sheet").
- **Fix:** nothing to fix; the error stays in the review. To carry it in the file, add `@sheetpane/review`, which lists it on a Review sheet of its own.
### SP-5901

**Compare key is not a column** · error · [SR-COMPARE](../records/0124_COMPARE.md)

- **Meaning:** `diffWorkbooks` was given a key for one sheet that is not a column of both versions, so it cannot tell which rows are the same row.
- **Likely cause:** a header title spelled differently, a key column renamed or deleted in one version, or a `headerRow` that is not the row with the titles.
- **Fix:** name the key by its title in the header row (or by its column letter) as both versions have it; a key given for every sheet (a string, a list or `'*'`) is used only where it exists.

---

## 6xxx · column rules and the rules file

The rules engine (`packages/grid/src/pane/rules.ts`). A rules file never
throws: each problem is one `note` error, `author: 'host'`, with its `code`.

### SP-6001

**Column rule pattern is not a regular expression** · error · [SR-GRID](../records/0105_GRID.md) decision 22a · `TypeError`

- **Meaning:** a `pattern` in the element's `columns` does not compile.
- **Likely cause:** an unbalanced bracket or bad escape.
- **Fix:** test the pattern with `new RegExp(…)`; escape `\` once more inside a JS string.

### SP-6002

**Column-rules validate function failed** · error · [SR-GRID](../records/0105_GRID.md) decision 22c

- **Meaning:** the host's `validate(ctx, signal)` threw or rejected; that cell has no result.
- **Likely cause:** a bug in the host function, or a network call that failed.
- **Fix:** read the error logged after this line; return `null` rather than throw.

### SP-6003

**Value refused by a rule** · warning · [SR-GRID](../records/0105_GRID.md) decision 22b

- **Meaning:** a rule with `onInvalid: 'block'` refused a typed value; it is never stored. `sheetpane-editcancel` fires with `reason: 'blocked'` and this code.
- **Likely cause:** the value breaks the rule — the event's `message` says how.
- **Fix:** type a value the rule accepts, or set `onInvalid: 'flag'` to keep it as an error instead.

### SP-6010

**Rules file is not a JSON object** · note · [SR-GRID](../records/0105_GRID.md) decision 22d

- **Meaning:** the rules document is not an object; no rule from it is checked.
- **Likely cause:** an array, a string, or a number given as `rules`.
- **Fix:** give `{ "version": 1, "sheets": { … } }`.

### SP-6011

**Rules file could not be read** · note · [SR-GRID](../records/0105_GRID.md) decision 22d

- **Meaning:** `rules-src` could not be fetched or parsed; no rule from it is checked.
- **Likely cause:** a 404, CORS, or JSON that does not parse.
- **Fix:** open the URL in the browser and validate it against `@sheetpane/grid/rules.schema.json`.

### SP-6012

**Unknown rules file version** · note · [SR-GRID](../records/0105_GRID.md) decision 22d

- **Meaning:** `version` is not one this grid reads (1); no rule from it is checked.
- **Likely cause:** a missing `version`, or a file for a newer grid.
- **Fix:** set `"version": 1`.

### SP-6013

**Unknown key in the rules file** · note · [SR-GRID](../records/0105_GRID.md) decision 22d

- **Meaning:** a top-level or sheet-level key is not one the file defines; it is ignored.
- **Likely cause:** a typo (`colums`), or a key for a newer grid.
- **Fix:** top level: `$schema`, `version`, `sheets`; per sheet: `headerRow`, `columns`, `cells`.

### SP-6014

**Rules file has no sheets** · note · [SR-GRID](../records/0105_GRID.md) decision 22d

- **Meaning:** the file has no `sheets` object; no rule is checked.
- **Likely cause:** rules written at the top level.
- **Fix:** put them under `"sheets": { "*": { "columns": { … } } }`.

### SP-6015

**Rule is not an object** · note · [SR-GRID](../records/0105_GRID.md) decision 22d

- **Meaning:** a column rule, a cell rule or a sheet's rules is not an object; it is skipped.
- **Likely cause:** `"Age": 18` instead of `"Age": { "min": 18 }`.
- **Fix:** write each rule as an object of rule words.

### SP-6016

**Unknown rule word** · note · [SR-GRID](../records/0105_GRID.md) decision 22a

- **Meaning:** a rule names a word the vocabulary lacks; it is ignored.
- **Likely cause:** a typo (`requird`), or a word for a newer grid.
- **Fix:** use `required`, `type`, `min`, `max`, `minLength`, `maxLength`, `pattern`, `oneOf`, `noneOf`, `equals`, `unique`, `message`, `note`, `severity`, `onInvalid`.

### SP-6017

**Unknown rule type** · note · [SR-GRID](../records/0105_GRID.md) decision 22a

- **Meaning:** `type` is not one the engine checks.
- **Likely cause:** `"type": "string"` or `"float"`.
- **Fix:** use `text`, `number`, `integer`, `date` or `boolean`.

### SP-6018

**Rules file pattern is not a regular expression** · note · [SR-GRID](../records/0105_GRID.md) decision 22a

- **Meaning:** a `pattern` in the rules file does not compile; it is not tested.
- **Likely cause:** an unbalanced bracket, or a JSON escape eaten (`"\d"` must be `"\\d"`).
- **Fix:** escape backslashes twice in JSON.

### SP-6019

**Rule list is not a list** · note · [SR-GRID](../records/0105_GRID.md) decision 22a

- **Meaning:** `oneOf` or `noneOf` is not an array.
- **Likely cause:** `"oneOf": "Active"`.
- **Fix:** `"oneOf": ["Active", "Inactive"]`.

### SP-6020

**Header row is not a row number** · note · [SR-GRID](../records/0105_GRID.md) decision 22d

- **Meaning:** a sheet's `headerRow` is not a number of 1 or more; the default applies.
- **Likely cause:** `"headerRow": "2"` or `0`.
- **Fix:** `"headerRow": 2` (1-based).

### SP-6021

**Not a cell or a range** · note · [SR-GRID](../records/0105_GRID.md) decision 22d

- **Meaning:** a key under `cells` is not an A1 cell or range; its rule is skipped.
- **Likely cause:** `"A"`, `"1:1"`, or a typo.
- **Fix:** use `"B2"` or `"B2:B200"`.

### SP-6022

**Rules name a missing sheet** · note · [SR-GRID](../records/0105_GRID.md) decision 22d

- **Meaning:** the rules file names a sheet the workbook lacks; its rules are not checked.
- **Likely cause:** a renamed sheet, or rules written for another workbook.
- **Fix:** match the sheet's exact name, or use `"*"` for every sheet.

### SP-6023

**No column has this title** · note · [SR-GRID](../records/0105_GRID.md) decision 22a

- **Meaning:** a rule names a column title no sheet has in its header row; it is not checked.
- **Likely cause:** a renamed column, a different `header-row`, or a typo.
- **Fix:** match the title (trimmed, any case) or set `headerRow` / `header-row` to the row that holds it.

### SP-6024

**Two columns share a title** · note · [SR-GRID](../records/0105_GRID.md) decision 22a

- **Meaning:** a ruled title appears twice in the header row; only the first column is checked.
- **Likely cause:** a duplicated column, or two blank-looking titles.
- **Fix:** rename one column, or accept that the first is the one checked.

### SP-6025

**Rules file rule replaces the element’s** · note · [SR-GRID](../records/0105_GRID.md) decision 22d

- **Meaning:** the element's `columns` and the rules file both rule a title; the file's rule wins.
- **Likely cause:** rules kept in two places.
- **Fix:** keep the rule in one place.

---

## 7xxx · mcp

### SP-7001

**Tool input is missing or malformed** · error · [SR-MCP](../records/0119_MCP.md) decision 7

- **Meaning:** a tool was called without an argument it needs, or with one of the wrong kind.
- **Likely cause:** the agent left out `path`, `rules`, `code` or `task`, passed an empty string, or a task with no searchable words.
- **Fix:** call the tool again with the argument its input schema names (`tools/list` shows it).

### SP-7002

**No file at that path** · error · [SR-MCP](../records/0119_MCP.md) decision 7

- **Meaning:** the path given to `inspect_workbook`, `draft_rules` or `check_rules` names nothing.
- **Likely cause:** a typo, or a path relative to a different folder — relative paths are read from where the server runs.
- **Fix:** pass an absolute path, or one relative to the server's working directory.

### SP-7003

**File too large for the tool** · error · [SR-MCP](../records/0119_MCP.md) decision 7

- **Meaning:** the file is over the 256 MB the server reads.
- **Likely cause:** a very large export.
- **Fix:** inspect a smaller extract, or read it with `@sheetpane/import` in your own script.

### SP-7004

**Workbook could not be read** · error · [SR-MCP](../records/0119_MCP.md) decision 7

- **Meaning:** the import package failed on the file without one of its own SP-10xx codes.
- **Likely cause:** an internal failure while reading.
- **Fix:** report it with the file if you can share it; the reader's own refusals (SP-1001…SP-1007) are passed through with their codes.

### SP-7005

**No sheet by that name** · error · [SR-MCP](../records/0119_MCP.md) decision 7

- **Meaning:** `draft_rules` was asked for a sheet the workbook does not have.
- **Likely cause:** a misspelt or renamed sheet; names are matched exactly.
- **Fix:** use a name from the list in the message, or leave `sheet` out for every sheet.

### SP-7006

**Not a sheetpane code** · error · [SR-MCP](../records/0119_MCP.md) decision 7

- **Meaning:** `explain_code` was given something that is not in the registry.
- **Likely cause:** a typo, or a code from another library.
- **Fix:** codes look like `SP-1002`; the message lists nearby codes when there are any.

### SP-7007

**Server data file missing** · error · [SR-MCP](../records/0119_MCP.md) decision 7

- **Meaning:** the server could not find `ERRORS.md` beside it.
- **Likely cause:** an incomplete install, or a build run without its copy step.
- **Fix:** reinstall `@sheetpane/mcp`; from the repository, run `pnpm --filter @sheetpane/mcp build`.
