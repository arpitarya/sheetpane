// Column rules (W-27): the host's checks on what a user types, by column title.
// A core provider on the `validate` hook (events verdict decision 8): its errors
// are `author: 'host'`, they resolve themselves when the cell passes, and a rule
// never edits a cell — it only reports (decision 13). Findings are cached per cell
// and updated on commit and undo, so `validate` stays cheap on a 250,000-row sheet;
// the `load` phase checks every row in time-sliced chunks with its progress shown.
import { cellRef, colName, parseRef } from '@sheetpane/export';
import type { Cell } from '@sheetpane/import';
import { serialToParts } from '@sheetpane/import';
import type { ErrorDraft, Plugin } from '../plugins/types.js';
import type { Severity } from './types.js';

/** One column's rule, as plain JSON keyed by the column's title (verdict decision 5). */
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
  oneOf?: readonly (string | number | boolean)[];
  unique?: boolean;
  /** Replaces the generated message. */
  message?: string;
  severity?: Severity;
  onInvalid?: OnInvalid;
}
export type ColumnRules = Readonly<Record<string, ColumnRule>>;
export type OnInvalid = 'flag' | 'block';
export type RulePhase = 'input' | 'commit' | 'load';

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
  /** The row holding the titles, 1-based (decision 11: 1). */
  headerRow?: number;
}

/** A failure, before it becomes an error. */
export interface RuleOutcome { severity: Severity; message: string; expected: string; onInvalid: OnInvalid }

/** What the rules need from the store (kept narrow, so this module stays testable). */
export interface RulesHost {
  bookSheets(): readonly { name: string; rows: readonly (readonly Cell[])[] }[] | undefined;
  date1904(): boolean;
  value(sheet: string, ref: string): Cell;
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
const PATTERN_LIMIT = 10_000;
const SLICE_MS = 8;

const blank = (v: Cell, t: string) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (v === '' && t === '');
const NUMERIC = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$|^[-+]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/i;
const asNumber = (v: Cell): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && NUMERIC.test(v.trim())) return Number(v.trim().replace(/,/g, ''));
  return undefined;
};
const norm = (v: Cell) => String(v ?? '').trim().toLowerCase();
const show = (x: unknown) => (typeof x === 'string' ? x : String(x));

export class HostRules {
  private cfg: Required<Pick<ColumnRulesConfig, 'columns' | 'onInvalid' | 'headerRow'>> & { validate: ValidateFn | undefined } = { columns: {}, validate: undefined, onInvalid: 'flag', headerRow: 1 };
  private patterns = new Map<string, RegExp>();
  /** Per sheet: title (normalised) → column; the titles by column. */
  private headers = new Map<string, { byTitle: Map<string, number>; titles: string[] }>();
  private notes: ErrorDraft[] = [];
  /** Per sheet, per cell: the JSON rules' failure. */
  private json = new Map<string, Map<string, ErrorDraft>>();
  /** Per sheet, per cell: the function's latest result. */
  private fn = new Map<string, Map<string, ErrorDraft>>();
  /** Per sheet and column: normalised value → rows (for `unique`). */
  private uniq = new Map<string, Map<string, Set<number>>>();
  private inflight = new Map<string, AbortController>();
  private gen = 0;
  /** The load phase: rows checked of rows to check; undefined when idle. */
  progress: { done: number; total: number } | undefined;

  readonly provider: Plugin = { id: RULES_PROVIDER_ID, provides: ['validate'], validate: (sheet) => this.drafts(sheet) };

  constructor(private readonly host: RulesHost) {}

  get active(): boolean { return Object.keys(this.cfg.columns).length > 0 || !!this.cfg.validate; }
  get config(): Readonly<ColumnRulesConfig> { return this.cfg; }

