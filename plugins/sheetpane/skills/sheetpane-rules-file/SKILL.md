---
name: sheetpane-rules-file
description: Use when valid and invalid values ship as a JSON file per sheet, column or cell, checked on load and listed only in the errors panel - rules / rules-src, its JSON Schema, flagging="off". Not for rules written in code (sheetpane-column-rules).
license: MIT
metadata:
  audience: host
---

# The rules file

A JSON document the host ships next to its code ([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) decision 22d). It
compiles into the same checker as column rules; failures are listed in
`<sheetpane-errors>`.

```html
<sheetpane-excel pane="q3" src="./q3.xlsx" rules-src="./sheetpane.rules.json" flagging="off"></sheetpane-excel>
<sheetpane-errors pane="q3"></sheetpane-errors>
```

```json
{
  "$schema": "https://unpkg.com/@sheetpane/grid/rules.schema.json",
  "version": 1,
  "sheets": {
    "*": { "columns": { "Email": { "pattern": "^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$", "unique": true } } },
    "Accounts": {
      "headerRow": 2,
      "columns": { "Units": { "type": "integer", "min": 0 } },
      "cells": { "B1": { "equals": "Q3 review", "note": "the export pipeline reads this" } }
    }
  }
}
```

## The shape

- `sheets` by name; `"*"` applies to every sheet; a named sheet's rule for
  the same title wins.
- Each sheet: `headerRow`, `columns` (by title), `cells` (an A1 cell or
  range — errors of type `cell-rule`).
- The words of [column rules](../sheetpane-column-rules/SKILL.md) plus
  `equals` (a blank fails it), `noneOf`, `note` (never shown as the message).
- `$schema` gives the editor autocomplete; the schema ships as
  `@sheetpane/grid/rules.schema.json`.

## Linking

`rules-src` reads the file with a GET, like `src`; `excel.rules = object`
does it without a fetch (parse YAML or TOML yourself and pass the object —
the package reads JSON only). Setting either re-checks every row. The
element's `columns` still apply; the file's rule wins for the same title.

## `flagging="off"`

No Flag issue (cell bar, right-click menu, `F`), no composer, no pop-up card
([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) decision 22e). The error mark stays on the cell; the panel is the one
place errors are read.

## Into the download as Excel dropdowns

With `@sheetpane/validation` on the pane, the Download menu offers *Write
rules as Excel dropdowns* (only while a rules file or column rules are set).
On, the `.xlsx` carries the rules as the workbook's own data validation, so a
person who opens it in Excel gets the same dropdowns and checks
([SR-VALIDATION](https://github.com/arpitarya/sheetpane/blob/main/records/0108_VALIDATION.md) decision 9).

```ts
import { validation, lastRulesWrite } from '@sheetpane/validation';

const store = createWorkbook({ plugins: [validation({ rulesAsValidation: true })] }); // the switch on at first
await excel.export({ rulesAsValidation: true });   // or for one export
lastRulesWrite(excel.workbook?.book);            // { written, merged, skipped, conflicts }
```

- `oneOf` / `equals` → a dropdown list; `number` / `integer` with `min` /
  `max` → decimal / whole number; `date` → date (bounds as `2026-01-31` or a
  serial); `minLength` / `maxLength` → text length; `boolean` → TRUE, FALSE;
  `required` → "ignore blank" off. A column rule covers the column under the
  titles to the last row.
- **Not written, and listed** on the console and the status line: `pattern`,
  `noneOf`, `unique` (SP-5401); two checks in one rule (SP-5402); a list with
  a comma in a value or over 255 characters (SP-5403); an unreadable bound
  (SP-5404); a missing column or sheet (SP-5405).
- **The workbook's own rule wins** on its cells (SP-5406); a rule that checks
  the same thing joins it instead of being repeated.
- `.xlsx` uploads only; a CSV download carries no rules.

## Pitfalls

- **Never silent:** an unknown key, word, type or version, a sheet, title or
  cell the workbook lacks, or a bad pattern becomes one `note` error (codes
  SP-6010 to SP-6025) — read the panel after changing the file.
- An unknown `version` applies no rule at all.
- The file is authored by the host; `@sheetpane/validation` reads rules saved
  in the workbook. They are different things — until the download writes the
  file's rules into the workbook (above), where Excel and sheetpane then agree.

## Related

[sheetpane-column-rules](../sheetpane-column-rules/SKILL.md) · [sheetpane-errors](../sheetpane-errors/SKILL.md) · [sheetpane-security](../sheetpane-security/SKILL.md)
