// @sheetpane/grid/static — a range of a sheet as one self-contained HTML <table> (W-67): the text
// the pane shows (the `format` hook), the look it draws (the `decorate` hooks, merges, the tokens
// as inline hex), hidden rows and columns left out, and the error marks with glyphs and labels.
// For a report or an email: no script, no class, no stylesheet, no URL, every value escaped, no
// font family (SR-LAW-5). It reads the same store the elements read and imports no element, so
// it runs in Node, a worker or a page (SR-GRID decision 22g).
import { cellRef, colName, parseRange, rangesIntersect, spError, type RangePos } from '@sheetpane/export';
import { sheetGeometry, HEAD_H, ROWHEAD_W } from './excel/geometry.js';
import type { WorkbookStore } from './pane/store.js';
import { BUILTIN_TYPE_NAMES, DEFAULT_ERROR_TYPES, SEVERITY, isResult, type ProblemSeverity, type SheetpaneError } from './pane/types.js';
import { STYLE_PROPS } from './plugins/types.js';
import { DARK_TOKENS, TOKENS, type TokenName } from './tokens.js';

// what a DOM-free host needs to get a store to render
export { loadWorkbook, type CheckOptions } from './check.js';
export { WorkbookStore, createWorkbook } from './pane/store.js';
export type { SheetpaneError, Severity } from './pane/types.js';
export { TOKENS, DARK_TOKENS, type TokenName } from './tokens.js';

/** The colours a static table is drawn in: the light tokens, or the dark set (SR-GRID decision 15a). Inline hex, so no `auto`. */
export type StaticTheme = 'light' | 'dark';

/** What {@link renderStatic} draws. */
export interface StaticOptions {
  /** The sheet, by name. Default: the sheet the pane has selected — the file's active sheet after a load. */
  sheet?: string;
  /** An A1 range (`B2:F20`, or one cell). Default: the sheet's used range — its data, widened to its merges. */
  range?: string;
  /** The errors to mark. Default: the workbook's own (`getErrors()`); `[]` marks nothing. Pass `check()`'s result, or a review restored from a server. */
  errors?: readonly SheetpaneError[];
  /** `light` (the default) or `dark`. A `decorate` colour (the file's fills and fonts) is drawn as saved in both. */
  theme?: StaticTheme;
  /** Column letters and row numbers around the cells, as the grid draws them. Default true. */
  headers?: boolean;
}

/** What decides a cell's mark: its error's status, then its severity — see {@link STATIC_MARKS}. */
export type StaticMarkKey = 'error' | 'warning' | 'note' | 'resolved';

/** How one mark is drawn: its glyph and label, the solid token of its ring and badge, the soft token of its tint (none: no tint), and its rank — the higher wins a cell two errors share. */
export interface StaticMark { glyph: string; label: string; solid: TokenName; soft?: TokenName; rank: number }

/**
 * Every mark a static table draws — the grid's `m-*` cell marks and glyphs: a ring in the solid
 * colour, a tint of the soft one at 60 % over the cell's own fill, and a badge holding the glyph
 * and the error's number, which the table's footer explains. Never colour alone.
 */
export const STATIC_MARKS: Readonly<Record<StaticMarkKey, StaticMark>> = {
  error: { glyph: SEVERITY.error.glyph, label: SEVERITY.error.name, solid: 'fail', soft: 'fail-soft', rank: 4 },
  warning: { glyph: SEVERITY.warning.glyph, label: SEVERITY.warning.name, solid: 'warn', soft: 'warn-soft', rank: 3 },
  note: { glyph: SEVERITY.note.glyph, label: SEVERITY.note.name, solid: 'accent', soft: 'accent-soft', rank: 2 },
  resolved: { glyph: '✓', label: 'Resolved', solid: 'pass', rank: 1 },
};

/** The one place an error becomes a mark: its status first, then its severity. A new status or result is a key here and in {@link STATIC_MARKS}. */
function markOf(e: SheetpaneError): StaticMarkKey {
  return e.status === 'resolved' ? 'resolved' : (e.severity as ProblemSeverity);
}

