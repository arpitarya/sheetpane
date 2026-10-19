# @sheetpane/compare

**What changed between two versions of a workbook — on the sheet in `<sheetpane-excel>`, or as data in Node.**

Pick the base version (the last approved one) and the pane shows what changed since: changed
cells amber, added rows green, moved rows blue, a red line where rows were removed. The status line
sums it up — *Compared with spec-v1.xlsx: 2 sheets · 5 rows · 3 cells changed* — and every change is
an entry in the errors list. Both files are read in the page; nothing is sent anywhere.

```js
import '@sheetpane/compare/ui';
excel.setAttribute('plugins', 'compare');   // Compare… in the cell bar picks the base file

// or the host hands it the base (bytes, a File, or a workbook already read)
import { compareWith } from '@sheetpane/compare/ui';
await compareWith(excel.workbook, baseBytes, { name: 'spec-v1.xlsx', key: 'Account' });
```

| control | where | keys |
|---|---|---|
| Compare… / Compare with another file… | the cell bar (View and Edit) | — |
| Previous change · Next change (wraps) | the cell bar | Alt+Shift+F5 · Alt+F5 |
| Stop comparing | the cell bar | — |
| the summary | the status line | — |

## Headless

```js
import { read } from '@sheetpane/import';
import { diffWorkbooks, summaryText, applyDiff } from '@sheetpane/compare';

const d = diffWorkbooks(await read(was), await read(now), { key: 'Account' });
summaryText(d.summary);    // "2 sheets · 5 rows · 3 cells changed"
d.sheets[0].rows;          // { op: 'added' | 'removed' | 'changed' | 'moved', a?, b?, … }
d.sheets[0].cells;         // { ref: 'D4', was: { value, text, formula? }, now: { … }, what: ['value', 'text'] }
```

- **Sheets** match by name; an unmatched sheet whose rows are mostly another's is *renamed*
  (`renameThreshold`, default 0.5); the rest are added or removed.
- **Columns** match by header title when both header rows hold distinct titles (a renamed title
  pairs with the one column left over), otherwise by position.
- **Rows** match by `key` columns (titles or letters, for every sheet or `{ Sheet: 'ID', '*': … }`)
  — then a row that changed place is *moved*. Without a key, rows are aligned (patience anchors and
  Myers' diff, alike rows paired as *changed*) and a row that changed place is removed and added:
  *moved* is said only when it is certain.
- **Cells** differ by value, display text (a number format) or formula — compared relative to the
  cell, so a formula that only shifted with its row is not a change.
- Also: merges, rows and columns newly hidden or shown, the sheet's state, and the counts of
  data-validation and conditional-format rules.
- `applyDiff(a, d)` rebuilds the newer version's values from the older one — the property the tests
  check on random workbooks. 50,000 rows diff in about 0.1 s (the budget is 0.5 s).

**Agents:** `@sheetpane/mcp`'s `diff_workbooks` tool runs the same function on two paths.

## Notes

- The comparison is the file **as loaded** against the base; edits made in the pane since are not
  part of it. Loading another file into the pane compares it with the same base.
- Until review layers (W-51) land, listing the changes
  replaces the errors list's contents through `setErrors` (a person's own errors are kept), which
  clears undo; with `@sheetpane/comments` a download also writes the changes as comments.
- The tints are `--sp-compare-added`, `--sp-compare-changed`, `--sp-compare-moved` and
  `--sp-compare-removed`; set them to restyle.

Spec: [SR-COMPARE](../../records/0124_COMPARE.md). MIT.
