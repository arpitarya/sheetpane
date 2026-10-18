import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { ExportError, toCsv, toXlsx, type Cell, type Workbook } from '../src/index.js';
import { SAMPLE_BOOK, SAMPLE_CSV_SHEET } from './fixtures/sample.js';
import { readBack, unzipText, values } from './helpers.js';

const fixture = (f: string) => new URL(`./fixtures/${f}`, import.meta.url);

describe('toXlsx', () => {
  it('writes the parts the verdict names, text inline, numbers and booleans typed', async () => {
    const z = unzipText(await toXlsx({ sheets: [{ name: 'S', rows: [['a & <b>', 1.5, true, null, '007']] }] }, { compression: 'store' }));
    expect(Object.keys(z).sort()).toEqual(['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']);
    const s = z['xl/worksheets/sheet1.xml']!;
    expect(s).toContain('<c r="A1" t="inlineStr"><is><t>a &amp; &lt;b&gt;</t></is></c>');
    expect(s).toContain('<c r="B1"><v>1.5</v></c><c r="C1" t="b"><v>1</v></c><c r="E1" t="inlineStr"><is><t>007</t></is></c>');
    expect(s).not.toContain('r="D1"');
  });
  it('reads back the sample workbook with an independent reader — values, names, merges, widths', async () => {
    const wb = await readBack(await toXlsx(SAMPLE_BOOK));
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Holdings', 'Fee tiers']);
    SAMPLE_BOOK.sheets.forEach((s, i) => {
      const ws = wb.worksheets[i]!;
      const got = values(ws);
      s.rows.forEach((row, r) => row.forEach((v, c) => expect(got[r]?.[c] ?? null, `${s.name} r${r} c${c}`).toEqual(v)));
      expect(ws.model.merges).toEqual(s.merges);
      expect(ws.getCell(s.merges![0]!.split(':')[0]!).alignment).toMatchObject({ horizontal: 'center' });
      s.columnWidths!.forEach((w, c) => expect(ws.getColumn(c + 1).width).toBeCloseTo(w));
    });
  });
  it('marks hidden sheets and keeps the first visible one active', async () => {
    const z = unzipText(await toXlsx({ sheets: [{ name: 'H', rows: [[1]], hidden: true }, { name: 'V', rows: [[2]] }] }));
    expect(z['xl/workbook.xml']).toContain('<sheet name="H" sheetId="1" state="hidden" r:id="rId1"/>');
    expect(z['xl/workbook.xml']).toContain('activeTab="1"');
    const wb = await readBack(await toXlsx({ sheets: [{ name: 'H', rows: [[1]], hidden: true }, { name: 'V', rows: [[2]] }] }));
    expect(wb.worksheets[0]!.state).toBe('hidden');
  });
  it('keeps whitespace, newlines and carriage returns in text', async () => {
    const rows: Cell[][] = [['  lead', 'trail  ', 'two\nlines', 'cr\r\nlf', '_x0041_']];
    const wb = await readBack(await toXlsx({ sheets: [{ name: 'S', rows }] }));
    expect(values(wb.worksheets[0]!)[0]!.slice(0, 3)).toEqual(rows[0]!.slice(0, 3));
    const z = unzipText(await toXlsx({ sheets: [{ name: 'S', rows }] }));
    expect(z['xl/worksheets/sheet1.xml']).toContain('cr_x000D_\nlf');
    expect(z['xl/worksheets/sheet1.xml']).toContain('_x005F_x0041_');
  });
  it('strips characters XML forbids and reports the cells', async () => {
    let refs: string[] = [];
    const z = unzipText(await toXlsx({ sheets: [{ name: 'S', rows: [['ok', 'bell\u0007']] }] }, { onStripped: (r) => (refs = r) }));
    expect(refs).toEqual(['S!B1']);
    expect(z['xl/worksheets/sheet1.xml']).toContain('<t>bell</t>');
  });
  it('round-trips any small grid of values (property, independent reader)', async () => {
    const cell = fc.oneof(fc.constant(null), fc.boolean(), fc.integer({ min: -1e9, max: 1e9 }), fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e12, max: 1e12 }), fc.string({ minLength: 1, maxLength: 12 }).filter((s) => s.trim() === s && /^[ -~é€]+$/.test(s)));
    await fc.assert(fc.asyncProperty(fc.array(fc.array(cell, { maxLength: 6 }), { maxLength: 6 }), async (rows) => {
      const wb = await readBack(await toXlsx({ sheets: [{ name: 'P', rows }] }, { compression: 'store' }));
      const got = values(wb.worksheets[0]!);
      rows.forEach((row, r) => row.forEach((v, c) => expect(got[r]?.[c] ?? null).toEqual(Object.is(v, -0) ? 0 : v)));
    }), { seed: 4, numRuns: 60 });
  });
});