/** A static table holds at most this many cells; a larger range throws SP-3028 — pass a smaller `range`. */
export const STATIC_MAX_CELLS = 200_000;

/**
 * A range of a sheet as one self-contained HTML `<table>` — the text the pane shows (the `format`
 * plugin), the look it draws (every `decorate` plugin, merges, the tokens as inline hex), hidden
 * rows and columns left out, and the given errors marked with a ring, a tint and a numbered glyph,
 * listed in the footer (SR-GRID decision 22g). Made with no DOM, in Node, a worker or a page.
 *
 * The output is inert: no `<script>`, no event attribute, no `class`, no `<style>`, no URL — inline
 * `style` only, every value escaped, no font family (the reader's font is the font, SR-LAW-5).
 * What a plugin draws over the cells (`overlay`: pictures, charts) is not drawn; the footer says so
 * and the table's `data-sp-skipped` names those plugins.
 * @param book - A loaded workbook: `loadWorkbook()`'s, `createWorkbook()`'s after `load()`, or an element's `workbook`. Its plugins format and decorate; its changes and derived values show.
 * @param options - `sheet`, `range`, `errors`, `theme` and `headers`.
 * @returns The HTML of one `<table>` element.
 * @throws SP-3027 when `book` is not a loaded workbook; SP-3028 for an unknown sheet, a range that is not A1, or one over {@link STATIC_MAX_CELLS} cells.
 * @example
 * ```ts
 * import { loadWorkbook, renderStatic } from '@sheetpane/grid/static';
 * import { numfmt } from '@sheetpane/numfmt';
 * import { styles } from '@sheetpane/styles';
 * import { validation } from '@sheetpane/validation/check';
 *
 * // `bytes`: the file as your runtime reads it — `await readFile(path)` in Node
 * const book = await loadWorkbook(bytes, { name: 'q3.xlsx', plugins: [numfmt(), styles(), validation()] });
 * const html = renderStatic(book, { sheet: 'Holdings', range: 'A1:F12' }); // the workbook's own errors marked
 * ```
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md
 */
