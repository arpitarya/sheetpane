// @sheetpane/formulas — live recalculation for sheetpane, as a plugin on the
// `derive` hook, backed by IronCalc (WASM, loaded on first use). Spec:
// work/open/W-16-formulas.md. The JavaScript workbook is the only source of
// truth (SR-LAW-9): the IronCalc model is a cache built from it, rebuilt when
// the workbook object changes, and only ever written to — never read back as
// state except for the values it computes.
//
// Importing this module registers the plugin id `formulas` and touches no WASM.
import { formulaRefs, registerPlugin, type DeriveInput, type DerivedChange, type Plugin, type PluginContext, type WorkbookStore } from '@sheetpane/grid';
import { cellRef, isError, parseRef, type Book, type BookSheet, type Cell } from './cells.js';
import { patchWorkbook, type FormulaCell } from './export.js';
import { CIRCULAR, ENGINE_ERRORS, FormulaModel, engineFormula, loadEngine, type WasmSource } from './model.js';

export { engineLoaded } from './model.js';
export { formulaIn, valueIn } from './cells.js';
export type { WasmSource } from './model.js';

export interface FormulasOptions {
  /** Load the WASM engine now rather than on the first `derive` that needs it. */
  preload?: boolean;
  /** Where the engine's `.wasm` comes from: a URL, a `Response`, the bytes or a compiled module. Default: beside `@ironcalc/wasm`'s `wasm.js`, as the host's bundler emits it. */
  wasm?: WasmSource;
}

export interface CellAddress { sheet: string; ref: string }

/** The headless plugin, plus what the UI and hosts read from it. */
export interface FormulasPlugin extends Plugin {
  /** Resolves when every queued recalculation has finished. */
  ready(): Promise<void>;
  /** The store this plugin last derived for (set on the first `derive`). */
  readonly store: WorkbookStore | undefined;
  /** Formula cells in a circular reference, as of the last recalculation (Excel shows them as 0). */
  cycles(): CellAddress[];
  /** Formula cells from the file that IronCalc cannot calculate (`#NAME?`, a parse error, `#SPILL!` over a legacy array): their saved value is kept. */
  unsupported(): CellAddress[];
  /** A cell's standing with the engine: in a circular reference, or a file formula IronCalc cannot calculate. */
  stateOf(sheet: string, ref: string): 'cycle' | 'unsupported' | undefined;
  /** Whether a model is built for the current workbook (false for a workbook with no formulas until one is typed). */
  built(): boolean;
  /** A formula's value at a cell, synchronously (`@sheetpane/validation`'s `custom` rules); `undefined` until the model is built. */
  evaluate(formula: string, at: CellAddress): Cell | undefined;
}

const k = (sheet: string, ref: string) => `${sheet}!${ref}`;
const REACH_ANYWHERE = /\b(?:INDIRECT|OFFSET)\s*\(/i;
const NUMERIC = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const REL = 1e-14; // IronCalc reads back 15 significant digits; Excel caches 17

/** Equal as a reviewer would see them: numbers to 15 significant digits, empty text as empty. */
export function sameValue(a: Cell, b: Cell): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a === b || Math.abs(a - b) <= REL * Math.max(Math.abs(a), Math.abs(b));
  return (a ?? '') === (b ?? '');
}

/** A result IronCalc gives where Excel, which saved the file, gave something else it could compute. */
const engineCannot = (v: Cell) => typeof v === 'string' && (ENGINE_ERRORS.has(v) || v === '#NAME?' || v === '#SPILL!');

interface Addr { sheet: string; ref: string; si: number; row: number; col: number }
/** The cell `evaluate()` borrows: the sheet's last cell, which no workbook sheetpane opens reaches. */
const SCRATCH_ROW = 1_048_575, SCRATCH_COL = 16_383;

class Engine {
  book: Book | undefined;
  store: WorkbookStore | undefined;
  model: FormulaModel | undefined;
  private sheets = new Map<string, number>();
  private formulas = new Map<string, Addr>();
  private last = new Map<string, Cell>();
  private fed = new Set<number>();
  private allFed = false;
  readonly cycles = new Set<string>();
  readonly unsupported = new Set<string>();
  private chain: Promise<unknown> = Promise.resolve();
  private batch: { cells: CellAddress[]; promise: Promise<DerivedChange[]> } | undefined;
  private edits = 0;
  /** The engine or a build failed for this workbook: no retry on every keystroke, only on the next load. */
  private failed = false;

