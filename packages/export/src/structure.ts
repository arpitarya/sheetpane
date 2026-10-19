// Inserting and deleting rows and columns (W-52): one operation, and what it does to
// every reference — an index, a span, an A1 range, a sqref list and a formula. Pure;
// the in-memory workbook (@sheetpane/import), the store and patchXlsx all shift
// through these, so the page and the download agree (SR-EXPORT decision 11).
import { MAX_COLS, MAX_ROWS, colIndex, colName, type RangePos } from './refs.js';

/** The four structural operations. */
export type StructureOpName = 'insertRows' | 'deleteRows' | 'insertCols' | 'deleteCols';

/**
 * One insert or delete of whole rows or columns on one sheet. `at` is 0-based (row 1 is 0,
 * column A is 0): an insert puts `count` new rows (columns) at `at`, moving `at` and everything
 * after it down (right); a delete removes `at` … `at + count − 1`.
 */
export interface StructureOp {
  /** The sheet's name. */
  sheet: string;
  op: StructureOpName;
  /** The first row or column, 0-based. */
  at: number;
  /** How many rows or columns; at least 1. */
  count: number;
}

/** Whether the operation moves rows (else columns). */
export const isRowOp = (o: Pick<StructureOp, 'op'>): boolean => o.op === 'insertRows' || o.op === 'deleteRows';
/** Whether the operation inserts (else deletes). */
export const isInsertOp = (o: Pick<StructureOp, 'op'>): boolean => o.op === 'insertRows' || o.op === 'insertCols';
const limit = (o: Pick<StructureOp, 'op'>) => (isRowOp(o) ? MAX_ROWS : MAX_COLS);

/**
 * The operation that undoes this one: an insert's inverse deletes the same span, and back.
 * @param o - The operation.
 * @returns The inverse operation.
 */
export function inverseOp(o: StructureOp): StructureOp {
  const op: StructureOpName = o.op === 'insertRows' ? 'deleteRows' : o.op === 'deleteRows' ? 'insertRows' : o.op === 'insertCols' ? 'deleteCols' : 'insertCols';
  return { ...o, op };
}

/**
 * Where one row or column index lands (on the operation's axis).
 * @param i - The 0-based index.
 * @param o - The operation.
 * @returns The new index, or `undefined` when it was deleted or pushed off the sheet.
 */
export function shiftIndex(i: number, o: StructureOp): number | undefined {
  if (i < o.at) return i;
  if (isInsertOp(o)) { const j = i + o.count; return j < limit(o) ? j : undefined; }
  return i < o.at + o.count ? undefined : i - o.count;
}

/**
 * Where a span of rows or columns lands: an insert inside it widens it, a delete clips it —
 * as Excel moves a range.
 * @param a - The span's first index, 0-based.
 * @param b - The span's last index, inclusive.
 * @param o - The operation.
 * @returns The new span, or `undefined` when all of it was deleted (or pushed off the sheet).
 */
export function shiftSpan(a: number, b: number, o: StructureOp): [number, number] | undefined {
  const max = limit(o) - 1;
  if (isInsertOp(o)) {
    if (a >= o.at) return a + o.count > max ? undefined : [a + o.count, Math.min(b + o.count, max)];
    return b >= o.at ? [a, Math.min(b + o.count, max)] : [a, b];
  }
  const end = o.at + o.count;
  if (b < o.at) return [a, b];
  if (a >= end) return [a - o.count, b - o.count];
  if (a >= o.at && b < end) return undefined;
  return [a < o.at ? a : o.at, b >= end ? b - o.count : o.at - 1];
}

/**
 * A count of leading rows or columns (frozen panes, a split): an insert inside it grows it, a
 * delete inside it shrinks it.
 * @param n - How many leading rows or columns.
 * @param o - The operation.
 * @returns The new count.
 */
