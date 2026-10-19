---
type: Log
description: "Append-only per-session trail, date-grouped, newest first."
---

# WORKLOG — the append-only session log

Every session appends **one entry before it ends** — a chat-only session
counts. **Never edit a past entry; append only, newest on top.** A wrong old
entry is corrected by a new one. Distinct from `INTERVIEW.md`, which is the
*current* state of play. Rules: [SR-WORK-SESSION](../records/0054_WORK-session.md).

**Entry format:**

```
## YYYY-MM-DD — <one-line title>  ·  <surface> (<model>)

- **Asked:** *<the ask>*
- **Done:** <what landed, with commit shas where they exist>
- **Decided / left open:** <rulings taken in-session; forks put to the decider>
- **Mistakes:** <what went wrong and what was done about it, or "none">
- **Next:** <the single next step>
```

---

## 2026-10-19 — 0.4.0 published: all 20 packages on npm  ·  Claude Code (claude-opus-5-5)

- **Asked:** *"commit everything and pull the latest changes merge all branches to main and delete other branches"*, then the publish.
- **Done:** committed the other session's fux setup (`6c95735`; SR-BUILD 1a written — its record text was missing), merged `origin/main` (`22d2d2b`), removed the ten lane worktrees and branches (all already in `main`). The first `publish.yml` run refused without publishing: the three new packages did not exist on npm. The decider would not type an OTP, but published them with `pnpm publish` in each folder (browser approval); the failed job was re-run and CI published the other 17. A clean install of the new packages from npm works. RELEASING.md: 20 packages, and the first-publish step as it was done.
- **Decided / left open:** a trusted publisher on tables, review and compare is owed before the next release (OPEN-WORK's next gate). Registry lag: a fresh version took 1–5 min to be served.
- **Mistakes:** I first told the decider "19 others" and "all 22" — it is 17 and 20; an agent started holding the three back as private before the decider's own publish made it moot (stopped before editing).
- **Next:** the decider's trusted publishers; then W-30 / W-48.

---

## 2026-10-19 — fux docs index set up; L11 committed  ·  Claude Code (claude-opus-5-5)

- **Asked:** *"setup fux-engine"*, then *"set it up using uv package manager"*, then *"commit everything"*.
- **Done:**
  - **Install:** fux 4.0.3 is installed with `uv tool install`, from `~/.claude/fux/engine/packages/fux-core` with the engine, reader and writer alongside. A broken pyenv copy (an entry script with no module) was removed.
  - **Repo setup:** ran `fux setup`, Claude-only. Indexed 220 docs and recorded seven ID families (`fux identifiers --write`).
  - **Node reader:** `.fux/node` is in the pnpm workspace, and `pnpm-lock.yaml` gains `fux-engine@4.0.3` from npm (MIT).
  - **Record:** SR-BUILD decision 1 corrected (the workspace already held `examples/*`), and decision 1a added. Ownership rows added for `.fux/`, `fux.toml` and `.claude/hooks/fux-index-hint.sh`.
  - **L11:** ran the Cowork session's L11 check on the Mac (`test/packages.test.ts` 73/73, repo project 191/191) and committed it as `0ddf8dd`.
- **Decided / left open:** the decider chose Claude-only agent files (no Codex, Copilot or Kiro), kept `.fux/node` in the workspace, and set the corpus to records, work, docs and the top-level docs, with archive marked archived. Not installed, because nobody asked: `fux hooks` (keeps the index current, plus a merge driver) and `fux mcp`. Every doc edit makes the committed index stale until someone runs `fux ingest`.
- **Mistakes:** `pnpm vitest run test/` matched every package's tests. With load average 209 (the lanes session is building alongside), it timed out in 1–5 files, different ones each run. A rerun of the repo project alone passed.
- **Next:** decide whether to install `fux hooks`, so the index is re-ingested on commit.
## 2026-10-19 — W-50–W-69 built in parallel lanes and merged; 0.4.0 prepared  ·  Claude Code (claude-opus-5-5, orchestrator)

- **Asked:** *"look into open work and implement everything and commit and push and publish a new version"*, then *"do as many work items or feature in parallel as possible"*.
- **Done:** committed and pushed the Cowork session's grid/demo fixes (`3640b72`) and the visibility tests they broke on CI (`a95fc33`). Built the 18 agent items W-50–W-69 with one agent per item in eight git worktrees (`../sheetpane-lanes/a`–`h`, branches `lane-*`), dependency-ordered; merged them on a branch `integration` with four merge passes, renumbering what two lanes issued alike (SP-3016–3020 several times over, W-52's SP-2015, the review plugin's SP-59xx → SP-50xx; SR-VALIDATION 9/10/11, SR-ERRORS 15–17, SR-IMPORT 11–15, SR-GRID 21d/e, W-30's DoD rows) and wiring what spanned items (W-63's `compare` layer, W-52 × W-61 / W-57 / W-64 / W-62, W-67's later marks, review skipping `compare`). A real bug found at the merge: reverting a `structure` Edits row left the workbook shifted. Filed B-036–B-046; CHANGELOG's 0.4.0 section written.
- **Verified:** integration's full suite 1484/1485 (the miss is `@sheetpane/compare`'s 500 ms perf budget at 507 ms under load ≈ 7.6; passes alone), demo-check 57/57, pack-check 22, smoke-built 23, export coverage 95.98 %.
- **Decided / left open:** the decider chose to publish the three new packages (`tables`, `review`, `compare`) by hand once, since CI's trusted publishing needs them to exist. The other session's fux setup is staged, uncommitted, in the main tree — it must rebase onto this push. Read in, for the decider to confirm: B-044–B-046.
- **Mistakes:** committing `3640b72` without running the plugin suites — two visibility tests went red on CI; fixed in `a95fc33`. Agents shared one scratchpad file once (a commit message swapped, amended before any push); later prompts gave each lane its own temp folder.
- **Next:** CI green on main → Arpit's first publish of the three → `just publish 0.4.0`.

---

## 2026-10-19 — W-62 and W-67 merged into integration, and the cross-item wiring  ·  Claude Code (claude-opus-5-5, the orchestrator's merge lane)

- **Asked:** *merge lane-e (W-62, `8fdbf88`) and lane-d (W-67, `55bd8f7`) into `integration` one at a time, renumber what collides, then wire W-62 × W-52, W-67's marks for W-50/51/53/55/69, and @sheetpane/review skipping the `compare` layer.*
- **Done:** merges `b1e34ca` (W-62) and `8f42095` (W-67); wiring `ba79bbb` (insert and delete refused by the structure lock and, as Excel, by a protected sheet's insert/delete switches — SP-3026), `9e97699` (`renderStatic`: results at `marks` only, accepted, the visible layers, sheet and workbook errors in the footer, rich-text runs), `a4d1938` (`@sheetpane/review` leaves `compare` out unless named). Renumbered: SP-3020 *Locked in the file* → SP-3026; SP-3017 *Nothing to render* → SP-3027; SP-3018 *Cannot render that range* → SP-3028 (W-67's lane SP-3016 for `check()` is W-54's SP-3020); SR-GRID 21d (W-62) → 21e; SR-IMPORT 14 (W-62) → 15; W-30 DoD 8 (W-62) → 9 and DoD 6 (W-67) → 10. Goldens: `parity.json` gains `protected.xlsx`; `static.json` gains the showcase's Tables sheet at the merge, then its showcase entries change only by the review state the shared `edit()` adds. Stale lane duplicates (W-66 and W-54 rows with old codes) dropped from IMPLEMENTATION, CHANGELOG and archive/README.md.
- **Decided / left open:** the structural refusal reuses SP-3026 (*Locked in the file*) rather than a new code; the structure lock refusing row and column inserts is sheetpane's reading (Excel's guards sheets only) — recorded in SR-GRID 21e; Excel's refusal to delete a row holding a locked cell when the switch allows it is not checked. A static result glyph floats before the text (mail clients drop `position`).
- **Mistakes:** the first renumbering pass skipped lines naming W-52 beside W-62 (one W-30 DoD reference) and lines without a W-67 keyword (the record's and README's refusal lines) — found by grepping every remaining SP-3017/3018/3020 and fixed before each commit.
- **Next:** the orchestrator reviews `integration` and decides on the push; W-30 DoD 9 and 10 wait on Arpit.

---

## 2026-10-19 — W-67 closed: a range as static HTML (`@sheetpane/grid/static`)  ·  Claude Code (claude-opus-5-5, lane d)

