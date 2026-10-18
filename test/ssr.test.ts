// SR-LAW-8 Consequences (server-side import ruled safe): every package imports in
// Node with no DOM; what needs a page says so instead of crashing at import time.
import { describe, expect, it } from 'vitest';

describe('importing in Node, no browser (SR-LAW-8)', () => {
  it('@sheetpane/export imports and writes', async () => {
    const m = await import('@sheetpane/export');
    expect((await m.toXlsx({ sheets: [{ name: 'S', rows: [[1]] }] })).length).toBeGreaterThan(0);
    expect(() => m.download('a', 'a.csv')).toThrow(/needs a browser page/);
  });
  it('@sheetpane/import imports, reads CSV, and refuses .xlsx without a DOM by name', async () => {
    const m = await import('@sheetpane/import');
    expect((await m.fromCsv('a;b\n1;2')).sheets[0]!.rows).toEqual([['a', 'b'], ['1', '2']]);
    const { toXlsx } = await import('@sheetpane/export');
    await expect(m.read(await toXlsx({ sheets: [{ name: 'S', rows: [[1]] }] }))).rejects.toMatchObject({ code: 'needs-dom' });
  });
});
