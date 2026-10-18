import { describe, expect, it } from 'vitest';

const until = async (cond: () => boolean, ms = 5000) => { const t0 = performance.now(); while (!cond()) { if (performance.now() - t0 > ms) throw new Error('timed out'); await new Promise((r) => setTimeout(r, 10)); } };
import { styles } from '@sheetpane/styles';
import { condfmt, evaluations, legendAt, ruleWords, rulesOf, skippedRules } from '../src/index.js';
import { BOLD_DXF, GREEN, GREEN_DXF, RED, RED_DXF, cellIs, col, colorScale, dataBar, decorations, expression, fillDxf, iconSet, simple, storeOf, textRule, top10, workbook, type V } from './helpers.js';

/** A column of values, `A1…An`. */
const column = (letter: string, values: V[]) => Object.fromEntries(values.map((v, i) => [`${letter}${i + 1}`, v]));
/** Which of `refs` a rule drew with `css` (the rest drew nothing). */
const marked = (s: Awaited<ReturnType<typeof storeOf>>, refs: string[], css: object = RED) =>
  refs.map((r) => { const d = s.decorate('Data', r); if (!Object.keys(d).length) return false; expect(d, r).toEqual(css); return true; });

describe('cellIs — every operator (DoD 2)', () => {
  const values = [5, 10, 15, 20, 25];
  const ops: [string, string[], boolean[]][] = [
    ['equal', ['15'], [false, false, true, false, false]],
    ['notEqual', ['15'], [true, true, false, true, true]],
    ['greaterThan', ['15'], [false, false, false, true, true]],
    ['lessThan', ['15'], [true, true, false, false, false]],
    ['greaterThanOrEqual', ['15'], [false, false, true, true, true]],
    ['lessThanOrEqual', ['15'], [true, true, true, false, false]],
    ['between', ['10', '20'], [false, true, true, true, false]],
    ['notBetween', ['20', '10'], [true, false, false, false, true]], // bounds in either order
  ];
  const letters = 'ABCDEFGH';
  const bytes = () => workbook({
    dxfs: [RED_DXF],
    sheets: [{ cells: Object.assign({}, ...ops.map((_, i) => column(letters[i]!, values))), cf: ops.map(([op, f], i) => ({ sqref: `${letters[i]}1:${letters[i]}5`, rules: [cellIs(op, f, { dxfId: 0 })] })) }],
  });
  it('each operator draws the dxf on exactly the cells it holds for, cell by cell', async () => {
    const s = await storeOf(bytes(), [condfmt()]);
    ops.forEach(([op, , want], i) => expect(marked(s, col(letters[i]!, 1, 5)), op).toEqual(want));
    expect(s.decorate('Data', 'A6')).toEqual({}); // outside every range
  });
  it("Excel's comparison: text without case, text above numbers, logicals above text, a blank as 0 or empty text", async () => {
    const vals: V[] = ['abc', 'ABC', 'x', 5, null, true];
    const s = await storeOf(workbook({
      dxfs: [RED_DXF],
      sheets: [{ cells: { ...column('A', vals), ...column('B', vals), C1: 0, C3: 1 }, cf: [
        { sqref: 'A1:A6', rules: [cellIs('equal', ['"abc"'], { dxfId: 0 })] },
        { sqref: 'B1:B6', rules: [cellIs('greaterThan', ['1000'], { dxfId: 0 })] },
        { sqref: 'C1:C3', rules: [cellIs('equal', ['0'], { dxfId: 0 })] },
      ] }],
    }), [condfmt()]);
    expect(marked(s, col('A', 1, 6))).toEqual([true, true, false, false, false, false]);
    expect(marked(s, col('B', 1, 6))).toEqual([true, true, true, false, false, true]);
    expect(marked(s, col('C', 1, 3))).toEqual([true, true, false]); // C2 is blank: = 0 holds, as in Excel
  });
  it('a cell operand: absolute stays, relative shifts with the cell from the range top-left', async () => {
    const s = await storeOf(workbook({
      dxfs: [RED_DXF],
      sheets: [{ cells: { ...column('M', [5, 15, 25]), P1: 12, ...column('Q', [1, 5, 9]), ...column('R', [3, 3, 10]) }, cf: [
        { sqref: 'M1:M3', rules: [cellIs('greaterThan', ['$P$1'], { dxfId: 0 })] },
        { sqref: 'Q1:Q3', rules: [cellIs('greaterThan', ['R1'], { dxfId: 0 })] },
      ] }],
    }), [condfmt()]);
    expect(marked(s, col('M', 1, 3))).toEqual([false, true, true]);
    expect(marked(s, col('Q', 1, 3))).toEqual([false, true, false]);
    s.setCell('Data', 'P1', '20');
    expect(marked(s, col('M', 1, 3))).toEqual([false, false, true]); // a cell operand is read live
    const q = rulesOf(s.book!, 'Data').find((r) => r.sqref === 'Q1:Q3')!;
    expect(ruleWords(q, 2, 16)).toBe('greater than R3');
  });
});

