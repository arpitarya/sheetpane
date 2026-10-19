// W-61 DoD 2: structured references — `Units[Name]`, `Units[[#Data],[Name]]` — resolved to plain cells.
import { describe, expect, it } from 'vitest';
import { resolveStructuredRef, type TableShape } from '../src/index.js';

// Units: A1:B5 — a header row and four data rows. Readings: D3:F8 — header, four rows, a totals row.
const UNITS: TableShape = { name: 'Units', ref: 'A1:B5', headerRowCount: 1, totalsRowCount: 0, columns: [{ name: 'Unit' }, { name: 'Meaning' }] };
const READINGS: TableShape = { name: 'Readings', ref: 'D3:F8', headerRowCount: 1, totalsRowCount: 1, columns: [{ name: 'Parameter' }, { name: 'Value' }, { name: 'Unit #' }] };
const BARE: TableShape = { name: 'NoHeader', ref: 'H1:H3', headerRowCount: 0, totalsRowCount: 0, columns: [{ name: 'Column1' }] };
const SHEETS = [{ name: 'Data' }, { name: 'Lists', tables: [UNITS, READINGS] }, { name: 'Other', tables: [BARE] }];
const at = (f: string) => resolveStructuredRef(f, SHEETS)?.ref;

describe('resolveStructuredRef (W-61)', () => {
  it('a column is its data rows, on the table’s sheet', () => {
    expect(resolveStructuredRef('Units[Unit]', SHEETS)).toEqual({ sheet: 'Lists', table: 'Units', ref: 'A2:A5', range: { top: 1, left: 0, bottom: 4, right: 0 } });
    expect(at('=Units[Meaning]')).toBe('B2:B5');
    expect(at('Readings[Value]')).toBe('E4:E7'); // the totals row left out
  });
  it('the special items name the bands', () => {
    expect(at('Units[[#Data],[Unit]]')).toBe('A2:A5');
    expect(at('Units[[#Headers],[Unit]]')).toBe('A1');
    expect(at('Units[[#All],[Unit]]')).toBe('A1:A5');
    expect(at('Readings[[#Totals],[Value]]')).toBe('E8');
    expect(at('Readings[[#Headers],[#Data],[Value]]')).toBe('E3:E7');
    expect(at('Readings[[#Data],[#Totals],[Value]]')).toBe('E4:E8');
    expect(at('Readings[#Data]')).toBe('D4:F7');
    expect(at('Readings[#All]')).toBe('D3:F8');
    expect(at('Readings[#Headers]')).toBe('D3:F3');
  });
  it('the data body: Table[] and the bare name', () => {
    expect(at('Units[]')).toBe('A2:B5');
    expect(at('Units')).toBe('A2:B5');
  });
  it('a column span, either way round', () => {
    expect(at('Readings[[Parameter]:[Value]]')).toBe('D4:E7');
    expect(at('Readings[[#All],[Value]:[Parameter]]')).toBe('D3:E8');
  });
  it('names are case-insensitive; spaces after commas; an apostrophe escapes # [ ] and itself', () => {
    expect(at('units[unit]')).toBe('A2:A5');
    expect(at('UNITS[[#data], [UNIT]]')).toBe('A2:A5');
    expect(at("Readings[Unit '#]")).toBe('F4:F7');
    expect(at("Readings[[#Data],[Unit '#]]")).toBe('F4:F7');
  });
  it('a table without a header row: its data starts at the top', () => {
    expect(at('NoHeader[Column1]')).toBe('H1:H3');
    expect(resolveStructuredRef('NoHeader[Column1]', SHEETS)?.sheet).toBe('Other');
  });
  it('nothing for what is not one range of an existing table', () => {
    for (const f of [
      'Nope[Unit]', 'Units[Nope]', 'Units[[#Totals],[Unit]]', 'NoHeader[[#Headers],[Column1]]', 'Units[[#This Row],[Unit]]', 'Units[@Unit]',
      'Readings[[#Headers],[#Totals],[Value]]', 'Readings[[Parameter],[Value]]', 'Units[[Unit]:]', 'Units[[Unit]', 'Units[Unit] extra', 'A1:B2', '"Units[Unit]"', '',
    ]) expect(at(f), f).toBeUndefined();
    expect(resolveStructuredRef('Units[Unit]', [{ name: 'Lists' }])).toBeUndefined();
    expect(resolveStructuredRef('Bad[Unit]', [{ name: 'S', tables: [{ ...UNITS, name: 'Bad', ref: 'not a ref' }] }])).toBeUndefined();
  });
});
