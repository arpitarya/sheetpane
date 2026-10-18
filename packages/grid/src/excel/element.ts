// <sheetpane-excel> — the sheet: the view and edit components as two modes of one
// element (W-01). Plain DOM in an open shadow root (grid verdict decisions 2, 6);
// every byte of state lives in the pane's store (L7); the contract is the DOM's (L4).
import { cellRef, colName, download, parseRange, parseRef, type RangePos } from '@sheetpane/export';
import type { ImportedSheet } from '@sheetpane/import';
import { controlsFor } from '../plugins/host.js';
import type { ControlDescriptor, Geometry } from '../plugins/types.js';
import { acquirePane, attach, detach, isPrimary, releasePane } from '../pane/registry.js';
import { createWorkbook, parseInput, splitKey, type StoreEvent, type WorkbookStore } from '../pane/store.js';
import { BUILTIN_TYPE_NAMES, DEFAULT_ERROR_TYPES, SEVERITY, machineAuthored, type ErrorType, type Mode, type SheetpaneError, type Severity } from '../pane/types.js';
import { ElementBase, ICON, esc, fire } from '../shared/dom.js';
import { pluginsFromIds } from '../plugins/host.js';
import type { Theme } from '../tokens.js';
import { COL_VIRTUAL_AFTER, HEAD_H, ROWHEAD_W, ROW_H, colAt, mergeAt, sheetGeometry, visibleWindow, type SheetGeometry } from './geometry.js';
import { EXCEL_CSS } from './styles.js';

const ZOOMS = [0.75, 1, 1.25, 1.5];
type Refs = Record<'help' | 'grid' | 'root' | 'dialog' | 'fname' | 'meta' | 'counts' | 'findin' | 'findcnt' | 'zoom' | 'editonly' | 'undo' | 'redo' | 'freeze' | 'changes' | 'export' | 'orig' | 'close' | 'ref' | 'cell' | 'cellname' | 'val' | 'merge' | 'changed' | 'revert' | 'issue' | 'hint' | 'plugCellbar' | 'frow' | 'plugFrow' | 'body' | 'scroller' | 'sheet' | 'hrow' | 'frozen' | 'rows' | 'overlay' | 'state' | 'tabs' | 'status' | 'picker' | 'modeseg', HTMLElement>;
const MAX_BYTES = 50 * 2 ** 20;

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
  if (!res.ok) throw new Error(`could not read ${src} (HTTP ${res.status})`);
  const name = decodeURIComponent(new URL(src, location.href).pathname.split('/').pop() || 'workbook.xlsx');
  return { bytes: new Uint8Array(await res.arrayBuffer()), name };
}

/** The text the cell bar shows for a value: raw, as Excel's formula bar does. */
const rawText = (v: unknown) => (v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v));
const sevOrder: Record<Severity, number> = { error: 3, warning: 2, note: 1 };
const errNum = (e: SheetpaneError) => Number(/(\d+)$/.exec(e.id)?.[1] ?? 0);

export class SheetpaneExcel extends ElementBase {
  static observedAttributes = ['pane', 'src', 'mode', 'display', 'open', 'author', 'plugins', 'header-row'];

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
  private dragging = false;
  private composerKey = '';
  private draft = { type: 'wrong-value', message: '', expected: '', severity: 'error' as Severity, change: false };
  private geom: { sheet: ImportedSheet; g: SheetGeometry } | undefined;
  private lastBody = '';
  private cellFocusStart: string | undefined;
  private overlayCache = new Map<string, HTMLElement>();
  private readonly onUnload = (e: BeforeUnloadEvent) => { if (this._store && this._store.changeCount > 0) { e.preventDefault(); e.returnValue = ''; } };

  // ── the DOM contract: properties ─────────────────────────────────────────
  get workbook(): WorkbookStore | undefined { return this._store; }
  set workbook(s: WorkbookStore | undefined) { this._explicitStore = s; if (this.isConnected) { this.unbind(); this.bind(); this.schedule(); } }
  get errors(): SheetpaneError[] { return this._store?.getErrors() ?? []; }
  set errors(list: SheetpaneError[]) { this.setErrors(list); }
  get errorTypes(): readonly ErrorType[] { return this._errorTypes; }
  set errorTypes(t: readonly ErrorType[]) { this._errorTypes = t.length ? t : DEFAULT_ERROR_TYPES; this.schedule(); }
  set file(f: File | Blob | ArrayBuffer | Uint8Array | null) { if (f) void this.load(f); }
  get mode(): Mode { return this._store?.getSnapshot().mode ?? ((this.getAttribute('mode') as Mode) || 'view'); }
  set mode(m: Mode) { this.setAttribute('mode', m); }
  /** `light` (the default), `dark`, or `auto` (follows `prefers-color-scheme`) — colour only; the file's own colours never change (W-29). */
  get theme(): Theme { const t = this.getAttribute('theme'); return t === 'dark' || t === 'auto' ? t : 'light'; }
  set theme(t: Theme) { this.setAttribute('theme', t); }
  get open(): boolean { return this.hasAttribute('open'); }
  set open(v: boolean) { this.toggleAttribute('open', v); }
  get src(): string | null { return this.getAttribute('src'); }
  set src(v: string | null | undefined) { if (v === null || v === undefined || v === '') this.removeAttribute('src'); else this.setAttribute('src', v); }

