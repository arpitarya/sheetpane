// Column rules (W-27) and the rules file (W-33): the host's checks on what a
// user types, by column title and by cell. A core provider on the `validate`
// hook (events verdict decision 8): its errors are `author: 'host'`, they
// resolve themselves when the cell passes, and a rule never edits a cell — it
// only reports (decision 13). Findings are cached per cell and updated on commit
// and undo, so `validate` stays cheap on a 250,000-row sheet; the `load` phase
// checks every row in time-sliced chunks with its progress shown.
//
// Where a cell's rule comes from, weakest first: the element's `columns`, the
// rules file's `"*"` sheet, the rules file's named sheet (SR-GRID 22, 22d).
import { cellRef, colName, parseRange, parseRef, spError, spMessage, type RangePos, type SpCode } from '@sheetpane/export';
import type { Cell } from '@sheetpane/import';
import { serialToParts } from '@sheetpane/import';
import type { ErrorDraft, Plugin } from '../plugins/types.js';
import type { Severity } from './types.js';

/** One rule, as plain JSON: for a column (by title) or for a cell or range (rules file). */
export interface ColumnRule {
  required?: boolean;
  type?: 'text' | 'number' | 'integer' | 'date' | 'boolean';
  /** A number, or for `type: 'date'` an ISO date (`2026-01-31`) or a serial. */
  min?: number | string;
  max?: number | string;
  minLength?: number;
  maxLength?: number;
  /** A regular expression source, tested against the cell's text (values over 10,000 characters are not tested). */
  pattern?: string;
  /** The valid values. */
  oneOf?: readonly (string | number | boolean)[];
  /** Values that are never valid (W-33). */
  noneOf?: readonly (string | number | boolean)[];
  /** The one valid value (W-33); a blank cell fails it. */
  equals?: string | number | boolean;
  unique?: boolean;
  /** Replaces the generated message. */
  message?: string;
  /** Free text for whoever maintains the rules; never shown as the message (W-33). */
  note?: string;
  severity?: Severity;
  onInvalid?: OnInvalid;
}
export type ColumnRules = Readonly<Record<string, ColumnRule>>;
export type OnInvalid = 'flag' | 'block';
export type RulePhase = 'input' | 'commit' | 'load';

/** The rules file (W-33), version 1: rules per sheet (`"*"` for every sheet), by column title and by cell or range. */
export interface RulesDocument {
  $schema?: string;
  version: 1;
  sheets: Readonly<Record<string, { headerRow?: number; columns?: ColumnRules; cells?: ColumnRules }>>;
}

/** What `validate(ctx, signal)` is told (verdict decision 6). */
export interface RuleContext {
  phase: RulePhase;
  sheet: string;
  ref: string;
  /** Zero-based. */
  row: number;
  column: { index: number; letter: string; header: string };
  value: Cell;
  was: Cell;
  original: Cell;
  /** The row's values keyed by column title. */
  rowValues: Readonly<Record<string, Cell>>;
}
export interface RuleResult { severity?: Severity; message: string; expected?: string }
export type ValidateFn = (ctx: RuleContext, signal: AbortSignal) => RuleResult | null | undefined | Promise<RuleResult | null | undefined>;

export interface ColumnRulesConfig {
  columns?: ColumnRules;
  validate?: ValidateFn | undefined;
  /** The default for every rule and for `validate` (decision 9: `flag`). */
  onInvalid?: OnInvalid;
  /** The row holding the titles, 1-based (decision 11: 1). A rules file's sheet may set its own. */
  headerRow?: number;
  /** A rules file (W-33), checked as given: its problems become `note` errors, never a throw. */
  document?: unknown;
}

/** A failure, before it becomes an error. */
export interface RuleOutcome { severity: Severity; message: string; expected: string; onInvalid: OnInvalid }

/** What the rules need from the store (kept narrow, so this module stays testable). */
export interface RulesHost {
  bookSheets(): readonly { name: string; rows: readonly (readonly Cell[])[] }[] | undefined;
  date1904(): boolean;
  value(sheet: string, ref: string): Cell;
  /** The same by position, without building a ref (the load phase reads every cell). */
  valueAt(sheet: string, row: number, col: number): Cell;
  text(sheet: string, ref: string): string;
  original(sheet: string, ref: string): { value: Cell; text: string };
  /** Re-run `validate` for these sheets (findings changed). */
  revalidate(sheets: string[]): void;
  /** Drop host errors no longer produced (rules changed, decision 12). */
  prune(providerId: string, produced: ReadonlySet<string>): void;
  /** The load phase's progress changed. */
  progress(): void;
}

export const RULES_PROVIDER_ID = 'host-rules';
export const RULE_TYPE = 'column-rule';
export const CELL_RULE_TYPE = 'cell-rule';
const PATTERN_LIMIT = 10_000;
const SLICE_MS = 8;
/** A cell rule over more cells than this is checked only where the sheet has data. */
const SMALL_RANGE = 10_000;
const RULE_WORDS = new Set(['required', 'type', 'min', 'max', 'minLength', 'maxLength', 'pattern', 'oneOf', 'noneOf', 'equals', 'unique', 'message', 'note', 'severity', 'onInvalid']);
const TYPES = new Set(['text', 'number', 'integer', 'date', 'boolean']);

