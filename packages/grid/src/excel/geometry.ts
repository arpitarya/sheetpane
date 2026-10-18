// Sheet geometry: column widths and row tops in pixels, at a zoom. Pure, so the
// virtualiser, the overlay plugins (W-20) and the tests share one implementation.
import { parseRange, type RangePos } from '@sheetpane/export';
import type { ImportedSheet } from '@sheetpane/import';

/** A row's height in pixels at 100 % zoom, unless the file or the user sets one (W-47). */
export const ROW_H = 28;
/** Column and row size limits in pixels at 100 % zoom (W-47 DoD 1). */
export const COL_MIN = 16, COL_MAX = 1200, ROW_MIN = 12, ROW_MAX = 600;
/** The column-header row's height in pixels at 100 % zoom. */
export const HEAD_H = 24;
/** The row-header column's width in pixels at 100 % zoom. */
export const ROWHEAD_W = 52;
export const DEFAULT_COL_PX = 64;
/** Columns past this many are virtualised as well as rows (grid verdict decision, "past 60 columns"). */
export const COL_VIRTUAL_AFTER = 60;
export const OVERSCAN = 20;

/** Excel character units → pixels at 100 % (Calibri 11, maximum digit width 7 px). */
export const charsToPx = (w: number) => Math.round(w * 7 + 5);

export interface SheetGeometry {
  rows: number;
  cols: number;
  /** Column left edges at 100 %, length cols + 1. */
  colX: Float64Array;
  /** Row top edges at 100 %, length rows + 1 — a prefix sum, so rows may differ in height (W-47). */
  rowY: Float64Array;
  merges: RangePos[];
}

/** What the grid hides: 0-based rows and columns drawn at 0 px (W-49) — the file's hiding, less what is revealed. */
export interface SheetHidden { rows?: ReadonlySet<number>; cols?: ReadonlySet<number> }

/** The user's sizes for one sheet, px at 100 %: column and row indexes (0-based) to a size (W-47). */
export interface SheetSizes { cols?: Readonly<Record<number, number>>; rows?: Readonly<Record<number, number>> }

/** Points (the file's row heights) to pixels at 100 %. */
export const ptToPx = (pt: number) => Math.round((pt * 96) / 72);

/**
 * A sheet's size and column edges at 100 % zoom (SR-GRID decision 11): the file's column widths,
 * else a width from the first 200 rows' text (CSV), else the default; the grid reaches merges,
 * rule ranges and drawing anchors past the data.
 * @param s - The sheet as read.
 * @param mergeList - The merged ranges to draw; the file's by default.
 * @param sizes - The user's column widths and row heights, px at 100 % (W-47); they win over the file's.
 * @param hidden - Rows and columns drawn at 0 px (W-49); a size set on one is kept for when it shows again.
 * @returns The row and column counts, the column and row edges and the merges.
 */
export function sheetGeometry(s: ImportedSheet, mergeList: readonly string[] = s.merges ?? [], sizes: SheetSizes = {}, hidden: SheetHidden = {}): SheetGeometry {
  const dataCols = s.rows.reduce((m, r) => Math.max(m, r.length), 0);
  const merges = mergeList.map((m) => parseRange(m)).filter((m): m is RangePos => !!m);
  const ruled = [...(s.dataValidations ?? []).flatMap((v) => v.sqref), ...(s.conditionalFormats ?? []).flatMap((f) => f.sqref)]
    .map((r) => parseRange(r)?.right ?? -1).filter((c) => c >= 0 && c < dataCols + 26);
  // pictures and charts sit beside the data: the grid reaches their anchor's far cell (W-20, W-21)
  // (a `to` point at offset 0 is the left / top edge of that cell; a lone `from` needs its own cell)
  const drawn = (s.drawings ?? []).map((d) => (d.to ? { col: d.to.col + (d.to.colOff > 0 ? 1 : 0), row: d.to.row + (d.to.rowOff > 0 ? 1 : 0) } : d.from ? { col: d.from.col + 1, row: d.from.row + 1 } : undefined))
    .filter((n): n is { col: number; row: number } => !!n);
  const drawnCols = drawn.map((n) => n.col).filter((n) => n <= dataCols + 26);
  const drawnRows = drawn.map((n) => n.row).filter((n) => n <= s.rows.length + 200);
  const cols = Math.max(1, dataCols, ...merges.map((m) => m.right + 1), ...ruled.map((c) => c + 1), ...drawnCols);
  const rows = Math.max(s.rows.length + 3, 20, ...merges.map((m) => m.bottom + 1), ...drawnRows);
  const dflt = s.defaultColWidth !== undefined ? charsToPx(s.defaultColWidth) : DEFAULT_COL_PX;
  const fileWidths = s.columnWidths ?? [];
  const guess = fileWidths.length === 0 && !s.path;
  const colX = new Float64Array(cols + 1);
  for (let c = 0; c < cols; c++) {
    let w = fileWidths[c] !== undefined ? charsToPx(fileWidths[c]!) : dflt;
    if (guess) {
      let ch = 0;
      for (let r = 0; r < Math.min(200, s.text.length); r++) ch = Math.max(ch, (s.text[r]?.[c] ?? '').length);
      w = Math.min(320, Math.max(DEFAULT_COL_PX, ch * 7 + 18));
    }
    const own = sizes.cols?.[c];
    colX[c + 1] = colX[c]! + (hidden.cols?.has(c) ? 0 : own !== undefined ? own : w);
  }
  // rows: the user's height, else the file's custom height (points), else 28 px
  const rowY = new Float64Array(rows + 1);
  const fileRows = s.rowHeights ?? [], ownRows = sizes.rows ?? {};
  for (let r = 0; r < rows; r++) {
    const own = ownRows[r], pt = fileRows[r];
    rowY[r + 1] = rowY[r]! + (hidden.rows?.has(r) ? 0 : own !== undefined ? own : pt !== undefined && pt > 0 ? Math.min(ROW_MAX, Math.max(ROW_MIN, ptToPx(pt))) : ROW_H);
  }
  return { rows, cols, colX, rowY, merges };
}