  constructor(private readonly o: FormulasOptions) {}

  derive(input: DeriveInput, ctx: PluginContext): Promise<DerivedChange[]> {
    this.store = ctx.store;
    if (input.kind === 'load') {
      this.batch = undefined;
      return this.enqueue(() => this.load(ctx));
    }
    // Changes queued behind a running recalculation share one evaluation (fast typing, paste).
    if (this.batch) { this.batch.cells.push(...input.cells); return this.batch.promise; }
    const batch: { cells: CellAddress[]; promise: Promise<DerivedChange[]> } = { cells: [...input.cells], promise: Promise.resolve([]) };
    batch.promise = this.enqueue(() => { if (this.batch === batch) this.batch = undefined; return this.change(batch.cells, ctx); });
    this.batch = batch;
    return batch.promise;
  }

  /** Settles after the queue is idle *and* the store has merged the last result (it does so a microtask after ours). */
  ready(): Promise<void> { return this.chain.then(() => new Promise<void>((r) => setTimeout(r, 0))); }

  private enqueue(fn: () => Promise<DerivedChange[]> | DerivedChange[]): Promise<DerivedChange[]> {
    const p = this.chain.then(fn);
    this.chain = p.catch(() => undefined);
    return p.catch((e: unknown) => {
      console.error('sheetpane formulas: recalculation failed; the saved values stay until the next workbook', e);
      this.reset();
      this.failed = true;
      return [];
    });
  }

  private reset(): void {
    this.model?.free();
    this.model = undefined;
    this.sheets.clear(); this.formulas.clear(); this.last.clear(); this.fed.clear();
    this.allFed = false; this.cycles.clear(); this.unsupported.clear();
  }

  /**
   * One formula's value at a cell, synchronously, without touching the workbook (W-18's `custom` rules):
   * the formula is set in a scratch cell on that sheet, evaluated, read and cleared. `undefined` until a
   * model is built, for an unknown sheet, or for a cycle.
   */
  evaluate(formula: string, at: CellAddress): Cell | undefined {
    const model = this.model, si = this.sheets.get(at.sheet);
    if (!model || si === undefined || this.batch) return undefined;
    const f = `=${engineFormula(formula.replace(/^=/, ''))}`;
    this.feedRefs(f, at.sheet, this.changedCells());
    model.set(si, SCRATCH_ROW, SCRATCH_COL, f);
    model.evaluate();
    const v = model.read(si, SCRATCH_ROW, SCRATCH_COL);
    model.set(si, SCRATCH_ROW, SCRATCH_COL, '', false);
    return v === CIRCULAR ? undefined : v;
  }

  // ── the JavaScript workbook, as IronCalc input ──────────────────────────
  /** What the cell holds now, as a user would type it into IronCalc: a formula, a number, `'text`, or '' for empty. */
  private inputOf(sheet: BookSheet, ref: string, row: number, col: number): string {
    const c = this.store!.changeOf(sheet.name, ref);
    if (c && c.kind === 'formula' && typeof c.now === 'string') return engineFormula(c.now);
    if (c && c.kind === 'value') return this.literal(c.now as Cell);
    const f = sheet.formulas[ref];
    if (f !== undefined) return `=${engineFormula(f)}`;
    return this.literal(sheet.rows[row]?.[col] ?? null);
  }

