// The rule engine: a sheet's `<dataValidations>` compiled once per workbook, then
// checked against the store's current values. No DOM, no dependency — the types
// come from @sheetpane/grid, the values from the store a hook is handed.
import { shiftFormula, type CellContext, type PluginContext, type WorkbookStore } from '@sheetpane/grid';

export type Book = PluginContext['book'];
export type Sheet = CellContext['sheet'];
export type Cell = CellContext['value'];
export type DataValidation = Sheet['dataValidations'][number];

export type RuleKind = 'whole' | 'decimal' | 'date' | 'time' | 'textLength' | 'list' | 'custom';
export type Operator = 'between' | 'notBetween' | 'equal' | 'notEqual' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual';
/** Why a rule is not checked: `custom` without a formula evaluator, an operator or operand outside the subset, an unknown type, a list source that names nothing. */
export type SkipReason = 'custom' | 'operator' | 'operand' | 'type' | 'source';

const KINDS: readonly RuleKind[] = ['whole', 'decimal', 'date', 'time', 'textLength', 'list', 'custom'];
const OPERATORS: readonly Operator[] = ['between', 'notBetween', 'equal', 'notEqual', 'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual'];
const MAX_ROWS = 1048576, MAX_COLS = 16384;

// ── A1 ────────────────────────────────────────────────────────────────────
export interface Box { top: number; left: number; bottom: number; right: number }

export function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
export function colLetters(col: number): string {
  let s = '';
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
export const a1 = (row: number, col: number) => `${colLetters(col)}${row + 1}`;

/** `B3`, `B3:B5`, `B:B`, `3:3` (`$` allowed) → a box; undefined when it is none of these. */
export function parseBox(s: string): Box | undefined {
  const t = s.replace(/\$/g, '').toUpperCase();
  let m = /^([A-Z]{1,3})(\d+)(?::([A-Z]{1,3})(\d+))?$/.exec(t);
  if (m) {
    const r1 = Number(m[2]) - 1, c1 = colIndex(m[1]!);
    const r2 = m[4] ? Number(m[4]) - 1 : r1, c2 = m[3] ? colIndex(m[3]) : c1;
    if (r1 < 0 || r2 < 0) return undefined;
    return { top: Math.min(r1, r2), left: Math.min(c1, c2), bottom: Math.max(r1, r2), right: Math.max(c1, c2) };
  }
  m = /^([A-Z]{1,3}):([A-Z]{1,3})$/.exec(t);
  if (m) { const a = colIndex(m[1]!), b = colIndex(m[2]!); return { top: 0, left: Math.min(a, b), bottom: MAX_ROWS - 1, right: Math.max(a, b) }; }
  m = /^(\d+):(\d+)$/.exec(t);
  if (m) { const a = Number(m[1]) - 1, b = Number(m[2]) - 1; return { top: Math.min(a, b), left: 0, bottom: Math.max(a, b), right: MAX_COLS - 1 }; }
  return undefined;
}
const inBox = (b: Box, row: number, col: number) => row >= b.top && row <= b.bottom && col >= b.left && col <= b.right;

// ── operands ──────────────────────────────────────────────────────────────
/** A formula1/formula2 the subset evaluates: a number, a string, DATE/TIME of numbers, a cell (relative parts shift with the cell), or a range (list sources). */
export type Operand =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'ref'; sheet: string | undefined; row: number; col: number; absRow: boolean; absCol: boolean }
  | { k: 'range'; sheet: string | undefined; box: Box; absRow: boolean; absCol: boolean };

const NUM = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const SHEET = String.raw`(?:'((?:[^']|'')+)'|([^\s!'"(),:=<>&+\-*/^]+))!`;
const REF = new RegExp(`^(?:${SHEET})?(\\$?)([A-Za-z]{1,3})(\\$?)(\\d+)$`);
const RANGE = new RegExp(`^(?:${SHEET})?(\\$?[A-Za-z]{1,3}\\$?\\d+:\\$?[A-Za-z]{1,3}\\$?\\d+|\\$?[A-Za-z]{1,3}:\\$?[A-Za-z]{1,3})$`);

