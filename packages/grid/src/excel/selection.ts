// Range selection (W-46): the pure parts — merge growth, the edge of the data for Ctrl+arrow, the
// split of a range across frozen panes, the clipboard payload, the totals. The element draws and
// wires them (SR-GRID decisions 11b, 12, 13).
import { cellRef, colName, type RangePos } from '@sheetpane/export';
import type { Cell } from '@sheetpane/export';

/** A cell position, 0-based. */
export interface Pos { row: number; col: number }

/** The range two corners span, top-left to bottom-right. */
export function spanOf(a: Pos, b: Pos): RangePos {
  return { top: Math.min(a.row, b.row), left: Math.min(a.col, b.col), bottom: Math.max(a.row, b.row), right: Math.max(a.col, b.col) };
}

/**
 * Grows a range until no merge sits partly inside it, as Excel does.
 * @param r - The range.
 * @param merges - The sheet's merged ranges.
 * @returns The grown range (the same object's values when nothing crossed it).
 */
export function growForMerges(r: RangePos, merges: readonly RangePos[]): RangePos {
  const out = { ...r };
  for (let changed = true; changed;) {
    changed = false;
    for (const m of merges) {
      const meets = m.top <= out.bottom && m.bottom >= out.top && m.left <= out.right && m.right >= out.left;
      if (!meets) continue;
      if (m.top < out.top) { out.top = m.top; changed = true; }
      if (m.left < out.left) { out.left = m.left; changed = true; }
      if (m.bottom > out.bottom) { out.bottom = m.bottom; changed = true; }
      if (m.right > out.right) { out.right = m.right; changed = true; }
    }
  }
  return out;
}

/** `A1:C4`, or `A1` for one cell. */
export const rangeText = (r: RangePos): string => (r.top === r.bottom && r.left === r.right ? cellRef(r.top, r.left) : `${cellRef(r.top, r.left)}:${cellRef(r.bottom, r.right)}`);

/**
 * What "Copy ref" gives: `B:D` for whole columns, `4:12` for whole rows, the sheet's name for all of it.
 * @param r - The range.
 * @param size - The sheet's drawn rows and columns.
 * @param sheet - The sheet's name.
 * @returns The reference as Excel writes it.
 */
export function refLabel(r: RangePos, size: { rows: number; cols: number }, sheet: string): string {
  const allRows = r.top === 0 && r.bottom >= size.rows - 1, allCols = r.left === 0 && r.right >= size.cols - 1;
  if (allRows && allCols) return sheet;
  if (allRows) return `${colName(r.left)}:${colName(r.right)}`;
  if (allCols) return `${r.top + 1}:${r.bottom + 1}`;
  return rangeText(r);
}

/** One part of a range split across the frozen panes: which pane, its cells, and which of its edges are the range's own. */
export interface Part extends RangePos { pane: 'corner' | 'top' | 'left' | 'main'; edges: { top: boolean; left: boolean; bottom: boolean; right: boolean } }

/**
 * Splits a range by the frozen rows and columns: up to four parts, each drawn in its own pane.
 * @param r - The range.
 * @param fr - Frozen rows.
 * @param fc - Frozen columns.
 * @returns The non-empty parts, with the edges each one draws.
 */
export function splitByPanes(r: RangePos, fr: number, fc: number): Part[] {
  const rows: [number, number, boolean][] = [];
  if (r.top < fr) rows.push([r.top, Math.min(r.bottom, fr - 1), true]);
  if (r.bottom >= fr) rows.push([Math.max(r.top, fr), r.bottom, false]);
  const cols: [number, number, boolean][] = [];
  if (r.left < fc) cols.push([r.left, Math.min(r.right, fc - 1), true]);
  if (r.right >= fc) cols.push([Math.max(r.left, fc), r.right, false]);
  const out: Part[] = [];
  for (const [top, bottom, fRow] of rows) for (const [left, right, fCol] of cols) {
    out.push({ top, left, bottom, right, pane: fRow ? (fCol ? 'corner' : 'top') : fCol ? 'left' : 'main', edges: { top: top === r.top, left: left === r.left, bottom: bottom === r.bottom, right: right === r.right } });
  }
  return out;
}

const filled = (v: Cell | undefined) => v !== null && v !== undefined && v !== '';

