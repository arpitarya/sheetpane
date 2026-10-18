// The rule compiler: a sheet's `<conditionalFormatting>` blocks, compiled once per
// workbook into one list sorted by priority (global per sheet), each rule with
// its ranges, its anchor and its operands. No DOM, no dependency — the types come
// from @sheetpane/grid, the values from the store a hook is handed.
import { shiftFormula, type CellContext, type PluginContext, type WorkbookStore } from '@sheetpane/grid';

export type Book = PluginContext['book'];
export type Sheet = CellContext['sheet'];
export type Cell = CellContext['value'];
export type ConditionalFormat = Sheet['conditionalFormats'][number];
export type CfRule = ConditionalFormat['rules'][number];
export type Cfvo = NonNullable<CfRule['colorScale']>['cfvo'][number];

/** The rule types v1 draws. */
export const RULE_KINDS = [
  'cellIs', 'containsText', 'notContainsText', 'beginsWith', 'endsWith',
  'containsBlanks', 'notContainsBlanks', 'containsErrors', 'notContainsErrors',
  'duplicateValues', 'uniqueValues', 'top10', 'aboveAverage', 'colorScale', 'dataBar', 'expression',
] as const;
export type RuleKind = (typeof RULE_KINDS)[number];
export type Operator = 'between' | 'notBetween' | 'equal' | 'notEqual' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual';
const OPERATORS: readonly Operator[] = ['between', 'notBetween', 'equal', 'notEqual', 'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual'];
/** Rule kinds that read the whole range (its statistics), not only the cell. */
export const RANGE_KINDS: readonly RuleKind[] = ['duplicateValues', 'uniqueValues', 'top10', 'aboveAverage', 'colorScale', 'dataBar'];

/**
 * Why a rule is not drawn: an icon set (v1 draws none), a formula without a
 * formula engine (`expression`, or an operand or a threshold that is a
 * formula), a rule type outside v1, or a malformed rule.
 */
export type SkipReason = 'iconSet' | 'formula' | 'type' | 'malformed';

export const MAX_ROWS = 1_048_576, MAX_COLS = 16_384;

// ── A1 ────────────────────────────────────────────────────────────────────
export interface Box { top: number; left: number; bottom: number; right: number }

export function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
export function colName(col: number): string {
  let s = '';
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
export const a1 = (row: number, col: number) => `${colName(col)}${row + 1}`;
export function parseA1(ref: string): { row: number; col: number } | undefined {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(ref);
  return m ? { row: Number(m[2]) - 1, col: colIndex(m[1]!) } : undefined;
}

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
export const inBox = (b: Box, row: number, col: number) => row >= b.top && row <= b.bottom && col >= b.left && col <= b.right;

// ── shifting relative references: @sheetpane/export's, re-exported by the grid peer
export { shiftFormula };

// ── operands ──────────────────────────────────────────────────────────────
/** A `cellIs` operand or a threshold's value: a literal, a cell (relative parts shift with the cell), or any other formula (needs the engine). */
export type Operand =
  | { k: 'num'; v: number; src: string }
  | { k: 'str'; v: string; src: string }
  | { k: 'bool'; v: boolean; src: string }
  | { k: 'ref'; sheet: string | undefined; row: number; col: number; absRow: boolean; absCol: boolean; src: string }
  | { k: 'formula'; src: string };

const NUM = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const SHEET = String.raw`(?:'((?:[^']|'')+)'|([^\s!'"(),:=<>&+\-*/^]+))!`;
const REF = new RegExp(`^(?:${SHEET})?(\\$?)([A-Za-z]{1,3})(\\$?)(\\d+)$`);

/** Parses one operand: a literal or a cell; anything else is a formula for the engine. */
export function parseOperand(f: string): Operand {
  const src = f.trim().replace(/^=/, '').trim();
  if (NUM.test(src)) return { k: 'num', v: Number(src), src };
  let m = /^"((?:[^"]|"")*)"$/.exec(src);
  if (m) return { k: 'str', v: m[1]!.replace(/""/g, '"'), src };
  if (/^(TRUE|FALSE)$/i.test(src)) return { k: 'bool', v: src.toUpperCase() === 'TRUE', src };
  m = REF.exec(src);
  if (m) {
    const sheet = m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2];
    return { k: 'ref', sheet, absCol: m[3] === '$', col: colIndex(m[4]!), absRow: m[5] === '$', row: Number(m[6]) - 1, src };
  }
  return { k: 'formula', src };
}