- **Asked:** the orchestrator: build W-67 in worktree lane d (branch `lane-d`), one item, commit, do not push.
- **Done:**
  - **The entry:** `packages/grid/src/static.ts` — `renderStatic(book, options)` reads a loaded store (`text()`, `value()`, `decorate()`, `merges()`, `hidden()`, changes, derived, `mayBeStale()`) and writes one `<table>`: inline CSS mirroring the grid's cell, header and merge rules, the tokens as hex (light or dark), `decorate` values allow-listed and sanitised, hidden rows and columns skipped, merges as `rowspan`/`colspan` clipped to the range. Marks through `STATIC_MARKS` + `markOf()` (status, then severity): ring, tint flattened over the fill, numbered glyph badge, row-header glyph, a footer line per error. Overlay plugins are named, not run. `check()` split into `loadWorkbook()` + the sort. SP-3027, SP-3028.
  - **Proof:** the graph test covers `/static`; a browser test compares every cell and header with the grid's computed style on six fixtures in both themes, and the HTML equals a golden that Node renders; the grid's static tests and a fast-check escaping fuzz (mutation-checked); smoke-built renders the built entry.
  - **Records:** SR-GRID 22f/22g, SR-BUILD 5a/8, SR-FIXTURES 6a, SR-CODES 2, SR-SKILLS 2; registry rows; skill `sheetpane-backend`, grid README, ARCHITECTURE, GLOSSARY, ERRORS.md, CHANGELOG; `llms*.txt` and `plugins/sheetpane` regenerated. W-30 gained DoD 10 (mail clients, the decider's).
- **Decided / left open:** read in: `book` is a store, not bytes (`loadWorkbook()` gives one), so a host renders many ranges from one load; inline hex, no `auto` theme (mail has no stylesheet); a shared cell takes the highest-ranked mark (the grid takes the last error's — the fidelity test met no shared cell); the changed corner is a background layer, the tint a flattened colour; text is clipped to the row as the grid clips it; no `tokens` override, no rich-text runs (not on this base), no condfmt icon sets or cell controls.
- **Mistakes:** a first test cut compared `start` with `left` and the selected header's highlight; the first render let wrapped text grow its row — fixed by clipping the text span to the row.
- **Next:** the orchestrator merges lane d (SP-3017/3018 may need renumbering; W-50/W-55/W-69 marks join `STATIC_MARKS`).

---

## 2026-10-19 — W-62 locked cells and sheet protection honoured in Edit  ·  Claude Code (claude-opus-5-5, lane e)

- **Asked:** *build W-62 in lane e (worktree `sheetpane-lanes/e`, branch `lane-e`, on the integration branch at `5007023`), beside other lanes; W-52 is not on this base, so expose one predicate its insert/delete can call.*
- **Done:** `@sheetpane/import` reads `<sheetProtection>` (fifteen switches with the schema defaults, `hasPassword` — never the hash), `<workbookProtection>`, each xf's `<protection>`, row (`customFormat`) and column formats, and exports `cellProtection()` (SR-IMPORT 15). The grid: `store.isLocked` / `isFormulaHidden` / `structureLocked` / `sheetProtection` / `setProtection`, `snapshot.protection`, snapshot helpers for plugin controls; a locked cell refuses typing, Enter/F2, Delete, paste and a range clear before `beforechange` with `sheetpane-editcancel` `reason: 'locked'`, SP-3026, a cell-bar chip and a status-line count; the store refuses `setCell` / `setCells` / "Also change the cell" there; no value picker on a locked cell; hidden formulas show their value (`input()`, the formulas plugin's `fx` and outlines); `setSheetState` refused under the structure lock, the banner's Unhide disabled; `protection="ignore"` (SR-GRID 21e). `@sheetpane/visibility`: Hide sheet disabled with the reason (`sheetBlockedReason`). `@sheetpane/fixtures`: `protected.xlsx` (password `sheetpane`, legacy hash `CC7D`). Skills `sheetpane-security`, `sheetpane-events`. Tests: import 8, grid 12, visibility, formulas and fixtures +1 each; all projects 1262 of 1263 (the SSR import test timed out at 5.2 s under a full parallel run and passes alone — load); demo-check 53 ✓.
- **Decided / left open:** read in: an empty cell takes its row's format (`customFormat`), else its column's, else the default — Excel's rule, so a column unlocked whole stays open below the data; the store refuses a locked write too (not only the element), so the errors panel's "Also change the cell" and a plugin's `choose` cannot get round it; `ignore` is a pane view setting, never a change. Not honoured yet (backlog candidates): the sheet switches for formatting, sorting, filtering and hiding rows or columns. Excel ties inserting and deleting rows to the sheet's `insertRows` / `deleteRows` switches, not to `lockStructure` — W-52 should ask `sheetProtection(sheet)` as well as `structureLocked()`. Handed on: the Excel-saved check to W-30 DoD 9; W-52's wiring to the orchestrator at merge.
- **Mistakes:** none.
- **Next:** the orchestrator merges lane e and wires W-52's insert/delete to `structureLocked()`.

---

## 2026-10-19 — W-63 closed: the `compare` layer, wired at the integration merge  ·  Claude Code (claude-opus-5-5, the orchestrator's merge lane)

- **Asked:** *merge lanes a, f, h and c (W-51, W-64, W-59, W-52) into `integration`, then wire what each left for the merge — first W-63's `compare` layer.*
- **Done:** `publishChanges` (`packages/compare/src/ui.ts`) writes only its entries with `setErrors(list, { layer: 'compare' })` (`COMPARE_LAYER`); the `keep` filter is gone, the review and undo are kept, ids are the pane's. `@sheetpane/comments` leaves the `compare` layer out of a download unless `export({ layers })` names it. Tests: `compare.test.ts` (the layer, the review apart, undo kept, the visible layers), comments `write.test.ts` (left out while shown, written when named). SR-COMPARE 12 and Consequences, SR-COMMENTS 3, the register row, the compare README, the `sheetpane-plugins` skill, CHANGELOG *Changed*. The item moves to `archive/open/`.
- **Decided / left open:** a comparison is not the review, so comments skip the layer by default; `@sheetpane/review` still lists every layer by default (W-59's choice) — whether it should skip `compare` too is the decider's.
- **Mistakes:** none.
- **Next:** the remaining merge wiring (W-59's types, W-52 × W-61, W-52 × W-57, W-52 × W-64).

---

## 2026-10-19 — W-64 closed: the Edits view in the errors panel  ·  Claude Code (claude-opus-5-5, lane f)

- **Asked:** *build W-64 in its own worktree lane, alongside the other lanes.*
- **Done:** `store.edits()` (the change map as a list, newest first, each entry's time kept by the entry object so undo brings it back), `editEffects(key)` (errors cleared / raised / matched, compared with before the cell first changed), `revertEdits(keys?)` (one undo step; all when no keys), `editRef`, types `Edit` and `EditEffects`; in `<sheetpane-errors>` an *Edits n* chip after Problems (Edit mode always, View mode only with edits), rows with place, kind, was → now, time and error links, Revert and Revert all, ↓ ↑ Home End, pages of 100. Records SR-GRID 9a, new 24; SR-ERRORS §1, new 16, Consequences. `edits.test.ts` (13); errors / results tests updated for the chip now shown in Edit mode.
- **Decided / left open:** read *hidden in View mode with no edits* literally — in Edit mode the *Problems · Edits* switch is always there, so other lanes' tests that list the view chips in Edit mode meet *Edits 0*. Unknown change kinds (W-52's `structure`) list as one row by name; reverting removes the entry.
- **Mistakes:** the skill section first went over the 200-line cap (`skills.test.ts`); folded into one table row.
- **Next:** the orchestrator merges lane f; W-52 checks its `structure` entry reads well in the Edits row.

---

## 2026-10-19 — W-50 closed: pass and not-checked results, quiet by default  ·  Claude Code (claude-opus-5-5, lane f)

- **Asked:** *build W-50 in its own worktree lane, alongside five other lanes.*
- **Done:** severities `pass` / `skipped` with `isResult` and `SEVERITY_ORDER`; the pane-wide `results` level (`off` · `summary` · `marks`) on both elements; result marks (9 px ✓ / — bottom-left, `--sp-skip`), the cell-bar chip and *n of m checked*; the errors panel's summary line, On sheet switch, Problems · Passed · Not checked chips, grouped results with Show ▸ and virtualised cells; problems-only counts; `@sheetpane/comments` writes results only with `includeResults`. Records SR-GRID 5, 9, 13, 15a, 22a, new 23; SR-ERRORS 1, 3, new 13; SR-COMMENTS 3. W-59 told what W-50 hands it.
- **Decided / left open:** rules keep `ProblemSeverity` (a failing rule is a problem), so `rules.schema.json` is unchanged; results are counted in cells, problems in entries; `includeResults` is host-only (no Download-menu switch); a result a `validate` provider stops reporting is removed, never resolved. Left open: a demo of results in `examples/` (not required by L10 — no example uses results).
- **Mistakes:** none.
- **Next:** merge lane f; then W-55/W-68/W-69's lane, which touches the same list.

---

## 2026-10-19 — W-60 dependent dropdowns: `INDIRECT(<cell>)` list sources  ·  Claude Code (claude-opus-5-5)

- **Asked:** *build W-60 in lane e (worktree `sheetpane-lanes/e`, branch `lane-e`), on top of W-61, beside other lanes.*
- **Done:** `@sheetpane/validation`'s `parseOperand` reads `INDIRECT(<cell>)`, `INDIRECT("text")` and `, TRUE`; `namedBy` resolves a text to a defined name (case-insensitive, sheet-scoped first), a table or table column (W-61's `resolveStructuredRef`) or an A1 range, cached per workbook; `indirectAt` reads the parent per cell, live; lists, the arrow, `expected` and number operands use it (SR-VALIDATION 3, 4, 9). The grid's `validate` reconcile now refreshes an open machine error's `expected` (SR-GRID 19b) — without it an orphaned unit kept the old parameter's list. `@sheetpane/fixtures` adds `dependent-lists.xlsx` (SR-FIXTURES 2, 5). Tests: validation 43, a grid assertion; validation · grid · fixtures · repo · node 622 ✓, testing · tables 17 ✓.
- **Decided / left open:** read in: a parent that names nothing (blank, `Flow Rate`) gives no list — the child passes under `allowBlank` ("Ignore blank") and fails without it, as Excel does; `INDIRECT(SUBSTITUTE(…))`, `&`, R1C1 and `OFFSET` are skipped (`source`), not emulated (the item's hazard). A separate fixture file rather than a showcase sheet, so the showcase, its goldens and the demos are unchanged. Handed on: the Excel-saved check to W-30 DoD 7.
- **Mistakes:** none.
- **Next:** the orchestrator merges lane e.

---

## 2026-10-19 — W-61 Excel tables: read, `Table[Column]` resolved, `@sheetpane/tables` draws them  ·  Claude Code (claude-opus-5-5)

- **Asked:** *build W-61 in lane e (worktree `sheetpane-lanes/e`, branch `lane-e`), beside five other lanes.*
- **Done:** import reads table parts (SR-IMPORT 11); `resolveStructuredRef` in `@sheetpane/export`'s `refs.ts` (SR-EXPORT 9a), re-exported by the grid; validation's list sources resolve it (SR-VALIDATION 3–4); new `@sheetpane/tables` and SR-TABLES (0122); `styles` and `condfmt` order themselves after `tables`; the showcase gains a Tables sheet (MCP goldens regenerated, `@sheetpane/tables` suggested); a *Tables* gallery tab in both demos and its demo-check step; llms and the Claude plugin regenerated. Item archived.
- **Decided / left open:** read in: the style subset is Light 1–7 and Medium 1–7 drawn from the theme, every other style a bold header (the item's hazard); a table with no style draws nothing; a filled table cell takes the theme's dark ink so it reads in dark mode. Handed on: the Excel-saved table file and opening a download in Excel → W-30 DoD 6; shifting a table's `ref` → W-52 (noted in its Hazards). Not done: `[#This Row]`, custom table styles, totals recalculated by the table.
- **Mistakes:** the resolver's first `@example` imported `@sheetpane/import`; `test/tsdoc-walk.ts` reads imports inside doc comments, so export appeared to import the reader and the walk lost `Cell` / `SheetState` (fixed by a self-contained example).
- **Next:** the orchestrator merges lane e and renumbers 0122 if another lane took it.

---

## 2026-10-19 — W-54 closed: the pane's checks in Node (`@sheetpane/grid/check`, `@sheetpane/validation/check`)  ·  Claude Code (claude-opus-5-5, lane d)

- **Asked:** the orchestrator: build W-54 in worktree lane d (branch `lane-d`), one item, commit, do not push.
- **Done:**
  - **The entries:** `packages/grid/src/check.ts` — `check(bytes, options)` over the existing store, `host-rules` and plugin host (none of `store.ts`, `rules.ts`, `element.ts` changed); it sets the rules before the file, waits for every `derive` (a prototype wrapper on the plugin) and for `ruleProgress` to clear, and sorts. `packages/validation/src/plugin.ts` holds the plugin moved out of `index.ts`; `check.ts` is its `/check` entry; `rules.ts` takes `shiftFormula` from `@sheetpane/export` (now a dependency) so the main entry needs no import-map line. SP-3020.
  - **Proof:** `test/check-entries.test.ts` walks both import graphs (no element, no DOM global) and runs them in Node; the fixtures parity pair (browser `<sheetpane-excel>` / Node `check()`) on one golden, 16 cases, also green in WebKit; `check_rules` in `@sheetpane/mcp` now runs `check()`, its own copy of the header notes deleted, `findings` added.
  - **Records:** SR-GRID 22f, SR-VALIDATION 1/4/11, SR-BUILD 5a/8, SR-MCP 1/5, SR-FIXTURES 6, SR-CODES 2, SR-SKILLS 2; registry rows; skills, READMEs, ARCHITECTURE, GLOSSARY, ERRORS.md, CHANGELOG; `llms*.txt` and `plugins/sheetpane` regenerated. W-67 re-balled 🟢.
- **Decided / left open:** read in: `check()` returns the store's errors sorted (sheet, row, column, type, message) so a CLI's output is stable; `check` on `@sheetpane/validation/check` is the workbook check, the one-rule `check` stays on the main entry; no `settled()` was added to the store (other lanes edit it) — a backlog candidate.
- **Mistakes:** the first cut imported `@sheetpane/grid/check` at run time from validation's shared `rules.ts`, which broke the plain-HTML import map (the testing package's Playwright run timed out); fixed by taking `shiftFormula` from `@sheetpane/export`. The TSDoc walker matched an `@example`'s import inside a comment and cut a real re-export in a cycle; it now strips comments.
- **Next:** the orchestrator merges lane d (SP-3016 may need renumbering).

---

## 2026-10-19 — W-63 built: `@sheetpane/compare` (layer pending W-51)  ·  Claude Code (lane g, claude-opus-5-5)

- **Asked:** *build W-63 in its own worktree (lane g of seven); W-51's layers are being built in another lane, so write the changes through the existing errors API in one function and leave the item open.*
- **Done:** the new package `@sheetpane/compare` and record SR-COMPARE (0124).
  - **Headless:** `diffWorkbooks` matches sheets by name, then renames by content; columns by header title; rows by key (moved) or by patience anchors plus Myers inside the gaps, with alike rows paired as changed; cells by value, text and relative formula. Also `applyDiff`, `summaryText`. fast-check checks that a workbook diffed with itself is empty and that the diff applied to *a* gives *b*'s values.
  - **`/ui`:** tints through `decorate`, the status summary, Alt+F5 / Alt+Shift+F5, and Compare… / Stop comparing in the cell bar. Each change is listed in the errors list by `publishChanges` (type `compare`, *found → expected* = now → base).
  - **Around it:** SP-5901; the fixtures pair `compare/`; the MCP tool `diff_workbooks`; the gallery tab *Compare* in both demos and its demo-check step (53 ✓); package lists, lockfile, vitest project, skill row, llms and the plugin regenerated.
  - **Speed:** 50,000 rows × 8 columns in 120 ms unkeyed, 119 keyed, 138 with every row changed (budget 500 ms). Measured on an Apple M4 at load average 14–17 while six other lanes built.
- **Decided / left open:** the comparison is the file as loaded against the base, never the pane's edits (edits are W-64's edits view). A removed sheet's rows count in the summary, and the status line names the sheet. Without a key a reordered row is removed and added, never moved. Of two equally long in-order runs, the one nearer the old places wins. **Left:** the `compare` layer: switch `publishChanges` once W-51 lands. Until then it goes through `setErrors`, which clears undo.
- **Mistakes:** the MCP tool first re-threw an uncoded error (the code scan caught it), so `callTool` now passes any coded error through. The README and SR-MCP first claimed the tool could raise SP-5901, which a key for every sheet never does; both were corrected before commit.
- **Next:** when W-51 merges, switch `publishChanges` to `setErrors(list, { layer: 'compare' })`, drop the `keep` filter, and close W-63.

---

## 2026-10-19 — law L11 filed: the workbook never leaves the browser  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *"Create a law. Everything should be within the browser. Nothing go back to the server. Meaning when you upload a CSV or when you upload an Excel file, it does not go to the server. It just stays within the browser."*
- **Done:** filed [SR-LAW-11](../records/0013_LAW-11-workbook-stays-in-the-browser.md) (0013). Added its row to SR-LAWS, the register (range note and row) and **`CLAUDE.md` §The laws (one line, added under SR-WORK-DOCS decision 7a)**.
  - **Enforced:** a new `SR-LAW-11` block in `test/packages.test.ts` fails on any network API in a package's shipped code except the three reads. A second test fails on any `fetch` with a method or body. SR-BUILD decision 7 names it.
  - **Verified:** vitest won't start in the Cowork Linux shell (macOS-only `rolldown` binding in `node_modules`). The same scan, run as a plain Node script over 131 files, finds exactly the three allowed reads and catches a planted `POST`.
  - **B-030 closed** (SR-WORK-BACKLOG rule 26): the law rules on the `src` read. Its citations were rewritten in SR-LAW-6, SR-GRID, `docs/ARCHITECTURE.md`, `INTERVIEW.md` and the `sheetpane-security` skill.
  - **Public docs:** the `sheetpane-backend` and `sheetpane-load-export` skills now say that a server save is the host's own code. README (Why sheetpane, What it does not do) and the CHANGELOG (Unreleased → Added) are updated. `llms-full.txt` and `plugins/sheetpane/` are regenerated.
- **Decided / left open:** the decider ruled (1) sheetpane never sends anything, while a host's own code may save to its server; (2) the `src`/`rules-src` GETs stay, because they send nothing. `NOW.md` was left alone: a concurrent Claude Code session owns it (lanes W-50–W-69). **Not committed**, at the decider's word.
- **Mistakes:** the first regex matched `fetch (` inside a doc comment; it was tightened to `fetch(`.
- **Next:** run `pnpm vitest run test/packages.test.ts -t 'SR-LAW-11'` on the Mac, then commit with explicit pathspecs.

---

## 2026-10-19 — W-51 closed: review layers  ·  Claude Code (claude-opus-5-5, lane a)

- **Asked:** *build W-51 in the lane-a worktree and close it* (the orchestrator's brief).
- **Done:** every error the store holds carries a `layer` — `review` unless named. `setErrors(list, { layer })` replaces that layer only; `setErrors(list)` and the new `setErrors(envelope)` restore the whole review; `getErrors({ layer })` reads one. The visible layers are the pane's (`setVisibleLayers`, the `layers` attribute and property on both elements) and `snapshot.visibleErrors` is what every surface reads: the sheet's pins, marks, toolbar and tab counts, error stepping and card, the error list, the validation status count and the comments export.
  - `<sheetpane-errors>`: with two or more layers, a *Review layers* switch in the header — All, then each layer with its open count, named by the new `layerNames`; rows name their layer while several are shown; `sheetpane-layers {visible, layers}` on the element acted on.
  - The `sheetpane-errors` detail is the envelope `v: 2` — `{ v, errors, plugins, layers, changed }` (`ErrorsEnvelope`, `store.envelope()`); a pre-layers envelope or bare list restores into `review`.
  - A `validate` draft may name a `layer` (its key and the adoption after a restore include it); `updateError` never moves an error; `export({ layers })` names the set the comments plugin writes.
  - SP-3021 is new (a name that is not one). Records changed: SR-GRID 2, 5d, 7, 9, 17 and the codes line; SR-ERRORS §1, 1, 2, 16 and Consequences; SR-COMMENTS 3 and Consequences; SR-VALIDATION 7; SR-CODES. Both skills, both READMEs, `docs/ERRORS.md` and the CHANGELOG are updated; `llms-full.txt`, the plugin copies of the skills, `custom-elements.json` and the framework typings are regenerated.
- **Decided / left open:**
  - The visible layers live in the store, like the mode: one setting per pane, so the sheet and the list cannot disagree (L7). Not undone. Not in the envelope — what is shown is the host's or the user's view, not the review.
  - Every layer is shown until something names one. The switch is All plus one button per layer (one layer at a time); several at once only from the attribute.
  - Replacing one layer keeps undo and rebases every step onto the new layer, so an edit made before a re-run can still be undone; restoring the whole review still clears it, as before.
  - A person's new error goes into the layer shown (`review` while it is shown), so it never vanishes as it is added.
  - An empty layer named by `setErrors([], { layer })` stays a layer (a check that found nothing). Nothing removes a layer short of a whole restore — a backlog candidate.
  - An id another layer holds, or a blank one, is renamed silently on a layered set.
- **Mistakes:** the `sheetpane-errors` skill went over its 200-line cap on the first draft; trimmed. The full suite run alongside seven other lanes (load ≈ 29) timed out three unrelated tests; each passed rerun alone.
- **Next:** the orchestrator merges lane a; W-63's ball is the orchestrator's to move.

---

## 2026-10-19 — W-59 closed: `@sheetpane/review`, the review as its own sheet  ·  Claude Code (claude-opus-5-5, lane h)

- **Asked:** *build W-59 in the lane-h worktree and close it* (the orchestrator's brief; lane h from lane a at `82f2c7d`).
- **Done:** a new export-only plugin, `@sheetpane/review` (SR-REVIEW 0123), on the existing `exportPatch` context. No core hook was added and SR-EXPORT is unchanged.
  - On download, a *Review* sheet lists every error except the file's own comments. It is a new worksheet part with its relationship, content type and `<sheet>`. Cells are inline strings, the header row is frozen, and the Cell column is an internal hyperlink. Workbook and whole-sheet errors are listed as *Whole workbook* and *Whole sheet*. An accepted error reads *Accepted: <reason>*, with who and when.
  - A hidden defined name, `_sheetpane_review`, marks the sheet, and `reviewSheetOf(book)` finds it. Beside a user's own *Review* sheet the new one is `Review (2)`. Exported again, the plugin rewrites its own sheet in place.
  - *Colour flagged cells* (opt-in) fills each open error's cells by severity on cloned `xf`s. Every other cell stays byte-identical. Accepted and resolved errors are never filled.
  - The Download menu gains two items, and the plugin has `severities` and `layers` options. New codes: SP-5001 – SP-5005.
  - Docs and checks: the gallery tab *Review sheet* in both demos with a demo-check step (53 ✓); the skills *sheetpane-plugins* and *sheetpane-errors*; READMEs; `docs/ERRORS.md`. The package is wired into the vitest project, tsdoc, llms, demo-packed, RELEASING and the lockfile.
  - Records: SR-REVIEW (new), SR-BUILD 11a, SR-CODES, SR-COMMENTS 3 (a pointer). Opening a download in real Excel is added to W-30 DoD 3.
- **Decided / left open:**
  - *Colour flagged cells* is off by default and the sheet is on.
  - The header is marked with a grey fill, not bold, so that no `<font>` is written.
  - The plugin replaces its own earlier Review sheet unless that sheet gained parts of its own in Excel.
  - A range over 10,000 cells colours only the cells the file has (SP-5003).
  - An empty selection writes nothing.
  - Until W-50 and W-51 merge, `severities` is `string[]` and `layer` is read defensively. The orchestrator tightens the types.
  - SP-59xx codes take the next free plugin range and may be renumbered at the merge.
- **Mistakes:** a test regex typo (a stray `)`) kept the package test file from loading, so the suite passed with five fewer tests. The run's count gave it away, and the typo was fixed.
- **Next:** the orchestrator merges lane h and npm's first publish of `@sheetpane/review`.

---

## 2026-10-19 — W-69 closed: accepted deviations  ·  Claude Code (claude-opus-5-5, lane a)

- **Asked:** *build W-69 in the lane-a worktree and close it* (the orchestrator's brief).
- **Done:** an error's `status` may be `accepted` (`ErrorStatus`), with `acceptedBy`, `acceptedAt` and a required `reason`. `acceptError(id, reason, { by })` and `updateError(…, { status: 'accepted', reason })` set it as one undo step; any other status drops the three fields. A blank reason, or an error authored `workbook` or `file`, is refused with the new SP-3018. `setErrors` keeps an older envelope as it was; an accepted error without a reason comes back `open`.
  - `<sheetpane-errors>`: *Accept…* in an open row asks *Why is this accepted?* (Accept disabled while blank; Esc, Cancel, ⌘↵) and writes the element's `author` as who. Accepted errors leave "n open", the severity chips and the sheet's counts; an *Accepted n* chip lists them. The pin and the badge read **A**; the row and the sheet's card show who, when and why, with Reopen.
  - `@sheetpane/comments` writes a reply *Accepted: <reason>* by who accepted it, at that time, and marks the thread done.
  - Records changed: SR-GRID 5c, 13 and the codes line; SR-ERRORS §1, 3, 7, 14 and Consequences; SR-COMMENTS 3, 5 and Consequences; SR-CODES. The skill, the grid README, `docs/ERRORS.md` and the CHANGELOG are updated; `llms-full.txt`, the plugin copy of the skill, `custom-elements.json` and the framework typings are regenerated.
  - Handed on: the review sheet's half of DoD 3 is W-59 DoD 5 (added); opening an export with an accepted reply in Excel joins W-30 DoD 3.
- **Decided / left open:**
  - *Accept…* is offered only where Resolve is: not on rule or file-comment rows, and not in the sheet's card (which shows the acceptance and Reopen). A `host` rule's error can still be accepted from code. It stays accepted while the cell fails the same way; a different finding reopens it, and a pass resolves it. The decider may want *Accept…* on rule rows or in the card.
  - Accepted errors are left out of the severity counts too, and the chip shows only them; the severity filter still applies inside.
  - The glyph is **A**, not ≈: ≈ already marks a stale cell.
  - A `validate` provider cannot accept (`ErrorDraft` has no acceptance fields).
- **Mistakes:** two of the new UI tests were wrong at first: one picked an already-open row again, which closed it, and one pressed a key after the filters had been redrawn, so the button that had focus was gone. Both tests were fixed; the code was not at fault.
- **Next:** the orchestrator merges lane a.

---

## 2026-10-19 — W-68 closed: `meta` on an error and a `renderDetail` hook  ·  Claude Code (claude-opus-5-5, lane a)

- **Asked:** *build W-68 in the lane-a worktree and close it* (the orchestrator's brief).
- **Done:** `SheetpaneError.meta` holds the host's JSON (`ErrorMeta`), up to `ERROR_META_MAX` (64 KiB of JSON, UTF-8). `addError`, `updateError` (`meta: undefined` removes it) and `setErrors` keep its JSON round trip; `getErrors()` copies it. One that is not JSON or is over the cap is dropped with the new SP-3016, and the error is kept.
  - `renderDetail(error)` on `<sheetpane-excel>` (the error card) and `<sheetpane-errors>` (the open row), each its own. Its result goes in a `part="detail"` region after the message: a string as text, a Node as is, nothing for `null`. It runs again only when that error changes or the hook is replaced; a throw is logged as the new SP-3017. Clicks, input and keys in the region are left to the host.
  - Records changed: SR-GRID 5b, 9, 13 and the codes line; SR-ERRORS 1, 13 and Consequences; SR-CODES and SR-COMMENTS Consequences. The skill, the grid README, `docs/ERRORS.md` and the CHANGELOG are updated; `llms-full.txt`, the plugin copy of the skill, `custom-elements.json` and the framework typings are regenerated.
- **Decided / left open:**
  - The region is in the **open** row of the list, not every row: the message it follows is shown only there, and a crop in every row would be heavy. The decider may want a compact form in the closed row; not done.
  - A `validate` provider cannot set `meta` (`ErrorDraft` has no field for it). Proposed as a follow-up, not done.
  - On `updateError`, a `meta` that may not be kept leaves the error's own `meta`, rather than removing it.
- **Mistakes:** one TSDoc `@example` did not type-check on its own (`tsdoc.test.ts` caught it); made self-contained.
- **Next:** the orchestrator merges lane a.

---

## 2026-10-19 — W-55 closed: errors with no cell  ·  Claude Code (claude-opus-5-5, lane a)

- **Asked:** *build W-55 in the lane-a worktree and close it* (the orchestrator's brief).
- **Done:** `SheetpaneError` takes `range: ''` (the whole sheet) and `sheet: ''` with `range: ''` (the workbook). `errorScope` / `ErrorScope` are exported. The store gives such an error `found: ''`; it is never stale or matched, and "Also change the cell" writes nothing.
  - `<sheetpane-errors>` lists a *Workbook* group, then *<sheet> · whole sheet* in sheet order, then *Cells*. Keyboard order follows the groups.
  - In the sheet, a whole-sheet error is counted on its tab, and the count's label names it. It gets no pin or mark, and stepping skips it.
  - Show in sheet opens the tab, or is disabled with a reason for a workbook-level error.
  - `@sheetpane/comments` skips these errors as `no-cell` with the new SP-5804.
  - Records changed: SR-GRID 5a, SR-ERRORS 3, 4 and Consequences, SR-COMMENTS 3 and Consequences, SR-CODES Consequences. The skill, the grid README, `docs/ERRORS.md` and the CHANGELOG are updated too, and `llms-full.txt` and the plugin copy of the skill are regenerated.
- **Decided / left open:**
  - The rules engine still anchors its workbook notes on A1: the rules file's own problems, and SP-6022 "no sheet named …". Moving them to `sheet: ''` changes the rules tests and `check_rules`, and a workbook-level draft does not resolve itself (because `validate` runs per sheet). Proposed as a follow-up, not done.
  - A gap, not caused by W-55: axe's label-in-name rule (2.5.3) fails on every row and filter of `<sheetpane-errors>` in the default font. It is noted in SR-ERRORS Consequences, and the W-55 axe test turns that rule off and says why.
  - The review-sheet half of DoD 3 belongs to W-59, whose DoD 3 already lists these errors.
- **Mistakes:** none. Three repo tests timed out at load ~146 (other lanes building), then passed when run alone.
- **Next:** the orchestrator merges lane a, then files the two follow-ups above if the decider wants them.

---

## 2026-10-19 — W-58 closed: the rules file written into the download as Excel dropdowns  ·  Claude Code (claude-opus-5-5)

- **Asked:** *build W-58 (write the rules file into the download as Excel's own dropdowns and checks) in lane b, its own worktree, while other agents build sibling items; use W-57's `setDataValidations`.*
- **Done:** `@sheetpane/validation` `src/write.ts` (DOM-free): `validationOf` maps one rule to one Excel rule (SR-VALIDATION decision 10's table), `rulesAsValidations(store)` places them per sheet from `store.columnRules` through the grid's exported `checkDocument` (element columns < `"*"` < named sheet, as the rules engine merges; rules.ts untouched), `writeRules` writes each changed sheet's whole block with `setDataValidations` from the plugin's new `exportPatch`. Option `rulesAsValidation` (*Write rules as Excel dropdowns*, off unless `validation({ rulesAsValidation: true })`). Grid: `ExportOption.applies(store)` — the menu hides a switch with nothing to do, Download exports an untouched workbook while an applying switch is on, a plugin whose switches all say `applies` is no longer caught by the "errors + exportPatch" heuristic; `export()` re-renders when done so the status line can report. SP-5401 – SP-5407 (CODES, lock, ERRORS.md). `@sheetpane/export` moved from devDependency to dependency of validation (lockfile). Tests: `packages/validation/test/write.test.ts` (16) — the mapping row by row, placing and merging, `x14` left alone, SP-5407, the option, console and status line, the Download menu, and parity on the showcase. Records: SR-VALIDATION 1, 10; SR-GRID 10, 17; SR-CODES. Skills `sheetpane-rules-file`, `sheetpane-plugin-author`; validation README; `llms-full.txt`; CHANGELOG. DoD 3's Excel/LibreOffice opening joins W-30 DoD 3.
- **Decided / left open:** "the file's own rule wins" read as the *workbook's* own validation (SR-VALIDATION §1's wording): a written rule leaves cells the workbook already rules (listed, SP-5406) and joins a rule that checks the same thing rather than repeating it; among written rules a cell rule beats a column rule, a named sheet's beats `"*"`'s. One rule → one Excel rule, or none: a rule with two checks is skipped whole, not half-written; no `custom` formulas are generated (they would need `@sheetpane/formulas` to be checked back). The switch is off by default, so Download is unchanged for every existing host. A rule that checks nothing (`type: 'text'` alone) is neither written nor listed. CSV downloads, and CSV converted to `.xlsx`, carry no rules. The element's `validate` function is not a rule and is not written.
- **Mistakes:** the first Download-menu test toggled the still-open menu shut; the status line did not show the report until the grid re-rendered after `export()`.
- **Next:** W-30 DoD 3 (the decider opens a written file in Excel and LibreOffice).

---

## 2026-10-19 — W-57 closed: export writes data validation and conditional formatting  ·  Claude Code (claude-opus-5-5)

- **Asked:** *build W-57 (export writes data validation and conditional formatting) in lane b, its own worktree, while other agents build sibling items.*
- **Done:** `@sheetpane/export`: the rule and format types (`DataValidation`, `ConditionalFormat`, `CfRule`, `Cfvo`, `Dxf`, `Font`, `Fill`, `Border`, `BorderSide`, `Alignment`, `Color`) moved here from import, which re-exports them — one definition, so the round trip is exact. `Sheet.dataValidations?`, `Sheet.conditionalFormats?`, `Workbook.dxfs?`; `toXlsx` writes one `<conditionalFormatting>` per format and one `<dataValidations>` after `<mergeCells>`, and `<dxfs>` after `<cellStyles>`; a workbook with none is byte for byte as before. `patchXlsx` options `dataValidations`, `conditionalFormats` (whole set per sheet, in schema position, `[]` removes, `x14:` rules in `extLst` left alone) and `dxfs` (appended; a package without a style sheet gets one). `setDataValidations` / `setConditionalFormats` exported for W-58's `exportPatch` hook. New `rules.ts` checks first: SP-2015 (`bad-rule`). Tests: `packages/export/test/rules.test.ts` (14, ExcelJS read-back), a fast-check round trip through both of import's readers (`rules.test.ts`, `rules.node.test.ts`). Records: SR-EXPORT 1, 2, 3, 6; SR-IMPORT 2; SR-CODES. ERRORS.md, two READMEs, `llms-full.txt`, CHANGELOG; W-30 DoD 3 gains the Excel/LibreOffice check (DoD 4 → W-30); W-58 unblocked.
- **Decided / left open:** a rule's format is a `dxfId` into `Workbook.dxfs` (import's shape), not an inline format; in `patchXlsx` the new `dxfs` are appended and numbered after the file's own, never deduplicated. `showInputMessage="1"` is written whenever a rule has a prompt (the shared shape has no flag, and Excel hides the prompt without it). Excel's limits refused rather than truncated: titles 32, messages 255, a typed-out list 255. Line breaks in attributes and a CR in a formula are written as character references (DOMParser and the built-in reader otherwise disagree). The grid's Download does not yet pass rules (not asked). No example change — the demos write no rules.
- **Mistakes:** the first type move dropped `CellXf` from import's types (typecheck caught it); `toStrictEqual` failed on fast-check's null-prototype records — the property compares with `toEqual`.
- **Next:** W-58 (the rules file as Excel dropdowns) can start.

---

## 2026-10-19 — W-53 closed: rich text read, drawn and kept  ·  Claude Code (claude-opus-5-5)

- **Asked:** *build W-53 (rich text: keep a cell's formatted runs on import and draw them) in lane b, its own worktree, while other agents build sibling items.*
- **Done:** `@sheetpane/import`: `ImportedSheet.runs` and the `TextRun` type — each `<r>`'s text and `<rPr>` (through the `styles.xml` font reader, never `<rFont>`), shared and inline strings, `<rPh>` left out, only for a rich string; cells sharing a string share one array. `@sheetpane/grid`: `CellContext.runs` while the cell holds the file's value; `store.runs()` and `store.decorateRuns()`; the `decorate` hook's optional `decorateRuns(cell)` → `RunStyle[]`, allow-listed, SP-3010 on a family, plain when the pieces' text is not the display text; spans inside `.v`; editing a rich cell shows a cell-bar chip (`data-sp="rich-text"`) and `sheetpane-editstart` carries `richText: true`. `@sheetpane/styles`: `decorateRuns` and `runCss` — weight, style and decoration outright, size and colour against the cell's own font, super/subscript at 0.75. Export needed no change: `patchXlsx` writes the edit as a plain inline string and leaves `sharedStrings.xml` and untouched cells as they were (tested). Tests: `runs.test.ts` in import (7), grid (11), styles (10). Records: SR-IMPORT 2, 3, 12; SR-GRID 9, 9a, 15c, 17; SR-STYLES 9; SR-SKILLS. Manifest, typings, `llms-full.txt`, the Claude plugin regenerated; three READMEs, two skills, CHANGELOG; W-30 DoD 3 gains the Excel check.
- **Decided / left open:** read in: a single run counts as rich only when it carries formatting (the hazard's "more than one run", widened so a wholly italic string's formatting is not lost); a formatted run states weight, style and decoration outright (an Excel `<rPr>` is the run's whole font), size and colour only where they differ from the cell's font; the warning is a cell-bar chip and an event flag, no SP code (no console line); `decorateRuns` is part of the `decorate` hook, so the hooks stay six. Paste and Delete over rich cells write plain text without the chip. `toXlsx` does not write runs (not asked). No example change — the demos' sample has no rich text.
- **Mistakes:** the first skill wording wrote `sheet.runs`, which the skills drift check reads as an element member; reworded.
- **Next:** the queue's next agent item.

---

## 2026-10-19 — W-65 closed: the file's SHA-256 on load and on export  ·  Claude Code (claude-opus-5-5)

- **Asked:** *build W-65 (the file's SHA-256 on load and on export) in lane b, its own worktree, while other agents build sibling items.*
- **Done:** `@sheetpane/import`: `hash.ts` — `sha256(bytes | ArrayBuffer | Blob)` through `crypto.subtle.digest`, lowercase hex, exported; `read()` sets `ImportedWorkbook.sha256` once after the file parsed. `@sheetpane/grid`: `Source.sha256`; `exportFile()` returns `sha256` of the blob (`buildExport` + one hash); `sheetpane-load` (ready) and `sheetpane-export` carry `sha256`; an untouched Download reuses the load's hash. No Web Crypto, or a failing digest → `undefined` with `console.warn` SP-1009 (new, warning), never a substitute. Manifest, framework typings, `llms-full.txt` and the ERRORS index regenerated; both READMEs; the demos' export line shows the first 12 hex digits (L10). Tests: `hash.test.ts` (8), `fingerprint.test.ts` (6). Records: SR-IMPORT 1, 2, 11; SR-GRID 2, 6, 9; SR-CODES; SR-BUILD 11.
- **Decided / left open:** read in: only `read()` hashes (`fromXlsx` / `fromCsv` may be given text, not the file); a refused file is not hashed; SP-1009 warns on every unhashed load or export rather than once per page; the event key is always present (`string | undefined`). `@sheetpane/mcp` does not report the hash yet — not asked.
- **Mistakes:** the empty-message vector was misremembered in the first test draft (`…afbe4c…` for `…afbf4c…`); `shasum -a 256` settled it before anything was committed.
- **Next:** the queue's next agent item.

---

## 2026-10-19 — W-52 insert and delete rows and columns, every reference shifted (closed)  ·  Claude Code (claude-opus-5-5)

- **Asked:** *build W-52 in lane c (a worktree beside six other lanes), close it, commit, do not push; leave W-61's in-memory table shift as one marked hook.*
- **Done:** in the Hazards' order, a test before each next part. **Shifts** (`@sheetpane/export` `structure.ts`, one implementation): index, span (an insert inside widens, a delete clips), leading count, A1 text, sqref, `restructureFormula` (`#REF!` for deleted targets; strings, other sheets, external, 3-D and structured refs left alone). **Import:** `restructureWorkbook(book, op)` moves every table plugins read, chart parts served moved; `PivotTable.source`; `shiftTables` is W-61's hook. **Store:** `insertRows` / `deleteRows` / `insertCols` / `deleteCols`, kind `structure` (`sheet!#structure`), one undo step restoring the moved book, derived values and plugin-error index; changes, errors (deleted → resolved "row deleted"), selection moved; refusals SP-3022 merge cut, SP-3023 pivot moved, SP-3024 off the sheet, SP-3025 table cut (reads `tables` when W-61 adds it). **Export:** `patchXlsx` `structure` replays the ops on the upload — rows, cells, formulas everywhere (shared groups unshared), merges, spans, filter, the existing rule blocks (own function, so W-57 composes), hyperlinks, view, tables, drawings, notes + VML, threads, charts, names; SP-2016 refusals. **Plugins:** `DeriveInput` `restructure` (formulas rebuild); charts, validation, comments verified. **UI:** cell, ⋯ and header menus, Ctrl/⌘+Shift+= and Ctrl/⌘+−, refusals greyed with their reason; sizes, reveals, highlights follow. Two fast-check properties: insert-then-delete is byte-stable on every part; memory ≡ download over random op sequences. Records SR-EXPORT 11, SR-IMPORT 11, SR-GRID 21d (+3, 6, 7, 17), SR-FORMULAS, SR-CHARTS, SR-CODES, SR-VALIDATION, SR-COMMENTS, SR-SKILLS, SR-MCP; skills, README, CHANGELOG; DoD 6 → W-30 DoD 8.
- **Decided / left open:** a delete that cuts a merge is refused, as the item says — Excel itself shrinks a merge on a whole-row delete, so the decider may relax it. Inserted columns take the default width (Excel copies the left neighbour's format). Pivots are never rewritten: any op that would move one or its source is refused. Tables: rows inserted inside grow it, columns inserted inside are refused (new `tableColumn` names). The selection keeps its address after a menu or key op, as in Excel; the store API moves it with its cells. Refusing an Excel-saved table only works in memory once W-61 lands — until then the download refuses (SP-2016).
- **Mistakes:** the first in-memory shift left trailing empty cells and rows a fresh read does not have — the memory ≡ download property found both; four menu tests listed exact items and now filter W-52's.
- **Next:** the orchestrator merges lane c — wire W-61's tables into `shiftTables`, compose W-57's options after `restructureRuleBlocks`, renumber SP-2015 / SP-3017–3020 if taken.

---

## 2026-10-19 — W-66 open at a cell: `ref`, `link="hash"`, Copy link (closed)  ·  Claude Code (claude-opus-5-5)

- **Asked:** *build W-66 in lane c (a worktree beside other lanes), close it, commit, do not push.*
- **Done:** `ref` attribute and property — the pane's selection once a file is read, scrolled into view; set later, selects then; one naming no cell warns SP-3019 (new, `docs/ERRORS.md`, lock) and opens at A1. `link="hash"` (default `none`) — one fragment parameter, `sheetpane=<pane>:<Sheet>!<ref>`, the host's router path and parameters kept byte for byte (`excel/link.ts`, pure); written with `replaceState` 300 ms after the selection settles (no entry, no `hashchange`, `history.state` kept); read on load (wins over `ref`) and on `hashchange` / `popstate`; off removes it. *Copy link* after *Copy ref* in the cell and ⋯ menus when on. Fixed on the way: the status line now renders before the grid — its first content after a load shrank the scroller after a scroll-to-selection, so `ref` (and a host's `select()` right after load) landed 18 px under the edge. React, Vue and Solid typings `Omit` `ref` (the framework's own); `build-manifest.mjs` does it. `link.test.ts` 12 ✓, `link.node.test.ts` 6 ✓; SR-GRID 9, 11d, 13, the manifest note, Codes, Consequences; SR-CODES; SR-SKILLS; `sheetpane-embed`; grid README; CHANGELOG; item archived.
- **Decided / left open:** the name `ref` is the decider's, kept — but React (pdfsuite's framework), Vue and Solid treat `ref` as their own, so there it is set with `setAttribute` or replaced by `link` / `select()`; a JSX-safe alias is the decider's call. The fragment is replaced, not pushed: back and forward step between links followed, not cells clicked. L11: the fragment is never sent (stated in SR-GRID 11d; L11's record is on main, not this lane).
- **Mistakes:** the first link grammar split the pane at the first `:` — a range's own `:` (`Sheet1!B4:D8`) broke it; the pane now ends at the `:` before the last `!`.
- **Next:** the orchestrator merges lane c (SP-3019 may need renumbering against other lanes).

---

## 2026-10-19 — W-56 hover and highlight (closed)  ·  Claude Code (claude-opus-5-5)

- **Asked:** *build W-56 in lane c (a worktree beside other lanes), close it, commit, do not push.*
- **Done:** `sheetpane-hover {sheet, ref, column}` / `null` — mouse and pen only, one `requestAnimationFrame` per frame, only on a new cell (a merge's top-left, frozen panes, re-read on scroll); `highlight(ranges, { tone, label, sheet, pinned, reveal })` → count, `clearHighlight()` — boxes 2 px outside the cells in the overlay, `pointer-events: none`, `info` · `pass` · `fail`, not a change, cleared on a sheet switch unless pinned and by a new file, `reveal` scrolls it in and shows a hidden row or column under it; the status line (a live region) now rewrites its nodes only when its text changes, so the label is said once. Manifest reads a `null` payload; typings, README, two skills, plugin copy, llms regenerated. `highlight.test.ts` 12 ✓; the hazard run — 250,000 rows, 4 moves a frame while scrolling, the host highlighting each hovered cell: 301 frames, 300 events, worst 16.8 ms, none dropped (load ≈ 115 from the parallel lanes). SR-GRID 9, 11c, Consequences; SR-SKILLS Consequences; CHANGELOG; item archived.
- **Decided / left open:** a bad ref or a missing sheet is skipped, not thrown (no new SP code; `highlight()` returns the count drawn); the highlight is per element, like zoom. Not done: hearing the label with a real screen reader.
- **Mistakes:** the first `reveal` scroll put the cell flush with the edge, hiding the outline's 2 px — the scroll now keeps 4 px.
- **Next:** the orchestrator merges lane c.

---

## 2026-10-19 — the HTML and React demos redesigned; demo-check 51/51  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *"improve the ui for example html and react it will be used for demo purpose and for test. recreate them if that will be faster"*
- **Done:** `examples/html/index.html` rewritten; `examples/react/src/App.tsx` and `PluginGallery.tsx` rewritten, with `src/demo.css` (the same stylesheet the HTML inlines), `index.html`, and a `*.css` declaration in `vite-env.d.ts`.
  - **The look:** Proof tokens, light and dark. A host bar (Views segmented; Open file…, the CSV sample, the pop-up, Font, a new **Theme** select that sets `theme` on every component). A *Demo* tab row with separators. A blurb showing the `plugins="…"` attribute. Components that fill the window. A footer of host events.
  - **Kept for the tests:** every name and hook the tests use: the tablist "Plugin gallery" and its tab names, `[role=tabpanel][data-tab]`, the page-font select, the two buttons, one `input[type=file]`, the pop-up as the second `sheetpane-excel`, `review-strip`, `last-change`, and the "Check columns" label. `<span class="logo">Your app</span>` stays for `build-site.mjs`.
  - **Verified:** `scripts/demo-check.mjs` was run in the cloud container against the HTML demo and a Vite build of the React one: 51 of 51 pass, no page errors. The React app typechecks (tsgo). The grid's toolbar shed order was changed so the file-meta chip (which demo-check reads) is dropped last.
- **Decided / left open:** read in: default theme Light (it was the only one); no web fonts, since the demos must run offline in CI. At 1440 px the React host bar wraps its tools to a second line.
- **Mistakes:** none.
- **Next:** run `just demo-check` and `just test-pkg grid` on the Mac, then commit.

---

## 2026-10-19 — the demo checked against the design; seven fixes in `@sheetpane/grid`  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *"Open the URL in the browser and check whatever is as per the design… Whatever isn't, fix it in this session itself. No work item, fix it right away."*
- **Done:** opened the plain-HTML demo (127.0.0.1:5173) in Chrome. Review, All plugins and Hide and show were compared with the Sheetpane, Selection-And-Download and All-Plugins boards. Seven fixes in `packages/grid/src/excel/{element,styles}.ts` and `shared/dom.ts`:
  - the toolbar is one row that sheds as it narrows, where it used to wrap Download to a second line;
  - the Download ▾ menu no longer opens clipped off the left edge;
  - ▾ is drawn as a chevron;
  - the format row is one row with More ▾ (W-14), where it used to wrap;
  - the docked plugin buttons fold when they would squeeze the value field (Hide and show had crushed it to 60 px), and greyed or header- and tab-only menu actions stay out of the bar;
  - a stray blue frame beside the grid is gone: the focus ring now shows for the keyboard only, drawn over the cells;
  - menu separators after Flag issue and before plugin items.
  Typecheck clean (tsgo 7.0.2, linux), dist rebuilt, each fix re-checked in the browser. SR-GRID decisions 10 and 13 and the CHANGELOG are updated.
- **Decided / left open:** the shed order (changes label → find width → counts → file meta → wrap only below 860 px; the meta stays longest because demo-check reads it) is read in. `just test-pkg grid` was not run here: the VM has no Playwright browser, so it is still to run on the Mac.
- **Mistakes:** none.
- **Next:** run `just test-pkg grid` on the Mac and commit.

---

## 2026-10-19 — W-50's look (quiet, optional results), canvas v51 synced; an open-work prototype  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *"what will be the best design — shouldn't be very overwhelming and should be optional — then sync the designs and update the work item on how it should look"*; then *"review the open work file and create a html prototype to test out the look and feel"*.
- **Done:** a new board, `Results-Pass-NotChecked` (canvas v51), with three levels: `results="off"`, `summary` (the default: one line of counts, nothing on the sheet) and `marks`. It also shows the On-sheet switch, passes grouped by check and not-checked grouped by reason, and the 9 px ✓ / — in a cell's bottom-left corner. Synced into `boards/` (the board and `canvas.json`; hashes match). W-50 has a *How it looks* section, and DoD 2 and 4 are rewritten. Reviewed OPEN-WORK and built `work/reference/design/prototypes/open-work-lab.html`, also published as a private artifact. It is one host page with W-50–W-53, W-55, W-56, W-60–W-66, W-68 and W-69 working, each switchable on and off, in light and dark.
- **Decided / left open:** read in, in W-50: results never fill or pin a cell, a problem always wins, results stay out of every action count and out of the download, and the level is pane-wide. Prototype only: W-54, W-57, W-58, W-59 and W-67 have no screen of their own, so they are not in it.
- **Mistakes:** none.
- **Next:** Arpit tries the prototype; then W-50 in Claude Code.

---

## 2026-10-19 — CI green on three OSes; publishing via GitHub Release over OIDC; v0.1.0 and v0.2.0 released, npm refuses until trusted  ·  Claude Code (claude-opus-5-5)

- **Asked:** *"commit everything. push everything publish zero point one point zero … Create CI/CD pipeline … And publish the packages"*; then *"publish 0.2.0 through pipeline"*, a fux-modelled publishing spec (GitHub Release → `publish.yml`, OIDC, parity, three-OS matrix, `RELEASING.md`), *"merge everything to main … delete all the merged branches"*, *"Always follow the conventional commit message pattern and always have a proper release note"*, *"add a release item for 0.1.0"*.
- **Done:** CI had been red on every push since W-36. Fixed: `just check` builds before it type-checks; wall-clock budgets asserted locally, reported in CI (SR-BUILD 6); Windows: `fileURLToPath` in the build scripts and CRLF-safe `ERRORS.md` in `@sheetpane/mcp`. `ci.yml`: push/PR/dispatch, `portable` ubuntu/macos/windows × Node 22/LTS with `smoke-built.mjs` (the packed tarballs imported from plain Node) — green on all 13 jobs. `publish.yml` replaces `release.yml`: CI gate, `check-version-parity.mjs` (178 sites), tag = version, one build, tarball checks, `npm publish --provenance` over OIDC. `release-notes.mjs` and `just publish`; `just release` commits `chore(release): …`. Engines `>=22` (SR-LAW-8, SR-EXPORT say Node 22+). `RELEASING.md`. Committed Cowork's L10, README, LICENSE, W-50 – W-69 and `create-sheetpane`-internal work. Versions `0.2.0`; CHANGELOG sections 0.2.0 and 0.1.0; GitHub Releases `v0.1.0` (tag only, never on npm, not latest) and `v0.2.0` (latest). The only branch besides `main` (`npm-publishing`) merged and deleted.
- **Decided / left open:** the publish run for `v0.2.0` (run 39168217324) passed the gate, parity, tag, build and all 17 tarball checks; npm refused the first package `E404 … PUT create-sheetpane` — no trusted publisher, because no package exists on npm yet. **Open for the decider (W-44):** `RELEASING.md` §One time — the first publish by hand (the account's 2FA is *auth-and-writes*; the decider declined to type a code here) or 2FA switched to *auth-only*, then a trusted publisher per package; then *Re-run failed jobs* on run 39168217324 publishes 0.2.0. `create-sheetpane` is still published (the decider's open question).
- **Mistakes:** `npm publish tarballs/x.tgz` without `./` read as GitHub owner/repo (EALLOWGIT) — fixed in `230f213` and `v0.2.0` re-cut there (nothing had reached npm). The `release v0.2.0` commit predates the conventional-commit rule; left as pushed. The first watcher used a short SHA `gh` could not match.
- **Next:** the decider's one-time npm steps; then re-run the publish job and check npm, the playground and the starters; bump the actions to their Node-24 majors (GitHub's deprecation notice on `checkout@v4`, `setup-node@v4`, `*-artifact@v4`).

---

## 2026-10-19 — `create-sheetpane` is internal: removed from every public doc  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *"npm create sheetpane@latest — Do not market this. This is just for internal purposes. Internal testing purposes. Remove it from readme wherever this is mentioned … Remove it from Markdown wherever this is mentioned."*
- **Done:** removed from `README.md` (Get started, packages table), `packages/grid/README.md`, `CHANGELOG.md` (the W-43 entry), the setup skill (`packages/skills` and the plugin copy), the starters index (generator `scripts/build-starters.mjs` and its output), `llms.txt`/`llms-full.txt` (`create-sheetpane` and SR-CREATE dropped from `scripts/build-llms.mjs`). `packages/create-sheetpane/README.md` now opens with an *Internal* note. The ruling filed as **SR-CREATE decision 6**. Registry rows bumped. Checked: `llms`, `starters`, `packages`, `create`, `skills` tests — 223 passed. **Not committed.**
- **Decided / left open:** records, `work/` history and `archive/` keep their mentions (internal; worklog append-only; archive is never edited). **Open for the decider:** `create-sheetpane` is still *published* to npm by `release.yml` — an internal tool would normally not be; say whether to stop publishing it.
- **Mistakes:** none.
- **Next:** the decider rules on publishing `create-sheetpane`; then commit.

---

## 2026-10-19 — correction to the W-50 – W-69 entry  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** (same session as the entry below)
- **Done:** the scratch file `work/open/_rows.tmp.md` was deleted with the decider's permission; the filing was committed as `3f04197` by the concurrent session, so the entry's *"Not committed"* no longer holds.
- **Decided / left open:** none.
- **Mistakes:** the entry below was written before the concurrent commit; corrected here, not edited (append-only).
- **Next:** the decider reviews W-50 – W-69.

---

## 2026-10-19 — twenty items filed from pdfsuite's spec needs: W-50 – W-69, classified plugin vs existing package  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *"look at PDF suite and think about what all features could be needed just from Excel point of view that can be added into sheet pane … consider it built and consider it published. What else?"*; then *"do some research. What can be created as plugin? What should be part of existing packages? Classify it into those and create work items for all of these. Group 1, Group 2, and Group 3."*
- **Done:** read pdfsuite's SR-SPEC-INTAKE, W-46, W-47 and its Spec/Sheet-Editor boards against sheetpane's code and plugin contract; filed W-50 – W-69 (files in `work/open/`, rows under *build*). Group 1 — the host's review flow: W-50 pass/not-checked, W-51 layers, W-52 insert/delete rows and columns, W-53 rich-text runs, W-54 checks in Node, W-55 sheet/workbook errors, W-56 hover + highlight. Group 2 — writing the files: W-57 export writes validation + conditional formats, W-58 rules file as Excel dropdowns, W-59 `@sheetpane/review` (new plugin), W-60 dependent dropdowns, W-61 Excel Tables + `@sheetpane/tables` (new plugin), W-62 locked cells and protection. Group 3 — over time: W-63 `@sheetpane/compare` (new plugin), W-64 edits view, W-65 SHA-256, W-66 link to a cell, W-67 static HTML, W-68 error detail slot, W-69 accepted deviations. Hidden rows/columns (the earlier list's item 4) dropped: W-49 built it.
- **Decided / left open:** classification — three new plugins (review, tables, compare); everything else extends existing packages (grid core, import, export, validation, styles). W-52 adds no seventh hook (the core shifts the imported tables; `derive` gains `restructure`); W-64 is a view inside `<sheetpane-errors>` so L7 is untouched. Not committed: a concurrent session has uncommitted release edits in `work/NOW.md`, `work/WORKLOG.md` and twenty other files.
- **Mistakes:** a scratch file `work/open/_rows.tmp.md` was written into the repo and cannot be deleted without the decider's permission — delete it (untracked).
- **Next:** the decider reviews W-50 – W-69 and commits them with explicit pathspecs; W-50, W-51, W-54 and W-57 first (others wait on them).

---

## 2026-10-19 — README as the landing page: real screenshot, GIF, logo  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *"Research the best README documents and then create sheet pane's README document. Right now, whatever we have doesn't look good for marketing."*
- **Done:** studied Zod, Excalidraw, Glide Data Grid, awesome-readme, Art of README. `README.md` rewritten: centred logo (light/dark), one-line pitch, badges, links row, a **real** screenshot (light/dark) and demo GIF, the three-line integration, why-table, rules-file snippet, frameworks, plugins, "deliberately does not do", the honest gaps kept (collapsed), packages, contributing. New `docs/readme/`: `logo-{light,dark}.svg`, `screenshot-{light,dark}.png`, `demo.gif`, `holdings.rules.json` (the exact file the screenshot shows), `capture.mjs` (regenerates them from `examples/html`). Registry rows for `README.md` and `docs/readme/`; `llms*.txt` rebuilt. **Not committed.**
- **Decided / left open:** no npm badge until `0.1.0` is on npm (it would read "not found") — add it then. The error numbers in the capture start at 5, not 1 (the rules phase numbers them so) — left as captured.
- **Mistakes:** none landed; a scratch tarball (`.readme-tmp/`) used for the captures was removed before the session ended.
- **Next:** the decider reviews the README on GitHub (light and dark), then commits.

---

## 2026-10-19 — honest README, LICENSE, Pages on, About set; npm goes token-free  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *"Create an honest, humble README … create environments … go to npm … make sure everything is ready to be published … update the about section"*; then *"honest, humble, and strong"*; on the npm token: *"I don't believe you need an NPM token … authorize it … publish it once and then it can go through"*.
- **Done:** README rewritten (status first, tested vs not-yet-proven, what it does not do); MIT `LICENSE` at the root and in every package (there was none); `llms*.txt` rebuilt — all three committed by the concurrent Claude Code session in `ad6a305`. GitHub (browser): Pages source → *GitHub Actions*, which created the `github-pages` environment; About description set.
- **Decided / left open:** **the decider's ruling — no `NPM_TOKEN`**: publish once by hand, then npm trusted publishing (OIDC) from `release.yml`. Trusted publishing is configured per package on npmjs.com and needs the package to exist (npm docs). Left open: topics + website and the `npm` environment (GitHub's settings form refused the browser's saves, 422).
- **Mistakes:** none landed; first saw CI red on every push since run #21 (clean-clone typecheck before build) — the concurrent session fixed it in `4049642` while this one diagnosed it; CI still red on `4049642`.
- **Next:** the decider publishes 0.1.0 once from a terminal; then an agent adds a trusted publisher to each of the 17 packages and switches `release.yml` to OIDC.

---

## 2026-10-19 — the consumer-tooling and grid run: W-36–W-43, W-45–W-47, W-49 closed; two more gates  ·  Claude Code (claude-opus-5-5)

- **Asked:** *"implement all work items as fast as possible make sure everything is implemented correctly and close all the work items one by one implement everything keep committing keep pushing"*; then *"continue"* (twice).
- **Done:** closed and pushed W-36 TSDoc + check (`04f9e36`), W-37 manifest, editor data, framework typings (`9b28465`), W-39 `@sheetpane/mcp` (`8d2a344`, `9b28465`; `@sheetpane/import` reads `.xlsx` in Node, SP-1008 retired), W-43 `create-sheetpane` (`7c9eada`), W-45 commands, hooks, Claude plugin (`d0a29b3`), W-46 range selection (`b0f7291`), W-47 resizing (`0010151`), W-49 hide and show + `@sheetpane/visibility` (`d7e2704`); W-44's starters and links built (`a24c135`), waiting on the decider. Agents built W-36 (three), W-37, W-43, W-45 and W-49's file layer; each verified here before closing. Cowork's W-46/W-47 filing and its W-35 close / W-48 filing committed as written (`0bbedc5`, `0010151`).
- **Decided / left open:** read in — sizes (W-47) and reveal / expand (W-49) are view settings, never changes; markers live outside the grid's rows (axe); MCP is hand-written, tools only (compare doc); the file layer's `outline` maps are complete sets. Left for the decider: W-44 (enable Pages, first release), W-30, W-48; Cowork's law L10 and B-035 are uncommitted for Arpit's review. Not done: opening downloads in Excel / LibreOffice (W-30's lane), the plugin eval (W-48).
- **Mistakes:** a script truncated CHANGELOG.md in `b0f7291` (restored in `7c9eada`); a helper emptied `work/IMPLEMENTATION.md` in the working tree — rebuilt from HEAD, **Cowork's uncommitted L10 row rebuilt from the 180 characters last seen: Cowork, please confirm its wording**; `git add -A <dir>` swept an agent's new files (caught by the guard); `git mv` left W-45's ticks out (added in `d7e2704`); `llms-full.txt` built before two records were staged (`772afa8`). Gates: the worklog-fence test (`0bbedc5`) and the shrink guard (`d0a29b3`), each in the change that recorded its second strike.
- **Next:** the decider — W-44 (Pages + the first release), W-30, W-48, and reviewing L10; no agent item is open.

---

## 2026-10-18 — law L10 filed (the examples are maintained with every package change)  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *"Create a law that examples are always supposed to be maintained whenever there is a change in any of the packages."*
- **Done:** SR-LAW-10 (`records/0012`); SR-LAWS routing (its veto grep now covers L10 and the whole law range); register row and range line; `CLAUDE.md` §The laws gained the L10 pointer line (SR-WORK-DOCS decision 7a — named here); SR-BUILD names L10; backlog B-035 (`ungated`); glossary "example"; ARCHITECTURE laws table (and its broken L8 row fixed); the L0–L10 count in `docs/architecture.svg` and the four `sheetpane-records` skill copies; `llms.txt` / `llms-full.txt` rebuilt; INTERVIEW, IMPLEMENTATION, NOW, registry. Not committed — another session's W-45 work (`packages/skills/bin/sheetpane-skills.mjs`, `work/OPEN-WORK.md`) and the W-49 item file are uncommitted in the same tree; commit with explicit pathspecs.
- **Decided / left open:** the decider ruled L10. Read in, open to override: "examples" = all of `examples/` (HTML demo, React demo and recipes, starters); "maintained" = working **and** current, in the same change; an example is never deleted or skipped to let a package change pass (removal takes a ruling); the law does not require a new example per feature (SR-BUILD 11/11a decide that). Left open: B-035, a commit-msg gate for "current".
- **Mistakes:** none.
- **Next:** the decider reviews and commits; rules on B-035.

---

## 2026-10-18 — hide and show researched; W-49 filed (core honours the file's hiding, `@sheetpane/visibility` edits it)  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *"research and create a plugin for hidden sheets, hidden rows, and anything else … related to hide and show of sheets and columns. How it is going to work, how it is going to look, how to hide, how to unhide … Create one work item … Research and then file."*
- **Done:** read the import (hiddenRows/hiddenCols read, veryHidden folded into hidden, outline and autoFilter not read), the grid (hidden sheets as italic tabs, nothing else honoured), `patchXlsx` (no hidden option) and the plugins verdict; researched Excel, Google Sheets and ECMA-376. Filed W-49 🟢 with the look, the hide/unhide gestures, shortcuts, outline groups, export and 15 DoD rows.
- **Decided / left open:** read in, in the item: seeing the file's hiding is core (like merges/freeze — no seventh hook), editing it is the plugin with one optional `menus` field on `selbar` controls; hide/unhide is a change (one per sheet per axis), revealing never is; copy, Delete and totals skip hidden cells, find and validation do not; collapse/expand is a view setting; Ctrl+Alt+9/0 (Sheets) because Ctrl+9/0 belong to the browser.
- **Mistakes:** none.
- **Next:** W-49 in Claude Code.

---

## 2026-10-18 — W-35 closed without the tool trial; W-48 filed; W-45 unblocked  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *"The testing of skills create a separate work item for it. I'll do it later on. Do not block work item 35 for it."*
- **Done:** W-35 DoD 8 → new W-48 (`arpit`, testing lane); the inbox row removed (inbox empty); W-35 closed and archived (map row → SR-SKILLS); W-45 re-balled 🟢 (it needs the shipped skills and installer, not the trial). Not committed.
- **Decided / left open:** Arpit: W-35 ships without the in-tool trial. Earlier review's other recommendations (B-030 narrow the veto, B-032 status line stands, B-026 as an agent item) still await his word.
- **Mistakes:** none.
- **Next:** W-44, W-45, W-47 for agents; W-30 and W-48 are Arpit's.

---

## 2026-10-18 — smoother range selection and column/row resizing: researched, W-46 and W-47 filed  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *"Can there be a smoother selection of multiple cells? File a work item for this. Can we increase the height and width of columns and rows? File a work item for this. Research and then file it with the best user experience."*
- **Done:** read the grid's selection and geometry code and SR-GRID; researched Excel, Google Sheets, the APG grid pattern, Glide Data Grid, AG Grid, MUI X and MESCIUS. Filed W-46 (selection: one layer, no redraw per pointer move, autoscroll, headers, keys, range copy/Delete, totals) 🟢 and W-47 (resize: drag, fit, several, header menu, per-row heights, `sizes` + `sheetpane-resize`) 🟡 waiting on W-46. Registry row bumped.
- **Decided / left open:** read in, each in its item: sizes are a view setting in both modes (not a change, not exported, not undone; reopen if sizes are wanted in the download); Arpit's ask supersedes grid-rendering decision 1 (fixed row height) — the 16 ms budget stays the test; the keyboard route for resizing is a header menu; several separate ranges, a fill handle and hidden rows/columns are out of scope.
- **Mistakes:** none.
- **Next:** W-46 in Claude Code, then W-47.

---

## 2026-10-18 — every agent item built and closed (W-15–W-29, W-31, W-32, W-34); a commit gate after two strikes  ·  Claude Code (claude-opus-5-5)

- **Asked:** *"implement all work items as fast as possible make sure everything is implemented correctly and close all the work items one by one implement everything keep committing keep pushing"*; then *"continue"*.
- **Done:** closed with records — W-03, W-04, W-10, W-13, W-01, W-02, W-14, W-23, W-24 (earlier in the session); W-09, W-26, W-20, W-18 (SR-VALIDATION), W-15 (SR-NUMFMT), W-17 (SR-STYLES, `a5b6df5`), W-29 (dark theme), W-16 (SR-FORMULAS) and W-22 (SR-COMMENTS, `912745c`), W-21 (SR-CHARTS, `a00bdc7`), W-27 (column rules, `e82b1bc`), W-28 (React hook recipes, `ec878ff`), W-19 (SR-CONDFMT, `33baabd`), W-31 (docked actions, one Download, `f09b1fa`), W-32 (plugin gallery, `066b2f2`), W-34 (Download split button, `af152c5`). Plugins W-15–W-22 were built by subagents; their core gaps were fixed in the grid (per-kind change slots, derive `clear`, overlay role/name/pass-through, geometry past the drawn columns, restore adoption by content, `shiftFormula` re-exported, `evaluate()` for custom rules and CF expressions). Records 0110–0114 written; `CHANGELOG.md` created; `docs/ARCHITECTURE.md`, the grid README, the registry kept current. Full suite 590+ tests; `demo-check` 47 ✓; `demo-packed` 47 ✓ from tarballs. `CLAUDE.md`: its layout line changed in W-10 (earlier in the session); nothing since.
- **Decided / left open:** read in — W-29 contrast pairs follow what the CSS draws (`ink-3` never sits on `sunken`); W-27's block only for a JSON rule or a synchronous result; W-34's `Plugin.exportOptions` as a new optional plugin field (not a hook or slot); a file formula back at its saved value clears its derived entry. Deviations recorded in each item: Excel-saved fixtures and opening our output in Excel/LibreOffice moved to W-30; schema validation backlog B-033; plugin-contract gaps backlog B-034.
- **Mistakes:** `git add -A` swept the Cowork session's items into `206c093` (lesson). **Twice** a failed `git add` let a commit run with only an item file's move (`aae714d`, then `42a3769` through a pipe) — content followed in `a5b6df5` and `af152c5`. Second strike → **gate** (SR-WORK-SESSION decision 13): `scripts/rename-only-guard.sh`, run first by the commit-msg hook, refuses a rename-only commit unless the message says `rename only`.
- **Next:** W-33 (rules file) and W-35 (agent skills package) in Claude Code; W-30 when Arpit has the files.

---

## 2026-10-18 — Download as a neutral split button: canvas redrawn, synced, W-34 filed  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *Download shouldn't be blue — match the theme; default to the uploaded format; a ▾ beside it offering .xlsx or .csv. Add it to the mockups, download them, create a work item.*
- **Done:** canvas v50: `Sheetpane` (interactive: click ▾), `PluginKit`, `Selection-And-Download`, `Plugin-Decisions`, `sp-plugins.css`, `canvas.json`. Synced into `work/reference/design/boards/` (hashes match v50). W-34 filed (🟢).
- **Decided / left open:** read in: CSV from an .xlsx is the current sheet; the upload's format is marked *default* in the menu; plugin export options sit under a separator in the same menu.
- **Mistakes:** none.
- **Next:** W-34 in Claude Code.

---

## 2026-10-18 — consumer tooling beyond skills: W-36 to W-45 filed, W-35 widened  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *"Other than codemods. File work item for everything else. Research and then file work items."*
- **Done:** researched each format (Custom Elements Manifest and its generators, llms.txt, MCP 2026-07-28, Kiro hooks, Claude Code plugins, Codex prompts → skills). Filed W-36 TSDoc · W-37 manifest, editor data, framework types · W-38 llms.txt · W-39 `@sheetpane/mcp` (🟡 waiting on W-37) · W-40 error codes · W-41 `@sheetpane/testing` · W-42 `@sheetpane/fixtures` · W-43 `create-sheetpane` · W-44 live playground · W-45 commands, hooks, Claude plugin (🟡 waiting on W-35). W-35 gains skills 17–23 (router, frameworks, backend, performance, security, a11y, migrate); descriptions ≤ 250 chars. Not committed.
- **Decided / left open:** codemods out (Arpit). Read in: MCP server hand-written, no SDK (a compare doc owed); error-code registry in `@sheetpane/export`; new records SR-MCP, SR-CODES, SR-TESTING, SR-FIXTURES, SR-CREATE numbered at build.
- **Mistakes:** the first generator script was too long for one shell call (E2BIG); split into parts.
- **Next:** W-33, then W-35–W-45 in Claude Code, per their balls.

---

## 2026-10-18 — agent skills package: W-35 filed  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *"Research and create a work item for all the skills … part of a new package … grid, export, import, all of them are going to use this package as a dependency."*
- **Done:** researched how Claude Code, Kiro and Codex find skills (vendor docs, 2026-10-18); W-35 filed (🟢): `@sheetpane/skills`, 16 skills (14 for hosts, 2 for contributors), entry files per tool, `sheetpane-skills install`, a drift check, new record SR-SKILLS. Not committed.
- **Decided / left open:** Arpit: the whole agent-facing set, not skills alone; contributor skills ship in the package. Read in: common frontmatter subset only; no `postinstall`; grid forwards the bin; skill 9 after W-33.
- **Mistakes:** none.
- **Next:** W-32 (in progress), then W-33, W-34, W-35 in Claude Code.

---

## 2026-10-18 — predefined errors from a rules file: W-33 filed  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *"some kind of file which says … this is a valid value and this is invalid value … it shows up on right-hand side section … I don't want any flag issues or to pop up … controlled through a prop … which would be the best file, YAML, TOML, or JSON?"*
- **Done:** W-33 filed (🟢; W-31 landed during filing, `f09b1fa`): a versioned JSON rules document (per sheet, `*`, column titles, cells and ranges; `equals`, `noneOf`, `note` added to SR-GRID 22a's words) with a shipped JSON Schema, linked by `rules` / `rules-src`, compiled into W-27's `host-rules` engine; `flagging="off"` removes Flag issue, the composer and the callout card; a Rules file tab added to W-32's gallery. Not committed.
- **Decided / left open:** read in: JSON (no runtime dependency, exact types, schema autocomplete); YAML/TOML stay host-side. Prop names `rules`, `rules-src`, `flagging` are the filer's — rename before building if wanted. `rules-src` follows B-030.
- **Mistakes:** none.
- **Next:** W-32, then W-33, in Claude Code.

---

## 2026-10-18 — plugin gallery for the demos: W-32 filed  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *"For demo items, I want HTML and React to have multiple tabs with vanilla grid, with different different plugins … and with all plugins … File a work item for this."*
- **Done:** W-32 filed (🟢, `agent`, build lane): ten tabs in both demos (Vanilla · numfmt · styles · formulas · validation · condfmt · images · charts · comments · All plugins), one generated showcase workbook, per-tab `demo-check` assertions; SR-BUILD decision 11 to be amended. Not committed.
- **Decided / left open:** read in: each tab its own `pane`; peers (styles for condfmt, images for charts) load with their tab and are labelled; the existing review demo stays; build after W-31 (both touch `demo-check`).
- **Mistakes:** none.
- **Next:** W-31, then W-32, in Claude Code.

---

## 2026-10-18 — selection bar docked, one Download button: canvas redrawn, W-31 filed  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *"whenever we click on a cell, there is always this bar … it hides the text behind it. Is there an other way to display it? Then there are two ways to download … It should only be one."*
- **Done:** design canvas: the floating selection bar replaced by actions docked at the right of the cell bar (Flag issue · plugin buttons · ⋯ Copy ref / Copy value) plus a right-click menu; Export and Download-the-original merged into one **Download .xlsx** (both modes; original when unchanged, a change count otherwise). Interactive `Sheetpane` board, `PluginKit` and five plugin boards updated; new board `Selection-And-Download` (before/after). Snapshot refreshed in `work/reference/design/boards/`. W-31 filed (🟢) for the grid, SR-GRID decisions 10 and 13. Not committed.
- **Decided / left open:** read in: the `selbar` slot keeps its id and moves into the cell bar; the download button is labelled Download, not Export.
- **Mistakes:** none.
- **Next:** W-31 in Claude Code.

---

## 2026-10-18 — W-09 closed; iPhone download check to backlog B-031  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *for W-09, put the iPhone download check in the backlog; not testing it now.*
- **Done:** B-031 (`unmeasured`) filed; W-09 DoD 10 → B-031, W-09 closed and archived (map row → SR-BUILD decision 11); its inbox row and queue row removed; SR-DOWNLOAD Consequences point at B-031; W-28's links to the demo now name `examples/react/`. The inbox is empty. INTERVIEW, registry. Not committed.
- **Decided / left open:** Arpit's ruling as above. SR-DOWNLOAD's 30-second revoke margin stays until B-031 is measured.
- **Mistakes:** none.
- **Next:** W-22, W-26, W-29 in Claude Code; W-30 whenever Arpit has the files.

---

## 2026-10-18 — W-29 and W-22 ruled  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *accept the dark colour values (W-29); explain W-22 more; then: W-22 and W-29, go with the recommendation.*
- **Done:** W-29 DoD 1 ✅ (dark values as drawn in `sp-plugins.css` `.spx-dark`; `theme` defaults to `light`); W-22 step 4 ✅ and DoD 3a added (`comments({ write })` default on, `export({ comments: false })`, no Export-menu line); both inbox rows removed; W-22 and W-29 re-balled 🟢 (W-01, W-02, W-03, W-13, W-14 had closed under parallel sessions). INTERVIEW §2, registry. Not committed.
- **Decided / left open:** Arpit's rulings as above. No extension point beyond the six slots, so the plugins verdict stands. The only inbox row left is W-09's iPhone check.
- **Mistakes:** "except" read as "accept" (voice input). The next message confirmed it.
- **Next:** W-09's iPhone check (Arpit); W-22, W-26, W-29 in Claude Code.

---

## 2026-10-18 — blockers ruled: W-03, W-12, W-13 closed; W-25 decided and closed; W-30 filed  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *present the blockers one by one with a recommendation.* Then: *W-03: all files opened, accents good. W-12: go with the recommendation. W-13: hold; a separate testing item. W-25 a–e: go with the recommendation.*
- **Done:** W-03 DoD 8 ✅, closed → SR-EXPORT Consequences updated. SR-DOWNLOAD `accepted` (register row); W-12's iOS check → W-09 DoD 10; W-12 closed. W-13 DoD 9 → W-30 (`testing`, `arpit`, 🟢), W-13 closed; SR-IMPORT and `FIXTURES.md` point at W-30. `work/compare/grid-events-and-host-rules.compare.md` written with Arpit's five rulings; W-25 closed; W-26–W-28 re-pointed and re-balled (W-26 waits on W-01; W-27 on W-26; W-28 on W-26, W-01). Contract verdict notes the extension; compare index row; archive map rows for W-03, W-12, W-13, W-25; open-item links to the closed items now name their records. Inbox down to the two rulings another session filed (W-29, W-22). Not committed.
- **Decided / left open:** Arpit's rulings as above. Read in (in the verdict, open to override): paste and fill check once per cell; event order beforechange → change map → undo → derive → validate → change; `input` checks after a 150 ms pause; `load` in idle-time chunks; `pattern` skipped on values over 10,000 characters; SR-GRID decision 17's auto-resolve widens to `host` when W-27 lands.
- **Mistakes:** filed the new testing item as W-29, but a parallel session had taken that id minutes earlier. Caught before the queue row was written; renumbered W-30 in all three places. Parallel sessions also closed W-02, W-14 and W-23 mid-turn, which halted one edit script; it was re-run against the live tree.
- **Next:** the two inbox rulings (W-29 dark values, W-22 Export line); W-01 continues in Claude Code.

---

## 2026-10-18 — plugin design boards downloaded, reconciled with W-14–W-24; W-29 filed  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *a design brief for the plugin surfaces (12 boards, a slot map, a list of open decisions) on the Design canvas; then: "download and update the designs and create/update work items".*
- **Done:** the canvas's 25 boards + `canvas.json` + `sp-plugins.css` saved to `work/reference/design/boards/` (the ten older boards unchanged); design README and reference index list the fifteen plugin boards. Boards fixed where they contradicted the item files: Undo/Redo core (W-23), Freeze Edit-only and exported (W-24), "may be stale" on dependents only (W-01 DoD 15), five chart types (W-21), changed mark on `--sp-changed` (tokens.ts). Items updated with design links and deltas: W-01, W-02, W-14 (selbar order, More ▾, mark positions), W-15–W-18, W-19 (gains a `./ui`: hover legend + rule count), W-20 (click-through pictures), W-21–W-24. Filed W-29 (dark theme + slot tokens). Proposal `dismiss-workbook-errors.md` + B-029. Registry, INTERVIEW, NOW. **Not committed.**
- **Decided / left open:** put to Arpit (inbox): the dark values and default (W-29); an on/off Export line for comments, which needs an extension point beyond the six slots (W-22, red for that line only). Read in: plugin selbar buttons follow the core ones; data colours are never re-themed.
- **Mistakes:** the first boards were drawn from the brief before reading the repo, so five of them disagreed with filed items; fixed on the canvas before the download.
- **Next:** W-01 (grid); Arpit's two rulings when convenient.

---

## 2026-10-18 — W-25 (research) and W-26–W-28 filed: editing events, column rules, React hooks  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *list the grid APIs; propose React hooks, events and callbacks for editing and the current cell, and a way to check per column title whether what is typed is correct; then: create work items for everything proposed.*
- **Done:** W-25 (`research`, `cowork`, 🟢) carries the chat's proposal and ten questions; W-26 (events), W-27 (column rules), W-28 (React hooks) filed `build`, 🟡, waiting on W-25 and their build prerequisites. INTERVIEW §2, glossary (column rules), registry. Not committed.
- **Decided / left open:** read in: host rules run as a core provider on W-14's `validate` hook with `author: "host"` (fits the plugins verdict without a seventh hook); no error-schema change needed. Put to Arpit in W-25: auto-resolve for host errors (W-18 sets it for workbook errors), flag vs block, missing or duplicate headers, rules changing after load vs the frozen plugin set, `@sheetpane/react` (overrules "no wrappers in v1") vs recipes.
- **Mistakes:** none. Found mid-session that parallel sessions had filed W-14–W-24 (plugins); the new items were fitted to them rather than duplicating W-18.
- **Next:** W-25 in Cowork.

---

## 2026-10-18 — plugin split decided; eight plugin packages scaffolded; W-14–W-24 filed  ·  Claude (Cowork, claude-fable-5-1)

- **Asked:** *compare sheetpane with the top Excel libraries, components and two creative ones, then with Excel itself; propose separate plugin packages for styles, formulas, number formats; whether plugins can add UI to the grid; then: "Let's create separate packages, plugins for number format, formulas, styles. Merge cells, freeze panes, data validation, conditional formatting, images, charts, pivots, comments, notes. Decide, do some research and have them as separate packages or plugins."*
- **Done:** `work/compare/plugins.compare.md` — the verdict: eight plugin packages (`numfmt`, `formulas`, `styles`, `validation`, `condfmt`, `images`, `charts`, `comments`) on six hooks and six slots; merged cells and freeze panes core; pivots not built. Scaffolded all eight under `packages/` (manifests, READMEs, stubs; `numfmt@4.0.1` and `@ironcalc/wasm@0.9.0` pinned; lockfile resolves). Filed W-14 (plugin host), W-15–W-22 (one per plugin), W-23 (undo — B-027 promoted), W-24 (freeze panes, core); W-01 gains stale marks and the pivot badge, W-03 gains `fullCalcOnLoad` / `refreshOnLoad`, W-13 gains what plugins read. `work/proposals/pivots.md` + B-028. SR-LAW-5 Consequences and the reading verdict's decision 2 carry the "unless a plugin" rulings. ARCHITECTURE, GLOSSARY, Ownership rows, registry, INTERVIEW, IMPLEMENTATION, NOW. **Not committed** — a large staged tree from earlier sessions is also uncommitted.
- **Decided / left open:** read in as Arpit's "decide", open to override: HyperFormula excluded (GPL, L2); IronCalc as a derived cache under L9; `numfmt` behind the `format` hook; cells plain *unless a plugin decorates them*; font weight/size/colour may follow the workbook with `styles`, family never (L5); undo before any formatting control; the core never grows a formatting control; the plugin set fixed per `pane`. Left open: `CLAUDE.md`'s Layout line still names two packages (SR-WORK-DOCS 6–8 — not edited); the architecture SVG (W-13 DoD 10); whether `images` and `charts` merge into one package if the anchor code proves tiny.
- **Mistakes:** `packages/import` was listed in the root workspaces before it existed (W-13 is unstarted) — `npm install` would have failed; removed before the lockfile run.
- **Next:** W-10 in Claude Code; the plugins begin at W-14 once W-01's store exists.

---

## 2026-10-18 — W-13 filed: `@sheetpane/import`, the reader as its own package  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *a work item for a new package that imports Excel or CSV files and gives JS objects, used by the grid package.*
- **Done:** W-13 (`build`, `agent`, 🟡 waiting on W-04, W-03) with its file and queue row. W-01 now waits on W-13 too; its DoD 2 reads only through the new package. The reading verdict's decision 5 is marked overridden. `docs/ARCHITECTURE.md` reader row and package layout updated; INTERVIEW §1–2, registry. Not committed.
- **Decided / left open:** Arpit ruled the reader into its own package (overrides the reading verdict's decision 5; decisions 1–4 and 6 carry over). Read in: the working name `@sheetpane/import` (mirrors export; Arpit may rename); output is export's `Workbook` plus per-cell display `text`, so files round-trip; import depends on `@sheetpane/export` for ZIP, CRC-32 and the type (one implementation). Left open: the name; the SVG diagram still shows two packages (W-13 DoD 10).
- **Mistakes:** none.
- **Next:** W-10 in Claude Code.

---

## 2026-10-18 — blockers resolved: five verdicts, eleven rulings, the architecture  ·  Claude (Cowork, claude-fable-5-1)

- **Asked:** *review all the work items and everything that needs to be built; resolve all the blockers; then create an architectural diagram and one architectural document — the diagram easy to read.*
- **Done:** five compare docs with verdicts and reopen-triggers (`work/compare/`: reading, grid, workbook-and-error contract, export shape, testing); W-05–W-08 and W-11 closed and archived (`archive/open/`, map rows); W-01–W-04 and W-12 rewritten to the verdicts — no row waits on a ruling; W-12's home ruled `@sheetpane/export` (SR-DOWNLOAD decision 1); merged onto the parallel session's rename to `@sheetpane/grid`, pnpm + justfile (W-10) and W-12 without losing either side; ten `unruled` backlog rows (B-010, 011, 013, 014, 016, 018, 019, 021, 022, 024) ruled into SR-LAW-2…8 Consequences and deleted, B-027 (undo/redo) added; SR-LAW-8's veto command now reads `packages/*/package.json`; `docs/ARCHITECTURE.md` + `docs/architecture.svg` (rendered in Chromium and checked). **`CLAUDE.md` changed:** an architecture row in "Where the state of play lives" and `docs/` layout line (SR-WORK-DOCS decision 7a). Not committed.
- **Decided / left open:** every verdict and ruling was drafted by the session under the decider's "resolve all the blockers" and is recorded as his, open to override. Left: B-025 (IndexedDB, his deferred request), B-027 (undo/redo), the `ungated` and `unmeasured` rows; W-03 DoD 8 (he opens the sample in Excel) is a verification, not a blocker.
- **Mistakes:** the first SVG render had marker blobs, a return line through the errors box and clipped footer text — fixed before landing. A parallel session changed twelve files while this one worked (the rename, W-10–W-12); the first write-back would have overwritten them — caught by the mtime guard, re-merged by hand. Lesson filed in `work/LESSONS.md`.
- **Next:** W-10 in Claude Code.
---

## 2026-10-18 — SR-DOWNLOAD written; W-12 re-pointed at it  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *show every example of how download works; then an SR document for download, the work item updated with the same details, and the examples kept in the work item too.*
- **Done:** SR-DOWNLOAD (`records/0101_DOWNLOAD.md`, kind `component`, `proposed`, `ratifies: W-12`, `owns: []`) with the ten examples in §1 and decisions 1–10 in §2. Register row. W-12 rewritten: its DoD cites the record's decisions instead of restating them (L0), and it keeps the examples, with the record winning on any difference. Queue row, INTERVIEW §2, registry. Not committed.
- **Decided / left open:** read in, from the examples: a Blob with no extension takes its `type` if it is xlsx or csv; text saved as `.xlsx` throws; names are capped at 200 characters. Status `proposed` until Arpit accepts (W-12 DoD 9). Left open: the home package (W-08), the revoke delay (W-12 measures it), iOS Safari behaviour.
- **Mistakes:** none.
- **Next:** Arpit reads SR-DOWNLOAD and accepts or amends it; W-10 in Claude Code.

---

## 2026-10-18 — W-12 (downloader) filed; export API walked through  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *show every API `@sheetpane/export` will offer, with examples; then file a work item for a downloader.*
- **Done:** answered from W-03's likely shape (`toXlsx`, `toCsv`), flagging that W-08 can still change it. Filed W-12 (`build`, `agent`, 🟡 waiting on W-08, W-04, W-11) with a file and a queue row; W-08 question 5 now points to W-12; INTERVIEW §2, registry. Not committed.
- **Decided / left open:** read in: the downloader refuses any extension other than `.xlsx` / `.csv` (L3) and never changes the bytes (L6). Left open: which package owns it (W-08 q5); whether the Export button fires a cancellable event first (W-07).
- **Mistakes:** none.
- **Next:** W-10 in Claude Code; W-08 and W-11 in Cowork.

---

## 2026-10-18 — W-10 (pnpm + justfile) and W-11 (testing research) filed  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *use pnpm and set up a justfile — one work item; another work item for testing, filed as research.*
- **Done:** W-10 (`build`, `agent`, 🟢) and W-11 (`research`, `cowork`, 🟢) with files and queue rows. W-04 re-balled 🟡 waiting on W-10, W-11: its npm-workspaces note is marked superseded, DoD 3 takes W-11's verdict, and its prompt uses pnpm/just. INTERVIEW §2, glossary (justfile), registry rows. Not committed.
- **Decided / left open:** Arpit ruled pnpm over npm workspaces, with a justfile. Read in: `package.json` scripts stay the real commands and `just` wraps them, so nothing *needs* just to build (W-10 DoD 3). Left to W-10: `workspace:*` vs `workspace:^`, and how contributors and CI get `just`.
- **Mistakes:** none.
- **Next:** W-10 in Claude Code; W-11 in Cowork.

---

## 2026-10-18 — UI package named `@sheetpane/grid`  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *what to name the viewer/editor package beside `@sheetpane/export`; not plain `sheetpane`. Ruled `@sheetpane/studio`, then changed to `@sheetpane/grid`.*
- **Done:** `packages/sheetpane/` → `packages/grid/`, name `@sheetpane/grid`; root workspaces and `package-lock.json`; `packages/export/README.md`; Ownership rows in `records/README.md`; registry rows; W-01–W-05, W-08, W-09 and the W-09 queue row; INTERVIEW §1; IMPLEMENTATION row. The ruling is written into W-01 until its component record exists (SR-LAW-8 Consequences). Past WORKLOG and IMPLEMENTATION rows left as they were (append-only). Not committed.
- **Decided / left open:** Arpit ruled the name `@sheetpane/grid`; the folder follows the `packages/export` pattern (read in). The `@sheetpane` npm org must exist before either scoped package publishes — part of W-04 DoD 6. Unscoped `sheetpane` is still free on npm; whether to reserve it is open.
- **Mistakes:** none.
- **Next:** W-04 in Claude Code.

---

## 2026-10-18 — monorepo skeleton, W-01–W-09 filed, reference docs downloaded  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *file work items for the Excel component, the error component, and a package that turns a JavaScript object into an Excel or CSV file (a dependency of the Excel component); make the repo a monorepo — one package for export, one for the UI; create the necessary research items; download the documents Claude Code needs into a new folder in `work/`. Then: put all work items in the repo, and file an item to see the component in a React app and in a plain `index.html` app, each taking the package as a dependency.*
- **Done:** npm-workspaces skeleton (`package.json`, `package-lock.json`, `tsconfig.base.json`, `packages/export`, `packages/sheetpane` with stubs and READMEs); W-01–W-04 and W-09 (build) and W-05–W-08 (research) filed with queue rows; Ownership rows for the new code; `work/reference/` — Open XML SpreadsheetML docs, MDN, WAI-ARIA APG, React, TanStack Virtual, W3C CSVW, OWASP, our ZIP notes, the design canvas snapshot; registry rows; glossary terms. **`CLAUDE.md` changed:** `packages/` added to the Layout block (SR-WORK-DOCS decision 7a). Merged onto the uncommitted L2–L9 work in the decider's tree; every item rewritten to the laws — web components with a DOM-only contract (L4), no shipped font (L5), one in-memory workbook (L6, L7, L9), FOSS dependencies (L2), XLSX and CSV only (L3). Fact fixes in SR-LAW-2 and SR-LAW-8 Consequences (`package.json` now exists). Not committed.
- **Decided / left open:** npm workspaces over pnpm (no extra tool — W-04). The PKWARE APPNOTE is gitignored (`_local/`): its licence forbids redistribution. RFC 4180 and ECMA-376 could not be downloaded here — a summary and a pointer stand in. Put to the decider: SR-LAW-8's veto check reads the root `package.json`, which is private in a monorepo (W-04 DoD 6); publishing (W-04 DoD 6); every research verdict; the open backlog rulings the items name.
- **Mistakes:** a duplicate registry row for `records/README.md` was written and merged into the existing one before finishing. The first pass filed a React-props API and IBM Plex tokens; the laws in the decider's tree superseded both and the items were rewritten.
- **Next:** W-04 in Claude Code.

---

## 2026-10-18 — laws L8 and L9 filed  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *a law that the package is consumed as an npm / Node package; a law that "memory" means a JavaScript object for now; a backlog item to connect it to IndexedDB as well ("Button").*
- **Done:** SR-LAW-8 (`records/0010`), SR-LAW-9 (`records/0011`); SR-LAW-6 decision 2 now links L9 for the meaning of memory; SR-LAWS routing; register rows; `CLAUDE.md` §The laws gained the L8 and L9 pointer lines (SR-WORK-DOCS decision 7a — named here); backlog B-023–B-026 (B-025 is the IndexedDB item); glossary "memory"; INTERVIEW, IMPLEMENTATION, NOW, registry. Not committed.
- **Decided / left open:** the decider ruled L8 and L9. Read in: a CDN serving the npm package is the same package; IndexedDB is `unruled` because it needs L6 and L9 rewritten. Left open: SSR safety (B-024); what "Button" meant in the IndexedDB ask (filed as "e.g. behind a button").
- **Mistakes:** none.
- **Next:** the decider reviews and commits the change; confirms B-025's wording.

---

## 2026-10-18 — laws L6 and L7 filed  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *a law that once the workbook is loaded every change is kept in memory and export carries the changes; another that the view, edit and error components are always in sync.*
- **Done:** SR-LAW-6 (`records/0008`), SR-LAW-7 (`records/0009`); SR-LAWS routing; register rows; `CLAUDE.md` §The laws gained the L6 and L7 pointer lines (SR-WORK-DOCS decision 7a — named here); backlog B-017–B-022; glossary "error component"; INTERVIEW, IMPLEMENTATION, NOW, registry. Not committed.
- **Decided / left open:** the decider ruled L6 and L7. Read in: memory is the only store (no server, no browser storage); the original file is never modified; all three components read one in-memory workbook, no private copies; errors are part of what syncs. Left open: reload survival (B-018), export fidelity (B-019), selection/scroll sync (B-021), auto-resolving errors (B-022).
- **Mistakes:** none.
- **Next:** the decider reviews and commits the change; rules the open `unruled` rows.

---

## 2026-10-18 — law L5 filed  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *a law that the default font is whatever the browser has, and the host application can set its own font, which sheetpane and every component inside it use.*
- **Done:** SR-LAW-5 (`records/0007`); SR-LAWS routing; register row; `CLAUDE.md` §The laws gained the L5 pointer line (SR-WORK-DOCS decision 7a — named here); backlog B-015, B-016; INTERVIEW, IMPLEMENTATION, NOW, registry. Not committed.
- **Decided / left open:** the decider ruled L5. Read in: no font ships (no file, `@font-face`, web-font URL or named `font-family`); form controls and canvas text are covered; a host font change reaches sheetpane live. Left open: workbook-stored fonts (B-016); the delivery mechanism is a component decision.
- **Mistakes:** none.
- **Next:** the decider reviews and commits the change; rules B-010, B-011, B-013, B-014, B-016.

---

## 2026-10-18 — law L4 filed  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *add a law that sheetpane is always a web component, so React or any other framework can use it.*
- **Done:** SR-LAW-4 (`records/0006`); SR-LAWS routing; register row; `CLAUDE.md` §The laws gained the L4 pointer line (SR-WORK-DOCS decision 7a — named here); backlog B-012–B-014; glossary "web component"; INTERVIEW, IMPLEMENTATION, NOW, registry. Not committed.
- **Decided / left open:** the decider ruled L4. Read in: the contract is DOM-native (attributes, properties, methods, events) and no UI framework is a peer dependency. Left open: framework wrappers (B-013), framework internals (B-014).
- **Mistakes:** the previous entry's backlog rows reused B-007, already the `Stop`-hook `cost` row. Renumbered to B-008–B-011 in the records, the backlog and INTERVIEW; the previous entry's IDs read one lower than the live rows.
- **Next:** the decider reviews and commits the change; rules B-010, B-011, B-013, B-014.

---

## 2026-10-18 — laws L2 and L3 filed  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *file a law that all the dependencies need to be free and open source; file another law that right now we only support XLSX and CSV files.*
- **Done:** SR-LAW-2 (`records/0004`) and SR-LAW-3 (`records/0005`); SR-LAWS routing table; register rows; `CLAUDE.md` §The laws gained the L2 and L3 pointer lines (SR-WORK-DOCS decision 7a — named here); backlog B-007–B-010; glossary FOSS; INTERVIEW, IMPLEMENTATION, NOW, registry. Not committed.
- **Decided / left open:** the decider ruled L2 and L3. Read in: FOSS = OSI-approved licence; L2 covers dev and transitive dependencies and vendored code; L3 covers read and write. Left open: copyleft (B-009), CSV delimiter variants (B-010).
- **Mistakes:** none.
- **Next:** the decider reviews and commits the change; rules B-009 and B-010.

---

## 2026-10-18 — the work system set up from WORK-SYSTEM.md  ·  Claude (Cowork, claude-opus-5-5)

- **Asked:** *set up the work system from WORK-SYSTEM.md, for sheetpane.*
- **Done:** records 0001–0003 and 0051–0060, `work/`, `archive/`, `scripts/`, `.claude/` hooks, `CLAUDE.md`, `.gitignore`; WORK-SYSTEM.md placed at `archive/bootstrap/` (it was never at the root of this repo).
- **Decided / left open:** tests deferred — backlog rows B-001–B-005. The repo had no commits and no code, so the code roots are `scripts/` and `.claude/hooks/` and no `W-01` was opened.
- **Mistakes:** the bootstrap's B-003 and B-004 cited locations that do not exist (`decision 11`, `veto 7`); both now cite the record's Consequences, which names them. The register said the queue has eight rule groups; it has ten.
- **Next:** the decider installs the commit-msg guard; the first `W-nn` is filed from the first real ask.
