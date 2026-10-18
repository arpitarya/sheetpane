// @sheetpane/charts — the charts in a workbook, drawn in sheet space through the `overlay` hook
// (W-21). Stage 1: a frame at the chart's anchor with its title, type and series count, a
// **Show source cells** button, and a "data changed — Excel will redraw" tag once a plotted cell
// was edited. Stage 2: bar, column, line, pie, doughnut and scatter drawn as our own SVG.
// View only: patch-mode export copies the chart parts byte for byte, so Excel redraws them from
// the (possibly changed) cells. Importing is safe in Node: no DOM until an item renders.
import { registerPlugin, type Geometry, type OverlayItem, type Plugin, type PluginContext, type Snapshot } from '@sheetpane/grid';
import { anchorRect, cellAt, type Rect } from '@sheetpane/images';
import { defaultColor, resolveColor } from './colors.js';
import { parseChart, type ChartModel, type SeriesModel } from './model.js';
import { cellRef, cellsOf, contains, parseCell, qualified, selectionFor, type SourceRange } from './refs.js';
import { drawChart, frameSvg, type PlotData, type PlotSeries } from './svg.js';

export { parseChart } from './model.js';
export type { ChartModel, SeriesModel, GroupModel, DataRef, DrawKind, Grouping } from './model.js';
export { parseFormulaRefs, selectionFor, qualified, cellsOf, type SourceRange } from './refs.js';

export { resolveColor, defaultColor, accents, modify, OFFICE_ACCENTS, type ColorSpec } from './colors.js';
export { drawChart, frameSvg, niceScale, stackedValues, formatNumber, withZero, HEAD, CHANGED_TAG, type PlotData, type PlotSeries, type Scale } from './svg.js';

/** The plugin's id, and the name `plugins="…"` takes. */
export const PLUGIN_ID = 'charts';

type Book = PluginContext['book'];
type Store = PluginContext['store'];
type Drawing = Book['sheets'][number]['drawings'][number];

/** Options for {@link charts}. */
export interface ChartsOptions {
  /** `false` keeps every chart a stage-1 frame (no SVG plot). Default `true`. */
  draw?: boolean;
}

// ── models: each chart part parsed once per workbook, on first ask ─────────────
const pending = new WeakMap<Book, Map<string, Promise<ChartModel | undefined>>>();
const parsed = new WeakMap<Book, Map<string, ChartModel | null>>();

/**
 * The parsed chart part, read through `book.part()` on first ask and cached per workbook.
 *
 * @param book - The workbook.
 * @param path - The chart part's path, e.g. `xl/charts/chart1.xml`.
 * @returns The model; `undefined` when the part is missing or unreadable.
 */
export function chartModel(book: Book, path: string): Promise<ChartModel | undefined> {
  let byPath = pending.get(book);
  if (!byPath) { byPath = new Map(); pending.set(book, byPath); }
  let p = byPath.get(path);
  if (!p) {
    p = (async () => {
      let model: ChartModel | undefined;
      try {
        const bytes = await book.part(path);
        if (bytes) model = parseChart(new TextDecoder().decode(bytes));
      } catch { model = undefined; }
      let done = parsed.get(book);
      if (!done) { done = new Map(); parsed.set(book, done); }
      done.set(path, model ?? null);
      return model;
    })();
    byPath.set(path, p);
  }
  return p;
}

/**
 * The chart model if it is parsed already, without reading anything.
 *
 * @param book - The workbook.
 * @param path - The chart part's path.
 * @returns The model, `null` (unreadable) or `undefined` (not read yet).
 */
export function chartModelNow(book: Book, path: string): ChartModel | null | undefined {
  return parsed.get(book)?.get(path);
}

/**
 * The chart drawings of a sheet, with their index among the sheet's drawings.
 *
 * @param book - The workbook, or `undefined`.
 * @param sheet - The sheet's name.
 * @returns One `{ drawing, index, path }` per chart; empty for none.
 */