export function renderStatic(book: WorkbookStore, options: StaticOptions = {}): string {
  const loaded = book && typeof book.getSnapshot === 'function' && typeof book.text === 'function' ? book.getSnapshot() : undefined;
  if (!loaded || loaded.load.status !== 'ready' || !loaded.book) throw spError('SP-3027', 'renderStatic() takes a loaded workbook — loadWorkbook(bytes), or a store after load() has finished', TypeError);
  const name = options.sheet ?? (loaded.selection.sheet || loaded.book.sheets[0]?.name || '');
  const sheet = book.sheet(name);
  if (!sheet) throw spError('SP-3028', `renderStatic(): no sheet is named “${name}”`, RangeError);
  const T: Record<string, string> = options.theme === 'dark' ? { ...TOKENS, ...DARK_TOKENS } : { ...TOKENS };
  const merges = book.merges(name);
  const hid = book.hidden(name);
  const g = sheetGeometry(sheet, merges, {}, { rows: new Set(hid.rows), cols: new Set(hid.cols) });
  const range = options.range === undefined ? usedRange(sheet.rows, g.merges) : parseRange(options.range);
  if (!range) throw spError('SP-3028', `renderStatic(): “${options.range}” is not an A1 range`, RangeError);
  const rowShown = (r: number) => !hid.rows.includes(r), colShown = (c: number) => !hid.cols.includes(c);
  const rows = span(range.top, range.bottom).filter(rowShown), cols = span(range.left, range.right).filter(colShown);
  if (rows.length * cols.length > STATIC_MAX_CELLS) throw spError('SP-3028', `renderStatic(): ${options.range ?? 'the used range'} holds ${rows.length * cols.length} cells — over ${STATIC_MAX_CELLS}; pass a smaller range`, RangeError);
  const headers = options.headers !== false;
  const rangeA1 = `${cellRef(range.top, range.left)}:${cellRef(range.bottom, range.right)}`;

  // the errors on this range, numbered in reading order; each cell takes its highest-ranked mark
  const marked = sortedErrors((options.errors ?? loaded.errors).filter((e) => e.sheet === name && !isResult(e)), range);
  const markAt = new Map<string, StaticMarkKey>(), badges = new Map<string, number[]>(), rowWorst = new Map<number, StaticMarkKey>();
  marked.forEach(({ e, r }, i) => {
    const k = markOf(e), clip = clipTo(r, range);
    const first = firstShown(clip, rowShown, colShown);
    if (first) { const key = `${first.row},${first.col}`; badges.set(key, [...(badges.get(key) ?? []), i]); }
    for (let rr = clip.top; rr <= clip.bottom; rr++) {
      for (let cc = clip.left; cc <= clip.right; cc++) { const p = markAt.get(`${rr},${cc}`); if (!p || STATIC_MARKS[k].rank > STATIC_MARKS[p].rank) markAt.set(`${rr},${cc}`, k); }
      const w = rowWorst.get(rr);
      if (e.status === 'open' && (!w || STATIC_MARKS[k].rank > STATIC_MARKS[w].rank)) rowWorst.set(rr, k);
    }
  });

  const decorating = book.plugins.some((p) => p.provides.includes('decorate'));
  const skipped = book.plugins.filter((p) => p.provides.includes('overlay')).map((p) => p.id);
  const width = (c: number) => g.colX[c + 1]! - g.colX[c]!;
  const height = (r: number) => g.rowY[r + 1]! - g.rowY[r]!;
  const cellFont = '.93em'; // --sp-cell-font-size's default (SR-GRID decision 15)
  const badge = (k: StaticMarkKey, text: string, label: string) => `<span data-sp-badge="${k}" aria-label="${esc(label)}" style="display:inline-block;min-width:16px;height:16px;padding:0 3px;border-radius:4px;background-color:${T[STATIC_MARKS[k].solid]};color:${T['on-solid']};font-size:10px;font-weight:700;line-height:16px;text-align:center;font-style:normal;text-decoration:none;box-sizing:border-box">${esc(text)}</span>`;

  // a merge is drawn once, from its first shown cell in the range; the cells it covers are skipped
  const mergeOf = (r: number, c: number) => g.merges.find((m) => r >= m.top && r <= m.bottom && c >= m.left && c <= m.right);
  const cell = (r: number, c: number): string => {
    const m = mergeOf(r, c);
    let rowspan = 1, colspan = 1, ref = cellRef(r, c);
    if (m && (m.top !== m.bottom || m.left !== m.right)) {
      const clip = clipTo(m, range), anchor = firstShown(clip, rowShown, colShown);
      if (!anchor || anchor.row !== r || anchor.col !== c) return '';
      rowspan = rows.filter((x) => x >= clip.top && x <= clip.bottom).length;
      colspan = cols.filter((x) => x >= clip.left && x <= clip.right).length;
      ref = cellRef(m.top, m.left); // the merge's value is its top-left cell's
    }
    const text = book.text(name, ref), v = book.value(name, ref);
    const merged = rowspan > 1 || colspan > 1 || (m !== undefined && (m.top !== m.bottom || m.left !== m.right));
    const h = rows.filter((x) => x >= r && x < r + rowspan).reduce((s, x) => s + height(x), 0);
    const css: Record<string, string> = {
      'background-color': merged ? T.head! : T.cell!, padding: '0 .6em', 'border-right': `1px solid ${T.grid}`, 'border-bottom': `1px solid ${T.grid}`,
      'font-size': cellFont, 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis', 'vertical-align': 'middle', height: `${h}px`, 'box-sizing': 'border-box',
    };
    if (typeof v === 'number') { css['text-align'] = 'right'; css['font-variant-numeric'] = 'tabular-nums'; }
    if (merged) { css['text-align'] = 'center'; css['font-weight'] = '600'; }
    if (decorating) {
      for (const [k, raw] of Object.entries(book.decorate(name, ref))) {
        if (!ALLOWED.has(k)) continue;
        const val = cssValue(raw, T);
        if (val === undefined) continue;
        css[k] = k === 'vertical-align' ? (val === 'top' ? 'top' : val === 'bottom' ? 'bottom' : 'middle') : val;
      }
    }
    const mk = markAt.get(`${r},${c}`);
    const attrs = [`data-sp-ref="${ref}"`];
    if (mk) {
      const s = STATIC_MARKS[mk];
      css['box-shadow'] = `inset 0 0 0 1.5px ${T[s.solid]}`;
      if (s.soft) css['background-color'] = blend(T[s.soft]!, css['background-color']!, 0.6);
      attrs.push(`data-sp-mark="${mk}"`);
    }
    if (book.changesAt(name, ref).length) {
      const corner = `linear-gradient(225deg,${T.changed} 5px,transparent 5px)`;
      css['background-image'] = css['background-image'] ? `${corner},${css['background-image']}` : corner;
      attrs.push('data-sp-changed=""');
    }
    if (rowspan > 1) attrs.push(`rowspan="${rowspan}"`);
    if (colspan > 1) attrs.push(`colspan="${colspan}"`);
    const stale = book.mayBeStale(name, ref);
    const derived = !stale && loaded.derived.has(`${name}!${ref}`) && !book.changeOf(name, ref);
    if (stale) attrs.push('title="May be stale — Excel recalculates on open"');
    else if (text.length > 24) attrs.push(`title="${esc(text)}"`);
    // the text is clipped to the row, as the grid clips it: a table row would otherwise grow to fit wrapped or large text
    const vStyle = ` style="display:block;overflow:hidden;text-overflow:ellipsis;max-height:${Math.max(0, h - 1)}px${stale ? `;color:${T['ink-3']};font-style:italic` : derived ? `;color:${T['accent-ink']}` : ''}"`;
    const pre = stale ? `<span data-sp-stale="" style="color:${T.warn};font-style:normal">≈ </span>` : '';
    const own = (badges.get(`${r},${c}`) ?? []).map((i) => badge(markOf(marked[i]!.e), `${STATIC_MARKS[markOf(marked[i]!.e)].glyph}${i + 1}`, `${STATIC_MARKS[markOf(marked[i]!.e)].label} ${i + 1}`)).join('');
    const pins = own ? `<span style="float:right;margin-left:4px">${own}</span>` : '';
    return `<td ${attrs.join(' ')} style="${styleOf(css)}">${pins}<span data-sp-v=""${vStyle}>${pre}${esc(text)}</span></td>`;
  };

  const head = `background-color:${T.head};color:${T['ink-3']};font-size:.85em;font-variant-numeric:tabular-nums;white-space:nowrap;box-sizing:border-box`;
  const out: string[] = [];
  const total = (headers ? ROWHEAD_W : 0) + cols.reduce((s, c) => s + width(c), 0);
  out.push(`<table data-sp-static="1" data-sp-sheet="${esc(name)}" data-sp-range="${rangeA1}" data-sp-theme="${options.theme === 'dark' ? 'dark' : 'light'}"${skipped.length ? ` data-sp-skipped="${esc(skipped.join(' '))}"` : ''} aria-label="${esc(`${name}, ${rangeA1}`)}" style="border-collapse:separate;border-spacing:0;table-layout:fixed;width:${total}px;background-color:${T.cell};color:${T.ink};font-size:14px;line-height:1.45;text-align:left${headers ? '' : `;border-top:1px solid ${T.grid};border-left:1px solid ${T.grid}`}">`);
  out.push(`<colgroup>${headers ? `<col style="width:${ROWHEAD_W}px">` : ''}${cols.map((c) => `<col style="width:${width(c)}px">`).join('')}</colgroup>`);
  if (headers) {
    out.push(`<thead><tr style="height:${HEAD_H}px"><th scope="col" style="${head};border-right:1px solid ${T.line};border-bottom:1px solid ${T.grid};padding:0 6px"></th>`);
    for (const c of cols) out.push(`<th scope="col" data-sp-col="${c}" style="${head};font-weight:500;text-align:center;border-right:1px solid ${T.grid};border-bottom:1px solid ${T.line};height:${HEAD_H}px;padding:0">${colName(c)}</th>`);
    out.push('</tr></thead>');
  }
  out.push('<tbody>');
  for (const r of rows) {
    out.push(`<tr style="height:${height(r)}px">`);
    if (headers) {
      const w = rowWorst.get(r);
      const g1 = w ? `${badge(w, STATIC_MARKS[w].glyph, STATIC_MARKS[w].label)} ` : '';
      out.push(`<th scope="row" data-sp-row="${r}" style="${head};font-weight:400;text-align:right;padding:0 6px;border-right:1px solid ${T.line};border-bottom:1px solid ${T.grid}">${g1}${r + 1}</th>`);
    }
    for (const c of cols) out.push(cell(r, c));
    out.push('</tr>');
  }
  out.push('</tbody>');
  const notes = footer(marked.map((x) => x.e), skipped, drawingsIn(sheet.drawings ?? [], range), T, badge);
  if (notes) out.push(`<tfoot><tr><td colspan="${cols.length + (headers ? 1 : 0)}" style="padding:6px 8px;border-top:1px solid ${T.line};background-color:${T.surface};color:${T['ink-2']};font-size:12px;white-space:normal;text-align:left">${notes}</td></tr></tfoot>`);
  out.push('</table>');
  return out.join('');
}