  /** Rules may change after a workbook is loaded (decision 12): every row is checked again and stale host errors go. */
  configure(c: ColumnRulesConfig): void {
    const patterns = new Map<string, RegExp>();
    for (const [title, r] of Object.entries(c.columns ?? {})) {
      if (r.pattern === undefined) continue;
      try { patterns.set(title, new RegExp(r.pattern)); } catch (e) { throw new TypeError(`sheetpane: the "${title}" column rule's pattern is not a regular expression: ${(e as Error).message}`); }
    }
    this.patterns = patterns;
    this.cfg = { columns: { ...(c.columns ?? {}) }, validate: c.validate, onInvalid: c.onInvalid ?? 'flag', headerRow: Math.max(1, Math.floor(c.headerRow ?? 1)) };
    void this.loadPhase(true);
  }

  /** A new workbook: forget everything and check it (`load`). */
  reset(): void { void this.loadPhase(false); }

  // ── the validate provider ───────────────────────────────────────────────
  private drafts(sheet: string): ErrorDraft[] {
    if (!this.active) return [];
    const out = this.notes.filter((n) => n.sheet === sheet);
    const j = this.json.get(sheet), f = this.fn.get(sheet);
    if (j) out.push(...j.values());
    if (f) for (const [ref, d] of f) if (!j?.has(ref)) out.push(d); // one error per cell: the JSON rule's first
    return out;
  }

  // ── headers ─────────────────────────────────────────────────────────────
  private readHeaders(): void {
    this.headers.clear();
    this.notes = [];
    const sheets = this.host.bookSheets() ?? [];
    const hr = this.cfg.headerRow - 1;
    const found = new Set<string>();
    for (const s of sheets) {
      const titles: string[] = [];
      const byTitle = new Map<string, number>();
      const width = s.rows[hr]?.length ?? 0;
      for (let c = 0; c < width; c++) {
        const t = this.host.text(s.name, cellRef(hr, c)).trim();
        titles[c] = t;
        if (!t) continue;
        const k = t.toLowerCase();
        if (byTitle.has(k)) {
          if (this.ruleFor(t)) this.notes.push(this.note(s.name, cellRef(hr, c), t, `Two columns are titled “${t}” — the rules check column ${colName(byTitle.get(k)!)}, the first`));
          continue;
        }
        byTitle.set(k, c);
        found.add(k);
      }
      this.headers.set(s.name, { byTitle, titles });
    }
    const first = sheets[0];
    if (first) for (const title of Object.keys(this.cfg.columns)) {
      if (!found.has(title.trim().toLowerCase())) this.notes.push(this.note(first.name, cellRef(hr, 0), title, `No column is titled “${title}” — its rule is not checked`));
    }
  }

  private note(sheet: string, range: string, title: string, message: string): ErrorDraft {
    return { sheet, range, type: RULE_TYPE, severity: 'note', found: title, expected: `a column titled “${title}” in row ${this.cfg.headerRow}`, message, author: 'host' };
  }

