---
type: Handoff
name: W-18
description: "Arpit asked on 2026-10-18 for data validation as a separate package; this item builds the plugin on the `validate` hook."
item: W-18
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-fable-5-1)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-fable-5-1)"
ball: agent
---

# W-18 — Build `@sheetpane/validation`: the workbook's own data-validation rules, flagged in the error pane

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Read `<dataValidations>` for every sheet | the rules the workbook's author already wrote | ⏳ |
| 2 | Check every cell on load and on every change through the `validate` hook | violations appear in `<sheetpane-errors>` as warnings from author `workbook` | ⏳ |
| 3 | Give `list` rules a dropdown in Edit | the reviewer picks a valid value instead of typing one | ⏳ |
| 4 | Skip `custom` (formula) rules unless `formulas` is installed, and say how many were skipped | honest coverage | ⏳ |

**Arpit, 2026-10-18:** *"Let's create separate packages, plugins for number format, formulas, styles. Merge cells, freeze panes, data validation, conditional formatting, images, charts, pivots, comments, notes. Decide, do some research and have them as separate packages or plugins."*

**Model:** Opus — mapping Excel's rule semantics onto sheetpane errors is where the product value is.

## Goal

A plugin that turns the workbook's `<dataValidations>` into sheetpane errors. This is the review tool's strongest new feature: the file's own rules find the wrong cells before a human does.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · package | `packages/validation/` builds to ESM, no runtime dependency; `@sheetpane/grid` a peer; `./ui` entry | ⏳ |
| 2 · rules | `whole`, `decimal`, `date`, `time`, `textLength` with every operator; `list` from a literal list or a range; `custom` only when `formulas` is present | ⏳ |
| 3 · validate | `validate(sheet)` returns errors `{ type: 'validation', severity: 'warning', author: 'workbook', found, expected: <the rule in words>, message: <the rule's own errorTitle/error text when present> }`; re-run for the affected cells on every change; a cell that now passes resolves its validation error automatically — the one auto-resolve, because the author is the workbook, not a person | ⏳ |
| 4 · ui | `cell`: a dropdown arrow on `list` cells in Edit, opening the choices; `status`: "n validation warnings" | ⏳ |
| 5 · filter | `<sheetpane-errors>` gains an author filter (person · workbook · file) — a W-02 addition made here | ⏳ |
| 6 · skipped | `sheetpane-load` detail counts rules skipped (`custom` without formulas, unsupported operators) | ⏳ |
| 7 · tests | a fixture with every rule type saved by Excel; load → expected error list; edit → resolve / reopen; the dropdown | ⏳ |
| 8 · record | a component record; Ownership rows for `packages/validation/` | ⏳ |

## Blockers

Waiting on **W-14** (the `validate` hook), **W-13** (`<dataValidations>` from the reader) and **W-02** (the error pane the errors land in).

## Record affected

A new component record on completion; W-02's record gains the author filter. Until then this item owns `packages/validation/`.

## Hazards

- **B-022's ruling** (no auto-resolve) is for human errors; workbook-authored ones auto-resolve — stated in DoD 3 so it is a decision, not drift.
- **Ranges as lists** (`$A$1:$A$9`) reference live cells; the dropdown re-reads them after a change.
- **Excel's `showErrorMessage="0"`** rules still validate; they only suppress Excel's popup.

## Reference

- [`../compare/plugins.compare.md`](../compare/plugins.compare.md) — `validate`
- [`../compare/workbook-and-error-contract.compare.md`](../compare/workbook-and-error-contract.compare.md) — the error schema
- [W-14](W-14-plugin-host.md) · [W-13](W-13-import-package.md) · [W-02](W-02-sheetpane-errors.md)

## Prompt — paste into Claude Code once the blockers close

```text
You are building W-18 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, docs/ARCHITECTURE.md,
   work/compare/plugins.compare.md and this file (work/open/W-18-validation.md).
2. Plan the modules and the fixture list in this file's body before writing code.
3. Implement. Write the rule → words mapping (expected text) as a table in this file before coding; the reviewer reads it in every error row.
4. Verify: just check; every DoD row above. Then do what SR-WORK-DOCS
   decision 10 says every task owes.
```
