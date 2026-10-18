// W-41 DoD 7: every helper of the DOM driver, in Chromium (Vitest browser mode).
import { afterEach, describe, expect, it } from 'vitest';
import '@sheetpane/grid';
import { bytes } from '@sheetpane/fixtures';
import { sheetpane } from '../src/dom.js';
import { changesBetween, matchers, readFile } from '../src/index.js';

expect.extend(matchers);
declare module 'vitest' { interface Assertion { toHaveCell(address: string, value: unknown): void; toHaveError(match: object): void } }
afterEach(() => document.body.replaceChildren());

async function mount(withPanel = true) {
  const x = document.createElement('sheetpane-excel'), e = document.createElement('sheetpane-errors');
  x.setAttribute('pane', `t${Math.random()}`); e.setAttribute('pane', x.getAttribute('pane')!);
  x.setAttribute('mode', 'edit'); x.setAttribute('author', 'Tester'); x.style.height = '500px';
  document.body.append(x, ...(withPanel ? [e] : []));
  const sp = sheetpane(x);
  void (x as unknown as { load(b: Uint8Array, n: string): Promise<void> }).load(await bytes('showcase.xlsx'), 'showcase.xlsx');
  await sp.waitForLoad();
  return { x, sp };
}

describe('the DOM driver (W-41 DoD 2, 3, 4)', () => {
  it('ref by column title, select, edit, value/text, undo', async () => {
    const { sp } = await mount();
    await sp.switchSheet('Formulas');
    expect(await sp.ref({ column: 'Amount', row: 2 })).toBe('Formulas!B2');
    await sp.edit({ column: 'Amount', row: 2 }, '2000');
    expect(await sp.value('Formulas!B2')).toBe(2000);
    await sp.undo();
    expect(await sp.value('Formulas!B2')).toBe(1200);
  });

  it('paste writes tab-separated rows from the cell', async () => {
    const { sp } = await mount();
    await sp.switchSheet('Validation');
    await sp.paste('Validation!A2', [['X1', 'Active'], ['X2', 'Inactive']]);
    expect([await sp.text('Validation!A2'), await sp.text('Validation!B3')]).toEqual(['X1', 'Inactive']);
  });

  it('flag fills the form in the errors panel; resolve resolves it; toHaveError', async () => {
    const { sp } = await mount();
    await sp.flag('Numbers!B2', { type: 'wrong-value', expected: '1,000', message: 'Check the amount', severity: 'warning' });
    expect(await sp.errors()).toHaveError({ ref: 'Numbers!B2', status: 'open', severity: 'warning', message: 'Check the amount' });
    await sp.resolve('Numbers!B2');
    expect(await sp.errors()).toHaveError({ ref: 'B2', status: 'resolved' });
  });

  it('flag without a panel uses the inline form', async () => {
    const { sp } = await mount(false);
    await sp.flag('Numbers!B3', { expected: '12%' });
    expect(await sp.errors()).toHaveError({ ref: 'Numbers!B3', status: 'open' });
  });

  it('readDownload reads the file back; toHaveCell; changesBetween', async () => {
    const { sp } = await mount();
    const before = await readFile(await bytes('showcase.xlsx'), 'showcase.xlsx');
    await sp.edit('Numbers!B7', '99');
    const after = await sp.readDownload();
    expect(after).toHaveCell('Numbers!B7', 99);
    expect(after).not.toHaveCell('Numbers!B7', 1234.5678);
    expect(changesBetween(before, after)).toEqual([{ sheet: 'Numbers', ref: 'B7', was: 1234.5678, now: 99 }]);
  });
});
