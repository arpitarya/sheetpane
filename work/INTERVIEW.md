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
**pnpm-workspace monorepo** (W-10; `just` runs it) with these packages:

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
its React API and its IBM Plex font**. The snapshot also holds **fifteen plugin
boards** (Cowork, later on 2026-10-18): one per plugin, freeze, a slot map, the
all-plugins density check and pane sync, reconciled with W-14–W-24 — where a
board and an item file disagreed, the board was changed.
**Ground it before you edit it** — `git log`, the queue, the code.

## 2 · In flight, and the immediate next step

*Updated 2026-10-18 (Claude Code).* **Built and closed:** W-10 (pnpm + just),
W-04 (toolchain, CI), W-03 (export), W-12 (download), W-13 (import), W-01
(the sheet + the pane's store), W-02 (errors), W-14 (plugin host), W-23
(undo), W-24 (freeze). Records SR-BUILD, SR-EXPORT, SR-DOWNLOAD (proposed),
SR-IMPORT, SR-GRID, SR-ERRORS. `just check` runs ~200 tests (Node + Chromium;
WebKit and Firefox nightly).

- **Next in Claude Code:** W-09 (demo apps), W-26 (editing events — W-25's
  verdict), then the plugins W-15 numfmt, W-16 formulas, W-17 styles, W-18
  validation, W-20 images; W-19 after W-17, W-21 after W-20; W-27 and W-28
  after W-26.
- **Owed by the decider:** W-30 (files from Excel, Google Sheets, LibreOffice,
  Numbers, when convenient); B-030 (SR-LAW-6's
  veto command flags the `src` loader's GET); the `@sheetpane` npm org before
  `just release`. **Ruled 2026-10-18:** W-29 dark values accepted, `theme`
  defaults to `light`; W-22 has no Export-menu line, the host decides
  (`comments({ write })` on by default, `export({ comments: false })`);
  SR-DOWNLOAD accepted. W-09 closed; its iPhone check is backlog B-031 (not now).
- **Know before you build on the grid:** the store is `packages/grid/src/pane/store.ts`
  (one commit path: undo, derive, validate, events); plugins are plain objects
  on six hooks (SR-GRID decisions 17–20); zoom scales geometry, not a
  transform (SR-GRID Alternatives).

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
