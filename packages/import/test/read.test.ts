import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { toCsv, toXlsx, type Workbook } from '@sheetpane/export';
import features from './fixtures/exceljs-features.xlsx?inline';
import d1904 from './fixtures/exceljs-1904.xlsx?inline';
import { fromCsv, fromXlsx, read, type ImportedWorkbook } from '../src/index.js';
import { SAMPLE_BOOK, SAMPLE_CSV_SHEET } from '../../export/test/fixtures/sample.js';
import { fromDataUrl } from './helpers.js';

const plain = (b: ImportedWorkbook): Workbook => ({ sheets: b.sheets.map((s) => ({ name: s.name, rows: s.rows, merges: s.merges ?? [], hidden: !!s.hidden })) });

describe('read → the Workbook @sheetpane/export writes (DoD 3, 7)', () => {
  it('reads the design sample built by toXlsx: values, text, names, merges, widths', async () => {
    const b = await read(await toXlsx(SAMPLE_BOOK), { name: 'sample.xlsx' });
    expect(b.source).toBe('xlsx');
    expect(b.sheets.map((s) => s.name)).toEqual(['Holdings', 'Fee tiers']);
    SAMPLE_BOOK.sheets.forEach((s, i) => {
      const got = b.sheets[i]!;
      s.rows.forEach((row, r) => row.forEach((v, c) => expect(got.rows[r]?.[c] ?? null, `${s.name} ${r},${c}`).toEqual(v)));
      expect(got.merges).toEqual(s.merges);
      s.columnWidths!.forEach((w, c) => expect(got.columnWidths![c]).toBeCloseTo(w));
    });
    expect(b.sheets[0]!.text[2]).toEqual(['AC-10021', 'R. Mehta', 'S. Kapoor', 'Total Market Index Fund', 'TMKT', '1200', '268.4', '322080', '0.75%', '30-Sep-2026']);
  });
  it('round-trips: toXlsx(read(file)) read again is the same — any grid (property)', async () => {
    const cell = fc.oneof(fc.constant(null), fc.boolean(), fc.integer({ min: -1e6, max: 1e6 }), fc.double({ min: -1e6, max: 1e6, noNaN: true }), fc.string({ minLength: 1, maxLength: 8 }));
    await fc.assert(fc.asyncProperty(fc.array(fc.array(cell, { maxLength: 5 }), { maxLength: 5 }), fc.boolean(), async (rows, hide) => {
      const book: Workbook = { sheets: [{ name: 'A', rows, merges: ['F1:G2'] }, { name: 'B', rows: [[1]], hidden: hide }] };
      const once = await read(await toXlsx(book, { compression: 'store' }));
      const twice = await read(await toXlsx(plain(once), { compression: 'store' }));
      expect(plain(twice)).toEqual(plain(once));
      rows.forEach((row, r) => row.forEach((v, c) => expect(once.sheets[0]!.rows[r]?.[c] ?? null).toEqual(Object.is(v, -0) ? 0 : v)));
    }), { seed: 6, numRuns: 50 });
  });
});

