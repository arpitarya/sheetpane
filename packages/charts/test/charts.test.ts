// The plugin in the grid: frames at their anchors (stage 1), Show source cells, the data-changed
// tag, the drawn types (stage 2) compared with the series' values, zoom, names, export.
import { afterEach, describe, expect, it } from 'vitest';
import { createWorkbook, type Plugin, type SheetpaneExcel, type WorkbookStore } from '@sheetpane/grid';
import { inflateEntry, readZip } from '@sheetpane/export';
import { CHANGED_TAG, charts, type ChartsOptions } from '../src/index.js';
import { ui } from '../src/ui.js';
import { cellEl, chartBook, chartEl, chartXml, cleanup, costs, frame, mount, olay, olays, sales, SALES, COSTS, shadow, svgOf, THEME_ACCENTS, until, XS, type ChartSpec, type Placed } from './helpers.js';

afterEach(cleanup);

const AT: Pick<Placed, 'from' | 'to'> = { from: [5, 0, 1, 0], to: [11, 0, 16, 0] }; // F2 to L17
const ready = (el: Element) => olays(el).length > 0 && olays(el).every((o) => o.querySelector('.sp-chart')?.getAttribute('data-state') !== 'pending');

async function open(placed: Placed[], o: { plugins?: Plugin[]; opts?: ChartsOptions; book?: Parameters<typeof chartBook>[1] } = {}): Promise<{ el: SheetpaneExcel; store: WorkbookStore }> {
  const el = mount();
  const store = createWorkbook({ plugins: o.plugins ?? [charts(o.opts)] });
  el.workbook = store;
  await store.load(await chartBook(placed, o.book), 'c.xlsx');
  await frame();
  await until(() => ready(el));
  return { el, store };
}
const one = (chart: ChartSpec, o: Parameters<typeof open>[1] = {}) => open([{ chart, ...AT }], o);
const rect = (e: Element) => e.getBoundingClientRect();
const num = (e: Element, a: string) => Number(e.getAttribute(a));
const marks = (el: Element, sel: string, n = 0) => Array.from(svgOf(el, n).querySelectorAll<SVGGraphicsElement>(sel));
const bySeries = (list: SVGGraphicsElement[], s: number) => list.filter((m) => num(m, 'data-series') === s).sort((a, b) => num(a, 'data-point') - num(b, 'data-point'));

const COLUMN: ChartSpec = { type: 'barChart', barDir: 'col', grouping: 'clustered', title: 'Sales and costs', series: [sales(), costs()] };

