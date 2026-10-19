// W-52 DoD 5 and 7: insert and delete in <sheetpane-excel> — the cell menu, the header menu,
// Ctrl/⌘+Shift+= and Ctrl/⌘+−, refusals greyed with their reason, the event, sizes following
// their rows, Edit only; axe on the menus.
import { afterEach, describe, expect, it } from 'vitest';
import axe from 'axe-core';
import type { SheetpaneExcel } from '../src/index.js';
import { toXlsx } from '@sheetpane/export';
import { structureBook } from '../../export/test/fixtures/structure.js';
import { cellEl, cleanup, frame, mountExcel, shadow, until } from './helpers.js';

afterEach(cleanup);

const key = (el: Element, k: string, o: KeyboardEventInit = {}) => shadow(el).querySelector('.grid')!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...o }));
const openMenu = async (el: SheetpaneExcel, r: number, c: number) => {
  cellEl(el, r, c)!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, button: 2 }));
  await frame(); await frame();
  return shadow(el).querySelector<HTMLElement>('.overlay .ctxmenu')!;
};
const items = (menu: Element) => [...menu.querySelectorAll<HTMLButtonElement>('[role=menuitem]')].map((b) => b.textContent!.replace(/Ctrl.*$/, ''));
const mount = async (mode = 'edit') => mountExcel({ mode }, await structureBook(), 'items.xlsx');

describe('the menus (W-52 DoD 5)', () => {
  it('the cell menu offers insert and delete in Edit, not in View', async () => {
    const el = await mount('view');
    expect(items(await openMenu(el, 2, 1))).not.toContain('Insert row above');
    el.mode = 'edit';
    await frame();
    const menu = await openMenu(el, 2, 1);
    expect(items(menu)).toEqual(expect.arrayContaining(['Insert row above', 'Insert row below', 'Delete row', 'Insert column left', 'Insert column right', 'Delete column']));
    // column B runs through the merge A6:C6: deleting it is refused, greyed, the reason in its tooltip
    const delCol = menu.querySelector<HTMLButtonElement>('[data-act=del-cols]')!;
    expect(delCol.disabled).toBe(true);
    expect(delCol.title).toContain('A6:C6');
    const seen: CustomEvent[] = [];
    el.addEventListener('sheetpane-change', (e) => seen.push(e as CustomEvent));
    menu.querySelector<HTMLElement>('[data-act=ins-above]')!.click();
    await frame();
    expect(seen.map((e) => e.detail)).toEqual([{ sheet: 'Data', ref: '3:3', kind: 'structure', was: null, now: null, op: 'insertRows', at: 2, count: 1 }]);
    expect(el.workbook!.value('Data', 'A4')).toBe('b');
    expect(el.workbook!.getSnapshot().selection.ref).toBe('B3'); // the selection keeps its address, as in Excel
    expect(cellEl(el, 3, 0)!.textContent).toBe('b');
    el.undo();
    await frame();
    expect(cellEl(el, 2, 0)!.textContent).toBe('b');
  });
  it('the header menu: a row header offers rows, a column header columns, for every selected one', async () => {
    const el = await mount();
    const rh = shadow(el).querySelector('.rh[data-hr="2"]')!;
    rh.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true }));
    await frame();
    let menu = shadow(el).querySelector('[data-sp=header-menu]')!;
    expect(items(menu)).toEqual(['Fit to data', 'Row height…', 'Reset to the file’s size', 'Insert row above', 'Insert row below', 'Delete row']);
    menu.querySelector<HTMLElement>('[data-act=del-rows]')!.click();
    await frame();
    expect(el.workbook!.value('Data', 'A3')).toBe('c');
    const ch = shadow(el).querySelector('[data-hc="3"]')!;
    ch.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true }));
    await frame();
    menu = shadow(el).querySelector('[data-sp=header-menu]')!;
    expect(items(menu)).toEqual(['Fit to data', 'Column width…', 'Reset to the file’s size', 'Insert column left', 'Insert column right', 'Delete column']);
    menu.querySelector<HTMLElement>('[data-act=ins-right]')!.click();
    await frame();
    expect(el.workbook!.value('Data', 'F1')).toBeNull();
    expect(el.workbook!.value('Data', 'D1')).toBe('Total');
    expect(el.workbook!.sheet('Data')!.rows[0]).toEqual(['Name', 'Rate', 'Qty', 'Total']);
  });
});

