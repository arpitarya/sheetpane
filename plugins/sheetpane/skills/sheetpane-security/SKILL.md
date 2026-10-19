---
name: sheetpane-security
description: Use when sheetpane handles untrusted uploads or runs under a strict CSP - what the grid reads and never sends, regexes in rules, CSV formula injection, sandboxed iframes, styles in shadow DOM. Not for general web security.
license: MIT
metadata:
  audience: host
---

# Security

## What sheetpane does with a file

- It is read **in the browser tab**; nothing is uploaded. The only network
  request the grid makes is the GET for `src` (and `rules-src`) the host
  wrote, and it sends nothing — no file, cell, edit, error or telemetry
  ([SR-LAW-11](https://github.com/arpitarya/sheetpane/blob/main/records/0013_LAW-11-workbook-stays-in-the-browser.md)).
- Only `.xlsx` and `.csv` are read ([SR-LAW-3](https://github.com/arpitarya/sheetpane/blob/main/records/0005_LAW-3-xlsx-and-csv-only.md));
  macros, external links and legacy `.xls` are never run or read;
  password-protected files are refused, not decrypted.
- ZIP bombs: entry and total size limits refuse oversized packages
  (SP-1006, SP-2013).
- Untouched parts of an `.xlsx` are copied byte for byte on export
  ([SR-EXPORT](https://github.com/arpitarya/sheetpane/blob/main/records/0103_EXPORT.md)) — sheetpane does not sanitise what it
  did not change.

## Protected sheets

A file's protection is honoured in Edit, with no plugin
([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) decision 21d):

- On a protected sheet, a locked cell (Excel's default) refuses typing, paste
  and Delete — `sheetpane-editcancel` with `reason: 'locked'` and SP-3020,
  *Locked in the file*; its unlocked cells edit as usual. A formula marked
  hidden shows its value only.
- A protected workbook structure keeps its sheets: hide and unhide are
  disabled with the reason. Ask `store.structureLocked()` before a
  structural edit of your own.
- sheetpane **never reads, checks or removes a protection password** — it
  knows only that one is stored (`hasPassword`). Protection in a file is a
  guard against accidents, not access control: anyone with the file can
  remove it in Excel.
- `protection="ignore"` on `<sheetpane-excel>` sets the file's protection
  aside for the pane. That is the host's decision and the host's to justify;
  the download still carries the file's protection unchanged.

## CSV formula injection

Exported CSV cells starting with `=`, `+`, `-` or `@` are guarded so a
spreadsheet app does not run them ([SR-EXPORT](https://github.com/arpitarya/sheetpane/blob/main/records/0103_EXPORT.md)); the
export reports which cells it guarded.

## Rules

`pattern` in column rules and rules files is a regular expression that runs
on the page. It is not tested on values over 10,000 characters, but a
catastrophic pattern can still freeze the tab — review rules files like code
([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) decision 22a).

## CSP and embedding

- No inline `<script>` and no `eval`. The grid writes a `<style>` element
  into each shadow root and positions cells with `style` attributes, so a
  CSP needs `style-src 'unsafe-inline'`. The formulas plugin instantiates
  WebAssembly — allow `'wasm-unsafe-eval'` if `script-src` is strict.
- In a sandboxed iframe, Download needs `allow-downloads`
  ([SR-DOWNLOAD](https://github.com/arpitarya/sheetpane/blob/main/records/0101_DOWNLOAD.md)).

## Related

[sheetpane-troubleshoot](../sheetpane-troubleshoot/SKILL.md) · [sheetpane-rules-file](../sheetpane-rules-file/SKILL.md)
