---
type: Handoff
name: W-12
description: "Arpit asked on 2026-10-18 for a downloader: one call that takes what @sheetpane/export produces and makes the browser save it as a file. Specified by SR-DOWNLOAD."
item: W-12
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-fable-5-1)"
ball: agent
---

# W-12 — Build the downloader: export output in, a saved file out

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Write the record for the downloader | one spec: [SR-DOWNLOAD](../../records/0101_DOWNLOAD.md) | ✅ 2026-10-18 (proposed) |
| 2 | Settle which package the downloader lives in | one home, no duplicate helper | ✅ `@sheetpane/export` (ruled 2026-10-18) |
| 3 | Build `download()`: bytes or text in, the browser's save prompt out | three lines of Blob and link code become one call | ⏳ |
| 4 | Prove it saves in Chromium, Firefox and WebKit | it works in the browsers people actually use | ⏳ |

**Arpit, 2026-10-18:** *"Create a work item for downloader."* Then: *"Create
an SR document for download … keep the examples in the work document as
well."*

**Model:** Sonnet — small, and every behaviour can be checked by a browser test.

## Goal

Build what [SR-DOWNLOAD](../../records/0101_DOWNLOAD.md) specifies: one
function, `download(data, filename, options?)`, that a host app or
`@sheetpane/grid`'s Export button calls to save an export. **The record is
the spec**; this file is the state and the examples.

## Examples

*The same examples as SR-DOWNLOAD §1. If they differ, the record wins.
The home is `@sheetpane/export` (ruled 2026-10-18 — [`export-shape.compare.md`](../compare/export-shape.compare.md) decision 4).*

**1 · Excel file**
```ts
import { toXlsx, download } from '@sheetpane/export';
download(await toXlsx(book), 'sales.xlsx');
// saves sales.xlsx, type application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

**2 · CSV text**
```ts
download(toCsv(sheet, { bom: true }), 'sales.csv');
// saves sales.csv, type text/csv;charset=utf-8; the BOM is kept so Excel shows "José" correctly
```

**3 · A Blob you already have**
```ts
download(new Blob([bytes]), 'report.xlsx');
```

**4 · Missing extension gets added**
```ts
download(await toXlsx(book), 'Q3 report');   // → Q3 report.xlsx  (bytes)
download(toCsv(sheet), 'Q3 report');         // → Q3 report.csv   (text)
```

**5 · Unsafe file names get cleaned**
```ts
download(bytes, 'FY26: North/South?.xlsx');  // → FY26_ North_South_.xlsx
```

**6 · Overriding the file type**
```ts
download(text, 'data.csv', { type: 'text/csv;charset=utf-8;header=present' });
```

**7 · Errors are explicit, never silent**
```ts
download(bytes, 'sales.pdf');
// ✗ Error: "sales.pdf" — sheetpane saves .xlsx or .csv only

download(new Blob([bytes]), 'mystery');
// ✗ Error: "mystery" — add .xlsx or .csv; the type can't be told from this Blob

download('a,b\n1,2', 'sales.xlsx');
// ✗ Error: "sales.xlsx" — text can't be saved as .xlsx; use .csv

download(bytes, 'sales.xlsx');   // in Node or a web worker
// ✗ Error: download() needs a browser page (no document); write the bytes yourself
```

**8 · Inside a button click, after the async export**
```ts
button.addEventListener('click', async () => {
  const bytes = await toXlsx(book);
  download(bytes, 'sales.xlsx');
});
```

**9 · With the grid's Export button**: no code needed.
```html
<sheetpane-excel src="sales.xlsx"></sheetpane-excel>
<!-- Export → object built from memory, edits included → toXlsx → download -->
```

**10 · Inside an iframe**: the host must allow downloads.
```html
<iframe src="app.html" sandbox="allow-scripts allow-downloads"></iframe>
```

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · record | SR-DOWNLOAD written, registered (`proposed`) | ✅ |
| 2 · home | **`@sheetpane/export`** (ruled 2026-10-18): `download` is exported from its index; `@sheetpane/grid`'s Export button calls it; SR-DOWNLOAD `owns:` and the Ownership table gain `packages/export/src/download/` in the change that lands the code (SR-DOWNLOAD decision 1) | ⏳ |
| 3 · behaviour | input, file type, extensions, file names, mechanism, no-page error and error messages, as SR-DOWNLOAD decisions 2–8 state | ⏳ |
| 4 · revoke delay | measured, and written into SR-DOWNLOAD decision 6 | ⏳ |
| 5 · zero-dep | no runtime dependency (SR-DOWNLOAD decision 9) | ⏳ |
| 6 · tests | a Vitest browser-mode test on Playwright ([`testing.compare.md`](../compare/testing.compare.md)) catches the download in Chromium per push and Firefox and WebKit nightly: name, size and first bytes for examples 1–5, and every error in example 7; what was run is written here | ⏳ |
| 7 · iOS | what iOS Safari does is tested and recorded in SR-DOWNLOAD Consequences | ⏳ |
| 8 · docs | the owning package's README documents `download` with the examples above and the iframe note | ⏳ |
| 9 · accepted | Arpit moves SR-DOWNLOAD from `proposed` to `accepted`; the register says `built: yes` | ⏳ 🔴 Arpit |

## Blockers

Waiting on **W-04** (build and tests must run). The home, the input types
(`Uint8Array` from `toXlsx`/`patchXlsx`, `string` from `toCsv`) and the runner
are decided. DoD 9 (Arpit accepts SR-DOWNLOAD) is the closing act, not a
blocker to building.

## Record affected

**[SR-DOWNLOAD](../../records/0101_DOWNLOAD.md)**: every behaviour change
lands with it in the same change.

## Hazards

- **Revoking the URL too early cancels the download** in some browsers. Test
  the delay; don't guess it.
- **Sandboxed iframes block downloads** without `allow-downloads`. Hosts embed
  sheetpane in iframes, so the README must say this.
- **Calling it after an `await`** (example 8). Test that every browser still
  saves.
- **The host may want to intercept the save**, e.g. to upload the file
  instead. That belongs to W-07's events contract; don't build it here.

## Reference

- [SR-DOWNLOAD](../../records/0101_DOWNLOAD.md) · [export verdict](../compare/export-shape.compare.md) decision 4 (the home) · [W-03](W-03-export-package.md) · [contract verdict](../compare/workbook-and-error-contract.compare.md) (events) · [testing verdict](../compare/testing.compare.md) (the runner)

## Prompt — paste into Claude Code once the blockers close

```text
You are building W-12 in the sheetpane monorepo: the downloader.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, records/0101_DOWNLOAD.md
   (SR-DOWNLOAD, the spec), this file (work/open/W-12-downloader.md), and
   work/compare/export-shape.compare.md decision 4 (the home: @sheetpane/export).
2. Plan the module and the browser tests in this file's body.
3. Implement SR-DOWNLOAD decisions 1–9 with zero runtime dependencies.
4. Verify with the real-browser tests in DoD 6, then do what SR-WORK-DOCS
   decision 10 says every task owes, including SR-DOWNLOAD in the same change.
```
