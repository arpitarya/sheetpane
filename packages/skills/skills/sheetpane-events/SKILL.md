---
name: sheetpane-events
description: Use when a host reacts to what the user does in the sheet - selection, hover, typing, saving, refusing a value, sheet tabs - or outlines cells with highlight(). Not for column checks (sheetpane-column-rules) or the error list (sheetpane-errors).
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

## Rows and columns inserted or deleted (W-52)

In Edit, the cell menu, the header menu, Ctrl/⌘+Shift+= and Ctrl/⌘+− insert
and delete rows and columns; a host calls `excel.workbook.insertRows(sheet,
at, count)` (also `deleteRows`, `insertCols`, `deleteCols`; `at` is 0-based).
Each is one `sheetpane-change` with `kind: 'structure'`, `op`
(`insertRows` · `deleteRows` · `insertCols` · `deleteCols`), `at`, `count`
and `ref` the span (`5:6`, `C:D`); undo fires the inverse. Nothing else fires
per moved cell: whatever a host keyed by address — saved errors excepted, they
move — it moves itself. A refusal (a merge cut, a pivot moved, a table cut,
cells pushed off the sheet) is `false` from the method, a greyed menu item with
its reason, and an `SP-3017`…`SP-3020` warning; `workbook.structureRefusal(op)`
asks first.

```js
excel.addEventListener('sheetpane-change', (e) => {
  if (e.detail.kind === 'structure') shiftMyAnnotations(e.detail); // { sheet, op, at, count }
});
```

## Pointing at cells — hover and highlight (W-56)

`sheetpane-hover` names the cell under a **mouse or pen** pointer:
`{sheet, ref, column}` (a merge by its top-left), at most once per frame and
only when the cell changes, `null` when the pointer leaves the cells. A finger
never hovers. It is not a selection.

`excel.highlight(ranges, options?)` outlines cells **without selecting them**
— `'B3'`, `'B3:D8'`, `'Data!B3'` or `{ ref, sheet?, tone? }`; options `tone`
(`info` · `pass` · `fail`), `label` (shown in the status line, said once by a
screen reader), `pinned` (kept across a sheet switch), `reveal` (scroll it into
view). The outline lets clicks through, is not a change, not undone, not
exported. Each call replaces the last; `clearHighlight()` removes it; it
returns how many ranges it drew (a bad ref or a missing sheet is skipped).

```js
// "hover a box, its cell lights up — hover a cell, its box does"
excel.addEventListener('sheetpane-hover', (e) => viewer.outline(e.detail ? boxFor(e.detail.ref) : null));
viewer.onHover = (box) => (box ? excel.highlight(box.cell, { tone: box.ok ? 'pass' : 'fail', label: box.name }) : excel.clearHighlight());
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
