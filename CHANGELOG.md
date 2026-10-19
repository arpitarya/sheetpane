# Changelog

Every package is versioned in lockstep (SR-BUILD): one version for all of
`@sheetpane/*` and `create-sheetpane`. Each heading is
`## <version> — <what this release is> (<date>)`: the summary is the GitHub
Release title (`v0.3.0 — CI in about two minutes; no change to the packages`), the section its note.
Newest first. The specs are the records in [`records/`](records/README.md).

## Unreleased

### Added

- **Dependent dropdowns** (W-60). `@sheetpane/validation` checks a list whose source is `INDIRECT(<cell>)` — Excel's *Unit depends on Parameter* pattern: each row reads its parent cell's text and lists what it names, a defined name (any case, the sheet's own first), a table or table column, or an A1 range; `INDIRECT("text")` too. A parent edit re-checks the children in the same edit, so a unit the new parameter does not allow is a warning, and the list arrow offers the new parameter's units. A parent that names nothing lets anything in under "Ignore blank" and nothing without it, as Excel does. `INDIRECT(SUBSTITUTE(…))`, `&`, R1C1 and `OFFSET` are listed as skipped, not guessed. `@sheetpane/fixtures` adds `dependent-lists.xlsx` (one defined name per parameter, one stale unit).
- **Excel tables** (W-61). `@sheetpane/import` reads each sheet's tables (`sheet.tables`: name, range, header and totals rows, columns, style). `@sheetpane/export` adds `resolveStructuredRef('Units[Unit]', book.sheets)`, which turns a table reference — `Units[Unit]`, `Units[[#Data],[Unit]]`, `#Headers`, `#Totals`, `#All`, a column span — into its cells. `@sheetpane/validation` uses it, so a dropdown whose source is a table column (directly, or through a defined name such as `UnitList`) offers the table's values and checks against them. The new plugin **`@sheetpane/tables`** draws each table in its style: header row, banded rows and columns, first and last column, totals row. It covers Excel's Light 1–7 and Medium 1–7 in the workbook's theme colours; other styles get a bold header. A cell's own format and conditional formats still draw over the table. A download keeps the file's tables. Both demos gain a *Tables* tab, and `@sheetpane/fixtures`' showcase a *Tables* sheet ([SR-TABLES](records/0122_TABLES.md)).
- **Law L11 — the workbook never leaves the browser** ([SR-LAW-11](records/0013_LAW-11-workbook-stays-in-the-browser.md)). sheetpane reads, edits, checks and exports a file inside the page and sends nothing to any server: no file bytes, cells, edits, errors, exports or telemetry. Its only network calls are the GETs for the `src` and `rules-src` the host sets. A test in `test/packages.test.ts` fails if any package adds another. The `sheetpane-backend`, `sheetpane-load-export` and `sheetpane-security` skills now say that a server save is the host's own code and choice.

### Fixed

- `@sheetpane/grid`: an open workbook or host error now follows its rule's `expected` too, not only `found` and `message` — a list whose choices changed showed the old choices (W-60).
- Demos (`examples/html`, `examples/react`): redesigned in the Proof look. A host bar with Views, Open file…, the CSV sample, the pop-up, Font and a new Theme switch (light, dark, auto, applied to every component). A *Demo* row of tabs, with Review, the plugins and the combinations set apart. Each demo's blurb shows the attribute that turns it on. Both components fill the window, and a footer shows the host events (change, errors, export). Every hook the demo check uses is kept; `demo-check` passes 51 of 51.
- `@sheetpane/grid`: the toolbar stays one row, shedding the change label, find width, counts and file meta as the element narrows, and the Download ▾ menu no longer opens off the left edge. The format row stays one row, with a More ▾ for the groups that do not fit. Docked plugin buttons fold into ⋯ before they squeeze the value field, and greyed or header- and tab-only menu actions stay out of the cell bar. The grid's focus ring shows only for the keyboard, drawn over the cells instead of as a stray frame beside them. The right-click menu separates Flag issue and plugin items. Checked against the design canvas in the plain-HTML demo.

## 0.3.0 — CI in about two minutes; no change to the packages (2026-10-19)

The package code is the same as 0.1.0 and 0.2.0; this release changes how
sheetpane is checked and published. It is the first version meant to
reach npm from CI, through `publish.yml` with signed provenance.

```bash
npm i @sheetpane/grid@0.3.0
```

**Before you upgrade from 0.1.0:** sheetpane needs **Node 22 or later**
wherever it runs in Node (0.2.0's change). Browsers are unaffected.

### Release and tooling

- **CI runs its jobs in parallel**: typecheck, coverage, the pack check
  and demos, the three-OS matrix, the templates, and the test suite in
  four shards balanced by measured time. The pnpm store and Chromium are
  cached.
- **`publish.yml` asks npm about every package before uploading any.** It
  prints npm's reason for each refusal, so a release is never left half on
  npm.
- **Release titles say what the release is** (`v0.3.0 — …`), taken from
  the CHANGELOG heading.
- **A test helper that took 117 s now takes 0.3 s**: the TSDoc check reads
  each declaration file once.
- Every GitHub Action moved to its current major.

## 0.2.0 — the release pipeline and Node 22+, never on npm (2026-10-19)

**Released on GitHub only.** Its publish run stopped before uploading
anything: no package on npm trusted `publish.yml` yet. Install
[0.3.0](https://github.com/arpitarya/sheetpane/releases/tag/v0.3.0), which
has the same package code, or 0.1.0.

**Before you upgrade:** sheetpane now needs **Node 22 or later** wherever it
runs in Node: SSR imports, tests, the MCP server, the CLIs. Node 20 is past
end of life. Browsers are unaffected.

### Release and tooling

- **Published from CI only, with provenance.** A GitHub Release runs
  `publish.yml`, which publishes nothing unless CI is green on that commit,
  every version site agrees, and the tag matches the packages. It builds once,
  checks each tarball (no `src/`, no tests, README and LICENSE present) and
  publishes over npm trusted publishing (OIDC): no token, with signed
  provenance. See `RELEASING.md`.
- **CI on Linux, macOS and Windows × Node 22 and the current LTS.** Each run
  installs the built tarballs into an empty folder and imports every package
  from plain Node.
- **`@sheetpane/mcp` on Windows:** `explain_code` returns the full entry
  (cause, meaning, fix) when `ERRORS.md` has CRLF line endings.
- **MIT `LICENSE` in every package.**

The package code is 0.1.0's; its *Changed* and *Added* lists are under
[0.1.0](https://github.com/arpitarya/sheetpane/releases/tag/v0.1.0).
## 0.1.0 — the first cut, published to npm by hand (2026-10-19)

**On npm.** Published from the `v0.1.0` tag by hand, the one version that
did not come from CI. CI at the tag passed every test and all six
templates; the only failure was a stale generated `llms-full.txt`.

The first complete cut of sheetpane, 17 packages at one version:

- **`<sheetpane-excel>` and `<sheetpane-errors>`** (`@sheetpane/grid`): open,
  edit and review `.xlsx` and `.csv` in the page. The sheet and its error
  list stay in sync through one in-memory workbook. Download hands back the
  original file with only your changes written in.
- **Review:** column rules, a JSON rules file and the workbook's own
  validation, with errors flagged on cells and listed beside the sheet.
- **Editing basics:** range selection, copy and paste, undo and redo, find,
  zoom, freeze panes, resize, and hidden rows, columns and sheets, with a
  dark theme.
- **Nine plugins:** `numfmt`, `formulas`, `styles`, `validation`, `condfmt`,
  `images`, `charts`, `comments`, `visibility`.
- **For hosts and agents:** `@sheetpane/testing`, `@sheetpane/fixtures`,
  `@sheetpane/skills` and `@sheetpane/mcp`; typings for React, Vue, Svelte
  and Solid; the custom-elements manifest.
- **Requirements:** browsers with `DecompressionStream`; Node 20+ for
  imports in Node (0.2.0 raises this to 22+). MIT licence.

### Changed in detail

- **Hidden rows, columns and sheets are honoured and marked** (W-49): the
  grid no longer draws what the file hides as ordinary rows and tabs. A
  ◂▸ / ▴▾ marker shows each hidden span (with its errors), *Show hidden* and
  a marker click show it for viewing, hidden sheets are listed by a
  *⊘ n hidden* button, outline groups get a gutter with +/− and levels, and
  an error in a hidden place is shown when selected. Keys, copy, Delete and
  totals skip hidden cells. **Deprecated:** `ImportedSheet.hidden` — use
  `state` (`visible` · `hidden` · `veryHidden`).

- **Resize columns and rows** (W-47): drag a header edge (a guide and the
  size while you drag), double-click to fit the text, several selected at
  once, or right-click a header for Fit · width… · Reset. Rows keep the
  file's custom heights and wrapped text wraps in them. Sizes are a view
  setting — not a change, not in the download — with `sizes` and
  `sheetpane-resize` for a host to keep them.

- **Range selection is smooth and does more** (W-46). The selection is one
  layer — a fill, one border, the active cell left clear — so a drag no longer
  redraws the cells (on 250,000 rows: no dropped frame dragging with
  autoscroll). Drag past an edge to scroll; click column or row headers or
  the corner; Ctrl/⌘+arrows, Ctrl+Space, Shift+Space, Ctrl/⌘+A,
  Shift+Backspace; Enter / Tab inside a range. A range copies as a grid
  (TSV + HTML), clears with Delete, fills from one pasted value, and shows
  Count · Sum · Average. `sheetpane-select` gains `range` and fires once per
  drag, on release. Touch: two handles. **Removed:** the cells' internal
  `.inrange` / `.sel` classes (in the shadow root, never host-facing).
- **`<sheetpane-excel>`: one Download button** (W-31). "Download .xlsx" /
  "Download .csv", in View and Edit, replaces **Export** and **Download the
  original**: with no change it hands back the file as opened, byte for
  byte; with changes it downloads `export()`'s copy, the change count on the
  button. `sheetpane-export` keeps its name and gains `original: true` for
  the untouched file. **Removed:** the separate download-original button.
- **The selection bar no longer floats over the cells** (W-31). Flag issue,
  the `selbar` plugin buttons and ⋯ (Copy ref, Copy value) are docked at the
  right end of the cell bar; right-click, Shift+F10 or the Menu key opens
  the same actions under the cell. The `selbar` slot keeps its id.

- **Download is a neutral split button** (W-34), not the accent colour: the
  main part downloads in the upload's format; **▾** offers Download as .xlsx
  or .csv (converting: one sheet, latest values) and each plugin's export
  options (comments: "Write review as Excel comments"). `sheetpane-export`
  gains `format` and `converted`.

### Added in detail

- **`@sheetpane/visibility`** (W-49): hide and unhide rows, columns and
  sheets, and group outlines, in Edit — the selection bar, the cell, header
  and tab menus, Google Sheets' keys, a marker click — written into the
  download (`patchXlsx`'s new `hidden` option). `sheetpane-visibility` event;
  `store.setHidden`, `setSheetState`, `setOutline`.

- **`custom-elements.json` and typings** (W-37): `@sheetpane/grid` ships the
  Custom Elements Manifest, VS Code and JetBrains editor data, and type-only
  entries `@sheetpane/grid/jsx`, `/vue`, `/svelte`, `/solid` — no host writes
  its own element typings. Angular: `CUSTOM_ELEMENTS_SCHEMA` (README).
- **`@sheetpane/mcp`** (W-39): `npx -y @sheetpane/mcp` — an MCP server
  (2026-07-28, stateless; 2025 clients too) with deterministic, read-only
  tools: inspect a workbook, draft and check a rules file, explain an SP
  code, find a skill, describe the API. `sheetpane-skills install` registers
  it for Claude Code, Kiro and Codex (`--no-mcp` to skip). Codes SP-7001…7007.
- **`@sheetpane/import` reads `.xlsx` in Node** (W-39): a built-in XML reader
  stands in when `DOMParser` is absent. **Removed:** the `needs-dom` refusal
  (SP-1008, retired). `@sheetpane/testing`'s `readFile` uses it everywhere
  and drops its own Node reader and its `@sheetpane/export` dependency.
- **TSDoc on the whole public API** (W-36): every export's `.d.ts` carries a
  summary, parameters, returns, the elements' attributes and events, an example
  and a link to its record.
- **`llms.txt` / `llms-full.txt`** (W-38): sheetpane's public contract for AI
  agents, at the repository root and in `@sheetpane/grid` (`dist/`).

- **`@sheetpane/testing`** (W-41): `sheetpane(page)` for Playwright and
  `sheetpane(element)` for Vitest browser mode — edit, flag, resolve, Download
  read back, `toHaveCell` / `toHaveError` — on committed `data-sp-*` hooks.

- **Agent skills** (W-35): `npx sheetpane-skills install` copies 23 skills for
  Claude Code, Kiro and Codex into a repository, plus a short block in
  `CLAUDE.md` / `AGENTS.md`; `uninstall` removes exactly what it wrote.

- **Stable error codes** (W-40): every thrown error, console warning, rules
  note, refused load and blocked edit carries an `SP-xxxx` code with an entry
  in `docs/ERRORS.md`; `spCode` / `codeOf()` read it. Messages keep their old
  text after the code.

- **A rules file** (W-33): `rules-src="./sheetpane.rules.json"` or
  `excel.rules = object` — rules per sheet (`"*"` for all), by column title
  and by cell or range, with `equals`, `noneOf` and `note`; a JSON Schema
  ships as `@sheetpane/grid/rules.schema.json`. **`flagging="off"`** hides
  Flag issue and every pop-up: errors are read in the panel.

- Dark theme: `theme="light" | "dark" | "auto"` on both elements (W-29).
- Column rules by title — `columns`, `validate`, `onInvalid` (W-27).
- Plugins: `@sheetpane/numfmt`, `formulas`, `styles`, `validation`,
  `condfmt`, `images`, `charts`, `comments` (W-15–W-22).
- React hook recipes in `examples/react` (W-28).
- A plugin gallery in both demos: Vanilla, a tab per plugin and All plugins on
  one showcase workbook (W-32).
