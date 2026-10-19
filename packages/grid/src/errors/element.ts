// <sheetpane-errors> — the error component (W-02): the list and the New error
// form, on the same store as <sheetpane-excel> (SR-LAW-7). It keeps no private
// copy of errors or workbook data; no "linked" chip, no export footer.
import { cellRef, colName, parseRange, parseRef, rangeRef, type StructureOp } from '@sheetpane/export';
import { pluginsFromIds } from '../plugins/host.js';
import type { Theme } from '../tokens.js';
import { acquirePane, attach, detach, isPrimary, releasePane } from '../pane/registry.js';
import { createWorkbook, editRef, splitKey, type StoreEvent, type WorkbookStore } from '../pane/store.js';
import { BUILTIN_TYPE_NAMES, DEFAULT_ERROR_TYPES, DEFAULT_LAYER, SEVERITY, SEVERITY_ORDER, errorScope, isResult, layerOf, machineAuthored, resultsLevelOf, type Edit, type ErrorType, type ErrorsEnvelope, type RenderDetail, type ResultSeverity, type ResultsLevel, type SheetpaneError, type Severity } from '../pane/types.js';
import { BASE_CSS } from '../excel/styles.js';
import { DETAIL_CSS, DetailRegion, acceptedHtml, inDetail } from '../shared/detail.js';
import { ElementBase, ICON, esc, fire, layersAttr } from '../shared/dom.js';

const CSS = `.grp{padding:8px 12px 2px;font-size:11px;font-weight:600;color:var(--sp-ink-3);text-transform:uppercase;letter-spacing:.04em}
${BASE_CSS}
:host{display:block}
.spe{display:flex;flex-direction:column;height:100%;min-height:240px;background:var(--sp-surface);border:1px solid var(--sp-line);border-radius:var(--sp-r-lg);overflow:hidden}
.hd{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--sp-line);flex-wrap:wrap}
.hd .t{font-weight:600}
.filters{display:flex;gap:4px;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid var(--sp-line)}
.filters button{height:26px;padding:0 10px;border:1px solid var(--sp-line-strong);border-radius:999px;background:var(--sp-surface);color:var(--sp-ink-2);font-size:12px;font-weight:500;cursor:pointer}
.filters button[aria-pressed=true]{background:var(--sp-ink);border-color:var(--sp-ink);color:var(--sp-cell)}
.filters .sep{width:1px;background:var(--sp-line);margin:2px 4px}
.scrollarea{flex:1;min-height:0;overflow:auto}
.empty{padding:24px 16px;color:var(--sp-ink-3);font-size:13px;text-align:center}
.item{border-bottom:1px solid var(--sp-line)}
.issue{display:flex;gap:10px;padding:10px 12px;align-items:flex-start;width:100%;border:0;background:none;text-align:left;cursor:pointer;color:var(--sp-ink);font:inherit}
.issue:hover{background:var(--sp-ground)}
.item.on .issue{background:var(--sp-accent-soft)}
.issue .n{font-size:11px;font-weight:700;min-width:22px;height:20px;border-radius:10px;color:var(--sp-on-solid);display:inline-flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums;flex:none}
.n.error{background:var(--sp-fail)}.n.warning{background:var(--sp-warn)}.n.note{background:var(--sp-accent)}.n.resolved{background:var(--sp-pass)}.n.accepted{background:var(--sp-surface);color:var(--sp-ink-2);box-shadow:inset 0 0 0 1.5px var(--sp-ink-3)}
.issue .bd{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.issue .ty{font-weight:600;font-size:13px}
.item.done .ty{color:var(--sp-ink-3);text-decoration:line-through}
.issue .ba{font-size:12px;overflow-wrap:anywhere}
.issue .m{font-size:12px;color:var(--sp-ink-3)}
.found{color:var(--sp-fail);text-decoration:line-through;background:var(--sp-fail-soft);padding:0 3px;border-radius:3px}
.want{color:var(--sp-pass);background:var(--sp-pass-soft);padding:0 3px;border-radius:3px}
.detail{padding:4px 12px 12px 44px;display:flex;flex-direction:column;gap:8px;background:var(--sp-accent-soft)}
.detail .why{font-size:13px;margin:0}
.detail .acts{display:flex;gap:6px;flex-wrap:wrap}
.accept{display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid var(--sp-line);border-radius:var(--sp-r);background:var(--sp-surface)}
.accept .acts{justify-content:flex-end}
.form{border-bottom:1px solid var(--sp-line);display:flex;flex-direction:column;background:var(--sp-surface)}
.form .fhd{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--sp-line)}
.form .fbd{padding:12px;display:flex;flex-direction:column;gap:10px}
.form .fft{display:flex;gap:6px;padding:8px 12px;border-top:1px solid var(--sp-line);background:var(--sp-ground);align-items:center}
.kv{display:grid;grid-template-columns:max-content 1fr;gap:4px 12px;font-size:13px;margin:0}
.kv dt{color:var(--sp-ink-3)}.kv dd{margin:0;overflow-wrap:anywhere}
.tchips{display:flex;flex-wrap:wrap;gap:6px}
.tchip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--sp-line-strong);border-radius:999px;background:var(--sp-surface);color:var(--sp-ink-2);font-size:12px;font-weight:500;cursor:pointer}
.tchip[aria-pressed=true]{background:var(--sp-ink);border-color:var(--sp-ink);color:var(--sp-cell)}
.field{display:flex;flex-direction:column;gap:4px}
.field>span{font-size:12px;font-weight:500;color:var(--sp-ink-2)}
.ex{padding:10px;border-radius:var(--sp-r);background:var(--sp-ground);border:1px dashed var(--sp-line-strong);font-size:12px;color:var(--sp-ink-2);display:flex;flex-direction:column;gap:4px}
.hd .seg>button{height:24px;padding:0 8px;font-size:12px}
.hd .seg .lc{font-variant-numeric:tabular-nums;color:var(--sp-ink-3)}
.notice{margin:8px 12px 0;padding:8px 10px;border-radius:var(--sp-r);background:var(--sp-warn-soft);border:1px solid var(--sp-warn);font-size:12px}
${DETAIL_CSS}
.summary{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid var(--sp-line);font-size:12px;color:var(--sp-ink-2)}
.summary b{color:var(--sp-ink);font-weight:600}.summary .p{color:var(--sp-pass)}.summary .sk{color:var(--sp-ink-3)}
.sumtext{display:inline-flex;gap:8px;flex-wrap:wrap}
.sw{margin-left:auto;display:inline-flex;align-items:center;gap:6px;border:0;background:none;padding:2px 0;color:var(--sp-ink-2);font:inherit;font-size:12px;cursor:pointer}
.sw .tg{width:26px;height:15px;border-radius:8px;background:var(--sp-line-strong);position:relative;flex:none}
.sw .tg::after{content:"";position:absolute;left:2px;top:2px;width:11px;height:11px;border-radius:50%;background:var(--sp-surface)}
.sw[aria-checked=true] .tg{background:var(--sp-ink)}.sw[aria-checked=true] .tg::after{left:13px}
.rg{font-weight:700;min-width:22px;line-height:20px;text-align:center;flex:none}.rg.pass{color:var(--sp-pass)}.rg.skipped{color:var(--sp-skip)}
.rgrp .grow{display:flex;align-items:center}.rgrp .grow .issue{flex:1;min-width:0}
.lnk{flex:none;margin-right:8px;color:var(--sp-accent-ink)}
.cells{overflow:auto;border-top:1px solid var(--sp-line);background:var(--sp-ground)}
.cells .vsp{position:relative}
.cellrow{position:absolute;left:0;right:0;height:28px;display:flex;align-items:center;gap:8px;padding:0 12px 0 44px;border:0;background:none;color:var(--sp-ink);font:inherit;font-size:12px;text-align:left;cursor:pointer;white-space:nowrap;overflow:hidden}
.cellrow:hover{background:var(--sp-surface)}.cellrow .m{color:var(--sp-ink-3);overflow:hidden;text-overflow:ellipsis}
.edbar{display:flex;align-items:center;gap:8px;padding:6px 12px;border-bottom:1px solid var(--sp-line);font-size:12px;color:var(--sp-ink-2)}
.edbar .spacer{flex:1}
.ek{min-width:22px;line-height:20px;text-align:center;flex:none;color:var(--sp-ink-3)}
.fx{display:flex;flex-wrap:wrap;gap:4px 10px;padding:0 12px 8px 44px;font-size:12px}
.fxl{border:0;background:none;padding:0;font:inherit;font-size:12px;color:var(--sp-ink-2);cursor:pointer;text-align:left}
button.fxl{text-decoration:underline;text-underline-offset:2px}button.fxl:hover{color:var(--sp-ink)}
.fxl .g-cleared{color:var(--sp-pass)}.fxl .g-raised{color:var(--sp-fail)}
.more{margin:8px 12px}
`;
/** The Edits view (W-64) draws this many rows, then *Show more* another page. */
const EDITS_PAGE = 100;
/** A result group's cell rows (W-50): 28 px each, drawn only where its box scrolls to. */
const CELL_ROW = 28, CELLS_MAX = 280;

