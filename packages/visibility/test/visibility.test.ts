// W-49 DoD 8: the plugin — Hide / Unhide / Group in the selection bar and the menus, the shortcuts,
// a marker click that unhides in Edit, the tab menu, the last-sheet rule and CSV.
import { afterEach, describe, expect, it } from 'vitest';
import { patchXlsx, toXlsx } from '@sheetpane/export';
import '@sheetpane/grid';
import '../src/ui.js';
import type { SheetpaneExcel } from '@sheetpane/grid';

afterEach(() => document.body.replaceChildren());
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const sh = (el: Element) => el.shadowRoot!;
const key = (el: Element, k: string, code: string, o: KeyboardEventInit = {}) => sh(el).querySelector('.grid')!.dispatchEvent(new KeyboardEvent('keydown', { key: k, code, bubbles: true, composed: true, cancelable: true, ...o }));
const grid = (r: number, c: number) => Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => (i === 0 ? `T${j}` : i * 10 + j)));

async function mount(bytes: Uint8Array, name = 'v.xlsx'): Promise<SheetpaneExcel> {
  const el = document.createElement('sheetpane-excel') as SheetpaneExcel;
  el.style.height = '500px';
  el.setAttribute('plugins', 'visibility');
  el.setAttribute('mode', 'edit');
  document.body.append(el);
  await el.load(bytes, name);
  await frame();
  return el;
}
const book = async () => patchXlsx(await toXlsx({ sheets: [{ name: 'S', rows: grid(10, 4) }, { name: 'T', rows: grid(3, 2) }] }), [], { hidden: [{ sheet: 'S', cols: [2] }] });

describe('@sheetpane/visibility (W-49 DoD 8)', () => {
  it('Hide rows from the selection bar follows the selection; Ctrl+Alt+9 matches on e.code; one change; undo', async () => {
    const el = await mount(await book());
    const wb = el.workbook!;
    const seen: unknown[] = [];
    el.addEventListener('sheetpane-visibility', (e) => seen.push((e as CustomEvent).detail));
    wb.select({ sheet: 'S', ref: 'A3', range: 'A3:B4' });
    await frame();
    const hide = sh(el).querySelector<HTMLElement>('[data-control=visibility-hide-rows]')!;
    expect(hide.getAttribute('aria-label')).toBe('Hide rows 3–4 (Mod+Alt+9)');
    hide.click();
    expect(wb.hidden('S').rows).toEqual([2, 3]);
    expect(seen.at(-1)).toEqual({ sheet: 'S', axis: 'row', indexes: [2, 3], hidden: true, via: 'menu' });
    wb.select({ sheet: 'S', ref: 'A6' });
    key(el, 'ª', 'Digit9', { metaKey: true, altKey: true }); // ⌘⌥9 on a Mac types "ª"
    expect(wb.hidden('S').rows).toEqual([2, 3, 5]);
    expect(seen.at(-1)).toMatchObject({ indexes: [5], via: 'key' });
    expect(wb.changeCount).toBe(1);
    wb.undo();
    expect(wb.hidden('S').rows).toEqual([2, 3]);
  });

  it('Unhide needs a range across the gap; a marker click in Edit unhides (a change)', async () => {
    const el = await mount(await book());
    const wb = el.workbook!;
    wb.select({ sheet: 'S', ref: 'A1' });
    await frame();
    expect(sh(el).querySelector<HTMLButtonElement>('[data-control=visibility-unhide-cols]')!.disabled).toBe(true);
    wb.select({ sheet: 'S', ref: 'B1', range: 'B1:D1' });
    await frame();
    const un = sh(el).querySelector<HTMLButtonElement>('[data-control=visibility-unhide-cols]')!;
    expect(un.disabled).toBe(false);
    un.click();
    expect(wb.hidden('S').cols).toEqual([]);
    wb.undo();
    await frame();
    sh(el).querySelector<HTMLElement>('.hmk[data-hid="cols:2-2"]')!.click();
    expect(wb.hidden('S').cols).toEqual([]);
    expect(wb.changeCount).toBe(1);
  });

  it('the header menu carries Hide and Group; the tab menu hides a sheet but never the last one', async () => {
    const el = await mount(await book());
    const wb = el.workbook!;
    const rh = sh(el).querySelector('.rh[data-hr="4"]')!;
    rh.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true }));
    await frame();
    const items = [...sh(el).querySelectorAll<HTMLElement>('[data-sp=header-menu] [role=menuitem]')].map((b) => b.textContent!.replace(/(Mod|Alt|Ctrl).*$/, ''));
    expect(items).toEqual(expect.arrayContaining(['Hide row 5', 'Group row 5']));
    sh(el).querySelector<HTMLElement>('[data-sp=header-menu] [data-control=visibility-group]')!.click();
    expect(wb.outline('S').rows).toEqual({ 4: 1 });
    const tab = sh(el).querySelector('.tab[data-sheet="T"]')!;
    tab.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true }));
    await frame();
    sh(el).querySelector<HTMLElement>('[data-sp=tab-menu] [data-control=visibility-hide-sheet]')!.click();
    expect(wb.hidden('T').state).toBe('hidden');
    sh(el).querySelector('.tab[data-sheet="S"]')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true }));
    await frame();
    const last = sh(el).querySelector<HTMLButtonElement>('[data-sp=tab-menu] [data-control=visibility-hide-sheet]')!;
    expect(last.disabled).toBe(true);
    expect(last.title).toBe('A workbook needs one visible sheet');
  });

  it('a CSV: the controls are disabled with the reason', async () => {
    const el = await mount(new TextEncoder().encode('a,b\n1,2\n3,4'), 'v.csv');
    el.workbook!.select({ sheet: el.workbook!.getSnapshot().selection.sheet, ref: 'A2', range: 'A2:B3' });
    await frame();
    const hide = sh(el).querySelector<HTMLButtonElement>('[data-control=visibility-hide-rows]')!;
    expect(hide.disabled).toBe(true);
  });
});
