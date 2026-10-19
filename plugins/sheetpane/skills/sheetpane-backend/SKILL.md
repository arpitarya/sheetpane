---
name: sheetpane-backend
description: Use when a host saves the reviewed file and the review on a server and restores them later, or checks a file on the server with check() - the blob, getErrors()/setErrors() JSON, restoring after load. Not for client-only use.
license: MIT
metadata:
  audience: host
---

# The server round trip

The workbook lives in the page's memory
([SR-LAW-9](https://github.com/arpitarya/sheetpane/blob/main/records/0011_LAW-9-memory-is-a-javascript-object.md)); nothing
survives a reload unless the host saves it. Two things to save: **the file**
and **the review**.

**sheetpane itself never sends anything to a server**
([SR-LAW-11](https://github.com/arpitarya/sheetpane/blob/main/records/0013_LAW-11-workbook-stays-in-the-browser.md)). The
`fetch` calls below are your app's code — saving is your choice, not
sheetpane's.

## Save

```js
excel.addEventListener('sheetpane-export', async (e) => {
  e.preventDefault();                                   // save it yourself instead of downloading
  await fetch(`/api/files/${id}`, { method: 'PUT', body: e.detail.blob });
});
errors.addEventListener('sheetpane-errors', (e) =>
  fetch(`/api/reviews/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(e.detail.errors) }));
```

`export()` returns the same blob without a click
([SR-LAW-6](https://github.com/arpitarya/sheetpane/blob/main/records/0008_LAW-6-edits-in-memory-export-with-changes.md)).

## Restore

```js
excel.addEventListener('sheetpane-load', async (e) => {
  if (e.detail.status !== 'ready') return;
  const saved = await (await fetch(`/api/reviews/${id}`)).json();
  excel.setErrors(saved);                               // after the load, never before
}, { once: true });
excel.src = `/api/files/${id}`;
```

`setErrors` is a host restore: it clears undo and keeps ids; machine errors
(rules, the workbook's own validation) are matched by content, not doubled
([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) decision 7; [SR-ERRORS](https://github.com/arpitarya/sheetpane/blob/main/records/0106_ERRORS.md)).

## When the file changed

An error stores `found` — the text the cell showed when it was flagged. A
restored error whose cell no longer shows it is marked **stale**
(`store.isStale(error)`). Show those to the reviewer instead of dropping them.

## The same checks on the server

`@sheetpane/grid/check` runs what the pane runs on load — the rules file,
column rules, an async `validate`, each plugin's `validate` — in Node or a
worker, with no page, and returns the same errors
([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) decision 22f):

```js
import { readFile } from 'node:fs/promises';
import { check } from '@sheetpane/grid/check';
import { validation } from '@sheetpane/validation/check';

const errors = await check(await readFile(path), { name: 'q3.xlsx', rules, columns, validate, plugins: [validation()] });
```

Give it the settings and plugins the page gives the element — the same
options, the same errors; only `id` and `createdAt` differ. It reads the
bytes your server already holds and sends nothing
([SR-LAW-11](https://github.com/arpitarya/sheetpane/blob/main/records/0013_LAW-11-workbook-stays-in-the-browser.md)
decision 2). `@sheetpane/formulas` in Node needs `formulas({ wasm })` with
the engine's `.wasm` bytes (no URL fetch there).

## Pitfalls

- Restoring before `sheetpane-load` loses the review: the load resets the
  pane.
- Save the **export**, not the upload, if you want the edits in the file.
- Author names land in the review JSON (and, with the comments plugin, in
  the `.xlsx`) — personal data.

## Related

[sheetpane-errors](../sheetpane-errors/SKILL.md) · [sheetpane-load-export](../sheetpane-load-export/SKILL.md)
