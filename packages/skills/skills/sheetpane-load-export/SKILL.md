---
name: sheetpane-load-export
description: Use when opening a file in the sheet (src, file, load()) or getting it back (the Download button, export(), sheetpane-export, download()). Not for saving the review (sheetpane-errors, sheetpane-backend) or no-UI read/write (sheetpane-setup).
license: MIT
metadata:
  audience: host
---

# Loading a file, and getting it back

**Two formats only, both ways: `.xlsx` and `.csv`**
([SR-LAW-3](https://github.com/arpitarya/sheetpane/blob/main/records/0005_LAW-3-xlsx-and-csv-only.md)).
**Every change is held in memory, and export carries every change into a copy
of the uploaded file — the upload is never modified**
([SR-LAW-6](https://github.com/arpitarya/sheetpane/blob/main/records/0008_LAW-6-edits-in-memory-export-with-changes.md)).

## Loading — pick one

| you have | write | notes |
|---|---|---|
| a URL | `<sheetpane-excel src="/files/q3.xlsx">` | read with a GET, same-origin credentials, nothing sent ([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) decision 9) |
| a data URL or base64 text | `src="data:…"` or the base64 string | the format is told from the bytes |
| a `File` from an `<input type="file">` or a drop | `excel.file = file` | also `Blob`, `ArrayBuffer`, `Uint8Array` |
| any of the above, with a name you choose | `await excel.load(source, 'q3.xlsx')` | the name decides the extension check |
| nothing yet | leave both empty | the element shows its own drop zone and file picker |

```js
const excel = document.querySelector('sheetpane-excel');
input.addEventListener('change', () => { excel.file = input.files[0]; });
excel.addEventListener('sheetpane-load', (e) => {
  if (e.detail.status === 'ready') console.log(e.detail.name, e.detail.sheets);
  else console.warn('refused:', e.detail.code, e.detail.message);
});
```

**`load()` does not throw on a bad file.** The pane goes to its error state
and `sheetpane-load` fires with `status: 'error'` and the reader's `code`:
`unsupported-format`, `password-or-legacy`, `not-workbook`, `too-large`,
`corrupt`, `needs-dom` ([SR-IMPORT](https://github.com/arpitarya/sheetpane/blob/main/records/0104_IMPORT.md)
decision 6), or `unreadable` when the URL could not be fetched. A password
cannot be removed — the reader does not decrypt (SR-GRID decision 10).

## Getting the file back

| the host wants | do | spec |
|---|---|---|
| the reviewer presses **Download** | nothing — it is in the toolbar, View and Edit | SR-GRID decisions 10, 13 |
| to save the file itself (upload it, store it) | cancel `sheetpane-export` and take `e.detail.blob` | SR-GRID decision 9 |
| the edited file from code | `const blob = await excel.export()` | SR-GRID decision 6 |
| the other format | `excel.export({}, { format: 'csv' })` — the current sheet; `'xlsx'` from a CSV gives one sheet | SR-GRID decision 9 |
| save any bytes as a file | `download(bytes, 'name.xlsx')` from `@sheetpane/export` | [SR-DOWNLOAD](https://github.com/arpitarya/sheetpane/blob/main/records/0101_DOWNLOAD.md) |

**Download** hands back the original bytes when nothing changed, else
`export()`'s copy; its **▾** menu offers the other format and each plugin's
export switches (SR-GRID decision 10).

### Example — send the file to your server instead of the disk

sheetpane never uploads ([SR-LAW-11](https://github.com/arpitarya/sheetpane/blob/main/records/0013_LAW-11-workbook-stays-in-the-browser.md)); this listener is
your app's code, and sending is your choice.

```js
excel.addEventListener('sheetpane-export', async (e) => {
  e.preventDefault();                       // no browser download
  const { blob, name, original, converted } = e.detail;
  await fetch('/api/files/q3', { method: 'PUT', body: blob, headers: { 'x-name': name } });
});
```

`original: true` when the untouched upload is handed back; `converted: true`
when the format differs from the upload's. `export()` fires the same event;
calling it from code returns the blob whatever a listener does.

## What export keeps

- **`.xlsx`:** the upload's ZIP is patched — only changed cells are rewritten;
  every other part (charts, pivots, comments, names, styles) is copied as it
  was, and Excel is asked to recalculate on open
  ([SR-EXPORT](https://github.com/arpitarya/sheetpane/blob/main/records/0103_EXPORT.md)
  decision 3; SR-LAW-6 Consequences).
- **`.csv`:** the sheet with its changes, in the delimiter the file used; text
  that starts like a formula is escaped (SR-EXPORT decision 4).
- **Plugin parts** (number formats, styles, formulas, comments) are written
  by the plugins' `exportPatch` hooks — see
  [sheetpane-plugins](../sheetpane-plugins/SKILL.md). `excel.export({ comments: false })`
  turns the comments switch off for one export
  ([SR-COMMENTS](https://github.com/arpitarya/sheetpane/blob/main/records/0112_COMMENTS.md)
  decision 6).

## Pitfalls

- **A reload loses unexported changes** — memory is the page
  ([SR-LAW-9](https://github.com/arpitarya/sheetpane/blob/main/records/0011_LAW-9-memory-is-a-javascript-object.md);
  SR-LAW-6 Consequences). The element warns on `beforeunload`; persist by
  exporting (see [sheetpane-backend](../sheetpane-backend/SKILL.md)).
- **`src` on another origin needs CORS** on that server; the GET is made by
  the page. A failed fetch shows "Can’t open this file".
- **`.xls`, `.xlsm`, `.ods`, Google Sheets links** are refused by design
  (SR-LAW-3). Convert before loading.
- **Reading `.xlsx` needs a browser** (`DOMParser`) — SR-IMPORT decision 8.
- **`download()` in a sandboxed iframe** needs `allow-downloads`; iOS Safari
  is untested (SR-DOWNLOAD Consequences).

## Related

[sheetpane-events](../sheetpane-events/SKILL.md) (what fires on each edit) ·
[sheetpane-troubleshoot](../sheetpane-troubleshoot/SKILL.md)
