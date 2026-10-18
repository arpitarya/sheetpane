// A chart part (`c:chartSpace`, DrawingML charts) → a plain model: the chart groups and their
// type, the title, the series with their `c:f` references and cached points, explicit fills.
// Namespace-agnostic (local names only), so strict and transitional parts read the same.
// Uses DOMParser, so it runs only in a browser — and only when a chart item renders.
import { spError } from '@sheetpane/grid';
import type { ColorSpec } from './colors.js';
import { parseFormulaRefs, uniqueRanges, type SourceRange } from './refs.js';

/** The types stage 2 draws. */
export type DrawKind = 'bar' | 'column' | 'line' | 'pie' | 'doughnut' | 'scatter';
/** How a chart group's series combine: side by side, stacked, stacked to 100 %, or (lines, scatter) as they are. */
export type Grouping = 'clustered' | 'stacked' | 'percentStacked' | 'standard';

/** A reference and what Excel cached for it when it last saved the file. */
export interface DataRef {
  /** The `c:f` formula, as written. */
  f?: string;
  ranges: SourceRange[];
  /** Cached points by index (`c:pt idx`), `ptCount` long; a missing point is `null`. */
  points: (string | number | null)[];
  /** `c:numCache` (true) or `c:strCache` / a literal string list (false). */
  numeric: boolean;
  formatCode?: string;
}

/** One series of a chart part: its name, references and cached points, and explicit colours. */
export interface SeriesModel {
  /** `c:idx` — what default colours count from. */
  idx: number;
  name: string;
  tx?: DataRef;
  /** Categories (`c:cat`) or, for scatter, x values (`c:xVal`). */
  cat?: DataRef;
  /** Values (`c:val`) or, for scatter, y values (`c:yVal`). */
  val?: DataRef;
  fill?: ColorSpec;
  line?: ColorSpec;
  /** `a:ln/a:noFill` on the series: no connecting line (scatter's default look). */
  noLine: boolean;
  /** Per-point fills (`c:dPt`), by point index. */
  pointFills: Map<number, ColorSpec>;
}

/** One chart group of the plot area (`c:barChart`, `c:lineChart` …): its type, layout settings and series. */
export interface GroupModel {
  /** The plot-area element's local name: `barChart`, `lineChart`, `pie3DChart` … */
  element: string;
  kind: DrawKind | undefined;
  /** A short name for the frame: `column`, `stacked bar`, `3-D pie`, `area` … */
  label: string;
  grouping: Grouping;
  varyColors: boolean;
  /** Bars: gap between categories as a percentage of a bar's width (default 150). */
  gapWidth: number;
  /** Doughnut: hole size in percent (default 50). */
  holeSize: number;
  /** Pie: first slice angle in degrees, clockwise from 12 o'clock. */
  firstSliceAng: number;
  scatterStyle: string;
  series: SeriesModel[];
}

/** A chart part read into plain data: title, groups, series, what can be drawn, and the ranges it reads. */
export interface ChartModel {
  /** The chart's title, or `Chart` when it has none. */
  title: string;
  groups: GroupModel[];
  series: SeriesModel[];
  /** `bar`, `stacked column`, `line + column` … — what the frame says. */
  typeLabel: string;
  /** The type stage 2 draws, or undefined: the chart stays a stage-1 frame. */
  drawable: DrawKind | undefined;
  /** Why it is not drawn, when it is not. */
  notDrawn?: string;
  /** A pivot chart (`c:pivotSource`): Excel refreshes it from the pivot table. */
  pivot: boolean;
  /** Every range the series name — names, categories, values — without duplicates. */
  sources: SourceRange[];
  /** The plotted ranges — each series' values, then its categories — what Show source cells selects. */
  plotted: SourceRange[];
  /** The value axis number format (`c:valAx/c:numFmt`), when the file names one. */
  valueFormat?: string;
  /** Where the legend sits (`c:legend/c:legendPos`); `none` when the chart has no legend. */
  legend: 'right' | 'bottom' | 'none';
}

