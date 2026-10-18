// <sheetpane-excel> — the sheet: the view and edit components as two modes of one
// element (W-01). Plain DOM in an open shadow root (grid verdict decisions 2, 6);
// every byte of state lives in the pane's store (L7); the contract is the DOM's (L4).
import { cellRef, codeOf, colName, detailOf, download, parseRange, parseRef, spError, spMessage, type Cell, type RangePos } from '@sheetpane/export';
import type { ImportedSheet } from '@sheetpane/import';
import { controlsFor } from '../plugins/host.js';
import type { ControlDescriptor, Geometry } from '../plugins/types.js';
import { acquirePane, attach, detach, isPrimary, releasePane } from '../pane/registry.js';
import { createWorkbook, parseInput, splitKey, type StoreEvent, type WorkbookStore } from '../pane/store.js';
import { BUILTIN_TYPE_NAMES, DEFAULT_ERROR_TYPES, SEVERITY, machineAuthored, type ErrorType, type Mode, type SheetpaneError, type Severity } from '../pane/types.js';
import { ElementBase, ICON, esc, fire } from '../shared/dom.js';
import { pluginsFromIds } from '../plugins/host.js';
import type { Theme } from '../tokens.js';
import type { ColumnRules, ColumnRulesConfig, OnInvalid, RuleOutcome, ValidateFn } from '../pane/rules.js';
import { COL_MAX, COL_MIN, COL_VIRTUAL_AFTER, DEFAULT_COL_PX, HEAD_H, ROWHEAD_W, ROW_H, ROW_MAX, ROW_MIN, colAt, colWidth, hiddenSpans, isHiddenAt, mergeAt, rowAt, rowHeight, rowTop, sheetGeometry, visibleWindow, type SheetGeometry, type SheetSizes } from './geometry.js';
import { cellCount, clipOf, dataEdge, growForMerges, rangeText, refLabel, spanOf, splitByPanes, totalsOf, usedRange, type Pos } from './selection.js';
import { EXCEL_CSS } from './styles.js';

const ZOOMS = [0.75, 1, 1.25, 1.5];
type Refs = Record<'help' | 'grid' | 'root' | 'dialog' | 'fname' | 'meta' | 'counts' | 'findin' | 'findcnt' | 'zoom' | 'editonly' | 'undo' | 'redo' | 'freeze' | 'changes' | 'export' | 'dlmore' | 'dlslot' | 'close' | 'ref' | 'cell' | 'cellname' | 'val' | 'merge' | 'changed' | 'revert' | 'issue' | 'hint' | 'rulemsg' | 'dock' | 'plugCellbar' | 'frow' | 'plugFrow' | 'body' | 'scroller' | 'sheet' | 'hrow' | 'frozen' | 'rows' | 'sellayer' | 'hidlayer' | 'hidbar' | 'hidmenuslot' | 'selsay' | 'overlay' | 'state' | 'tabs' | 'status' | 'picker' | 'modeseg', HTMLElement>;
const MAX_BYTES = 50 * 2 ** 20;
/** A size kept inside the limits (W-47 DoD 1): columns 16–1,200 px, rows 12–600 px, at 100 %. */
const clampSize = (axis: 'col' | 'row', px: number) => Math.round(axis === 'col' ? Math.min(COL_MAX, Math.max(COL_MIN, px)) : Math.min(ROW_MAX, Math.max(ROW_MIN, px)));
/** A drag in progress: where it started, where the pointer is, what it selects, and the selection to restore on Esc. */
type Drag = { id: number; anchor: Pos; focus: Pos; kind: 'cell' | 'col' | 'row'; before: { sheet: string; ref: string; range?: string }; x: number; y: number };

