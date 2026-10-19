// SR-LAW-13: every dropdown, menu and pop-up card is drawn on top of the page and wholly inside the viewport.
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { toXlsx } from '@sheetpane/export';
import type { SheetpaneExcel } from '../src/index.js';
import { EDGE, FLOATS, placeInViewport } from '../src/excel/float.js';
import { cellEl, cleanup, frame, mountExcel, shadow } from './helpers.js';

afterEach(cleanup);

const inside = (el: Element) => {
  const r = el.getBoundingClientRect(), d = document.documentElement;
  return r.left >= 0 && r.top >= 0 && r.right <= d.clientWidth && r.bottom <= d.clientHeight && r.width > 0 && r.height > 0;
};
const onTop = (el: Element) => el.matches(':popover-open');
/** The topmost element at the card's centre is the card or inside it: nothing covers it. */
const uncovered = (el: Element, root: ShadowRoot) => { const r = el.getBoundingClientRect(); const hit = root.elementFromPoint(r.left + r.width / 2, r.top + Math.min(12, r.height / 2)); return !!hit && (hit === el || el.contains(hit)); };

async function mountWide(): Promise<SheetpaneExcel> {
  const rows = Array.from({ length: 40 }, (_, r) => Array.from({ length: 12 }, (_, c) => (r === 0 ? `Head ${c}` : r * 100 + c)));
  return mountExcel({ mode: 'edit' }, await toXlsx({ sheets: [{ name: 'S', rows }] }), 'wide.xlsx');
}

describe('placeInViewport', () => {
  it('moves a card in from the right and the bottom, above its anchor when it fits there', () => {
    expect(placeInViewport(950, 100, 200, 100, 1000, 800)).toEqual({ x: 1000 - EDGE - 200, y: 100 });
    expect(placeInViewport(-20, -5, 100, 100, 1000, 800)).toEqual({ x: EDGE, y: EDGE });
    expect(placeInViewport(100, 750, 100, 200, 1000, 800, 30)).toEqual({ x: 100, y: 750 - 30 - 200 });
    // too tall for above or below: it stays where it opened and scrolls inside
    expect(placeInViewport(100, 150, 100, 700, 1000, 800, 30)).toEqual({ x: 100, y: 150, maxH: 800 - EDGE - 150 });
    expect(placeInViewport(100, 100, 100, 900, 1000, 800)).toEqual({ x: 100, y: 100, maxH: 800 - EDGE - 100 });
    // too little room below to stay: it moves up
    expect(placeInViewport(100, 760, 100, 200, 1000, 800)).toEqual({ x: 100, y: 800 - EDGE - 200 });
    expect(placeInViewport(100, 760, 100, 900, 1000, 800)).toEqual({ x: 100, y: EDGE, maxH: 800 - 2 * EDGE });
  });
});

describe('the element’s cards (SR-LAW-13)', () => {
  it('the header menu of the last column is on top and inside the viewport', async () => {
    await page.viewport(900, 600);
    const el = await mountWide();
    const sc = shadow(el).querySelector<HTMLElement>('.scroller')!;
    sc.scrollLeft = sc.scrollWidth; await frame(); await frame();
    const heads = [...shadow(el).querySelectorAll<HTMLElement>('[data-hc]')];
    heads.at(-1)!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true }));
    await frame(); await frame();
    const m = shadow(el).querySelector<HTMLElement>('[data-sp=header-menu]')!;
    expect(onTop(m)).toBe(true);
    expect(inside(m)).toBe(true);
    expect(uncovered(m, shadow(el))).toBe(true);
  });
  it('the cell menu near the bottom opens above its cell, inside the viewport', async () => {
    await page.viewport(900, 600);
    const el = await mountWide();
    el.style.height = '600px';
    await frame(); await frame();
    const cells = [...shadow(el).querySelectorAll<HTMLElement>('[role=gridcell]')];
    const low = cells.filter((c) => c.getBoundingClientRect().bottom < 600).sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0]!;
    low.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, button: 2 }));
    await frame(); await frame();
    const m = shadow(el).querySelector<HTMLElement>('.ctxmenu')!;
    expect(onTop(m)).toBe(true);
    expect(inside(m)).toBe(true);
    const sel = shadow(el).querySelector<HTMLElement>('[role=gridcell][aria-selected=true]') ?? low;
    expect(m.getBoundingClientRect().bottom).toBeLessThanOrEqual(sel.getBoundingClientRect().top + 1); // above, not over, its cell
  });
  it('a gate: every card drawn is in the top layer, whatever opened it', async () => {
    const el = await mountWide();
    const visibleCards = () => [...shadow(el).querySelectorAll<HTMLElement>('.card')].filter((c) => c.getBoundingClientRect().width > 0);
    cellEl(el, 2, 2)!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, button: 2 }));
    await frame(); await frame();
    expect(visibleCards().length).toBeGreaterThan(0);
    for (const c of visibleCards()) expect([c.className, onTop(c)]).toEqual([c.className, true]);
    expect(FLOATS).toContain('.card.ctxmenu');
    expect([...shadow(el).querySelectorAll('.sp-float')].every((x) => x.classList.contains('card'))).toBe(true); // a button named like a card stays put
  });
});
