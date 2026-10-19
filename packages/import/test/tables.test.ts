// W-61 DoD 1: Excel tables (ListObjects) read from their parts — name, range, header and totals rows,
// columns, style; and kept by patchXlsx, so a download still holds them (At a glance step 4).
import { describe, expect, it } from 'vitest';
import { patchXlsx, readZip, toXlsx } from '@sheetpane/export';
import { fromCsv, read } from '../src/index.js';
import { tablesPkg } from './helpers.js';

describe('reading Excel tables (W-61 DoD 1)', async () => {
  const b = await read(tablesPkg(), { name: 'tables.xlsx' });
  const s = b.sheets[0]!;
  it('reads each table in <tableParts> order; a part without its relationship is skipped', () => {
    expect(s.tables.map((t) => t.name)).toEqual(['Units', 'Readings']);
  });
  it('the name formulas use is displayName; ref, header and totals rows, the part', () => {
    expect(s.tables[0]).toEqual({
      name: 'Units', id: 1, ref: 'A1:B5', headerRowCount: 1, totalsRowCount: 0, autoFilter: 'A1:B5', path: 'xl/tables/table1.xml',
      columns: [{ name: 'Unit' }, { name: 'Meaning' }],
      style: { name: 'TableStyleMedium2', showFirstColumn: false, showLastColumn: false, showRowStripes: true, showColumnStripes: false },
    });
  });
  it('columns carry their totals-row label and function; escaped names are decoded', () => {
    const r = s.tables[1]!;
    expect(r).toMatchObject({ ref: 'D1:F6', totalsRowCount: 1, path: 'xl/tables/table2.xml' });
    expect(r.columns).toEqual([{ name: 'Parameter', totalsRowLabel: 'Total' }, { name: 'Value', totalsRowFunction: 'sum' }, { name: 'Unit #' }]);
    expect(r.style).toEqual({ name: 'TableStyleLight9', showFirstColumn: true, showLastColumn: false, showRowStripes: false, showColumnStripes: true });
    expect('autoFilter' in r).toBe(false);
  });
  it('a sheet with no table, and a CSV, have none', async () => {
    expect((await read(await toXlsx({ sheets: [{ name: 'A', rows: [[1]] }] }), { name: 'a.xlsx' })).sheets[0]!.tables).toEqual([]);
    expect((await fromCsv('a,b\n1,2', { name: 'x.csv' })).sheets[0]!.tables).toEqual([]);
  });
});

describe('patchXlsx keeps the table parts (W-61 step 4)', () => {
  it('an edit downloads with both tables and their links intact', async () => {
    const out = await patchXlsx(tablesPkg(), [{ sheet: 'Lists', ref: 'E2', value: 9 }]);
    const names = readZip(out).map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining(['xl/tables/table1.xml', 'xl/tables/table2.xml', 'xl/worksheets/_rels/sheet1.xml.rels']));
    const s = (await read(out, { name: 'out.xlsx' })).sheets[0]!;
    expect(s.tables.map((t) => [t.name, t.ref])).toEqual([['Units', 'A1:B5'], ['Readings', 'D1:F6']]);
    expect(s.rows[1]![4]).toBe(9);
  });
});
