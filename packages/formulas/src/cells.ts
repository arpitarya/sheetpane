// Pure JavaScript: A1 references, a cell's formula and value as the JavaScript
// workbook holds them. No WASM here — `ui.ts` and the headless plugin share it.
import { cellKey, type CellContext, type PluginContext, type Snapshot } from '@sheetpane/grid';

export type Cell = CellContext['value'];
export type Book = PluginContext['book'];
export type BookSheet = Book['sheets'][number];

export const colName = (i: number): string => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
export const colIndex = (s: string): number => [...s.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
export const cellRef = (row: number, col: number): string => `${colName(col)}${row + 1}`;
export function parseRef(ref: string): { row: number; col: number } | undefined {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})$/.exec(ref);
  if (!m) return undefined;
  const row = Number(m[2]) - 1, col = colIndex(m[1]!);
  return row >= 0 && row < 1_048_576 && col >= 0 && col < 16_384 ? { row, col } : undefined;
}
export interface Box { top: number; left: number; bottom: number; right: number }
export function parseBox(range: string): Box | undefined {
  const [a, b = a] = range.split(':') as [string, string?];
  const p = parseRef(a), q = parseRef(b ?? a);
  if (!p || !q) return undefined;
  return { top: Math.min(p.row, q.row), left: Math.min(p.col, q.col), bottom: Math.max(p.row, q.row), right: Math.max(p.col, q.col) };
}

/** Excel's error values — a string cell holding exactly one of these is an error, not text. */
export const ERRORS = new Set(['#NULL!', '#DIV/0!', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#N/A', '#GETTING_DATA', '#SPILL!', '#CALC!', '#FIELD!', '#BLOCKED!', '#CONNECT!', '#BUSY!', '#UNKNOWN!']);
export const isError = (v: unknown): boolean => typeof v === 'string' && ERRORS.has(v);

/**
 * A cell's formula (with its `=`) as the JavaScript workbook holds it now: a
 * user's `formula` change, else the file's formula unless a value replaced it.
 *
 * @param snap - A snapshot of the store.
 * @param sheet - The sheet's name.
 * @param ref - The cell, `A1`.
 * @returns The formula with its `=`, or `undefined` when the cell holds none.
 */
export function formulaIn(snap: Snapshot, sheet: string, ref: string): string | undefined {
  const c = snap.changes.get(cellKey(sheet, ref));
  if (c && c.kind === 'formula' && typeof c.now === 'string') return c.now;
  if (c && c.kind === 'value') return typeof c.now === 'string' && c.now.startsWith('=') ? c.now : undefined;
  const f = snap.book?.sheets.find((s) => s.name === sheet)?.formulas[ref];
  return f === undefined ? undefined : `=${f}`;
}

/**
 * The value a cell shows now: a user's value, a formula's computed value, else the file's.
 *
 * @param snap - A snapshot of the store.
 * @param sheet - The sheet's name.
 * @param ref - The cell, `A1`.
 * @returns The value; `null` for an empty cell or a typed formula not yet evaluated.
 */
export function valueIn(snap: Snapshot, sheet: string, ref: string): Cell {
  const k = cellKey(sheet, ref);
  const c = snap.changes.get(k);
  if (c && c.kind === 'value') return c.now as Cell;
  const d = snap.derived.get(k);
  if (d) return d.value;
  if (c && c.kind === 'formula') return null; // typed, not yet evaluated
  const s = snap.book?.sheets.find((x) => x.name === sheet), p = parseRef(ref);
  return (s && p ? s.rows[p.row]?.[p.col] : null) ?? null;
}
