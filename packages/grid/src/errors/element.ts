// <sheetpane-errors> — the error component (W-02): the list and the New error
// form, on the same store as <sheetpane-excel> (SR-LAW-7). It keeps no private
// copy of errors or workbook data; no "linked" chip, no export footer.
import { cellRef, colName, parseRange, parseRef } from '@sheetpane/export';
import { pluginsFromIds } from '../plugins/host.js';
import { acquirePane, attach, detach, isPrimary, releasePane } from '../pane/registry.js';
import { createWorkbook, type StoreEvent, type WorkbookStore } from '../pane/store.js';
import { BUILTIN_TYPE_NAMES, DEFAULT_ERROR_TYPES, SEVERITY, machineAuthored, type ErrorType, type SheetpaneError, type Severity } from '../pane/types.js';
import { BASE_CSS } from '../excel/styles.js';
import { ElementBase, ICON, esc, fire } from '../shared/dom.js';

const CSS = `${BASE_CSS}
:host{display:block}
.spe{display:flex;flex-direction:column;height:100%;min-height:240px;background:var(--sp-surface);border:1px solid var(--sp-line);border-radius:var(--sp-r-lg);overflow:hidden}
.hd{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--sp-line);flex-wrap:wrap}
.hd .t{font-weight:600}
.filters{display:flex;gap:4px;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid var(--sp-line)}
.filters button{height:26px;padding:0 10px;border:1px solid var(--sp-line-strong);border-radius:999px;background:var(--sp-surface);color:var(--sp-ink-2);font-size:12px;font-weight:500;cursor:pointer}
.filters button[aria-pressed=true]{background:var(--sp-ink);border-color:var(--sp-ink);color:#fff}
.filters .sep{width:1px;background:var(--sp-line);margin:2px 4px}
.scrollarea{flex:1;min-height:0;overflow:auto}
.empty{padding:24px 16px;color:var(--sp-ink-3);font-size:13px;text-align:center}
.item{border-bottom:1px solid var(--sp-line)}
.issue{display:flex;gap:10px;padding:10px 12px;align-items:flex-start;width:100%;border:0;background:none;text-align:left;cursor:pointer;color:var(--sp-ink);font:inherit}
.issue:hover{background:var(--sp-ground)}
.item.on .issue{background:var(--sp-accent-soft)}
.issue .n{font-size:11px;font-weight:700;min-width:22px;height:20px;border-radius:10px;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums;flex:none}
.n.error{background:var(--sp-fail)}.n.warning{background:var(--sp-warn)}.n.note{background:var(--sp-accent)}.n.resolved{background:var(--sp-pass)}
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
.form{border-bottom:1px solid var(--sp-line);display:flex;flex-direction:column;background:var(--sp-surface)}
.form .fhd{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--sp-line)}
.form .fbd{padding:12px;display:flex;flex-direction:column;gap:10px}
.form .fft{display:flex;gap:6px;padding:8px 12px;border-top:1px solid var(--sp-line);background:var(--sp-ground);align-items:center}
.kv{display:grid;grid-template-columns:max-content 1fr;gap:4px 12px;font-size:13px;margin:0}
.kv dt{color:var(--sp-ink-3)}.kv dd{margin:0;overflow-wrap:anywhere}
.tchips{display:flex;flex-wrap:wrap;gap:6px}
.tchip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--sp-line-strong);border-radius:999px;background:var(--sp-surface);color:var(--sp-ink-2);font-size:12px;font-weight:500;cursor:pointer}
.tchip[aria-pressed=true]{background:var(--sp-ink);border-color:var(--sp-ink);color:#fff}
.field{display:flex;flex-direction:column;gap:4px}
.field>span{font-size:12px;font-weight:500;color:var(--sp-ink-2)}
.ex{padding:10px;border-radius:var(--sp-r);background:var(--sp-ground);border:1px dashed var(--sp-line-strong);font-size:12px;color:var(--sp-ink-2);display:flex;flex-direction:column;gap:4px}
.notice{margin:8px 12px 0;padding:8px 10px;border-radius:var(--sp-r);background:var(--sp-warn-soft);border:1px solid #EAD4A3;font-size:12px}
`;

const sevOrder: Record<Severity, number> = { error: 3, warning: 2, note: 1 };
const errNum = (e: SheetpaneError) => Number(/(\d+)$/.exec(e.id)?.[1] ?? 0);

type Filter = 'all' | Severity;
type AuthorFilter = 'all' | 'person' | 'workbook' | 'file';