export function shiftCount(n: number, o: StructureOp): number {
  if (isInsertOp(o)) return o.at < n ? Math.min(n + o.count, limit(o)) : n;
  return n - Math.max(0, Math.min(n, o.at + o.count) - o.at);
}

/**
 * A range's corners after the operation (on the sheet it names).
 * @param r - The range, 0-based.
 * @param o - The operation.
 * @returns The moved range, or `undefined` when every row (or column) of it was deleted.
 */
export function shiftRangePos(r: RangePos, o: StructureOp): RangePos | undefined {
  if (isRowOp(o)) { const s = shiftSpan(r.top, r.bottom, o); return s && { ...r, top: s[0], bottom: s[1] }; }
  const s = shiftSpan(r.left, r.right, o);
  return s && { ...r, left: s[0], right: s[1] };
}

/**
 * Whether the operation splits a range on its axis — a delete that removes some of the range's
 * rows (columns) but not all, or an insert strictly inside it. A merge, a table or a pivot that
 * this is true for is refused (W-52).
 * @param r - The range, 0-based.
 * @param o - The operation.
 * @returns True when the range would be cut.
 */
export function splitsRange(r: RangePos, o: StructureOp): boolean {
  const [a, b] = isRowOp(o) ? [r.top, r.bottom] : [r.left, r.right];
  if (isInsertOp(o)) return o.at > a && o.at <= b;
  const end = o.at + o.count - 1;
  const meets = o.at <= b && end >= a;
  return meets && !(o.at <= a && end >= b);
}

/**
 * Whether the operation moves or changes a range at all (on its sheet): it is at or before the
 * range's end on the operation's axis. Pivot locations and sources are refused when true.
 * @param r - The range, 0-based.
 * @param o - The operation.
 * @returns True when the range's address would change.
 */
export function movesRange(r: RangePos, o: StructureOp): boolean {
  return o.at <= (isRowOp(o) ? r.bottom : r.right);
}

/**
 * Why an operation cannot be followed by an Excel table, or `undefined` when it can (W-52): a
 * table grows with rows inserted inside it, loses deleted body rows and deleted columns, and moves
 * whole; it is refused when the operation deletes all of it, its header or totals row, every data
 * row, or inserts columns inside it (new columns would need names Excel checks).
 * @param r - The table's range, 0-based.
 * @param o - The operation, on the table's sheet.
 * @param t - The table's name, and whether it has a header row (default yes) and a totals row.
 * @returns The reason, as the end of a sentence (`deletes the header row of table Items`).
 */
export function tableRefusal(r: RangePos, o: StructureOp, t: { name?: string; header?: boolean; totals?: boolean } = {}): string | undefined {
  if (!movesRange(r, o)) return undefined;
  const name = t.name ?? 'a table', rows = isRowOp(o), header = t.header ?? true, totals = t.totals ?? false;
  const [a, b] = rows ? [r.top, r.bottom] : [r.left, r.right];
  const end = o.at + o.count - 1;
  if (isInsertOp(o)) return !rows && o.at > a && o.at <= b ? `inserts columns inside table ${name}` : undefined;
  if (o.at <= a && end >= b) return `deletes all of table ${name}`;
  if (!rows) return undefined;
  const hits = (i: number) => o.at <= i && end >= i;
  if (header && hits(r.top)) return `deletes the header row of table ${name}`;
  if (totals && hits(r.bottom)) return `deletes the totals row of table ${name}`;
  const left = b - a + 1 - Math.max(0, Math.min(b, end) - Math.max(a, o.at) + 1);
  if (left < (header ? 1 : 0) + (totals ? 1 : 0) + 1) return `leaves table ${name} without a data row`;
  return undefined;
}

// ── text: A1 references, sqref lists and formulas ───────────────────────────

const CELL_RE = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})$/;
const COLS_RE = /^(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})$/;
const ROWS_RE = /^(\$?)(\d{1,7}):(\$?)(\d{1,7})$/;