const blank = (v: Cell) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
const NUMERIC = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$|^[-+]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/i;
const asNumber = (v: Cell): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && NUMERIC.test(v.trim())) return Number(v.trim().replace(/,/g, ''));
  return undefined;
};
const norm = (v: Cell) => String(v ?? '').trim().toLowerCase();
const show = (x: unknown) => (typeof x === 'string' ? x : String(x));
/** Does a listed value (`oneOf`, `noneOf`, `equals`) match the cell? Text trimmed and without case; numbers by value. */
const matches = (o: string | number | boolean, value: Cell, t: string, n: number | undefined) =>
  typeof o === 'number' ? n === o : typeof o === 'boolean' ? (typeof value === 'boolean' ? value === o : t.toLowerCase() === String(o)) : o.trim().toLowerCase() === t.toLowerCase();

interface CellRule { ref: string; box: RangePos; rule: ColumnRule; re: RegExp | undefined }
/** Where a value sits; `text` is a draft's text (not yet in the store). */
interface CellPos { sheet: string; row: number; col: number; text?: string | undefined }
/** One sheet's rules once the element's `columns` and the rules file are merged. */
interface SheetRules { headerRow: number; columns: [string, ColumnRule, RegExp | undefined][]; cells: CellRule[] }
/** One problem found in a rules file: a `note`, never a throw; `code` is its SP code (W-40). */
export interface DocProblem { code: SpCode; sheet?: string; found: string; message: string }
interface DocSheet { headerRow?: number; columns: Record<string, ColumnRule>; cells: Record<string, ColumnRule> }

export class HostRules {
  private cfg: { columns: ColumnRules; validate: ValidateFn | undefined; onInvalid: OnInvalid; headerRow: number; document: unknown } = { columns: {}, validate: undefined, onInvalid: 'flag', headerRow: 1, document: undefined };
  /** The element's patterns, compiled (an invalid one throws at `configure`). */
  private patterns = new Map<ColumnRule, RegExp>();
  /** The rules file, checked: per sheet (`*` and named), and the problems found in it. */
  private doc: { sheets: Map<string, DocSheet>; problems: DocProblem[] } | undefined;
  private sheetRules = new Map<string, SheetRules>();
  /** Per sheet, per column: the rule its title resolves to (resolved once per load, not per cell). */
  private colRules = new Map<string, Map<number, { header: string; rule: ColumnRule; re: RegExp | undefined }>>();
  /** Per sheet: title (normalised) → column; the titles by column. */
  private headers = new Map<string, { byTitle: Map<string, number>; titles: string[] }>();
  private notes: ErrorDraft[] = [];
  /** Per sheet, per cell: the column rule's failure. */
  private json = new Map<string, Map<string, ErrorDraft>>();
  /** Per sheet, per cell: a cell rule's failure (rules file). */
  private cellJson = new Map<string, Map<string, ErrorDraft>>();
  /** Per sheet, per cell: the function's latest result. */
  private fn = new Map<string, Map<string, ErrorDraft>>();
  /** Per sheet and column: normalised value → its row, or its rows once it repeats (for `unique`; a Set per distinct value would be 250,000 Sets). */
  private uniq = new Map<string, Map<string, number | Set<number>>>();
  private inflight = new Map<string, AbortController>();
  private gen = 0;
  /** The load phase: rows checked of rows to check; undefined when idle. */
  progress: { done: number; total: number } | undefined;

  readonly provider: Plugin = { id: RULES_PROVIDER_ID, provides: ['validate'], validate: (sheet) => this.drafts(sheet) };

  constructor(private readonly host: RulesHost) {}

  get active(): boolean { return Object.keys(this.cfg.columns).length > 0 || !!this.cfg.validate || this.cfg.document !== undefined; }
  get config(): Readonly<ColumnRulesConfig> { return this.cfg; }
  /** Whether a rules file is in force (its errors are labelled "Rules file"). */
  get hasDocument(): boolean { return this.cfg.document !== undefined; }

  /** Rules may change after a workbook is loaded (decision 12): every row is checked again and stale host errors go. */
  configure(c: ColumnRulesConfig): void {
    const patterns = new Map<ColumnRule, RegExp>();
    for (const [title, r] of Object.entries(c.columns ?? {})) {
      if (r.pattern === undefined) continue;
      try { patterns.set(r, new RegExp(r.pattern)); } catch (e) { throw spError('SP-6001', `sheetpane: the "${title}" column rule's pattern is not a regular expression: ${(e as Error).message}`, TypeError); }
    }
    this.patterns = patterns;
    this.cfg = { columns: { ...(c.columns ?? {}) }, validate: c.validate, onInvalid: c.onInvalid ?? 'flag', headerRow: Math.max(1, Math.floor(c.headerRow ?? 1)), document: c.document };
    this.doc = c.document === undefined ? undefined : checkDocument(c.document);
    void this.loadPhase(true);
  }

  /** A new workbook: forget everything and check it (`load`). */
  reset(): void { void this.loadPhase(false); }

  // ── the validate provider ───────────────────────────────────────────────
  private drafts(sheet: string): ErrorDraft[] {
    if (!this.active) return [];
    const out = this.notes.filter((n) => n.sheet === sheet);
    const j = this.json.get(sheet), f = this.fn.get(sheet), k = this.cellJson.get(sheet);
    if (j) out.push(...j.values());
    if (k) out.push(...k.values());
    if (f) for (const [ref, d] of f) if (!j?.has(ref)) out.push(d); // one column error per cell: the JSON rule's first
    return out;
  }

