---
type: Reference
description: "The sheetpane design canvas, snapshotted as source — what each board shows and how to read it. Reference material for W-01–W-03, the plugin items W-14–W-24 and W-29; the item files hold the spec."
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
| [`boards/sp-plugins.css`](boards/sp-plugins.css) | the plugin boards' classes and their `--sp-*` token layer (light + a proposed dark ramp, W-29); names match `packages/grid/src/tokens.ts` where they overlap |
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

## The plugin boards (added 2026-10-18, later the same day)

Drawn from a design brief Arpit gave in Cowork, then **reconciled with
W-14–W-24**: where a board contradicted an item file, the board was changed.
Every plugin board mounts one shared grid, [`PluginKit`](boards/PluginKit.dc.html),
driven by props (`scene`, `plugins`, `mode`, `theme`, `frozen`, `scroll`,
`marks`) — read `renderVals()` there for the sample data, slot contents and
geometry. The purple **a, b, c…** markers and the legend beside each board name
a control's slot and plugin; they never ship.

| board | what it shows | item |
|---|---|---|
| [`Slot-Map`](boards/Slot-Map.dc.html) | the six slots, where they sit, which plugin fills which; three places outside the slots | W-14 |
| [`Baseline-NoPlugins`](boards/Baseline-NoPlugins.dc.html) | today's grid with the six slots outlined — the no-plugin guardrail | W-14 DoD 7 |
| [`Plugin-Numfmt`](boards/Plugin-Numfmt.dc.html) | format menu, ± decimals, raw value in the cell bar, “Changed · was General”; View | W-15 |
| [`Plugin-Formulas`](boards/Plugin-Formulas.dc.html) | `fx`, reference outlines while editing, ⟳, `#REF!`, Sum · Avg · Count; View; “may be stale” without the plugin | W-16, W-01 DoD 15 |
| [`Plugin-Styles`](boards/Plugin-Styles.dc.html) | the format row's groups, selbar Bold · Fill · Merge, file styles; **the format-row states** (hover, pressed, active, disabled, focus; light and dark) | W-17, W-23 |
| [`Plugin-Validation`](boards/Plugin-Validation.dc.html) | list arrows and the open list, ⚠ workbook pins, the author filter and workbook rows in `<sheetpane-errors>`; View | W-18, W-02 |
| [`Plugin-CondFmt`](boards/Plugin-CondFmt.dc.html) | colour scale, data bars, `cellIs` fill, hover legend; marks on a dark-filled cell | W-19 |
| [`Plugin-Images`](boards/Plugin-Images.dc.html) | a picture anchored C4:F9, an EMF frame, scrolled, a pin above the picture | W-20 |
| [`Plugin-Charts`](boards/Plugin-Charts.dc.html) | stage 1 frame + Show source cells + “data changed”; stage 2 drawn | W-21 |
| [`Plugin-Comments`](boards/Plugin-Comments.dc.html) | file notes and a thread in `<sheetpane-errors>`, the Export menu line, the cell in Excel | W-22 |
| [`Core-FreezePanes`](boards/Core-FreezePanes.dc.html) | Freeze ▾ (Edit), dividers, scrolled with headers held | W-24 |
| [`All-Plugins`](boards/All-Plugins.dc.html) | every slot filled at 1440, at 1024 (More ▾ overflow) and in dark | W-14 |
| [`Pane-Sync`](boards/Pane-Sync.dc.html) | an edit in one host tab raises a workbook warning in the other | W-18, W-02 (L7) |
| [`Selection-And-Download`](boards/Selection-And-Download.dc.html) | the change of 2026-10-18 evening: selection actions docked in the cell bar (no floating bar), right-click menu, one Download button — before and after | W-31 |
| [`Plugin-Decisions`](boards/Plugin-Decisions.dc.html) | the 19 calls the brief left open — which match the spec, which changed an item, which need a ruling | — |

**Prototype-only on these boards:** the sample references are adapted to the
holdings workbook (`=F12*G12`, the fee-rate rule 0.00%–2.00%, a chart over
E3:E15 and H3:H15); pin 9 on E7 exists only on the Images board; the Pane-Sync
host's tab badge is the host's, not the component's.

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
