---
name: sheetpane-errors
description: Use for the review list - <sheetpane-errors>, the SheetpaneError schema, getErrors()/setErrors(), sheetpane-errors and sheetpane-reveal, error types. Not for rule-made errors (sheetpane-column-rules) or server storage (sheetpane-backend).
license: MIT
metadata:
  audience: host
---

# The review: errors and `<sheetpane-errors>`

A review is a list of **errors** — "this cell is wrong, it should be this" —
held in the pane's workbook with the cells, so the sheet and the panel always
show the same list
([SR-LAW-7](https://github.com/arpitarya/sheetpane/blob/main/records/0009_LAW-7-surfaces-always-in-sync.md)).
The element is specified by
[SR-ERRORS](https://github.com/arpitarya/sheetpane/blob/main/records/0106_ERRORS.md);
the schema and the store by
[SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md)
decision 5.

## The element

| kind | name | what |
|---|---|---|
| attribute | `pane` | the same id as the sheet's |
| attribute | `author` | written on errors added here, and as who accepted one (W-69) |
| attribute | `readonly` | a sign-off screen: no form, Resolve, Accept…, Delete, Undo or Redo (SR-ERRORS decision 7) |
| attribute | `plugins`, `theme` | as on the sheet |
| property | `errors`, `errorTypes`, `readOnly`, `workbook` | |
| property | `renderDetail` | the host's extra detail in an open row (W-68) — see below |
| method | `getErrors()`, `setErrors(list, { plugins })` | |
| event | `sheetpane-errors {errors, plugins}` | the list changed — the one to persist |
| event | `sheetpane-reveal {error}` | **Show in sheet** was pressed: switch to the sheet's tab or open the pop-up |
| event | `sheetpane-change`, `sheetpane-select`, `sheetpane-history` | as on the sheet, for actions taken here |

## An error

Plain JSON, schema `v: 1` (`SheetpaneError`, exported as a type):

```json
{ "v": 1, "id": "ERR-0003", "sheet": "Holdings", "range": "F7", "type": "wrong-value",
  "severity": "error", "found": "7.50%", "expected": "0.75%", "message": "Fee rate is 10x the tier",
  "cellChanged": false, "status": "open", "matchesExpected": false, "author": "Asha",
  "createdAt": "2026-10-18T09:12:00.000Z" }
```

- **`found`** is the uploaded text, frozen; it never follows an edit.
- **`matchesExpected`** turns true when the cell shows `expected` — it never
  resolves the error. A person resolves it.
- **`author`** is the element's `author`, or `workbook` / `file` / `host`
  for errors a plugin or a rule wrote — those are read-only and resolve
  themselves (SR-GRID decision 19b).
- Ids are `ERR-0001…`, never reused in a session.

### An error with no cell

A finding about a whole sheet or the workbook has no cell, and is never put
on A1 (W-55):

```js
excel.workbook.addError({ sheet: 'Pages', range: '', type: 'other', severity: 'error', message: 'No Pages List' }); // the whole sheet
excel.workbook.addError({ sheet: '', range: '', type: 'other', severity: 'warning', message: 'A listed tab has no sheet' }); // the workbook
```

- The list shows a **Workbook** group, then each sheet's whole-sheet
  errors, above the cell errors; a whole-sheet error counts on its tab.
- **Show in sheet** opens the sheet's tab; for a workbook-level error it is
  disabled (no `sheetpane-reveal`).
- `found` is `""`; no pin, no cell mark; `errorScope(e)` → `cell` · `sheet`
  · `workbook`.
- **Code that parses `range` as A1 must handle `""`.**
- `@sheetpane/comments` does not write them (a comment needs a cell):
  `lastExport.skipped` lists each as `no-cell`, SP-5804.

### The host's data and detail (W-68)

`meta` is yours: any JSON (64 KiB at most, `ERROR_META_MAX`), kept by
`getErrors()` / `setErrors()` and the `sheetpane-errors` envelope, **never
written into the file**. `renderDetail` draws from it, after the message, in
the panel's open row and the sheet's error card — set it on **both**:

```js
excel.workbook.addError({ sheet: 'Spec', range: 'C7', type: 'out-of-range', severity: 'error', meta: { page: 3, measured: '6.63 in' } });
const detail = (e) => (e.meta?.measured ? `The PDF measures ${e.meta.measured}, outside ± 0.06 in` : null);
excel.renderDetail = detail;
panel.renderDetail = detail; // or return a Node: an <img> of the crop, a link
```

- A string is text, never HTML; a Node is yours, placed as it is. Style it
  with `::part(detail)`.
- It runs again only when that error changes (`meta` included).
- A `meta` over the cap or not JSON is dropped (SP-3016); a throwing hook
  shows nothing (SP-3017).
- Keep a reference in `meta` (a page, a box), not the picture's pixels.

### Accepted deviations (W-69)

A known, approved difference should stop counting as a problem without being
deleted. `status` is `open` · `resolved` · `accepted`; an accepted error
carries `acceptedBy`, `acceptedAt` and a **required** `reason`:

```js
excel.workbook.acceptError(e.id, 'Approved by the customer on 18 Oct', { by: 'Ravi' }); // true; one undo step
excel.workbook.updateError(e.id, { status: 'open' }); // Reopen: who, when and why are dropped
```

- In the panel, **Accept…** in an open row asks *Why is this accepted?* and
  writes the element's `author` as who. Not in `readonly`, not on rule or
  file-comment rows.
- Not counted: "n open", the severity chips, the sheet's counts and tab
  counts leave accepted errors out. The **Accepted n** chip lists them.
- **Count open errors with `status === 'open'`**, not `!== 'resolved'`.
- `@sheetpane/comments` writes a reply *Accepted: <reason>* by who accepted
  it, and marks the thread done.
- A blank reason, or a `workbook` / `file` error, is refused (SP-3018).
  `setErrors` brings an accepted error without a reason back as `open`.

## Saving and restoring a review

```js
const excel = document.querySelector('sheetpane-excel');
const panel = document.querySelector('sheetpane-errors');
panel.addEventListener('sheetpane-errors', (e) => save({ errors: e.detail.errors, plugins: e.detail.plugins }));
excel.addEventListener('sheetpane-load', () => {
  panel.setErrors(saved.errors, { plugins: saved.plugins });
}, { once: true });
```

- **Restore after `sheetpane-load`.** Loading a file starts with an empty
  list; a restore before it is wiped.
- **`setErrors()` is a restore, not an edit:** it clears undo (SR-GRID
  decision 7). An error whose cell no longer shows `found` is tagged *stale*,
  never moved.
- **Pass `plugins`** from the saved envelope: a different plugin set shows the
  "formatted differently" notice (SR-ERRORS decision 8).
- The full server round trip is [sheetpane-backend](../sheetpane-backend/SKILL.md).

## Error types

`errorTypes` is the catalog the form offers: `{ id, name, severity, why,
expected }[]`. The default is `DEFAULT_ERROR_TYPES` — Wrong value, Doesn’t
match source, Wrong format, Invalid date, Missing value, Out of range,
Duplicate row, Other (SR-ERRORS decision 6). Set your own on **both**
elements:

```js
import { DEFAULT_ERROR_TYPES } from '@sheetpane/grid';
const types = [...DEFAULT_ERROR_TYPES, { id: 'stale-price', name: 'Stale price', severity: 'warning', why: 'Older than the pricing date.', expected: '' }];
excel.errorTypes = types;
panel.errorTypes = types;
```

Types written by plugins and rules (`validation`, `comment`, `column-rule`,
`cell-rule`) are named from `BUILTIN_TYPE_NAMES` when your catalog does not
name them.

## Show in sheet

```js
panel.addEventListener('sheetpane-reveal', () => { tabs.select('sheet'); /* or: excel.open = true */ });
```

The cell is already selected (selection is shared); the host only makes the
sheet visible (SR-ERRORS decision 4).

## Pitfalls

- **Editing an error object you got from `getErrors()` changes nothing** —
  it is a copy. Use `setErrors()` for a restore.
- **The form lives in the panel** when a panel is connected to the pane, else
  it opens inline in the sheet (SR-GRID decision 13).
- **With `flagging="off"`** nobody can add errors by hand; the panel is then
  where rule errors are read ([sheetpane-rules-file](../sheetpane-rules-file/SKILL.md)).
- **Undo is shared:** Ctrl/⌘+Z in the panel undoes the pane's last action,
  cell edits included (SR-ERRORS decision 9).
- Errors travel inside an `.xlsx` as comments only with
  `@sheetpane/comments` installed ([SR-COMMENTS](https://github.com/arpitarya/sheetpane/blob/main/records/0112_COMMENTS.md)).
