---
name: sheetpane-troubleshoot
description: Use when sheetpane misbehaves in a host - a blank grid, a file refused, an SP-xxxx code in the console, SSR crashes, CORS on src, copy not working, rules errors that look wrong. Not for designing a feature.
license: MIT
metadata:
  audience: host
---

# Troubleshooting

**Every message carries a code** `SP-xxxx` with an entry in
[`docs/ERRORS.md`](https://github.com/arpitarya/sheetpane/blob/main/docs/ERRORS.md) — meaning, cause, fix
([SR-CODES](https://github.com/arpitarya/sheetpane/blob/main/records/0117_CODES.md)). Read `error.spCode` (or `codeOf(error)`
from `@sheetpane/export`) instead of matching message text.

| symptom | likely cause | fix |
|---|---|---|
| the grid is blank or 320 px tall | the element has no definite height | give it a height or a sized flex parent ([sheetpane-embed](../sheetpane-embed/SKILL.md)) |
| "Can't open this file", SP-1001 / SP-1005 | not an `.xlsx` or `.csv` | sheetpane reads only those ([SR-LAW-3](https://github.com/arpitarya/sheetpane/blob/main/records/0005_LAW-3-xlsx-and-csv-only.md)) |
| SP-1002 / SP-1003 / SP-1004 | password-protected, legacy `.xls`, or encrypted | ask for an unprotected `.xlsx`; nothing is decrypted |
| SP-1006 / SP-2013 | over the size limits | split the file |
| SP-1008 "Reading .xlsx needs a DOM" | `read()` called on the server | read in the browser; the elements are client-only |
| nothing renders on a server-rendered page | the import is safe in Node and registers nothing without `customElements` (SR-LAW-8) — the elements upgrade only in the browser | make sure the client bundle imports `@sheetpane/grid` (a Next.js client component); load files in the browser |
| `src` fails, SP-3015 | CORS or a 404 on the URL | serve the file from the same origin or with CORS; `src` is a plain GET |
| copy does nothing; a status-line note | the clipboard needs a secure context | serve over https or localhost |
| no errors panel content | different `pane` on the two elements | use one `pane` string on both |
| SP-3002 unknown plugin | `plugins="x"` without importing the package | `import '@sheetpane/x'` (or `/ui`) first |
| SP-3006 two providers for a hook | two formula plugins | one `derive` provider per pane |
| SP-3010 a plugin set a font family | a plugin broke SR-LAW-5 | fix the plugin; fonts are the host's |
| rules notes SP-6010 to SP-6025 | the rules file has a typo, a missing title or sheet | read the note: it names the key, the title or the sheet |
| SP-6003 a value was refused | a rule set to `block` | the message names the rule; the value was not stored |
| a formula cell looks stale | no `@sheetpane/formulas` | install it, or accept the saved value (marked ≈) |

## Gathering facts

- `el.workbook.getSnapshot()` — load state (with `spCode`), selection, mode.
- `el.workbook.getErrors()` — every error, with `code` on machine notes.
- `el.workbook.pluginIds` — which plugins this pane runs.

## Related

[sheetpane-setup](../sheetpane-setup/SKILL.md) · [sheetpane-security](../sheetpane-security/SKILL.md) · [`docs/ERRORS.md`](https://github.com/arpitarya/sheetpane/blob/main/docs/ERRORS.md)
