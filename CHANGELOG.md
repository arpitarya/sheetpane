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
- **The pane's checks with no page: `@sheetpane/grid/check` and `@sheetpane/validation/check`** (W-54; [SR-GRID](records/0105_GRID.md) decision 22f, [SR-VALIDATION](records/0108_VALIDATION.md) decision 11). `check(bytes, { name, rules, columns, validate, plugins })` runs what `<sheetpane-excel>` runs on load — the rules file, column rules, an async `validate`, each plugin's `validate` after a formula engine has recalculated — in Node, a worker or a page, and returns the errors the pane would hold, sorted by sheet, row and column; only `id` and `createdAt` differ. The entries import no element and touch no DOM: a test walks their import graphs, and a parity test holds the pane in a browser and `check()` in Node to one golden on every `@sheetpane/fixtures` workbook. `@sheetpane/validation/check` is the validation plugin with no registration and no *Write rules as Excel dropdowns* switch (that is the main entry's, W-58), plus `check()` with it on. A new code, **SP-3020**, is thrown when `check()` gets something other than bytes. `@sheetpane/validation` now imports `shiftFormula` from `@sheetpane/export` (a new dependency), so its main entry needs no new import-map line.
- **`@sheetpane/mcp`'s `check_rules` runs the pane's own `check()`** over the workbook it is given: the workbook notes come from the grid (SP-6023 for a `"*"` title now sits on the first sheet's header cell, worded as the grid words it; SP-6024 only for a duplicated title a rule names), and the failing cells are listed as `findings` (the first 50) with `findingCount`.
- **`@sheetpane/compare` — what changed between two versions of a workbook** ([SR-COMPARE](records/0124_COMPARE.md)). `diffWorkbooks(a, b, { key })` runs in Node or the browser: sheets added, removed and renamed; rows added, removed, changed and — with key columns — moved; cells changed by value, display text or formula (a formula that only moved with its row is not a change); merges, hidden rows and columns, rule counts. `@sheetpane/compare/ui` (`plugins="compare"`) compares the open file with a base the user picks (Compare…) or the host passes (`compareWith`), both read in the page: changed cells amber, added rows green, moved rows blue, a red line where rows were removed, *n sheets · n rows · n cells changed* in the status line, Alt+F5 / Alt+Shift+F5 to step through, and each change in the errors list. 50,000 rows diff in about 0.1 s. New code SP-5901 (a per-sheet key that is not a column). The demos gain a *Compare* tab.
- `@sheetpane/mcp`: a seventh tool, `diff_workbooks(base, path, key?)`, on the same diff.
- `@sheetpane/fixtures`: `compare/base.xlsx` and `compare/now.xlsx`, two versions of one spec workbook.
- **Law L11 — the workbook never leaves the browser** ([SR-LAW-11](records/0013_LAW-11-workbook-stays-in-the-browser.md)). sheetpane reads, edits, checks and exports a file inside the page and sends nothing to any server: no file bytes, cells, edits, errors, exports or telemetry. Its only network calls are the GETs for the `src` and `rules-src` the host sets. A test in `test/packages.test.ts` fails if any package adds another. The `sheetpane-backend`, `sheetpane-load-export` and `sheetpane-security` skills now say that a server save is the host's own code and choice.
- `@sheetpane/grid`: errors with no cell (W-55). `range: ""` is an error about the whole sheet; `sheet: ""` with `range: ""`, about the whole workbook. `<sheetpane-errors>` lists them first, in a *Workbook* group and then one group per sheet, above the cell errors. A whole-sheet error counts on its tab, and **Show in sheet** opens that tab. For a workbook-level error the button is disabled and says why. Neither kind is placed on A1, gets a pin or marks a cell. New: `errorScope(e)` (`cell`, `sheet` or `workbook`) and the `ErrorScope` type.
- `@sheetpane/comments`: an error with no cell is not written as an Excel comment, because a comment needs a cell. `lastExport.skipped` lists it with `reason: 'no-cell'` and the new code SP-5804.
- `@sheetpane/grid`: room for the host in an error (W-68). `SheetpaneError.meta` holds any JSON of the host's, up to 64 KiB (`ERROR_META_MAX`). It is saved and restored with the error and never written into the file. `renderDetail(error)`, a new property on `<sheetpane-excel>` (the error card) and `<sheetpane-errors>` (the open row), returns a string, a Node or `null`. The result is drawn after the message in `::part(detail)`, and the hook runs again only when that error changes. A string is shown as text, never as HTML. New: the `ErrorMeta` and `RenderDetail` types, and the codes SP-3016 (a `meta` that is not JSON or is over the cap is dropped; the error is kept) and SP-3017 (`renderDetail` threw; nothing is shown).
- `@sheetpane/grid`: accepted deviations (W-69). An error's `status` may now be `accepted`, with `acceptedBy`, `acceptedAt` and a required `reason`: a known, approved difference that stays in the review and the download but is not counted as open. **Accept…** in an open row of `<sheetpane-errors>` asks why and records the element's `author` as who; an **Accepted n** chip lists them, and the severity chips, "n open" and the sheet's counts leave them out. In the sheet the pin reads **A** and the error card shows who, when and why, with Reopen. Undo and Reopen take an acceptance back. New: `workbook.acceptError(id, reason, { by })`, the `ErrorStatus` type, and the code SP-3018 (a blank reason, or an error the workbook itself wrote, is not accepted; restored without a reason, it comes back open). Code that counted open errors as `status !== 'resolved'` should use `status === 'open'`.
- `@sheetpane/comments`: an accepted error gets one more reply in its thread, *Accepted: <reason>*, written by who accepted it, and its thread is marked done (W-69).
- `@sheetpane/grid`: review layers (W-51). Every error has a `layer` (`review` unless named). `setErrors(list, { layer })` replaces that layer only, keeping the others and the undo stack; `getErrors({ layer })` reads one. A `layers` attribute and property on either element chooses the layers shown — the pane's one setting — and `<sheetpane-errors>` shows a switch (**All**, then each layer with its open count; names from `layerNames`) when the pane has two or more. The sheet's pins, marks, counts and tab counts, the list and the comments export follow what is shown; a person's new error goes into the layer shown. A `validate` draft may name a `layer`. New: `sheetpane-layers {visible, layers}`, `setVisibleLayers()`, `snapshot.layers`, `visibleLayers` and `visibleErrors`, `layerOf()`, `isLayerName()`, `DEFAULT_LAYER`, the `ErrorsEnvelope` type and SP-3021 (a name that is not one).
- `@sheetpane/comments`: an export writes the errors of the layers shown; `export({ layers: [...] })` names another set (W-51).

- `@sheetpane/grid`: the Edits view (W-64). `<sheetpane-errors>` gets an **Edits n** chip beside *Problems*: every change in the pane, newest first — the cell or range and kind, *was → now*, the time, and links to the errors that edit cleared or raised. Picking a row selects its cell. **Revert** on a row and **Revert all** are each one undo step. It shows in Edit mode, and in View mode while the pane holds edits; in Edit mode the panel now always shows the *Problems · Edits* switch. New on the store: `edits()`, `editEffects(key)` (`{ cleared, raised, matched }`) and `revertEdits(keys?)`; new exports `editRef`, `Edit` and `EditEffects`.
- `@sheetpane/review`, a new plugin (W-59, SR-REVIEW). On download it adds a *Review* sheet that lists every error: ID, sheet, cell, severity, type, found, expected, message, author, status, and for an accepted error *Accepted: <reason>* with who accepted it and when. The Cell column links to the cell. Errors about a whole sheet or the workbook are listed too, never coloured. Optionally, each open error's cells are filled by severity: the cell's own format is cloned, so its number format, font and borders stay, and every other cell keeps its exact bytes. The Download menu gains *Add a Review sheet* (on) and *Colour flagged cells* (off); `export({ review, reviewFills, reviewSeverities, reviewLayers })` sets them for one export. A user's own sheet called *Review* is never overwritten: the new sheet is *Review (2)*. A hidden defined name, `_sheetpane_review`, marks the sheet, and `reviewSheetOf(book)` finds it, so a host can skip it when the file comes back. Exporting the file again rewrites the plugin's own sheet instead of adding a second one. New codes: SP-5001 – SP-5005.

### Changed

- **`SheetpaneError.range` may be `""`, and `sheet` may be `""` too** (W-55). If your code reads `range` as an A1 reference, handle `""` (use `errorScope(e)`). Existing errors are unaffected.
- `@sheetpane/validation`: the rules file written into the download as Excel's own dropdowns and checks (W-58). With *Write rules as Excel dropdowns* on in the Download menu — or `export({ rulesAsValidation: true })`, or `validation({ rulesAsValidation: true })` to start with it on — the `.xlsx` carries the host's rules file and column rules as the workbook's data validation: `oneOf` and `equals` become a dropdown list, `integer` / `number` with `min` / `max` a whole-number or decimal check, `date` a date check, `minLength` / `maxLength` a text-length check, `required` turns off "ignore blank", and the rule's `message` is Excel's error text. What Excel cannot hold — a `pattern`, `noneOf`, `unique`, two checks in one rule, a list value with a comma — is not written and is listed on the console with its code (SP-5401 – SP-5405) and on the status line. Where the workbook already has a rule, the workbook's rule wins and the conflict is listed (SP-5406); a rule that checks the same thing joins it instead of repeating it. `rulesAsValidations(store)` gives the plan, `lastRulesWrite(book)` the report. A plugin's Download-menu switch can now say when it `applies`: the switch is hidden without rules, and while it is on an untouched workbook is exported rather than handed back as the original file.
- `@sheetpane/export`: dropdowns and conditional formats in the files it writes (W-57). A sheet's `dataValidations` and `conditionalFormats`, and the workbook's `dxfs`, are written by `toXlsx` as Excel's own rules — the shapes `@sheetpane/import` reads, so a rule read from a file is written back unchanged. `patchXlsx` takes `dataValidations` and `conditionalFormats` per sheet (the whole set; `[]` removes it) and `dxfs` to add, and leaves every other sheet and part byte for byte; `setDataValidations` and `setConditionalFormats` do the same from an `exportPatch` hook. A rule Excel would repair (an unknown type, a title over 32 characters, a typed-out list over 255, a format that does not exist) is refused with SP-2015. The rule and format types (`DataValidation`, `ConditionalFormat`, `CfRule`, `Dxf`, `Font`, `Fill`, `Border`, `Color`…) now live in `@sheetpane/export`; `@sheetpane/import` re-exports them unchanged.
- `@sheetpane/import`, `@sheetpane/styles` and `@sheetpane/grid`: rich text (W-53). A cell with one word in italic is read as runs. Each sheet's `runs` maps the cell to `[{ text, b, i, u, strike, color, sz, vertAlign }]`, from shared and inline strings, with phonetic runs left out; `rows` and `text` are unchanged. With `styles` on, the grid draws the runs as spans: weight, style, underline and strike, size, colour, and superscript and subscript. It never draws a font family. A plugin draws runs through the new optional `decorateRuns` on the `decorate` hook. Editing a rich cell writes plain text. The cell bar warns first, and `sheetpane-editstart` carries `richText: true`. Rich cells left untouched, and the shared strings, export byte for byte.
- `@sheetpane/import` and `@sheetpane/grid`: the file's SHA-256 (W-65). `read()` returns `sha256`, 64 lowercase hex digits of the bytes opened, and `sha256(bytes)` is exported. `sheetpane-load` and `sheetpane-export` carry `sha256` — the file opened and the file handed back — and so does `store.exportFile()`. On a page without Web Crypto (not `https` or `localhost`) it is `undefined` with a console warning, SP-1009, never a substitute hash. The demos' export line shows it.
- `@sheetpane/grid`: open straight at a cell (W-66, SR-GRID decision 11d). The `ref` attribute and property (`B4`, `Data!B4`, `'Q3 data'!B4:D8`) is the selection once a file is read, scrolled into view; one that names no cell warns `SP-3019` and the sheet opens at A1. `link="hash"` (off by default) keeps the selection in the URL fragment as `#sheetpane=<pane>:<Sheet>!<ref>` — only that parameter is touched, after a hash router's path (`#/reports/12?sheetpane=…`) or the host's own parameters; written with `replaceState` once the selection settles (no history entry, no `hashchange`), read when a file is read and on back and forward. With it, *Copy link* joins the cell menu after *Copy ref*. The fragment is never sent to a server. React, Vue and Solid typings leave `ref` out (it is the framework's own ref); set it there with `setAttribute`.
- `@sheetpane/grid`: `sheetpane-hover` names the cell under a mouse or pen pointer — `{ sheet, ref, column }`, at most once per frame and only when the cell changes — and `null` when the pointer leaves the cells; a finger never fires it. `highlight(ranges, { tone, label, sheet, pinned, reveal })` outlines cells from outside without selecting them: several ranges, `info`, `pass` or `fail`, clicks pass through, not a change and not in the download, cleared on a sheet switch unless pinned; `reveal` scrolls it into view and the label is said once by the status line. `clearHighlight()` removes it. Typed in the manifest and the framework typings (W-56, SR-GRID decision 11c).
- **Two new severities: `pass` and `skipped` (not checked)** — results as well as faults (W-50; [SR-ERRORS](records/0106_ERRORS.md), [SR-GRID](records/0105_GRID.md)). A host or a plugin's `validate` can report a passed cell and a cell it did not check; a `v: 1` review without them loads as before. **A host that switches exhaustively on `severity` meets two more values** — `isResult(e)` tells a result from a problem. Results stay quiet: the new `results` attribute (on either element, pane-wide) is `summary` by default — one line of counts in `<sheetpane-errors>` (*1 problem · ✓ 180 passed · — 28 not checked · On sheet*), *Passed* / *Not checked* chips, passes grouped by check and not-checked cells by reason, nothing on the sheet and *186 of 214 checked* in the status line; `marks` (or the panel's *On sheet* switch) adds a 9 px ✓ or — in each result cell's bottom-left corner (new token `--sp-skip`); `off` drops results on arrival. Tab counts, the toolbar counts, *n open* and the severity filters count problems only. `@sheetpane/comments` writes results into a download only with `export({ includeResults: true })`.
- **`sheetpane-errors` carries the review envelope `v: 2`** (W-51): `{ v, errors, plugins, layers, changed }`, and every error in it has a `layer`. Save the whole `detail` and give it back with `setErrors(saved)`; a review saved before (`{ errors, plugins }`, or a bare list) restores into the `review` layer as before.

### Fixed

- `@sheetpane/grid`: a cell selected and scrolled to right after a file is read (`select()`, or `ref`) could land just under the bottom edge — the status line's first content shrank the grid after the scroll. The status line is now laid out first (W-66).
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
