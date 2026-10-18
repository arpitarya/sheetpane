// The in-memory workbook one pane shares (contract verdict decisions 1–9; SR-LAW-6,
// SR-LAW-7, SR-LAW-9). Framework-free: subscribe / getSnapshot, and mutators.
// Every mutation goes through commit(): undo (W-23), derive and validate
// (W-14), "matches suggestion" (B-022) and one notification.
import { cellRef, parseRange, parseRef, patchXlsx, rangesIntersect, toCsv, type Cell, type Change, type ExportPatchHook } from '@sheetpane/export';
import { formatCode, general, ImportError, read, subsetCode, type ImportedSheet, type ImportedWorkbook } from '@sheetpane/import';
import { checkPlugins, mergeDecorations } from '../plugins/host.js';
import type { CellContext, DeriveInput, DerivedChange, ErrorDraft, Plugin, PluginContext, StyleSubset } from '../plugins/types.js';
import type { ChangeEntry, ChangeKind, Composing, DerivedCell, LoadState, Mode, Selection, SheetpaneError, Snapshot, Source } from './types.js';

export interface StoreOptions {
  plugins?: readonly Plugin[];
}

/** Who made a mutation — the element that dispatches its DOM event (one event per action, on the element where it happened). */
export type Origin = object | undefined;

export type StoreEvent =
  | { type: 'load'; origin: Origin }
  | { type: 'change'; origin: Origin; sheet: string; ref: string; kind: ChangeKind; was: unknown; now: unknown }
  | { type: 'errors'; origin: Origin }
  | { type: 'select'; origin: Origin; sheet: string; ref: string }
  | { type: 'mode'; origin: Origin; mode: Mode }
  | { type: 'history'; origin: Origin; reason: 'undo' | 'redo' | 'cleared' };

interface Undoable { changes: ReadonlyMap<string, ChangeEntry>; errors: readonly SheetpaneError[] }
interface HistoryEntry { before: Undoable; after: Undoable; keys: string[]; coalesce: string | undefined }

export const HISTORY_CAP = 500;
const BLANK = '(blank)';

export const key = (sheet: string, ref: string) => `${sheet}!${ref}`;
export function splitKey(k: string): { sheet: string; ref: string } {
  const i = k.lastIndexOf('!');
  return { sheet: k.slice(0, i), ref: k.slice(i + 1) };
}

/** A value typed into the cell bar, as the cell will store it. */
export function parseInput(text: string, original: Cell, source: 'xlsx' | 'csv'): Cell {
  if (text === '') return null;
  if (source === 'csv') return text;
  if (typeof original === 'boolean' && /^(true|false)$/i.test(text)) return /^true$/i.test(text);
  if (typeof original === 'number' || original === null) {
    const t = text.trim().replace(/(\d),(?=\d{3}\b)/g, '$1');
    if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return Number(t);
  }
  return text;
}

const same = (a: unknown, b: unknown) => a === b || (typeof a === 'number' && typeof b === 'number' && Object.is(a, b)) || JSON.stringify(a) === JSON.stringify(b);

export class WorkbookStore {
  readonly plugins: readonly Plugin[];
  private snap: Snapshot;
  private readonly listeners = new Set<() => void>();
  private readonly eventListeners = new Set<(e: StoreEvent) => void>();
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private nextError = 1;
  private loadSeq = 0;
  private readonly textCache = new Map<string, string>();
  /** Plugin errors by `plugin|sheet|range|type` → error id. */
  private readonly pluginErrors = new Map<string, string>();
  private errorsViews = 0;

  constructor(o: StoreOptions = {}) {
    this.plugins = checkPlugins(o.plugins ?? []);
    this.snap = {
      load: { status: 'empty' }, source: undefined, book: undefined,
      changes: new Map(), derived: new Map(), errors: [],
      selection: { sheet: '', ref: 'A1' }, mode: 'view', composing: null,
      canUndo: false, canRedo: false, version: 0,
    };
  }

