// SR-DOWNLOAD decisions 2–8 that need no browser: names, extensions, the no-page error.
import { describe, expect, it } from 'vitest';
import { download } from '../src/index.js';
import { fileNameFor } from '../src/download/index.js';

const bytes = new Uint8Array([0x50, 0x4b, 3, 4]);
const name = (d: Uint8Array | Blob | string, f: string) => fileNameFor(d, f).name;

describe('download() file names (SR-DOWNLOAD decisions 4–5)', () => {
  it('keeps a good name and matches the extension ignoring case', () => {
    expect(name(bytes, 'sales.xlsx')).toBe('sales.xlsx');
    expect(name(bytes, 'SALES.XLSX')).toBe('SALES.XLSX');
    expect(name('a,b', 'data.csv')).toBe('data.csv');
  });
  it('adds a missing extension: bytes → .xlsx, text → .csv, a typed Blob by its type', () => {
    expect(name(bytes, 'Q3 report')).toBe('Q3 report.xlsx');
    expect(name('a', 'Q3 report')).toBe('Q3 report.csv');
    expect(name(new Blob([], { type: 'text/csv;charset=utf-8' }), 'b')).toBe('b.csv');
    expect(name(new Blob([], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'b')).toBe('b.xlsx');
  });
  it('cleans unsafe names (example 5)', () => {
    expect(name(bytes, 'FY26: North/South?.xlsx')).toBe('FY26_ North_South_.xlsx');
    expect(name(bytes, '  a\u0001b\u007f "c" <d>|e*.xlsx')).toBe('ab _c_ _d__e_.xlsx');
    expect(name(bytes, 'trailing. . ')).toBe('trailing.xlsx');
  });
  it('caps the name at 200 characters, keeping the extension', () => {
    const n = name(bytes, 'x'.repeat(300) + '.xlsx');
    expect(n.length).toBe(200);
    expect(n.endsWith('x.xlsx')).toBe(true);
  });
  it('refuses, naming the file as given (example 7)', () => {
    expect(() => name(bytes, 'sales.pdf')).toThrow('"sales.pdf" — sheetpane saves .xlsx or .csv only');
    expect(() => name(new Blob([bytes]), 'mystery')).toThrow(`"mystery" — add .xlsx or .csv; the type can't be told from this Blob`);
    expect(() => name('a,b\n1,2', 'sales.xlsx')).toThrow(`"sales.xlsx" — text can't be saved as .xlsx; use .csv`);
    expect(() => name(bytes, '  .xlsx')).toThrow(/nothing is left/);
  });
  it('each refusal carries its SP code (W-40)', () => {
    const codeOf = (f: () => unknown) => { try { f(); } catch (e) { return [(e as { code?: string }).code, (e as { spCode?: string }).spCode, (e as Error).message.slice(0, 9)]; } return undefined; };
    expect(codeOf(() => name(bytes, 'sales.pdf'))).toEqual(['SP-2102', 'SP-2102', 'SP-2102: ']);
    expect(codeOf(() => name(new Blob([bytes]), 'mystery'))?.[0]).toBe('SP-2103');
    expect(codeOf(() => name('a,b', 'sales.xlsx'))?.[0]).toBe('SP-2104');
    expect(codeOf(() => name(bytes, '  .xlsx'))?.[0]).toBe('SP-2105');
    expect(codeOf(() => name(bytes, undefined as unknown as string))?.[0]).toBe('SP-2101');
    expect(codeOf(() => download(42 as unknown as string, 'x.csv'))?.[0]).toBe('SP-2107');
    expect(codeOf(() => download(bytes, 'sales.xlsx'))?.[0]).toBe('SP-2106');
  });
});

describe('download() outside a page (SR-DOWNLOAD decisions 7–8)', () => {
  it('throws, never a silent no-op', () => {
    expect(() => download(bytes, 'sales.xlsx')).toThrow('download() needs a browser page (no document); write the bytes yourself');
  });
  it('throws a TypeError for the wrong argument types', () => {
    expect(() => download(42 as unknown as string, 'x.csv')).toThrow(TypeError);
    expect(() => download(bytes, undefined as unknown as string)).toThrow(TypeError);
  });
});
