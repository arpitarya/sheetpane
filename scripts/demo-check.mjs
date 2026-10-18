// W-09 DoD 4, 5, 7, 8: open each demo in Chromium and use it as a person would.
// node scripts/demo-check.mjs <html-dir> <react-dist-dir>
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { sheetpane } from '@sheetpane/testing/playwright';
import { readFile as readValues, valueAt } from '@sheetpane/testing';
import { serve } from './serve.mjs';

const [htmlDir = 'examples/html', reactDir = 'examples/react/dist'] = process.argv.slice(2);
const results = [];
const check = (ok, what) => { results.push(`${ok ? '✓' : '✗'} ${what}`); if (!ok) process.exitCode = 1; };

// W-32: every gallery tab opens the showcase on its own pane, and shows its plugin's mark (absent in Vanilla).
async function gallery(page, name) {
  const tab = async (label, id, sheet) => {
    await page.getByRole('tablist', { name: 'Plugin gallery' }).getByRole('tab', { name: label, exact: true }).click();
    const panel = page.locator(`[role=tabpanel][data-tab="${id}"]`);
    const x = panel.locator('sheetpane-excel');
    await x.locator(`.tab[data-sheet="${sheet}"][aria-selected="true"]`).waitFor({ timeout: 15000 });
    await x.locator('#c1_1').waitFor();
    return { x, e: panel.locator('sheetpane-errors') };
  };
  const text = (loc) => loc.evaluate((el) => el.textContent);
  const items = (e) => e.locator('.item').count();
  check((await page.locator('[role=tabpanel] sheetpane-excel').count()) === 0, `${name}: no gallery grid is created before its tab opens`);
  // Vanilla: the plain grid — no format, fill, rule, picture or chart
  let t = await tab('Vanilla', 'vanilla', 'Numbers');
  check((await text(t.x.locator('#c5_1'))) === '1.25' && (await t.x.locator('.olay').count()) === 0 && (await items(t.e)) === 0, `${name}: Vanilla shows the plain grid (1.25, no overlay, no errors)`);
  t = await tab('Number formats', 'numfmt', 'Numbers');
  check((await text(t.x.locator('#c5_1'))) === '1 1/4', `${name}: Number formats shows 1 1/4`);
  t = await tab('Styles', 'styles', 'Styles');
  check((await t.x.locator('#c1_1').evaluate((el) => getComputedStyle(el).backgroundColor)) === 'rgb(255, 242, 204)', `${name}: Styles draws the yellow fill`);
  t = await tab('Formulas', 'formulas', 'Formulas');
  await t.x.locator('#c1_1').click();
  await t.x.locator('input.cell').fill('2000');
  await t.x.locator('input.cell').press('Enter');
  await t.x.locator('#c5_1').filter({ hasText: '8400' }).waitFor({ timeout: 15000 });
  check(true, `${name}: Formulas recalculates B6 after an edit to B2`);
  t = await tab('Validation', 'validation', 'Validation');
  await t.e.locator('.item').nth(1).waitFor();
  check((await items(t.e)) === 2, `${name}: Validation lists the two broken rules`);
  t = await tab('Conditional formats', 'condfmt', 'CondFmt');
  check((await t.x.locator('#c1_1').evaluate((el) => el.style.backgroundImage)).includes('linear-gradient'), `${name}: Conditional formats draws a data bar`);
  t = await tab('Images', 'images', 'Images');
  await t.x.locator('.olay img').waitFor({ timeout: 10000 });
  check(true, `${name}: Images draws the picture`);
  t = await tab('Charts', 'charts', 'Charts');
  await t.x.locator('.olay svg[data-values]').nth(1).waitFor({ timeout: 10000 });
  check(true, `${name}: Charts draws both charts`);
  t = await tab('Comments', 'comments', 'Comments');
  await t.e.locator('.item').nth(1).waitFor();
  const msgs = await t.x.evaluate((el) => el.workbook.getErrors().filter((x) => x.author === 'file').map((x) => x.message).join(' | '));
  check((await items(t.e)) === 2 && msgs.includes('Checked against the custodian file') && msgs.includes('Is this the September price?'), `${name}: Comments lists the file's note and thread`);
  t = await tab('All plugins', 'all', 'Numbers');
  await t.e.locator('.item').nth(3).waitFor({ timeout: 15000 });
  check((await text(t.x.locator('#c5_1'))) === '1 1/4' && (await items(t.e)) >= 4, `${name}: All plugins — formats, rules and comments on one pane`);
  t = await tab('Formulas', 'formulas', 'Formulas');
  check((await text(t.x.locator('#c1_1'))) === '2000' && (await page.locator('[role=tabpanel] sheetpane-excel').count()) === 10, `${name}: a tab opened again keeps its edits; ten grids, one per opened tab`);
  // W-33: the rules file, flagging="off"
  t = await tab('Rules file', 'rules', 'Validation');
  await t.e.locator('.item').nth(5).waitFor({ timeout: 15000 });
  const ruleRows = await items(t.e);
  await t.x.locator('#c2_2').click(); // C3, a failing cell
  await t.x.locator('.grid').press('f');
  await page.waitForTimeout(200);
  const quiet = (await t.x.locator('.dock [data-act=flag]').count()) === 0 && (await t.x.locator('.cardslot').evaluate((el) => el.innerHTML)) === '' && (await t.x.evaluate((el) => el.workbook.getSnapshot().composing)) === null;
  check(ruleRows === 6 && quiet, `${name}: Rules file lists 6 failing cells; flagging="off" — no Flag issue, F and a click open nothing (${ruleRows})`);
  await page.getByRole('tablist', { name: 'Plugin gallery' }).getByRole('tab', { name: 'Review', exact: true }).click();
}

async function run(name, dir, spa) {
  const { server, url } = await serve(dir, 0, spa);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  const errorsSeen = [];
  page.on('pageerror', (e) => errorsSeen.push(String(e)));
  try {
    await page.goto(url);
    // the review, driven with @sheetpane/testing (W-41) — the helpers hosts use for their own apps
    const sp = sheetpane(page);
    const excel = sp.excel;
    const errors = page.locator('sheetpane-errors').first();
    await sp.waitForLoad();
    check((await sp.text('Holdings!A2')) === 'Account ID', `${name}: the sample workbook opens`);
    // flag an error in the sheet → it appears in the list
    await sp.flag('Holdings!G7', { expected: '268.4' });
    check((await errors.locator('[data-sp-error]').count()) === 1, `${name}: a flagged error appears in the error list`);
    // resolve it in the list → the pin turns ✓
    await sp.resolve(0);
    await excel.locator('.pin.resolved').waitFor();
    check((await excel.locator('.pin').first().textContent()) === '✓', `${name}: resolved in the list → the pin turns ✓`);
    // edit a cell → Download hands back a file with the change
    await sp.edit('Holdings!B8', 'Edited in the demo');
    const got = await sp.download();
    const book = await readValues(got.bytes, got.name);
    check(valueAt(book, 'Holdings!B8') === 'Edited in the demo' && got.name.endsWith('.xlsx'), `${name}: Download hands back ${got.name} carrying the edit`);
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
    await gallery(page, name);
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
