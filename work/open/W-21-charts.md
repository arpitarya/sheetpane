---
type: Handoff
name: W-21
description: "Arpit asked on 2026-10-18 for charts as a separate package; this item builds the plugin on the `overlay` hook in two stages."
item: W-21
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-fable-5-1)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-fable-5-1)"
ball: agent
---

# W-21 — Build `@sheetpane/charts`: a chart's frame, title and source cells; later, own SVG, as a plugin

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Stage 1: a frame at each chart's anchor with its title, type and a **Show source cells** action | a reviewer knows a chart is there and can check the numbers behind it | ⏳ |
| 2 | Stage 2: render bar, column, line, pie and scatter to SVG ourselves | the common charts look like charts, with no chart library | ⏳ |
| 3 | Export keeps the chart part untouched | Excel redraws it from the (possibly changed) cells | ⏳ |

**Arpit, 2026-10-18:** *"Let's create separate packages, plugins for number format, formulas, styles. Merge cells, freeze panes, data validation, conditional formatting, images, charts, pivots, comments, notes. Decide, do some research and have them as separate packages or plugins."*

**Model:** Opus — stage 2 is a chart renderer written from the DrawingML chart schema; stage 1 is Sonnet-sized.

## Goal

A plugin that makes charts visible in a review. Stage 1 is honest and small: the chart's place, its title and its data range. Stage 2 draws the five common types from `c:chartSpace` — our own SVG, zero dependencies, so the L2 tree stays clean.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · package | `packages/charts/` builds to ESM, no runtime dependency; `@sheetpane/grid` and `@sheetpane/images` peers; `./ui` entry (the action) | ⏳ |
| 2 · stage 1 | a frame per `graphicFrame` chart at its anchor: title (`c:title`, or "Chart"), type (`c:barChart` …), series count; **Show source cells** selects the union of the series' `c:f` ranges through `select()`; a changed cell inside a plotted range shows the frame's "data changed — Excel will redraw" tag | ⏳ |
| 3 · stage 2 | bar, column (clustered and stacked), line, pie, scatter rendered as SVG from the series' cached values (`c:numCache`) or, when `formulas` is present, from the live cells; axes, legend, title; colours from the workbook theme or the chart's explicit fills; every other type stays at stage 1 | ⏳ |
| 4 · overlay | same item shape as images; the SVG scales with zoom; `role="img"` with an `aria-label` from the title | ⏳ |
| 5 · tests | fixtures with each type from Excel; stage 1 frames and ranges checked; stage 2 compared to the series' values, not to pixels | ⏳ |
| 6 · record | a component record; Ownership rows for `packages/charts/` | ⏳ |

## Blockers

Waiting on **W-20** (anchors and the overlay layer in use).

## Record affected

A new component record on completion. Until then this item owns `packages/charts/`.

## Hazards

- **Stage 2 is big.** It ships after stage 1 lands and is measured on its own; stage 1 alone closes nothing but is useful.
- **Live data** without `formulas` means a chart over formula cells shows cached values — labelled as such.
- **Pivot charts** stay at stage 1.

## Reference

- [`../compare/plugins.compare.md`](../compare/plugins.compare.md) — `overlay`
- [W-20](W-20-images.md) · [W-16](W-16-formulas.md)

## Prompt — paste into Claude Code once the blockers close

```text
You are building W-21 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, docs/ARCHITECTURE.md,
   work/compare/plugins.compare.md and this file (work/open/W-21-charts.md).
2. Plan the modules and the fixture list in this file's body before writing code.
3. Implement. Deliver stage 1 as its own PR with its tests; open stage 2 only when the decider has seen stage 1 in the demo.
4. Verify: just check; every DoD row above. Then do what SR-WORK-DOCS
   decision 10 says every task owes.
```
