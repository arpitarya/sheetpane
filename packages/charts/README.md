# @sheetpane/charts

**Charts for sheetpane — each chart in a workbook shown at its anchor: a frame with its title, type, series count and Show source cells (stage 1), drawn as our own SVG for bar, column, line, pie and scatter (stage 2) — through the `overlay` hook.**

A plugin: it registers against the one in-memory workbook of `@sheetpane/grid`
(`createWorkbook({ plugins: [...] })`, or `plugins="charts"` on the element), so
`<sheetpane-excel>` and `<sheetpane-errors>` both see its effect. Versioned in
lockstep with `@sheetpane/grid`.

```ts
import { createWorkbook } from '@sheetpane/grid';
import { charts } from '@sheetpane/charts';
import { ui } from '@sheetpane/charts/ui';

el.workbook = createWorkbook({ plugins: [charts(), ui()] });
// stage 1 only (frames, no plot):  charts({ draw: false })
// or: import '@sheetpane/charts/ui'  and  <sheetpane-excel plugins="charts">
```

- `@sheetpane/charts` — the headless plugin: the `overlay` provider.
- `@sheetpane/charts/ui` — the status line and a keyboard shortcut; opt-in.

No runtime dependencies, no chart library. Importing is safe in Node: nothing touches the DOM
until a chart renders.

## The frame (stage 1)

Every `graphicFrame` in a sheet's drawing that holds a chart (`c:chart r:id` → the chart part)
becomes one overlay item at its anchor, scrolling and zooming with its cells. The frame shows:

- the **title** — `c:title` rich text (runs joined, paragraphs joined by a space), a title
  reference's cached text, the only series' name when the title has no text, else `Chart`;
- the **type and series count** — `column · 2 series`, `stacked bar · 3 series`,
  `100% stacked column`, `line`, `pie`, `doughnut`, `scatter`, `area`, `radar`, `3-D column`,
  `column + line` (a combination) …;
- **Show source cells** — selects the plotted cells (see below), in View and in Edit;
- **data changed — Excel will redraw**, once a user change (`value` or `formula`) lands in a
  cell the chart reads — a series' values, categories or name. Undo takes it away again.

A chart that is not drawn lists `Not drawn here: area chart.` and, per series, the cells it
reads: `Sales — Data!A2:A5, Data!B2:B5`.

**Show source cells** selects the union of the series' `c:f` ranges when they tile one
rectangle (categories in A, values in B and C → `A2:C5`). The grid's selection is one
rectangle, so ranges that do not tile one (categories in E, values in H) select the first
series' values. A chart whose data is literal (`c:numLit`, no `c:f`) has nothing to select and
its button is disabled.

In Edit, a click on the chart away from its button selects the cell under the click, so that
cell can be flagged — as pictures do.

## The drawing (stage 2)

| type | drawn |
|---|---|
| `c:barChart`, `c:barDir="col"` | column — clustered, stacked or 100 % stacked |
| `c:barChart`, `c:barDir="bar"` | bar — the same groupings; the first category at the bottom, as in Excel |
| `c:lineChart` | line — standard, stacked or 100 % stacked; a missing point breaks the line |
| `c:pieChart`, `c:doughnutChart` | pie and doughnut — the first series, clockwise from `c:firstSliceAng` (12 o'clock) |
| `c:scatterChart` | scatter — x from `c:xVal` (text x values plot at 1, 2, 3 … as in Excel); lines when the style and the series' line say so |

Everything else — area, radar, stock, surface, bubble, 3-D, pie-of-pie, combination charts and
pivot charts — stays a stage-1 frame.

The SVG has a title band, a value axis with "nice" ticks (1, 2, 2.5 or 5 × 10ⁿ; zero included
unless the data sit in a narrow band far from it, as Excel does), category labels thinned so
they do not overlap, and a legend where the chart has one (`c:legend`: right, or bottom when
`legendPos` is top or bottom, or the chart is narrow). A negative bar is drawn in the error red
(the design board). Percent axes follow a `%` in the value axis' number format.

**Colours** come from the series' explicit fill (`c:spPr/a:solidFill` — `a:srgbClr`,
`a:schemeClr` through the workbook theme, `a:sysClr`, with `lumMod`, `lumOff`, `tint`,
`shade`), a line chart's line colour, per-point fills (`c:dPt`), else Excel's default style:
the theme's accents 1–6 by series index (`c:idx`) — or by point for `varyColors` pies — then
darker and lighter rounds. A workbook without a theme gets Office's accents.

**Values** are the series' cached points (`c:numCache`, `c:strCache`): what Excel drew when the
file was saved. With a `derive` plugin on the pane (`@sheetpane/formulas`), the chart reads the
live cells instead (`store.value`, `store.text` for labels) and redraws as they change; the SVG
carries `data-values="live"` or `"cache"`. Without one, an edit leaves the drawing as Excel
saved it, and the tag says so.

The SVG uses a `viewBox` the size of the anchor at 100 % and fills the item, so it scales with
zoom exactly as the cells do. Every mark carries what it stands for (`data-series`,
`data-point`, `data-value`; slices `data-start`/`data-end` in degrees), so tests compare the
drawing with the values rather than with pixels. No font is named anywhere (SR-LAW-5): the text
is the host's. Text from the file is escaped; colours from the file are validated `#RRGGBB`.

## Names

The item is `role="img"`; its `aria-label` is the chart's title once the part is read (the
drawing's description or name before that), and the SVG carries the same `role`, `aria-label`
and `<title>`.

## `@sheetpane/charts/ui`

- **Status line:** `Chart source: Data!A2:A5, Data!B2:B5, Data!C2:C5` while the selection lies in
  a chart's plotted cells or under its frame; otherwise `2 charts` on a sheet that has some.
- **Mod+Shift+U** shows the source of the chart over the active cell, or of the sheet's only
  chart — listed in the grid's keyboard help. The frame's own button sits inside the grid's
  `role="img"` overlay wrapper, where assistive technology does not reach it; the shortcut is the
  accessible route to the same action.

There is no `selbar` button: a selbar control has no "applies here" test, so it would show on
every selection, chart or not.

## Export

Nothing. Patch-mode export copies the chart parts byte for byte, so Excel redraws each chart
from the (possibly changed) cells when the file is opened.

## Limits

- **Placement uses the grid's geometry** (28 px rows, every row and column shown), as pictures
  do — not Excel's row heights. Past the last column the grid draws, columns count 64 px each.
- One rectangle per selection (above). Data labels, trendlines, error bars, axis titles,
  secondary axes, log scales and date axes are not drawn.
- Only charts on worksheets; chartsheets hold no cells and are not read.
- No chart is ever edited: no type switcher, no series editor, no resize.

## Dependencies

Anchors are placed with `@sheetpane/images`' `anchorRect` and `cellAt` (SR-IMAGES decision 3); `@sheetpane/images` is a peer.

Spec: [`work/open/W-21-charts.md`](../../work/open/W-21-charts.md).
How plugins plug in: [`work/compare/plugins.compare.md`](../../work/compare/plugins.compare.md).

**Using an AI coding agent?** `npx sheetpane-skills install` puts sheetpane's skills for Claude Code, Kiro and Codex into your repository.
