---
type: Handoff
name: W-30
description: "Split from W-13 on 2026-10-18 at Arpit's request: test @sheetpane/import against small files saved by Excel, Google Sheets, LibreOffice and Numbers. Arpit provides the files when convenient."
item: W-30
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
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
| 3 · tests | `read()` on each file: values, display text (dates, percent), merges, the formula's cached value, both sheets, **a frozen header row** (W-24 DoD 6), **a picture** whose frame sits where Excel shows it (W-20 DoD 6); **number formats** shown as Excel shows them (W-15 DoD 7); **validation rules** of every type (W-18 DoD 7); **cell styles** — every fill, font and border kind, property by property (W-17 DoD 8); `<sheetpane-excel>` opens each (W-01 DoD 13); failures fixed in the owning package with its record in the same change | ⏳ |
| 4 · trigger | misread cells counted across the fixtures and written into SR-IMPORT; over 1 in 100 reopens the reading verdict | ⏳ |
| 5 · missing app | an app Arpit doesn't have is a backlog row, not a reason to keep this item open | ⏳ |

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
