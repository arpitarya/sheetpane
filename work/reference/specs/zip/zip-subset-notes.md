---
type: Reference
description: "The slice of the ZIP format an .xlsx reader and writer needs — written in our own words from PKWARE APPNOTE 6.3.4, which may not be redistributed."
source: "PKWARE APPNOTE.TXT 6.3.4 — https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT"
written: 2026-10-18
---

# ZIP — the subset an `.xlsx` needs

> **Why notes and not the spec.** APPNOTE §1.4.2 forbids redistributing the
> document, and this repo is public. A local copy is fetched into
> `_local/` (gitignored) by the command in
> [`../../README.md`](../../README.md). Section numbers below are APPNOTE's.

**An `.xlsx` is a ZIP of XML parts.** Reading one is: find the central
directory → list the entries → inflate the parts you want. Writing one is the
reverse. Nothing outside this page is needed for sheetpane's scope.

## The layout

```text
[local file header 1][file data 1]
[local file header 2][file data 2]
...
[central directory header 1]
[central directory header 2]
...
[end of central directory record]
```

**All integers are little-endian.**

## Local file header (§4.3.7) — before each entry's data

| field | bytes | sheetpane writes |
|---|---|---|
| signature | 4 | `0x04034b50` |
| version needed to extract | 2 | `20` (2.0 — deflate) or `10` (store) |
| general purpose bit flag | 2 | bit 11 set → names are UTF-8 |
| compression method | 2 | `0` store · `8` deflate |
| last mod file time | 2 | MS-DOS time, see below |
| last mod file date | 2 | MS-DOS date, see below |
| CRC-32 | 4 | of the **uncompressed** bytes |
| compressed size | 4 | |
| uncompressed size | 4 | |
| file name length | 2 | |
| extra field length | 2 | `0` |
| file name | n | e.g. `xl/worksheets/sheet1.xml` |

**Bit 3 (data descriptor).** When set, the CRC and sizes in the local header
are zero and follow the data instead (§4.3.9). Many writers set it. **A reader
must take sizes from the central directory**, never trust the local header.

## Central directory header (§4.3.12) — one per entry, after all data

The local header's fields again, plus: version made by · file comment length ·
disk number start · internal attributes · external attributes · **relative
offset of the local header**. Signature `0x02014b50`.

## End of central directory record (§4.3.16) — the last thing in the file

Signature `0x06054b50` · disk numbers · entries on this disk · total entries ·
**size of the central directory** · **offset of its start** · comment length ·
comment.

**Finding it:** scan backwards from the end for the signature. The comment is
variable-length, so it is not always 22 bytes from the end.

## Values that need care

- **CRC-32** — the standard reflected polynomial `0xEDB88320`, initial value
  `0xFFFFFFFF`, final XOR `0xFFFFFFFF`. A 256-entry table is enough.
- **MS-DOS date and time** (§4.4.6) — date `((year − 1980) << 9) | (month << 5) | day`;
  time `(hour << 11) | (minute << 5) | (second / 2)`.
- **Compression method 8 is raw DEFLATE** (RFC 1951, no zlib header). In a
  browser: `new CompressionStream('deflate-raw')` to write,
  `new DecompressionStream('deflate-raw')` to read — see
  [`../web/`](../web/).
- **ZIP64** (§4.3.14) is only needed past 4 GiB or 65,535 entries — out of
  scope; refuse such files with a clear message.

## Determinism — for an export that can be audited

- **Same input, same bytes** is reachable: fixed entry order, a fixed
  timestamp (1980-01-01 00:00), no extra fields, no comment.
- **DEFLATE output can differ between engines.** If byte-identical output across
  browsers matters, write with **method 0 (store)**, or ship one deflate
  implementation. This is a fork for the export package's research.