function dayBase(d1904: boolean): number { return d1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30); }
export function dateSerial(y: number, m: number, d: number, d1904: boolean): number { return Math.round((Date.UTC(y, m - 1, d) - dayBase(d1904)) / 864e5); }

/** Parses one operand; a defined name is followed (three levels) to its formula. Undefined: outside the subset. */
export function parseOperand(f: string, book: Book, sheetIndex: number, depth = 0): Operand | undefined {
  const t = f.trim().replace(/^=/, '').trim();
  if (NUM.test(t)) return { k: 'num', v: Number(t) };
  let m = /^"((?:[^"]|"")*)"$/.exec(t);
  if (m) return { k: 'str', v: m[1]!.replace(/""/g, '"') };
  m = /^(DATE|TIME)\(\s*([^,()]+?)\s*,\s*([^,()]+?)\s*,\s*([^,()]+?)\s*\)$/i.exec(t);
  if (m) {
    const [a, b, c] = [m[2]!, m[3]!, m[4]!].map(Number) as [number, number, number];
    if (![a, b, c].every(Number.isFinite)) return undefined;
    return m[1]!.toUpperCase() === 'DATE' ? { k: 'num', v: dateSerial(a, b, c, book.date1904) } : { k: 'num', v: (a * 3600 + b * 60 + c) / 86400 };
  }
  m = REF.exec(t);
  if (m) {
    const sheet = m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2];
    return { k: 'ref', sheet, absCol: m[3] === '$', col: colIndex(m[4]!), absRow: m[5] === '$', row: Number(m[6]) - 1 };
  }
  m = RANGE.exec(t);
  if (m) {
    const sheet = m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2];
    const body = m[3]!, box = parseBox(body);
    if (!box) return undefined;
    const first = body.split(':')[0]!;
    return { k: 'range', sheet, box, absCol: first.startsWith('$'), absRow: /^\$?[A-Za-z]+\$/.test(first) || /^\$?[A-Za-z]+:/.test(body) };
  }
  if (depth < 3 && /^[A-Za-z_\\][\w.]*$/.test(t)) {
    const names = book.definedNames.filter((n) => n.name.toLowerCase() === t.toLowerCase());
    const n = names.find((x) => x.localSheetId === sheetIndex) ?? names.find((x) => x.localSheetId === undefined);
    if (n) return parseOperand(n.formula, book, sheetIndex, depth + 1);
  }
  return undefined;
}

/** Shifting relative references is @sheetpane/export's `shiftFormula`, re-exported by the grid peer. */
export { shiftFormula };

// ── compiled rules ────────────────────────────────────────────────────────
export interface Rule {
  sheet: string;
  dv: DataValidation;
  kind: RuleKind;
  op: Operator;
  boxes: Box[];
  /** The top-left of the first range: relative references are written against it. */
  anchor: { row: number; col: number };
  f1?: Operand;
  f2?: Operand;
  /** `list`: the literal choices. */
  literal?: string[];
  skip?: { reason: SkipReason; detail: string };
}

const cache = new WeakMap<Book, Map<string, Rule[]>>();

/** The sheet's rules, compiled once per workbook. `type="none"` (any value) is not a rule. */
export function rulesOf(book: Book, sheetName: string): Rule[] {
  let bySheet = cache.get(book);
  if (!bySheet) cache.set(book, (bySheet = new Map()));
  let rules = bySheet.get(sheetName);
  if (!rules) bySheet.set(sheetName, (rules = compile(book, sheetName)));
  return rules;
}

