// W-66: open straight at a cell — the `ref` attribute (the selection once a file is read, scrolled into
// view), the opt-in `link="hash"` binding to `#sheetpane=<pane>:<Sheet>!<ref>` that leaves a host's own
// fragment alone and follows back and forward, and *Copy link* in the cell menu.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axe from 'axe-core';
import { toXlsx } from '@sheetpane/export';
import type { SheetpaneExcel } from '../src/index.js';
import { cellEl, cleanup, frame, mountExcel, shadow, until } from './helpers.js';

const base = location.href.split('#')[0]!;
const setHash = (h: string) => history.replaceState(null, '', h ? `${base}#${h}` : base);
beforeEach(() => setHash(''));
afterEach(() => { cleanup(); setHash(''); vi.restoreAllMocks(); });

const sel = (el: SheetpaneExcel) => el.workbook!.getSnapshot().selection;
const scroller = (el: Element) => shadow(el).querySelector<HTMLElement>('.scroller')!;
const warnings = () => vi.spyOn(console, 'warn').mockImplementation(() => undefined);
const selects = (el: Element) => { const got: { sheet: string; ref: string; range?: string }[] = []; el.addEventListener('sheetpane-select', (e) => got.push((e as CustomEvent).detail)); return got; };
/** Waits past the 300 ms the fragment write waits for the selection to settle. */
const settle = () => new Promise((r) => setTimeout(r, 400));
const nextHashChange = () => new Promise<void>((r) => addEventListener('hashchange', () => r(), { once: true }));
const menuItems = (root: Element) => [...root.querySelectorAll('[role=menuitem]')].map((x) => x.firstChild!.textContent);
const openMenu = async (el: SheetpaneExcel, r: number, c: number) => {
  cellEl(el, r, c)!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, button: 2 }));
  await frame(); await frame();
  return shadow(el).querySelector<HTMLElement>('.overlay .ctxmenu')!;
};

/** Sheet `S` of 300 rows × 30 columns of numbers under a header row, and a short sheet `Q3 data`. */
async function mountBook(attrs: Record<string, string> = {}): Promise<SheetpaneExcel> {
  const data: (string | number)[][] = [Array.from({ length: 30 }, (_, c) => `T${c}`)];
  for (let r = 1; r < 300; r++) data.push(Array.from({ length: 30 }, (_, c) => r * 100 + c));
  return mountExcel(attrs, await toXlsx({ sheets: [{ name: 'S', rows: data }, { name: 'Q3 data', rows: data.slice(0, 20) }] }), 'book.xlsx');
}
/** The cell is drawn and inside the scroller's client area. */
function inView(el: SheetpaneExcel, r: number, c: number): boolean {
  const cell = cellEl(el, r, c), box = scroller(el).getBoundingClientRect();
  if (!cell) return false;
  const b = cell.getBoundingClientRect();
  return b.top >= box.top && b.bottom <= box.top + scroller(el).clientHeight + 1 && b.left >= box.left && b.right <= box.left + scroller(el).clientWidth + 1;
}

