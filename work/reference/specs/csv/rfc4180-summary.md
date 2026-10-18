---
type: Reference
description: "RFC 4180 (CSV) in summary — the full text could not be downloaded from this machine; read the source before relying on a detail."
source: "https://www.rfc-editor.org/rfc/rfc4180"
fetched: 2026-10-18
---

# RFC 4180 — Common Format and MIME Type for CSV Files (summary)

> ⚠ **A summary, not the text.** rfc-editor.org and ietf.org are not reachable
> from the machine that built this folder. Read the RFC at the source link
> above before treating any detail here as exact. The verbatim W3C model of
> tabular data, which builds on RFC 4180, is beside this file:
> [`w3c-csvw-tabular-data-model.html`](w3c-csvw-tabular-data-model.html).

## The seven rules (§2)

1. **Records end with CRLF.**
2. **The last record may or may not end with a line break.**
3. **An optional header line** may come first, with the same number of fields.
4. **Fields are separated by commas.** Spaces are part of the field. No comma after the last field.
5. **Fields may be wrapped in double quotes.** An unquoted field must not contain a double quote.
6. **Quote a field that contains CRLF, a double quote or a comma.**
7. **Escape a double quote inside a quoted field by doubling it** — `"a ""b"" c"`.

## Grammar (§2, ABNF, paraphrased)

```text
file        = [header CRLF] record *(CRLF record) [CRLF]
header      = name *(COMMA name)
record      = field *(COMMA field)
field       = escaped / non-escaped
escaped     = DQUOTE *(TEXTDATA / COMMA / CR / LF / 2DQUOTE) DQUOTE
non-escaped = *TEXTDATA
TEXTDATA    = any printable character except DQUOTE and COMMA
```

## MIME type (§3)

- **`text/csv`**; no required parameters.
- **Optional `charset`** (US-ASCII is the stated common case; sheetpane uses UTF-8).
- **Optional `header`** — `present` or `absent`.
- **Security:** CSV is passive text, but a field can carry data meant to exploit a
  reader. For the spreadsheet-specific risk — formula injection — see
  [`owasp-csv-injection.md`](owasp-csv-injection.md).

## What real files do that the RFC does not say

- **Excel writes `;` as the separator** in locales whose decimal mark is `,`.
- **Excel needs a UTF-8 BOM** (`EF BB BF`) to open UTF-8 CSV correctly on Windows.
- **Line endings are often bare LF.** A tolerant reader accepts CRLF, LF and CR.
