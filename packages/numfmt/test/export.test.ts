import { describe, expect, it } from 'vitest';
import { toXlsx } from '@sheetpane/export';
import { read } from '@sheetpane/import';
import { SAMPLE_BOOK } from '../../export/test/fixtures/sample.js';
import { createWorkbook } from '@sheetpane/grid';
import { numfmt } from '../src/index.js';
import { patchSheet, patchStyles } from '../src/patch.js';
import { styledBook } from './helpers.js';

const bytesOf = async (store: ReturnType<typeof createWorkbook>) => new Uint8Array(await (await store.exportFile()).blob.arrayBuffer());
const fresh = async (bytes: Uint8Array) => { const s = createWorkbook({ plugins: [numfmt()] }); await s.load(bytes, 'f.xlsx'); return s; };

const BASE = [
  { ref: 'A1', value: 1234.5, code: '#,##0.00' },
  { ref: 'A2', value: 0.256 },
  { ref: 'A3', value: 5 },
  { ref: 'B1', value: 45000, id: 14 },
  { ref: 'B2', value: 7, code: '0.0' },
];

describe('exportPatch (DoD 5)', () => {
  it('writes new numFmts and xfs, deduplicated, repoints only the changed cells, and reads back as shown', async () => {
    const store = await fresh(styledBook(BASE));
    const before = store.book!;
    const untouched = { ...before.sheets[0]!.styleIndex };
    store.setChange('Data', 'A2', 'numFmt', '0.0%', 'General');     // new custom code
    store.setChange('Data', 'A3', 'numFmt', '0.0%', 'General');     // the same code → the same numFmt and xf
    store.setChange('Data', 'A1', 'numFmt', '0%', '#,##0.00');      // built-in id 9: no numFmt entry
    store.setChange('Data', 'B1', 'numFmt', 'dd/mm/yyyy', 'm/d/yyyy'); // another new code
    const shown = ['A1', 'A2', 'A3', 'B1', 'B2'].map((r) => store.text('Data', r));
    expect(shown).toEqual(['123450%', '25.6%', '500.0%', '15/03/2023', '7.0']);

    const out = await bytesOf(store);
    const back = await read(out, { name: 'f.xlsx' });
    // two new custom formats (0.0%, dd/mm/yyyy) on top of the file's two (#,##0.00, 0.0)
    expect(Object.values(back.styles.numFmts).sort()).toEqual(['#,##0.00', '0.0', '0.0%', 'dd/mm/yyyy']);
    // xfs: the file's own + one per distinct (base xf, code): A2/A3 share (xf 0, 0.0%), A1 (xf 1, 0%), B1 (xf 2, dd/mm/yyyy)
    expect(back.styles.cellXfs.length).toBe(before.styles.cellXfs.length + 3);
    // untouched cells keep their s
    expect(back.sheets[0]!.styleIndex['B2']).toBe(untouched['B2']);
    // the new xfs kept their base's other properties
    expect(back.styles.cellXfs[back.sheets[0]!.styleIndex['A1']!]!.alignment).toEqual({ horizontal: 'right' });
    expect(back.styles.cellXfs[back.sheets[0]!.styleIndex['A1']!]!.numFmtId).toBe(9);
    expect(back.sheets[0]!.styleIndex['A2']).toBe(back.sheets[0]!.styleIndex['A3']);

    // …and a fresh pane shows exactly what the first one showed
    const again = await fresh(out);
    expect(['A1', 'A2', 'A3', 'B1', 'B2'].map((r) => again.text('Data', r))).toEqual(shown);
    expect(again.changeCount).toBe(0);
  });

  it('exporting the same change again adds nothing: codes already in the file are reused', async () => {
    const first = await fresh(styledBook(BASE));
    first.setChange('Data', 'A2', 'numFmt', '0.0%', 'General');
    const once = await bytesOf(first);
    const second = await fresh(once);
    second.setChange('Data', 'A3', 'numFmt', '0.0%', 'General');
    const twice = await read(await bytesOf(second), { name: 'f.xlsx' });
    const b1 = await read(once, { name: 'f.xlsx' });
    expect(Object.keys(twice.styles.numFmts).length).toBe(Object.keys(b1.styles.numFmts).length);
    expect(twice.styles.cellXfs.length).toBe(b1.styles.cellXfs.length);
    expect(twice.sheets[0]!.styleIndex['A3']).toBe(b1.sheets[0]!.styleIndex['A2']);
  });

  it('a value edit and a format change on different cells are both exported', async () => {
    const store = await fresh(styledBook(BASE));
    store.setCell('Data', 'A3', '99');
    store.setChange('Data', 'A2', 'numFmt', '0.00', 'General');
    const back = await fresh(await bytesOf(store));
    expect(back.text('Data', 'A3')).toBe('99');
    expect(back.text('Data', 'A2')).toBe('0.26');
  });

  it('works on a workbook the export package wrote (no <numFmts> yet), and on cells the sheet does not hold', async () => {
    const store = createWorkbook({ plugins: [numfmt()] });
    await store.load(await toXlsx(SAMPLE_BOOK), 's.xlsx');
    expect(store.text('Holdings', 'F3')).toBe('1200');
    store.setChange('Holdings', 'F3', 'numFmt', '#,##0.00', 'General');
    store.setChange('Holdings', 'G3', 'numFmt', '"$"0.000', 'General');
    store.setChange('Holdings', 'M20', 'numFmt', '0.0%', 'General'); // an empty cell in a row that does not exist
    store.setChange('Holdings', 'L3', 'numFmt', '0.0%', 'General'); // an empty cell past the end of an existing row
    const back = await read(await bytesOf(store), { name: 's.xlsx' });
    expect(Object.values(back.styles.numFmts).sort()).toEqual(['"$"0.000', '0.0%']); // #,##0.00 is built-in id 4: no entry
    expect(back.styles.cellXfs[back.sheets[0]!.styleIndex['F3']!]!.numFmtId).toBe(4);
    const re = await fresh(await bytesOf(store));
    expect(re.text('Holdings', 'F3')).toBe('1,200.00');
    expect(re.text('Holdings', 'G3')).toBe('$268.400');
    expect(back.sheets[0]!.styleIndex['M20']).toBeGreaterThan(0);
    expect(back.sheets[0]!.styleIndex['L3']).toBeGreaterThan(0);
    expect(back.sheets[0]!.styleIndex['M20']).toBe(back.sheets[0]!.styleIndex['L3']);
    // every other cell is as it was
    expect(re.text('Holdings', 'B3')).toBe('R. Mehta');
    expect(re.text('Holdings', 'H3')).toBe('322080');
  });

  it('a CSV has no styles: exporting a pane with format changes still gives the CSV', async () => {
    const store = createWorkbook({ plugins: [numfmt()] });
    await store.load(new TextEncoder().encode('a,b\n1,2\n'), 'x.csv');
    store.setChange('Sheet1', 'A2', 'numFmt', '0.00', 'General');
    expect((await store.exportFile()).kind).toBe('csv');
  });
});