const sevOrder: Record<Severity, number> = SEVERITY_ORDER;
const errNum = (e: SheetpaneError) => Number(/(\d+)$/.exec(e.id)?.[1] ?? 0);

type Filter = 'all' | Severity;
/** The list's view: the problems, one kind of result, grouped (W-50), or the pane's edits (W-64). */
type View = 'problems' | ResultSeverity | 'edits';
/** A result group: one check (passes) or one reason (not checked), with its entries. */
interface Group { key: string; label: string; sev: ResultSeverity; entries: SheetpaneError[]; cells: number; where: string }
type AuthorFilter = 'all' | 'person' | 'workbook' | 'host' | 'file';

/**
 * `<sheetpane-errors>` — the error list and the Flag issue form, on the same in-memory
 * workbook as `<sheetpane-excel>` (SR-ERRORS). It keeps no private copy: every render reads
 * the pane's store, so the two are always in step (SR-LAW-7). It registers on import.
 *
 * Attributes:
 * - `pane` — the pane id shared with the sheet; none gives the element its own store.
 * - `readonly` — hides the form, Resolve, Accept…, Delete, Undo and Redo (a sign-off screen).
 * - `author` — written into the errors this element's user adds, and as who accepted one (W-69).
 * - `plugins` — space-separated registered plugin ids; fixed per pane.
 * - `theme` — `light` (the default), `dark` or `auto`.
 * - `results` — `summary` (the default), `marks` or `off`: how `pass` and `skipped` results show, pane-wide (W-50).
 * - `layers` — space-separated review layers to show (W-51); none shows every layer. Shared by the pane's elements; with two or more layers the header shows a switch.
 *
 * Properties: `workbook`, `errors`, `errorTypes`, `readOnly`, `theme`, `results`, `renderDetail`, `layers`, `layerNames`.
 *
 * Methods: `getErrors({ layer? })`, `setErrors(list | envelope, { plugins?, layer? })`, `renderNow()`.
 *
 * Every event bubbles and is composed; an action's event fires once, on the element where it
 * happened.
 *
 * @fires sheetpane-errors `{ v, errors, plugins, layers, changed }` when the pane's errors change — the envelope to save a review (`v: 2`, W-51); `changed` names the layers whose errors changed.
 * @fires sheetpane-layers `{ visible, layers }` when the visible review layers change — the switch or the `layers` attribute (W-51).
 * @fires sheetpane-change `{ sheet, ref, kind, was, now }` when a cell changes from here ("Also change the cell", undo, redo).
 * @fires sheetpane-select `{ sheet, ref }` when picking a row selects its cell.
 * @fires sheetpane-history `{ reason, canUndo, canRedo }` on undo, redo, or the stack cleared by `setErrors()`.
 * @fires sheetpane-reveal `{ error }` on Show in sheet, so the host can switch tab or open the pop-up — for a whole-sheet error too (its tab is opened); never for a workbook-level one (W-55); for a result group's Show ▸, its first entry (W-50).
 *
 * Views (W-50, W-64): *Problems* (the default); *✓ Passed* and *— Not checked* while the pane holds results; *Edits n* —
 * every change in the pane, newest first, each with its place, kind, was → now, time, the errors it cleared or raised,
 * and its own Revert — in Edit mode, and in View mode while there are edits.
 *
 * @csspart root - The panel's frame: the header, the form, the filters and the list.
 * @csspart detail - The host's region in an open row, after the message: what `renderDetail` returns (W-68).
 *
 * @example
 * ```ts
 * import '@sheetpane/grid';
 * const list = document.createElement('sheetpane-errors');
 * list.setAttribute('pane', 'q3');
 * list.setAttribute('author', 'reviewer@example.com');
 * document.body.append(list);
 * list.addEventListener('sheetpane-errors', (e) => localStorage.setItem('review', JSON.stringify((e as CustomEvent).detail)));
 * const saved = JSON.parse(localStorage.getItem('review') ?? 'null');
 * if (saved) list.setErrors(saved); // the envelope: every layer, and the plugins notice
 * list.setErrors(pdfFindings, { layer: 'pdf' }); // one layer replaced; the others kept
 * list.layerNames = { pdf: 'PDF check' };
 * ```
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0106_ERRORS.md
 * @see https://github.com/arpitarya/sheetpane/blob/main/packages/grid/README.md#sheetpane-errors
 */
export class SheetpaneErrors extends ElementBase {
  /** The attributes the element reacts to. */
  static observedAttributes = ['pane', 'readonly', 'author', 'plugins', 'results', 'layers'];

  private _store: WorkbookStore | undefined;
  private _explicitStore: WorkbookStore | undefined;
  private _paneId: string | undefined;
  private _errorTypes: readonly ErrorType[] = DEFAULT_ERROR_TYPES;
  private unsub: (() => void)[] = [];
  private shadow!: ShadowRoot;
  private raf = 0;
  private filter: Filter = 'all';
  private authorFilter: AuthorFilter = 'all';
  private expanded: string | undefined;
  private draft = { type: DEFAULT_ERROR_TYPES[0]!.id, message: '', expected: '', severity: DEFAULT_ERROR_TYPES[0]!.severity as Severity, change: false };
  private formKey = '';
  private savedPlugins: string[] | undefined;
  private detailRegion = new DetailRegion();
  /** W-69: the Accepted chip is on (only accepted errors listed); the error whose Accept form is open, and its reason so far. */
  private showAccepted = false;
  /** W-51: the switch's button to focus after a re-draw (`''` is All). */
  private focusLayer = '';
  private accepting: string | undefined;
  private reasonDraft = '';
  private focusNext: 'reason' | 'accept' | 'chip' | 'layer' | undefined;
  private _layerNames: Readonly<Record<string, string>> = {};
  private view: View = 'problems';
  private openGroups = new Set<string>();
  private groupEntries = new Map<string, SheetpaneError[]>();
  /** A control to focus again once the list is redrawn (a group toggled). */
  private refocus: string | undefined;
  /** W-64: how many edits the Edits view draws; the Edits chip to focus once the last row is reverted. */
  private editsLimit = EDITS_PAGE;
  private focusEditsChip = false;

  // ── properties ───────────────────────────────────────────────────────────
  /** The pane's store; assigning one replaces the `pane` lookup. */
  get workbook(): WorkbookStore | undefined { return this._store; }
  set workbook(s: WorkbookStore | undefined) { this._explicitStore = s; if (this.isConnected) { this.unbind(); this.bind(); this.applyLayers(); this.schedule(); } }
  /** A copy of the pane's errors; assigning restores a saved review, like `setErrors()`. */
  get errors(): SheetpaneError[] { return this._store?.getErrors() ?? []; }
  set errors(list: SheetpaneError[]) { this.setErrors(list); }
  /** The types offered in the form; an empty list falls back to `DEFAULT_ERROR_TYPES`. */
  get errorTypes(): readonly ErrorType[] { return this._errorTypes; }
  set errorTypes(t: readonly ErrorType[]) { this._errorTypes = t.length ? t : DEFAULT_ERROR_TYPES; this.formKey = ''; this.schedule(); }
  /** Whether the list is read-only (the `readonly` attribute). */
  get readOnly(): boolean { return this.hasAttribute('readonly'); }
  set readOnly(v: boolean) { this.toggleAttribute('readonly', v); }
  /** `light` (the default), `dark` or `auto` — the same tokens as the sheet (W-29). */
  get theme(): Theme { const t = this.getAttribute('theme'); return t === 'dark' || t === 'auto' ? t : 'light'; }
  set theme(t: Theme) { this.setAttribute('theme', t); }
  /**
   * The host's extra detail for an error (W-68): called with a copy of the error when its row is opened, and drawn after
   * the message in a `part="detail"` region. A string is text, never HTML; a Node is the host's own. Called again only when
   * the error changes (its `meta` included) or this is replaced; a throw is logged as SP-3017. Set it on each element
   * that should show it — the sheet's error card has its own.
   */
  get renderDetail(): RenderDetail | undefined { return this.detailRegion.render; }
  set renderDetail(f: RenderDetail | undefined) { this.detailRegion.render = f; this.schedule(); }
  /** The pane's results level (W-50): `summary` (the default), `marks` or `off`; setting it sets the `results` attribute. */
  get results(): ResultsLevel { return this._store?.results ?? resultsLevelOf(this.getAttribute('results')); }
  set results(v: ResultsLevel) { this.setAttribute('results', v); }

