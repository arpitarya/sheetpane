---
type: Handoff
name: W-53
description: "Arpit, 2026-10-19: per-run formatting inside a cell read on import, drawn by the styles plugin, kept byte-for-byte on export when the cell is untouched — Group 1 of the features pdfsuite's spec work needs from sheetpane."
item: W-53
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Claude Code (claude-opus-5-5), closed"
ball: agent
---

# W-53 — Rich text: keep a cell's formatted runs (one word in italic) on import and draw them

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Import: `ImportedSheet.runs` — `{ B4: [{ text, b, i, u, strike, color, sz, vertAlign }] }` from `<si><r><rPr>` and inline strings; `rows` and `text` unchanged | a host can read which word is italic | ✅ |
| 2 | Grid + styles: draw runs as spans when `styles` is on; plain text when off | the sheet looks like Excel | ✅ |
| 3 | Edit: editing a rich cell warns that its formatting will go and writes plain text; untouched rich cells stay byte-identical on export | no silent loss | ✅ |

**Arpit, 2026-10-19:** *"look at PDF suite and think about what all features could be needed just from Excel point of view that can be added into sheet pane … consider it built and consider it published. What else?"* — then *"do some research. What can be created as plugin? What should be part of existing packages? Classify it into those and create work items for all of these. Group 1, Group 2, and Group 3."*

**Group 1 — the host's review flow cannot work without it.** **Where it lives:** **Existing packages — `@sheetpane/import` (read the runs) and the `@sheetpane/styles` plugin (draw them)**, with a small render path in core `@sheetpane/grid`.

**Model:** Sonnet: a reader addition and a render path; the format is well defined.

## Goal

Per-run formatting inside a cell read on import, drawn by the styles plugin, kept byte-for-byte on export when the cell is untouched.

**Why a host needs it:** pdfsuite (arpitarya/pdf-testing-suite) SR-SPEC-INTAKE decision 10: one italic word in a wording cell becomes a per-word style assertion. Today shared strings are flattened by `richText()`, so the formatting is lost.

**Why here and not elsewhere:** The data belongs to the reader. Drawing belongs to the styles plugin, but `decorate` styles a whole cell, so the grid needs a way to render spans when runs exist.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · import | `runs` for shared and inline strings, phonetic runs ignored; the built-in XML reader matches (parity test) | ✅ `ImportedSheet.runs` — `TextRun` `{ text, b?, i?, u?, strike?, color?, sz?, vertAlign? }` per `<r>`, shared and inline, only for a rich string (two or more runs, or one formatted run); `<rPh>` left out, `<rFont>` never read; cells sharing a string share one array; CSV `{}`; DOMParser–minixml parity (SR-IMPORT decision 12) |
| 2 · draw | styles plugin renders runs; never a font family (L5) | ✅ the grid's render path: optional `decorateRuns(cell)` on the `decorate` hook, `cell.runs` while the value is the file's, `store.runs()` / `store.decorateRuns()` (allow-listed, SP-3010 on a family, plain when the text does not match), spans inside `.v` (SR-GRID 15c, 17); `@sheetpane/styles` draws weight, style, decoration, size and colour against the cell's own font, super/subscript (SR-STYLES 9) |
| 3 · edit | the warning; plain text written; untouched cells byte-identical through `patchXlsx` | ✅ editing a rich cell shows a cell-bar chip (`data-sp="rich-text"`, "Mixed formatting — an edit saves plain text") and `sheetpane-editstart` carries `richText: true`; the edit stores plain text, written as an inline string; `sharedStrings.xml` and every untouched rich cell byte for byte, also with a restyle elsewhere. Opening the result in Excel → W-30 DoD 3 |
| 4 · tests · docs | import, render and round-trip tests; SR-IMPORT, SR-STYLES; skill `sheetpane-plugins`; CHANGELOG | ✅ `packages/import/test/runs.test.ts` (7), `packages/grid/test/runs.test.ts` (11), `packages/styles/test/runs.test.ts` (10); SR-IMPORT 2, 3, 12; SR-GRID 9, 9a, 15c, 17; SR-STYLES 9; SR-SKILLS (the two skills); skills `sheetpane-plugins`, `sheetpane-plugin-author`; the import, grid and styles READMEs; manifest and typings, `llms-full.txt`, the Claude plugin regenerated; CHANGELOG |

## Blockers

None.

## Record affected

SR-IMPORT · SR-STYLES · SR-GRID (render path).

## Hazards

- Memory: runs only for cells that have more than one run.

## Reference

- The classification and grouping: this item's siblings W-50 – W-69, filed together on 2026-10-19.
- The host's side: pdfsuite (arpitarya/pdf-testing-suite) — `work/open/W-46-sheet-viewer.md`, `work/open/W-47-sheet-editor.md`, `records/0101_SPEC-intake.md`, `work/design/Spec-*.dc.html`, `Sheet-Editor.dc.html`.
- The plugin contract: `packages/grid/src/plugins/types.ts` (six hooks, six slots).

## The prompt to paste

```text
Build W-53 in arpitarya/sheetpane. Read CLAUDE.md, work/INTERVIEW.md, then
work/open/W-53-rich-text-runs.md and every record it names. Work through the
Definition of done in order, with a test before each next row. Update the
records, OPEN-WORK.md, IMPLEMENTATION.md, CHANGELOG.md, WORKLOG.md and NOW.md
in the same change. Close by moving the file to archive/open/.
```
