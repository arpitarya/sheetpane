// W-52 DoD 2: restructureWorkbook — every table of the imported workbook moved by one insert
// or delete; and the property that the page and the download agree: the workbook moved in memory
// reads the same as the file patchXlsx moves, read back.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { patchXlsx, type StructureOp } from '@sheetpane/export';
import { read, restructureWorkbook, shiftTables, type ImportedWorkbook } from '../src/index.js';
import { structureBook } from '../../export/test/fixtures/structure.js';
import { tablesPkg } from './helpers.js';

const op = (o: Partial<StructureOp> & Pick<StructureOp, 'op' | 'at'>): StructureOp => ({ sheet: 'Data', count: 1, ...o });
const text = async (book: ImportedWorkbook, path: string) => new TextDecoder().decode((await book.part(path))!);

describe('restructureWorkbook (W-52 DoD 2)', async () => {
  const bytes = await structureBook();
  const book = await read(bytes, { name: 's.xlsx' });
  it('leaves the workbook it was given as it was', () => {
    const before = JSON.stringify(book.sheets);
    restructureWorkbook(book, op({ op: 'insertRows', at: 2 }));
    expect(JSON.stringify(book.sheets)).toBe(before);
    expect(restructureWorkbook(book, op({ op: 'insertRows', at: 2, sheet: 'Nope' }))).toBe(book);
  });
  it('moves cells, text, formulas, merges, rules and the filter on an insert', () => {
    const next = restructureWorkbook(book, op({ op: 'insertRows', at: 2, count: 2 }));
    const d = next.sheets[0]!;
    expect(d.rows.map((r) => r[0] ?? null)).toEqual(['Name', 'a', null, null, 'b', 'c', 'd', 'Sum']);
    expect(d.text[4]).toEqual(['b', '2', '3', '6']);
    expect(d.formulas).toMatchObject({ D2: 'B2*C2', D5: 'B5*C5', D8: 'SUM(D2:D7)' });
    expect(d.formulas.D3).toBeUndefined();
    expect(d.merges).toEqual(['A8:C8']);
    expect(d.dataValidations[0]).toMatchObject({ sqref: ['B2:B7'], formula2: '$D$8' });
    expect(d.conditionalFormats[0]).toMatchObject({ sqref: ['D2:D7'], rules: [{ formulas: ['D2>$B$2*2'] }] });
    expect(d.autoFilter).toBe('A1:D7');
    expect(d.freeze).toEqual({ rows: 1, cols: 0 });
    expect(d.notes).toEqual([{ ref: 'C5', author: 'Ann', text: 'check qty' }]);
    expect(d.threadedComments[0]!.ref).toBe('B6');
    expect(d.drawings[0]).toMatchObject({ from: { row: 1, col: 5 }, to: { row: 12, col: 9 } });
    expect(next.sheets[1]!.formulas).toEqual({ A1: 'Data!D8*2', B1: 'SUM(Data!B2:B7)', C1: 'Data!B5+A1' });
    expect(next.definedNames.find((n) => n.name === 'Rates')!.formula).toBe('Data!$B$2:$B$7');
  });
  it('a delete drops the deleted cells, notes and threads and writes #REF!', () => {
    const next = restructureWorkbook(book, op({ op: 'deleteRows', at: 2 }));
    const d = next.sheets[0]!;
    expect(d.rows.map((r) => r[0])).toEqual(['Name', 'a', 'c', 'd', 'Sum']);
    expect(d.notes).toEqual([]);
    expect(next.sheets[1]!.formulas.C1).toBe('Data!#REF!+A1');
  });
  it('a column operation splices every row, widths, hidden columns and drawings', () => {
    const next = restructureWorkbook(book, op({ op: 'deleteCols', at: 1 }));
    const d = next.sheets[0]!;
    expect(d.rows[1]).toEqual(['a', 2, 3]);
    expect(d.columnWidths).toEqual([14, 10, 10]);
    expect(d.formulas.C2).toBe('#REF!*B2');
    expect(d.dataValidations).toEqual([]);
    expect(d.drawings[0]).toMatchObject({ from: { col: 4 }, to: { col: 8 } });
    const ins = restructureWorkbook(book, op({ op: 'insertCols', at: 1, count: 2 })).sheets[0]!;
    expect(ins.rows[1]).toEqual(['a', null, null, 1.5, 2, 3]);
    expect(ins.columnWidths).toEqual([14, undefined, undefined, 10, 10, 10]);
  });
  it('serves chart parts with their series moved', async () => {
    const next = restructureWorkbook(book, op({ op: 'insertRows', at: 0 }));
    expect(await text(next, 'xl/charts/chart1.xml')).toContain('<c:f>Data!$A$3:$A$6</c:f>');
    expect(await text(book, 'xl/charts/chart1.xml')).toContain('<c:f>Data!$A$2:$A$5</c:f>');
  });
  it('W-61: a sheet with no table is returned as given', () => {
    const s = book.sheets[0]!;
    expect(shiftTables(s, op({ op: 'insertRows', at: 0 }))).toBe(s);
  });
});

