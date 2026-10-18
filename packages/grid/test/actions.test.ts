// W-31: the selection actions docked in the cell bar and on right-click; one Download button.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createWorkbook, type Plugin, type SheetpaneExcel } from '../src/index.js';
import { cellEl, cleanup, frame, mountExcel, sampleCsv, sampleXlsx, shadow } from './helpers.js';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const $ = (el: Element, sel: string) => shadow(el).querySelector(sel) as HTMLElement;
const shout: Plugin = { id: 'shout', provides: [], controls: [{ id: 'shout-sel', slot: 'selbar', group: 'x', label: 'Shout', mode: 'edit', run: (s, sel) => s.setCell(sel.sheet, sel.ref, 'SHOUT') }] };
const click = async (el: Element, r: number, c: number) => { cellEl(el, r, c)!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 })); await frame(); };
const labels = (root: Element | null) => [...(root?.querySelectorAll<HTMLElement>('button') ?? [])].map((b) => b.getAttribute('aria-label') ?? b.textContent);

async function withPlugin(mode: 'view' | 'edit' = 'edit'): Promise<SheetpaneExcel> {
  const el = await mountExcel({ mode });
  el.workbook = createWorkbook({ plugins: [shout] });
  await el.load(await sampleXlsx(), 'Client holdings — Q3 2026.xlsx');
  await frame();
  return el;
}

describe('docked, never floating (DoD 1, 2, 4)', () => {
  it('a click draws nothing over the grid; the cell bar ends with Flag issue · plugin buttons · ⋯', async () => {
    const el = await withPlugin();
    await click(el, 3, 2);
    expect(shadow(el).querySelector('.selbar')).toBeNull();
    expect(shadow(el).querySelectorAll('.overlay .dyn > :not(.pin)').length).toBe(0);
    expect(labels($(el, '.fx .dock'))).toEqual(['Flag issue (F)', 'Shout', 'More actions (Shift+F10)']);
    // the dock is the cell bar's last group
    expect($(el, '.fx').lastElementChild).toBe($(el, '.dock'));
  });

  it('a workbook given to an element takes the element’s mode', async () => {
    const el = await withPlugin('edit');
    expect(el.workbook!.getSnapshot().mode).toBe('edit');
  });

  it('View: only ⋯; a cell with an error: no Flag issue', async () => {
    const view = await withPlugin('view');
    await click(view, 3, 2);
    expect(labels($(view, '.dock'))).toEqual(['More actions (Shift+F10)']);
    cleanup();
    const el = await withPlugin();
    el.workbook!.addError({ sheet: 'Holdings', range: 'C4', type: 'wrong-value', severity: 'error', expected: 'x' });
    await click(el, 3, 2);
    expect(labels($(el, '.dock'))).toEqual(['Shout', 'More actions (Shift+F10)']);
  });

  it('steps aside while the draft is edited and while composing', async () => {
    const el = await withPlugin();
    await click(el, 3, 2);
    $(el, 'input.cell').focus();
    await frame();
    expect($(el, '.dock').hidden).toBe(true);
    $(el, '.grid').focus();
    await frame();
    expect($(el, '.dock').hidden).toBe(false);
    ($(el, '.dock [data-act=flag]') as HTMLButtonElement).click();
    await frame();
    expect(el.workbook!.getSnapshot().composing).not.toBeNull();
    expect($(el, '.dock').hidden).toBe(true);
  });

  it('⋯ opens Copy ref and Copy value; a plugin button stays in the bar while it is wide', async () => {
    const el = await withPlugin();
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await click(el, 3, 2);
    ($(el, '.dock [data-act=more]') as HTMLButtonElement).click();
    await frame();
    const menu = $(el, '.dock .moremenu');
    expect(menu.getAttribute('role')).toBe('menu');
    expect($(el, '.dock [data-act=more]').getAttribute('aria-expanded')).toBe('true');
    const visible = [...menu.querySelectorAll<HTMLElement>('[role=menuitem]')].filter((x) => x.offsetParent !== null).map((x) => x.firstChild!.textContent);
    expect(visible).toEqual(['Copy ref', 'Copy value']);
    (menu.querySelector('[data-act=copy-value]') as HTMLButtonElement).click();
    expect(write).toHaveBeenCalledWith(el.workbook!.text('Holdings', 'C4'));
    await frame();
    expect(shadow(el).querySelector('.moremenu')).toBeNull();
  });

  it('a narrow cell bar folds the plugin buttons into ⋯ before Flag issue moves', async () => {
    const el = await withPlugin();
    el.style.width = '600px';
    await click(el, 3, 2);
    expect($(el, '.dock .plug').offsetParent).toBeNull();
    expect($(el, '.dock [data-act=flag]').offsetParent).not.toBeNull();
    ($(el, '.dock [data-act=more]') as HTMLButtonElement).click();
    await frame();
    const fold = $(el, '.moremenu [data-control=shout-sel]');
    expect(fold.offsetParent).not.toBeNull();
    fold.click();
    expect(el.workbook!.text('Holdings', 'C4')).toBe('SHOUT');
  });

  it('copying without a secure context says so in the status line', async () => {
    const el = await withPlugin();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    await click(el, 3, 2);
    $(el, '.grid').focus();
    await userEvent.keyboard('{Control>}c{/Control}');
    await frame(); await frame();
    expect($(el, '.status').textContent).toContain('Copy needs a secure page');
  });
});

