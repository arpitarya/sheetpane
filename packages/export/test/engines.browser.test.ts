// The same object gives the same bytes in a browser engine as in Node (W-03 DoD 6),
// and deflate through CompressionStream round-trips through two readers.
import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import golden from './fixtures/sheetpane-sample.store.xlsx?inline';
import { fromUtf8, inflateEntry, readZip, toXlsx } from '../src/index.js';
import { SAMPLE_BOOK } from './fixtures/sample.js';

const fromDataUrl = (u: string) => Uint8Array.from(atob(u.slice(u.indexOf(',') + 1)), (c) => c.charCodeAt(0));

describe(`in ${navigator.userAgent.match(/(Chrome|Firefox|Safari)\/[\d.]+/)?.[0] ?? 'a browser'}`, () => {
  it('store mode reproduces the golden file Node wrote, byte for byte', async () => {
    expect(await toXlsx(SAMPLE_BOOK, { compression: 'store' })).toEqual(fromDataUrl(golden));
  });
  it('deflate output (CompressionStream) reads back through our reader and fflate', async () => {
    const z = await toXlsx(SAMPLE_BOOK);
    const ours = readZip(z);
    expect(ours.every((e) => e.method === 8)).toBe(true);
    const sheet = ours.find((e) => e.name === 'xl/worksheets/sheet1.xml')!;
    const text = fromUtf8(await inflateEntry(z, sheet));
    expect(text).toContain('Client holdings — as of 30 Sep 2026');
    expect(fromUtf8(unzipSync(z)['xl/worksheets/sheet1.xml']!)).toBe(text);
  });
});
