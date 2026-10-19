// @sheetpane/compare/ui (W-63, SR-COMPARE decisions 8–12): the pane compared with a base file the
// user picks (or the host passes) — read in the page, never sent anywhere (SR-LAW-11). Changed
// cells, added, moved and removed rows tinted through `decorate`; the size of the change in the
// status line; Alt+F5 / Alt+Shift+F5 step to the next and previous change; every change also an
// entry in the errors list (type `compare`), written by `publishChanges`.
import { colName, parseRange } from '@sheetpane/export';
import { read, type ImportedWorkbook } from '@sheetpane/import';
import { registerPlugin, type CellContext, type ControlDescriptor, type Plugin, type Selection, type SheetpaneError, type Snapshot, type StyleSubset, type WorkbookStore } from '@sheetpane/grid';
import { diffWorkbooks, summaryText, type CellChange, type DiffOptions, type SheetDiff, type WorkbookDiff } from './diff.js';

/** The error type every change is listed under. */
export const COMPARE_TYPE = 'compare';
/** The most changes listed as errors; past it one note says how many more (the status line counts all). */
export const MAX_LISTED = 2000;

/** The tints, each a `--sp-compare-*` custom property the host may set. */
const TINT = {
  added: 'var(--sp-compare-added, rgba(26, 127, 55, 0.18))',
  changed: 'var(--sp-compare-changed, rgba(191, 135, 0, 0.30))',
  moved: 'var(--sp-compare-moved, rgba(9, 105, 218, 0.16))',
  removed: '2px solid var(--sp-compare-removed, rgb(207, 34, 46))',
};

/** What one sheet of the pane marks, in the pane's coordinates. */
interface Marks {
  sheetAdded: boolean;
  added: Set<number>;
  moved: Set<number>;
  cols: Set<number>;
  cells: Map<string, CellChange>;
  /** Rows with removed rows just above them; `end`: removed after the last row. */
  removedAbove: Set<number>;
  removedEnd: boolean;
  last: number;
}

/** One place the next/previous keys stop at. */
interface Stop { sheet: number; name: string; row: number; col: number; range?: string }

/** A pane's comparison. */
interface View {
  base: ImportedWorkbook;
  name: string;
  opts: DiffOptions;
  book: ImportedWorkbook | undefined;
  diff: WorkbookDiff | undefined;
  marks: Map<string, Marks>;
  stops: Stop[];
  off: () => void;
}

const views = new WeakMap<WorkbookStore, View>();
const byBook = new WeakMap<ImportedWorkbook, View>();
/** A base file that could not be read, said in the status line until the next comparison. */
const failed = new WeakMap<ImportedWorkbook, string>();

/** Options for {@link compareWith}. */
export interface CompareOptions extends DiffOptions {
  /** The base file's name, shown in the status line (and how its bytes are read: `.xlsx` or `.csv`). */
  name?: string;
}

const widthOf = (store: WorkbookStore, sheet: string) => Math.max(1, store.book?.sheets.find((s) => s.name === sheet)?.rows.reduce((m, r) => Math.max(m, r.length), 0) ?? 1);
const rowRange = (store: WorkbookStore, sheet: string, row: number) => `A${row + 1}:${colName(widthOf(store, sheet) - 1)}${row + 1}`;
const quote = (s: string) => `“${s.length > 60 ? `${s.slice(0, 59)}…` : s}”`;

/** What changed in a cell, in words. */
function cellMessage(c: CellChange): string {
  const parts: string[] = [];
  if (c.what.includes('value') || c.what.includes('text')) parts.push(`was ${quote(c.was?.text ?? '')} → now ${quote(c.now.text)}`);
  if (c.what.includes('formula')) parts.push(`formula ${c.was?.formula ? `=${c.was.formula}` : 'none'} → ${c.now.formula ? `=${c.now.formula}` : 'none'}`);
  return `Changed: ${parts.join('; ')}`;
}