type Part = { cd: string; c: number; rd: string; r: number };
const cellPart = (s: string): Part | undefined => {
  const m = CELL_RE.exec(s);
  if (!m) return undefined;
  const c = colIndex(m[2]!), r = Number(m[4]) - 1;
  return c < MAX_COLS && r >= 0 && r < MAX_ROWS ? { cd: m[1]!, c, rd: m[3]!, r } : undefined;
};
const cellText = (p: Part) => `${p.cd}${colName(p.c)}${p.rd}${p.r + 1}`;

/** Shifts one reference body (no sheet prefix): a cell, `A1:B2`, `A:C` or `3:5`; `null` = not a reference. */
function shiftBody(body: string, o: StructureOp): string | undefined | null {
  const rows = isRowOp(o);
  let m = COLS_RE.exec(body);
  if (m) {
    if (rows) return body;
    const s = shiftSpan(colIndex(m[2]!), colIndex(m[4]!), o);
    return s && `${m[1]}${colName(s[0])}:${m[3]}${colName(s[1])}`;
  }
  m = ROWS_RE.exec(body);
  if (m) {
    if (!rows) return body;
    const s = shiftSpan(Number(m[2]) - 1, Number(m[4]) - 1, o);
    return s && `${m[1]}${s[0] + 1}:${m[3]}${s[1] + 1}`;
  }
  const [a, b, extra] = body.split(':');
  if (extra !== undefined) return null;
  const p = cellPart(a ?? '');
  if (!p) return null;
  if (b === undefined) {
    const i = shiftIndex(rows ? p.r : p.c, o);
    if (i === undefined) return undefined;
    return cellText(rows ? { ...p, r: i } : { ...p, c: i });
  }
  const q = cellPart(b);
  if (!q) return null;
  // the corners as written may be in either order; shift the normalised span and keep each corner's `$`
  const lo = rows ? Math.min(p.r, q.r) : Math.min(p.c, q.c), hi = rows ? Math.max(p.r, q.r) : Math.max(p.c, q.c);
  const s = shiftSpan(lo, hi, o);
  if (!s) return undefined;
  const firstLow = rows ? p.r <= q.r : p.c <= q.c;
  const [na, nb] = firstLow ? s : [s[1], s[0]];
  return `${cellText(rows ? { ...p, r: na } : { ...p, c: na })}:${cellText(rows ? { ...q, r: nb } : { ...q, c: nb })}`;
}

/**
 * Shifts an A1 reference on the operation's sheet: `B3`, `$B$3`, `A1:C4`, `A:C`, `3:5`.
 * @param ref - The reference, without a sheet name.
 * @param o - The operation.
 * @returns The moved reference (with its `$` signs), `undefined` when it was deleted, or the
 *   text unchanged when it is not a reference.
 */
export function shiftRefText(ref: string, o: StructureOp): string | undefined {
  const r = shiftBody(ref.trim(), o);
  return r === null ? ref : r;
}

/**
 * Shifts a space-separated `sqref` (`A1:B5 D2`) or a list of ranges; ranges wholly deleted go.
 * @param sqref - The ranges, as one string or a list.
 * @param o - The operation.
 * @returns The moved ranges, in order; empty when every one was deleted.
 */
export function shiftSqref(sqref: string | readonly string[], o: StructureOp): string[] {
  const list = typeof sqref === 'string' ? sqref.trim().split(/\s+/).filter(Boolean) : sqref;
  return list.flatMap((r) => { const s = shiftRefText(r, o); return s === undefined ? [] : [s]; });
}

