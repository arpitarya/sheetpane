# `archive/` — the one archive, and where each thing went

**There is exactly ONE archive directory, and it is this one, at the repo
root.** Anything archived is moved here, into a directory mirroring where it
came from. This README is the **map**: every archived doc gets a row naming its
**live successor**.

## Archive is not evidence

A doc in here may be *named*. It may never be *cited as backing a live claim*
— nothing guarantees an archived file was not overwritten after it was
retired. Entries are frozen; **relative links inside them are not repaired**.
Rules: [SR-WORK-ARCHIVE](../records/0057_WORK-archive.md).

## Layout — the archive mirrors the live tree

| directory | holds |
|---|---|
| `open/` | closed work items' detail files, byte for byte |
| `records/` | retired records (L1) |
| `compare/` | decided forks whose triggers were ported into a record |
| `proposals/` | implemented or rejected proposals |
| `worklog/` | worklog slices cut at each major release |
| `bootstrap/` | the WORK-SYSTEM.md this repo's work system was set up from |

## `open/`

| file | closed | where the live answer lives now |
|---|---|---|
| `W-35-agent-skills-package.md` | 2026-10-18 | [SR-SKILLS](../records/0116_SKILLS.md); DoD 8 (a prompt in each tool) moved to W-48 |
| `W-38-llms-txt.md` | 2026-10-18 | [SR-BUILD](../records/0102_BUILD.md) decision 9a |
| `W-36-tsdoc-public-api.md` | 2026-10-18 | [SR-BUILD](../records/0102_BUILD.md) decision 7a |
| `W-37-custom-elements-manifest.md` | 2026-10-18 | [SR-GRID](../records/0105_GRID.md) (the manifest) · [SR-BUILD](../records/0102_BUILD.md) decisions 5, 7 |
| `W-39-mcp-server.md` | 2026-10-18 | [SR-MCP](../records/0119_MCP.md) |
| `W-43-create-sheetpane.md` | 2026-10-18 | [SR-CREATE](../records/0120_CREATE.md) · [SR-BUILD](../records/0102_BUILD.md) decisions 7, 8 |
| `W-50-pass-and-not-checked.md` | 2026-10-19 | [SR-GRID](../records/0105_GRID.md) 23 · [SR-ERRORS](../records/0106_ERRORS.md) 13 · [SR-COMMENTS](../records/0112_COMMENTS.md) 3 |
| `W-61-excel-tables.md` | 2026-10-19 | [SR-TABLES](../records/0122_TABLES.md) · [SR-IMPORT](../records/0104_IMPORT.md) 13 · [SR-EXPORT](../records/0103_EXPORT.md) 9a · [SR-VALIDATION](../records/0108_VALIDATION.md) 3–4; the Excel check is W-30 DoD 6, the `ref` shift W-52 |
| `W-60-dependent-dropdowns.md` | 2026-10-19 | [SR-VALIDATION](../records/0108_VALIDATION.md) 3, 4, 9 · [SR-GRID](../records/0105_GRID.md) 19b · [SR-FIXTURES](../records/0115_FIXTURES.md) 2, 5; the Excel-saved check is W-30 DoD 7 |
| `W-49-hide-and-show.md` | 2026-10-19 | [SR-GRID](../records/0105_GRID.md) 21c · [SR-VISIBILITY](../records/0121_VISIBILITY.md) · [SR-IMPORT](../records/0104_IMPORT.md) 10 · [SR-EXPORT](../records/0103_EXPORT.md) 3 |
| `W-58-rules-file-as-excel-dropdowns.md` | 2026-10-19 | [SR-VALIDATION](../records/0108_VALIDATION.md) 1, 10 · [SR-GRID](../records/0105_GRID.md) 10, 17 · [SR-CODES](../records/0117_CODES.md) (SP-5401 – SP-5407) |
| `W-57-export-writes-validation-and-conditional-formats.md` | 2026-10-19 | [SR-EXPORT](../records/0103_EXPORT.md) 1, 2, 3, 6 · [SR-IMPORT](../records/0104_IMPORT.md) 2 · [SR-CODES](../records/0117_CODES.md) (SP-2015) |
| `W-53-rich-text-runs.md` | 2026-10-19 | [SR-IMPORT](../records/0104_IMPORT.md) 12 · [SR-GRID](../records/0105_GRID.md) 9, 9a, 15c, 17 · [SR-STYLES](../records/0110_STYLES.md) 9 |
| `W-65-file-fingerprint.md` | 2026-10-19 | [SR-IMPORT](../records/0104_IMPORT.md) 11 · [SR-GRID](../records/0105_GRID.md) 2, 6, 9 · [SR-CODES](../records/0117_CODES.md) (SP-1009) |
| `W-54-checks-in-node.md` | 2026-10-19 | [SR-GRID](../records/0105_GRID.md) 22f · [SR-VALIDATION](../records/0108_VALIDATION.md) 11 · [SR-BUILD](../records/0102_BUILD.md) 5a · [SR-MCP](../records/0119_MCP.md) 5 · [SR-FIXTURES](../records/0115_FIXTURES.md) 6 |
| `W-44-live-playground.md` | 2026-10-19 | [SR-BUILD](../records/0102_BUILD.md) 8, 8b, 9 · [`RELEASING.md`](../RELEASING.md) — the playground at https://arpitarya.github.io/sheetpane/, the starters, and publishing from CI |
| `W-63-compare-plugin.md` | 2026-10-19 | [SR-COMPARE](../records/0124_COMPARE.md) · [SR-MCP](../records/0119_MCP.md) · [SR-COMMENTS](../records/0112_COMMENTS.md) 3 · [SR-CODES](../records/0117_CODES.md) (SP-5901) |
| `W-51-review-layers.md` | 2026-10-19 | [SR-GRID](../records/0105_GRID.md) 2, 5d, 7, 9, 17 · [SR-ERRORS](../records/0106_ERRORS.md) 1, 2, 16 · [SR-COMMENTS](../records/0112_COMMENTS.md) 3 · [SR-CODES](../records/0117_CODES.md) (SP-3021) |
| `W-59-review-sheet-plugin.md` | 2026-10-19 | [SR-REVIEW](../records/0123_REVIEW.md) · [SR-CODES](../records/0117_CODES.md) (SP-5001 – SP-5005) · [SR-BUILD](../records/0102_BUILD.md) 11a; opening a download in real Excel → W-30 DoD 3 |
| `W-69-accepted-deviations.md` | 2026-10-19 | [SR-GRID](../records/0105_GRID.md) 5c · [SR-ERRORS](../records/0106_ERRORS.md) 3, 7, 14 · [SR-COMMENTS](../records/0112_COMMENTS.md) 3, 5 · [SR-CODES](../records/0117_CODES.md) (SP-3018) |
| `W-68-error-detail-slot.md` | 2026-10-19 | [SR-GRID](../records/0105_GRID.md) 5b · [SR-ERRORS](../records/0106_ERRORS.md) 1, 13 · [SR-CODES](../records/0117_CODES.md) (SP-3016, SP-3017) |
| `W-55-sheet-and-workbook-errors.md` | 2026-10-19 | [SR-GRID](../records/0105_GRID.md) 5a · [SR-ERRORS](../records/0106_ERRORS.md) 3, 4 · [SR-COMMENTS](../records/0112_COMMENTS.md) 3 · [SR-CODES](../records/0117_CODES.md) (SP-5804) |
| `W-56-hover-and-highlight.md` | 2026-10-19 | [SR-GRID](../records/0105_GRID.md) 9, 11c |
| `W-64-edits-view.md` | 2026-10-19 | [SR-GRID](../records/0105_GRID.md) 9a, 24 · [SR-ERRORS](../records/0106_ERRORS.md) 17 |
| `W-66-link-to-a-cell.md` | 2026-10-19 | [SR-GRID](../records/0105_GRID.md) 9, 11d, 13 · [SR-CODES](../records/0117_CODES.md) (SP-3019) |
| `W-52-insert-delete-rows-columns.md` | 2026-10-19 | [SR-GRID](../records/0105_GRID.md) 3, 6, 7, 17, 21d · [SR-EXPORT](../records/0103_EXPORT.md) 3, 11 · [SR-IMPORT](../records/0104_IMPORT.md) 14 · [SR-FORMULAS](../records/0111_FORMULAS.md) 4 · [SR-CHARTS](../records/0113_CHARTS.md) 8 · [SR-CODES](../records/0117_CODES.md) (SP-2016, SP-3022–3025) |
| `W-66-link-to-a-cell.md` | 2026-10-19 | [SR-GRID](../records/0105_GRID.md) 9, 11d, 13 · [SR-CODES](../records/0117_CODES.md) (SP-3016) |
| `W-45-agent-commands-hooks-plugin.md` | 2026-10-18 | [SR-SKILLS](../records/0116_SKILLS.md) decisions 2a, 4b–4d |
| `W-47-resize-columns-rows.md` | 2026-10-18 | [SR-GRID](../records/0105_GRID.md) decisions 9, 9a, 11, 12 |
| `W-46-smooth-range-selection.md` | 2026-10-18 | [SR-GRID](../records/0105_GRID.md) decisions 9, 9a, 11a, 11b, 12, 13 |
| `W-41-testing-package.md` | 2026-10-18 | [SR-TESTING](../records/0118_TESTING.md) |
| `W-40-error-codes.md` | 2026-10-18 | [SR-CODES](../records/0117_CODES.md) |
| `W-42-fixtures-package.md` | 2026-10-18 | [SR-FIXTURES](../records/0115_FIXTURES.md) |
| `W-33-rules-file.md` | 2026-10-18 | [SR-GRID](../records/0105_GRID.md) decisions 22d, 22e |
| `W-34-download-split-button.md` | 2026-10-18 | [SR-GRID](../records/0105_GRID.md) decisions 9, 10, 17 |
| `W-32-plugin-gallery-demos.md` | 2026-10-18 | [SR-BUILD](../records/0102_BUILD.md) decision 11a |
| `W-31-docked-actions-one-download.md` | 2026-10-18 | [SR-GRID](../records/0105_GRID.md) decisions 10, 13 |
| `W-19-condfmt.md` | 2026-10-18 | [SR-CONDFMT](../records/0114_CONDFMT.md) |
| `W-28-react-hooks.md` | 2026-10-18 | [`packages/grid/README.md`](../packages/grid/README.md) §React hooks · [`examples/react/src/sheetpane-hooks.ts`](../examples/react/src/sheetpane-hooks.ts) |
| `W-27-host-column-rules.md` | 2026-10-18 | [SR-GRID](../records/0105_GRID.md) decisions 22–22c |
| `W-21-charts.md` | 2026-10-18 | [SR-CHARTS](../records/0113_CHARTS.md) |
| `W-22-comments.md` | 2026-10-18 | [SR-COMMENTS](../records/0112_COMMENTS.md) |
| `W-16-formulas.md` | 2026-10-18 | [SR-FORMULAS](../records/0111_FORMULAS.md) |
| `W-17-styles.md` | 2026-10-18 | [SR-STYLES](../records/0110_STYLES.md) |
| `W-29-dark-theme-and-slot-tokens.md` | 2026-10-18 | [SR-GRID](../records/0105_GRID.md) decisions 15a–15b |
| `W-15-numfmt.md` | 2026-10-18 | [SR-NUMFMT](../records/0109_NUMFMT.md); Excel-captured values in W-30 |
| `W-18-validation.md` | 2026-10-18 | [SR-VALIDATION](../records/0108_VALIDATION.md); an Excel-saved fixture in W-30 |
| `W-20-images.md` | 2026-10-18 | [SR-IMAGES](../records/0107_IMAGES.md); real-app pictures in W-30 |
| `W-26-edit-events.md` | 2026-10-18 | [SR-GRID](../records/0105_GRID.md) decisions 9, 11a |
| `W-24-freeze-panes.md` | 2026-10-18 | [SR-GRID](../records/0105_GRID.md) decision 21; Excel-saved freezes in W-30 |
| `W-01-sheetpane-excel.md` | 2026-10-18 | [SR-GRID](../records/0105_GRID.md); real-app fixtures in W-30 |
| `W-23-undo-redo.md` | 2026-10-18 | [SR-GRID](../records/0105_GRID.md) decision 7 |
| `W-14-plugin-host.md` | 2026-10-18 | [SR-GRID](../records/0105_GRID.md) decisions 17–20 |
| `W-02-sheetpane-errors.md` | 2026-10-18 | [SR-ERRORS](../records/0106_ERRORS.md) |
| `W-04-monorepo-toolchain.md` | 2026-10-18 | [SR-BUILD](../records/0102_BUILD.md) |
| `W-10-pnpm-and-justfile.md` | 2026-10-18 | the root `package.json`, `pnpm-workspace.yaml`, `justfile`; W-04 owns them |
| `W-03-export-package.md` | 2026-10-18 | [SR-EXPORT](../records/0103_EXPORT.md) |
| `W-12-downloader.md` | 2026-10-18 | [SR-DOWNLOAD](../records/0101_DOWNLOAD.md); the iOS check moved to W-09 DoD 10 |
| `W-13-import-package.md` | 2026-10-18 | [SR-IMPORT](../records/0104_IMPORT.md); real-app fixtures moved to W-30 |
| `W-25-research-events-rules-hooks.md` | 2026-10-18 | [`work/compare/grid-events-and-host-rules.compare.md`](../work/compare/grid-events-and-host-rules.compare.md) |
| `W-09-demo-apps.md` | 2026-10-18 | [SR-BUILD](../records/0102_BUILD.md) decision 11; the iPhone check is backlog B-031 |
| `W-05-research-xlsx-csv-reading.md` | 2026-10-18 | [`work/compare/xlsx-csv-reading.compare.md`](../work/compare/xlsx-csv-reading.compare.md); built by W-01 |
| `W-06-research-grid-rendering.md` | 2026-10-18 | [`work/compare/grid-rendering.compare.md`](../work/compare/grid-rendering.compare.md); built by W-01 |
| `W-07-research-pane-and-error-contract.md` | 2026-10-18 | [`work/compare/workbook-and-error-contract.compare.md`](../work/compare/workbook-and-error-contract.compare.md); built by W-01 and W-02 |
| `W-08-research-export-shape.md` | 2026-10-18 | [`work/compare/export-shape.compare.md`](../work/compare/export-shape.compare.md); built by W-03 |
| `W-11-research-testing.md` | 2026-10-18 | [`work/compare/testing.compare.md`](../work/compare/testing.compare.md); built by W-04, then every item's tests |

## `records/`

| file | retired | ruling | successor |
|---|---|---|---|

## `compare/`

| file | decided | the trigger lives in |
|---|---|---|

## `proposals/`

| file | outcome | successor |
|---|---|---|

## `bootstrap/`

| file | archived | successor |
|---|---|---|
| `WORK-SYSTEM.md` | 2026-10-18 | the records `0001`–`0003` and `0051`–`0060`, which are now the only home of every rule it carried |
