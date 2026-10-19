// diffWorkbooks (W-63, SR-COMPARE decisions 2–6): what changed between two versions of a workbook.
// Sheets match by name, then a renamed sheet by content; columns by header title when both header
// rows hold distinct titles, else by position; rows by key columns when given (a row is *moved*
// only then — certain), else by alignment (patience anchors + Myers) with changed rows paired by
// similarity inside each gap; cells by value, display text and formula (compared relative, so a
// formula that only shifted with its row is not a change). Pure: no DOM, no network, Node-safe.
import { cellRef, colIndex, parseRange, rangeRef, spError, type Cell, type SheetState } from '@sheetpane/export';
import { alignIds, inOrder } from './align.js';

/** A sheet as the diff reads it — an imported sheet (`@sheetpane/import`) fits as it is. */
export interface CompareSheet {
  name: string;
  /** Row-major values: `rows[0][0]` is A1. */
  rows: readonly (readonly Cell[])[];
  /** Display text, same shape as `rows`; `String(value)` where absent. */
  text?: readonly (readonly string[])[];
  /** Formula text without `=`, by A1 ref. */
  formulas?: Readonly<Record<string, string>>;
  merges?: readonly string[];
  state?: SheetState;
  hiddenRows?: readonly number[];
  hiddenCols?: readonly number[];
  dataValidations?: readonly unknown[];
  conditionalFormats?: readonly unknown[];
}

/** A workbook as the diff reads it — an `ImportedWorkbook` fits as it is. */
export interface CompareWorkbook { sheets: readonly CompareSheet[] }

/** Key columns: header titles (matched trimmed, ignoring case) or column letters. */
export type KeySpec = string | readonly string[];

/** How to diff. */
export interface DiffOptions {
  /**
   * Key columns that identify a row, for every sheet (`'Account'`, `['Account', 'Date']`, `'A'`) or
   * per sheet (`{ Holdings: 'Account', '*': 'ID' }`, by the newer workbook's sheet name). A sheet
   * that lacks a key named for all sheets is aligned without one; a key named for that sheet must
   * exist (SP-5901). With a key, rows that changed place are *moved*; without one, never.
   */
  key?: KeySpec | Readonly<Record<string, KeySpec>>;
  /** The header row, 1-based (default 1): column titles, and the rows above it are not keyed. */
  headerRow?: number;
  /** How alike (0–1, rows in common) an unmatched sheet must be to count as renamed (default 0.5). */
  renameThreshold?: number;
}

/** One cell as a side of a change shows it. */
export interface CellState { value: Cell; text: string; formula?: string }

/** One changed cell of a row both versions hold. `ref` is in the newer sheet; `was` is null in a new column. */
export interface CellChange {
  row: number;
  col: number;
  ref: string;
  /** The cell's address in the older sheet (absent in a new column). */
  wasRef?: string;
  was: CellState | null;
  now: CellState;
  /** What differs. */
  what: ('value' | 'text' | 'formula')[];
}

/** One row that is not the same in both versions. Indexes are 0-based. */
export type RowOp =
  | { op: 'changed'; a: number; b: number }
  | { op: 'moved'; a: number; b: number }
  | { op: 'added'; b: number; values: Cell[] }
  /** `after`: the newer sheet's row it follows (−1: before the first). */
  | { op: 'removed'; a: number; after: number };

/** How one sheet changed. */
export interface SheetDiff {
  status: 'same' | 'changed' | 'added' | 'removed';
  /** The sheet's name in the older workbook (absent when added). */
  a?: string;
  /** Its name in the newer workbook (absent when removed). */
  b?: string;
  /** Matched by content, not name: how alike they are (0–1). */
  renamed?: number;
  /** Row alignment: by `key` columns (their titles or letters), else by alignment. */
  keyed: boolean;
  key?: string[];
  /** A key named for every sheet that this sheet lacks. */
  note?: string;
  /** How columns were matched; `map[bCol]` is the older column, −1 when new. */
  columns: { by: 'header' | 'position'; map: number[]; added: number[]; removed: number[]; moved: { a: number; b: number }[] };
  /** Every row that is not the same, in the newer sheet's order (a removed row after the row it followed). */
  rows: RowOp[];
  cells: CellChange[];
  merges: { added: string[]; removed: string[] };
  hidden: { rows: { hidden: number[]; shown: number[] }; cols: { hidden: number[]; shown: number[] }; state?: { was: SheetState; now: SheetState } };
  /** Data-validation and conditional-format rule counts, when they differ. */
  rules?: { dataValidations: { was: number; now: number }; conditionalFormats: { was: number; now: number } };
  counts: { rowsAdded: number; rowsRemoved: number; rowsChanged: number; rowsMoved: number; cells: number };
}

