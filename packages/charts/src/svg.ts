// Stage 2: bar, column (clustered, stacked, 100 % stacked), line, pie, doughnut and scatter as
// our own SVG markup — no chart library (SR-LAW-2). Pure string building, no DOM, so the
// geometry is testable anywhere. No font is named (SR-LAW-5): text inherits the host's font.
//
// Every mark carries what it stands for (`data-series`, `data-point`, `data-value`, and for
// slices `data-start`/`data-end` in degrees) so tests compare the drawing with the series'
// values, not with pixels.
import type { DrawKind, Grouping } from './model.js';

/** One series as stage 2 draws it: its values and colours. */
export interface PlotSeries {
  name: string;
  /** Fill (bars, slices, markers), `#RRGGBB`. */
  color: string;
  /** Stroke for lines. */
  lineColor: string;
  noLine: boolean;
  values: (number | null)[];
  /** Scatter: x values; `null` where a point has none. */
  xs?: (number | null)[];
  /** Pie and doughnut: one colour per point. */
  pointColors: string[];
}

/** Everything stage 2 needs to draw one chart group. */
export interface PlotData {
  kind: DrawKind;
  grouping: Grouping;
  cats: string[];
  series: PlotSeries[];
  gapWidth: number;
  holeSize: number;
  firstSliceAng: number;
  scatterStyle: string;
  /** The value axis shows percentages (`%` in its number format). */
  percent: boolean;
  legend: 'right' | 'bottom' | 'none';
}

export interface Box { x: number; y: number; width: number; height: number }

/** Space at the top of the frame the title band (title, then type and series count) takes. */
export const HEAD = 42;

export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const n2 = (v: number): string => String(Math.round(v * 100) / 100);
const INK = 'fill:var(--sp-ink,#16171A)';
const INK3 = 'fill:var(--sp-ink-3,#63666E)';
const GRID = 'stroke:var(--sp-line,#E2E2DD)';
const AXIS = 'stroke:var(--sp-line-strong,#CBCBC5)';
const NEG = 'var(--sp-fail,#B42318)';

const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
/**
 * A number for an axis or label: `-9180` → `−9,180` (a true minus), at most two decimals, in the page's locale.
 *
 * @param v - The number.
 * @param percent - Show `v` as a percentage (`0.25` → `25%`).
 * @returns The text.
 */
export function formatNumber(v: number, percent = false): string {
  const x = percent ? v * 100 : v;
  const s = nf.format(Math.abs(x)) + (percent ? '%' : '');
  return x < 0 ? `−${s}` : s;
}

/** Cuts a label to `max` characters with an ellipsis. */
export const clip = (s: string, max: number): string => (max <= 1 ? '' : s.length > max ? `${s.slice(0, Math.max(1, max - 1))}…` : s);

/** An axis: its ends, its step and its tick values. */
export interface Scale { lo: number; hi: number; step: number; ticks: number[] }

/**
 * A "nice" axis: steps of 1, 2, 2.5 or 5 × 10ⁿ covering [lo, hi] in about `count` intervals.
 *
 * @param lo - The lowest value to cover.
 * @param hi - The highest value to cover.
 * @param count - About how many intervals.
 * @returns The scale; at least two ticks.
 */
export function niceScale(lo: number, hi: number, count: number): Scale {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) { lo = 0; hi = 1; }
  if (hi < lo) [lo, hi] = [hi, lo];
  if (hi === lo) { if (lo === 0) hi = 1; else if (lo > 0) lo = 0; else hi = 0; }
  const raw = (hi - lo) / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const fix = (v: number) => Number(v.toPrecision(12));
  const nlo = fix(Math.floor(lo / step + 1e-9) * step), nhi = fix(Math.ceil(hi / step - 1e-9) * step);
  const ticks: number[] = [];
  for (let i = 0; i <= Math.round((nhi - nlo) / step); i++) ticks.push(fix(nlo + i * step));
  return { lo: nlo, hi: nhi === nlo ? fix(nlo + step) : nhi, step, ticks: ticks.length > 1 ? ticks : [nlo, fix(nlo + step)] };
}

