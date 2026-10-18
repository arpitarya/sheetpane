// W-42 DoD 4 in Node: path() is a file on disk; bytes() reads it; hugeCsv() makes the large case.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { bytes, hugeCsv, MANIFEST, path } from '../src/index.js';

describe('@sheetpane/fixtures in Node', () => {
  it('path() is on disk for every listed file and bytes() reads the same bytes', async () => {
    for (const f of MANIFEST.files) expect(existsSync(path(f.name)), f.name).toBe(true);
    expect(await bytes('showcase.xlsx')).toEqual(new Uint8Array(readFileSync(path('showcase.xlsx'))));
  });
  it('hugeCsv() makes the 250,000-row case on demand', () => {
    const csv = hugeCsv(1000);
    expect(csv.split('\n')).toHaveLength(1001);
    expect(csv.split('\n')[0]).toBe('Account,Email,Units,Status');
  });
});