  // ── merging: element columns < file "*" < file named sheet ───────────────
  private compileSheet(name: string): SheetRules {
    const star = this.doc?.sheets.get('*'), own = this.doc?.sheets.get(name);
    const byTitle = new Map<string, [string, ColumnRule, RegExp | undefined]>();
    const put = (title: string, rule: ColumnRule, re: RegExp | undefined, from: string) => {
      const k = title.trim().toLowerCase(), had = byTitle.get(k);
      if (had && from !== 'element' && this.cfg.columns[had[0]] === had[1]) this.notes.push(this.note('SP-6025', name, `A${this.cfg.headerRow}`, title, `The rules file's rule for “${title}” replaces the one set on the element`, `override:${k}`));
      byTitle.set(k, [title, rule, re]);
    };
    for (const [t, r] of Object.entries(this.cfg.columns)) put(t, r, this.patterns.get(r), 'element');
    for (const src of [star, own]) if (src) for (const [t, r] of Object.entries(src.columns)) put(t, r, filePattern(r), 'file');
    const cells: CellRule[] = [];
    for (const src of [star, own]) if (src) for (const [ref, r] of Object.entries(src.cells)) { const box = parseRange(ref); if (box) cells.push({ ref, box, rule: r, re: filePattern(r) }); }
    return { headerRow: Math.max(1, Math.floor(own?.headerRow ?? star?.headerRow ?? this.cfg.headerRow)), columns: [...byTitle.values()], cells };
  }

  // ── headers ─────────────────────────────────────────────────────────────
  private readHeaders(): void {
    this.headers.clear();
    this.sheetRules.clear();
    this.colRules.clear();
    this.notes = [];
    const sheets = this.host.bookSheets() ?? [];
    const first = sheets[0];
    // the rules file's own problems, and the sheets it names that the workbook lacks
    for (const p of this.doc?.problems ?? []) this.notes.push(this.note(p.code, p.sheet && sheets.some((s) => s.name === p.sheet) ? p.sheet : first?.name ?? '', 'A1', p.found, p.message, `doc:${p.message}`));
    for (const name of this.doc?.sheets.keys() ?? []) if (name !== '*' && first && !sheets.some((s) => s.name === name)) this.notes.push(this.note('SP-6022', first.name, 'A1', name, `No sheet is named “${name}” — its rules are not checked`, `sheet:${name}`));
    const found = new Map<string, Set<string>>(); // title → sheets that have it
    for (const s of sheets) {
      const sr = this.compileSheet(s.name);
      this.sheetRules.set(s.name, sr);
      const hr = sr.headerRow - 1;
      const titles: string[] = [];
      const byTitle = new Map<string, number>();
      const width = s.rows[hr]?.length ?? 0;
      for (let c = 0; c < width; c++) {
        const t = this.host.text(s.name, cellRef(hr, c)).trim();
        titles[c] = t;
        if (!t) continue;
        const k = t.toLowerCase();
        if (byTitle.has(k)) {
          if (this.ruleFor(s.name, t)) this.notes.push(this.note('SP-6024', s.name, cellRef(hr, c), t, `Two columns are titled “${t}” — the rules check column ${colName(byTitle.get(k)!)}, the first`));
          continue;
        }
        byTitle.set(k, c);
        if (!found.has(k)) found.set(k, new Set());
        found.get(k)!.add(s.name);
      }
      this.headers.set(s.name, { byTitle, titles });
      const cr = new Map<number, { header: string; rule: ColumnRule; re: RegExp | undefined }>();
      for (const [, c] of byTitle) { const hit = this.ruleFor(s.name, titles[c]!); if (hit) cr.set(c, { header: titles[c]!, rule: hit.rule, re: hit.re }); }
      this.colRules.set(s.name, cr);
    }
    if (!first) return;
    // a title nobody has: the element's and "*"'s across the workbook; a named sheet's on that sheet
    const general = new Set([...Object.keys(this.cfg.columns), ...Object.keys(this.doc?.sheets.get('*')?.columns ?? {})]);
    for (const title of general) if (!found.has(title.trim().toLowerCase())) this.notes.push(this.note('SP-6023', first.name, cellRef(this.cfg.headerRow - 1, 0), title, `No column is titled “${title}” — its rule is not checked`, `title:${title}`));
    for (const [name, d] of this.doc?.sheets ?? []) {
      if (name === '*' || !this.headers.has(name)) continue;
      const hr = this.sheetRules.get(name)!.headerRow;
      for (const title of Object.keys(d.columns)) if (!found.get(title.trim().toLowerCase())?.has(name)) this.notes.push(this.note('SP-6023', name, cellRef(hr - 1, 0), title, `No column is titled “${title}” in row ${hr} of “${name}” — its rule is not checked`, `title:${title}`));
    }
  }

  /** A `note` error about the rules themselves; it carries its SP code (W-40). */
  private note(code: SpCode, sheet: string, range: string, found: string, message: string, key?: string): ErrorDraft {
    const d: ErrorDraft = { sheet, range, type: RULE_TYPE, severity: 'note', found, expected: '', message, author: 'host', code };
    if (key) d.key = key; // several notes may share a cell
    return d;
  }

