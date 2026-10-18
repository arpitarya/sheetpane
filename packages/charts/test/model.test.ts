// The chart-part reader, references, colours and the drawing's arithmetic — no grid.
import { describe, expect, it } from 'vitest';
import { accents, defaultColor, drawChart, modify, niceScale, parseChart, parseFormulaRefs, resolveColor, selectionFor, stackedValues, withZero, type PlotData } from '../src/index.js';
import { chartXml, costs, MONTHS, SALES, sales, XS } from './helpers.js';

describe('references (c:f)', () => {
  it('reads plain, quoted, absolute and multi-area references; skips names and external books', () => {
    expect(parseFormulaRefs('Data!$B$2:$B$5')).toEqual([{ sheet: 'Data', range: 'B2:B5', top: 1, left: 1, bottom: 4, right: 1 }]);
    expect(parseFormulaRefs("'Q1 ''data'''!$A$2")).toEqual([{ sheet: "Q1 'data'", range: 'A2', top: 1, left: 0, bottom: 1, right: 0 }]);
    expect(parseFormulaRefs('(Data!$A$2:$A$3,Data!$A$5)').map((r) => r.range)).toEqual(['A2:A3', 'A5']);
    expect(parseFormulaRefs('Data!MyName')).toEqual([]);
    expect(parseFormulaRefs('[1]Data!$A$1')).toEqual([]);
    expect(parseFormulaRefs(undefined)).toEqual([]);
  });

  it('a selection is the exact union when the ranges tile a rectangle, else the first range', () => {
    const r = (f: string) => parseFormulaRefs(f);
    expect(selectionFor([...r('Data!$B$2:$B$5'), ...r('Data!$A$2:$A$5'), ...r('Data!$C$2:$C$5')])).toEqual({ sheet: 'Data', ref: 'A2', range: 'A2:C5' });
    expect(selectionFor([...r('Data!$C$2:$C$5'), ...r('Data!$A$2:$A$5')])).toEqual({ sheet: 'Data', ref: 'C2', range: 'C2:C5' });
    expect(selectionFor(r('Data!$B$3'))).toEqual({ sheet: 'Data', ref: 'B3' });
    expect(selectionFor([])).toBeUndefined();
  });
});

describe('parseChart', () => {
  it('a clustered column chart: type, title, series with refs and cached points', () => {
    const m = parseChart(chartXml({ type: 'barChart', barDir: 'col', grouping: 'clustered', title: 'Sales by month', series: [sales(), costs()] }));
    expect(m.title).toBe('Sales by month');
    expect(m.drawable).toBe('column');
    expect(m.typeLabel).toBe('column');
    expect(m.groups.map((g) => g.element)).toEqual(['barChart']);
    expect(m.series.map((s) => s.name)).toEqual(['Sales', 'Costs']);
    expect(m.series[0]!.cat!.points).toEqual(MONTHS);
    expect(m.series[0]!.val!.points).toEqual(SALES);
    expect(m.series[0]!.val!.f).toBe('Data!$B$2:$B$5');
    expect(m.plotted.map((r) => r.range)).toEqual(['B2:B5', 'A2:A5', 'C2:C5']);
    expect(m.sources.map((r) => r.range)).toEqual(['B1', 'A2:A5', 'B2:B5', 'C1', 'C2:C5']);
    expect(m.legend).toBe('right');
  });

  it('names each type and grouping', () => {
    const t = (type: string, o: Record<string, unknown> = {}) => parseChart(chartXml({ type, series: [sales()], ...o }));
    expect([t('barChart', { barDir: 'bar' }).typeLabel, t('barChart', { barDir: 'bar' }).drawable]).toEqual(['bar', 'bar']);
    expect(t('barChart', { barDir: 'col', grouping: 'stacked' }).typeLabel).toBe('stacked column');
    expect(t('barChart', { barDir: 'col', grouping: 'percentStacked' }).typeLabel).toBe('100% stacked column');
    expect(t('lineChart', { grouping: 'standard' }).drawable).toBe('line');
    expect(t('pieChart').drawable).toBe('pie');
    expect(t('doughnutChart').drawable).toBe('doughnut');
    expect(t('scatterChart').drawable).toBe('scatter');
    expect([t('areaChart').typeLabel, t('areaChart').drawable]).toEqual(['area', undefined]);
    expect([t('radarChart').typeLabel, t('radarChart').drawable]).toEqual(['radar', undefined]);
    expect([t('bar3DChart', { barDir: 'col' }).typeLabel, t('bar3DChart', { barDir: 'col' }).drawable]).toEqual(['3-D column', undefined]);
  });

  it('combination and pivot charts stay frames, with a reason', () => {
    const combo = parseChart(chartXml({ type: 'barChart', barDir: 'col', series: [sales()], extra: `<c:lineChart><c:grouping val="standard"/><c:ser><c:idx val="1"/><c:order val="1"/><c:val><c:numRef><c:f>Data!$C$2:$C$5</c:f></c:numRef></c:val></c:ser><c:axId val="1"/><c:axId val="2"/></c:lineChart>` }));
    expect(combo.typeLabel).toBe('column + line');
    expect(combo.drawable).toBeUndefined();
    expect(combo.notDrawn).toMatch(/combination/);
    const pivot = parseChart(chartXml({ type: 'barChart', barDir: 'col', series: [sales()], pivot: true }));
    expect(pivot.pivot).toBe(true);
    expect(pivot.drawable).toBeUndefined();
  });

  it('title: rich text, else the only series name, else "Chart"', () => {
    expect(parseChart(chartXml({ type: 'pieChart', series: [sales()] })).title).toBe('Sales');
    expect(parseChart(chartXml({ type: 'pieChart', series: [sales()], noTitle: true })).title).toBe('Chart');
    expect(parseChart(chartXml({ type: 'barChart', series: [sales(), costs()] })).title).toBe('Chart');
    const twoParas = chartXml({ type: 'barChart', series: [sales()], title: 'x' }).replace('<a:p><a:r><a:t>x</a:t></a:r></a:p>', '<a:p><a:r><a:t>Market </a:t></a:r><a:r><a:t>value</a:t></a:r></a:p><a:p><a:r><a:t>2026</a:t></a:r></a:p>');
    expect(parseChart(twoParas).title).toBe('Market value 2026');
  });

  it('explicit fills (srgb, scheme with modifiers) and per-point fills', () => {
    const m = parseChart(chartXml({ type: 'pieChart', varyColors: true, series: [sales({ fill: 'srgb:FF0000', dPt: { 1: 'scheme:accent2' } })] }));
    const s = m.series[0]!;
    expect(resolveColor(s.fill, [])).toBe('#FF0000');
    expect(resolveColor(s.pointFills.get(1), ['FFFFFF', '000000', 'EEEEEE', '111111', '112233', '445566'])).toBe('#445566');
    expect(m.groups[0]!.varyColors).toBe(true);
  });

  it('literal values (no c:f) are read, and the chart has no source to select', () => {
    const m = parseChart(chartXml({ type: 'barChart', barDir: 'col', series: [{ name: 'Lit', cats: ['a', 'b'], vals: [3, 4] }] }));
    expect(m.series[0]!.val!.points).toEqual([3, 4]);
    expect(m.plotted).toEqual([]);
  });

  it('malformed XML throws', () => {
    expect(() => parseChart('<c:chartSpace')).toThrow();
    expect(() => parseChart('<chartSpace/>')).toThrow(/c:chart/);
    expect(() => parseChart('<c:chartSpace')).toThrow(/^SP-5701: /); // W-40
    expect(() => parseChart('<chartSpace/>')).toThrow(/^SP-5702: /);
  });

  it('namespace prefixes do not matter (strict OOXML, other prefixes)', () => {
    const xml = chartXml({ type: 'lineChart', grouping: 'standard', series: [sales()], title: 'T' }).replace(/c:/g, 'cx:').replace('xmlns:c=', 'xmlns:cx=');
    const m = parseChart(xml);
    expect(m.drawable).toBe('line');
    expect(m.series[0]!.val!.points).toEqual(SALES);
  });
});