function compile(book: Book, sheetName: string): Rule[] {
  const index = book.sheets.findIndex((s) => s.name === sheetName);
  const sheet = book.sheets[index];
  if (!sheet) return [];
  const out: Rule[] = [];
  for (const dv of sheet.dataValidations) {
    if (dv.type === 'none' || dv.type === '' || dv.type === 'any') continue;
    const boxes = dv.sqref.map(parseBox).filter((b): b is Box => !!b);
    if (!boxes.length) continue;
    const kind = dv.type as RuleKind, op = (dv.operator ?? 'between') as Operator;
    const rule: Rule = { sheet: sheetName, dv, kind, op, boxes, anchor: { row: boxes[0]!.top, col: boxes[0]!.left } };
    out.push(rule);
    if (!KINDS.includes(kind)) { rule.skip = { reason: 'type', detail: `rule type "${dv.type}"` }; continue; }
    if (kind === 'custom') continue; // checked only with a formula evaluator (see `evaluatorOf`)
    if (kind === 'list') {
      const f = (dv.formula1 ?? '').trim();
      const lit = /^"((?:[^"]|"")*)"$/.exec(f);
      if (lit) { rule.literal = lit[1]!.replace(/""/g, '"').split(',').map((x) => x.trim()); continue; }
      const o = parseOperand(f, book, index);
      if (o && (o.k === 'range' || o.k === 'ref')) {
        const src = o.sheet ?? sheetName;
        if (!book.sheets.some((s) => s.name === src)) { rule.skip = { reason: 'source', detail: `list source "${f}" names no sheet in this workbook` }; continue; }
        rule.f1 = o;
      } else if (o && o.k === 'num') rule.literal = [String(o.v)];
      else rule.skip = { reason: 'source', detail: `list source "${f}" is not a list, a range or a defined name` };
      continue;
    }
    if (!OPERATORS.includes(op)) { rule.skip = { reason: 'operator', detail: `operator "${dv.operator}"` }; continue; }
    const two = op === 'between' || op === 'notBetween';
    const f1 = dv.formula1 !== undefined ? parseOperand(dv.formula1, book, index) : undefined;
    const f2 = two && dv.formula2 !== undefined ? parseOperand(dv.formula2, book, index) : undefined;
    const bad = (o: Operand | undefined) => !o || o.k === 'range';
    if (bad(f1) || (two && bad(f2))) { rule.skip = { reason: 'operand', detail: `operand "${bad(f1) ? dv.formula1 ?? '' : dv.formula2 ?? ''}" is not a number, a date, a time or a cell` }; continue; }
    rule.f1 = f1!;
    if (two) rule.f2 = f2!;
  }
  return out;
}

/** What `@sheetpane/validation` needs from a formula engine for `custom` rules: the `derive` provider's synchronous `evaluate`. */
export type Evaluate = (formula: string, at: { sheet: string; ref: string }) => Cell | undefined;
export function evaluatorOf(store: WorkbookStore): Evaluate | undefined {
  const p = store.plugins.find((x) => x.provides.includes('derive')) as { evaluate?: unknown } | undefined;
  return typeof p?.evaluate === 'function' ? (p.evaluate as Evaluate).bind(p) : undefined;
}

/** The reason a rule is not checked in this store, if it is not. */
export function skipOf(rule: Rule, store: WorkbookStore | undefined): Rule['skip'] {
  if (rule.skip) return rule.skip;
  if (rule.kind === 'custom' && !(store && evaluatorOf(store))) return { reason: 'custom', detail: store?.plugins.some((p) => p.provides.includes('derive')) ? 'custom (formula) rule — the formula plugin offers no evaluate()' : 'custom (formula) rule — needs the formulas plugin' };
  return undefined;
}

// ── values ────────────────────────────────────────────────────────────────
/** The cell's value now. A typed formula (change kind `formula`) is its derived result, not its text. */
export function valueAt(store: WorkbookStore, sheet: string, ref: string): Cell | undefined {
  const c = store.changeOf(sheet, ref);
  if (c?.kind === 'formula') { const d = store.getSnapshot().derived.get(`${sheet}!${ref}`); return d ? d.value : undefined; }
  return store.value(sheet, ref);
}
export function textAt(store: WorkbookStore, sheet: string, ref: string): string {
  const c = store.changeOf(sheet, ref);
  if (c?.kind === 'formula') return store.getSnapshot().derived.get(`${sheet}!${ref}`)?.text ?? String(c.now);
  return store.text(sheet, ref);
}

const toNumber = (v: Cell | undefined): number | undefined => {
  if (v === null) return 0; // an empty cell reads as 0, as in Excel
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const t = v.trim(); return NUM.test(t) ? Number(t) : undefined; }
  return undefined;
};