export function chartsOn(book: Book | undefined, sheet: string): { drawing: Drawing; index: number; path: string }[] {
  const s = book?.sheets.find((x) => x.name === sheet);
  if (!s) return [];
  return s.drawings.flatMap((d, index) => (d.kind === 'chart' && d.chart ? [{ drawing: d, index, path: d.chart }] : []));
}

// ── data: cached points, or the live cells when a `derive` plugin is installed ──
const asNumber = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** True when the pane computes formulas (a `derive` plugin), so the cells are live. */
export const isLive = (store: Store): boolean => store.plugins.some((p) => p.provides.includes('derive'));

function readable(book: Book, ranges: readonly SourceRange[]): boolean {
  return ranges.length > 0 && ranges.every((r) => book.sheets.some((s) => s.name === r.sheet));
}

function liveNumbers(store: Store, ranges: readonly SourceRange[]): (number | null)[] {
  return cellsOf(ranges).map((c) => asNumber(store.value(c.sheet, c.ref)));
}

/**
 * What stage 2 draws: the chart's one group, its series coloured and valued — the cached points, or the live cells
 * when `live` and the ranges are readable.
 *
 * @param m - The chart model.
 * @param book - The workbook (its theme and sheets).
 * @param store - The store, for live values; `undefined` uses the cache.
 * @param live - Whether the pane computes formulas (a `derive` plugin), so the cells are current.
 * @returns The plot data, or `undefined` when the chart is not drawable.
 */
export function plotData(m: ChartModel, book: Book, store: Store | undefined, live: boolean): PlotData | undefined {
  const g = m.groups[0];
  if (!m.drawable || !g) return undefined;
  const theme = book.themeColors;
  const useLive = (ranges: readonly SourceRange[] | undefined): ranges is SourceRange[] => !!store && live && !!ranges && readable(book, ranges);
  const catsOf = (s: SeriesModel | undefined): string[] => {
    if (!s?.cat) return [];
    if (useLive(s.cat.ranges)) return cellsOf(s.cat.ranges).map((c) => store!.text(c.sheet, c.ref));
    return s.cat.points.map((p) => (p === null ? '' : String(p)));
  };
  const series: PlotSeries[] = g.series.map((s, i) => {
    const values = s.val ? (useLive(s.val.ranges) ? liveNumbers(store!, s.val.ranges) : s.val.points.map(asNumber)) : [];
    const name = s.tx && useLive(s.tx.ranges) ? cellsOf(s.tx.ranges).map((c) => store!.text(c.sheet, c.ref)).join(' ') || s.name : s.name;
    const fallback = defaultColor(Number.isFinite(s.idx) ? s.idx : i, theme);
    const color = resolveColor(s.fill, theme) ?? (m.drawable === 'line' ? resolveColor(s.line, theme) : undefined) ?? fallback;
    const lineColor = resolveColor(s.line, theme) ?? color;
    const pointColors = values.map((_, j) => resolveColor(s.pointFills.get(j), theme) ?? (g.varyColors ? defaultColor(j, theme) : color));
    const ps: PlotSeries = { name, color, lineColor, noLine: s.noLine, values, pointColors };
    if (m.drawable === 'scatter' && s.cat) {
      const xs = useLive(s.cat.ranges) ? liveNumbers(store!, s.cat.ranges) : s.cat.numeric ? s.cat.points.map(asNumber) : undefined;
      // text x values: Excel plots such a series against 1, 2, 3 …
      if (xs && xs.some((x) => x !== null)) ps.xs = xs;
    }
    return ps;
  });
  return {
    kind: m.drawable, grouping: g.grouping, cats: catsOf(g.series.find((s) => s.cat) ?? g.series[0]), series,
    gapWidth: g.gapWidth, holeSize: g.holeSize, firstSliceAng: g.firstSliceAng, scatterStyle: g.scatterStyle,
    percent: !!m.valueFormat?.includes('%'), legend: m.legend,
  };
}