  private literal(v: Cell): string {
    if (v === null || v === '') return '';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'number') return String(v);
    if (isError(v)) return v;
    // A .csv keeps every cell as text; Excel reads its numbers as numbers, so a formula over one does too.
    if (this.book?.source === 'csv' && NUMERIC.test(v.trim())) return v.trim();
    return `'${v}`;
  }

  /** The formula cells of the workbook as it is now: the file's, less those a value replaced, plus typed ones. */
  private currentFormulas(book: Book): Map<string, Addr> {
    const out = new Map<string, Addr>();
    const snap = this.store!.getSnapshot();
    book.sheets.forEach((s, si) => {
      for (const ref of Object.keys(s.formulas)) {
        const c = snap.changes.get(k(s.name, ref));
        if (c && c.kind === 'value') continue;
        const p = parseRef(ref);
        if (p) out.set(k(s.name, ref), { sheet: s.name, ref, si, ...p });
      }
    });
    for (const [key, c] of snap.changes) {
      if (c.kind !== 'formula') continue;
      const i = key.lastIndexOf('!');
      const sheet = key.slice(0, i), ref = key.slice(i + 1), si = book.sheets.findIndex((s) => s.name === sheet), p = parseRef(ref);
      if (si >= 0 && p) out.set(key, { sheet, ref, si, ...p });
    }
    return out;
  }

  // ── feeding the model only what formulas read ──────────────────────────
  private feedCell(si: number, row: number, col: number): void {
    const id = si * 2 ** 34 + row * 16_384 + col;
    if (this.fed.has(id)) return;
    this.fed.add(id);
    const sheet = this.book!.sheets[si]!, ref = cellRef(row, col);
    if (this.formulas.has(k(sheet.name, ref))) return; // fed as a formula
    const input = this.inputOf(sheet, ref, row, col);
    if (input !== '') this.model!.set(si, row, col, input, false);
  }

  /** Every non-empty cell of a box — the file's and the user's — goes into the model once. */
  private feedBox(si: number, box: { top: number; left: number; bottom: number; right: number }, changed: readonly Addr[]): void {
    const sheet = this.book!.sheets[si]!;
    const bottom = Math.min(box.bottom, sheet.rows.length - 1);
    for (let r = box.top; r <= bottom; r++) {
      const row = sheet.rows[r];
      if (!row) continue;
      const right = Math.min(box.right, row.length - 1);
      for (let c = box.left; c <= right; c++) if (row[c] !== null && row[c] !== undefined) this.feedCell(si, r, c);
    }
    for (const a of changed) if (a.si === si && a.row >= box.top && a.row <= box.bottom && a.col >= box.left && a.col <= box.right) this.feedCell(si, a.row, a.col);
  }

  private feedAll(changed: readonly Addr[]): void {
    if (this.allFed) return;
    this.allFed = true;
    this.book!.sheets.forEach((s, si) => this.feedBox(si, { top: 0, left: 0, bottom: s.rows.length - 1, right: 16_383 }, changed));
  }

  /** Feeds what one formula (or defined name) reads. */
  private feedRefs(formula: string, sheet: string, changed: readonly Addr[]): void {
    if (this.allFed) return;
    if (REACH_ANYWHERE.test(formula)) { this.feedAll(changed); return; }
    for (const r of formulaRefs(formula, sheet)) {
      const si = this.sheets.get(r.sheet);
      if (si !== undefined && r.range) this.feedBox(si, r.range, changed);
    }
  }

  private changedCells(): Addr[] {
    const out: Addr[] = [];
    for (const [key, c] of this.store!.getSnapshot().changes) {
      if (c.kind !== 'value' && c.kind !== 'formula') continue;
      const i = key.lastIndexOf('!'), sheet = key.slice(0, i), ref = key.slice(i + 1), si = this.sheets.get(sheet), p = parseRef(ref);
      if (si !== undefined && p) out.push({ sheet, ref, si, ...p });
    }
    return out;
  }

  // ── build ───────────────────────────────────────────────────────────────
  private async build(book: Book): Promise<DerivedChange[]> {
    this.reset();
    this.book = book;
    const formulas = this.currentFormulas(book);
    // nothing to calculate — no formula and no custom validation rule to evaluate: the engine is not even loaded
    if (!formulas.size && !book.sheets.some((s) => s.dataValidations.some((d) => d.type === 'custom'))) return [];
    const lib = await loadEngine(this.o.wasm);
    if (this.book !== book) return [];
    this.formulas = formulas;
    book.sheets.forEach((s, i) => this.sheets.set(s.name, i));
    const model = (this.model = new FormulaModel(lib, book.sheets.map((s) => s.name)));
    const names = book.definedNames.filter((n) => !/^_xlnm\./i.test(n.name));
    for (const n of names) model.defineName(n.name, n.localSheetId, n.formula);
    model.pause();
    const changed = this.changedCells();
    const width = book.sheets.map((s) => s.rows.reduce((m, r) => Math.max(m, r.length), 0));
    for (const a of formulas.values()) {
      model.set(a.si, a.row, a.col, this.inputOf(book.sheets[a.si]!, a.ref, a.row, a.col), false);
      width[a.si] = Math.max(width[a.si]!, a.col + 1);
    }
    for (const a of changed) width[a.si] = Math.max(width[a.si]!, a.col + 1);
    for (const n of names) this.feedRefs(n.formula, n.localSheetId !== undefined ? book.sheets[n.localSheetId]?.name ?? '' : '', changed);
    for (const a of formulas.values()) this.feedRefs(this.inputOf(book.sheets[a.si]!, a.ref, a.row, a.col), a.sheet, changed);
    width.forEach((w, si) => model.restyleColumns(si, w));
    model.evaluate();
    model.trim();
    const store = this.store!, out: DerivedChange[] = [];
    for (const [key, a] of formulas) {
      const v = model.read(a.si, a.row, a.col);
      this.last.set(key, v);
      const typed = store.changeOf(a.sheet, a.ref)?.kind === 'formula';
      const saved = book.sheets[a.si]!.rows[a.row]?.[a.col] ?? null;
      if (!typed && engineCannot(v) && !sameValue(v, saved)) { this.unsupported.add(key); continue; }
      const shown = this.shown(key, v);
      if (typed || !sameValue(shown, saved)) out.push(this.derived(a, shown));
    }
    return out;
  }

  /** A circular reference shows 0, as Excel shows it; the cell is listed in `cycles()`. */
  private shown(key: string, v: Cell): Cell {
    if (v === CIRCULAR) { this.cycles.add(key); return 0; }
    this.cycles.delete(key);
    return v;
  }

  private derived(a: { sheet: string; ref: string }, value: Cell): DerivedChange {
    return { sheet: a.sheet, ref: a.ref, value, text: this.store!.format(a.sheet, a.ref, value) };
  }

  private load(ctx: PluginContext): Promise<DerivedChange[]> {
    this.failed = false;
    return this.build(ctx.book);
  }

  // ── a change ────────────────────────────────────────────────────────────
  private async change(cells: CellAddress[], ctx: PluginContext): Promise<DerivedChange[]> {
    const book = ctx.book;
    // A new workbook object, or the first formula typed into a workbook that had none: build from the workbook as it is.
    if (book !== this.book || (!this.model && !this.failed)) {
      if (book === this.book && !this.currentFormulas(book).size) return [];
      this.failed = false;
      return this.build(book);
    }
    if (!this.model) return [];
    const model = this.model, store = ctx.store;
    const seen = new Set<string>(), typed = new Set<string>(), gone: Addr[] = [];
    const changed = this.changedCells();
    model.pause();
    for (const c of cells) {
      const key = k(c.sheet, c.ref);
      const si = this.sheets.get(c.sheet), p = parseRef(c.ref);
      if (seen.has(key) || si === undefined || !p) continue;
      seen.add(key);
      const sheet = book.sheets[si]!, a: Addr = { sheet: c.sheet, ref: c.ref, si, ...p };
      const input = this.inputOf(sheet, c.ref, p.row, p.col);
      if (input.startsWith('=')) {
        this.formulas.set(key, a);
        this.unsupported.delete(key);
        if (store.changeOf(c.sheet, c.ref)?.kind === 'formula') typed.add(key);
        this.feedRefs(input, c.sheet, changed);
      } else if (this.formulas.delete(key)) {
        this.last.delete(key); this.cycles.delete(key); this.unsupported.delete(key);
        gone.push(a);
      }
      this.fed.add(si * 2 ** 34 + p.row * 16_384 + p.col);
      model.set(si, p.row, p.col, input);
    }
    model.evaluate();
    if (++this.edits % 50 === 0) model.trim();
    const out: DerivedChange[] = [];
    for (const [key, a] of this.formulas) {
      const v = model.read(a.si, a.row, a.col);
      const prev = this.last.get(key);
      this.last.set(key, v);
      if (this.unsupported.has(key)) {
        if (engineCannot(v)) continue;
        this.unsupported.delete(key);
      } else if (!typed.has(key) && !seen.has(key) && prev !== undefined && sameValue(v, prev)) continue;
      const shown = this.shown(key, v);
      // a file formula back at its saved value is not recalculated any more: drop its derived entry
      if (!typed.has(key) && sameValue(shown, book.sheets[a.si]!.rows[a.row]?.[a.col] ?? null) && store.changeOf(a.sheet, a.ref)?.kind !== 'formula') {
        if (store.getSnapshot().derived.has(key)) out.push({ sheet: a.sheet, ref: a.ref, value: null, text: '', clear: true });
        continue;
      }
      out.push(this.derived(a, shown));
    }
    // A typed formula reverted to nothing: its derived value would otherwise outlive it.
    for (const a of gone) if (!store.changeOf(a.sheet, a.ref)) out.push({ sheet: a.sheet, ref: a.ref, value: null, text: '', clear: true });
    return out;
  }

  // ── export ──────────────────────────────────────────────────────────────
  /** Every formula cell to rewrite: typed formulas get `<f>` + `<v>`; recalculated file formulas a new `<v>`. */
  exportCells(ctx: PluginContext): Map<string, Map<string, FormulaCell>> {
    const snap = ctx.snapshot(), out = new Map<string, Map<string, FormulaCell>>();
    const put = (sheet: string, ref: string, c: FormulaCell) => { let m = out.get(sheet); if (!m) out.set(sheet, (m = new Map())); m.set(ref, c); };
    for (const [key, c] of snap.changes) {
      if (c.kind !== 'formula' || typeof c.now !== 'string') continue;
      const i = key.lastIndexOf('!');
      put(key.slice(0, i), key.slice(i + 1), { formula: c.now.replace(/^=/, ''), value: snap.derived.get(key)?.value });
    }
    for (const [key, d] of snap.derived) {
      if (snap.changes.has(key)) continue;
      const i = key.lastIndexOf('!'), sheet = key.slice(0, i), ref = key.slice(i + 1);
      if (ctx.book.sheets.find((s) => s.name === sheet)?.formulas[ref] === undefined) continue;
      put(sheet, ref, { value: d.value });
    }
    return out;
  }
}