  /** The rule for a title on a sheet (matched trimmed and case-insensitive; an exact title wins). */
  private ruleFor(sheet: string, header: string): { title: string; rule: ColumnRule; re: RegExp | undefined } | undefined {
    const h = header.trim(), k = h.toLowerCase();
    const all = this.sheetRules.get(sheet)?.columns;
    if (!k || !all) return undefined;
    const hit = all.find(([t]) => t.trim() === h) ?? all.find(([t]) => t.trim().toLowerCase() === k);
    return hit && { title: hit[0], rule: hit[1], re: hit[2] };
  }

  private headerRow(sheet: string): number { return this.sheetRules.get(sheet)?.headerRow ?? this.cfg.headerRow; }

  /** The column's title on a sheet, when the column is the first of its title. */
  private headerAt(sheet: string, col: number): string | undefined {
    const h = this.headers.get(sheet);
    const t = h?.titles[col];
    return t && h!.byTitle.get(t.toLowerCase()) === col ? t : undefined;
  }

  private context(phase: RulePhase, sheet: string, row: number, col: number, value: Cell): RuleContext {
    const ref = cellRef(row, col);
    const h = this.headers.get(sheet);
    const rowValues: Record<string, Cell> = {};
    if (h) for (const [, c] of h.byTitle) rowValues[h.titles[c]!] = c === col ? value : this.host.value(sheet, cellRef(row, c));
    return { phase, sheet, ref, row, column: { index: col, letter: colName(col), header: h?.titles[col] ?? '' }, value, was: this.host.value(sheet, ref), original: this.host.original(sheet, ref).value, rowValues };
  }

  // ── checking ────────────────────────────────────────────────────────────
  /** A rule's first failing constraint for a value, or null. `label` names what is checked (a column's title or a cell). */
  /** A rule's first failing constraint for a value, or null. `label` names what is checked (a column's title or a cell).
   *  `at` is where the value sits (its shown text is read only when a constraint needs it — reading fills the store's
   *  text cache) or, for a draft, the text itself. No closure is made per call: the load phase checks a million cells. */
  private checkRule(rule: ColumnRule, re: RegExp | undefined, label: string, value: Cell, at: CellPos, unique: boolean): RuleOutcome | null {
    if (blank(value)) return rule.required ? this.fail(rule, label, 'a value is required', 'required') : rule.equals !== undefined ? this.fail(rule, label, `must be ${show(rule.equals)}`, 'equals') : null;
    const n = asNumber(value);
    if (rule.equals !== undefined && !matches(rule.equals, value, this.trimmed(value, at), n)) return this.fail(rule, label, `must be ${show(rule.equals)}`, 'equals');
    switch (rule.type) {
      case 'number': if (n === undefined) return this.fail(rule, label, 'must be a number', 'type: number'); break;
      case 'integer': if (n === undefined || !Number.isInteger(n)) return this.fail(rule, label, 'must be a whole number', 'type: integer'); break;
      case 'date': if (this.dateMs(value, this.shownText(at)) === undefined) return this.fail(rule, label, 'must be a date', 'type: date'); break;
      case 'boolean': if (typeof value !== 'boolean' && !/^(true|false)$/i.test(this.trimmed(value, at))) return this.fail(rule, label, 'must be TRUE or FALSE', 'type: boolean'); break;
      default: break;
    }
    if (rule.min !== undefined || rule.max !== undefined) {
      const asDate = rule.type === 'date';
      const v = asDate ? this.dateMs(value, this.shownText(at)) : n;
      const lo = rule.min === undefined ? undefined : asDate ? this.boundMs(rule.min) : Number(rule.min);
      const hi = rule.max === undefined ? undefined : asDate ? this.boundMs(rule.max) : Number(rule.max);
      if (v === undefined) { if (rule.type === undefined) return this.fail(rule, label, `must be a ${asDate ? 'date' : 'number'}`, rule.min !== undefined ? 'min' : 'max'); }
      else {
        if (lo !== undefined && v < lo) return this.fail(rule, label, `must be at least ${show(rule.min)}`, 'min');
        if (hi !== undefined && v > hi) return this.fail(rule, label, `must be at most ${show(rule.max)}`, 'max');
      }
    }
    if (rule.minLength !== undefined || rule.maxLength !== undefined || re) {
      const raw = typeof value === 'string' ? value : this.shownText(at);
      if (rule.minLength !== undefined && raw.length < rule.minLength) return this.fail(rule, label, `must be at least ${rule.minLength} characters`, 'minLength');
      if (rule.maxLength !== undefined && raw.length > rule.maxLength) return this.fail(rule, label, `must be at most ${rule.maxLength} characters`, 'maxLength');
      if (re && raw.length <= PATTERN_LIMIT) { re.lastIndex = 0; if (!re.test(raw)) return this.fail(rule, label, 'does not match the expected format', 'pattern'); }
    }
    if (rule.oneOf || rule.noneOf || (rule.unique && unique)) {
      const t = this.trimmed(value, at);
      if (rule.oneOf && !rule.oneOf.some((o) => matches(o, value, t, n))) return this.fail(rule, label, `must be one of ${rule.oneOf.map(show).join(', ')}`, 'oneOf');
      if (rule.noneOf?.some((o) => matches(o, value, t, n))) return this.fail(rule, label, `“${t}” is not allowed`, 'noneOf');
      if (rule.unique && unique) {
        const rows = this.uniq.get(`${at.sheet}|${at.col}`)?.get(norm(t));
        if (rows !== undefined && typeof rows !== 'number' && [...rows].some((r) => r !== at.row)) return this.fail(rule, label, `“${t}” appears more than once`, 'unique');
      }
    }
    return null;
  }
  private fail(rule: ColumnRule, label: string, what: string, name: string): RuleOutcome {
    return { severity: rule.severity ?? 'error', message: rule.message ?? `${label}: ${what} (${name})`, expected: describeRule(rule), onInvalid: rule.onInvalid ?? this.cfg.onInvalid };
  }
  private shownText(at: CellPos): string { return at.text ?? this.host.text(at.sheet, cellRef(at.row, at.col)); }
  private trimmed(value: Cell, at: CellPos): string { return (typeof value === 'string' ? value : this.shownText(at)).trim(); }

