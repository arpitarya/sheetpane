---
type: Handoff
name: W-20
description: "Arpit asked on 2026-10-18 for images as a separate package; this item builds the plugin on the `overlay` hook."
item: W-20
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-fable-5-1)"
updated: 2026-10-18
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-20 — Build `@sheetpane/images`: pictures anchored in the sheet, drawn in sheet space, as a plugin

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Read each sheet's drawing part: `oneCellAnchor` and `twoCellAnchor` picture frames and the media they reference | where every picture sits and what it shows | ✅ |
| 2 | Return overlay items the grid positions in sheet space | pictures scroll, zoom and freeze with the cells | ✅ |
| 3 | View only; export keeps the parts untouched | nothing is lost, nothing is edited | ✅ |

**Arpit, 2026-10-18:** *"Let's create separate packages, plugins for number format, formulas, styles. Merge cells, freeze panes, data validation, conditional formatting, images, charts, pivots, comments, notes. Decide, do some research and have them as separate packages or plugins."*

**Model:** Sonnet — anchors, media and an `<img>` per picture; the overlay layer is W-14's.

## Goal

A plugin that shows the pictures a workbook carries. It is the first `overlay` provider and establishes the anchor arithmetic `@sheetpane/charts` reuses.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · package | `packages/images/` builds to ESM, no runtime dependency; `@sheetpane/grid` a peer; no `./ui` | ✅ ESM + `.d.ts`, no runtime dependency, `@sheetpane/grid` a peer, no `./ui`; imports in Node; `sideEffects` names the registering entry |
| 2 · anchors | `oneCellAnchor` (from + ext) and `twoCellAnchor` (from, to) with EMU offsets converted through column widths and row heights, including hidden rows and columns; `absoluteAnchor` positioned from the sheet origin | ✅ `oneCell`, `twoCell`, `absolute` in EMU → px through the grid's `Geometry` — rects match the rendered cells for each, at 150 % zoom too. Hidden rows and columns are **shown by the grid**, so anchors are placed where the grid draws them, not in Excel's row heights ([SR-IMAGES](../../records/0107_IMAGES.md) decision 3) |
| 3 · media | PNG, JPEG, GIF, SVG, BMP as object URLs from the ZIP part, created on first scroll into view and revoked when the workbook is replaced; EMF and WMF show a placeholder frame with the file name | ✅ PNG, JPEG, GIF, SVG (as `<img>`), BMP (and WebP) as object URLs read on first scroll into view, revoked when the workbook is replaced; EMF/WMF → a frame with the file name — tests |
| 4 · overlay | items `{ id, sheet, rect, element }`; the grid places them under pins and find-highlights, above cells; `alt` from the picture's `descr`; in Edit a click on a picture selects the cell under it, and pins draw above pictures (board Plugin-Images) | ✅ items `{ id, sheet, rect, render, alt }` under pins; `alt` from `descr`; a click in Edit selects the cell under it — tests |
| 5 · export | patch mode leaves drawing and media parts as they were (the fidelity ruling); a deleted row shifts anchors — documented as not re-anchored in v1 | ✅ patch mode copies drawing and media parts byte for byte (SR-EXPORT); no re-anchoring on row deletion, documented |
| 6 · tests | fixtures with each anchor type from Excel and LibreOffice; rect arithmetic against Excel's rendered positions; memory: object URLs revoked | ✅ each anchor type (hand-made packages + the ExcelJS picture), rects against the rendered cells, URLs revoked — 29 tests; **files saved by Excel and LibreOffice, and positions against Excel's own rendering, moved to W-30** |
| 7 · record | a component record; Ownership rows for `packages/images/` | ✅ [SR-IMAGES](../../records/0107_IMAGES.md) (0107); Ownership `packages/images/` → SR-IMAGES |
## Blockers

None. Real-app pictures are W-30.

## Record affected

**[SR-IMAGES](../../records/0107_IMAGES.md)** — written by this item.

## Hazards

- **EMU to pixels** depends on the default row height and column width of the sheet's `<sheetFormatPr>`; read them, never assume 15 pt × 8.43 ch.
- **Large media** — a 20 MB photo in a workbook; decode lazily and never on load.

## Reference

- Design: [`../reference/design/boards/Plugin-Images.dc.html`](../reference/design/boards/Plugin-Images.dc.html) — a picture anchored C4:F9, the EMF frame, scrolled, a pin above the picture
- [`../compare/plugins.compare.md`](../compare/plugins.compare.md) — `overlay`
- [W-14](W-14-plugin-host.md) · W-13 (closed — [SR-IMPORT](../../records/0104_IMPORT.md))

## Prompt — paste into Claude Code once the blockers close

```text
You are building W-20 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, docs/ARCHITECTURE.md,
   work/compare/plugins.compare.md and this file (work/open/W-20-images.md).
2. Plan the modules and the fixture list in this file's body before writing code.
3. Implement. Put the anchor → rect arithmetic in src/anchor.ts with its own tests; W-21 imports it.
4. Verify: just check; every DoD row above. Then do what SR-WORK-DOCS
   decision 10 says every task owes.
```
