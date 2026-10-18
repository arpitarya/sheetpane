---
type: Handoff
name: W-22
description: "Arpit asked on 2026-10-18 for comments and notes as a separate package; this item builds the plugin on the `validate` and `exportPatch` hooks."
item: W-22
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-fable-5-1)"
updated: 2026-10-18
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-22 — Build `@sheetpane/comments`: the file's notes and threaded comments in the error pane, and the review written back as threaded comments

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Read notes (`xl/comments*.xml`) and threaded comments (`xl/threadedComments/`) into the error pane as notes from author `file` | what the file's authors already said is part of the review | ✅ |
| 2 | On export, write every sheetpane error as a threaded comment Excel displays | the review travels inside the .xlsx — no sidecar | ✅ |
| 3 | Also write the legacy comment and VML parts Excel needs, so older Excel sees a note | every Excel shows it | ✅ |
| 4 | Arpit rules: an on/off "Write review as Excel comments" line in Export ▾, or always write | whether writing the review into the file is optional | ✅ |

**Arpit, 2026-10-18:** *"Let's create separate packages, plugins for number format, formulas, styles. Merge cells, freeze panes, data validation, conditional formatting, images, charts, pivots, comments, notes. Decide, do some research and have them as separate packages or plugins."*

**Model:** Opus — writing threaded comments Excel accepts (four parts, one of them VML) is detail-heavy and judged by opening the file in Excel.

## Goal

A plugin that connects Excel's comments to sheetpane's errors in both directions. On load, existing notes and threads become read-only `note` entries in `<sheetpane-errors>`; on export, the review's errors become threaded comments anchored to their cells. This is the feature no library in the comparison offers.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · package | `packages/comments/` builds to ESM, no runtime dependency; `@sheetpane/grid` a peer; no `./ui` | ✅ ESM + `.d.ts`, no runtime dependency, grid the only peer, no `./ui`; string XML only (no `DOMParser`), Node-safe — tests |
| 2 · read | notes: text per cell, author from the `authors` list; threaded: each `threadedComment` with replies in order, person from `persons`; both land as errors `{ type: 'comment', severity: 'note', author: 'file', found: <cell text>, message: <the comment>, status: 'open' }`, read-only in the pane (no Resolve / Delete), filterable by author | ✅ notes and threads (replies in order, persons by displayName) → `{ type: 'comment', severity: 'note', author: 'file', … status: 'open' }`; read-only in both elements, filterable as File comments — tests on the ExcelJS fixture and hand-written packages |
| 3 · write | `exportPatch` adds, per sheet with errors: `xl/threadedComments/threadedCommentN.xml` (one thread per error: message, then `expected` as a reply when present, `done="1"` when resolved), `xl/persons/person.xml` (one person per `author`), the legacy `xl/commentsN.xml` with the "[Threaded comment]" placeholder text, and `xl/drawings/vmlDrawingN.vml`; the four rels and content types; existing parts are extended, never replaced | ✅ threadedCommentN, commentsN (placeholder text), vmlDrawingN, persons; rels, content types, `<legacyDrawing>` in schema order; existing parts extended, never replaced; an error on a note cell is skipped and reported — tests |
| 3a · option | `comments({ write })` plugin option, default `true`; `export({ comments: false })` on `<sheetpane-excel>` skips the parts for that call; both documented in the README and added to SR-GRID's `export()` signature | ✅ `comments({ write: false })` and `export({ comments: false })` (SR-GRID decision 6, `ctx.exportOptions`) — parts byte-identical; both in the README |
| 4 · round-trip | an exported file opened in Excel 365, Excel 2019 and LibreOffice shows every error at its cell — checked by the decider on the fixture; loading the exported file back into sheetpane recreates the errors as `file` notes | ✅ sheetpane half: reloading the export recreates every error as a `file` note at its cell (test); **opening it in Excel 365, Excel 2019 and LibreOffice moved to W-30** (the decider's) |
| 5 · ids | a sheetpane error written once keeps its `id` in the thread's `id` GUID namespace, so a second export of the same review updates rather than duplicates | ✅ version-5 UUIDs of `sheetpane:<id>:<createdAt>`; export → reload → `setErrors` → export keeps ids and counts; Excel replies survive — tests; the restore exposed a core bug (a plugin taking over a restored error by id), fixed in SR-GRID decision 7 |
| 6 · tests | fixtures from Excel with notes, threads and both; the written parts validated against the schema; the duplicate-export test | ✅ with a deviation: hand-written packages and the ExcelJS fixture, every written part checked well-formed, the duplicate-export test — 26 tests; **Excel-saved fixtures → W-30; schema validation → backlog B-033** |
| 7 · record | a component record; Ownership rows for `packages/comments/` | ✅ [SR-COMMENTS](../../records/0112_COMMENTS.md) (0112); Ownership `packages/comments/` → SR-COMMENTS |
## Blockers

None. Excel and LibreOffice opening the output is W-30; schema validation is B-033.

## Record affected

**[SR-COMMENTS](../../records/0112_COMMENTS.md)**; SR-GRID decision 7 (restore adoption).

## Hazards

- **VML is required.** Excel does not show a comment without a `vmlDrawing` part; the minimal shape is fixed and ugly — copy it from a fixture Excel wrote, never improvise.
- **Threaded comments need the legacy part too**, carrying the placeholder text; omit it and Excel 2019 shows nothing.
- **Author names** are personal data written into the file; the `author` attribute is the only source, and an empty author writes "Reviewer".

## Reference

- Design: [`../reference/design/boards/Plugin-Comments.dc.html`](../reference/design/boards/Plugin-Comments.dc.html) — file notes and a thread in `<sheetpane-errors>`, the Export menu line (unruled), and the cell as Excel shows it
- [`../compare/plugins.compare.md`](../compare/plugins.compare.md) — `exportPatch`
- [`../compare/workbook-and-error-contract.compare.md`](../compare/workbook-and-error-contract.compare.md) — the error schema
- [W-14](W-14-plugin-host.md) · W-13 (closed — [SR-IMPORT](../../records/0104_IMPORT.md)) · [W-02](W-02-sheetpane-errors.md) · W-03 (closed — [SR-EXPORT](../../records/0103_EXPORT.md))

## Prompt — paste into Claude Code once the blockers close

```text
You are building W-22 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, docs/ARCHITECTURE.md,
   work/compare/plugins.compare.md and this file (work/open/W-22-comments.md).
2. Plan the modules and the fixture list in this file's body before writing code.
3. Implement. Obtain two fixtures first: a workbook with one note and one threaded comment saved by Excel 365. Diff the parts; your writer reproduces them.
4. Verify: just check; every DoD row above. Then do what SR-WORK-DOCS
   decision 10 says every task owes.
```
