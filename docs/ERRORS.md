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
| 5xxx | plugins — 5100 numfmt · 5200 formulas · 5300 styles · 5400 validation · 5500 condfmt · 5600 images · 5700 charts · 5800 comments |
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
| [SP-5101](#sp-5101) | Selection too large to format | warning |
| [SP-5102](#sp-5102) | Not a style sheet | error |
| [SP-5103](#sp-5103) | Workbook has no style sheet | error |
| [SP-5201](#sp-5201) | Recalculation failed | error |
| [SP-5202](#sp-5202) | Formula engine did not load | error |
| [SP-5701](#sp-5701) | Chart part is not well-formed XML | error |
| [SP-5702](#sp-5702) | Chart part holds no chart | error |
| [SP-5801](#sp-5801) | Comment part has no container | error |
| [SP-5802](#sp-5802) | Not a worksheet | error |
| [SP-5803](#sp-5803) | Comments not written for a sheet | error |
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

---

## 4xxx · the errors element

`<sheetpane-errors>` raises no code yet; the range is held for it.

---

## 5xxx · plugins

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
