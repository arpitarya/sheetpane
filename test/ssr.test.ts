// SR-LAW-8 Consequences (server-side import ruled safe): every package imports in
// Node with no DOM; what needs a page says so instead of crashing at import time.
import { describe, expect, it } from 'vitest';

describe('importing in Node, no browser (SR-LAW-8)', () => {
  it('@sheetpane/export imports and writes', async () => {
    const m = await import('@sheetpane/export');
    expect((await m.toXlsx({ sheets: [{ name: 'S', rows: [[1]] }] })).length).toBeGreaterThan(0);
    expect(() => m.download('a', 'a.csv')).toThrow(/^SP-2106: .*needs a browser page/);
  });
  it('@sheetpane/import imports and reads CSV and .xlsx with no DOM (SR-IMPORT decision 8)', async () => {
    const m = await import('@sheetpane/import');
    expect((await m.fromCsv('a;b\n1;2')).sheets[0]!.rows).toEqual([['a', 'b'], ['1', '2']]);
    const { toXlsx } = await import('@sheetpane/export');
    const wb = await m.read(await toXlsx({ sheets: [{ name: 'S', rows: [['a', 1], ['b & c', true]] }] }));
    expect(wb.sheets[0]!.name).toBe('S');
    expect(wb.sheets[0]!.rows).toEqual([['a', 1], ['b & c', true]]);
  });
});
