// Real downloads, caught by Playwright (W-12 DoD 6): the saved name, size and first bytes.
import { describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import { download, toCsv, toXlsx } from '../src/index.js';
import { save } from '../src/download/index.js';
import { SAMPLE_BOOK, SAMPLE_CSV_SHEET } from './fixtures/sample.js';

const PK = [0x50, 0x4b, 0x03, 0x04];
async function caught(run: () => void | Promise<void>) {
  await commands.armDownload();
  await run();
  return commands.takeDownload();
}

describe('download() in a real browser', () => {
  it('example 1 — toXlsx bytes save as sales.xlsx, unchanged', async () => {
    const bytes = await toXlsx(SAMPLE_BOOK);
    const d = await caught(() => download(bytes, 'sales.xlsx'));
    expect(d).toMatchObject({ name: 'sales.xlsx', size: bytes.length, failure: null });
    expect(d.head.slice(0, 4)).toEqual(PK);
  });
  it('example 2 — CSV text keeps its BOM and accents', async () => {
    const { text } = toCsv(SAMPLE_CSV_SHEET, { bom: true });
    const d = await caught(() => download(text, 'sales.csv'));
    expect(d.name).toBe('sales.csv');
    expect(d.head.slice(0, 3)).toEqual([0xef, 0xbb, 0xbf]);
    expect(d.text).toBe(text);
    expect(d.text).toContain('M. D’Souza');
  });
  it('example 3 — a Blob already in hand', async () => {
    const bytes = await toXlsx(SAMPLE_BOOK, { compression: 'store' });
    const d = await caught(() => download(new Blob([bytes as BlobPart]), 'report.xlsx'));
    expect(d).toMatchObject({ name: 'report.xlsx', size: bytes.length });
  });
  it('example 4 — a missing extension is added', async () => {
    expect((await caught(async () => download(await toXlsx(SAMPLE_BOOK), 'Q3 report'))).name).toBe('Q3 report.xlsx');
    expect((await caught(() => download(toCsv(SAMPLE_CSV_SHEET).text, 'Q3 report'))).name).toBe('Q3 report.csv');
  });
  it('example 5 — unsafe names are cleaned', async () => {
    expect((await caught(() => download(new Uint8Array(PK), 'FY26: North/South?.xlsx'))).name).toBe('FY26_ North_South_.xlsx');
  });
  it('example 8 — called after an await inside a click handler', async () => {
    const button = document.createElement('button');
    document.body.append(button);
    const done = new Promise<void>((resolve) => button.addEventListener('click', async () => {
      const bytes = await toXlsx(SAMPLE_BOOK);
      download(bytes, 'after-await.xlsx');
      resolve();
    }));
    const d = await caught(async () => { button.click(); await done; });
    expect(d.name).toBe('after-await.xlsx');
    button.remove();
  });
  it('example 7 — every error is thrown before anything is saved', () => {
    const bytes = new Uint8Array(PK);
    expect(() => download(bytes, 'sales.pdf')).toThrow('sheetpane saves .xlsx or .csv only');
    expect(() => download(new Blob([bytes]), 'mystery')).toThrow(`the type can't be told from this Blob`);
    expect(() => download('a,b\n1,2', 'sales.xlsx')).toThrow(`text can't be saved as .xlsx`);
  });
  it('leaves no link behind in the page', async () => {
    await caught(() => download('a', 'x.csv'));
    expect(document.querySelectorAll('a[download]').length).toBe(0);
  });
  it('measures the revoke delay (SR-DOWNLOAD decision 6): a 64 MB file revoked on the next task still saves whole', async () => {
    const big = new Uint8Array(64 * 2 ** 20);
    big.set(PK);
    const next = await caught(() => save(new Blob([big]), 'next-task.xlsx', 0));
    const same = await caught(() => save(new Blob([big]), 'same-task.xlsx', -1));
    console.info(`revoke on next task: ${next.failure ?? `saved ${next.size} bytes`}; in the click's own task: ${same.failure ?? `saved ${same.size} bytes`} — ${navigator.userAgent}`);
    expect(next).toMatchObject({ size: big.length, failure: null });
  });
});
