# @sheetpane/comments

**Excel's comments and sheetpane's errors, in both directions. When a file loads, its notes and threaded comments show up in `<sheetpane-errors>`. When you export, every error in the review goes into the file as an Excel threaded comment on its cell.**

A plugin for `@sheetpane/grid`. It works through the `validate` and
`exportPatch` hooks of the one in-memory workbook, so `<sheetpane-excel>` and
`<sheetpane-errors>` on the same pane both see it. No runtime dependencies;
`@sheetpane/grid` is a peer. Versioned in lockstep with it. There is no
`/ui` entry, because the plugin adds no controls.

## Use

```html
<script type="module">
  import '@sheetpane/grid';
  import '@sheetpane/comments'; // registers "comments"
</script>

<sheetpane-excel pane="q3" plugins="comments" src="/files/holdings.xlsx" mode="edit" author="Arpit"></sheetpane-excel>
<sheetpane-errors pane="q3"></sheetpane-errors>
```

Without a page:

```ts
import { createWorkbook } from '@sheetpane/grid';
import { comments } from '@sheetpane/comments';

const plugin = comments();                  // comments({ write: false }) reads only
const store = createWorkbook({ plugins: [plugin] });
await store.load(bytes, 'holdings.xlsx');
store.getErrors();                          // the file's notes and threads, as `file` notes
const { blob } = await store.exportFile();  // the review written in as threaded comments
plugin.lastExport;                          // { written: [ids], skipped: [{ id, reason }] }
```

## What is read

The plugin reads every legacy note (`xl/comments*.xml`) and every threaded
comment (`xl/threadedComments/*`). Each commented cell becomes one entry in
the error list:

| field | value |
|---|---|
| `type` | `comment` (shown as "Comment") |
| `severity` | `note` |
| `author` | `file`. The pane filters these as "File comments". |
| `range` | the cell |
| `found` | the cell's display text from the upload, or `(blank)` |
| `expected` | `''` |
| `message` | the note, or the whole thread: the first comment, then each reply in order, one per line, each starting with its author's name (`R. Mehta: …`). Thread names come from the file's person list; note names come from its authors list. |
| `status` | `open` |

File notes are read-only in both elements: they show **Show in sheet** but no
Resolve or Delete. They never resolve themselves.

For each thread, Excel also writes a legacy note with the author `tc={id}`.
That note is not listed a second time.

## What is written

On export, every error that did **not** come from the file is written:
people's errors, workbook-rule errors and host-rule errors. Each one is
anchored at the top-left cell of its range.

- **The thread.** The first comment holds a header line (`ERR-0003 · Error · Wrong value · Found: 7.5%`) followed by the `message`. If the error has an `expected`, it follows as a reply (`Should be: 0.75%`). The thread is marked `done="1"` when the error is resolved.
- **One comment per cell.** If several errors share a cell, they form one thread: the first error opens it and the rest follow as replies. It is marked done only when all of them are resolved.
- **A cell that already holds someone's thread.** The errors are added to that thread as replies.
- **A cell that already holds a legacy note.** Nothing is written there, because a cell holds one comment and the note stays untouched. The error appears in `plugin.lastExport.skipped` with the reason `note-at-cell`.

Each sheet with errors gets four parts:

| part | what |
|---|---|
| `xl/threadedComments/threadedCommentN.xml` | the threads (Excel 365) |
| `xl/commentsN.xml` | a legacy comment per thread (author `tc={thread id}`). Its text is Excel's `[Threaded comment]` placeholder, followed by the comment and its replies, so Excel 2019 and older can show something. |
| `xl/drawings/vmlDrawingN.vml` | the hidden note shape Excel needs before it shows any comment, plus `<legacyDrawing>` in the sheet |
| `xl/persons/person.xml` | one person per author, for the whole workbook |

The plugin also adds the four relationships and content types. **A part the
file already has is extended, never replaced:** its notes, threads, shapes,
persons and anything else it holds are kept. If a part cannot be read, that
sheet's parts are left exactly as they were and its errors are reported as
`unreadable-part`.

No font is written. The legacy comment text is a plain `<t>`, and the VML
shape copies the one Excel writes, which names no font (SR-LAW-5).

### Ids: export twice, get one thread

Each thread entry's `id` is a version-5 UUID made from the error's `id` and
`createdAt`. Here is how that plays out:

1. You export a review.
2. You load the exported file and restore the same review with `setErrors(saved)`.
3. You export again.

The second export **replaces** the review's own threads instead of adding
copies. Replies that someone added in Excel stay attached to the thread.
After the review is restored, its own threads are no longer listed as file
notes. Without the restore, the threads come back as `file` notes, which is
how a reviewer sees an earlier review. `createdAt` is part of the name
because error ids restart at `ERR-0001` every session.

### Author names go into the file

Each error's `author` is written into the file as a person's `displayName`
and `userId`, with `providerId="None"`. An empty author is written as
**"Reviewer"**. The `author` attribute is the only source. If the names are
personal data the file should not carry, either set `author` to something
neutral or switch writing off.

## Switching writing off

- `comments({ write: false })`: never write. Notes and threads are still read.
- `export({ comments: false })` on `<sheetpane-excel>` (or `store.exportFile({ options: { comments: false } })`): skip the parts for that one export.

There is no menu item for this. The host decides, and a host that wants an
end-user toggle can put one in its own `format-row` slot.

## Not yet checked

Whether **Excel 365, Excel 2019 and LibreOffice** open an exported file and
show every error at its cell is checked by the decider, on fixtures saved
from Excel (W-30). The parts follow the shapes Excel writes, but these tests
check the parts sheetpane writes and reads, not Excel itself.

Spec: [`work/open/W-22-comments.md`](../../work/open/W-22-comments.md).

**Using an AI coding agent?** `npx sheetpane-skills install` puts sheetpane's skills for Claude Code, Kiro and Codex into your repository.
