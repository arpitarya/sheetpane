// One test on @sheetpane/testing: the sample loads, the rules file flags a cell, an edit reaches the download.
// The helpers find the grid by roles, labels and its data-sp-* hooks, so restyling never breaks this test.
import { expect as base, test } from '@playwright/test';
import { matchers } from '@sheetpane/testing';
import { sheetpane } from '@sheetpane/testing/playwright';

const expect = base.extend(matchers);

test('the sample loads, the rules flag a cell, an edit reaches the download', async ({ page }) => {
  await page.goto('/');
  const sp = sheetpane(page); // the first <sheetpane-excel> on the page
  await sp.waitForLoad(); // the file read and the rules file checked
  expect(await sp.value('Numbers!B2')).toBe(1234.5);
  expect(await sp.errors()).toHaveError({ ref: 'Numbers!B3', status: 'open' }); // the rate is above the 10 % cap
  await sp.edit('Numbers!B2', '42');
  expect(await sp.readDownload()).toHaveCell('Numbers!B2', 42);
});
