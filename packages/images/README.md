# @sheetpane/images

**Images for sheetpane — pictures anchored in the sheet drawn in sheet space through the `overlay` hook; view only, kept on export.**

A plugin: it registers against the one in-memory workbook of `@sheetpane/grid`
(`createWorkbook({ plugins: [...] })`, or `plugins="images"` on the element), so
`<sheetpane-excel>` and `<sheetpane-errors>` both see its effect. Versioned in
lockstep with `@sheetpane/grid`.

```ts
import { createWorkbook } from '@sheetpane/grid';
import { images } from '@sheetpane/images';

el.workbook = createWorkbook({ plugins: [images()] });
// or: import '@sheetpane/images'  and  <sheetpane-excel plugins="images">
```

No runtime dependencies. Importing is safe in Node (no DOM until a picture renders).

## What it draws

Every `picture` in a sheet's drawing part, at its anchor, in the overlay layer: it scrolls,
zooms and clips with its cells, under the pins and above the cells. `alt` is the picture's
description (`descr`), else its name.

| format | shown as |
|---|---|
| PNG, JPEG, GIF, BMP, WebP | an `<img>` over an object URL |
| SVG | an `<img>` too — never inline markup, so no script in the file can run |
| EMF, WMF, TIFF, anything else | a dashed frame the size of the anchor: `logo.emf — preview unavailable` |

The format is told from the bytes' header first and the file name second.

Charts and shapes are not pictures and are skipped (the charts plugin draws charts). The status
bar adds `2 pictures · 1 preview unavailable` for the sheet in view.

**View only.** In Edit a click on a picture selects the cell under the click, so that cell can
still be flagged; pictures cannot be moved, resized, added or deleted.

## Anchors (`src/anchors.ts`, exported)

EMU become pixels at 9,525 EMU per pixel (914,400 per inch, 96 px per inch), then are placed in
the grid's own geometry (`Geometry` — pixels at 100 % zoom from A1's top-left):

| anchor | rectangle |
|---|---|
| `twoCell` | `from` to `to`, each corner plus its offset |
| `oneCell` | `from` plus its offset, sized by `ext` |
| `absolute` | `pos` from the sheet origin, sized by `ext` |

An offset never reaches past its own cell, as in Excel. `anchorRect(anchor, geometry)`,
`pointToPx`, `cellAt`, `emuToPx` and `refOf` are plain functions with no DOM, so
`@sheetpane/charts` reuses them as they are.

**Excel's own row heights and hidden rows or columns are not used.** The grid draws every row at
its fixed height and shows what is stored, hidden or not; a picture anchored C4:F9 covers C4:F9
on screen, whatever size those cells are in Excel. A `oneCell` or `absolute` picture keeps its
`ext` in pixels, so beside tall Excel rows it can look smaller than it did there.

## Memory

Nothing is read from the file's media until a picture comes near the screen (a 20 MB photo costs
nothing until scrolled to). One object URL is made per media part however many pictures show it,
and all are revoked when the pane loads another workbook (or a load fails). A decode that
finishes after the workbook went makes no URL.

## Export

Patch-mode export leaves the drawing and media parts as they were (the fidelity ruling), so a
workbook's pictures survive a round trip. **A deleted row does not re-anchor pictures in v1**:
the file keeps the anchors it had.

## Tests

`pnpm exec vitest run --project images` — anchor arithmetic against geometry, rectangles against
the rendered cells (oneCell, twoCell, absolute, zoom), every format, laziness, object-URL
revocation. Fixtures are hand-written packages and the ExcelJS 2×2 PNG; files saved by Excel and
LibreOffice are owed by W-30.