describe('a workbook written by another program (ExcelJS)', async () => {
  const b = await fromXlsx(fromDataUrl(features));
  const s = b.sheets[0]!;
  it('marks hidden sheets and reads every sheet', () => {
    expect(b.sheets.map((x) => [x.name, x.hidden])).toEqual([['Holdings', false], ['Hidden', true]]);
    expect(b.sheets[1]!.rows).toEqual([['secret', 1]]);
  });
  it('shows typed cells through the number-format subset and keeps the raw value', () => {
    expect(s.rows[2]!.slice(0, 9)).toEqual(['AC-10021', 1200, 268.4, 322080, 46295, 0.0075, 1234.5, true, '#DIV/0!']);
    expect(s.text[2]!.slice(0, 9)).toEqual(['AC-10021', '1,200', '268.40', '322,080.00', '30-Sep-2026', '0.75%', '1234.5', 'TRUE', '#DIV/0!']);
  });
  it('reads formulas as their saved value, expanding shared formulas', () => {
    expect(s.formulas).toEqual({ D3: 'B3*C3', D4: 'B4*C4', D5: 'B5*C5' });
    expect(s.rows[3]![3]).toBe(32185.5);
  });
  it('reads merges, widths, hidden rows and columns, heights, the frozen pane', () => {
    expect(s.merges).toEqual(['A1:E1']);
    expect(s.columnWidths![0]).toBe(14);
    expect(s.hiddenCols).toEqual([8]);
    expect(s.hiddenRows).toEqual([5]);
    expect(s.rows[5]).toEqual(['hidden row']);
    expect(s.rowHeights[3]).toBe(30);
    expect(s.freeze).toEqual({ rows: 2, cols: 1 });
  });
  it('exposes the tables plugins read (DoD 12)', async () => {
    const xf = b.styles.cellXfs[s.styleIndex.A3!]!;
    expect(b.styles.fonts[xf.fontId]).toMatchObject({ b: true, color: { rgb: 'FF2346C8' } });
    expect(b.styles.fills[xf.fillId]).toMatchObject({ patternType: 'solid', fgColor: { rgb: 'FFFFF2CC' } });
    expect(b.styles.borders[xf.borderId]!.bottom).toMatchObject({ style: 'thin' });
    expect(b.styles.numFmts[b.styles.cellXfs[s.styleIndex.G3!]!.numFmtId]).toBe('[$€-407]#,##0.00');
    expect(b.themeColors).toHaveLength(12);
    expect(s.dataValidations).toEqual([
      expect.objectContaining({ sqref: ['B3:B5'], type: 'whole', operator: 'greaterThan', formula1: '0', error: 'Units must be positive', showErrorMessage: true }),
      expect.objectContaining({ sqref: ['J3:J5'], type: 'list', formula1: '"Core,Income,Cap"' }),
    ]);
    expect(s.conditionalFormats[0]).toMatchObject({ sqref: ['C3:C5'], rules: [{ type: 'cellIs', operator: 'greaterThan', formulas: ['100'], dxfId: 0, priority: 1 }] });
    expect(s.conditionalFormats[1]!.rules[0]!.colorScale).toMatchObject({ cfvo: [{ type: 'min' }, { type: 'max' }], colors: [{ rgb: 'FFFFFFFF' }, { rgb: 'FF2346C8' }] });
    expect(b.styles.dxfs[0]!.fill).toBeDefined();
    expect(s.notes).toEqual([{ ref: 'A3', author: 'Author', text: 'Checked against the custodian file.' }]);
    expect(s.drawings).toEqual([expect.objectContaining({ kind: 'picture', anchor: 'oneCell', from: { col: 6, colOff: 0, row: 5, rowOff: 0 }, media: 'xl/media/image1.png' })]);
    const png = await b.part('xl/media/image1.png');
    expect([...png!.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
  it('honours the 1904 date system', async () => {
    const b4 = await fromXlsx(fromDataUrl(d1904));
    expect(b4.date1904).toBe(true);
    expect(b4.sheets[0]!.text[0]![0]).toBe('2026-09-30');
  });
});

describe('CSV (reading verdict decision 3)', () => {
  it('detects , ; and tab, with or without BOM, CRLF / LF / CR', async () => {
    for (const [d, eol] of [[',', '\r\n'], [';', '\n'], ['\t', '\r']] as const) {
      const text = `﻿a${d}b${d}c${eol}1${d}"x${d}y"${d}3${eol}`;
      const b = await fromCsv(text);
      expect(b.delimiter).toBe(d);
      expect(b.sheets[0]!.rows).toEqual([['a', 'b', 'c'], ['1', `x${d}y`, '3']]);
    }
  });
  it('keeps quotes, embedded newlines, empty fields and empty lines; names the sheet after the file', async () => {
    const b = await read(new TextEncoder().encode('id,note\r\n1,"say ""hi""\r\nthere"\r\n\r\n2,\r\n'), { name: 'Q3 [draft].csv' });
    expect(b.sheets[0]!.name).toBe('Q3 _draft_');
    expect(b.sheets[0]!.rows).toEqual([['id', 'note'], ['1', 'say "hi"\r\nthere'], [], ['2', null]]);
    expect(b.sheets[0]!.text[3]).toEqual(['2', '']);
  });
  it('round-trips with toCsv for any grid of text (property)', async () => {
    const s = fc.string({ unit: fc.constantFrom('a', 'é', ',', ';', '"', '\n', ' ', '1') , minLength: 1, maxLength: 6 });
    await fc.assert(fc.asyncProperty(fc.array(fc.array(s, { minLength: 3, maxLength: 3 }), { minLength: 2, maxLength: 6 }), async (rows) => {
      const b = await fromCsv(toCsv({ name: 'x', rows }, { guardFormulas: false }).text, { delimiter: ',' });
      expect(b.sheets[0]!.rows).toEqual(rows);
    }), { seed: 7, numRuns: 100 });
  });
  it('reads the design CSV sample', async () => {
    const b = await read(new TextEncoder().encode(toCsv(SAMPLE_CSV_SHEET).text), { name: 'sample.csv' });
    expect(b.sheets[0]!.rows[9]).toEqual(['AC-10051', 'M. D’Souza', null, 'Treasury Inflation Fund', 'TIPF', '500', '27.64', '13820', '0.40%', '30-Sep-2026']);
  });
  it('reads a generated 250,000-row CSV (DoD 9) and reports how long it took', async () => {
    const lines = ['id,client,units,price,value'];
    for (let i = 0; i < 250_000; i++) lines.push(`AC-${i},Client ${i % 97},${i % 1000},${(i % 300) + 0.25},${i * 3}`);
    const t0 = performance.now();
    const b = await fromCsv(lines.join('\r\n'));
    const ms = Math.round(performance.now() - t0);
    console.info(`250,000-row CSV read in ${ms} ms — ${navigator.userAgent}`);
    expect(b.sheets[0]!.rows.length).toBe(250_001);
    expect(b.sheets[0]!.rows[250_000]).toEqual(['AC-249999', 'Client 30', '999', '99.25', '749997']);
  });
});