  /**
   * The review layers shown (W-51) — the pane's, shared with `<sheetpane-excel>`: every layer until the `layers`
   * attribute or the switch names some. Setting it sets the attribute; `null` or `[]` shows every layer.
   */
  get layers(): string[] { return [...(this._store?.getSnapshot().visibleLayers ?? layersAttr(this.getAttribute('layers')) ?? [])]; }
  set layers(v: readonly string[] | null) { if (v && v.length) this.setAttribute('layers', v.join(' ')); else this.removeAttribute('layers'); this._store?.setVisibleLayers(v, this); }
  /** What the switch and the rows call each layer (W-51), e.g. `{ pdf: 'PDF check' }`; a layer not named here shows its name (`review` as *Review*). */
  get layerNames(): Readonly<Record<string, string>> { return this._layerNames; }
  set layerNames(m: Readonly<Record<string, string>>) { this._layerNames = { ...(m ?? {}) }; this.schedule(); }

  /** A copy of the pane's errors, to save a review; `{ layer }` gives one layer's (W-51). */
  getErrors(o: { layer?: string } = {}): SheetpaneError[] { return this._store?.getErrors(o) ?? []; }
  /**
   * Restores a saved review — a list, or the `sheetpane-errors` envelope with its layers — or, with `layer`, replaces that
   * layer only (W-51). `plugins` (from the saved envelope; read from it when it is passed whole) shows a notice when it
   * differs from this pane's set.
   */
  setErrors(list: SheetpaneError[] | ErrorsEnvelope, o: { plugins?: string[]; layer?: string } = {}): void {
    if (o.layer === undefined) this.savedPlugins = o.plugins ?? (Array.isArray(list) ? undefined : list.plugins);
    this.ensureStore().setErrors(list, o.layer === undefined ? {} : { layer: o.layer }, this);
  }
  private layerName(l: string): string { return this._layerNames[l] ?? (l === DEFAULT_LAYER ? 'Review' : l); }
  /** The `layers` attribute, given to the store (connect, a new store). */
  private applyLayers(): void { if (this.hasAttribute('layers')) this._store?.setVisibleLayers(layersAttr(this.getAttribute('layers')), this); }

  /** Builds the shadow root once and binds to the pane's store. */
  connectedCallback(): void {
    if (!this.shadow) {
      this.shadow = this.attachShadow({ mode: 'open' });
      this.shadow.innerHTML = `<style>${CSS}</style><div class="spe" part="root"><div class="hd"><span class="t">Errors</span><span class="chip opencount"></span><span class="layerbox"></span><span class="spacer" style="flex:1"></span><button type="button" class="btn btn-g btn-i" data-act="undo" aria-label="Undo (Ctrl+Z)" title="Undo">${ICON.undo}</button><button type="button" class="btn btn-g btn-i" data-act="redo" aria-label="Redo (Ctrl+Shift+Z)" title="Redo">${ICON.redo}</button></div><div class="summary" hidden><span class="sumtext"></span><button type="button" class="sw" role="switch" aria-checked="false" data-act="onsheet"><span class="tg" aria-hidden="true"></span>On sheet</button></div><div class="scrollarea"><div class="noticebox"></div><div class="formbox"></div><div class="filters" role="toolbar" aria-label="Filter errors"></div><div class="edbar" hidden></div><div class="list" role="list"></div></div></div>`;
      this.shadow.addEventListener('click', (e) => this.onClick(e));
      this.shadow.addEventListener('input', (e) => this.onInput(e));
      this.shadow.addEventListener('change', (e) => this.onInput(e));
      this.shadow.addEventListener('keydown', (e) => this.onKey(e as KeyboardEvent));
      // a result group's cells scroll in their own box: draw the rows it shows (scroll does not bubble — capture)
      this.shadow.addEventListener('scroll', (e) => { const t = e.target as HTMLElement; if (t.classList?.contains('cells')) this.fillCells(t); }, true);
    }
    this.bind();
    this.applyLayers();
    this.schedule();
  }
  /** Releases the pane's store. */
  disconnectedCallback(): void { this.unbind(); cancelAnimationFrame(this.raf); }
  /** Reacts to an observed attribute. */
  attributeChangedCallback(name: string, old: string | null, val: string | null): void {
    if (!this.isConnected || old === val) return;
    if (name === 'pane' || name === 'plugins') { this.unbind(); this.bind(); this.applyLayers(); }
    else if (name === 'results' && val !== null) this._store?.setResults(resultsLevelOf(val));
    else if (name === 'layers') this._store?.setVisibleLayers(layersAttr(val), this);
    this.schedule();
  }

  private ensureStore(): WorkbookStore { if (!this._store) this.bind(); return this._store!; }
  private bind(): void {
    if (this._store) return;
    const pane = this.getAttribute('pane');
    const plugins = (this.getAttribute('plugins') ?? '').split(/\s+/).filter(Boolean);
    if (this._explicitStore) this._store = this._explicitStore;
    else if (pane) { this._store = acquirePane(pane, this, plugins); this._paneId = pane; }
    else this._store = createWorkbook({ plugins: pluginsFromIds(plugins) });
    const s = this._store;
    attach(s, this);
    if (this.hasAttribute('results')) s.setResults(resultsLevelOf(this.getAttribute('results')));
    const detachView = s.attachErrorsView();
    this.unsub.push(s.subscribe(() => this.schedule()), s.on((e) => this.onStoreEvent(e)), () => detach(s, this), detachView);
  }
  private unbind(): void {
    for (const u of this.unsub) u();
    this.unsub = [];
    if (this._paneId) releasePane(this._paneId, this);
    this._paneId = undefined;
    this._store = undefined;
  }

  private onStoreEvent(e: StoreEvent): void {
    const mine = e.origin === this || (e.origin === undefined && isPrimary(this._store!, this));
    if (!mine) return;
    const s = this._store!;
    if (e.type === 'errors') fire(this, 'sheetpane-errors', s.envelope(e.layers));
    else if (e.type === 'layers') fire(this, 'sheetpane-layers', { visible: [...s.getSnapshot().visibleLayers], layers: [...s.getSnapshot().layers] });
    else if (e.type === 'change') fire(this, 'sheetpane-change', { sheet: e.sheet, ref: e.ref, kind: e.kind, was: e.was, now: e.now });
    else if (e.type === 'select') fire(this, 'sheetpane-select', { sheet: e.sheet, ref: e.ref });
    else if (e.type === 'history') fire(this, 'sheetpane-history', { reason: e.reason, canUndo: s.getSnapshot().canUndo, canRedo: s.getSnapshot().canRedo });
  }

