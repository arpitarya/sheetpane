---
type: Handoff
name: W-16
description: "Arpit asked on 2026-10-18 for formulas as a separate package; this item builds the plugin on the `derive` hook, backed by IronCalc's WASM engine."
item: W-16
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-fable-5-1)"
updated: 2026-10-18
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-16 — Build `@sheetpane/formulas`: live recalculation through IronCalc, as a plugin

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Load `@ironcalc/wasm` on first use, never on import | hosts that do not need formulas pay nothing | ✅ |
| 2 | Feed the JavaScript workbook into an IronCalc model as a derived cache | edit B2 and every cell that depends on it updates, in both elements | ✅ |
| 3 | Show the formula in the cell bar; Sum · Avg · Count in the status line; a mark on recalculated cells | a reviewer sees what a cell computes, not only its value | ✅ |
| 4 | Measure IronCalc against Excel's cached values on the fixture set | the reopen-trigger: >1/100 formula cells disagree | ✅ |

**Arpit, 2026-10-18:** *"Let's create separate packages, plugins for number format, formulas, styles. Merge cells, freeze panes, data validation, conditional formatting, images, charts, pivots, comments, notes. Decide, do some research and have them as separate packages or plugins."*

**Model:** Opus — the derived-cache boundary (L9), lazy loading and the Excel-parity measurement need judgment.

## Goal

A plugin that makes formula cells live. Without it the grid shows a formula's saved value and marks dependents of a changed cell "may be stale" (W-01, W-03); with it, every change runs through IronCalc and the dependents recalculate. The model is **derived**: built from the JavaScript workbook, rebuilt on load, never the source of truth (L9, verdict decision 9).

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · package | `packages/formulas/` builds to ESM; `@ironcalc/wasm` pinned exactly; the `.wasm` is loaded with a dynamic `import()` on the first `derive` call; `@sheetpane/grid` a peer; `./ui` entry | ✅ ESM + `.d.ts`; `@ironcalc/wasm` pinned at 0.9.0 (MIT/Apache-2.0); grid a peer; `./ui` entry; the `.wasm` loads by dynamic `import()` on the first `derive` with a formula; Node import safe (checked with every `WebAssembly` member trapped) |
| 2 · model | on load: `newEmpty`, one sheet per sheet, `pauseEvaluation`, `setUserInput` per non-empty cell (formula cells get their `<f>` text), `resumeEvaluation`, `evaluate`; on a change: `setUserInput` then `evaluate`; results read with `getFormattedCellValue` and `getCellType` | ✅ with deviations: IronCalc 0.9 has no `newEmpty` — `new Model(...)`; one sheet per sheet, defined names, `pauseEvaluation` → `setUserInput` → `resumeEvaluation` + `evaluate`; only reachable cells are loaded (formulas and the ranges they name; `INDIRECT`/`OFFSET` load all); values read at 15 significant digits (SR-FORMULAS 3) |
| 3 · derive | `derive(change)` returns the cells whose value changed, each marked derived; they never enter the user's change map; a formula cell edited by the user is a change of kind `formula` | ✅ edit B3 → D3 and D6 recalculate, the change map stays one entry; derived cells never enter it; a typed `=` is kind `formula`, evaluates, and the cell bar holds the formula in Edit (core, SR-GRID 21b); a value back at its saved one clears its derived entry (`clear: true`) — tests |
| 4 · export | `exportPatch` writes `<f>` and the new cached `<v>` for every formula cell IronCalc evaluated, and keeps `fullCalcOnLoad="1"` so Excel re-verifies | ✅ typed formulas `<f>`+`<v>`, recalculated file formulas a new `<v>` (shared `<f>` kept), `fullCalcOnLoad="1"`, read back by `@sheetpane/import`; untouched → byte-identical |
| 5 · ui | `cellbar`: `fx =…`, read-only in View, editable in Edit, with referenced ranges highlighted while typing; `status`: Sum · Avg · Count of the selection; `cell`: the derived mark | ✅ cell bar: `fx =…` read-only (dashed) in View, the formula in the grid's own input in Edit, referenced ranges outlined while typing; status Sum · Avg · Count; marks ⟳ ↻ ≈ — tests |
| 6 · errors | `#REF!`, `#DIV/0!`, circular references show as Excel shows them, and a cycle is reported through `sheetpane-load` or `sheetpane-change` detail — never thrown | ✅ with a deviation: `#REF!`, `#DIV/0!`, `#N/A` as Excel shows them; a cycle shows 0, is listed, marked and named in the status line — never thrown; not in `sheetpane-load`/`-change` detail (backlog B-032) |
| 7 · parity | IronCalc's value equals Excel's cached `<v>` for ≥ 99 % of formula cells across the W-13 fixture set; the measurement and the function list that failed are written here | ✅ on the W-13 fixture set: 3/3 formula cells (100 %); a 116-case function probe 113/116 — misses `AGGREGATE`, `XLOOKUP` over array constants, `TEXTJOIN` with an empty literal; **Excel-saved fixtures moved to W-30** |
| 8 · perf | the 250,000-row fixture with 10,000 formulas loads within the W-01 budget plus the WASM load; measured on the reference machine | ✅ with a deviation: Arpit's MacBook (headless Chromium 156, 10 cores, loaded by sibling agents): 250,000 rows + 10,000 formulas — the plugin adds ≈ 0.4 s to a 6.1 s read, one edit 40–48 ms, the `.wasm` 34 ms; W-01's budget is CSV-only, so there is no `.xlsx` budget to compare against |
| 9 · tests | hook tests with a tiny workbook; the parity run; a lazy-load test proving no `.wasm` request before the first formula edit | ✅ 34 tests: hook tests on tiny workbooks, the parity run, the lazy-load test (no `.wasm` request before the first formula) |
| 10 · record | a component record; Ownership rows for `packages/formulas/` | ✅ [SR-FORMULAS](../../records/0111_FORMULAS.md) (0111); Ownership `packages/formulas/` → SR-FORMULAS |
## Blockers