/**
 * Excel's automatic axis range, roughly: it includes zero unless the data sit in a narrow band far from it.
 *
 * @param lo - The data's minimum.
 * @param hi - The data's maximum.
 * @returns `[lo, hi]` widened to zero, or unchanged.
 */
export function withZero(lo: number, hi: number): [number, number] {
  if (lo > 0 && hi - lo < hi / 6) return [lo, hi];
  if (hi < 0 && hi - lo < -lo / 6) return [lo, hi];
  return [Math.min(0, lo), Math.max(0, hi)];
}

const finite = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Per category: the value each series contributes once stacking (or 100 % stacking) is applied.
 *
 * @param series - The series.
 * @param cats - How many categories.
 * @param grouping - The group's grouping; `clustered` and `standard` do not stack.
 * @returns Per series, per category: `{ base, top, value }` (`value` `null` for a missing point).
 */
export function stackedValues(series: readonly PlotSeries[], cats: number, grouping: Grouping): { base: number; top: number; value: number | null }[][] {
  const out = series.map(() => [] as { base: number; top: number; value: number | null }[]);
  for (let j = 0; j < cats; j++) {
    const total = grouping === 'percentStacked' ? series.reduce((t, s) => t + Math.abs(finite(s.values[j]) ? s.values[j]! : 0), 0) : 1;
    let pos = 0, neg = 0;
    series.forEach((s, i) => {
      const raw = s.values[j];
      if (!finite(raw)) { out[i]!.push({ base: 0, top: 0, value: null }); return; }
      const v = grouping === 'percentStacked' ? (total ? raw / total : 0) : raw;
      if (grouping === 'stacked' || grouping === 'percentStacked') {
        if (v >= 0) { out[i]!.push({ base: pos, top: pos + v, value: raw }); pos += v; } else { out[i]!.push({ base: neg, top: neg + v, value: raw }); neg += v; }
      } else out[i]!.push({ base: 0, top: v, value: raw });
    });
  }
  return out;
}

const stacked = (g: Grouping) => g === 'stacked' || g === 'percentStacked';
const catCount = (d: PlotData) => Math.max(d.cats.length, ...d.series.map((s) => s.values.length), 0);

interface LegendItem { label: string; color: string; line?: boolean }

function legendItems(d: PlotData): LegendItem[] {
  if (d.kind === 'pie' || d.kind === 'doughnut') {
    const s = d.series[0];
    if (!s) return [];
    return s.values.map((_, j) => ({ label: d.cats[j] ?? String(j + 1), color: s.pointColors[j] ?? s.color })).filter((_, j) => finite(s.values[j]));
  }
  return d.series.map((s) => ({ label: s.name, color: d.kind === 'line' ? s.lineColor : s.color, line: d.kind === 'line' }));
}

/** Lays out the legend and returns the plot box left for the chart. */
function legend(d: PlotData, area: Box, parts: string[]): Box {
  const items = legendItems(d);
  if (d.legend === 'none' || !items.length) return area;
  if (d.legend === 'right' && area.width >= 300) {
    const longest = Math.max(...items.map((i) => i.label.length));
    const w = Math.min(area.width * 0.32, 24 + longest * 6.2);
    const rows = Math.max(1, Math.min(items.length, Math.floor(area.height / 16)));
    const top = area.y + Math.max(0, (area.height - rows * 16) / 2);
    const max = Math.floor((w - 20) / 6.2);
    parts.push('<g class="sp-legend">');
    items.slice(0, rows).forEach((it, i) => {
      const y = top + i * 16, x = area.x + area.width - w + 6;
      parts.push(`<rect x="${n2(x)}" y="${n2(y + 3)}" width="9" height="9" fill="${it.color}" rx="1"/><text x="${n2(x + 14)}" y="${n2(y + 11)}" font-size="11" style="${INK3}">${esc(clip(it.label, max))}</text>`);
    });
    parts.push('</g>');
    return { x: area.x, y: area.y, width: area.width - w, height: area.height };
  }
  // bottom: one row, as many items as fit
  const y = area.y + area.height - 14;
  let x = area.x + 4;
  parts.push('<g class="sp-legend">');
  for (const it of items) {
    const label = clip(it.label, 18), w = 20 + label.length * 6.2;
    if (x + w > area.x + area.width) break;
    parts.push(`<rect x="${n2(x)}" y="${n2(y + 1)}" width="9" height="9" fill="${it.color}" rx="1"/><text x="${n2(x + 13)}" y="${n2(y + 9)}" font-size="11" style="${INK3}">${esc(label)}</text>`);
    x += w + 8;
  }
  parts.push('</g>');
  return { x: area.x, y: area.y, width: area.width, height: area.height - 20 };
}