/** The size of the change at a glance. */
export interface DiffSummary {
  /** Sheets that are not the same (added, removed, renamed or changed). */
  sheets: number;
  /** Rows added, removed, changed or moved. */
  rows: number;
  /** Cells changed in rows both versions hold. */
  cells: number;
  sheetsAdded: number;
  sheetsRemoved: number;
  sheetsRenamed: number;
}

/** What `diffWorkbooks` returns: one entry per sheet, the newer workbook's order, removed sheets last. */
export interface WorkbookDiff { sheets: SheetDiff[]; summary: DiffSummary }

// ── cells ──────────────────────────────────────────────────────────────────

const blank = (v: Cell | undefined): boolean => v === null || v === undefined || v === '';
const norm = (v: Cell | undefined): Cell => (blank(v) ? null : v!);
const enc = (v: Cell | undefined): string => (blank(v) ? '' : typeof v === 'number' ? `n${v}` : typeof v === 'boolean' ? (v ? 'T' : 'F') : `s${v}`);

/**
 * A formula with each relative reference written as an offset from its cell (`R[0]C[-2]`; `$`
 * parts absolute), so a formula that moved with its row compares equal.
 * @param f - The formula, without `=`.
 * @param row - Its cell's row, 0-based.
 * @param col - Its cell's column, 0-based.
 * @returns The formula in that relative form — for comparing, never for showing.
 */
export function relativeFormula(f: string, row: number, col: number): string {
  // string literals and quoted sheet names are left alone
  return f.split(/("(?:[^"]|"")*"|'(?:[^']|'')*')/).map((part, i) => (i % 2 ? part : part.replace(/(?<![A-Za-z0-9_.])(\$?)([A-Z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/g, (_m, dc: string, c: string, dr: string, r: string) => {
    const ci = colIndex(c), ri = Number(r) - 1;
    return `R${dr ? ri : `[${ri - row}]`}C${dc ? ci : `[${ci - col}]`}`;
  }))).join('');
}

/** The rows that hold anything: trailing blank rows do not count. */
function extent(s: CompareSheet): { rows: number; cols: number } {
  let rows = s.rows.length;
  while (rows > 0 && (s.rows[rows - 1] ?? []).every(blank)) rows--;
  let cols = 0;
  for (let r = 0; r < rows; r++) { const row = s.rows[r]!; for (let c = row.length - 1; c >= cols; c--) if (!blank(row[c])) { cols = c + 1; break; } }
  return { rows, cols };
}

/** Reads one side's cells: value, text and formula, by 0-based position. */
class Side {
  readonly rows: number;
  readonly cols: number;
  constructor(readonly s: CompareSheet) { const e = extent(s); this.rows = e.rows; this.cols = e.cols; }
  value(r: number, c: number): Cell { return norm(this.s.rows[r]?.[c]); }
  text(r: number, c: number): string { const t = this.s.text?.[r]?.[c]; return t !== undefined ? t : blank(this.s.rows[r]?.[c]) ? '' : String(this.s.rows[r]![c]); }
  formula(r: number, c: number): string | undefined { return this.s.formulas?.[cellRef(r, c)]; }
  rel(r: number, c: number): string { const f = this.formula(r, c); return f === undefined ? '' : relativeFormula(f, r, c); }
  state(r: number, c: number): CellState { const f = this.formula(r, c); return { value: this.value(r, c), text: this.text(r, c), ...(f !== undefined ? { formula: f } : {}) }; }
  title(c: number, hr: number): string { return hr < this.rows ? this.text(hr, c).trim().toLowerCase() : ''; }
}

// ── columns ────────────────────────────────────────────────────────────────

