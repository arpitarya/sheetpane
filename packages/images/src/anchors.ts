// Anchor arithmetic: a drawing's anchor (EMU) → a rectangle in sheet space (px at 100 % zoom,
// from the top-left of A1), placed through the grid's `Geometry`. Pure — no DOM — so
// @sheetpane/charts reuses it unchanged (W-20 prompt, W-21).
//
// The grid shows every row at its fixed height and every column at the width it computes from
// the file's character units; it does not hide hidden rows or columns. Anchors are placed in
// *that* geometry, which is what the user sees. Excel's own row heights (`rowHeights`,
// `defaultRowHeight`) are therefore never used here: a picture anchored to C4:F9 covers C4:F9 on
// screen, whatever its size in Excel.
import type { Geometry } from '@sheetpane/grid';

/** 914,400 EMU per inch, 96 px per inch. */
export const EMU_PER_PX = 9525;

export const emuToPx = (emu: number): number => emu / EMU_PER_PX;
export const pxToEmu = (px: number): number => Math.round(px * EMU_PER_PX);

/** A position in a drawing: zero-based column and row, plus an offset in EMU inside that cell. */
export interface AnchorPoint { col: number; colOff: number; row: number; rowOff: number }

/** The shape of `DrawingAnchor` (@sheetpane/import) that placing needs; any drawing kind fits. */
export interface Anchor {
  anchor: 'twoCell' | 'oneCell' | 'absolute';
  from?: AnchorPoint;
  to?: AnchorPoint;
  /** Size in EMU (oneCell, absolute). */
  ext?: { cx: number; cy: number };
  /** Position in EMU from the sheet origin (absolute). */
  pos?: { x: number; y: number };
}

export interface Rect { x: number; y: number; width: number; height: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const finite = (n: number) => (Number.isFinite(n) ? n : 0);

/** A point's top-left in px. An offset never reaches past its own cell (Excel clamps it the same way). */
export function pointToPx(g: Geometry, p: AnchorPoint): { x: number; y: number } {
  return {
    x: g.colX(p.col) + clamp(emuToPx(finite(p.colOff)), 0, g.colWidth(p.col)),
    y: g.rowY(p.row) + clamp(emuToPx(finite(p.rowOff)), 0, g.rowHeight(p.row)),
  };
}

/**
 * The rectangle an anchor covers, or `undefined` when the anchor lacks what its kind needs.
 * - twoCell: `from` to `to`, each with its offsets;
 * - oneCell: `from` plus `ext`;
 * - absolute: `pos` plus `ext`, from the sheet origin.
 */
export function anchorRect(a: Anchor, g: Geometry): Rect | undefined {
  if (a.anchor === 'twoCell') {
    if (!a.from || !a.to) return undefined;
    const p0 = pointToPx(g, a.from), p1 = pointToPx(g, a.to);
    return { x: Math.min(p0.x, p1.x), y: Math.min(p0.y, p1.y), width: Math.abs(p1.x - p0.x), height: Math.abs(p1.y - p0.y) };
  }
  if (!a.ext) return undefined;
  const width = emuToPx(finite(a.ext.cx)), height = emuToPx(finite(a.ext.cy));
  if (a.anchor === 'oneCell') {
    if (!a.from) return undefined;
    const p = pointToPx(g, a.from);
    return { x: p.x, y: p.y, width, height };
  }
  if (!a.pos) return undefined;
  return { x: emuToPx(finite(a.pos.x)), y: emuToPx(finite(a.pos.y)), width, height };
}

/** The last index in `[0, max)` whose start (`at(i)`) is at or before `v`. `at` must not decrease. */
function indexAt(at: (i: number) => number, v: number, max: number): number {
  let lo = 0, hi = max - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (at(mid) <= v) lo = mid; else hi = mid - 1;
  }
  return lo;
}

const MAX_COLS = 16384;
const MAX_ROWS = 1048576;

/** The zero-based cell under a point in sheet space (px at 100 %). */
export function cellAt(g: Geometry, x: number, y: number): { row: number; col: number } {
  return { col: indexAt((c) => g.colX(c), Math.max(0, x), MAX_COLS), row: indexAt((r) => g.rowY(r), Math.max(0, y), MAX_ROWS) };
}

/** `0` → `A`, `25` → `Z`, `26` → `AA`. */
export function colLabel(col: number): string {
  let s = '';
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Zero-based row and column → `A1`. */
export const refOf = (row: number, col: number): string => `${colLabel(col)}${row + 1}`;
