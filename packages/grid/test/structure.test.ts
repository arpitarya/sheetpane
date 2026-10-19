// W-52 DoD 1, 2 and 5: inserting and deleting rows and columns in the store — one change of kind
// `structure`, one undo step, every table moved (changes, errors, derived values, the selection,
// merges, hidden and outline state), the refusals, and the download that carries it.
import { describe, expect, it } from 'vitest';
import { read, type Table } from '@sheetpane/import';
import { createWorkbook, type Plugin, type StoreEvent } from '../src/index.js';
import { structureBook } from '../../export/test/fixtures/structure.js';
import { sampleCsv } from './helpers.js';

async function loaded(plugins: Plugin[] = []) {
  const s = createWorkbook({ plugins });
  await s.load(await structureBook(), 'items.xlsx');
  return s;
}
const changeEvents = (s: ReturnType<typeof createWorkbook>) => {
  const out: StoreEvent[] = [];
  s.on((e) => { if (e.type === 'change') out.push(e); });
  return out;
};

describe('insert and delete: the store (W-52 DoD 1)', () => {
  it('one change of kind structure, one event carrying op, at and count, one undo step', async () => {
    const s = await loaded();
    const events = changeEvents(s);
    expect(s.insertRows('Data', 2, 2)).toBe(true);
    expect(events).toEqual([expect.objectContaining({ type: 'change', sheet: 'Data', ref: '3:4', kind: 'structure', op: 'insertRows', at: 2, count: 2 })]);
    expect(s.changeOf('Data', '#structure')).toEqual({ kind: 'structure', was: [], now: [{ sheet: 'Data', op: 'insertRows', at: 2, count: 2 }] });
    expect(s.value('Data', 'A5')).toBe('b');
    expect(s.value('Data', 'A3')).toBeNull();
    expect(s.text('Data', 'D8')).toBe('17');
    expect(s.sheet('Data')!.formulas.D8).toBe('SUM(D2:D7)');
    expect(s.getSnapshot().canUndo).toBe(true);
    s.undo();
    expect(events.at(-1)).toMatchObject({ kind: 'structure', op: 'deleteRows', at: 2, count: 2, ref: '3:4' });
    expect(s.value('Data', 'A3')).toBe('b');
    expect(s.changeOf('Data', '#structure')).toBeUndefined();
    s.redo();
    expect(events.at(-1)).toMatchObject({ kind: 'structure', op: 'insertRows' });
    expect(s.value('Data', 'A5')).toBe('b');
    expect(s.insertCols('Data', 1)).toBe(true);
    expect(events.at(-1)).toMatchObject({ ref: 'B:B', op: 'insertCols', at: 1, count: 1 });
    expect(s.value('Data', 'C5')).toBe(2);
  });
  it('moves cell changes with their cells, rewrites typed formulas, drops what was deleted', async () => {
    const s = await loaded();
    s.setCell('Data', 'C3', '9');
    s.setCell('Data', 'C4', '7');
    s.setChange('Data', 'B3', 'style', { bold: true }, undefined);
    s.setCell('Other', 'D1', '=Data!C4*2', { parse: false });
    s.deleteRows('Data', 2);
    expect(s.changeOf('Data', 'C3')).toMatchObject({ now: 7 });
    expect(s.changeOf('Data', 'C4')).toBeUndefined();
    expect(s.changeOf('Data', 'B3', 'style')).toBeUndefined();
    expect(s.changeOf('Other', 'D1')!.now).toBe('=Data!C3*2');
    s.insertRows('Data', 0);
    expect(s.changeOf('Data', 'C4')).toMatchObject({ now: 7 });
    expect(s.changeOf('Other', 'D1')!.now).toBe('=Data!C4*2');
  });
  it('moves errors; an error on a deleted row is resolved, "row deleted"; undo puts it back', async () => {
    const s = await loaded();
    const a = s.addError({ sheet: 'Data', range: 'B4', type: 'wrong-value', severity: 'error', message: 'too high' });
    const b = s.addError({ sheet: 'Data', range: 'A6:D6', type: 'other', severity: 'note' });
    s.insertRows('Data', 0);
    expect(s.getErrors().map((e) => [e.id, e.range, e.status])).toEqual([[a.id, 'B5', 'open'], [b.id, 'A7:D7', 'open']]);
    s.deleteRows('Data', 4);
    expect(s.getErrors()[0]).toMatchObject({ id: a.id, range: 'B5', status: 'resolved', message: 'row deleted' });
    expect(s.deleteCols('Data', 0)).toBe(false); // A6:C6 is merged: cutting it is refused
    s.deleteCols('Data', 3);
    expect(s.getErrors()[1]).toMatchObject({ range: 'A6:C6' });
    s.undo(); s.undo();
    expect(s.getErrors()[0]).toMatchObject({ range: 'B5', status: 'open', message: 'too high' });
  });
  it('moves the selection, merges, freeze, hidden rows and outline with their rows', async () => {
    const s = await loaded();
    s.select({ sheet: 'Data', ref: 'B4', range: 'B4:C6' });
    s.setHidden('Data', 'rows', [3], true);
    s.setOutline('Data', 'rows', [4, 5], 1);
    s.insertRows('Data', 1, 2);
    expect(s.getSnapshot().selection).toEqual({ sheet: 'Data', ref: 'B6', range: 'B6:C8' });
    expect(s.merges('Data')).toEqual(['A8:C8']);
    expect(s.hidden('Data').rows).toEqual([5]);
    expect(s.outline('Data').rows).toEqual({ 6: 1, 7: 1 });
    expect(s.freeze('Data')).toEqual({ rows: 1, cols: 0 });
    s.insertRows('Data', 0);
    expect(s.freeze('Data')).toEqual({ rows: 2, cols: 0 });
    s.deleteRows('Data', 5, 3);
    expect(s.getSnapshot().selection.ref).toBe('B6');
  });
  it('tells the derive provider, which returns the whole set (DeriveInput restructure)', async () => {
    const seen: unknown[] = [];
    const p: Plugin = { id: 'calc', provides: ['derive'], derive: (input) => { seen.push(input); return input.kind === 'change' ? [] : [{ sheet: 'Data', ref: 'D8', value: 99, text: '99' }]; } };
    const s = await loaded([p]);
    await new Promise((r) => setTimeout(r, 0));
    s.insertRows('Data', 1, 2);
    await new Promise((r) => setTimeout(r, 0));
    expect(seen.at(-1)).toEqual({ kind: 'restructure', sheet: 'Data', op: 'insertRows', at: 1, count: 2 });
    expect([...s.getSnapshot().derived.keys()]).toEqual(['Data!D8']);
  });
});