None. Excel-saved parity fixtures are W-30.

## Record affected

**[SR-FORMULAS](../../records/0111_FORMULAS.md)**; the core gaps it found landed in SR-GRID (decisions 19, 21b).

## Hazards

- **L9.** The WASM heap is not the workbook. If the model and the JavaScript objects ever disagree, the JavaScript objects win and the model is rebuilt.
- **Function coverage.** IronCalc is early (0.9); a function it lacks shows `#NAME?`. The parity DoD names every such function so the decider can rule.
- **Size.** 2 MB of WASM — hence lazy loading; a host must be able to pre-warm it (`formulas({ preload: true })`).
- **SSR (L8 ruling):** importing the package in Node must not touch `WebAssembly`.

## Reference

- Design: [`../reference/design/boards/Plugin-Formulas.dc.html`](../reference/design/boards/Plugin-Formulas.dc.html) — `fx`, reference outlines while editing, ⟳, `#REF!`, Sum · Avg · Count, View read-only
- [`../compare/plugins.compare.md`](../compare/plugins.compare.md) — `derive` hook, decision 9
- [IronCalc](https://github.com/ironcalc/IronCalc) — `@ironcalc/wasm` API: `setUserInput`, `evaluate`, `getFormattedCellValue`
- [`../reference/specs/spreadsheetml/working-with-formulas.md`](../reference/specs/spreadsheetml/working-with-formulas.md)
- [W-14](W-14-plugin-host.md) · W-13 (closed — [SR-IMPORT](../../records/0104_IMPORT.md)) · W-03 (closed — [SR-EXPORT](../../records/0103_EXPORT.md))

## Prompt — paste into Claude Code once the blockers close

```text
You are building W-16 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, docs/ARCHITECTURE.md,
   work/compare/plugins.compare.md and this file (work/open/W-16-formulas.md).
2. Plan the modules and the fixture list in this file's body before writing code.
3. Implement. Keep the IronCalc model behind one module (src/model.ts) with a rebuild() that the store can call; nothing else in the package touches WASM.
4. Verify: just check; every DoD row above. Then do what SR-WORK-DOCS
   decision 10 says every task owes.
```