  private schedule(): void {
    if (this.raf || !this.shadow) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); });
  }
  /** Renders now (tests and the first frame). */
  renderNow(): void { cancelAnimationFrame(this.raf); this.raf = 0; this.render(); }

  // ── interactions ─────────────────────────────────────────────────────────
  private onClick(e: Event): void {
    if (inDetail(e.target)) return; // the host's region: its clicks are the host's (W-68)
    const t = e.target as HTMLElement, s = this._store!;
    const el = t.closest<HTMLElement>('[data-act]');
    if (!el) return;
    const id = el.closest<HTMLElement>('[data-id]')?.dataset.id;
    const err = id ? s.getSnapshot().errors.find((x) => x.id === id) : undefined;
    switch (el.dataset.act) {
      case 'filter': this.filter = el.dataset.v as Filter; this.schedule(); break;
      case 'author': this.authorFilter = el.dataset.v as AuthorFilter; this.schedule(); break;
      case 'status': this.showAccepted = !this.showAccepted; this.schedule(); break;
      case 'view': this.view = el.dataset.v as View; this.schedule(); break;
      case 'onsheet': s.setResults(s.results === 'marks' ? 'summary' : 'marks'); break;
      case 'group': {
        const g = el.closest<HTMLElement>('[data-g]')!.dataset.g!;
        if (!this.openGroups.delete(g)) this.openGroups.add(g);
        this.refocus = `[data-g="${globalThis.CSS.escape(g)}"] [data-act=group]`;
        this.schedule();
        break;
      }
      case 'show-group': this.showGroup(el.closest<HTMLElement>('[data-g]')!.dataset.g!); break;
      case 'layer': { // W-51: one layer, or every layer
        const v = el.dataset.v;
        if (s.setVisibleLayers(v ? [v] : null, this)) { this.expanded = undefined; this.focusNext = 'layer'; this.focusLayer = v ?? ''; }
        break;
      }
      case 'edit-pick': this.showEdit(el.closest<HTMLElement>('[data-k]')!.dataset.k!); break;
      case 'revert-edit': this.revertEdit(el.closest<HTMLElement>('[data-k]')!.dataset.k!); break;
      case 'revert-all': if (!this.readOnly && s.revertEdits(undefined, this)) this.focusEditsChip = true; break;
      case 'edits-more': this.editsLimit += EDITS_PAGE; this.refocus = `.item.edit:nth-child(${this.editsLimit - EDITS_PAGE + 1}) [data-act=edit-pick]`; this.schedule(); break;
      case 'goto-error': // an edit's cleared or raised error: shown in the Problems view, opened (W-64)
        if (!err) return;
        this.view = 'problems'; this.filter = 'all'; this.authorFilter = 'all'; this.showAccepted = err.status === 'accepted';
        this.expanded = err.id;
        this.showPlace(err);
        this.refocus = `[data-id="${globalThis.CSS.escape(err.id)}"] .issue`;
        this.schedule();
        break;
      case 'pick':
        if (!err) return;
        this.expanded = this.expanded === err.id ? undefined : err.id;
        this.showPlace(err);
        this.schedule();
        break;
      case 'reveal':
        if (!err || errorScope(err) === 'workbook') return; // a workbook-level error has no sheet to show (W-55)
        this.showPlace(err);
        if (isResult(err)) s.focusResults(err.sheet, err.range); // a result shown from its group is marked, even at `summary` (W-50)
        fire(this, 'sheetpane-reveal', { error: { ...err } });
        break;
      case 'resolve': if (err && !this.readOnly) s.updateError(err.id, { status: err.status === 'open' ? 'resolved' : 'open' }, this); break; // Reopen also takes back an acceptance (W-69)
      case 'accept': // W-69: the reason form, in the open row
        if (!err || err.status !== 'open' || this.readOnly || machineAuthored(err.author)) return;
        this.accepting = this.accepting === err.id ? undefined : err.id;
        this.reasonDraft = '';
        this.focusNext = this.accepting ? 'reason' : undefined;
        this.schedule();
        break;
      case 'accept-cancel': this.closeAccept(); break;
      case 'accept-ok': this.acceptNow(); break;
      case 'delete': if (err && !this.readOnly) { s.deleteError(err.id, this); if (this.expanded === err.id) this.expanded = undefined; } break;
      case 'type': {
        const ty = this._errorTypes.find((x) => x.id === el.dataset.v);
        if (ty) { this.draft.type = ty.id; this.draft.severity = ty.severity; this.formKey = ''; this.schedule(); }
        break;
      }
      case 'sev': this.draft.severity = el.dataset.v as Severity; this.formKey = ''; this.schedule(); break;
      case 'add': this.add(); break;
      case 'undo': s.undo(this); break;
      case 'redo': s.redo(this); break;
      case 'cancel': s.compose(null); break;
    }
  }

  private onInput(e: Event): void {
    if (inDetail(e.target)) return;
    const t = e.target as HTMLInputElement, f = t.dataset.field;
    if (f === 'message') this.draft.message = t.value;
    else if (f === 'expected') this.draft.expected = t.value;
    else if (f === 'change') this.draft.change = t.checked;
    else if (f === 'reason') { this.reasonDraft = t.value; const ok = this.shadow.querySelector<HTMLButtonElement>('[data-act=accept-ok]'); if (ok) ok.disabled = !t.value.trim(); }
  }

  private onKey(e: KeyboardEvent): void {
    if (inDetail(e.composedPath()[0] ?? null)) return; // the host's keys in its region (W-68)
    const typing = (e.composedPath()[0] as HTMLElement | undefined)?.matches?.('input, textarea');
    if (this.accepting && (e.composedPath()[0] as HTMLElement | undefined)?.dataset?.field === 'reason') { // W-69: the reason form
      if (e.key === 'Escape') { e.preventDefault(); this.closeAccept(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); this.acceptNow(); return; }
    }
    const at = e.composedPath()[0] as HTMLElement | undefined;
    if (at?.dataset?.act === 'edit-pick' && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) { // W-64: the Edits list moves by row
      const rows = Array.from(this.shadow.querySelectorAll<HTMLElement>('.list [data-act=edit-pick]')), i = rows.indexOf(at);
      const to = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : i + (e.key === 'ArrowDown' ? 1 : -1);
      if (rows[to]) { e.preventDefault(); rows[to]!.focus(); }
      return;
    }
    if (!typing && (e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) this._store!.redo(this); else this._store!.undo(this); return; }
    if (!typing && e.ctrlKey && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); this._store!.redo(this); return; }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && this.shadow.querySelector('.form')) { e.preventDefault(); this.add(); }
    if (e.key === 'Escape' && this.shadow.querySelector('.form')) { e.preventDefault(); this._store!.compose(null); }
  }

  /** Selects an error's cell; a sheet-level error opens its tab (W-55), keeping the selection when it is already there; a workbook-level one has no place. */
  private showPlace(err: SheetpaneError): void {
    const s = this._store!, scope = errorScope(err);
    if (scope === 'cell') { const r = parseRange(err.range); if (r) s.select({ sheet: err.sheet, ref: cellRef(r.top, r.left) }, this); }
    else if (scope === 'sheet' && s.getSnapshot().selection.sheet !== err.sheet && s.sheet(err.sheet)) s.select({ sheet: err.sheet, ref: 'A1' }, this); // as a tab click does
  }

  /** Selects an edit's cell or range (W-64); an edit about a whole sheet opens its tab, keeping the selection when it is already there. */
  private showEdit(k: string): void {
    const s = this._store!, { sheet, ref } = splitKey(k), r = parseRange(editRef(ref));
    if (r) { const range = rangeRef(r), at = cellRef(r.top, r.left); s.select(range === at ? { sheet, ref: at } : { sheet, ref: at, range }, this); }
    else if (s.getSnapshot().selection.sheet !== sheet && s.sheet(sheet)) s.select({ sheet, ref: 'A1' }, this);
  }

  /** Reverts one edit (W-64) — itself one undo step. Focus moves to the next row's Revert, else the previous one's, else the Edits chip. */
  private revertEdit(k: string): void {
    if (this.readOnly) return;
    const keys = Array.from(this.shadow.querySelectorAll<HTMLElement>('.list [data-k]')).map((x) => x.dataset.k!), i = keys.indexOf(k);
    if (!this._store!.revertEdits([k], this)) return;
    const next = keys[i + 1] ?? keys[i - 1];
    if (next) this.refocus = `[data-k="${globalThis.CSS.escape(next)}"] [data-act=revert-edit]`;
    else this.focusEditsChip = true;
  }

  /** Closes the reason form; focus goes back to Accept…. */
  private closeAccept(): void { this.accepting = undefined; this.reasonDraft = ''; this.focusNext = 'accept'; this.schedule(); }

  /** Accepts the error whose form is open (W-69): only with a reason; who is this element's `author`. The row moves under the Accepted chip, which takes focus. */
  private acceptNow(): void {
    const id = this.accepting;
    if (!id || this.readOnly || !this.reasonDraft.trim()) return;
    if (!this._store!.acceptError(id, this.reasonDraft, { by: this.getAttribute('author') ?? '' }, this)) return;
    this.accepting = undefined; this.reasonDraft = ''; this.focusNext = 'chip';
    this.schedule();
  }

  private add(): void {
    const s = this._store!, c = s.getSnapshot().composing;
    if (!c || this.readOnly) return;
    let range = c.range ?? c.ref;
    if (this.draft.type === 'duplicate-row') {
      const p = parseRef(c.ref)!, sh = s.sheet(c.sheet);
      const width = Math.max(1, ...(sh?.rows.map((r) => r.length) ?? [1]));
      range = `${cellRef(p.row, 0)}:${cellRef(p.row, width - 1)}`;
    }
    s.addError({ sheet: c.sheet, range, type: this.draft.type, severity: this.draft.severity, expected: this.draft.expected, message: this.draft.message, cellChanged: this.draft.change, author: this.getAttribute('author') ?? '' }, this);
    const t = this._errorTypes[0]!;
    this.draft = { type: t.id, message: '', expected: '', severity: t.severity, change: false };
    this.formKey = '';
  }

  /** Show ▸ (W-50): selects the group's range on its first sheet and marks that range's results, even at `summary`. */
  private showGroup(key: string): void {
    const s = this._store!, entries = this.groupEntries.get(key);
    if (!entries?.length) return;
    const sheet = entries[0]!.sheet, box = boxOf(entries.filter((e) => e.sheet === sheet));
    if (!box) return;
    const range = rangeRef(box), ref = cellRef(box.top, box.left);
    s.select(range === ref ? { sheet, ref } : { sheet, ref, range }, this);
    s.focusResults(sheet, range);
    fire(this, 'sheetpane-reveal', { error: { ...entries[0]! } });
  }

  // ── rendering ────────────────────────────────────────────────────────────
  private authorKind(e: SheetpaneError): AuthorFilter { return e.author === 'workbook' ? 'workbook' : e.author === 'host' ? 'host' : e.author === 'file' ? 'file' : 'person'; }

  private render(): void {
    const s = this._store;
    if (!s || !this.shadow) return;
    const snap = s.getSnapshot();
    const q = (sel: string) => this.shadow.querySelector(sel) as HTMLElement;
    // counts that ask for action count problems only; results are counted apart (W-50)
    // W-51: what the visible layers hold — the sheet draws the same
    const errors = snap.visibleErrors.filter((e) => !isResult(e));
    const open = errors.filter((e) => e.status === 'open');
    q('.opencount').textContent = `${open.length} open`;
    const rc = s.resultCounts(), hasResults = s.results !== 'off' && rc.pass + rc.skipped > 0;
    // W-64: the Edits view — in Edit mode, and in View mode while the pane holds edits
    const editCount = snap.changes.size, hasEdits = editCount > 0 || snap.mode === 'edit';
    if ((this.view === 'pass' && !(hasResults && rc.pass)) || (this.view === 'skipped' && !(hasResults && rc.skipped)) || (this.view === 'edits' && !hasEdits)) this.view = 'problems';
    q('.summary').hidden = !hasResults;
    if (hasResults) {
      const sum = `<span><b>${rc.open}</b> problem${rc.open === 1 ? '' : 's'}</span><span class="p">✓ ${rc.pass} passed</span><span class="sk">— ${rc.skipped} not checked</span>`;
      const st = q('.sumtext');
      if (st.dataset.html !== sum) { st.innerHTML = sum; st.dataset.html = sum; }
      q('.sw').setAttribute('aria-checked', String(s.results === 'marks'));
    }
    // W-51: the layers switch, with two or more layers — All, then each layer with its open count
    const multi = snap.layers.length > 1;
    const allOn = snap.visibleLayers.length === snap.layers.length;
    const lb = q('.layerbox');
    const layersHtml = multi ? `<div class="seg" role="group" aria-label="Review layers"><button type="button" data-act="layer" data-v="" aria-pressed="${allOn}">All</button>${snap.layers.map((l) => `<button type="button" data-act="layer" data-v="${esc(l)}" data-sp-layer="${esc(l)}" aria-pressed="${snap.visibleLayers.includes(l)}">${esc(this.layerName(l))} <span class="lc">${snap.errors.filter((e) => e.status === 'open' && !isResult(e) && layerOf(e) === l).length}</span></button>`).join('')}</div>` : '';
    if (lb.dataset.html !== layersHtml) { lb.innerHTML = layersHtml; lb.dataset.html = layersHtml; }
    if (this.focusNext === 'layer') { [...lb.querySelectorAll<HTMLElement>('[data-act=layer]')].find((b) => b.dataset.v === this.focusLayer)?.focus(); this.focusNext = undefined; }
    const tagLayer = multi && snap.visibleLayers.length > 1;
    (q('[data-act=undo]') as HTMLButtonElement).disabled = !snap.canUndo || this.readOnly;
    (q('[data-act=redo]') as HTMLButtonElement).disabled = !snap.canRedo || this.readOnly;
    q('[data-act=undo]').hidden = q('[data-act=redo]').hidden = this.readOnly || snap.mode !== 'edit';
    // the saved review was made with a different plugin set (plugins verdict decision 3)
    const differ = this.savedPlugins !== undefined && this.savedPlugins.join(' ') !== s.pluginIds.join(' ');
    q('.noticebox').innerHTML = differ ? `<div class="notice" role="status">This review was saved with ${this.savedPlugins!.length ? esc(this.savedPlugins!.join(', ')) : 'no plugins'}; this pane runs ${s.pluginIds.length ? esc(s.pluginIds.join(', ')) : 'none'} — cells may be formatted differently.</div>` : '';
    // filters: severity, and author once more than people write errors (W-18 DoD 5)
    // W-69: accepted errors are not counted; the Accepted chip lists them instead of the rest
    const accepted = errors.filter((e) => e.status === 'accepted');
    if (!accepted.length) this.showAccepted = false;
    const counted = errors.filter((e) => e.status !== 'accepted');
    const counts = { all: counted.length, error: counted.filter((e) => e.severity === 'error').length, warning: counted.filter((e) => e.severity === 'warning').length, note: counted.filter((e) => e.severity === 'note').length };
    // Problems · Passed · Not checked — the result chips only when results exist; Problems is the default (W-50); then Edits (W-64)
    const views = ([['problems', `Problems ${counts.all}`, `Problems: ${counts.all}`], ['pass', `✓ Passed ${rc.pass}`, `Passed: ${rc.pass} cells`], ['skipped', `— Not checked ${rc.skipped}`, `Not checked: ${rc.skipped} cells`], ['edits', `Edits ${editCount}`, `Edits: ${editCount}`]] as const)
      .filter(([v]) => v === 'problems' || (v === 'edits' ? hasEdits : hasResults && rc[v] > 0));
    const viewBtns = views.length > 1
      ? `${views.map(([v, label, name]) => `<button type="button" data-act="view" data-v="${v}" aria-pressed="${this.view === v}" aria-label="${name}">${label}</button>`).join('')}${this.view === 'problems' ? '<span class="sep" aria-hidden="true"></span>' : ''}`
      : '';
    const authors = new Set(errors.map((e) => this.authorKind(e)));
    const sevBtns = ([['all', `All ${counts.all}`, 'All severities'], ['error', `✕ ${counts.error}`, 'Errors'], ['warning', `! ${counts.warning}`, 'Warnings'], ['note', `i ${counts.note}`, 'Notes']] as const)
      .map(([v, label, name]) => `<button type="button" data-act="filter" data-v="${v}" aria-pressed="${this.filter === v}" aria-label="${name}: ${counts[v]}">${label}</button>`).join('');
    const authorBtns = authors.size > 1 || (authors.size === 1 && !authors.has('person'))
      ? `<span class="sep" aria-hidden="true"></span>${(['all', 'person', 'workbook', 'host', 'file'] as const).filter((a) => a === 'all' || authors.has(a)).map((a) => `<button type="button" data-act="author" data-v="${a}" aria-pressed="${this.authorFilter === a}">${a === 'all' ? 'Anyone' : a === 'person' ? 'People' : a === 'workbook' ? 'Workbook rules' : a === 'host' ? (s.hasRulesDocument ? 'Rules file' : 'Column rules') : 'File comments'}</button>`).join('')}`
      : '';
    const acceptedBtn = accepted.length ? `<span class="sep" aria-hidden="true"></span><button type="button" data-act="status" data-v="accepted" aria-pressed="${this.showAccepted}">Accepted ${accepted.length}</button>` : '';
    // the severity, Accepted and author filters are the Problems view's (W-50)
    const filtersHtml = viewBtns + (this.view === 'problems' ? sevBtns + acceptedBtn + authorBtns : '');
    const fl = q('.filters');
    if (fl.dataset.html !== filtersHtml) { fl.innerHTML = filtersHtml; fl.dataset.html = filtersHtml; }
    // the form (contract decision 4: this element shows it whenever it is connected to the pane)
    const formbox = q('.formbox');
    const c = snap.composing;
    if (c && !this.readOnly && snap.mode === 'edit' && s.flagging) { // flagging="off" (W-33): no New error
      const key = `${c.sheet}!${c.range ?? c.ref}|${this.draft.type}|${this.draft.severity}|${this._errorTypes.length}`;
      if (key !== this.formKey) { this.formKey = key; formbox.innerHTML = this.formHtml(); (formbox.querySelector('textarea') as HTMLElement | null)?.focus(); }
    } else if (formbox.innerHTML) { formbox.innerHTML = ''; this.formKey = ''; }
    // the list
    const list = errors
      .filter((e) => (this.showAccepted ? e.status === 'accepted' : e.status !== 'accepted') && (this.filter === 'all' || e.severity === this.filter) && (this.authorFilter === 'all' || this.authorKind(e) === this.authorFilter))
      .sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || errNum(a) - errNum(b));
    if (this.accepting && !list.some((e) => e.id === this.accepting && e.id === this.expanded && e.status === 'open')) { this.accepting = undefined; this.reasonDraft = ''; }
    // W-55: errors with no cell come first — the Workbook group, then each sheet's whole-sheet errors in sheet order
    const order = (snap.book?.sheets ?? []).map((x) => x.name);
    const rank = (e: SheetpaneError) => { const sc = errorScope(e); return sc === 'workbook' ? 0 : sc === 'sheet' ? 1 : 2; };
    const sheetAt = (n: string) => { const i = order.indexOf(n); return i < 0 ? order.length : i; };
    const scoped = list.some((e) => rank(e) < 2);
    // rule rows are read by sheet (W-33): under the host filter, grouped by the workbook's sheet order
    const grouped = this.authorFilter === 'host' && new Set(list.filter((e) => rank(e) === 2).map((e) => e.sheet)).size > 1;
    list.sort((a, b) => rank(a) - rank(b) || (rank(a) === 1 || grouped ? sheetAt(a.sheet) - sheetAt(b.sheet) : 0)); // stable: open first, by number, within each
    let lastHead = '';
    const types = new Map([...Object.entries(BUILTIN_TYPE_NAMES), ...this._errorTypes.map((t) => [t.id, t.name] as [string, string])]);
    const sel = snap.selection;
    const html = list.length ? list.map((e) => {
      const scope = errorScope(e);
      const title = scope === 'workbook' ? 'Workbook' : scope === 'sheet' ? `${e.sheet} · whole sheet` : grouped ? e.sheet : scoped ? 'Cells' : '';
      const head = title && title !== lastHead ? `<div class="grp" role="presentation">${esc(title)}</div>` : '';
      lastHead = title;
      const place = scope === 'workbook' ? 'workbook' : scope === 'sheet' ? 'whole sheet' : e.range;
      const r = parseRange(e.range);
      const on = this.expanded === e.id || (!!r && e.sheet === sel.sheet && parseRef(sel.ref) && r.top === parseRef(sel.ref)!.row && r.left <= parseRef(sel.ref)!.col && r.right >= parseRef(sel.ref)!.col);
      const tags = [tagLayer ? this.layerName(layerOf(e)) : '', e.cellChanged ? 'cell changed' : '', e.status === 'resolved' ? 'resolved' : e.status === 'accepted' ? 'accepted' : '', e.matchesExpected ? 'matches suggestion' : '', s.isStale(e) ? 'stale' : '', ...hiddenTags(s, e)].filter(Boolean);
      const ro = this.readOnly || machineAuthored(e.author);
      const sv = SEVERITY[e.severity];
      const time = e.createdAt ? new Date(e.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
      const detail = this.expanded === e.id ? `<div class="detail">${e.message ? `<p class="why">${esc(e.message)}</p>` : ''}${this.detailRegion.html()}${acceptedHtml(e)}<span class="xs faint">${esc([e.author === 'workbook' ? 'Workbook rule' : e.author === 'file' ? 'File comment' : e.author === 'host' ? (s.hasRulesDocument ? 'Rules file' : 'Column rule') : e.author, e.code, time].filter(Boolean).join(' · '))}</span><div class="acts">${scope === 'workbook' ? '<button type="button" class="btn" data-act="reveal" disabled aria-describedby="nowhere">Show in sheet</button><span class="xs faint" id="nowhere">About the whole workbook — no sheet to show</span>' : `<button type="button" class="btn" data-act="reveal">Show in sheet</button>`}${ro ? '' : `<button type="button" class="btn" data-act="resolve" data-sp="resolve">${e.status === 'open' ? '✓ Resolve' : 'Reopen'}</button>${e.status === 'open' ? `<button type="button" class="btn" data-act="accept" data-sp="accept-open" aria-expanded="${this.accepting === e.id}">Accept…</button>` : ''}<span class="spacer" style="flex:1"></span><button type="button" class="btn btn-g btn-d" data-act="delete">Delete</button>`}</div>${this.accepting === e.id && !ro ? ACCEPT_FORM : ''}</div>` : '';
      return `${head}<div class="item${e.status === 'resolved' ? ' done' : ''}${on ? ' on' : ''}" role="listitem" data-id="${esc(e.id)}" data-sp-error="${esc(e.id)}" data-sp-ref="${esc(e.sheet)}!${esc(e.range)}"><button type="button" class="issue" data-act="pick" aria-expanded="${this.expanded === e.id}" aria-label="Error ${errNum(e)}: ${esc(types.get(e.type) ?? e.type)}, ${scope === 'workbook' ? 'whole workbook' : `${esc(e.sheet)} ${esc(place)}`}, ${sv.name}${e.status === 'open' ? '' : `, ${e.status}`}"><span class="n ${e.status === 'open' ? e.severity : e.status}" aria-hidden="true">${e.status === 'resolved' ? '✓' : e.status === 'accepted' ? 'A' : errNum(e)}</span><span class="bd"><span class="ty">${esc(types.get(e.type) ?? e.type)}</span>${scope !== 'cell' && !e.found && !e.expected ? '' : `<span class="ba"><span class="found">${esc(scope === 'cell' ? e.found : e.found || '—')}</span> → <span class="want">${esc(e.expected || '—')}</span></span>`}<span class="m">${esc(place)} · <span class="g g-${e.severity}" aria-hidden="true">${sv.glyph}</span> ${sv.name}${tags.length ? ` · ${esc(tags.join(' · '))}` : ''}</span></span></button>${detail}</div>`;
    }).join('') : `<p class="empty">${errors.length ? 'Nothing matches this filter.' : 'Nothing flagged yet. Select a cell in the sheet, then Flag issue.'}</p>`;
    const listEl = q('.list');
    // the Problems view lists the errors (W-55's groups first); Passed and Not checked list grouped results (W-50); Edits the changes (W-64)
    const edits = this.view === 'edits' ? s.edits() : [];
    const canRevert = !this.readOnly && snap.mode === 'edit';
    const edbar = q('.edbar');
    edbar.hidden = this.view !== 'edits' || !edits.length;
    const edbarHtml = edbar.hidden ? '' : `<span>${edits.length} edit${edits.length === 1 ? '' : 's'} · newest first</span><span class="spacer"></span>${canRevert ? '<button type="button" class="btn btn-g" data-act="revert-all" data-sp="revert-all">Revert all</button>' : ''}`;
    if (edbar.dataset.html !== edbarHtml) { edbar.innerHTML = edbarHtml; edbar.dataset.html = edbarHtml; }
    const shown = this.view === 'problems' ? html : this.view === 'edits' ? this.editsHtml(edits, canRevert, types) : this.groupsHtml(snap.visibleErrors, this.view, types);
    const hadReason = this.shadow.activeElement?.matches('[data-field=reason]') ?? false;
    const rebuilt = listEl.dataset.html !== shown;
    if (rebuilt) {
      listEl.innerHTML = shown; listEl.dataset.html = shown;
      if (this.refocus) (listEl.querySelector(this.refocus) as HTMLElement | null)?.focus();
    }
    this.refocus = undefined;
    this.detailRegion.sync(listEl, this.view === 'problems' ? list.find((e) => e.id === this.expanded) : undefined); // the host's region, after the message (W-68)
    // W-69: the reason lives outside the markup, so typing never re-draws the list; focus follows the form
    const reason = listEl.querySelector<HTMLTextAreaElement>('[data-field=reason]');
    if (reason) {
      if (reason.value !== this.reasonDraft) reason.value = this.reasonDraft;
      listEl.querySelector<HTMLButtonElement>('[data-act=accept-ok]')!.disabled = !this.reasonDraft.trim();
      if (this.focusNext === 'reason' || (rebuilt && hadReason)) reason.focus();
    }
    if (this.focusEditsChip) { this.focusEditsChip = false; q('.filters').querySelector<HTMLElement>('[data-act=view][data-v=edits]')?.focus(); }
    if (this.focusNext === 'accept') listEl.querySelector<HTMLElement>('[data-act=accept]')?.focus();
    else if (this.focusNext === 'chip') q('.filters').querySelector<HTMLElement>('[data-act=status]')?.focus();
    this.focusNext = undefined;
    for (const box of Array.from(listEl.querySelectorAll<HTMLElement>('.cells'))) this.fillCells(box);
  }

  /** The Passed or Not checked view (W-50): one row per check (passes, by type + message) or reason (not checked, by message). */
  private groupsHtml(all: readonly SheetpaneError[], sev: ResultSeverity, types: Map<string, string>): string {
    const groups = new Map<string, Group>();
    for (const e of all) {
      if (e.severity !== sev) continue;
      const key = sev === 'pass' ? `${e.type}|${e.message}` : e.message ? `|${e.message}` : `${e.type}|`;
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { key, label: e.message || (types.get(e.type) ?? e.type), sev, entries: [], cells: 0, where: '' }));
      g.entries.push(e);
      const r = parseRange(e.range);
      g.cells += r ? (r.bottom - r.top + 1) * (r.right - r.left + 1) : 1;
    }
    this.groupEntries.clear();
    const list = [...groups.values()].sort((a, b) => b.cells - a.cells || a.label.localeCompare(b.label));
    return list.map((g) => {
      this.groupEntries.set(g.key, g.entries);
      const open = this.openGroups.has(g.key), sv = SEVERITY[sev];
      const n = g.entries.length;
      const cells = open ? `<div class="cells" role="group" aria-label="${esc(g.label)}: ${g.cells} cell${g.cells === 1 ? '' : 's'}" style="height:${Math.min(n * CELL_ROW, CELLS_MAX)}px"><div class="vsp" style="height:${n * CELL_ROW}px"></div></div>` : '';
      return `<div class="item rgrp" role="listitem" data-g="${esc(g.key)}"><div class="grow"><button type="button" class="issue" data-act="group" aria-expanded="${open}"><span class="rg ${sev}" aria-hidden="true">${sv.glyph}</span><span class="bd"><span class="ty"><span class="vh">${sv.name}: </span>${esc(g.label)}</span><span class="m">${g.cells} cell${g.cells === 1 ? '' : 's'} · ${esc(whereOf(g.entries))}</span></span></button><button type="button" class="btn btn-g lnk" data-act="show-group" aria-label="Show ${esc(g.label)} in sheet">Show ▸</button></div>${cells}</div>`;
    }).join('');
  }

  /**
   * The Edits view (W-64): one row per change-map entry, newest first — its place and kind, was → now, the time, and the
   * errors it cleared or raised (each a link to the error in Problems); Revert per row in Edit mode. A page at a time.
   */
  private editsHtml(edits: readonly Edit[], canRevert: boolean, types: Map<string, string>): string {
    if (!edits.length) return '<p class="empty">No edits yet. Each change to the workbook is listed here — what it was, what it is now — with its own Revert.</p>';
    const s = this._store!, snap = s.getSnapshot(), byId = new Map(snap.errors.map((e) => [e.id, e]));
    const shown = new Set(snap.visibleErrors.map((e) => e.id)); // W-51: an error in a hidden layer is named, not linked — Problems would not show it
    const link = (id: string, how: 'cleared' | 'raised' | 'matched') => {
      const e = byId.get(id), word = how === 'cleared' ? 'Cleared' : how === 'raised' ? 'Raised' : 'Matches the suggestion of';
      const glyph = how === 'cleared' ? '✓' : how === 'raised' ? '✕' : '=';
      const what = e ? `error ${errNum(e)}: ${types.get(e.type) ?? e.type}` : id;
      return e && shown.has(id)
        ? `<button type="button" class="fxl" data-act="goto-error" data-id="${esc(id)}"><span class="g-${how}" aria-hidden="true">${glyph}</span> ${word} ${esc(what)}</button>`
        : `<span class="fxl"><span class="g-${how}" aria-hidden="true">${glyph}</span> ${word} ${esc(what)}</span>`;
    };
    const rows = edits.slice(0, this.editsLimit).map((ed) => {
      const place = ed.ref ? `${ed.sheet}!${ed.ref}` : `${ed.sheet} · whole sheet`, kind = kindName(ed);
      const fx = s.editEffects(ed.key);
      const links = [...fx.cleared.map((id) => link(id, 'cleared')), ...fx.raised.map((id) => link(id, 'raised')), ...fx.matched.map((id) => link(id, 'matched'))];
      const time = Date.parse(ed.at) ? new Date(ed.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
      const summary = [fx.cleared.length ? `${fx.cleared.length} cleared` : '', fx.raised.length ? `${fx.raised.length} raised` : ''].filter(Boolean).join(' · ');
      return `<div class="item edit" role="listitem" data-k="${esc(ed.key)}" data-sp-edit="${esc(ed.key)}" data-sp-ref="${esc(ed.sheet)}!${esc(ed.ref)}"><div class="grow"><button type="button" class="issue" data-act="edit-pick"><span class="ek" aria-hidden="true">✎</span><span class="bd"><span class="ty">${esc(place)} · ${esc(kind)}</span><span class="ba"><span class="vh">was </span><span class="found">${esc(editText(s, ed, ed.was))}</span> → <span class="vh">now </span><span class="want">${esc(editText(s, ed, ed.now))}</span></span><span class="m">${time ? `<time datetime="${esc(ed.at)}">${esc(time)}</time>` : ''}${time && summary ? ' · ' : ''}${esc(summary)}</span></span></button>${canRevert ? `<button type="button" class="btn btn-g lnk" data-act="revert-edit" data-sp="revert-edit" aria-label="Revert ${esc(place)}${ed.kind === 'value' ? '' : ` ${esc(kind.toLowerCase())}`}">Revert</button>` : ''}</div>${links.length ? `<div class="fx">${links.join('')}</div>` : ''}</div>`;
    }).join('');
    const rest = edits.length - Math.min(edits.length, this.editsLimit);
    return rows + (rest ? `<div role="listitem"><button type="button" class="btn more" data-act="edits-more">Show ${Math.min(EDITS_PAGE, rest)} more of ${rest}</button></div>` : '');
  }

  /** Draws the cell rows an opened group's box shows, and a few either side — never all of them (W-50, virtualised). */
  private fillCells(box: HTMLElement): void {
    const entries = this.groupEntries.get(box.closest<HTMLElement>('[data-g]')?.dataset.g ?? '') ?? [];
    const top = box.scrollTop, h = box.clientHeight || CELLS_MAX;
    const a = Math.max(0, Math.floor(top / CELL_ROW) - 4), b = Math.min(entries.length, Math.ceil((top + h) / CELL_ROW) + 4);
    let html = '';
    for (let i = a; i < b; i++) {
      const e = entries[i]!, sv = SEVERITY[e.severity];
      html += `<button type="button" class="cellrow" data-act="reveal" data-id="${esc(e.id)}" data-sp-error="${esc(e.id)}" data-sp-ref="${esc(e.sheet)}!${esc(e.range)}" style="top:${i * CELL_ROW}px" title="Show in sheet"><span class="rg ${e.severity}" aria-hidden="true">${sv.glyph}</span><span class="vh">${sv.name}: </span>${esc(e.range)} <span class="m">${esc(e.sheet)}${e.found ? ` · ${esc(e.found)}` : ''}</span></button>`;
    }
    const sp = box.firstElementChild as HTMLElement;
    if (sp.dataset.html !== html) { sp.innerHTML = html; sp.dataset.html = html; }
  }

  private formHtml(): string {
    const s = this._store!, snap = s.getSnapshot(), c = snap.composing!;
    const p = parseRef(c.ref)!;
    const sheet = s.sheet(c.sheet);
    const header = sheet ? headerFor(sheet.text, p.row, p.col) : '';
    const rowFirst = sheet?.text[p.row]?.find((x) => x) ?? '';
    const ex = this._errorTypes.find((t) => t.id === this.draft.type) ?? this._errorTypes[0]!;
    const sevs = (['error', 'warning', 'note'] as Severity[]).map((v) => `<button type="button" data-act="sev" data-v="${v}" aria-pressed="${this.draft.severity === v}"><span class="g g-${v}" aria-hidden="true">${SEVERITY[v].glyph}</span>${SEVERITY[v].name}</button>`).join('');
    return `<div class="form" role="group" aria-label="New error">
<div class="fhd"><span class="t" style="font-weight:600">New error</span><span class="xs faint">${esc(c.sheet)}!${esc(c.range ?? c.ref)}</span><span class="spacer" style="flex:1"></span><button type="button" class="btn btn-g btn-i" data-act="cancel" aria-label="Cancel">${ICON.close}</button></div>
<div class="fbd">
<dl class="kv"><dt>Found</dt><dd><span class="found">${esc(s.foundFor(c.sheet, c.range ?? c.ref))}</span></dd><dt>Column</dt><dd>${esc(header ? `${header} (${colName(p.col)})` : colName(p.col))}</dd><dt>Row</dt><dd>${p.row + 1}${rowFirst ? ` · ${esc(rowFirst)}` : ''}</dd></dl>
<div class="field"><span id="tlbl">What kind of problem?</span><div class="tchips" role="group" aria-labelledby="tlbl">${this._errorTypes.map((t) => `<button type="button" class="tchip" data-act="type" data-v="${esc(t.id)}" aria-pressed="${t.id === this.draft.type}">${esc(t.name)}</button>`).join('')}</div></div>
<label class="field"><span>What’s wrong</span><textarea class="input" rows="2" data-field="message" placeholder="${esc(ex.why)}">${esc(this.draft.message)}</textarea></label>
<label class="field"><span>What it should be</span><input class="input" data-field="expected" placeholder="${esc(ex.expected)}" value="${esc(this.draft.expected)}"></label>
<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" data-field="change"${this.draft.change ? ' checked' : ''}>Also change the cell to this value</label>
<div class="field"><span id="slbl">Severity</span><div class="seg" role="group" aria-labelledby="slbl">${sevs}</div><span class="xs faint">${esc(SEVERITY[this.draft.severity].help)}</span></div>
<div class="ex"><span style="font-weight:600">Example · ${esc(ex.name)}</span><span>What’s wrong: “${esc(ex.why)}”</span>${ex.expected ? `<span>Should be: <span class="want">${esc(ex.expected)}</span></span>` : ''}</div>
</div>
<div class="fft"><span class="xs faint">⌘ ↵</span><span class="spacer" style="flex:1"></span><button type="button" class="btn" data-act="cancel">Cancel</button><button type="button" class="btn btn-p" data-act="add" data-sp="add-error">Add error</button></div></div>`;
  }
}

