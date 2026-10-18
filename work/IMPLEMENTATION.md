---
type: Log
description: "What shipped, when, and how it turned out — the evidence store the queue reconciles against."
---

# IMPLEMENTATION — what has landed

A row is earned by **landing**, never by being planned. The queue reconciles
against this file before an item may be closed
([SR-WORK-OPEN-QUEUE](../records/0051_WORK-open-queue.md) rule 9). Newest first.

| date | item | what landed | outcome | evidence |
|---|---|---|---|---|
| 2026-10-18 | W-10 | pnpm workspace (`pnpm-workspace.yaml`, `pnpm-lock.yaml`, `packageManager pnpm@10.28.2`), `workspace:*` links, root `justfile`; npm workspaces and `package-lock.json` removed | closed | clean-copy `pnpm install --frozen-lockfile && just --list && just check` exit 0 |
| 2026-10-18 | — | `docs/ARCHITECTURE.md` and `docs/architecture.svg` — the map of packages, elements, workbook, flows, contract, laws, build order | landed | the files; the SVG rendered and checked in Chromium |
| 2026-10-18 | W-11 | the testing verdict — Vitest (Node + browser mode on Playwright), fixtures, goldens, property tests, a11y, perf, sync, coverage | closed — the decider's "resolve all the blockers" ruling of 2026-10-18 | `work/compare/testing.compare.md` |
| 2026-10-18 | W-05 · W-06 · W-07 · W-08 | four compare docs with verdicts: reading, grid, workbook-and-error contract, export shape; ten `unruled` backlog rows ruled into their laws | closed — the decider's "resolve all the blockers" ruling of 2026-10-18 | `work/compare/*.compare.md`; the rulings in SR-LAW-2 … SR-LAW-8 Consequences |
| 2026-10-18 | W-15–W-22 (skeletons) | eight plugin packages scaffolded under `packages/` — `numfmt`, `formulas`, `styles`, `validation`, `condfmt`, `images`, `charts`, `comments` — manifests with `@sheetpane/grid` as a peer, `numfmt@4.0.1` and `@ironcalc/wasm@0.9.0` pinned, stub sources, READMEs; root workspaces list them | landed — skeletons only, nothing builds | `packages/*/package.json`; `npm install --package-lock-only --ignore-scripts` resolves all ten workspaces and both dependencies (`package-lock.json`) |
| 2026-10-18 | W-04 (rename) | the UI package renamed `sheetpane` → **`@sheetpane/grid`**, folder `packages/sheetpane/` → `packages/grid/`; workspaces, lockfile, Ownership rows, registry and items W-01–W-05, W-08, W-09 follow | landed — name only, no code changed | `packages/grid/package.json`; `npm install --package-lock-only --offline` resolves both workspaces |
| 2026-10-18 | W-04 (step 1) | the monorepo skeleton: npm workspaces, `packages/export` and `packages/sheetpane` manifests, shared `tsconfig.base.json`, stub sources; `work/reference/` with downloaded specs and the design snapshot | landed — skeleton only, nothing builds or tests yet | `npm install --package-lock-only` resolves both workspaces; `package-lock.json` |
| 2026-10-18 | — | laws L8 (npm package) and L9 (memory = a JavaScript object): records 0010, 0011 | filed | `records/0010_LAW-8-npm-package.md`, `records/0011_LAW-9-memory-is-a-javascript-object.md` |
| 2026-10-18 | — | laws L6 (changes in memory, export carries them) and L7 (components in sync): records 0008, 0009 | filed | `records/0008_LAW-6-edits-in-memory-export-with-changes.md`, `records/0009_LAW-7-surfaces-always-in-sync.md` |
| 2026-10-18 | — | law L5 (browser-default font unless the host sets one): record 0007 | filed | `records/0007_LAW-5-host-font.md` |
| 2026-10-18 | — | law L4 (always a web component): record 0006 | filed | `records/0006_LAW-4-web-component.md` |
| 2026-10-18 | — | laws L2 (every dependency is FOSS) and L3 (XLSX and CSV only): records 0004, 0005 | filed | `records/0004_LAW-2-foss-dependencies.md`, `records/0005_LAW-3-xlsx-and-csv-only.md` |
| 2026-10-18 | — | the work system: records 0001–0003, 0051–0060; `work/`; `archive/`; hooks; the commit guard | set up | the setup commit |