  /** The column rule's verdict for a cell, or null. `at` is the cell's place, or a draft's text. */
  private checkJson(sheet: string, row: number, col: number, value: Cell, at: string | undefined): RuleOutcome | null {
    if (row <= this.headerRow(sheet) - 1) return null;
    const hit = this.colRules.get(sheet)?.get(col);
    return hit ? this.checkRule(hit.rule, hit.re, hit.header, value, { sheet, row, col, text: at }, true) : null;
  }

  /** The first failing cell rule (rules file) for a cell, or null. */
  private checkCells(sheet: string, row: number, col: number, value: Cell, at: string | undefined): RuleOutcome | null {
    const rules = this.sheetRules.get(sheet)?.cells;
    if (!rules?.length) return null;
    for (const c of rules) {
      if (row < c.box.top || row > c.box.bottom || col < c.box.left || col > c.box.right) continue;
      const o = this.checkRule(c.rule, c.re, cellRef(row, col), value, { sheet, row, col, text: at }, false);
      if (o) return o;
    }
    return null;
  }

  private dateMs(value: Cell, text: string): number | undefined {
    if (typeof value === 'number') {
      // a date cell is a serial shown as a date: its text must read as one
      if (!/[a-z]{3}|\d[\/.-]\d/i.test(text)) return undefined;
      const p = serialToParts(value, this.host.date1904());
      return Date.UTC(p.y, p.mo, p.d) + Math.round((value % 1) * 86_400_000);
    }
    if (typeof value === 'string' && value.trim()) { const ms = Date.parse(value.trim()); return Number.isFinite(ms) ? ms : undefined; }
    return undefined;
  }
  private boundMs(b: number | string): number | undefined {
    if (typeof b === 'number') { const p = serialToParts(b, this.host.date1904()); return Date.UTC(p.y, p.mo, p.d); }
    const ms = Date.parse(b);
    return Number.isFinite(ms) ? ms : undefined;
  }

  private toDraft(sheet: string, ref: string, text: string, o: RuleOutcome | RuleResult, type = RULE_TYPE): ErrorDraft {
    return { sheet, range: ref, type, severity: o.severity ?? 'error', found: text === '' ? '(blank)' : text, expected: o.expected ?? '', message: o.message, author: 'host' };
  }

  /** Is this cell a data cell in a titled column of a sheet with rules? */
  private inScope(sheet: string, row: number, col: number): boolean {
    return row > this.headerRow(sheet) - 1 && !!this.headers.get(sheet)?.titles[col];
  }
  private inCellRule(sheet: string, row: number, col: number): boolean {
    return (this.sheetRules.get(sheet)?.cells ?? []).some((c) => row >= c.box.top && row <= c.box.bottom && col >= c.box.left && col <= c.box.right);
  }

  private setJson(sheet: string, row: number, col: number): void {
    const m = this.json.get(sheet);
    const o = this.checkJson(sheet, row, col, this.host.valueAt(sheet, row, col), undefined);
    if (o) { const ref = cellRef(row, col), d = this.toDraft(sheet, ref, this.host.text(sheet, ref), o); if (m) m.set(ref, d); else this.json.set(sheet, new Map([[ref, d]])); }
    else if (m?.size) m.delete(cellRef(row, col));
  }
  private setCell(sheet: string, row: number, col: number): void {
    const m = this.cellJson.get(sheet);
    const o = this.checkCells(sheet, row, col, this.host.valueAt(sheet, row, col), undefined);
    if (o) { const ref = cellRef(row, col), d = this.toDraft(sheet, ref, this.host.text(sheet, ref), o, CELL_RULE_TYPE); if (m) m.set(ref, d); else this.cellJson.set(sheet, new Map([[ref, d]])); }
    else if (m?.size) m.delete(cellRef(row, col));
  }

  /** Calls the host's function for one cell; a sync result lands now, an async one later (unless superseded). */
  private callFn(phase: RulePhase, sheet: string, row: number, col: number, gen: number): Promise<void> | undefined {
    const f = this.cfg.validate;
    if (!f) return undefined;
    const ref = cellRef(row, col), k = `${sheet}!${ref}`;
    this.inflight.get(k)?.abort();
    const ac = new AbortController();
    this.inflight.set(k, ac);
    const value = this.host.value(sheet, ref);
    const land = (r: RuleResult | null | undefined) => {
      if (ac.signal.aborted || gen !== this.gen) return false; // a newer edit or a new workbook: drop it
      this.inflight.delete(k);
      let m = this.fn.get(sheet);
      if (r) { if (!m) this.fn.set(sheet, (m = new Map())); m.set(ref, this.toDraft(sheet, ref, this.host.text(sheet, ref), r)); } else m?.delete(ref);
      return true;
    };
    let r: ReturnType<ValidateFn>;
    try { r = f(this.context(phase, sheet, row, col, value), ac.signal); } catch (e) { console.error(spMessage('SP-6002', 'sheetpane: the column-rules validate function threw'), e); return undefined; }
    if (r && typeof (r as Promise<unknown>).then === 'function') {
      return (r as Promise<RuleResult | null | undefined>).then(
        (x) => { if (land(x) && phase !== 'load') this.host.revalidate([sheet]); },
        (e: unknown) => { if (!ac.signal.aborted) console.error(spMessage('SP-6002', 'sheetpane: the column-rules validate function failed'), e); },
      );
    }
    land(r as RuleResult | null | undefined);
    return undefined;
  }