describe('text, blanks and errors (DoD 2)', () => {
  const vals: V[] = ['Late payment', 'on time', 'LATE', 123, null, 'early late'];
  it('containsText, notContainsText, beginsWith, endsWith: without case, numbers read as text, a blank contains nothing', async () => {
    const types = ['containsText', 'notContainsText', 'beginsWith', 'endsWith'] as const;
    const s = await storeOf(workbook({
      dxfs: [RED_DXF],
      sheets: [{ cells: { ...Object.assign({}, ...types.map((_, i) => column('ABCD'[i]!, vals))), ...column('E', vals) }, cf: [
        ...types.map((t, i) => ({ sqref: `${'ABCD'[i]}1:${'ABCD'[i]}6`, rules: [textRule(t, 'late', `${'ABCD'[i]}1`, { dxfId: 0 })] })),
        { sqref: 'E1:E6', rules: [textRule('containsText', '2', 'E1', { dxfId: 0 })] },
      ] }],
    }), [condfmt()]);
    expect(marked(s, col('A', 1, 6))).toEqual([true, false, true, false, false, true]);
    expect(marked(s, col('B', 1, 6))).toEqual([false, true, false, true, true, false]);
    expect(marked(s, col('C', 1, 6))).toEqual([true, false, true, false, false, false]);
    expect(marked(s, col('D', 1, 6))).toEqual([false, false, true, false, false, true]);
    expect(marked(s, col('E', 1, 6))).toEqual([false, false, false, true, false, false]);
  });
  it('containsBlanks, notContainsBlanks, containsErrors, notContainsErrors', async () => {
    const v: V[] = ['x', null, '  ', '#DIV/0!', 0];
    const types = ['containsBlanks', 'notContainsBlanks', 'containsErrors', 'notContainsErrors'];
    const s = await storeOf(workbook({
      dxfs: [RED_DXF],
      sheets: [{ cells: Object.assign({}, ...types.map((_, i) => column('ABCD'[i]!, v))), cf: types.map((t, i) => ({ sqref: `${'ABCD'[i]}1:${'ABCD'[i]}5`, rules: [simple(t, { dxfId: 0 })] })) }],
    }), [condfmt()]);
    expect(marked(s, col('A', 1, 5))).toEqual([false, true, true, false, false]);
    expect(marked(s, col('B', 1, 5))).toEqual([true, false, false, true, true]);
    expect(marked(s, col('C', 1, 5))).toEqual([false, false, false, true, false]);
    expect(marked(s, col('D', 1, 5))).toEqual([true, true, true, false, true]);
  });
});