/**
 * Whether a user changed a value inside one of the ranges (snapshot `changes`, kinds `value` and `formula`).
 *
 * @param snap - A snapshot of the store.
 * @param ranges - The ranges a chart reads.
 * @returns `true` when at least one such change lies in them.
 */
export function changedInside(snap: Snapshot, ranges: readonly SourceRange[]): boolean {
  if (!ranges.length) return false;
  for (const [k, c] of snap.changes) {
    if (c.kind !== 'value' && c.kind !== 'formula') continue;
    const i = k.lastIndexOf('!'), p = parseCell(k.slice(i + 1));
    if (p && ranges.some((r) => contains(r, k.slice(0, i), p.row, p.col))) return true;
  }
  return false;
}

/**
 * The chart's plotted ranges that exist in this workbook, as one selection (see {@link selectionFor}).
 *
 * @param m - The chart model.
 * @param book - The workbook.
 * @returns A selection for `store.select()`, or `undefined` when the data is literal or names no sheet here.
 */
export function sourceSelection(m: ChartModel, book: Book): { sheet: string; ref: string; range?: string } | undefined {
  return selectionFor(m.plotted.filter((r) => book.sheets.some((s) => s.name === r.sheet)));
}

/**
 * Shows a chart's source: selects the union of its plotted ranges (or the first one — see {@link selectionFor}).
 *
 * @param store - The workbook store.
 * @param m - The chart model.
 * @returns `true` when something was selected; `false` when there was nothing to select.
 */
export function showSource(store: Store, m: ChartModel): boolean {
  const book = store.book;
  const sel = book && sourceSelection(m, book);
  if (!sel) return false;
  store.select(sel);
  return true;
}

/** `bar · 2 series`. */
export const metaOf = (m: ChartModel): string => `${m.typeLabel} · ${m.series.length} series`;

/** Stage-1 lines: why it is not drawn, then each series and the cells it reads. */
function frameLines(m: ChartModel): string[] {
  const lines = m.notDrawn ? [`Not drawn here: ${m.notDrawn}.`] : [];
  for (const s of m.series) {
    const refs = [...(s.cat?.ranges ?? []), ...(s.val?.ranges ?? [])].map(qualified).join(', ');
    lines.push(`${s.name}${refs ? ` — ${refs}` : ' — values stored in the chart'}`);
  }
  return lines;
}

// ── the overlay item ────────────────────────────────────────────────────────────
/** Each workbook gets a number, so item ids never repeat across two loads (the grid caches rendered items by id). */
const generations = new WeakMap<object, number>();
let nextGeneration = 1;
const generationOf = (book: Book): number => {
  let g = generations.get(book);
  if (!g) { g = nextGeneration++; generations.set(book, g); }
  return g;
};

const FRAME = 'position:relative;box-sizing:border-box;width:100%;height:100%;overflow:hidden;background:var(--sp-surface,#FFFFFF);border:1px solid var(--sp-line-strong,#CBCBC5);border-radius:2px;color:var(--sp-ink,#16171A)';
const BUTTON = 'height:22px;padding:0 8px;font-size:11px;font-weight:500;line-height:1;white-space:nowrap;border:1px solid var(--sp-line-strong,#CBCBC5);border-radius:var(--sp-r-sm,4px);background:var(--sp-surface,#FFFFFF);color:var(--sp-ink-2,#45484F);cursor:pointer';