/** The reason form in an open row (W-69): a reason is required — Accept stays disabled until one is typed. */
const ACCEPT_FORM = `<div class="accept" role="group" aria-label="Accept this deviation"><label class="field"><span>Why is this accepted?</span><textarea class="input" rows="2" data-field="reason" required aria-required="true" aria-describedby="sp-accept-help"></textarea></label><span class="xs faint" id="sp-accept-help">Required. Saved with your name and the time; the error stays in the review and the download, and no longer counts as open.</span><div class="acts"><button type="button" class="btn" data-act="accept-cancel">Cancel</button><button type="button" class="btn btn-p" data-act="accept-ok" data-sp="accept" disabled>Accept</button></div></div>`;

/** The column's header text: the nearest row above with two or more text cells. */
export function headerFor(text: string[][], row: number, col: number): string {
  for (let r = 0; r < Math.min(row, 10); r++) {
    const cells = text[r] ?? [];
    if (cells.filter((x) => x).length >= 2 && cells[col]) return cells[col]!;
  }
  return '';
}

export { sevOrder };

/** The bounding range of entries on one sheet, or undefined when none parses. */
function boxOf(entries: readonly SheetpaneError[]): { top: number; left: number; bottom: number; right: number } | undefined {
  let box: { top: number; left: number; bottom: number; right: number } | undefined;
  for (const e of entries) {
    const r = parseRange(e.range);
    if (!r) continue;
    box = box ? { top: Math.min(box.top, r.top), left: Math.min(box.left, r.left), bottom: Math.max(box.bottom, r.bottom), right: Math.max(box.right, r.right) } : { ...r };
  }
  return box;
}