/** The footer: each marked error — badge, label, range, type, message, expected — then what was not drawn. */
function footer(errors: SheetpaneError[], skipped: string[], drawings: number, T: Record<string, string>, badge: (k: StaticMarkKey, text: string, label: string) => string): string {
  const lines = errors.map((e, i) => {
    const k = markOf(e), s = STATIC_MARKS[k];
    const type = DEFAULT_ERROR_TYPES.find((t) => t.id === e.type)?.name ?? BUILTIN_TYPE_NAMES[e.type] ?? e.type;
    const parts = [`<b style="color:${T.ink}">${esc(s.label)}</b>`, esc(e.range), esc(type)];
    if (e.status === 'resolved' && k !== 'resolved') parts.push('resolved');
    const said = [e.message ? esc(e.message) : '', e.expected ? `should be ${esc(e.expected)}` : ''].filter(Boolean).join(' · ');
    return `<div data-sp-note="${i + 1}" style="margin:2px 0">${badge(k, `${s.glyph}${i + 1}`, `${s.label} ${i + 1}`)} ${parts.join(' · ')}${said ? ` — ${said}` : ''}</div>`;
  });
  if (skipped.length) {
    const what = drawings ? `${drawings} picture${drawings === 1 ? '' : 's'} or chart${drawings === 1 ? '' : 's'} in this range` : 'what they draw over the cells';
    lines.push(`<div data-sp-skipped-note="" style="margin:2px 0;color:${T['ink-3']}">Not drawn in a static copy: ${what} (${esc(skipped.join(', '))}).</div>`);
  }
  return lines.join('');
}

