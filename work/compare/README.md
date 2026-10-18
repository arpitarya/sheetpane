---
type: Index
description: "Index of the live forks: verdict first, every one with a reopen-trigger."
---

# `work/compare/` — live forks, verdict first

One doc per **live fork**: a decision with real options, an experiment, or an
alternative implementation that exists alongside the current one. Every doc
carries a **verdict** and an explicit **reopen-trigger** — a condition, not a
date. Fork or idea? A fork has options now → here; an undecided idea →
[`../proposals/`](../proposals/README.md).

Convention: `> **Verdict:**` blockquote first (status · the call · confidence ·
reopen-trigger), then Context → Options → Matrix → Consequences → References →
Reopen-trigger. File name `<name>.compare.md`. When a fork is decided and
built, its trigger is ported into the owning record and the doc moves to
`archive/compare/` with a map row.

| doc | fork | verdict | reopen-trigger |
|-----|------|---------|----------------|
| [`xlsx-csv-reading.compare.md`](xlsx-csv-reading.compare.md) | own reader vs library; typed-cell display; where the reader lives | own reader on browser APIs; small number-format subset; `src/read/` in `sheetpane` | a real file a library opens that we misread beyond a bounded bug; >1/100 cells misformatted |
| [`grid-rendering.compare.md`](grid-rendering.compare.md) | DOM vs canvas vs library; what runs inside the element (B-014) | DOM + own virtualiser in a shadow root; plain DOM internals; `--sp-*` tokens, no font | a frame >16 ms on the 250k-row fixture after tuning; an APG behaviour DOM cannot meet |
| [`workbook-and-error-contract.compare.md`](workbook-and-error-contract.compare.md) | how elements share the workbook; error schema; events (B-021, B-022) | registry by `pane` + `workbook` property; selection syncs; no auto-resolve; `sheetpane-*` events | two elements on one `pane` out of step; a review not reloadable from events |
| [`testing.compare.md`](testing.compare.md) | runner; real browser vs simulated DOM; matrix; fixtures; goldens; property tests; a11y; performance; sync; coverage | Vitest, Node + browser mode on Playwright; Chromium per push, Firefox/WebKit nightly; no jsdom; `store`-mode goldens; fast-check; axe-core; no screenshots; perf reported not gating | a DOM API browser mode gets wrong; the Chromium lane over ten minutes |
| [`export-shape.compare.md`](export-shape.compare.md) | input shape; fidelity (B-019); compression; CSV defaults; runtimes (B-024) | `toXlsx` + `patchXlsx` + `toCsv`; inline strings, typed numbers; deflate default, `store` option; BOM + formula guard on | an Excel repair prompt on a fixture; a cell type the object cannot carry |
| [`grid-events-and-host-rules.compare.md`](grid-events-and-host-rules.compare.md) | editing and position events; column rules by header title; React hooks | seven `sheetpane-*` events, two cancellable; JSON rules + `validate` as a core provider on the `validate` hook (`author: "host"`, auto-resolve, flag by default); recipes, no React package | two real apps copy the recipes; the 250k-row rule load blocks >100 ms |
| [`plugins.compare.md`](plugins.compare.md) | core vs plugin for number formats, formulas, styles, merged cells, freeze panes, validation, conditional formatting, images, charts, pivots, comments; hooks, slots, engines | eight plugin packages on six hooks and six slots; merges and freeze panes core; pivots not built; `numfmt` + IronCalc, no copyleft | a plugin needing a seventh hook; a formatting control in the no-plugin grid; >1/100 cells misformatted or miscalculated on the fixtures |
