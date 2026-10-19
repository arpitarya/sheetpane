// A1 references: zero-based row/column numbers in, Excel names out, and back.

/** Excel's row limit. */
export const MAX_ROWS = 1_048_576;
/** Excel's column limit (column XFD). */
export const MAX_COLS = 16_384;

/**
 * A zero-based column number as its letters: 0 → "A", 25 → "Z", 26 → "AA".
 *
 * @param col - The zero-based column.
 * @returns The column's letters.
 */
export function colName(col: number): string {
  let s = '';
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/**
 * Column letters as a zero-based number: "A" → 0, "AA" → 26. Case-insensitive.
 *
 * @param name - The column's letters.
 * @returns The zero-based column.
 */
export function colIndex(name: string): number {
  let n = 0;
  for (const ch of name.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** A cell's zero-based row and column. */
export interface CellPos { row: number; col: number }
/** A range's zero-based corners, inclusive. */
export interface RangePos { top: number; left: number; bottom: number; right: number }

const REF = /^\$?([A-Za-z]{1,3})\$?([1-9][0-9]{0,6})$/;

/**
 * Parses an A1 reference: "B3" or "$B$3" → { row: 2, col: 1 }.
 *
 * @param ref - The reference; `$` signs are ignored.
 * @returns The position, or `undefined` if malformed or past Excel's limits.
 */
export function parseRef(ref: string): CellPos | undefined {
  const m = REF.exec(ref.trim());
  if (!m) return undefined;
  const col = colIndex(m[1]!), row = Number(m[2]) - 1;
  if (col >= MAX_COLS || row >= MAX_ROWS) return undefined;
  return { row, col };
}

/**
 * A zero-based position as an A1 reference: (2, 1) → "B3".
 *
 * @param row - The zero-based row.
 * @param col - The zero-based column.
 * @returns The reference.
 */
export function cellRef(row: number, col: number): string {
  return colName(col) + (row + 1);
}

/**
 * Parses "A1:J1" (or a single "B2") into its corners, normalised.
 *
 * @param range - The range.
 * @returns The corners, or `undefined` if malformed.
 */
export function parseRange(range: string): RangePos | undefined {
  const [a, b = a] = range.split(':');
  const p = parseRef(a ?? ''), q = parseRef(b ?? '');
  if (!p || !q) return undefined;
  return { top: Math.min(p.row, q.row), left: Math.min(p.col, q.col), bottom: Math.max(p.row, q.row), right: Math.max(p.col, q.col) };
}

/**
 * Corners as an A1 range; a single cell comes back as one reference.
 *
 * @param r - The corners.
 * @returns The range, e.g. "A1:J1" or "B2".
 */
export function rangeRef(r: RangePos): string {
  const a = cellRef(r.top, r.left), b = cellRef(r.bottom, r.right);
  return a === b ? a : `${a}:${b}`;
}

/**
 * Whether two ranges share at least one cell.
 *
 * @param a - One range.
 * @param b - The other range.
 * @returns True when they overlap.
 */
export function rangesIntersect(a: RangePos, b: RangePos): boolean {
  return a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom;
}

// ── structured references (W-61): `Units[Name]`, `Units[[#Data],[Name]]` ──

/** What the structured-reference resolver reads of an Excel table — `@sheetpane/import`'s `Table` fits. */
export interface TableShape {
  /** The name formulas use (`displayName`). */
  name: string;
  /** The whole table, header and totals rows included: `A1:C10`. */
  ref: string;
  /** Header rows, 0 or 1. */
  headerRowCount: number;
  /** Totals rows, 0 or 1. */
  totalsRowCount: number;
  /** The columns, left to right. */
  columns: readonly { name: string }[];
}

/** A structured reference resolved to plain cells. */
export interface StructuredRef {
  /** The sheet the table sits on. */
  sheet: string;
  /** The table's name, as the workbook spells it. */
  table: string;
  /** The cells, zero-based and inclusive. */
  range: RangePos;
  /** The same cells as an A1 range, e.g. `A2:A5`. */
  ref: string;
}

type Item = { special: boolean; text: string } | ':';

/** The bracketed items of a structured reference's body — `[#Data],[Name]` or `[A]:[B]` — with `'` escapes undone. */
function bracketItems(s: string): Item[] | undefined {
  const out: Item[] = [];
  let i = 0;
  const skip = () => { while (s[i] === ' ') i++; };
  for (;;) {
    skip();
    if (s[i] !== '[') return undefined;
    let text = '', j = i + 1;
    const special = s[j] === '#';
    for (; j < s.length && s[j] !== ']'; j++) { if (s[j] === "'") j++; text += s[j] ?? ''; }
    if (j >= s.length) return undefined;
    out.push({ special, text: text.trim() });
    i = j + 1;
    skip();
    if (i >= s.length) return out;
    if (s[i] === ',') i++;
    else if (s[i] === ':') { out.push(':'); i++; }
    else return undefined;
  }
}

/** A column specifier's text, `'` escapes undone (`Unit '#` → `Unit #`). */
const unescapeColumn = (s: string) => s.replace(/'(.)/g, '$1').trim();

const NAME = /^([A-Za-z_\\][\w.\\]*)\s*(?:\[(.*)\])?$/s;

/**
 * Resolves a structured reference to the cells it names: `Units[Name]` and `Units[[#Data],[Name]]` (the
 * column's data rows), `Units[[#Headers],[Name]]`, `Units[[#Totals],[Name]]`, `Units[[#All],[Name]]`,
 * a column span `Units[[Name]:[Code]]`, `Units[#Data]`, `Units[]` and the bare `Units` (the data body).
 * Table and column names are case-insensitive; `'` escapes `[ ] # '` in a column name. `[#This Row]`
 * (`@`), a union of columns and a band that is not there (`#Totals` with the totals row off) resolve to
 * nothing.
 *
 * @param formula - The reference, with or without a leading `=`.
 * @param sheets - The workbook's sheets, each with its tables — an `ImportedWorkbook`'s `sheets` fits.
 * @returns The sheet and the cells, or `undefined` when it names no table, no column, or nothing contiguous.
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0103_EXPORT.md
 * @example
 * ```ts
 * import { resolveStructuredRef } from '@sheetpane/export';
 *
 * // an imported workbook's `sheets` (each with its `tables`) fits as it is
 * const sheets = [{ name: 'Lists', tables: [{ name: 'Units', ref: 'A1:B5', headerRowCount: 1, totalsRowCount: 0, columns: [{ name: 'Name' }, { name: 'Code' }] }] }];
 * resolveStructuredRef('Units[Name]', sheets)?.ref; // 'A2:A5' — the Name column's data rows
 * ```
 */
export function resolveStructuredRef(formula: string, sheets: readonly { name: string; tables?: readonly TableShape[] }[]): StructuredRef | undefined {
  const m = NAME.exec(formula.trim().replace(/^=\s*/, ''));
  if (!m) return undefined;
  const want = m[1]!.toLowerCase();
  let sheet: string | undefined, table: TableShape | undefined;
  for (const s of sheets) {
    const t = s.tables?.find((x) => x.name.toLowerCase() === want);
    if (t) { sheet = s.name; table = t; break; }
  }
  const box = table && parseRange(table.ref);
  if (!sheet || !table || !box) return undefined;
  const body = (m[2] ?? '').trim();
  const specials: string[] = [];
  let cols: string[] = [];
  if (body.startsWith('[')) {
    const items = bracketItems(body);
    if (!items) return undefined;
    for (let i = 0; i < items.length; i++) {
      const it = items[i]!;
      if (it === ':') return undefined; // a span is read with its left column, below
      if (it.special) { specials.push(it.text.toLowerCase().replace(/\s+/g, ' ')); continue; }
      if (cols.length) return undefined; // a union of columns is not one range
      const next = items[i + 1], right = items[i + 2];
      if (next === ':') {
        if (!right || right === ':' || right.special) return undefined;
        cols = [it.text, right.text];
        i += 2;
      } else cols = [it.text];
    }
  } else if (body.startsWith('#')) specials.push(body.toLowerCase().replace(/\s+/g, ' '));
  else if (body) cols = [unescapeColumn(body)];
  // columns: all of them, one, or a span
  let left = box.left, right = box.right;
  if (cols.length) {
    const at = cols.map((c) => table.columns.findIndex((x) => x.name.trim().toLowerCase() === c.toLowerCase()));
    if (at.some((i) => i < 0)) return undefined;
    left = box.left + Math.min(...at);
    right = box.left + Math.max(...at);
    if (right > box.right) return undefined;
  }
  // rows: the data body unless a special item names bands; the bands must touch
  const h = Math.max(0, table.headerRowCount), t = Math.max(0, table.totalsRowCount);
  const bands = {
    '#headers': h ? [box.top, box.top + h - 1] : undefined,
    '#data': box.top + h <= box.bottom - t ? [box.top + h, box.bottom - t] : undefined,
    '#totals': t ? [box.bottom - t + 1, box.bottom] : undefined,
    '#all': [box.top, box.bottom],
  } as Record<string, [number, number] | undefined>;
  const named = specials.length ? specials : ['#data'];
  const picked: [number, number][] = [];
  for (const s of named) {
    if (!(s in bands)) return undefined; // #This Row, or not a special item
    const b = bands[s];
    if (!b) return undefined;
    picked.push(b);
  }
  picked.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < picked.length; i++) if (picked[i]![0] > picked[i - 1]![1] + 1) return undefined; // #Headers,#Totals
  const range = { top: picked[0]![0], bottom: Math.max(...picked.map((p) => p[1])), left, right };
  return { sheet, table: table.name, range, ref: rangeRef(range) };
}