/** Category labels along an axis, thinned so they do not overlap. */
function catLabels(cats: string[], n: number, at: (j: number) => number, room: number, place: (pos: number, label: string) => string): string {
  if (!n) return '';
  const longest = Math.max(1, ...cats.slice(0, n).map((c) => c.length));
  const every = Math.max(1, Math.ceil((Math.min(longest, 14) * 6 + 6) / Math.max(1, room)));
  const max = Math.max(3, Math.floor((room * every) / 6) - 1);
  let out = '';
  for (let j = 0; j < n; j += every) out += place(at(j), clip(cats[j] ?? String(j + 1), max));
  return out;
}

function valueLabelWidth(s: Scale, percent: boolean): number {
  return 10 + Math.max(...s.ticks.map((t) => formatNumber(t, percent).length)) * 6;
}

function barsAndLines(d: PlotData, plot: Box, parts: string[]): void {
  const n = catCount(d);
  const st = d.kind !== 'line' || d.grouping !== 'standard' ? stacked(d.grouping) : false;
  const vals = stackedValues(d.series, n, st ? d.grouping : 'clustered');
  const flat = vals.flat().filter((v) => v.value !== null);
  let lo = Math.min(0, ...flat.map((v) => Math.min(v.base, v.top))), hi = Math.max(0, ...flat.map((v) => Math.max(v.base, v.top)));
  if (d.kind === 'line' && !st && flat.length) [lo, hi] = withZero(Math.min(...flat.map((v) => v.top)), Math.max(...flat.map((v) => v.top)));
  const percent = d.grouping === 'percentStacked' || d.percent;
  const horizontal = d.kind === 'bar';
  const len = horizontal ? plot.width : plot.height;
  const sc = niceScale(lo, hi, Math.max(2, Math.min(10, Math.floor(len / 30))));
  const left = horizontal ? plot.x + 4 + Math.min(plot.width * 0.35, 8 + Math.min(14, Math.max(1, ...d.cats.map((c) => c.length))) * 6) : plot.x + valueLabelWidth(sc, percent);
  const bottom = plot.y + plot.height - 18;
  const box: Box = { x: left, y: plot.y + 4, width: Math.max(10, plot.x + plot.width - left - 8), height: Math.max(10, bottom - plot.y - 4) };
  const v2p = (v: number) => horizontal ? box.x + ((v - sc.lo) / (sc.hi - sc.lo)) * box.width : box.y + box.height - ((v - sc.lo) / (sc.hi - sc.lo)) * box.height;

  // value axis: gridlines and labels
  parts.push(`<g class="sp-axis sp-axis-value" data-lo="${sc.lo}" data-hi="${sc.hi}">`);
  for (const t of sc.ticks) {
    const p = v2p(t);
    if (horizontal) parts.push(`<line class="sp-grid" x1="${n2(p)}" x2="${n2(p)}" y1="${n2(box.y)}" y2="${n2(box.y + box.height)}" style="${GRID}"/><text class="sp-tick" data-value="${t}" x="${n2(p)}" y="${n2(box.y + box.height + 13)}" font-size="10" text-anchor="middle" style="${INK3}">${esc(formatNumber(t, percent))}</text>`);
    else parts.push(`<line class="sp-grid" x1="${n2(box.x)}" x2="${n2(box.x + box.width)}" y1="${n2(p)}" y2="${n2(p)}" style="${GRID}"/><text class="sp-tick" data-value="${t}" x="${n2(box.x - 5)}" y="${n2(p + 3.5)}" font-size="10" text-anchor="end" style="${INK3}">${esc(formatNumber(t, percent))}</text>`);
  }
  parts.push('</g>');

  // category axis
  const catLen = (horizontal ? box.height : box.width) / Math.max(1, n);
  const catMid = (j: number) => horizontal ? box.y + box.height - (j + 0.5) * catLen : box.x + (j + 0.5) * catLen;
  const zero = v2p(Math.min(Math.max(0, sc.lo), sc.hi));
  parts.push('<g class="sp-axis sp-axis-cat">');
  parts.push(horizontal
    ? `<line x1="${n2(zero)}" x2="${n2(zero)}" y1="${n2(box.y)}" y2="${n2(box.y + box.height)}" style="${AXIS}"/>`
    : `<line x1="${n2(box.x)}" x2="${n2(box.x + box.width)}" y1="${n2(zero)}" y2="${n2(zero)}" style="${AXIS}"/>`);
  parts.push(catLabels(d.cats, n, catMid, catLen, (pos, label) => horizontal
    ? `<text class="sp-cat" x="${n2(box.x - 5)}" y="${n2(pos + 3.5)}" font-size="10" text-anchor="end" style="${INK3}">${esc(label)}</text>`
    : `<text class="sp-cat" x="${n2(pos)}" y="${n2(box.y + box.height + 13)}" font-size="10" text-anchor="middle" style="${INK3}">${esc(label)}</text>`));
  parts.push('</g>');

  if (d.kind === 'line') {
    d.series.forEach((s, i) => {
      const pts = vals[i]!.map((v, j) => (v.value === null ? null : { x: catMid(j), y: v2p(v.top), v: v.value, j }));
      let path = '', pen = false;
      for (const p of pts) { if (!p) { pen = false; continue; } path += `${pen ? 'L' : 'M'}${n2(p.x)} ${n2(p.y)}`; pen = true; }
      parts.push(`<g class="sp-series" data-series="${i}">`);
      if (path && !s.noLine) parts.push(`<path class="sp-line" d="${path}" fill="none" stroke="${s.lineColor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
      for (const p of pts) if (p) parts.push(`<circle class="sp-point" data-series="${i}" data-point="${p.j}" data-value="${p.v}" cx="${n2(p.x)}" cy="${n2(p.y)}" r="2.75" fill="${s.lineColor}"/>`);
      parts.push('</g>');
    });
    return;
  }

  // bars
  const gap = Math.max(0, d.gapWidth) / 100;
  const k = st ? 1 : Math.max(1, d.series.length);
  const thick = catLen / (k + gap);
  d.series.forEach((s, i) => {
    parts.push(`<g class="sp-series" data-series="${i}">`);
    vals[i]!.forEach((v, j) => {
      if (v.value === null) return;
      const a = v2p(v.base), b = v2p(v.top);
      const offset = (thick * gap) / 2 + (st ? 0 : i * thick);
      const fill = v.value < 0 ? `style="fill:${NEG}"` : `fill="${s.color}"`;
      const common = `class="sp-bar" data-series="${i}" data-point="${j}" data-value="${v.value}" ${fill}`;
      if (horizontal) {
        const bandBottom = box.y + box.height - j * catLen;
        parts.push(`<rect ${common} x="${n2(Math.min(a, b))}" y="${n2(bandBottom - offset - thick)}" width="${n2(Math.abs(b - a))}" height="${n2(thick)}"/>`);
      } else {
        parts.push(`<rect ${common} x="${n2(box.x + j * catLen + offset)}" y="${n2(Math.min(a, b))}" width="${n2(thick)}" height="${n2(Math.abs(b - a))}"/>`);
      }
    });
    parts.push('</g>');
  });
}

/** A point on a circle: 0° at 12 o'clock, clockwise. */
const polar = (cx: number, cy: number, r: number, deg: number) => ({ x: cx + r * Math.sin((deg * Math.PI) / 180), y: cy - r * Math.cos((deg * Math.PI) / 180) });

function slicePath(cx: number, cy: number, r: number, inner: number, a0: number, a1: number): string {
  if (a1 - a0 >= 359.999) {
    // a whole ring: two half arcs
    const o = `M${n2(cx)} ${n2(cy - r)}A${n2(r)} ${n2(r)} 0 1 1 ${n2(cx)} ${n2(cy + r)}A${n2(r)} ${n2(r)} 0 1 1 ${n2(cx)} ${n2(cy - r)}Z`;
    return inner > 0 ? `${o}M${n2(cx)} ${n2(cy - inner)}A${n2(inner)} ${n2(inner)} 0 1 0 ${n2(cx)} ${n2(cy + inner)}A${n2(inner)} ${n2(inner)} 0 1 0 ${n2(cx)} ${n2(cy - inner)}Z` : o;
  }
  const large = a1 - a0 > 180 ? 1 : 0;
  const p0 = polar(cx, cy, r, a0), p1 = polar(cx, cy, r, a1);
  if (inner <= 0) return `M${n2(cx)} ${n2(cy)}L${n2(p0.x)} ${n2(p0.y)}A${n2(r)} ${n2(r)} 0 ${large} 1 ${n2(p1.x)} ${n2(p1.y)}Z`;
  const q0 = polar(cx, cy, inner, a0), q1 = polar(cx, cy, inner, a1);
  return `M${n2(p0.x)} ${n2(p0.y)}A${n2(r)} ${n2(r)} 0 ${large} 1 ${n2(p1.x)} ${n2(p1.y)}L${n2(q1.x)} ${n2(q1.y)}A${n2(inner)} ${n2(inner)} 0 ${large} 0 ${n2(q0.x)} ${n2(q0.y)}Z`;
}

function pie(d: PlotData, plot: Box, parts: string[]): void {
  const s = d.series[0];
  if (!s) return;
  const total = s.values.reduce<number>((t, v) => t + (finite(v) ? Math.abs(v) : 0), 0);
  const cx = plot.x + plot.width / 2, cy = plot.y + plot.height / 2, r = Math.max(4, Math.min(plot.width, plot.height) / 2 - 6);
  const inner = d.kind === 'doughnut' ? (r * Math.min(90, Math.max(10, d.holeSize))) / 100 : 0;
  let a = d.firstSliceAng;
  parts.push(`<g class="sp-series" data-series="0" data-cx="${n2(cx)}" data-cy="${n2(cy)}" data-r="${n2(r)}">`);
  s.values.forEach((v, j) => {
    if (!finite(v) || v === 0 || !total) return;
    const sweep = (Math.abs(v) / total) * 360;
    parts.push(`<path class="sp-slice" data-series="0" data-point="${j}" data-value="${v}" data-start="${n2(a)}" data-end="${n2(a + sweep)}" d="${slicePath(cx, cy, r, inner, a, a + sweep)}" fill="${s.pointColors[j] ?? s.color}" fill-rule="evenodd" style="stroke:var(--sp-surface,#FFFFFF);stroke-width:1"/>`);
    a += sweep;
  });
  parts.push('</g>');
}

function scatter(d: PlotData, plot: Box, parts: string[]): void {
  const pts = d.series.map((s) => s.values.map((y, j) => {
    const x = s.xs ? s.xs[j] : j + 1;
    return finite(y) && finite(x) ? { x, y, j } : null;
  }));
  const all = pts.flat().filter((p): p is { x: number; y: number; j: number } => !!p);
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  const [xlo, xhi] = withZero(Math.min(...xs, Infinity), Math.max(...xs, -Infinity));
  const [ylo, yhi] = withZero(Math.min(...ys, Infinity), Math.max(...ys, -Infinity));
  const sy = niceScale(all.length ? ylo : 0, all.length ? yhi : 1, Math.max(2, Math.min(10, Math.floor(plot.height / 30))));
  const left = plot.x + valueLabelWidth(sy, d.percent);
  const box: Box = { x: left, y: plot.y + 4, width: Math.max(10, plot.x + plot.width - left - 10), height: Math.max(10, plot.y + plot.height - 18 - plot.y - 4) };
  const sx = niceScale(all.length ? xlo : 0, all.length ? xhi : 1, Math.max(2, Math.min(10, Math.floor(box.width / 60))));
  const X = (v: number) => box.x + ((v - sx.lo) / (sx.hi - sx.lo)) * box.width;
  const Y = (v: number) => box.y + box.height - ((v - sy.lo) / (sy.hi - sy.lo)) * box.height;
  parts.push(`<g class="sp-axis sp-axis-value" data-lo="${sy.lo}" data-hi="${sy.hi}">`);
  for (const t of sy.ticks) parts.push(`<line class="sp-grid" x1="${n2(box.x)}" x2="${n2(box.x + box.width)}" y1="${n2(Y(t))}" y2="${n2(Y(t))}" style="${GRID}"/><text class="sp-tick" data-value="${t}" x="${n2(box.x - 5)}" y="${n2(Y(t) + 3.5)}" font-size="10" text-anchor="end" style="${INK3}">${esc(formatNumber(t, d.percent))}</text>`);
  parts.push('</g>');
  parts.push(`<g class="sp-axis sp-axis-x" data-lo="${sx.lo}" data-hi="${sx.hi}">`);
  parts.push(`<line x1="${n2(box.x)}" x2="${n2(box.x + box.width)}" y1="${n2(box.y + box.height)}" y2="${n2(box.y + box.height)}" style="${AXIS}"/>`);
  for (const t of sx.ticks) parts.push(`<text class="sp-tick" data-value="${t}" x="${n2(X(t))}" y="${n2(box.y + box.height + 13)}" font-size="10" text-anchor="middle" style="${INK3}">${esc(formatNumber(t))}</text>`);
  parts.push('</g>');
  const lines = /line|smooth/i.test(d.scatterStyle);
  const markers = !/^(line|smooth)$/i.test(d.scatterStyle);
  d.series.forEach((s, i) => {
    parts.push(`<g class="sp-series" data-series="${i}">`);
    const ps = pts[i]!.filter((p): p is { x: number; y: number; j: number } => !!p);
    if (lines && !s.noLine && ps.length > 1) parts.push(`<path class="sp-line" d="${ps.map((p, k) => `${k ? 'L' : 'M'}${n2(X(p.x))} ${n2(Y(p.y))}`).join('')}" fill="none" stroke="${s.lineColor}" stroke-width="2"/>`);
    for (const p of ps) parts.push(`<circle class="sp-point" data-series="${i}" data-point="${p.j}" data-value="${p.y}" data-x="${p.x}" cx="${n2(X(p.x))}" cy="${n2(Y(p.y))}" r="${markers ? 3 : 0}" fill="${s.color}"/>`);
    parts.push('</g>');
  });
}

/** The note a frame carries once a plotted cell was changed. */
export const CHANGED_TAG = 'data changed — Excel will redraw';
const TAG_W = 14 + CHANGED_TAG.length * 5.6;

/**
 * The title band: the title in bold (the frame's HTML button sits to its right), the type and
 * series count under it, then — once a plotted cell changed — the tag, on the same line when it
 * fits, else on a line of its own. Returns the markup and where the plot may start.
 */
export function titleBand(title: string, meta: string, width: number, changed = false): { svg: string; bottom: number } {
  const t = clip(title, Math.max(8, Math.floor((width - 140) / 7.4)));
  const m = clip(meta, Math.max(8, Math.floor((width - 16) / 6.2)));
  let svg = `<text class="sp-chart-title" x="8" y="18" font-size="13" font-weight="600" style="${INK}">${esc(t)}</text>`
    + `<text class="sp-chart-meta" x="8" y="34" font-size="11" style="${INK3}">${esc(m)}</text>`;
  let bottom = HEAD;
  if (changed) {
    const after = 8 + m.length * 6.2 + 10;
    const inline = after + TAG_W <= width - 6;
    const x = inline ? after : 8, y = inline ? 23 : 41;
    if (!inline) bottom += 20;
    svg += `<g class="sp-chart-tag"><rect x="${n2(x)}" y="${y}" width="${n2(TAG_W)}" height="16" rx="8" style="fill:var(--sp-changed-soft,#FDF1E3)"/>`
      + `<text x="${n2(x + 7)}" y="${y + 11.5}" font-size="10" font-weight="500" style="fill:var(--sp-changed,#C46A00)">${esc(CHANGED_TAG)}</text></g>`;
  }
  return { svg, bottom };
}

const svgOpen = (w: number, h: number, label: string, attrs: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" class="sp-chart-svg" viewBox="0 0 ${n2(w)} ${n2(h)}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(label)}" ${attrs} style="display:block;overflow:hidden"><title>${esc(label)}</title>`;

/**
 * Stage 2: the whole drawn chart as SVG markup, `width` × `height` in px at 100 % zoom. No font is named; every
 * file string is escaped.
 *
 * @param d - What to draw.
 * @param title - The chart's title.
 * @param meta - The line under the title, e.g. `bar · 2 series`.
 * @param width - Width in px.
 * @param height - Height in px.
 * @param attrs - Extra attributes for the `<svg>` element.
 * @param changed - Show the "data changed — Excel will redraw" tag.
 * @returns The `<svg>` markup.
 */
export function drawChart(d: PlotData, title: string, meta: string, width: number, height: number, attrs = '', changed = false): string {
  const band = titleBand(title, meta, width, changed);
  const parts: string[] = [svgOpen(width, height, title, `data-kind="${d.kind}" data-stage="2" ${attrs}`), band.svg];
  const area: Box = { x: 4, y: band.bottom, width: Math.max(10, width - 8), height: Math.max(10, height - band.bottom - 4) };
  const plot = legend(d, area, parts);
  parts.push('<g class="sp-plot">');
  if (d.kind === 'pie' || d.kind === 'doughnut') pie(d, plot, parts);
  else if (d.kind === 'scatter') scatter(d, plot, parts);
  else barsAndLines(d, plot, parts);
  parts.push('</g></svg>');
  return parts.join('');
}

/**
 * Stage 1: the frame's content as SVG markup — title, type and series count, and as many of `lines` as fit under it.
 *
 * @param title - The chart's title.
 * @param meta - The line under the title, e.g. `bar · 2 series`.
 * @param lines - The lines to list (why it is not drawn, each series and the cells it reads).
 * @param width - Width in px.
 * @param height - Height in px.
 * @param attrs - Extra attributes for the `<svg>` element.
 * @param changed - Show the "data changed — Excel will redraw" tag.
 * @returns The `<svg>` markup.
 */
export function frameSvg(title: string, meta: string, lines: string[], width: number, height: number, attrs = '', changed = false): string {
  const band = titleBand(title, meta, width, changed);
  const parts = [svgOpen(width, height, title, `data-stage="1" ${attrs}`), band.svg];
  const max = Math.max(4, Math.floor((width - 16) / 6.3));
  lines.slice(0, Math.max(0, Math.floor((height - band.bottom - 6) / 16))).forEach((l, i) => {
    parts.push(`<text class="sp-chart-line" x="8" y="${n2(band.bottom + 14 + i * 16)}" font-size="11" style="${INK3}">${esc(clip(l, max))}</text>`);
  });
  parts.push('</svg>');
  return parts.join('');
}
