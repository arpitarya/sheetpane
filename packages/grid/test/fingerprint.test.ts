// W-65: the file's SHA-256 on load and on export — the store, the events, and no substitute without Web Crypto.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sha256 } from '@sheetpane/import';
import { createWorkbook } from '../src/index.js';
import { cleanup, frame, mountExcel, sampleCsv, sampleXlsx, shadow } from './helpers.js';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const hex = /^[0-9a-f]{64}$/;
const blobHash = async (b: Blob) => sha256(new Uint8Array(await b.arrayBuffer()));
type Detail = Record<string, unknown>;
function listen(el: EventTarget, name: string, prevent = false): Detail[] {
  const got: Detail[] = [];
  el.addEventListener(name, (e) => { got.push((e as CustomEvent).detail); if (prevent) e.preventDefault(); });
  return got;
}

describe('the store (DoD 2)', () => {
  it('source.sha256 is the hash of the bytes loaded; exportFile() hashes the blob it hands back', async () => {
    const bytes = await sampleXlsx();
    const s = createWorkbook();
    await s.load(bytes, 'sample.xlsx');
    const src = s.getSnapshot().source!;
    expect(src.sha256).toMatch(hex);
    expect(src.sha256).toBe(await sha256(bytes));
    s.setMode('edit');
    s.setCell('Holdings', 'G7', '268.4');
    const r = await s.exportFile();
    expect(r.sha256).toMatch(hex);
    expect(r.sha256).toBe(await blobHash(r.blob));
    expect(r.sha256).not.toBe(src.sha256);
  });
  it('a .csv, and a conversion either way, hash the bytes of the blob', async () => {
    const s = createWorkbook();
    await s.load(sampleCsv(), 'holdings.csv');
    expect(s.getSnapshot().source!.sha256).toBe(await sha256(sampleCsv()));
    for (const format of [undefined, 'xlsx'] as const) {
      const r = await s.exportFile(format ? { format } : {});
      expect(r.sha256).toBe(await blobHash(r.blob));
    }
  });
  it('edits never hash; one export hashes once', async () => {
    const s = createWorkbook();
    await s.load(await sampleXlsx(), 'sample.xlsx');
    const digest = vi.spyOn(crypto.subtle, 'digest');
    s.setMode('edit');
    for (let i = 0; i < 20; i++) s.setCell('Holdings', 'B3', `x${i}`);
    expect(digest).not.toHaveBeenCalled();
    await s.exportFile();
    expect(digest).toHaveBeenCalledTimes(1);
  });
});

describe('the events (DoD 2)', () => {
  it('sheetpane-load carries the hash of the file opened', async () => {
    const bytes = await sampleXlsx();
    const el = document.createElement('sheetpane-excel');
    document.body.append(el);
    const loads = listen(el, 'sheetpane-load');
    await el.load(bytes, 'sample.xlsx');
    expect(loads).toHaveLength(1);
    expect(loads[0]).toMatchObject({ status: 'ready', sha256: await sha256(bytes) });
  });
  it('sheetpane-export carries the hash of the blob: export(), and Download of the untouched file (no re-hash)', async () => {
    const el = await mountExcel({ mode: 'edit' });
    const opened = el.workbook!.getSnapshot().source!.sha256;
    const got = listen(el, 'sheetpane-export', true);
    const digest = vi.spyOn(crypto.subtle, 'digest');
    (shadow(el).querySelector('button.export') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(got).toHaveLength(1));
    expect(got[0]).toMatchObject({ original: true, sha256: opened });
    expect(digest).not.toHaveBeenCalled(); // the bytes handed back are the bytes opened
    el.workbook!.setCell('Holdings', 'G7', '268.4');
    const blob = await el.export();
    expect(got[1]!.sha256).toMatch(hex);
    expect(got[1]!.sha256).toBe(await blobHash(blob));
  });
});

describe('no Web Crypto (an insecure page) — undefined and SP-1009, never a substitute (DoD 3)', () => {
  it('the file opens and exports; both events say sha256: undefined; the console says SP-1009', async () => {
    const bytes = await sampleXlsx();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('crypto', {});
    const el = document.createElement('sheetpane-excel');
    el.setAttribute('mode', 'edit');
    document.body.append(el);
    const loads = listen(el, 'sheetpane-load');
    const exports = listen(el, 'sheetpane-export', true);
    await el.load(bytes, 'sample.xlsx');
    await frame();
    expect(loads[0]).toMatchObject({ status: 'ready' });
    expect('sha256' in loads[0]!).toBe(true);
    expect(loads[0]!.sha256).toBeUndefined();
    el.workbook!.setCell('Holdings', 'G7', '268.4');
    await el.export();
    expect('sha256' in exports[0]!).toBe(true);
    expect(exports[0]!.sha256).toBeUndefined();
    const lines = warn.mock.calls.map((c) => String(c[0]));
    expect(lines.filter((l) => l.startsWith('SP-1009: '))).toHaveLength(2);
  });
});