// ── compiled rules ────────────────────────────────────────────────────────
export interface Rule {
  sheet: string;
  /** The file's rule, as `@sheetpane/import` read it. */
  cf: CfRule;
  kind: string;
  /** The block's ranges, as written (`F3:F15 H3`). */
  sqref: string;
  boxes: Box[];
  /** The top-left of the first range: relative references are written against it. */
  anchor: { row: number; col: number };
  /** Position in the file, for equal priorities. */
  order: number;
  /** `cellIs`: its operands (one, or two for `between` / `notBetween`). */
  operands?: Operand[];
  /** `colorScale` / `dataBar`: its thresholds' values. */
  thresholds?: (Operand | undefined)[];
  /** Needs a formula engine: an `expression`, or an operand or a threshold that is a formula. */
  needsEngine: boolean;
  /** Reads cells outside its own (a formula, a cell operand): re-evaluated on any change. */
  volatile: boolean;
  skip?: { reason: SkipReason; detail: string };
}

const cache = new WeakMap<Book, Map<string, Rule[]>>();

/** The sheet's rules in drawing order: priority ascending (1 is first), then file order. Compiled once per workbook. */
export function rulesOf(book: Book, sheetName: string): Rule[] {
  let bySheet = cache.get(book);
  if (!bySheet) cache.set(book, (bySheet = new Map()));
  let rules = bySheet.get(sheetName);
  if (!rules) bySheet.set(sheetName, (rules = compile(book, sheetName)));
  return rules;
}

function compile(book: Book, sheetName: string): Rule[] {
  const sheet = book.sheets.find((s) => s.name === sheetName);
  if (!sheet) return [];
  const out: Rule[] = [];
  let order = 0;
  for (const block of sheet.conditionalFormats) {
    const boxes = block.sqref.map(parseBox).filter((b): b is Box => !!b);
    const sqref = block.sqref.join(' ');
    for (const cf of block.rules) {
      const rule: Rule = { sheet: sheetName, cf, kind: cf.type, sqref, boxes, anchor: boxes[0] ? { row: boxes[0].top, col: boxes[0].left } : { row: 0, col: 0 }, order: order++, needsEngine: false, volatile: false };
      out.push(rule);
      if (!boxes.length) { rule.skip = { reason: 'malformed', detail: `range "${sqref}"` }; continue; }
      if (cf.type === 'iconSet') { rule.skip = { reason: 'iconSet', detail: 'icon sets are not drawn in v1' }; continue; }
      if (!(RULE_KINDS as readonly string[]).includes(cf.type)) { rule.skip = { reason: 'type', detail: `rule type "${cf.type || '(none)'}"` }; continue; }
      const kind = cf.type as RuleKind;
      if (kind === 'expression') {
        if (!cf.formulas[0]?.trim()) { rule.skip = { reason: 'malformed', detail: 'expression rule without a formula' }; continue; }
        rule.needsEngine = rule.volatile = true;
      } else if (kind === 'cellIs') {
        const op = cf.operator as Operator | undefined;
        if (!op || !OPERATORS.includes(op)) { rule.skip = { reason: 'malformed', detail: `operator "${cf.operator ?? ''}"` }; continue; }
        const two = op === 'between' || op === 'notBetween';
        const fs = cf.formulas.slice(0, two ? 2 : 1);
        if (fs.length < (two ? 2 : 1)) { rule.skip = { reason: 'malformed', detail: `cellIs ${op} without its operand` }; continue; }
        rule.operands = fs.map(parseOperand);
        rule.needsEngine = rule.operands.some((o) => o.k === 'formula');
        rule.volatile = rule.operands.some((o) => o.k === 'formula' || o.k === 'ref');
      } else if (kind === 'containsText' || kind === 'notContainsText' || kind === 'beginsWith' || kind === 'endsWith') {
        if (cf.text === undefined) { rule.skip = { reason: 'malformed', detail: `${kind} without its text` }; continue; }
      } else if (kind === 'colorScale' || kind === 'dataBar') {
        const cfvo = kind === 'colorScale' ? cf.colorScale?.cfvo : cf.dataBar?.cfvo;
        const want = kind === 'colorScale' ? [2, 3] : [2];
        if (!cfvo || !want.includes(cfvo.length) || (kind === 'colorScale' && (cf.colorScale?.colors.length ?? 0) < cfvo.length)) {
          rule.skip = { reason: 'malformed', detail: `${kind === 'colorScale' ? 'colour scale' : 'data bar'} with ${cfvo?.length ?? 0} thresholds` }; continue;
        }
        rule.thresholds = cfvo.map(thresholdOperand);
        rule.needsEngine = rule.thresholds.some((o) => o?.k === 'formula');
        rule.volatile = rule.thresholds.some((o) => o?.k === 'formula' || o?.k === 'ref');
      }
    }
  }
  return out.sort((a, b) => a.cf.priority - b.cf.priority || a.order - b.order);
}

/** A threshold's `val` as an operand; `min` and `max` have none. */
function thresholdOperand(c: Cfvo): Operand | undefined {
  if (c.type === 'min' || c.type === 'max' || c.val === undefined) return undefined;
  return parseOperand(c.val);
}

