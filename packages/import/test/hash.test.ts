// W-65: the file's SHA-256 — known vectors, read() of both kinds, and no substitute hash without Web Crypto.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toXlsx } from '@sheetpane/export';
import { fromCsv, read, sha256 } from '../src/index.js';

// FIPS 180-2 appendix B.1 and the empty message
const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const LONG = '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'; // 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'

const enc = (s: string) => new TextEncoder().encode(s);

describe('sha256() — known vectors (DoD 1, 4)', () => {
  it('hashes bytes, an ArrayBuffer and a Blob to lowercase hex', async () => {
    expect(await sha256(enc('abc'))).toBe(ABC);
    expect(await sha256(new Uint8Array(0))).toBe(EMPTY);
    expect(await sha256(enc('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq').buffer)).toBe(LONG);
    expect(await sha256(new Blob(['abc']))).toBe(ABC);
  });
  it('hashes only the view, not the whole buffer behind it', async () => {
    const whole = enc('xxabcxx');
    expect(await sha256(whole.subarray(2, 5))).toBe(ABC);
  });
});

describe('read() — sha256 of the bytes opened (DoD 1)', () => {
  it('a CSV: the hash of its bytes as given', async () => {
    const book = await read(enc('abc'), { name: 'abc.csv' });
    expect(book.sha256).toBe(ABC);
  });
  it('an .xlsx: the hash of the file, the same however it is passed', async () => {
    const bytes = await toXlsx({ sheets: [{ name: 'A', rows: [[1, 'two']] }] });
    const want = await sha256(bytes);
    expect(want).toMatch(/^[0-9a-f]{64}$/);
    expect((await read(bytes)).sha256).toBe(want);
    expect((await read(new Blob([bytes as BlobPart]), { name: 'a.xlsx' })).sha256).toBe(want);
    expect((await read(new File([bytes as BlobPart], 'a.xlsx'))).sha256).toBe(want);
  });
  it('fromXlsx / fromCsv do not hash (they may not hold the file’s bytes)', async () => {
    expect((await fromCsv('a,b')).sha256).toBeUndefined();
  });
});

describe('no Web Crypto (an insecure page) — undefined and SP-1009, never a substitute (DoD 3)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it('sha256() is undefined with one SP-1009 warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('crypto', {});
    expect(await sha256(enc('abc'))).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toMatch(/^SP-1009: /);
  });
  it('read() still opens the file; its sha256 is absent', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('crypto', undefined);
    const book = await read(enc('a,b\n1,2'), { name: 'x.csv' });
    expect(book.sheets[0]!.rows).toEqual([['a', 'b'], ['1', '2']]);
    expect('sha256' in book).toBe(false);
    expect(String(warn.mock.calls[0]![0])).toMatch(/^SP-1009: /);
  });
  it('a failing digest is the same: undefined, SP-1009', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('crypto', { subtle: { digest: () => Promise.reject(new Error('boom')) } });
    expect(await sha256(enc('abc'))).toBeUndefined();
    expect(String(warn.mock.calls[0]![0])).toMatch(/^SP-1009: .*boom/);
  });
});