  /** The rule for a title (matched trimmed and case-insensitive) and its key in `columns`. */
  private ruleFor(header: string): { title: string; rule: ColumnRule } | undefined {
    const h = header.trim(), k = h.toLowerCase();
    if (!k) return undefined;
    const all = Object.entries(this.cfg.columns);
    const hit = all.find(([t]) => t.trim() === h) ?? all.find(([t]) => t.trim().toLowerCase() === k); // an exact title wins
    return hit && { title: hit[0], rule: hit[1] };
  }

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
  /** The JSON rule's first failing constraint for a value, or null. */
  private checkJson(sheet: string, row: number, col: number, value: Cell, text: string): RuleOutcome | null {
    const header = this.headerAt(sheet, col);
    const hit = header ? this.ruleFor(header) : undefined;
    if (!hit) return null;
    const { title, rule } = hit;
    const fail = (what: string, name: string): RuleOutcome => ({
      severity: rule.severity ?? 'error',
      message: rule.message ?? `${header}: ${what} (${name})`, // the column's title as the file writes it
      expected: describeRule(rule),
      onInvalid: rule.onInvalid ?? this.cfg.onInvalid,
    });
    if (blank(value, text)) return rule.required ? fail('a value is required', 'required') : null;
    const t = typeof value === 'string' ? value.trim() : text.trim();
    const n = asNumber(value);
    switch (rule.type) {
      case 'number': if (n === undefined) return fail('must be a number', 'type: number'); break;
      case 'integer': if (n === undefined || !Number.isInteger(n)) return fail('must be a whole number', 'type: integer'); break;
      case 'date': if (this.dateMs(value, text) === undefined) return fail('must be a date', 'type: date'); break;
      case 'boolean': if (typeof value !== 'boolean' && !/^(true|false)$/i.test(t)) return fail('must be TRUE or FALSE', 'type: boolean'); break;
      default: break;
    }
    if (rule.min !== undefined || rule.max !== undefined) {
      const asDate = rule.type === 'date';
      const v = asDate ? this.dateMs(value, text) : n;
      const lo = rule.min === undefined ? undefined : asDate ? this.boundMs(rule.min) : Number(rule.min);
      const hi = rule.max === undefined ? undefined : asDate ? this.boundMs(rule.max) : Number(rule.max);
      if (v === undefined) { if (rule.type === undefined) return fail(`must be a ${asDate ? 'date' : 'number'}`, rule.min !== undefined ? 'min' : 'max'); }
      else {
        if (lo !== undefined && v < lo) return fail(`must be at least ${show(rule.min)}`, 'min');
        if (hi !== undefined && v > hi) return fail(`must be at most ${show(rule.max)}`, 'max');
      }
    }
    const len = (typeof value === 'string' ? value : text).length;
    if (rule.minLength !== undefined && len < rule.minLength) return fail(`must be at least ${rule.minLength} characters`, 'minLength');
    if (rule.maxLength !== undefined && len > rule.maxLength) return fail(`must be at most ${rule.maxLength} characters`, 'maxLength');
    const re = this.patterns.get(title);
    if (re && len <= PATTERN_LIMIT) { re.lastIndex = 0; if (!re.test(typeof value === 'string' ? value : text)) return fail('does not match the expected format', 'pattern'); }
    if (rule.oneOf && !rule.oneOf.some((o) => (typeof o === 'number' ? n === o : typeof o === 'boolean' ? (typeof value === 'boolean' ? value === o : t.toLowerCase() === String(o)) : o.trim().toLowerCase() === t.toLowerCase()))) {
      return fail(`must be one of ${rule.oneOf.map(show).join(', ')}`, 'oneOf');
    }
    if (rule.unique) {
      const rows = this.uniq.get(`${sheet}|${col}`)?.get(norm(t));
      if (rows && [...rows].some((r) => r !== row)) return fail(`“${t}” appears more than once`, 'unique');
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

  private toDraft(sheet: string, ref: string, text: string, o: RuleOutcome | RuleResult): ErrorDraft {
    return { sheet, range: ref, type: RULE_TYPE, severity: o.severity ?? 'error', found: text === '' ? '(blank)' : text, expected: o.expected ?? '', message: o.message, author: 'host' };
  }

  /** Is this cell a data cell in a titled column of a sheet with rules? */
  private inScope(sheet: string, row: number, col: number): boolean {
    return row > this.cfg.headerRow - 1 && !!this.headers.get(sheet)?.titles[col];
  }

  private setJson(sheet: string, row: number, col: number): void {
    const ref = cellRef(row, col);
    const text = this.host.text(sheet, ref);
    const o = this.checkJson(sheet, row, col, this.host.value(sheet, ref), text);
    let m = this.json.get(sheet);
    if (o) { if (!m) this.json.set(sheet, (m = new Map())); m.set(ref, this.toDraft(sheet, ref, text, o)); } else m?.delete(ref);
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
    try { r = f(this.context(phase, sheet, row, col, value), ac.signal); } catch (e) { console.error('sheetpane: the column-rules validate function threw', e); return undefined; }
    if (r && typeof (r as Promise<unknown>).then === 'function') {
      return (r as Promise<RuleResult | null | undefined>).then(
        (x) => { if (land(x) && phase !== 'load') this.host.revalidate([sheet]); },
        (e: unknown) => { if (!ac.signal.aborted) console.error('sheetpane: the column-rules validate function failed', e); },
      );
    }
    land(r as RuleResult | null | undefined);
    return undefined;
  }

  // ── phases ──────────────────────────────────────────────────────────────
  /** `load` (decision 7): every row of every sheet with titles, in time slices; progress is shown. */
  private async loadPhase(rulesChanged: boolean): Promise<void> {
    const gen = ++this.gen;
    for (const ac of this.inflight.values()) ac.abort();
    this.inflight.clear();
    this.json.clear(); this.fn.clear(); this.uniq.clear();
    const sheets = this.host.bookSheets();
    if (!sheets || !this.active) {
      this.notes = []; this.headers.clear(); this.progress = undefined;
      if (rulesChanged) { this.host.prune(RULES_PROVIDER_ID, new Set()); this.host.revalidate((sheets ?? []).map((s) => s.name)); }
      return;
    }
    this.readHeaders();
    const first = this.cfg.headerRow; // zero-based index of the first data row
    const total = sheets.reduce((n, s) => n + Math.max(0, s.rows.length - first), 0);
    this.progress = { done: 0, total };
    this.host.progress();
    // unique: index every titled column with a unique rule before checking
    for (const s of sheets) {
      const h = this.headers.get(s.name)!;
      for (const [, c] of h.byTitle) {
        if (!this.ruleFor(h.titles[c]!)?.rule.unique) continue;
        const idx = new Map<string, Set<number>>();
        for (let r = first; r < s.rows.length; r++) { const v = norm(this.host.value(s.name, cellRef(r, c))); if (!v) continue; let set = idx.get(v); if (!set) idx.set(v, (set = new Set())); set.add(r); }
        this.uniq.set(`${s.name}|${c}`, idx);
      }
    }
    let t0 = now();
    let lastShown = t0;
    for (const s of sheets) {
      const h = this.headers.get(s.name)!;
      const ruled = [...h.byTitle.values()].filter((c) => this.ruleFor(h.titles[c]!));
      const titled = this.cfg.validate ? [...h.byTitle.values()] : [];
      if (!ruled.length && !titled.length) { this.progress.done += Math.max(0, s.rows.length - first); continue; }
      for (let r = first; r < s.rows.length; r++) {
        for (const c of ruled) this.setJson(s.name, r, c);
        const pending: Promise<void>[] = [];
        for (const c of titled) { const p = this.callFn('load', s.name, r, c, gen); if (p) pending.push(p); }
        if (pending.length) await Promise.all(pending);
        if (gen !== this.gen) return;
        this.progress.done++;
        if (now() - t0 > SLICE_MS) {
          if (now() - lastShown > 100) { this.host.progress(); lastShown = now(); }
          await yieldToPage();
          if (gen !== this.gen) return; // a newer workbook or newer rules
          t0 = now();
        }
      }
    }
    this.progress = undefined;
    this.host.progress();
    if (rulesChanged) {
      const produced = new Set<string>();
      for (const s of sheets) for (const d of this.drafts(s.name)) produced.add(`${RULES_PROVIDER_ID}|${d.sheet}|${d.range}|${d.type}`);
      this.host.prune(RULES_PROVIDER_ID, produced);
    }
    this.host.revalidate(sheets.map((s) => s.name));
  }

  /** `commit` (decision 7): cells changed by an edit, a paste or undo. Returns whether findings changed synchronously. */
  touch(cells: readonly { sheet: string; ref: string }[]): void {
    if (!this.active || !this.host.bookSheets()) return;
    const hr = this.cfg.headerRow - 1;
    if (cells.some((c) => parseRef(c.ref)?.row === hr)) { void this.loadPhase(true); return; } // a title changed
    const rows = new Set<string>();
    for (const c of cells) {
      const p = parseRef(c.ref);
      if (!p || !this.inScope(c.sheet, p.row, p.col)) continue;
      const header = this.headerAt(c.sheet, p.col);
      if (header && this.ruleFor(header)?.rule.unique) this.reindexUnique(c.sheet, p.row, p.col);
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
    for (const [v, set] of idx) if (set.delete(row)) { for (const r of set) affected.add(r); if (!set.size) idx.delete(v); }
    const v = norm(this.host.value(sheet, cellRef(row, col)));
    if (v) { let set = idx.get(v); if (!set) idx.set(v, (set = new Set())); set.add(row); for (const r of set) affected.add(r); }
    for (const r of affected) this.setJson(sheet, r, col);
  }

  /** `input` (decision 7): the draft checked as typed — nothing is stored. */
  async checkInput(sheet: string, ref: string, value: Cell, text: string, signal: AbortSignal): Promise<RuleOutcome | null> {
    if (!this.active) return null;
    const p = parseRef(ref);
    if (!p || !this.inScope(sheet, p.row, p.col)) return null;
    const j = this.checkJson(sheet, p.row, p.col, value, text);
    if (j) return j;
    const f = this.cfg.validate;
    if (!f) return null;
    try {
      const r = await f(this.context('input', sheet, p.row, p.col, value), signal);
      return r && !signal.aborted ? { severity: r.severity ?? 'error', message: r.message, expected: r.expected ?? '', onInvalid: this.cfg.onInvalid } : null;
    } catch { return null; }
  }

  /** The `block` check at commit (decision 9): a failing rule set to block refuses the value. Async results can only flag. */
  blocked(sheet: string, ref: string, value: Cell, text: string): RuleOutcome | null {
    if (!this.active) return null;
    const p = parseRef(ref);
    if (!p || !this.inScope(sheet, p.row, p.col)) return null;
    const j = this.checkJson(sheet, p.row, p.col, value, text);
    if (j) return j.onInvalid === 'block' ? j : null;
    const f = this.cfg.validate;
    if (!f || this.cfg.onInvalid !== 'block') return null;
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

/** A rule in words, for an error's `expected`: "a whole number from 18 to 99", "one of Active, Inactive". */
export function describeRule(r: ColumnRule): string {
  const parts: string[] = [];
  const kind = r.type === 'integer' ? 'a whole number' : r.type === 'number' ? 'a number' : r.type === 'date' ? 'a date' : r.type === 'boolean' ? 'TRUE or FALSE' : r.type === 'text' ? 'text' : '';
  if (r.min !== undefined && r.max !== undefined) parts.push(`${kind || 'a value'} from ${show(r.min)} to ${show(r.max)}`);
  else if (r.min !== undefined) parts.push(`${kind || 'a value'} of at least ${show(r.min)}`);
  else if (r.max !== undefined) parts.push(`${kind || 'a value'} of at most ${show(r.max)}`);
  else if (kind) parts.push(kind);
  if (r.minLength !== undefined && r.maxLength !== undefined) parts.push(`${r.minLength}–${r.maxLength} characters`);
  else if (r.minLength !== undefined) parts.push(`at least ${r.minLength} characters`);
  else if (r.maxLength !== undefined) parts.push(`at most ${r.maxLength} characters`);
  if (r.pattern !== undefined) parts.push(`matching /${r.pattern}/`);
  if (r.oneOf) parts.push(`one of ${r.oneOf.map(show).join(', ')}`);
  if (r.unique) parts.push('unique in the column');
  if (r.required) parts.push('required');
  return parts.join('; ');
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const yieldToPage = () => new Promise<void>((r) => setTimeout(r, 0));
