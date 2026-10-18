import { afterEach, describe, expect, it } from 'vitest';
import { paneStore, registeredPluginIds, type SheetpaneErrors, type SheetpaneExcel } from '@sheetpane/grid';
import features from '../../import/test/fixtures/exceljs-features.xlsx?inline';
import '../src/ui.js';
import { ui } from '../src/ui.js';
import { frame, fromDataUrl, workbook } from './helpers.js';

afterEach(() => document.body.replaceChildren());
let paneN = 0;
const sh = (el: Element) => el.shadowRoot!;
const cell = (el: Element, r: number, c: number) => sh(el).getElementById(`c${r}_${c}`) as HTMLElement | null;
const mousedown = (el: Element) => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));

/** A sheet and an error list on one pane running `plugins="validation"`. */
async function pair(data: Uint8Array, mode: 'edit' | 'view' = 'edit') {
  const pane = `v${++paneN}`;
  const excel = document.createElement('sheetpane-excel') as SheetpaneExcel;
  excel.setAttribute('pane', pane); excel.setAttribute('plugins', 'validation'); excel.setAttribute('mode', mode); excel.setAttribute('author', 'Arpit');
  excel.style.height = '600px';
  const errors = document.createElement('sheetpane-errors') as SheetpaneErrors;
  errors.setAttribute('pane', pane); errors.style.height = '600px';
  document.body.append(excel, errors);
  await excel.load(data, 'features.xlsx');
  await frame();
  return { excel, errors, store: paneStore(pane)! };
}

describe('registration (DoD 1)', () => {
  it('importing /ui registers "validation" as the rule plugin plus its controls', () => {
    expect(registeredPluginIds()).toContain('validation');
    expect(ui().controls!.map((c) => [c.id, c.slot, c.mode])).toEqual([['validation-list', 'cell', 'edit'], ['validation-status', 'status', 'both']]);
  });
});

describe('the list arrow (DoD 4)', () => {
  it('sits in every list-rule cell in Edit, opens the rule’s choices, and picking sets the cell', async () => {
    const data = await workbook([{ name: 'S', cells: { A1: 'Fund', B1: 'Kind', A2: 'TMKT', B2: 'Core', A3: 'GOVT', B3: 'Bogus', A4: 'CASH', C4: 1 }, rules: [
      { sqref: 'B2:B4', type: 'list', f1: '"Core,Income,Cap"', allowBlank: true, errorTitle: 'Kind', error: 'Pick a kind from the list' },
      { sqref: 'C2:C4', type: 'whole', operator: 'greaterThan', f1: '0', allowBlank: true },
    ] }]);
    const { excel, store } = await pair(data);
    expect(store.pluginIds).toEqual(['validation', 'validation-ui']);
    for (const r of [1, 2, 3]) expect(cell(excel, r, 1)!.querySelector('.mk'), `B${r + 1}`).not.toBeNull();
    expect(cell(excel, 3, 2)!.querySelector('.mk')).toBeNull(); // C4: a whole-number rule, no arrow
    expect(cell(excel, 0, 1)!.querySelector('.mk')).toBeNull(); // B1: no rule
    expect(store.getErrors()).toEqual([expect.objectContaining({ range: 'B3', found: 'Bogus', message: 'Kind: Pick a kind from the list' })]);
    mousedown(cell(excel, 2, 1)!.querySelector('.mk')!);
    await frame();
    const opts = [...sh(excel).querySelectorAll('.menu [data-act=pick-option]')] as HTMLButtonElement[];
    expect(opts.map((o) => o.textContent)).toEqual(['Core', 'Income', 'Cap']);
    opts[2]!.click();
    expect(store.text('S', 'B3')).toBe('Cap');
    expect(store.getErrors()).toEqual([expect.objectContaining({ range: 'B3', status: 'resolved' })]);
  });

  it('the fixture’s J3:J5 list: the grid widens to column J and draws the arrow there', async () => {
    const { excel, store } = await pair(fromDataUrl(features));
    const arrow = ui().controls![0]!;
    expect(arrow.appliesTo!(store.cellContext('Holdings', 'J3')!)).toBe(true);
    expect(arrow.cellOptions!(store.cellContext('Holdings', 'J4')!)).toEqual(['Core', 'Income', 'Cap']);
    expect(arrow.appliesTo!(store.cellContext('Holdings', 'B3')!)).toBe(false);
    expect(cell(excel, 2, 9)!.querySelector('.mk')).not.toBeNull(); // the grid reaches the columns rules name
  });

  it('no arrows in View', async () => {
    const { excel } = await pair(fromDataUrl(features), 'view');
    expect(sh(excel).querySelectorAll('.mk').length).toBe(0);
  });

  it('a range list re-reads its source: the menu shows the live values', async () => {
    const data = await workbook([
      { name: 'Main', cells: { A1: 'Gold', B1: 'x' }, rules: [{ sqref: 'A1:A3', type: 'list', f1: 'Lists!$A$1:$A$3', allowBlank: true }] },
      { name: 'Lists', cells: { A1: 'Gold', A2: 'Silver', A3: 'Copper' } },
    ]);
    const { excel, store } = await pair(data);
    store.setCell('Lists', 'A3', 'Tin');
    store.select({ sheet: 'Main', ref: 'A1' });
    await frame();
    mousedown(cell(excel, 1, 0)!.querySelector('.mk')!);
    await frame();
    const opts = [...sh(excel).querySelectorAll('.menu [data-act=pick-option]')] as HTMLButtonElement[];
    expect(opts.map((o) => o.textContent)).toEqual(['Gold', 'Silver', 'Tin']);
    opts[1]!.click();
    expect(store.text('Main', 'A2')).toBe('Silver');
  });
});