/** Where a result group sits (W-50): one range when its cells fill it ("H3:H214"), else the first three ("H6, H31, H44 …"). */
function whereOf(entries: readonly SheetpaneError[]): string {
  const sheets = new Set(entries.map((e) => e.sheet));
  if (sheets.size > 1) return `${sheets.size} sheets`;
  const box = boxOf(entries);
  let cells = 0;
  for (const e of entries) { const r = parseRange(e.range); if (r) cells += (r.bottom - r.top + 1) * (r.right - r.left + 1); }
  if (box && cells === (box.bottom - box.top + 1) * (box.right - box.left + 1)) return rangeRef(box);
  return entries.slice(0, 3).map((e) => e.range).join(', ') + (entries.length > 3 ? ' …' : '');
}

/** Where an error sits out of sight: a hidden sheet, row or column (W-49). Selecting it shows it in the sheet. */
function hiddenTags(s: { hidden(sheet: string): { rows: number[]; cols: number[]; state: string } }, e: SheetpaneError): string[] {
  const h = s.hidden(e.sheet), r = parseRange(e.range);
  if (h.state !== 'visible') return ['hidden sheet'];
  if (!r) return [];
  const out: string[] = [];
  if (h.rows.some((i) => i >= r.top && i <= r.bottom)) out.push('hidden row');
  if (h.cols.some((i) => i >= r.left && i <= r.right)) out.push('hidden column');
  return out;
}

