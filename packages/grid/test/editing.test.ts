// Editing as in Excel, and then some: the editor on the cell, Enter after Tabs, Ctrl+Enter, the fill
// handle (drag, double-click, Ctrl+D / Ctrl+R) and a file dropped on a loaded sheet (SR-GRID 11a, 11e, 12).
import { afterEach, describe, expect, it } from 'vitest';
import { toXlsx } from '@sheetpane/export';
import type { SheetpaneExcel } from '../src/index.js';
import { fillDownTo, fillSeries } from '../src/excel/fill.js';
import { cellEl, cleanup, frame, mountExcel, sampleCsv, shadow, until } from './helpers.js';

afterEach(cleanup);

const $ = (el: Element, s: string) => shadow(el).querySelector(s) as HTMLElement;
const grid = (el: Element) => $(el, '.grid');
const ice = (el: Element) => $(el, '.ice') as HTMLInputElement;
const bar = (el: Element) => $(el, '.cell') as HTMLInputElement;
const key = (target: Element, k: string, o: KeyboardEventInit = {}) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...o }));
const sel = (el: SheetpaneExcel) => el.workbook!.getSnapshot().selection;
const ptr = (target: Element, type: string, o: PointerEventInit = {}) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, cancelable: true, pointerId: 9, pointerType: 'mouse', button: 0, buttons: 1, ...o }));
const center = (e: Element) => { const r = e.getBoundingClientRect(); return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }; };
const type = (el: Element, text: string) => { const i = ice(el); i.value += text; i.dispatchEvent(new Event('input', { bubbles: true })); };

/** Rows of numbers under a title row: row r, column c holds r × 10 + c. */
async function mountBook(rows = 12, cols = 4): Promise<SheetpaneExcel> {
  const data: (string | number)[][] = [Array.from({ length: cols }, (_, c) => `T${c}`)];
  for (let r = 1; r < rows; r++) data.push(Array.from({ length: cols }, (_, c) => r * 10 + c));
  return mountExcel({ mode: 'edit' }, await toXlsx({ sheets: [{ name: 'S', rows: data }] }), 'book.xlsx');
}

describe('the fill arithmetic', () => {
  const u = { dr: 1, dc: 0 };
  it('numbers: two make a series, one repeats; Ctrl swaps; copy copies', () => {
    expect(fillSeries(['1', '3'], 3, { unit: u })).toEqual(['5', '7', '9']);
    expect(fillSeries(['5'], 2, { unit: u })).toEqual(['5', '5']);
    expect(fillSeries(['5'], 2, { unit: u, invert: true })).toEqual(['6', '7']);
    expect(fillSeries(['1', '2'], 2, { unit: u, invert: true })).toEqual(['1', '2']);
    expect(fillSeries(['0.1', '0.2'], 3, { unit: u })).toEqual(['0.3', '0.4', '0.5']);
    expect(fillSeries(['1', '3'], 2, { unit: u, back: true })).toEqual(['-1', '-3']);
    expect(fillSeries(['1', '3'], 2, { unit: u, copy: true })).toEqual(['1', '3']);
  });
  it('text ending in a number counts on; formulas move; anything else cycles', () => {
    expect(fillSeries(['Q1'], 3, { unit: u })).toEqual(['Q2', 'Q3', 'Q4']);
    expect(fillSeries(['Item 09'], 2, { unit: u })).toEqual(['Item 10', 'Item 11']);
    expect(fillSeries(['=B2*C2'], 2, { unit: u })).toEqual(['=B3*C3', '=B4*C4']);
    expect(fillSeries(['=B5'], 1, { unit: u, back: true })).toEqual(['=B4']);
    expect(fillSeries(['a', 'b'], 3, { unit: u })).toEqual(['a', 'b', 'a']);
  });
  it('a double-click fills down as far as the column beside has data', () => {
    const filled = [[1, 1], [1, 0], [1, 0], [0, 0]];
    expect(fillDownTo((r, c) => !!filled[r]?.[c], 0, 1, 1, 4)).toBe(2);
    expect(fillDownTo(() => false, 0, 1, 1, 4)).toBe(0);
  });
});

