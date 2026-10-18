// W-09 DoD 4, 5, 7, 8: open each demo in Chromium and use it as a person would.
// node scripts/demo-check.mjs <html-dir> <react-dist-dir>
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fromUtf8, inflateEntry, readZip } from '@sheetpane/export';
import { serve } from './serve.mjs';

const [htmlDir = 'examples/html', reactDir = 'examples/react/dist'] = process.argv.slice(2);
const results = [];
const check = (ok, what) => { results.push(`${ok ? '✓' : '✗'} ${what}`); if (!ok) process.exitCode = 1; };

async function run(name, dir, spa) {
  const { server, url } = await serve(dir, 0, spa);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  const errorsSeen = [];
  page.on('pageerror', (e) => errorsSeen.push(String(e)));
  try {
    await page.goto(url);
    const excel = page.locator('sheetpane-excel').first();
    const errors = page.locator('sheetpane-errors').first();
    await excel.locator('#c1_0').waitFor({ timeout: 15000 });
    check((await excel.locator('#c1_0').textContent()) === 'Account ID', `${name}: the sample workbook opens`);
    // flag an error in the sheet → it appears in the list
    await excel.locator('#c6_6').click();
    await page.keyboard.press('f');
    await errors.locator('[data-field=expected]').fill('268.4');
    await errors.locator('[data-act=add]').click();
    await errors.locator('.item').first().waitFor();
    check((await errors.locator('.item').count()) === 1, `${name}: a flagged error appears in the error list`);
    // resolve it in the list → the pin turns ✓
    await errors.locator('.item .issue').first().click();
    await errors.locator('[data-act=resolve]').click();
    await excel.locator('.pin.resolved').waitFor();
    check((await excel.locator('.pin').first().textContent()) === '✓', `${name}: resolved in the list → the pin turns ✓`);
    // edit a cell → Export downloads a file with the change
    await excel.locator('#c7_1').click();
    await excel.locator('input.cell').fill('Edited in the demo');
    await excel.locator('input.cell').press('Enter');
    const [dl] = await Promise.all([page.waitForEvent('download'), excel.locator('button.export').click()]);
    const bytes = new Uint8Array(await readFile(await dl.path()));
    const sheet = readZip(bytes).find((e) => e.name === 'xl/worksheets/sheet1.xml');
    const xml = fromUtf8(await inflateEntry(bytes, sheet));
    check(xml.includes('<t>Edited in the demo</t>') && dl.suggestedFilename().endsWith('.xlsx'), `${name}: Export downloads ${dl.suggestedFilename()} carrying the edit`);
    // the host's font, switched live
    await page.selectOption('select[aria-label="Page font"]', { label: 'Georgia' });
    await page.waitForTimeout(100);
    const fam = await excel.locator('#c2_0').evaluate((el) => getComputedStyle(el).fontFamily);
    check(/Georgia/.test(fam), `${name}: the components render in the page's font, switched live (${fam})`);
    // the pop-up on the same pane
    await page.getByRole('button', { name: 'Open in a pop-up' }).click();
    const pop = page.locator('sheetpane-excel').nth(1);
    await pop.locator('#c1_0').waitFor();
    check(await pop.evaluate((el) => el.shadowRoot.querySelector('dialog').open), `${name}: the pop-up opens on the same pane`);
    await page.keyboard.press('Escape');
    check(!(await pop.evaluate((el) => el.shadowRoot.querySelector('dialog').open)), `${name}: Esc closes the pop-up`);
    if (name === 'react') {
      // W-28: the hooks strip follows the sheet; Check columns turns on the column rules (W-27)
      const strip = page.getByTestId('review-strip');
      await excel.locator('#c4_5').click();
      await strip.filter({ hasText: 'Units (F5): 430' }).waitFor({ timeout: 5000 });
      check(true, `${name}: useSelection names the column and value under the sheet`);
      const before = await errors.locator('.item').count();
      await page.getByLabel('Check columns').check();
      await errors.locator('.item').nth(before + 2).waitFor({ timeout: 10000 });
      const rows = await errors.locator('.item').allTextContents();
      check(rows.length === before + 3 && rows.some((r) => r.includes('AC-1O044')) && rows.some((r) => r.includes('-150')), `${name}: Check columns flags the sample's three mistakes by column title`);
      await page.getByLabel('Check columns').uncheck();
      await page.waitForFunction((n) => document.querySelector('sheetpane-errors').shadowRoot.querySelectorAll('.item').length === n, before, { timeout: 10000 });
      check(true, `${name}: unchecking removes the column-rule errors`);
    }
    // a .csv opens; any other format is refused
    await page.getByRole('button', { name: 'Load the CSV sample' }).click();
    await excel.locator('.meta').filter({ hasText: 'csv' }).waitFor();
    check((await excel.locator('#c0_0').textContent()) === 'Account ID', `${name}: the CSV sample opens`);
    await page.setInputFiles('input[type=file]', { name: 'holdings.xls', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) });
    await excel.locator('.state').filter({ hasText: 'Can’t open this file' }).waitFor();
    check(true, `${name}: a .xls is refused with "Can’t open this file"`);
    check(errorsSeen.length === 0, `${name}: no page errors${errorsSeen.length ? ` (${errorsSeen.join('; ')})` : ''}`);
  } catch (e) {
    check(false, `${name}: ${e.message.split('\n')[0]}`);
  } finally {
    await browser.close();
    server.close();
  }
}

await run('html', htmlDir, false);
await run('react', reactDir, true);
console.log(results.join('\n'));