describe('range rules: duplicates, unique, top / bottom, average (DoD 2)', () => {
  it('duplicateValues and uniqueValues over a multi-area range, text without case, blanks never counted', async () => {
    const s = await storeOf(workbook({
      dxfs: [RED_DXF, GREEN_DXF],
      sheets: [{ cells: { ...column('A', [1, 2, 'x', null]), B1: 1, ...column('C', [2, 'X', 3, null]) }, cf: [
        { sqref: 'A1:A4 C1:C4', rules: [simple('duplicateValues', { dxfId: 0 }), simple('uniqueValues', { dxfId: 1 })] },
      ] }],
    }), [condfmt()]);
    expect(decorations(s, ['A1', 'A2', 'A3', 'A4', 'B1', 'C1', 'C2', 'C3', 'C4'])).toEqual([GREEN, RED, RED, {}, {}, RED, RED, GREEN, {}]);
  });
  it('top10: top n with ties, bottom n, top n %; text in the range is not ranked', async () => {
    const v: V[] = [10, 20, 30, 40, 40, 5, 'n/a'];
    const s = await storeOf(workbook({
      dxfs: [RED_DXF],
      sheets: [{ cells: Object.assign({}, ...'ABCD'.split('').map((l) => column(l, v))), cf: [
        { sqref: 'A1:A7', rules: [top10(2, {}, { dxfId: 0 })] },
        { sqref: 'B1:B7', rules: [top10(3, {}, { dxfId: 0 })] },
        { sqref: 'C1:C7', rules: [top10(1, { bottom: true }, { dxfId: 0 })] },
        { sqref: 'D1:D7', rules: [top10(50, { percent: true }, { dxfId: 0 })] },
      ] }],
    }), [condfmt()]);
    expect(marked(s, col('A', 1, 7))).toEqual([false, false, false, true, true, false, false]);
    expect(marked(s, col('B', 1, 7))).toEqual([false, false, true, true, true, false, false]);
    expect(marked(s, col('C', 1, 7))).toEqual([false, false, false, false, false, true, false]);
    expect(marked(s, col('D', 1, 7))).toEqual([false, false, true, true, true, false, false]); // 50 % of 6 numbers = 3
  });
  it('aboveAverage and below average', async () => {
    const v: V[] = [10, 20, 30, 40, 40, 5];
    const s = await storeOf(workbook({
      dxfs: [RED_DXF],
      sheets: [{ cells: { ...column('A', v), ...column('B', v) }, cf: [
        { sqref: 'A1:A6', rules: [simple('aboveAverage', { dxfId: 0 })] },
        { sqref: 'B1:B6', rules: [simple('aboveAverage', { dxfId: 0 }, { aboveAverage: false })] },
      ] }],
    }), [condfmt()]);
    expect(marked(s, col('A', 1, 6))).toEqual([false, false, true, true, true, false]);
    expect(marked(s, col('B', 1, 6))).toEqual([true, true, false, false, false, true]);
  });
});