/** Turns a `src` attribute value into bytes: a data URL, raw base64, or a URL to fetch (a read; nothing is sent). */
export async function bytesFromSrc(src: string): Promise<{ bytes: Uint8Array; name: string }> {
  const b64 = (s: string) => Uint8Array.from(atob(s.replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  const guessName = (b: Uint8Array) => (b[0] === 0x50 && b[1] === 0x4b ? 'workbook.xlsx' : 'data.csv');
  if (src.startsWith('data:')) {
    const comma = src.indexOf(',');
    const meta = src.slice(5, comma), body = src.slice(comma + 1);
    const bytes = /;base64$/.test(meta) ? b64(body) : new TextEncoder().encode(decodeURIComponent(body));
    return { bytes, name: /csv/.test(meta) ? 'data.csv' : /sheet/.test(meta) ? 'workbook.xlsx' : guessName(bytes) };
  }
  if (src.length > 64 && /^[A-Za-z0-9+/=\s]+$/.test(src)) { const bytes = b64(src); return { bytes, name: guessName(bytes) }; }
  const res = await fetch(src, { credentials: 'same-origin' });
  if (!res.ok) throw spError('SP-3015', `could not read ${src} (HTTP ${res.status})`);
  const name = decodeURIComponent(new URL(src, location.href).pathname.split('/').pop() || 'workbook.xlsx');
  return { bytes: new Uint8Array(await res.arrayBuffer()), name };
}

/** The text the cell bar shows for a value: raw, as Excel's formula bar does. */
const rawText = (v: unknown) => (v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v));
const sevOrder: Record<Severity, number> = { error: 3, warning: 2, note: 1 };
const errNum = (e: SheetpaneError) => Number(/(\d+)$/.exec(e.id)?.[1] ?? 0);

/**
 * `<sheetpane-excel>` — the sheet: views and edits a `.xlsx` or `.csv` file held in the pane's
 * in-memory workbook (SR-GRID decisions 9–22e). Every change stays in memory and `export()`
 * writes a copy of the upload with it (SR-LAW-6); a `<sheetpane-errors>` on the same `pane`
 * reads the same store, so the two are always in step (SR-LAW-7). It registers on import.
 *
 * Attributes:
 * - `pane` — the pane id shared with other elements; none gives the element its own store.
 * - `src` — a URL (read with a GET; nothing is sent), a data URL or base64.
 * - `mode` — `view` (the default) or `edit`.
 * - `display` — `tab` (the default) or `popup` (a modal dialog, shown by `open`).
 * - `open` — shows the pop-up.
 * - `author` — written into the errors this element's user flags.
 * - `plugins` — space-separated registered plugin ids; fixed per pane.
 * - `theme` — `light` (the default), `dark` or `auto`.
 * - `header-row` — the 1-based row holding column titles (default 1).
 * - `on-invalid` — `flag` (the default) or `block`: what a failing column rule does.
 * - `rules-src` — a URL to a rules file (read with a GET).
 * - `flagging` — `on` (the default) or `off`: no Flag issue anywhere.
 *
 * Properties: `workbook`, `errors`, `errorTypes`, `file`, `mode`, `theme`, `open`, `src`, `sizes`,
 * `rules`, `flagging`, `columns`, `validate`, `onInvalid`.
 *
 * Methods: `load()`, `export()`, `select()`, `getErrors()`, `setErrors()`, `undo()`, `redo()`,
 * `shortcuts()`, `column()`, `renderNow()`, `geometryFor()`, `reveal()`, `unreveal()`.
 *
 * Every event bubbles and is composed; an action's event fires once, on the element where it
 * happened. Cell payloads also carry `column: { index, letter, header }`.
 *
 * @fires sheetpane-load `{ status: 'ready', name, kind, sheets, readMs }` when a file is read, or the refusal `{ status: 'error', code, spCode, message, name, detail? }`.
 * @fires sheetpane-change `{ sheet, ref, kind, was, now }` for each change, undo and redo included.
 * @fires sheetpane-errors `{ errors, plugins }` when the pane's errors change.
 * @fires sheetpane-select `{ sheet, ref, range, column, value }` when the selection settles — `range` (`B3:D8`) when more than one cell is selected; a drag fires once, on release.
 * @fires sheetpane-visibility `{ sheet, axis, indexes, hidden, via }` when rows, columns or a sheet are hidden, unhidden or shown for viewing (`via: 'reveal'`) (W-49).
 * @fires sheetpane-resize `{ sheet, axis, indexes, px, via }` when a column width or row height is set by a drag, a fit, the header menu or a reset — on release, never during a drag (W-47).
 * @fires sheetpane-sheet `{ sheet }` when the selection moves to another sheet.
 * @fires sheetpane-mode `{ mode }` when the pane switches between View and Edit.
 * @fires sheetpane-history `{ reason, canUndo, canRedo }` on undo, redo, or the stack cleared by `setErrors()`.
 * @fires sheetpane-editstart `{ sheet, ref, column, value }` before a cell edit starts; cancellable — the cell stays read-only.
 * @fires sheetpane-input `{ sheet, ref, column, draft, was }` as the cell-bar draft is typed.
 * @fires sheetpane-beforechange `{ sheet, ref, column, was, now }` before a value is stored; cancellable — the value is refused.
 * @fires sheetpane-editcancel `{ sheet, ref }` when Esc restores a draft, or `{ sheet, ref, reason: 'blocked', code: 'SP-6003', message }` when a `block` rule refuses it.
 * @fires sheetpane-export `{ blob, kind, name, guarded, format, converted, original? }` on `export()` and Download; cancellable — the Download control then saves nothing.
 * @fires sheetpane-close `{}` when the pop-up closes.
 *
 * @slot format-row - Host controls for the format row (Edit only); the row shows when a plugin or this slot puts something in it.
 * @csspart root - The sheet's frame: toolbar, cell bar, format row, grid, sheet tabs and status line.
 * @csspart toolbar - The top bar: file, View/Edit, counts, find, zoom, undo, redo, freeze, Download.
 * @csspart cellbar - The cell bar: the reference, the value being edited and the docked selection actions.
 * @csspart format-row - The format row (Edit): plugin controls and the `format-row` slot.
 * @csspart status - The status line under the sheet tabs.
 * @csspart dialog - The modal `<dialog>` the root moves into when `display="popup"`.
 *
 * @example
 * ```ts
 * import '@sheetpane/grid';
 * const sheet = document.createElement('sheetpane-excel');
 * sheet.setAttribute('pane', 'q3');
 * sheet.setAttribute('mode', 'edit');
 * document.body.append(sheet);
 * sheet.addEventListener('sheetpane-change', (e) => console.log((e as CustomEvent).detail));
 * await sheet.load(file);
 * const blob = await sheet.export();
 * ```
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md
 * @see https://github.com/arpitarya/sheetpane/blob/main/packages/grid/README.md#sheetpane-excel
 */
export class SheetpaneExcel extends ElementBase {
  /** The attributes the element reacts to. */
  static observedAttributes = ['pane', 'src', 'mode', 'display', 'open', 'author', 'plugins', 'header-row', 'on-invalid', 'rules-src', 'flagging'];

  private _store: WorkbookStore | undefined;
  private _explicitStore: WorkbookStore | undefined;
  private _paneId: string | undefined;
  private _errorTypes: readonly ErrorType[] = DEFAULT_ERROR_TYPES;
  private unsub: (() => void)[] = [];
  private shadow!: ShadowRoot;
  private q!: Refs;
  private built = false;
  private raf = 0;
  private zoom = 1;
  private findText = '';
  private findHits: { sheet: string; ref: string }[] = [];
  private findIdx = -1;
  private findVersion = -1;
  private scrollToSel = false;
  private anchor: { row: number; col: number } | undefined;
  /** A drag in progress (W-46): drawn by the selection layer each frame; the store hears of it on release. */
  private drag: Drag | undefined;
  private dragRaf = 0;
  /** The last pointer was a finger: a range shows its two handles. */
  private touchUi = false;
  /** The range Ctrl/⌘+C copied, outlined until Esc, an edit or the next copy. */
  private copied: { sheet: string; range: RangePos } | undefined;
  private selKey = '';
  private ariaOn = new Set<Element>();
  private sayTimer: ReturnType<typeof setTimeout> | undefined;
  private totalsKey: unknown[] = [];
  /** Column widths and row heights the user set, per sheet, px at 100 % — a view setting, never a change (W-47). */
  private _sizes: Record<string, { cols: Record<number, number>; rows: Record<number, number> }> = {};
  private sizesVer = 0;
  /** A header-edge drag in progress (W-47). */
  private rz: { id: number; axis: 'col' | 'row'; indexes: number[]; start: number; from: number; px: number; moved: boolean; before: { cols: Record<number, number>; rows: Record<number, number> } | undefined } | undefined;
  private rzRaf = 0;
  /** What this element shows of what the file hides, per sheet — a view setting, never a change (W-49). */
  private revealed: Record<string, { rows: Set<number>; cols: Set<number>; all: boolean }> = {};
  /** Hidden sheets opened for viewing from the hidden-sheets list (W-49). */
  private openedSheets = new Set<string>();
  /** The note after an automatic reveal: "Shown for ERR-0004 · Hide again". */
  private revealNote: { sheet: string; text: string; rows: number[]; cols: number[] } | undefined;
  private hiddenMenuOpen = false;
  /** The tab menu (W-49): right-click a tab or Shift+F10 on it; only plugin items, so it opens only when there are some. */
  private tabMenu: { sheet: string; x: number } | undefined;
  private revealVer = 0;
  /** The header menu (W-47 DoD 4): which axis and indexes it acts on, and the exact-size popover's state. */
  private hdrMenu: { axis: 'col' | 'row'; indexes: number[]; sizing: boolean } | undefined;
  private totalsText = '';
  private composerKey = '';
  private draft = { type: 'wrong-value', message: '', expected: '', severity: 'error' as Severity, change: false };
  private geom: { sheet: ImportedSheet; g: SheetGeometry } | undefined;
  private lastBody = '';
  private cellFocusStart: string | undefined;
  private overlayCache = new Map<string, HTMLElement>();
  private readonly onUnload = (e: BeforeUnloadEvent) => { if (this._store && this._store.changeCount > 0) { e.preventDefault(); e.returnValue = ''; } };

  // ── the DOM contract: properties ─────────────────────────────────────────
  /** The pane's store; assigning one replaces the `pane` lookup and applies this element's `mode` to it. */
  get workbook(): WorkbookStore | undefined { return this._store; }
  set workbook(s: WorkbookStore | undefined) {
    this._explicitStore = s;
    if (!this.isConnected) return;
    this.unbind(); this.bind();
    const m = this.getAttribute('mode'); // the element's mode applies to the store it is given, as on connect
    if (m === 'edit' || m === 'view') this._store!.setMode(m, this);
    this.schedule();
  }
  /** A copy of the pane's errors; assigning restores a saved review, like `setErrors()`. */
  get errors(): SheetpaneError[] { return this._store?.getErrors() ?? []; }
  set errors(list: SheetpaneError[]) { this.setErrors(list); }
  /** The types offered in the Flag issue form; an empty list falls back to `DEFAULT_ERROR_TYPES`. */
  get errorTypes(): readonly ErrorType[] { return this._errorTypes; }
  set errorTypes(t: readonly ErrorType[]) { this._errorTypes = t.length ? t : DEFAULT_ERROR_TYPES; this.schedule(); }
  /** Loads a file, like `load()`; `null` does nothing. */
  set file(f: File | Blob | ArrayBuffer | Uint8Array | null) { if (f) void this.load(f); }
  /** The pane's mode, `view` or `edit`; setting it sets the `mode` attribute. */
  get mode(): Mode { return this._store?.getSnapshot().mode ?? ((this.getAttribute('mode') as Mode) || 'view'); }
  set mode(m: Mode) { this.setAttribute('mode', m); }
  /** `light` (the default), `dark`, or `auto` (follows `prefers-color-scheme`) — colour only; the file's own colours never change (W-29). */
  get theme(): Theme { const t = this.getAttribute('theme'); return t === 'dark' || t === 'auto' ? t : 'light'; }
  set theme(t: Theme) { this.setAttribute('theme', t); }

  // ── column rules (W-27) and the rules file (W-33): the pane's, set from here ──
  private rulesCfg: { columns?: ColumnRules; validate?: ValidateFn | undefined; document?: unknown } | undefined;
  /** A rules file (W-33) as an object: `{ version: 1, sheets: { "*": …, "Accounts": { headerRow, columns, cells } } }`. Also `rules-src`. */
  get rules(): unknown { return this.rulesCfg?.document; }
  set rules(doc: unknown) {
    if (doc === undefined || doc === null) { if (this.rulesCfg) { const { document: _drop, ...rest } = this.rulesCfg; this.rulesCfg = rest; } }
    else this.rulesCfg = { ...this.rulesCfg, document: doc };
    this.applyRules();
  }
  /** `rules-src`: a URL read with a GET, like `src` (nothing is sent); a failure is a note in the errors, never a throw. */
  private async loadRules(url: string): Promise<void> {
    let doc: unknown;
    try { const res = await fetch(url, { credentials: 'same-origin' }); doc = res.ok ? JSON.parse(await res.text()) : { __error: `${url}: HTTP ${res.status}` }; }
    catch (e) { doc = { __error: `${url}: ${(e as Error).message}` }; }
    if (this.getAttribute('rules-src') === url) this.rules = doc;
  }
  /** `flagging="off"`: no Flag issue anywhere, no composer, no callout card — the errors panel is the one place errors are read. */
  get flagging(): 'on' | 'off' { return this.getAttribute('flagging') === 'off' ? 'off' : 'on'; }
  set flagging(v: 'on' | 'off') { this.setAttribute('flagging', v); }
  /** Rules by column title, as plain JSON (`required`, `type`, `min`, `max`, `minLength`, `maxLength`, `pattern`, `oneOf`, `unique`, `message`, `severity`, `onInvalid`). */
  get columns(): ColumnRules | undefined { return this.rulesCfg?.columns; }
  set columns(c: ColumnRules | undefined) { this.rulesCfg = { ...this.rulesCfg, columns: c ?? {} }; this.applyRules(); }
  /** `validate(ctx, signal)`, sync or async: `null`, or `{ severity, message, expected? }`. */
  get validate(): ValidateFn | undefined { return this.rulesCfg?.validate; }
  set validate(f: ValidateFn | undefined) { this.rulesCfg = { ...this.rulesCfg, validate: f }; this.applyRules(); }
  /** The default for every rule: `flag` (store and add an error) or `block` (refuse the value). Also the `on-invalid` attribute. */
  get onInvalid(): OnInvalid { return this.getAttribute('on-invalid') === 'block' ? 'block' : 'flag'; }
  set onInvalid(v: OnInvalid) { this.setAttribute('on-invalid', v); }
  /** Rules belong to the pane: only an element that was given rules sets them. */
  private applyRules(): void {
    if (!this.rulesCfg || !this._store) return;
    const c: ColumnRulesConfig = { columns: this.rulesCfg.columns ?? {}, validate: this.rulesCfg.validate, onInvalid: this.onInvalid, headerRow: Math.max(1, Number(this.getAttribute('header-row') ?? 1) || 1) };
    if (this.rulesCfg.document !== undefined) c.document = this.rulesCfg.document;
    this._store.setColumnRules(c);
  }
  /** Whether the pop-up is shown (the `open` attribute). */
  get open(): boolean { return this.hasAttribute('open'); }
  set open(v: boolean) { this.toggleAttribute('open', v); }

  /**
   * The column widths and row heights a user set, px at 100 % zoom: `{ [sheet]: { cols: { B: 120 }, rows: { 4: 40 } } }`
   * (columns by letter, rows by number). A view setting like zoom — not a change, not undone, not in the
   * download; a new file clears it. Set it to restore what a host saved from `sheetpane-resize` (W-47).
   */
  get sizes(): Record<string, { cols: Record<string, number>; rows: Record<string, number> }> {
    const out: Record<string, { cols: Record<string, number>; rows: Record<string, number> }> = {};
    for (const [sheet, z] of Object.entries(this._sizes)) {
      const cols = Object.fromEntries(Object.entries(z.cols).map(([c, px]) => [colName(Number(c)), px]));
      const rows = Object.fromEntries(Object.entries(z.rows).map(([r, px]) => [String(Number(r) + 1), px]));
      if (Object.keys(cols).length || Object.keys(rows).length) out[sheet] = { cols, rows };
    }
    return out;
  }
  set sizes(v: Record<string, { cols?: Record<string, number>; rows?: Record<string, number> }> | null | undefined) {
    const next: Record<string, { cols: Record<number, number>; rows: Record<number, number> }> = {};
    for (const [sheet, z] of Object.entries(v ?? {})) {
      const cols: Record<number, number> = {}, rows: Record<number, number> = {};
      for (const [k, px] of Object.entries(z.cols ?? {})) { const c = parseRef(`${k}1`)?.col; if (c !== undefined && Number.isFinite(px)) cols[c] = clampSize('col', px); }
      for (const [k, px] of Object.entries(z.rows ?? {})) { const r = Number(k) - 1; if (Number.isInteger(r) && r >= 0 && Number.isFinite(px)) rows[r] = clampSize('row', px); }
      next[sheet] = { cols, rows };
    }
    this._sizes = next; this.sizesVer++; this.schedule();
  }
  /** The `src` attribute; `null`, `undefined` or `''` removes it. */
  get src(): string | null { return this.getAttribute('src'); }
  set src(v: string | null | undefined) { if (v === null || v === undefined || v === '') this.removeAttribute('src'); else this.setAttribute('src', v); }

  // ── methods ──────────────────────────────────────────────────────────────
  /** Reads a file into the pane: a File, Blob, bytes, a URL, or base64. */
  async load(src: string | File | Blob | ArrayBuffer | Uint8Array, name?: string): Promise<void> {
    const store = this.ensureStore();
    let data: Uint8Array | Blob | ArrayBuffer, nm = name;
    if (typeof src === 'string') {
      try { const r = await bytesFromSrc(src); data = r.bytes; nm ??= r.name; }
      catch (e) { this.showEmpty = false; store.failLoad(name ?? src, detailOf(e), this, codeOf(e)); return; }
    } else {
      data = src;
      if (!nm && typeof File !== 'undefined' && src instanceof File) nm = src.name;
      if (!nm) { const head = src instanceof Blob ? new Uint8Array(await src.slice(0, 2).arrayBuffer()) : new Uint8Array(src instanceof ArrayBuffer ? src : src.buffer, src instanceof ArrayBuffer ? 0 : src.byteOffset, 2); nm = head[0] === 0x50 && head[1] === 0x4b ? 'workbook.xlsx' : 'data.csv'; }
    }
    this.geom = undefined;
    this.showEmpty = false;
    await store.load(data, nm!, this);
  }

  /** Every change applied; the upload untouched. Also dispatches `sheetpane-export`. */
  async export(options: Readonly<Record<string, unknown>> = {}, o: { format?: 'xlsx' | 'csv'; sheet?: string } = {}): Promise<Blob> {
    const store = this.ensureStore();
    const r = await store.exportFile({ options, ...o, ...(o.format === 'csv' && !o.sheet ? { sheet: store.getSnapshot().selection.sheet } : {}) });
    this.lastExport = { ok: fire(this, 'sheetpane-export', { blob: r.blob, kind: r.kind, name: r.name, guarded: r.guarded, format: r.kind, converted: r.converted }, true), name: r.name };
    return r.blob;
  }
  private lastExport: { ok: boolean; name: string } | undefined;
  private lastSheet = '';

  /** Selects a cell and scrolls to it. */
  select(sheet: string, ref: string): void { this.ensureStore().select({ sheet, ref }, this); this.scrollToSel = true; }
  /** A copy of the pane's errors, to save a review. */
  getErrors(): SheetpaneError[] { return this.errors; }
  /** Restores a saved review; not a user action, so the undo stack is cleared. */
  setErrors(list: SheetpaneError[]): void { this.ensureStore().setErrors(list, this); }
  /** Undoes the pane's last step. */
  undo(): void { this._store?.undo(this); }
  /** Redoes the last undone step. */
  redo(): void { this._store?.redo(this); }

  // ── lifecycle ────────────────────────────────────────────────────────────
  /** Binds to the pane's store, applies `mode`, and reads `src` and `rules-src`. */
  connectedCallback(): void {
    if (!this.built) this.build();
    this.bind();
    const m = this.getAttribute('mode');
    if (m === 'edit' || m === 'view') this._store!.setMode(m, this);
    const src = this.getAttribute('src');
    if (src && this._store!.getSnapshot().load.status === 'empty') void this.load(src);
    const rsrc = this.getAttribute('rules-src');
    if (rsrc && this.rules === undefined) void this.loadRules(rsrc);
    addEventListener('beforeunload', this.onUnload);
    this.place();
    this.schedule();
  }

  /** Releases the pane's store. */
  disconnectedCallback(): void {
    removeEventListener('beforeunload', this.onUnload);
    this.unbind();
    cancelAnimationFrame(this.raf);
  }

  /** Reacts to an observed attribute. */
  attributeChangedCallback(name: string, old: string | null, val: string | null): void {
    if (!this.isConnected || old === val) return;
    if (name === 'pane' || name === 'plugins') { this.unbind(); this.bind(); }
    else if (name === 'src' && val) void this.load(val);
    else if (name === 'mode' && (val === 'view' || val === 'edit')) this._store?.setMode(val, this);
    else if (name === 'display' || name === 'open') this.place();
    else if (name === 'header-row' || name === 'on-invalid') this.applyRules();
    else if (name === 'rules-src') { if (val) void this.loadRules(val); else this.rules = undefined; }
    else if (name === 'flagging') this._store?.setFlagging(val !== 'off');
    this.schedule();
  }

  private ensureStore(): WorkbookStore {
    if (!this._store) this.bind();
    return this._store!;
  }

  private bind(): void {
    if (this._store) return;
    const pane = this.getAttribute('pane');
    const plugins = (this.getAttribute('plugins') ?? '').split(/\s+/).filter(Boolean);
    if (this._explicitStore) this._store = this._explicitStore;
    else if (pane) { this._store = acquirePane(pane, this, plugins); this._paneId = pane; }
    else this._store = createWorkbook({ plugins: pluginsFromIds(plugins) });
    const s = this._store;
    attach(s, this);
    this.unsub.push(s.subscribe(() => this.schedule()), s.on((e) => this.onStoreEvent(e)), () => detach(s, this));
    this.applyRules();
    if (this.hasAttribute('flagging')) s.setFlagging(this.getAttribute('flagging') !== 'off');
  }

  private unbind(): void {
    for (const u of this.unsub) u();
    this.unsub = [];
    if (this._paneId) releasePane(this._paneId, this);
    this._paneId = undefined;
    this._store = undefined;
    this.geom = undefined;
  }

  /** One DOM event per action, on the element where it happened (or the pane's first sheet when nobody owns it). */
  private onStoreEvent(e: StoreEvent): void {
    if (e.type === 'select' && e.origin !== this) this.scrollToSel = true;
    if (e.type === 'select') this.revealFor(e.sheet, e.ref);
    if ((e.type === 'change' || e.type === 'load') && this.copied) { this.copied = undefined; this.selKey = ''; } // an edit ends the copied outline
    if (e.type === 'select' || e.type === 'load') { this.ctxOpen = false; this.moreOpen = false; this.hdrMenu = undefined; this.tabMenu = undefined; if (e.type === 'load') this.dlOpen = false; } // a menu belongs to the cell it opened on
    const sheetBefore = this.lastSheet;
    if (e.type === 'load') this.lastSheet = this._store!.getSnapshot().selection.sheet;
    if (e.type === 'select') this.lastSheet = e.sheet;
    if (e.type === 'load') {
      this.revealed = {}; this.openedSheets.clear(); this.revealNote = undefined; this.revealVer++; this.hiddenMenuOpen = false;
      // a workbook opens on a visible sheet, even when the file's active tab is hidden
      const st = this._store!, snap0 = st.getSnapshot();
      if (snap0.book && st.hidden(snap0.selection.sheet).state !== 'visible') {
        const first = snap0.book.sheets.find((x) => st.hidden(x.name).state === 'visible');
        if (first) queueMicrotask(() => st.select({ sheet: first.name, ref: 'A1' }));
      }
    }
    if (e.type === 'load') { this._sizes = {}; this.sizesVer++; this.rz = undefined; this.hdrMenu = undefined; this.geom = undefined; this.findHits = []; this.findVersion = -1; for (const el of this.overlayCache.values()) el.remove(); this.overlayCache.clear(); }
    const mine = e.origin === this || (e.origin === undefined && isPrimary(this._store!, this));
    if (!mine) return;
    const s = this._store!;
    switch (e.type) {
      case 'load': {
        const snap = s.getSnapshot();
        fire(this, 'sheetpane-load', snap.load.status === 'ready'
          ? { status: 'ready', name: snap.source!.name, kind: snap.source!.kind, sheets: snap.book!.sheets.map((x) => x.name), readMs: snap.source!.readMs }
          : { ...snap.load });
        break;
      }
      case 'change':
        fire(this, 'sheetpane-change', { sheet: e.sheet, ref: e.ref, kind: e.kind, was: e.was, now: e.now });
        if (e.kind === 'hidden' || e.kind === 'sheetState') this.visibilityEvent(e.sheet, e.ref, e.kind, e.was, e.now);
        break;
      case 'errors': fire(this, 'sheetpane-errors', { errors: s.getErrors(), plugins: s.pluginIds }); break;
      case 'select':
        if (e.sheet !== sheetBefore) fire(this, 'sheetpane-sheet', { sheet: e.sheet });
        fire(this, 'sheetpane-select', { sheet: e.sheet, ref: e.ref, range: s.getSnapshot().selection.range, column: this.column(e.sheet, e.ref), value: s.value(e.sheet, e.ref) });
        break;
      case 'mode': fire(this, 'sheetpane-mode', { mode: e.mode }); break;
      case 'history': fire(this, 'sheetpane-history', { reason: e.reason, canUndo: s.getSnapshot().canUndo, canRedo: s.getSnapshot().canRedo }); break;
    }
  }


  // ── the skeleton, built once ─────────────────────────────────────────────
  private build(): void {
    this.built = true;
    this.shadow = this.attachShadow({ mode: 'open' });
    const zoomOpts = ZOOMS.map((z) => `<option value="${z}"${z === 1 ? ' selected' : ''}>${z * 100} %</option>`).join('');
    this.shadow.innerHTML = `<style>${EXCEL_CSS}</style><dialog part="dialog" aria-label="Spreadsheet"></dialog>
<div class="sp" part="root">
 <div class="bar" part="toolbar">
  <span class="ico">${ICON.sheet}</span><span class="fname"></span><span class="chip meta"></span>
  <div class="seg modeseg" role="group" aria-label="Mode"><button type="button" data-mode="view" aria-pressed="true">${ICON.view}View</button><button type="button" data-mode="edit" aria-pressed="false">${ICON.edit}Edit</button></div>
  <span class="counts"></span>
  <span class="spacer"></span>
  <label class="find"><span class="vh">Find in sheet</span>${ICON.find}<input class="input findin" type="search" placeholder="Find" autocomplete="off"><span class="cnt"></span></label>
  <select class="input zoom" aria-label="Zoom">${zoomOpts}</select>
  <span class="editonly" style="display:contents">
   <button type="button" class="btn btn-g btn-i undo" data-sp="undo" aria-label="Undo (Ctrl+Z)" title="Undo">${ICON.undo}</button>
   <button type="button" class="btn btn-g btn-i redo" data-sp="redo" aria-label="Redo (Ctrl+Shift+Z)" title="Redo">${ICON.redo}</button>
   <button type="button" class="btn btn-g btn-i freeze" aria-label="Freeze panes at the selected cell" title="Freeze rows above and columns left of the selected cell">${ICON.freeze}</button>
   <span class="xs faint changes"></span>
  </span>
  <span class="split dl"><button type="button" class="btn export" data-sp="download">${ICON.download}<span class="lbl">Download</span><span class="badge-n" hidden></span></button><button type="button" class="btn btn-i dlmore" data-sp="download-menu" aria-label="Choose download format" aria-haspopup="menu" aria-expanded="false">▾</button><span class="dlslot"></span></span>
  <button type="button" class="btn btn-g btn-i help" aria-label="Keyboard shortcuts" aria-expanded="false" title="Keyboard shortcuts">?</button>
  <button type="button" class="btn btn-g btn-i close" aria-label="Close (Esc)" title="Close">${ICON.close}</button>
 </div>
 <div class="fx" part="cellbar">
  <span class="ref"></span>
  <label class="cellwrap" style="display:contents"><span class="vh cellname">Cell value</span><input class="input cell" data-sp="cell-input" placeholder="(empty)" autocomplete="off" spellcheck="false"></label>
  <span class="val"></span>
  <span class="tag merge"></span>
  <span class="chip chip-info changed"></span><button type="button" class="btn btn-g revert">Revert</button>
  <span class="chip issue"></span>
  <span class="chip chip-info hint">Describe it in the Errors panel</span>
  <span class="chip rulemsg" role="status"></span>
  <span class="plug-cellbar" style="display:contents"></span>
  <span class="dock" role="toolbar" aria-label="Selection"></span>
 </div>
 <div class="frow" part="format-row" role="toolbar" aria-label="Format"><span class="plug-frow" style="display:contents"></span><slot name="format-row"></slot></div>
 <div class="hidbar" role="status" hidden></div>
 <div class="body">
  <div class="scroller">
   <div class="sheet"><div class="grid" role="grid" tabindex="0" aria-label="Sheet" aria-multiselectable="true"><div class="hrow" role="row" aria-rowindex="1"></div><div class="frozenrows" style="display:contents"></div><div class="rows"></div><div class="sellayer" aria-hidden="true"></div></div><div class="hidlayer"></div><div class="overlay"></div></div>
  </div>
  <div class="state" hidden></div>
 </div>
 <div class="hidmenuslot"></div>
 <div class="tabs"></div>
 <div class="status" part="status" role="status"></div>
 <span class="vh selsay" aria-live="polite"></span>
 <input type="file" class="picker" accept=".xlsx,.csv" hidden>
</div>`;
    const $ = <T extends HTMLElement>(sel: string) => this.shadow.querySelector(sel) as T;
    this.q = {
      root: $('.sp'), dialog: $('dialog'), fname: $('.fname'), meta: $('.meta'), counts: $('.counts'), findin: $('.findin'), findcnt: $('.find .cnt'), zoom: $('.zoom'),
      editonly: $('.editonly'), undo: $('.undo'), redo: $('.redo'), freeze: $('.freeze'), changes: $('.changes'), export: $('.export'), dlmore: $('.dlmore'), dlslot: $('.dlslot'), close: $('.close'), dock: $('.dock'),
      help: $('.help'), ref: $('.ref'), cell: $('.cell'), cellname: $('.cellname'), val: $('.val'), merge: $('.merge'), changed: $('.changed'), revert: $('.revert'), issue: $('.issue'), hint: $('.hint'), rulemsg: $('.rulemsg'),
      plugCellbar: $('.plug-cellbar'), frow: $('.frow'), plugFrow: $('.plug-frow'), body: $('.body'), scroller: $('.scroller'), sheet: $('.sheet'), hrow: $('.hrow'),
      grid: $('.grid'), frozen: $('.frozenrows'), rows: $('.rows'), sellayer: $('.sellayer'), hidlayer: $('.hidlayer'), hidbar: $('.hidbar'), hidmenuslot: $('.hidmenuslot'), selsay: $('.selsay'), overlay: $('.overlay'), state: $('.state'), tabs: $('.tabs'), status: $('.status'), picker: $('.picker'), modeseg: $('.modeseg'),
    } as Refs;
    this.wire();
  }

  /** Tab or pop-up (W-01 DoD 5): the root moves into a modal <dialog> for `display="popup"`. */
  private place(): void {
    if (!this.built) return;
    const popup = this.getAttribute('display') === 'popup';
    const dialog = this.q.dialog as HTMLDialogElement, root = this.q.root;
    if (popup) {
      if (root.parentNode !== dialog) dialog.append(root);
      if (this.hasAttribute('open') && !dialog.open && this.isConnected) {
        this.returnFocus = (document.activeElement as HTMLElement | null) ?? undefined;
        try { dialog.showModal(); } catch { dialog.setAttribute('open', ''); }
        requestAnimationFrame(() => this.q.grid.focus({ preventScroll: true }));
      } else if (!this.hasAttribute('open') && dialog.open) this.closeDialog(false);
    } else {
      if (dialog.open) dialog.close();
      if (root.parentNode !== this.shadow) this.shadow.append(root);
    }
    this.q.close.hidden = !popup;
  }
  private returnFocus: HTMLElement | undefined;
  private closeDialog(fireEvent: boolean): void {
    const d = this.q.dialog as HTMLDialogElement;
    if (d.open) d.close();
    if (this.hasAttribute('open')) this.removeAttribute('open');
    this.returnFocus?.focus?.();
    if (fireEvent) fire(this, 'sheetpane-close', {});
  }

  // ── events ───────────────────────────────────────────────────────────────
  private wire(): void {
    const q = this.q;
    const s = () => this._store!;
    (q.dialog as HTMLDialogElement).addEventListener('cancel', (e) => { e.preventDefault(); if (!this.escape()) this.closeDialog(true); });
    q.close.addEventListener('click', () => this.closeDialog(true));
    q.modeseg.addEventListener('click', (e) => { const b = (e.target as Element).closest('button'); if (b) s().setMode(b.dataset.mode as Mode, this); });
    q.zoom.addEventListener('change', () => { this.zoom = Number((q.zoom as HTMLSelectElement).value) || 1; this.scrollToSel = true; this.schedule(); });
    q.findin.addEventListener('input', () => { this.findText = (q.findin as HTMLInputElement).value; this.findVersion = -1; this.findIdx = -1; this.schedule(); });
    q.findin.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.findNext(e.shiftKey ? -1 : 1); }
      if (e.key === 'Escape') { (q.findin as HTMLInputElement).value = ''; this.findText = ''; this.findHits = []; this.schedule(); q.grid.focus({ preventScroll: true }); e.stopPropagation(); }
    });
    q.undo.addEventListener('click', () => s().undo(this));
    q.redo.addEventListener('click', () => s().redo(this));
    q.freeze.addEventListener('click', () => this.toggleFreeze());
    q.export.addEventListener('click', () => void this.downloadFile());
    q.dlmore.addEventListener('click', () => { this.dlOpen = !this.dlOpen; this.schedule(); if (this.dlOpen) requestAnimationFrame(() => this.q.dlslot.querySelector<HTMLElement>('[role^=menuitem]')?.focus()); });
    q.dlslot.addEventListener('click', (e) => {
      const t = (e.target as Element).closest<HTMLElement>('[data-fmt], [data-opt]');
      if (!t) return;
      if (t.dataset.opt) { this.exportChoice[t.dataset.opt] = !this.exportChoices()[t.dataset.opt]; this.schedule(); return; } // a checkbox keeps the menu open
      this.dlOpen = false; this.schedule();
      void this.downloadFile(t.dataset.fmt as 'xlsx' | 'csv');
      this.q.dlmore.focus();
    });
    q.dlslot.addEventListener('keydown', (e) => this.onMenuKey(e, '.dlmenu'));
    q.root.addEventListener('pointerdown', (e) => { if (this.dlOpen && !(e.target as Element).closest('.split')) { this.dlOpen = false; this.schedule(); } });
    q.dock.addEventListener('click', (e) => this.onDockClick(e));
    q.dock.addEventListener('keydown', (e) => this.onMenuKey(e, '.moremenu'));
    q.help.addEventListener('click', () => { this.helpOpen = !this.helpOpen; q.help.setAttribute('aria-expanded', String(this.helpOpen)); this.schedule(); });
    q.revert.addEventListener('click', () => { const sel = s().getSnapshot().selection; s().revert(sel.sheet, sel.ref, this); });
    // The cell bar edits a draft; Enter, Tab and blur commit it (W-26, events verdict decisions 1–3).
    const cell = q.cell as HTMLInputElement;
    cell.addEventListener('focus', () => {
      const sel = s().getSnapshot().selection;
      const allowed = fire(this, 'sheetpane-editstart', { sheet: sel.sheet, ref: sel.ref, column: this.column(sel.sheet, sel.ref), value: s().value(sel.sheet, sel.ref) }, true);
      if (!allowed) { cell.readOnly = true; this.editing = undefined; queueMicrotask(() => q.grid.focus({ preventScroll: true })); return; }
      cell.readOnly = false;
      this.editing = { sheet: sel.sheet, ref: sel.ref, start: cell.value };
      this.schedule(); // the docked actions step aside while the draft is edited
    });
    cell.addEventListener('input', () => {
      const ed = this.editing;
      if (!ed) return;
      fire(this, 'sheetpane-input', { sheet: ed.sheet, ref: ed.ref, column: this.column(ed.sheet, ed.ref), draft: cell.value, was: s().value(ed.sheet, ed.ref) });
      this.checkDraft(ed.sheet, ed.ref, cell.value);
    });
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        this.commitDraft();
        this.move(e.key === 'Tab' ? 0 : e.shiftKey ? -1 : 1, e.key === 'Tab' ? (e.shiftKey ? -1 : 1) : 0, false);
        q.grid.focus({ preventScroll: true });
      } else if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        const ed = this.editing;
        if (ed) { cell.value = ed.start; this.editing = undefined; this.clearRuleMsg(); fire(this, 'sheetpane-editcancel', { sheet: ed.sheet, ref: ed.ref }); }
        q.grid.focus({ preventScroll: true });
      }
    });
    cell.addEventListener('blur', () => { this.commitDraft(); this.schedule(); });
    q.grid.addEventListener('paste', (e) => this.onPaste(e as ClipboardEvent));
    q.tabs.addEventListener('click', (e) => {
      const t = e.target as Element;
      if (t.closest('[data-act=hidden-sheets]')) { this.hiddenMenuOpen = !this.hiddenMenuOpen; this.schedule(); if (this.hiddenMenuOpen) requestAnimationFrame(() => this.q.hidmenuslot.querySelector<HTMLElement>('.hidmenu [role=menuitem]')?.focus()); return; }
      const b = t.closest<HTMLElement>('[data-sheet]');
      if (b) { s().select({ sheet: b.dataset.sheet!, ref: 'A1' }, this); this.q.scroller.scrollTo(0, 0); }
    });
    const openTabMenu = (tab: HTMLElement) => {
      const sheet = tab.dataset.sheet!;
      if (!this.pluginMenuItems('tab', { sheet, ref: 'A1' })) return false; // no plugin items: the browser's menu stays
      this.tabMenu = { sheet, x: tab.offsetLeft };
      this.hiddenMenuOpen = false; this.schedule();
      requestAnimationFrame(() => this.q.hidmenuslot.querySelector<HTMLElement>('.tabmenu [role=menuitem]:not([disabled])')?.focus());
      return true;
    };
    q.tabs.addEventListener('contextmenu', (e) => { const tab = (e.target as Element).closest<HTMLElement>('[data-sheet]'); if (tab && openTabMenu(tab)) e.preventDefault(); });
    q.tabs.addEventListener('keydown', (e) => { const tab = (e.target as Element).closest<HTMLElement>('[data-sheet]'); if (tab && ((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu') && openTabMenu(tab)) e.preventDefault(); });
    q.hidmenuslot.addEventListener('click', (e) => {
      const ctl = (e.target as Element).closest<HTMLElement>('[data-control][data-menu=tab]');
      if (ctl && this.tabMenu) {
        const st = s(), c = st.plugins.flatMap((p) => p.controls ?? []).find((x) => x.id === ctl.dataset.control), sel = { sheet: this.tabMenu.sheet, ref: 'A1' };
        this.tabMenu = undefined;
        if (c && !c.disabled?.(st.getSnapshot(), sel)) c.run?.(st, sel);
        this.schedule(); this.q.grid.focus({ preventScroll: true });
        return;
      }
      const open = (e.target as Element).closest<HTMLElement>('[data-open-sheet]');
      if (!open) return;
      this.hiddenMenuOpen = false; this.openedSheets.add(open.dataset.openSheet!);
      s().select({ sheet: open.dataset.openSheet!, ref: 'A1' }, this); this.q.scroller.scrollTo(0, 0); this.q.grid.focus({ preventScroll: true });
    });
    q.hidmenuslot.addEventListener('keydown', (e) => { if (this.onMenuKey(e, '.tabmenu')) { this.tabMenu = undefined; this.schedule(); return; } if (this.onMenuKey(e, '.hidmenu')) { this.hiddenMenuOpen = false; this.schedule(); this.q.tabs.querySelector<HTMLElement>('[data-act=hidden-sheets]')?.focus(); } });
    q.scroller.addEventListener('scroll', () => this.schedule(), { passive: true });
    // W-46: mouse and pen drag with Pointer Events (captured, so the drag outlives the grid); a finger
    // pans, and its tap arrives as the compatibility mousedown — as do synthetic clicks
    q.scroller.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    q.scroller.addEventListener('pointermove', (e) => { if (this.rz) { this.moveResize(e); return; } if (this.drag && e.pointerId === this.drag.id) { this.drag.x = e.clientX; this.drag.y = e.clientY; this.queueDrag(); } });
    q.scroller.addEventListener('pointerup', (e) => { if (this.rz && e.pointerId === this.rz.id) { this.endResize(true); return; } if (this.drag && e.pointerId === this.drag.id) this.endDrag(true); });
    q.scroller.addEventListener('pointercancel', (e) => { if (this.rz && e.pointerId === this.rz.id) { this.endResize(false); return; } if (this.drag && e.pointerId === this.drag.id) this.endDrag(false); });
    q.scroller.addEventListener('lostpointercapture', (e) => { if (this.rz && e.pointerId === this.rz.id) { this.endResize(true); return; } if (this.drag && e.pointerId === this.drag.id) this.endDrag(true); });
    q.scroller.addEventListener('mousedown', (e) => this.onPointer(e));
    q.scroller.addEventListener('click', (e) => {
      const t = e.target as Element;
      const m = t.closest<HTMLElement>('[data-hid]');
      if (m) { e.preventDefault(); this.onHiddenMarker(m); return; }
      const og = t.closest<HTMLElement>('[data-og]');
      if (og) { const [axis, span, open] = og.dataset.og!.split(':') as ['rows' | 'cols', string, string]; const [a, b] = span.split('-').map(Number) as [number, number]; this.toggleGroup(axis, a, b, open === '0'); return; }
      const lv = t.closest<HTMLElement>('[data-olvl]');
      if (lv) { const [axis, n] = lv.dataset.olvl!.split(':') as ['rows' | 'cols', string]; this.showLevel(axis, Number(n)); }
    });
    q.hidbar.addEventListener('click', (e) => this.onHidbar(e));
    q.status.addEventListener('click', (e) => {
      if (!(e.target as Element).closest('[data-act=show-hidden]')) return;
      const sheet = this._store!.getSnapshot().selection.sheet, rev = this.revealed[sheet];
      if (rev?.all) this.unreveal(sheet);
      else { this.revealed[sheet] = { rows: rev?.rows ?? new Set(), cols: rev?.cols ?? new Set(), all: true }; this.revealVer++; this.schedule(); this.q.selsay.textContent = 'Hidden rows and columns shown'; }
    });
    // right-click on a cell: select it and open the selection actions under it (the browser's menu stays everywhere else)
    q.scroller.addEventListener('contextmenu', (e) => {
      const head = this.headerHit(e.target as HTMLElement);
      if (head && head.kind !== 'all') {
        // a header: select it unless it is already part of a whole selection, then its size menu
        e.preventDefault();
        const targets = this.sizeTargets(head.kind, head.index);
        if (targets.length === 1) this.selectHeader(head, false);
        this.openHeaderMenu(head.kind, this.sizeTargets(head.kind, head.index));
        return;
      }
      const c = (e.target as Element).closest<HTMLElement>('.c');
      if (!c || c.dataset.r === undefined) return;
      e.preventDefault();
      this.selectCell(Number(c.dataset.r), Number(c.dataset.c), false);
      this.openContextMenu();
    });
    q.scroller.addEventListener('dblclick', (e) => {
      const edge = (e.target as Element).closest<HTMLElement>('[data-rz-c], [data-rz-r]');
      if (edge) { const axis = edge.dataset.rzC !== undefined ? 'col' : 'row'; this.fit(axis, this.sizeTargets(axis, Number(axis === 'col' ? edge.dataset.rzC : edge.dataset.rzR))); return; }
      if ((e.target as Element).closest('.c') && this.mode === 'edit') this.editCell();
    });
    q.grid.addEventListener('keydown', (e) => this.onKey(e));
    q.overlay.addEventListener('click', (e) => this.onOverlayClick(e));
    q.overlay.addEventListener('keydown', (e) => {
      if (this.onSizeKey(e)) return;
      if (this.onMenuKey(e, '.ctxmenu')) return;
      const opt = (e.target as HTMLElement).closest?.('.menu [data-act=pick-option]') as HTMLElement | null;
      if (opt && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); ((e.key === 'ArrowDown' ? opt.nextElementSibling : opt.previousElementSibling) as HTMLElement | null)?.focus(); return; }
      if (opt && e.key === 'Escape') { e.stopPropagation(); this.menu = undefined; this.schedule(); this.q.grid.focus({ preventScroll: true }); return; } if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); this.addFromComposer(); } if (e.key === 'Escape') { e.stopPropagation(); s().compose(null); this.q.grid.focus({ preventScroll: true }); } });
    q.overlay.addEventListener('input', (e) => this.onComposerInput(e));
    q.overlay.addEventListener('change', (e) => this.onComposerInput(e));
    q.plugFrow.addEventListener('click', (e) => this.runControl(e));
    q.plugCellbar.addEventListener('click', (e) => this.runControl(e));
    for (const box of [q.plugFrow, q.plugCellbar, q.overlay]) box.addEventListener('change', (e) => this.chooseControl(e));
    q.frow.querySelector('slot')!.addEventListener('slotchange', () => this.schedule());
    // the empty state: drop a file, browse, open a link, paste base64
    q.state.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('.browse')) (q.picker as HTMLInputElement).click();
      if (t.closest('.openlink')) { const v = (q.state.querySelector('.linkin') as HTMLInputElement).value.trim(); if (v) void this.load(v); }
      if (t.closest('.openb64')) { const v = (q.state.querySelector('.b64in') as HTMLTextAreaElement).value.trim(); if (v) void this.load(v); }
      if (t.closest('.again')) { this.showEmpty = true; this.schedule(); }
    });
    q.picker.addEventListener('change', () => { const f = (q.picker as HTMLInputElement).files?.[0]; if (f) { this.showEmpty = false; void this.load(f); } (q.picker as HTMLInputElement).value = ''; });
    q.state.addEventListener('dragover', (e) => { e.preventDefault(); q.state.querySelector('.drop')?.classList.add('over'); });
    q.state.addEventListener('dragleave', () => q.state.querySelector('.drop')?.classList.remove('over'));
    q.state.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) { this.showEmpty = false; void this.load(f); } });
  }
  private showEmpty = false;
  private helpOpen = false;
  private editing: { sheet: string; ref: string; start: string } | undefined;

  /** The column a payload names: index, letter and the title from the header row (`header-row`, default 1). */
  column(sheet: string, ref: string): { index: number; letter: string; header: string } {
    const p = parseRef(ref)!;
    const hr = Math.max(1, Number(this.getAttribute('header-row') ?? 1) || 1);
    return { index: p.col, letter: colName(p.col), header: this._store?.text(sheet, cellRef(hr - 1, p.col)).trim() ?? '' };
  }

  /** `sheetpane-beforechange` (cancellable) for one cell; the value it would store is `now`. Then a column rule set to `block` (W-27). */
  private allowChange(sheet: string, ref: string, now: unknown, text = now === null || now === undefined ? '' : String(now)): boolean {
    const s = this._store!;
    if (!fire(this, 'sheetpane-beforechange', { sheet, ref, column: this.column(sheet, ref), was: s.value(sheet, ref), now }, true)) return false;
    const b = s.ruleBlocks(sheet, ref, now as Cell, text);
    if (!b) return true;
    // refused: the value is never stored (L6); the message stays at the cell until the selection moves
    this.ruleMsg = { sheet, ref, outcome: b, blocked: true };
    fire(this, 'sheetpane-editcancel', { sheet, ref, reason: 'blocked', code: 'SP-6003', message: b.message });
    this.schedule();
    return false;
  }

  // ── column rules: the input phase (an outline and a tooltip, nothing stored) ──
  private ruleMsg: { sheet: string; ref: string; outcome: RuleOutcome; blocked?: boolean } | undefined;
  private ruleTimer: ReturnType<typeof setTimeout> | undefined;
  private ruleAbort: AbortController | undefined;
  private checkDraft(sheet: string, ref: string, draft: string): void {
    clearTimeout(this.ruleTimer);
    this.ruleAbort?.abort();
    const s = this._store;
    if (!s?.columnRules.columns || (!Object.keys(s.columnRules.columns).length && !s.columnRules.validate)) return;
    this.ruleTimer = setTimeout(() => {
      const ac = (this.ruleAbort = new AbortController());
      void s.checkInput(sheet, ref, draft, ac.signal).then((o) => {
        if (ac.signal.aborted) return;
        this.ruleMsg = o ? { sheet, ref, outcome: o } : undefined;
        this.schedule();
      });
    }, 150);
  }
  private clearRuleMsg(): void { clearTimeout(this.ruleTimer); this.ruleAbort?.abort(); if (this.ruleMsg) { this.ruleMsg = undefined; this.schedule(); } }

  /** Commits the cell bar's draft: beforechange, then the store (change map → undo → derive → validate → sheetpane-change). */
  private commitDraft(): void {
    const ed = this.editing, s = this._store;
    this.editing = undefined;
    if (!ed || !s) return;
    const cell = this.q.cell as HTMLInputElement;
    const draft = cell.value;
    if (draft === ed.start) return;
    const book = s.book;
    const now = book ? parseInput(draft, s.original(ed.sheet, ed.ref).value, book.source) : draft;
    clearTimeout(this.ruleTimer); this.ruleAbort?.abort();
    if (!this.allowChange(ed.sheet, ed.ref, now, draft)) { cell.value = ed.start; return; }
    if (this.ruleMsg && !this.ruleMsg.blocked) this.ruleMsg = undefined;
    s.setCell(ed.sheet, ed.ref, draft, { origin: this });
  }

  /** Paste (Edit): tab- and line-separated text from the active cell, beforechange per cell, one undo step. */
  private onPaste(e: ClipboardEvent): void {
    const s = this._store!, snap = s.getSnapshot();
    if (snap.mode !== 'edit' || snap.load.status !== 'ready') return;
    const text = e.clipboardData?.getData('text/plain');
    if (text === undefined) return;
    e.preventDefault();
    const rows = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').map((r) => r.split('\t'));
    const p = parseRef(snap.selection.ref)!;
    const book = s.book!;
    const cells: { sheet: string; ref: string; input: string }[] = [];
    const over = snap.selection.range ? parseRange(snap.selection.range) : undefined;
    if (over && rows.length === 1 && rows[0]!.length === 1) {
      // one value pasted over a range fills every cell of it (W-46 DoD 7)
      if (cellCount(over) > 1_000_000) { this.say0('Nothing pasted — the range is over 1,000,000 cells'); return; }
      const v = rows[0]![0]!;
      const gq = this.geometry()!.g;
      for (let row = over.top; row <= over.bottom; row++) for (let col = over.left; col <= over.right; col++) {
        if (!this.shownRow(gq, row) || !this.shownCol(gq, col)) continue; // hidden cells are left alone (W-49)
        const ref = cellRef(row, col);
        if (this.allowChange(snap.selection.sheet, ref, parseInput(v, s.original(snap.selection.sheet, ref).value, book.source), v)) cells.push({ sheet: snap.selection.sheet, ref, input: v });
      }
      s.setCells(cells, { origin: this });
      return;
    }
    rows.forEach((row, dr) => row.forEach((v, dc) => {
      const ref = cellRef(p.row + dr, p.col + dc);
      if (this.allowChange(snap.selection.sheet, ref, parseInput(v, s.original(snap.selection.sheet, ref).value, book.source), v)) cells.push({ sheet: snap.selection.sheet, ref, input: v });
    }));
    s.setCells(cells, { origin: this });
  }

  // ── selection actions (W-31): docked in the cell bar, and on right-click ──
  private ctxOpen = false;
  private moreOpen = false;
  private notice = '';
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;

  /** Copies to the clipboard; without a secure context it says so in the status line. */
  private copy(text: string): void {
    const fail = () => { this.notice = 'Copy needs a secure page (https or localhost)'; clearTimeout(this.noticeTimer); this.noticeTimer = setTimeout(() => { this.notice = ''; this.schedule(); }, 4000); this.schedule(); };
    if (!navigator.clipboard?.writeText) { fail(); return; }
    navigator.clipboard.writeText(text).catch(fail);
  }

  /** Copy ref: `B3`, `B3:D8`, `B:D`, `4:12`, or the sheet's name (W-46 DoD 4). */
  private refOf(sel: { sheet: string; ref: string; range?: string }): string {
    const r = sel.range ? parseRange(sel.range) : undefined, g = this.geometry();
    return r && g ? refLabel(r, { rows: g.g.rows, cols: g.g.cols }, sel.sheet) : sel.ref;
  }

  private openContextMenu(): void {
    const s = this._store;
    if (!s || s.getSnapshot().load.status !== 'ready' || s.getSnapshot().composing) return;
    this.menu = undefined; this.moreOpen = false; this.ctxOpen = true;
    this.schedule();
    requestAnimationFrame(() => this.q.overlay.querySelector<HTMLElement>('.ctxmenu [role=menuitem]:not([disabled])')?.focus({ preventScroll: true }));
  }

  /** The actions as menu items: Flag issue (Edit), Copy ref, Copy value, then the `selbar` plugin controls. */
  private actionItems(edit: boolean, err: SheetpaneError | undefined, o: { flag: boolean; plugins: boolean }): string {
    const s = this._store!, snap = s.getSnapshot();
    const item = (act: string, label: string, kbd = '') => `<button type="button" role="menuitem" class="mi" data-act="${act}">${esc(label)}${kbd ? `<span class="kbd">${esc(kbd)}</span>` : ''}</button>`;
    const out = [o.flag && edit && !err && s.flagging ? item('flag', 'Flag issue', 'F') : '', item('copy-ref', 'Copy ref'), item('copy-value', snap.selection.range ? 'Copy values' : 'Copy value', 'Ctrl/⌘+C')];
    if (o.plugins && edit) for (const c of controlsFor(s.plugins, 'selbar', 'edit').filter((x) => !x.menus || x.menus.includes('cell'))) {
      const label = c.labelFor?.(snap, snap.selection) ?? c.label;
      const off = c.disabled?.(snap, snap.selection) ?? false;
      out.push(`<button type="button" role="menuitem" class="mi fold" data-control="${esc(c.id)}"${off ? ' disabled' : ''}>${esc(label)}${c.shortcut ? `<span class="kbd">${esc(c.shortcut)}</span>` : ''}</button>`);
    }
    return out.join('');
  }

  private contextMenuHtml(x: number, y: number, edit: boolean, err: SheetpaneError | undefined): string {
    return `<div class="card ctxmenu" role="menu" aria-label="Selection actions" data-sp="menu" style="top:${y}px;left:${x}px">${this.actionItems(edit, err, { flag: true, plugins: true })}</div>`;
  }

  /** Arrow keys move through a menu's items; Esc closes it and returns focus. True when handled. */
  private onMenuKey(e: KeyboardEvent, sel: string): boolean {
    const menu = (e.target as Element).closest?.(sel);
    if (!menu) return false;
    const items = [...menu.querySelectorAll<HTMLElement>('[role=menuitem]:not([disabled])')].filter((x) => x.offsetParent !== null);
    const i = items.indexOf(e.target as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus(); return true; }
    if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); items[e.key === 'Home' ? 0 : items.length - 1]?.focus(); return true; }
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault(); e.stopPropagation();
      this.ctxOpen = false; this.moreOpen = false; this.dlOpen = false; this.hdrMenu = undefined; this.schedule();
      if (sel === '.moremenu') this.q.dock.querySelector<HTMLElement>('[data-act=more]')?.focus();
      else if (sel === '.dlmenu') this.q.dlmore.focus();
      else this.q.grid.focus({ preventScroll: true });
      return true;
    }
    return false;
  }

  private onDockClick(e: Event): void {
    const t = e.target as HTMLElement, s = this._store!, sel = s.getSnapshot().selection;
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'more') {
      this.moreOpen = !this.moreOpen; this.schedule();
      if (this.moreOpen) requestAnimationFrame(() => this.q.dock.querySelector<HTMLElement>('.moremenu [role=menuitem]')?.focus());
      return;
    }
    if (t.closest('.moremenu')) this.moreOpen = false;
    if (act === 'flag') this.flag();
    else if (act === 'copy-ref') this.copy(this.refOf(sel));
    else if (act === 'copy-value') this.copySelection();
    else if (t.closest('[data-control]')) this.runControl(e);
    this.schedule();
  }

  /** Untouched: no change, and nothing a plugin would write (a review exported as comments). */
  private untouched(): boolean {
    const s = this._store!;
    return s.changeCount === 0 && !(s.getSnapshot().errors.length && s.plugins.some((p) => p.provides.includes('exportPatch')));
  }

  // ── Download (W-31, W-34): the main part in the upload's format; ▾ for either format and plugin options ──
  private dlOpen = false;
  private exportChoice: Record<string, boolean> = {};
  /** Each plugin export option, its default unless the reviewer flipped it in the menu. */
  private exportChoices(): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const o of (this._store?.plugins ?? []).flatMap((p) => p.exportOptions ?? [])) out[o.key] = this.exportChoice[o.key] ?? o.default;
    return out;
  }

  /** The upload's format: the original bytes when untouched, else `export()` with every change. Another format converts. All fire `sheetpane-export`. */
  private async downloadFile(format?: 'xlsx' | 'csv'): Promise<void> {
    const s = this._store, src = s?.getSnapshot().source;
    if (!s || !src) return;
    const fmt = format ?? src.kind;
    if (fmt === src.kind && this.untouched()) {
      const blob = new Blob([src.bytes as BlobPart], { type: src.kind === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      if (fire(this, 'sheetpane-export', { blob, kind: src.kind, name: src.name, guarded: false, original: true, format: fmt, converted: false }, true)) download(src.bytes, src.name);
      return;
    }
    const blob = await this.export(this.exportChoices(), { format: fmt });
    if (this.lastExport?.ok) download(blob, this.lastExport.name);
  }

  private downloadMenuHtml(kind: 'xlsx' | 'csv'): string {
    const order: ('xlsx' | 'csv')[] = kind === 'xlsx' ? ['xlsx', 'csv'] : ['csv', 'xlsx'];
    const note = (f: 'xlsx' | 'csv') => (f === kind ? '' : f === 'csv' ? 'The current sheet only — values as shown now, no formatting' : 'One sheet with the latest values');
    const items = order.map((f) => `<button type="button" role="menuitem" class="mi" data-fmt="${f}"><span>Download as .${f}</span>${f === kind ? '<span class="kbd">default</span>' : ''}</button>${note(f) ? `<span class="mnote">${note(f)}</span>` : ''}`).join('');
    const choices = this.exportChoices();
    const opts = (this._store?.plugins ?? []).flatMap((p) => p.exportOptions ?? []);
    const optHtml = opts.length ? `<div role="separator" class="msep"></div>${opts.map((o) => `<button type="button" role="menuitemcheckbox" class="mi" data-opt="${esc(o.key)}" aria-checked="${choices[o.key]}"><span>${choices[o.key] ? '✓ ' : ''}${esc(o.label)}</span></button>`).join('')}` : '';
    return `<div class="card dlmenu" role="menu" aria-label="Download format">${items}${optHtml}</div>`;
  }

  /** The grid's keys, then every plugin control's shortcut (W-14 DoD 8). */
  shortcuts(): { keys: string; what: string }[] {
    const own = [
      ['Arrows', 'Move'], ['Shift + arrows', 'Select a range'], ['Ctrl/⌘ + arrows', 'Jump to the edge of the data'], ['Ctrl/⌘ + Shift + arrows', 'Select to the edge of the data'],
      ['Ctrl + Space', 'Select the column'], ['Shift + Space', 'Select the row'], ['Ctrl/⌘ + A', 'Select the data, then the sheet'], ['Shift + Backspace', 'Back to the active cell'],
      ['Enter / Tab in a range', 'Next cell of the range (Shift: back)'], ['Drag, Shift + click', 'Select a range'], ['Click a header', 'Select a column, a row or the sheet'],
      ['Drag a header edge', 'Resize the column or row'], ['Double-click a header edge', 'Fit it to the text'], ['Shift + F10 on a whole column or row', 'Fit · width… · reset to the file’s size'],
      ['Home / End', 'Row start / end'], ['Ctrl + Home / End', 'First / last cell'],
      ['Page Up / Down', 'Move a screen'], ['Enter or F2', 'Edit the cell (Edit)'], ['Type', 'Replace the cell (Edit)'], ['Delete', 'Clear the cell or range (Edit)'],
      ['F', 'Flag issue (Edit)'], ['Esc', 'Cancel a drag or copy · close the pop-up'], ['Ctrl/⌘ + Z', 'Undo'], ['Ctrl + Y, ⌘ + Shift + Z', 'Redo'], ['Ctrl/⌘ + C', 'Copy the value or the range'], ['Shift + F10 or Menu', 'Selection actions'],
    ].map(([keys, what]) => ({ keys: keys!, what: what! }));
    const plug = (this._store?.plugins ?? []).flatMap((p) => p.controls ?? []).filter((c) => c.shortcut).map((c) => ({ keys: c.shortcut!, what: c.label }));
    return [...(this._store && !this._store.flagging ? own.filter((x) => x.keys !== 'F') : own), ...plug];
  }

  /** Does a key event match a control's shortcut, e.g. `Mod+B`, `Ctrl+Shift+5`, `B`? */
  private matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
    const parts = shortcut.split('+').map((x) => x.trim().toLowerCase());
    const key = parts.pop()!;
    const want = { mod: parts.includes('mod'), ctrl: parts.includes('ctrl'), meta: parts.includes('meta') || parts.includes('cmd'), shift: parts.includes('shift'), alt: parts.includes('alt') };
    const mod = want.mod ? e.ctrlKey || e.metaKey : (want.ctrl ? e.ctrlKey : !e.ctrlKey) && (want.meta ? e.metaKey : !e.metaKey);
    // a digit is matched on e.code: ⌥ and AltGr change e.key (⌘⌥9 is "ª" on a Mac) — W-49
    const keyOk = /^[0-9]$/.test(key) ? e.code === `Digit${key}` : key.startsWith('arrow') ? e.key.toLowerCase() === key : e.key.toLowerCase() === key;
    return mod && e.shiftKey === want.shift && e.altKey === want.alt && keyOk;
  }

  /** A click without a pointer sequence before it: a finger's tap, or a synthetic event. Selects; never drags. */
  private onPointer(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    if (e.button !== 0) return;
    if (t.closest('[data-rz-c], [data-rz-r], [data-hid], [data-og], [data-olvl]')) return;
    const mk = t.closest<HTMLElement>('.mk');
    if (mk) { e.preventDefault(); this.runCellControl(mk); return; }
    const head = this.headerHit(t);
    if (head) { e.preventDefault(); this.q.grid.focus({ preventScroll: true }); this.selectHeader(head, e.shiftKey); return; }
    const c = t.closest<HTMLElement>('.c');
    if (!c || c.dataset.r === undefined) return;
    e.preventDefault(); this.q.grid.focus({ preventScroll: true });
    this.selectCell(Number(c.dataset.r), Number(c.dataset.c), e.shiftKey);
  }

  /** A column header, a row header or the corner under the pointer. */
  private headerHit(t: HTMLElement): { kind: 'col' | 'row' | 'all'; index: number } | undefined {
    const h = t.closest<HTMLElement>('[data-hc], [data-hr], [data-hall]');
    if (!h) return undefined;
    if (h.dataset.hall !== undefined) return { kind: 'all', index: 0 };
    return h.dataset.hc !== undefined ? { kind: 'col', index: Number(h.dataset.hc) } : { kind: 'row', index: Number(h.dataset.hr) };
  }

  /** Mouse or pen: select, then follow the pointer until release (W-46 DoD 3). */
  private onPointerDown(e: PointerEvent): void {
    const s = this._store;
    if (!s || s.getSnapshot().load.status !== 'ready') return;
    const t = e.target as HTMLElement;
    const edge = t.closest<HTMLElement>('[data-rz-c], [data-rz-r]');
    if (edge) { if (e.button === 0) this.startResize(e, edge); return; } // W-47: a header edge resizes, never selects
    if (t.closest('[data-hid], [data-og], [data-olvl]')) return; // W-49: markers and outline buttons act on click
    const handle = t.closest<HTMLElement>('.sh');
    if (handle && e.button === 0) { this.startHandleDrag(e, handle.dataset.end === 'start'); return; }
    if (e.pointerType === 'touch') { this.touchUi = true; return; } // a pan scrolls; the tap selects through mousedown
    this.touchUi = false;
    if (e.button !== 0 || t.closest('.overlay')) return;
    const mk = t.closest<HTMLElement>('.mk');
    if (mk) { e.preventDefault(); this.runCellControl(mk); return; }
    const head = this.headerHit(t);
    const c = head ? undefined : t.closest<HTMLElement>('.c');
    if (!head && (!c || c.dataset.r === undefined)) return;
    e.preventDefault(); // no text selection, and no compatibility mousedown after this
    this.q.grid.focus({ preventScroll: true });
    if (head?.kind === 'all') { this.selectHeader(head, false); return; }
    if (e.shiftKey) { if (head) this.selectHeader(head, true); else this.selectCell(Number(c!.dataset.r), Number(c!.dataset.c), true); return; }
    const snap = s.getSnapshot(), before = { ...snap.selection };
    if (head) this.selectHeader(head, false);
    else this.selectCell(Number(c!.dataset.r), Number(c!.dataset.c), false);
    const at: Pos = head ? (head.kind === 'col' ? { row: 0, col: head.index } : { row: head.index, col: 0 }) : { row: Number(c!.dataset.r), col: Number(c!.dataset.c) };
    this.drag = { id: e.pointerId, anchor: at, focus: at, kind: head ? head.kind : 'cell', before, x: e.clientX, y: e.clientY };
    try { this.q.scroller.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer has nothing to capture */ }
  }

  /** A touch handle: extend the range from its other corner. */
  private startHandleDrag(e: PointerEvent, start: boolean): void {
    const snap = this._store!.getSnapshot(), sel = snap.selection;
    const r = sel.range ? parseRange(sel.range) : undefined;
    if (!r) return;
    e.preventDefault(); e.stopPropagation();
    const fixed: Pos = start ? { row: r.bottom, col: r.right } : { row: r.top, col: r.left };
    const moving: Pos = start ? { row: r.top, col: r.left } : { row: r.bottom, col: r.right };
    this.anchor = fixed;
    this.drag = { id: e.pointerId, anchor: fixed, focus: moving, kind: 'cell', before: { ...sel }, x: e.clientX, y: e.clientY };
    try { this.q.scroller.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
  }

  private queueDrag(): void {
    if (!this.dragRaf) this.dragRaf = requestAnimationFrame(() => { this.dragRaf = 0; this.dragStep(); });
  }

  /** One frame of a drag: autoscroll at an edge, the cell under the pointer, the layer redrawn. */
  private dragStep(): void {
    const d = this.drag, g = this.geometry();
    if (!d || !g) return;
    const sc = this.q.scroller, z = this.zoom, HH = this.headH() * z, RW = this.rowHeadW() * z;
    const fz = this._store!.freeze(g.sheet.name), fr = Math.min(fz.rows, g.g.rows), fc = Math.min(fz.cols, g.g.cols);
    const rect = sc.getBoundingClientRect();
    const vx = d.x - rect.left - sc.clientLeft, vy = d.y - rect.top - sc.clientTop;
    const paneTop = HH + g.g.rowY[fr]! * z, paneLeft = RW + g.g.colX[fc]! * z;
    // autoscroll: within 24 px of the scrolling pane's edge, or past it — faster the further out
    const speed = (into: number) => Math.min(80, 4 + into * 0.8);
    let dy = 0, dx = 0;
    if (d.kind !== 'col') { if (vy > sc.clientHeight - 24) dy = speed(vy - (sc.clientHeight - 24)); else if (vy < paneTop + 24 && sc.scrollTop > 0) dy = -speed(paneTop + 24 - vy); }
    if (d.kind !== 'row') { if (vx > sc.clientWidth - 24) dx = speed(vx - (sc.clientWidth - 24)); else if (vx < paneLeft + 24 && sc.scrollLeft > 0) dx = -speed(paneLeft + 24 - vx); }
    if (dy) sc.scrollTop += dy;
    if (dx) sc.scrollLeft += dx;
    // the cell under the pointer: frozen panes do not scroll
    const sy = vy < paneTop && fr > 0 ? vy : vy + sc.scrollTop, sx = vx < paneLeft && fc > 0 ? vx : vx + sc.scrollLeft;
    const row = sy < HH ? 0 : rowAt(g.g, (sy - HH) / z);
    const col = Math.max(0, Math.min(g.g.cols - 1, colAt(g.g, Math.max(0, (sx - RW) / z))));
    d.focus = d.kind === 'col' ? { row: d.focus.row, col } : d.kind === 'row' ? { row, col: d.focus.col } : { row, col };
    this.drawSelection();
    if (dy || dx) this.queueDrag();
  }

  /** Release commits the range to the store once; a cancel (Esc, pointercancel) restores the selection from before. */
  private endDrag(commit: boolean): void {
    const d = this.drag;
    if (!d) return;
    if (this.dragRaf) { cancelAnimationFrame(this.dragRaf); this.dragRaf = 0; }
    if (commit) this.dragStep();
    this.drag = undefined;
    try { if (this.q.scroller.hasPointerCapture(d.id)) this.q.scroller.releasePointerCapture(d.id); } catch { /* synthetic */ }
    const s = this._store!;
    if (!commit) { s.select(d.before, this); this.drawSelection(); return; }
    const sheet = s.getSnapshot().selection.sheet;
    const r = this.dragRange(d);
    const active = d.kind === 'cell' ? d.anchor : s.getSnapshot().selection.ref ? parseRef(s.getSnapshot().selection.ref)! : d.anchor;
    this.anchor = d.anchor;
    const one = r.top === r.bottom && r.left === r.right;
    s.select(one ? { sheet, ref: cellRef(active.row, active.col) } : { sheet, ref: cellRef(active.row, active.col), range: rangeText(r) }, this);
    if (!one) this.say(r);
    this.drawSelection();
  }

  /** The range a drag spans: corners for cells (grown over merges), whole columns or rows for headers. */
  private dragRange(d: Drag): RangePos {
    const g = this.geometry()!.g;
    if (d.kind === 'col') return { top: 0, bottom: g.rows - 1, left: Math.min(d.anchor.col, d.focus.col), right: Math.max(d.anchor.col, d.focus.col) };
    if (d.kind === 'row') return { left: 0, right: g.cols - 1, top: Math.min(d.anchor.row, d.focus.row), bottom: Math.max(d.anchor.row, d.focus.row) };
    return growForMerges(spanOf(d.anchor, d.focus), g.merges);
  }

  // ── hidden rows, columns and sheets (W-49): honoured, marked, revealed for viewing ──
  // ── outline groups (W-49 DoD 9): a gutter of brackets, +/− and level buttons; expand / collapse is a view setting ──
  /** Groups collapsed in this element only (view), per sheet. */
  private viewHidden: Record<string, { rows: Set<number>; cols: Set<number> }> = {};
  private gutter(axis: 'rows' | 'cols'): number {
    const s = this._store, sheet = s?.getSnapshot().selection.sheet;
    if (!s || !sheet) return 0;
    const o = s.outline(sheet), n = axis === 'rows' ? o.levelRow : o.levelCol;
    return n ? 18 * (n + 1) : 0;
  }
  /** The row-header column's width at 100 %: the header, plus the row outline gutter. */
  private rowHeadW(): number { return ROWHEAD_W + this.gutter('rows'); }
  /** The header row's height at 100 %: the header, plus the column outline gutter. */
  private headH(): number { return HEAD_H + this.gutter('cols'); }

  /** The groups of an outline axis: runs of a level or deeper, `[level, first, last]`, around a window. */
  private groupsOf(levels: Record<number, number>, deepest: number, from: number, to: number, count: number): [number, number, number][] {
    const out: [number, number, number][] = [];
    for (let L = 1; L <= deepest; L++) {
      for (let i = Math.max(0, from); i <= Math.min(count - 1, to); i++) {
        if ((levels[i] ?? 0) < L) continue;
        let a = i, b = i;
        while (a > 0 && (levels[a - 1] ?? 0) >= L) a--;
        while (b < count - 1 && (levels[b + 1] ?? 0) >= L) b++;
        if (!out.some(([l, x]) => l === L && x === a)) out.push([L, a, b]);
        i = b;
      }
    }
    return out;
  }
  /** Expands (shows) or collapses (hides, in view) a group's rows or columns. */
  private toggleGroup(axis: 'rows' | 'cols', a: number, b: number, expand: boolean): void {
    const s = this._store!, sheet = s.getSnapshot().selection.sheet;
    const v = (this.viewHidden[sheet] ??= { rows: new Set(), cols: new Set() });
    const rev = (this.revealed[sheet] ??= { rows: new Set(), cols: new Set(), all: false });
    const file = new Set(s.hidden(sheet)[axis]);
    for (let i = a; i <= b; i++) {
      if (expand) { v[axis].delete(i); if (file.has(i)) rev[axis].add(i); }
      else { rev[axis].delete(i); if (!file.has(i)) v[axis].add(i); }
    }
    this.revealVer++; this.schedule();
    const idx = Array.from({ length: b - a + 1 }, (_, i) => a + i);
    fire(this, 'sheetpane-visibility', { sheet, axis: axis === 'rows' ? 'row' : 'col', indexes: idx, hidden: !expand, via: 'reveal' });
    this.q.selsay.textContent = `${this.spanName(axis, idx)} ${expand ? 'shown' : 'hidden'}`;
  }
  /** Level n: groups deeper than n collapse, the others expand. */
  private showLevel(axis: 'rows' | 'cols', n: number): void {
    const s = this._store!, sheet = s.getSnapshot().selection.sheet, o = s.outline(sheet), g = this.geometry()!.g;
    const levels = axis === 'rows' ? o.rows : o.cols, deepest = axis === 'rows' ? o.levelRow : o.levelCol, count = axis === 'rows' ? g.rows : g.cols;
    for (const [L, a, b] of this.groupsOf(levels, deepest, 0, count - 1, count).sort((x, y) => x[0] - y[0])) this.toggleGroup(axis, a, b, L < n);
  }
  /** The outline gutter's brackets, +/− buttons and level buttons, for the rendered window. */
  private outlineMarks(sheet: string, g: SheetGeometry, win: { r0: number; r1: number; c0: number; c1: number }): string {
    const s = this._store!, o = s.outline(sheet), z = this.zoom, HH = this.headH() * z, RW = this.rowHeadW() * z;
    if (!o.levelRow && !o.levelCol) return '';
    const X = (c: number) => g.colX[Math.min(c, g.cols)]! * z, Y = (r: number) => rowTop(g, r) * z;
    let out = '';
    const shown = (edges: Float64Array, a: number, b: number) => { for (let i = a; i <= b; i++) if (!isHiddenAt(edges, i)) return true; return false; };
    if (o.levelRow) {
      for (const [L, a, b] of this.groupsOf(o.rows, o.levelRow, win.r0 - 1, win.r1 + 1, g.rows)) {
        const open = shown(g.rowY, a, b), sum = o.summaryBelow ? Math.min(g.rows - 1, b + 1) : Math.max(0, a - 1), x = (L - 1) * 18 * z + 4;
        if (open) out += `<span class="obr obr-r" style="position:sticky;left:${x + 7}px;margin:${HH + Y(a)}px 0 0 ${x + 7}px;height:${Math.max(0, Y(b + 1) - Y(a))}px"></span>`;
        const label = `${open ? 'Collapse' : 'Expand'} rows ${a + 1}–${b + 1} (level ${L})`;
        out += `<button type="button" class="obtn" data-og="rows:${a}-${b}:${open ? 1 : 0}" style="position:sticky;left:${x}px;margin:${HH + Y(sum) + 4}px 0 0 ${x}px" aria-label="${label}" title="${label}">${open ? '−' : '+'}</button>`;
      }
      for (let n = 1; n <= o.levelRow + 1; n++) out += `<button type="button" class="obtn olvl" data-olvl="rows:${n}" style="position:sticky;top:2px;left:${(n - 1) * 18 * z + 4}px;margin:2px 0 0 ${(n - 1) * 18 * z + 4}px;z-index:7" aria-label="Show row outline level ${n}" title="Row level ${n}">${n}</button>`;
    }
    if (o.levelCol) {
      for (const [L, a, b] of this.groupsOf(o.cols, o.levelCol, win.c0 - 1, win.c1 + 1, g.cols)) {
        const open = shown(g.colX, a, b), sum = o.summaryRight ? Math.min(g.cols - 1, b + 1) : Math.max(0, a - 1), y = (L - 1) * 18 * z + 4;
        if (open) out += `<span class="obr obr-c" style="position:sticky;top:${y + 7}px;margin:${y + 7}px 0 0 ${RW + X(a)}px;width:${Math.max(0, X(b + 1) - X(a))}px"></span>`;
        const label = `${open ? 'Collapse' : 'Expand'} columns ${colName(a)}–${colName(b)} (level ${L})`;
        out += `<button type="button" class="obtn" data-og="cols:${a}-${b}:${open ? 1 : 0}" style="position:sticky;top:${y}px;margin:${y}px 0 0 ${RW + X(sum) + 4}px" aria-label="${label}" title="${label}">${open ? '−' : '+'}</button>`;
      }
      for (let n = 1; n <= o.levelCol + 1; n++) out += `<button type="button" class="obtn olvl" data-olvl="cols:${n}" style="position:sticky;top:${(n - 1) * 18 * z + 4}px;left:2px;margin:${(n - 1) * 18 * z + 4}px 0 0 2px;z-index:7" aria-label="Show column outline level ${n}" title="Column level ${n}">${n}</button>`;
    }
    return out;
  }

  /** Is a row (column) drawn — not hidden, or revealed? */
  private shownRow = (g: SheetGeometry, r: number) => !isHiddenAt(g.rowY, r);
  private shownCol = (g: SheetGeometry, c: number) => !isHiddenAt(g.colX, c);
  /** The nearest drawn row (column) from `i`, stepping `dir` first, then back (W-49 DoD 7). */
  private nearestShown(edges: Float64Array, count: number, i: number, dir: number): number {
    const d = dir < 0 ? -1 : 1;
    for (let j = i; j >= 0 && j < count; j += d) if (!isHiddenAt(edges, j)) return j;
    for (let j = i; j >= 0 && j < count; j -= d) if (!isHiddenAt(edges, j)) return j;
    return i;
  }
  /** How many cells of a range are hidden. */
  private hiddenIn(g: SheetGeometry, r: RangePos): number {
    let hr = 0, hc = 0;
    for (let i = r.top; i <= Math.min(r.bottom, g.rows - 1); i++) if (isHiddenAt(g.rowY, i)) hr++;
    for (let i = r.left; i <= Math.min(r.right, g.cols - 1); i++) if (isHiddenAt(g.colX, i)) hc++;
    const rows = r.bottom - r.top + 1, cols = r.right - r.left + 1;
    return rows * cols - (rows - hr) * (cols - hc);
  }

  private isRevealed(sheet: string, axis: 'rows' | 'cols', i: number): boolean {
    const rev = this.revealed[sheet];
    if (!rev || !this._store) return false;
    if (!(rev.all || rev[axis].has(i))) return false;
    return this._store.hidden(sheet)[axis].includes(i);
  }
  /** Whether a `visibility` plugin can change hiding here (Edit). */
  private canUnhide(): boolean {
    const s = this._store!;
    return s.getSnapshot().mode === 'edit' && s.plugins.some((p) => p.id === 'visibility') && s.getSnapshot().source?.kind === 'xlsx';
  }
  /**
   * Shows hidden rows or columns for viewing, in this element only — never a change (W-49).
   * @param sheet - The sheet's name.
   * @param axis - `rows` or `cols`.
   * @param indexes - The 0-based rows or columns.
   */
  reveal(sheet: string, axis: 'rows' | 'cols', indexes: readonly number[]): void {
    const rev = (this.revealed[sheet] ??= { rows: new Set(), cols: new Set(), all: false });
    for (const i of indexes) rev[axis].add(i);
    this.revealVer++; this.schedule();
    fire(this, 'sheetpane-visibility', { sheet, axis: axis === 'rows' ? 'row' : 'col', indexes: [...indexes], hidden: false, via: 'reveal' });
    this.q.selsay.textContent = `${this.spanName(axis, indexes)} shown`;
  }
  /**
   * Hides again what this element revealed for viewing on a sheet (W-49).
   * @param sheet - The sheet's name.
   */
  unreveal(sheet: string): void {
    delete this.revealed[sheet];
    if (this.revealNote?.sheet === sheet) this.revealNote = undefined;
    this.revealVer++; this.schedule();
  }
  private spanName(axis: 'rows' | 'cols', indexes: readonly number[]): string {
    let a = Infinity, b = -Infinity; // a loop, not Math.min(...): a list can hold 125,000 rows
    for (const i of indexes) { if (i < a) a = i; if (i > b) b = i; }
    const n = (i: number) => (axis === 'rows' ? String(i + 1) : colName(i));
    return a === b ? `${axis === 'rows' ? 'Row' : 'Column'} ${n(a)}` : `${axis === 'rows' ? 'Rows' : 'Columns'} ${n(a)} to ${n(b)}`;
  }

  /** The ◂▸ / ▴▾ markers and the double lines where hidden rows and columns sit (W-49 DoD 4). */
  private hiddenMarks(sheet: string, g: SheetGeometry, win: { r0: number; r1: number; c0: number; c1: number }, fr: number, fc: number): { cols: string; layer: string } {
    const z = this.zoom, HH = this.headH() * z, RW = this.rowHeadW() * z, s = this._store!;
    const X = (c: number) => g.colX[Math.min(c, g.cols)]! * z, Y = (r: number) => rowTop(g, r) * z;
    const errs = s.getSnapshot().errors.filter((e) => e.sheet === sheet && e.status === 'open');
    const inSpan = (axis: 'rows' | 'cols', a: number, b: number) => {
      let worst: Severity | undefined, n = 0;
      for (const e of errs) {
        const r = parseRange(e.range);
        if (!r || (axis === 'rows' ? r.top > b || r.bottom < a : r.left > b || r.right < a)) continue;
        n++; if (!worst || sevOrder[e.severity] > sevOrder[worst]) worst = e.severity;
      }
      return worst ? { worst, n } : undefined;
    };
    const filter = (s.sheet(sheet) as { autoFilter?: string } | undefined)?.autoFilter;
    const fr2 = filter ? parseRange(filter) : undefined;
    const label = (axis: 'rows' | 'cols', a: number, b: number) => {
      const n = (i: number) => (axis === 'rows' ? String(i + 1) : colName(i));
      const what = a === b ? `${axis === 'rows' ? 'Row' : 'Column'} ${n(a)}` : `${axis === 'rows' ? 'Rows' : 'Columns'} ${n(a)}–${n(b)}`;
      const filtered = axis === 'rows' && fr2 && a >= fr2.top && b <= fr2.bottom ? ' filtered' : ' hidden';
      return `${what}${filtered}${a === b ? '' : ` (${b - a + 1})`} — click to show`;
    };
    const mark = (axis: 'rows' | 'cols', a: number, b: number, style: string) => {
      const e = inSpan(axis, a, b), l = label(axis, a, b) + (e ? `; ${e.n} open error${e.n === 1 ? '' : 's'} inside` : '');
      return `<button type="button" class="hmk ${axis === 'rows' ? 'hmr' : 'hmc'}" data-hid="${axis}:${a}-${b}" style="${style}" aria-label="${esc(l)}" title="${esc(l)}">${axis === 'rows' ? '▴▾' : '◂▸'}${e ? `<span class="g g-${e.worst}" aria-hidden="true">${SEVERITY[e.worst].glyph}${e.n}</span>` : ''}</button>`;
    };
    let cols = '', layer = '';
    for (const [a, b] of hiddenSpans(g.colX, g.cols)) {
      if (b < win.c0 - 1 && a >= fc) continue;
      if (a > win.c1 + 1) continue;
      const x = RW + X(a);
      // in the layer beside the grid (a grid row owns only cells): sticky at the top with the headers
      layer += mark('cols', a, b, `position:sticky;top:3px;margin:3px 0 0 ${x - 11}px`);
      layer += `<span class="hline hv" style="margin:${HH}px 0 0 ${x - 2}px;height:${Y(g.rows)}px"></span>`;
    }
    // rows: only around the rendered window (every other row hidden must not cost every row)
    const rowSpans: [number, number][] = [];
    const scan = (from: number, to: number) => {
      for (let r = Math.max(0, from); r <= Math.min(g.rows - 1, to); r++) {
        if (!isHiddenAt(g.rowY, r)) continue;
        let a = r, b = r;
        while (a > 0 && isHiddenAt(g.rowY, a - 1)) a--;
        while (b < g.rows - 1 && isHiddenAt(g.rowY, b + 1)) b++;
        if (!rowSpans.some(([x]) => x === a)) rowSpans.push([a, b]);
        r = b;
      }
    };
    scan(0, fr - 1);
    scan(win.r0 - 1, win.r1 + 1);
    for (const [a, b] of rowSpans) {
      const y = HH + Y(a);
      layer += `<span class="hline hh" style="margin:${y - 2}px 0 0 0;width:${RW + X(g.cols)}px"></span>`;
      layer += mark('rows', a, b, `position:sticky;left:${RW - 24}px;margin:${y - 9}px 0 0 ${RW - 24}px`);
    }
    return { cols, layer };
  }

  private onHidbar(e: Event): void {
    const act = (e.target as Element).closest<HTMLElement>('[data-act]')?.dataset.act;
    const s = this._store!, sheet = s.getSnapshot().selection.sheet;
    if (act === 'hide-sheet-again') {
      this.openedSheets.delete(sheet);
      const first = s.getSnapshot().book!.sheets.find((x) => s.hidden(x.name).state === 'visible');
      if (first) s.select({ sheet: first.name, ref: 'A1' }, this);
    } else if (act === 'unhide-sheet') {
      s.setSheetState(sheet, 'visible', this);
    } else if (act === 'hide-again') {
      const n = this.revealNote, rev = this.revealed[sheet];
      if (n && rev) { for (const r of n.rows) rev.rows.delete(r); for (const c of n.cols) rev.cols.delete(c); }
      this.revealNote = undefined; this.revealVer++;
    } else if (act === 'note-close') this.revealNote = undefined;
    this.schedule();
  }

  /** How the last hiding change was asked for: a shortcut, a marker, else a menu or a host call. */
  private visVia: 'menu' | 'key' | 'marker' = 'menu';
  /** `sheetpane-visibility` for a hiding change, with what changed, and said politely (W-49 DoD 11, 12). */
  private visibilityEvent(sheet: string, ref: string, kind: string, was: unknown, now: unknown): void {
    const via = this.visVia; this.visVia = 'menu';
    if (kind === 'sheetState') {
      const hidden = now !== 'visible';
      fire(this, 'sheetpane-visibility', { sheet, axis: 'sheet', indexes: [], hidden, via });
      this.q.selsay.textContent = `Sheet ${sheet} ${hidden ? 'hidden' : 'unhidden'}`;
      return;
    }
    const a = new Set((was as number[]) ?? []), b = new Set((now as number[]) ?? []);
    const added = [...b].filter((i) => !a.has(i)), removed = [...a].filter((i) => !b.has(i));
    const axis = ref === '#hiddenRows' ? 'rows' : 'cols';
    for (const [list, hidden] of [[added, true], [removed, false]] as const) {
      if (!list.length) continue;
      fire(this, 'sheetpane-visibility', { sheet, axis: axis === 'rows' ? 'row' : 'col', indexes: list, hidden, via });
      this.q.selsay.textContent = `${this.spanName(axis, list)} ${hidden ? 'hidden' : 'shown'}`;
    }
  }

  /** A marker: unhide (Edit, with the visibility plugin — a change) or reveal for viewing. */
  private onHiddenMarker(el: HTMLElement): void {
    const [axis, span] = el.dataset.hid!.split(':') as ['rows' | 'cols', string];
    const [a, b] = span.split('-').map(Number) as [number, number];
    const idx = Array.from({ length: b - a + 1 }, (_, i) => a + i);
    const s = this._store!, sheet = s.getSnapshot().selection.sheet;
    if (this.canUnhide()) { this.visVia = 'marker'; s.setHidden(sheet, axis, idx, false, this); }
    else this.reveal(sheet, axis, idx);
  }

  /** A selection landing somewhere hidden shows it — nothing can hide an error from a reviewer (W-49 DoD 5). */
  private revealFor(sheet: string, ref: string): void {
    const s = this._store!, h = s.hidden(sheet), p = parseRef(ref);
    if (!p) return;
    let what = '';
    if (h.state !== 'visible' && !this.openedSheets.has(sheet)) { this.openedSheets.add(sheet); what = 'hidden sheet'; }
    const rev = this.revealed[sheet];
    const rowHidden = h.rows.includes(p.row) && !(rev?.all || rev?.rows.has(p.row));
    const colHidden = h.cols.includes(p.col) && !(rev?.all || rev?.cols.has(p.col));
    if (rowHidden || colHidden) {
      const r = (this.revealed[sheet] ??= { rows: new Set(), cols: new Set(), all: false });
      if (rowHidden) r.rows.add(p.row);
      if (colHidden) r.cols.add(p.col);
      this.revealVer++;
      what = rowHidden && colHidden ? 'hidden row and column' : rowHidden ? 'hidden row' : 'hidden column';
    }
    if (!what) return;
    const err = this.errorAt(sheet, ref);
    this.revealNote = { sheet, text: `Shown for ${err ? err.id : ref} (${what})`, rows: rowHidden ? [p.row] : [], cols: colHidden ? [p.col] : [] };
    this.schedule();
  }

  /** The hidden-sheets button and its menu, at the end of the tabs (W-49 DoD 6). */
  private hiddenSheetsHtml(): string {
    const s = this._store!, snap = s.getSnapshot(), book = snap.book!;
    const hidden = book.sheets.filter((x) => s.hidden(x.name).state !== 'visible');
    if (!hidden.length) return '';
    const errs = snap.mode === 'edit' ? snap.errors.filter((e) => e.status === 'open' && hidden.some((h) => h.name === e.sheet)).length : 0;
    const btn = `<button type="button" class="tab hidbtn" data-act="hidden-sheets" aria-haspopup="menu" aria-expanded="${this.hiddenMenuOpen}" title="Sheets hidden in the file">⊘ ${hidden.length} hidden ▾${errs ? `<span class="cnt" aria-label="${errs} open">${errs}</span>` : ''}</button>`;
    return btn;
  }
  /** The hidden-sheets menu, or the tab menu, above the tabs. */
  private hiddenMenuHtml(): string {
    const s = this._store!, book = s.getSnapshot().book;
    if (this.tabMenu && book) {
      const items = this.pluginMenuItems('tab', { sheet: this.tabMenu.sheet, ref: 'A1' });
      return items ? `<div class="card ctxmenu tabmenu" role="menu" aria-label="Sheet ${esc(this.tabMenu.sheet)}" data-sp="tab-menu" style="left:${this.tabMenu.x}px">${items.replace('<div role="separator" class="msep"></div>', '')}</div>` : '';
    }
    if (!this.hiddenMenuOpen || !book) return '';
    const hidden = book.sheets.filter((x) => s.hidden(x.name).state !== 'visible');
    const items = hidden.map((h) => {
      const very = s.hidden(h.name).state === 'veryHidden';
      return `<button type="button" role="menuitem" class="mi" data-open-sheet="${esc(h.name)}"><span>${esc(h.name)}</span>${very ? '<span class="mnote">very hidden — Excel’s own menu can’t show this one</span>' : ''}</button>`;
    }).join('');
    return hidden.length ? `<div class="card hidmenu" role="menu" aria-label="Hidden sheets">${items}</div>` : '';
  }

  // ── sizes (W-47): drag a header edge, double-click to fit, the header menu ──
  private sheetSizes(sheet: string): { cols: Record<number, number>; rows: Record<number, number> } {
    return (this._sizes[sheet] ??= { cols: {}, rows: {} });
  }

  /** The indexes an edge acts on: every selected whole column (row) when the edge's own is one of them. */
  private sizeTargets(axis: 'col' | 'row', index: number): number[] {
    const s = this._store!, sel = s.getSnapshot().selection, g = this.geometry();
    const r = sel.range ? parseRange(sel.range) : undefined;
    if (!r || !g) return [index];
    const whole = axis === 'col' ? r.top === 0 && r.bottom >= g.g.rows - 1 && index >= r.left && index <= r.right : r.left === 0 && r.right >= g.g.cols - 1 && index >= r.top && index <= r.bottom;
    if (!whole) return [index];
    const out: number[] = [];
    for (let i = axis === 'col' ? r.left : r.top; i <= (axis === 'col' ? r.right : r.bottom); i++) out.push(i);
    return out;
  }

  /** Sets sizes (px at 100 %, or `undefined` for the file's) and redraws; with `via`, fires `sheetpane-resize` and says it. */
  private setSizes(axis: 'col' | 'row', indexes: number[], px: number | undefined, via?: 'drag' | 'fit' | 'menu' | 'reset', each?: number[]): void {
    const sheet = this._store!.getSnapshot().selection.sheet, z = this.sheetSizes(sheet), map = axis === 'col' ? z.cols : z.rows;
    indexes.forEach((i, k) => { const v = each ? each[k] : px; if (v === undefined) delete map[i]; else map[i] = clampSize(axis, v); });
    this.sizesVer++; this.schedule();
    if (!via) return;
    const g = this.geometry()!.g, now = indexes.map((i) => Math.round(axis === 'col' ? colWidth(g, i) : rowHeight(g, i)));
    fire(this, 'sheetpane-resize', { sheet, axis, indexes, px: indexes.length === 1 ? now[0]! : now, via });
    const name = (i: number) => (axis === 'col' ? `Column ${colName(i)}` : `Row ${i + 1}`);
    this.q.selsay.textContent = indexes.length === 1 ? `${name(indexes[0]!)}, ${now[0]} pixels` : `${indexes.length} ${axis === 'col' ? 'columns' : 'rows'}, ${now[0]} pixels`;
  }

  /** Pointer down on a header edge: follow it until release; Esc puts the sizes back. */
  private startResize(e: PointerEvent, el: HTMLElement): void {
    const g = this.geometry();
    if (!g) return;
    e.preventDefault(); e.stopPropagation();
    const axis = el.dataset.rzC !== undefined ? 'col' : 'row', index = Number(axis === 'col' ? el.dataset.rzC : el.dataset.rzR);
    const sheet = this._store!.getSnapshot().selection.sheet, cur = this._sizes[sheet];
    const start = axis === 'col' ? colWidth(g.g, index) : rowHeight(g.g, index);
    this.rz = { id: e.pointerId, axis, indexes: this.sizeTargets(axis, index), start, from: axis === 'col' ? e.clientX : e.clientY, px: start, moved: false, before: cur ? { cols: { ...cur.cols }, rows: { ...cur.rows } } : undefined };
    try { this.q.scroller.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
  }
  private moveResize(e: PointerEvent): void {
    const r = this.rz;
    if (!r || e.pointerId !== r.id) return;
    const delta = ((r.axis === 'col' ? e.clientX : e.clientY) - r.from) / this.zoom;
    if (!r.moved && Math.abs(delta) < 2) return; // a click on the edge with no movement changes nothing
    r.moved = true;
    r.px = clampSize(r.axis, r.start + delta);
    if (!this.rzRaf) this.rzRaf = requestAnimationFrame(() => { this.rzRaf = 0; if (this.rz) { this.setSizes(this.rz.axis, this.rz.indexes, this.rz.px); this.renderNow(); } });
  }
  private endResize(commit: boolean): void {
    const r = this.rz;
    if (!r) return;
    this.rz = undefined;
    if (this.rzRaf) { cancelAnimationFrame(this.rzRaf); this.rzRaf = 0; }
    try { if (this.q.scroller.hasPointerCapture(r.id)) this.q.scroller.releasePointerCapture(r.id); } catch { /* synthetic */ }
    const sheet = this._store!.getSnapshot().selection.sheet;
    if (!commit || !r.moved) {
      if (r.before) this._sizes[sheet] = r.before; else delete this._sizes[sheet];
      this.sizesVer++; this.schedule();
      return;
    }
    this.setSizes(r.axis, r.indexes, r.px, 'drag');
  }

  /** Double-click on an edge, or Fit to data: each column to its widest text, each row to its tallest wrapped text (W-47 DoD 2). */
  private fit(axis: 'col' | 'row', indexes: number[], via: 'fit' | 'menu' = 'fit'): void {
    const g = this.geometry();
    if (!g) return;
    const px = indexes.map((i) => (axis === 'col' ? this.fitWidth(g, i) : this.fitHeight(g, i)));
    this.setSizes(axis, indexes, undefined, via, px);
  }
  private measureCtx: CanvasRenderingContext2D | null | undefined;
  /** The widest display text in a column, in each cell's own size and weight, padding included; merges ignored. */
  private fitWidth(g: { sheet: ImportedSheet; g: SheetGeometry }, c: number): number {
    const s = this._store!, sheet = g.sheet.name, z = this.zoom;
    const ctx = (this.measureCtx ??= document.createElement('canvas').getContext('2d'));
    const sample = this.q.grid.querySelector<HTMLElement>('.c') ?? this.q.grid;
    const cs = getComputedStyle(sample), base = parseFloat(cs.fontSize) || 14 * z, family = cs.fontFamily;
    const pad = base * 1.2 + 4; // .6em each side, the border, a little air
    const rows = new Set<number>();
    for (let r = 0; r < Math.min(g.g.rows, 20_000); r++) rows.add(r);
    for (const el of Array.from(this.q.grid.querySelectorAll<HTMLElement>(`.c[data-c="${c}"]`))) rows.add(Number(el.dataset.r));
    let widest = 0;
    for (const r of rows) {
      const m = mergeAt(g.g, r, c);
      if (m && (m.left !== m.right || m.top !== m.bottom)) continue; // merged cells do not size a column (Excel)
      const ref = cellRef(r, c), text = s.text(sheet, ref);
      if (!text) continue;
      let weight = cs.fontWeight, size = base;
      if (s.plugins.some((p) => p.provides.includes('decorate'))) {
        const d = s.decorate(sheet, ref) as Record<string, string>;
        if (d['font-weight']) weight = d['font-weight'];
        if (d['font-size']) { const v = parseFloat(d['font-size']); if (v) size = d['font-size'].endsWith('em') ? v * base : v * z; }
      }
      const longest = text.split('\n').reduce((a, b) => (b.length > a.length ? b : a), '');
      let w = longest.length * size * 0.6;
      if (ctx) { ctx.font = `${weight} ${size}px ${family}`; w = ctx.measureText(longest).width; }
      widest = Math.max(widest, w);
    }
    return Math.min(480, Math.max(DEFAULT_COL_PX, Math.ceil((widest + pad) / z)));
  }
  /** The tallest wrapped text in a row at the current column widths, at least 28 px. */
  private fitHeight(g: { sheet: ImportedSheet; g: SheetGeometry }, r: number): number {
    const s = this._store!, sheet = g.sheet.name, z = this.zoom;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0;box-sizing:border-box;padding:4px .6em;font-size:var(--sp-cell-font-size,.93em)';
    this.q.sheet.append(probe);
    let tallest = ROW_H * z;
    try {
      for (let c = 0; c < g.g.cols; c++) {
        const ref = cellRef(r, c), text = s.text(sheet, ref);
        if (!text) continue;
        const d = s.plugins.some((p) => p.provides.includes('decorate')) ? (s.decorate(sheet, ref) as Record<string, string>) : {};
        const wraps = (d['white-space'] ?? '').startsWith('pre-wrap') || (d['white-space'] ?? '') === 'normal' || text.includes('\n');
        if (!wraps) continue;
        probe.style.width = `${colWidth(g.g, c) * z}px`;
        probe.style.whiteSpace = 'pre-wrap';
        probe.style.fontWeight = d['font-weight'] ?? '';
        probe.textContent = text;
        tallest = Math.max(tallest, probe.offsetHeight);
      }
    } finally { probe.remove(); }
    return Math.max(ROW_H, Math.ceil(tallest / z));
  }

  /** The exact-size field: arrows ±1, Shift+arrows ±10, Enter applies, Esc cancels. True when handled. */
  private onSizeKey(e: KeyboardEvent): boolean {
    const f = (e.target as HTMLElement).closest?.('.szpop input') as HTMLInputElement | null;
    if (!f) return false;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); f.value = String((Number(f.value) || 0) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)); return true; }
    if (e.key === 'Enter') { e.preventDefault(); this.applySizeField(); return true; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.hdrMenu = undefined; this.schedule(); this.q.grid.focus({ preventScroll: true }); return true; }
    return false;
  }
  private applySizeField(): void {
    const m = this.hdrMenu, f = this.q.overlay.querySelector<HTMLInputElement>('.szpop input');
    if (!m || !f) return;
    const v = Number(f.value);
    this.hdrMenu = undefined;
    if (Number.isFinite(v) && v > 0) this.setSizes(m.axis, m.indexes, v, 'menu'); else this.schedule();
    this.q.grid.focus({ preventScroll: true });
  }

  /** The `selbar` controls that join a menu (W-49 `menus`), as menu items under a separator. */
  private pluginMenuItems(menu: 'header' | 'tab', sel?: { sheet: string; ref: string; range?: string }): string {
    const s = this._store!, snap = s.getSnapshot();
    if (snap.mode !== 'edit') return '';
    const at = sel ?? snap.selection;
    const list = controlsFor(s.plugins, 'selbar', 'edit').filter((c) => c.menus?.includes(menu));
    if (!list.length) return '';
    return `<div role="separator" class="msep"></div>${list.map((c) => {
      const label = c.labelFor?.(snap, at) ?? c.label, off = c.disabled?.(snap, at) ?? false, why = off ? c.disabledReason?.(snap, at) : undefined;
      return `<button type="button" role="menuitem" class="mi" data-control="${esc(c.id)}" data-menu="${menu}"${off ? ' disabled' : ''}${why ? ` title="${esc(why)}"` : ''}>${esc(label)}${c.shortcut ? `<span class="kbd">${esc(c.shortcut)}</span>` : ''}</button>`;
    }).join('')}`;
  }

  /** The header menu (right-click a header; Shift+F10 on a whole column or row): Fit · Width… · Reset (W-47 DoD 4). */
  private openHeaderMenu(axis: 'col' | 'row', indexes: number[]): void {
    this.ctxOpen = false; this.moreOpen = false; this.menu = undefined;
    this.hdrMenu = { axis, indexes, sizing: false };
    this.schedule();
    requestAnimationFrame(() => this.q.overlay.querySelector<HTMLElement>('.hdrmenu [role=menuitem]')?.focus({ preventScroll: true }));
  }
  private headerMenuHtml(g: SheetGeometry, z: number): string {
    const m = this.hdrMenu!, sc = this.q.scroller, HH = this.headH() * z, RW = this.rowHeadW() * z;
    const first = m.indexes[0]!;
    const x = m.axis === 'col' ? RW + g.colX[Math.min(first, g.cols)]! * z : sc.scrollLeft + RW + 2;
    const y = m.axis === 'col' ? sc.scrollTop + HH + 2 : HH + rowTop(g, first + 1) * z + 2;
    const what = m.axis === 'col' ? 'Column width' : 'Row height';
    const cur = Math.round(m.axis === 'col' ? colWidth(g, first) : rowHeight(g, first));
    if (m.sizing) {
      return `<div class="card szpop" role="dialog" aria-label="${what}" style="top:${y}px;left:${x}px;width:220px"><div class="bd"><label class="field"><span>${what} (px)</span><input class="input" type="number" data-field="size" min="${m.axis === 'col' ? COL_MIN : ROW_MIN}" max="${m.axis === 'col' ? COL_MAX : ROW_MAX}" value="${cur}" aria-label="${what} in pixels"></label><span class="xs faint">Arrows ±1 · Shift ±10 · Enter applies${m.indexes.length > 1 ? ` to ${m.indexes.length} ${m.axis === 'col' ? 'columns' : 'rows'}` : ''}</span></div><div class="ft"><span class="spacer"></span><button type="button" class="btn btn-g" data-act="hcancel">Cancel</button><button type="button" class="btn btn-p" data-act="happly">Apply</button></div></div>`;
    }
    const item = (act: string, label: string) => `<button type="button" role="menuitem" class="mi" data-act="${act}">${esc(label)}</button>`;
    return `<div class="card ctxmenu hdrmenu" role="menu" aria-label="${m.axis === 'col' ? 'Column' : 'Row'} menu" data-sp="header-menu" style="top:${y}px;left:${x}px">${item('hfit', 'Fit to data')}${item('hsize', `${what}…`)}${item('hreset', 'Reset to the file’s size')}${this.pluginMenuItems('header')}</div>`;
  }

  /** A header click: the whole column, row or sheet; with Shift, out to it from the anchor. */
  private selectHeader(h: { kind: 'col' | 'row' | 'all'; index: number }, extend: boolean): void {
    const s = this._store!, g = this.geometry();
    if (!g) return;
    const sheet = s.getSnapshot().selection.sheet;
    const fz = s.freeze(sheet), sc = this.q.scroller;
    // the active cell stays at the first visible cell of the range
    const firstRow = fz.rows > 0 ? 0 : rowAt(g.g, sc.scrollTop / this.zoom);
    const firstCol = fz.cols > 0 ? 0 : Math.min(g.g.cols - 1, colAt(g.g, sc.scrollLeft / this.zoom));
    let r: RangePos, active: Pos;
    if (h.kind === 'all') { r = { top: 0, left: 0, bottom: g.g.rows - 1, right: g.g.cols - 1 }; active = { row: firstRow, col: firstCol }; this.anchor = { row: 0, col: 0 }; }
    else if (h.kind === 'col') {
      const from = extend && this.anchor ? this.anchor.col : h.index;
      r = { top: 0, bottom: g.g.rows - 1, left: Math.min(from, h.index), right: Math.max(from, h.index) };
      active = { row: firstRow, col: extend && this.anchor ? this.anchor.col : h.index };
      if (!extend) this.anchor = { row: 0, col: h.index };
    } else {
      const from = extend && this.anchor ? this.anchor.row : h.index;
      r = { left: 0, right: g.g.cols - 1, top: Math.min(from, h.index), bottom: Math.max(from, h.index) };
      active = { row: extend && this.anchor ? this.anchor.row : h.index, col: firstCol };
      if (!extend) this.anchor = { row: h.index, col: 0 };
    }
    s.select({ sheet, ref: cellRef(active.row, active.col), range: rangeText(r) }, this);
    this.say(r);
  }

  /** Says the settled range once, politely (W-46 DoD 9). */
  private say(r: RangePos): void {
    clearTimeout(this.sayTimer);
    this.sayTimer = setTimeout(() => { if (this.built) this.q.selsay.textContent = `${cellRef(r.top, r.left)} to ${cellRef(r.bottom, r.right)}, ${cellCount(r)} cells`; }, 250);
  }

  private selectCell(row: number, col: number, extend: boolean, dir: { dr: number; dc: number } = { dr: 1, dc: 1 }): void {
    const s = this._store!, snap = s.getSnapshot();
    const gq = this.geometry();
    if (gq) { row = this.nearestShown(gq.g.rowY, gq.g.rows, row, dir.dr); col = this.nearestShown(gq.g.colX, gq.g.cols, col, dir.dc); } // keys skip hidden rows and columns (W-49)
    const ref = cellRef(row, col);
    if (extend && this.anchor) {
      const g = this.geometry();
      const r = growForMerges(spanOf(this.anchor, { row, col }), g?.g.merges ?? []);
      const one = r.top === r.bottom && r.left === r.right;
      const am = g && mergeAt(g.g, this.anchor.row, this.anchor.col);
      const range = one || (am && am.top === r.top && am.left === r.left && am.bottom === r.bottom && am.right === r.right) ? undefined : rangeText(r);
      s.select(range ? { sheet: snap.selection.sheet, ref: cellRef(this.anchor.row, this.anchor.col), range } : { sheet: snap.selection.sheet, ref: cellRef(this.anchor.row, this.anchor.col) }, this);
      if (range) this.say(r);
    } else {
      this.anchor = { row, col };
      s.select({ sheet: snap.selection.sheet, ref }, this);
    }
    this.scrollToSel = true;
  }

  /** The APG grid keyboard model (grid verdict decision 4). */
  private onKey(e: KeyboardEvent): void {
    const s = this._store!, snap = s.getSnapshot();
    if (snap.load.status !== 'ready') return;
    const mod = e.metaKey || e.ctrlKey;
    const edit = snap.mode === 'edit';
    const g = this.geometry();
    if (!g) return;
    const page = Math.max(1, Math.floor(this.q.scroller.clientHeight / (ROW_H * this.zoom)) - 2);
    const k = e.key;
    let handled = true;
    const ctl = s.plugins.flatMap((p) => p.controls ?? []).find((c) => c.shortcut && c.run && (c.mode === 'both' || c.mode === snap.mode) && this.matchesShortcut(e, c.shortcut));
    if (ctl && !ctl.disabled?.(snap, snap.selection)) { this.visVia = 'key'; ctl.run!(s, snap.selection); this.visVia = 'menu'; e.preventDefault(); return; }
    if (e.altKey && e.shiftKey && (k === 'ArrowDown' || k === 'ArrowUp') && !mod) {
      // Alt+Shift+↓ / ↑: expand or collapse the innermost row group at the active cell (W-49, view only)
      const o = s.outline(snap.selection.sheet), p0 = parseRef(snap.selection.ref)!;
      const mine = this.groupsOf(o.rows, o.levelRow, p0.row, p0.row, g.g.rows).filter(([, a, b]) => p0.row >= a && p0.row <= b).sort((x, y) => y[0] - x[0])[0];
      if (mine) { this.toggleGroup('rows', mine[1], mine[2], k === 'ArrowDown'); e.preventDefault(); return; }
    }
    if (e.altKey && !e.shiftKey && k === 'ArrowDown' && edit) {
      const ctx = s.cellContext(snap.selection.sheet, snap.selection.ref);
      const mc = ctx && controlsFor(s.plugins, 'cell', 'edit').find((c) => c.cellOptions && c.choose && c.appliesTo?.(ctx));
      if (mc && ctx) { this.menu = { control: mc.id, sheet: snap.selection.sheet, ref: snap.selection.ref, options: mc.cellOptions!(ctx) }; this.focusMenu = true; this.schedule(); e.preventDefault(); return; }
    }
    if (this.drag && k === 'Escape') { this.endDrag(false); e.preventDefault(); e.stopPropagation(); return; }
    if (this.rz && k === 'Escape') { this.endResize(false); e.preventDefault(); e.stopPropagation(); return; }
    const range = snap.selection.range ? parseRange(snap.selection.range) : undefined;
    const arrow = k === 'ArrowDown' ? [1, 0] : k === 'ArrowUp' ? [-1, 0] : k === 'ArrowRight' ? [0, 1] : k === 'ArrowLeft' ? [0, -1] : undefined;
    if (mod && arrow && !e.altKey) {
      // Ctrl/⌘+arrow: the edge of the data; with Shift, extend there (W-46 DoD 5)
      const from = e.shiftKey && this.anchor && range ? this.rangeEnd(snap.selection) : parseRef(snap.selection.ref)!;
      const to = dataEdge(from, arrow[0]!, arrow[1]!, (r, c) => s.value(snap.selection.sheet, cellRef(r, c)), { rows: g.g.rows, cols: g.g.cols });
      if (e.shiftKey && !this.anchor) this.anchor = parseRef(snap.selection.ref)!;
      this.selectCell(to.row, to.col, e.shiftKey, { dr: -(arrow[0]! || -1), dc: -(arrow[1]! || -1) });
    }
    else if (k === ' ' && (e.ctrlKey || e.shiftKey) && !e.metaKey && !e.altKey && !(e.ctrlKey && e.shiftKey)) {
      // Ctrl+Space: the columns; Shift+Space: the rows — of the active cell or the range
      const r = range ?? { top: parseRef(snap.selection.ref)!.row, bottom: parseRef(snap.selection.ref)!.row, left: parseRef(snap.selection.ref)!.col, right: parseRef(snap.selection.ref)!.col };
      const whole = e.ctrlKey ? { top: 0, bottom: g.g.rows - 1, left: r.left, right: r.right } : { left: 0, right: g.g.cols - 1, top: r.top, bottom: r.bottom };
      s.select({ sheet: snap.selection.sheet, ref: snap.selection.ref, range: rangeText(whole) }, this);
      this.say(whole);
    }
    else if (mod && (k === 'a' || k === 'A') && !e.shiftKey && !e.altKey) {
      // Ctrl/⌘+A: the data region; again: the whole sheet
      const used = usedRange(g.sheet.rows), all = { top: 0, left: 0, bottom: g.g.rows - 1, right: g.g.cols - 1 };
      const next = range && rangeText(range) === rangeText(used) ? all : used;
      const one = next.top === next.bottom && next.left === next.right;
      s.select(one ? { sheet: snap.selection.sheet, ref: cellRef(next.top, next.left) } : { sheet: snap.selection.sheet, ref: snap.selection.ref, range: rangeText(next) }, this);
      this.anchor = { row: next.top, col: next.left };
      if (!one) this.say(next);
    }
    else if (k === 'Backspace' && e.shiftKey && !mod) { this.anchor = parseRef(snap.selection.ref)!; s.select({ sheet: snap.selection.sheet, ref: snap.selection.ref }, this); }
    else if (range && (k === 'Enter' || k === 'Tab') && !mod && !e.altKey) this.stepInRange(range, k === 'Tab', e.shiftKey);
    else if (mod && (k === 'z' || k === 'Z')) { if (e.shiftKey) s.redo(this); else s.undo(this); }
    else if (mod && (k === 'y' || k === 'Y')) s.redo(this);
    else if (mod && (k === 'c' || k === 'C')) this.copySelection();
    else if ((k === 'F10' && e.shiftKey) || k === 'ContextMenu') {
      // a whole column or row selected: its size menu (W-47); otherwise the selection actions
      const whole = range && (range.top === 0 && range.bottom >= g.g.rows - 1 ? 'col' : range.left === 0 && range.right >= g.g.cols - 1 ? 'row' : undefined);
      if (whole && range) this.openHeaderMenu(whole, this.sizeTargets(whole, whole === 'col' ? range.left : range.top));
      else this.openContextMenu();
    }
    else if (k === 'ArrowDown') this.move(1, 0, e.shiftKey);
    else if (k === 'ArrowUp') this.move(-1, 0, e.shiftKey);
    else if (k === 'ArrowRight') this.move(0, 1, e.shiftKey);
    else if (k === 'ArrowLeft') this.move(0, -1, e.shiftKey);
    else if (k === 'PageDown') this.move(page, 0, e.shiftKey);
    else if (k === 'PageUp') this.move(-page, 0, e.shiftKey);
    else if (k === 'Home') { const p = parseRef(snap.selection.ref)!; this.selectCell(mod ? 0 : p.row, 0, e.shiftKey); }
    else if (k === 'End') { const p = parseRef(snap.selection.ref)!; const s0 = this.geom!.sheet; this.selectCell(mod ? Math.max(0, s0.rows.length - 1) : p.row, mod ? g.g.cols - 1 : Math.max(0, (s0.rows[p.row]?.length ?? 1) - 1), e.shiftKey); }
    else if ((k === 'Enter' || k === 'F2') && edit) this.editCell();
    else if ((k === 'f' || k === 'F') && edit && !mod && !e.altKey) this.flag();
    else if (k === 'Escape') { if (!this.escape()) handled = false; }
    else if ((k === 'Delete' || k === 'Backspace') && edit) {
      if (range) this.clearRange(range);
      else if (this.allowChange(snap.selection.sheet, snap.selection.ref, null)) s.setCell(snap.selection.sheet, snap.selection.ref, null, { origin: this });
    }
    else if (edit && !mod && !e.altKey && k.length === 1) { this.editCell(k); }
    else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }

  /** Esc cancels the innermost thing open; false when nothing was. */
  private escape(): boolean {
    const s = this._store;
    if (this.menu) { this.menu = undefined; this.schedule(); return true; }
    if (this.hdrMenu) { this.hdrMenu = undefined; this.schedule(); return true; }
    if (this.tabMenu || this.hiddenMenuOpen) { this.tabMenu = undefined; this.hiddenMenuOpen = false; this.schedule(); return true; }
    if (this.ctxOpen || this.moreOpen || this.dlOpen) { this.ctxOpen = false; this.moreOpen = false; this.dlOpen = false; this.schedule(); return true; }
    if (s?.getSnapshot().composing) { s.compose(null); return true; }
    if (this.findText) { (this.q.findin as HTMLInputElement).value = ''; this.findText = ''; this.findHits = []; this.schedule(); return true; }
    if (this.copied) { this.copied = undefined; this.selKey = ''; this.schedule(); return true; }
    return false;
  }

  private move(dr: number, dc: number, extend: boolean): void {
    const s = this._store!, snap = s.getSnapshot(), g = this.geometry();
    if (!g) return;
    const base = extend && this.anchor && snap.selection.range ? this.rangeEnd(snap.selection) : parseRef(snap.selection.ref)!;
    let row = Math.min(g.g.rows - 1, Math.max(0, base.row + dr)), col = Math.min(g.g.cols - 1, Math.max(0, base.col + dc));
    if (!extend) {
      const m = mergeAt(g.g, base.row, base.col);
      if (m && !(dr === 0 && dc === 0)) { if (dr > 0) row = Math.min(g.g.rows - 1, m.bottom + 1); if (dc > 0) col = Math.min(g.g.cols - 1, m.right + 1); }
      const m2 = mergeAt(g.g, row, col);
      if (m2) { row = m2.top; col = m2.left; }
    }
    if (extend && !this.anchor) this.anchor = parseRef(snap.selection.ref)!;
    // stepping onto hidden rows (columns) carries on past them, in the direction of travel
    this.selectCell(row, col, extend, { dr: dr || 1, dc: dc || 1 });
  }
  /** Enter / Tab inside a range: the active cell moves within it and wraps, as in Excel (W-46 DoD 5). */
  private stepInRange(r: RangePos, across: boolean, back: boolean): void {
    const s = this._store!, sel = s.getSnapshot().selection, p = parseRef(sel.ref)!;
    const h = r.bottom - r.top + 1, w = r.right - r.left + 1, n = h * w;
    // the cells in order: down the columns for Enter, along the rows for Tab
    const idx = across ? (p.row - r.top) * w + (p.col - r.left) : (p.col - r.left) * h + (p.row - r.top);
    const next = (idx + (back ? -1 : 1) + n) % n;
    const pos = across ? { row: r.top + Math.floor(next / w), col: r.left + (next % w) } : { row: r.top + (next % h), col: r.left + Math.floor(next / h) };
    s.select({ sheet: sel.sheet, ref: cellRef(pos.row, pos.col), range: sel.range! }, this);
    this.scrollToSel = true;
  }

  /** Ctrl/⌘+C: one cell's value, or a range as TSV and an HTML table; the copied range is outlined (W-46 DoD 6). */
  private copySelection(): void {
    const s = this._store!, sel = s.getSnapshot().selection;
    const r = sel.range ? parseRange(sel.range) : undefined;
    if (!r) { this.copied = undefined; this.copy(s.text(sel.sheet, sel.ref)); this.schedule(); return; }
    if (cellCount(r) > 1_000_000) { this.say0(`Nothing copied — ${cellCount(r).toLocaleString()} cells is over the 1,000,000 a copy holds`); return; }
    const g = this.geometry()!.g, left = this.hiddenIn(g, r);
    const { tsv, html } = clipOf(r, (row, col) => s.text(sel.sheet, cellRef(row, col)), { row: (i) => this.shownRow(g, i), col: (i) => this.shownCol(g, i) });
    if (left) this.say0(`Copied the shown cells — ${left} hidden cell${left === 1 ? '' : 's'} left out`);
    const fallback = () => this.copy(tsv);
    const Item = (globalThis as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
    if (navigator.clipboard?.write && Item) navigator.clipboard.write([new Item({ 'text/plain': new Blob([tsv], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) })]).catch(fallback);
    else fallback();
    this.copied = { sheet: sel.sheet, range: r };
    this.selKey = '';
    this.schedule();
  }

  /** A status-line notice for a few seconds. */
  private say0(text: string): void {
    this.notice = text; clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => { this.notice = ''; this.schedule(); }, 4000);
    this.schedule();
  }

  /** Delete / Backspace over a range (Edit): every filled cell through `sheetpane-beforechange`, refused ones skipped, one undo step. */
  private clearRange(r: RangePos): void {
    const s = this._store!, sheet = s.getSnapshot().selection.sheet, g = this.geometry();
    if (!g) return;
    const cells: { sheet: string; ref: string; input: Cell }[] = [];
    const left = this.hiddenIn(g.g, r);
    if (left) this.say0(`Cleared the shown cells — ${left} hidden cell${left === 1 ? '' : 's'} left out`);
    for (let row = r.top; row <= Math.min(r.bottom, g.g.rows - 1); row++) for (let col = r.left; col <= Math.min(r.right, g.g.cols - 1); col++) {
      if (!this.shownRow(g.g, row) || !this.shownCol(g.g, col)) continue;
      const ref = cellRef(row, col), v = s.value(sheet, ref);
      if (v === null || v === undefined || v === '') continue;
      if (this.allowChange(sheet, ref, null)) cells.push({ sheet, ref, input: null });
    }
    if (cells.length) s.setCells(cells, { origin: this });
  }

  private rangeEnd(sel: { ref: string; range?: string }): { row: number; col: number } {
    const r = parseRange(sel.range!)!, a = this.anchor!;
    return { row: a.row === r.top ? r.bottom : r.top, col: a.col === r.left ? r.right : r.left };
  }

  private editCell(first?: string): void {
    const cell = this.q.cell as HTMLInputElement;
    if (cell.hidden) return;
    cell.focus();
    if (first !== undefined) { cell.value = first; cell.dispatchEvent(new Event('input')); } else cell.select();
  }

  /** Flag issue (`F`): the store decides which form opens (contract decision 4). */
  private flag(): void {
    const s = this._store!, sel = s.getSnapshot().selection;
    if (!s.flagging) return; // flagging="off" (W-33)
    const t = this._errorTypes[0]!;
    this.draft = { type: t.id, message: '', expected: '', severity: t.severity, change: false };
    this.composerKey = '';
    const c: { sheet: string; ref: string; range?: string } = { sheet: sel.sheet, ref: sel.ref };
    if (sel.range) c.range = sel.range;
    s.compose(c);
  }

  private toggleFreeze(): void {
    const s = this._store!, sel = s.getSnapshot().selection, cur = s.freeze(sel.sheet);
    if (cur.rows || cur.cols) s.setFreeze(sel.sheet, { rows: 0, cols: 0 }, this);
    else { const p = parseRef(sel.ref)!; s.setFreeze(sel.sheet, { rows: p.row, cols: p.col }, this); }
  }

  private findNext(dir: 1 | -1): void {
    this.computeHits();
    if (!this.findHits.length) return;
    this.findIdx = (this.findIdx + dir + this.findHits.length) % this.findHits.length;
    const h = this.findHits[this.findIdx]!;
    this._store!.select({ sheet: h.sheet, ref: h.ref }, this);
    this.anchor = parseRef(h.ref)!;
    this.scrollToSel = true;
    this.schedule();
  }

  /** Find covers every row of every sheet, not just the rendered window. */
  private computeHits(): void {
    const s = this._store!, snap = s.getSnapshot();
    if (this.findVersion === snap.version) return;
    this.findVersion = snap.version;
    this.findHits = [];
    const q = this.findText.trim().toLowerCase();
    if (!q || !snap.book) return;
    const order = [snap.selection.sheet, ...snap.book.sheets.map((x) => x.name).filter((n) => n !== snap.selection.sheet)];
    for (const name of order) {
      const sh = s.sheet(name)!;
      for (let r = 0; r < sh.text.length; r++) {
        const row = sh.text[r]!;
        for (let c = 0; c < row.length; c++) {
          const ref = cellRef(r, c);
          if (s.text(name, ref).toLowerCase().includes(q)) this.findHits.push({ sheet: name, ref });
        }
      }
    }
    for (const [k] of snap.changes) {
      const { sheet, ref } = splitKey(k);
      if (!ref.startsWith('#') && s.text(sheet, ref).toLowerCase().includes(q) && !this.findHits.some((h) => h.sheet === sheet && h.ref === ref)) this.findHits.push({ sheet, ref });
    }
  }

  private onOverlayClick(e: Event): void {
    const t = e.target as HTMLElement, s = this._store!, snap = s.getSnapshot();
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    const pin = t.closest<HTMLElement>('[data-pin]');
    if (pin) { const err = snap.errors.find((x) => x.id === pin.dataset.pin); if (err) { const r = parseRange(err.range)!; this.anchor = { row: r.top, col: r.left }; s.select({ sheet: err.sheet, ref: cellRef(r.top, r.left) }, this); } return; }
    const inCtx = !!t.closest('.ctxmenu:not(.hdrmenu)');
    if (inCtx) { this.ctxOpen = false; this.schedule(); queueMicrotask(() => this.q.grid.focus({ preventScroll: true })); }
    if (!act) {
      const c = t.closest<HTMLElement>('[data-control]');
      if (c) { this.runControl(e); if (c.dataset.menu === 'header') { this.hdrMenu = undefined; this.schedule(); this.q.grid.focus({ preventScroll: true }); } }
      return;
    }
    const sel = snap.selection;
    const err = this.errorAt(sel.sheet, sel.ref);
    switch (act) {
      case 'hfit': if (this.hdrMenu) { const m = this.hdrMenu; this.hdrMenu = undefined; this.fit(m.axis, m.indexes, 'menu'); this.q.grid.focus({ preventScroll: true }); } break;
      case 'hreset': if (this.hdrMenu) { const m = this.hdrMenu; this.hdrMenu = undefined; this.setSizes(m.axis, m.indexes, undefined, 'reset'); this.q.grid.focus({ preventScroll: true }); } break;
      case 'hsize': if (this.hdrMenu) { this.hdrMenu.sizing = true; this.schedule(); requestAnimationFrame(() => this.q.overlay.querySelector<HTMLInputElement>('.szpop input')?.select()); } break;
      case 'happly': this.applySizeField(); break;
      case 'hcancel': this.hdrMenu = undefined; this.schedule(); this.q.grid.focus({ preventScroll: true }); break;
      case 'flag': this.flag(); break;
      case 'copy-ref': this.copy(this.refOf(sel)); break;
      case 'copy-value': this.copySelection(); break;
      case 'resolve': if (err) s.updateError(err.id, { status: err.status === 'open' ? 'resolved' : 'open' }, this); break;
      case 'delete': if (err) s.deleteError(err.id, this); break;
      case 'prev': case 'next': this.stepError(act === 'next' ? 1 : -1); break;
      case 'sev': this.draft.severity = t.closest<HTMLElement>('[data-sev]')!.dataset.sev as Severity; this.composerKey = ''; this.schedule(); break;
      case 'cancel': s.compose(null); this.q.grid.focus({ preventScroll: true }); break;
      case 'add': this.addFromComposer(); break;
      case 'pick-option': {
        const m = this.menu;
        this.menu = undefined;
        const c = m && s.plugins.flatMap((p) => p.controls ?? []).find((x) => x.id === m.control);
        if (m && c?.choose) c.choose(s, { sheet: m.sheet, ref: m.ref }, t.closest<HTMLElement>('[data-v]')!.dataset.v!);
        this.schedule();
        break;
      }
    }
  }

  private onComposerInput(e: Event): void {
    const t = e.target as HTMLInputElement;
    const f = t.dataset.field;
    if (!f) return;
    if (f === 'type') {
      const ty = this._errorTypes.find((x) => x.id === t.value);
      this.draft.type = t.value;
      if (ty) this.draft.severity = ty.severity;
      this.composerKey = '';
      this.schedule();
    } else if (f === 'message') this.draft.message = t.value;
    else if (f === 'expected') this.draft.expected = t.value;
    else if (f === 'change') this.draft.change = t.checked;
  }

  private addFromComposer(): void {
    const s = this._store!, c = s.getSnapshot().composing;
    if (!c) return;
    let range = c.range ?? c.ref;
    if (this.draft.type === 'duplicate-row') { const p = parseRef(c.ref)!; const g = this.geometry(); range = `${cellRef(p.row, 0)}:${cellRef(p.row, (g?.g.cols ?? 1) - 1)}`; }
    s.addError({ sheet: c.sheet, range, type: this.draft.type, severity: this.draft.severity, expected: this.draft.expected, message: this.draft.message, cellChanged: this.draft.change, author: this.getAttribute('author') ?? '' }, this);
    this.q.grid.focus({ preventScroll: true });
  }

  private stepError(dir: 1 | -1): void {
    const s = this._store!, snap = s.getSnapshot();
    const list = snap.errors.filter((e) => e.sheet === snap.selection.sheet);
    if (!list.length) return;
    const cur = this.errorAt(snap.selection.sheet, snap.selection.ref);
    const i = cur ? list.indexOf(cur) : -1;
    const nx = list[(i + dir + list.length) % list.length]!;
    const r = parseRange(nx.range)!;
    this.anchor = { row: r.top, col: r.left };
    s.select({ sheet: nx.sheet, ref: cellRef(r.top, r.left) }, this);
  }

  private errorAt(sheet: string, ref: string): SheetpaneError | undefined {
    const p = parseRef(ref);
    if (!p) return undefined;
    const hits = this._store!.getSnapshot().errors.filter((e) => {
      if (e.sheet !== sheet) return false;
      const r = parseRange(e.range);
      return !!r && p.row >= r.top && p.row <= r.bottom && p.col >= r.left && p.col <= r.right;
    });
    return hits.sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || sevOrder[b.severity] - sevOrder[a.severity])[0];
  }

  private chooseControl(e: Event): void {
    const t = e.target as HTMLSelectElement;
    if (t.tagName !== 'SELECT' || !t.dataset.control) return;
    const c = this._store!.plugins.flatMap((p) => p.controls ?? []).find((x) => x.id === t.dataset.control);
    c?.choose?.(this._store!, this._store!.getSnapshot().selection, t.value);
  }

  private runControl(e: Event): void {
    const b = (e.target as Element).closest<HTMLElement>('[data-control]');
    if (!b || b.tagName === 'SELECT') return;
    const c = this._store!.plugins.flatMap((p) => p.controls ?? []).find((x) => x.id === b.dataset.control);
    const snap = this._store!.getSnapshot();
    if (c?.disabled?.(snap, snap.selection)) return;
    c?.run?.(this._store!, snap.selection);
  }
  private runCellControl(mk: HTMLElement): void {
    const s = this._store!;
    const c = s.plugins.flatMap((p) => p.controls ?? []).find((x) => x.id === mk.dataset.control);
    const cell = mk.closest<HTMLElement>('.c')!;
    const sel = { sheet: s.getSnapshot().selection.sheet, ref: cellRef(Number(cell.dataset.r), Number(cell.dataset.c)) };
    s.select(sel, this);
    const ctx = s.cellContext(sel.sheet, sel.ref);
    if (c?.cellOptions && c.choose && ctx) { this.menu = { control: c.id, sheet: sel.sheet, ref: sel.ref, options: c.cellOptions(ctx) }; this.schedule(); return; }
    c?.run?.(s, sel);
  }
  private menu: { control: string; sheet: string; ref: string; options: string[] } | undefined;
  private focusMenu = false;

  // ── rendering ────────────────────────────────────────────────────────────
  private schedule(): void {
    if (this.raf || !this.built) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); });
  }

  /** Renders now (tests and the first frame). */
  renderNow(): void { cancelAnimationFrame(this.raf); this.raf = 0; this.render(); }

  private geometry(): { sheet: ImportedSheet; g: SheetGeometry } | undefined {
    const s = this._store, snap = s?.getSnapshot();
    const sheet = snap && s!.sheet(snap.selection.sheet);
    if (!sheet) return undefined;
    const merges = s!.merges(sheet.name);
    const hid = s!.hidden(sheet.name), rev = this.revealed[sheet.name];
    const ol = s!.outline(sheet.name);
    const mk = `${merges.join('|')}#${this.sizesVer}#${hid.rows.join(',')}#${hid.cols.join(',')}#${this.revealVer}#${ol.levelRow},${ol.levelCol}`;
    if (this.geom?.sheet !== sheet || this.geomMerges !== mk) {
      // the file's hiding, less what this element reveals for viewing (W-49)
      const vh = this.viewHidden[sheet.name];
      const keep = (list: number[], shown: Set<number> | undefined, view: Set<number> | undefined) => new Set([...(rev?.all ? [] : list.filter((i) => !shown?.has(i))), ...(view ?? [])]);
      this.geom = { sheet, g: sheetGeometry(sheet, merges, this._sizes[sheet.name] as SheetSizes | undefined, { rows: keep(hid.rows, rev?.rows, vh?.rows), cols: keep(hid.cols, rev?.cols, vh?.cols) }) };
      this.geomMerges = mk;
    }
    return this.geom;
  }
  private geomMerges = '';

  /** Geometry as plugins see it: pixels at 100 % zoom from A1's top-left. */
  geometryFor(sheet: string): Geometry | undefined {
    const sh = this._store?.sheet(sheet);
    if (!sh) return undefined;
    const g = this.geom?.sheet === sh ? this.geom.g : sheetGeometry(sh);
    // past the last drawn column a column is 64 px wide (Excel's default), so x keeps growing
    return { colX: (c) => (c <= g.cols ? g.colX[c]! : g.colX[g.cols]! + (c - g.cols) * DEFAULT_COL_PX), colWidth: (c) => colWidth(g, c), rowY: (r) => rowTop(g, r), rowHeight: (r) => rowHeight(g, r) };
  }

  private render(): void {
    const s = this._store;
    if (!s || !this.built) return;
    const snap = s.getSnapshot(), q = this.q;
    const ready = snap.load.status === 'ready' && !this.showEmpty;
    q.scroller.hidden = !ready;
    q.state.hidden = ready;
    for (const k of ['.bar', '.fx', '.tabs']) (q.root.querySelector(k) as HTMLElement).hidden = !ready;
    if (!ready) { this.renderState(); q.frow.hidden = true; q.status.textContent = 'Read in this tab — nothing is uploaded'; return; }
    const book = snap.book!, src = snap.source!;
    const edit = snap.mode === 'edit';
    const g = this.geometry()!;
    const sheet = g.sheet;
    // toolbar
    q.fname.textContent = src.name;
    q.meta.textContent = `${src.kind} · ${fmtSize(src.size)} · ${src.kind === 'csv' ? delimName(book.delimiter) : `${book.sheets.length} sheet${book.sheets.length === 1 ? '' : 's'}`}`;
    for (const b of Array.from(q.modeseg.querySelectorAll('button'))) b.setAttribute('aria-pressed', String(b.dataset.mode === snap.mode));
    const open = { error: 0, warning: 0, note: 0 };
    for (const e of snap.errors) if (e.status === 'open') open[e.severity]++;
    q.counts.innerHTML = edit ? `<span class="chip chip-fail" title="Open errors">✕ ${open.error}</span> <span class="chip chip-warn" title="Open warnings">! ${open.warning}</span> <span class="chip chip-info" title="Open notes">i ${open.note}</span>` : '';
    q.editonly.style.display = edit ? 'contents' : 'none';
    (q.undo as HTMLButtonElement).disabled = !snap.canUndo;
    (q.redo as HTMLButtonElement).disabled = !snap.canRedo;
    const fz = s.freeze(sheet.name);
    const frozen = !!(fz.rows || fz.cols);
    q.freeze.setAttribute('aria-pressed', String(frozen));
    q.freeze.setAttribute('aria-label', frozen ? 'Unfreeze panes' : 'Freeze panes at the selected cell');
    q.freeze.title = frozen ? 'Unfreeze panes' : 'Freeze rows above and columns left of the selected cell';
    const n = s.changeCount;
    q.changes.textContent = n === 0 ? 'No changes yet' : `${n} change${n === 1 ? '' : 's'} in memory`;
    // one Download button in View and Edit (W-31): its count says the file will carry changes
    const n2 = s.changeCount;
    q.export.querySelector('.lbl')!.textContent = `Download .${src.kind}`;
    const badge = q.export.querySelector<HTMLElement>('.badge-n')!;
    badge.hidden = n2 === 0; badge.textContent = String(n2);
    const tip = this.untouched() ? `Download the file as it was opened` : `Download with ${n2} change${n2 === 1 ? '' : 's'}${n2 === 0 ? ' (the review as comments)' : ''}`;
    q.export.title = tip; q.export.setAttribute('aria-label', `Download .${src.kind} — ${tip}`);
    q.dlmore.setAttribute('aria-expanded', String(this.dlOpen));
    const dl = this.dlOpen ? this.downloadMenuHtml(src.kind) : '';
    if (q.dlslot.dataset.html !== dl) { q.dlslot.innerHTML = dl; q.dlslot.dataset.html = dl; }
    // cell bar
    const sel = snap.selection;
    const p = parseRef(sel.ref)!;
    const merge = mergeAt(g.g, p.row, p.col);
    q.ref.textContent = sel.range ?? (merge ? `${cellRef(merge.top, merge.left)}:${cellRef(merge.bottom, merge.right)}` : sel.ref);
    const composing = !!snap.composing;
    const editable = edit && !composing;
    const cell = q.cell as HTMLInputElement;
    cell.hidden = !editable;
    q.val.hidden = editable;
    q.cellname.textContent = `Value of ${sel.ref}`;
    const curText = s.input(sel.sheet, sel.ref);
    if (this.shadow.activeElement !== cell) cell.value = curText;
    q.val.textContent = s.text(sel.sheet, sel.ref) || '(empty)';
    q.merge.hidden = !merge;
    if (merge) q.merge.textContent = `Merged ${cellRef(merge.top, merge.left)}:${cellRef(merge.bottom, merge.right)} · centred`;
    const ch = s.changeOf(sel.sheet, sel.ref);
    const fmt = s.changesAt(sel.sheet, sel.ref).filter((c) => c !== ch);
    q.changed.hidden = !ch && !fmt.length;
    q.revert.hidden = (!ch && !fmt.length) || !edit;
    if (ch || fmt.length) q.changed.textContent = `Changed · was ${s.original(sel.sheet, sel.ref).text || '(blank)'}`; // the board's wording for any change to the cell
    const err = edit ? this.errorAt(sel.sheet, sel.ref) : undefined;
    q.issue.hidden = !err;
    if (err) { q.issue.className = `chip ${err.status === 'resolved' ? 'chip-pass' : err.severity === 'error' ? 'chip-fail' : err.severity === 'warning' ? 'chip-warn' : 'chip-info'}`; q.issue.textContent = `${err.status === 'resolved' ? '✓' : SEVERITY[err.severity].glyph} Error ${errNum(err)}`; }
    q.hint.hidden = !(composing && s.hasErrorsView);
    // column rules: the draft's failure as typed, or a refused value (W-27)
    const rm = this.ruleMsg && this.ruleMsg.sheet === sel.sheet && this.ruleMsg.ref === sel.ref ? this.ruleMsg : undefined;
    if (this.ruleMsg && !rm) this.ruleMsg = undefined; // the selection moved on
    q.rulemsg.hidden = !rm || !edit;
    cell.toggleAttribute('aria-invalid', !!rm);
    if (rm) {
      const sv = SEVERITY[rm.outcome.severity];
      q.rulemsg.className = `chip rulemsg ${rm.outcome.severity === 'error' ? 'chip-fail' : rm.outcome.severity === 'warning' ? 'chip-warn' : 'chip-info'}`;
      q.rulemsg.textContent = `${sv.glyph} ${rm.blocked ? 'Not saved — ' : ''}${rm.outcome.message}`;
      cell.title = rm.outcome.message;
    } else cell.removeAttribute('title');
    q.plugCellbar.innerHTML = this.controlsHtml(controlsFor(s.plugins, 'cellbar', snap.mode), 'btn btn-g');
    // docked selection actions (W-31): Flag issue · selbar plugin controls · ⋯ — hidden while typing or composing
    const typing = !!this.editing && this.shadow.activeElement === cell;
    q.dock.hidden = typing || composing;
    if (!q.dock.hidden) {
      const flagBtn = edit && !err && s.flagging ? `<button type="button" class="btn btn-g" data-act="flag" data-sp="flag" title="Flag issue (F)" aria-keyshortcuts="F">${ICON.flag}Flag issue<span class="kbd" aria-hidden="true">F</span></button>` : '';
      const plug = edit ? this.controlsHtml(controlsFor(s.plugins, 'selbar', 'edit'), 'btn btn-g') : '';
      const more = `<button type="button" class="btn btn-g btn-i" data-act="more" aria-haspopup="menu" aria-expanded="${this.moreOpen}" title="More actions (Shift+F10)" aria-label="More actions (Shift+F10)">⋯</button>`;
      // the ⋯ menu: Copy ref, Copy value, and the plugin buttons, which show here only once they fold out of the bar
      const menu = this.moreOpen ? `<div class="card moremenu" role="menu" aria-label="More actions">${this.actionItems(edit, err, { flag: false, plugins: true })}</div>` : '';
      const html = `${flagBtn}${plug ? `<span class="plug">${plug}</span>` : ''}<span class="morewrap">${more}${menu}</span>`;
      if (q.dock.dataset.html !== html) { q.dock.innerHTML = html; q.dock.dataset.html = html; }
    } else if (this.moreOpen) this.moreOpen = false;
    // format row: Edit only, and only when a plugin or the host put something in it
    const frow = controlsFor(s.plugins, 'format-row', 'edit');
    const hostSlot = (q.frow.querySelector('slot') as HTMLSlotElement).assignedElements().length > 0;
    q.frow.hidden = !edit || (!frow.length && !hostSlot);
    q.plugFrow.innerHTML = this.controlsHtml(frow, 'btn btn-g', true);
    // find
    if (this.findText) this.computeHits();
    // W-49: find still sees hidden cells; the count says how many, and a hit there is shown when reached
    const inHidden = this.findText ? this.findHits.filter((h) => { const hd = s.hidden(h.sheet), p2 = parseRef(h.ref)!; return hd.state !== 'visible' || hd.rows.includes(p2.row) || hd.cols.includes(p2.col); }).length : 0;
    (q.findcnt as HTMLElement).textContent = this.findText ? (this.findHits.length ? `${this.findIdx >= 0 ? this.findIdx + 1 : 0} of ${this.findHits.length}${inHidden ? ` (${inHidden} in hidden cells)` : ''}` : 'none') : '';
    // tabs (.xlsx only)
    q.tabs.hidden = src.kind === 'csv';
    // W-49: hidden sheets are not tabs — one ⊘ button lists them; one opened for viewing shows dashed
    const tabsHtml = book.sheets.filter((sh) => s.hidden(sh.name).state === 'visible' || this.openedSheets.has(sh.name) || sh.name === sheet.name).map((sh) => {
      const cnt = edit ? snap.errors.filter((e) => e.sheet === sh.name && e.status === 'open').length : 0;
      const hid = s.hidden(sh.name).state !== 'visible';
      return `<button type="button" role="tab" class="tab${hid ? ' hid' : ''}" data-sheet="${esc(sh.name)}" data-sp-sheet="${esc(sh.name)}" aria-selected="${sh.name === sheet.name}"${hid ? ' title="Hidden in the file — shown for viewing"' : ''}>${hid ? '⊘ ' : ''}${esc(sh.name)}${cnt ? `<span class="cnt" aria-label="${cnt} open">${cnt}</span>` : ''}</button>`;
    }).join('');
    const tabsHtml2 = `<div class="tablist" role="tablist" aria-label="Sheets">${tabsHtml}</div>${this.hiddenSheetsHtml()}`;
    if (q.tabs.dataset.html !== tabsHtml2) { q.tabs.innerHTML = tabsHtml2; q.tabs.dataset.html = tabsHtml2; }
    const hm = this.hiddenMenuHtml();
    if (q.hidmenuslot.dataset.html !== hm) { q.hidmenuslot.innerHTML = hm; q.hidmenuslot.dataset.html = hm; }
    // the banner on a hidden sheet, or the note after a reveal
    const curHidden = s.hidden(sheet.name).state !== 'visible';
    const note = this.revealNote?.sheet === sheet.name ? this.revealNote : undefined;
    const barHtml = curHidden
      ? `<span>⊘ This sheet is hidden in the file</span><button type="button" class="btn btn-g" data-act="hide-sheet-again">Hide again</button>${this.canUnhide() ? '<button type="button" class="btn btn-g" data-act="unhide-sheet">Unhide</button>' : ''}`
      : note ? `<span>${esc(note.text)}</span><button type="button" class="btn btn-g" data-act="hide-again">Hide again</button><button type="button" class="btn btn-g btn-i" data-act="note-close" aria-label="Dismiss">${ICON.close}</button>` : '';
    q.hidbar.hidden = !barHtml;
    if (q.hidbar.dataset.html !== barHtml) { q.hidbar.innerHTML = barHtml; q.hidbar.dataset.html = barHtml; }
    this.renderGrid(g.g, sheet, snap.mode);
    // status line
    const statusPlug = controlsFor(s.plugins, 'status', snap.mode).map((c) => c.text?.(snap, sel) ?? '').filter(Boolean);
    const dataRows = sheet.rows.length, dataCols = sheet.rows.reduce((m, r) => Math.max(m, r.length), 0);
    q.status.innerHTML = [
      `<span>${esc(sheet.name)} · ${dataRows} row${dataRows === 1 ? '' : 's'} × ${dataCols} column${dataCols === 1 ? '' : 's'}${g.g.merges.length ? ` · ${g.g.merges.length} merged range${g.g.merges.length === 1 ? '' : 's'}` : ''}</span>`,
      n ? `<span>· ${n} cell change${n === 1 ? '' : 's'} kept in memory until you export</span>` : '',
      (() => { const t = this.totalsFor(g.g); return t ? `<span class="totals" data-sp="totals">· ${esc(t)}</span>` : ''; })(),
      (() => {
        const h = s.hidden(sheet.name);
        if (!h.rows.length && !h.cols.length) return '';
        const parts = [h.cols.length ? `${h.cols.length} column${h.cols.length === 1 ? '' : 's'}` : '', h.rows.length ? `${h.rows.length} row${h.rows.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(', ');
        const all = this.revealed[sheet.name]?.all;
        return `<span>· ${parts} hidden · <button type="button" class="link" data-act="show-hidden" aria-pressed="${!!all}">${all ? 'Hide them again' : 'Show hidden'}</button></span>`;
      })(),
      ...statusPlug.map((t) => `<span>${esc(t)}</span>`),
      this.notice ? `<span role="status" class="warn-t">· ${esc(this.notice)}</span>` : '',
      s.ruleProgress ? `<span role="status">· Checking column rules · ${Math.floor((100 * s.ruleProgress.done) / Math.max(1, s.ruleProgress.total))} %</span>` : '',
      `<span class="spacer"></span><span>Read in this tab — nothing uploaded</span>`,
      this.getAttribute('display') === 'popup' ? '<span>Esc to close</span>' : '',
    ].join('');
  }

  /** Count · Sum · Average of a range of two or more cells (W-46 DoD 8), cached until the range or the cells change. */
  private totalsFor(g: SheetGeometry): string {
    const s = this._store!, snap = s.getSnapshot(), sel = snap.selection;
    const r = sel.range ? parseRange(sel.range) : undefined;
    if (!r || cellCount(r) < 2) return '';
    const key = [sel.sheet, sel.range, sel.ref, snap.book, snap.changes, snap.derived, this.revealVer];
    if (key.length === this.totalsKey.length && key.every((k, i) => Object.is(k, this.totalsKey[i]))) return this.totalsText;
    this.totalsKey = key;
    const t = totalsOf(r, (row, col) => s.value(sel.sheet, cellRef(row, col)), g.rows - 1, { row: (i) => this.shownRow(g, i), col: (i) => this.shownCol(g, i) });
    const left = this.hiddenIn(g, r);
    // the active cell's number format when a format plugin (numfmt) is installed, else locale grouping
    const formatted = s.plugins.some((p) => p.provides.includes('format'));
    const fmt = (v: number) => (formatted ? s.format(sel.sheet, sel.ref, v) : new Intl.NumberFormat(undefined, { maximumFractionDigits: 10 }).format(v));
    this.totalsText = (t.numbers ? `Count ${t.count.toLocaleString()} · Sum ${fmt(t.sum)} · Average ${fmt(t.sum / t.numbers)}` : `Count ${t.count.toLocaleString()}`) + (left ? ` (${left} hidden cell${left === 1 ? '' : 's'} left out)` : '');
    return this.totalsText;
  }

  private controlsHtml(list: ControlDescriptor[], cls: string, separators = false): string {
    const snap = this._store!.getSnapshot();
    let group = '';
    return list.map((c) => {
      const sep = separators && group && c.group !== group ? '<span class="sep" aria-hidden="true"></span>' : '';
      group = c.group;
      if (c.options && c.choose) {
        const cur = c.value?.(snap, snap.selection) ?? '';
        return `${sep}<select class="input" data-control="${esc(c.id)}" aria-label="${esc(c.label)}" title="${esc(c.label)}" style="height:28px;font-size:12px">${c.options(snap, snap.selection).map((o) => `<option value="${esc(o.value)}"${o.value === cur ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
      }
      if (c.text && !c.run) { // read-only text (a status-like control in another slot): shown, not pressed
        const t = c.text(snap, snap.selection);
        return t ? `${sep}<span class="ptext" data-control="${esc(c.id)}" title="${esc(c.label)}">${esc(t)}</span>` : '';
      }
      const active = c.isActive?.(snap, snap.selection);
      const label = c.labelFor?.(snap, snap.selection) ?? c.label;
      const named = `${label}${c.shortcut ? ` (${c.shortcut})` : ''}`;
      const off = c.disabled?.(snap, snap.selection) ?? false;
      const why = off ? c.disabledReason?.(snap, snap.selection) : undefined; // W-49: a disabled control says why
      return `${sep}<button type="button" class="${cls}" data-control="${esc(c.id)}" aria-label="${esc(named)}" title="${esc(why ? `${named} — ${why}` : named)}"${active !== undefined ? ` aria-pressed="${active}"` : ''}${off ? ' disabled' : ''}>${c.icon ?? ''}${c.icon ? '' : esc(label)}</button>`;
    }).join('');
  }

  private renderState(): void {
    const snap = this._store!.getSnapshot(), st = this.q.state;
    let html: string;
    if (!this.showEmpty && snap.load.status === 'error') {
      const f = snap.load;
      const pw = f.detail === 'password';
      html = `<div class="msg ${pw ? 'warn' : 'fail'}" role="alert"><span class="g ${pw ? 'g-warning' : 'g-error'}">${pw ? '!' : '✕'}</span><div style="display:flex;flex-direction:column;gap:8px"><span class="t">${pw ? 'Password protected' : 'Can’t open this file'}</span><span>${esc(f.message)}</span><span class="xs faint code">${esc(f.spCode)}</span><div><button type="button" class="btn again">Choose another file</button></div></div></div>`;
    } else if (snap.load.status === 'loading') {
      html = `<div class="msg" role="status"><div style="display:flex;flex-direction:column;gap:6px"><span class="t">Reading</span><span>${esc(snap.load.name)}</span></div></div>`;
    } else {
      html = `<div class="drop"><span class="faint">${ICON.upload}</span><span class="t" style="font-weight:600">No workbook yet</span><span>Drop an .xlsx or .csv file here</span><span class="xs faint">Up to ${MAX_BYTES / 2 ** 20} MB · or <button type="button" class="link browse">browse your files</button></span>
<div class="row"><label style="display:contents"><span class="vh">Open from a link</span><input class="input linkin" placeholder="Or open from a link"></label><button type="button" class="btn openlink">Open</button></div>
<div class="row"><label style="display:contents"><span class="vh">Paste base64</span><textarea class="input b64in" rows="1" placeholder="Or paste base64" style="min-height:28px"></textarea></label><button type="button" class="btn openb64">Open</button></div>
<span class="xs faint">Read in this tab — nothing is uploaded</span></div>`;
    }
    if (st.dataset.html !== html) { st.innerHTML = html; st.dataset.html = html; }
  }

  private renderGrid(g: SheetGeometry, sheet: ImportedSheet, mode: Mode): void {
    const s = this._store!, snap = s.getSnapshot(), q = this.q, z = this.zoom;
    const edit = mode === 'edit';
    const fz = s.freeze(sheet.name);
    const fr = Math.min(fz.rows, g.rows), fc = Math.min(fz.cols, g.cols);
    const HH = this.headH() * z, RW = this.rowHeadW() * z;
    const X = (c: number) => g.colX[c]! * z;
    const W = (c: number) => (g.colX[c + 1]! - g.colX[c]!) * z;
    const Y = (r: number) => rowTop(g, r) * z, H = (r: number) => rowHeight(g, r) * z;
    const totalW = RW + X(g.cols), totalH = HH + Y(g.rows);
    const sc = q.scroller;
    q.sheet.style.cssText = `width:${totalW}px;height:${totalH}px;font-size:${14 * z}px`;
    if (this.scrollToSel && sc.clientWidth > 0) { this.scrollToSel = false; this.scrollSelIntoView(g, z, fr, fc); }
    const win = visibleWindow(g, z, sc.scrollTop, sc.scrollLeft, sc.clientHeight || 600, sc.clientWidth || 900, { rows: fr, cols: fc });
    const grid = q.grid;
    grid.style.cssText = `position:relative;width:${totalW}px;height:${totalH}px`;
    grid.setAttribute('aria-rowcount', String(g.rows + 1));
    grid.setAttribute('aria-colcount', String(g.cols + 1));
    grid.setAttribute('aria-readonly', String(!edit));
    // selection, find, errors
    const sel = snap.selection;
    const selP = parseRef(sel.ref)!;
    const hitSet = new Set(this.findText ? this.findHits.filter((h) => h.sheet === sheet.name).map((h) => h.ref) : []);
    const curHit = this.findIdx >= 0 ? this.findHits[this.findIdx] : undefined;
    const marks = new Map<string, string>();
    const rowWorst = new Map<number, Severity>();
    if (edit) for (const e of snap.errors) {
      if (e.sheet !== sheet.name) continue;
      const r = parseRange(e.range);
      if (!r) continue;
      const m = e.status === 'resolved' ? 'm-pass' : `m-${e.severity}`;
      for (let rr = r.top; rr <= Math.min(r.bottom, r.top + 2000); rr++) for (let cc = r.left; cc <= r.right; cc++) marks.set(`${rr},${cc}`, m);
      if (e.status === 'open') for (let rr = r.top; rr <= Math.min(r.bottom, r.top + 2000); rr++) { const w = rowWorst.get(rr); if (!w || sevOrder[e.severity] > sevOrder[w]) rowWorst.set(rr, e.severity); }
    }
    const cellControls = controlsFor(s.plugins, 'cell', mode);
    const decorating = s.plugins.some((p) => p.provides.includes('decorate'));
    const covered = (r: number, c: number) => { const m = mergeAt(g, r, c); return m && !(m.top === r && m.left === c) ? m : undefined; };
    const cellHtml = (r: number, c: number, frozenCol: boolean): string => {
      if (covered(r, c)) return '';
      const ref = cellRef(r, c);
      const m = g.merges.find((x) => x.top === r && x.left === c);
      const v = s.value(sheet.name, ref);
      const text = s.text(sheet.name, ref);
      const cls = ['c'];
      if (frozenCol) cls.push('fz');
      if (this.isRevealed(sheet.name, 'rows', r) || this.isRevealed(sheet.name, 'cols', c)) cls.push('rev');
      if (typeof v === 'number') cls.push('n');
      if (m) cls.push('merge');
      if (hitSet.has(ref)) cls.push('hit');
      if (curHit && curHit.sheet === sheet.name && curHit.ref === ref) cls.push('cur');
      if (s.changesAt(sheet.name, ref).length) cls.push('chg');
      const mk = marks.get(`${r},${c}`);
      if (mk) cls.push(mk);
      const stale = s.mayBeStale(sheet.name, ref);
      if (stale) cls.push('stale');
      if (snap.derived.has(`${sheet.name}!${ref}`) && !s.changeOf(sheet.name, ref)) cls.push('derived');
      const w = m ? X(m.right + 1) - X(m.left) : W(c);
      const h = m ? Y(m.bottom + 1) - Y(m.top) : H(r);
      let style = frozenCol ? `left:${RW + X(c)}px;width:${W(c)}px;height:${H(r)}px;flex:none` : `left:${RW + X(c)}px;width:${w}px;height:${h}px`;
      if (decorating) {
        const d = s.decorate(sheet.name, ref);
        for (const [k2, v2] of Object.entries(d)) {
          // cells are a column of one text line: vertical alignment is the column's justify-content
          if (k2 === 'vertical-align') style += `;justify-content:${v2 === 'top' ? 'flex-start' : v2 === 'bottom' ? 'flex-end' : 'center'}`;
          else style += `;${k2}:${v2}`;
        }
      }
      let extra = '';
      if (cellControls.length) {
        const ctx = s.cellContext(sheet.name, ref);
        for (const cc of cellControls) if (ctx && cc.appliesTo?.(ctx)) extra += `<button type="button" class="mk" data-control="${esc(cc.id)}" aria-label="${esc(cc.label)}" tabindex="-1">${cc.icon ?? '▾'}</button>`;
      }
      const title = stale ? ' title="May be stale — Excel recalculates on open"' : text.length > 24 ? ` title="${esc(text)}"` : '';
      return `<div id="c${r}_${c}" role="gridcell" class="${cls.join(' ')}" data-r="${r}" data-c="${c}" data-sp-ref="${cellRef(r, c)}" aria-colindex="${c + 2}" aria-selected="false" style="${style}"${title}><span class="v">${esc(text)}</span>${extra}</div>`;
    };
    const rowHead = (r: number) => {
      const w = rowWorst.get(r);
      return `<div class="rh${this.isRevealed(sheet.name, 'rows', r) ? ' rev' : ''}" role="rowheader" data-hr="${r}" style="width:${RW}px;height:${H(r)}px">${w ? `<span class="g g-${w}" aria-label="${SEVERITY[w].name}">${SEVERITY[w].glyph}</span>` : ''}${r + 1}${r > 0 ? `<span class="rz rzs" data-rz-r="${r - 1}" aria-hidden="true"></span>` : ''}<span class="rz rze" data-rz-r="${r}" aria-hidden="true"></span></div>`;
    };
    const cellsOf = (r: number) => {
      let out = '';
      for (let c = 0; c < fc; c++) if (W(c) > 0) out += cellHtml(r, c, true);
      for (let c = win.c0; c <= win.c1; c++) if (W(c) > 0) out += cellHtml(r, c, false);
      // merges that start left of the window but reach into it
      for (const m of g.merges) if (m.top === r && m.left < win.c0 && m.left >= fc && m.right >= win.c0) out += cellHtml(r, m.left, false);
      return out;
    };
    // header row
    let hdr = `<div class="corner" role="columnheader" data-hall title="Select all" style="width:${RW}px;height:${HH}px"><span class="vh">Row</span></div>`;
    const chTop = HH - HEAD_H * z; // the column outline gutter sits above the letters
    const zones = (c: number) => `${c > 0 ? `<span class="rz rzs" data-rz-c="${c - 1}" aria-hidden="true"></span>` : ''}<span class="rz rze" data-rz-c="${c}" aria-hidden="true"></span>`;
    for (let c = 0; c < fc; c++) if (W(c) > 0) hdr += `<div class="ch fz${this.isRevealed(sheet.name, 'cols', c) ? ' rev' : ''}" role="columnheader" data-hc="${c}" style="left:${RW + X(c)}px;width:${W(c)}px;height:${HEAD_H * z}px;flex:none;align-self:flex-end" aria-colindex="${c + 2}">${colName(c)}${zones(c)}</div>`;
    for (let c = win.c0; c <= win.c1; c++) if (W(c) > 0) hdr += `<div class="ch${this.isRevealed(sheet.name, 'cols', c) ? ' rev' : ''}" role="columnheader" data-hc="${c}" style="left:${RW + X(c)}px;top:${chTop}px;width:${W(c)}px;height:${HEAD_H * z}px" aria-colindex="${c + 2}">${colName(c)}${zones(c)}</div>`;
    // W-49: where the file hides columns, a ◂▸ marker on the header boundary
    const hmarks = this.hiddenMarks(sheet.name, g, win, fr, fc);
    hmarks.layer += this.outlineMarks(sheet.name, g, win);
    hdr += hmarks.cols;
    // frozen rows (sticky), then the window
    let frozen = '';
    for (let r = 0; r < fr; r++) if (H(r) > 0) frozen += `<div class="frozen" role="row" aria-rowindex="${r + 2}" style="top:${HH + Y(r)}px;height:${H(r)}px;width:${totalW}px;position:sticky">${rowHead(r)}${cellsOf(r)}</div>`;
    const rows = new Set<number>();
    for (let r = win.r0; r <= win.r1; r++) if (H(r) > 0) rows.add(r);
    for (const m of g.merges) if (m.top < win.r0 && m.top >= fr && m.bottom >= win.r0 && H(m.top) > 0) rows.add(m.top);
    let body = '';
    for (const r of [...rows].sort((a, b) => a - b)) body += `<div class="row" role="row" aria-rowindex="${r + 2}" style="top:${HH + Y(r)}px;height:${H(r)}px;width:${totalW}px">${rowHead(r)}${cellsOf(r)}</div>`;
    const key = `${hdr}|${frozen}|${body}|${hmarks.layer}`;
    if (key !== this.lastBody) {
      this.lastBody = key;
      q.hidlayer.innerHTML = hmarks.layer;
      q.hrow.innerHTML = hdr;
      q.hrow.style.cssText = `width:${totalW}px;height:${HH}px`;
      q.frozen.innerHTML = frozen;
      q.rows.innerHTML = body;
      this.selKey = ''; this.ariaOn.clear(); // new nodes: the layer's bands and aria-selected go on again
    }
    grid.setAttribute('aria-activedescendant', `c${selP.row}_${selP.col}`);
    this.drawSelection();
    this.renderOverlay(g, sheet, z, RW, HH, Y, H, X, W, win);
  }

  /**
   * The selection layer (W-46 DoD 1, 2): per pane part a fill (a hole at the active cell), one border on
   * the range's own edges, the active cell's ring, the copied outline and — after a touch — two handles.
   * The scrolling part sits in `.sellayer`; the frozen-column part sticks left there; the frozen-row
   * parts are bands inside the frozen rows. No cell is re-created: only `aria-selected` changes on them.
   */
  private drawSelection(): void {
    const s = this._store, g = this.geometry();
    if (!s || !g || !this.built || s.getSnapshot().load.status !== 'ready') return;
    const snap = s.getSnapshot(), q = this.q, z = this.zoom, gg = g.g;
    const HH = this.headH() * z, RW = this.rowHeadW() * z;
    const X = (c: number) => gg.colX[Math.min(c, gg.cols)]! * z;
    const Y = (r: number) => rowTop(gg, r) * z, H = (r: number) => rowHeight(gg, r) * z;
    const fz = s.freeze(g.sheet.name), fr = Math.min(fz.rows, gg.rows), fc = Math.min(fz.cols, gg.cols);
    const d = this.drag, sel = snap.selection;
    const active: Pos = d && d.kind === 'cell' ? d.anchor : parseRef(sel.ref)!;
    const am = mergeAt(gg, active.row, active.col) ?? { top: active.row, left: active.col, bottom: active.row, right: active.col };
    const range: RangePos = d ? this.dragRange(d) : sel.range ? parseRange(sel.range) ?? am : am;
    const multi = !(range.top === am.top && range.left === am.left && range.bottom === am.bottom && range.right === am.right);
    const copied = this.copied && this.copied.sheet === g.sheet.name ? this.copied.range : undefined;
    if (d) q.ref.textContent = `${range.bottom - range.top + 1}R × ${range.right - range.left + 1}C`;
    const key = [g.sheet.name, z, fr, fc, gg.rows, gg.cols, rangeText(range), rangeText(am), copied ? rangeText(copied) : '', this.touchUi && !d && multi ? 1 : 0].join('|');
    if (key === this.selKey) return;
    this.selKey = key;
    let layer = '';
    const bands = new Map<number, string>();
    const borders = (e: { top: boolean; right: boolean; bottom: boolean; left: boolean }) => `border-width:${e.top ? 2 : 0}px ${e.right ? 2 : 0}px ${e.bottom ? 2 : 0}px ${e.left ? 2 : 0}px`;
    /** One part's element: in the layer for the scrolling rows, a band per frozen row otherwise. */
    const put = (pane: string, r0: number, r1: number, c0: number, c1: number, cls: string, style: (row: number | undefined) => string) => {
      const x = RW + X(c0), w = X(c1 + 1) - X(c0);
      if (pane === 'main' || pane === 'left') {
        const pos = pane === 'left' ? `position:sticky;left:${x}px;z-index:2` : 'position:relative;z-index:1';
        layer += `<div class="${cls}" style="${pos};margin:${HH + Y(r0)}px 0 0 ${x}px;width:${w}px;height:${Y(r1 + 1) - Y(r0)}px;${style(undefined)}"></div>`;
        return;
      }
      const flow = RW + X(fc); // a corner band follows the frozen cells in the row's flex flow
      for (let r = r0; r <= r1; r++) {
        const pos = pane === 'top' ? `position:absolute;top:0;left:${x}px;z-index:1` : `position:sticky;left:${x}px;flex:none;margin:0 ${-(x - flow + w)}px 0 ${x - flow}px;z-index:3`;
        bands.set(r, (bands.get(r) ?? '') + `<div class="sband ${cls}" style="${pos};width:${w}px;height:${H(r)}px;${style(r)}"></div>`);
      }
    };
    if (multi) {
      for (const p of splitByPanes(range, fr, fc)) {
        // the fill leaves the active cell clear: an even-odd hole where it meets this part
        const hole = (row: number | undefined) => {
          const t = Math.max(p.top, am.top, row ?? -1), b = Math.min(p.bottom, am.bottom, row ?? Infinity), l = Math.max(p.left, am.left), rr = Math.min(p.right, am.right);
          if (t > b || l > rr) return '';
          const y0 = row === undefined ? Y(t) - Y(p.top) : 0, y1 = row === undefined ? Y(b + 1) - Y(p.top) : H(row);
          const x0 = X(l) - X(p.left), x1 = X(rr + 1) - X(p.left);
          return `;clip-path:polygon(evenodd,0 0,100% 0,100% 100%,0 100%,0 0,${x0}px ${y0}px,${x1}px ${y0}px,${x1}px ${y1}px,${x0}px ${y1}px,${x0}px ${y0}px)`;
        };
        put(p.pane, p.top, p.bottom, p.left, p.right, 'sf', hole);
        put(p.pane, p.top, p.bottom, p.left, p.right, 'sb', (row) => borders(row === undefined ? p.edges : { ...p.edges, top: p.edges.top && row === p.top, bottom: p.edges.bottom && row === p.bottom }));
      }
    }
    for (const p of splitByPanes(am, fr, fc)) put(p.pane, p.top, p.bottom, p.left, p.right, 'sa', (row) => borders(row === undefined ? p.edges : { ...p.edges, top: p.edges.top && row === p.top, bottom: p.edges.bottom && row === p.bottom }));
    if (copied) for (const p of splitByPanes(copied, fr, fc)) put(p.pane, p.top, p.bottom, p.left, p.right, 'sc', (row) => borders(row === undefined ? p.edges : { ...p.edges, top: p.edges.top && row === p.top, bottom: p.edges.bottom && row === p.bottom }));
    // touch: two round handles, top-left and bottom-right, to extend the range
    if (this.touchUi && !d && multi) {
      for (const [end, row, col] of [['start', range.top, range.left], ['end', range.bottom + 1, range.right + 1]] as const) {
        layer += `<div class="sh" data-end="${end}" style="position:relative;z-index:3;margin:${HH + Y(row) - 12}px 0 0 ${RW + X(col) - 12}px"></div>`;
      }
    }
    q.sellayer.innerHTML = layer;
    for (const b of Array.from(q.frozen.querySelectorAll('.sband'))) b.remove();
    const frozenRows = q.frozen.children;
    for (const [r, html] of bands) frozenRows[r]?.insertAdjacentHTML('beforeend', html);
    // headers: tinted with an accent edge where the selection spans them
    for (const h of Array.from(q.hrow.querySelectorAll<HTMLElement>('[data-hc]'))) { const c = Number(h.dataset.hc); h.classList.toggle('on', c >= range.left && c <= range.right); }
    for (const h of Array.from(q.grid.querySelectorAll<HTMLElement>('.rh[data-hr]'))) { const r = Number(h.dataset.hr); h.classList.toggle('on', r >= range.top && r <= range.bottom); }
    // aria-selected on the rendered cells of the range
    const next = new Set<Element>();
    for (const c of Array.from(q.grid.querySelectorAll<HTMLElement>('.c[data-r]'))) {
      const r = Number(c.dataset.r), cc = Number(c.dataset.c);
      if (r >= range.top && r <= range.bottom && cc >= range.left && cc <= range.right) next.add(c);
    }
    for (const el of this.ariaOn) if (!next.has(el)) el.setAttribute('aria-selected', 'false');
    for (const el of next) if (!this.ariaOn.has(el)) el.setAttribute('aria-selected', 'true');
    this.ariaOn = next;
  }

  private scrollSelIntoView(g: SheetGeometry, z: number, fr: number, fc: number): void {
    const s = this._store!, p = parseRef(s.getSnapshot().selection.ref)!, sc = this.q.scroller;
    const HH = this.headH() * z, RW = this.rowHeadW() * z;
    const top = rowTop(g, p.row) * z, bottom = rowTop(g, p.row + 1) * z;
    const stickTop = HH + rowTop(g, fr) * z, stickLeft = RW + g.colX[fc]! * z;
    if (p.row >= fr) {
      if (top + HH < sc.scrollTop + stickTop) sc.scrollTop = Math.max(0, top + HH - stickTop);
      else if (bottom + HH > sc.scrollTop + sc.clientHeight) sc.scrollTop = bottom + HH - sc.clientHeight;
    }
    if (p.col >= fc) {
      const left = g.colX[p.col]! * z + RW, right = (g.colX[p.col + 1] ?? g.colX[p.col]!) * z + RW;
      if (left < sc.scrollLeft + stickLeft) sc.scrollLeft = Math.max(0, left - stickLeft);
      else if (right > sc.scrollLeft + sc.clientWidth) sc.scrollLeft = right - sc.clientWidth;
    }
  }

  private renderOverlay(g: SheetGeometry, sheet: ImportedSheet, z: number, RW: number, HH: number, Y: (r: number) => number, H: (r: number) => number, X: (c: number) => number, W: (c: number) => number, win: { r0: number; r1: number }): void {
    const s = this._store!, snap = s.getSnapshot(), edit = snap.mode === 'edit', ov = this.q.overlay;
    const at = (r: number, c: number) => ({ x: RW + X(c), y: HH + Y(r) });
    const parts: string[] = [];
    // pivot badges (W-01 DoD 15): the cached cells show; Excel refreshes
    for (const pt of sheet.pivotTables) {
      const r = parseRange(pt.ref);
      if (r) { const p = at(r.top, r.left); parts.push(`<span class="badge" style="top:${p.y + 2}px;left:${p.x + 2}px" title="${esc(pt.name)}">pivot table — refreshes in Excel</span>`); }
    }
    const sel = snap.selection, selP = parseRef(sel.ref)!;
    if (edit) {
      for (const e of snap.errors) {
        if (e.sheet !== sheet.name) continue;
        const r = parseRange(e.range);
        if (!r || r.top > win.r1 + 40) continue;
        const p = at(r.top, r.left);
        const on = r.top === selP.row && selP.col >= r.left && selP.col <= r.right;
        const mach = machineAuthored(e.author);
        const left = mach ? RW + X(r.right + 1) - 18 : p.x - 6;
        parts.push(`<button type="button" class="pin ${e.status === 'resolved' ? 'resolved' : e.severity}${on ? ' on' : ''}${mach ? ' square' : ''}" data-pin="${esc(e.id)}" aria-label="${mach ? `${esc(BUILTIN_TYPE_NAMES[e.type] ?? e.type)}` : `Error ${errNum(e)}`}, ${esc(e.range)}, ${SEVERITY[e.severity].name}${e.status === 'resolved' ? ', resolved' : ''}" style="top:${p.y - 8}px;left:${left}px">${e.status === 'resolved' ? '✓' : mach ? '⚠' : errNum(e)}</button>`);
      }
    }
    const composing = snap.composing;
    const err = edit && !composing ? this.errorAt(sel.sheet, sel.ref) : undefined;
    const p = at(selP.row, selP.col);
    const cw = W(selP.col);
    const sheetW = RW + X(g.cols);
    const sideLeft = (boxW: number) => { let l = p.x + cw + 10; if (l + boxW > Math.max(sheetW, this.q.scroller.scrollLeft + this.q.scroller.clientWidth)) l = p.x - boxW - 10; return Math.max(RW + 4, l); };
    const sideTop = (boxH: number) => Math.max(HH, Math.min(p.y - 6, Math.max(HH, this.q.scroller.scrollTop + this.q.scroller.clientHeight - boxH - 8)));
    let card = '';
    if (composing && edit && composing.sheet === sheet.name) {
      parts.push(`<span class="pin pending" aria-hidden="true" style="top:${p.y - 8}px;left:${p.x - 6}px">${snap.errors.reduce((m, e) => Math.max(m, errNum(e)), 0) + 1}</span>`);
      if (!s.hasErrorsView) card = this.composerHtml(sideLeft(330), sideTop(380), sel.ref);
    } else if (this.menu && this.menu.sheet === sheet.name && this.menu.ref === sel.ref) {
      const m = this.menu;
      card = `<div class="card menu" role="listbox" aria-label="Choices" style="top:${p.y + H(selP.row)}px;left:${p.x}px;min-width:${Math.max(cw, 140)}px;max-height:260px;overflow:auto">${m.options.map((o) => `<button type="button" role="option" class="btn btn-g" style="justify-content:flex-start;width:100%;border-radius:0" data-act="pick-option" data-v="${esc(o)}">${esc(o) || '(empty)'}</button>`).join('')}</div>`;
    } else if (err && s.flagging) {
      card = this.calloutHtml(err, sideLeft(300), sideTop(260));
    }
    // a header edge drag: a guide line across the grid and the size as a tip (W-47 DoD 1)
    if (this.rz?.moved) {
      const r = this.rz, sc = this.q.scroller, last = r.indexes[r.indexes.length - 1]!;
      if (r.axis === 'col') {
        const gx = RW + X(Math.min(last + 1, g.cols));
        parts.push(`<span class="rzguide" style="left:${gx - 1}px;top:${sc.scrollTop}px;width:2px;height:${sc.clientHeight}px"></span><span class="rztip" role="status" style="left:${gx + 6}px;top:${sc.scrollTop + HH + 4}px">Width ${r.px} px</span>`);
      } else {
        const gy = HH + Y(last + 1);
        parts.push(`<span class="rzguide" style="top:${gy - 1}px;left:${sc.scrollLeft}px;height:2px;width:${sc.clientWidth}px"></span><span class="rztip" role="status" style="top:${gy + 6}px;left:${sc.scrollLeft + RW + 4}px">Height ${r.px} px</span>`);
      }
    }
    if (this.hdrMenu) card = this.headerMenuHtml(g, z);
    // the context menu (right-click, Shift+F10, the Menu key) sits just under the cell, above any card
    if (this.ctxOpen && sel.sheet === sheet.name) { const mg = mergeAt(g, selP.row, selP.col); card = this.contextMenuHtml(p.x, (mg ? HH + Y(mg.bottom + 1) : p.y + H(selP.row)) + 2, edit, err); }
    if (!card && this.helpOpen) {
      const sc = this.q.scroller;
      card = `<div class="card help" role="dialog" aria-label="Keyboard shortcuts" style="top:${sc.scrollTop + 8}px;left:${sc.scrollLeft + sc.clientWidth - 300}px;width:290px"><div class="hd"><span class="t">Keyboard</span></div><div class="bd"><dl class="fe" style="grid-template-columns:120px 1fr">${this.shortcuts().map((x) => `<dt>${esc(x.keys)}</dt><dd>${esc(x.what)}</dd>`).join('')}</dl></div></div>`;
    }
    if (!card) this.composerKey = '';
    const html = parts.join('');
    let fixed = ov.querySelector<HTMLElement>(':scope > .dyn');
    if (!fixed) { fixed = document.createElement('div'); fixed.className = 'dyn'; fixed.style.cssText = 'position:absolute;inset:0;pointer-events:none'; ov.append(fixed); }
    if (fixed.dataset.html !== html) { fixed.innerHTML = html; fixed.dataset.html = html; for (const el of Array.from(fixed.children) as HTMLElement[]) el.style.pointerEvents = 'auto'; }
    let cardEl = ov.querySelector<HTMLElement>(':scope > .cardslot');
    if (!cardEl) { cardEl = document.createElement('div'); cardEl.className = 'cardslot'; ov.append(cardEl); }
    if (cardEl.dataset.html !== card) {
      const keepComposer = card.startsWith('<div class="card composer"') && cardEl.dataset.key === this.composerKey && this.composerKey !== '';
      if (!keepComposer) {
        cardEl.innerHTML = card; cardEl.dataset.html = card;
        if (this.focusMenu && card.startsWith('<div class="card menu"')) { this.focusMenu = false; (cardEl.querySelector('button') as HTMLElement | null)?.focus(); }
        if (card.startsWith('<div class="card composer"')) { this.composerKey = `${sel.sheet}!${sel.ref}|${this.draft.type}|${this.draft.severity}`; cardEl.dataset.key = this.composerKey; (cardEl.querySelector('textarea') as HTMLElement | null)?.focus(); }
      }
    }
    this.renderPluginOverlays(sheet, z, RW, HH, ov);
  }

  private renderPluginOverlays(sheet: ImportedSheet, z: number, RW: number, HH: number, ov: HTMLElement): void {
    const s = this._store!;
    const providers = s.plugins.filter((p) => p.provides.includes('overlay'));
    let layer = ov.querySelector<HTMLElement>(':scope > .plug');
    if (!providers.length) { layer?.remove(); return; }
    if (!layer) { layer = document.createElement('div'); layer.className = 'plug'; layer.style.cssText = 'position:absolute;inset:0;pointer-events:none'; ov.prepend(layer); }
    const geometry = this.geometryFor(sheet.name)!;
    const items = providers.flatMap((p) => { try { return p.overlay!(sheet.name, { ...s.pluginContext(), geometry }); } catch (e) { console.error(spMessage('SP-3014', `sheetpane: plugin "${p.id}" overlay failed`), e); return []; } });
    const keep = new Set<string>();
    for (const it of items) {
      const id = `${sheet.name}|${it.id}`;
      keep.add(id);
      let el = this.overlayCache.get(id);
      if (!el) { el = document.createElement('div'); el.className = 'olay'; el.append(it.render()); this.overlayCache.set(id, el); }
      // role and name follow the item on every pass (a chart's title is known only after its part is read)
      if (el.getAttribute('role') !== (it.role ?? 'img')) el.setAttribute('role', it.role ?? 'img');
      if (it.alt) { if (el.getAttribute('aria-label') !== it.alt) el.setAttribute('aria-label', it.alt); } else el.removeAttribute('aria-label');
      el.style.cssText = `left:${RW + it.rect.x * z}px;top:${HH + it.rect.y * z}px;width:${it.rect.width * z}px;height:${it.rect.height * z}px;pointer-events:${it.passThrough ? 'none' : 'auto'}`;
      if (el.parentNode !== layer) layer.append(el);
    }
    for (const [id, el] of this.overlayCache) if (!keep.has(id)) { el.remove(); if (!id.startsWith(`${sheet.name}|`)) continue; this.overlayCache.delete(id); }
  }

  private calloutHtml(e: SheetpaneError, left: number, top: number): string {
    const s = this._store!, sv = SEVERITY[e.severity], t = this._errorTypes.find((x) => x.id === e.type);
    const tags = [e.matchesExpected ? '<span class="chip chip-pass">matches suggestion</span>' : '', s.isStale(e) ? '<span class="chip">stale</span>' : ''].join('');
    const meta = [sv.name, e.author || '', e.code ?? '', e.createdAt ? new Date(e.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '', e.cellChanged ? 'cell changed' : ''].filter(Boolean).join(' · ');
    const ro = machineAuthored(e.author);
    return `<div class="card callout" role="group" aria-label="Error details" data-sp="callout" style="top:${top}px;left:${left}px;width:300px">
<div class="hd"><span class="g ${e.status === 'resolved' ? 'g-pass' : `g-${e.severity}`}" aria-hidden="true">${e.status === 'resolved' ? '✓' : sv.glyph}</span><span class="t">${esc(t?.name ?? BUILTIN_TYPE_NAMES[e.type] ?? e.type)}</span><span class="xs faint">${esc(e.range)}</span><span class="spacer"></span><button type="button" class="btn btn-g btn-i" data-act="prev" aria-label="Previous error">${ICON.prev}</button><button type="button" class="btn btn-g btn-i" data-act="next" aria-label="Next error">${ICON.next}</button></div>
<div class="bd"><dl class="fe"><dt>Found</dt><dd><span class="found">${esc(e.found)}</span></dd><dt>Should be</dt><dd><span class="want">${esc(e.expected || '—')}</span></dd></dl>${e.message ? `<p style="margin:0;font-size:13px">${esc(e.message)}</p>` : ''}${tags ? `<div style="display:flex;gap:6px">${tags}</div>` : ''}<span class="xs faint">${esc(meta)}</span></div>
${ro ? '' : `<div class="ft"><button type="button" class="btn" data-act="resolve">${e.status === 'resolved' ? 'Reopen' : '✓ Resolve'}</button><span class="spacer"></span><button type="button" class="btn btn-g btn-d" data-act="delete">Delete</button></div>`}</div>`;
  }

  private composerHtml(left: number, top: number, ref: string): string {
    const s = this._store!, snap = s.getSnapshot(), c = snap.composing!;
    const found = s.foundFor(c.sheet, c.range ?? c.ref);
    const ex = this._errorTypes.find((x) => x.id === this.draft.type) ?? this._errorTypes[0]!;
    const sevs = (['error', 'warning', 'note'] as Severity[]).map((v) => `<button type="button" data-act="sev" data-sev="${v}" aria-pressed="${this.draft.severity === v}"><span class="g g-${v}">${SEVERITY[v].glyph}</span>${SEVERITY[v].name}</button>`).join('');
    return `<div class="card composer" role="dialog" aria-label="New error" data-sp="composer" style="top:${top}px;left:${left}px;width:330px">
<div class="hd"><span class="t">New error</span><span class="xs faint">${esc(c.range ?? ref)} · found ${esc(found)}</span><span class="spacer"></span><button type="button" class="btn btn-g btn-i" data-act="cancel" aria-label="Cancel">${ICON.close}</button></div>
<div class="bd">
<label class="field"><span>Type</span><select class="input" data-field="type">${this._errorTypes.map((t) => `<option value="${esc(t.id)}"${t.id === this.draft.type ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
<label class="field"><span>What’s wrong</span><textarea class="input" rows="2" data-field="message" placeholder="${esc(ex.why)}">${esc(this.draft.message)}</textarea></label>
<label class="field"><span>What it should be</span><input class="input" data-field="expected" placeholder="${esc(ex.expected)}" value="${esc(this.draft.expected)}"></label>
<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" data-field="change"${this.draft.change ? ' checked' : ''}>Also change the cell to this value</label>
<div class="seg" role="group" aria-label="Severity">${sevs}</div><span class="xs faint">${esc(SEVERITY[this.draft.severity].help)}</span>
</div>
<div class="ft"><span class="xs faint">⌘↵ adds</span><span class="spacer"></span><button type="button" class="btn btn-p" data-act="add" data-sp="add-error">Add error</button></div></div>`;
  }
}

function fmtSize(n: number): string {
  return n < 1024 ? `${n} B` : n < 2 ** 20 ? `${Math.round(n / 1024)} KB` : `${(n / 2 ** 20).toFixed(1)} MB`;
}
const delimName = (d: string | undefined) => (d === ';' ? 'semicolon' : d === '\t' ? 'tab' : 'comma');

export { COL_VIRTUAL_AFTER, colAt };
