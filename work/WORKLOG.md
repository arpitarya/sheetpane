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