/** An edit's kind in words (W-64); a kind this list does not know is named as it is. */
function kindName(e: Edit): string {
  switch (e.kind) {
    case 'value': return 'Value';
    case 'formula': return 'Formula';
    case 'style': return 'Style';
    case 'numFmt': return 'Number format';
    case 'merge': return 'Merge';
    case 'freeze': return 'Freeze panes';
    case 'hidden': return e.key.endsWith('!#hiddenCols') ? 'Hidden columns' : 'Hidden rows';
    case 'sheetState': return 'Sheet visibility';
    case 'outline': return e.key.endsWith('!#outlineCols') ? 'Column groups' : 'Row groups';
    case 'structure': return 'Rows and columns'; // W-52: every insert and delete on the sheet, one row
    default: { const k = String(e.kind); return k ? k[0]!.toUpperCase() + k.slice(1) : 'Change'; }
  }
}

/** One side of an edit as text (W-64): a cell value as the cell shows it, `(blank)` for none; other kinds in a few words. */
function editText(s: WorkbookStore, e: Edit, v: unknown): string {
  if (v === undefined || v === null || v === '') return e.kind === 'value' || e.kind === 'formula' ? '(blank)' : '—';
  if (e.kind === 'structure' && Array.isArray(v)) return v.length ? clip((v as StructureOp[]).map(opText).join(', ')) : 'as read';
  const r = parseRange(e.ref);
  if ((e.kind === 'value' || e.kind === 'formula') && r && (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string')) return s.format(e.sheet, cellRef(r.top, r.left), v);
  if (e.kind === 'merge') return v ? 'merged' : 'not merged';
  if (e.kind === 'freeze' && typeof v === 'object') { const f = v as { rows?: number; cols?: number }; return f.rows || f.cols ? `${f.rows ?? 0} row${f.rows === 1 ? '' : 's'}, ${f.cols ?? 0} column${f.cols === 1 ? '' : 's'}` : 'none'; }
  if (e.kind === 'hidden' && Array.isArray(v)) {
    if (!v.length) return 'none';
    const cols = e.key.endsWith('!#hiddenCols'), names = (v as number[]).slice(0, 6).map((i) => (cols ? colName(i) : String(i + 1)));
    return `${cols ? 'columns' : 'rows'} ${names.join(', ')}${v.length > 6 ? ' …' : ''}`;
  }
  if (e.kind === 'outline' && typeof v === 'object') { const n = Object.keys(v as object).length; return n ? `${n} grouped` : 'none'; }
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  let json: string;
  try { json = JSON.stringify(v); } catch { json = String(v); }
  return clip(json);
}
const clip = (t: string) => (t.length > 60 ? `${t.slice(0, 59)}…` : t);
/** One insert or delete in a few words (W-52): `2 rows inserted at 3`, `column C deleted`. */
function opText(o: StructureOp): string {
  const rows = o.op.endsWith('Rows'), n = o.count, end = o.at + n - 1;
  const where = rows ? (n === 1 ? `row ${o.at + 1}` : `rows ${o.at + 1}–${end + 1}`) : n === 1 ? `column ${colName(o.at)}` : `columns ${colName(o.at)}–${colName(end)}`;
  return o.op.startsWith('insert') ? `${n} ${rows ? 'row' : 'column'}${n === 1 ? '' : 's'} inserted at ${rows ? o.at + 1 : colName(o.at)}` : `${where} deleted`;
}
