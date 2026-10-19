// W-63 DoD 5: the fixtures pair (@sheetpane/fixtures compare/base.xlsx → compare/now.xlsx), read by
// the import package as a host would, diffs to exactly what make.mjs built into it.
import { describe, expect, it } from 'vitest';
import { bytes } from '@sheetpane/fixtures';
import { read } from '@sheetpane/import';
import { applyDiff, diffWorkbooks, summaryText } from '../src/index.js';

describe('the compare fixtures pair (DoD 5)', () => {
  it('keyed by Account: a price changed, a row removed, added and moved; a sheet renamed, removed and added', async () => {
    const base = await read(await bytes('compare/base.xlsx'), { name: 'base.xlsx' });
    const now = await read(await bytes('compare/now.xlsx'), { name: 'now.xlsx' });
    const d = diffWorkbooks(base, now, { key: 'Account' });
    expect(d.sheets.map((s) => [s.status, s.a, s.b, s.renamed])).toEqual([
      ['changed', 'Holdings', 'Holdings', undefined],
      ['changed', 'Fees', 'Fee schedule', 0.667], // 4 of 6 distinct rows in common
      ['added', undefined, 'Summary', undefined],
      ['removed', 'Notes', undefined, undefined],
    ]);
    const [h, f] = d.sheets;
    expect(h!.rows).toEqual([
      { op: 'moved', a: 4, b: 1 },
      { op: 'changed', a: 2, b: 3 },
      { op: 'removed', a: 3, after: 3 },
      { op: 'added', b: 5, values: ['AC-10099', 'Mia Chen', 50, 18.75] },
    ]);
    expect(h!.cells.map((c) => `${c.ref} ${c.was?.text} → ${c.now.text}`)).toEqual(['D4 74.85 → 76.1']);
    expect(f!.cells.map((c) => `${c.ref} ${c.was?.text} → ${c.now.text}`)).toEqual(['B3 0.5 → 0.45']);
    expect(summaryText(d.summary)).toBe('4 sheets · 7 rows · 2 cells changed');
    // and the newer file's values come back from the older one and the diff
    expect(applyDiff(base, d).map((s) => s.name)).toEqual(['Holdings', 'Fee schedule', 'Summary']);
  });
});
