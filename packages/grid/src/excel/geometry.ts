// Sheet geometry: column widths and row tops in pixels, at a zoom. Pure, so the
// virtualiser, the overlay plugins (W-20) and the tests share one implementation.
import { parseRange, type RangePos } from '@sheetpane/export';
import type { ImportedSheet } from '@sheetpane/import';

export const ROW_H = 28;
export const HEAD_H = 24;
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
  merges: RangePos[];
}

/** Column widths: the file's, else a width from the first 200 rows' text (CSV), else the default. */
export function sheetGeometry(s: ImportedSheet, mergeList: readonly string[] = s.merges ?? []): SheetGeometry {
  const dataCols = s.rows.reduce((m, r) => Math.max(m, r.length), 0);
  const merges = mergeList.map((m) => parseRange(m)).filter((m): m is RangePos => !!m);
  const ruled = [...(s.dataValidations ?? []).flatMap((v) => v.sqref), ...(s.conditionalFormats ?? []).flatMap((f) => f.sqref)]
    .map((r) => parseRange(r)?.right ?? -1).filter((c) => c >= 0 && c < dataCols + 26);
  const cols = Math.max(1, dataCols, ...merges.map((m) => m.right + 1), ...ruled.map((c) => c + 1));
  const rows = Math.max(s.rows.length + 3, 20, ...merges.map((m) => m.bottom + 1));
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
    colX[c + 1] = colX[c]! + w;
  }
  return { rows, cols, colX, merges };
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
  const rh = ROW_H * z;
  const r0 = Math.max(frozen.rows, Math.floor(scrollTop / rh) - OVERSCAN);
  const r1 = Math.min(g.rows - 1, Math.ceil((scrollTop + height) / rh) + OVERSCAN);
  if (g.cols <= COL_VIRTUAL_AFTER) return { r0, r1, c0: frozen.cols, c1: g.cols - 1 };
  const x0 = scrollLeft / z, x1 = (scrollLeft + width) / z;
  return { r0, r1, c0: Math.max(frozen.cols, colAt(g, x0) - 2), c1: Math.min(g.cols - 1, colAt(g, x1) + 2) };
}