describe('toXlsx input rules', () => {
  const bad = async (book: Workbook) => toXlsx(book).then(() => 'ok', (e: ExportError) => `${e.code}: ${e.message}`);
  it.each([
    ['', 'sheet-name'], ['x'.repeat(32), 'sheet-name'], ['a/b', 'sheet-name'], ['a[1]', 'sheet-name'], ["'q", 'sheet-name'],
  ])('refuses the sheet name %j', async (name, code) => {
    expect(await bad({ sheets: [{ name, rows: [] }] })).toMatch(new RegExp(`^${code}`));
  });
  it('refuses duplicate names ignoring case, no sheets, and all sheets hidden', async () => {
    expect(await bad({ sheets: [{ name: 'Data', rows: [] }, { name: 'DATA', rows: [] }] })).toMatch(/used twice/);
    expect(await bad({ sheets: [] })).toMatch(/at least one sheet/);
    expect(await bad({ sheets: [{ name: 'A', rows: [], hidden: true }] })).toMatch(/visible/);
    expect(await bad({ sheets: [] })).toMatch(/^sheet-count: SP-2002: No visible sheet — a workbook needs at least one sheet \(https:\/\/github\.com\/arpitarya\/sheetpane\/blob\/main\/docs\/ERRORS\.md#sp-2002\)$/); // W-40
  });
  it('names the sheet and the cell past the row and column limits', async () => {
    expect(await bad({ sheets: [{ name: 'Big', rows: new Array(1_048_577).fill([]) }] })).toMatch(/"Big" has 1048577 rows.*A1048577/);
    expect(await bad({ sheets: [{ name: 'Wide', rows: [[], new Array(16_385).fill(1)] }] })).toMatch(/"Wide" row 2 has 16385 columns.*XFE2/);
  });
  it('refuses NaN, Infinity, over-long text and overlapping merges, naming the cell', async () => {
    expect(await bad({ sheets: [{ name: 'S', rows: [[1, NaN]] }] })).toMatch(/S!B1 holds NaN/);
    expect(await bad({ sheets: [{ name: 'S', rows: [['x'.repeat(32_768)]] }] })).toMatch(/S!A1 holds 32768 characters/);
    expect(await bad({ sheets: [{ name: 'S', rows: [], merges: ['A1:B2', 'B2:C3'] }] })).toMatch(/overlaps/);
    expect(await bad({ sheets: [{ name: 'S', rows: [], merges: ['A1'] }] })).toMatch(/two or more cells/);
  });
});

describe('determinism (store mode) and the golden sample', () => {
  it('gives the same bytes for the same object, and matches the committed golden', async () => {
    const a = await toXlsx(SAMPLE_BOOK, { compression: 'store' });
    expect(await toXlsx(SAMPLE_BOOK, { compression: 'store' })).toEqual(a);
    const golden = fixture('sheetpane-sample.store.xlsx');
    if (process.env.SP_UPDATE_GOLDENS || !existsSync(golden)) writeFileSync(golden, a);
    expect(new Uint8Array(readFileSync(golden))).toEqual(a);
  });
  it('writes the deflate sample and the CSV sample for the decider to open (W-03 DoD 8)', async () => {
    const x = await toXlsx(SAMPLE_BOOK);
    const c = toCsv(SAMPLE_CSV_SHEET).text;
    const xf = fixture('sheetpane-sample.xlsx'), cf = fixture('sheetpane-sample.csv');
    if (process.env.SP_UPDATE_GOLDENS || !existsSync(cf)) { writeFileSync(xf, x); writeFileSync(cf, c); }
    expect(values((await readBack(new Uint8Array(readFileSync(xf)))).worksheets[0]!)[1]![0]).toBe('Account ID');
    expect(readFileSync(cf, 'utf8')).toBe(c);
  });
});
