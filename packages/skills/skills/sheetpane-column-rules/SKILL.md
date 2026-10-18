---
name: sheetpane-column-rules
description: Use when the host checks what users type by column title in code - columns, validate(ctx, signal), on-invalid flag or block, header-row. Not for rules shipped as a JSON file (sheetpane-rules-file) or the workbook's own validation (sheetpane-plugins).
license: MIT
metadata:
  audience: host
---

# Column rules

Rules by column title, as plain JSON, plus an optional check function. Each
failure is an error with `author: "host"` in `<sheetpane-errors>`, resolving
itself when the cell passes ([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) decisions 22–22c).

## Example

```js
excel.columns = {
  Name:   { required: true },
  Email:  { pattern: '^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$', unique: true },
  Age:    { type: 'integer', min: 18, max: 99, onInvalid: 'block' },
  Status: { oneOf: ['Active', 'Inactive'], severity: 'warning' },
};
excel.validate = async (ctx, signal) =>
  ctx.column.header === 'Email' && ctx.phase !== 'input' && (await api.taken(ctx.value, { signal }))
    ? { severity: 'error', message: 'Email already used' } : null;
```

## The words

`required`, `type` (`text`, `number`, `integer`, `date`, `boolean`), `min`,
`max`, `minLength`, `maxLength`, `pattern`, `oneOf`, `noneOf`, `equals`,
`unique`, `message`, `note`, `severity`, `onInvalid` ([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) decision 22a).

## Phases

| phase | when | what happens |
|---|---|---|
| `input` | 150 ms after typing stops | an outline and a message at the cell bar; nothing stored |
| `commit` | Enter, Tab, blur, paste | `flag` (default) stores and lists an error; `block` refuses the value |
| `load` | the file opens, or rules change | every row, in idle-time slices, progress in the status line |

`validate(ctx, signal)` gets `{phase, sheet, ref, row, column, value, was,
original, rowValues}` — `rowValues` keyed by title; a newer edit aborts the
older check through `signal`.

## Pitfalls

- Titles match trimmed and case-insensitive in the `header-row` row; a
  missing or duplicated title becomes one `note`, never silence.
- Only a JSON rule or a **synchronous** result can `block`; an async result
  can only flag.
- `pattern` is not tested on values over 10,000 characters; avoid patterns
  that backtrack catastrophically — they run on the page.
- Setting `columns` again re-checks every row and removes host errors no
  longer produced; people's errors are never touched.
- Rules belong to the pane: `workbook.setColumnRules({...})` does the same
  without an element.

## Related

[sheetpane-rules-file](../sheetpane-rules-file/SKILL.md) · [sheetpane-events](../sheetpane-events/SKILL.md) · [sheetpane-security](../sheetpane-security/SKILL.md)