  // ── methods ──────────────────────────────────────────────────────────────
  /** Reads a file into the pane: a File, Blob, bytes, a URL, or base64. */
  async load(src: string | File | Blob | ArrayBuffer | Uint8Array, name?: string): Promise<void> {
    const store = this.ensureStore();
    let data: Uint8Array | Blob | ArrayBuffer, nm = name;
    if (typeof src === 'string') {
      try { const r = await bytesFromSrc(src); data = r.bytes; nm ??= r.name; }
      catch (e) { this.showEmpty = false; store.failLoad(name ?? src, e instanceof Error ? e.message : String(e), this); return; }
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
  async export(options: Readonly<Record<string, unknown>> = {}): Promise<Blob> {
    const r = await this.ensureStore().exportFile({ options });
    this.lastExport = { ok: fire(this, 'sheetpane-export', { blob: r.blob, kind: r.kind, name: r.name, guarded: r.guarded }, true), name: r.name };
    return r.blob;
  }
  private lastExport: { ok: boolean; name: string } | undefined;
  private lastSheet = '';

  select(sheet: string, ref: string): void { this.ensureStore().select({ sheet, ref }, this); this.scrollToSel = true; }
  getErrors(): SheetpaneError[] { return this.errors; }
  setErrors(list: SheetpaneError[]): void { this.ensureStore().setErrors(list, this); }
  undo(): void { this._store?.undo(this); }
  redo(): void { this._store?.redo(this); }

  // ── lifecycle ────────────────────────────────────────────────────────────
  connectedCallback(): void {
    if (!this.built) this.build();
    this.bind();
    const m = this.getAttribute('mode');
    if (m === 'edit' || m === 'view') this._store!.setMode(m, this);
    const src = this.getAttribute('src');
    if (src && this._store!.getSnapshot().load.status === 'empty') void this.load(src);
    addEventListener('beforeunload', this.onUnload);
    this.place();
    this.schedule();
  }

  disconnectedCallback(): void {
    removeEventListener('beforeunload', this.onUnload);
    this.unbind();
    cancelAnimationFrame(this.raf);
  }

  attributeChangedCallback(name: string, old: string | null, val: string | null): void {
    if (!this.isConnected || old === val) return;
    if (name === 'pane' || name === 'plugins') { this.unbind(); this.bind(); }
    else if (name === 'src' && val) void this.load(val);
    else if (name === 'mode' && (val === 'view' || val === 'edit')) this._store?.setMode(val, this);
    else if (name === 'display' || name === 'open') this.place();
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
    const sheetBefore = this.lastSheet;
    if (e.type === 'load') this.lastSheet = this._store!.getSnapshot().selection.sheet;
    if (e.type === 'select') this.lastSheet = e.sheet;
    if (e.type === 'load') { this.geom = undefined; this.findHits = []; this.findVersion = -1; for (const el of this.overlayCache.values()) el.remove(); this.overlayCache.clear(); }
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
      case 'change': fire(this, 'sheetpane-change', { sheet: e.sheet, ref: e.ref, kind: e.kind, was: e.was, now: e.now }); break;
      case 'errors': fire(this, 'sheetpane-errors', { errors: s.getErrors(), plugins: s.pluginIds }); break;
      case 'select':
        if (e.sheet !== sheetBefore) fire(this, 'sheetpane-sheet', { sheet: e.sheet });
        fire(this, 'sheetpane-select', { sheet: e.sheet, ref: e.ref, column: this.column(e.sheet, e.ref), value: s.value(e.sheet, e.ref) });
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
   <button type="button" class="btn btn-g btn-i undo" aria-label="Undo (Ctrl+Z)" title="Undo">${ICON.undo}</button>
   <button type="button" class="btn btn-g btn-i redo" aria-label="Redo (Ctrl+Shift+Z)" title="Redo">${ICON.redo}</button>
   <button type="button" class="btn btn-g btn-i freeze" aria-label="Freeze panes at the selected cell" title="Freeze rows above and columns left of the selected cell">${ICON.freeze}</button>
   <span class="xs faint changes"></span>
   <button type="button" class="btn btn-p export">${ICON.download}<span>Export</span></button>
  </span>
  <button type="button" class="btn btn-g btn-i orig" aria-label="Download the original file" title="Download the original">${ICON.download}</button>
  <button type="button" class="btn btn-g btn-i help" aria-label="Keyboard shortcuts" aria-expanded="false" title="Keyboard shortcuts">?</button>
  <button type="button" class="btn btn-g btn-i close" aria-label="Close (Esc)" title="Close">${ICON.close}</button>
 </div>
 <div class="fx" part="cellbar">
  <span class="ref"></span>
  <label class="cellwrap" style="display:contents"><span class="vh cellname">Cell value</span><input class="input cell" placeholder="(empty)" autocomplete="off" spellcheck="false"></label>
  <span class="val"></span>
  <span class="tag merge"></span>
  <span class="chip chip-info changed"></span><button type="button" class="btn btn-g revert">Revert</button>
  <span class="chip issue"></span>
  <span class="chip chip-info hint">Describe it in the Errors panel</span>
  <span class="plug-cellbar" style="display:contents"></span>
 </div>
 <div class="frow" part="format-row" role="toolbar" aria-label="Format"><span class="plug-frow" style="display:contents"></span><slot name="format-row"></slot></div>
 <div class="body">
  <div class="scroller">
   <div class="sheet"><div class="grid" role="grid" tabindex="0" aria-label="Sheet" aria-multiselectable="true"><div class="hrow" role="row" aria-rowindex="1"></div><div class="frozenrows" style="display:contents"></div><div class="rows"></div></div><div class="overlay"></div></div>
  </div>
  <div class="state" hidden></div>
 </div>
 <div class="tabs" role="tablist" aria-label="Sheets"></div>
 <div class="status" part="status" role="status"></div>
 <input type="file" class="picker" accept=".xlsx,.csv" hidden>
</div>`;
    const $ = <T extends HTMLElement>(sel: string) => this.shadow.querySelector(sel) as T;
    this.q = {
      root: $('.sp'), dialog: $('dialog'), fname: $('.fname'), meta: $('.meta'), counts: $('.counts'), findin: $('.findin'), findcnt: $('.find .cnt'), zoom: $('.zoom'),
      editonly: $('.editonly'), undo: $('.undo'), redo: $('.redo'), freeze: $('.freeze'), changes: $('.changes'), export: $('.export'), orig: $('.orig'), close: $('.close'),
      help: $('.help'), ref: $('.ref'), cell: $('.cell'), cellname: $('.cellname'), val: $('.val'), merge: $('.merge'), changed: $('.changed'), revert: $('.revert'), issue: $('.issue'), hint: $('.hint'),
      plugCellbar: $('.plug-cellbar'), frow: $('.frow'), plugFrow: $('.plug-frow'), body: $('.body'), scroller: $('.scroller'), sheet: $('.sheet'), hrow: $('.hrow'),
      grid: $('.grid'), frozen: $('.frozenrows'), rows: $('.rows'), overlay: $('.overlay'), state: $('.state'), tabs: $('.tabs'), status: $('.status'), picker: $('.picker'), modeseg: $('.modeseg'),
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
    q.export.addEventListener('click', async () => {
      const blob = await this.export();
      if (this.lastExport?.ok) download(blob, this.lastExport.name);
    });
    q.orig.addEventListener('click', () => { const src = s().getSnapshot().source; if (src) download(src.bytes, src.name); });
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
    });
    cell.addEventListener('input', () => {
      const ed = this.editing;
      if (!ed) return;
      fire(this, 'sheetpane-input', { sheet: ed.sheet, ref: ed.ref, column: this.column(ed.sheet, ed.ref), draft: cell.value, was: s().value(ed.sheet, ed.ref) });
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
        if (ed) { cell.value = ed.start; this.editing = undefined; fire(this, 'sheetpane-editcancel', { sheet: ed.sheet, ref: ed.ref }); }
        q.grid.focus({ preventScroll: true });
      }
    });
    cell.addEventListener('blur', () => this.commitDraft());
    q.grid.addEventListener('paste', (e) => this.onPaste(e as ClipboardEvent));
    q.tabs.addEventListener('click', (e) => { const b = (e.target as Element).closest<HTMLElement>('[data-sheet]'); if (b) { s().select({ sheet: b.dataset.sheet!, ref: 'A1' }, this); this.q.scroller.scrollTo(0, 0); } });
    q.scroller.addEventListener('scroll', () => this.schedule(), { passive: true });
    q.scroller.addEventListener('mousedown', (e) => this.onPointer(e, 'down'));
    q.scroller.addEventListener('mousemove', (e) => { if (this.dragging) this.onPointer(e, 'move'); });
    addEventListener('mouseup', () => { this.dragging = false; });
    q.scroller.addEventListener('dblclick', (e) => { if ((e.target as Element).closest('.c') && this.mode === 'edit') this.editCell(); });
    q.grid.addEventListener('keydown', (e) => this.onKey(e));
    q.overlay.addEventListener('click', (e) => this.onOverlayClick(e));
    q.overlay.addEventListener('keydown', (e) => {
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

  /** `sheetpane-beforechange` (cancellable) for one cell; the value it would store is `now`. */
  private allowChange(sheet: string, ref: string, now: unknown): boolean {
    const s = this._store!;
    return fire(this, 'sheetpane-beforechange', { sheet, ref, column: this.column(sheet, ref), was: s.value(sheet, ref), now }, true);
  }

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
    if (!this.allowChange(ed.sheet, ed.ref, now)) { cell.value = ed.start; return; }
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
    rows.forEach((row, dr) => row.forEach((v, dc) => {
      const ref = cellRef(p.row + dr, p.col + dc);
      if (this.allowChange(snap.selection.sheet, ref, parseInput(v, s.original(snap.selection.sheet, ref).value, book.source))) cells.push({ sheet: snap.selection.sheet, ref, input: v });
    }));
    s.setCells(cells, { origin: this });
  }

  /** The grid's keys, then every plugin control's shortcut (W-14 DoD 8). */
  shortcuts(): { keys: string; what: string }[] {
    const own = [
      ['Arrows', 'Move'], ['Shift + arrows', 'Select a range'], ['Home / End', 'Row start / end'], ['Ctrl + Home / End', 'First / last cell'],
      ['Page Up / Down', 'Move a screen'], ['Enter or F2', 'Edit the cell (Edit)'], ['Type', 'Replace the cell (Edit)'], ['Delete', 'Clear the cell (Edit)'],
      ['F', 'Flag issue (Edit)'], ['Esc', 'Cancel · close the pop-up'], ['Ctrl/⌘ + Z', 'Undo'], ['Ctrl + Y, ⌘ + Shift + Z', 'Redo'], ['Ctrl/⌘ + C', 'Copy the value'],
    ].map(([keys, what]) => ({ keys: keys!, what: what! }));
    const plug = (this._store?.plugins ?? []).flatMap((p) => p.controls ?? []).filter((c) => c.shortcut).map((c) => ({ keys: c.shortcut!, what: c.label }));
    return [...own, ...plug];
  }

  /** Does a key event match a control's shortcut, e.g. `Mod+B`, `Ctrl+Shift+5`, `B`? */
  private matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
    const parts = shortcut.split('+').map((x) => x.trim().toLowerCase());
    const key = parts.pop()!;
    const want = { mod: parts.includes('mod'), ctrl: parts.includes('ctrl'), meta: parts.includes('meta') || parts.includes('cmd'), shift: parts.includes('shift'), alt: parts.includes('alt') };
    const mod = want.mod ? e.ctrlKey || e.metaKey : (want.ctrl ? e.ctrlKey : !e.ctrlKey) && (want.meta ? e.metaKey : !e.metaKey);
    return mod && e.shiftKey === want.shift && e.altKey === want.alt && e.key.toLowerCase() === key;
  }

  private onPointer(e: MouseEvent, phase: 'down' | 'move'): void {
    const t = e.target as HTMLElement;
    const mk = t.closest<HTMLElement>('.mk');
    if (mk && phase === 'down') { e.preventDefault(); this.runCellControl(mk); return; }
    const c = t.closest<HTMLElement>('.c');
    if (!c || c.dataset.r === undefined) return;
    if (phase === 'down') { if (e.button !== 0) return; e.preventDefault(); this.q.grid.focus({ preventScroll: true }); this.dragging = true; }
    const row = Number(c.dataset.r), col = Number(c.dataset.c);
    this.selectCell(row, col, phase === 'move' || e.shiftKey);
  }

  private selectCell(row: number, col: number, extend: boolean): void {
    const s = this._store!, snap = s.getSnapshot();
    const ref = cellRef(row, col);
    if (extend && this.anchor) {
      const r: RangePos = { top: Math.min(this.anchor.row, row), left: Math.min(this.anchor.col, col), bottom: Math.max(this.anchor.row, row), right: Math.max(this.anchor.col, col) };
      const range = r.top === r.bottom && r.left === r.right ? undefined : `${cellRef(r.top, r.left)}:${cellRef(r.bottom, r.right)}`;
      s.select(range ? { sheet: snap.selection.sheet, ref: cellRef(this.anchor.row, this.anchor.col), range } : { sheet: snap.selection.sheet, ref }, this);
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
    if (ctl && !ctl.disabled?.(snap, snap.selection)) { ctl.run!(s, snap.selection); e.preventDefault(); return; }
    if (e.altKey && k === 'ArrowDown' && edit) {
      const ctx = s.cellContext(snap.selection.sheet, snap.selection.ref);
      const mc = ctx && controlsFor(s.plugins, 'cell', 'edit').find((c) => c.cellOptions && c.choose && c.appliesTo?.(ctx));
      if (mc && ctx) { this.menu = { control: mc.id, sheet: snap.selection.sheet, ref: snap.selection.ref, options: mc.cellOptions!(ctx) }; this.focusMenu = true; this.schedule(); e.preventDefault(); return; }
    }
    if (mod && (k === 'z' || k === 'Z')) { if (e.shiftKey) s.redo(this); else s.undo(this); }
    else if (mod && (k === 'y' || k === 'Y')) s.redo(this);
    else if (mod && (k === 'c' || k === 'C')) void navigator.clipboard?.writeText(s.text(snap.selection.sheet, snap.selection.ref)).catch(() => {});
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
    else if ((k === 'Delete' || k === 'Backspace') && edit) { if (this.allowChange(snap.selection.sheet, snap.selection.ref, null)) s.setCell(snap.selection.sheet, snap.selection.ref, null, { origin: this }); }
    else if (edit && !mod && !e.altKey && k.length === 1) { this.editCell(k); }
    else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }

  /** Esc cancels the innermost thing open; false when nothing was. */
  private escape(): boolean {
    const s = this._store;
    if (this.menu) { this.menu = undefined; this.schedule(); return true; }
    if (s?.getSnapshot().composing) { s.compose(null); return true; }
    if (this.findText) { (this.q.findin as HTMLInputElement).value = ''; this.findText = ''; this.findHits = []; this.schedule(); return true; }
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
    this.selectCell(row, col, extend);
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
    if (!act) { const c = t.closest<HTMLElement>('[data-control]'); if (c) this.runControl(e); return; }
    const sel = snap.selection;
    const err = this.errorAt(sel.sheet, sel.ref);
    switch (act) {
      case 'flag': this.flag(); break;
      case 'copy-ref': void navigator.clipboard?.writeText(sel.range ?? sel.ref).catch(() => {}); break;
      case 'copy-value': void navigator.clipboard?.writeText(s.text(sel.sheet, sel.ref)).catch(() => {}); break;
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
    const mk = merges.join('|');
    if (this.geom?.sheet !== sheet || this.geomMerges !== mk) { this.geom = { sheet, g: sheetGeometry(sheet, merges) }; this.geomMerges = mk; }
    return this.geom;
  }
  private geomMerges = '';

  /** Geometry as plugins see it: pixels at 100 % zoom from A1's top-left. */
  geometryFor(sheet: string): Geometry | undefined {
    const sh = this._store?.sheet(sheet);
    if (!sh) return undefined;
    const g = this.geom?.sheet === sh ? this.geom.g : sheetGeometry(sh);
    return { colX: (c) => g.colX[Math.min(c, g.cols)] ?? g.colX[g.cols]! + (c - g.cols) * 64, colWidth: (c) => (g.colX[c + 1] ?? 0) - (g.colX[c] ?? 0) || 64, rowY: (r) => r * ROW_H, rowHeight: () => ROW_H };
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
    q.export.querySelector('span')!.textContent = `Export .${src.kind}`;
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
    const curText = rawText(s.value(sel.sheet, sel.ref));
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
    q.plugCellbar.innerHTML = this.controlsHtml(controlsFor(s.plugins, 'cellbar', snap.mode), 'btn btn-g');
    // format row: Edit only, and only when a plugin or the host put something in it
    const frow = controlsFor(s.plugins, 'format-row', 'edit');
    const hostSlot = (q.frow.querySelector('slot') as HTMLSlotElement).assignedElements().length > 0;
    q.frow.hidden = !edit || (!frow.length && !hostSlot);
    q.plugFrow.innerHTML = this.controlsHtml(frow, 'btn btn-g', true);
    // find
    if (this.findText) this.computeHits();
    (q.findcnt as HTMLElement).textContent = this.findText ? (this.findHits.length ? `${this.findIdx >= 0 ? this.findIdx + 1 : 0} of ${this.findHits.length}` : 'none') : '';
    // tabs (.xlsx only)
    q.tabs.hidden = src.kind === 'csv';
    q.tabs.innerHTML = book.sheets.map((sh) => {
      const cnt = edit ? snap.errors.filter((e) => e.sheet === sh.name && e.status === 'open').length : 0;
      return `<button type="button" role="tab" class="tab${sh.hidden ? ' hidden-sheet' : ''}" data-sheet="${esc(sh.name)}" aria-selected="${sh.name === sheet.name}"${sh.hidden ? ' title="Hidden in the file"' : ''}>${esc(sh.name)}${cnt ? `<span class="cnt" aria-label="${cnt} open">${cnt}</span>` : ''}</button>`;
    }).join('');
    this.renderGrid(g.g, sheet, snap.mode);
    // status line
    const statusPlug = controlsFor(s.plugins, 'status', snap.mode).map((c) => c.text?.(snap, sel) ?? '').filter(Boolean);
    const dataRows = sheet.rows.length, dataCols = sheet.rows.reduce((m, r) => Math.max(m, r.length), 0);
    q.status.innerHTML = [
      `<span>${esc(sheet.name)} · ${dataRows} row${dataRows === 1 ? '' : 's'} × ${dataCols} column${dataCols === 1 ? '' : 's'}${g.g.merges.length ? ` · ${g.g.merges.length} merged range${g.g.merges.length === 1 ? '' : 's'}` : ''}</span>`,
      n ? `<span>· ${n} cell change${n === 1 ? '' : 's'} kept in memory until you export</span>` : '',
      ...statusPlug.map((t) => `<span>${esc(t)}</span>`),
      `<span class="spacer"></span><span>Read in this tab — nothing uploaded</span>`,
      this.getAttribute('display') === 'popup' ? '<span>Esc to close</span>' : '',
    ].join('');
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
      const active = c.isActive?.(snap, snap.selection);
      const label = c.labelFor?.(snap, snap.selection) ?? c.label;
      const named = `${label}${c.shortcut ? ` (${c.shortcut})` : ''}`;
      const off = c.disabled?.(snap, snap.selection) ?? false;
      return `${sep}<button type="button" class="${cls}" data-control="${esc(c.id)}" aria-label="${esc(named)}" title="${esc(named)}"${active !== undefined ? ` aria-pressed="${active}"` : ''}${off ? ' disabled' : ''}>${c.icon ?? ''}${c.icon ? '' : esc(label)}</button>`;
    }).join('');
  }

  private renderState(): void {
    const snap = this._store!.getSnapshot(), st = this.q.state;
    let html: string;
    if (!this.showEmpty && snap.load.status === 'error') {
      const f = snap.load;
      const pw = f.detail === 'password';
      html = `<div class="msg ${pw ? 'warn' : 'fail'}" role="alert"><span class="g ${pw ? 'g-warning' : 'g-error'}">${pw ? '!' : '✕'}</span><div style="display:flex;flex-direction:column;gap:8px"><span class="t">${pw ? 'Password protected' : 'Can’t open this file'}</span><span>${esc(f.message)}</span><div><button type="button" class="btn again">Choose another file</button></div></div></div>`;
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
    const RH = ROW_H * z, HH = HEAD_H * z, RW = ROWHEAD_W * z;
    const X = (c: number) => g.colX[c]! * z;
    const W = (c: number) => (g.colX[c + 1]! - g.colX[c]!) * z;
    const totalW = RW + X(g.cols), totalH = HH + g.rows * RH;
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
    const selR = sel.range ? parseRange(sel.range) : undefined;
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
      if (typeof v === 'number') cls.push('n');
      if (m) cls.push('merge');
      if (r === selP.row && c === selP.col) cls.push('sel');
      else if (selR && r >= selR.top && r <= selR.bottom && c >= selR.left && c <= selR.right) cls.push('inrange');
      if (hitSet.has(ref)) cls.push('hit');
      if (curHit && curHit.sheet === sheet.name && curHit.ref === ref) cls.push('cur');
      if (s.changesAt(sheet.name, ref).length) cls.push('chg');
      const mk = marks.get(`${r},${c}`);
      if (mk) cls.push(mk);
      const stale = s.mayBeStale(sheet.name, ref);
      if (stale) cls.push('stale');
      if (snap.derived.has(`${sheet.name}!${ref}`) && !s.changeOf(sheet.name, ref)) cls.push('derived');
      const w = m ? X(m.right + 1) - X(m.left) : W(c);
      const h = m ? (m.bottom - m.top + 1) * RH : RH;
      let style = frozenCol ? `left:${RW + X(c)}px;width:${W(c)}px;height:${RH}px;flex:none` : `left:${RW + X(c)}px;width:${w}px;height:${h}px`;
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
      return `<div id="c${r}_${c}" role="gridcell" class="${cls.join(' ')}" data-r="${r}" data-c="${c}" aria-colindex="${c + 2}" aria-selected="${r === selP.row && c === selP.col}" style="${style}"${title}><span class="v">${esc(text)}</span>${extra}</div>`;
    };
    const rowHead = (r: number) => {
      const w = rowWorst.get(r);
      return `<div class="rh" role="rowheader" style="width:${RW}px;height:${RH}px">${w ? `<span class="g g-${w}" aria-label="${SEVERITY[w].name}">${SEVERITY[w].glyph}</span>` : ''}${r + 1}</div>`;
    };
    const cellsOf = (r: number) => {
      let out = '';
      for (let c = 0; c < fc; c++) out += cellHtml(r, c, true);
      for (let c = win.c0; c <= win.c1; c++) out += cellHtml(r, c, false);
      // merges that start left of the window but reach into it
      for (const m of g.merges) if (m.top === r && m.left < win.c0 && m.left >= fc && m.right >= win.c0) out += cellHtml(r, m.left, false);
      return out;
    };
    // header row
    let hdr = `<div class="corner" role="columnheader" style="width:${RW}px;height:${HH}px"><span class="vh">Row</span></div>`;
    for (let c = 0; c < fc; c++) hdr += `<div class="ch fz" role="columnheader" style="left:${RW + X(c)}px;width:${W(c)}px;height:${HH}px;flex:none" aria-colindex="${c + 2}">${colName(c)}</div>`;
    for (let c = win.c0; c <= win.c1; c++) hdr += `<div class="ch" role="columnheader" style="left:${RW + X(c)}px;width:${W(c)}px;height:${HH}px" aria-colindex="${c + 2}">${colName(c)}</div>`;
    // frozen rows (sticky), then the window
    let frozen = '';
    for (let r = 0; r < fr; r++) frozen += `<div class="frozen" role="row" aria-rowindex="${r + 2}" style="top:${HH + r * RH}px;height:${RH}px;width:${totalW}px;position:sticky">${rowHead(r)}${cellsOf(r)}</div>`;
    const rows = new Set<number>();
    for (let r = win.r0; r <= win.r1; r++) rows.add(r);
    for (const m of g.merges) if (m.top < win.r0 && m.top >= fr && m.bottom >= win.r0) rows.add(m.top);
    let body = '';
    for (const r of [...rows].sort((a, b) => a - b)) body += `<div class="row" role="row" aria-rowindex="${r + 2}" style="top:${HH + r * RH}px;height:${RH}px;width:${totalW}px">${rowHead(r)}${cellsOf(r)}</div>`;
    const key = `${hdr.length}|${frozen}|${body}`;
    if (key !== this.lastBody) {
      this.lastBody = key;
      q.hrow.innerHTML = hdr;
      q.hrow.style.cssText = `width:${totalW}px;height:${HH}px`;
      q.frozen.innerHTML = frozen;
      q.rows.innerHTML = body;
    }
    grid.setAttribute('aria-activedescendant', `c${selP.row}_${selP.col}`);
    this.renderOverlay(g, sheet, z, RW, HH, RH, X, W, win);
  }

  private scrollSelIntoView(g: SheetGeometry, z: number, fr: number, fc: number): void {
    const s = this._store!, p = parseRef(s.getSnapshot().selection.ref)!, sc = this.q.scroller;
    const RH = ROW_H * z, HH = HEAD_H * z, RW = ROWHEAD_W * z;
    const top = p.row * RH, bottom = top + RH;
    const stickTop = HH + fr * RH, stickLeft = RW + g.colX[fc]! * z;
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

  private renderOverlay(g: SheetGeometry, sheet: ImportedSheet, z: number, RW: number, HH: number, RH: number, X: (c: number) => number, W: (c: number) => number, win: { r0: number; r1: number }): void {
    const s = this._store!, snap = s.getSnapshot(), edit = snap.mode === 'edit', ov = this.q.overlay;
    const at = (r: number, c: number) => ({ x: RW + X(c), y: HH + r * RH });
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
      card = `<div class="card menu" role="listbox" aria-label="Choices" style="top:${p.y + RH}px;left:${p.x}px;min-width:${Math.max(cw, 140)}px;max-height:260px;overflow:auto">${m.options.map((o) => `<button type="button" role="option" class="btn btn-g" style="justify-content:flex-start;width:100%;border-radius:0" data-act="pick-option" data-v="${esc(o)}">${esc(o) || '(empty)'}</button>`).join('')}</div>`;
    } else if (err) {
      card = this.calloutHtml(err, sideLeft(300), sideTop(260));
    } else if (edit && sel.sheet === sheet.name) {
      const plug = this.controlsHtml(controlsFor(s.plugins, 'selbar', 'edit'), '');
      const top = selP.row <= 1 ? p.y + RH + 4 : p.y - 40;
      parts.push(`<div class="selbar" role="toolbar" aria-label="Selection" style="top:${top}px;left:${Math.max(RW, p.x - 40)}px"><button type="button" class="on" data-act="flag">${ICON.flag}Flag issue <span class="kbd">F</span></button><span class="sep" aria-hidden="true"></span><button type="button" data-act="copy-ref">Copy ref</button><button type="button" data-act="copy-value">Copy value</button>${plug ? `<span class="sep" aria-hidden="true"></span>${plug}` : ''}</div>`);
    }
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
    const items = providers.flatMap((p) => { try { return p.overlay!(sheet.name, { ...s.pluginContext(), geometry }); } catch (e) { console.error(`sheetpane: plugin "${p.id}" overlay failed`, e); return []; } });
    const keep = new Set<string>();
    for (const it of items) {
      const id = `${sheet.name}|${it.id}`;
      keep.add(id);
      let el = this.overlayCache.get(id);
      if (!el) { el = document.createElement('div'); el.className = 'olay'; el.setAttribute('role', 'img'); if (it.alt) el.setAttribute('aria-label', it.alt); el.append(it.render()); this.overlayCache.set(id, el); }
      el.style.cssText = `left:${RW + it.rect.x * z}px;top:${HH + it.rect.y * z}px;width:${it.rect.width * z}px;height:${it.rect.height * z}px;pointer-events:auto`;
      if (el.parentNode !== layer) layer.append(el);
    }
    for (const [id, el] of this.overlayCache) if (!keep.has(id)) { el.remove(); if (!id.startsWith(`${sheet.name}|`)) continue; this.overlayCache.delete(id); }
  }

  private calloutHtml(e: SheetpaneError, left: number, top: number): string {
    const s = this._store!, sv = SEVERITY[e.severity], t = this._errorTypes.find((x) => x.id === e.type);
    const tags = [e.matchesExpected ? '<span class="chip chip-pass">matches suggestion</span>' : '', s.isStale(e) ? '<span class="chip">stale</span>' : ''].join('');
    const meta = [sv.name, e.author || '', e.createdAt ? new Date(e.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '', e.cellChanged ? 'cell changed' : ''].filter(Boolean).join(' · ');
    const ro = machineAuthored(e.author);
    return `<div class="card callout" role="group" aria-label="Error details" style="top:${top}px;left:${left}px;width:300px">
<div class="hd"><span class="g ${e.status === 'resolved' ? 'g-pass' : `g-${e.severity}`}" aria-hidden="true">${e.status === 'resolved' ? '✓' : sv.glyph}</span><span class="t">${esc(t?.name ?? BUILTIN_TYPE_NAMES[e.type] ?? e.type)}</span><span class="xs faint">${esc(e.range)}</span><span class="spacer"></span><button type="button" class="btn btn-g btn-i" data-act="prev" aria-label="Previous error">${ICON.prev}</button><button type="button" class="btn btn-g btn-i" data-act="next" aria-label="Next error">${ICON.next}</button></div>
<div class="bd"><dl class="fe"><dt>Found</dt><dd><span class="found">${esc(e.found)}</span></dd><dt>Should be</dt><dd><span class="want">${esc(e.expected || '—')}</span></dd></dl>${e.message ? `<p style="margin:0;font-size:13px">${esc(e.message)}</p>` : ''}${tags ? `<div style="display:flex;gap:6px">${tags}</div>` : ''}<span class="xs faint">${esc(meta)}</span></div>
${ro ? '' : `<div class="ft"><button type="button" class="btn" data-act="resolve">${e.status === 'resolved' ? 'Reopen' : '✓ Resolve'}</button><span class="spacer"></span><button type="button" class="btn btn-g btn-d" data-act="delete">Delete</button></div>`}</div>`;
  }

  private composerHtml(left: number, top: number, ref: string): string {
    const s = this._store!, snap = s.getSnapshot(), c = snap.composing!;
    const found = s.foundFor(c.sheet, c.range ?? c.ref);
    const ex = this._errorTypes.find((x) => x.id === this.draft.type) ?? this._errorTypes[0]!;
    const sevs = (['error', 'warning', 'note'] as Severity[]).map((v) => `<button type="button" data-act="sev" data-sev="${v}" aria-pressed="${this.draft.severity === v}"><span class="g g-${v}">${SEVERITY[v].glyph}</span>${SEVERITY[v].name}</button>`).join('');
    return `<div class="card composer" role="dialog" aria-label="New error" style="top:${top}px;left:${left}px;width:330px">
<div class="hd"><span class="t">New error</span><span class="xs faint">${esc(c.range ?? ref)} · found ${esc(found)}</span><span class="spacer"></span><button type="button" class="btn btn-g btn-i" data-act="cancel" aria-label="Cancel">${ICON.close}</button></div>
<div class="bd">
<label class="field"><span>Type</span><select class="input" data-field="type">${this._errorTypes.map((t) => `<option value="${esc(t.id)}"${t.id === this.draft.type ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
<label class="field"><span>What’s wrong</span><textarea class="input" rows="2" data-field="message" placeholder="${esc(ex.why)}">${esc(this.draft.message)}</textarea></label>
<label class="field"><span>What it should be</span><input class="input" data-field="expected" placeholder="${esc(ex.expected)}" value="${esc(this.draft.expected)}"></label>
<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" data-field="change"${this.draft.change ? ' checked' : ''}>Also change the cell to this value</label>
<div class="seg" role="group" aria-label="Severity">${sevs}</div><span class="xs faint">${esc(SEVERITY[this.draft.severity].help)}</span>
</div>
<div class="ft"><span class="xs faint">⌘↵ adds</span><span class="spacer"></span><button type="button" class="btn btn-p" data-act="add">Add error</button></div></div>`;
  }
}

function fmtSize(n: number): string {
  return n < 1024 ? `${n} B` : n < 2 ** 20 ? `${Math.round(n / 1024)} KB` : `${(n / 2 ** 20).toFixed(1)} MB`;
}
const delimName = (d: string | undefined) => (d === ';' ? 'semicolon' : d === '\t' ? 'tab' : 'comma');

export { COL_VIRTUAL_AFTER, colAt };
