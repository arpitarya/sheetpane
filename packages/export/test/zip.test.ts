import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { ExportError, inflateEntry, readZip, utf8, writeZip, fromUtf8 } from '../src/index.js';

const files = [{ name: 'a.txt', data: utf8('hello '.repeat(100)) }, { name: 'dir/ü.xml', data: utf8('<x/>') }];

describe('ZIP', () => {
  it.each(['store', 'deflate'] as const)('writes %s archives an independent reader opens, and reads them back', async (compression) => {
    const z = await writeZip(files, { compression });
    const other = unzipSync(z);
    expect(fromUtf8(other['a.txt']!)).toBe('hello '.repeat(100));
    expect(fromUtf8(other['dir/ü.xml']!)).toBe('<x/>');
    const entries = readZip(z);
    expect(entries.map((e) => e.name)).toEqual(['a.txt', 'dir/ü.xml']);
    expect(entries[0]?.method).toBe(compression === 'store' ? 0 : 8);
    expect(fromUtf8(await inflateEntry(z, entries[0]!))).toBe('hello '.repeat(100));
  });
  it('is byte-identical in store mode', async () => {
    expect(await writeZip(files, { compression: 'store' })).toEqual(await writeZip(files, { compression: 'store' }));
  });
  it('refuses what is not a ZIP, ZIP64, and a corrupt entry', async () => {
    expect(() => readZip(utf8('not a zip at all, definitely not'))).toThrow(ExportError);
    const z = await writeZip(files, { compression: 'store' });
    const z64 = z.slice(); const v = new DataView(z64.buffer);
    v.setUint16(z64.length - 22 + 10, 0xffff, true);
    expect(() => readZip(z64)).toThrow(/ZIP64/);
    expect(() => readZip(z64)).toThrow(/^SP-2009: ZIP64 archive refused — /); // W-40
    const bad = z.slice(); bad[37] = bad[37]! ^ 0xff; // flip a data byte of a.txt
    await expect(inflateEntry(bad, readZip(bad)[0]!)).rejects.toThrow(/CRC-32/);
  });
  it('caps the inflated size of an entry (ZIP bomb guard)', async () => {
    const z = await writeZip([{ name: 'big', data: new Uint8Array(4 * 2 ** 20) }], { compression: 'deflate' });
    const e = readZip(z)[0]!;
    await expect(inflateEntry(z, e, { maxEntrySize: 2 ** 20 })).rejects.toMatchObject({ code: 'over-limit', spCode: 'SP-2013' });
    await expect(inflateEntry(z, { ...e, size: 1 }, { maxEntrySize: 2 ** 20 })).rejects.toMatchObject({ code: 'over-limit' });
    expect(() => readZip(z, { maxTotalSize: 2 ** 20 })).toThrow(/inflates past/);
  });
});