/**
 * Ctrl+arrow: the edge of the data region from a cell, as Excel moves.
 * From a filled cell whose neighbour is filled: the last filled cell of that run; otherwise the next
 * filled cell; otherwise the sheet's edge.
 * @param at - The cell to move from.
 * @param dr - Row step (−1, 0, 1).
 * @param dc - Column step (−1, 0, 1).
 * @param value - A cell's value.
 * @param size - The sheet's drawn rows and columns.
 * @returns Where the jump lands.
 */
export function dataEdge(at: Pos, dr: number, dc: number, value: (row: number, col: number) => Cell | undefined, size: { rows: number; cols: number }): Pos {
  const inside = (r: number, c: number) => r >= 0 && c >= 0 && r < size.rows && c < size.cols;
  let r = at.row, c = at.col;
  if (!inside(r + dr, c + dc)) return { row: r, col: c };
  if (filled(value(r, c)) && filled(value(r + dr, c + dc))) {
    while (inside(r + dr, c + dc) && filled(value(r + dr, c + dc))) { r += dr; c += dc; }
    return { row: r, col: c };
  }
  r += dr; c += dc;
  while (inside(r, c) && !filled(value(r, c))) {
    if (!inside(r + dr, c + dc)) return { row: r, col: c };
    r += dr; c += dc;
  }
  return { row: r, col: c };
}

/**
 * The data region: the used range from A1 to the last filled row and column (Ctrl/⌘+A's first press).
 * @param rows - The sheet's rows.
 * @returns The range, at least A1.
 */
export function usedRange(rows: readonly (readonly Cell[])[]): RangePos {
  let bottom = 0, right = 0;
  rows.forEach((row, r) => { for (let c = row.length - 1; c >= 0; c--) if (filled(row[c])) { bottom = Math.max(bottom, r); right = Math.max(right, c); break; } });
  return { top: 0, left: 0, bottom, right };
}

const htmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The clipboard payload for a range: TSV (display text) and an HTML table, so Excel and Sheets paste a grid.
 * @param r - The range.
 * @param text - A cell's display text.
 * @param shown - Which rows and columns are shown; the others are left out (W-49).
 * @returns `text/plain` and `text/html`.
 */
export function clipOf(r: RangePos, text: (row: number, col: number) => string, shown: { row?: (i: number) => boolean; col?: (i: number) => boolean } = {}): { tsv: string; html: string } {
  const lines: string[] = [], trs: string[] = [];
  for (let row = r.top; row <= r.bottom; row++) {
    if (shown.row && !shown.row(row)) continue; // hidden rows and columns are left out (W-49)
    const cells: string[] = [];
    for (let col = r.left; col <= r.right; col++) if (!shown.col || shown.col(col)) cells.push(text(row, col));
    // a tab or line break inside a cell would split it: Excel quotes such a cell in TSV
    lines.push(cells.map((t) => (/[\t\n"]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t)).join('\t'));
    trs.push(`<tr>${cells.map((t) => `<td>${htmlEsc(t)}</td>`).join('')}</tr>`);
  }
  return { tsv: lines.join('\n'), html: `<table>${trs.join('')}</table>` };
}

/** The status line's totals: Count of non-empty cells; Sum and Average of the numeric ones. */
export interface Totals { count: number; numbers: number; sum: number }

/**
 * Totals over a range; only the cells that exist are visited.
 * @param r - The range.
 * @param value - A cell's value.
 * @param lastRow - The last row holding data (rows past it are empty).
 * @param shown - Which rows and columns are shown; hidden ones are left out (W-49).
 * @returns Count, how many were numbers, and their sum.
 */
export function totalsOf(r: RangePos, value: (row: number, col: number) => Cell | undefined, lastRow: number, shown: { row?: (i: number) => boolean; col?: (i: number) => boolean } = {}): Totals {
  const t: Totals = { count: 0, numbers: 0, sum: 0 };
  for (let row = r.top; row <= Math.min(r.bottom, lastRow); row++) {
    if (shown.row && !shown.row(row)) continue;
    for (let col = r.left; col <= r.right; col++) {
      if (shown.col && !shown.col(col)) continue;
      const v = value(row, col);
      if (!filled(v)) continue;
      t.count++;
      if (typeof v === 'number') { t.numbers++; t.sum += v; }
    }
  }
  return t;
}

/** Cells a range holds (for the copy limit and the announcement). */
export const cellCount = (r: RangePos): number => (r.bottom - r.top + 1) * (r.right - r.left + 1);
