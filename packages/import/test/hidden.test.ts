// W-49 DoD 1 and 10: what a file hides — sheet states, hidden and zero-size rows and columns,
// outline levels, the autoFilter — read; and what patchXlsx writes, read back the same.
import { describe, expect, it } from 'vitest';
import { patchXlsx, toXlsx } from '@sheetpane/export';
import { fromCsv, read } from '../src/index.js';
import { hiddenPkg } from './helpers.js';

describe('reading what a file hides (W-49 DoD 1)', async () => {
  const b = await read(hiddenPkg(), { name: 'hidden.xlsx' });
  const [data, hid, very, bare] = b.sheets;
  it('reads each sheet state, and keeps the deprecated hidden flag in step', () => {
    expect(b.sheets.map((s) => [s.name, s.state, s.hidden])).toEqual([
      ['Data', 'visible', false], ['Hid', 'hidden', true], ['Very', 'veryHidden', true], ['Bare', 'visible', false],
    ]);
    expect(hid!.rows).toEqual([[2]]);
    expect(very!.rows).toEqual([[3]]);
  });
  it('counts hidden="1" and a zero height as hidden rows, sorted', () => {
    expect(data!.hiddenRows).toEqual([2, 3, 6]);
    expect(data!.rowHeights[3]).toBe(0);
  });
  it('expands <col> spans: hidden="1" and a zero width are hidden columns', () => {
    expect(data!.hiddenCols).toEqual([1, 2, 3, 5, 6, 7]);
    expect(data!.columnWidths![5]).toBe(12);
  });
  it('reads outline levels and collapsed per row and per column', () => {
    expect(data!.rowOutline).toEqual([undefined, { level: 1 }, { level: 2 }, undefined, { level: 0, collapsed: true }]);
    expect(data!.colOutline).toEqual([undefined, undefined, undefined, undefined, undefined, { level: 1 }, { level: 1 }, { level: 1 }, { level: 0, collapsed: true }]);
    expect(data!.outline).toEqual({ levelRow: 2, levelCol: 1, summaryBelow: false, summaryRight: true });
  });
  it('falls back to the deepest level read when sheetFormatPr names none, clamped to 7', () => {
    expect(bare!.rowOutline).toEqual([undefined, { level: 3 }, { level: 7 }]);
    expect(bare!.outline).toEqual({ levelRow: 7, levelCol: 0, summaryBelow: true, summaryRight: true });
  });
  it('reads the autoFilter range, and leaves it out when there is none', () => {
    expect(data!.autoFilter).toBe('A1:C7');
    expect('autoFilter' in bare!).toBe(false);
  });
  it('a CSV hides nothing', async () => {
    const s = (await fromCsv('a,b\n1,2', { name: 'x.csv' })).sheets[0]!;
    expect(s).toMatchObject({ state: 'visible', hidden: false, hiddenRows: [], hiddenCols: [], rowOutline: [], colOutline: [] });
    expect(s.outline).toEqual({ levelRow: 0, levelCol: 0, summaryBelow: true, summaryRight: true });
    expect(s.autoFilter).toBeUndefined();
  });
});

describe('patchXlsx hidden, read back (W-49 DoD 10 round trip)', () => {
  it('rows, columns, state, the active sheet and outline come back as written', async () => {
    const rows = Array.from({ length: 6 }, (_, r) => [r, r * 2, r * 3, r * 4]);
    const orig = await toXlsx({ sheets: [{ name: 'A', rows, columnWidths: [10, 11, 12, 13] }, { name: 'B', rows: [[1]] }, { name: 'C', rows: [[1]] }] });
    const out = await patchXlsx(orig, [], {
      hidden: [
        { sheet: 'A', rows: [1, 2, 9], cols: [1, 2, 6], state: 'hidden', outline: { rows: { 1: 1, 2: 2, 3: 1 }, cols: { 1: 1 } } },
        { sheet: 'C', state: 'veryHidden' },
      ],
    });
    const b = await read(out, { name: 'out.xlsx' });
    const [a, bb, c] = b.sheets;
    expect(b.sheets.map((s) => s.state)).toEqual(['hidden', 'visible', 'veryHidden']);
    expect(b.activeSheet).toBe(1);
    expect(a!.hiddenRows).toEqual([1, 2, 9]);
    expect(a!.hiddenCols).toEqual([1, 2, 6]);
    expect(a!.columnWidths!.slice(0, 4).map(Math.round)).toEqual([10, 11, 12, 13]);
    expect(Array.from(a!.rowOutline, (e) => e?.level ?? 0)).toEqual([0, 1, 2, 1]);
    expect(Array.from(a!.colOutline, (e) => e?.level ?? 0)).toEqual([0, 1]);
    expect(a!.outline).toMatchObject({ levelRow: 2, levelCol: 1 });
    expect(a!.rows).toEqual(rows);
    expect([bb!.state, c!.state]).toEqual(['visible', 'veryHidden']);
  });
  it('unhiding everything clears hidden, zero heights and zero widths', async () => {
    const out = await patchXlsx(hiddenPkg(), [], { hidden: [{ sheet: 'Data', rows: [], cols: [], state: 'visible' }, { sheet: 'Hid', state: 'visible' }] });
    const s = (await read(out, { name: 'out.xlsx' })).sheets;
    expect(s[0]!.hiddenRows).toEqual([]);
    expect(s[0]!.hiddenCols).toEqual([]);
    expect(s[0]!.columnWidths![5]).toBe(12);
    expect(s[0]!.rowOutline[2]).toEqual({ level: 2 }); // outline not named: kept
    expect(s.map((x) => x.state)).toEqual(['visible', 'visible', 'veryHidden', 'visible']);
  });
});
