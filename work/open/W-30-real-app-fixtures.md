---
type: Handoff
name: W-30
description: "Split from W-13 on 2026-10-18 at Arpit's request: test @sheetpane/import against small files saved by Excel, Google Sheets, LibreOffice and Numbers. Arpit provides the files when convenient."
item: W-30
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Claude Code (claude-opus-5-5), lane h — DoD 3 check from W-59"
ball: arpit
---

# W-30 — Test the importer on files saved by real spreadsheet apps

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Arpit makes one tiny sheet and saves it from Excel, Google Sheets, LibreOffice and Numbers | real-world `.xlsx` variants, not library-made ones | ⏳ Arpit, when convenient |
| 2 | An agent adds them to the fixtures with a row each in `FIXTURES.md` | every file's origin on record | ⏳ |
| 3 | The import tests read each one and check values, dates, merges and formulas | proof the reader handles what real users upload | ⏳ |
| 4 | Measure the reading verdict's "1 in 100 cells misread" trigger | a known misread rate, not a guess | ⏳ |

**Arpit, 2026-10-18:** *"For W13, let's hold on to it. We will do it later on
or have a separate work item created just for testing these out."*

**Model:** NONE for step 1 (Arpit's own files, apps the build machine lacks);
Sonnet for steps 2–4.

## Goal

`@sheetpane/import` is proven on files saved by Excel, Google Sheets,
LibreOffice and Numbers, not only on ExcelJS output and hand-written XML. This
was W-13 DoD 9; W-13 closed without it.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · files | one small workbook saved from each app, with the same content: a merged title row; columns Name, Email, Age, Status; a date; a formula; a second sheet; the header row frozen (View → Freeze). Arpit's own data, no third-party files. Google Sheets: File → Download → .xlsx; Numbers: File → Export To → Excel | ⏳ Arpit |
| 2 · record | each file in `packages/import/test/fixtures/` with a row in `FIXTURES.md` (made by, how, licence) | ⏳ |
| 3 · tests | `read()` on each file: values, display text (dates, percent), merges, the formula's cached value, both sheets, **a frozen header row** (W-24 DoD 6), **a picture** whose frame sits where Excel shows it (W-20 DoD 6); **number formats** shown as Excel shows them (W-15 DoD 7); **validation rules** of every type (W-18 DoD 7); **cell styles** — every fill, font and border kind, property by property (W-17 DoD 8); **formulas** — IronCalc's value equals Excel's cached `<v>` for ≥ 99 % of formula cells (W-16 DoD 7); **the review sheet** — a file `@sheetpane/review` wrote (with *Colour flagged cells* on) opened in Excel 365, Excel 2019 and LibreOffice with no repair prompt, each Cell link opening its cell, each flagged cell filled with its own number format kept, and an accepted error shown as *Accepted: <reason>* (W-59 DoD 2, 3, 5); **comments** — notes, threads and both read back, and a file `@sheetpane/comments` wrote opened in Excel 365, Excel 2019 and LibreOffice with every error at its cell, an accepted error's *Accepted: <reason>* reply shown under it (W-69 DoD 3), and no repair prompt (W-22 DoD 4, 6); **charts** of each type (bar, column, line, pie, scatter and one that stays a frame) at their anchors, drawn against their series (W-21 DoD 5); **conditional formats** of each drawn type, coloured as Excel colours them (W-19 DoD 6); **comments** — notes, threads and both read back, and a file `@sheetpane/comments` wrote opened in Excel 365, Excel 2019 and LibreOffice with every error at its cell and no repair prompt (W-22 DoD 4, 6); **rich text** — a cell with one italic word read as runs and drawn as Excel draws it, and a file whose rich cell sheetpane edited opened in Excel with that cell plain and every other rich cell intact (W-53); **validation and conditional formats written by `@sheetpane/export`** — a `toXlsx` file with a list dropdown, a whole-number check with its prompt and error, an expression format, a colour scale, a data bar and an icon set, and a `patchXlsx` file that gained and lost rules, opened in Excel and LibreOffice with no repair prompt, the dropdowns working and the formats coloured (W-57 DoD 4); **the rules file written as Excel dropdowns** — `showcase.xlsx` downloaded from the playground with `showcase.rules.json` and *Write rules as Excel dropdowns* on, opened in Excel and LibreOffice with no repair prompt: Status a dropdown of Active, Inactive, Amount refusing 6000 with "Any one line over 5,000 needs a second approver", the input prompt showing the rule in words (W-58 DoD 3); **the saved files join `@sheetpane/fixtures`** with `appSaved` naming the app and version in `fixtures.json` (W-42 DoD 5); `<sheetpane-excel>` opens each (W-01 DoD 13); failures fixed in the owning package with its record in the same change | ⏳ |
| 4 · trigger | misread cells counted across the fixtures and written into SR-IMPORT; over 1 in 100 reopens the reading verdict | ⏳ |
| 5 · missing app | an app Arpit doesn't have is a backlog row, not a reason to keep this item open | ⏳ |
| 6 · tables (from W-61) | a workbook saved by Excel with two tables (one with a totals row, one in a style outside the Light/Medium 1–7 subset) and a dropdown over `Table[Column]` through a defined name: `read()` gives each table's name, ref, columns and style; the list rule resolves; `@sheetpane/tables` draws them close to Excel; and a sheetpane download with an edit opens in Excel 365 with both tables intact and no repair prompt | ⏳ Arpit |
| 7 · dependent lists (from W-60) | a workbook saved by Excel with one defined name per parameter (one of them sheet-scoped) and a Unit column whose list is `=INDIRECT($A2)`: the importer reads the names and the rule; each row's arrow offers its parameter's units; a stale unit is flagged; a blank parameter lets any unit in under "Ignore blank" and none without it — as Excel itself does | ⏳ Arpit |

## Blockers

None. Step 1 is Arpit's own work, done whenever convenient. Nothing else
waits on this item.

## Record affected

[SR-IMPORT](../../records/0104_IMPORT.md) Consequences: the "owed by the
decider" line becomes the measured result.

## Hazards

- **No third-party workbooks** (testing verdict decision 3). Every committed
  fixture names its origin.
- **Keep the files small**, a few KB each. They are committed.

## Reference

- [SR-IMPORT](../../records/0104_IMPORT.md) · [`../../packages/import/test/fixtures/FIXTURES.md`](../../packages/import/test/fixtures/FIXTURES.md) · [`../compare/xlsx-csv-reading.compare.md`](../compare/xlsx-csv-reading.compare.md) (reopen-trigger)