// ── namespace-agnostic helpers ─────────────────────────────────────────────
const kids = (e: Element | undefined, name: string): Element[] => (e ? Array.from(e.children).filter((c) => c.localName === name) : []);
const kid = (e: Element | undefined, name: string): Element | undefined => kids(e, name)[0];
const path = (e: Element | undefined, ...names: string[]): Element | undefined => names.reduce<Element | undefined>((x, n) => kid(x, n), e);
const val = (e: Element | undefined): string | undefined => e?.getAttribute('val') ?? undefined;
const desc = (e: Element | undefined, name: string): Element[] => (e ? Array.from(e.getElementsByTagNameNS('*', name)) : []);
const numVal = (e: Element | undefined, d: number): number => { const v = Number(val(e)); return val(e) !== undefined && Number.isFinite(v) ? v : d; };
const boolVal = (e: Element | undefined, d: boolean): boolean => { const v = val(e); return v === undefined ? (e ? true : d) : v === '1' || v === 'true'; };

function colorOf(fill: Element | undefined): ColorSpec | undefined {
  if (!fill) return undefined;
  for (const c of Array.from(fill.children)) {
    const kind = c.localName === 'srgbClr' ? 'srgb' : c.localName === 'schemeClr' ? 'scheme' : c.localName === 'sysClr' ? 'sys' : undefined;
    if (!kind) continue;
    const v = kind === 'sys' ? c.getAttribute('lastClr') ?? '' : c.getAttribute('val') ?? '';
    const mods = Array.from(c.children).map((m) => ({ name: m.localName, val: Number(m.getAttribute('val')) })).filter((m) => Number.isFinite(m.val));
    return { kind, val: v, mods };
  }
  return undefined;
}

/** Points of a cache or literal (`c:numCache`, `c:strCache`, `c:numLit`, `c:strLit`, a `c:lvl`). */
function points(cache: Element | undefined, numeric: boolean): (string | number | null)[] {
  if (!cache) return [];
  const pts = kids(cache, 'pt');
  const count = Math.max(numVal(kid(cache, 'ptCount'), 0), ...pts.map((p) => Number(p.getAttribute('idx') ?? 0) + 1), 0);
  const out: (string | number | null)[] = Array.from({ length: Math.min(count, 100000) }, () => null);
  for (const p of pts) {
    const i = Number(p.getAttribute('idx') ?? 0), t = kid(p, 'v')?.textContent ?? '';
    if (!(i >= 0 && i < out.length)) continue;
    if (numeric) { const n = Number(t); out[i] = t.trim() !== '' && Number.isFinite(n) ? n : null; } else out[i] = t;
  }
  return out;
}

/** A data source element (`c:tx`, `c:cat`, `c:val`, `c:xVal`, `c:yVal`) → its reference and cache. */
function dataRef(e: Element | undefined): DataRef | undefined {
  if (!e) return undefined;
  const ref = kid(e, 'numRef') ?? kid(e, 'strRef') ?? kid(e, 'multiLvlStrRef');
  if (ref) {
    const f = kid(ref, 'f')?.textContent ?? undefined;
    const numCache = kid(ref, 'numCache');
    const strCache = kid(ref, 'strCache');
    const multi = kid(ref, 'multiLvlStrCache');
    // multi-level categories: the first level is the innermost — the labels next to the axis
    const cache = numCache ?? strCache ?? (multi ? kid(multi, 'lvl') : undefined);
    const ptCount = multi ? kid(multi, 'ptCount') : undefined;
    const pts = points(cache, !!numCache);
    if (ptCount && pts.length < numVal(ptCount, 0)) pts.push(...Array.from({ length: numVal(ptCount, 0) - pts.length }, () => null));
    const d: DataRef = { ranges: parseFormulaRefs(f), points: pts, numeric: !!numCache };
    if (f !== undefined) d.f = f;
    const fc = kid(numCache, 'formatCode')?.textContent;
    if (fc) d.formatCode = fc;
    return d;
  }
  const lit = kid(e, 'numLit') ?? kid(e, 'strLit');
  if (lit) return { ranges: [], points: points(lit, lit.localName === 'numLit'), numeric: lit.localName === 'numLit' };
  const v = kid(e, 'v');
  if (v) return { ranges: [], points: [v.textContent ?? ''], numeric: false };
  return undefined;
}

