---
type: Handoff
name: W-11
description: "Research filed 2026-10-18 at Arpit's request: how sheetpane is tested. Covers the runner, real browsers, fixture files, round-trips, accessibility, and which checks owed by the laws become tests. Feeds W-04 DoD 3."
item: W-11
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-fable-5-1)"
ball: cowork
---

# W-11 — Research: how sheetpane is tested

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Choose the test runner, and whether both packages share it | one command that runs every test | ✅ |
| 2 | Decide where browser-dependent tests run: a real browser or a simulated DOM | tests that fail when the real thing would fail | ✅ |
| 3 | Decide which test files we keep, where they come from, and how big ones are made | spreadsheets from Excel, LibreOffice and Google Sheets in every run | ✅ |
| 4 | Decide how round-trips, accessibility and the 250,000-row case are tested | proof for L6, L7 and the grid's speed | ✅ |
| 5 | Map the backlog's owed checks to tests | each law's check gets a home | ✅ |
| 6 | Arpit picks from the compare doc | W-04 DoD 3 can start | ✅ 2026-10-18 — "resolve all the blockers" |

**Arpit, 2026-10-18:** *"Create another work item for testing. The testing
work item, put it as research."*

**Model:** Cowork — a reading-and-weighing task with no code (SR-WORK-OPEN-QUEUE rule 37a).

**Closed 2026-10-18.** Verdict: [`work/compare/testing.compare.md`](../compare/testing.compare.md). Arpit ruled *"resolve all the blockers"*; the verdict was drafted in-session and is his to override — the reopen-trigger is in the doc.

## Goal

A compare doc, `work/compare/testing.compare.md`, with a verdict. W-04 DoD 3
builds the test setup from it, and the backlog's test rows take their shape
from it.

## The questions

1. **Runner.** Vitest vs Node's built-in `node:test` vs Web Test Runner vs
   Playwright Test. One runner for both packages, or one per package. Each
   one's licence (L2) and dependency weight.
2. **Where DOM tests run.** A real browser (Vitest browser mode, or Web Test
   Runner with Playwright) vs jsdom / happy-dom. List the APIs that behave
   differently: `CompressionStream('deflate-raw')`, `DOMParser`, custom
   elements, shadow DOM, `ElementInternals`, focus and keyboard events.
3. **Browser matrix.** Chromium, Firefox and WebKit: which run on every push,
   which nightly, and what each costs in CI time.
4. **Fixtures.** A corpus of `.xlsx` / `.csv` files from Excel, LibreOffice,
   Google Sheets and Numbers. Commit them or generate them; each file's licence
   and origin. The 250,000-row file (W-06) is generated at test time, never
   committed.
5. **Round-trip and determinism.** Export a file, read it back, compare
   (B-017). Byte-identical golden files if W-08 picks ZIP store. How a golden
   file is updated on purpose and never by accident.
6. **Property-based tests** (e.g. fast-check) for the reader and the writer,
   with fixed seeds so every failure can be replayed.
7. **Accessibility.** What automated checks catch (e.g. axe-core) and what
   needs a manual pass: the keyboard model and screen readers (W-06).
8. **Visual regression.** Yes or no. Screenshot tests flake across machines.
   Weigh that against the preference for deterministic, verifiable checks.
9. **Performance.** How to measure the 250,000-row render budget reproducibly,
   given the lesson that a loaded machine produces clean-looking anomalies.
10. **Sync across components (L7).** How a change in one element is proven to
    reach the other two (B-020) — unit level, DOM level, or the W-09 demo apps
    as the end-to-end bed.
11. **Owed checks as tests.** B-001–B-005 (process), B-009 (L3), B-012 (L4),
    B-015 (L5), B-017 (L6), B-020 (L7), B-023 (L8): which belong in the test
    suite and which stay scripts or hooks. Promoting a row is Arpit's call.
12. **Coverage.** The tool, and whether a threshold gates CI.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · doc | the compare doc exists with verdict, options, matrix, consequences, references, reopen-trigger | ✅ |
| 2 · evidence | every claim about a runner or a DOM gap cites the tool's docs or an issue; licences listed | ✅ |
| 3 · ruling | Arpit picks; the pick is written into W-04 DoD 3 and the compare doc | ✅ |

## Blockers

None. The runner's commands land as `just` recipes once W-10 lands.

## Record affected

**No SR affected.** The verdict feeds W-04's build record.

## Hazards

- **A simulated DOM can pass where a browser fails.** That gap is exactly
  where the ZIP and XML code lives, so say which tests must never run there.
- **Dev dependencies count too (L2).** Every runner, browser driver and plugin
  must be FOSS.
- **Committed fixtures are redistributed files.** Each one needs a licence or
  must be generated.

## Reference

- [W-04](W-04-monorepo-toolchain.md) DoD 3 · [W-06](W-06-research-grid-rendering.md) (grid, accessibility) · [W-08](W-08-research-export-shape.md) (determinism)
- [`../BACKLOG.md`](../BACKLOG.md) — `ungated` rows B-001–B-005, B-009, B-012, B-015, B-017, B-020, B-023
- [`../reference/README.md`](../reference/README.md)