export class SheetpaneErrors extends ElementBase {
  static observedAttributes = ['pane', 'readonly', 'author', 'plugins'];

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

  // ── properties ───────────────────────────────────────────────────────────
  get workbook(): WorkbookStore | undefined { return this._store; }
  set workbook(s: WorkbookStore | undefined) { this._explicitStore = s; if (this.isConnected) { this.unbind(); this.bind(); this.schedule(); } }
  get errors(): SheetpaneError[] { return this._store?.getErrors() ?? []; }
  set errors(list: SheetpaneError[]) { this.setErrors(list); }
  get errorTypes(): readonly ErrorType[] { return this._errorTypes; }
  set errorTypes(t: readonly ErrorType[]) { this._errorTypes = t.length ? t : DEFAULT_ERROR_TYPES; this.formKey = ''; this.schedule(); }
  get readOnly(): boolean { return this.hasAttribute('readonly'); }
  set readOnly(v: boolean) { this.toggleAttribute('readonly', v); }

  getErrors(): SheetpaneError[] { return this.errors; }
  /** Restores a saved review. `plugins` (from the saved `sheetpane-errors` envelope) shows a notice when it differs from this pane's set. */
  setErrors(list: SheetpaneError[], o: { plugins?: string[] } = {}): void {
    this.savedPlugins = o.plugins;
    this.ensureStore().setErrors(list, this);
  }

  connectedCallback(): void {
    if (!this.shadow) {
      this.shadow = this.attachShadow({ mode: 'open' });
      this.shadow.innerHTML = `<style>${CSS}</style><div class="spe" part="root"><div class="hd"><span class="t">Errors</span><span class="chip opencount"></span><span class="spacer" style="flex:1"></span><button type="button" class="btn btn-g btn-i" data-act="undo" aria-label="Undo (Ctrl+Z)" title="Undo">${ICON.undo}</button><button type="button" class="btn btn-g btn-i" data-act="redo" aria-label="Redo (Ctrl+Shift+Z)" title="Redo">${ICON.redo}</button></div><div class="scrollarea"><div class="noticebox"></div><div class="formbox"></div><div class="filters" role="toolbar" aria-label="Filter errors"></div><div class="list" role="list"></div></div></div>`;
      this.shadow.addEventListener('click', (e) => this.onClick(e));
      this.shadow.addEventListener('input', (e) => this.onInput(e));
      this.shadow.addEventListener('change', (e) => this.onInput(e));
      this.shadow.addEventListener('keydown', (e) => this.onKey(e as KeyboardEvent));
    }
    this.bind();
    this.schedule();
  }
  disconnectedCallback(): void { this.unbind(); cancelAnimationFrame(this.raf); }
  attributeChangedCallback(name: string, old: string | null, val: string | null): void {
    if (!this.isConnected || old === val) return;
    if (name === 'pane' || name === 'plugins') { this.unbind(); this.bind(); }
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
    if (e.type === 'errors') fire(this, 'sheetpane-errors', { errors: s.getErrors(), plugins: s.pluginIds });
    else if (e.type === 'change') fire(this, 'sheetpane-change', { sheet: e.sheet, ref: e.ref, kind: e.kind, was: e.was, now: e.now });
    else if (e.type === 'select') fire(this, 'sheetpane-select', { sheet: e.sheet, ref: e.ref });
    else if (e.type === 'history') fire(this, 'sheetpane-history', { reason: e.reason, canUndo: s.getSnapshot().canUndo, canRedo: s.getSnapshot().canRedo });
  }

