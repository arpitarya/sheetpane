---
name: sheetpane-plugins
description: Use when a host needs more than review - number formats, live formulas, cell styles, data validation, conditional formats, pictures, charts or comments - and must pick and enable plugins. Not for writing a plugin (sheetpane-plugin-author).
license: MIT
metadata:
  audience: host
---

# Choosing and enabling plugins

With no plugin the grid is the plain review tool: values as stored, saved
formula results, no fills. Each feature is a package that plugs into the one
workbook ([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) decisions 17–19).

| feature | package | adds | record |
|---|---|---|---|
| every Excel number format | `@sheetpane/numfmt` | `1 1/4`, `$1,234.50`, locales; a format dropdown | [SR-NUMFMT](https://github.com/arpitarya/sheetpane/blob/main/records/0109_NUMFMT.md) |
| live formulas | `@sheetpane/formulas` | IronCalc recalculation, typed formulas, ⟳ marks | [SR-FORMULAS](https://github.com/arpitarya/sheetpane/blob/main/records/0111_FORMULAS.md) |
| cell styles | `@sheetpane/styles` | fills, fonts, borders, alignment; rich text (one italic word) as runs; the format row | [SR-STYLES](https://github.com/arpitarya/sheetpane/blob/main/records/0110_STYLES.md) |
| the workbook's data validation | `@sheetpane/validation` | rule failures as errors, list arrows | [SR-VALIDATION](https://github.com/arpitarya/sheetpane/blob/main/records/0108_VALIDATION.md) |
| conditional formatting | `@sheetpane/condfmt` (needs styles) | colour scales, data bars, rule fills | [SR-CONDFMT](https://github.com/arpitarya/sheetpane/blob/main/records/0114_CONDFMT.md) |
| pictures | `@sheetpane/images` | images at their anchors | [SR-IMAGES](https://github.com/arpitarya/sheetpane/blob/main/records/0107_IMAGES.md) |
| charts | `@sheetpane/charts` (needs images) | bar, column, line, pie, scatter as SVG | [SR-CHARTS](https://github.com/arpitarya/sheetpane/blob/main/records/0113_CHARTS.md) |
| comments | `@sheetpane/comments` | file comments in, the review out as threads | [SR-COMMENTS](https://github.com/arpitarya/sheetpane/blob/main/records/0112_COMMENTS.md) |

## Enable

```js
import '@sheetpane/grid';
import '@sheetpane/numfmt/ui';     // registers "numfmt" with its controls
import '@sheetpane/formulas/ui';
```
```html
<sheetpane-excel pane="q3" plugins="numfmt formulas"></sheetpane-excel>
```

Importing a package registers it for the page; the `plugins` attribute turns
it on per element. Import `@sheetpane/x` for the headless plugin, or
`@sheetpane/x/ui` for it with its toolbar controls. Without the attribute:
`excel.workbook = createWorkbook({ plugins: [numfmt(), formulas()] })`.

## Pitfalls

- **The set is fixed per pane** once the pane exists: put `plugins` on the
  first element of the pane ([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) decision 18).
- **Peers:** condfmt draws after styles — list both; charts places with
  images' anchors — list both.
- **Rich text** (a cell with one word in italic) is read by `@sheetpane/import`
  always (each sheet's `runs`) but drawn only with `styles`; editing such a cell
  writes plain text — the cell bar warns, and `sheetpane-editstart` carries
  `richText: true` so a host can refuse the edit.
- `@sheetpane/formulas` loads its WASM only on the first formula; a
  workbook without formulas never fetches it.
- `@sheetpane/validation` reads rules **saved in the workbook**; your own
  checks are [sheetpane-column-rules](../sheetpane-column-rules/SKILL.md) or a
  [rules file](../sheetpane-rules-file/SKILL.md).

## Related

[sheetpane-setup](../sheetpane-setup/SKILL.md) · [sheetpane-plugin-author](../sheetpane-plugin-author/SKILL.md)