describe('the context menu (DoD 3)', () => {
  it('right-click selects the cell and opens the actions under it; arrows move; Esc closes and returns focus', async () => {
    const el = await withPlugin();
    const ev = new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, button: 2 });
    cellEl(el, 5, 3)!.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    await frame(); await frame();
    expect(el.workbook!.getSnapshot().selection.ref).toBe('D6');
    const menu = $(el, '.overlay .ctxmenu');
    expect(menu.getAttribute('role')).toBe('menu');
    expect([...menu.querySelectorAll('[role=menuitem]')].map((x) => x.firstChild!.textContent)).toEqual(['Flag issue', 'Copy ref', 'Copy value', 'Shout']);
    expect(menu.getBoundingClientRect().top).toBeGreaterThanOrEqual(cellEl(el, 5, 3)!.getBoundingClientRect().bottom - 1);
    expect(shadow(el).activeElement?.textContent).toContain('Flag issue');
    await userEvent.keyboard('{ArrowDown}');
    expect(shadow(el).activeElement?.textContent).toBe('Copy ref');
    await userEvent.keyboard('{Escape}');
    await frame();
    expect(shadow(el).querySelector('.ctxmenu')).toBeNull();
    expect(shadow(el).activeElement).toBe($(el, '.grid'));
  });

  it('Shift+F10 and the Menu key open it; Enter runs an item; the browser menu stays off the toolbar and cell bar', async () => {
    const el = await withPlugin();
    await click(el, 3, 2);
    $(el, '.grid').focus();
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    await frame(); await frame();
    expect(shadow(el).querySelector('.ctxmenu')).not.toBeNull();
    await userEvent.keyboard('{Enter}'); // Flag issue
    await frame();
    expect(el.workbook!.getSnapshot().composing).not.toBeNull();
    el.workbook!.compose(null);
    $(el, '.grid').focus();
    await userEvent.keyboard('{ContextMenu}');
    await frame(); await frame();
    expect(shadow(el).querySelector('.ctxmenu')).not.toBeNull();
    for (const sel of ['.bar', '.fx']) {
      const e = new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true });
      $(el, sel).dispatchEvent(e);
      expect(e.defaultPrevented, sel).toBe(false);
    }
  });
});

describe('one Download button (DoD 5)', () => {
  it('in View and Edit; untouched → the original bytes; changed → export() with the count on the button', async () => {
    const el = await mountExcel({ mode: 'view' });
    expect(shadow(el).querySelector('.orig')).toBeNull();
    expect(shadow(el).querySelectorAll('button.export')).toHaveLength(1);
    expect($(el, 'button.export').offsetParent).not.toBeNull();
    expect($(el, 'button.export .lbl').textContent).toBe('Download .xlsx');
    const got: { original?: boolean; blob: Blob }[] = [];
    el.addEventListener('sheetpane-export', (e) => { got.push((e as CustomEvent).detail); e.preventDefault(); });
    ($(el, 'button.export') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(got).toHaveLength(1));
    expect(got[0]!.original).toBe(true);
    expect(new Uint8Array(await got[0]!.blob.arrayBuffer())).toEqual(el.workbook!.getSnapshot().source!.bytes);
    el.mode = 'edit';
    el.workbook!.setCell('Holdings', 'B3', 'Changed');
    await frame();
    expect($(el, 'button.export .badge-n').textContent).toBe('1');
    expect($(el, 'button.export').title).toBe('Download with 1 change');
    ($(el, 'button.export') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(got).toHaveLength(2));
    expect(got[1]!.original).toBeUndefined();
    expect(got[1]!.blob.size).not.toBe(got[0]!.blob.size);
  });

  it('a CSV says Download .csv', async () => {
    const el = await mountExcel({}, sampleCsv(), 'holdings.csv');
    expect($(el, 'button.export .lbl').textContent).toBe('Download .csv');
  });
});
