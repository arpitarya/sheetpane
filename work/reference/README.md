---
type: Index
description: "Index of the reference material for building sheetpane — downloaded specs and the design snapshot, each with its source, licence and the items that use it."
---

# `work/reference/` — what a builder reads before writing code

**What this is.** Documents downloaded for the build items, so a Claude Code
session can read them without the network. **Reference, not spec:** what to
build lives in each item's file in [`../open/`](../open/README.md).

**Fetched 2026-10-18** from the sources below. Files keep their upstream
form (Markdown, HTML, text); nothing was edited except where a row says
*summary* or *our notes*. **Links inside the upstream files point at their own
sites and are not repaired** — like `archive/`, those copies are frozen.

## Start here

| if you are building | read first |
|---|---|
| **W-01** `SheetPaneExcel` | [design](design/README.md) · [SpreadsheetML](#spreadsheetml--whats-inside-an-xlsx) · [ZIP notes](specs/zip/zip-subset-notes.md) · [grid a11y](#accessibility--wai-aria-authoring-practices) · [virtualisation](#virtualisation) |
| **W-02** `SheetPaneErrors` | [design](design/README.md) · [React store](#react) |
| **W-03** `@sheetpane/export` | [ZIP notes](specs/zip/zip-subset-notes.md) · [SpreadsheetML](#spreadsheetml--whats-inside-an-xlsx) · [CSV](#csv) · [compression streams](#web-platform--mdn) |
| **W-04** the monorepo | nothing here — the item file |
| **W-09** the demo apps | [design](design/README.md) (the `Host-*` boards) · [custom elements](specs/web/mdn-using-custom-elements.md) |
| **W-14–W-24, W-29** plugins, undo, freeze, tokens | [design](design/README.md) §The plugin boards — `Slot-Map` first, then the board named in each item file |

## Design

| file | what it is |
|---|---|
| [`design/README.md`](design/README.md) | the canvas snapshot — what each board shows and how to read a `.dc.html` |
| [`design/boards/`](design/boards/) | the ten component boards and fifteen plugin boards (incl. the shared `PluginKit` grid) as source, the Proof tokens (`proof.css`), sheetpane's classes (`sheetpane.css`) and the plugin classes and `--sp-*` layer (`sp-plugins.css`) |

## SpreadsheetML — what's inside an `.xlsx`

Source: [OfficeDev/open-xml-docs](https://github.com/OfficeDev/open-xml-docs) `docs/spreadsheet/`, commit `6f1822dd` (2026-09-09) · licence MIT.
The code samples are C# for the Open XML SDK — **read them for the XML, not the API**.

| file | why it matters |
|---|---|
| [`overview.md`](specs/spreadsheetml/overview.md) | the map of the docs |
| [`structure-of-a-spreadsheetml-document.md`](specs/spreadsheetml/structure-of-a-spreadsheetml-document.md) | **start here** — workbook, worksheet, sheetData, row, c, v; the minimum parts |
| [`working-with-sheets.md`](specs/spreadsheetml/working-with-sheets.md) | `<sheets>`, `<sheet r:id>`, sheet state (hidden) |
| [`working-with-the-shared-string-table.md`](specs/spreadsheetml/working-with-the-shared-string-table.md) | `t="s"` cells and `sharedStrings.xml` |
| [`working-with-formulas.md`](specs/spreadsheetml/working-with-formulas.md) | `<f>` vs the cached `<v>` — sheetpane shows `<v>` only |
| [`how-to-merge-two-adjacent-cells-in-a-spreadsheet.md`](specs/spreadsheetml/how-to-merge-two-adjacent-cells-in-a-spreadsheet.md) | `<mergeCells>` / `<mergeCell ref>` |
| [`how-to-retrieve-the-values-of-cells-in-a-spreadsheet.md`](specs/spreadsheetml/how-to-retrieve-the-values-of-cells-in-a-spreadsheet.md) | resolving a cell's display value by type |
| [`how-to-retrieve-a-list-of-the-worksheets-in-a-spreadsheet.md`](specs/spreadsheetml/how-to-retrieve-a-list-of-the-worksheets-in-a-spreadsheet.md) | listing sheets |
| [`how-to-retrieve-a-list-of-the-hidden-worksheets-in-a-spreadsheet.md`](specs/spreadsheetml/how-to-retrieve-a-list-of-the-hidden-worksheets-in-a-spreadsheet.md) | hidden sheets |
| [`how-to-retrieve-a-list-of-the-hidden-rows-or-columns-in-a-spreadsheet.md`](specs/spreadsheetml/how-to-retrieve-a-list-of-the-hidden-rows-or-columns-in-a-spreadsheet.md) | hidden rows and columns, `<cols>` widths |
| [`how-to-get-a-column-heading-in-a-spreadsheet.md`](specs/spreadsheetml/how-to-get-a-column-heading-in-a-spreadsheet.md) | A1 references ↔ indexes |
| [`how-to-insert-text-into-a-cell-in-a-spreadsheet.md`](specs/spreadsheetml/how-to-insert-text-into-a-cell-in-a-spreadsheet.md) | writing a text cell |
| [`how-to-create-a-spreadsheet-document-by-providing-a-file-name.md`](specs/spreadsheetml/how-to-create-a-spreadsheet-document-by-providing-a-file-name.md) | the parts a new workbook needs |
| [`how-to-parse-and-read-a-large-spreadsheet.md`](specs/spreadsheetml/how-to-parse-and-read-a-large-spreadsheet.md) | streaming (SAX) vs loading whole parts |

## ZIP — the container

| file | what it is |
|---|---|
| [`specs/zip/zip-subset-notes.md`](specs/zip/zip-subset-notes.md) | **our notes** — the headers, CRC-32, DOS dates, raw DEFLATE, determinism |
| `specs/zip/_local/pkware-appnote-6.3.4.txt` | the full PKWARE spec — **gitignored**: its licence forbids redistribution. Fetch it with the command below |

## CSV

| file | source · licence |
|---|---|
| [`specs/csv/rfc4180-summary.md`](specs/csv/rfc4180-summary.md) | **summary** of RFC 4180 — the source was not reachable from this machine; [rfc-editor.org/rfc/rfc4180](https://www.rfc-editor.org/rfc/rfc4180) |
| [`specs/csv/w3c-csvw-tabular-data-model.html`](specs/csv/w3c-csvw-tabular-data-model.html) | W3C *Model for Tabular Data and Metadata on the Web* — [w3c/csvw](https://github.com/w3c/csvw) `syntax/` · W3C Document License |
| [`specs/csv/owasp-csv-injection.md`](specs/csv/owasp-csv-injection.md) | OWASP *CSV Injection* — why exported cells starting `=` `+` `-` `@` are escaped · CC BY-SA 4.0 |

## Web platform — MDN

Source: [mdn/content](https://github.com/mdn/content) `files/en-us/web/api/` · licence CC BY-SA 2.5, © Mozilla Contributors.

| file | for |
|---|---|
| [`mdn-compressionstream.md`](specs/web/mdn-compressionstream.md) · [constructor](specs/web/mdn-compressionstream-constructor.md) | writing DEFLATE (`'deflate-raw'`) |
| [`mdn-decompressionstream.md`](specs/web/mdn-decompressionstream.md) · [constructor](specs/web/mdn-decompressionstream-constructor.md) | reading DEFLATE |
| [`mdn-domparser.md`](specs/web/mdn-domparser.md) · [parseFromString](specs/web/mdn-domparser-parsefromstring.md) | parsing the XML parts with no dependency |
| [`mdn-textencoder.md`](specs/web/mdn-textencoder.md) | UTF-8 bytes for names and XML |
| [`mdn-blob.md`](specs/web/mdn-blob.md) · [URL.createObjectURL](specs/web/mdn-url-createobjecturl.md) | handing the exported file to the user |
| [`mdn-using-custom-elements.md`](specs/web/mdn-using-custom-elements.md) | the `<sheetpane-excel>` / `<sheetpane-errors>` wrappers |
| [`mdn-dialog-showmodal.md`](specs/web/mdn-dialog-showmodal.md) | the pop-up placement |

## Accessibility — WAI-ARIA Authoring Practices

Source: [w3c/aria-practices](https://github.com/w3c/aria-practices) `content/patterns/` · W3C Software and Document License.

| file | for |
|---|---|
| [`apg-grid-pattern.html`](specs/a11y/apg-grid-pattern.html) | the grid's roles and keyboard model |
| [`apg-data-grids-example.html`](specs/a11y/apg-data-grids-example.html) | a worked data grid |
| [`apg-tabs-pattern.html`](specs/a11y/apg-tabs-pattern.html) | sheet tabs |
| [`apg-toolbar-pattern.html`](specs/a11y/apg-toolbar-pattern.html) | the toolbar and the selection bar |
| [`apg-dialog-modal-pattern.html`](specs/a11y/apg-dialog-modal-pattern.html) | the pop-up |

## React

Source: [reactjs/react.dev](https://github.com/reactjs/react.dev) `src/content/reference/` · CC BY 4.0.

| file | for |
|---|---|
| [`react-useSyncExternalStore.md`](specs/react/react-useSyncExternalStore.md) | the subscribe/snapshot store shape — and how the React demo (W-09) reads it |
| [`react-createPortal.md`](specs/react/react-createPortal.md) | how a React host renders the pop-up outside its layout (W-09) |

## Virtualisation

Source: [TanStack/virtual](https://github.com/TanStack/virtual) `docs/` · MIT. **Reference for the technique** — whether to take it as a dependency is W-06's call.

| file | for |
|---|---|
| [`tanstack-virtual-introduction.md`](specs/virtual/tanstack-virtual-introduction.md) | what row/column virtualisation is |
| [`tanstack-virtual-virtualizer-api.md`](specs/virtual/tanstack-virtual-virtualizer-api.md) | the API shape, if adopted or mirrored |

## Not here — and why

- **ECMA-376 itself** (the Office Open XML standard). ecma-international.org is
  not reachable from this machine. Get it from the
  [Ecma page](https://ecma-international.org/publications-and-standards/standards/ecma-376/)
  if the Microsoft docs above fall short.
- **RFC 4180 verbatim** — see the summary's banner.
- **Excel's limits** (1,048,576 rows, 16,384 columns, 31-character sheet names,
  32,767 characters a cell) — from Microsoft's *Excel specifications and
  limits*; check the source before relying on them.

## Refreshing this folder

Run from the repo root. GitHub raw is the only host this was fetched from.

```bash
GH=https://raw.githubusercontent.com
# the PKWARE spec — local only, never committed
mkdir -p work/reference/specs/zip/_local
curl -fsSL -o work/reference/specs/zip/_local/pkware-appnote-6.3.4.txt \
  $GH/nih-at/libzip/78d1fd993e01c0adfd437f78d518ca60e396fd57/docs/appnote.txt
# any other file: the source repo and path in its section above, e.g.
curl -fsSL -o work/reference/specs/web/mdn-compressionstream.md \
  $GH/mdn/content/main/files/en-us/web/api/compressionstream/index.md
```
