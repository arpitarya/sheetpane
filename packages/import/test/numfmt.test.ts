import { describe, expect, it } from 'vitest';
import { formatCode, general, inSubset, subsetCode, BUILTIN } from '../src/numfmt.js';

describe('General', () => {
  it.each([
    [0, '0'], [-5, '-5'], [0.1 + 0.2, '0.3'], [1234567.891, '1234567.891'], [1 / 3, '0.333333333'],
    [123456789012, '1.23457E+11'], [0.00000000012, '1.2E-10'], [46295, '46295'],
  ])('%d → %s', (n, s) => expect(general(n)).toBe(s));
});

describe('the subset (reading verdict decision 2)', () => {
  const f = (n: number, id: number) => formatCode(n, BUILTIN[id]!);
  it.each([
    [2.5, 1, '3'], [1.005, 2, '1.01'], [1234567.8, 3, '1,234,568'], [-1234.5, 4, '-1,234.50'],
    [0.075, 9, '8%'], [0.0075, 10, '0.75%'], [12345, 11, '1.23E+04'], [0.000123, 11, '1.23E-04'],
    [1.5, 12, '1 1/2'], [46295, 14, '9/30/2026'], [46295, 15, '30-Sep-26'], [46295, 16, '30-Sep'], [46295, 17, 'Sep-26'],
    [0.75, 18, '6:00 PM'], [0.25, 19, '6:00:00 AM'], [0.5 + 1 / 86400, 21, '12:00:01'], [46295.5, 22, '9/30/2026 12:00'],
    [1234, 37, '1,234 '], [-1234, 37, '(1,234)'], [-1234.5, 40, '(1,234.50)'],
    [0.0625, 45, '30:00'], [1.5, 46, '36:00:00'], [12345, 48, '12.3E+3'], [42, 49, '42'],
  ])('%d with built-in %i → %j', (n, id, s) => expect(f(n, id)).toBe(s));
  it('custom codes inside the subset', () => {
    expect(formatCode(46295, 'dd-mmm-yyyy')).toBe('30-Sep-2026');
    expect(formatCode(46295, 'yyyy-mm-dd')).toBe('2026-09-30');
    expect(formatCode(46295.75, 'yyyy-mm-dd hh:mm')).toBe('2026-09-30 18:00');
    expect(formatCode(1234.5, '"USD" #,##0.00')).toBe('USD 1,234.50');
    expect(formatCode(0.5, '0.0#')).toBe('0.5');
    expect(formatCode(5, '#.##')).toBe('5.');
    expect(formatCode(1234567, '#,##0,')).toBe('1,235');
  });
  it('the 1900 leap-year bug and the 1904 system', () => {
    expect(formatCode(1, 'm/d/yyyy')).toBe('1/1/1900');
    expect(formatCode(60, 'm/d/yyyy')).toBe('2/29/1900');
    expect(formatCode(61, 'm/d/yyyy')).toBe('3/1/1900');
    expect(formatCode(0, 'm/d/yyyy', true)).toBe('1/1/1904');
    expect(formatCode(46295 - 1462, 'm/d/yyyy', true)).toBe('9/30/2026');
  });
  it('knows what is outside the subset', () => {
    expect(inSubset('yyyy-mm-dd')).toBe(true);
    expect(inSubset('"USD" #,##0')).toBe(true);
    expect(inSubset('[$€-407]#,##0')).toBe(false);
    expect(inSubset('0.00;[Red]-0.00')).toBe(false);
    expect(inSubset('_(* #,##0_)')).toBe(false);
    expect(subsetCode(164, { 164: '[$-409]mmmm d, yyyy' })).toBeUndefined();
    expect(subsetCode(164, { 164: 'd mmm yyyy' })).toBe('d mmm yyyy');
    expect(subsetCode(5, {})).toBeUndefined();
  });
});
