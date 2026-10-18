---
type: Compare
title: How sheetpane is tested
description: "Runner, where DOM tests run, browser matrix, fixtures, round-trips, property tests, accessibility, performance, sync, coverage. Verdict for W-04, W-01, W-02, W-03, W-12 (closes W-11)."
status: decided
decided: 2026-10-18
decided_by: "Arpit (Cowork, claude-fable-5-1) — ruling 'resolve all the blockers', 2026-10-18; verdict drafted by the session, open to override"
---

# How sheetpane is tested

> **Verdict:** decided · **one runner, Vitest** (MIT): Node environment for
> `@sheetpane/export`, **browser mode on Playwright** for `@sheetpane/grid` —
> real Chromium on every push, Firefox and WebKit nightly; **no jsdom**;
> **committed small fixtures plus generated big ones**; round-trip tests with
> **golden files in ZIP `store` mode**; **fast-check** property tests on the
> reader and writers; **axe-core** on every rendered state plus a manual
> keyboard pass; **no visual-regression screenshots**; **performance measured,
> reported, not gating**; the L7 sync proved at DOM level with both elements
> in one page; **coverage reported, gating only `export` at 90 % lines** ·
> confidence **high** · **reopen if** a DOM API the grid needs is missing or
> wrong in Vitest browser mode, or CI time for the Chromium lane passes ten
> minutes.

## Context

W-04 needs a runner before any test exists; W-01, W-02, W-03 and W-12 each
name "a real browser engine where an API needs one". L2 wants FOSS
dependencies; the house wants deterministic, replayable checks. The code uses
`CompressionStream('deflate-raw')`, `DOMParser`, custom elements, shadow DOM
and focus — exactly the APIs simulated DOMs get wrong.

## Options

| | Vitest (node + browser mode) | `node:test` + Playwright Test | Web Test Runner | jsdom / happy-dom anywhere |
|---|---|---|---|---|
| licence | MIT | MIT / Apache-2.0 | MIT | MIT |
| one runner for both packages | yes | two | one (browser only) | one |
| real `CompressionStream`, shadow DOM, focus | yes (browser mode) | yes | yes | **no** |
| watch mode, filtering, coverage | built in | partial | partial | built in |
| CI weight | moderate | moderate | light | light |

**Chosen: Vitest**, two projects in one config — `export` runs in Node,
`grid` runs in a real browser through `@vitest/browser` + Playwright. jsdom and
happy-dom are **rejected** for every test that touches the DOM: they would pass
tests the browsers fail.

## Decisions

1. **Runner.** Vitest, one root config with two projects. `pnpm test` / `just
   test` run both; `just test-export`, `just test-grid` run one.
2. **Browser matrix.** Chromium on every push and PR. Firefox and WebKit on a
   nightly workflow and before a release. Playwright's browsers are the only
   binaries fetched in CI.
3. **Fixtures.** Committed under `packages/*/test/fixtures/`: the design's
   sample workbook written by `toXlsx`; small files saved by Excel, LibreOffice
   and Google Sheets that Arpit provides (origin and licence in a
   `FIXTURES.md` beside them — his own files, no third-party workbooks); a
   `.csv` per dialect. Generated at test time, never committed: the
   250,000-row CSV, the 16,384-column sheet, the over-limit refusals.
4. **Round-trip and golden files.** For every fixture: read → export (`store`
   mode) → read again → deep-equal cells, merges, sheet names, hidden flags
   (B-017's test). Golden `.xlsx` files are byte-compared in `store` mode;
   `deflate` output is round-tripped, never byte-compared. A golden file is
   updated only by `just update-goldens`, which prints the diff of cell values
   first.
5. **Property tests.** `fast-check` (MIT) with fixed seeds, printed on failure:
   CSV writer ∘ reader is identity for any cell grid; `toXlsx` ∘ reader is
   identity; `patchXlsx` changes exactly the named cells and nothing else.
6. **Accessibility.** `axe-core` (MPL-2.0 — a dev dependency, allowed by the
   L2 copyleft ruling) runs against every rendered state the element tests
   produce; the APG keyboard model is a scripted keyboard test in the browser;
   a screen-reader pass is a manual checklist in W-01's file, done once per
   release.
7. **Visual regression: no.** Screenshot diffs flake across machines and GPUs
   and would fight the "deterministic, verifiable" preference. Layout is
   asserted with DOM measurements where it matters (merged cell spans, sticky
   headers, the callout staying inside the grid).
8. **Performance.** A Vitest browser test scrolls the generated 250,000-row CSV
   for five seconds and records frame times through `requestAnimationFrame`;
   it **reports** the worst frame and the machine (`navigator.hardwareConcurrency`,
   user agent) and **never fails CI** — CI machines are loaded and lie. The
   gate is W-01 DoD 11 on Arpit's MacBook, written into the item file.
9. **Sync (L7, B-020).** A browser test mounts `<sheetpane-excel>` and
   `<sheetpane-errors>` on one `pane` in **two separate containers** — one of
   them inside a `<dialog>` — mounts them in both orders, and asserts every
   change, error, resolve and selection made in one is visible in the other
   within one animation frame. The W-09 demo apps get one Playwright
   end-to-end run each as the last line of defence.
10. **Owed checks that become tests** (each stays a backlog row until its
    `W-nn` picks it up — promotion is the decider's call, taken here as part of
    "resolve all the blockers"): B-009 (unsupported formats refused) and
    B-017 (round-trip) land with W-03/W-01; B-012 (custom element registered,
    no framework peer) and B-015 (no font in the package) land with W-04 as
    package-level tests; B-020 (sync) lands with W-02; B-023 (publishable
    packages) lands with W-04's release recipe. B-001–B-005 stay scripts in
    `scripts/`, run by `just check`.
11. **Coverage.** Vitest's v8 coverage, reported on every run. **Gate:** 90 %
    lines on `@sheetpane/export` (small, deterministic, no excuse). No gate on
    `@sheetpane/grid` until W-01 and W-02 land; then Arpit sets one.
12. **Determinism of the suite itself.** No network, no clock (`vi.useFakeTimers`
    where time matters), fixed seeds, no retries on CI. A flaky test is a bug
    with a `W-nn`.

## Consequences

- W-04 DoD 3 is fully specified; W-12 DoD 9 and W-01 DoD 13 name their runner.
- Dev dependencies added: `vitest`, `@vitest/browser`, `playwright`,
  `fast-check`, `axe-core`, `@vitest/coverage-v8` — all FOSS (L2); none at runtime.
- Firefox and WebKit failures surface nightly, not on every push — a deliberate
  trade of latency for CI minutes.

## References

- [`work/reference/specs/a11y/apg-grid-pattern.html`](../reference/specs/a11y/apg-grid-pattern.html) — the keyboard model the scripted test follows.
- [`grid-rendering.compare.md`](grid-rendering.compare.md) decision 5 — the performance budget.
- [`export-shape.compare.md`](export-shape.compare.md) decision 7 — `store` mode for golden files.
- [`workbook-and-error-contract.compare.md`](workbook-and-error-contract.compare.md) — what the sync test asserts.
- Laws: [SR-LAW-2](../../records/0004_LAW-2-foss-dependencies.md), [SR-LAW-7](../../records/0009_LAW-7-surfaces-always-in-sync.md).

## Reopen-trigger

A DOM API the grid needs that Vitest browser mode cannot provide or gets
wrong; or the Chromium lane taking over ten minutes on CI.
**Check:** the CI run time on `main`; a failing grid test that passes in a real
tab.
