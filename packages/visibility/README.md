# @sheetpane/visibility

**Hide and unhide rows, columns and sheets in `<sheetpane-excel>` — as changes, written into the download.**

The grid already honours what a file hides, marks it (◂▸ / ▴▾ on the headers, a double line, a
*⊘ n hidden* button for sheets) and lets anyone show it for viewing. This plugin adds editing, in
Edit:

```js
import '@sheetpane/visibility/ui';
excel.setAttribute('plugins', 'visibility');
```

| action | where | Windows / Linux | Mac |
|---|---|---|---|
| Hide rows / columns | the selection bar, the cell and header menus | Ctrl+Alt+9 / Ctrl+Alt+0 | ⌘⌥9 / ⌘⌥0 |
| Unhide rows / columns (select across the gap) | the same, and a click on a marker | Ctrl+Shift+9 / Ctrl+Shift+0 | ⌘⇧9 / ⌘⇧0 |
| Group / Ungroup (outline) | the selection bar, the header menu | Alt+Shift+→ / Alt+Shift+← | ⌥⇧→ / ⌥⇧← |
| Hide sheet | right-click a tab (or Shift+F10 on it) | — | — |
| Unhide sheet | the banner on a hidden sheet opened from *⊘ n hidden* | — | — |

Excel's own Ctrl+9 / Ctrl+0 belong to the browser, so the keys are Google Sheets'. On Windows,
Ctrl+Shift+0 is often taken by the input-language hotkey — the header menu always works.

- **Changes:** hiding is counted once per sheet and axis, undoable, and the download carries it
  (`patchXlsx`'s `hidden` option). Revealing for viewing never is.
- **Rules:** the last visible sheet cannot be hidden ("A workbook needs one visible sheet"); a CSV
  stores no hidden state, so the controls are disabled there.
- **Headless:** `visibility()` from `@sheetpane/visibility`, and the actions `setSpanHidden`,
  `setSheetHidden`, `hiddenIn`, `canHideSheet`, `spanOf`.

Spec: [SR-VISIBILITY](../../records/0121_VISIBILITY.md). MIT.