function renderChart(d: Drawing & { chart: string }, rect: Rect, sheet: string, ctx: PluginContext & { geometry: Geometry }, draw: boolean): HTMLElement {
  const book = ctx.book, store = ctx.store, path = d.chart;
  const W = rect.width, H = rect.height;
  const fallbackTitle = d.descr || d.name || 'Chart';
  const root = document.createElement('div');
  root.className = 'sp-chart';
  root.dataset.chart = path;
  root.dataset.state = 'pending';
  root.style.cssText = FRAME;
  const art = document.createElement('div');
  art.className = 'sp-chart-art';
  art.style.cssText = 'position:absolute;inset:0';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sp-chart-src';
  button.textContent = 'Show source cells';
  button.style.cssText = `position:absolute;top:4px;right:4px;${BUTTON}`;
  root.append(art, button);
  art.innerHTML = frameSvg(fallbackTitle, 'reading the chart…', [], W, H);

  let model: ChartModel | undefined;
  let drawn = '';
  let changed = false;
  const live = isLive(store);

  const paint = () => {
    if (!model) return;
    const data = draw ? plotData(model, book, store, live) : undefined;
    const attrs = `data-values="${data && live ? 'live' : 'cache'}"`;
    const html = data ? drawChart(data, model.title, metaOf(model), W, H, attrs, changed) : frameSvg(model.title, metaOf(model), frameLines(model), W, H, attrs, changed);
    if (html !== drawn) { art.innerHTML = html; drawn = html; }
    root.dataset.stage = data ? '2' : '1';
    root.dataset.changed = String(changed);
  };
  let lastChanges: Snapshot['changes'] | undefined, lastDerived: Snapshot['derived'] | undefined;
  const update = () => {
    if (!model) return;
    const snap = store.getSnapshot();
    if (snap.changes === lastChanges && snap.derived === lastDerived) return;
    const was = changed;
    if (snap.changes !== lastChanges) changed = changedInside(snap, model.sources);
    if (changed !== was || live) paint();
    lastChanges = snap.changes;
    lastDerived = snap.derived;
  };
  // Lives as long as the workbook: the grid drops every item when another one loads.
  const unsubscribe = store.subscribe(() => {
    if (store.book !== book) { unsubscribe(); return; }
    update();
  });

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    void chartModel(book, path).then((m) => { if (m && store.book === book) showSource(store, m); });
  });
  // Edit: a click on the chart (not its button) selects the cell under it, so that cell can be flagged.
  root.addEventListener('click', (e) => {
    if ((e.target as Element).closest('button') || store.getSnapshot().mode !== 'edit') return;
    const r = root.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const c = cellAt(ctx.geometry, rect.x + ((e.clientX - r.left) / r.width) * rect.width, rect.y + ((e.clientY - r.top) / r.height) * rect.height);
    store.select({ sheet, ref: cellRef(c.row, c.col) });
  });

  void chartModel(book, path).then((m) => {
    if (store.book !== book) return;
    if (!m) {
      root.dataset.state = 'missing';
      root.dataset.stage = '1';
      button.disabled = true;
      art.innerHTML = frameSvg(fallbackTitle, 'chart', ['The chart part could not be read — Excel still has it.'], W, H);
      return;
    }
    model = m;
    root.dataset.state = 'ready';
    root.dataset.type = m.groups.map((g) => g.element).join(' ');
    root.dataset.series = String(m.series.length);
    if (!sourceSelection(m, book)) { button.disabled = true; button.title = 'This chart’s data is stored in the chart, not in cells'; }
    else button.title = `Select ${m.plotted.map(qualified).join(', ')}`;
    // The grid names the item from `alt` before the part is read; the title replaces it once known.
    // the next overlay pass names the item from `alt`; until then, name it now that the title is known
    const wrapper = root.parentElement;
    if (wrapper?.classList.contains('olay')) wrapper.setAttribute('aria-label', m.title);
    paint();
    update();
  });
  return root;
}

/** The last geometry the grid gave for each sheet of a workbook — what `chartAt` places anchors with. */
const geometries = new WeakMap<Book, Map<string, Geometry>>();

