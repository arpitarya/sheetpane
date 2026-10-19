// The in-memory workbook one pane shares (contract verdict decisions 1–9; SR-LAW-6,
// SR-LAW-7, SR-LAW-9). Framework-free: subscribe / getSnapshot, and mutators.
// Every mutation goes through commit(): undo (W-23), derive and validate
// (W-14), "matches suggestion" (B-022) and one notification.
import { cellRef, detailOf, parseRange, parseRef, patchXlsx, rangesIntersect, spError, spMessage, toCsv, toXlsx, type Cell, type Change, type ExportPatchHook, type SpCode } from '@sheetpane/export';
import { formatCode, general, ImportError, read, sha256, subsetCode, type ImportedSheet, type ImportedWorkbook, type TextRun } from '@sheetpane/import';
import { checkPlugins, mergeDecorations } from '../plugins/host.js';
import { STYLE_PROPS, type CellContext, type DeriveInput, type DerivedChange, type ErrorDraft, type Plugin, type PluginContext, type RunStyle, type StyleSubset } from '../plugins/types.js';
import { HostRules, type ColumnRulesConfig } from './rules.js';
import { machineAuthored } from './types.js';
import type { ChangeEntry, ChangeKind, Composing, DerivedCell, LoadState, Mode, Selection, SheetState, SheetpaneError, Snapshot, Source } from './types.js';

/** What {@link createWorkbook} takes. */
export interface StoreOptions {
  /** The pane's plugins, fixed for the store's life; checked by `checkPlugins` (throws on a broken rule). */
  plugins?: readonly Plugin[];
}

/** Who made a mutation — the element that dispatches its DOM event (one event per action, on the element where it happened). */
export type Origin = object | undefined;

/**
 * What {@link WorkbookStore.on} reports: one event per action, which the elements turn into
 * `sheetpane-*` DOM events on the element named by `origin`.
 */
export type StoreEvent =
  | { type: 'load'; origin: Origin }
  | { type: 'change'; origin: Origin; sheet: string; ref: string; kind: ChangeKind; was: unknown; now: unknown }
  | { type: 'errors'; origin: Origin }
  | { type: 'select'; origin: Origin; sheet: string; ref: string }
  | { type: 'mode'; origin: Origin; mode: Mode }
  | { type: 'history'; origin: Origin; reason: 'undo' | 'redo' | 'cleared' };

interface Undoable { changes: ReadonlyMap<string, ChangeEntry>; errors: readonly SheetpaneError[] }
interface HistoryEntry { before: Undoable; after: Undoable; keys: string[]; coalesce: string | undefined }

/** The undo stack's depth per pane; the oldest entry goes first (W-23, SR-GRID decision 7). */
export const HISTORY_CAP = 500;
const BLANK = '(blank)';
/** The CSS a run's span may carry (W-53): the `decorate` allow-list. */
const ALLOWED_PROPS: ReadonlySet<string> = new Set(STYLE_PROPS);

/**
 * The change-map key of a cell: `Sheet1!B3` (exported as `cellKey`).
 * @param sheet - The sheet name.
 * @param ref - The A1 ref, or a slotted ref such as `#style:A1`.
 * @returns `sheet!ref`.
 */
export const key = (sheet: string, ref: string) => `${sheet}!${ref}`;

