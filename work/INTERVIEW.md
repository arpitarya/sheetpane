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
- **`@sheetpane/import`** (`packages/import`) — `.xlsx` or `.csv` in, the
  `Workbook` object out, in a page or in Node (W-13, W-39).
- **Consumer tooling** — `@sheetpane/skills` (W-35), `@sheetpane/mcp` (W-39),
  `@sheetpane/testing` (W-41), `@sheetpane/fixtures` (W-42), `llms.txt`
  (W-38), SP error codes (W-40).
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

*Updated 2026-10-18 (Claude Code, the consumer-tooling run).* **Built and
closed:** every agent item through W-34, then W-33 (rules file), W-36 (TSDoc +
check), W-38 (llms.txt), W-40 (SP codes), W-41 (`@sheetpane/testing`), W-42
(`@sheetpane/fixtures`). **Built, open:** W-35 (`@sheetpane/skills`; skill 18
waits on W-37, DoD 8 is the decider's) and W-39 (`@sheetpane/mcp`; its
`describe_api` answers once W-37's manifest lands). `@sheetpane/import` now
reads `.xlsx` in Node (`minixml.ts`; SP-1008 retired). W-44 DoD 1 (the Pages
playground) is built.

- **In flight:** W-37 (custom-elements manifest, editor data, framework
  typings) — with an agent; when it lands, regenerate `llms*.txt`, close W-37,
  add the `describe_api` golden and close W-39, finish W-35 skill 18.
- **Next in Claude Code:** W-46 (smooth range selection — waits only on
  W-37's edits to `element.ts` settling), then W-47; W-43 (`create-sheetpane`,
  needs W-37's typings); W-44's StackBlitz links (after W-43); W-45 (after
  W-35 and W-39 close).
- **What every plugin left owed:** Excel-saved fixtures and opening sheetpane's
  output in Excel / LibreOffice — all gathered in W-30's DoD 3; schema
  validation (B-033); plugin-contract gaps (B-034); plugin detail in core
  events (B-032).
- **Owed by the decider:** W-30 (files from Excel, Google Sheets, LibreOffice,
  Numbers, when convenient); B-030 (SR-LAW-6's
  veto command flags the `src` loader's GET); the `@sheetpane` npm org before
  `just release`. **Ruled 2026-10-18:** W-29 dark values accepted, `theme`
  defaults to `light`; W-22 has no Export-menu line, the host decides
  (`comments({ write })` on by default, `export({ comments: false })`);
  SR-DOWNLOAD accepted. W-09 closed; its iPhone check is backlog B-031 (not now).
- **Know before you build on the grid:** the store is `packages/grid/src/pane/store.ts`
  (one commit path: undo, derive, validate, events; `style`/`numFmt` changes
  in their own slot; column rules are a built-in `validate` provider in
  `pane/rules.ts`); plugins are plain objects on six hooks plus optional
  `controls` and `exportOptions` (SR-GRID decisions 17–20); zoom scales
  geometry, not a transform (SR-GRID Alternatives). **Commit with `git add
  … && git commit`, never through a pipe** — the commit-msg hook now refuses a
  rename-only commit (SR-WORK-SESSION decision 13).

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
