import { afterEach, describe, expect, it } from 'vitest';
import { createWorkbook } from '@sheetpane/grid';
import { numfmt } from '../src/index.js';
import { formatValue, resolveLocale, documentLocale } from '../src/fmt.js';
import { styledBook } from './helpers.js';

afterEach(() => { document.documentElement.removeAttribute('lang'); });

const book = (cells: Parameters<typeof styledBook>[0]) => styledBook(cells);

describe('locale (DoD 6)', () => {
  it('de-DE: separators, month names, percent, General and the system date ids', async () => {
    const store = createWorkbook({ plugins: [numfmt({ locale: 'de-DE' })] });
    await store.load(book([
      { ref: 'A1', value: 1234567.891, code: '#,##0.00' },
      { ref: 'A2', value: 45000, code: 'd mmmm yyyy' },
      { ref: 'A3', value: 0.1234, code: '0.0%' },
      { ref: 'A4', value: 1234.5, id: 0 },
      { ref: 'A5', value: 45000, id: 14 },
      { ref: 'A6', value: 45000, code: 'dddd' },
      { ref: 'A7', value: 1234.5, id: 4 },
    ]), 'f.xlsx');
    expect(['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'].map((r) => store.text('Data', r))).toEqual([
      '1.234.567,89', '15 März 2023', '12,3%', '1234,5', '15.03.2023', 'Mittwoch', '1.234,50',
    ]);
  });

  it('en-IN: lakh grouping (12,34,567), decimals unchanged', async () => {
    const store = createWorkbook({ plugins: [numfmt({ locale: 'en-IN' })] });
    await store.load(book([
      { ref: 'A1', value: 1234567.891, code: '#,##0.00' },
      { ref: 'A2', value: -1234567, code: '#,##0' },
      { ref: 'A3', value: 999, code: '#,##0' },
      { ref: 'A4', value: 12345, code: '#,##0' },
      { ref: 'A5', value: 123456789, code: '#,##0' },
    ]), 'f.xlsx');
    expect(['A1', 'A2', 'A3', 'A4', 'A5'].map((r) => store.text('Data', r))).toEqual(['12,34,567.89', '-12,34,567', '999', '12,345', '12,34,56,789']);
  });

  it('the page’s lang is read when a cell is formatted, not before; an unknown tag means English', async () => {
    const plugin = numfmt();
    const cells = [{ ref: 'A1', value: 1234.5, code: '#,##0.00' }];
    document.documentElement.lang = 'fr-FR';
    const fr = createWorkbook({ plugins: [plugin] });
    await fr.load(book(cells), 'f.xlsx');
    expect(fr.text('Data', 'A1')).toBe('1\u202f234,50'); // the library’s fr grouping character: a narrow no-break space
    document.documentElement.lang = 'xx-ZZ';
    const unknown = createWorkbook({ plugins: [numfmt()] });
    await unknown.load(book(cells), 'f.xlsx');
    expect(unknown.text('Data', 'A1')).toBe('1,234.50');
    document.documentElement.removeAttribute('lang');
    const none = createWorkbook({ plugins: [numfmt()] });
    await none.load(book(cells), 'f.xlsx');
    expect(none.text('Data', 'A1')).toBe('1,234.50');
  });

  it('an explicit locale option beats the page’s lang', async () => {
    document.documentElement.lang = 'de-DE';
    const store = createWorkbook({ plugins: [numfmt({ locale: 'en-GB' })] });
    await store.load(book([{ ref: 'A1', value: 1234.5, code: '#,##0.00' }]), 'f.xlsx');
    expect(store.text('Data', 'A1')).toBe('1,234.50');
  });

  it('tags are normalised: de_DE = de-DE; documentLocale is empty when lang is unset', () => {
    expect(resolveLocale('de_DE').tag).toBe('de-DE');
    expect(resolveLocale('en-IN').grouping).toEqual([3, 2]);
    expect(resolveLocale('nonsense!').tag).toBe('');
    expect(documentLocale()).toBe('');
    expect(formatValue('#,##0.00', 1234.5, { locale: 'de_DE', date1904: false })).toBe('1.234,50');
  });
});