/**
 * The chart whose frame covers the middle of a cell (the topmost), once the grid has drawn that sheet.
 *
 * @param book - The workbook, or `undefined`.
 * @param sheet - The sheet's name.
 * @param row - The cell's row, 0-based.
 * @param col - The cell's column, 0-based.
 * @returns `{ path, index }` of the chart, or `undefined`.
 */
export function chartAt(book: Book | undefined, sheet: string, row: number, col: number): { path: string; index: number } | undefined {
  const g = book && geometries.get(book)?.get(sheet);
  if (!g) return undefined;
  const x = g.colX(col) + g.colWidth(col) / 2, y = g.rowY(row) + g.rowHeight(row) / 2;
  const hits = chartsOn(book, sheet).filter(({ drawing }) => {
    const r = anchorRect(drawing, g);
    return !!r && x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
  });
  const top = hits[hits.length - 1]; // the last drawn is on top
  return top && { path: top.path, index: top.index };
}

/**
 * The chart items of one sheet, with their rectangles in sheet space: one item per chart drawing with an area.
 *
 * @param sheet - The sheet's name.
 * @param ctx - The plugin context with the grid's geometry, as the `overlay` hook receives it.
 * @param o - The plugin's options (`draw: false` keeps every chart a frame).
 * @returns The overlay items.
 */
export function chartItems(sheet: string, ctx: PluginContext & { geometry: Geometry }, o: ChartsOptions = {}): OverlayItem[] {
  let bySheet = geometries.get(ctx.book);
  if (!bySheet) { bySheet = new Map(); geometries.set(ctx.book, bySheet); }
  bySheet.set(sheet, ctx.geometry);
  const gen = generationOf(ctx.book);
  const items: OverlayItem[] = [];
  for (const { drawing, index, path } of chartsOn(ctx.book, sheet)) {
    const rect = anchorRect(drawing, ctx.geometry);
    if (!rect || rect.width <= 0 || rect.height <= 0) continue;
    void chartModel(ctx.book, path);
    const known = chartModelNow(ctx.book, path);
    const d = { ...drawing, chart: path };
    items.push({
      id: `chart:${gen}:${index}:${path}`, sheet, rect,
      alt: known?.title ?? (drawing.descr || drawing.name || 'Chart'),
      role: 'group', // the frame holds a button (Show source cells); the drawing inside is the role="img"
      render: () => renderChart(d, rect, sheet, ctx, o.draw !== false),
    });
  }
  return items;
}

/**
 * The charts plugin: draws each chart of the workbook at its anchor through the `overlay` hook, view only. Every
 * chart gets a frame with its title, type and series count and a Show source cells button; bar, column, line, pie,
 * doughnut and scatter charts are drawn as SVG (no chart library, no font named), from the cached points or, with a
 * `derive` plugin such as `@sheetpane/formulas`, the live cells. A "data changed — Excel will redraw" tag shows once a
 * plotted cell is edited. Export copies the chart parts unchanged. Importing this module registers it as `charts`;
 * add `ui()` from `@sheetpane/charts/ui` for the status line and the shortcut.
 *
 * @param o - `draw: false` keeps every chart a frame.
 * @returns The plugin (`id: 'charts'`).
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0113_CHARTS.md
 * @example
 * ```ts
 * import { createWorkbook } from '@sheetpane/grid';
 * import { charts } from '@sheetpane/charts';
 * import { formulas } from '@sheetpane/formulas';
 *
 * const book = createWorkbook({ plugins: [charts(), formulas()] });
 * await book.load(bytes, 'dashboard.xlsx');
 * ```
 * @example
 * ```ts
 * import '@sheetpane/charts'; // registers `charts`
 * excel.setAttribute('plugins', 'charts');
 * ```
 */
export function charts(o: ChartsOptions = {}): Plugin {
  return {
    id: PLUGIN_ID,
    provides: ['overlay'],
    overlay: (sheet, ctx) => chartItems(sheet, ctx, o),
  };
}

registerPlugin(PLUGIN_ID, () => charts());