  private schedule(): void {
    if (this.raf || !this.shadow) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); });
  }
  renderNow(): void { cancelAnimationFrame(this.raf); this.raf = 0; this.render(); }

  // ── interactions ─────────────────────────────────────────────────────────
  private onClick(e: Event): void {
    const t = e.target as HTMLElement, s = this._store!;
    const el = t.closest<HTMLElement>('[data-act]');
    if (!el) return;
    const id = el.closest<HTMLElement>('[data-id]')?.dataset.id;
    const err = id ? s.getSnapshot().errors.find((x) => x.id === id) : undefined;
    switch (el.dataset.act) {
      case 'filter': this.filter = el.dataset.v as Filter; this.schedule(); break;
      case 'author': this.authorFilter = el.dataset.v as AuthorFilter; this.schedule(); break;
      case 'pick':
        if (!err) return;
        this.expanded = this.expanded === err.id ? undefined : err.id;
        { const r = parseRange(err.range)!; s.select({ sheet: err.sheet, ref: cellRef(r.top, r.left) }, this); }
        this.schedule();
        break;
      case 'reveal':
        if (!err) return;
        { const r = parseRange(err.range)!; s.select({ sheet: err.sheet, ref: cellRef(r.top, r.left) }, this); }
        fire(this, 'sheetpane-reveal', { error: { ...err } });
        break;
      case 'resolve': if (err && !this.readOnly) s.updateError(err.id, { status: err.status === 'open' ? 'resolved' : 'open' }, this); break;
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
    const t = e.target as HTMLInputElement, f = t.dataset.field;
    if (f === 'message') this.draft.message = t.value;
    else if (f === 'expected') this.draft.expected = t.value;
    else if (f === 'change') this.draft.change = t.checked;
  }

  private onKey(e: KeyboardEvent): void {
    const typing = (e.composedPath()[0] as HTMLElement | undefined)?.matches?.('input, textarea');
    if (!typing && (e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) this._store!.redo(this); else this._store!.undo(this); return; }
    if (!typing && e.ctrlKey && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); this._store!.redo(this); return; }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && this.shadow.querySelector('.form')) { e.preventDefault(); this.add(); }
    if (e.key === 'Escape' && this.shadow.querySelector('.form')) { e.preventDefault(); this._store!.compose(null); }
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

  // ── rendering ────────────────────────────────────────────────────────────
  private authorKind(e: SheetpaneError): AuthorFilter { return e.author === 'workbook' ? 'workbook' : e.author === 'file' ? 'file' : 'person'; }

  private render(): void {
    const s = this._store;
    if (!s || !this.shadow) return;
    const snap = s.getSnapshot();
    const q = (sel: string) => this.shadow.querySelector(sel) as HTMLElement;
    const errors = snap.errors;
    const open = errors.filter((e) => e.status === 'open');
    q('.opencount').textContent = `${open.length} open`;
    (q('[data-act=undo]') as HTMLButtonElement).disabled = !snap.canUndo || this.readOnly;
    (q('[data-act=redo]') as HTMLButtonElement).disabled = !snap.canRedo || this.readOnly;
    q('[data-act=undo]').hidden = q('[data-act=redo]').hidden = this.readOnly || snap.mode !== 'edit';
    // the saved review was made with a different plugin set (plugins verdict decision 3)
    const differ = this.savedPlugins !== undefined && this.savedPlugins.join(' ') !== s.pluginIds.join(' ');
    q('.noticebox').innerHTML = differ ? `<div class="notice" role="status">This review was saved with ${this.savedPlugins!.length ? esc(this.savedPlugins!.join(', ')) : 'no plugins'}; this pane runs ${s.pluginIds.length ? esc(s.pluginIds.join(', ')) : 'none'} — cells may be formatted differently.</div>` : '';
    // filters: severity, and author once more than people write errors (W-18 DoD 5)
    const counts = { all: errors.length, error: errors.filter((e) => e.severity === 'error').length, warning: errors.filter((e) => e.severity === 'warning').length, note: errors.filter((e) => e.severity === 'note').length };
    const authors = new Set(errors.map((e) => this.authorKind(e)));
    const sevBtns = ([['all', `All ${counts.all}`, 'All severities'], ['error', `✕ ${counts.error}`, 'Errors'], ['warning', `! ${counts.warning}`, 'Warnings'], ['note', `i ${counts.note}`, 'Notes']] as const)
      .map(([v, label, name]) => `<button type="button" data-act="filter" data-v="${v}" aria-pressed="${this.filter === v}" aria-label="${name}: ${counts[v]}">${label}</button>`).join('');
    const authorBtns = authors.size > 1 || (authors.size === 1 && !authors.has('person'))
      ? `<span class="sep" aria-hidden="true"></span>${(['all', 'person', 'workbook', 'file'] as const).filter((a) => a === 'all' || authors.has(a)).map((a) => `<button type="button" data-act="author" data-v="${a}" aria-pressed="${this.authorFilter === a}">${a === 'all' ? 'Anyone' : a === 'person' ? 'People' : a === 'workbook' ? 'Workbook rules' : 'File comments'}</button>`).join('')}`
      : '';
    q('.filters').innerHTML = sevBtns + authorBtns;
    // the form (contract decision 4: this element shows it whenever it is connected to the pane)
    const formbox = q('.formbox');
    const c = snap.composing;
    if (c && !this.readOnly && snap.mode === 'edit') {
      const key = `${c.sheet}!${c.range ?? c.ref}|${this.draft.type}|${this.draft.severity}|${this._errorTypes.length}`;
      if (key !== this.formKey) { this.formKey = key; formbox.innerHTML = this.formHtml(); (formbox.querySelector('textarea') as HTMLElement | null)?.focus(); }
    } else if (formbox.innerHTML) { formbox.innerHTML = ''; this.formKey = ''; }
    // the list
    const list = errors
      .filter((e) => (this.filter === 'all' || e.severity === this.filter) && (this.authorFilter === 'all' || this.authorKind(e) === this.authorFilter))
      .sort((a, b) => (a.status === b.status ? errNum(a) - errNum(b) : a.status === 'open' ? -1 : 1));
    const types = new Map([...Object.entries(BUILTIN_TYPE_NAMES), ...this._errorTypes.map((t) => [t.id, t.name] as [string, string])]);
    const sel = snap.selection;
    const html = list.length ? list.map((e) => {
      const r = parseRange(e.range);
      const on = this.expanded === e.id || (!!r && e.sheet === sel.sheet && parseRef(sel.ref) && r.top === parseRef(sel.ref)!.row && r.left <= parseRef(sel.ref)!.col && r.right >= parseRef(sel.ref)!.col);
      const tags = [e.cellChanged ? 'cell changed' : '', e.status === 'resolved' ? 'resolved' : '', e.matchesExpected ? 'matches suggestion' : '', s.isStale(e) ? 'stale' : ''].filter(Boolean);
      const ro = this.readOnly || machineAuthored(e.author);
      const sv = SEVERITY[e.severity];
      const time = e.createdAt ? new Date(e.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
      const detail = this.expanded === e.id ? `<div class="detail">${e.message ? `<p class="why">${esc(e.message)}</p>` : ''}<span class="xs faint">${esc([e.author === 'workbook' ? 'Workbook rule' : e.author === 'file' ? 'File comment' : e.author === 'host' ? 'Column rule' : e.author, time].filter(Boolean).join(' · '))}</span><div class="acts"><button type="button" class="btn" data-act="reveal">Show in sheet</button>${ro ? '' : `<button type="button" class="btn" data-act="resolve">${e.status === 'resolved' ? 'Reopen' : '✓ Resolve'}</button><span class="spacer" style="flex:1"></span><button type="button" class="btn btn-g btn-d" data-act="delete">Delete</button>`}</div></div>` : '';
      return `<div class="item${e.status === 'resolved' ? ' done' : ''}${on ? ' on' : ''}" role="listitem" data-id="${esc(e.id)}"><button type="button" class="issue" data-act="pick" aria-expanded="${this.expanded === e.id}" aria-label="Error ${errNum(e)}: ${esc(types.get(e.type) ?? e.type)}, ${esc(e.sheet)} ${esc(e.range)}, ${sv.name}${e.status === 'resolved' ? ', resolved' : ''}"><span class="n ${e.status === 'resolved' ? 'resolved' : e.severity}" aria-hidden="true">${e.status === 'resolved' ? '✓' : errNum(e)}</span><span class="bd"><span class="ty">${esc(types.get(e.type) ?? e.type)}</span><span class="ba"><span class="found">${esc(e.found)}</span> → <span class="want">${esc(e.expected || '—')}</span></span><span class="m">${esc(e.range)} · <span class="g g-${e.severity}" aria-hidden="true">${sv.glyph}</span> ${sv.name}${tags.length ? ` · ${esc(tags.join(' · '))}` : ''}</span></span></button>${detail}</div>`;
    }).join('') : `<p class="empty">${errors.length ? 'Nothing matches this filter.' : 'Nothing flagged yet. Select a cell in the sheet, then Flag issue.'}</p>`;
    const listEl = q('.list');
    if (listEl.dataset.html !== html) { listEl.innerHTML = html; listEl.dataset.html = html; }
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
<div class="fft"><span class="xs faint">⌘ ↵</span><span class="spacer" style="flex:1"></span><button type="button" class="btn" data-act="cancel">Cancel</button><button type="button" class="btn btn-p" data-act="add">Add error</button></div></div>`;
  }
}

/** The column's header text: the nearest row above with two or more text cells. */
export function headerFor(text: string[][], row: number, col: number): string {
  for (let r = 0; r < Math.min(row, 10); r++) {
    const cells = text[r] ?? [];
    if (cells.filter((x) => x).length >= 2 && cells[col]) return cells[col]!;
  }
  return '';
}

export { sevOrder };