/** Kinds that sit beside a cell's value in their own slot: `sheet!#style:A1`, `sheet!#numFmt:A1`. */
export const SLOTTED_KINDS: readonly ChangeKind[] = ['style', 'numFmt'];
/** The change-map ref of a kind for a cell: `A1` for value and formula, `#style:A1` for style … */
export const kindRef = (ref: string, kind: ChangeKind) => (ref.startsWith('#') || !SLOTTED_KINDS.includes(kind) ? ref : `#${kind}:${ref}`);
/** The cell a change-map ref belongs to: `#style:A1` → `A1`. */
export const baseRef = (ref: string) => ref.replace(/^#(?:style|numFmt):/, '');
/**
 * Splits a change-map key at its last `!`: `Sheet1!B3` → `{ sheet: 'Sheet1', ref: 'B3' }`.
 * @param k - A key made by `cellKey`.
 * @returns The sheet name and the ref.
 */
export function splitKey(k: string): { sheet: string; ref: string } {
  const i = k.lastIndexOf('!');
  return { sheet: k.slice(0, i), ref: k.slice(i + 1) };
}

/**
 * A value typed into the cell bar, as the cell will store it (SR-GRID decision 3): in a
 * `.csv` it stays text; in an `.xlsx` a number or blank cell takes a number, a boolean cell
 * `TRUE`/`FALSE`.
 * @param text - What was typed; `''` clears the cell.
 * @param original - The cell's uploaded value, which decides the parse.
 * @param source - The workbook's kind.
 * @returns The value to store.
 */
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

/** A sheet's state as read: `state` (W-49), else the older `hidden` flag. */
export const sheetStateOf = (s: ImportedSheet): SheetState => ((s as { state?: SheetState }).state ?? (s.hidden ? 'hidden' : 'visible'));
const same = (a: unknown, b: unknown) => a === b || (typeof a === 'number' && typeof b === 'number' && Object.is(a, b)) || JSON.stringify(a) === JSON.stringify(b);

/**
 * The in-memory workbook one pane shares (SR-GRID decisions 1–8): the uploaded file, every
 * change, every error, the selection, the mode and one undo stack. Framework-free and
 * `useSyncExternalStore`-shaped (`subscribe`, `getSnapshot`); every mutation goes through one
 * commit (undo entry, one notification, then `validate` and `derive`). The upload is never
 * modified; {@link WorkbookStore.exportFile} writes a copy with the changes (SR-LAW-6).
 *
 * Elements get one per `pane` id from the registry ({@link paneStore}); a host may make its own
 * with {@link createWorkbook} and assign it to `el.workbook`.
 *
 * @example
 * ```ts
 * import { createWorkbook } from '@sheetpane/grid';
 * const book = createWorkbook();
 * await book.load(bytes, 'accounts.xlsx');
 * book.setMode('edit');
 * book.setCell('Sheet1', 'B3', '42');
 * const off = book.subscribe(() => console.log(book.getSnapshot().changes.size));
 * const { blob, name } = await book.exportFile();
 * off();
 * ```
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md
 */
export class WorkbookStore {
  /** The pane's plugins, checked and in `decorate` order; fixed for the store's life. */
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
  /** The host's column rules (W-27): a built-in `validate` provider, never part of the frozen plugin set. */
  private readonly rules: HostRules = new HostRules({
    bookSheets: () => this.snap.book?.sheets,
    date1904: () => this.snap.book?.date1904 ?? false,
    value: (sheet, ref) => this.value(sheet, ref),
    valueAt: (sheet, row, col) => (this.snap.changes.size || this.snap.derived.size ? this.value(sheet, cellRef(row, col)) : (this.sheet(sheet)?.rows[row]?.[col] ?? null)),
    text: (sheet, ref) => this.text(sheet, ref),
    original: (sheet, ref) => this.original(sheet, ref),
    revalidate: (sheets) => this.runValidate(sheets, undefined),
    prune: (id, produced) => this.prune(id, produced),
    progress: () => this.set({}),
  });

  /** An empty store; prefer {@link createWorkbook}. Throws when the plugin set breaks a rule. */
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
  /** Calls `fn` after every change of state; returns the unsubscribe function. */
  subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  /** The current immutable snapshot — a new object per change, with a `version`. */
  getSnapshot = (): Snapshot => this.snap;
  /** Store events, for the elements to turn into DOM events. */
  on(fn: (e: StoreEvent) => void): () => void { this.eventListeners.add(fn); return () => this.eventListeners.delete(fn); }

  private set(patch: Partial<Snapshot>, events: StoreEvent[] = []): void {
    this.snap = { ...this.snap, ...patch, canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0, version: this.snap.version + 1 };
    for (const fn of [...this.listeners]) fn();
    for (const e of events) for (const fn of [...this.eventListeners]) fn(e);
  }

  /** The ids of the pane's plugins, in order. */
  get pluginIds(): string[] { return this.plugins.map((p) => p.id); }

  /** `<sheetpane-errors>` elements connected to this pane: the store decides which form opens (contract decision 4). */
  attachErrorsView(): () => void { this.errorsViews++; this.set({}); return () => { this.errorsViews--; this.set({}); }; }
  /** Whether a `<sheetpane-errors>` is connected to this pane. */
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
      const err = e instanceof ImportError ? e : new ImportError('corrupt', detailOf(e));
      const load: LoadState = { status: 'error', code: err.code, spCode: err.spCode, message: err.spDetail, name };
      if (err.detail) load.detail = err.detail;
      this.set({ load, book: undefined, source: undefined }, [{ type: 'load', origin }]);
      return;
    }
    if (seq !== this.loadSeq) return;
    const source: Source = { name, kind: book.source, size: bytes.length, bytes, readMs: Math.round(performance.now() - t0), ...(book.sha256 ? { sha256: book.sha256 } : {}) };
    this.undoStack = []; this.redoStack = []; this.textCache.clear(); this.pluginErrors.clear();
    const first = book.sheets[book.activeSheet] ?? book.sheets[0]!;
    this.set({ load: { status: 'ready' }, source, book, changes: new Map(), derived: new Map(), errors: [], composing: null, selection: { sheet: first.name, ref: 'A1' } }, [{ type: 'load', origin }]);
    this.rules.reset(); // column rules: the `load` phase (time-sliced; it re-runs validate when done)
    this.runValidate(book.sheets.map((s) => s.name), origin);
    void this.runDerive({ kind: 'load' });
  }

  /** A source that could not even be fetched (a bad URL): the pane shows the refusal state. */
  failLoad(name: string, message: string, origin?: Origin, spCode: SpCode = 'SP-3015'): void {
    this.loadSeq++;
    this.set({ load: { status: 'error', code: 'unreadable', spCode, message, name }, book: undefined, source: undefined }, [{ type: 'load', origin }]);
  }

  // ── reading ──────────────────────────────────────────────────────────────
  /** The workbook as read, or undefined before a load. */
  get book(): ImportedWorkbook | undefined { return this.snap.book; }
  /** A sheet of the workbook by name. */
  sheet(name: string): ImportedSheet | undefined { return this.snap.book?.sheets.find((s) => s.name === name); }

  /** The uploaded value and display text. */
  original(sheet: string, ref: string): { value: Cell; text: string } {
    const s = this.sheet(sheet), p = parseRef(ref);
    if (!s || !p) return { value: null, text: '' };
    return { value: s.rows[p.row]?.[p.col] ?? null, text: s.text[p.row]?.[p.col] ?? '' };
  }

  /** A cell's change of one kind (default: its value). */
  changeOf(sheet: string, ref: string, kind?: ChangeKind): ChangeEntry | undefined { return this.snap.changes.get(key(sheet, kind ? kindRef(ref, kind) : ref)); }
  /** Every change a cell carries — its value and each slotted kind. */
  changesAt(sheet: string, ref: string): ChangeEntry[] {
    const out: ChangeEntry[] = [];
    for (const r of [ref, ...SLOTTED_KINDS.map((k) => kindRef(ref, k))]) { const c = this.snap.changes.get(key(sheet, r)); if (c) out.push(c); }
    return out;
  }

  /** The cell's formula with its `=`: a typed formula, else the file's (unless a value edit replaced it); undefined when none. */
  formula(sheet: string, ref: string): string | undefined {
    const c = this.snap.changes.get(key(sheet, ref));
    if (c) return typeof c.now === 'string' && c.now.startsWith('=') ? c.now : undefined;
    const f = this.sheet(sheet)?.formulas[ref];
    return f === undefined ? undefined : `=${f}`;
  }
  /** What the cell bar edits: the formula when a `derive` provider (a formula engine) is installed, else the raw value. */
  input(sheet: string, ref: string): string {
    const f = this.plugins.some((x) => x.provides.includes('derive')) ? this.formula(sheet, ref) : undefined;
    if (f !== undefined) return f;
    const v = this.value(sheet, ref);
    return v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v);
  }
  /** The current value: a user change, else a derived value, else the upload. */
  value(sheet: string, ref: string): Cell {
    const k = key(sheet, ref), c = this.snap.changes.get(k);
    const d = this.snap.derived.get(k);
    if (c && c.kind === 'value') return c.now as Cell;
    if (c && c.kind === 'formula') return d ? d.value : (c.now as Cell); // a typed formula reads as its result once derived
    return d ? d.value : this.original(sheet, ref).value;
  }

  /** The current display text. */
  text(sheet: string, ref: string): string {
    const k = key(sheet, ref);
    const hit = this.textCache.get(k);
    if (hit !== undefined) return hit;
    const c = this.snap.changes.get(k);
    let t: string;
    if (c && c.kind === 'value') t = this.format(sheet, ref, c.now as Cell);
    else if (c && c.kind === 'formula') { const d = this.snap.derived.get(k); t = d ? d.text : this.format(sheet, ref, c.now as Cell); }
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

  /** One cell as a plugin hook sees it; undefined when the sheet is unknown. */
  cellContext(sheet: string, ref: string, value?: Cell): CellContext | undefined {
    const book = this.snap.book, s = this.sheet(sheet), p = parseRef(ref);
    if (!book || !s || !p) return undefined;
    const runs = this.runs(sheet, ref);
    return { store: this, book, sheet: s, ref, row: p.row, col: p.col, value: value === undefined ? this.value(sheet, ref) : value, styleIndex: s.styleIndex[ref], ...(runs ? { runs } : {}) };
  }

  /**
   * A rich-text cell's runs from the file (W-53, SR-IMPORT decision 12) while it still holds the file's value — no
   * value or formula change, no derived value; `undefined` otherwise. An edit writes plain text, so its runs go.
   */
  runs(sheet: string, ref: string): readonly TextRun[] | undefined {
    const r = this.sheet(sheet)?.runs?.[ref];
    if (!r) return undefined;
    const k = key(sheet, ref), c = this.snap.changes.get(k);
    if ((c && (c.kind === 'value' || c.kind === 'formula')) || this.snap.derived.has(k)) return undefined;
    return r;
  }

  /**
   * A rich-text cell as styled pieces (W-53): the last `decorate` provider's `decorateRuns` that answers, its CSS
   * allow-listed to `STYLE_PROPS`; a `font-family` throws (SP-3010). `undefined` — draw the text plain — when the
   * cell has no runs, no provider answers, or the pieces' text is not the display text.
   */
  decorateRuns(sheet: string, ref: string): RunStyle[] | undefined {
    if (!this.runs(sheet, ref)) return undefined;
    const ctx = this.cellContext(sheet, ref);
    if (!ctx) return undefined;
    let out: RunStyle[] | undefined;
    for (const p of this.plugins) {
      if (!p.provides.includes('decorate') || !p.decorateRuns) continue;
      const pieces = p.decorateRuns(ctx);
      if (!pieces) continue;
      out = pieces.map((x) => {
        const style = mergeDecorations([{ id: p.id, style: x.style }]);
        for (const k of Object.keys(style)) if (!ALLOWED_PROPS.has(k)) delete (style as Record<string, string>)[k];
        return Object.keys(style).length ? { text: x.text, style } : { text: x.text };
      });
    }
    return out && out.map((x) => x.text).join('') === this.text(sheet, ref) ? out : undefined;
  }

  /** The merged `decorate` result for a cell; `{}` with no decorate plugin. */
  decorate(sheet: string, ref: string): StyleSubset {
    const deco = this.plugins.filter((p) => p.provides.includes('decorate'));
    if (!deco.length) return {};
    const ctx = this.cellContext(sheet, ref);
    if (!ctx) return {};
    return mergeDecorations(deco.map((p) => ({ id: p.id, style: p.decorate!(ctx) })));
  }

  /** What a plugin hook is given: the store, the book and a snapshot reader. */
  pluginContext(): PluginContext {
    return { store: this, book: this.snap.book!, snapshot: () => this.snap };
  }

  /** How many cells a user changed (derived cells are not changes). */
  get changeCount(): number { return this.snap.changes.size; }

  // ── the one commit path ──────────────────────────────────────────────────
  private commit(next: Undoable, keys: string[], origin: Origin, events: StoreEvent[], o: { coalesce?: string; record?: boolean; extra?: Partial<Snapshot> } = {}): void {
    const before: Undoable = { changes: this.snap.changes, errors: this.snap.errors };
    for (const k of keys) { this.textCache.delete(k); const { sheet, ref } = splitKey(k); this.textCache.delete(key(sheet, baseRef(ref))); }
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
      this.rules.touch(keys.map(splitKey).filter((c) => !c.ref.startsWith('#')));
      this.runValidate(this.allSheets(), origin);
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
    const step = this.cellStep(this.snap.changes, sheet, ref, input, o);
    if (!step) return false;
    const commitOpts: { coalesce?: string } = {};
    if (o.coalesce) commitOpts.coalesce = `type:${step.key}`;
    this.commit({ changes: step.changes, errors: this.snap.errors }, [step.key], o.origin, [step.event], commitOpts);
    return true;
  }

  /** Sets many cells as one undo step (paste). Returns how many changed. */
  setCells(cells: { sheet: string; ref: string; input: string | Cell }[], o: { origin?: Origin; parse?: boolean } = {}): number {
    let changes = this.snap.changes;
    const keys: string[] = [], events: StoreEvent[] = [];
    for (const c of cells) {
      const step = this.cellStep(changes, c.sheet, c.ref, c.input, o);
      if (!step) continue;
      changes = step.changes; keys.push(step.key); events.push(step.event);
    }
    if (keys.length) this.commit({ changes, errors: this.snap.errors }, keys, o.origin, events);
    return keys.length;
  }

  /** What a cell write would do to the change map, or undefined when nothing changes. */
  private cellStep(base: ReadonlyMap<string, ChangeEntry>, sheet: string, ref: string, input: string | Cell, o: { origin?: Origin; parse?: boolean }): { key: string; changes: Map<string, ChangeEntry>; event: StoreEvent } | undefined {
    const book = this.snap.book;
    const p = parseRef(ref);
    if (!book || !p || !this.sheet(sheet)) return undefined;
    const a1 = cellRef(p.row, p.col);
    const orig = this.original(sheet, a1);
    const now: Cell = typeof input === 'string' && o.parse !== false ? parseInput(input, orig.value, book.source) : (input as Cell);
    const k = key(sheet, a1);
    const prev = base.get(k);
    const fileFormula = this.sheet(sheet)?.formulas[a1];
    const backToOriginal = fileFormula !== undefined
      ? typeof input === 'string' && input.trim() === `=${fileFormula}` // retyping the file's formula restores the cell
      : same(now, orig.value) || (typeof input === 'string' && input === orig.text && orig.text !== '');
    if (!prev && backToOriginal) return undefined;
    if (prev && same(prev.now, now)) return undefined;
    const changes = new Map(base);
    if (backToOriginal) changes.delete(k);
    else changes.set(k, { kind: typeof now === 'string' && now.startsWith('=') && this.plugins.some((x) => x.provides.includes('derive')) ? 'formula' : 'value', was: orig.value, now });
    return { key: k, changes, event: { type: 'change', origin: o.origin, sheet, ref: a1, kind: 'value', was: prev ? prev.now : orig.value, now: backToOriginal ? orig.value : now } };
  }

  /** Sets any change-map entry a plugin owns (`style`, `numFmt`, `merge`, `freeze`). `now === undefined` removes it. */
  setChange(sheet: string, ref: string, kind: ChangeKind, now: unknown, was: unknown, origin?: Origin): void {
    const slot = kindRef(ref, kind);
    ref = baseRef(slot);
    const k = key(sheet, slot);
    const changes = new Map(this.snap.changes);
    const prev = changes.get(k);
    if (now === undefined || same(now, was)) changes.delete(k);
    else changes.set(k, { kind, was: prev ? prev.was : was, now });
    this.commit({ changes, errors: this.snap.errors }, [k], origin, [{ type: 'change', origin, sheet, ref, kind, was: prev ? prev.now : was, now: now ?? was }]);
  }

  /** Many plugin-kind changes as one undo step (a format applied to a range). `now === undefined` removes. */
  setChanges(list: { sheet: string; ref: string; kind: ChangeKind; now: unknown; was: unknown }[], origin?: Origin): void {
    const changes = new Map(this.snap.changes);
    const keys: string[] = [], events: StoreEvent[] = [];
    for (const c of list) {
      const k = key(c.sheet, kindRef(c.ref, c.kind)), prev = changes.get(k);
      if (c.now === undefined || same(c.now, c.was)) { if (!prev) continue; changes.delete(k); }
      else { if (prev && same(prev.now, c.now)) continue; changes.set(k, { kind: c.kind, was: prev ? prev.was : c.was, now: c.now }); }
      keys.push(k);
      events.push({ type: 'change', origin, sheet: c.sheet, ref: baseRef(c.ref), kind: c.kind, was: prev ? prev.now : c.was, now: c.now ?? c.was });
    }
    if (keys.length) this.commit({ changes, errors: this.snap.errors }, keys, origin, events);
  }

  /** Reverts one cell (or any change-map key) to the upload; undoable. */
  revert(sheet: string, ref: string, origin?: Origin): void {
    const refs = ref.startsWith('#') ? [ref] : [ref, ...SLOTTED_KINDS.map((k) => kindRef(ref, k))];
    const changes = new Map(this.snap.changes);
    const keys: string[] = [], events: StoreEvent[] = [];
    for (const r of refs) {
      const k = key(sheet, r), prev = changes.get(k);
      if (!prev) continue;
      changes.delete(k); keys.push(k);
      events.push({ type: 'change', origin, sheet, ref: baseRef(r), kind: prev.kind, was: prev.now, now: prev.was });
    }
    if (keys.length) this.commit({ changes, errors: this.snap.errors }, keys, origin, events);
  }

  // ── merged ranges: core, changed by plugins as kind `merge` (key `sheet!#merge:A1:C1`, now true | false) ──
  /** The sheet's merged ranges: the file's with `merge` changes applied. */
  merges(sheet: string): string[] {
    const s = this.sheet(sheet);
    if (!s) return [];
    const out = new Set(s.merges ?? []);
    for (const [k, c] of this.snap.changes) {
      if (c.kind !== 'merge' || !k.startsWith(`${sheet}!#merge:`)) continue;
      const r = k.slice(sheet.length + 8);
      if (c.now) out.add(r); else out.delete(r);
    }
    return [...out];
  }
  /** Merges (`true`) or unmerges (`false`) a range; undoable. */
  setMerge(sheet: string, range: string, merged: boolean, origin?: Origin): void {
    const was = (this.sheet(sheet)?.merges ?? []).includes(range);
    this.setChange(sheet, `#merge:${range}`, 'merge', merged, was, origin);
  }

  // ── hidden rows, columns and sheets (W-49): the file's, then `hidden` / `sheetState` changes ──
  /**
   * What a sheet hides: rows and columns (0-based, sorted) and its state — the file's, with the
   * `hidden` and `sheetState` changes applied.
   * @param sheet - The sheet's name.
   * @returns The hidden rows and columns and the sheet's state.
   */
  hidden(sheet: string): { rows: number[]; cols: number[]; state: SheetState } {
    const s = this.sheet(sheet);
    if (!s) return { rows: [], cols: [], state: 'visible' };
    const ch = (k: string) => this.snap.changes.get(key(sheet, k))?.now;
    return { rows: (ch('#hiddenRows') as number[] | undefined) ?? s.hiddenRows ?? [], cols: (ch('#hiddenCols') as number[] | undefined) ?? s.hiddenCols ?? [], state: (ch('#sheetState') as SheetState | undefined) ?? sheetStateOf(s) };
  }
  /**
   * Hides or unhides rows or columns: one undoable change per sheet and axis, written to the download.
   * @param sheet - The sheet's name.
   * @param axis - `rows` or `cols`.
   * @param indexes - The 0-based rows or columns.
   * @param hide - True hides, false unhides.
   * @param origin - The element that asked.
   */
  setHidden(sheet: string, axis: 'rows' | 'cols', indexes: readonly number[], hide: boolean, origin?: Origin): void {
    const s = this.sheet(sheet);
    if (!s) return;
    const cur = new Set(this.hidden(sheet)[axis]);
    for (const i of indexes) if (hide) cur.add(i); else cur.delete(i);
    const file = [...((axis === 'rows' ? s.hiddenRows : s.hiddenCols) ?? [])].sort((a, b) => a - b);
    this.setChange(sheet, axis === 'rows' ? '#hiddenRows' : '#hiddenCols', 'hidden', [...cur].sort((a, b) => a - b), file, origin);
  }
  /**
   * Sets a sheet's state; the last visible sheet cannot be hidden (Excel's rule).
   * @param sheet - The sheet's name.
   * @param state - `visible`, `hidden` or `veryHidden`.
   * @param origin - The element that asked.
   * @returns False when refused.
   */
  setSheetState(sheet: string, state: SheetState, origin?: Origin): boolean {
    const s = this.sheet(sheet), book = this.snap.book;
    if (!s || !book) return false;
    if (state !== 'visible' && !book.sheets.some((x) => x.name !== sheet && this.hidden(x.name).state === 'visible')) return false;
    this.setChange(sheet, '#sheetState', 'sheetState', state, sheetStateOf(s), origin);
    return true;
  }

  /**
   * A sheet's outline levels (W-49 DoD 9): rows and columns (0-based) to a level 1–7, the file's with
   * the `outline` changes applied, and where the summary sits.
   * @param sheet - The sheet's name.
   * @returns The levels per axis, the deepest level per axis, and `summaryBelow` / `summaryRight`.
   */
  outline(sheet: string): { rows: Record<number, number>; cols: Record<number, number>; levelRow: number; levelCol: number; summaryBelow: boolean; summaryRight: boolean } {
    const s = this.sheet(sheet) as (ImportedSheet & { rowOutline?: ({ level: number } | undefined)[]; colOutline?: ({ level: number } | undefined)[]; outline?: { summaryBelow: boolean; summaryRight: boolean } }) | undefined;
    const fromFile = (list: ({ level: number } | undefined)[] | undefined) => { const m: Record<number, number> = {}; (list ?? []).forEach((e, i) => { if (e && e.level > 0) m[i] = e.level; }); return m; };
    const ch = (k: string) => this.snap.changes.get(key(sheet, k))?.now as Record<number, number> | undefined;
    const rows = ch('#outlineRows') ?? fromFile(s?.rowOutline), cols = ch('#outlineCols') ?? fromFile(s?.colOutline);
    const deepest = (m: Record<number, number>) => Object.values(m).reduce((a, b) => Math.max(a, b), 0);
    return { rows, cols, levelRow: deepest(rows), levelCol: deepest(cols), summaryBelow: s?.outline?.summaryBelow ?? true, summaryRight: s?.outline?.summaryRight ?? true };
  }
  /**
   * Groups (+1 level) or ungroups (−1) rows or columns — one undoable change per sheet and axis; seven levels at most.
   * @param sheet - The sheet's name.
   * @param axis - `rows` or `cols`.
   * @param indexes - The 0-based rows or columns.
   * @param delta - `1` groups, `-1` ungroups.
   * @param origin - The element that asked.
   */
  setOutline(sheet: string, axis: 'rows' | 'cols', indexes: readonly number[], delta: 1 | -1, origin?: Origin): void {
    if (!this.sheet(sheet)) return;
    const o = this.outline(sheet), cur = { ...(axis === 'rows' ? o.rows : o.cols) };
    for (const i of indexes) { const v = Math.max(0, Math.min(7, (cur[i] ?? 0) + delta)); if (v) cur[i] = v; else delete cur[i]; }
    const k = axis === 'rows' ? '#outlineRows' : '#outlineCols';
    const was = this.snap.changes.get(key(sheet, k))?.was ?? (axis === 'rows' ? this.outlineFile(sheet).rows : this.outlineFile(sheet).cols);
    this.setChange(sheet, k, 'outline', cur, was, origin);
  }
  private outlineFile(sheet: string): { rows: Record<number, number>; cols: Record<number, number> } {
    const s = this.sheet(sheet) as (ImportedSheet & { rowOutline?: ({ level: number } | undefined)[]; colOutline?: ({ level: number } | undefined)[] }) | undefined;
    const m = (list: ({ level: number } | undefined)[] | undefined) => { const r: Record<number, number> = {}; (list ?? []).forEach((e, i) => { if (e && e.level > 0) r[i] = e.level; }); return r; };
    return { rows: m(s?.rowOutline), cols: m(s?.colOutline) };
  }

  // ── freeze panes (W-24): view state, a change of kind `freeze` ─────────
  /** A sheet's frozen rows and columns: a `freeze` change, else the file's. */
  freeze(sheet: string): { rows: number; cols: number } {
    const c = this.snap.changes.get(key(sheet, '#freeze'));
    return (c?.now as { rows: number; cols: number } | undefined) ?? this.sheet(sheet)?.freeze ?? { rows: 0, cols: 0 };
  }
  /** Freezes rows and columns of a sheet, as an undoable change of kind `freeze` (W-24). */
  setFreeze(sheet: string, f: { rows: number; cols: number }, origin?: Origin): void {
    const s = this.sheet(sheet);
    if (!s) return;
    this.setChange(sheet, '#freeze', 'freeze', { rows: Math.max(0, f.rows), cols: Math.max(0, f.cols) }, s.freeze, origin);
  }

  // ── selection, mode, composing ───────────────────────────────────────────
  /** Moves the pane's shared selection; leaving the composed cell drops the draft error. */
  select(sel: Selection, origin?: Origin): void {
    const s = this.snap.selection;
    if (s.sheet === sel.sheet && s.ref === sel.ref && s.range === sel.range) return;
    const next: Selection = { sheet: sel.sheet, ref: sel.ref };
    if (sel.range) next.range = sel.range;
    const drop = !!this.snap.composing && (this.snap.composing.sheet !== sel.sheet || this.snap.composing.ref !== sel.ref);
    this.set(drop ? { selection: next, composing: null } : { selection: next }, [{ type: 'select', origin, sheet: sel.sheet, ref: sel.ref }]);
  }
  /** Switches the pane between `view` and `edit`. */
  setMode(mode: Mode, origin?: Origin): void {
    if (this.snap.mode === mode) return;
    this.set({ mode, composing: mode === 'view' ? null : this.snap.composing }, [{ type: 'mode', origin, mode }]);
  }
  /** Opens (or, with `null`, closes) the Flag issue form for a cell. */
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

  /** Adds a person's error with a new id; `cellChanged` also writes `expected` into the cell in the same undo step. */
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

  /** Changes an error's status, severity, expected value, message or type; undoable. */
  updateError(id: string, patch: Partial<Pick<SheetpaneError, 'status' | 'severity' | 'expected' | 'message' | 'type'>>, origin?: Origin): void {
    if (!this.snap.errors.some((e) => e.id === id)) return;
    this.commit({ changes: this.snap.changes, errors: this.snap.errors.map((e) => (e.id === id ? { ...e, ...patch } : e)) }, [], origin, [{ type: 'errors', origin }]);
  }

  /** Deletes an error; a cell it changed keeps the change (contract decision 6). */
  deleteError(id: string, origin?: Origin): void {
    if (!this.snap.errors.some((e) => e.id === id)) return;
    this.commit({ changes: this.snap.changes, errors: this.snap.errors.filter((e) => e.id !== id) }, [], origin, [{ type: 'errors', origin }]);
  }

  /** A copy of every error in the pane. */
  getErrors(): SheetpaneError[] { return this.snap.errors.map((e) => ({ ...e })); }

  /** The host restores a saved review. Not a user action: the undo stack is cleared (W-23). */
  setErrors(list: readonly SheetpaneError[], origin?: Origin): void {
    const errors = list.map((e) => ({ ...e, v: 1 as const, matchesExpected: false }));
    for (const e of errors) { const n = /^ERR-(\d+)$/.exec(e.id); if (n) this.nextError = Math.max(this.nextError, Number(n[1]) + 1); }
    this.undoStack = []; this.redoStack = [];
    this.pluginErrors.clear(); // ids now name the restored list's errors; validate re-adopts its own by what they say, never by id
    this.set({ errors: this.withMatches(errors, this.snap.changes) }, [{ type: 'errors', origin }, { type: 'history', origin, reason: 'cleared' }]);
    this.runValidate(this.allSheets(), origin);
  }

  // ── undo / redo (W-23): one stack per pane ──────────────────────────────
  /** Undoes the pane's last step (changes and errors; never selection or mode). */
  undo(origin?: Origin): void { this.travel(this.undoStack, this.redoStack, 'before', origin, 'undo'); }
  /** Redoes the last undone step. */
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
      const { sheet, ref } = splitKey(k);
      this.textCache.delete(k);
      this.textCache.delete(key(sheet, baseRef(ref)));
      const a = cur.get(k), b = state.changes.get(k);
      if (a !== b) events.push({ type: 'change', origin, sheet, ref, kind: (b ?? a)!.kind, was: a ? a.now : b!.was, now: b ? b.now : a!.was });
    }
    if (this.snap.errors !== state.errors) events.push({ type: 'errors', origin });
    this.set({ changes: state.changes, errors: this.withMatches(state.errors, state.changes) }, events);
    const sheets = [...new Set(h.keys.map((k) => splitKey(k).sheet))];
    if (sheets.length) {
      this.rules.touch(h.keys.map(splitKey).filter((c) => !c.ref.startsWith('#')));
      this.runValidate(this.allSheets(), origin);
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
    try { out = await p.derive(input, this.pluginContext()); } catch (e) { console.error(spMessage('SP-3012', `sheetpane: plugin "${p.id}" derive failed`), e); return; }
    if (load !== this.loadSeq) return; // a newer workbook replaced this one
    const derived = new Map(input.kind === 'load' ? [] : this.snap.derived);
    for (const d of out) {
      const k = key(d.sheet, d.ref);
      if (d.clear) derived.delete(k);
      else derived.set(k, { value: d.value, text: d.text } satisfies DerivedCell);
      this.textCache.delete(k);
    }
    this.set({ derived, errors: this.withMatches(this.snap.errors, this.snap.changes) });
    this.runValidate(this.allSheets(), undefined); // rules may read the recalculated cells
  }

  /** A rule may read another sheet (a list range, an operand), so validation re-runs on every sheet. */
  private allSheets(): string[] { return this.snap.book?.sheets.map((x) => x.name) ?? []; }

  private runValidate(sheets: string[], origin: Origin): void {
    const vs = this.plugins.filter((p) => p.provides.includes('validate'));
    if (this.rules.active) vs.push(this.rules.provider);
    if (!vs.length || !this.snap.book) return;
    let errors = [...this.snap.errors];
    let changed = false;
    const at = new Map(errors.map((e, i) => [e.id, i]));
    // restored errors a provider may adopt (setErrors): by what they say, built once
    let adoptable: Map<string, number[]> | undefined;
    const contentKey = (e: { sheet: string; range: string; type: string; author: string }) => `${e.sheet}|${e.range}|${e.type}|${e.author}`;
    const adopt = (d: ErrorDraft): number => {
      if (!adoptable) {
        adoptable = new Map();
        const owned = new Set(this.pluginErrors.values());
        errors.forEach((e, i) => { if (!owned.has(e.id) && machineAuthored(e.author)) { const k = contentKey(e); const l = adoptable!.get(k); if (l) l.push(i); else adoptable!.set(k, [i]); } });
      }
      return adoptable.get(contentKey(d))?.shift() ?? -1;
    };
    for (const p of vs) {
      for (const sheet of sheets) {
        let drafts: ErrorDraft[];
        try { drafts = p.validate!(sheet, this.pluginContext()); } catch (e) { console.error(spMessage('SP-3013', `sheetpane: plugin "${p.id}" validate failed`), e); continue; }
        const seen = new Set<string>();
        for (const d of drafts) {
          const k = `${p.id}|${d.sheet}|${d.range}|${d.type}${d.key ? `|${d.key}` : ''}`;
          seen.add(k);
          const id = this.pluginErrors.get(k);
          const mine = (e: SheetpaneError | undefined) => !!e && e.sheet === d.sheet && e.range === d.range && e.type === d.type && e.author === d.author;
          let i = id !== undefined ? at.get(id) ?? -1 : -1;
          if (i >= 0 && !mine(errors[i])) i = -1;
          if (i < 0) { // a restored review may already hold this error: adopt it rather than add a second
            i = adopt(d);
            if (i >= 0) this.pluginErrors.set(k, errors[i]!.id);
          }
          if (i < 0) {
            const e: SheetpaneError = { v: 1, id: this.newId(), sheet: d.sheet, range: d.range, type: d.type, severity: d.severity, found: d.found, expected: d.expected, message: d.message, cellChanged: !!d.cellChanged, status: d.status ?? 'open', matchesExpected: false, author: d.author, createdAt: new Date().toISOString() }; // `key` stays out of the error
            if (d.code) e.code = d.code;
            this.pluginErrors.set(k, e.id);
            at.set(e.id, errors.length);
            errors.push(e);
            changed = true;
          } else if (errors[i]!.author !== 'file' && (errors[i]!.status === 'resolved' || errors[i]!.found !== d.found || errors[i]!.message !== d.message || errors[i]!.severity !== d.severity || errors[i]!.code !== d.code)) {
            // a machine-authored error follows the cell: reopened, and its found / message refreshed
            const { code: _was, ...rest } = errors[i]!;
            errors[i] = { ...rest, status: d.status ?? 'open', message: d.message, expected: d.expected, found: d.found, severity: d.severity, ...(d.code ? { code: d.code } : {}) };
            changed = true;
          }
        }
        // A workbook-authored error whose cell now passes resolves itself — the one auto-resolve (W-18 DoD 3).
        for (const [k, id] of this.pluginErrors) {
          if (!k.startsWith(`${p.id}|${sheet}|`) || seen.has(k)) continue;
          const i = at.get(id) ?? -1;
          if (i >= 0 && (errors[i]!.author === 'workbook' || errors[i]!.author === 'host') && errors[i]!.status === 'open') { errors[i] = { ...errors[i]!, status: 'resolved' }; changed = true; }
        }
      }
    }
    if (changed) this.set({ errors: this.withMatches(errors, this.snap.changes) }, [{ type: 'errors', origin }]);
  }

  // ── column rules (W-27) ──────────────────────────────────────────────────
  /** The host's column rules for this pane. Setting them checks every row again; host errors no longer produced go. */
  setColumnRules(c: ColumnRulesConfig): void { this.rules.configure(c); }
  /** The column rules in force. */
  get columnRules(): Readonly<ColumnRulesConfig> { return this.rules.config; }
  /** The `load` phase's progress while it runs (rows checked of rows to check). */
  get ruleProgress(): { done: number; total: number } | undefined { return this.rules.progress; }
  /** Whether a rules file (W-33) is in force for this pane. */
  get hasRulesDocument(): boolean { return this.rules.hasDocument; }

  // ── flagging (W-33): `off` leaves the errors panel as the one place errors are read ──
  private flaggingOn = true;
  /** Whether Flag issue is on for this pane (SR-GRID decision 22e). */
  get flagging(): boolean { return this.flaggingOn; }
  /** Turns Flag issue on or off; off cancels an open form. */
  setFlagging(on: boolean): void { if (on !== this.flaggingOn) { this.flaggingOn = on; if (!on && this.snap.composing) this.compose(null); this.set({}); } }
  /** The draft as typed, checked without storing anything (`input` phase). */
  checkInput(sheet: string, ref: string, input: string, signal: AbortSignal) {
    const now = this.snap.book ? parseInput(input, this.original(sheet, ref).value, this.snap.book.source) : input;
    return this.rules.checkInput(sheet, ref, now, input, signal);
  }
  /** A failing rule set to `block` for this value, if any (the element refuses it). */
  ruleBlocks(sheet: string, ref: string, now: Cell, text: string) { return this.rules.blocked(sheet, ref, now, text); }

  /** Removes a provider's errors whose key it no longer produces (rules changed, decision 12). */
  private prune(providerId: string, produced: ReadonlySet<string>): void {
    const drop = new Set<string>();
    for (const [k, id] of this.pluginErrors) if (k.startsWith(`${providerId}|`) && !produced.has(k)) { drop.add(id); this.pluginErrors.delete(k); }
    if (drop.size) this.set({ errors: this.snap.errors.filter((e) => !drop.has(e.id)) }, [{ type: 'errors', origin: undefined }]);
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

  /** The sheet as it shows now: changes, typed formulas and recalculated cells as their values (a converted download). */
  latestRows(sheet: string): Cell[][] {
    const rows = this.currentRows(sheet);
    const pre = `${sheet}!`;
    for (const k of new Set([...this.snap.derived.keys(), ...[...this.snap.changes.keys()].filter((x) => !x.slice(pre.length).startsWith('#'))])) {
      if (!k.startsWith(pre)) continue;
      const ref = k.slice(pre.length), p = parseRef(ref);
      if (!p) continue;
      const row = (rows[p.row] ??= []);
      while (row.length < p.col) row.push(null);
      row[p.col] = this.value(sheet, ref);
    }
    return Array.from(rows, (r) => Array.from(r ?? [], (v) => v ?? null));
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

  /**
   * Every change applied; the upload never modified (SR-LAW-6). `sha256` is the hash of the
   * blob's bytes, taken once per export (W-65) — `undefined` where Web Crypto is missing (SP-1009).
   */
  async exportFile(o: { extraPatch?: ExportPatchHook[]; options?: Readonly<Record<string, unknown>>; format?: 'xlsx' | 'csv'; sheet?: string } = {}): Promise<{ blob: Blob; kind: 'xlsx' | 'csv'; name: string; guarded: string[]; converted: boolean; sha256: string | undefined }> {
    const r = await this.buildExport(o);
    return { ...r, sha256: await sha256(r.blob) };
  }
  private async buildExport(o: { extraPatch?: ExportPatchHook[]; options?: Readonly<Record<string, unknown>>; format?: 'xlsx' | 'csv'; sheet?: string }): Promise<{ blob: Blob; kind: 'xlsx' | 'csv'; name: string; guarded: string[]; converted: boolean }> {
    const src = this.snap.source, book = this.snap.book;
    if (!src || !book) throw spError('SP-3001', 'sheetpane: nothing is loaded to export');
    const base = src.name.replace(/\.(xlsx|csv)$/i, '');
    if (o.format === 'csv' && src.kind === 'xlsx') {
      // CSV holds one sheet and no formatting: the chosen (else the selected) sheet, as it shows now
      const name = o.sheet ?? this.snap.selection.sheet ?? book.sheets[0]!.name;
      const { text, guarded } = toCsv({ name, rows: this.latestRows(name) });
      return { blob: new Blob([text], { type: 'text/csv;charset=utf-8' }), kind: 'csv', name: `${base}.csv`, guarded, converted: true };
    }
    if (o.format === 'xlsx' && src.kind === 'csv') {
      // one sheet with the latest values; numbers typed as text in the CSV become numbers, as Excel reads them
      const sheet = book.sheets[0]!;
      const rows = this.latestRows(sheet.name).map((r) => r.map((v) => (typeof v === 'string' && /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[-+]?\d+)?$/i.test(v.trim()) ? Number(v) : v)));
      const bytes = await toXlsx({ sheets: [{ name: sheet.name, rows }] });
      return { blob: new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), kind: 'xlsx', name: `${base}.xlsx`, guarded: [], converted: true };
    }
    if (src.kind === 'csv') {
      const sheet = book.sheets[0]!;
      const { text, guarded } = toCsv({ name: sheet.name, rows: this.currentRows(sheet.name) }, { delimiter: book.delimiter ?? ',' });
      return { blob: new Blob([text], { type: 'text/csv;charset=utf-8' }), kind: 'csv', name: src.name, guarded, converted: false };
    }
    const ctx = { ...this.pluginContext(), exportOptions: o.options ?? {} };
    const hooks: ExportPatchHook[] = [...(o.extraPatch ?? []), ...this.plugins.filter((p) => p.provides.includes('exportPatch')).map((p) => (patch: Parameters<ExportPatchHook>[0]) => p.exportPatch!(patch, ctx))];
    const freeze = [...this.snap.changes].filter(([k, c]) => c.kind === 'freeze' && k.endsWith('!#freeze')).map(([k, c]) => ({ sheet: splitKey(k).sheet, ...(c.now as { rows: number; cols: number }) }));
    const mergeSheets = new Set([...this.snap.changes].filter(([, c]) => c.kind === 'merge').map(([k]) => k.slice(0, k.indexOf('!#merge:'))));
    const merges = [...mergeSheets].map((sheet) => ({ sheet, ranges: this.merges(sheet) }));
    // hidden rows, columns and sheet states (W-49): each sheet's whole set after the edits
    const hidSheets = new Set([...this.snap.changes].filter(([, c]) => c.kind === 'hidden' || c.kind === 'sheetState' || c.kind === 'outline').map(([k]) => splitKey(k).sheet));
    const hidden = [...hidSheets].map((sheet) => {
      const h = this.hidden(sheet), o = this.outline(sheet), has = (r: string) => this.snap.changes.has(key(sheet, r));
      const outline = has('#outlineRows') || has('#outlineCols') ? { outline: { ...(has('#outlineRows') ? { rows: o.rows } : {}), ...(has('#outlineCols') ? { cols: o.cols } : {}) } } : {};
      return { sheet, ...(has('#hiddenRows') ? { rows: h.rows } : {}), ...(has('#hiddenCols') ? { cols: h.cols } : {}), ...(has('#sheetState') ? { state: h.state } : {}), ...outline };
    });
    const bytes = await patchXlsx(src.bytes, this.exportChanges(), { exportPatch: hooks, ...(freeze.length ? { freeze } : {}), ...(merges.length ? { merges } : {}), ...(hidden.length ? { hidden } : {}) });
    return { blob: new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), kind: 'xlsx', name: src.name, guarded: [], converted: false };
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
/**
 * The ranges a formula reads (A1 refs, ranges, whole columns or rows; sheet-qualified or not),
 * used for the "may be stale" mark (SR-GRID decision 8).
 * @param f - The formula, without its `=`.
 * @param sheet - The sheet the formula sits on, for unqualified refs.
 * @returns Each referenced range with its sheet.
 */
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

/**
 * Makes a framework-free workbook store (SR-GRID decision 1). Elements make theirs through the
 * pane registry; a host makes one to share across elements or to drive without any DOM.
 * @param o - The store's options: its plugins, fixed for its life.
 * @returns A new, empty {@link WorkbookStore}.
 * @example
 * ```ts
 * import { createWorkbook } from '@sheetpane/grid';
 * const book = createWorkbook({ plugins: [] });
 * await book.load(bytes, 'q3.csv');
 * excel.workbook = book;
 * errors.workbook = book;
 * ```
 */
export function createWorkbook(o: StoreOptions = {}): WorkbookStore {
  return new WorkbookStore(o);
}