  // ── phases ──────────────────────────────────────────────────────────────
  /** `load` (decision 7): every row of every sheet with titles, then every cell a cell rule names, in time slices; progress is shown. */
  private async loadPhase(rulesChanged: boolean): Promise<void> {
    const gen = ++this.gen;
    for (const ac of this.inflight.values()) ac.abort();
    this.inflight.clear();
    this.json.clear(); this.cellJson.clear(); this.fn.clear(); this.uniq.clear();
    const sheets = this.host.bookSheets();
    if (!sheets || !this.active) {
      this.notes = []; this.headers.clear(); this.sheetRules.clear(); this.progress = undefined;
      if (rulesChanged) { this.host.prune(RULES_PROVIDER_ID, new Set()); this.host.revalidate((sheets ?? []).map((s) => s.name)); }
      return;
    }
    this.readHeaders();
    const cellBoxes = (s: { name: string; rows: readonly (readonly Cell[])[] }) => (this.sheetRules.get(s.name)?.cells ?? []).map((c) => {
      const cells = (c.box.bottom - c.box.top + 1) * (c.box.right - c.box.left + 1);
      const width = s.rows.reduce((m, r) => Math.max(m, r.length), 0);
      return cells <= SMALL_RANGE ? c.box : { top: c.box.top, left: c.box.left, bottom: Math.min(c.box.bottom, s.rows.length - 1), right: Math.min(c.box.right, Math.max(width - 1, c.box.left)) };
    });
    const total = sheets.reduce((n, s) => n + Math.max(0, s.rows.length - this.headerRow(s.name)) + cellBoxes(s).reduce((m, b) => m + Math.max(0, b.bottom - b.top + 1), 0), 0);
    this.progress = { done: 0, total };
    this.host.progress();
    let t0 = now();
    let lastShown = t0;
    // unique: index every titled column with a unique rule before checking (sliced too: 250,000 rows is a long index)
    for (const s of sheets) {
      const h = this.headers.get(s.name)!, first = this.headerRow(s.name);
      for (const [, c] of h.byTitle) {
        if (!this.ruleFor(s.name, h.titles[c]!)?.rule.unique) continue;
        const idx = new Map<string, number | Set<number>>();
        for (let r = first; r < s.rows.length; r++) {
          const v = norm(this.host.valueAt(s.name, r, c));
          if (v) addRow(idx, v, r);
          if ((r & 1023) === 0 && now() - t0 > SLICE_MS) { await yieldToPage(); if (gen !== this.gen) return; t0 = now(); }
        }
        this.uniq.set(`${s.name}|${c}`, idx);
      }
    }
    const tick = async (): Promise<boolean> => {
      this.progress!.done++;
      if (now() - t0 <= SLICE_MS) return true;
      if (now() - lastShown > 100) { this.host.progress(); lastShown = now(); }
      await yieldToPage();
      t0 = now();
      return gen === this.gen; // false: a newer workbook or newer rules
    };
    for (const s of sheets) {
      const h = this.headers.get(s.name)!, first = this.headerRow(s.name);
      const ruled = [...h.byTitle.values()].filter((c) => this.ruleFor(s.name, h.titles[c]!));
      const titled = this.cfg.validate ? [...h.byTitle.values()] : [];
      if (!ruled.length && !titled.length) this.progress.done += Math.max(0, s.rows.length - first);
      else for (let r = first; r < s.rows.length; r++) {
        for (const c of ruled) this.setJson(s.name, r, c);
        const pending: Promise<void>[] = [];
        for (const c of titled) { const p = this.callFn('load', s.name, r, c, gen); if (p) pending.push(p); }
        if (pending.length) await Promise.all(pending);
        if (gen !== this.gen || !(await tick())) return;
      }
      for (const b of cellBoxes(s)) for (let r = b.top; r <= b.bottom; r++) {
        for (let c = b.left; c <= b.right; c++) this.setCell(s.name, r, c);
        if (!(await tick())) return;
      }
    }
    this.progress = undefined;
    this.host.progress();
    if (rulesChanged) {
      const produced = new Set<string>();
      for (const s of sheets) for (const d of this.drafts(s.name)) produced.add(`${RULES_PROVIDER_ID}|${d.sheet}|${d.range}|${d.type}${d.key ? `|${d.key}` : ''}`);
      this.host.prune(RULES_PROVIDER_ID, produced);
    }
    this.host.revalidate(sheets.map((s) => s.name));
  }