describe('an insert at the edge of the data (SR-GRID 11e)', () => {
  // aria-colcount / aria-rowcount count the header too
  const cols = (el: Element) => Number(shadow(el).querySelector('[role=grid]')!.getAttribute('aria-colcount')) - 1;
  const rows = (el: Element) => Number(shadow(el).querySelector('[role=grid]')!.getAttribute('aria-rowcount')) - 1;
  it('a column inserted right of the last one shows and takes typing; undo takes it away', async () => {
    const el = await mountExcel({ mode: 'edit' }, await toXlsx({ sheets: [{ name: 'Data', rows: [['a', 'b', 'c'], [1, 2, 3]] }] }), 'plain.xlsx');
    const n = cols(el), last = String.fromCharCode(64 + n);
    el.workbook!.select({ sheet: 'Data', ref: `${last}2` }); await frame();
    const menu = await openMenu(el, 1, n - 1);
    menu.querySelector<HTMLElement>('[data-act=ins-right]')!.click();
    await frame();
    expect(cols(el)).toBe(n + 1);
    const added = String.fromCharCode(65 + n);
    expect(shadow(el).querySelector(`[data-hc="${n}"]`)!.textContent).toContain(added);
    el.workbook!.setCells([{ sheet: 'Data', ref: `${added}2`, input: 'new' }]);
    expect(el.workbook!.value('Data', `${added}2`)).toBe('new');
    el.undo(); el.undo(); await frame();
    expect(cols(el)).toBe(n);
  });
  it('rows inserted at the last row add as many rows to the grid', async () => {
    const el = await mount();
    const n = rows(el);
    el.workbook!.select({ sheet: 'Data', ref: `A${n - 1}`, range: `A${n - 1}:A${n}` }); await frame();
    key(el, '=', { ctrlKey: true, shiftKey: true }); await frame();
    expect(rows(el)).toBe(n + 2);
  });
});

describe('the keys (W-52 DoD 5)', () => {
  it('Ctrl+Shift+= inserts above, Ctrl+− deletes whole rows or columns and asks for them otherwise', async () => {
    const el = await mount();
    el.select('Data', 'B3');
    await frame();
    key(el, '+', { ctrlKey: true, shiftKey: true });
    await frame();
    expect(el.workbook!.value('Data', 'A4')).toBe('b');
    key(el, '-', { ctrlKey: true });
    await frame();
    expect(el.workbook!.value('Data', 'A4')).toBe('b'); // a cell is not whole rows: nothing deleted
    expect(shadow(el).textContent).toContain('Select whole rows');
    key(el, ' ', { shiftKey: true }); // the row
    await frame();
    key(el, '-', { metaKey: true });
    await frame();
    expect(el.workbook!.value('Data', 'A3')).toBe('b');
    el.select('Data', 'B3');
    await frame();
    key(el, ' ', { ctrlKey: true }); // the column
    await frame();
    key(el, '=', { ctrlKey: true, shiftKey: true });
    await frame();
    expect(el.workbook!.value('Data', 'C3')).toBe(2);
    expect(el.shortcuts().map((s) => s.keys)).toEqual(expect.arrayContaining(['Ctrl/⌘ + Shift + =', 'Ctrl/⌘ + −']));
  });
  it('the keys do nothing in View', async () => {
    const el = await mount('view');
    el.select('Data', 'B3');
    key(el, '+', { ctrlKey: true, shiftKey: true });
    await frame();
    expect(el.workbook!.getSnapshot().canUndo).toBe(false);
  });
});

describe('view state follows its rows (W-52: W-47 sizes, W-49 reveal)', () => {
  it('a row height set by the user moves with its row; a deleted row takes its size with it', async () => {
    const el = await mount();
    el.sizes = { Data: { rows: { 4: 40 }, cols: { C: 90 } } };
    el.workbook!.insertRows('Data', 0, 2);
    el.workbook!.insertCols('Data', 0);
    await frame();
    expect(el.sizes).toEqual({ Data: { rows: { 6: 40 }, cols: { D: 90 } } });
    el.workbook!.deleteRows('Data', 5);
    await frame();
    expect(el.sizes).toEqual({ Data: { rows: {}, cols: { D: 90 } } });
  });
});

describe('axe (W-52 DoD 7)', () => {
  it('the cell menu and the header menu with insert and delete', async () => {
    const el = await mount();
    const rules = { 'scrollable-region-focusable': { enabled: true } };
    await openMenu(el, 2, 1);
    await until(() => !!shadow(el).querySelector('[data-act=ins-above]'));
    let r = await axe.run(el, { rules });
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    shadow(el).querySelector('.rh[data-hr="2"]')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true }));
    await frame();
    r = await axe.run(el, { rules });
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
});