describe('W-52 × W-61: Excel tables move as patchXlsx moves their parts', async () => {
  const lists = await read(tablesPkg(), { name: 'tables.xlsx' });
  const tables = (b: ImportedWorkbook) => b.sheets[0]!.tables.map(({ path: _p, ...t }) => t);
  it('ref and autoFilter follow their rows; a column deleted inside a table takes its column', () => {
    const down = restructureWorkbook(lists, op({ sheet: 'Lists', op: 'insertRows', at: 2, count: 2 })).sheets[0]!;
    expect(down.tables.map((t) => [t.name, t.ref, t.autoFilter ?? null])).toEqual([['Units', 'A1:B7', 'A1:B7'], ['Readings', 'D1:F8', null]]);
    const narrow = restructureWorkbook(lists, op({ sheet: 'Lists', op: 'deleteCols', at: 4 })).sheets[0]!;
    expect(narrow.tables[1]).toMatchObject({ ref: 'D1:E6', columns: [{ name: 'Parameter', totalsRowLabel: 'Total' }, { name: 'Unit #' }] });
    expect(narrow.tables[0]!.ref).toBe('A1:B5');
    expect(lists.sheets[0]!.tables[1]!.ref).toBe('D1:F6'); // the workbook given is not changed
  });
  it('refuses what tableRefusal refuses, as patchXlsx does (bad-structure, SP-2016)', async () => {
    for (const o of [op({ sheet: 'Lists', op: 'insertCols', at: 4 }), op({ sheet: 'Lists', op: 'deleteRows', at: 0 }), op({ sheet: 'Lists', op: 'deleteRows', at: 1, count: 4 })]) {
      let thrown: unknown;
      try { restructureWorkbook(lists, o); } catch (e) { thrown = e; }
      expect(thrown).toMatchObject({ code: 'bad-structure', spCode: 'SP-2016' });
      await expect(patchXlsx(tablesPkg(), [], { structure: [o] })).rejects.toMatchObject({ code: 'bad-structure' });
    }
  });
  it('the moved workbook’s tables read as the moved file’s', async () => {
    for (const o of [op({ sheet: 'Lists', op: 'insertRows', at: 0 }), op({ sheet: 'Lists', op: 'insertRows', at: 3, count: 3 }), op({ sheet: 'Lists', op: 'deleteRows', at: 2 }), op({ sheet: 'Lists', op: 'deleteCols', at: 4 }), op({ sheet: 'Lists', op: 'insertCols', at: 0, count: 2 }), op({ sheet: 'Lists', op: 'deleteCols', at: 2 })]) {
      const file = await read(await patchXlsx(tablesPkg(), [], { structure: [o] }), { name: 'out.xlsx' });
      expect(tables(restructureWorkbook(lists, o)), `${o.op} ${o.at}`).toEqual(tables(file));
    }
  });
});

describe('property: the page and the download agree (W-52 DoD 2, 4)', async () => {
  const bytes = await structureBook();
  const book = await read(bytes, { name: 's.xlsx' });
  const view = (b: ImportedWorkbook) => b.sheets.map((s) => ({
    rows: s.rows, merges: s.merges, formulas: s.formulas, freeze: s.freeze, autoFilter: s.autoFilter ?? null,
    dataValidations: s.dataValidations, conditionalFormats: s.conditionalFormats, notes: s.notes,
    threads: s.threadedComments.map((t) => t.ref), drawings: s.drawings.map((d) => [d.from, d.to]), widths: [...(s.columnWidths ?? [])].map((w) => w ?? null),
  }));
  it('restructureWorkbook(read(file)) reads the same as read(patchXlsx(file, structure))', async () => {
    const arbOp = fc.record({
      sheet: fc.constant('Data'),
      op: fc.constantFrom('insertRows', 'deleteRows', 'insertCols', 'deleteCols'),
      at: fc.integer({ min: 0, max: 9 }),
      count: fc.integer({ min: 1, max: 3 }),
    }) as fc.Arbitrary<StructureOp>;
    await fc.assert(fc.asyncProperty(fc.array(arbOp, { minLength: 1, maxLength: 3 }), async (ops) => {
      const memory = ops.reduce(restructureWorkbook, book);
      const file = await read(await patchXlsx(bytes, [], { structure: ops }), { name: 's.xlsx' });
      expect(view(file)).toEqual(view(memory));
      expect(file.definedNames).toEqual(memory.definedNames);
    }), { numRuns: 60, examples: [[[{ sheet: 'Data', op: 'deleteCols', at: 3, count: 1 }]], [[{ sheet: 'Data', op: 'deleteRows', at: 5, count: 1 }, { sheet: 'Data', op: 'insertCols', at: 0, count: 2 }]]] });
  });
});