function series(ser: Element, i: number, scatter: boolean): SeriesModel {
  const tx = dataRef(kid(ser, 'tx'));
  const spPr = kid(ser, 'spPr');
  const ln = kid(spPr, 'ln');
  const s: SeriesModel = {
    idx: numVal(kid(ser, 'idx'), i),
    name: tx?.points.filter((p) => p !== null).join(' ') || `Series ${i + 1}`,
    noLine: !!kid(ln, 'noFill'),
    pointFills: new Map(),
  };
  if (tx) s.tx = tx;
  const cat = dataRef(kid(ser, scatter ? 'xVal' : 'cat') ?? kid(ser, 'cat'));
  const v = dataRef(kid(ser, scatter ? 'yVal' : 'val') ?? kid(ser, 'val'));
  if (cat) s.cat = cat;
  if (v) s.val = v;
  const fill = colorOf(kid(spPr, 'solidFill')), line = colorOf(kid(ln, 'solidFill'));
  if (fill) s.fill = fill;
  if (line) s.line = line;
  for (const dPt of kids(ser, 'dPt')) {
    const c = colorOf(path(dPt, 'spPr', 'solidFill'));
    if (c) s.pointFills.set(numVal(kid(dPt, 'idx'), -1), c);
  }
  return s;
}

const LABELS: Record<string, string> = {
  areaChart: 'area', area3DChart: '3-D area', lineChart: 'line', line3DChart: '3-D line', stockChart: 'stock', radarChart: 'radar',
  scatterChart: 'scatter', pieChart: 'pie', pie3DChart: '3-D pie', doughnutChart: 'doughnut', barChart: 'bar', bar3DChart: '3-D bar',
  ofPieChart: 'pie of pie', surfaceChart: 'surface', surface3DChart: '3-D surface', bubbleChart: 'bubble',
};

function group(e: Element): GroupModel {
  const element = e.localName;
  const scatter = element === 'scatterChart';
  const barDir = val(kid(e, 'barDir')) === 'bar' ? 'bar' : 'col';
  const rawGrouping = val(kid(e, 'grouping'));
  const grouping: Grouping = rawGrouping === 'stacked' || rawGrouping === 'percentStacked' || rawGrouping === 'clustered' ? rawGrouping : element.startsWith('bar') ? 'clustered' : 'standard';
  let kind: DrawKind | undefined;
  if (element === 'barChart') kind = barDir === 'bar' ? 'bar' : 'column';
  else if (element === 'lineChart') kind = 'line';
  else if (element === 'pieChart') kind = 'pie';
  else if (element === 'doughnutChart') kind = 'doughnut';
  else if (scatter) kind = 'scatter';
  let label = LABELS[element] ?? element.replace(/Chart$/, '');
  if (element === 'barChart' || element === 'bar3DChart') {
    const base = `${element === 'bar3DChart' ? '3-D ' : ''}${barDir === 'bar' ? 'bar' : 'column'}`;
    label = grouping === 'stacked' ? `stacked ${base}` : grouping === 'percentStacked' ? `100% stacked ${base}` : base;
  } else if ((element === 'lineChart' || element === 'areaChart') && grouping !== 'standard') {
    label = `${grouping === 'stacked' ? 'stacked' : '100% stacked'} ${label}`;
  }
  return {
    element, kind, label, grouping,
    varyColors: boolVal(kid(e, 'varyColors'), false),
    gapWidth: numVal(kid(e, 'gapWidth'), 150),
    holeSize: numVal(kid(e, 'holeSize'), 50),
    firstSliceAng: numVal(kid(e, 'firstSliceAng'), 0),
    scatterStyle: val(kid(e, 'scatterStyle')) ?? 'marker',
    series: kids(e, 'ser').map((s, i) => series(s, i, scatter)),
  };
}

