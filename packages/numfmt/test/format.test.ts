import { describe, expect, it } from 'vitest';
import { createWorkbook } from '@sheetpane/grid';
import { formatCode, inSubset, subsetCode, BUILTIN_FORMATS } from '@sheetpane/import';
import { numfmt } from '../src/index.js';
import { formatValue } from '../src/fmt.js';
import { BUILTIN_ROWS, CUSTOM_ROWS } from './fixtures/table.js';
import { fromDataUrl } from '../../import/test/helpers.js';
import features from '../../import/test/fixtures/exceljs-features.xlsx?inline';
import { styledBook } from './helpers.js';

const ENV = { locale: '', date1904: false };

async function load(cells: Parameters<typeof styledBook>[0], o: Parameters<typeof styledBook>[1] = {}, opts: Parameters<typeof numfmt>[0] = {}) {
  const store = createWorkbook({ plugins: [numfmt(opts)] });
  await store.load(styledBook(cells, o), 'f.xlsx');
  return store;
}

describe('format: every built-in id and 50 custom codes through the whole pipeline (DoD 2, 7)', () => {
  it('the table has every built-in id Excel stores in a workbook and at least 40 custom formats', () => {
    const ids = BUILTIN_ROWS.map((r) => r.id);
    for (const id of [...Array(23).keys(), 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49]) expect(ids, `built-in id ${id}`).toContain(id);
    expect(CUSTOM_ROWS.length).toBeGreaterThanOrEqual(40);
  });

  it('built-in ids: the cell shows the expected text', async () => {
    const store = await load(BUILTIN_ROWS.map((r, i) => ({ ref: `A${i + 1}`, value: r.value, id: r.id })));
    const wrong = BUILTIN_ROWS.map((r, i) => ({ id: r.id, got: store.text('Data', `A${i + 1}`), want: r.expected })).filter((x) => x.got !== x.want);
    expect(wrong).toEqual([]);
  });

  it('custom codes in <numFmts>: the cell shows the expected text', async () => {
    const store = await load(CUSTOM_ROWS.map((r, i) => ({ ref: `A${i + 1}`, value: r.value, code: r.code })));
    const wrong = CUSTOM_ROWS.map((r, i) => ({ code: r.code, value: r.value, got: store.text('Data', `A${i + 1}`), want: r.expected })).filter((x) => x.got !== x.want);
    expect(wrong).toEqual([]);
  });

  it('a user edit of a number is formatted by the cell’s own format', async () => {
    const store = await load([{ ref: 'A1', value: 1, code: '#,##0.00' }]);
    store.setCell('Data', 'A1', '1234.5');
    expect(store.text('Data', 'A1')).toBe('1,234.50');
  });

  it('General follows Excel’s 11-character rule', () => {
    const g = (n: number) => formatValue('General', n, ENV);
    expect(g(12345678901)).toBe('12345678901');
    expect(g(123456789012)).toBe('1.23457E+11');
    expect(g(0.000012345)).toBe('0.000012345');
    expect(g(1e-10)).toBe('1E-10');
    expect(g(-0.5)).toBe('-0.5');
    expect(g(1234567.891234)).toBe('1234567.891');
  });
});

describe('the 1904 date system (DoD 2)', () => {
  it('shifts a date serial by 1,462 days before the library sees it; elapsed time is not a date', async () => {
    const store = await load([
      { ref: 'A1', value: 0, code: 'yyyy-mm-dd' },
      { ref: 'A2', value: 44833, code: 'yyyy-mm-dd' },
      { ref: 'A3', value: 1.5, code: '[h]:mm' },
      { ref: 'A4', value: 1.75, code: 'h:mm AM/PM' },
      { ref: 'A5', value: 1.5, code: '0.00' },
    ], { date1904: true });
    expect(store.text('Data', 'A1')).toBe('1904-01-01');
    expect(store.text('Data', 'A2')).toBe('2026-09-30');
    expect(store.text('Data', 'A3')).toBe('36:00');
    expect(store.text('Data', 'A4')).toBe('6:00 PM');
    expect(store.text('Data', 'A5')).toBe('1.50');
  });
  it('the same serial is a different date in the 1900 system', async () => {
    const store = await load([{ ref: 'A1', value: 44833, code: 'yyyy-mm-dd' }]);
    expect(store.text('Data', 'A1')).toBe('2022-09-29');
  });
});