/** A row's top at 100 %; past the drawn rows each row is 28 px. */
export function rowTop(g: SheetGeometry, r: number): number {
  return r <= g.rows ? g.rowY[Math.max(0, r)]! : g.rowY[g.rows]! + (r - g.rows) * ROW_H;
}

/** A row's height at 100 %. */
export function rowHeight(g: SheetGeometry, r: number): number {
  return r < g.rows ? g.rowY[r + 1]! - g.rowY[r]! : ROW_H;
}

/** A column's width at 100 %. */
export function colWidth(g: SheetGeometry, c: number): number {
  return c < g.cols ? g.colX[c + 1]! - g.colX[c]! : DEFAULT_COL_PX;
}

/** The row whose bottom edge is past `y` (100 % pixels) — a binary search over the row tops. */
export function rowAt(g: SheetGeometry, y: number): number {
  let lo = 0, hi = g.rows - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (g.rowY[mid + 1]! <= y) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/** The first column whose right edge is past `x` (100 % pixels). */
export function colAt(g: SheetGeometry, x: number): number {
  let lo = 0, hi = g.cols - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (g.colX[mid + 1]! <= x) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/** The merge that covers a cell, if any. */
export function mergeAt(g: SheetGeometry, row: number, col: number): RangePos | undefined {
  return g.merges.find((m) => row >= m.top && row <= m.bottom && col >= m.left && col <= m.right);
}

export interface Window { r0: number; r1: number; c0: number; c1: number }

/** The rows and columns to render for a scroll position (zoom-scaled pixels), with overscan. */
export function visibleWindow(g: SheetGeometry, z: number, scrollTop: number, scrollLeft: number, height: number, width: number, frozen: { rows: number; cols: number }): Window {
  const r0 = Math.max(frozen.rows, rowAt(g, scrollTop / z) - OVERSCAN);
  const r1 = Math.min(g.rows - 1, rowAt(g, (scrollTop + height) / z) + OVERSCAN);
  if (g.cols <= COL_VIRTUAL_AFTER) return { r0, r1, c0: frozen.cols, c1: g.cols - 1 };
  const x0 = scrollLeft / z, x1 = (scrollLeft + width) / z;
  return { r0, r1, c0: Math.max(frozen.cols, colAt(g, x0) - 2), c1: Math.min(g.cols - 1, colAt(g, x1) + 2) };
}

/**
 * The spans of hidden rows or columns: runs of consecutive 0 px indexes (W-49).
 * @param edges - `rowY` or `colX`.
 * @param count - Rows or columns drawn.
 * @returns Each run as `[first, last]`.
 */
export function hiddenSpans(edges: Float64Array, count: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    if (edges[i + 1]! !== edges[i]!) continue;
    const last = out[out.length - 1];
    if (last && last[1] === i - 1) last[1] = i; else out.push([i, i]);
  }
  return out;
}

/** True when a row (column) is drawn at 0 px — hidden (W-49). */
export const isHiddenAt = (edges: Float64Array, i: number) => edges[i + 1] !== undefined && edges[i + 1]! === edges[i]!;