describe('the editor on the cell', () => {
  it('typing opens it on the cell with the key; the bar follows; Enter commits and moves down', async () => {
    const el = await mountBook();
    el.select('S', 'B3'); await frame();
    grid(el).focus();
    key(grid(el), '7');
    await frame();
    expect(ice(el).hidden).toBe(false);
    expect(shadow(el).activeElement).toBe(ice(el));
    expect(ice(el).value).toBe('7');
    expect(bar(el).value).toBe('7');
    const c = cellEl(el, 2, 1)!.getBoundingClientRect(), r = ice(el).getBoundingClientRect();
    expect(Math.abs(r.left - c.left)).toBeLessThan(2);
    expect(Math.abs(r.top - c.top)).toBeLessThan(2);
    type(el, '5');
    key(ice(el), 'Enter');
    await frame();
    expect(el.workbook!.value('S', 'B3')).toBe(75);
    expect(sel(el).ref).toBe('B4');
    expect(ice(el).hidden).toBe(true);
    expect(shadow(el).activeElement).toBe(grid(el));
  });
  it('Enter and F2 keep the value; arrows then move the caret, and after typing they commit and move', async () => {
    const el = await mountBook();
    el.select('S', 'B3'); await frame();
    grid(el).focus();
    key(grid(el), 'F2'); await frame();
    expect(ice(el).value).toBe('21');
    expect(key(ice(el), 'ArrowLeft')).toBe(true); // not cancelled: the caret moves
    expect(sel(el).ref).toBe('B3');
    key(ice(el), 'Escape'); await frame();
    expect(el.workbook!.value('S', 'B3')).toBe(21);
    key(grid(el), '4'); await frame();
    key(ice(el), 'ArrowRight'); await frame();
    expect(el.workbook!.value('S', 'B3')).toBe(4);
    expect(sel(el).ref).toBe('C3');
  });
  it('Esc puts the value back and fires sheetpane-editcancel', async () => {
    const el = await mountBook();
    el.select('S', 'C2'); await frame();
    let cancelled = 0;
    el.addEventListener('sheetpane-editcancel', () => cancelled++);
    grid(el).focus();
    key(grid(el), '9'); await frame();
    key(ice(el), 'Escape'); await frame();
    expect(cancelled).toBe(1);
    expect(el.workbook!.value('S', 'C2')).toBe(12);
    expect(bar(el).value).toBe('12');
  });
  it('a second press on the same cell edits it in place', async () => {
    const el = await mountBook();
    const cell = cellEl(el, 3, 2)!;
    ptr(cell, 'pointerdown', center(cell)); ptr($(el, '.scroller'), 'pointerup', center(cell));
    ptr(cell, 'pointerdown', center(cell)); ptr($(el, '.scroller'), 'pointerup', center(cell));
    await frame();
    expect(ice(el).hidden).toBe(false);
    expect(ice(el).value).toBe('32');
  });
  it('Tab, Tab, Enter: back to the first column, a row down', async () => {
    const el = await mountBook();
    el.select('S', 'A3'); await frame();
    grid(el).focus();
    key(grid(el), '1'); await frame(); key(ice(el), 'Tab'); await frame();
    key(grid(el), '2'); await frame(); key(ice(el), 'Tab'); await frame();
    key(grid(el), '3'); await frame(); key(ice(el), 'Enter'); await frame();
    expect([el.workbook!.value('S', 'A3'), el.workbook!.value('S', 'B3'), el.workbook!.value('S', 'C3')]).toEqual([1, 2, 3]);
    expect(sel(el).ref).toBe('A4');
  });
  it('Ctrl+Enter puts the entry in every cell of the range, one undo step', async () => {
    const el = await mountBook();
    el.workbook!.select({ sheet: 'S', ref: 'B2', range: 'B2:C4' }); await frame();
    grid(el).focus();
    key(grid(el), 'x'); await frame();
    key(ice(el), 'Enter', { ctrlKey: true }); await frame();
    for (const ref of ['B2', 'C2', 'B3', 'C3', 'B4', 'C4']) expect(el.workbook!.value('S', ref)).toBe('x');
    expect(sel(el).range).toBe('B2:C4');
    el.workbook!.undo();
    expect(el.workbook!.value('S', 'C4')).toBe(32);
  });
});

