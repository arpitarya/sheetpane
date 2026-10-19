// W-63 DoD 2 (SR-COMPARE decisions 8–12), in Chromium: a pane compared with a base file — the
// tints, the status line, the changes in the errors list (other errors kept), Alt+F5 / Alt+Shift+F5,
// Stop comparing, and a second file compared with the same base.
import { afterEach, describe, expect, it } from 'vitest';
import { toXlsx, type Cell } from '@sheetpane/export';
import '@sheetpane/grid';
import { clearCompare, compareWith, comparison } from '../src/ui.js';
import type { SheetpaneExcel } from '@sheetpane/grid';

afterEach(() => document.body.replaceChildren());
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const sh = (el: Element) => el.shadowRoot!;
const key = (el: Element, k: string, o: KeyboardEventInit = {}) => sh(el).querySelector('.grid')!.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: k, bubbles: true, composed: true, cancelable: true, ...o }));
const bg = (el: Element, r: number, c: number) => getComputedStyle(sh(el).querySelector(`#c${r}_${c}`)!).backgroundColor;
const border = (el: Element, r: number, c: number) => getComputedStyle(sh(el).querySelector(`#c${r}_${c}`)!).borderTopColor;
const status = (el: Element) => sh(el).querySelector('.status')?.textContent ?? '';

const BASE: Cell[][] = [['Account', 'Units', 'Price'], ['AC-1', 10, 2.5], ['AC-2', 20, 3], ['AC-3', 30, 4], ['AC-4', 40, 5]];
// AC-2's price changed, AC-9 added, AC-3 removed, AC-4 moved above AC-1
const NOW: Cell[][] = [['Account', 'Units', 'Price'], ['AC-4', 40, 5], ['AC-1', 10, 2.5], ['AC-2', 20, 3.25], ['AC-9', 90, 9]];
const xlsx = (rows: Cell[][], extra: { name: string; rows: Cell[][] }[] = []) => toXlsx({ sheets: [{ name: 'Holdings', rows }, ...extra] });

async function mount(mode: 'view' | 'edit' = 'view'): Promise<SheetpaneExcel> {
  const el = document.createElement('sheetpane-excel') as SheetpaneExcel;
  el.style.height = '500px';
  el.setAttribute('plugins', 'compare');
  el.setAttribute('mode', mode);
  document.body.append(el);
  await el.load(await xlsx(NOW), 'spec-v2.xlsx');
  await frame();
  return el;
}