const BOUNDARY = /[\p{L}\p{N}_.$]/u;
const SHEET_3D = /(?:'(?:[^']|'')+'|[\p{L}_][\p{L}\p{N}_.]*):(?:'(?:[^']|'')+'|[\p{L}_][\p{L}\p{N}_.]*)!/uy;
const SHEET_Q = /'((?:[^']|'')+)'!/uy;
const SHEET_U = /([\p{L}_][\p{L}\p{N}_.]*)!/uy;
const REF_AT = /(\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}(?![\p{L}\p{N}_(]))|(\$?[A-Za-z]{1,3}\$?\d{1,7}(?::\$?[A-Za-z]{1,3}\$?\d{1,7})?(?![\p{L}\p{N}_(.!:]))|(\$?\d{1,7}:\$?\d{1,7}(?![\p{L}\p{N}_(.]))/uy;

/**
 * Moves every reference a formula makes to the operation's sheet — as Excel does when rows or
 * columns are inserted or deleted. A reference to a deleted cell becomes `#REF!` (`Sheet1!#REF!`
 * when qualified); a range loses its deleted rows. Strings, other sheets, external workbooks
 * (`[1]Sheet1!A1`), 3-D references and structured references are left as written.
 * @param f - The formula, without its `=`.
 * @param host - The sheet the formula sits on (its unqualified references are that sheet's);
 *   `undefined` for a defined name, whose unqualified references are left alone.
 * @param o - The operation.
 * @returns The formula with its references moved; the same string when nothing moved.
 */
export function restructureFormula(f: string, host: string | undefined, o: StructureOp): string {
  const target = o.sheet.toUpperCase();
  const hostIs = host !== undefined && host.toUpperCase() === target;
  let out = '', i = 0, changed = false;
  while (i < f.length) {
    const ch = f[i]!;
    if (ch === '"') {
      let j = i + 1;
      for (; j < f.length; j++) if (f[j] === '"') { if (f[j + 1] === '"') j++; else break; }
      out += f.slice(i, j + 1); i = j + 1; continue;
    }
    if (ch === '[') { // a structured reference or an external workbook's index: copied whole, nesting kept
      let depth = 0, j = i;
      for (; j < f.length; j++) { if (f[j] === '[') depth++; else if (f[j] === ']' && --depth === 0) break; }
      out += f.slice(i, j + 1); i = j + 1;
      // `[1]Sheet1!A1`: an external reference — the sheet and its reference are copied too
      SHEET_Q.lastIndex = i; SHEET_U.lastIndex = i;
      const ext = SHEET_Q.exec(f) ?? SHEET_U.exec(f);
      if (ext) { out += ext[0]; i += ext[0].length; REF_AT.lastIndex = i; const r = REF_AT.exec(f); if (r) { out += r[0]; i += r[0].length; } }
      continue;
    }
    if (i > 0 && BOUNDARY.test(f[i - 1]!)) { out += ch; i++; continue; }
    let sheet: string | undefined, prefix = '', verbatim = false;
    SHEET_3D.lastIndex = i;
    let m = SHEET_3D.exec(f);
    if (m) { prefix = m[0]; verbatim = true; }
    else {
      SHEET_Q.lastIndex = i;
      m = SHEET_Q.exec(f);
      if (m) { prefix = m[0]; sheet = m[1]!.replace(/''/g, "'"); verbatim = sheet.startsWith('[') || sheet.includes(':'); }
      else { SHEET_U.lastIndex = i; m = SHEET_U.exec(f); if (m) { prefix = m[0]; sheet = m[1]!; } }
    }
    REF_AT.lastIndex = i + prefix.length;
    const r = REF_AT.exec(f);
    if (!r) {
      if (prefix) { out += prefix; i += prefix.length; continue; } // `Sheet1!Name`: a sheet-scoped name
      out += ch; i++; continue;
    }
    const mine = !verbatim && (sheet !== undefined ? sheet.toUpperCase() === target : hostIs);
    let body = r[0];
    if (mine) {
      const s = shiftBody(body, o);
      if (s !== null && s !== body) { body = s ?? '#REF!'; changed = true; }
    }
    out += prefix + body;
    i += prefix.length + r[0].length;
  }
  return changed ? out : f;
}