function titlesUsable(s: Side, hr: number): boolean {
  if (hr >= s.rows) return false;
  const seen = new Set<string>();
  let n = 0;
  for (let c = 0; c < s.cols; c++) {
    const t = s.title(c, hr);
    if (!t) continue;
    if (seen.has(t)) return false;
    seen.add(t); n++;
  }
  return n >= 2;
}

/** Each newer column's older column (−1: new). By header title when both header rows hold distinct titles; leftovers pair in order when their counts agree (a renamed title). */
function matchColumns(a: Side, b: Side, hr: number): { by: 'header' | 'position'; map: number[] } {
  const map = new Array<number>(b.cols).fill(-1);
  if (!titlesUsable(a, hr) || !titlesUsable(b, hr)) {
    for (let c = 0; c < b.cols; c++) map[c] = c < a.cols ? c : -1;
    return { by: 'position', map };
  }
  const at = new Map<string, number>();
  for (let c = 0; c < a.cols; c++) { const t = a.title(c, hr); if (t) at.set(t, c); }
  const used = new Set<number>();
  for (let c = 0; c < b.cols; c++) { const t = b.title(c, hr); const ac = t ? at.get(t) : undefined; if (ac !== undefined) { map[c] = ac; used.add(ac); } }
  const leftA = Array.from({ length: a.cols }, (_, c) => c).filter((c) => !used.has(c));
  const leftB = map.map((x, c) => (x < 0 ? c : -1)).filter((c) => c >= 0);
  if (leftA.length === leftB.length) leftB.forEach((c, i) => { map[c] = leftA[i]!; });
  return { by: 'header', map };
}

/** Key columns → [older, newer] column indexes, or undefined when either sheet lacks one. */
function resolveKey(spec: KeySpec, a: Side, b: Side, hr: number): { cols: [number, number][]; names: string[] } | undefined {
  const names = (typeof spec === 'string' ? [spec] : [...spec]).map((k) => k.trim()).filter(Boolean);
  if (!names.length) return undefined;
  const find = (s: Side, k: string): number => {
    const want = k.toLowerCase();
    for (let c = 0; c < s.cols; c++) if (s.title(c, hr) === want) return c;
    const c = /^[A-Za-z]{1,3}$/.test(k) ? colIndex(k.toUpperCase()) : -1;
    return c < s.cols ? c : -1;
  };
  const cols: [number, number][] = [];
  for (const k of names) { const ca = find(a, k), cb = find(b, k); if (ca < 0 || cb < 0) return undefined; cols.push([ca, cb]); }
  return { cols, names };
}

// ── rows ───────────────────────────────────────────────────────────────────

interface Pairing { aToB: Int32Array; bToA: Int32Array; moved: Set<number> /* b rows */; sa: Int32Array; sb: Int32Array }

/** Row signatures over the matched columns, as integer ids shared by both sides. */
function signatures(a: Side, b: Side, pairs: [number, number][]): { sa: Int32Array; sb: Int32Array } {
  const ids = new Map<string, number>();
  const sig = (s: Side, r: number, side: 0 | 1): number => {
    let k = '';
    for (const p of pairs) { const c = p[side]; k += `${enc(s.s.rows[r]?.[c])}\u0001${s.text(r, c)}\u0001${s.rel(r, c)}\u0002`; }
    let id = ids.get(k);
    if (id === undefined) { id = ids.size; ids.set(k, id); }
    return id;
  };
  const sa = new Int32Array(a.rows), sb = new Int32Array(b.rows);
  for (let r = 0; r < a.rows; r++) sa[r] = sig(a, r, 0);
  for (let r = 0; r < b.rows; r++) sb[r] = sig(b, r, 1);
  return { sa, sb };
}

/** How alike two rows are: equal cells over cells either side fills (1 for two blank rows). */
function similarity(a: Side, ra: number, b: Side, rb: number, pairs: [number, number][]): number {
  let same = 0, filled = 0;
  for (const [ca, cb] of pairs) {
    const va = a.value(ra, ca), vb = b.value(rb, cb);
    if (va === null && vb === null) continue;
    filled++;
    if (va === vb) same++;
  }
  return filled ? same / filled : 1;
}

const PAIR_AT = 0.5;
const PAIR_DP_MAX = 250_000;

