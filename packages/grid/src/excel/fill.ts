// The fill handle's arithmetic (Excel's AutoFill): what the cells beyond a source run hold when the
// handle is dragged past them, or Ctrl+D / Ctrl+R copies down or right. Pure, so it is tested alone.
import { shiftFormula } from '@sheetpane/export';

/** How a fill continues its source. */
export interface FillOptions {
  /** `back`: filling up or left, away from the source's first cell. */
  back?: boolean;
  /** Ctrl/⌘ held: a single number counts up, several numbers copy (Excel's toggle). */
  invert?: boolean;
  /** Ctrl+D / Ctrl+R: copy the source exactly — no series, no counting; formulas still move. */
  copy?: boolean;
  /** One step along the fill, in rows and columns, for shifting formulas: `{ dr: 1, dc: 0 }` down. */
  unit: { dr: number; dc: number };
}

const NUM = /^\s*-?(\d+(\.\d*)?|\.\d+)\s*$/;
const TEXT_NUM = /^(.*\D)(\d+)$/;
const decimals = (s: string) => { const m = s.trim().match(/\.(\d+)$/); return m ? m[1]!.length : 0; };

/**
 * The values for `count` cells continuing `src`, nearest first.
 * - Numbers: two or more make a linear series (1, 3 → 5, 7); one number repeats. Ctrl/⌘ swaps the two.
 * - Text ending in a number counts on (`Q1` → `Q2`, `Item 09` → `Item 10`), unless Ctrl/⌘ is held.
 * - A formula moves with the fill: its relative references shift by the distance (`=B2*C2` → `=B3*C3`).
 * - Anything else repeats, the source as a cycle.
 * @param src - The source inputs in sheet order (top to bottom, or left to right), as typed.
 * @param count - How many cells to fill.
 * @param o - Direction, the Ctrl/⌘ toggle, and the step for formulas.
 * @returns The inputs to write, nearest the source first.
 */
export function fillSeries(src: readonly string[], count: number, o: FillOptions): string[] {
  const n = src.length, out: string[] = [];
  if (!n || count <= 0) return out;
  const nums = src.map((s) => (NUM.test(s) ? Number(s) : NaN));
  const allNum = nums.every((x) => Number.isFinite(x));
  const series = !o.copy && allNum && (n >= 2) !== !!o.invert;
  if (series) {
    const step = n >= 2 ? (nums[n - 1]! - nums[0]!) / (n - 1) : 1;
    const dp = Math.min(10, Math.max(...src.map(decimals), decimals(String(step))));
    for (let t = 0; t < count; t++) {
      const v = o.back ? nums[0]! - step * (t + 1) : nums[n - 1]! + step * (t + 1);
      out.push(String(Number(v.toFixed(dp))));
    }
    return out;
  }
  for (let t = 0; t < count; t++) {
    const cycle = Math.floor(t / n) + 1;
    const i = o.back ? n - 1 - (t % n) : t % n;
    const s = src[i]!;
    if (s.startsWith('=')) {
      const k = (o.back ? -1 : 1) * n * cycle;
      out.push(shiftFormula(s, o.unit.dr * k, o.unit.dc * k));
      continue;
    }
    const m = !o.copy && !o.invert && !allNum ? s.match(TEXT_NUM) : null;
    if (m) {
      const next = Number(m[2]) + (o.back ? -1 : 1) * cycle * n;
      if (next >= 0) { out.push(m[1] + String(next).padStart(m[2]!.length, '0')); continue; }
    }
    out.push(s);
  }
  return out;
}

/**
 * The rows (or columns) a double-click on the fill handle fills: down to the last filled cell of the
 * column beside the source, as Excel does — the left one, else the right one.
 * @param hasValue - Whether a cell holds something.
 * @param from - The source's last row.
 * @param left - The source's first column; the column left of it is looked at first.
 * @param right - The source's last column; the column right of it is looked at next.
 * @param rows - The sheet's row count.
 * @returns The last row to fill, or `from` when there is nothing beside.
 */
export function fillDownTo(hasValue: (row: number, col: number) => boolean, from: number, left: number, right: number, rows: number): number {
  for (const col of [left - 1, right + 1]) {
    if (col < 0) continue;
    if (!hasValue(from + 1, col)) continue;
    let r = from + 1;
    while (r + 1 < rows && hasValue(r + 1, col)) r++;
    return r;
  }
  return from;
}