  /** `commit` (decision 7): cells changed by an edit, a paste or undo. */
  touch(cells: readonly { sheet: string; ref: string }[]): void {
    if (!this.active || !this.host.bookSheets()) return;
    if (cells.some((c) => parseRef(c.ref)?.row === this.headerRow(c.sheet) - 1)) { void this.loadPhase(true); return; } // a title changed
    const rows = new Set<string>();
    for (const c of cells) {
      const p = parseRef(c.ref);
      if (!p) continue;
      if (this.inCellRule(c.sheet, p.row, p.col)) this.setCell(c.sheet, p.row, p.col);
      if (!this.inScope(c.sheet, p.row, p.col)) continue;
      const header = this.headerAt(c.sheet, p.col);
      if (header && this.ruleFor(c.sheet, header)?.rule.unique) this.reindexUnique(c.sheet, p.row, p.col);
      else this.setJson(c.sheet, p.row, p.col);
      rows.add(`${c.sheet}\u0000${p.row}`);
    }
    // the function sees the whole row (cross-column checks): every titled cell of a touched row is asked again
    if (this.cfg.validate) for (const key of rows) {
      const [sheet, r] = key.split('\u0000') as [string, string];
      const h = this.headers.get(sheet);
      if (h) for (const c of h.byTitle.values()) void this.callFn('commit', sheet, Number(r), c, this.gen);
    }
  }

  private reindexUnique(sheet: string, row: number, col: number): void {
    const idx = this.uniq.get(`${sheet}|${col}`);
    if (!idx) { this.setJson(sheet, row, col); return; }
    const affected = new Set<number>([row]);
    for (const [v, rows] of idx) {
      if (rows === row) { idx.delete(v); continue; }
      if (typeof rows !== 'number' && rows.delete(row)) { for (const r of rows) affected.add(r); if (rows.size === 1) idx.set(v, [...rows][0]!); }
    }
    const v = norm(this.host.valueAt(sheet, row, col));
    if (v) { addRow(idx, v, row); const rows = idx.get(v)!; if (typeof rows !== 'number') for (const r of rows) affected.add(r); }
    for (const r of affected) this.setJson(sheet, r, col);
  }

  /** `input` (decision 7): the draft checked as typed — nothing is stored. */
  async checkInput(sheet: string, ref: string, value: Cell, text: string, signal: AbortSignal): Promise<RuleOutcome | null> {
    if (!this.active) return null;
    const p = parseRef(ref);
    if (!p) return null;
    const j = (this.inScope(sheet, p.row, p.col) ? this.checkJson(sheet, p.row, p.col, value, text) : null) ?? this.checkCells(sheet, p.row, p.col, value, text);
    if (j) return j;
    const f = this.cfg.validate;
    if (!f || !this.inScope(sheet, p.row, p.col)) return null;
    try {
      const r = await f(this.context('input', sheet, p.row, p.col, value), signal);
      return r && !signal.aborted ? { severity: r.severity ?? 'error', message: r.message, expected: r.expected ?? '', onInvalid: this.cfg.onInvalid } : null;
    } catch { return null; }
  }

  /** The `block` check at commit (decision 9): a failing rule set to block refuses the value. Async results can only flag. */
  blocked(sheet: string, ref: string, value: Cell, text: string): RuleOutcome | null {
    if (!this.active) return null;
    const p = parseRef(ref);
    if (!p) return null;
    for (const j of [this.inScope(sheet, p.row, p.col) ? this.checkJson(sheet, p.row, p.col, value, text) : null, this.checkCells(sheet, p.row, p.col, value, text)]) if (j?.onInvalid === 'block') return j;
    const f = this.cfg.validate;
    if (!f || this.cfg.onInvalid !== 'block' || !this.inScope(sheet, p.row, p.col)) return null;
    try {
      const r = f(this.context('commit', sheet, p.row, p.col, value), new AbortController().signal);
      if (r && typeof (r as Promise<unknown>).then !== 'function') {
        const x = r as RuleResult;
        return { severity: x.severity ?? 'error', message: x.message, expected: x.expected ?? '', onInvalid: 'block' };
      }
    } catch { /* a throwing function never blocks */ }
    return null;
  }
}

/** Adds a row to a `unique` index entry: a bare number until the value repeats. */
function addRow(idx: Map<string, number | Set<number>>, v: string, r: number): void {
  const had = idx.get(v);
  if (had === undefined) idx.set(v, r);
  else if (typeof had === 'number') { if (had !== r) idx.set(v, new Set([had, r])); }
  else had.add(r);
}

/** A file pattern: compiled, or undefined when it is not a regular expression (the document check named it already). */
const patternCache = new WeakMap<ColumnRule, RegExp | null>();
function filePattern(r: ColumnRule): RegExp | undefined {
  if (r.pattern === undefined) return undefined;
  let re = patternCache.get(r);
  if (re === undefined) { try { re = new RegExp(r.pattern); } catch { re = null; } patternCache.set(r, re); }
  return re ?? undefined;
}

/**
 * Checks a rules file (W-33) by hand — no schema library at run time. Every problem
 * is named (an unknown key, version or word, a bad ref or pattern) and the rest
 * still applies; nothing throws.
 */