describe('colours', () => {
  it('lumMod / lumOff, tint and shade', () => {
    expect(modify('4472C4', [{ name: 'lumMod', val: 75000 }])).toBe('2F5597');
    expect(modify('FFFFFF', [{ name: 'lumMod', val: 50000 }])).toBe('808080');
    expect(modify('000000', [{ name: 'lumMod', val: 50000 }, { name: 'lumOff', val: 50000 }])).toBe('808080');
    expect(modify('FF0000', [{ name: 'shade', val: 50000 }])).toBe('800000');
  });
  it('default colours follow the theme accents, Office\'s when the theme has none', () => {
    expect(accents([])[0]).toBe('4472C4');
    expect(defaultColor(0, [])).toBe('#4472C4');
    expect(defaultColor(1, ['', '', '', '', '112233', '445566'])).toBe('#445566');
    expect(defaultColor(6, [])).not.toBe('#4472C4');
  });
});

describe('scales and stacking', () => {
  it('nice ticks cover the data in steps of 1, 2, 2.5 or 5 × 10ⁿ', () => {
    expect(niceScale(0, 40, 4).ticks).toEqual([0, 10, 20, 30, 40]);
    expect(niceScale(-5, 40, 5).ticks).toEqual([-10, 0, 10, 20, 30, 40]);
    expect(niceScale(0, 0.37, 4).ticks).toEqual([0, 0.1, 0.2, 0.3, 0.4]);
    expect(niceScale(3, 3, 4).lo).toBe(0);
    expect(withZero(100, 104)).toEqual([100, 104]);
    expect(withZero(10, 40)).toEqual([0, 40]);
  });
  it('stacks positives up and negatives down; 100 % stacking divides by the category total', () => {
    const s = (values: number[]) => ({ name: '', color: '#000000', lineColor: '#000000', noLine: false, values, pointColors: [] });
    const st = stackedValues([s([10, 20]), s([5, -5])], 2, 'stacked');
    expect(st[1]![0]).toEqual({ base: 10, top: 15, value: 5 });
    expect(st[1]![1]).toEqual({ base: 0, top: -5, value: -5 });
    const pct = stackedValues([s([30, 1]), s([10, 3])], 2, 'percentStacked');
    expect(pct[0]![0]!.top).toBeCloseTo(0.75);
    expect(pct[1]![1]!.top).toBeCloseTo(1);
  });
  it('the SVG names no font and escapes the file\'s text', () => {
    const d: PlotData = { kind: 'column', grouping: 'clustered', cats: ['<b>'], series: [{ name: 'A&B', color: '#112233', lineColor: '#112233', noLine: false, values: [1], pointColors: [] }], gapWidth: 150, holeSize: 50, firstSliceAng: 0, scatterStyle: 'marker', percent: false, legend: 'right' };
    const svg = drawChart(d, '<script>', 'column · 1 series', 400, 300);
    expect(svg).not.toMatch(/font-family|<script>|<b>/);
    expect(svg).toContain('&#60;script&#62;');
    expect(XS.length).toBe(4);
  });
});
