// @sheetpane/visibility (W-49) — hiding and unhiding as changes. Core honours, marks and reveals what
// a file hides (SR-GRID decision 21c); this plugin is what lets an editor change it: with it in the
// pane, a marker click in Edit unhides, and `./ui` adds the controls. Headless: the actions below.
// No runtime dependency; `@sheetpane/grid` is a peer.
import { cellKey, registerPlugin, type Plugin, type Selection, type Snapshot, type WorkbookStore } from '@sheetpane/grid';
import { parseRange, parseRef } from '@sheetpane/export';

/**
 * The rows and columns a selection spans, 0-based.
 * @param sel - The selection.
 * @returns Its rows and columns.
 */
export function spanOf(sel: Selection): { rows: number[]; cols: number[] } {
  const r = sel.range ? parseRange(sel.range) : undefined, p = parseRef(sel.ref)!;
  const top = r ? r.top : p.row, bottom = r ? r.bottom : p.row, left = r ? r.left : p.col, right = r ? r.right : p.col;
  return { rows: Array.from({ length: bottom - top + 1 }, (_, i) => top + i), cols: Array.from({ length: right - left + 1 }, (_, i) => left + i) };
}

/**
 * Why hiding cannot be changed here, or undefined when it can: a CSV stores no hidden state.
 * @param snap - The pane's snapshot.
 * @returns The reason, or undefined.
 */
export function blockedReason(snap: Snapshot): string | undefined {
  return snap.source?.kind === 'csv' ? 'CSV can’t store hidden rows' : undefined;
}

/**
 * Hides the selection's rows or columns — one undoable change, written into the download.
 * @param store - The pane's workbook.
 * @param sel - The selection.
 * @param axis - `rows` or `cols`.
 * @param hide - True hides; false unhides (a range across a hidden span shows it, as in Excel).
 */
export function setSpanHidden(store: WorkbookStore, sel: Selection, axis: 'rows' | 'cols', hide: boolean): void {
  if (blockedReason(store.getSnapshot())) return;
  store.setHidden(sel.sheet, axis, spanOf(sel)[axis], hide);
}

/**
 * Hides a sheet (`hidden`, never `veryHidden`) or unhides it; the last visible sheet stays.
 * @param store - The pane's workbook.
 * @param sheet - The sheet's name.
 * @param hide - True hides; false unhides.
 * @returns False when refused (the last visible sheet, or a CSV).
 */
export function setSheetHidden(store: WorkbookStore, sheet: string, hide: boolean): boolean {
  if (blockedReason(store.getSnapshot())) return false;
  const ok = store.setSheetState(sheet, hide ? 'hidden' : 'visible');
  // hiding the sheet in view moves to the next visible one
  if (ok && hide && store.getSnapshot().selection.sheet === sheet) {
    const next = store.getSnapshot().book!.sheets.find((x) => x.name !== sheet && store.hidden(x.name).state === 'visible');
    if (next) store.select({ sheet: next.name, ref: 'A1' });
  }
  return ok;
}

/**
 * What a sheet hides, read from a snapshot (the file's, with the hiding changes applied) — what
 * `store.hidden()` gives, for controls that see only the snapshot.
 * @param snap - The pane's snapshot.
 * @param sheet - The sheet's name.
 * @returns Hidden rows and columns (0-based) and the sheet's state.
 */
export function hiddenIn(snap: Snapshot, sheet: string): { rows: number[]; cols: number[]; state: string } {
  const sh = snap.book?.sheets.find((x) => x.name === sheet) as ({ hiddenRows?: number[]; hiddenCols?: number[]; hidden?: boolean; state?: string } | undefined);
  const ch = (k: string) => snap.changes.get(cellKey(sheet, k))?.now;
  return {
    rows: (ch('#hiddenRows') as number[] | undefined) ?? sh?.hiddenRows ?? [],
    cols: (ch('#hiddenCols') as number[] | undefined) ?? sh?.hiddenCols ?? [],
    state: (ch('#sheetState') as string | undefined) ?? sh?.state ?? (sh?.hidden ? 'hidden' : 'visible'),
  };
}

/**
 * Whether another sheet would stay visible if this one were hidden.
 * @param snap - The pane's snapshot.
 * @param sheet - The sheet's name.
 * @returns True when the sheet may be hidden.
 */
export function canHideSheet(snap: Snapshot, sheet: string): boolean {
  return !!snap.book && snap.book.sheets.some((x) => x.name !== sheet && hiddenIn(snap, x.name).state === 'visible');
}

/**
 * The headless plugin: its presence in a pane lets a hidden-span marker unhide (Edit).
 * @returns The plugin (`id: 'visibility'`).
 * @example
 * ```ts
 * import { createWorkbook } from '@sheetpane/grid';
 * import { visibility } from '@sheetpane/visibility';
 * const book = createWorkbook({ plugins: [visibility()] });
 * ```
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0121_VISIBILITY.md
 */
export function visibility(): Plugin {
  return { id: 'visibility', provides: [] };
}

registerPlugin('visibility', () => visibility());