describe('the fill handle', () => {
  const handle = (el: Element) => $(el, '.sellayer .fh');
  it('shows in Edit at the selection corner, not in View', async () => {
    const el = await mountBook();
    el.select('S', 'B3'); await frame();
    expect(handle(el)).not.toBeNull();
    el.mode = 'view'; await frame();
    expect(handle(el)).toBeNull();
  });
  it('a drag down continues a series, shows the last value on the way, and selects what it filled', async () => {
    const el = await mountBook();
    el.workbook!.setCells([{ sheet: 'S', ref: 'B2', input: '5' }, { sheet: 'S', ref: 'B3', input: '7' }]);
    el.workbook!.select({ sheet: 'S', ref: 'B2', range: 'B2:B3' }); await frame();
    const h = handle(el);
    ptr(h, 'pointerdown', center(h));
    ptr($(el, '.scroller'), 'pointermove', center(cellEl(el, 5, 1)!)); // to B6
    await frame();
    expect($(el, '.sellayer .ftip').textContent).toBe('13');
    ptr($(el, '.scroller'), 'pointerup', center(cellEl(el, 5, 1)!));
    await frame();
    expect(['B4', 'B5', 'B6'].map((r) => el.workbook!.value('S', r))).toEqual([9, 11, 13]);
    expect(sel(el).range).toBe('B2:B6');
    el.workbook!.undo(); // one step
    expect(['B4', 'B5', 'B6'].map((r) => el.workbook!.value('S', r))).toEqual([31, 41, 51]);
  });
  it('Esc during a fill drag writes nothing', async () => {
    const el = await mountBook();
    el.select('S', 'B2'); await frame();
    const h = handle(el), before = el.workbook!.getSnapshot().changes.size;
    ptr(h, 'pointerdown', center(h));
    ptr($(el, '.scroller'), 'pointermove', center(cellEl(el, 6, 1)!));
    await frame();
    key(grid(el), 'Escape');
    ptr($(el, '.scroller'), 'pointerup', center(cellEl(el, 6, 1)!));
    await frame();
    expect(el.workbook!.getSnapshot().changes.size).toBe(before);
  });
  it('a double-click fills down beside the data; Ctrl+D copies down; Ctrl+R copies right', async () => {
    const el = await mountBook(6, 3);
    el.select('S', 'C2'); await frame();
    handle(el).dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await frame();
    expect([3, 4, 5, 6].map((r) => el.workbook!.value('S', `C${r}`))).toEqual([12, 12, 12, 12]); // one number repeats, down to B's last row
    el.select('S', 'A3'); await frame();
    grid(el).focus();
    key(grid(el), 'd', { ctrlKey: true }); await frame();
    expect(el.workbook!.value('S', 'A3')).toBe(10);
    el.select('S', 'B4'); await frame();
    key(grid(el), 'r', { ctrlKey: true }); await frame();
    expect(el.workbook!.value('S', 'B4')).toBe(30);
  });
});

describe('a file dropped on a loaded sheet (SR-GRID 10)', () => {
  it('shows what dropping does, then opens the file', async () => {
    const el = await mountBook();
    const root = $(el, '.sp'), dt = new DataTransfer();
    dt.items.add(new File([sampleCsv()], 'dropped.csv', { type: 'text/csv' }));
    root.dispatchEvent(new DragEvent('dragenter', { bubbles: true, composed: true, cancelable: true, dataTransfer: dt }));
    expect($(el, '.dropov')?.textContent).toContain('Drop to open');
    root.dispatchEvent(new DragEvent('drop', { bubbles: true, composed: true, cancelable: true, dataTransfer: dt }));
    await until(() => $(el, '.fname').textContent === 'dropped.csv');
    expect($(el, '.dropov')).toBeNull();
  });
});