/** An operand's number at one cell; undefined when the cell it reads is not a number. */
function operandAt(o: Operand, rule: Rule, store: WorkbookStore, row: number, col: number): number | undefined {
  if (o.k === 'num') return o.v;
  if (o.k === 'str') return toNumber(o.v);
  if (o.k === 'ref') {
    const r = o.absRow ? o.row : o.row + row - rule.anchor.row, c = o.absCol ? o.col : o.col + col - rule.anchor.col;
    if (r < 0 || c < 0) return undefined;
    return toNumber(valueAt(store, o.sheet ?? rule.sheet, a1(r, c)));
  }
  return undefined;
}

/** A `list` rule's choices at one cell — read live from the store for a range. */
export function listOptions(rule: Rule, store: WorkbookStore, row: number, col: number): string[] {
  if (rule.literal) return rule.literal;
  const o = rule.f1;
  if (!o || (o.k !== 'range' && o.k !== 'ref')) return [];
  const src = o.sheet ?? rule.sheet;
  const dr = o.absRow ? 0 : row - rule.anchor.row, dc = o.absCol ? 0 : col - rule.anchor.col;
  const box = o.k === 'ref' ? { top: o.row, left: o.col, bottom: o.row, right: o.col } : o.box;
  const s = store.sheet(src);
  const used = s ? usedRange(store, s) : { rows: 0, cols: 0 };
  const out: string[] = [];
  const seen = new Set<string>();
  for (let r = box.top + dr; r <= Math.min(box.bottom + dr, used.rows - 1); r++) {
    for (let c = box.left + dc; c <= Math.min(box.right + dc, used.cols - 1); c++) {
      if (r < 0 || c < 0) continue;
      const t = textAt(store, src, a1(r, c));
      if (t === '' || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/** The rows and columns a sheet uses: its data, plus any cell a user changed. */
export function usedRange(store: WorkbookStore, s: Sheet): { rows: number; cols: number } {
  let rows = s.rows.length, cols = s.rows.reduce((m, r) => Math.max(m, r?.length ?? 0), 0);
  const prefix = `${s.name}!`;
  for (const k of store.getSnapshot().changes.keys()) {
    if (!k.startsWith(prefix)) continue;
    const box = parseBox(k.slice(prefix.length));
    if (box && box.top === box.bottom && box.left === box.right) { rows = Math.max(rows, box.top + 1); cols = Math.max(cols, box.left + 1); }
  }
  return { rows, cols };
}

export type Verdict = 'pass' | 'fail' | 'unknown';

const compare = (op: Operator, x: number, a: number, b: number | undefined): boolean => {
  const lo = b === undefined ? a : Math.min(a, b), hi = b === undefined ? a : Math.max(a, b);
  switch (op) {
    case 'between': return x >= lo && x <= hi;
    case 'notBetween': return x < lo || x > hi;
    case 'equal': return x === a;
    case 'notEqual': return x !== a;
    case 'greaterThan': return x > a;
    case 'lessThan': return x < a;
    case 'greaterThanOrEqual': return x >= a;
    case 'lessThanOrEqual': return x <= a;
  }
};

/** Does one cell pass one (checkable) rule? `unknown` when an operand cannot be read — not an error. */
export function check(rule: Rule, store: WorkbookStore, row: number, col: number, evaluate: Evaluate | undefined, memo?: Map<Rule, string[]>): Verdict {
  const ref = a1(row, col);
  const v = valueAt(store, rule.sheet, ref);
  if (v === undefined) return 'unknown';
  const blank = v === null || v === '';
  if (blank && rule.dv.allowBlank) return 'pass';
  if (rule.kind === 'custom') {
    if (!evaluate || !rule.dv.formula1) return 'unknown';
    const f = shiftFormula(rule.dv.formula1.replace(/^=/, ''), row - rule.anchor.row, col - rule.anchor.col);
    let r: Cell | undefined;
    try { r = evaluate(f, { sheet: rule.sheet, ref }); } catch { return 'unknown'; }
    if (typeof r === 'boolean') return r ? 'pass' : 'fail';
    if (typeof r === 'number') return r !== 0 ? 'pass' : 'fail';
    return 'unknown';
  }
  if (rule.kind === 'list') {
    if (blank) return 'fail';
    const fixed = !rule.f1 || (rule.f1.k !== 'ref' && rule.f1.k !== 'range') || (rule.f1.absRow && rule.f1.absCol);
    let opts = fixed ? memo?.get(rule) : undefined;
    if (!opts) { opts = listOptions(rule, store, row, col); if (fixed) memo?.set(rule, opts); }
    const t = textAt(store, rule.sheet, ref).trim().toLowerCase();
    if (opts.some((o) => o.trim().toLowerCase() === t)) return 'pass';
    if (typeof v === 'number' && opts.some((o) => { const n = toNumber(o.replace(/(\d),(?=\d{3}\b)/g, '$1')); return n !== undefined && n === v; })) return 'pass';
    return 'fail';
  }
  let x: number;
  if (rule.kind === 'textLength') {
    x = v === null ? 0 : typeof v === 'string' ? v.length : typeof v === 'boolean' ? (v ? 4 : 5) : String(v).length;
  } else {
    if (typeof v !== 'number') return 'fail';
    if (rule.kind === 'whole' && !Number.isInteger(v)) return 'fail';
    x = v;
  }
  const a = operandAt(rule.f1!, rule, store, row, col);
  const b = rule.f2 ? operandAt(rule.f2, rule, store, row, col) : undefined;
  if (a === undefined || (rule.f2 && b === undefined)) return 'unknown';
  return compare(rule.op, x, a, b) ? 'pass' : 'fail';
}

// ── the rule in words (the error row's "expected") ────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dateText(serial: number, d1904: boolean): string {
  const d = new Date(dayBase(d1904) + Math.floor(serial) * 864e5);
  return `${String(d.getUTCDate()).padStart(2, '0')}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}
export function timeText(serial: number): string {
  const secs = Math.round((serial - Math.floor(serial)) * 86400) % 86400;
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}${s ? `:${String(s).padStart(2, '0')}` : ''}`;
}

const TYPE_WORDS: Record<RuleKind, string> = { whole: 'whole number', decimal: 'decimal', date: 'date', time: 'time', textLength: 'text length', list: 'list', custom: 'custom' };
const OP_WORDS: Record<Operator, string> = { between: 'between', notBetween: 'not between', equal: '=', notEqual: '≠', greaterThan: '>', lessThan: '<', greaterThanOrEqual: '≥', lessThanOrEqual: '≤' };
const LIST_SHOWN = 8;

/** The rule in words, at one cell: `whole number > 0`, `decimal between 0.00% and 2.00%`, `date ≤ 30-Sep-2026`, `list — Core, Income, Cap`. */
export function ruleWords(rule: Rule, store: WorkbookStore, row: number, col: number): string {
  const ref = a1(row, col);
  if (rule.kind === 'list') {
    const opts = listOptions(rule, store, row, col);
    const shown = opts.slice(0, LIST_SHOWN).join(', ');
    return `list — ${shown || '(empty)'}${opts.length > LIST_SHOWN ? `, … (${opts.length - LIST_SHOWN} more)` : ''}`;
  }
  if (rule.kind === 'custom') return `custom — =${(rule.dv.formula1 ?? '').replace(/^=/, '')}`;
  const book = store.book;
  const show = (o: Operand | undefined): string => {
    if (!o) return '?';
    const n = operandAt(o, rule, store, row, col);
    if (n === undefined) return o.k === 'ref' ? a1(o.row, o.col) : '?';
    if (rule.kind === 'date') return dateText(n, book?.date1904 ?? false);
    if (rule.kind === 'time') return timeText(n);
    if (rule.kind === 'textLength') return String(n);
    return store.format(rule.sheet, ref, n);
  };
  const two = rule.op === 'between' || rule.op === 'notBetween';
  return `${TYPE_WORDS[rule.kind]} ${OP_WORDS[rule.op]} ${show(rule.f1)}${two ? ` and ${show(rule.f2)}` : ''}${rule.kind === 'textLength' ? ' characters' : ''}`;
}

/** Does a cell sit in one of the rule's ranges? */
export const covers = (rule: Rule, row: number, col: number) => rule.boxes.some((b) => inBox(b, row, col));
