---
type: Handoff
name: W-49
description: "Arpit, 2026-10-18: a plugin for hidden sheets, rows and columns, and everything else about hiding and showing — how it works, how it looks, how to hide and unhide. Core honours and shows what the file hides (like merges and freeze); @sheetpane/visibility adds hide/unhide editing and outline groups."
item: W-49
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-49 — Hide and show: honour what the file hides, mark it, reveal it, and a `@sheetpane/visibility` plugin to hide, unhide and group

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | **Core:** honour the file's hidden rows, columns and sheets, and mark every place something is hidden | the grid looks like Excel, and a reviewer always sees that something is hidden | ✅ |
| 2 | **Core:** reveal hidden things for viewing: a marker click, *Show hidden*, the hidden-sheets list, or *Show in sheet* on an error | nothing can hide an error from a reviewer | ✅ |
| 3 | **Core:** arrows, copy, Delete and totals skip hidden cells; find and validation still see them | what you see is what you act on | ✅ |
| 4 | **Plugin (Edit):** Hide and Unhide rows, columns and sheets, from menus, shortcuts and the markers; written into the download | an editor can tidy a sheet the way Excel does | ✅ |
| 5 | **Core + plugin:** outline groups: draw the file's +/− groups and level buttons; the plugin adds Group and Ungroup | grouped financial sheets read as they were built | ✅ |
| 6 | Records: SR-GRID, SR-IMPORT, SR-EXPORT, and a new SR-VISIBILITY, in the same change | the spec says what ships | ✅ |

**Arpit, 2026-10-18:** *"research and create a plugin for hidden sheets, hidden rows, and anything else that comes to your mind related to hide and show of sheets and columns. How it is going to work, how it is going to look, how to hide, how to unhide, all those things. Create one work item on how that plugin is going to be built. Research and then file."*

**Model:** Opus. Hidden rows and columns change the geometry under the virtualiser, keyboard, selection layer (W-46) and sizes (W-47), and the export has to rewrite three parts of the package.

## Today

What the code does, read on 2026-10-18:

- **Rows and columns.** `@sheetpane/import` reads `hiddenRows` and `hiddenCols`, but the grid ignores them: every hidden row and column is drawn as an ordinary one.
- **Sheets.** The import folds `hidden` and `veryHidden` into one `hidden: boolean`. The grid shows hidden sheets as ordinary tabs in italic with the tooltip *"Hidden in the file"* (SR-GRID decision 10).
- **Not read.** Outline levels (`outlineLevel`, `collapsed`), `<autoFilter>`, and zero-width or zero-height rows and columns.
- **Export.** `patchXlsx` cannot write hidden state.
- **Plugins.** The contract has six hooks, and none of them changes geometry. A plugin alone cannot hide a row without a seventh hook, which is the plugins verdict's reopen-trigger.

## Research (2026-10-18)

