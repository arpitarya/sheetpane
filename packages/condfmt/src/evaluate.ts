// The evaluator: one cell against the sheet's rules, in priority order, with
// `stopIfTrue`. Range statistics (min, max, sorted numbers, duplicate counts)
// are computed once per range and kept until a cell of that range changes;
// per-cell results are kept until that cell, its range's statistics, or —
// for a rule that reads other cells — anything changes. The cache keys on the
// store's snapshot (its workbook, its change map and its derived map).
import type { StyleSubset, WorkbookStore } from '@sheetpane/grid';
import { allowListed, AUTO_INK, dxfCss, mix, paletteOf, resolveColor, type Palette, type XlColor } from '@sheetpane/styles';
import { a1, covers, evaluatorOf, inBox, parseA1, ruleWords, rulesOf, shiftFormula, skipOf, type Book, type Box, type Cell, type Cfvo, type Evaluate, type Operand, type Operator, type Rule, type Sheet } from './rules.js';

type Snap = ReturnType<WorkbookStore['getSnapshot']>;

// ── values ────────────────────────────────────────────────────────────────
const ERRORS = /^#(NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|GETTING_DATA|SPILL!|CALC!|FIELD!|BLOCKED!|CONNECT!|BUSY!|UNKNOWN!)$/;
export const isError = (v: Cell | undefined) => typeof v === 'string' && ERRORS.test(v);
export const isBlank = (v: Cell | undefined) => v === null || v === '';

/** The cell's value now; a typed formula not yet calculated is unknown (`undefined`). */
export function valueAt(store: WorkbookStore, sheet: string, ref: string): Cell | undefined {
  const c = store.changeOf(sheet, ref);
  if (c?.kind === 'formula') { const d = store.getSnapshot().derived.get(`${sheet}!${ref}`); return d ? d.value : undefined; }
  return store.value(sheet, ref);
}

/** The rows and columns a sheet uses: its data, plus any cell a user changed or a plugin derived. */
export function usedRange(snap: Snap, s: Sheet): { rows: number; cols: number } {
  let rows = s.rows.length, cols = s.rows.reduce((m, r) => Math.max(m, r?.length ?? 0), 0);
  const prefix = `${s.name}!`;
  for (const k of [...snap.changes.keys(), ...snap.derived.keys()]) {
    if (!k.startsWith(prefix)) continue;
    const p = parseA1(k.slice(prefix.length));
    if (p) { rows = Math.max(rows, p.row + 1); cols = Math.max(cols, p.col + 1); }
  }
  return { rows, cols };
}

/**
 * Excel's comparison: numbers < text < logicals; text without case; a blank takes the other side's type.
 *
 * @param x - One value.
 * @param y - The other.
 * @returns Negative when `x` sorts first, positive when `y` does, 0 when equal.
 */
