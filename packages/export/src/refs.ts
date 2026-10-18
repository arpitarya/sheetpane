// A1 references: zero-based row/column numbers in, Excel names out, and back.

export const MAX_ROWS = 1_048_576;
export const MAX_COLS = 16_384;

/** 0 → "A", 25 → "Z", 26 → "AA". */
export function colName(col: number): string {
  let s = '';
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** "A" → 0, "AA" → 26. Case-insensitive. */
export function colIndex(name: string): number {
  let n = 0;
  for (const ch of name.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export interface CellPos { row: number; col: number }
export interface RangePos { top: number; left: number; bottom: number; right: number }

const REF = /^\$?([A-Za-z]{1,3})\$?([1-9][0-9]{0,6})$/;

/** "B3" or "$B$3" → { row: 2, col: 1 }; undefined if malformed or past Excel's limits. */
export function parseRef(ref: string): CellPos | undefined {
  const m = REF.exec(ref.trim());
  if (!m) return undefined;
  const col = colIndex(m[1]!), row = Number(m[2]) - 1;
  if (col >= MAX_COLS || row >= MAX_ROWS) return undefined;
  return { row, col };
}

export function cellRef(row: number, col: number): string {
  return colName(col) + (row + 1);
}

/** "A1:J1" (or a single "B2") → its corners, normalised; undefined if malformed. */
export function parseRange(range: string): RangePos | undefined {
  const [a, b = a] = range.split(':');
  const p = parseRef(a ?? ''), q = parseRef(b ?? '');
  if (!p || !q) return undefined;
  return { top: Math.min(p.row, q.row), left: Math.min(p.col, q.col), bottom: Math.max(p.row, q.row), right: Math.max(p.col, q.col) };
}

export function rangeRef(r: RangePos): string {
  const a = cellRef(r.top, r.left), b = cellRef(r.bottom, r.right);
  return a === b ? a : `${a}:${b}`;
}

export function rangesIntersect(a: RangePos, b: RangePos): boolean {
  return a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom;
}