  // ── subscription (useSyncExternalStore-shaped) ───────────────────────────
  subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  getSnapshot = (): Snapshot => this.snap;
  /** Store events, for the elements to turn into DOM events. */
  on(fn: (e: StoreEvent) => void): () => void { this.eventListeners.add(fn); return () => this.eventListeners.delete(fn); }

  private set(patch: Partial<Snapshot>, events: StoreEvent[] = []): void {
    this.snap = { ...this.snap, ...patch, canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0, version: this.snap.version + 1 };
    for (const fn of [...this.listeners]) fn();
    for (const e of events) for (const fn of [...this.eventListeners]) fn(e);
  }

  get pluginIds(): string[] { return this.plugins.map((p) => p.id); }

  /** `<sheetpane-errors>` elements connected to this pane: the store decides which form opens (contract decision 4). */
  attachErrorsView(): () => void { this.errorsViews++; this.set({}); return () => { this.errorsViews--; this.set({}); }; }
  get hasErrorsView(): boolean { return this.errorsViews > 0; }

  // ── loading ──────────────────────────────────────────────────────────────
  /** Reads a file into the pane. Changes, errors and history start empty; the host restores a review with setErrors(). */
  async load(data: Uint8Array | ArrayBuffer | Blob, name: string, origin?: Origin): Promise<void> {
    const seq = ++this.loadSeq;
    this.set({ load: { status: 'loading', name } });
    const bytes = data instanceof Uint8Array ? data : data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(await data.arrayBuffer());
    const t0 = performance.now();
    let book: ImportedWorkbook;
    try {
      book = await read(bytes, { name });
    } catch (e) {
      if (seq !== this.loadSeq) return;
      const err = e instanceof ImportError ? e : new ImportError('corrupt', e instanceof Error ? e.message : String(e));
      const load: LoadState = { status: 'error', code: err.code, message: err.message, name };
      if (err.detail) load.detail = err.detail;
      this.set({ load, book: undefined, source: undefined }, [{ type: 'load', origin }]);
      return;
    }
    if (seq !== this.loadSeq) return;
    const source: Source = { name, kind: book.source, size: bytes.length, bytes, readMs: Math.round(performance.now() - t0) };
    this.undoStack = []; this.redoStack = []; this.textCache.clear(); this.pluginErrors.clear();
    const first = book.sheets[book.activeSheet] ?? book.sheets[0]!;
    this.set({ load: { status: 'ready' }, source, book, changes: new Map(), derived: new Map(), errors: [], composing: null, selection: { sheet: first.name, ref: 'A1' } }, [{ type: 'load', origin }]);
    this.runValidate(book.sheets.map((s) => s.name), origin);
    void this.runDerive({ kind: 'load' });
  }

  /** A source that could not even be fetched (a bad URL): the pane shows the refusal state. */
  failLoad(name: string, message: string, origin?: Origin): void {
    this.loadSeq++;
    this.set({ load: { status: 'error', code: 'unreadable', message, name }, book: undefined, source: undefined }, [{ type: 'load', origin }]);
  }

  // ── reading ──────────────────────────────────────────────────────────────
  get book(): ImportedWorkbook | undefined { return this.snap.book; }
  sheet(name: string): ImportedSheet | undefined { return this.snap.book?.sheets.find((s) => s.name === name); }

  /** The uploaded value and display text. */
  original(sheet: string, ref: string): { value: Cell; text: string } {
    const s = this.sheet(sheet), p = parseRef(ref);
    if (!s || !p) return { value: null, text: '' };
    return { value: s.rows[p.row]?.[p.col] ?? null, text: s.text[p.row]?.[p.col] ?? '' };
  }

  changeOf(sheet: string, ref: string): ChangeEntry | undefined { return this.snap.changes.get(key(sheet, ref)); }

  /** The current value: a user change, else a derived value, else the upload. */
  value(sheet: string, ref: string): Cell {
    const k = key(sheet, ref), c = this.snap.changes.get(k);
    if (c && (c.kind === 'value' || c.kind === 'formula')) return c.now as Cell;
    const d = this.snap.derived.get(k);
    return d ? d.value : this.original(sheet, ref).value;
  }