export function checkDocument(doc: unknown): { sheets: Map<string, DocSheet>; problems: DocProblem[] } {
  const problems: DocProblem[] = [];
  const sheets = new Map<string, DocSheet>();
  const obj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
  if (!obj(doc)) return { sheets, problems: [{ code: 'SP-6010', found: typeof doc, message: 'The rules file is not a JSON object — no rule from it is checked' }] };
  if ('__error' in doc) return { sheets, problems: [{ code: 'SP-6011', found: String(doc.__error), message: `The rules file could not be read — ${String(doc.__error)}` }] };
  if (doc.version !== 1) return { sheets, problems: [{ code: 'SP-6012', found: String(doc.version), message: `Rules file version ${JSON.stringify(doc.version)} is not one this grid reads (1) — no rule from it is checked` }] };
  for (const k of Object.keys(doc)) if (!['$schema', 'version', 'sheets'].includes(k)) problems.push({ code: 'SP-6013', found: k, message: `Unknown key “${k}” in the rules file` });
  if (!obj(doc.sheets)) { problems.push({ code: 'SP-6014', found: 'sheets', message: 'The rules file has no “sheets” object' }); return { sheets, problems }; }
  const rule = (r: unknown, where: string, sheet: string): ColumnRule | undefined => {
    if (!obj(r)) { problems.push({ code: 'SP-6015', sheet, found: where, message: `The rule for ${where} is not an object` }); return undefined; }
    for (const k of Object.keys(r)) if (!RULE_WORDS.has(k)) problems.push({ code: 'SP-6016', sheet, found: k, message: `Unknown rule word “${k}” for ${where}` });
    if (r.type !== undefined && !TYPES.has(String(r.type))) problems.push({ code: 'SP-6017', sheet, found: String(r.type), message: `Unknown type “${String(r.type)}” for ${where} (text, number, integer, date, boolean)` });
    if (r.pattern !== undefined) { try { new RegExp(String(r.pattern)); } catch (e) { problems.push({ code: 'SP-6018', sheet, found: String(r.pattern), message: `The pattern for ${where} is not a regular expression (${(e as Error).message}) — it is not tested` }); } }
    for (const k of ['oneOf', 'noneOf'] as const) if (r[k] !== undefined && !Array.isArray(r[k])) problems.push({ code: 'SP-6019', sheet, found: k, message: `“${k}” for ${where} is not a list` });
    return r as ColumnRule;
  };
  for (const [name, s] of Object.entries(doc.sheets)) {
    if (!obj(s)) { problems.push({ code: 'SP-6015', sheet: name, found: name, message: `The rules for sheet “${name}” are not an object` }); continue; }
    for (const k of Object.keys(s)) if (!['headerRow', 'columns', 'cells'].includes(k)) problems.push({ code: 'SP-6013', sheet: name, found: k, message: `Unknown key “${k}” in sheet “${name}”` });
    const d: DocSheet = { columns: {}, cells: {} };
    if (s.headerRow !== undefined) { if (typeof s.headerRow === 'number' && s.headerRow >= 1) d.headerRow = s.headerRow; else problems.push({ code: 'SP-6020', sheet: name, found: String(s.headerRow), message: `“headerRow” in sheet “${name}” is not a row number` }); }
    if (obj(s.columns)) for (const [t, r] of Object.entries(s.columns)) { const x = rule(r, `column “${t}”`, name); if (x) d.columns[t] = x; }
    if (obj(s.cells)) for (const [ref, r] of Object.entries(s.cells)) {
      if (!parseRange(ref)) { problems.push({ code: 'SP-6021', sheet: name, found: ref, message: `“${ref}” in sheet “${name}” is not a cell or a range` }); continue; }
      const x = rule(r, `cell ${ref}`, name); if (x) d.cells[ref] = x;
    }
    sheets.set(name, d);
  }
  return { sheets, problems };
}

/** A rule in words, for an error's `expected`: "a whole number from 18 to 99", "one of Active, Inactive". */
export function describeRule(r: ColumnRule): string {
  const parts: string[] = [];
  const kind = r.type === 'integer' ? 'a whole number' : r.type === 'number' ? 'a number' : r.type === 'date' ? 'a date' : r.type === 'boolean' ? 'TRUE or FALSE' : r.type === 'text' ? 'text' : '';
  if (r.equals !== undefined) parts.push(`exactly ${show(r.equals)}`);
  if (r.min !== undefined && r.max !== undefined) parts.push(`${kind || 'a value'} from ${show(r.min)} to ${show(r.max)}`);
  else if (r.min !== undefined) parts.push(`${kind || 'a value'} of at least ${show(r.min)}`);
  else if (r.max !== undefined) parts.push(`${kind || 'a value'} of at most ${show(r.max)}`);
  else if (kind) parts.push(kind);
  if (r.minLength !== undefined && r.maxLength !== undefined) parts.push(`${r.minLength}–${r.maxLength} characters`);
  else if (r.minLength !== undefined) parts.push(`at least ${r.minLength} characters`);
  else if (r.maxLength !== undefined) parts.push(`at most ${r.maxLength} characters`);
  if (r.pattern !== undefined) parts.push(`matching /${r.pattern}/`);
  if (r.oneOf) parts.push(`one of ${r.oneOf.map(show).join(', ')}`);
  if (r.noneOf) parts.push(`not ${r.noneOf.map(show).join(', ')}`);
  if (r.unique) parts.push('unique in the column');
  if (r.required) parts.push('required');
  return parts.join('; ');
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
/**
 * Yields until the page is idle (verdict decision 7: idle-time chunks): frames paint, and the browser's
 * own idle work — garbage collection after a large read — runs between slices instead of as one long pause.
 */
const yieldToPage = () => new Promise<void>((r) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(() => r(), { timeout: 100 }) : setTimeout(r, 0)));
