---
type: Handoff
name: W-08
description: "Research filed 2026-10-18 for Arpit's export package (W-03): the input object, how faithful and how deterministic the output is, and the CSV defaults."
item: W-08
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-fable-5-1)"
ball: cowork
---

# W-08 — Research: what the export package takes in and gives out

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Fix the shape of the object the package accepts | one input both apps and sheetpane use | ✅ |
| 2 | Choose how numbers, text and merged cells are written | files that behave like Excel's own | ✅ |
| 3 | Choose between same-bytes-every-time and smaller files | an export that can be audited | ✅ |
| 4 | Choose CSV defaults, including the formula-injection guard | CSVs that are safe to open | ✅ |
| 5 | Arpit picks a shape from the compare doc | W-03 can start | ✅ 2026-10-18 — "resolve all the blockers" |

**Arpit, 2026-10-18:** *"Accept a JavaScript object and emit an Excel or CSV file."*

**Model:** Cowork — a reading-and-weighing task with no code (SR-WORK-OPEN-QUEUE rule 37a).

**Closed 2026-10-18.** Verdict: [`work/compare/export-shape.compare.md`](../compare/export-shape.compare.md). Arpit ruled *"resolve all the blockers"*; the verdict was drafted in-session and is his to override — the reopen-trigger is in the doc.

## Goal

A compare doc, `work/compare/export-shape.compare.md`, with a verdict, that
W-03 builds from.

## The questions

1. **Input.** `{ sheets: [{ name, rows, merges?, columnWidths? }] }` — or rows as
   objects with headers; whether a sheet can be hidden; whether a title row is
   just a merged first row.
2. **Cell types.** Everything as text (matches "plain text") vs numbers and
   booleans as typed cells (Excel can sum them). Shared strings vs inline
   strings (size vs simplicity).
3. **Determinism vs size.** ZIP store (byte-identical everywhere) vs deflate
   via `CompressionStream` (smaller; bytes may differ by engine) vs a bundled
   deflate.
4. **CSV defaults.** Delimiter, UTF-8 BOM (Excel needs it for accents),
   CRLF vs LF, and formula injection: escape `=` `+` `-` `@` by default (safe,
   but changes data), opt-in, or off.
5. **Output type.** `Uint8Array`, `Blob`, or both; a `download(name)` helper in
   this package or in `sheetpane`.
6. **Runtimes.** Browser only, or Node 20+ too (servers generating files) — see B-024.
7. **Fidelity (L6).** Export carries every change; B-019 (`unruled`) asks whether
   it also keeps what sheetpane does not show — charts, comments, defined names.
   Writing from a plain object cannot; patching the original ZIP can. Lay both
   out for Arpit.
8. **Multi-sheet to CSV.** CSV holds one sheet: the active sheet, one file per
   sheet, or a refusal (L6 Consequences).

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · doc | the compare doc exists with verdict, options, matrix, consequences, references, reopen-trigger | ✅ |
| 2 · evidence | at least one sample file per option opened in Excel and LibreOffice, or a cited source for each claim | ✅ |
| 3 · ruling | Arpit picks; the pick is written into W-03 and the compare doc | ✅ |

## Blockers

None.

## Record affected

**No SR affected** — the verdict feeds W-03's record.

## Hazards

- **Escaping changes the data.** An auditor comparing an export with the
  upload must know which cells were escaped — say how that is reported.

## Reference

- [`../reference/specs/zip/zip-subset-notes.md`](../reference/specs/zip/zip-subset-notes.md) §Determinism.
- [`../reference/specs/csv/`](../reference/specs/csv/) — RFC 4180 summary, W3C tabular model, OWASP CSV injection.
- [`../reference/README.md`](../reference/README.md) §SpreadsheetML.
