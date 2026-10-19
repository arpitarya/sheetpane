// @sheetpane/visibility/ui (W-49): Hide / Unhide rows, columns and sheets in the docked selection bar,
// the cell menu, the header menu and the tab menu, with Google Sheets' keys (Excel's Ctrl+9 / Ctrl+0
// are the browser's). Labels follow the selection; a CSV and the last visible sheet say why not.
import { colName, parseRange } from '@sheetpane/export';
import { registerPlugin, type ControlDescriptor, type Plugin, type Selection, type Snapshot, type WorkbookStore } from '@sheetpane/grid';
import { blockedReason, canHideSheet, hiddenIn, setSheetHidden, setSpanHidden, sheetBlockedReason, spanOf, visibility } from './index.js';

const span = (axis: 'rows' | 'cols', sel: Selection) => {
  const list = spanOf(sel)[axis], a = list[0]!, b = list[list.length - 1]!;
  const n = (i: number) => (axis === 'rows' ? String(i + 1) : colName(i));
  return a === b ? `${axis === 'rows' ? 'row' : 'column'} ${n(a)}` : `${axis === 'rows' ? 'rows' : 'columns'} ${n(a)}–${n(b)}`;
};
const hiddenInside = (snap: Snapshot, sel: Selection, axis: 'rows' | 'cols') => {
  const h = new Set(hiddenIn(snap, sel.sheet)[axis]);
  return spanOf(sel)[axis].some((i) => h.has(i));
};

function spanControl(axis: 'rows' | 'cols', hide: boolean, shortcut: string): ControlDescriptor {
  const verb = hide ? 'Hide' : 'Unhide';
  return {
    id: `visibility-${hide ? 'hide' : 'unhide'}-${axis}`, slot: 'selbar', group: 'visibility', mode: 'edit', shortcut,
    label: `${verb} ${axis === 'rows' ? 'rows' : 'columns'}`,
    labelFor: (_s: Snapshot, sel: Selection) => `${verb} ${span(axis, sel)}`,
    menus: ['cell', 'header'],
    // Unhide needs a selection across the hidden span; Hide needs something to hide
    disabled: (snap: Snapshot, sel: Selection) => !!blockedReason(snap) || (!hide && !hiddenInside(snap, sel, axis)),
    disabledReason: (snap: Snapshot, sel: Selection) => blockedReason(snap) ?? (!hide && !hiddenInside(snap, sel, axis) ? `Select across the hidden ${axis === 'rows' ? 'rows' : 'columns'} to unhide them` : undefined),
    run: (store: WorkbookStore, sel: Selection) => setSpanHidden(store, sel, axis, hide),
  };
}

/** Group (+1 level) or ungroup (−1): whole columns selected → columns, else rows. */
function groupControl(delta: 1 | -1): ControlDescriptor {
  const axisOf = (snap: Snapshot, sel: Selection): 'rows' | 'cols' => {
    const sheet = snap.book?.sheets.find((x) => x.name === sel.sheet), r = sel.range ? parseRange(sel.range) : undefined;
    return r && sheet && r.top === 0 && r.bottom >= sheet.rows.length - 1 && sheet.rows.length > 1 ? 'cols' : 'rows';
  };
  const verb = delta > 0 ? 'Group' : 'Ungroup';
  return {
    id: `visibility-${delta > 0 ? 'group' : 'ungroup'}`, slot: 'selbar', group: 'visibility-outline', mode: 'edit', label: verb,
    shortcut: delta > 0 ? 'Alt+Shift+ArrowRight' : 'Alt+Shift+ArrowLeft', menus: ['header'],
    labelFor: (snap: Snapshot, sel: Selection) => `${verb} ${span(axisOf(snap, sel), sel)}`,
    disabled: (snap: Snapshot) => !!blockedReason(snap),
    disabledReason: (snap: Snapshot) => blockedReason(snap),
    run: (store: WorkbookStore, sel: Selection) => { if (!blockedReason(store.getSnapshot())) { const axis = axisOf(store.getSnapshot(), sel); store.setOutline(sel.sheet, axis, spanOf(sel)[axis], delta); } },
  };
}

/**
 * The controls: Hide and Unhide rows and columns (selection bar, cell and header menus), Group and
 * Ungroup (Alt+Shift+→ / ←), and Hide sheet (tab menu).
 * @returns The controls plugin (`id: 'visibility-ui'`).
 * @example
 * ```ts
 * import '@sheetpane/visibility/ui';
 * excel.setAttribute('plugins', 'visibility'); // a <sheetpane-excel>
 * ```
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0121_VISIBILITY.md
 */
export function ui(): Plugin {
  const controls: ControlDescriptor[] = [
    spanControl('rows', true, 'Mod+Alt+9'),
    spanControl('cols', true, 'Mod+Alt+0'),
    spanControl('rows', false, 'Mod+Shift+9'),
    spanControl('cols', false, 'Mod+Shift+0'),
    groupControl(1), groupControl(-1),
    {
      id: 'visibility-hide-sheet', slot: 'selbar', group: 'visibility', mode: 'edit', label: 'Hide sheet', menus: ['tab'],
      labelFor: (_s: Snapshot, sel: Selection) => `Hide sheet ${sel.sheet}`,
      // a protected structure keeps its sheets as they are (W-62)
      disabled: (snap: Snapshot, sel: Selection) => !!sheetBlockedReason(snap) || !canHideSheet(snap, sel.sheet),
      disabledReason: (snap: Snapshot, sel: Selection) => sheetBlockedReason(snap) ?? (!canHideSheet(snap, sel.sheet) ? 'A workbook needs one visible sheet' : undefined),
      run: (store: WorkbookStore, sel: Selection) => { setSheetHidden(store, sel.sheet, true); },
    },
  ];
  return { id: 'visibility-ui', provides: [], controls };
}

registerPlugin('visibility', () => [visibility(), ui()]);