/** The formulas plugin: `derive` recalculates through IronCalc; `exportPatch` writes `<f>` and cached `<v>`. */
export function formulas(o: FormulasOptions = {}): FormulasPlugin {
  const e = new Engine(o);
  if (o.preload) loadEngine(o.wasm).catch((err: unknown) => console.error('sheetpane formulas: the engine did not load', err));
  const list = (s: Set<string>): CellAddress[] => {
    const order = (a: CellAddress) => { const p = parseRef(a.ref)!; return [e.book?.sheets.findIndex((x) => x.name === a.sheet) ?? 0, p.row, p.col] as const; };
    return [...s].map((key) => { const i = key.lastIndexOf('!'); return { sheet: key.slice(0, i), ref: key.slice(i + 1) }; })
      .sort((a, b) => { const x = order(a), y = order(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; });
  };
  return {
    id: 'formulas',
    provides: ['derive', 'exportPatch'],
    derive: (input, ctx) => e.derive(input, ctx),
    async exportPatch(patch, ctx) {
      await e.ready();
      await patchWorkbook(patch, e.exportCells(ctx));
    },
    ready: () => e.ready(),
    get store() { return e.store; },
    cycles: () => list(e.cycles),
    unsupported: () => list(e.unsupported),
    stateOf: (sheet, ref) => (e.cycles.has(k(sheet, ref)) ? 'cycle' : e.unsupported.has(k(sheet, ref)) ? 'unsupported' : undefined),
    built: () => !!e.model,
    evaluate: (formula, at) => e.evaluate(formula, at),
  };
}

registerPlugin('formulas', () => formulas());