describe('<sheetpane-errors> on the same pane (DoD 3, 4, 5)', () => {
  it('a broken rule reaches the error list at once; the Workbook-rules author filter shows only rule rows', async () => {
    const { excel, errors, store } = await pair(fromDataUrl(features));
    store.setCell('Holdings', 'B4', '-5');
    store.addError({ sheet: 'Holdings', range: 'C3', type: 'wrong-value', severity: 'error', expected: '268.40', author: 'Arpit' });
    await frame();
    const rows = () => [...sh(errors).querySelectorAll('.list .item')].map((x) => (x as HTMLElement).dataset.id);
    expect(rows()).toHaveLength(2);
    const filters = [...sh(errors).querySelectorAll('[data-act=author]')] as HTMLButtonElement[];
    expect(filters.map((b) => b.textContent)).toEqual(['Anyone', 'People', 'Workbook rules']);
    filters[2]!.click();
    await frame();
    const wb = store.getErrors().find((e) => e.author === 'workbook')!;
    expect(rows()).toEqual([wb.id]);
    const item = sh(errors).querySelector('.list .item')!;
    expect(item.textContent).toContain('-5');
    expect(item.textContent).toContain('whole number > 0');
    (sh(errors).querySelector('[data-act=pick]') as HTMLElement).click();
    await frame();
    expect(sh(errors).querySelector('.detail')!.textContent).toContain('Units: Units must be positive');
    expect(sh(errors).querySelector('.detail')!.textContent).toContain('Workbook rule');
    // the fix resolves it in both views; the status line counts open warnings
    expect(sh(excel).querySelector('.status')!.textContent).toContain('1 validation warning');
    store.setCell('Holdings', 'B4', '430');
    await frame();
    expect(store.getErrors().find((e) => e.id === wb.id)!.status).toBe('resolved');
    expect(sh(excel).querySelector('.status')!.textContent).toContain('0 validation warnings');
  });

  it('the status line names skipped rules, in View too', async () => {
    const data = await workbook([{ name: 'S', cells: { A1: -1, B1: 1 }, rules: [
      { sqref: 'A1', type: 'whole', operator: 'greaterThan', f1: '0' },
      { sqref: 'B1', type: 'custom', f1: 'B1>0' },
    ] }]);
    const { excel } = await pair(data, 'view');
    expect(sh(excel).querySelector('.status')!.textContent).toContain('1 validation warning · 1 rule not checked');
  });
});
