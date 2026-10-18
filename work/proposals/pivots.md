---
type: Proposal
title: Live pivot tables in the grid
description: "Re-aggregate a pivot table inside sheetpane when its source cells change. Parked: v1 shows the cached cells and asks Excel to refresh on open."
status: proposed
timestamp: 2026-10-18T16:30:00+05:30
---

# Live pivot tables in the grid

## The idea

A pivot table's result is stored in the sheet as ordinary cells, so sheetpane
already shows it. What it cannot do is re-aggregate when a reviewer corrects a
source cell: the pivot stays as Excel last computed it. A `@sheetpane/pivots`
plugin would read `pivotTableDefinition` and `pivotCacheDefinition`, rebuild
the aggregation (sum, count, average, min, max over the row and column fields)
on every change through the `derive` hook, and write the new cells on export.

## Why it is parked, not built

- The review tool's job is to find wrong source cells; a stale pivot is a
  symptom, and Excel repairs it on open. W-03 DoD 11 sets
  `refreshOnLoad="1"` on affected caches and `fullCalcOnLoad="1"`, and the
  grid shows a read-only badge on the range (W-01).
- Pivot semantics are wide — calculated fields, grouping, filters, slicers,
  data models. A partial implementation would silently differ from Excel,
  which is worse than an honest badge.
- Nothing else waits on it.

## Graduation trigger

A host asks for a pivot to recompute inside the review **after W-16
(formulas) has landed** — the aggregation can then reuse IronCalc's model
instead of a second engine. Then the decider rules, and it becomes a `W-nn`
and a ninth plugin package.

Backlog row: B-028.
