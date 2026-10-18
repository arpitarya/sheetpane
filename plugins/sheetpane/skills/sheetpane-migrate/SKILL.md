---
name: sheetpane-migrate
description: Use when replacing SheetJS, Handsontable or AG Grid with sheetpane - their concepts mapped to sheetpane's elements, events and plugins, and what has no equivalent. Not for a fresh project (sheetpane-setup).
license: MIT
metadata:
  audience: host
---

# Migrating

sheetpane is a **review tool for `.xlsx` and `.csv` files**, not a general
data grid: it shows a file as Excel would, lets a person edit and flag it, and
exports the original with the changes
([SR-LAW-6](https://github.com/arpitarya/sheetpane/blob/main/records/0008_LAW-6-edits-in-memory-export-with-changes.md)).

| concept elsewhere | in sheetpane |
|---|---|
| SheetJS `XLSX.read` / `sheet_to_json` | `read()` from `@sheetpane/import` → `{ sheets: [{ name, rows, text }] }` |
| SheetJS `XLSX.write` | `export()` on the element, or `patchXlsx` / `toXlsx` from `@sheetpane/export` (untouched parts kept byte for byte) |
| Handsontable / AG Grid column definitions and validators | `columns` (column rules) or a rules file |
| `afterChange` / `cellValueChanged` | `sheetpane-change`; refuse with `sheetpane-beforechange` |
| cell renderers | plugins (`format`, `decorate`) — never a font family |
| row data binding | the file is the data; the store (`workbook.value`, `setCell`) |
| comments / notes | `@sheetpane/comments`, and the review in `<sheetpane-errors>` |

## No equivalent (yet)

- Arbitrary JSON data sources — sheetpane opens files.
- A formula editing UI beyond the cell bar; pivots are shown as saved and
  refreshed by Excel ([proposal](https://github.com/arpitarya/sheetpane/blob/main/work/proposals/pivots.md)).
- Formats other than `.xlsx` and `.csv` ([SR-LAW-3](https://github.com/arpitarya/sheetpane/blob/main/records/0005_LAW-3-xlsx-and-csv-only.md)).
- Framework wrappers — the elements are web components; React uses them
  directly ([sheetpane-react](../sheetpane-react/SKILL.md)).

## Related

[sheetpane-setup](../sheetpane-setup/SKILL.md) · [sheetpane-plugins](../sheetpane-plugins/SKILL.md)