describe('the fallback (DoD 3)', () => {
  it('a code the library rejects shows the core subset’s text and is counted', async () => {
    const plugin = numfmt();
    const store = createWorkbook({ plugins: [plugin] });
    await store.load(styledBook([
      { ref: 'A1', value: 1234.5, code: '#,##0.00' },
      { ref: 'A2', value: 1234.5, code: '0.00"unterminated' },
      { ref: 'A3', value: 7, code: '0 "ok"' },
    ]), 'f.xlsx');
    expect(store.text('Data', 'A1')).toBe('1,234.50');
    expect(store.text('Data', 'A3')).toBe('7 ok');
    // the core: A2's code is outside its subset, so it shows General
    expect(store.text('Data', 'A2')).toBe('1234.5');
    expect(plugin.fallbacks()).toEqual(['Data!A2']);
    expect(plugin.fallbacks(store.book)).toEqual(['Data!A2']);
  });
  it('an invalid user code (set through the API) falls back too and does not throw', async () => {
    const plugin = numfmt();
    const store = createWorkbook({ plugins: [plugin] });
    await store.load(styledBook([{ ref: 'A1', value: 5, code: '0.00' }]), 'f.xlsx');
    store.setChange('Data', 'A1', 'numFmt', 'bad"', '0.00');
    expect(store.text('Data', 'A1')).toBe('5.00');
    expect(plugin.fallbacks()).toEqual(['Data!A1']);
  });
});

describe('user changes (DoD 4, 5)', () => {
  it('a numFmt change re-formats the cell; reverting to the original code removes the change', async () => {
    const store = await load([{ ref: 'A1', value: 0.256, code: '0%' }]);
    store.setChange('Data', 'A1', 'numFmt', '0.000%', '0%');
    expect(store.text('Data', 'A1')).toBe('25.600%');
    expect(store.changeOf('Data', 'A1', 'numFmt')).toMatchObject({ kind: 'numFmt', was: '0%', now: '0.000%' });
    store.setChange('Data', 'A1', 'numFmt', '0%', '0%');
    expect(store.changeOf('Data', 'A1', 'numFmt')).toBeUndefined();
    expect(store.text('Data', 'A1')).toBe('26%');
    store.setChange('Data', 'A1', 'numFmt', '0.0', '0%');
    store.undo();
    expect(store.text('Data', 'A1')).toBe('26%');
  });
});

describe('subset vs library (DoD 7, the reopen trigger)', () => {
  it('over the W-13 fixture workbooks: how many numeric cells differ', async () => {
    const store = createWorkbook({ plugins: [numfmt()] });
    await store.load(fromDataUrl(features), 'features.xlsx');
    const core = createWorkbook();
    await core.load(fromDataUrl(features), 'features.xlsx');
    const cells: { cell: string; subset: string; library: string }[] = [];
    let numeric = 0;
    for (const sh of core.book!.sheets) {
      sh.rows.forEach((row, r) => row.forEach((v, c) => {
        if (typeof v !== 'number') return;
        numeric++;
        const ref = `${'ABCDEFGHIJ'[c]}${r + 1}`;
        const a = core.text(sh.name, ref), b = store.text(sh.name, ref);
        if (a !== b) cells.push({ cell: `${sh.name}!${ref}`, subset: a, library: b });
      }));
    }
    // eslint-disable-next-line no-console
    console.log(`numfmt: W-13 fixture set — ${numeric} numeric cells, ${cells.length} differ`, JSON.stringify(cells));
    expect(numeric).toBeGreaterThan(8);
    // Only the cell the subset cannot read ([$€-407]…, shown raw by the core) may differ.
    expect(cells.map((c) => c.cell)).toEqual(['Holdings!G3']);
  });

  it('over the fixture table (adversarial: built to stress the subset): the cases the subset gets wrong', () => {
    const covered = [
      ...BUILTIN_ROWS.filter((r) => BUILTIN_FORMATS[r.id] !== undefined).map((r) => ({ code: BUILTIN_FORMATS[r.id]!, value: r.value })),
      ...CUSTOM_ROWS.filter((r) => inSubset(r.code)).map((r) => ({ code: r.code, value: r.value })),
    ];
    const diffs = covered.flatMap((c) => {
      const a = formatCode(c.value, c.code), b = formatValue(c.code, c.value, ENV);
      return a === b ? [] : [`${c.code} @ ${c.value}: subset ${JSON.stringify(a)}, library ${JSON.stringify(b)}`];
    });
    expect(covered.length).toBeGreaterThan(40);
    expect(subsetCode(14, {})).toBe('m/d/yyyy');
    // The subset's remaining gaps, found by this table (SR-IMPORT records them): scaling commas after the decimals,
    // literal-separated digit masks, a padded fraction. Month-only dates and serial 0 were fixed in the subset from this table.
    expect(diffs.sort()).toEqual([
      '# ??/?? @ 0.5: subset " 1/2 ", library "  1/2 "',
      '000-00-0000 @ 123456789: subset "123456789-00-0000", library "123-45-6789"',
      '00-00-00 @ 123456: subset "123456-00-00", library "12-34-56"',
      '0.0,,"M" @ 12345678: subset "12345678.0M", library "12.3M"',
    ].sort());
  });
});
