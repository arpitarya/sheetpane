// W-26: editing and position events (events verdict decisions 1–4).
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createWorkbook, type Plugin, type SheetpaneErrors } from '../src/index.js';
import { cleanup, frame, mountExcel, sampleXlsx, shadow } from './helpers.js';

afterEach(cleanup);
const $ = (el: Element, sel: string) => shadow(el).querySelector(sel) as HTMLElement;
type Ev = { name: string; detail: Record<string, unknown> };
function record(el: EventTarget, names: string[]): Ev[] {
  const out: Ev[] = [];
  for (const name of names) el.addEventListener(name, (e) => out.push({ name, detail: (e as CustomEvent).detail }));
  return out;
}
const ALL = ['sheetpane-select', 'sheetpane-editstart', 'sheetpane-input', 'sheetpane-beforechange', 'sheetpane-change', 'sheetpane-editcancel', 'sheetpane-sheet'];

describe('editing events (W-26)', () => {
  it('fire in order with the column title from the header row', async () => {
    const el = await mountExcel({ mode: 'edit', 'header-row': '2' });
    const ev = record(el, ALL);
    el.select('Holdings', 'G7');
    await frame();
    await userEvent.fill($(el, '.cell') as HTMLInputElement, '268.4');
    await userEvent.keyboard('{Enter}');
    expect(ev.map((e) => e.name)).toEqual(['sheetpane-select', 'sheetpane-editstart', 'sheetpane-input', 'sheetpane-beforechange', 'sheetpane-change', 'sheetpane-select']);
    const column = { index: 6, letter: 'G', header: 'Price' };
    expect(ev[0]!.detail).toEqual({ sheet: 'Holdings', ref: 'G7', column, value: 286.4 });
    expect(ev[1]!.detail).toEqual({ sheet: 'Holdings', ref: 'G7', column, value: 286.4 });
    expect(ev[2]!.detail).toEqual({ sheet: 'Holdings', ref: 'G7', column, draft: '268.4', was: 286.4 });
    expect(ev[3]!.detail).toEqual({ sheet: 'Holdings', ref: 'G7', column, was: 286.4, now: 268.4 });
    expect(ev[4]!.detail).toMatchObject({ sheet: 'Holdings', ref: 'G7', kind: 'value', was: 286.4, now: 268.4 });
    expect(ev[5]!.detail).toMatchObject({ ref: 'G8' });
  });
  it('a cancelled editstart keeps the cell read-only', async () => {
    const el = await mountExcel({ mode: 'edit', 'header-row': '2' });
    el.addEventListener('sheetpane-editstart', (e) => { if ((e as CustomEvent).detail.column.header === 'Account ID') e.preventDefault(); });
    el.select('Holdings', 'A3');
    await frame();
    const input = $(el, '.cell') as HTMLInputElement;
    input.focus();
    expect(input.readOnly).toBe(true);
    el.select('Holdings', 'B3');
    await frame();
    input.focus();
    expect(input.readOnly).toBe(false);
  });
  it('a cancelled beforechange never reaches the change map, the undo stack or derive', async () => {
    const derived: unknown[] = [];
    const spy: Plugin = { id: 'spy', provides: ['derive'], derive: (input) => { derived.push(input.kind); return []; } };
    const el = await mountExcel({ mode: 'edit', 'header-row': '2' });
    el.workbook = createWorkbook({ plugins: [spy] });
    await el.workbook.load(await sampleXlsx(), 's.xlsx');
    el.workbook.setMode('edit');
    el.addEventListener('sheetpane-beforechange', (e) => { const d = (e as CustomEvent).detail; if (d.column.header === 'Units' && Number(d.now) < 0) e.preventDefault(); });
    el.select('Holdings', 'F3');
    await frame();
    await userEvent.fill($(el, '.cell') as HTMLInputElement, '-5');
    await userEvent.keyboard('{Enter}');
    expect(el.workbook.changeCount).toBe(0);
    expect(el.workbook.getSnapshot().canUndo).toBe(false);
    expect(derived).toEqual(['load']);
    el.select('Holdings', 'F3');
    await frame();
    expect(($(el, '.cell') as HTMLInputElement).value).toBe('1200');
  });
  it('Esc fires editcancel and keeps the value; Delete asks beforechange', async () => {
    const el = await mountExcel({ mode: 'edit' });
    const ev = record(el, ['sheetpane-editcancel', 'sheetpane-beforechange']);
    el.select('Holdings', 'B3');
    await frame();
    await userEvent.fill($(el, '.cell') as HTMLInputElement, 'oops');
    await userEvent.keyboard('{Escape}');
    expect(ev.map((e) => e.name)).toEqual(['sheetpane-editcancel']);
    expect(el.workbook!.text('Holdings', 'B3')).toBe('R. Mehta');
    el.addEventListener('sheetpane-beforechange', (e) => e.preventDefault(), { once: true });
    $(el, '.grid').focus();
    await userEvent.keyboard('{Delete}');
    expect(el.workbook!.text('Holdings', 'B3')).toBe('R. Mehta');
  });
  it('paste asks beforechange once per cell, skips the refused one, saves the rest as one undo step', async () => {
    const el = await mountExcel({ mode: 'edit' });
    const asked: string[] = [];
    el.addEventListener('sheetpane-beforechange', (e) => { const d = (e as CustomEvent).detail; asked.push(d.ref); if (d.ref === 'C4') e.preventDefault(); });
    el.select('Holdings', 'B3');
    await frame();
    const data = new DataTransfer();
    data.setData('text/plain', 'a\tb\r\nc\td\r\n');
    $(el, '.grid').dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    expect(asked).toEqual(['B3', 'C3', 'B4', 'C4']);
    const s = el.workbook!;
    expect(['B3', 'C3', 'B4', 'C4'].map((r) => s.text('Holdings', r))).toEqual(['a', 'b', 'c', s.original('Holdings', 'C4').text]);
    s.undo();
    expect(s.changeCount).toBe(0);
  });
  it('a tab change fires sheetpane-sheet; events fire once, on the element where the edit happened', async () => {
    const el = await mountExcel({ mode: 'edit', pane: 'ev1' });
    const errors = document.createElement('sheetpane-errors') as SheetpaneErrors;
    errors.setAttribute('pane', 'ev1');
    document.body.append(errors);
    await frame();
    const onSheet = record(el, ['sheetpane-sheet', 'sheetpane-change']);
    const onErrors = record(errors, ALL);
    (shadow(el).querySelector('.tab[data-sheet="Fee tiers"]') as HTMLButtonElement).click();
    expect(onSheet.map((e) => e.name)).toEqual(['sheetpane-sheet']);
    el.select('Fee tiers', 'B4');
    await frame();
    await userEvent.fill($(el, '.cell') as HTMLInputElement, '10');
    await userEvent.keyboard('{Enter}');
    expect(onSheet.filter((e) => e.name === 'sheetpane-change')).toHaveLength(1);
    expect(onErrors).toEqual([]);
  });
});
