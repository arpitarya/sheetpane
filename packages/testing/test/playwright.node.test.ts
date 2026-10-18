// W-41 DoD 7: the Playwright driver against the plain-HTML demo, in Chromium; the Node reader.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { readFileSync } from 'node:fs';
// @ts-expect-error — a plain .mjs script without types
import { serve } from '../../../scripts/serve.mjs';
import { path } from '@sheetpane/fixtures';
import { sheetpane } from '../src/playwright.js';
import { matchers, readFile, valueAt } from '../src/index.js';

expect.extend(matchers);
declare module 'vitest' { interface Assertion { toHaveCell(address: string, value: unknown): void; toHaveError(match: object): void } }

let browser: Browser, page: Page, server: { close(): void }, url: string;
beforeAll(async () => {
  ({ server, url } = await serve(new URL('../../../examples/html', import.meta.url).pathname, 0, false));
  browser = await chromium.launch();
  page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1400, height: 900 } });
  await page.goto(url);
}, 60_000);
afterAll(async () => { await browser?.close(); server?.close(); });

describe('Node reader (W-41 DoD 4)', () => {
  it('reads .xlsx in Node without a DOM — the same values as the manifest says', async () => {
    const book = await readFile(new Uint8Array(readFileSync(path('showcase.xlsx'))), 'showcase.xlsx');
    expect(book.names).toEqual(['Numbers', 'Styles', 'Formulas', 'Validation', 'CondFmt', 'Images', 'Charts', 'Comments']);
    expect(valueAt(book, 'Numbers!B6')).toBe(1.25);
    expect(valueAt(book, 'Formulas!B6')).toBe(7600);
    expect(book).toHaveCell('Validation!B4', 'Bogus');
  });
});

describe('the Playwright driver on the HTML demo (W-41 DoD 2, 3, 7)', () => {
  it('waitForLoad, ref by title, edit, flag in the panel, resolve, undo, switchSheet, readDownload', async () => {
    const sp = sheetpane(page);
    await sp.waitForLoad();
    await page.locator('sheetpane-excel').first().evaluate((el) => el.setAttribute('header-row', '2')); // the sample's titles are in row 2
    expect(await sp.ref({ column: 'Units', row: 3 })).toBe('Holdings!F3');
    await sp.edit({ column: 'Units', row: 3 }, '1300');
    expect(await sp.value('Holdings!F3')).toBe(1300);
    await sp.flag('Holdings!G4', { expected: '101.20', message: 'Stale price' });
    expect(await sp.errors()).toHaveError({ ref: 'Holdings!G4', status: 'open', message: 'Stale price' });
    await sp.resolve('Holdings!G4');
    expect(await sp.errors()).toHaveError({ ref: 'Holdings!G4', status: 'resolved' });
    const book = await sp.readDownload();
    expect(book).toHaveCell('Holdings!F3', 1300);
    await sp.undo(); // the resolve
    await sp.undo(); // the flag
    await sp.undo(); // the edit
    expect(await sp.value('Holdings!F3')).toBe(1200);
    await sp.switchSheet(book.names[1]!);
    expect(await sp.ref('A1')).toBe(`${book.names[1]}!A1`);
  }, 60_000);
});
