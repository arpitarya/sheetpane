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

## Pitfalls

- **Never silent:** an unknown key, word, type or version, a sheet, title or
  cell the workbook lacks, or a bad pattern becomes one `note` error (codes
  SP-6010 to SP-6025) — read the panel after changing the file.
- An unknown `version` applies no rule at all.
- The file is authored by the host; `@sheetpane/validation` reads rules saved
  in the workbook. They are different things.

## Related

[sheetpane-column-rules](../sheetpane-column-rules/SKILL.md) · [sheetpane-errors](../sheetpane-errors/SKILL.md) · [sheetpane-security](../sheetpane-security/SKILL.md)