/** Inside a gap of unmatched rows, the in-order pairs alike enough to be one row changed. */
function pairGap(a: Side, as: number[], b: Side, bs: number[], pairs: [number, number][], out: (ra: number, rb: number) => void): void {
  const n = as.length, m = bs.length;
  if (!n || !m) return;
  if (n * m > PAIR_DP_MAX) { // too big to search: pair by position where alike
    for (let t = 0; t < Math.min(n, m); t++) if (similarity(a, as[t]!, b, bs[t]!, pairs) >= PAIR_AT) out(as[t]!, bs[t]!);
    return;
  }
  // the in-order pairing with the most likeness (a weighted longest common subsequence)
  const w = m + 1, dp = new Float64Array((n + 1) * w), sim = new Float64Array(n * m);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) sim[i * m + j] = similarity(a, as[i]!, b, bs[j]!, pairs);
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const s = sim[(i - 1) * m + j - 1]!;
    dp[i * w + j] = Math.max(dp[(i - 1) * w + j]!, dp[i * w + j - 1]!, s >= PAIR_AT ? dp[(i - 1) * w + j - 1]! + s : -1);
  }
  const got: [number, number][] = [];
  for (let i = n, j = m; i > 0 && j > 0;) {
    const s = sim[(i - 1) * m + j - 1]!;
    if (s >= PAIR_AT && dp[i * w + j] === dp[(i - 1) * w + j - 1]! + s) { got.push([as[i - 1]!, bs[j - 1]!]); i--; j--; }
    else if (dp[i * w + j] === dp[(i - 1) * w + j]) i--;
    else j--;
  }
  for (let k = got.length - 1; k >= 0; k--) out(got[k]![0], got[k]![1]);
}

/** Unkeyed: align by signature, then pair alike rows inside each gap. Never moved. */
function alignRows(a: Side, b: Side, pairs: [number, number][]): Pairing {
  const { sa, sb } = signatures(a, b, pairs);
  const m = alignIds(sa, sb);
  const aToB = new Int32Array(a.rows).fill(-1), bToA = new Int32Array(b.rows).fill(-1);
  const link = (ra: number, rb: number) => { aToB[ra] = rb; bToA[rb] = ra; };
  let pa = 0, pb = 0;
  for (let i = 0; i <= m.a.length; i++) {
    const ea = i < m.a.length ? m.a[i]! : a.rows, eb = i < m.b.length ? m.b[i]! : b.rows;
    pairGap(a, range(pa, ea), b, range(pb, eb), pairs, link);
    if (i < m.a.length) { link(ea, eb); pa = ea + 1; pb = eb + 1; }
  }
  return { aToB, bToA, moved: new Set(), sa, sb };
}

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);

/** Keyed: rows above and at the header pair by position; data rows by key (the n-th of a key with the n-th); a row out of order is moved. */
function keyRows(a: Side, b: Side, key: [number, number][], hr: number, pairs: [number, number][]): Pairing {
  const aToB = new Int32Array(a.rows).fill(-1), bToA = new Int32Array(b.rows).fill(-1);
  const head = Math.min(hr + 1, a.rows, b.rows);
  for (let r = 0; r < head; r++) { aToB[r] = r; bToA[r] = r; }
  const keyOf = (s: Side, r: number, side: 0 | 1) => key.map((k) => enc(s.s.rows[r]?.[k[side]])).join('\u0001');
  const isBlank = (k: string) => /^\u0001*$/.test(k);
  // blank-key rows match by their whole content instead, and are never called moved
  const { sa, sb } = signatures(a, b, pairs);
  const waiting = new Map<string, number[]>();
  for (let r = hr + 1; r < a.rows; r++) {
    const k = keyOf(a, r, 0), kk = isBlank(k) ? `#${sa[r]}` : `k${k}`;
    const l = waiting.get(kk); if (l) l.push(r); else waiting.set(kk, [r]);
  }
  const matched: [number, number, boolean][] = []; // [a, b, blank key]
  for (let r = hr + 1; r < b.rows; r++) {
    const k = keyOf(b, r, 1), blankKey = isBlank(k), kk = blankKey ? `#${sb[r]}` : `k${k}`;
    const ra = waiting.get(kk)?.shift();
    if (ra !== undefined) matched.push([ra, r, blankKey]);
  }
  // the longest in-order run stays; a keyed pair outside it moved; a blank-key pair outside it is added + removed
  const keep = inOrder(matched.map((p) => p[0]), matched.map((p) => p[1]));
  const moved = new Set<number>();
  matched.forEach(([ra, rb, blankKey], i) => {
    if (!keep.has(i)) { if (blankKey) return; moved.add(rb); }
    aToB[ra] = rb; bToA[rb] = ra;
  });
  return { aToB, bToA, moved, sa, sb };
}