describe('stage 1: a frame at the anchor (DoD 2)', () => {
  it('covers exactly the anchor\'s cells and shows title, type and series count', async () => {
    const { el, store } = await one(COLUMN, { opts: { draw: false } });
    const o = olay(el), f2 = rect(cellEl(el, 1, 5)), k16 = rect(cellEl(el, 15, 10));
    expect(rect(o).left).toBeCloseTo(f2.left, 0);
    expect(rect(o).top).toBeCloseTo(f2.top, 0);
    expect(rect(o).right).toBeCloseTo(k16.right, 0);
    expect(rect(o).bottom).toBeCloseTo(k16.bottom, 0);
    const c = chartEl(el);
    expect(c.dataset.stage).toBe('1');
    expect(c.dataset.type).toBe('barChart');
    expect(c.dataset.series).toBe('2');
    expect(c.querySelector('.sp-chart-title')!.textContent).toBe('Sales and costs');
    expect(c.querySelector('.sp-chart-meta')!.textContent).toBe('column · 2 series');
    // stage 1 lists what each series reads
    const lines = Array.from(c.querySelectorAll('.sp-chart-line')).map((l) => l.textContent);
    expect(lines).toEqual(['Sales — Data!A2:A5, Data!B2:B5', 'Costs — Data!A2:A5, Data!C2:C5']);
    expect(c.querySelector('.sp-bar')).toBeNull();
    // the stage-1 frame carries the tag too: here a category label was changed
    store.setCell('Data', 'A3', 'February');
    await until(() => !!c.querySelector('.sp-chart-tag'));
    expect(c.dataset.stage).toBe('1');
  });

  it('a chart part is read only when its sheet is shown, and once per workbook (lazy)', async () => {
    const el = mount();
    const store = createWorkbook({ plugins: [charts()] });
    el.workbook = store;
    const reads: string[] = [];
    await store.load(await chartBook([{ chart: COLUMN, ...AT }], { chartSheet: true }), 'c.xlsx');
    const book = store.book!, orig = book.part.bind(book);
    book.part = (p) => { reads.push(p); return orig(p); };
    await frame();
    expect(reads).toEqual([]); // the chart is on "Charts"; "Data" is showing
    store.select({ sheet: 'Charts', ref: 'A1' });
    await frame();
    await until(() => ready(el));
    store.select({ sheet: 'Data', ref: 'A1' });
    await frame();
    store.select({ sheet: 'Charts', ref: 'B2' });
    await frame();
    expect(reads).toEqual(['xl/charts/chart1.xml']);
  });

  it('a missing chart part shows a labelled frame, not an error', async () => {
    const el = mount();
    const store = createWorkbook({ plugins: [charts()] });
    el.workbook = store;
    await store.load(await chartBook([{ chart: COLUMN, ...AT, name: 'Chart 7' }]), 'c.xlsx');
    store.book!.part = async () => undefined;
    await frame();
    await until(() => ready(el));
    expect(chartEl(el).dataset.state).toBe('missing');
    expect(chartEl(el).querySelector('.sp-chart-title')!.textContent).toBe('Chart 7');
    expect((chartEl(el).querySelector('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('anchored past the last drawn column: placed at 64 px per column beyond the sheet\'s edge', async () => {
    const { el } = await one(COLUMN, { book: { narrow: true } });
    // four columns (A–D) are drawn; F is two columns past the edge
    const d1 = rect(cellEl(el, 0, 3)), f2 = rect(olay(el));
    expect(f2.left - d1.right).toBeCloseTo(64, 0);
    expect(f2.width).toBeCloseTo(6 * 64, 0);
  });
});

describe('Show source cells (DoD 2)', () => {
  it('selects the union of the plotted ranges when they tile a rectangle', async () => {
    const { el, store } = await one(COLUMN);
    chartEl(el).querySelector<HTMLButtonElement>('.sp-chart-src')!.click();
    await until(() => store.getSnapshot().selection.range === 'A2:C5');
    expect(store.getSnapshot().selection).toEqual({ sheet: 'Data', ref: 'A2', range: 'A2:C5' });
  });

  it('non-adjacent ranges: the first series\' values (one rectangle is all a selection holds)', async () => {
    const { el, store } = await one({ type: 'barChart', barDir: 'col', series: [costs()], title: 'Costs' });
    chartEl(el).querySelector<HTMLButtonElement>('.sp-chart-src')!.click();
    await until(() => store.getSnapshot().selection.range === 'C2:C5');
    expect(store.getSnapshot().selection).toEqual({ sheet: 'Data', ref: 'C2', range: 'C2:C5' });
  });

  it('a chart on another sheet selects its source on the data sheet', async () => {
    const el = mount();
    const store = createWorkbook({ plugins: [charts()] });
    el.workbook = store;
    await store.load(await chartBook([{ chart: COLUMN, ...AT }], { chartSheet: true }), 'c.xlsx');
    await frame();
    expect(store.getSnapshot().selection.sheet).toBe('Data');
    expect(olays(el)).toHaveLength(0);
    store.select({ sheet: 'Charts', ref: 'A1' });
    await frame();
    await until(() => ready(el));
    chartEl(el).querySelector<HTMLButtonElement>('.sp-chart-src')!.click();
    await until(() => store.getSnapshot().selection.sheet === 'Data');
    expect(store.getSnapshot().selection).toEqual({ sheet: 'Data', ref: 'A2', range: 'A2:C5' });
  });

  it('works in View and in Edit; a click elsewhere on the frame selects the cell under it in Edit only', async () => {
    const { el, store } = await one(COLUMN);
    store.select({ sheet: 'Data', ref: 'A10' });
    const art = chartEl(el).querySelector('.sp-chart-art')!;
    const k10 = rect(cellEl(el, 9, 10));
    const click = () => art.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, clientX: k10.left + 5, clientY: k10.top + 5 }));
    click();
    expect(store.getSnapshot().selection.ref).toBe('A10');
    store.setMode('edit');
    click();
    expect(store.getSnapshot().selection).toMatchObject({ sheet: 'Data', ref: 'K10' });
    chartEl(el).querySelector<HTMLButtonElement>('.sp-chart-src')!.click();
    await until(() => store.getSnapshot().selection.range === 'A2:C5');
  });

  it('literal values: the button is disabled — there are no cells to show', async () => {
    const { el } = await one({ type: 'barChart', barDir: 'col', series: [{ name: 'Lit', cats: ['a', 'b'], vals: [3, 4] }] });
    expect(chartEl(el).querySelector<HTMLButtonElement>('.sp-chart-src')!.disabled).toBe(true);
    expect(chartEl(el).dataset.stage).toBe('2');
  });
});

describe('data changed — Excel will redraw (DoD 2)', () => {
  it('shows after an edit inside a plotted range, not outside it, and goes with undo', async () => {
    const { el, store } = await one(COLUMN);
    const tag = () => chartEl(el).querySelector<SVGGElement>('.sp-chart-tag');
    expect(tag()).toBeNull();
    store.setMode('edit');
    store.setCell('Data', 'D3', 99); // the X column: not plotted by this chart
    await frame();
    expect(tag()).toBeNull();
    store.setCell('Data', 'B3', 99);
    await until(() => !!tag());
    expect(tag()!.textContent).toBe(CHANGED_TAG);
    expect(chartEl(el).dataset.changed).toBe('true');
    expect(tag()!.getBoundingClientRect().width).toBeGreaterThan(0);
    store.undo();
    await until(() => !tag());
    store.setCell('Data', 'C1', 'Spend'); // a series name is read by the chart too
    await until(() => !!tag());
  });

  it('without a derive plugin the drawing keeps Excel\'s cached values', async () => {
    const { el, store } = await one(COLUMN);
    store.setCell('Data', 'B3', 99);
    await until(() => !!chartEl(el).querySelector('.sp-chart-tag'));
    const feb = bySeries(marks(el, '.sp-bar'), 0)[1]!;
    expect(num(feb, 'data-value')).toBe(20);
    expect(svgOf(el).getAttribute('data-values')).toBe('cache');
  });

  it('with a derive plugin the drawing follows the live cells, derived ones included', async () => {
    const derive: Plugin = {
      id: 'fake-formulas', provides: ['derive'],
      derive: (input) => (input.kind === 'change' && input.cells.some((c) => c.ref === 'B2') ? [{ sheet: 'Data', ref: 'B5', value: 1000, text: '1000' }] : []),
    };
    const { el, store } = await one(COLUMN, { plugins: [charts(), derive] });
    expect(svgOf(el).getAttribute('data-values')).toBe('live');
    store.setCell('Data', 'B3', 99);
    await until(() => num(bySeries(marks(el, '.sp-bar'), 0)[1]!, 'data-value') === 99);
    store.setCell('Data', 'B2', 11);
    await until(() => num(bySeries(marks(el, '.sp-bar'), 0)[3]!, 'data-value') === 1000);
    expect(chartEl(el).querySelector('.sp-chart-tag')).not.toBeNull();
  });
});

/** Every bar's length divided by its value is one constant: lengths are proportional to values. */
function proportional(list: SVGGraphicsElement[], len: (r: SVGGraphicsElement) => number): void {
  const k = list.map((r) => len(r) / Math.abs(num(r, 'data-value')));
  for (const x of k) expect(x).toBeCloseTo(k[0]!, 1);
}
const h = (r: Element) => num(r, 'height'), w = (r: Element) => num(r, 'width'), y = (r: Element) => num(r, 'y'), x = (r: Element) => num(r, 'x');

describe('stage 2: drawn from the series\' values (DoD 3)', () => {
  it('column, clustered: bar heights proportional to the values; negatives below the zero line; side by side', async () => {
    const { el } = await one(COLUMN);
    expect(chartEl(el).dataset.stage).toBe('2');
    expect(svgOf(el).getAttribute('data-kind')).toBe('column');
    const bars = marks(el, '.sp-bar');
    expect(bars).toHaveLength(8);
    proportional(bars, h);
    const s0 = bySeries(bars, 0), s1 = bySeries(bars, 1);
    expect(s0.map((b) => num(b, 'data-value'))).toEqual(SALES);
    expect(s1.map((b) => num(b, 'data-value'))).toEqual(COSTS);
    const zero = y(s0[0]!) + h(s0[0]!);
    expect(y(s1[2]!)).toBeCloseTo(zero, 1); // −5 hangs from the zero line
    for (let j = 0; j < 4; j++) {
      expect(x(s1[j]!)).toBeCloseTo(x(s0[j]!) + w(s0[j]!), 1); // clustered: next to each other
      if (j) expect(x(s0[j]!)).toBeGreaterThan(x(s0[j - 1]!));
    }
    // the negative bar is red (the board), the others the series colour
    expect(s1[2]!.getAttribute('style')).toMatch(/--sp-fail/);
  });

  it('column, stacked: each series sits on the one below; negatives stack down from zero', async () => {
    const { el } = await one({ ...COLUMN, grouping: 'stacked' });
    expect(chartEl(el).querySelector('.sp-chart-meta')!.textContent).toBe('stacked column · 2 series');
    const bars = marks(el, '.sp-bar');
    proportional(bars, h);
    const s0 = bySeries(bars, 0), s1 = bySeries(bars, 1);
    for (const j of [0, 1, 3]) {
      expect(y(s1[j]!) + h(s1[j]!)).toBeCloseTo(y(s0[j]!), 1);
      expect(x(s1[j]!)).toBeCloseTo(x(s0[j]!), 1);
    }
    expect(y(s1[2]!)).toBeCloseTo(y(s0[2]!) + h(s0[2]!), 1);
  });

  it('column, 100 % stacked: every category fills the same height', async () => {
    const { el } = await one({ type: 'barChart', barDir: 'col', grouping: 'percentStacked', series: [sales(), costs({ vals: [5, 15, 5, 25] })] });
    const bars = marks(el, '.sp-bar'), s0 = bySeries(bars, 0), s1 = bySeries(bars, 1);
    const totals = s0.map((b, j) => h(b) + h(s1[j]!));
    for (const t of totals) expect(t).toBeCloseTo(totals[0]!, 1);
    expect(h(s0[0]!) / totals[0]!).toBeCloseTo(10 / 15, 2);
    expect(Array.from(svgOf(el).querySelectorAll('.sp-tick')).map((t) => t.textContent)).toContain('100%');
  });

  it('bar (horizontal): widths proportional; the first category at the bottom', async () => {
    const { el } = await one({ type: 'barChart', barDir: 'bar', grouping: 'clustered', series: [sales()] });
    expect(svgOf(el).getAttribute('data-kind')).toBe('bar');
    const bars = bySeries(marks(el, '.sp-bar'), 0);
    proportional(bars, w);
    expect(y(bars[0]!)).toBeGreaterThan(y(bars[3]!));
    for (const b of bars) expect(x(b)).toBeCloseTo(x(bars[0]!), 1);
  });

  it('line: points evenly spaced, heights linear in the values', async () => {
    const { el } = await one({ type: 'lineChart', grouping: 'standard', series: [sales(), costs()] });
    const pts = marks(el, '.sp-point');
    expect(pts).toHaveLength(8);
    const all = pts.map((p) => ({ v: num(p, 'data-value'), cy: num(p, 'cy'), cx: num(p, 'cx') }));
    // cy = a − b·v for one a and b across both series
    const [p, q] = [all[0]!, all[3]!];
    const b = (p.cy - q.cy) / (q.v - p.v), a = p.cy + b * p.v;
    for (const r of all) expect(r.cy).toBeCloseTo(a - b * r.v, 1);
    const s0 = bySeries(pts, 0).map((p) => num(p, 'cx'));
    const step = s0[1]! - s0[0]!;
    for (let j = 1; j < 4; j++) expect(s0[j]! - s0[j - 1]!).toBeCloseTo(step, 1);
    expect(svgOf(el).querySelectorAll('.sp-line')).toHaveLength(2);
  });

  it('pie: slice angles are the values\' shares of the total, clockwise from 12 o\'clock', async () => {
    const { el } = await one({ type: 'pieChart', varyColors: true, title: 'Share', series: [sales()] });
    const slices = marks(el, '.sp-slice');
    const total = SALES.reduce((s, v) => s + v, 0);
    expect(slices).toHaveLength(4);
    let at = 0;
    slices.forEach((s, j) => {
      expect(num(s, 'data-start')).toBeCloseTo(at, 1);
      expect(num(s, 'data-end') - num(s, 'data-start')).toBeCloseTo((SALES[j]! / total) * 360, 1);
      at = num(s, 'data-end');
    });
    expect(at).toBeCloseTo(360, 1);
    // the arc ends where the angle says
    const g = svgOf(el).querySelector('.sp-plot .sp-series')!, cx = num(g, 'data-cx'), cy = num(g, 'data-cy'), r = num(g, 'data-r');
    const d = slices[0]!.getAttribute('d')!, end = /A[^A]*?([\d.]+) ([\d.]+)Z$/.exec(d)!;
    const a = (num(slices[0]!, 'data-end') * Math.PI) / 180;
    expect(Number(end[1])).toBeCloseTo(cx + r * Math.sin(a), 0);
    expect(Number(end[2])).toBeCloseTo(cy - r * Math.cos(a), 0);
    // varyColors: one colour per slice
    expect(new Set(slices.map((s) => s.getAttribute('fill'))).size).toBe(4);
  });

  it('doughnut: the same angles, with a hole', async () => {
    const { el } = await one({ type: 'doughnutChart', varyColors: true, series: [sales()] });
    const slices = marks(el, '.sp-slice');
    expect(num(slices[1]!, 'data-end') - num(slices[1]!, 'data-start')).toBeCloseTo(72, 1);
    expect(slices[1]!.getAttribute('d')!.match(/A/g)).toHaveLength(2);
  });

  it('scatter: x and y positions linear in the series\' x and y values', async () => {
    const { el } = await one({ type: 'scatterChart', series: [sales({ catRef: 'Data!$D$2:$D$5', cats: XS, catNumeric: true, noLine: true })] });
    expect(svgOf(el).getAttribute('data-kind')).toBe('scatter');
    const pts = bySeries(marks(el, '.sp-point'), 0);
    expect(pts.map((p) => num(p, 'data-x'))).toEqual(XS);
    const fit = (attr: string, val: (p: Element) => number) => {
      const [p, q] = [pts[0]!, pts[3]!];
      const k = (num(q, attr) - num(p, attr)) / (val(q) - val(p));
      for (const r of pts) expect(num(r, attr)).toBeCloseTo(num(p, attr) + k * (val(r) - val(p)), 1);
      return k;
    };
    expect(fit('cx', (p) => num(p, 'data-x'))).toBeGreaterThan(0);
    expect(fit('cy', (p) => num(p, 'data-value'))).toBeLessThan(0);
    expect(svgOf(el).querySelector('.sp-line')).toBeNull(); // the series has no line
  });

  it('axes with ticks, a legend and the title', async () => {
    const { el } = await one(COLUMN);
    const svg = svgOf(el);
    const ticks = Array.from(svg.querySelectorAll('.sp-axis-value .sp-tick')).map((t) => num(t, 'data-value'));
    expect(ticks[0]).toBeLessThanOrEqual(-5);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(40);
    expect(Array.from(svg.querySelectorAll('.sp-cat')).map((t) => t.textContent)).toEqual(['Jan', 'Feb', 'Mar', 'Apr']);
    expect(Array.from(svg.querySelectorAll('.sp-legend text')).map((t) => t.textContent)).toEqual(['Sales', 'Costs']);
    expect(svg.querySelector('.sp-chart-title')!.textContent).toBe('Sales and costs');
    expect(svg.outerHTML).not.toMatch(/font-family/);
  });

  it('colours: explicit fills, else the workbook theme\'s accents in series order', async () => {
    const { el } = await one({ ...COLUMN, series: [sales({ fill: 'srgb:FF0000' }), costs({ fill: 'scheme:accent3' }), (() => { const s = costs({ name: 'Third' }); delete s.nameRef; return s; })()] }, { book: { theme: true } });
    const bars = marks(el, '.sp-bar');
    expect(bySeries(bars, 0)[0]!.getAttribute('fill')).toBe('#FF0000');
    expect(bySeries(bars, 1)[0]!.getAttribute('fill')).toBe(`#${THEME_ACCENTS[2]}`);
    expect(bySeries(bars, 2)[0]!.getAttribute('fill')).toBe(`#${THEME_ACCENTS[2]}`); // idx 2 → accent3
    const { el: el2 } = await one({ type: 'lineChart', grouping: 'standard', series: [sales()] }, { book: { theme: true } });
    expect(svgOf(el2).querySelector('.sp-line')!.getAttribute('stroke')).toBe(`#${THEME_ACCENTS[0]}`);
  });

  it('every other type stays a stage-1 frame: area, radar, 3-D, combination, pivot', async () => {
    const combo = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/><c:ser><c:idx val="1"/><c:order val="1"/><c:val><c:numRef><c:f>Data!$C$2:$C$5</c:f></c:numRef></c:val></c:ser><c:axId val="1"/><c:axId val="2"/></c:lineChart>`;
    const specs: ChartSpec[] = [
      { type: 'areaChart', grouping: 'standard', series: [sales()] },
      { type: 'radarChart', series: [sales()] },
      { type: 'bar3DChart', barDir: 'col', series: [sales()] },
      { ...COLUMN, extra: combo },
      { ...COLUMN, pivot: true },
    ];
    const { el } = await open(specs.map((chart, i) => ({ chart, from: [5, 0, i * 6, 0], to: [11, 0, i * 6 + 5, 0] })), { book: {} });
    expect(olays(el)).toHaveLength(5);
    const cs = olays(el).map((o) => o.querySelector<HTMLElement>('.sp-chart')!);
    expect(cs.map((c) => c.dataset.stage)).toEqual(['1', '1', '1', '1', '1']);
    expect(cs.map((c) => c.querySelector('.sp-chart-meta')!.textContent)).toEqual(['area · 1 series', 'radar · 1 series', '3-D column · 1 series', 'column + line · 3 series', 'column · 2 series']);
    expect(cs.every((c) => !c.querySelector('.sp-bar, .sp-point, .sp-slice'))).toBe(true);
    expect(cs.every((c) => c.querySelector('.sp-chart-line')!.textContent!.startsWith('Not drawn here'))).toBe(true);
    expect(cs.every((c) => !c.querySelector<HTMLButtonElement>('.sp-chart-src')!.disabled)).toBe(true);
  });
});

describe('overlay: zoom and names (DoD 4)', () => {
  it('the frame and its SVG scale with zoom, still covering the anchor\'s cells', async () => {
    const { el } = await one(COLUMN);
    const before = rect(svgOf(el));
    const zoom = shadow(el).querySelector('.zoom') as HTMLSelectElement;
    zoom.value = '1.5';
    zoom.dispatchEvent(new Event('change'));
    await frame();
    const o = olay(el), f2 = rect(cellEl(el, 1, 5)), k16 = rect(cellEl(el, 15, 10));
    expect(rect(o).left).toBeCloseTo(f2.left, 0);
    expect(rect(o).top).toBeCloseTo(f2.top, 0);
    expect(rect(o).right).toBeCloseTo(k16.right, 0);
    expect(rect(o).bottom).toBeCloseTo(k16.bottom, 0);
    const after = rect(svgOf(el));
    expect(after.width / before.width).toBeCloseTo(1.5, 1);
    expect(after.height / before.height).toBeCloseTo(1.5, 1);
    expect(after.width).toBeCloseTo(rect(o).width - 2, 0); // inside a 1 px border
  });

  it('a group named by the chart\'s title, holding a role="img" drawing; the alt before the part is read is the drawing\'s name', async () => {
    const { el } = await open([{ chart: COLUMN, ...AT, name: 'Chart 1' }, { chart: { type: 'pieChart', series: [sales()], noTitle: true }, from: [0, 0, 20, 0], to: [4, 0, 30, 0], name: 'Chart 2' }]);
    expect(olay(el, 0).getAttribute('role')).toBe('group'); // its Show source cells button stays reachable
    expect(olay(el, 0).getAttribute('aria-label')).toBe('Sales and costs');
    expect(olay(el, 1).getAttribute('aria-label')).toBe('Chart');
    const svg = svgOf(el, 0);
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Sales and costs');
    expect(svg.querySelector('title')!.textContent).toBe('Sales and costs');
  });
});

describe('ui: the status line and the shortcut', () => {
  it('names the source while the selection is in it or under the chart; counts charts otherwise', async () => {
    const { el, store } = await one(COLUMN, { plugins: [charts(), ui()] });
    const status = () => shadow(el).querySelector('.status')!.textContent!;
    store.select({ sheet: 'Data', ref: 'A20' });
    await frame();
    expect(status()).toContain('1 chart');
    chartEl(el).querySelector<HTMLButtonElement>('.sp-chart-src')!.click();
    await until(() => status().includes('Chart source: Data!A2:A5, Data!B2:B5, Data!C2:C5'));
    store.select({ sheet: 'Data', ref: 'H8' }); // under the frame
    await until(() => status().includes('Chart source:'));
  });

  it('Mod+Shift+U shows the source of the chart over the active cell', async () => {
    const { el, store } = await one(COLUMN, { plugins: [charts(), ui()] });
    store.select({ sheet: 'Data', ref: 'H8' });
    await frame();
    const grid = shadow(el).querySelector('.grid') as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'U', shiftKey: true, ctrlKey: true, bubbles: true, composed: true }));
    await until(() => store.getSnapshot().selection.range === 'A2:C5');
  });
});

describe('export (W-21 step 3)', () => {
  it('the chart part leaves byte for byte, edits or not', async () => {
    const { store } = await one(COLUMN);
    store.setCell('Data', 'B3', 99);
    const { blob } = await store.exportFile();
    const out = new Uint8Array(await blob.arrayBuffer());
    const e = readZip(out).find((x) => x.name === 'xl/charts/chart1.xml')!;
    expect(new TextDecoder().decode(await inflateEntry(out, e))).toBe(chartXml(COLUMN));
  });
});
