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
