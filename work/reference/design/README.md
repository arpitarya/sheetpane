---
type: Reference
description: "The sheetpane design canvas, snapshotted as source — what each board shows and how to read it. Reference material for W-01, W-02 and W-03; the item files hold the spec."
source: "https://claude.ai/code/artifact/ecabc2f4-ffde-4e9f-af38-cc0558b5cac7 (private Design canvas, Arpit)"
snapshot: 2026-10-18
---

# The sheetpane design — snapshot of 2026-10-18

**What this is.** The Design canvas Arpit and Claude built on 2026-10-18,
saved as source. **It is reference, not the spec**: what a component must do
lives in its item file in [`../../open/`](../../open/README.md). Where this
folder and an item file disagree, the item file wins.

**The live canvas** (clickable, newer than this snapshot if it was edited):
the source link in this file's frontmatter. It is private to Arpit.

> **Superseded by the laws, filed later the same day:** the React API on the
> `Main` board (`useSheetPane`, props, `<SheetPaneExcel>`) gives way to web
> components with a DOM-only contract ([SR-LAW-4](../../../records/0006_LAW-4-web-component.md)),
> and the IBM Plex font in `proof.css` gives way to the host's font
> ([SR-LAW-5](../../../records/0007_LAW-5-host-font.md)). Take layout,
> behaviour, copy and colour from the boards — not the API or the font.

## How to read a board

| part of a `.dc.html` file | what it tells you |
|---|---|
| the markup inside `<x-dc>` | the layout, the copy and the CSS classes |
| `renderVals()` in the `<script type="text/x-dc">` block | the **sample data** and the **behaviour** — what a click changes |
| `this.state` / `this.props.shared` | the prototype's state; `shared` is what the two components share |
| [`boards/proof.css`](boards/proof.css) | **Proof**, the design tokens shared with PDF Suite (colour, type, spacing, sheet grid) |
| [`boards/sheetpane.css`](boards/sheetpane.css) | sheetpane's own classes on top of Proof (pins, callouts, form, errors list) |
| [`boards/canvas.json`](boards/canvas.json) | the canvas index — board titles and sizes |

The boards need the canvas runtime (`support.js`) to render, so they do not
open in a browser as they are. **Read them as source.**

## The boards

| board | what it shows | read it for |
|---|---|---|
| [`Main`](boards/Main.dc.html) | the overview — one package, two components, the link, the props, the error JSON | the public API shape |
| [`Sheetpane`](boards/Sheetpane.dc.html) | **`<SheetPaneExcel>`** — the sheet, View and Edit | grid, merged title row, sheet tabs, cell bar, in-memory edits, Export, pins, callout, selection bar |
| [`Errors`](boards/Errors.dc.html) | **`<SheetPaneErrors>`** — the error list and the New error form | list, filters, expand, resolve/delete, the form, "Show in sheet" |
| [`Host-Tab-View`](boards/Host-Tab-View.dc.html) | the sheet alone, in a host app's tab | `display="tab"`, View |
| [`Host-Tab-Edit`](boards/Host-Tab-Edit.dc.html) | sheet in the tab, errors in the host's side column | two components placed apart, one shared state |
| [`Host-Linked-Tabs`](boards/Host-Linked-Tabs.dc.html) | errors in one host tab, the sheet in another | `onReveal` switching the host's tab |
| [`Host-Popup-View`](boards/Host-Popup-View.dc.html) | a `.csv` in a pop-up | `display="popup"`, CSV (one sheet, no merges) |
| [`Host-Popup-Edit`](boards/Host-Popup-Edit.dc.html) | both components side by side in a pop-up | composition inside a modal |
| [`View-Upload`](boards/View-Upload.dc.html) | the empty state and the loading/failure states | drop zone, link, base64, reading, large file, password, unsupported |
| [`Edit-Examples`](boards/Edit-Examples.dc.html) | the seven error types plus *Other* and *change the cell* | the default `errorTypes` catalog and its examples |

## Decisions the canvas records (Arpit, 2026-10-18)

- **One npm package, two components** — `SheetPaneExcel` and `SheetPaneErrors`,
  placed independently by the host, **always linked** through one pane.
- **Modes are View and Edit.** Placement is a tab or a pop-up.
- **`.xlsx` and `.csv` only.** Cells are plain text; formulas show their saved
  value; **merge-and-centre** is the only formatting kept.
- **Edits stay in memory**; Export writes the latest values.
- **No "linked" chip and no export footer** in the Errors component.
- **Export is a separate package** the UI depends on (filed 2026-10-18).

## What is prototype-only

- **The host owns the shared state** in the boards (`shared` / `on-shared`
  props). In the package, `useSheetPane()` owns it and the host only passes
  the `pane`.
- **The sample workbook is hard-coded** in `renderVals()` — "Client holdings —
  Q3 2026", 13 rows, a merged title row, a second sheet. It is fictional and
  makes good test-fixture data.
- **Export only sets a status line.** There is no file writer in the boards.
