---
type: Compare
title: How the grid draws big sheets, and what runs inside the element
description: "DOM with our own virtualiser inside a shadow root, plain DOM internals, tokens as CSS custom properties, in `@sheetpane/grid`. Verdict for W-01 (closes W-06; rules B-014)."
status: decided
decided: 2026-10-18
decided_by: "Arpit (Cowork, claude-fable-5-1) — ruling 'resolve all the blockers', 2026-10-18; verdict drafted by the session, open to override"
---

# How the grid draws big sheets, and what runs inside the element

> **Verdict:** decided · **DOM cells inside a shadow root, with our own row and
> column virtualiser**; **plain DOM internals — no Lit, no bundled framework**
> (B-014 ruled); **Proof colour and spacing tokens as CSS custom properties on
> the host element, no font** (L5) · confidence **high** on internals and
> tokens, **medium** on the virtualiser until measured · **reopen if** the
> 250,000-row CSV cannot hold 60 fps scroll on the reference machine after the
> virtualiser is tuned, or if a required accessibility behaviour cannot be
> met with DOM cells.

## Context

W-01 must show a 250,000-row CSV smoothly, follow the APG grid pattern, keep
merged cells correct when they start above the viewport, and ship as a web
component (L4) with no font of its own (L5) and FOSS-only dependencies (L2).

## Options

### A · DOM cells + own virtualiser — **chosen**

Render only the visible rows (±20 overscan) and, past 60 columns, only the
visible columns. Absolute-positioned rows in a sized scroll container; sticky
row and column headers. Merged ranges are drawn from the merge list, not from
the visible window, so a merge starting above the viewport still paints.
~400 lines. Text selection, find-highlighting and screen readers all work on
real DOM.

### B · DOM cells + TanStack Virtual — rejected

Excellent library, MIT, but one more runtime dependency for ~400 lines of
logic we would still need to wrap (merges, sticky headers). The reference
docs stay in `work/reference/specs/virtual/` as the model for option A.

### C · `<canvas>` grid + accessible overlay — rejected

Fastest at scale, but text selection, find, IME input and screen-reader
support all have to be rebuilt, and L5 (canvas text does not inherit the host
font) adds a measure-and-redraw loop. Right answer at millions of cells; wrong
answer for this scope.

### Internals (B-014)

| | plain DOM | Lit | bundled React/Preact |
|---|---|---|---|
| runtime deps | 0 | 1 (BSD-3) | 1–2 (MIT) |
| bundle | smallest | +16 KB | +45 KB / +4 KB |
| L4 contract | native | native | wrapped |
| templating comfort | lowest | high | high |

**Plain DOM.** The grid is a virtualiser that patches a few hundred nodes; a
template library buys little there, and the house default is zero
dependencies. The errors panel and the forms are small enough to write with
`<template>` clones.

## Decisions

1. **Rendering:** option A. ~~Row height is fixed per sheet (28 px at 100 %
   zoom; zoom scales the container with `transform` — no reflow of cells).~~
   **Superseded 2026-10-18** by Arpit's ask in W-47: rows have their own
   heights (the file's, then the user's) as a prefix sum, and zoom scales the
   geometry, not a transform — [SR-GRID](../../records/0105_GRID.md) decision 11.
   Decision 5's 16 ms budget stays the test (re-measured: 250,000 rows, 5 s
   scroll, worst 16.8 ms, none dropped).
2. **Shadow DOM, open.** Styles are isolated; inherited properties — `font`,
   `color`, `direction` — cross the boundary, which is exactly what L5 needs.
   Form controls inside get `font: inherit`.
3. **Tokens:** Proof's colours, spacing and radii become `--sp-*` custom
   properties declared on `:host` with defaults; a host overrides them on the
   element. **No `font-family` anywhere** (L5 veto command stays clean).
4. **Accessibility:** `role="grid"` with `aria-rowcount` / `aria-colcount`
   set to the sheet's true size and `aria-rowindex` / `aria-colindex` on
   rendered cells; roving `tabindex`; arrow, Home/End, PageUp/PageDown, Ctrl+Home;
   Enter / F2 to edit; `F` flags; Esc cancels. Every icon button labelled.
5. **Measurement:** "smooth" = no frame over 16 ms during a 5-second wheel
   scroll of the 250,000-row fixture, Chrome, on Arpit's MacBook; recorded in
   W-01 with the machine named (CLAUDE.md: say what you are running).
6. **Internals (B-014 ruled):** plain DOM and `<template>`; no framework or
   template library inside the element.

## Consequences

- W-01 DoD 4, 6, 11 and 12 are fully specified.
- Column virtualisation past 60 columns keeps very wide CSVs usable; below
  that, all columns render and horizontal scroll is native.
- Zoom by `transform` means find-highlight boxes are computed in sheet space.

## References

- [`work/reference/specs/a11y/apg-grid-pattern.html`](../reference/specs/a11y/apg-grid-pattern.html),
  [`apg-data-grids-example.html`](../reference/specs/a11y/apg-data-grids-example.html).
- [`work/reference/specs/virtual/tanstack-virtual-virtualizer-api.md`](../reference/specs/virtual/tanstack-virtual-virtualizer-api.md) — the model for the virtualiser.
- [`work/reference/specs/web/mdn-using-custom-elements.md`](../reference/specs/web/mdn-using-custom-elements.md).
- [`work/reference/design/boards/proof.css`](../reference/design/boards/proof.css) — the tokens, fonts excluded.
- Laws: [SR-LAW-4](../../records/0006_LAW-4-web-component.md), [SR-LAW-5](../../records/0007_LAW-5-host-font.md).

## Reopen-trigger

A frame over 16 ms during the 5-second scroll of the 250,000-row fixture on
the reference machine after tuning; or an APG grid behaviour that cannot be met
with DOM cells. **Check:** the W-01 DoD 11 measurement.