const ALLOWED = new Set<string>(STYLE_PROPS);
/** A value from a `decorate` hook, kept only when it is plain CSS: `var(--sp-*)` resolved to the theme, then no URL, no function that loads or reads anything, no quote, semicolon, brace, comment or escape. */
const SAFE_VALUE = /^[\w\s#%.,()+\-/]*$/;
const LOADS = /(url|image|image-set|element|cross-fade|expression|attr|env|var|paint|src)\s*\(/i;
function cssValue(raw: unknown, T: Record<string, string>): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.replace(/var\(\s*--sp-([\w-]+)\s*(?:,[^()]*)?\)/g, (m, n: string) => T[n] ?? m).trim();
  if (!v || v.length > 300 || !SAFE_VALUE.test(v) || LOADS.test(v) || v.includes('/*') || v.includes('*/')) return undefined;
  return v;
}

/** `{ prop: value }` → `prop:value;…`, escaped for a double-quoted attribute. */
const styleOf = (css: Record<string, string>) => esc(Object.entries(css).map(([k, v]) => `${k}:${v}`).join(';'));

/** HTML-escapes text and attribute values: `& < > " '`, and a carriage return (the parser would fold it) and NUL (it has no HTML form: U+FFFD, as the parser would read it). */
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '\r': '&#13;', '\0': '&#xFFFD;' };
const esc = (s: string) => String(s).replace(/[&<>"'\r\0]/g, (c) => ESC[c]!);

/** `soft` laid over `base` at `alpha` — the grid's `::before` tint, flattened for mail; an unreadable `base` gives `soft`. */
function blend(soft: string, base: string, alpha: number): string {
  const a = rgb(soft), b = rgb(base);
  if (!a || !b) return soft;
  return `#${a.map((x, i) => Math.round(x * alpha + b[i]! * (1 - alpha)).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
function rgb(c: string): [number, number, number] | undefined {
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (h) { const x = h[1]!.length === 3 ? h[1]!.replace(/./g, '$&$&') : h[1]!; return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)) as [number, number, number]; }
  const f = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*1(?:\.0*)?\s*)?\)$/i.exec(c.trim());
  return f ? [Number(f[1]), Number(f[2]), Number(f[3])] : undefined;
}

const span = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const clipTo = (r: RangePos, to: RangePos): RangePos => ({ top: Math.max(r.top, to.top), left: Math.max(r.left, to.left), bottom: Math.min(r.bottom, to.bottom), right: Math.min(r.right, to.right) });

/** The first cell of a range that is drawn (not hidden), reading row by row. */
function firstShown(r: RangePos, row: (r: number) => boolean, col: (c: number) => boolean): { row: number; col: number } | undefined {
  const rr = span(r.top, r.bottom).find(row), cc = span(r.left, r.right).find(col);
  return rr === undefined || cc === undefined ? undefined : { row: rr, col: cc };
}

/** The data's extent, widened to the merges: A1 for an empty sheet. */
function usedRange(rows: readonly (readonly unknown[])[], merges: readonly RangePos[]): RangePos {
  const bottom = Math.max(rows.length, ...merges.map((m) => m.bottom + 1), 1) - 1;
  const right = Math.max(rows.reduce((m, r) => Math.max(m, r.length), 0), ...merges.map((m) => m.right + 1), 1) - 1;
  return { top: 0, left: 0, bottom, right };
}

/** The errors whose range meets the rendered one, in `check()`'s order — row, column, type, message — then by what else they say, so one review always numbers alike. */
function sortedErrors(list: readonly SheetpaneError[], range: RangePos): { e: SheetpaneError; r: RangePos }[] {
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return list.map((e) => ({ e, r: parseRange(e.range) })).filter((x): x is { e: SheetpaneError; r: RangePos } => !!x.r && rangesIntersect(x.r, range))
    .sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left || cmp(a.e.type, b.e.type) || cmp(a.e.message, b.e.message) || cmp(a.e.range, b.e.range) || cmp(a.e.severity, b.e.severity) || cmp(a.e.status, b.e.status) || cmp(a.e.expected, b.e.expected) || cmp(a.e.author, b.e.author));
}

/** Pictures and charts anchored in the range (by their top-left cell). */
function drawingsIn(list: readonly { kind: string; from?: { row: number; col: number } }[], range: RangePos): number {
  return list.filter((d) => d.kind !== 'shape' && d.from && d.from.row >= range.top && d.from.row <= range.bottom && d.from.col >= range.left && d.from.col <= range.right).length;
}