describe('refusals (W-52 DoD 5)', () => {
  it('a delete that cuts a merge: SP-3022, nothing changes', async () => {
    const s = await loaded();
    expect(s.structureRefusal({ sheet: 'Data', op: 'deleteCols', at: 1, count: 1 })).toMatchObject({ code: 'SP-3022' });
    expect(s.deleteCols('Data', 1)).toBe(false);
    expect(s.getSnapshot().canUndo).toBe(false);
    expect(s.deleteCols('Data', 0, 3)).toBe(true); // the whole merge goes with its columns
    expect(s.merges('Data')).toEqual([]);
  });
  it('a pivot that would move (SP-3023), a table cut (SP-3025, W-61’s tables), cells off the sheet (SP-3024)', async () => {
    const s = await loaded();
    const data = s.sheet('Data')! as { pivotTables: { name: string; ref: string; source?: { sheet: string; ref: string } }[]; tables: Table[] };
    data.pivotTables.push({ name: 'P', ref: 'H20:J30' });
    expect(s.structureRefusal({ sheet: 'Data', op: 'insertRows', at: 4, count: 1 })).toMatchObject({ code: 'SP-3023' });
    expect(s.structureRefusal({ sheet: 'Data', op: 'insertRows', at: 31, count: 1 })).toBeUndefined();
    data.pivotTables.length = 0;
    const other = s.sheet('Other')! as typeof data;
    other.pivotTables.push({ name: 'P', ref: 'A10:B20', source: { sheet: 'Data', ref: 'A1:D5' } });
    expect(s.structureRefusal({ sheet: 'Data', op: 'deleteRows', at: 0, count: 1 })?.message).toContain('the source of the pivot table P');
    expect(s.structureRefusal({ sheet: 'Data', op: 'deleteRows', at: 7, count: 1 })).toBeUndefined();
    other.pivotTables.length = 0;
    data.tables = [{ name: 'Items', id: 1, ref: 'A1:D5', headerRowCount: 1, totalsRowCount: 0, columns: [], style: { showFirstColumn: false, showLastColumn: false, showRowStripes: true, showColumnStripes: false }, path: 'xl/tables/table1.xml' }];
    expect(s.structureRefusal({ sheet: 'Data', op: 'deleteRows', at: 0, count: 1 })).toMatchObject({ code: 'SP-3025', message: 'This deletes the header row of table Items.' });
    expect(s.structureRefusal({ sheet: 'Data', op: 'insertRows', at: 3, count: 1 })).toBeUndefined();
    data.tables[0]!.headerRowCount = 0; // no header row: the top row is a data row
    expect(s.structureRefusal({ sheet: 'Data', op: 'deleteRows', at: 0, count: 1 })).toBeUndefined();
    data.tables = [];
    const wide = s.sheet('Other')!.rows[0]!;
    wide[16_383] = 'edge';
    expect(s.structureRefusal({ sheet: 'Other', op: 'insertCols', at: 0, count: 1 })).toMatchObject({ code: 'SP-3024' });
    expect(s.insertRows('Nope', 0)).toBe(false);
    expect(s.insertRows('Data', -1)).toBe(false);
  });
});

describe('the download carries it (W-52 DoD 4, 5)', () => {
  it('an .xlsx: the structure replayed first, then the cell changes where they now are', async () => {
    const s = await loaded();
    s.insertRows('Data', 2);
    s.setCell('Data', 'A3', 'new');
    expect(s.deleteCols('Data', 3)).toBe(true);
    const back = await read(new Uint8Array(await (await s.exportFile()).blob.arrayBuffer()), { name: 'x.xlsx' });
    const d = back.sheets[0]!;
    expect(d.rows.slice(0, 4)).toEqual([['Name', 'Rate', 'Qty'], ['a', 1.5, 2], ['new'], ['b', 2, 3]]);
    expect(back.sheets[1]!.formulas).toMatchObject({ A1: 'Data!#REF!*2', B1: 'SUM(Data!B2:B6)' });
    expect(d.rows).toEqual(s.sheet('Data')!.rows.map((r, i) => (i === 2 ? ['new'] : r)));
  });
  it('a .csv supports rows and columns', async () => {
    const s = createWorkbook();
    await s.load(sampleCsv(), 'q3.csv');
    const first = s.sheet(s.getSnapshot().selection.sheet)!;
    const name = first.name, header = first.rows[0]!;
    expect(s.insertRows(name, 1)).toBe(true);
    expect(s.deleteCols(name, 0)).toBe(true);
    const text = await (await s.exportFile()).blob.text();
    const lines = text.split(/\r?\n/);
    expect(lines[0]!.split(',')[0]).toBe(String(header[1]));
    expect(lines[1]!.replace(/,/g, '')).toBe('');
  });
});