/** Rich text (`c:rich`) → one line: runs joined, paragraphs joined by a space. */
function richText(rich: Element | undefined): string {
  if (!rich) return '';
  return kids(rich, 'p').map((p) => desc(p, 't').map((t) => t.textContent ?? '').join('')).filter(Boolean).join(' ').trim();
}

function titleOf(chart: Element | undefined, all: SeriesModel[]): string {
  const t = kid(chart, 'title');
  if (t) {
    const tx = kid(t, 'tx');
    const rich = richText(kid(tx, 'rich'));
    if (rich) return rich;
    const ref = dataRef(tx);
    const s = ref?.points.filter((p) => p !== null).join(' ');
    if (s) return s;
    // a title element with no text: Excel shows the only series' name
    if (all.length === 1 && all[0]!.tx) return all[0]!.name;
  } else if (!boolVal(kid(chart, 'autoTitleDeleted'), false) && all.length === 1 && all[0]!.tx) {
    return all[0]!.name;
  }
  return 'Chart';
}

const PLOT_TYPES = new Set(Object.keys(LABELS));

/**
 * Parses a chart part's XML (`c:chartSpace`, by local name, so strict and transitional parts read the same).
 * Uses DOMParser: browser only.
 *
 * @param xml - The chart part's text.
 * @returns The model.
 * @throws When the XML is not well-formed or holds no `chart`.
 */
export function parseChart(xml: string): ChartModel {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw spError('SP-5701', 'sheetpane charts: the chart part is not well-formed XML');
  const root = doc.documentElement;
  const chart = kid(root, 'chart');
  if (!chart) throw spError('SP-5702', 'sheetpane charts: the chart part has no c:chart');
  const plot = kid(chart, 'plotArea');
  const groups = plot ? Array.from(plot.children).filter((c) => PLOT_TYPES.has(c.localName)).map(group) : [];
  const all = groups.flatMap((g) => g.series);
  const pivot = !!kid(root, 'pivotSource');
  const labels = [...new Set(groups.map((g) => g.label))];
  const leg = kid(chart, 'legend'), legendPos = val(kid(leg, 'legendPos')) ?? 'r';
  const m: ChartModel = {
    title: titleOf(chart, all),
    groups,
    series: all,
    typeLabel: labels.join(' + ') || 'chart',
    drawable: undefined,
    pivot,
    sources: uniqueRanges(all.flatMap((s) => [...(s.tx?.ranges ?? []), ...(s.cat?.ranges ?? []), ...(s.val?.ranges ?? [])])),
    plotted: uniqueRanges(all.flatMap((s) => [...(s.val?.ranges ?? []), ...(s.cat?.ranges ?? [])])),
    legend: !leg ? 'none' : legendPos === 'b' || legendPos === 't' ? 'bottom' : 'right',
  };
  const vf = path(plot, 'valAx', 'numFmt')?.getAttribute('formatCode');
  if (vf) m.valueFormat = vf;
  const kinds = new Set(groups.map((g) => g.kind));
  if (pivot) m.notDrawn = 'a pivot chart, refreshed by Excel';
  else if (!groups.length) m.notDrawn = 'no chart type this viewer knows';
  else if (groups.length > 1) m.notDrawn = 'a combination chart';
  else if (kinds.has(undefined)) m.notDrawn = `${m.typeLabel} chart`;
  else if (!all.length) m.notDrawn = 'no series';
  else m.drawable = groups[0]!.kind;
  return m;
}