export function compareCells(x: Cell, y: Cell): number {
  const blankAs = (o: Cell): Cell => (typeof o === 'string' ? '' : typeof o === 'boolean' ? false : 0);
  if (isBlank(x) && isBlank(y)) return 0;
  if (x === null || x === '') x = blankAs(y);
  if (y === null || y === '') y = blankAs(x);
  const rank = (v: Cell) => (typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2);
  const rx = rank(x), ry = rank(y);
  if (rx !== ry) return rx - ry;
  if (typeof x === 'string' && typeof y === 'string') { const a = x.toLowerCase(), b = y.toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; }
  const a = Number(x), b = Number(y);
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A value as the text rules read it (Excel's SEARCH / LEFT / RIGHT coerce the same way). */
const textOf = (v: Cell): string => (v === null ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v));
const isNum = (v: Cell | undefined): v is number => typeof v === 'number' && Number.isFinite(v);
/** Duplicate-counting key: numbers by value, text without case; blanks and errors are not counted. */
const dupKey = (v: Cell | undefined): string | undefined => (v === undefined || isBlank(v) || isError(v) ? undefined : typeof v === 'number' ? `n${v}` : typeof v === 'boolean' ? `b${v}` : `s${v.toLowerCase()}`);

// ── range statistics ──────────────────────────────────────────────────────
export interface Stats {
  boxes: Box[];
  /** The range's numbers, ascending. */
  nums: number[];
  sum: number;
  /** Values by duplicate key → how many cells hold it. */
  counts: Map<string, number>;
}

function computeStats(store: WorkbookStore, snap: Snap, sheet: Sheet, boxes: Box[]): Stats {
  const used = usedRange(snap, sheet);
  const nums: number[] = [], counts = new Map<string, number>();
  let sum = 0;
  const seen = new Set<string>(); // overlapping areas count a cell once
  for (const b of boxes) {
    for (let r = b.top; r <= Math.min(b.bottom, used.rows - 1); r++) {
      for (let c = b.left; c <= Math.min(b.right, used.cols - 1); c++) {
        const ref = a1(r, c);
        if (boxes.length > 1) { if (seen.has(ref)) continue; seen.add(ref); }
        const v = valueAt(store, sheet.name, ref);
        if (isNum(v)) { nums.push(v); sum += v; }
        const k = dupKey(v);
        if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
  }
  nums.sort((a, b) => a - b);
  return { boxes, nums, sum, counts };
}

/**
 * PERCENTILE.INC over sorted numbers.
 *
 * @param sorted - The numbers, ascending.
 * @param p - The percentile as a fraction, 0 to 1 (clamped).
 * @returns The interpolated value; `NaN` for no numbers.
 */
export function percentile(sorted: readonly number[], p: number): number {
  if (!sorted.length) return NaN;
  const k = Math.max(0, Math.min(1, p)) * (sorted.length - 1);
  const lo = Math.floor(k), hi = Math.ceil(k);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (k - lo);
}

// ── the cache ─────────────────────────────────────────────────────────────
/** Every rule of a sheet at one cell: the CSS they draw and the rules that drew it. */
export interface CellResult {
  /** What the rules draw, or undefined when none matched. */
  css: StyleSubset | undefined;
  /** The rules that drew something, in priority order. */
  hits: Rule[];
  /** Read through a rule that reads other cells: dropped on any change. */
  volatile: boolean;
}
interface SheetState { stats: Map<string, Stats>; cells: Map<string, CellResult> }
interface State { book: Book; changes: Snap['changes']; derived: Snap['derived']; sheets: Map<string, SheetState> }

const states = new WeakMap<WorkbookStore, State>();
const counters = new WeakMap<WorkbookStore, { stats: number; cells: number }>();

/**
 * How many range statistics and cell results this store has computed (for tests and profiling).
 *
 * @param store - The workbook store.
 * @returns A copy of the counters.
 */
export function evaluations(store: WorkbookStore): { stats: number; cells: number } {
  return { ...(counters.get(store) ?? { stats: 0, cells: 0 }) };
}
const count = (store: WorkbookStore, k: 'stats' | 'cells') => {
  let c = counters.get(store);
  if (!c) counters.set(store, (c = { stats: 0, cells: 0 }));
  c[k]++;
};

function stateFor(store: WorkbookStore, snap: Snap): State {
  const book = snap.book!;
  let st = states.get(store);
  if (!st || st.book !== book) {
    st = { book, changes: snap.changes, derived: snap.derived, sheets: new Map() };
    states.set(store, st);
    return st;
  }
  if (st.changes !== snap.changes || st.derived !== snap.derived) {
    invalidate(st, snap);
    st.changes = snap.changes;
    st.derived = snap.derived;
  }
  return st;
}

/** Cells whose entry differs between two maps keyed `sheet!ref`, as `{ sheet, ref }` (slotted kinds keep their `#kind:` prefix). */
function diffKeys<V>(a: ReadonlyMap<string, V>, b: ReadonlyMap<string, V>, out: Map<string, Set<string>>): void {
  const add = (k: string) => {
    const i = k.lastIndexOf('!');
    const sheet = k.slice(0, i), ref = k.slice(i + 1);
    let s = out.get(sheet);
    if (!s) out.set(sheet, (s = new Set()));
    s.add(ref);
  };
  for (const [k, v] of a) if (b.get(k) !== v) add(k);
  for (const k of b.keys()) if (!a.has(k)) add(k);
}

/** A change: drop what depends on the changed cells, nothing else. */
function invalidate(st: State, snap: Snap): void {
  const touched = new Map<string, Set<string>>();
  diffKeys(st.changes, snap.changes, touched);
  diffKeys(st.derived, snap.derived, touched);
  for (const [sheet, ss] of st.sheets) {
    // a rule that reads other cells (a formula, a cell operand) may read any of them
    for (const [ref, r] of ss.cells) if (r.volatile) ss.cells.delete(ref);
    const refs = touched.get(sheet);
    if (!refs) continue;
    const cells: { row: number; col: number }[] = [];
    for (const ref of refs) {
      if (ref.startsWith('#style:')) { ss.cells.delete(ref.slice(7)); continue; } // the static style under a rule's fill (its text colour)
      if (ref.startsWith('#')) continue; // number formats, merges, freeze: no rule reads them
      ss.cells.delete(ref);
      const p = parseA1(ref);
      if (p) cells.push(p);
    }
    if (!cells.length) continue;
    // a range whose statistics hold a changed cell: its statistics and every result read from them
    for (const [key, s] of ss.stats) {
      if (!cells.some((p) => s.boxes.some((b) => inBox(b, p.row, p.col)))) continue;
      ss.stats.delete(key);
      for (const ref of ss.cells.keys()) {
        const p = parseA1(ref);
        if (p && s.boxes.some((b) => inBox(b, p.row, p.col))) ss.cells.delete(ref);
      }
    }
  }
}

function sheetState(st: State, sheet: string): SheetState {
  let ss = st.sheets.get(sheet);
  if (!ss) st.sheets.set(sheet, (ss = { stats: new Map(), cells: new Map() }));
  return ss;
}

// ── one cell ──────────────────────────────────────────────────────────────
interface Run {
  store: WorkbookStore;
  snap: Snap;
  sheet: Sheet;
  ss: SheetState;
  palette: Palette;
  evaluate: Evaluate | undefined;
}

const dxfCache = new WeakMap<Book, Map<number, StyleSubset>>();
/**
 * A rule's dxf as allow-listed CSS (the same allow-list as `@sheetpane/styles`; never a font family). Cached per workbook.
 *
 * @param book - The workbook.
 * @param dxfId - The rule's `dxfId`, or `undefined`.
 * @param palette - The workbook's palette; default: read from `book`.
 * @returns The CSS; `{}` when the rule has no dxf.
 */
export function dxfStyle(book: Book, dxfId: number | undefined, palette: Palette = paletteOf(book)): StyleSubset {
  if (dxfId === undefined) return {};
  let m = dxfCache.get(book);
  if (!m) dxfCache.set(book, (m = new Map()));
  let css = m.get(dxfId);
  if (!css) m.set(dxfId, (css = allowListed(dxfCss(book.styles.dxfs[dxfId], palette))));
  return css;
}

function statsOf(run: Run, rule: Rule): Stats {
  let s = run.ss.stats.get(rule.sqref);
  if (!s) {
    s = computeStats(run.store, run.snap, run.sheet, rule.boxes);
    run.ss.stats.set(rule.sqref, s);
    count(run.store, 'stats');
  }
  return s;
}

/** An operand's value at one cell; undefined when it cannot be read. */
function operandAt(o: Operand, rule: Rule, run: Run, row: number, col: number): Cell | undefined {
  switch (o.k) {
    case 'num': case 'str': case 'bool': return o.v;
    case 'ref': {
      const r = o.absRow ? o.row : o.row + row - rule.anchor.row, c = o.absCol ? o.col : o.col + col - rule.anchor.col;
      if (r < 0 || c < 0) return undefined;
      return valueAt(run.store, o.sheet ?? rule.sheet, a1(r, c));
    }
    case 'formula': {
      if (!run.evaluate) return undefined;
      try { return run.evaluate(shiftFormula(o.src, row - rule.anchor.row, col - rule.anchor.col), { sheet: rule.sheet, ref: a1(row, col) }); } catch { return undefined; }
    }
  }
}

const compareOp = (op: Operator, v: Cell, a: Cell, b: Cell | undefined): boolean => {
  const ca = compareCells(v, a);
  switch (op) {
    case 'equal': return ca === 0;
    case 'notEqual': return ca !== 0;
    case 'greaterThan': return ca > 0;
    case 'lessThan': return ca < 0;
    case 'greaterThanOrEqual': return ca >= 0;
    case 'lessThanOrEqual': return ca <= 0;
    case 'between': case 'notBetween': {
      const [lo, hi] = compareCells(a, b!) <= 0 ? [a, b!] : [b!, a];
      const inside = compareCells(v, lo) >= 0 && compareCells(v, hi) <= 0;
      return op === 'between' ? inside : !inside;
    }
  }
};

/** Excel's truthiness of a formula's result: TRUE, or a non-zero number. */
const truthy = (r: Cell | undefined) => r === true || (typeof r === 'number' && r !== 0);

/** A threshold (`cfvo`) as a number over the range's statistics; NaN when it cannot be read. */
function thresholdAt(c: Cfvo, o: Operand | undefined, stats: Stats, rule: Rule, run: Run): number {
  const lo = stats.nums[0]!, hi = stats.nums[stats.nums.length - 1]!;
  if (c.type === 'min') return lo;
  if (c.type === 'max') return hi;
  if (!o) return NaN;
  // a threshold's formula is read at the range's top-left (Excel requires it to be absolute)
  const v = operandAt(o, rule, run, rule.anchor.row, rule.anchor.col);
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return NaN;
  if (c.type === 'percent') return lo + ((hi - lo) * n) / 100;
  if (c.type === 'percentile') return percentile(stats.nums, n / 100);
  return n; // num, formula
}

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/**
 * Linear interpolation between two `#RRGGBB` colours in sRGB, per channel.
 *
 * @param a - The colour at 0.
 * @param b - The colour at 1.
 * @param t - Where between them, 0 to 1 (clamped).
 * @returns The colour, `#RRGGBB` upper case.
 */
export function lerpColor(a: string, b: string, t: number): string {
  const x = hex(a), y = hex(b), k = Math.max(0, Math.min(1, t));
  return toHex(x.map((v, i) => v + (y[i]! - v) * k));
}

/**
 * A colour scale's colour for one value: the stops' colours interpolated between their thresholds.
 *
 * @param v - The cell's number.
 * @param points - The thresholds' values, ascending (2 or 3).
 * @param colors - One `#RRGGBB` per threshold.
 * @returns The colour; the end colours beyond the ends.
 */
export function scaleColor(v: number, points: readonly number[], colors: readonly string[]): string {
  if (v <= points[0]!) return colors[0]!;
  const last = points.length - 1;
  if (v >= points[last]!) return colors[last]!;
  for (let i = 0; i < last; i++) {
    const p0 = points[i]!, p1 = points[i + 1]!;
    if (v >= p0 && v <= p1) return p1 === p0 ? colors[i + 1]! : lerpColor(colors[i]!, colors[i + 1]!, (v - p0) / (p1 - p0));
  }
  return colors[last]!;
}

/** Excel's default data-bar colour, when the rule names none. */
export const DEFAULT_BAR = '#638EC6';
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A data bar's length in percent of the cell: `minLength` (default 10) for a
 * value at or below the low threshold, `maxLength` (default 90) at or above
 * the high one, linear between (Excel 2007 data bars).
 *
 * @param v - The cell's number.
 * @param lo - The low threshold's value.
 * @param hi - The high threshold's value.
 * @param minLength - The shortest bar, in percent; default 10.
 * @param maxLength - The longest bar, in percent; default 90.
 * @returns The length in percent, to two decimals.
 */
export function barLength(v: number, lo: number, hi: number, minLength = 10, maxLength = 90): number {
  const t = hi > lo ? (v - lo) / (hi - lo) : v >= hi ? 1 : 0;
  return round2(minLength + Math.max(0, Math.min(1, t)) * (maxLength - minLength));
}
/** The data bar's CSS: a gradient from the bar colour to a lighter tint, ending at the bar's length. */
export const barImage = (color: string, length: number) => `linear-gradient(90deg, ${color} 0%, ${mix(color, '#FFFFFF', 0.45)} ${length}%, transparent ${length}%)`;

/** One rule at one cell: the CSS it draws, `{}` when it matches with nothing to draw, undefined when it does not match. */
function applyRule(rule: Rule, run: Run, row: number, col: number, v: Cell | undefined): StyleSubset | undefined {
  const cf = rule.cf, book = run.snap.book!;
  const dxf = () => dxfStyle(book, cf.dxfId, run.palette);
  if (v === undefined) return undefined; // a typed formula not yet calculated
  switch (rule.kind) {
    case 'expression': {
      if (!run.evaluate) return undefined;
      let r: Cell | undefined;
      try { r = run.evaluate(shiftFormula(cf.formulas[0]!.replace(/^=/, ''), row - rule.anchor.row, col - rule.anchor.col), { sheet: rule.sheet, ref: a1(row, col) }); } catch { return undefined; }
      return truthy(r) ? dxf() : undefined;
    }
    case 'cellIs': {
      if (isError(v)) return undefined;
      const [oa, ob] = rule.operands!;
      const a = operandAt(oa!, rule, run, row, col), b = ob ? operandAt(ob, rule, run, row, col) : undefined;
      if (a === undefined || isError(a) || (ob && (b === undefined || isError(b)))) return undefined;
      return compareOp(cf.operator as Operator, v, a, b) ? dxf() : undefined;
    }
    case 'containsText': case 'notContainsText': case 'beginsWith': case 'endsWith': {
      const t = (cf.text ?? '').toLowerCase();
      if (isError(v)) return rule.kind === 'notContainsText' ? dxf() : undefined;
      const s = textOf(v).toLowerCase();
      const hit = rule.kind === 'beginsWith' ? s.startsWith(t) : rule.kind === 'endsWith' ? s.endsWith(t) : s.includes(t);
      return (rule.kind === 'notContainsText' ? !hit : hit) ? dxf() : undefined;
    }
    case 'containsBlanks': return !isError(v) && textOf(v).trim() === '' ? dxf() : undefined;
    case 'notContainsBlanks': return isError(v) || textOf(v).trim() !== '' ? dxf() : undefined;
    case 'containsErrors': return isError(v) ? dxf() : undefined;
    case 'notContainsErrors': return isError(v) ? undefined : dxf();
    case 'duplicateValues': case 'uniqueValues': {
      const k = dupKey(v);
      if (!k) return undefined;
      const n = statsOf(run, rule).counts.get(k) ?? 0;
      return (rule.kind === 'duplicateValues' ? n > 1 : n === 1) ? dxf() : undefined;
    }
    case 'top10': {
      if (!isNum(v)) return undefined;
      const { nums } = statsOf(run, rule);
      if (!nums.length) return undefined;
      const rank = Math.max(0, cf.rank ?? 10);
      const n = cf.percent ? Math.max(1, Math.floor((nums.length * rank) / 100)) : rank;
      if (n <= 0) return undefined;
      if (n >= nums.length) return dxf();
      return (cf.bottom ? v <= nums[n - 1]! : v >= nums[nums.length - n]!) ? dxf() : undefined;
    }
    case 'aboveAverage': {
      if (!isNum(v)) return undefined;
      const { nums, sum } = statsOf(run, rule);
      if (!nums.length) return undefined;
      const avg = sum / nums.length;
      return (cf.aboveAverage === false ? v < avg : v > avg) ? dxf() : undefined;
    }
    case 'colorScale': {
      if (!isNum(v)) return undefined;
      const stats = statsOf(run, rule);
      if (!stats.nums.length) return undefined;
      const cs = cf.colorScale!;
      const points = cs.cfvo.map((c, i) => thresholdAt(c, rule.thresholds![i], stats, rule, run));
      if (points.some((p) => Number.isNaN(p))) return undefined;
      const colors = cs.colors.slice(0, points.length).map((c) => resolveColor(c as XlColor, run.palette) ?? '#FFFFFF');
      return { 'background-color': scaleColor(v, points, colors) };
    }
    case 'dataBar': {
      if (!isNum(v)) return undefined;
      const stats = statsOf(run, rule);
      if (!stats.nums.length) return undefined;
      const db = cf.dataBar!;
      const [lo, hi] = db.cfvo.map((c, i) => thresholdAt(c, rule.thresholds![i], stats, rule, run)) as [number, number];
      if (Number.isNaN(lo) || Number.isNaN(hi)) return undefined;
      const color = resolveColor(db.color as XlColor | undefined, run.palette) ?? DEFAULT_BAR;
      return { 'background-image': barImage(color, barLength(v, lo, hi, db.minLength, db.maxLength)) };
    }
    default: return undefined;
  }
}

/**
 * Every rule of the sheet at one cell, in priority order: a higher-priority
 * rule wins each property it sets, a lower one fills in the rest; a matching
 * rule with `stopIfTrue` ends the walk. Cached per store, and dropped as the cells it read change.
 *
 * @param store - The workbook store.
 * @param sheetName - The sheet's name.
 * @param row - The cell's row, 0-based.
 * @param col - The cell's column, 0-based.
 * @returns The CSS the rules draw and the rules that drew it.
 */
export function cellResult(store: WorkbookStore, sheetName: string, row: number, col: number): CellResult {
  const snap = store.getSnapshot(), book = snap.book;
  const none: CellResult = { css: undefined, hits: [], volatile: false };
  if (!book) return none;
  const rules = rulesOf(book, sheetName);
  if (!rules.length) return none;
  const here = rules.filter((r) => covers(r, row, col));
  if (!here.length) return none;
  const st = stateFor(store, snap), ss = sheetState(st, sheetName), ref = a1(row, col);
  const hit = ss.cells.get(ref);
  if (hit) return hit;
  const sheet = book.sheets.find((s) => s.name === sheetName)!;
  const evaluate = evaluatorOf(store);
  const run: Run = { store, snap, sheet, ss, palette: paletteOf(book), evaluate };
  const v = valueAt(store, sheetName, ref);
  const css: StyleSubset = {};
  const hits: Rule[] = [];
  let volatile = false;
  for (const rule of here) {
    if (skipOf(rule, store)) continue;
    if (rule.volatile) volatile = true;
    const out = applyRule(rule, run, row, col, v);
    if (!out) continue;
    let drew = false;
    for (const [k, val] of Object.entries(out) as [keyof StyleSubset, string][]) if (css[k] === undefined) { css[k] = val; drew = true; }
    if (drew) hits.push(rule);
    if (rule.cf.stopIfTrue) break;
  }
  // A rule's fill with no text colour of its own: the cell's static colour, else the workbook's default ink —
  // the file's colours are data and do not follow a dark host (SR-GRID 15a).
  if (css['background-color'] && !css.color) {
    const ctx = store.cellContext(sheetName, ref);
    const styled = ctx ? store.plugins.find((p) => p.id === 'styles')?.decorate?.(ctx)?.color : undefined;
    css.color = styled ?? resolveColor(book.styles.fonts[0]?.color as XlColor | undefined, run.palette) ?? AUTO_INK;
  }
  const res: CellResult = { css: Object.keys(css).length ? css : undefined, hits, volatile };
  ss.cells.set(ref, res);
  count(store, 'cells');
  return res;
}

/**
 * The legend at one cell: each rule that drew it, in words, with its range.
 *
 * @param store - The workbook store.
 * @param sheet - The sheet's name.
 * @param row - The cell's row, 0-based.
 * @param col - The cell's column, 0-based.
 * @returns One `{ words, range, rule }` per rule, in priority order; empty when none drew the cell.
 */
export function legendAt(store: WorkbookStore, sheet: string, row: number, col: number): { words: string; range: string; rule: Rule }[] {
  return cellResult(store, sheet, row, col).hits.map((rule) => ({ words: ruleWords(rule, row, col), range: rule.sqref, rule }));
}