// ── the diff ───────────────────────────────────────────────────────────────

function diffCells(a: Side, ra: number, b: Side, rb: number, map: number[], whole: boolean, out: CellChange[]): void {
  for (let cb = 0; cb < map.length; cb++) {
    const ca = map[cb]!;
    if (ca < 0) { // a new column: any content is a change
      if (b.value(rb, cb) === null && b.formula(rb, cb) === undefined) continue;
      out.push({ row: rb, col: cb, ref: cellRef(rb, cb), was: null, now: b.state(rb, cb), what: ['value'] });
      continue;
    }
    if (!whole) continue;
    const what: CellChange['what'] = [];
    if (a.value(ra, ca) !== b.value(rb, cb)) what.push('value');
    if (a.text(ra, ca) !== b.text(rb, cb)) what.push('text');
    if (a.rel(ra, ca) !== b.rel(rb, cb)) what.push('formula');
    if (what.length) out.push({ row: rb, col: cb, ref: cellRef(rb, cb), wasRef: cellRef(ra, ca), was: a.state(ra, ca), now: b.state(rb, cb), what });
  }
}

const emptyHidden = (): SheetDiff['hidden'] => ({ rows: { hidden: [], shown: [] }, cols: { hidden: [], shown: [] } });
const zero = (): SheetDiff['counts'] => ({ rowsAdded: 0, rowsRemoved: 0, rowsChanged: 0, rowsMoved: 0, cells: 0 });
const stateOf = (s: CompareSheet): SheetState => s.state ?? 'visible';
const rowValues = (s: Side, r: number): Cell[] => { const out: Cell[] = []; for (let c = 0; c < s.cols; c++) out.push(s.value(r, c)); return out; };

function addedSheet(s: CompareSheet): SheetDiff {
  const b = new Side(s);
  const rows: RowOp[] = range(0, b.rows).map((r) => ({ op: 'added', b: r, values: rowValues(b, r) }));
  return { status: 'added', b: s.name, keyed: false, columns: { by: 'position', map: new Array(b.cols).fill(-1), added: range(0, b.cols), removed: [], moved: [] }, rows, cells: [], merges: { added: [...(s.merges ?? [])], removed: [] }, hidden: emptyHidden(), counts: { ...zero(), rowsAdded: b.rows } };
}
function removedSheet(s: CompareSheet): SheetDiff {
  const a = new Side(s);
  return { status: 'removed', a: s.name, keyed: false, columns: { by: 'position', map: [], added: [], removed: range(0, a.cols), moved: [] }, rows: [], cells: [], merges: { added: [], removed: [...(s.merges ?? [])] }, hidden: emptyHidden(), counts: { ...zero(), rowsRemoved: a.rows } };
}

