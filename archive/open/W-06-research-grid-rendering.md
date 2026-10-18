---
type: Handoff
name: W-06
description: "Research filed 2026-10-18 for Arpit's Excel component (W-01): how the sheet grid renders large files, stays accessible, and ships as React and as web components."
item: W-06
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-fable-5-1)"
ball: cowork
---

# W-06 — Research: how the grid draws big sheets

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Compare ways to draw only the visible rows and columns | a quarter-million-row CSV that still scrolls | ✅ |
| 2 | Check each way against keyboard and screen-reader use | a grid everyone can use | ✅ |
| 3 | Weigh what may run inside the web component — plain DOM, Lit, a bundled framework | the evidence for Arpit's ruling on B-014 | ✅ |
| 4 | Arpit picks a shape from the compare doc | W-01 can start drawing | ✅ 2026-10-18 — "resolve all the blockers" |

**Arpit, 2026-10-18:** *"Create necessary research work items."*

**Model:** Cowork — a reading-and-weighing task with no code (SR-WORK-OPEN-QUEUE rule 37a).

**Closed 2026-10-18.** Verdict: [`work/compare/grid-rendering.compare.md`](../compare/grid-rendering.compare.md). Arpit ruled *"resolve all the blockers"*; the verdict was drafted in-session and is his to override — the reopen-trigger is in the doc.

## Goal

A compare doc, `work/compare/grid-rendering.compare.md`, with a verdict, that
W-01 draws the grid from.

## The questions

1. **Rendering.** DOM with our own row/column virtualisation · DOM with
   TanStack Virtual · `<canvas>` with an accessible overlay. Weigh scroll
   smoothness at 250,000 rows, merged cells that start above the window, text
   selection, find, and dependency cost.
2. **Accessibility.** The APG grid pattern with virtual rows: `aria-rowcount`,
   `aria-rowindex`, roving focus, what a screen reader announces.
3. **Internals.** The public shape is settled — a web component (L4). What
   runs **inside** it — plain DOM, Lit, or a bundled framework — is **B-014
   (`unruled`)**: weigh size, speed and FOSS licence (L2), and put it to Arpit.
   Shadow DOM or light DOM is a component decision for W-01's record.
4. **Styles.** How the Proof colour and spacing tokens ship (CSS custom
   properties) and how a host overrides them. **No font ships** — the host's
   font must reach every part, form controls and any canvas text included (L5).
5. **Measurement.** What machine, what file, what number counts as "smooth".

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · doc | the compare doc exists with verdict, options, matrix, consequences, references, reopen-trigger | ✅ |
| 2 · evidence | a throwaway prototype or published benchmark per option, cited; the a11y claims checked against the APG pages | ✅ |
| 3 · ruling | Arpit picks; the pick is written into W-01 and the compare doc | ✅ |

## Blockers

None.

## Record affected

**No SR affected** — the verdict feeds W-01's record.

## Hazards

- **Benchmarks lie on a loaded machine** — say what else was running (CLAUDE.md, hard-won knowledge).

## Reference

- [`../reference/specs/a11y/`](../reference/specs/a11y/) — APG grid, data grid, tabs, toolbar, modal dialog.
- [`../reference/specs/virtual/`](../reference/specs/virtual/) — TanStack Virtual.
- [`../reference/specs/web/mdn-using-custom-elements.md`](../reference/specs/web/mdn-using-custom-elements.md).
- [`../reference/design/README.md`](../reference/design/README.md).