// ── the formula engine ────────────────────────────────────────────────────
/** What a formula engine offers: the `derive` provider's synchronous `evaluate` (@sheetpane/formulas). */
export type Evaluate = (formula: string, at: { sheet: string; ref: string }) => Cell | undefined;
export function evaluatorOf(store: WorkbookStore): Evaluate | undefined {
  const p = store.plugins.find((x) => x.provides.includes('derive')) as { evaluate?: unknown } | undefined;
  return typeof p?.evaluate === 'function' ? (p.evaluate as Evaluate).bind(p) : undefined;
}

/** The reason a rule is not drawn in this store, if it is not. */
export function skipOf(rule: Rule, store: WorkbookStore | undefined): Rule['skip'] {
  if (rule.skip) return rule.skip;
  if (rule.needsEngine && !(store && evaluatorOf(store))) {
    const what = rule.kind === 'expression' ? 'formula rule' : `${rule.kind} rule with a formula operand`;
    return { reason: 'formula', detail: store?.plugins.some((p) => p.provides.includes('derive')) ? `${what} — the formula plugin offers no evaluate()` : `${what} — needs the formulas plugin` };
  }
  return undefined;
}

/** Does a cell sit in one of the rule's ranges? */
export const covers = (rule: Rule, row: number, col: number) => rule.boxes.some((b) => inBox(b, row, col));

// ── the rule in words (the legend) ────────────────────────────────────────
const OP_WORDS: Record<Operator, string> = {
  between: 'between', notBetween: 'not between', equal: 'equal to', notEqual: 'not equal to',
  greaterThan: 'greater than', lessThan: 'less than', greaterThanOrEqual: 'greater than or equal to', lessThanOrEqual: 'less than or equal to',
};
const quote = (s: string) => `"${s}"`;
const ordinal = (n: string) => { const v = Math.abs(Number(n)) % 100; return /^\d+$/.test(n) ? `${n}${v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][v % 10] ?? 'th'}` : n; };

function thresholdWords(c: Cfvo): string {
  switch (c.type) {
    case 'min': return 'lowest';
    case 'max': return 'highest';
    case 'percent': return `${c.val ?? '?'}%`;
    case 'percentile': return `${ordinal(c.val ?? '?')} percentile`;
    case 'formula': return `=${(c.val ?? '').replace(/^=/, '')}`;
    default: return c.val ?? '?';
  }
}

/**
 * The rule in words, at one cell (relative references shifted to it):
 * `greater than 1000`, `between 10 and 20`, `contains "late"`, `top 10%`,
 * `colour scale: lowest → 50th percentile → highest`, `formula =A2>B2`.
 */
export function ruleWords(rule: Rule, row = rule.anchor.row, col = rule.anchor.col): string {
  const cf = rule.cf;
  const dr = row - rule.anchor.row, dc = col - rule.anchor.col;
  const operand = (o: Operand) => (o.k === 'str' ? quote(o.v) : o.k === 'num' || o.k === 'bool' ? o.src : `=${shiftFormula(o.src, dr, dc)}`.replace(/^=(\$?[A-Za-z]{1,3}\$?\d+)$/, '$1'));
  switch (rule.kind) {
    case 'cellIs': {
      const [a, b] = rule.operands ?? [];
      const op = cf.operator as Operator;
      return `${OP_WORDS[op] ?? op} ${a ? operand(a) : '?'}${b ? ` and ${operand(b)}` : ''}`;
    }
    case 'containsText': return `contains ${quote(cf.text ?? '')}`;
    case 'notContainsText': return `does not contain ${quote(cf.text ?? '')}`;
    case 'beginsWith': return `begins with ${quote(cf.text ?? '')}`;
    case 'endsWith': return `ends with ${quote(cf.text ?? '')}`;
    case 'containsBlanks': return 'blank';
    case 'notContainsBlanks': return 'not blank';
    case 'containsErrors': return 'an error';
    case 'notContainsErrors': return 'not an error';
    case 'duplicateValues': return 'duplicate value';
    case 'uniqueValues': return 'unique value';
    case 'top10': return `${cf.bottom ? 'bottom' : 'top'} ${cf.rank ?? 10}${cf.percent ? '%' : ''}`;
    case 'aboveAverage': return `${cf.aboveAverage === false ? 'below' : 'above'} average`;
    case 'colorScale': return `colour scale: ${(cf.colorScale?.cfvo ?? []).map(thresholdWords).join(' → ')}`;
    case 'dataBar': return `data bar: ${(cf.dataBar?.cfvo ?? []).map(thresholdWords).join(' → ')}`;
    case 'expression': return `formula =${shiftFormula((cf.formulas[0] ?? '').replace(/^=/, ''), dr, dc)}`;
    case 'iconSet': return `icon set${cf.iconSet?.iconSet ? ` ${cf.iconSet.iconSet}` : ''}`;
    default: return `${rule.kind || 'unknown'} rule`;
  }
}