function diffSheet(sa: CompareSheet, sb: CompareSheet, o: DiffOptions, renamed?: number): SheetDiff {
  const a = new Side(sa), b = new Side(sb);
  const hr = Math.max(0, (o.headerRow ?? 1) - 1);
  const cols = matchColumns(a, b, hr);
  const pairs: [number, number][] = cols.map.flatMap((ca, cb) => (ca >= 0 ? [[ca, cb] as [number, number]] : []));
  // the key: this sheet's own (must exist), else every sheet's (used where it exists)
  const per = o.key !== undefined && typeof o.key !== 'string' && !Array.isArray(o.key) ? (o.key as Readonly<Record<string, KeySpec>>) : undefined;
  const own = per ? per[sb.name] : undefined;
  const spec = own ?? (per ? per['*'] : (o.key as KeySpec | undefined));
  let key: ReturnType<typeof resolveKey>;
  let note: string | undefined;
  if (spec !== undefined) {
    key = resolveKey(spec, a, b, hr);
    if (!key && own !== undefined) throw spError('SP-5901', `“${sb.name}” has no column ${JSON.stringify(own)} in row ${hr + 1} of both versions`);
    if (!key) note = `no key column ${JSON.stringify(spec)} in both versions — rows aligned without a key`;
  }
  const p = key ? keyRows(a, b, key.cols, hr, pairs) : alignRows(a, b, pairs);
  // rows, in the newer sheet's order; a removed row after the newer row its older neighbour became
  const rows: RowOp[] = [];
  const cells: CellChange[] = [];
  const counts = zero();
  const removedAfter = new Map<number, number[]>(); // b row (−1: top) → removed a rows
  for (let ra = 0, last = -1; ra < a.rows; ra++) {
    const rb = p.aToB[ra]!;
    if (rb >= 0) { if (!p.moved.has(rb)) last = rb; continue; }
    const l = removedAfter.get(last); if (l) l.push(ra); else removedAfter.set(last, [ra]);
  }
  const pushRemoved = (after: number) => { for (const ra of removedAfter.get(after) ?? []) { rows.push({ op: 'removed', a: ra, after }); counts.rowsRemoved++; } };
  pushRemoved(-1);
  for (let rb = 0; rb < b.rows; rb++) {
    const ra = p.bToA[rb]!;
    if (ra < 0) { rows.push({ op: 'added', b: rb, values: rowValues(b, rb) }); counts.rowsAdded++; }
    else {
      const before = cells.length;
      diffCells(a, ra, b, rb, cols.map, p.sa[ra] !== p.sb[rb], cells); // equal signatures: the matched cells are equal
      if (p.moved.has(rb)) { rows.push({ op: 'moved', a: ra, b: rb }); counts.rowsMoved++; }
      else if (cells.length > before) { rows.push({ op: 'changed', a: ra, b: rb }); counts.rowsChanged++; }
    }
    pushRemoved(rb);
  }
  counts.cells = cells.length;
  // columns
  const used = new Set(pairs.map((x) => x[0]));
  const added = cols.map.flatMap((ca, cb) => (ca < 0 ? [cb] : []));
  const removed = range(0, a.cols).filter((c) => !used.has(c));
  const stay = inOrder(pairs.map((x) => x[0]), pairs.map((x) => x[1]));
  const moved = pairs.flatMap(([ca, cb], i) => (stay.has(i) ? [] : [{ a: ca, b: cb }]));
  // merges and hidden state, mapped into the newer sheet's coordinates; past the data's extent a
  // row or column maps by its distance from the extent's edge
  const aToBCol = new Int32Array(a.cols).fill(-1);
  cols.map.forEach((ca, cb) => { if (ca >= 0) aToBCol[ca] = cb; });
  const bRowOf = (ra: number) => (ra < a.rows ? p.aToB[ra]! : ra - a.rows + b.rows);
  const aRowOf = (rb: number) => (rb < b.rows ? p.bToA[rb]! : rb - b.rows + a.rows);
  const past = (c: number, from: number, to: number) => (cols.by === 'position' ? c : c - from + to);
  const bColOf = (ca: number) => (ca < a.cols ? aToBCol[ca]! : past(ca, a.cols, b.cols));
  const aColOf = (cb: number) => (cb < b.cols ? cols.map[cb]! : past(cb, b.cols, a.cols));
  const mapRange = (rg: string): string | undefined => {
    const r = parseRange(rg);
    if (!r) return undefined;
    const top = bRowOf(r.top), bottom = bRowOf(r.bottom), left = bColOf(r.left), right = bColOf(r.right);
    return top < 0 || bottom < 0 || left < 0 || right < 0 ? undefined : rangeRef({ top, bottom, left, right });
  };
  const bMerges = new Set(sb.merges ?? []), mapped = new Set<string>();
  const mergesRemoved: string[] = [];
  for (const m of sa.merges ?? []) { const t = mapRange(m); if (t && bMerges.has(t)) mapped.add(t); else mergesRemoved.push(m); }
  const mergesAdded = [...bMerges].filter((m) => !mapped.has(m));
  const hidden = emptyHidden();
  const flips = (hidA: readonly number[] | undefined, hidB: readonly number[] | undefined, toA: (i: number) => number, toB: (i: number) => number, out: { hidden: number[]; shown: number[] }) => {
    const ha = new Set(hidA ?? []), hb = new Set(hidB ?? []);
    for (const i of hb) { const j = toA(i); if (j < 0 || !ha.has(j)) out.hidden.push(i); }
    for (const j of ha) { const i = toB(j); if (i >= 0 && !hb.has(i)) out.shown.push(i); }
    out.hidden.sort((x, y) => x - y); out.shown.sort((x, y) => x - y);
  };
  flips(sa.hiddenRows, sb.hiddenRows, aRowOf, bRowOf, hidden.rows);
  flips(sa.hiddenCols, sb.hiddenCols, aColOf, bColOf, hidden.cols);
  if (stateOf(sa) !== stateOf(sb)) hidden.state = { was: stateOf(sa), now: stateOf(sb) };
  const dvA = sa.dataValidations?.length ?? 0, dvB = sb.dataValidations?.length ?? 0, cfA = sa.conditionalFormats?.length ?? 0, cfB = sb.conditionalFormats?.length ?? 0;
  const rules = dvA !== dvB || cfA !== cfB ? { dataValidations: { was: dvA, now: dvB }, conditionalFormats: { was: cfA, now: cfB } } : undefined;
  const changed = rows.length || cells.length || added.length || removed.length || moved.length || mergesAdded.length || mergesRemoved.length
    || hidden.rows.hidden.length || hidden.rows.shown.length || hidden.cols.hidden.length || hidden.cols.shown.length || hidden.state || rules || renamed !== undefined;
  return {
    status: changed ? 'changed' : 'same', a: sa.name, b: sb.name, ...(renamed !== undefined ? { renamed } : {}),
    keyed: !!key, ...(key ? { key: key.names } : {}), ...(note ? { note } : {}),
    columns: { by: cols.by, map: cols.map, added, removed, moved }, rows, cells,
    merges: { added: mergesAdded, removed: mergesRemoved }, hidden, ...(rules ? { rules } : {}), counts,
  };
}