/** One sheet's structural changes (columns, merges, hidden, rules), in words, or ''. */
function structureMessage(s: SheetDiff): string {
  const out: string[] = [];
  if (s.columns.removed.length) out.push(`${s.columns.removed.length} column${s.columns.removed.length === 1 ? '' : 's'} removed`);
  if (s.columns.moved.length) out.push(`columns moved: ${s.columns.moved.map((m) => `${colName(m.a)} → ${colName(m.b)}`).join(', ')}`);
  if (s.merges.added.length) out.push(`merged ${s.merges.added.join(', ')}`);
  if (s.merges.removed.length) out.push(`unmerged ${s.merges.removed.join(', ')}`);
  const h = s.hidden;
  if (h.rows.hidden.length) out.push(`${h.rows.hidden.length} row${h.rows.hidden.length === 1 ? '' : 's'} newly hidden`);
  if (h.rows.shown.length) out.push(`${h.rows.shown.length} row${h.rows.shown.length === 1 ? '' : 's'} no longer hidden`);
  if (h.cols.hidden.length) out.push(`columns newly hidden: ${h.cols.hidden.map(colName).join(', ')}`);
  if (h.cols.shown.length) out.push(`columns no longer hidden: ${h.cols.shown.map(colName).join(', ')}`);
  if (h.state) out.push(`sheet ${h.state.was} → ${h.state.now}`);
  if (s.rules) {
    const { dataValidations: dv, conditionalFormats: cf } = s.rules;
    if (dv.was !== dv.now) out.push(`validation rules ${dv.was} → ${dv.now}`);
    if (cf.was !== cf.now) out.push(`conditional formats ${cf.was} → ${cf.now}`);
  }
  return out.join('; ');
}

/** An entry: where, what — and `expected`, what the base holds there (the list reads *found → expected*: now → base). */
type Draft = Pick<SheetpaneError, 'sheet' | 'range' | 'message'> & { expected?: string };

/** Every change as an entry for the errors list, at most {@link MAX_LISTED} (and one note for the rest). */
function changeDrafts(store: WorkbookStore, diff: WorkbookDiff): Draft[] {
  const out: Draft[] = [];
  for (const s of diff.sheets) {
    if (s.status === 'same' || s.status === 'removed') continue; // a removed sheet has no place in this workbook: the status line names it
    const sheet = s.b!;
    if (s.status === 'added') { out.push({ sheet, range: 'A1', message: 'Sheet added' }); continue; }
    if (s.renamed !== undefined) out.push({ sheet, range: 'A1', message: `Sheet renamed — was ${quote(s.a!)}` });
    const st = structureMessage(s);
    if (st) out.push({ sheet, range: 'A1', message: `Sheet changed: ${st}` });
    for (const c of s.columns.added) out.push({ sheet, range: `${colName(c)}1:${colName(c)}${Math.max(1, store.book?.sheets.find((x) => x.name === sheet)?.rows.length ?? 1)}`, message: `Column ${colName(c)} added` });
    const added = new Set(s.columns.added);
    const removed = new Map<number, number[]>();
    for (const r of s.rows) if (r.op === 'removed') { const l = removed.get(r.after); if (l) l.push(r.a); else removed.set(r.after, [r.a]); }
    const rowsIn = store.book?.sheets.find((x) => x.name === sheet)?.rows.length ?? 0;
    for (const r of s.rows) {
      if (r.op === 'added') out.push({ sheet, range: rowRange(store, sheet, r.b), message: `Row ${r.b + 1} added` });
      else if (r.op === 'moved') out.push({ sheet, range: rowRange(store, sheet, r.b), message: `Row moved — was row ${r.a + 1}`, expected: `row ${r.a + 1}` });
    }
    for (const [after, as] of removed) {
      const at = after + 1 < rowsIn ? after + 1 : Math.max(0, after);
      const span = as.length === 1 ? `row ${as[0]! + 1}` : `rows ${as.map((x) => x + 1).join(', ')}`;
      out.push({ sheet, range: rowRange(store, sheet, at), message: `${as.length} row${as.length === 1 ? '' : 's'} removed ${after + 1 < rowsIn ? 'above this row' : 'below this row'} — was ${span}` });
    }
    for (const c of s.cells) if (!added.has(c.col)) out.push({ sheet, range: c.ref, message: cellMessage(c), expected: c.what.includes('value') || c.what.includes('text') ? c.was?.text ?? '' : c.was?.formula ? `=${c.was.formula}` : '' });
  }
  if (out.length > MAX_LISTED) {
    const more = out.length - MAX_LISTED;
    out.length = MAX_LISTED;
    out.push({ sheet: out[0]!.sheet, range: 'A1', message: `…and ${more.toLocaleString('en-US')} more changes not listed — the status line counts them all` });
  }
  return out;
}

