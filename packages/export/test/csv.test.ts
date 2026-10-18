import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import Papa from 'papaparse';
import { toCsv } from '../src/index.js';
import { SAMPLE_CSV_SHEET } from './fixtures/sample.js';

describe('toCsv', () => {
  it('quotes per RFC 4180 and writes CRLF with a BOM by default', () => {
    const { text } = toCsv({ name: 's', rows: [['a,b', 'say "hi"', 'line\nbreak', 'plain'], [1, true, null, 'x']] });
    expect(text).toBe('﻿"a,b","say ""hi""","line\nbreak",plain\r\n1,TRUE,,x\r\n');
  });
  it('honours delimiter, BOM and line-ending options', () => {
    const { text } = toCsv({ name: 's', rows: [['a;b', 1.5]] }, { delimiter: ';', bom: false, eol: '\n' });
    expect(text).toBe('"a;b";1.5\n');
    expect(toCsv({ name: 's', rows: [['a\tb']] }, { delimiter: '\t', bom: false }).text).toBe('"a\tb"\r\n');
  });
  it('pads ragged rows to one width', () => {
    expect(toCsv({ name: 's', rows: [['a', 'b', 'c'], ['d']] }, { bom: false }).text).toBe('a,b,c\r\nd,,\r\n');
  });
  it('guards formula-like text and reports where, but leaves numbers and signed numerals alone', () => {
    const r = toCsv({ name: 's', rows: [['=SUM(A1)', '+1', '-150', '@cmd', '\tx', '-', -5, '1,200.50', '-2e3']] }, { bom: false });
    expect(r.text).toBe("'=SUM(A1),+1,-150,'@cmd,'\tx,'-,-5,\"1,200.50\",-2e3\r\n");
    expect(r.guarded).toEqual(['A1', 'D1', 'E1', 'F1']);
    expect(toCsv({ name: 's', rows: [['=1']] }, { guardFormulas: false }).guarded).toEqual([]);
  });
  it('round-trips any grid of text through an independent reader (PapaParse)', () => {
    const cell = fc.string({ unit: fc.constantFrom('a', 'é', ',', '"', '\n', '\r\n', ' ', ';', 'x', '1') });
    fc.assert(
      fc.property(fc.array(fc.array(cell, { minLength: 2, maxLength: 4 }).map((r) => r.map((s) => 'k' + s)), { minLength: 1, maxLength: 6 }).chain((rows) => {
        const w = Math.max(...rows.map((r) => r.length));
        return fc.constant(rows.map((r) => [...r, ...Array(w - r.length).fill('k')]));
      }), (rows) => {
        const { text } = toCsv({ name: 's', rows }, { bom: false, guardFormulas: false });
        const back = Papa.parse<string[]>(text, { newline: '\r\n', delimiter: ',' }).data.filter((r) => !(r.length === 1 && r[0] === ''));
        expect(back).toEqual(rows);
      }),
      { seed: 3, numRuns: 200 },
    );
  });
  it('writes the sample sheet', () => {
    const { text, guarded } = toCsv(SAMPLE_CSV_SHEET);
    expect(text.startsWith('﻿Account ID,Client,')).toBe(true);
    expect(text).toContain('AC-10051,M. D’Souza,,Treasury Inflation Fund,TIPF,500,27.64,13820,0.40%,30-Sep-2026\r\n');
    expect(guarded).toEqual([]);
  });
});