/** How alike two sheets' contents are: rows in common over rows in either (0–1). */
function likeness(x: CompareSheet, y: CompareSheet): number {
  const rowsOf = (s: CompareSheet) => { const sd = new Side(s); return new Set(range(0, sd.rows).map((r) => rowValues(sd, r).map(enc).join('\u0001'))); };
  const a = rowsOf(x), b = rowsOf(y);
  if (!a.size || !b.size) return 0;
  let both = 0;
  for (const k of a) if (b.has(k)) both++;
  return both / (a.size + b.size - both);
}

/**
 * What changed between two versions of a workbook: sheets added, removed and renamed; per sheet,
 * rows added, removed, changed and (with a key) moved, cells changed by value, display text or
 * formula, merges, hidden rows, columns and state, and rule counts. Pure and deterministic; runs
 * in Node or the browser.
 * @param a - The older workbook (the base).
 * @param b - The newer workbook.
 * @param o - Key columns, the header row, the rename threshold.
 * @returns One entry per sheet — the newer workbook's order, removed sheets last — and a summary.
 * @throws SP-5901 when a key named for one sheet is not a column of both versions.
 * @example
 * ```ts
 * import { read } from '@sheetpane/import';
 * import { diffWorkbooks } from '@sheetpane/compare';
 * const was = await read(file), now = await read(bytes, { name: 'spec-v2.xlsx' });
 * const d = diffWorkbooks(was, now, { key: 'Account' });
 * console.log(d.summary); // { sheets: 1, rows: 3, cells: 2, … }
 * ```
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0124_COMPARE.md
 */
