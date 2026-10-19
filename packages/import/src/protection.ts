// A cell's effective protection (W-62): which format decides whether a protected sheet locks it.
import { cellRef } from '@sheetpane/export';
import type { CellProtection, ImportedSheet, StyleTables } from './types.js';

/**
 * A cell's effective `<protection>`: the format of the cell itself when the file stores the cell, else its row's
 * (`<row s customFormat="1">`), else its column's (`<col style>`), else the default format (`cellXfs[0]`). A format
 * with no `<protection>` is locked and not hidden — Excel's default. It says what the file asks for; whether it
 * applies depends on the sheet's `protection` (absent: nothing is locked).
 *
 * @param sheet - The imported sheet.
 * @param styles - The workbook's style tables.
 * @param row - The 0-based row.
 * @param col - The 0-based column.
 * @returns `{ locked, hidden }`.
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0104_IMPORT.md
 */
export function cellProtection(sheet: ImportedSheet, styles: StyleTables, row: number, col: number): CellProtection {
  let s = sheet.styleIndex[cellRef(row, col)];
  if (s === undefined) {
    const stored = sheet.rows[row]?.[col];
    s = stored !== null && stored !== undefined ? 0 : (sheet.rowStyles?.[row] ?? sheet.colStyles?.[col] ?? 0);
  }
  const p = styles.cellXfs[s]?.protection;
  return { locked: p?.locked ?? true, hidden: p?.hidden ?? false };
}