/**
 * Writes the comparison's changes into the pane's errors list (type `compare`, severity `note`,
 * author `compare`), replacing the previous comparison's and keeping every other error. Pass
 * `undefined` to remove them.
 *
 * Until review layers (W-51) land this goes through `setErrors`, which also clears undo; with them
 * it becomes the `compare` layer and leaves the review alone.
 * @param store - The pane's workbook.
 * @param diff - The comparison, or undefined to clear it.
 * @returns False when there was nothing to write (no change listed, none to remove).
 */
export function publishChanges(store: WorkbookStore, diff: WorkbookDiff | undefined): boolean {
  // W-51: layer 'compare' — becomes `store.setErrors(list, { layer: 'compare' })` with only the
  // compare entries, and the `keep` filter goes; nothing else in this package writes errors.
  const keep = store.getErrors().filter((e) => e.type !== COMPARE_TYPE);
  let next = keep.reduce((m, e) => Math.max(m, Number(/^ERR-(\d+)$/.exec(e.id)?.[1] ?? 0)), 0) + 1;
  const now = new Date().toISOString();
  const list: SheetpaneError[] = (diff ? changeDrafts(store, diff) : []).map((d) => ({
    v: 1, id: `ERR-${String(next++).padStart(4, '0')}`, sheet: d.sheet, range: d.range, type: COMPARE_TYPE, severity: 'note',
    found: store.foundFor(d.sheet, d.range), expected: d.expected ?? '', message: d.message, cellChanged: false, status: 'open', matchesExpected: false, author: COMPARE_TYPE, createdAt: now,
  }));
  if (!list.length && keep.length === store.getSnapshot().errors.length) return false; // nothing of ours to add or take away
  store.setErrors([...keep, ...list]);
  return true;
}

/** A new snapshot with nothing changed, so the grid redraws the tints and the status line. */
const redraw = (store: WorkbookStore) => store.compose(store.getSnapshot().composing);

/** The marks and the stops of a diff, in the pane's coordinates. */
function index(store: WorkbookStore, view: View, diff: WorkbookDiff): void {
  view.marks.clear();
  const stops: Stop[] = [];
  const order = new Map((store.book?.sheets ?? []).map((s, i) => [s.name, i]));
  for (const s of diff.sheets) {
    if (s.status === 'same' || s.status === 'removed') continue;
    const name = s.b!, si = order.get(name) ?? 0;
    const rows = store.book?.sheets.find((x) => x.name === name)?.rows.length ?? 0;
    const m: Marks = { sheetAdded: s.status === 'added', added: new Set(), moved: new Set(), cols: new Set(s.columns.added), cells: new Map(), removedAbove: new Set(), removedEnd: false, last: Math.max(0, rows - 1) };
    if (m.sheetAdded || s.renamed !== undefined || structureMessage(s)) stops.push({ sheet: si, name, row: 0, col: 0 });
    for (const c of m.cols) stops.push({ sheet: si, name, row: 0, col: c });
    for (const r of s.rows) {
      if (m.sheetAdded) break;
      if (r.op === 'added') { m.added.add(r.b); stops.push({ sheet: si, name, row: r.b, col: 0, range: rowRange(store, name, r.b) }); }
      else if (r.op === 'moved') { m.moved.add(r.b); stops.push({ sheet: si, name, row: r.b, col: 0, range: rowRange(store, name, r.b) }); }
      else if (r.op === 'removed') {
        if (r.after + 1 < rows) m.removedAbove.add(r.after + 1); else m.removedEnd = true;
        const at = r.after + 1 < rows ? r.after + 1 : Math.max(0, r.after);
        stops.push({ sheet: si, name, row: at, col: 0, range: rowRange(store, name, at) });
      }
    }
    for (const c of s.cells) { m.cells.set(c.ref, c); if (!m.cols.has(c.col)) stops.push({ sheet: si, name, row: c.row, col: c.col }); }
    view.marks.set(name, m);
  }
  stops.sort((x, y) => x.sheet - y.sheet || x.row - y.row || x.col - y.col);
  view.stops = stops.filter((x, i) => !i || x.sheet !== stops[i - 1]!.sheet || x.row !== stops[i - 1]!.row || x.col !== stops[i - 1]!.col);
}

