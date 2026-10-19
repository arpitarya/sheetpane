# @sheetpane/review

**The review written into the download as a sheet of its own. Every error is listed on a *Review* sheet with a link to its cell. Optionally, each flagged cell is filled by severity, so a reviewer can work the list in Excel, fix the file and upload it again.**

A plugin for `@sheetpane/grid`. It uses one hook, `exportPatch`, on the
in-memory workbook, so it works for `<sheetpane-excel>` and for a store with
no page. `@sheetpane/grid` is a peer and `@sheetpane/export` is a dependency.
Versioned in lockstep with them. There is no `/ui` entry: the plugin adds two
items to the Download menu and nothing else. Everything is written into the
bytes the browser saves. Nothing is sent anywhere (SR-LAW-11).

## Use

```html
<script type="module">
  import '@sheetpane/grid';
  import '@sheetpane/review'; // registers "review"
</script>

<sheetpane-excel pane="q3" plugins="review" src="/files/holdings.xlsx" mode="edit" author="Arpit"></sheetpane-excel>
<sheetpane-errors pane="q3"></sheetpane-errors>
```

The Download menu gains **Add a Review sheet** (on by default) and **Colour
flagged cells** (off by default). Each one applies to the next download.

Without a page:

```ts
import { createWorkbook } from '@sheetpane/grid';
import { review } from '@sheetpane/review';

const plugin = review({ fill: true });           // colour flagged cells by default
const store = createWorkbook({ plugins: [plugin] });
await store.load(bytes, 'holdings.xlsx');
const { blob } = await store.exportFile();        // the file, plus a Review sheet
plugin.lastExport;                                // { sheet, listed, counts, filled, skipped }
```

## Options

| option | default | what |
|---|---|---|
| `sheet` | `true` | Add the Review sheet. `export({ review: false })` leaves it out of one export. |
| `fill` | `false` | Colour each flagged cell. `export({ reviewFills: true })` colours one export. |
| `sheetName` | `'Review'` | The sheet's name. Characters Excel forbids are dropped, and the name is cut to 31 characters. |
| `severities` | `['error', 'warning', 'note']` | The severities listed and coloured. Results such as `pass` and `skipped` are written only when you name them. `export({ reviewSeverities })` overrides it for one export. |
| `layers` | every layer | The layers listed and coloured. An error with no `layer` belongs to `review`. `export({ reviewLayers })` overrides it for one export. |
| `fills` | pale red, yellow, blue | A fill per severity, as `#RRGGBB`, `RRGGBB` or ARGB. `null` turns a severity's fill off. A value that is not a colour throws SP-5905. |

## The Review sheet

One row per error, below a header row that stays frozen. The workbook's own
errors come first. Then, for each sheet in the file's order, its whole-sheet
errors, then its cells from top to bottom and left to right.

| column | value |
|---|---|
| ID | `ERR-0003` |
| Sheet | the sheet's name; empty for an error about the workbook |
| Cell | `I6` or `A14:J14`, as a link that opens the cell in Excel. A whole-sheet error reads *Whole sheet* and links to its A1. A workbook error reads *Whole workbook* and has no link. |
| Severity · Type | `Error` · `Wrong value` |
| Found · Expected · Message · Author | as in the review |
| Status | `Open`, `Resolved` or `Accepted` |
| Accepted · Accepted by · Accepted at | for an accepted error: *Accepted: \<reason\>*, who accepted it and when (UTC) |

- **A user's own sheet is never overwritten.** If the file already has a
  sheet called *Review* (in any case), the new one is *Review (2)*.
- **The file's own comments are not listed.** These are errors with `author:
  'file'`, which came from the file in the first place.
- **Every cell is an inline string.** `sharedStrings.xml` is never touched,
  and the links are internal hyperlinks, which need no relationship.
- **No font is written** (SR-LAW-5). The header row is marked with a grey
  fill instead of bold text.

## Uploading an annotated file again

A hidden, workbook-scoped defined name, `_sheetpane_review`, marks the sheet.
`reviewSheetOf(book)` reads that name, so a host can leave the sheet out:

```ts
import { read } from '@sheetpane/import';
import { reviewSheetOf } from '@sheetpane/review';

const book = await read(bytes, { name: 'holdings.xlsx' });
const skip = reviewSheetOf(book);                  // 'Review', or undefined
const data = book.sheets.filter((s) => s.name !== skip);
```

When a file that already has a Review sheet is exported again, the plugin
rewrites that sheet in place rather than adding a second one. There is one
exception: if someone gave the sheet parts of its own in Excel, such as
comments or a drawing, it is left alone and a new sheet is added.

## Colouring flagged cells

Each **open** error at a cell has its cells filled by severity. **Accepted**
and **resolved** errors are not problems, so they are never filled.
Whole-sheet and workbook errors are listed but not coloured. They appear in
`lastExport.skipped` as `no-cell`.

- **The cell's own format stays.** Its `xf` is cloned with a solid fill and
  the cell points at the clone, so the number format, font, borders and
  alignment are kept. One clone is made per format and colour. Existing
  formats and fills are never edited, only added to.
- **Nothing else changes.** Only the `s` of a flagged cell is written. Every
  other row and cell keeps its exact bytes. A flagged cell the file does not
  have is added empty, styled from its row or column.
- **Two errors on one cell:** the worse severity's fill wins.
- **A range over 10,000 cells** colours only the cells the file already has
  in it (`range-capped`, SP-5903).
- **No styles part:** nothing is coloured (`no-styles`, SP-5904), and the
  sheet is still written.

## What it does not do

- It writes into an `.xlsx` download of an `.xlsx`. A CSV, or a CSV converted
  to `.xlsx`, carries no plugin parts.
- An empty review writes nothing.
- Whether Excel opens the file without a repair prompt and follows each link
  to its cell is checked by the decider on real Excel (W-30). These tests
  check the parts sheetpane writes and reads, not Excel itself.

Spec: [SR-REVIEW](../../records/0123_REVIEW.md). MIT.

**Using an AI coding agent?** `npx sheetpane-skills install` puts sheetpane's skills for Claude Code, Kiro and Codex into your repository.