describe('colour scales and data bars (DoD 3)', () => {
  const bg = (s: Awaited<ReturnType<typeof storeOf>>, refs: string[]) => refs.map((r) => s.decorate('Data', r)['background-color']);
  it('2 colours, lowest → highest, interpolated in sRGB; text and blanks take no colour', async () => {
    const s = await storeOf(workbook({ sheets: [{ cells: column('A', [0, 25, 50, 100, 'x', null]), cf: [{ sqref: 'A1:A6', rules: [colorScale([[{ type: 'min' }, 'F8696B'], [{ type: 'max' }, '63BE7B']])] }] }] }), [condfmt()]);
    expect(bg(s, col('A', 1, 6))).toEqual(['#F8696B', '#D37E6F', '#AE9473', '#63BE7B', undefined, undefined]);
  });
  it('3 colours with a 50th-percentile midpoint', async () => {
    const s = await storeOf(workbook({ sheets: [{ cells: column('A', [0, 25, 50, 100]), cf: [{ sqref: 'A1:A4', rules: [colorScale([[{ type: 'min' }, 'F8696B'], [{ type: 'percentile', val: '50' }, 'FFEB84'], [{ type: 'max' }, '63BE7B']])] }] }] }), [condfmt()]);
    // the median of 0, 25, 50, 100 is 37.5
    expect(bg(s, col('A', 1, 4))).toEqual(['#F8696B', '#FDC07C', '#E0E282', '#63BE7B']);
  });
  it('number and percent thresholds; values beyond them take the end colours', async () => {
    const s = await storeOf(workbook({ sheets: [{ cells: { ...column('A', [0, 50, 100]), ...column('B', [0, 25, 100]) }, cf: [
      { sqref: 'A1:A3', rules: [colorScale([[{ type: 'num', val: '10' }, '000000'], [{ type: 'num', val: '90' }, 'FFFFFF']])] },
      { sqref: 'B1:B3', rules: [colorScale([[{ type: 'percent', val: '0' }, '000000'], [{ type: 'percent', val: '50' }, 'FFFFFF']])] },
    ] }] }), [condfmt()]);
    expect(bg(s, col('A', 1, 3))).toEqual(['#000000', '#808080', '#FFFFFF']);
    expect(bg(s, col('B', 1, 3))).toEqual(['#000000', '#808080', '#FFFFFF']);
  });
  it('the colour scale’s fill takes the workbook’s ink when the cell names none (file colours are data)', async () => {
    const s = await storeOf(workbook({ sheets: [{ cells: column('A', [0, 1]), cf: [{ sqref: 'A1:A2', rules: [colorScale([[{ type: 'min' }, 'F8696B'], [{ type: 'max' }, '63BE7B']])] }] }] }), [condfmt()]);
    expect(s.decorate('Data', 'A1')).toEqual({ 'background-color': '#F8696B', color: '#000000' });
  });
  const width = (css: Record<string, string | undefined>) => { const m = /transparent ([\d.]+)%\)$/.exec(css['background-image'] ?? ''); return m ? Number(m[1]) : undefined; };
  it('data bars: lowest → highest at 10 % … 90 % of the cell; number thresholds and lengths; the colour from the rule', async () => {
    const s = await storeOf(workbook({ sheets: [{ cells: { ...column('A', [0, 50, 100, 'x']), ...column('B', [0, 50, 100, 300]) }, cf: [
      { sqref: 'A1:A4', rules: [dataBar({ type: 'min' }, { type: 'max' })] },
      { sqref: 'B1:B4', rules: [dataBar({ type: 'num', val: '0' }, { type: 'num', val: '200' }, 'FF0000', { minLength: 0, maxLength: 100 })] },
    ] }] }), [condfmt()]);
    expect(col('A', 1, 4).map((r) => width(s.decorate('Data', r)))).toEqual([10, 50, 90, undefined]);
    expect(col('B', 1, 4).map((r) => width(s.decorate('Data', r)))).toEqual([0, 25, 50, 100]);
    expect(s.decorate('Data', 'A2')['background-image']).toMatch(/^linear-gradient\(90deg, #638EC6 0%, #[0-9A-F]{6} 50%, transparent 50%\)$/);
    expect(s.decorate('Data', 'B2')['background-image']).toMatch(/^linear-gradient\(90deg, #FF0000 0%/);
    expect(s.decorate('Data', 'A2')['background-color']).toBeUndefined(); // a bar is not a fill
  });
});

describe('priority and stopIfTrue (DoD 2)', () => {
  // Written in the file with priority 2 first: the order is the priority, global across blocks.
  const bytes = (stop: boolean) => workbook({
    dxfs: [RED_DXF, `${BOLD_DXF}${fillDxf('C6EFCE')}`],
    sheets: [{ cells: column('A', [3, 8, 12]), cf: [
      { sqref: 'A1:A3', rules: [cellIs('greaterThan', ['5'], { dxfId: 1, priority: 2 })] },
      { sqref: 'A2:A3', rules: [cellIs('greaterThan', ['10'], { dxfId: 0, priority: 1, stopIfTrue: stop })] },
    ] }],
  });
  it('sorted by priority across blocks', async () => {
    const s = await storeOf(bytes(false), [condfmt()]);
    expect(rulesOf(s.book!, 'Data').map((r) => r.cf.priority)).toEqual([1, 2]);
  });
  it('without stopIfTrue, the higher priority wins each property it sets and the lower fills in the rest', async () => {
    const s = await storeOf(bytes(false), [condfmt()]);
    expect(decorations(s, ['A1', 'A2', 'A3'])).toEqual([{}, { 'font-weight': '700', 'background-color': '#C6EFCE', color: '#000000' }, { ...RED, 'font-weight': '700' }]);
    expect(legendAt(s, 'Data', 2, 0).map((h) => `${h.words} · ${h.range}`)).toEqual(['greater than 10 · A2:A3', 'greater than 5 · A1:A3']);
  });
  it('with stopIfTrue, a matching rule ends the walk', async () => {
    const s = await storeOf(bytes(true), [condfmt()]);
    expect(decorations(s, ['A1', 'A2', 'A3'])).toEqual([{}, { 'font-weight': '700', 'background-color': '#C6EFCE', color: '#000000' }, RED]);
    expect(legendAt(s, 'Data', 2, 0).map((h) => h.words)).toEqual(['greater than 10']);
  });
});

describe('after styles: a rule’s dxf overrides the static style per property (DoD 2, 6)', () => {
  const bytes = () => workbook({
    fonts: ['<font><b/><sz val="11"/><color rgb="FF2346C8"/><name val="Calibri"/></font>'],
    fills: ['<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>'],
    borders: ['<border><left/><right/><top/><bottom style="thin"><color auto="1"/></bottom><diagonal/></border>'],
    xfs: ['<xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1"/>'],
    dxfs: [fillDxf('FF0000'), RED_DXF],
    sheets: [{ cells: column('A', [50, 50, 1]), s: { A1: 1, A2: 1, A3: 1 }, cf: [
      { sqref: 'A1', rules: [cellIs('greaterThan', ['10'], { dxfId: 0 })] },
      { sqref: 'A2:A3', rules: [cellIs('greaterThan', ['10'], { dxfId: 1 })] },
    ] }],
  });
  const STATIC = { 'font-weight': '700', color: '#2346C8', 'background-color': '#FFF2CC', 'border-bottom': '1px solid #000000' };
  it('a styled cell with a rule fill shows the rule fill and keeps the weight, the colour and the border', async () => {
    const s = await storeOf(bytes(), [styles(), condfmt()]);
    expect(s.decorate('Data', 'A1')).toEqual({ ...STATIC, 'background-color': '#FF0000' });
    expect(s.decorate('Data', 'A2')).toEqual({ ...STATIC, ...RED }); // the rule's own text colour wins too
    expect(s.decorate('Data', 'A3')).toEqual(STATIC); // the rule does not hold: the static style alone
  });
  it('the order holds whatever order the plugins are listed in', async () => {
    const s = await storeOf(bytes(), [condfmt(), styles()]);
    expect(s.plugins.map((p) => p.id)).toEqual(['styles', 'condfmt']);
    expect(s.decorate('Data', 'A1')).toEqual({ ...STATIC, 'background-color': '#FF0000' });
  });
  it('a reviewer’s own style change shows under the rule fill', async () => {
    const s = await storeOf(bytes(), [styles(), condfmt()]);
    const { styleRef } = await import('@sheetpane/styles');
    expect(s.decorate('Data', 'A1')).toMatchObject({ color: '#2346C8' });
    s.setChange('Data', styleRef('A1'), 'style', { i: true, color: '00AA00' }, {});
    expect(s.decorate('Data', 'A1')).toMatchObject({ 'font-style': 'italic', color: '#00AA00', 'background-color': '#FF0000' });
  });
});

describe('skipped rules are counted, never guessed (DoD 2, 4)', () => {
  it('icon sets, formula rules without a formula engine, rule types outside v1', async () => {
    const s = await storeOf(workbook({
      dxfs: [RED_DXF],
      sheets: [{ cells: column('A', [1, 2, 3]), cf: [
        { sqref: 'A1:A3', rules: [iconSet(), expression('$A1>1', { dxfId: 0 }), simple('timePeriod', { dxfId: 0 }, { timePeriod: 'today' }), cellIs('greaterThan', ['SUM(1,1)'], { dxfId: 0 }), cellIs('greaterThan', ['1'], { dxfId: 0 })] },
      ] }],
    }), [condfmt()]);
    const rep = skippedRules(s);
    expect(rep.rules).toBe(5);
    expect(rep.shown).toBe(1);
    expect(rep.skipped.map((x) => [x.type, x.reason])).toEqual([['iconSet', 'iconSet'], ['expression', 'formula'], ['timePeriod', 'type'], ['cellIs', 'formula']]);
    expect(rep.skipped[1]!.detail).toMatch(/needs the formulas plugin/);
    expect(skippedRules(s.book!).skipped).toHaveLength(4); // a bare workbook: the same
    expect(marked(s, col('A', 1, 3))).toEqual([false, true, true]); // only the cellIs > 1 draws
  });
});

describe('live: a change re-evaluates what depends on it, and only that (DoD 5)', () => {
  it('a value rule follows store.setCell, and undo', async () => {
    const s = await storeOf(workbook({ dxfs: [RED_DXF], sheets: [{ cells: column('A', [5, 50]), cf: [{ sqref: 'A1:A2', rules: [cellIs('greaterThan', ['10'], { dxfId: 0 })] }] }] }), [condfmt()]);
    expect(marked(s, ['A1', 'A2'])).toEqual([false, true]);
    s.setCell('Data', 'A1', '500');
    expect(marked(s, ['A1', 'A2'])).toEqual([true, true]);
    s.setCell('Data', 'A2', '1');
    expect(marked(s, ['A1', 'A2'])).toEqual([true, false]);
    s.undo(); s.undo();
    expect(marked(s, ['A1', 'A2'])).toEqual([false, true]);
  });
  it('a scale’s statistics are computed once per range, recomputed when a cell of the range changes, kept otherwise', async () => {
    const s = await storeOf(workbook({ sheets: [{ cells: { ...column('A', [0, 50, 100]), C1: 'other' }, cf: [{ sqref: 'A1:A3', rules: [colorScale([[{ type: 'min' }, '000000'], [{ type: 'max' }, 'FFFFFF']])] }] }] }), [condfmt()]);
    const paint = () => col('A', 1, 3).map((r) => s.decorate('Data', r)['background-color']);
    expect(paint()).toEqual(['#000000', '#808080', '#FFFFFF']);
    expect(evaluations(s)).toEqual({ stats: 1, cells: 3 });
    paint(); paint();
    expect(evaluations(s)).toEqual({ stats: 1, cells: 3 }); // cached: never per cell, never per render
    s.setCell('Data', 'C1', 'changed'); // outside the range
    s.select({ sheet: 'Data', ref: 'B2' });
    paint();
    expect(evaluations(s)).toEqual({ stats: 1, cells: 3 });
    s.setCell('Data', 'A3', '200'); // the max moves: every cell of the range is re-read
    expect(paint()).toEqual(['#000000', '#404040', '#FFFFFF']);
    expect(evaluations(s)).toEqual({ stats: 2, cells: 6 });
    s.setCell('Data', 'A4', '400'); // below the range: nothing to redo
    paint();
    expect(evaluations(s)).toEqual({ stats: 2, cells: 6 });
  });
  it('duplicates follow an edit anywhere in their range', async () => {
    const s = await storeOf(workbook({ dxfs: [RED_DXF], sheets: [{ cells: column('A', [1, 2, 3]), cf: [{ sqref: 'A1:A3', rules: [simple('duplicateValues', { dxfId: 0 })] }] }] }), [condfmt()]);
    expect(marked(s, col('A', 1, 3))).toEqual([false, false, false]);
    s.setCell('Data', 'A3', '1');
    expect(marked(s, col('A', 1, 3))).toEqual([true, false, true]);
  });
  it('a new workbook in the same store starts afresh', async () => {
    const s = await storeOf(workbook({ dxfs: [RED_DXF], sheets: [{ cells: column('A', [50]), cf: [{ sqref: 'A1', rules: [cellIs('greaterThan', ['10'], { dxfId: 0 })] }] }] }), [condfmt()]);
    expect(marked(s, ['A1'])).toEqual([true]);
    await s.load(await workbook({ dxfs: [RED_DXF], sheets: [{ cells: column('A', [5]), cf: [{ sqref: 'A1', rules: [cellIs('greaterThan', ['10'], { dxfId: 0 })] }] }] }), 'two.xlsx');
    expect(marked(s, ['A1'])).toEqual([false]);
  });
});

describe('expression rules through @sheetpane/formulas (DoD 4)', () => {
  const bytes = () => workbook({
    dxfs: [RED_DXF],
    sheets: [{
      cells: { ...column('A', [5, 1, 7]), ...column('B', [3, 4, 2]), C1: 8 },
      formulas: { C1: 'A1+B1' },
      cf: [
        { sqref: 'A1:B3', rules: [expression('$A1>$B1', { dxfId: 0 })] },
        { sqref: 'D1:D3', rules: [expression('A1>B1', { dxfId: 0 })] }, // relative: D2 reads A2>B2
      ],
    }],
  });
  it('a workbook with no formula cell still builds the model for its expression rules', async () => {
    const { formulas } = await import('@sheetpane/formulas');
    const f = formulas();
    const s = await storeOf(workbook({ dxfs: [RED_DXF], sheets: [{ cells: { ...column('A', [5, 1]), ...column('B', [3, 4]) }, cf: [{ sqref: 'A1:A2', rules: [expression('A1>B1', { dxfId: 0 })] }] }] }), [condfmt(), f]);
    await f.ready();
    expect(f.built()).toBe(true);
    await until(() => marked(s, ['A1', 'A2']).join() === 'true,false');
  });
  it('evaluated per cell by IronCalc, references shifted from the range top-left; live after an edit', async () => {
    const { formulas } = await import('@sheetpane/formulas');
    const f = formulas();
    const s = await storeOf(bytes(), [condfmt(), f]);
    await f.ready();
    expect(f.built()).toBe(true);
    expect(skippedRules(s).skipped).toEqual([]);
    expect(marked(s, ['A1', 'B1', 'A2', 'B2', 'A3', 'B3'])).toEqual([true, true, false, false, true, true]);
    expect(marked(s, col('D', 1, 3))).toEqual([true, false, true]);
    expect(legendAt(s, 'Data', 1, 3)).toEqual([]);
    expect(legendAt(s, 'Data', 2, 3).map((h) => h.words)).toEqual(['formula =A3>B3']);
    s.setCell('Data', 'A2', '9');
    await f.ready();
    expect(marked(s, ['A2', 'B2', 'D2'])).toEqual([true, true, true]);
    expect(s.changeCount).toBe(1); // evaluating never touches the workbook
  });
  it('without a formula engine: skipped, counted, drawn as nothing', async () => {
    const s = await storeOf(bytes(), [condfmt()]);
    expect(skippedRules(s).skipped.map((x) => x.reason)).toEqual(['formula', 'formula']);
    expect(marked(s, ['A1', 'D1'])).toEqual([false, false]);
  });
});

describe('the rule in words', () => {
  it('names every type as the legend shows it', async () => {
    const s = await storeOf(workbook({
      dxfs: [RED_DXF],
      sheets: [{ cells: { A1: 1 }, cf: [{ sqref: 'A1:A9', rules: [
        cellIs('between', ['1', '"z"'], { dxfId: 0 }), textRule('notContainsText', 'late', 'A1'), simple('duplicateValues'), top10(10, { percent: true, bottom: true }),
        simple('aboveAverage', {}, { aboveAverage: false }), colorScale([[{ type: 'min' }, '000000'], [{ type: 'percentile', val: '50' }, '888888'], [{ type: 'max' }, 'FFFFFF']]),
        dataBar({ type: 'num', val: '0' }, { type: 'percent', val: '80' }), iconSet(),
      ] }] }],
    }), [condfmt()]);
    expect(rulesOf(s.book!, 'Data').map((r) => ruleWords(r))).toEqual([
      'between 1 and "z"', 'does not contain "late"', 'duplicate value', 'bottom 10%', 'below average',
      'colour scale: lowest → 50th percentile → highest', 'data bar: 0 → 80%', 'icon set 3Arrows',
    ]);
  });
});