/** Diffs the pane's workbook (as the file holds it) against the base, and publishes the result. */
function refresh(store: WorkbookStore, view: View): void {
  const book = store.book;
  if (view.book) byBook.delete(view.book);
  view.book = book;
  if (!book) { view.diff = undefined; view.marks.clear(); view.stops = []; return; }
  byBook.set(book, view);
  view.diff = diffWorkbooks(view.base, book, view.opts);
  index(store, view, view.diff);
  if (!publishChanges(store, view.diff)) redraw(store);
}

/**
 * Compares the pane's workbook with a base version: the file the pane shows (as loaded — edits made
 * since are not part of the comparison) against `base`, read in the page. Re-runs when another file
 * loads into the pane. Replaces an earlier comparison.
 * @param store - The pane's workbook (`excel.workbook`).
 * @param base - The older version: bytes or a `File`/`Blob` (`.xlsx` or `.csv`), or a workbook already read.
 * @param o - The base's name and the diff options (key columns, header row).
 * @returns The comparison, or undefined while the pane holds no workbook.
 * @throws The reader's error (SP-10xx) when `base` cannot be read; SP-5901 for a missing per-sheet key.
 * @example
 * ```ts
 * import { compareWith } from '@sheetpane/compare/ui';
 * // excel: a <sheetpane-excel plugins="compare">; file: the approved version the user picked
 * const diff = await compareWith(excel.workbook!, file, { name: file.name, key: 'ID' });
 * console.log(diff?.summary);
 * ```
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0124_COMPARE.md
 */
export async function compareWith(store: WorkbookStore, base: ImportedWorkbook | Blob | ArrayBuffer | Uint8Array, o: CompareOptions = {}): Promise<WorkbookDiff | undefined> {
  const { name, ...opts } = o;
  const wb = 'sheets' in base ? base : await read(base, name ? { name } : {});
  clearCompare(store);
  if (store.book) failed.delete(store.book);
  const view: View = { book: undefined, diff: undefined, base: wb, name: name ?? (typeof File !== 'undefined' && base instanceof File ? base.name : 'the base file'), opts, marks: new Map(), stops: [], off: () => {} };
  views.set(store, view);
  // another file loading into the pane is compared with the same base (after the store settles)
  view.off = store.subscribe(() => { if (store.book !== view.book && views.get(store) === view) queueMicrotask(() => { if (store.book !== view.book && views.get(store) === view) refresh(store, view); }); });
  refresh(store, view);
  return view.diff;
}

/**
 * Ends the comparison: the tints, the status line and the `compare` entries go.
 * @param store - The pane's workbook.
 */
export function clearCompare(store: WorkbookStore): void {
  const v = views.get(store);
  if (!v) return;
  v.off();
  views.delete(store);
  if (v.book) byBook.delete(v.book);
  if (!publishChanges(store, undefined)) redraw(store);
}

/**
 * The pane's current comparison, if any.
 * @param store - The pane's workbook.
 * @returns The diff and the base's name, or undefined.
 */
export function comparison(store: WorkbookStore): { diff: WorkbookDiff; base: string } | undefined {
  const v = views.get(store);
  return v?.diff ? { diff: v.diff, base: v.name } : undefined;
}

/**
 * Moves the selection to the next (or previous) change, wrapping at the end.
 * @param store - The pane's workbook.
 * @param dir - 1 for the next change, −1 for the previous.
 * @returns False when there is no change to go to.
 */
export function stepChange(store: WorkbookStore, dir: 1 | -1): boolean {
  const v = views.get(store), snap = store.getSnapshot();
  if (!v?.stops.length || !snap.book) return false;
  const si = snap.book.sheets.findIndex((s) => s.name === snap.selection.sheet);
  const p = parseRange(snap.selection.ref);
  const cur = { sheet: si, row: p?.top ?? 0, col: p?.left ?? 0 };
  const cmp = (s: Stop) => s.sheet - cur.sheet || s.row - cur.row || s.col - cur.col;
  const stop = dir > 0 ? v.stops.find((s) => cmp(s) > 0) ?? v.stops[0]! : [...v.stops].reverse().find((s) => cmp(s) < 0) ?? v.stops[v.stops.length - 1]!;
  const ref = `${colName(stop.col)}${stop.row + 1}`;
  store.select(stop.range ? { sheet: stop.name, ref, range: stop.range } : { sheet: stop.name, ref });
  return true;
}