| source | what we take |
|---|---|
| [Excel: hide or unhide worksheets](https://support.microsoft.com/en-us/excel/hide-or-unhide-worksheets) | **Hiding:** right-click a tab › Hide. **Unhiding:** Unhide opens a list of hidden sheets, and several can be picked. **Very hidden:** a `veryHidden` sheet never appears in that list ([xlVeryHidden](https://learn.microsoft.com/en-us/office/troubleshoot/excel/hide-sheet-and-use-xlveryhidden)). **No tab cue:** tabs never show that anything is hidden, which is the gap a review tool must close. Excel also refuses to hide the last visible sheet. |
| Excel, rows and columns | **Markers:** a hidden row or column leaves a skipped letter or number and a thicker header border; dragging that border open unhides. **Menus:** right-click › Hide / Unhide. **Outline:** groups draw a gutter with level buttons 1 2 3 and +/−. **Status bar:** Sum and Average ignore hidden rows. |
| [Google Sheets shortcuts](https://www.computerhope.com/shortcut/sheets.htm) | **Hide:** Ctrl+Alt+9 for rows, Ctrl+Alt+0 for columns. **Unhide:** Ctrl+Shift+9 and Ctrl+Shift+0. **Groups:** Alt+Shift+→ groups, Alt+Shift+← ungroups, Alt+Shift+↓ / ↑ expand and collapse. **Markers:** Sheets draws **◂▸ arrow pairs** on the header at a hidden boundary; one click unhides. Excel's Ctrl+9 and Ctrl+0 are taken in a browser (Ctrl+9 switches to the last tab, Ctrl+0 resets zoom), so web grids use Sheets' keys. |
| [ECMA-376 `<row>`](https://webapp.docx4java.org/OnlineDemo/ecma376/SpreadsheetML/row_1.html) · [ST_SheetState](https://webapp.docx4java.org/OnlineDemo/ecma376/SpreadsheetML/ST_SheetState.html) | **Rows:** `hidden` is set whether a row is hidden by hand or by a collapsed outline, plus `outlineLevel` and `collapsed`. **Columns:** `<col>` carries the same attributes over a `min`–`max` span. **Sheets:** `<sheet state>` is `visible`, `hidden` or `veryHidden`. **Workbook view:** `<workbookView activeTab>` must point at a visible sheet. |

## How it works — the split

**Seeing what the file hides is core; changing it is the plugin.** This is the same split as merged cells (SR-GRID 21a: *"a plugin's merge control only calls `setMerge()`"*) and freeze panes. There are two reasons:

- **Hiding changes which cells exist on screen.** Geometry, keys, selection, find and errors all depend on it, and no hook can do that. Putting it in core avoids a seventh hook.
- **A reviewer must see that something is hidden, plugin or not.** Showing hidden rows as ordinary rows, as the grid does today, hides the fact that the author hid them.

| | without `@sheetpane/visibility` | with it, View | with it, Edit |
|---|---|---|---|
| the file's hidden rows, columns, sheets | hidden, marked | hidden, marked | hidden, marked |
| reveal for viewing (not a change) | ✓ | ✓ | ✓ |
| Hide / Unhide (a change, exported) | — | — | ✓ |
| outline groups: draw, expand, collapse | ✓ | ✓ | ✓ |
| Group / Ungroup (a change, exported) | — | — | ✓ |

## How it looks

```
        A      B   ◂▸   F      G          ← columns C–E hidden: a ◂▸ pair on the boundary, letters skip
     ┌──────┬──────╥──────┬──────┐
   1 │      │      ║      │      │        ← a 3 px double line runs down the grid at the boundary
   2 │      │      ║      │      │
  ▴▾ ╞══════╪══════╬══════╪══════╡        ← rows 3–8 hidden: ▴▾ on the row header, double line across
   9 │      │      ║      │      │
     └──────┴──────╨──────┴──────┘
  Holdings │ Summary │ ⊘ 2 hidden ▾         ← hidden sheets: one button at the end of the tabs
  status:  3 columns, 6 rows hidden · Show hidden
```

- **Boundary markers.**
  - **Shape:** a ◂▸ pair (columns) or ▴▾ pair (rows), drawn in `--sp-ink-3` on the header, always visible and not only on hover. A 3 px double line in `--sp-line-strong` marks the boundary through the cells. The skipped letter or number is the third cue, so colour is never the only one.
  - **Tooltip and label:** *"Columns C–E hidden (3) — click to show"*, with the same text as `aria-label`.
  - **Errors inside:** when the hidden part holds errors, the marker carries the worst severity glyph (✕ ! i) and the count. A hidden error is never invisible.
- **Revealed rows and columns.** When shown for viewing, they draw with a diagonal hatch on their header and a faint hatch on their cells. The tooltip reads *"Hidden in the file — shown for viewing"*.
- **Hidden sheets.**
  - **Tabs:** hidden sheets are no longer tabs. A tab-bar button reads *"⊘ 2 hidden ▾"* and carries an error badge when those sheets hold errors. It opens a `role="menu"` listing each hidden sheet, with *very hidden* tagged *"Excel's own menu can't show this one"*.
  - **Opening one:** a dashed tab with ⊘ appears, and a banner over the grid reads *"This sheet is hidden in the file"*, with *Hide again*, plus *Unhide* in Edit with the plugin.
- **Status line.** It shows *"3 columns, 6 rows hidden · Show hidden"*. *Show hidden* toggles a view-only reveal of every hidden row and column on the sheet. It is per element and never a change.
- **Outline groups.**
  - **Gutter:** an 18 px-per-level gutter left of the row headers, and above the column headers for column groups. It holds level buttons 1 2 3, brackets, and a − / + button at the summary end (`summaryBelow` / `summaryRight`).
  - **When drawn:** only on sheets that have outline levels.

## How to hide and unhide (the plugin, Edit)

- **Commands.** Hide rows, Hide columns, Unhide rows, Unhide columns, Hide sheet and Unhide sheet. Each label follows the selection, for example *"Hide rows 4–6"*, *"Unhide columns C–E"*.
- **Where they appear.**
  - **Cell bar:** docked in the `selbar` group.
  - **Menus:** the cell right-click menu, the W-47 header menu (right-click a column or row header), and a new tab menu (right-click a tab, or Shift+F10 on it).
  - **How they get there:** a `selbar` control gains an optional `menus: ('cell' | 'header' | 'tab')[]` field. It names which menus it also joins, the same way `exportOptions` was added in W-34. It is a field, not a new hook or slot.
- **Markers.** In Edit with the plugin, a marker click **unhides**, which is a change. Without the plugin, or in View, it **reveals** for viewing.
- **Shortcuts.**

  | action | Windows / Linux | Mac |
  |---|---|---|
  | hide rows | Ctrl+Alt+9 | ⌘⌥9 |
  | hide columns | Ctrl+Alt+0 | ⌘⌥0 |
  | unhide rows | Ctrl+Shift+9 | ⌘⇧9 |
  | unhide columns | Ctrl+Shift+0 | ⌘⇧0 |
  | group | Alt+Shift+→ | ⌥⇧→ |
  | ungroup | Alt+Shift+← | ⌥⇧← |

  Keys are matched on `e.code`. They are listed in the keyboard help, and the menus always work.
- **Unhide selects across the gap.** Selecting B:F (W-46) and choosing Unhide columns shows C–E, as in Excel. A selection inside a hidden span is impossible, so Unhide needs a range that crosses the boundary.
- **Rules.** The last visible sheet cannot be hidden: the item is disabled with the reason *"A workbook needs one visible sheet"*. Hiding the active sheet moves to the next visible one.

## Decisions taken in this item

1. **Core honours the file's hiding; the plugin edits it** (the split above). No seventh hook. One optional field, `menus`, on `selbar` controls.
2. **Hide and Unhide are changes** in Edit with the plugin. They are counted, undoable and exported, as freeze is (SR-GRID 21).
   - **Keys:** `sheet!#hiddenRows` and `sheet!#hiddenCols` (`was` / `now` sorted index lists) and `sheet!#sheetState` (`visible` / `hidden` / `veryHidden`).
   - **Counting:** one change per sheet per axis, so hiding 500 rows counts once.
   - **Changes panel:** *"Holdings: rows 4–6 hidden"*.
3. **Revealing is never a change.** A marker click without the plugin, *Show hidden*, opening a hidden sheet from the list and *Show in sheet* are all per element, like zoom and sizes (W-47).
4. **Expand and collapse of outline groups are a view setting** in both modes. The download keeps the file's collapse state. Group and Ungroup, which change the structure, are changes. **Reopen** if editors expect a collapse to be saved.
5. **What is acted on skips hidden cells.**
   - **Visible cells only:** arrows, Tab, Enter, PageUp/PageDown and Ctrl+arrow skip hidden rows and columns. Copy (TSV/HTML), Delete, paste-fill over a range and the W-46 totals act on visible cells only, and the status line says *"6 hidden cells left out"*.
   - **Hidden cells too:** validation, conditional formats and find. A find hit in a hidden cell reveals it.
   - **Why:** Excel clears hidden cells on Delete unless they were filtered out. That surprises people, and a review tool should not.
6. **CSV.** A `.csv` has no hidden state: nothing is hidden on load, and the plugin's controls are disabled on a CSV with the reason *"CSV can't store hidden rows"*. *Download as .csv* from an `.xlsx` includes hidden rows and columns, as Excel's Save As CSV does. The W-34 menu line says so.
7. **Very hidden sheets** are listed and can be opened for viewing. In Edit they can be unhidden with the plugin, and the list tags them. *Hide sheet* always writes `hidden`, never `veryHidden`.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · import | **Sheets:** `ImportedSheet.state: 'visible' \| 'hidden' \| 'veryHidden'` replaces `hidden: boolean`; `hidden` stays as a derived getter for one minor release. **Rows and columns:** `outlineLevel` and `collapsed` are read per row and per column span, with `sheetFormatPr` `outlineLevelRow/Col` and `sheetPr/outlinePr` `summaryBelow/summaryRight`. **Zero size:** a row with `ht="0"` or a column with `width="0"` counts as hidden. **Filters:** `<autoFilter ref>` is read, so a hidden row inside it is labelled *filtered*. | ✅ `state` (+ deprecated `hidden`), `rowOutline` / `colOutline`, `outline`, `ht="0"` / `width="0"`, `autoFilter`; the built-in XML reader matches (parity test) — by an agent |
| 2 · store | **Reading:** `store.hidden(sheet)` gives `{ rows, cols, state }`, the file's state with `hidden*` changes applied. **Revealing:** `reveal()` and `unreveal()` are per element. **Writing:** `setHidden(sheet, axis, indexes, hidden)` and `setSheetState(sheet, state)` each make one undoable change. The change kinds gain `hidden` and `sheetState`, and plugins verdict decision 6's list is updated. | ✅ `hidden()`, `setHidden()`, `setSheetState()` (last visible sheet refused), `outline()`, `setOutline()`; kinds `hidden`, `sheetState`, `outline`; `reveal()` / `unreveal()` on the element |
| 3 · geometry | **Zero size:** hidden rows and columns are 0 px in the W-47 prefix sums. `rowAt` / `colAt` never return a hidden index, and the virtualiser never renders one. **Sizes:** a W-47 size on a hidden column is kept and comes back on unhide. **Spans:** merges and overlays spanning hidden parts are drawn at their visible size, and an overlay with both anchors inside a hidden span is not drawn. **Frozen panes:** may contain hidden rows and columns. | ✅ hidden rows/columns 0 px in the prefix sums; `rowAt`/`colAt` skip them (fast-check); the virtualiser renders none; sizes kept; merges at their shown size |
| 4 · markers | **Drawing:** ◂▸ / ▴▾ pairs on the headers and the double line in the cells, as in *How it looks*. **Label:** a tooltip and `aria-label` naming the span and count. **Errors:** the worst severity glyph and count when the span holds errors. **Clicks:** reveal (core) or unhide (plugin, Edit). **Touch:** a 24 px hit area on a coarse pointer. | ✅ ◂▸ / ▴▾ buttons (columns sticky with the headers), double lines, labels with count and "filtered", worst error glyph + count, 24 px on a coarse pointer; reveal or (plugin, Edit) unhide |
| 5 · reveal | **Show hidden:** the status-line toggle; revealed parts are hatched. **Errors panel:** *Show in sheet* on an error in a hidden row, column or sheet reveals exactly that, with a dismissible note *"Shown for ERR-0004 · Hide again"*. **Tags:** errors panel rows gain *hidden row*, *hidden column* or *hidden sheet*. **Find:** a match in a hidden cell reveals it, and the find count says *"(2 in hidden cells)"*. | ✅ Show hidden (status line), hatching, any selection into a hidden place reveals it with "Shown for ERR-… · Hide again", panel tags, find's "(n in hidden cells)" |
| 6 · hidden sheets | **Tabs:** the tab-bar button with its count and error badge; the menu listing each hidden sheet with its *very hidden* tag. **Opening one:** the dashed tab and the banner. **Records:** SR-GRID decision 10's italic tab is removed. **Selection:** `select()` on a hidden sheet opens it the same way. | ✅ the ⊘ n hidden button and menu (very hidden tagged, error badge), dashed tab + banner, Hide again; a hidden active tab opens on the first visible sheet; the italic tab removed |
| 7 · keys and acts | **Keys:** arrows, Tab, Enter, PageUp/PageDown, Home/End and Ctrl+arrow skip hidden rows and columns. **Copy:** TSV/HTML holds visible cells only; copy-ref keeps the full range. **Edits:** Delete and paste-fill change visible cells only. **Totals:** visible cells only. **Status line:** names what was left out. | ✅ keys skip hidden rows/columns; copy, Delete, paste-fill and totals on shown cells, saying how many were left out |
| 8 · plugin package | **Package:** `@sheetpane/visibility` (headless) and `@sheetpane/visibility/ui`. **Controls:** in `selbar` with `menus`, labels that follow the selection, and `disabled` with a reason on a CSV and on the last visible sheet. **Shortcuts:** the table above. **Markers:** a marker click in Edit unhides. **Tab menu:** the core tab menu gets right-click and Shift+F10 on a tab, and shows only plugin items, so with no plugin the browser's menu stays. | ✅ `@sheetpane/visibility` (+ `/ui`): controls with `menus`, labels that follow, `disabledReason`, Google Sheets' keys on `e.code`, marker unhide, the core tab menu |
| 9 · outline | **Core (both modes):** draws the gutter, level buttons and +/−; expand and collapse as a view setting. **Plugin (Edit):** Group and Ungroup on a row or column selection, with Alt+Shift+→ / ←. **Limit:** eight levels, as in Excel. **Keyboard:** Alt+Shift+↓ / ↑ expand and collapse at the active cell. | ✅ gutter, brackets, +/−, level buttons; expand/collapse a view setting; Alt+Shift+↓/↑; Group/Ungroup (plugin, Alt+Shift+→/←); seven levels |
| 10 · export | **`patchXlsx` option:** `hidden: { sheet, rows?, cols?, state?, outline? }[]`. **Rows:** writes `<row hidden="1">`, creating empty `<row r>` elements where none exist and keeping `sheetData` ordered. **Columns:** splits and merges `<col>` spans for `hidden` and `outlineLevel`. **Sheets:** sets `<sheet state>` in `workbook.xml`. **Active sheet:** when the active sheet becomes hidden, `<workbookView activeTab>` and `firstSheet` move to a visible sheet and `tabSelected` is cleared, or Excel opens to a blank window. **Outline:** `sheetFormatPr outlineLevelRow/Col` is updated. **Round trip:** the result opens in Excel, LibreOffice and Sheets showing the same hidden state. | ✅ `patchXlsx` `hidden` (rows, cols, state, activeTab/firstSheet/tabSelected, outline) — by an agent; round-trip through the import package. **Not done:** opening the result in Excel, LibreOffice and Sheets — W-30's real-app lane |
| 11 · L7 and events | **Sync:** the errors panel tags hidden places; a hide or unhide is one store commit and both elements follow. **Event:** `sheetpane-visibility` with detail `{ sheet, axis, indexes, hidden, via: 'menu' \| 'key' \| 'marker' \| 'reveal' }`; a reveal fires it too, with `via: 'reveal'`. | ✅ one store commit, both elements follow; `sheetpane-visibility {sheet, axis, indexes, hidden, via}` incl. reveal |
| 12 · a11y | **Markers:** buttons with names; `aria-rowcount` / `aria-colcount` stay the true size; `aria-rowindex` / `aria-colindex` keep true indexes, so a screen reader hears "row 9" after row 2. **Announcements:** a polite live region says *"Rows 3 to 8 hidden"* and *"Columns C to E shown"*. **Menus:** every menu is keyboard-reachable. **axe:** View and Edit with hidden parts. | ✅ labelled marker buttons outside the grid's rows (axe), true `aria-rowindex`/`aria-colindex`, polite announcements, keyboard menus; axe View and Edit |
| 13 · speed | On the 250,000-row fixture with every other row hidden, a 5 s wheel scroll gives no frame over 16 ms (grid-rendering decision 5), recorded here with the machine named. | ✅ 250,000 rows, every other hidden, 5 s scroll: 301 frames, worst 16.8 ms, none dropped in two of three runs (one 33 ms frame in the first; Chromium 156 headless, Apple Silicon, 10 cores, load average ~4) |
| 14 · tests | **Import:** each state, outline, `ht="0"` and filtered rows. **Store:** hide, unhide, undo, one change per axis. **Geometry:** a fast-check property of `rowAt` against a linear scan with hidden rows. **UI:** markers, reveal, keys skipping hidden cells, visible-only copy, Delete and totals, the hidden-sheet menu, the last-sheet rule, CSV disabled. **Export round-trip:** rows, cols, state, activeTab and outline. **Plugin:** controls in each menu and the shortcuts. **axe:** View and Edit. | ✅ `packages/grid/test/hidden.test.ts` (12), `packages/visibility/test/visibility.test.ts` (4), import (9) and export (13) tests; demo-check 51 |
| 15 · records | **SR-GRID:** decisions 9, 10, 12, 13 and 17–19 (`menus`), and a new 21c, *"Hidden rows, columns and sheets are core"*. **SR-IMPORT:** the sheet state and outline. **SR-EXPORT:** `hidden`. **New record:** SR-VISIBILITY, plus its row in the register and in §Ownership. **Plugins verdict:** a dated note on decision 6's change kinds and on `menus`. **Also:** the package README, the CHANGELOG, and a demo in the gallery (W-32). | ✅ SR-GRID 9, 10, 12, 19, 21c; SR-IMPORT 2, 7, 10; SR-EXPORT 1, 3; SR-VISIBILITY (0121); plugins compare note; README; CHANGELOG; the gallery's "Hide and show" tab |

## Blockers

None. W-46 (selection) and W-47 (sizes) are closed.

## Out of scope

- **Filtering itself** (an autoFilter UI). Filtered rows are only labelled.
- **Hiding gridlines or headings** (`showGridLines`, `showRowColHeaders`). This is a later item if wanted.
- **Hidden formulas under sheet protection, and hidden names.**
- **Temporary hiding in View** (decluttering a view without a change). Reopen if reviewers ask.
- **Showing or hiding comments and notes.** That belongs to `@sheetpane/comments`.

## Record affected

**[SR-GRID](../../records/0105_GRID.md)** decisions 9, 10, 12, 13, 17–19 and a new 21c. **[SR-IMPORT](../../records/0104_IMPORT.md)** for the sheet state and outline. **[SR-EXPORT](../../records/0103_EXPORT.md)** for `hidden`. A new **SR-VISIBILITY** record for the plugin. [`plugins.compare.md`](../compare/plugins.compare.md) gets a dated note on decision 6 and `menus`.

## Hazards

- **This changes the no-plugin grid.** Rows and sheets the file hides stop showing as ordinary rows and tabs. The markers and the hidden-sheets button are what make that safe; ship them together, never the hiding alone.
- **Hiding the active sheet in the download** without moving `activeTab` makes Excel open to a blank window. Test it in Excel itself (W-30's real-app files).
- **`AltGr` is Ctrl+Alt on many European layouts,** so Ctrl+Alt+9 can type a character there. Match `e.code` only while the grid has focus and no cell is being edited, and never block typing in the cell bar.
- **On Windows, Ctrl+Shift+0** is often taken by an input-language hotkey, a known Excel problem. The header menu is the fallback; say so in the keyboard help.
- **`hidden` → `state` on `ImportedSheet`** is a public-type change. Keep the getter, and note it in the CHANGELOG as deprecated.
- **Concurrent sessions** edit this repo; re-derive `git status` before staging.

## Reference

- [`../../packages/import/src/xlsx.ts`](../../packages/import/src/xlsx.ts): `hiddenRows`, `hiddenCols`, and `state` folded into `hidden`.
- [`../../packages/grid/src/excel/element.ts`](../../packages/grid/src/excel/element.ts): tabs (`hidden-sheet`), the W-47 header menu (`hdrMenu`), the W-46 selection layer.
- [`../../packages/grid/src/excel/geometry.ts`](../../packages/grid/src/excel/geometry.ts): the W-47 prefix sums and `rowAt`.
- [`../../packages/export/src/patch.ts`](../../packages/export/src/patch.ts): the `freeze` option to copy for `hidden`.
- [`../compare/plugins.compare.md`](../compare/plugins.compare.md): six hooks, six slots, the reopen-trigger, and decision 6.
- `../../packages/styles/`: how an existing plugin package and its `./ui` are laid out.

## Prompt — paste into Claude Code

```text
You are building W-49 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, this file, records/0105_GRID.md (9, 10, 12, 13, 17–21a),
   records/0104_IMPORT.md, records/0103_EXPORT.md, work/compare/plugins.compare.md,
   packages/import/src/xlsx.ts, packages/grid/src/excel/{element,geometry}.ts,
   packages/export/src/patch.ts and one plugin package (packages/styles) for the layout.
2. Plan in this order: import (state, outline, autoFilter) → store model and change kinds → geometry
   (zero size) → markers, reveal and hidden-sheets menu → keys/copy/Delete/totals → export `hidden`
   → @sheetpane/visibility (controls, menus field, shortcuts) → outline. Measure the scroll first.
3. Implement each step with its tests before the next; keep the no-plugin grid safe at every commit
   (never hide without the markers).
4. Verify: just check; every DoD row; open an exported file in Excel or LibreOffice for DoD 10;
   the 16 ms measurement written here. Then do what SR-WORK-DOCS decision 10 says every task owes.
```
