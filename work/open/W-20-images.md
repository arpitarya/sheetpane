---
type: Handoff
name: W-20
description: "Arpit asked on 2026-10-18 for images as a separate package; this item builds the plugin on the `overlay` hook."
item: W-20
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-fable-5-1)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-20 — Build `@sheetpane/images`: pictures anchored in the sheet, drawn in sheet space, as a plugin

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Read each sheet's drawing part: `oneCellAnchor` and `twoCellAnchor` picture frames and the media they reference | where every picture sits and what it shows | ⏳ |
| 2 | Return overlay items the grid positions in sheet space | pictures scroll, zoom and freeze with the cells | ⏳ |
| 3 | View only; export keeps the parts untouched | nothing is lost, nothing is edited | ⏳ |

**Arpit, 2026-10-18:** *"Let's create separate packages, plugins for number format, formulas, styles. Merge cells, freeze panes, data validation, conditional formatting, images, charts, pivots, comments, notes. Decide, do some research and have them as separate packages or plugins."*

**Model:** Sonnet — anchors, media and an `<img>` per picture; the overlay layer is W-14's.

## Goal

A plugin that shows the pictures a workbook carries. It is the first `overlay` provider and establishes the anchor arithmetic `@sheetpane/charts` reuses.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · package | `packages/images/` builds to ESM, no runtime dependency; `@sheetpane/grid` a peer; no `./ui` | ⏳ |
| 2 · anchors | `oneCellAnchor` (from + ext) and `twoCellAnchor` (from, to) with EMU offsets converted through column widths and row heights, including hidden rows and columns; `absoluteAnchor` positioned from the sheet origin | ⏳ |
| 3 · media | PNG, JPEG, GIF, SVG, BMP as object URLs from the ZIP part, created on first scroll into view and revoked when the workbook is replaced; EMF and WMF show a placeholder frame with the file name | ⏳ |
| 4 · overlay | items `{ id, sheet, rect, element }`; the grid places them under pins and find-highlights, above cells; `alt` from the picture's `descr`; in Edit a click on a picture selects the cell under it, and pins draw above pictures (board Plugin-Images) | ⏳ |
| 5 · export | patch mode leaves drawing and media parts as they were (the fidelity ruling); a deleted row shifts anchors — documented as not re-anchored in v1 | ⏳ |
| 6 · tests | fixtures with each anchor type from Excel and LibreOffice; rect arithmetic against Excel's rendered positions; memory: object URLs revoked | ⏳ |
| 7 · record | a component record; Ownership rows for `packages/images/` | ⏳ |

## Blockers

Waiting on **W-14** (the `overlay` hook) and **W-13** (drawing anchors and media from the reader).

## Record affected

A new component record on completion. Until then this item owns `packages/images/`.

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
