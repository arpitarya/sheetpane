// Cell references a chart part names: `c:f` formulas such as `Sheet1!$B$2:$B$5`,
// `'Q1 data'!$A$2:$A$9` or a multi-area `(Sheet1!$A$2,Sheet1!$A$4:$A$6)`. Pure, no DOM.
// Kept here rather than imported from @sheetpane/export so the package's only peer is the grid.

/** A rectangle of cells on one sheet; zero-based, inclusive. */
export interface SourceRange {
  sheet: string;
  /** `B2:B5` (no `$`), or a single `B2`. */
  range: string;
  top: number;
  left: number;
  bottom: number;
  right: number;
}

const CELL = /^\$?([A-Za-z]{1,3})\$?([1-9][0-9]{0,6})$/;

/** `A` → 0, `AA` → 26. */
export function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** `0` → `A`, `26` → `AA`. */
export function colName(col: number): string {
  let s = '';
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

export const cellRef = (row: number, col: number): string => `${colName(col)}${row + 1}`;

/** `B3` or `$B$3` → `{ row: 2, col: 1 }`. */
export function parseCell(ref: string): { row: number; col: number } | undefined {
  const m = CELL.exec(ref.trim());
  if (!m) return undefined;
  const col = colIndex(m[1]!), row = Number(m[2]) - 1;
  if (col >= 16384 || row >= 1048576) return undefined;
  return { row, col };
}

/** `A1:B2` → corners, normalised. */
export function parseArea(area: string): Omit<SourceRange, 'sheet'> | undefined {
  const [a, b = a] = area.split(':');
  const p = parseCell(a ?? ''), q = parseCell(b ?? '');
  if (!p || !q) return undefined;
  const top = Math.min(p.row, q.row), left = Math.min(p.col, q.col), bottom = Math.max(p.row, q.row), right = Math.max(p.col, q.col);
  const range = top === bottom && left === right ? cellRef(top, left) : `${cellRef(top, left)}:${cellRef(bottom, right)}`;
  return { range, top, left, bottom, right };
}

/** Splits on commas outside single quotes. */
function splitAreas(f: string): string[] {
  const out: string[] = [];
  let cur = '', quoted = false;
  for (let i = 0; i < f.length; i++) {
    const ch = f[i]!;
    if (ch === "'") { quoted = !quoted; cur += ch; continue; }
    if (ch === ',' && !quoted) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

const AREA = /^(?:'((?:[^']|'')+)'|([^'!]+))!(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?)$/;

/**
 * The cell ranges a `c:f` formula names. Anything that is not a plain sheet-qualified
 * reference — a defined name, an external workbook (`[1]Sheet1!A1`), a whole column — is skipped.
 */
export function parseFormulaRefs(f: string | undefined): SourceRange[] {
  if (!f) return [];
  let s = f.trim();
  if (s.startsWith('(') && s.endsWith(')')) s = s.slice(1, -1);
  const out: SourceRange[] = [];
  for (const part of splitAreas(s)) {
    const m = AREA.exec(part);
    if (!m) continue;
    const sheet = m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2]!;
    if (sheet.startsWith('[')) continue;
    const a = parseArea(m[3]!);
    if (a) out.push({ sheet, ...a });
  }
  return out;
}

/** The cells of the ranges in reading order: down a column, across a row, row by row for a block. */
export function cellsOf(ranges: readonly SourceRange[]): { sheet: string; ref: string }[] {
  const out: { sheet: string; ref: string }[] = [];
  for (const r of ranges) {
    for (let row = r.top; row <= r.bottom; row++) for (let col = r.left; col <= r.right; col++) out.push({ sheet: r.sheet, ref: cellRef(row, col) });
  }
  return out;
}

export const contains = (r: SourceRange, sheet: string, row: number, col: number): boolean =>
  r.sheet === sheet && row >= r.top && row <= r.bottom && col >= r.left && col <= r.right;

export const intersects = (a: Omit<SourceRange, 'sheet' | 'range'>, b: Omit<SourceRange, 'sheet' | 'range'>): boolean =>
  a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom;

/** `Holdings!E3:E15`, quoting a sheet name that needs it. */
export function qualified(r: SourceRange): string {
  const name = /^[A-Za-z_][A-Za-z0-9_.]*$/.test(r.sheet) ? r.sheet : `'${r.sheet.replace(/'/g, "''")}'`;
  return `${name}!${r.range}`;
}

/** The ranges without duplicates (same sheet and corners), first occurrence first. */
export function uniqueRanges(list: readonly SourceRange[]): SourceRange[] {
  const seen = new Set<string>();
  return list.filter((r) => { const k = `${r.sheet}!${r.range}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

/**
 * What one `select()` can show of a union of ranges: the ranges on the first range's sheet, as
 * their bounding box when that box is exactly their union (adjacent columns, say), else the first
 * range alone. The grid's selection is one rectangle; a multi-area selection would need core.
 */
export function selectionFor(list: readonly SourceRange[]): { sheet: string; ref: string; range?: string } | undefined {
  const first = list[0];
  if (!first) return undefined;
  const same = uniqueRanges(list.filter((r) => r.sheet === first.sheet));
  const box = same.reduce((b, r) => ({ top: Math.min(b.top, r.top), left: Math.min(b.left, r.left), bottom: Math.max(b.bottom, r.bottom), right: Math.max(b.right, r.right) }), { top: first.top, left: first.left, bottom: first.bottom, right: first.right });
  const area = (r: { top: number; left: number; bottom: number; right: number }) => (r.bottom - r.top + 1) * (r.right - r.left + 1);
  const disjoint = same.every((a, i) => same.every((b, j) => i >= j || !intersects(a, b)));
  const exact = disjoint && same.reduce((n, r) => n + area(r), 0) === area(box);
  const pick = exact ? box : first;
  const ref = cellRef(pick.top, pick.left);
  const single = pick.top === pick.bottom && pick.left === pick.right;
  return single ? { sheet: first.sheet, ref } : { sheet: first.sheet, ref, range: `${ref}:${cellRef(pick.bottom, pick.right)}` };
}
