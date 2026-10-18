// The controls (W-16 DoD 5) inside a real <sheetpane-excel>, enabled by `plugins="formulas"`.
import { afterEach, describe, expect, it } from 'vitest';
import '@sheetpane/grid';
import type { SheetpaneExcel } from '@sheetpane/grid';
import '../src/ui.js';
import { selectionStats } from '../src/ui.js';
import { book, until } from './helpers.js';

const holdings = () => book({
  Holdings: [
    ['Account', 'Units', 'Price', 'Value'],
    [],
    ['AC-1', 1200, 268.4, { f: 'B3*C3', v: 322080 }],
    ['AC-2', 150, 214.57, { f: 'B4*C4', v: 32185.5 }],
    ['AC-3', 800, 41.84, { f: 'B5*C5', v: 33472 }],
    [null, null, 'Total', { f: 'SUM(D3:D5)', v: 387737.5 }],
  ],
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
async function mount(): Promise<SheetpaneExcel> {
  const el = document.createElement('sheetpane-excel');
  el.style.height = '600px';
  el.setAttribute('plugins', 'formulas');
  document.body.append(el);
  await el.load(await holdings(), 'holdings.xlsx');
  await frame();
  return el;
}
const root = (el: Element) => el.shadowRoot!;
const fxButton = (el: Element) => root(el).querySelector<HTMLElement>('[data-control="formulas-fx"]');
const status = (el: Element) => root(el).querySelector('.status')!.textContent ?? '';
const cellAt = (el: Element, r: number, c: number) => root(el).getElementById(`c${r}_${c}`) as HTMLElement;

afterEach(() => document.body.replaceChildren());

describe('formulas/ui in the grid', () => {
  it('cellbar: View shows the formula as read-only text; Edit puts it in the cell input, editable', async () => {
    const el = await mount();
    const store = el.workbook!;
    store.select({ sheet: 'Holdings', ref: 'D3' });
    await frame();
    expect(fxButton(el)?.tagName).toBe('SPAN'); // text, not a button
    expect(fxButton(el)?.textContent).toBe('fx =B3*C3');
    store.select({ sheet: 'Holdings', ref: 'B3' });
    await frame();
    expect(fxButton(el)).toBeNull(); // no formula, no chip
    el.mode = 'edit';
    store.select({ sheet: 'Holdings', ref: 'D6' });
    await frame();
    expect(fxButton(el)).toBeNull(); // Edit: the core's input holds it
    const input = root(el).querySelector<HTMLInputElement>('.fx input.cell')!;
    expect(input.value).toBe('=SUM(D3:D5)');
    // retyping the file's own formula is no change
    store.setCell('Holdings', 'D6', '=SUM(D3:D5)');
    expect(store.changeCount).toBe(0);
    // a new formula is a formula change and evaluates
    store.setCell('Holdings', 'D6', '=SUM(D3:D4)');
    await until(() => store.text('Holdings', 'D6') === '354265.5');
    expect(store.changeOf('Holdings', 'D6')?.kind).toBe('formula');
    await frame();
    expect(input.value).toBe('=SUM(D3:D4)');
    // reverting clears the derived entry: the file's value is back
    store.revert('Holdings', 'D6');
    await until(() => !store.getSnapshot().derived.has('Holdings!D6'));
    expect(store.text('Holdings', 'D6')).toBe('387737.5');
  });

  it('status: Sum · Avg · Count of the selection', async () => {
    const el = await mount();
    const store = el.workbook!;
    store.select({ sheet: 'Holdings', ref: 'B3', range: 'B3:B5' });
    await frame();
    // Formatted as the active cell is (B3: General), as Excel's status bar does.
    expect(status(el)).toContain('Sum 2150 · Avg 716.6666667 · Count 3');
    store.select({ sheet: 'Holdings', ref: 'A3', range: 'A3:A5' });
    await frame();
    expect(status(el)).toContain('Count 3');
    expect(status(el)).not.toContain('Sum');
    const snap = store.getSnapshot();
    expect(selectionStats(snap, { sheet: 'Holdings', ref: 'A1', range: 'A1:D6' })).toMatchObject({ count: 18, numbers: 10 });
  });

  it('cell: ⟳ on a recalculated cell; status counts them; the derived cell shows its new value', async () => {
    const el = await mount();
    const store = el.workbook!;
    el.mode = 'edit';
    store.setCell('Holdings', 'B3', '1000', { origin: el });
    await until(() => store.getSnapshot().derived.has('Holdings!D6'));
    await frame();
    const d3 = cellAt(el, 2, 3);
    expect(d3.classList.contains('derived')).toBe(true);
    expect(d3.querySelector('[data-control="formulas-derived"]')?.textContent).toBe('⟳');
    expect(d3.textContent).toContain('268400');
    expect(cellAt(el, 3, 3).querySelector('[data-control="formulas-derived"]')).toBeNull();
    expect(status(el)).toContain('⟳ 2 cells recalculated');
    expect(status(el)).toContain('1 cell change');
  });

  it('a circular reference: ↻ on the cells and named in the status line', async () => {
    const el = await mount();
    const store = el.workbook!;
    el.mode = 'edit';
    store.setCell('Holdings', 'B6', '=A6');
    store.setCell('Holdings', 'A6', '=B6+1');
    await until(() => status(el).includes('Circular references: A6, B6'));
    await frame();
    expect(cellAt(el, 5, 0).querySelector('[data-control="formulas-cycle-mark"]')?.textContent).toBe('↻');
    expect(cellAt(el, 5, 1).querySelector('[data-control="formulas-cycle-mark"]')?.textContent).toBe('↻');
    expect(cellAt(el, 5, 1).querySelector('[data-control="formulas-derived"]')).toBeNull();
  });

  it('overlay: in Edit, the ranges the selected formula reads are outlined and labelled', async () => {
    const el = await mount();
    const store = el.workbook!;
    el.mode = 'edit';
    store.select({ sheet: 'Holdings', ref: 'D6' });
    await frame();
    const labels = [...root(el).querySelectorAll('.overlay .olay')].map((o) => o.textContent).filter(Boolean);
    expect(labels).toEqual(['D3:D5']);
    // While typing (the cell bar sets the cell on every keystroke) the outlines follow the formula.
    store.setCell('Holdings', 'F3', '=B3*C3', { coalesce: true });
    store.select({ sheet: 'Holdings', ref: 'F3' });
    await frame();
    const now = [...root(el).querySelectorAll('.overlay .olay')].map((o) => o.textContent).filter(Boolean);
    expect(now).toEqual(['B3', 'C3']);
    el.mode = 'view';
    await frame();
    expect(root(el).querySelectorAll('.overlay .olay').length).toBe(0);
  });

  it('names no font family anywhere (SR-LAW-5)', async () => {
    const el = await mount();
    el.mode = 'edit';
    el.workbook!.select({ sheet: 'Holdings', ref: 'D6' });
    await frame();
    expect(root(el).innerHTML).not.toMatch(/font-family/i);
  });
});