/** The tint of one cell. */
function tint(cell: CellContext): StyleSubset | undefined {
  const v = views.get(cell.store);
  const m = v && v.book === cell.book ? v.marks.get(cell.sheet.name) : undefined;
  if (!m) return undefined;
  const out: StyleSubset = {};
  if (m.sheetAdded || m.added.has(cell.row) || m.cols.has(cell.col)) out['background-color'] = TINT.added;
  else if (m.cells.has(cell.ref)) out['background-color'] = TINT.changed;
  else if (m.moved.has(cell.row)) out['background-color'] = TINT.moved;
  if (m.removedAbove.has(cell.row)) out['border-top'] = TINT.removed;
  if (m.removedEnd && cell.row === m.last) out['border-bottom'] = TINT.removed;
  return Object.keys(out).length ? out : undefined;
}

/** The status line: what the pane is compared with and how much changed. */
function statusText(snap: Snapshot): string {
  const v = snap.book ? byBook.get(snap.book) : undefined;
  if (!v?.diff) return (snap.book && failed.get(snap.book)) || '';
  const gone = v.diff.sheets.filter((s) => s.status === 'removed').map((s) => quote(s.a!));
  return `Compared with ${v.name}: ${summaryText(v.diff.summary)}${gone.length ? ` · removed ${gone.join(', ')}` : ''}`;
}

/** Asks the user for the base file (a file picker; the file is read in the page). */
function pickBase(store: WorkbookStore): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.csv';
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    if (!f) return;
    compareWith(store, f, { name: f.name }).catch((e: Error) => {
      // the reader's refusal (SP-10xx) is said in the status line; the pane redraws for it
      if (store.book) failed.set(store.book, `Can’t compare with ${f.name}: ${e.message}`);
      redraw(store);
    });
  }, { once: true });
  input.click();
}

const CHEVRON = (d: string) => `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const noStops = (snap: Snapshot) => !(snap.book && byBook.get(snap.book)?.stops.length);

/**
 * The compare plugin: tints the changes (`decorate`), sums them up in the status line, and adds
 * Compare… (pick the base file), the previous / next change buttons (Alt+Shift+F5 / Alt+F5) and
 * Stop comparing to the cell bar, in View and Edit.
 * @returns The plugin (`id: 'compare'`).
 * @example
 * ```ts
 * import '@sheetpane/compare/ui';
 * excel.setAttribute('plugins', 'compare'); // a <sheetpane-excel>
 * ```
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0124_COMPARE.md
 */
export function compare(): Plugin {
  const controls: ControlDescriptor[] = [
    { id: 'compare-pick', slot: 'cellbar', group: 'compare', mode: 'both', label: 'Compare with a base file…', labelFor: (snap: Snapshot) => (snap.book && byBook.get(snap.book) ? 'Compare with another file…' : 'Compare…'), run: (store: WorkbookStore) => pickBase(store) },
    { id: 'compare-prev', slot: 'cellbar', group: 'compare', mode: 'both', label: 'Previous change', shortcut: 'Alt+Shift+F5', icon: CHEVRON('M10 3 5 8l5 5'), disabled: noStops, disabledReason: (snap: Snapshot) => (noStops(snap) ? 'No changes to step through' : undefined), run: (store: WorkbookStore) => { stepChange(store, -1); } },
    { id: 'compare-next', slot: 'cellbar', group: 'compare', mode: 'both', label: 'Next change', shortcut: 'Alt+F5', icon: CHEVRON('M6 3l5 5-5 5'), disabled: noStops, disabledReason: (snap: Snapshot) => (noStops(snap) ? 'No changes to step through' : undefined), run: (store: WorkbookStore) => { stepChange(store, 1); } },
    { id: 'compare-stop', slot: 'cellbar', group: 'compare', mode: 'both', label: 'Stop comparing', disabled: (snap: Snapshot) => !(snap.book && byBook.get(snap.book)), run: (store: WorkbookStore) => clearCompare(store) },
    { id: 'compare-status', slot: 'status', group: 'compare', mode: 'both', label: 'Changes since the base file', text: (snap: Snapshot) => statusText(snap) },
  ];
  return { id: 'compare', provides: ['decorate'], after: ['styles', 'condfmt'], decorate: tint, controls };
}

registerPlugin('compare', () => compare());

export type { WorkbookDiff, SheetDiff, CellChange, DiffOptions } from './diff.js';
export { diffWorkbooks, summaryText } from './diff.js';
