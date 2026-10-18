import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { cellRef, colIndex, colName, crc32, decodeOoxmlString, encodeOoxmlString, cleanXmlChars, parseRange, parseRef, shiftFormula, utf8 } from '../src/index.js';

describe('A1 references', () => {
  it('names columns', () => {
    expect([0, 25, 26, 701, 702, 16383].map(colName)).toEqual(['A', 'Z', 'AA', 'ZZ', 'AAA', 'XFD']);
  });
  it('colName and colIndex are inverses', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 16383 }), (c) => colIndex(colName(c)) === c), { seed: 1 });
  });
  it('parses refs and ranges, refusing past the limits', () => {
    expect(parseRef('$B$3')).toEqual({ row: 2, col: 1 });
    expect(parseRef('XFD1048576')).toEqual({ row: 1048575, col: 16383 });
    expect(parseRef('XFE1')).toBeUndefined();
    expect(parseRef('A1048577')).toBeUndefined();
    expect(parseRef('A0')).toBeUndefined();
    expect(parseRange('J1:A1')).toEqual({ top: 0, left: 0, bottom: 0, right: 9 });
    expect(cellRef(13, 9)).toBe('J14');
  });
});

describe('CRC-32', () => {
  it('matches the standard check value', () => {
    expect(crc32(utf8('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe('XML strings', () => {
  it('keeps CR and literal _xHHHH_ through the SpreadsheetML escape', () => {
    expect(encodeOoxmlString('a\r\nb')).toBe('a_x000D_\nb');
    expect(encodeOoxmlString('_x0041_')).toBe('_x005F_x0041_');
    fc.assert(fc.property(fc.string(), (s) => decodeOoxmlString(encodeOoxmlString(s)) === s), { seed: 2 });
  });
  it('strips what XML forbids and says so', () => {
    expect(cleanXmlChars('a\u0001b\u000bc\td')).toEqual({ text: 'abc\td', stripped: true });
    expect(cleanXmlChars('ok')).toEqual({ text: 'ok', stripped: false });
  });
});

describe('shiftFormula', () => {
  it.each([
    ['A1+$B2', 1, 2, 'C2+$B3'],
    ['SUM(A1:B2)*$C$1', 3, 0, 'SUM(A4:B5)*$C$1'],
    ['Sheet2!A1&"A1"', 1, 1, 'Sheet2!B2&"A1"'],
    ["'My Sheet'!B2", 0, 1, "'My Sheet'!C2"],
    ['LOG10(A1)+_xlfn.STDEV.S(B:B)', 1, 1, 'LOG10(B2)+_xlfn.STDEV.S(C:C)'],
    ['SUM(1:3)', 2, 0, 'SUM(3:5)'],
    ['A1', -1, 0, '#REF!'],
  ])('%s by (%i, %i)', (f, dr, dc, want) => expect(shiftFormula(f, dr, dc)).toBe(want));
});