describe('@sheetpane/compare/ui (W-63 DoD 2)', () => {
  it('keyed: tints changed, added, moved and removed rows; the status line sums it up; the errors list holds each change', async () => {
    const el = await mount();
    const wb = el.workbook!;
    const d = await compareWith(wb, await xlsx(BASE), { name: 'spec-v1.xlsx', key: 'Account' });
    await frame();
    expect(d!.summary).toMatchObject({ sheets: 1, rows: 4, cells: 1 });
    expect(status(el)).toContain('Compared with spec-v1.xlsx: 1 sheet · 4 rows · 1 cell changed');
    expect(bg(el, 3, 2)).toBe('rgba(191, 135, 0, 0.3)'); // C4, AC-2's price
    expect(bg(el, 3, 1)).not.toBe('rgba(191, 135, 0, 0.3)'); // its unchanged neighbour
    expect(bg(el, 4, 0)).toBe('rgba(26, 127, 55, 0.18)'); // AC-9, added
    expect(bg(el, 1, 0)).toBe('rgba(9, 105, 218, 0.16)'); // AC-4, moved
    expect(border(el, 4, 0)).toBe('rgb(207, 34, 46)'); // AC-3 was removed above AC-9's row
    const listed = wb.getErrors().filter((e) => e.type === 'compare').map((e) => `${e.range} ${e.message}`);
    expect(listed).toEqual([
      'A2:C2 Row moved — was row 5',
      'A5:C5 Row 5 added',
      'A5:C5 1 row removed above this row — was row 4',
      'C4 Changed: was “3” → now “3.25”',
    ]);
    expect(wb.getErrors().every((e) => e.type !== 'compare' || (e.severity === 'note' && e.author === 'compare' && e.status === 'open'))).toBe(true);
    // the list reads found → expected: the file's text → the base's
    expect(wb.getErrors().filter((e) => e.type === 'compare').map((e) => `${e.found} → ${e.expected}`)).toEqual(['row 2 → row 5', 'row 5 → ', 'row 5 → ', '3.25 → 3']);
    expect(wb.getErrors().some((e) => e.type === 'compare' && (wb.isStale(e) || e.matchesExpected))).toBe(false);
    expect(comparison(wb)?.base).toBe('spec-v1.xlsx');
  });

  it('Alt+F5 and Alt+Shift+F5 step through the changes in order, wrapping; the cell-bar buttons do the same', async () => {
    const el = await mount();
    const wb = el.workbook!;
    await compareWith(wb, await xlsx(BASE), { name: 'spec-v1.xlsx', key: 'Account' });
    wb.select({ sheet: 'Holdings', ref: 'A1' });
    await frame();
    const at = () => `${wb.getSnapshot().selection.ref}${wb.getSnapshot().selection.range ? ` ${wb.getSnapshot().selection.range}` : ''}`;
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) { key(el, 'F5', { altKey: true }); seen.push(at()); }
    expect(seen).toEqual(['A2 A2:C2', 'C4', 'A5 A5:C5', 'A2 A2:C2']);
    key(el, 'F5', { altKey: true, shiftKey: true });
    expect(at()).toBe('A5 A5:C5');
    await frame();
    sh(el).querySelector<HTMLButtonElement>('[data-control=compare-prev]')!.click();
    expect(at()).toBe('C4');
    expect(sh(el).querySelector('[data-control=compare-next]')!.getAttribute('aria-label')).toBe('Next change (Alt+F5)');
  });

  it('a person’s own errors stay; Stop comparing takes the tints, the status and the compare entries away', async () => {
    const el = await mount('edit');
    const wb = el.workbook!;
    wb.addError({ sheet: 'Holdings', range: 'B2', type: 'wrong-value', severity: 'error', expected: '41' });
    await compareWith(wb, await xlsx(BASE), { name: 'spec-v1.xlsx' });
    await frame();
    expect(wb.getErrors().map((e) => e.type)).toContain('wrong-value');
    expect(wb.getErrors().filter((e) => e.type === 'compare').length).toBeGreaterThan(0);
    // W-51: the changes are the `compare` layer — the review is its own layer, and undo is kept
    expect(wb.getErrors({ layer: 'compare' }).map((e) => e.type)).toEqual(wb.getErrors().filter((e) => e.type === 'compare').map(() => 'compare'));
    expect(wb.getErrors({ layer: 'review' }).map((e) => e.type)).toEqual(['wrong-value']);
    expect(wb.getSnapshot().layers).toEqual(['review', 'compare']);
    expect(wb.getSnapshot().canUndo).toBe(true);
    wb.setVisibleLayers(['review']);
    expect(wb.getSnapshot().visibleErrors.map((e) => e.type)).toEqual(['wrong-value']);
    wb.setVisibleLayers(null);
    sh(el).querySelector<HTMLButtonElement>('[data-control=compare-stop]')!.click();
    await frame();
    expect(wb.getErrors().map((e) => e.type)).toEqual(['wrong-value']);
    expect(bg(el, 3, 2)).not.toBe('rgba(191, 135, 0, 0.3)');
    expect(status(el)).not.toContain('Compared with');
    expect(comparison(wb)).toBeUndefined();
    clearCompare(wb); // a second clear is a no-op
  });

  it('without a key a reordered row is added and removed, never moved; another file loaded is compared with the same base', async () => {
    const el = await mount();
    const wb = el.workbook!;
    await compareWith(wb, await xlsx(BASE), { name: 'spec-v1.xlsx' });
    expect(comparison(wb)!.diff.sheets[0]!.counts.rowsMoved).toBe(0);
    await el.load(await xlsx(BASE, [{ name: 'Fees', rows: [['Tier', 'Rate'], ['A', 0.5]] }]), 'spec-v3.xlsx');
    await new Promise((r) => setTimeout(r, 0));
    await frame();
    expect(comparison(wb)!.diff.summary).toMatchObject({ sheets: 1, rows: 2, cells: 0, sheetsAdded: 1 });
    expect(status(el)).toContain('Compared with spec-v1.xlsx: 1 sheet · 2 rows · 0 cells changed');
    expect(wb.getErrors().filter((e) => e.type === 'compare').map((e) => `${e.sheet}!${e.range} ${e.message}`)).toEqual(['Fees!A1 Sheet added']);
    wb.select({ sheet: 'Fees', ref: 'A1' });
    await frame();
    expect(bg(el, 1, 1)).toBe('rgba(26, 127, 55, 0.18)');
  });

  it('a removed sheet is named in the status line (its rows count as removed); the base is read in the page from bytes', async () => {
    const el = await mount();
    const wb = el.workbook!;
    await compareWith(wb, new Blob([(await xlsx(NOW, [{ name: 'Old', rows: [['gone']] }])) as Uint8Array<ArrayBuffer>]), { name: 'spec-v0.xlsx' });
    await frame();
    expect(status(el)).toContain('Compared with spec-v0.xlsx: 1 sheet · 1 row · 0 cells changed · removed “Old”');
    await expect(compareWith(wb, new Uint8Array([1, 2, 3]), { name: 'broken.xlsx' })).rejects.toThrow(/^SP-100\d/);
  });
});
