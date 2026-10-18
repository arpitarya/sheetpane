---
type: Handoff
description: "Cold-start state of play for a successor session: in-flight work, constraints, lessons."
---

# Model handoff — the agent-succession record

*The departing model answers for the record, so whatever succeeds it inherits
the judgment and not just the files.*

**Standing instruction to every future model reading this: you are now the
maintainer of this document. When the project's direction, decisions or state
change, update it in the same change. Leave it better.**

## How to use this file

A state-of-play doc, not an end-of-session report. Keep it current **during**
the session. Write it for a different model arriving with zero other context,
mid-task. The four sections below are maintained; anything after them is
history. **A stale INTERVIEW at handoff is as serious as a missing worklog
entry.**

---

## 1 · State of play

*Updated 2026-10-18.* Laws L2–L9 are filed (see §3). sheetpane is an
**npm-workspaces monorepo** with two packages and no feature code yet:

- **`@sheetpane/export`** (`packages/export`) — a JavaScript object in, `.xlsx`
  or `.csv` out; no runtime dependencies (W-03).
- **`@sheetpane/grid`** (`packages/grid`) — the web components (L4):
  `<sheetpane-excel>` (view and edit, W-01) and `<sheetpane-errors>` (W-02),
  one package, **always in sync** (L7) through one in-memory workbook (L6, L9).
  Depends on `@sheetpane/export` and `@sheetpane/import`.
- **`@sheetpane/import`** (`packages/import`, not created yet; working name) —
  `.xlsx` or `.csv` in, the `Workbook` object out; the reader, moved out of
  grid by Arpit's ruling (W-13).
- **Demo apps** — a React app and a plain `index.html` that consume the
  package as a dependency (W-09).
- **Eight plugin packages** (`packages/numfmt` `formulas` `styles` `validation`
  `condfmt` `images` `charts` `comments`, scaffolded 2026-10-18; W-15–W-22) —
  each registers against the one workbook through six hooks and adds controls
  to six slots the grid draws (the plugin host, W-14). **Merged cells and
  freeze panes (W-24) are core; pivots are not built** (proposal, B-028);
  undo / redo (W-23) ships before any formatting control. The whole split and
  the rulings it read in: [`compare/plugins.compare.md`](compare/plugins.compare.md).

**Arpit's rulings, 2026-10-18, "resolve all the blockers":** the four
research forks were decided in-session and the ten `unruled` backlog rows
ruled into their laws (own reader; DOM grid, plain internals; workbook registry
by `pane`, selection syncs, no auto-resolve; `patchXlsx` for fidelity; no
copyleft at runtime; CSV dialects read; no wrappers; host font wins over
workbook fonts; no reload survival; SSR-safe import; lockstep versions). All
are his to override; the reopen-triggers are in the compare docs.

**Arpit's rulings, 2026-10-18** (design session): modes are View and Edit;
placement is a tab or a pop-up; cells are plain text, formulas show their
saved value, merge-and-centre is the only format; the error component has no
"linked" chip and no export footer. The design is snapshotted in
[`reference/design/`](reference/design/README.md) — **L4 and L5 supersede
its React API and its IBM Plex font**.
**Ground it before you edit it** — `git log`, the queue, the code.

## 2 · In flight, and the immediate next step

Nothing in flight. Nineteen items are open, all build; **nothing waits on the
decider** — the plugin rulings were read in as Arpit's "decide" of 2026-10-18,
open to override (plugins verdict decision 9):

- **Next in Claude Code:** W-10 — pnpm and a justfile (🟢); then W-04 — build,
  test (Vitest, browser mode for the grid), CI, lockstep publishing.
- **Then:** W-03 (export, with `download`) and W-01 (excel + workbook) in
  parallel, then W-13 (import — the reader, needs W-03's ZIP code) before W-01 can
  read files; W-12 (downloader, spec: SR-DOWNLOAD `proposed`) inside W-03's package; W-02 (errors) after W-01;
  W-09 (demo apps) last. **Plugins after that:** W-14 (host) → W-15 numfmt →
  W-16 formulas → W-23 undo → W-17 styles → W-18 validation → W-19 condfmt →
  W-20 images → W-21 charts → W-22 comments; W-24 freeze panes beside W-01. Every verdict they build from is in `work/compare/`;
  read the five docs before writing code.
- **Owed by the decider, when convenient:** install `scripts/sr-guard.sh` as the
  `commit-msg` hook (W-04 DoD 7); create the `@sheetpane` npm org before the
  first publish; open the sample `.xlsx` in Excel when W-03 asks (DoD 8);
  override any 2026-10-18 verdict he disagrees with — each has a reopen-trigger.
- **The map:** [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

## 3 · Standing constraints

- The laws: L0 (records are the only source; links, never restatements), L1
  (retired records are archived), L2 (every dependency is FOSS), L3 (XLSX and
  CSV only), L4 (always a web component), L5 (browser-default
  font unless the host sets one), L6 (changes held in memory; export carries
  them), L7 (view, edit and error components always in sync), L8 (an npm
  package), L9 (memory = a JavaScript object, for now). See `records/0001_LAWS.md`.
- The queue is the list; a blocker is a file; nothing closed is deleted.
- Tests are not yet in place (`BACKLOG.md` B-001–B-005); the hooks and the
  commit guard are the only mechanical enforcement.
- **Zero runtime dependencies** is the default for both packages; a dependency
  needs a research verdict that allows it.
- **`work/reference/` is reference, never spec.** The spec is the item file.
  The PKWARE ZIP spec is kept local only (`_local/`, gitignored) — its licence
  forbids redistribution.

## 4 · Lessons learned

- **Two sessions share this tree.** Re-read every file before writing it and
  expect a refused write (`LESSONS.md`, 2026-10-18).