describe('the ref attribute (W-66 DoD 1)', () => {
  it('selects its cell once a file is read and scrolls it into view; sheetpane-select names it', async () => {
    const el = document.createElement('sheetpane-excel') as SheetpaneExcel;
    const got = selects(el);
    el.setAttribute('ref', 'S!X250');
    el.style.height = '600px';
    document.body.append(el);
    const data: (string | number)[][] = [Array.from({ length: 30 }, (_, c) => `T${c}`)];
    for (let r = 1; r < 300; r++) data.push(Array.from({ length: 30 }, (_, c) => r * 100 + c));
    await el.load(await toXlsx({ sheets: [{ name: 'S', rows: data }] }), 'book.xlsx');
    await frame(); await frame();
    expect(sel(el)).toEqual({ sheet: 'S', ref: 'X250' });
    expect(scroller(el).scrollTop).toBeGreaterThan(0);
    expect(scroller(el).scrollLeft).toBeGreaterThan(0);
    expect(inView(el, 249, 23)).toBe(true);
    expect(got.map((d) => d.ref)).toEqual(['X250']);
  });

  it('a range on another sheet, the sheet quoted; the property sets the attribute and selects at once after a load', async () => {
    const el = await mountBook({ ref: "'Q3 data'!C3:D5" });
    await frame();
    expect(sel(el)).toEqual({ sheet: 'Q3 data', ref: 'C3', range: 'C3:D5' });
    expect(shadow(el).querySelector('[role=tab][aria-selected=true]')!.getAttribute('data-sp-sheet')).toBe('Q3 data');
    el.ref = 'S!B200';
    expect(el.getAttribute('ref')).toBe('S!B200');
    await frame(); await frame();
    expect(sel(el)).toEqual({ sheet: 'S', ref: 'B200' });
    expect(inView(el, 199, 1)).toBe(true);
    el.ref = 'E7'; // no sheet: the sheet shown
    expect(sel(el)).toEqual({ sheet: 'S', ref: 'E7' });
    el.ref = null;
    expect(el.hasAttribute('ref')).toBe(false);
    expect(sel(el).ref).toBe('E7');
  });

  it('a ref that names no cell is warned with SP-3016 and the sheet opens at A1; none says nothing', async () => {
    const warn = warnings();
    const el = await mountBook({ ref: 'Nope!B4' });
    await frame();
    expect(sel(el)).toEqual({ sheet: 'S', ref: 'A1' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toMatch(/^SP-3016: Cell to open at not found — sheetpane: the ref attribute "Nope!B4" names no cell in this workbook \(.*ERRORS\.md#sp-3016\)$/);
    el.ref = '4B';
    expect(warn).toHaveBeenCalledTimes(2);
    expect(sel(el).ref).toBe('A1');
    cleanup();
    await mountBook();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('a ref set before a file is read waits for it; a second element on the pane follows the shared selection', async () => {
    const warn = warnings();
    const a = document.createElement('sheetpane-excel') as SheetpaneExcel;
    a.setAttribute('pane', 'w66-two'); a.setAttribute('ref', 'Q3 data!B2'); a.style.height = '400px';
    const b = document.createElement('sheetpane-excel') as SheetpaneExcel;
    b.setAttribute('pane', 'w66-two'); b.style.height = '400px';
    document.body.append(a, b);
    expect(warn).not.toHaveBeenCalled();
    const data = [['a', 'b'], [1, 2], [3, 4]];
    await b.load(await toXlsx({ sheets: [{ name: 'S', rows: data }, { name: 'Q3 data', rows: data }] }), 'two.xlsx');
    await frame();
    expect(sel(a)).toEqual({ sheet: 'Q3 data', ref: 'B2' });
    expect(sel(b)).toEqual({ sheet: 'Q3 data', ref: 'B2' });
  });
});

describe('link="hash" (W-66 DoD 2)', () => {
  it('off by default: a selection leaves the URL alone and a link in it is not read', async () => {
    setHash('sheetpane=q3:S!C5');
    const el = await mountBook({ pane: 'q3' });
    await frame();
    expect(sel(el).ref).toBe('A1');
    el.select('S', 'D9');
    await settle();
    expect(location.hash).toBe('#sheetpane=q3:S!C5');
    expect(el.link).toBe('none');
  });

  it('opens at the link in the fragment, beside a hash router\'s path, which stays as it was', async () => {
    setHash('/reports/12?tab=sheet&sheetpane=q3:S!C150');
    const el = await mountBook({ pane: 'q3', link: 'hash', ref: 'S!B2' });
    await frame(); await frame();
    expect(sel(el)).toEqual({ sheet: 'S', ref: 'C150' }); // the link wins over ref
    expect(inView(el, 149, 2)).toBe(true);
    expect(location.hash).toBe('#/reports/12?tab=sheet&sheetpane=q3:S!C150');
  });

  it('the selection is written once it settles, with replaceState: no history entry, no hashchange, the host\'s state and fragment kept', async () => {
    setHash('/reports/12');
    history.replaceState({ router: 'key-1' }, '', location.href);
    const el = await mountBook({ pane: 'q3', link: 'hash' });
    const len = history.length;
    let changes = 0;
    const onChange = () => changes++;
    addEventListener('hashchange', onChange); addEventListener('popstate', onChange);
    try {
      el.select('S', 'B3'); el.select('S', 'B4'); el.select('Q3 data', 'D8');
      expect(location.hash).toBe('#/reports/12'); // not yet: it waits for the selection to settle
      await settle();
      expect(location.hash).toBe('#/reports/12?sheetpane=q3:Q3%20data!D8');
      expect(history.length).toBe(len);
      expect(history.state).toEqual({ router: 'key-1' });
      // a range is written as a range
      el.workbook!.select({ sheet: 'S', ref: 'B3', range: 'B3:D8' });
      await settle();
      expect(location.hash).toBe('#/reports/12?sheetpane=q3:S!B3:D8');
      expect(changes).toBe(0);
    } finally { removeEventListener('hashchange', onChange); removeEventListener('popstate', onChange); }
  });

  it('back and forward: a followed link selects its cell, and back returns to the cell before', async () => {
    const el = await mountBook({ pane: 'q3', link: 'hash' });
    el.select('S', 'E5');
    await settle();
    expect(location.hash).toBe('#sheetpane=q3:S!E5');
    let hc = nextHashChange();
    location.hash = 'sheetpane=q3:S!G200'; // a link the page followed: a new history entry
    await hc; await frame(); await frame();
    expect(sel(el)).toEqual({ sheet: 'S', ref: 'G200' });
    expect(inView(el, 199, 6)).toBe(true);
    hc = nextHashChange();
    history.back();
    await hc; await frame();
    expect(sel(el)).toEqual({ sheet: 'S', ref: 'E5' });
    hc = nextHashChange();
    history.forward();
    await hc; await frame();
    expect(sel(el)).toEqual({ sheet: 'S', ref: 'G200' });
    // another pane's link, or the host's own fragment, moves nothing
    hc = nextHashChange();
    location.hash = 'sheetpane=q4:S!B2&/elsewhere';
    await hc; await frame();
    expect(sel(el).ref).toBe('G200');
    history.back(); await nextHashChange();
  });

  it('a link naming no cell is warned (SP-3016) and ref is used; two panes keep their own links', async () => {
    const warn = warnings();
    setHash('sheetpane=p1:Gone!B2&sheetpane=p2:S!D4');
    const a = await mountBook({ pane: 'p1', link: 'hash', ref: 'S!C3' });
    const b = await mountBook({ pane: 'p2', link: 'hash' });
    await frame();
    expect(sel(a)).toEqual({ sheet: 'S', ref: 'C3' });
    expect(sel(b)).toEqual({ sheet: 'S', ref: 'D4' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain('SP-3016');
    expect(String(warn.mock.calls[0]![0])).toContain('the link in the URL "Gone!B2"');
    await settle();
    // each pane writes its own, where it stood; the other's stays
    expect(location.hash).toBe('#sheetpane=p1:S!C3&sheetpane=p2:S!D4');
    b.select('S', 'F6');
    await settle();
    expect(location.hash).toBe('#sheetpane=p1:S!C3&sheetpane=p2:S!F6');
  });

  it('turning it off takes this pane\'s link out of the URL and keeps the host\'s part', async () => {
    setHash('section-2');
    const el = await mountBook({ pane: 'q3', link: 'hash' });
    el.select('S', 'B3');
    await settle();
    expect(location.hash).toBe('#section-2&sheetpane=q3:S!B3');
    el.link = 'none';
    expect(location.hash).toBe('#section-2');
    el.select('S', 'B9');
    await settle();
    expect(location.hash).toBe('#section-2');
  });
});

describe('Copy link (W-66 DoD 3)', () => {
  it('sits after Copy ref in the cell menu and the ⋯ menu only when link="hash", and copies the page\'s URL with the cell', async () => {
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    setHash('/reports/12');
    const el = await mountBook({ pane: 'q3', mode: 'edit' });
    expect(menuItems(await openMenu(el, 3, 2))).toEqual(['Flag issue', 'Copy ref', 'Copy value']);
    el.link = 'hash';
    await frame();
    const menu = await openMenu(el, 4, 3);
    expect(menuItems(menu)).toEqual(['Flag issue', 'Copy ref', 'Copy link', 'Copy value']);
    menu.querySelector<HTMLButtonElement>('[data-act=copy-link]')!.click();
    expect(write).toHaveBeenLastCalledWith(`${base}#/reports/12?sheetpane=q3:S!D5`);
    // the ⋯ menu in the cell bar, for a range
    el.workbook!.select({ sheet: 'Q3 data', ref: 'B2', range: 'B2:C4' });
    await frame();
    shadow(el).querySelector<HTMLButtonElement>('.dock [data-act=more]')!.click();
    await frame();
    const more = shadow(el).querySelector<HTMLElement>('.dock .moremenu')!;
    expect(menuItems(more)).toEqual(['Copy ref', 'Copy link', 'Copy values']);
    more.querySelector<HTMLButtonElement>('[data-act=copy-link]')!.click();
    expect(write).toHaveBeenLastCalledWith(`${base}#/reports/12?sheetpane=q3:Q3%20data!B2:C4`);
    // a copied link opens there
    const link = String(write.mock.calls.at(-1)![0]);
    cleanup();
    setHash(link.slice(link.indexOf('#') + 1));
    const again = await mountBook({ pane: 'q3', link: 'hash' });
    await frame();
    expect(sel(again)).toEqual({ sheet: 'Q3 data', ref: 'B2', range: 'B2:C4' });
  });

  it('axe: the menu with Copy link in View and Edit', async () => {
    const el = await mountBook({ pane: 'q3', link: 'hash' });
    const rules = { 'scrollable-region-focusable': { enabled: true } };
    for (const mode of ['view', 'edit'] as const) {
      el.mode = mode;
      await frame();
      await openMenu(el, 2, 2);
      await until(() => !!shadow(el).querySelector('[data-act=copy-link]'));
      const r = await axe.run(el, { rules });
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    }
  });
});
