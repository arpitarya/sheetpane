---
name: sheetpane-events
description: Use when a host reacts to what the user does in the sheet - selection, typing, saving, cancelling, refusing a value with sheetpane-beforechange, or switching sheets. Not for column checks (sheetpane-column-rules) or the error list (sheetpane-errors).
license: MIT
metadata:
  audience: host
---

# Following an edit

Every event bubbles, is composed, and fires **once, on the element where the
action happened** ([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) decision 9). Every edit payload names the column as
`{ index, letter, header }`, the header read from the `header-row`
attribute (default 1).

## The order of one edit

| event | fires | detail | cancel it to |
|---|---|---|---|
| `sheetpane-select` | the selected cell moves | `{sheet, ref, column, value}` | — |
| `sheetpane-editstart` | the cell bar opens on a cell | `{sheet, ref, column, value}` | keep the cell read-only |
| `sheetpane-input` | each keystroke, before saving | `{sheet, ref, column, draft, was}` | — |
| `sheetpane-beforechange` | Enter, Tab, blur, Delete, each cell of a paste | `{sheet, ref, column, was, now}` | refuse the value |
| `sheetpane-change` | after saving | `{sheet, ref, kind, was, now}` | — |
| `sheetpane-editcancel` | Esc, or a rule set to `block` refused the value | `{sheet, ref}` (blocked: `reason`, `message`, `code`) | — |
| `sheetpane-sheet` | the sheet tab changes | `{sheet}` | — |

A refused value never reaches the change map, undo, a plugin or the error
list ([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) decision 9). Paste fires `beforechange` once per cell.

## Example — refuse negative units

```js
excel.addEventListener('sheetpane-beforechange', (e) => {
  if (e.detail.column.header === 'Units' && Number(e.detail.now) < 0) e.preventDefault();
});
excel.addEventListener('sheetpane-change', (e) => save(e.detail)); // after it is stored
```

## Other events

`sheetpane-load` (status ready or error, with `spCode` on a refusal),
`sheetpane-errors {errors, plugins}`, `sheetpane-mode {mode}`,
`sheetpane-history`, `sheetpane-export {blob, kind, name, format, converted,
original?}` (cancel it to save the file yourself), `sheetpane-close`
(the pop-up), and on `<sheetpane-errors>` `sheetpane-reveal {error}`.

## Pitfalls

- Listening on `document` works (they bubble and are composed), but two
  sheets on one pane each fire their own — filter by `e.target`.
- `beforechange`'s `now` is the parsed value: a number stays a number in an
  `.xlsx`, a `.csv` cell stays text ([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) decision 3).
- For a rule over a whole column, prefer `columns` / a rules file — they also
  list the failures ([sheetpane-column-rules](../sheetpane-column-rules/SKILL.md)).

## Related

[sheetpane-react](../sheetpane-react/SKILL.md) · [sheetpane-column-rules](../sheetpane-column-rules/SKILL.md) · [the grid README](https://github.com/arpitarya/sheetpane/blob/main/packages/grid/README.md)
