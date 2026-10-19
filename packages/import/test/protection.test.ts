// W-62 DoD 1: sheet protection, workbook structure protection and each format's <protection> read — the file's
// intent known; never the password. And patchXlsx keeps <sheetProtection> / <workbookProtection> untouched (Hazards).
import { describe, expect, it } from 'vitest';
import { fromUtf8, inflateEntry, patchXlsx, readZip, toXlsx } from '@sheetpane/export';
import { cellProtection, fromCsv, read } from '../src/index.js';
import { protectedPkg } from './helpers.js';

const partText = async (bytes: Uint8Array, name: string) => fromUtf8(await inflateEntry(bytes, readZip(bytes).find((e) => e.name === name)!));
const tag = (xml: string, local: string) => new RegExp(`<${local}\\b[^>]*/>`).exec(xml)?.[0];

describe('reading protection (W-62 DoD 1)', async () => {
  const b = await read(protectedPkg(), { name: 'protected.xlsx' });
  const [spec, open, off] = b.sheets;
  it('a protected sheet: every switch as the file stores it, the schema defaults for the rest', () => {
    expect(spec!.protection).toEqual({
      objects: true, scenarios: true, formatCells: true, formatColumns: false, formatRows: true, insertColumns: true, insertRows: true,
      insertHyperlinks: true, deleteColumns: true, deleteRows: true, selectLockedCells: false, selectUnlockedCells: false, sort: true,
      autoFilter: true, pivotTables: true, hasPassword: true,
    });
  });
  it('a sheet with no <sheetProtection>, or with sheet="0", is not protected', () => {
    expect('protection' in open!).toBe(false);
    expect('protection' in off!).toBe(false);
  });
  it('the workbook structure lock, with the password noticed but never read', () => {
    expect(b.workbookProtection).toEqual({ lockStructure: true, lockWindows: false, hasPassword: true });
    expect(JSON.stringify({ sheets: b.sheets, wb: b.workbookProtection })).not.toContain('CC3D');
  });
  it('each format’s <protection>: absent when the format has none', () => {
    expect(b.styles.cellXfs.map((x) => x.protection)).toEqual([undefined, { locked: false, hidden: false }, { locked: true, hidden: true }, { locked: false, hidden: true }]);
    expect(b.styles.cellXfs[1]!.applyProtection).toBe(true);
  });
  it('row formats (customFormat only) and column formats, sparse', () => {
    expect({ ...spec!.rowStyles }).toEqual({ 4: 1 });
    expect({ ...spec!.colStyles }).toEqual({ 1: 1 });
  });
  it('cellProtection: the cell’s own format, else its row’s, else its column’s, else the default (locked)', () => {
    const at = (r: number, c: number) => cellProtection(spec!, b.styles, r, c);
    expect(at(0, 0)).toEqual({ locked: true, hidden: false }); // A1: a stored cell, default format
    expect(at(1, 1)).toEqual({ locked: false, hidden: false }); // B2: unlocked
    expect(at(1, 2)).toEqual({ locked: true, hidden: true }); // C2: a hidden formula
    expect(at(1, 3)).toEqual({ locked: false, hidden: true });
    expect(at(0, 1)).toEqual({ locked: true, hidden: false }); // B1: a stored cell keeps its own (default) format over the column's
    expect(at(9, 1)).toEqual({ locked: false, hidden: false }); // B10: empty, the column's format
    expect(at(4, 0)).toEqual({ locked: false, hidden: false }); // A5: empty, the row's format
    expect(at(5, 0)).toEqual({ locked: true, hidden: false }); // A6: s without customFormat is not the row's format
    expect(at(9, 9)).toEqual({ locked: true, hidden: false });
  });
  it('a workbook without protection, and a CSV, carry none', async () => {
    const plain = await read(await toXlsx({ sheets: [{ name: 'A', rows: [[1]] }] }), { name: 'a.xlsx' });
    expect('workbookProtection' in plain).toBe(false);
    expect('protection' in plain.sheets[0]!).toBe(false);
    const csv = await fromCsv('a,b\n1,2', { name: 'x.csv' });
    expect('workbookProtection' in csv).toBe(false);
    expect(csv.sheets[0]).toMatchObject({ rowStyles: [], colStyles: [] });
    expect('protection' in csv.sheets[0]!).toBe(false);
  });
});

describe('patchXlsx keeps protection untouched (W-62 Hazards)', () => {
  it('an edit, a freeze and a hidden row download with <sheetProtection> and <workbookProtection> byte for byte', async () => {
    const src = protectedPkg();
    const out = await patchXlsx(src, [{ sheet: 'Spec', ref: 'B2', value: 9 }, { sheet: 'Spec', ref: 'B10', value: 'new' }], {
      freeze: [{ sheet: 'Spec', rows: 1, cols: 0 }],
      hidden: [{ sheet: 'Spec', rows: [6] }],
    });
    for (const [part, el] of [['xl/worksheets/sheet1.xml', 'sheetProtection'], ['xl/worksheets/sheet3.xml', 'sheetProtection'], ['xl/workbook.xml', 'workbookProtection']] as const) {
      const before = tag(await partText(src, part), el), after = tag(await partText(out, part), el);
      expect(before).toBeTruthy();
      expect(after).toBe(before);
    }
    expect(await partText(out, 'xl/styles.xml')).toBe(await partText(src, 'xl/styles.xml'));
    const back = await read(out, { name: 'out.xlsx' });
    expect(back.sheets[0]!.protection).toEqual((await read(src, { name: 'p.xlsx' })).sheets[0]!.protection);
    expect(back.workbookProtection).toEqual({ lockStructure: true, lockWindows: false, hasPassword: true });
    expect(back.sheets[0]!.rows[1]![1]).toBe(9);
  });
});