  /** The current display text. */
  text(sheet: string, ref: string): string {
    const k = key(sheet, ref);
    const hit = this.textCache.get(k);
    if (hit !== undefined) return hit;
    const c = this.snap.changes.get(k);
    let t: string;
    if (c && (c.kind === 'value' || c.kind === 'formula')) t = this.format(sheet, ref, c.now as Cell);
    else {
      const d = this.snap.derived.get(k);
      if (d) t = d.text;
      else {
        const o = this.original(sheet, ref);
        t = typeof o.value === 'number' && this.formatter ? this.format(sheet, ref, o.value) : o.text;
      }
    }
    this.textCache.set(k, t);
    return t;
  }

  private get formatter(): Plugin | undefined { return this.plugins.find((p) => p.provides.includes('format')); }

  /** Formats a value for one cell: the `format` plugin, else the core number-format subset. */
  format(sheet: string, ref: string, v: Cell): string {
    if (v === null) return '';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'string') return v;
    const f = this.formatter;
    if (f?.format) {
      const ctx = this.cellContext(sheet, ref, v);
      const out = ctx && f.format(ctx);
      if (out !== undefined) return out;
    }
    const book = this.snap.book, s = this.sheet(sheet);
    const si = s?.styleIndex[ref];
    const xf = book && si !== undefined ? book.styles.cellXfs[si] : undefined;
    const code = xf ? subsetCode(xf.numFmtId, book!.styles.numFmts) : 'General';
    return code === undefined || code === 'General' ? general(v) : formatCode(v, code, book?.date1904 ?? false);
  }

  cellContext(sheet: string, ref: string, value?: Cell): CellContext | undefined {
    const book = this.snap.book, s = this.sheet(sheet), p = parseRef(ref);
    if (!book || !s || !p) return undefined;
    return { store: this, book, sheet: s, ref, row: p.row, col: p.col, value: value === undefined ? this.value(sheet, ref) : value, styleIndex: s.styleIndex[ref] };
  }

  /** The merged `decorate` result for a cell; `{}` with no decorate plugin. */
  decorate(sheet: string, ref: string): StyleSubset {
    const deco = this.plugins.filter((p) => p.provides.includes('decorate'));
    if (!deco.length) return {};
    const ctx = this.cellContext(sheet, ref);
    if (!ctx) return {};
    return mergeDecorations(deco.map((p) => ({ id: p.id, style: p.decorate!(ctx) })));
  }

  pluginContext(): PluginContext {
    return { store: this, book: this.snap.book!, snapshot: () => this.snap };
  }

  /** How many cells a user changed (derived cells are not changes). */
  get changeCount(): number { return this.snap.changes.size; }

  // ── the one commit path ──────────────────────────────────────────────────
  private commit(next: Undoable, keys: string[], origin: Origin, events: StoreEvent[], o: { coalesce?: string; record?: boolean; extra?: Partial<Snapshot> } = {}): void {
    const before: Undoable = { changes: this.snap.changes, errors: this.snap.errors };
    for (const k of keys) this.textCache.delete(k);
    const errors = this.withMatches(next.errors, next.changes);
    if (o.record !== false) {
      const last = this.undoStack[this.undoStack.length - 1];
      if (o.coalesce && last && last.coalesce === o.coalesce) {
        last.after = { changes: next.changes, errors };
      } else {
        this.undoStack.push({ before, after: { changes: next.changes, errors }, keys, coalesce: o.coalesce });
        if (this.undoStack.length > HISTORY_CAP) this.undoStack.shift();
      }
      this.redoStack = [];
    }
    this.set({ ...o.extra, changes: next.changes, errors }, events);
    const sheets = [...new Set(keys.map((k) => splitKey(k).sheet))];
    if (sheets.length) {
      this.runValidate(sheets, origin);
      const cells = keys.map(splitKey).filter((c) => !c.ref.startsWith('#')).map((c) => ({ ...c, value: this.value(c.sheet, c.ref) }));
      if (cells.length) void this.runDerive({ kind: 'change', cells });
    }
  }

  /** Ends typing in one cell: the next keystroke there starts a new undo entry. */
  endCoalesce(): void {
    const last = this.undoStack[this.undoStack.length - 1];
    if (last) last.coalesce = undefined;
  }

  // ── cell changes ─────────────────────────────────────────────────────────
  /**
   * Sets a cell. Text is parsed as the cell would store it (a number stays a number).
   * Typing the uploaded value back removes the change. Returns false when nothing changed.
   */
  setCell(sheet: string, ref: string, input: string | Cell, o: { origin?: Origin; coalesce?: boolean; parse?: boolean } = {}): boolean {
    const book = this.snap.book;
    const p = parseRef(ref);
    if (!book || !p || !this.sheet(sheet)) return false;
    const a1 = cellRef(p.row, p.col);
    const orig = this.original(sheet, a1);
    const now: Cell = typeof input === 'string' && o.parse !== false ? parseInput(input, orig.value, book.source) : (input as Cell);
    const k = key(sheet, a1);
    const prev = this.snap.changes.get(k);
    const backToOriginal = same(now, orig.value) || (typeof input === 'string' && input === orig.text && orig.text !== '');
    if (!prev && backToOriginal) return false;
    if (prev && same(prev.now, now)) return false;
    const changes = new Map(this.snap.changes);
    if (backToOriginal) changes.delete(k);
    else changes.set(k, { kind: 'value', was: orig.value, now });
    const commitOpts: { coalesce?: string } = {};
    if (o.coalesce) commitOpts.coalesce = `type:${k}`;
    this.commit({ changes, errors: this.snap.errors }, [k], o.origin, [{ type: 'change', origin: o.origin, sheet, ref: a1, kind: 'value', was: prev ? prev.now : orig.value, now: backToOriginal ? orig.value : now }], commitOpts);
    return true;
  }

  /** Sets any change-map entry a plugin owns (`style`, `numFmt`, `merge`, `freeze`). `now === undefined` removes it. */
  setChange(sheet: string, ref: string, kind: ChangeKind, now: unknown, was: unknown, origin?: Origin): void {
    const k = key(sheet, ref);
    const changes = new Map(this.snap.changes);
    const prev = changes.get(k);
    if (now === undefined || same(now, was)) changes.delete(k);
    else changes.set(k, { kind, was: prev ? prev.was : was, now });
    this.commit({ changes, errors: this.snap.errors }, [k], origin, [{ type: 'change', origin, sheet, ref, kind, was: prev ? prev.now : was, now: now ?? was }]);
  }

  /** Reverts one cell (or any change-map key) to the upload; undoable. */
  revert(sheet: string, ref: string, origin?: Origin): void {
    const k = key(sheet, ref), prev = this.snap.changes.get(k);
    if (!prev) return;
    const changes = new Map(this.snap.changes);
    changes.delete(k);
    this.commit({ changes, errors: this.snap.errors }, [k], origin, [{ type: 'change', origin, sheet, ref, kind: prev.kind, was: prev.now, now: prev.was }]);
  }

  // ── freeze panes (W-24): view state, a change of kind `freeze` ─────────
  freeze(sheet: string): { rows: number; cols: number } {
    const c = this.snap.changes.get(key(sheet, '#freeze'));
    return (c?.now as { rows: number; cols: number } | undefined) ?? this.sheet(sheet)?.freeze ?? { rows: 0, cols: 0 };
  }
  setFreeze(sheet: string, f: { rows: number; cols: number }, origin?: Origin): void {
    const s = this.sheet(sheet);
    if (!s) return;
    this.setChange(sheet, '#freeze', 'freeze', { rows: Math.max(0, f.rows), cols: Math.max(0, f.cols) }, s.freeze, origin);
  }

  // ── selection, mode, composing ───────────────────────────────────────────
  select(sel: Selection, origin?: Origin): void {
    const s = this.snap.selection;
    if (s.sheet === sel.sheet && s.ref === sel.ref && s.range === sel.range) return;
    const next: Selection = { sheet: sel.sheet, ref: sel.ref };
    if (sel.range) next.range = sel.range;
    const drop = !!this.snap.composing && (this.snap.composing.sheet !== sel.sheet || this.snap.composing.ref !== sel.ref);
    this.set(drop ? { selection: next, composing: null } : { selection: next }, [{ type: 'select', origin, sheet: sel.sheet, ref: sel.ref }]);
  }
  setMode(mode: Mode, origin?: Origin): void {
    if (this.snap.mode === mode) return;
    this.set({ mode, composing: mode === 'view' ? null : this.snap.composing }, [{ type: 'mode', origin, mode }]);
  }
  compose(c: Composing | null): void { this.set({ composing: c }); }

  // ── errors ───────────────────────────────────────────────────────────────
  private newId(): string { return `ERR-${String(this.nextError++).padStart(4, '0')}`; }

  /** Recomputes `matchesExpected` (B-022: it marks, never resolves). */
  private withMatches(errors: readonly SheetpaneError[], changes: ReadonlyMap<string, ChangeEntry>): SheetpaneError[] {
    return errors.map((e) => {
      const r = parseRange(e.range);
      let m = false;
      if (r && r.top === r.bottom && r.left === r.right && e.expected.trim() !== '') {
        const ref = cellRef(r.top, r.left);
        const c = changes.get(key(e.sheet, ref));
        const t = c && (c.kind === 'value' || c.kind === 'formula') ? this.format(e.sheet, ref, c.now as Cell) : this.text(e.sheet, ref);
        m = t.trim() === e.expected.trim();
      }
      return m === e.matchesExpected ? e : { ...e, matchesExpected: m };
    });
  }

  /** The uploaded display text of a range's first cell, as `found` freezes it. */
  foundFor(sheet: string, range: string): string {
    const r = parseRange(range);
    if (!r) return BLANK;
    if (r.top === r.bottom && r.left !== r.right) return `row ${r.top + 1}`;
    return this.original(sheet, cellRef(r.top, r.left)).text || BLANK;
  }

  /** A saved error whose cell no longer holds `found` (contract decision 8). */
  isStale(e: SheetpaneError): boolean {
    const r = parseRange(e.range);
    if (!r || e.author === 'workbook' || e.author === 'file' || !this.sheet(e.sheet)) return false;
    if (r.left !== r.right) return false;
    return (this.original(e.sheet, cellRef(r.top, r.left)).text || BLANK) !== e.found;
  }

  addError(d: { sheet: string; range: string; type: string; severity: SheetpaneError['severity']; expected?: string; message?: string; cellChanged?: boolean; author?: string }, origin?: Origin): SheetpaneError {
    const e: SheetpaneError = {
      v: 1, id: this.newId(), sheet: d.sheet, range: d.range, type: d.type, severity: d.severity,
      found: this.foundFor(d.sheet, d.range), expected: d.expected ?? '', message: d.message ?? '',
      cellChanged: !!d.cellChanged, status: 'open', matchesExpected: false, author: d.author ?? '', createdAt: new Date().toISOString(),
    };
    let changes = this.snap.changes;
    const keys: string[] = [];
    const events: StoreEvent[] = [{ type: 'errors', origin }];
    const r = parseRange(d.range);
    if (d.cellChanged && r && e.expected !== '') {
      const ref = cellRef(r.top, r.left), k = key(d.sheet, ref), orig = this.original(d.sheet, ref);
      const now = parseInput(e.expected, orig.value, this.snap.book?.source ?? 'xlsx');
      const m = new Map(changes);
      if (same(now, orig.value)) m.delete(k); else m.set(k, { kind: 'value', was: orig.value, now });
      changes = m; keys.push(k);
      events.push({ type: 'change', origin, sheet: d.sheet, ref, kind: 'value', was: this.value(d.sheet, ref), now });
    }
    this.commit({ changes, errors: [...this.snap.errors, e] }, keys, origin, events, { extra: { composing: null } });
    return this.snap.errors.find((x) => x.id === e.id)!;
  }

  updateError(id: string, patch: Partial<Pick<SheetpaneError, 'status' | 'severity' | 'expected' | 'message' | 'type'>>, origin?: Origin): void {
    if (!this.snap.errors.some((e) => e.id === id)) return;
    this.commit({ changes: this.snap.changes, errors: this.snap.errors.map((e) => (e.id === id ? { ...e, ...patch } : e)) }, [], origin, [{ type: 'errors', origin }]);
  }

  /** Deletes an error; a cell it changed keeps the change (contract decision 6). */
  deleteError(id: string, origin?: Origin): void {
    if (!this.snap.errors.some((e) => e.id === id)) return;
    this.commit({ changes: this.snap.changes, errors: this.snap.errors.filter((e) => e.id !== id) }, [], origin, [{ type: 'errors', origin }]);
  }

  getErrors(): SheetpaneError[] { return this.snap.errors.map((e) => ({ ...e })); }

  /** The host restores a saved review. Not a user action: the undo stack is cleared (W-23). */
  setErrors(list: readonly SheetpaneError[], origin?: Origin): void {
    const errors = list.map((e) => ({ ...e, v: 1 as const, matchesExpected: false }));
    for (const e of errors) { const n = /^ERR-(\d+)$/.exec(e.id); if (n) this.nextError = Math.max(this.nextError, Number(n[1]) + 1); }
    this.undoStack = []; this.redoStack = [];
    this.set({ errors: this.withMatches(errors, this.snap.changes) }, [{ type: 'errors', origin }, { type: 'history', origin, reason: 'cleared' }]);
  }

  // ── undo / redo (W-23): one stack per pane ──────────────────────────────
  undo(origin?: Origin): void { this.travel(this.undoStack, this.redoStack, 'before', origin, 'undo'); }
  redo(origin?: Origin): void { this.travel(this.redoStack, this.undoStack, 'after', origin, 'redo'); }

  private travel(from: HistoryEntry[], to: HistoryEntry[], side: 'before' | 'after', origin: Origin, reason: 'undo' | 'redo'): void {
    const h = from.pop();
    if (!h) return;
    h.coalesce = undefined;
    to.push(h);
    const state = h[side];
    const events: StoreEvent[] = [{ type: 'history', origin, reason }];
    const cur = this.snap.changes;
    for (const k of new Set([...h.keys, ...[...cur.keys()].filter((x) => cur.get(x) !== state.changes.get(x))])) {
      this.textCache.delete(k);
      const { sheet, ref } = splitKey(k);
      const a = cur.get(k), b = state.changes.get(k);
      if (a !== b) events.push({ type: 'change', origin, sheet, ref, kind: (b ?? a)!.kind, was: a ? a.now : b!.was, now: b ? b.now : a!.was });
    }
    if (this.snap.errors !== state.errors) events.push({ type: 'errors', origin });
    this.set({ changes: state.changes, errors: this.withMatches(state.errors, state.changes) }, events);
    const sheets = [...new Set(h.keys.map((k) => splitKey(k).sheet))];
    if (sheets.length) {
      this.runValidate(sheets, origin);
      const cells = h.keys.map(splitKey).filter((c) => !c.ref.startsWith('#')).map((c) => ({ ...c, value: this.value(c.sheet, c.ref) }));
      if (cells.length) void this.runDerive({ kind: 'change', cells });
    }
  }

  // ── plugin hooks: derive, validate ───────────────────────────────────────
  private async runDerive(input: DeriveInput): Promise<void> {
    const p = this.plugins.find((x) => x.provides.includes('derive'));
    if (!p?.derive || !this.snap.book) return;
    const load = this.loadSeq;
    let out: DerivedChange[];
    try { out = await p.derive(input, this.pluginContext()); } catch (e) { console.error(`sheetpane: plugin "${p.id}" derive failed`, e); return; }
    if (load !== this.loadSeq) return; // a newer workbook replaced this one
    const derived = new Map(input.kind === 'load' ? [] : this.snap.derived);
    for (const d of out) {
      const k = key(d.sheet, d.ref);
      derived.set(k, { value: d.value, text: d.text } satisfies DerivedCell);
      this.textCache.delete(k);
    }
    this.set({ derived, errors: this.withMatches(this.snap.errors, this.snap.changes) });
  }

  private runValidate(sheets: string[], origin: Origin): void {
    const vs = this.plugins.filter((p) => p.provides.includes('validate'));
    if (!vs.length || !this.snap.book) return;
    let errors = [...this.snap.errors];
    let changed = false;
    for (const p of vs) {
      for (const sheet of sheets) {
        let drafts: ErrorDraft[];
        try { drafts = p.validate!(sheet, this.pluginContext()); } catch (e) { console.error(`sheetpane: plugin "${p.id}" validate failed`, e); continue; }
        const seen = new Set<string>();
        for (const d of drafts) {
          const k = `${p.id}|${d.sheet}|${d.range}|${d.type}`;
          seen.add(k);
          const id = this.pluginErrors.get(k);
          const at = id ? errors.findIndex((e) => e.id === id) : -1;
          if (at < 0) {
            const e: SheetpaneError = { v: 1, id: this.newId(), sheet: d.sheet, range: d.range, type: d.type, severity: d.severity, found: d.found, expected: d.expected, message: d.message, cellChanged: !!d.cellChanged, status: d.status ?? 'open', matchesExpected: false, author: d.author, createdAt: new Date().toISOString() };
            this.pluginErrors.set(k, e.id);
            errors.push(e);
            changed = true;
          } else if (errors[at]!.author === 'workbook' && errors[at]!.status === 'resolved') {
            errors[at] = { ...errors[at]!, status: 'open', message: d.message, expected: d.expected };
            changed = true;
          }
        }
        // A workbook-authored error whose cell now passes resolves itself — the one auto-resolve (W-18 DoD 3).
        for (const [k, id] of this.pluginErrors) {
          if (!k.startsWith(`${p.id}|${sheet}|`) || seen.has(k)) continue;
          const at = errors.findIndex((e) => e.id === id);
          if (at >= 0 && errors[at]!.author === 'workbook' && errors[at]!.status === 'open') { errors[at] = { ...errors[at]!, status: 'resolved' }; changed = true; }
        }
      }
    }
    if (changed) this.set({ errors: this.withMatches(errors, this.snap.changes) }, [{ type: 'errors', origin }]);
  }

  // ── export ───────────────────────────────────────────────────────────────
  /** The value changes as `@sheetpane/export` takes them. */
  exportChanges(): Change[] {
    const out: Change[] = [];
    for (const [k, c] of this.snap.changes) {
      if (c.kind !== 'value' && c.kind !== 'formula') continue;
      const { sheet, ref } = splitKey(k);
      out.push({ sheet, ref, value: c.now as Cell });
    }
    return out;
  }

  /** The sheet's rows with every change applied (CSV export, `toXlsx`). */
  currentRows(sheet: string): Cell[][] {
    const s = this.sheet(sheet);
    if (!s) return [];
    const rows = s.rows.map((r) => [...r]);
    for (const c of this.exportChanges()) {
      if (c.sheet !== sheet) continue;
      const p = parseRef(c.ref)!;
      const row = (rows[p.row] ??= []);
      while (row.length < p.col) row.push(null);
      row[p.col] = c.value;
    }
    return Array.from(rows, (r) => Array.from(r ?? [], (v) => v ?? null));
  }

  /** Every change applied; the upload never modified (SR-LAW-6). */
  async exportFile(o: { extraPatch?: ExportPatchHook[] } = {}): Promise<{ blob: Blob; kind: 'xlsx' | 'csv'; name: string; guarded: string[] }> {
    const src = this.snap.source, book = this.snap.book;
    if (!src || !book) throw new Error('sheetpane: nothing is loaded to export');
    if (src.kind === 'csv') {
      const sheet = book.sheets[0]!;
      const { text, guarded } = toCsv({ name: sheet.name, rows: this.currentRows(sheet.name) }, { delimiter: book.delimiter ?? ',' });
      return { blob: new Blob([text], { type: 'text/csv;charset=utf-8' }), kind: 'csv', name: src.name, guarded };
    }
    const ctx = this.pluginContext();
    const hooks: ExportPatchHook[] = [...(o.extraPatch ?? []), ...this.plugins.filter((p) => p.provides.includes('exportPatch')).map((p) => (patch: Parameters<ExportPatchHook>[0]) => p.exportPatch!(patch, ctx))];
    const freeze = [...this.snap.changes].filter(([k, c]) => c.kind === 'freeze' && k.endsWith('!#freeze')).map(([k, c]) => ({ sheet: splitKey(k).sheet, ...(c.now as { rows: number; cols: number }) }));
    const bytes = await patchXlsx(src.bytes, this.exportChanges(), { exportPatch: hooks, ...(freeze.length ? { freeze } : {}) });
    return { blob: new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), kind: 'xlsx', name: src.name, guarded: [] };
  }

  // ── stale formula marks (W-01 DoD 15) ───────────────────────────────────
  private refsCache = new WeakMap<ImportedSheet, Map<string, { sheet: string; range: ReturnType<typeof parseRange> }[]>>();
  /** A formula cell that reads a changed cell may show a stale value — unless a `derive` plugin recalculates. */
  mayBeStale(sheet: string, ref: string): boolean {
    if (this.plugins.some((p) => p.provides.includes('derive')) || !this.snap.changes.size) return false;
    const s = this.sheet(sheet);
    const f = s?.formulas[ref];
    if (!s || f === undefined || this.snap.changes.has(key(sheet, ref))) return false;
    let cache = this.refsCache.get(s);
    if (!cache) this.refsCache.set(s, (cache = new Map()));
    let refs = cache.get(ref);
    if (!refs) cache.set(ref, (refs = formulaRefs(f, sheet)));
    for (const [k, c] of this.snap.changes) {
      if (c.kind !== 'value' && c.kind !== 'formula') continue;
      const { sheet: cs, ref: cr } = splitKey(k), p = parseRef(cr)!;
      const cell = { top: p.row, left: p.col, bottom: p.row, right: p.col };
      if (refs.some((r) => r.sheet === cs && r.range && rangesIntersect(r.range, cell))) return true;
    }
    return false;
  }
}

/** The ranges a formula reads (A1 refs, ranges, whole columns or rows; sheet-qualified or not). */
export function formulaRefs(f: string, sheet: string): { sheet: string; range: ReturnType<typeof parseRange> }[] {
  const out: { sheet: string; range: ReturnType<typeof parseRange> }[] = [];
  const src = f.replace(/"(?:[^"]|"")*"/g, '""');
  const re = /(?:(?:'((?:[^']|'')+)'|([A-Za-z_][\w.]*))!)?(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?|\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}|\$?\d+:\$?\d+)(?![\w(])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const sh = m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2] ?? sheet;
    const body = m[3]!.replace(/\$/g, '');
    let range = parseRange(body);
    if (!range && /^[A-Za-z]+:[A-Za-z]+$/.test(body)) { const [a, b] = body.split(':'); range = parseRange(`${a}1:${b}1048576`); }
    if (!range && /^\d+:\d+$/.test(body)) { const [a, b] = body.split(':'); range = parseRange(`A${a}:XFD${b}`); }
    if (range) out.push({ sheet: sh, range });
  }
  return out;
}

export function createWorkbook(o: StoreOptions = {}): WorkbookStore {
  return new WorkbookStore(o);
}