export function diffWorkbooks(a: CompareWorkbook, b: CompareWorkbook, o: DiffOptions = {}): WorkbookDiff {
  const leftA = a.sheets.filter((s) => !b.sheets.some((t) => t.name === s.name));
  const leftB = b.sheets.filter((s) => !a.sheets.some((t) => t.name === s.name));
  // renamed: the most alike unmatched pairs, over the threshold, greedily
  const at = o.renameThreshold ?? 0.5;
  const cand = leftA.flatMap((x) => leftB.map((y) => ({ x, y, s: likeness(x, y) }))).filter((c) => c.s >= at && c.s > 0).sort((p, q) => q.s - p.s);
  const renamedTo = new Map<CompareSheet, { from: CompareSheet; s: number }>(), takenA = new Set<CompareSheet>();
  for (const c of cand) if (!takenA.has(c.x) && !renamedTo.has(c.y)) { takenA.add(c.x); renamedTo.set(c.y, { from: c.x, s: Math.round(c.s * 1000) / 1000 }); }
  const sheets: SheetDiff[] = b.sheets.map((sb) => {
    const same = a.sheets.find((s) => s.name === sb.name);
    if (same) return diffSheet(same, sb, o);
    const r = renamedTo.get(sb);
    return r ? diffSheet(r.from, sb, o, r.s) : addedSheet(sb);
  });
  for (const sa of leftA) if (!takenA.has(sa)) sheets.push(removedSheet(sa));
  const summary: DiffSummary = { sheets: 0, rows: 0, cells: 0, sheetsAdded: 0, sheetsRemoved: 0, sheetsRenamed: 0 };
  for (const s of sheets) {
    if (s.status !== 'same') summary.sheets++;
    if (s.status === 'added') summary.sheetsAdded++;
    if (s.status === 'removed') summary.sheetsRemoved++;
    if (s.renamed !== undefined) summary.sheetsRenamed++;
    summary.rows += s.counts.rowsAdded + s.counts.rowsRemoved + s.counts.rowsChanged + s.counts.rowsMoved;
    summary.cells += s.counts.cells;
  }
  return { sheets, summary };
}

/**
 * The newer workbook's values rebuilt from the older one and the diff — the diff's own proof:
 * `applyDiff(a, diffWorkbooks(a, b))` holds `b`'s values (blank cells as null, trailing blanks trimmed).
 * @param a - The older workbook the diff was made from.
 * @param d - The diff.
 * @returns Each sheet of the newer workbook, in its order, with its values.
 */
export function applyDiff(a: CompareWorkbook, d: WorkbookDiff): { name: string; rows: Cell[][] }[] {
  const out: { name: string; rows: Cell[][] }[] = [];
  for (const s of d.sheets) {
    if (s.status === 'removed') continue;
    if (s.status === 'added') { out.push({ name: s.b!, rows: s.rows.map((r) => (r.op === 'added' ? [...r.values] : [])) }); continue; }
    const src = new Side(a.sheets.find((x) => x.name === s.a)!);
    const added = new Map<number, Cell[]>(), movedB = new Map<number, number>(), removedA = new Set<number>(), movedA = new Set<number>();
    let bRows = 0;
    for (const r of s.rows) {
      if (r.op === 'added') added.set(r.b, r.values);
      else if (r.op === 'moved') { movedB.set(r.b, r.a); movedA.add(r.a); }
      else if (r.op === 'removed') removedA.add(r.a);
      if (r.op !== 'removed') bRows = Math.max(bRows, r.b + 1);
    }
    // every other row of the newer sheet pairs, in order, with the next older row neither removed nor moved
    const unchangedA = range(0, src.rows).filter((ra) => !removedA.has(ra) && !movedA.has(ra));
    bRows = Math.max(bRows, unchangedA.length + added.size + movedB.size);
    const rows: Cell[][] = [];
    let k = 0;
    for (let rb = 0; rb < bRows; rb++) {
      const v = added.get(rb);
      if (v) { rows.push([...v]); continue; }
      const ra = movedB.get(rb) ?? unchangedA[k++]!;
      rows.push(s.columns.map.map((ca) => (ca < 0 ? null : src.value(ra, ca))));
    }
    for (const c of s.cells) { const row = rows[c.row]!; while (row.length <= c.col) row.push(null); row[c.col] = c.now.value; }
    out.push({ name: s.b!, rows });
  }
  return out;
}

/**
 * The summary in words: `2 sheets · 5 rows · 7 cells changed`, or `No changes`.
 * @param s - A diff's summary.
 * @returns One line.
 */
export function summaryText(s: DiffSummary): string {
  if (!s.sheets && !s.rows && !s.cells) return 'No changes';
  const n = (x: number, one: string) => `${x.toLocaleString('en-US')} ${one}${x === 1 ? '' : 's'}`;
  return `${n(s.sheets, 'sheet')} · ${n(s.rows, 'row')} · ${n(s.cells, 'cell')} changed`;
}
