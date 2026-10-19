---
name: sheetpane-plugin-author
description: Use when writing a sheetpane plugin - the six hooks, the slots and control descriptors, exportOptions, registerPlugin, what a plugin may never do. Not for choosing among the shipped plugins (sheetpane-plugins).
license: MIT
metadata:
  audience: host
---

# Writing a plugin

A plugin is a plain object registered against the one workbook ([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md)
decisions 17–21b; the verdict: [`work/compare/plugins.compare.md`](https://github.com/arpitarya/sheetpane/blob/main/work/compare/plugins.compare.md)).

```ts
import { registerPlugin, type Plugin } from '@sheetpane/grid';

export const shout = (): Plugin => ({
  id: 'shout',
  provides: ['decorate'],
  decorate: (cell) => (typeof cell.value === 'string' && cell.value.endsWith('!') ? { 'font-weight': '700' } : undefined),
  controls: [{ id: 'shout-sel', slot: 'selbar', group: 'shout', label: 'Shout', mode: 'edit',
    run: (store, sel) => store.setCell(sel.sheet, sel.ref, `${store.text(sel.sheet, sel.ref)}!`) }],
});
registerPlugin('shout', () => shout());      // then <sheetpane-excel plugins="shout">
```

## The hooks

| hook | providers | does |
|---|---|---|
| `format` | one per pane | a number's display text |
| `decorate` | many, ordered by `after` | allow-listed CSS for a cell — never `font-family`; optional `decorateRuns(cell)` draws a rich-text cell's `cell.runs` as styled pieces |
| `derive` | one per pane | recalculated cells (never user changes); `evaluate()` optional |
| `validate` | many | error drafts, `author: 'workbook'` / `'file'` / `'host'` |
| `overlay` | many | items in sheet space (`role`, `alt`, `passThrough`) |
| `exportPatch` | many | writes into the `.xlsx` package on export; reads `ctx.exportOptions` |

**Slots** for `controls`: `format-row`, `selbar` (docked in the cell bar and
the right-click menu), `cellbar`, `status` (text), `cell` (a mark where
`appliesTo` accepts), `overlay`. `exportOptions: [{ key, label, default,
applies? }]` adds a switch to the Download menu; `applies(store)` hides it
while it has nothing to do and, while it is on, makes Download export an
untouched workbook instead of handing back the original bytes.

## Rules

- The plugin set is fixed per pane at creation; a duplicate control id, a
  hook without its function, a second `format`/`derive` provider throw.
- A change goes through the store (`setCell`, `setChange`, `setChanges` for
  one undo step) — never into the DOM.
- No font family, ever ([SR-LAW-5](https://github.com/arpitarya/sheetpane/blob/main/records/0007_LAW-5-host-font.md)); no
  network beyond what the host gave.
- Rows and columns inserted or deleted (W-52): the core moves every table of
  `ctx.book` (a new object — re-read it, do not cache by address) and the
  change map; `derive` is told `{ kind: 'restructure', sheet, op, at, count }`
  and returns the whole derived set, as on a load. References a plugin keeps
  itself (chart series, formula text) move with `restructureFormula` from
  `@sheetpane/grid`; `book.part()` already serves chart parts moved.
- Errors and warnings carry an `SP-5x00` code ([SR-CODES](https://github.com/arpitarya/sheetpane/blob/main/records/0117_CODES.md)):
  use `spError` / `spMessage` from `@sheetpane/grid`.

## Related

[sheetpane-plugins](../sheetpane-plugins/SKILL.md) · [the grid README §Plugins](https://github.com/arpitarya/sheetpane/blob/main/packages/grid/README.md)
