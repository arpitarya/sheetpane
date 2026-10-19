# Changelog

Every package is versioned in lockstep (SR-BUILD): one version for all of
`@sheetpane/*` and `create-sheetpane`. Each heading is
`## <version> — <what this release is> (<date>)`: the summary is the GitHub
Release title (`v0.2.0 — the first release on npm`), the section its note.
Newest first. The specs are the records in [`records/`](records/README.md).

## Unreleased

## 0.2.0 — the first release on npm (2026-10-19)

The first release on npm: all 17 packages at `0.2.0`. `v0.1.0` was tagged but
never published, so this is the first version you can install.

```bash
npm i @sheetpane/grid
```

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

The *Changed* and *Added* lists below are the work first tagged as 0.1.0.
This is the first version where you can install them.

### Changed

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

### Added

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

## 0.1.0 — tagged, never published to npm (2026-10-19)

**Tagged, never published to npm.** Install
[0.2.0](https://github.com/arpitarya/sheetpane/releases/tag/v0.2.0) instead:
the same code, plus the release pipeline, and the first version on npm. The
first publish needed the npm account's one-time code and was handed to CI
instead. 0.2.0's notes list in full what this tag contains. CI at the tag passed every test
and all six templates; the only failure was a stale generated `llms-full.txt`.

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