describe('the styles patch, unit (DoD 5)', () => {
  const STYLES = '<?xml version="1.0"?><styleSheet xmlns="x"><fonts count="1"><font/></fonts><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="3" applyNumberFormat="1"><alignment horizontal="center"/></xf></cellXfs><cellStyles count="1"/></styleSheet>';
  it('adds <numFmts> first when absent; escapes the code; starts custom ids at 164', () => {
    const { xml, styleOf } = patchStyles(STYLES, [{ sheet: 'S', ref: 'A1', was: 1, code: '"a&b" 0' }]);
    expect(xml).toMatch(/^<\?xml version="1.0"\?><styleSheet xmlns="x"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;a&amp;b&quot; 0"\/><\/numFmts><fonts/);
    expect(xml).toContain('<cellXfs count="3">');
    expect(styleOf(1, '"a&b" 0')).toBe(2);
    expect(xml).toContain('<xf numFmtId="3" applyNumberFormat="1"><alignment horizontal="center"/></xf><xf numFmtId="164" applyNumberFormat="1"><alignment horizontal="center"/></xf></cellXfs>');
  });
  it('picks the next free id after the file’s own, and an out-of-range base falls back to xf 0', () => {
    const withFmts = STYLES.replace('<fonts', '<numFmts count="1"><numFmt numFmtId="170" formatCode="0.0"/></numFmts><fonts');
    const { xml, styleOf } = patchStyles(withFmts, [{ sheet: 'S', ref: 'A1', was: 99, code: '0.000' }]);
    expect(xml).toContain('<numFmts count="2"><numFmt numFmtId="170" formatCode="0.0"/><numFmt numFmtId="171" formatCode="0.000"/></numFmts>');
    expect(styleOf(99, '0.000')).toBe(2);
    expect(xml).toContain('<xf numFmtId="171" applyNumberFormat="1"/></cellXfs>');
  });
  it('a built-in code needs no numFmt; General is id 0; an identical xf is reused', () => {
    const { xml, styleOf } = patchStyles(STYLES, [{ sheet: 'S', ref: 'A1', was: 0, code: '0.00%' }, { sheet: 'S', ref: 'A2', was: 0, code: 'General' }]);
    expect(xml).not.toContain('<numFmts');
    expect(styleOf(0, '0.00%')).toBe(2);
    expect(xml).toContain('<xf numFmtId="10" applyNumberFormat="1"/>');
    expect(styleOf(0, 'General')).toBe(3); // numFmtId="0" + applyNumberFormat="1" differs from the bare xf 0
    expect(patchStyles(xml, [{ sheet: 'S', ref: 'A1', was: 0, code: 'General' }]).xml).toContain('<cellXfs count="4">');
  });
  it('refuses a part that is not a style sheet', () => {
    expect(() => patchStyles('<nope/>', [{ sheet: 'S', ref: 'A1', was: 0, code: '0' }])).toThrow(/not a style sheet/);
  });
  it('patchSheet sets s, adds it, and inserts a cell in order, a row in order, or the first row', () => {
    const x = '<worksheet><sheetData><row r="2"><c r="A2" s="4"><v>1</v></c><c r="C2"><v>2</v></c></row><row r="5"/></sheetData></worksheet>';
    const out = patchSheet(x, new Map([['A2', 9], ['C2', 8], ['B2', 7], ['D2', 6], ['A1', 5], ['A5', 4], ['A9', 3]]));
    expect(out).toBe('<worksheet><sheetData><row r="1"><c r="A1" s="5"/></row><row r="2"><c r="A2" s="9"><v>1</v></c><c r="B2" s="7"/><c r="C2" s="8"><v>2</v></c><c r="D2" s="6"/></row><row r="5"><c r="A5" s="4"/></row><row r="9"><c r="A9" s="3"/></row></sheetData></worksheet>');
    expect(patchSheet('<worksheet><sheetData/></worksheet>', new Map([['B3', 1]]))).toBe('<worksheet><sheetData><row r="3"><c r="B3" s="1"/></row></sheetData></worksheet>');
  });
});
