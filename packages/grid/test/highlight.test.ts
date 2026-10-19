// W-56: sheetpane-hover as a mouse or pen pointer crosses cells (once per frame, never for a finger), and
// highlight(ranges) — a pass-through outline on the overlay that is not a change and does not select.
import { afterEach, describe, expect, it } from 'vitest';
import axe from 'axe-core';
import { toXlsx } from '@sheetpane/export';
import type { SheetpaneExcel } from '../src/index.js';
import { budgets, cellEl, cleanup, frame, mountExcel, shadow } from './helpers.js';

afterEach(cleanup);

type Hover = { sheet: string; ref: string; column: { index: number; letter: string; header: string } } | null;
const sel = (el: SheetpaneExcel) => el.workbook!.getSnapshot().selection;
const scroller = (el: Element) => shadow(el).querySelector<HTMLElement>('.scroller')!;
const center = (e: Element) => { const r = e.getBoundingClientRect(); return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }; };
const ptr = (target: Element, type: string, o: PointerEventInit = {}) => target.dispatchEvent(new PointerEvent(type, { bubbles: type !== 'pointerleave', composed: true, cancelable: true, pointerId: 3, pointerType: 'mouse', ...o }));
/** Moves a mouse (or another pointer type) to the centre of an element. */
const moveTo = (target: Element, pointerType = 'mouse') => ptr(target, 'pointermove', { pointerType, ...center(target) });
const boxes = (el: Element) => [...shadow(el).querySelectorAll<HTMLElement>('.overlay > .hl > .hlbox')];
const rect = (e: Element) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
const hovers = (el: Element) => { const got: Hover[] = []; el.addEventListener('sheetpane-hover', (e) => got.push((e as CustomEvent<Hover>).detail)); return got; };

/** Sheets of `rows` × `cols` numbers under a header row of titles; the first sheet is `S`, a second `T` when asked. */
async function mountBook(rows = 40, cols = 8, o: { merges?: string[]; two?: boolean; attrs?: Record<string, string> } = {}): Promise<SheetpaneExcel> {
  const data: (string | number)[][] = [Array.from({ length: cols }, (_, c) => `T${c}`)];
  for (let r = 1; r < rows; r++) data.push(Array.from({ length: cols }, (_, c) => r * 10 + c));
  const sheets = [{ name: 'S', rows: data, merges: o.merges ?? [] }, ...(o.two ? [{ name: 'T', rows: data.slice(0, 10) }] : [])];
  return mountExcel(o.attrs ?? {}, await toXlsx({ sheets }), 'book.xlsx');
}

describe('sheetpane-hover (W-56 DoD 1)', () => {
  it('names the cell under a mouse once it changes, at most once per frame, with the column; null off the cells', async () => {
    const el = await mountBook();
    const got = hovers(el);
    // three moves in one frame: one event, for the last cell
    moveTo(cellEl(el, 1, 1)!); moveTo(cellEl(el, 2, 1)!); moveTo(cellEl(el, 2, 2)!);
    await frame();
    expect(got).toEqual([{ sheet: 'S', ref: 'C3', column: { index: 2, letter: 'C', header: 'T2' } }]);
    // moving inside the same cell says nothing new
    const c = cellEl(el, 2, 2)!.getBoundingClientRect();
    ptr(cellEl(el, 2, 2)!, 'pointermove', { clientX: c.left + 3, clientY: c.top + 3 });
    await frame();
    expect(got).toHaveLength(1);
    // a header is not a cell
    moveTo(shadow(el).querySelector('[data-hc="3"]')!);
    await frame();
    expect(got.at(-1)).toBeNull();
    moveTo(cellEl(el, 4, 0)!);
    await frame();
    expect(got.at(-1)?.ref).toBe('A5');
    // leaving the grid
    ptr(scroller(el), 'pointerleave');
    await frame();
    expect(got.at(-1)).toBeNull();
    expect(got).toHaveLength(4);
    // a hover is not a selection
    expect(sel(el).ref).toBe('A1');
  });

  it('never fires for a finger; a pen hovers', async () => {
    const el = await mountBook();
    const got = hovers(el);
    moveTo(cellEl(el, 3, 3)!, 'touch');
    await frame();
    expect(got).toEqual([]);
    moveTo(cellEl(el, 3, 3)!, 'pen');
    await frame();
    expect(got.map((h) => h?.ref)).toEqual(['D4']);
  });

  it('a merged cell is named by its top-left; frozen panes are read where they stick', async () => {
    const el = await mountBook(80, 8, { merges: ['B3:C4'] });
    const got = hovers(el);
    const m = cellEl(el, 2, 1)!.getBoundingClientRect();
    ptr(cellEl(el, 2, 1)!, 'pointermove', { clientX: m.right - 4, clientY: m.bottom - 4 });
    await frame();
    expect(got.at(-1)?.ref).toBe('B3');
    el.workbook!.setFreeze('S', { rows: 2, cols: 0 });
    await frame();
    scroller(el).scrollTop = 600;
    await frame();
    moveTo(cellEl(el, 1, 4)!); // a frozen row stays put while the rest scrolls
    await frame();
    expect(got.at(-1)?.ref).toBe('E2');
  });

  it('a pointer that stays put while the sheet scrolls names the new cell under it', async () => {
    const el = await mountBook(200);
    const got = hovers(el);
    moveTo(cellEl(el, 3, 1)!);
    await frame();
    expect(got.at(-1)?.ref).toBe('B4');
    scroller(el).scrollTop = 28 * 10;
    await frame(); await frame();
    expect(got.at(-1)?.ref).toBe('B14');
  });
});

describe('highlight() (W-56 DoD 2)', () => {
  it('outlines several ranges in a tone, around the cells, without selecting or changing anything', async () => {
    const el = await mountBook();
    expect(el.highlight(['B3', 'D5:E6'], { tone: 'fail' })).toBe(2);
    await frame();
    const [a, b] = boxes(el);
    expect(boxes(el)).toHaveLength(2);
    expect(a!.className).toBe('hlbox fail');
    const b3 = cellEl(el, 2, 1)!.getBoundingClientRect(), d5 = cellEl(el, 4, 3)!.getBoundingClientRect(), e6 = cellEl(el, 5, 4)!.getBoundingClientRect();
    expect(rect(a!)).toEqual([Math.round(b3.left - 2), Math.round(b3.top - 2), Math.round(b3.width + 4), Math.round(b3.height + 4)]);
    expect(rect(b!)).toEqual([Math.round(d5.left - 2), Math.round(d5.top - 2), Math.round(e6.right - d5.left + 4), Math.round(e6.bottom - d5.top + 4)]);
    expect(getComputedStyle(a!).borderTopWidth).toBe('2px');
    // pass-through: the cell under the outline gets the pointer, and a press there selects it
    const p = center(cellEl(el, 2, 1)!);
    const under = shadow(el).elementFromPoint(p.clientX, p.clientY)!;
    expect(under.closest('[data-sp-ref]')?.getAttribute('data-sp-ref')).toBe('B3');
    expect(getComputedStyle(a!).pointerEvents).toBe('none');
    expect(getComputedStyle(a!.parentElement!).pointerEvents).toBe('none');
    // not a change, not undone, not the selection, not in the download
    const wb = el.workbook!;
    expect(sel(el).ref).toBe('A1');
    expect(wb.changeCount).toBe(0);
    expect(wb.getSnapshot().canUndo).toBe(false);
    let original: unknown;
    el.addEventListener('sheetpane-export', (e) => { original = (e as CustomEvent).detail.original; e.preventDefault(); });
    shadow(el).querySelector<HTMLElement>('[data-sp=download]')!.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(original).toBe(true);
    ptr(under, 'pointerdown', { ...p, button: 0, buttons: 1 });
    ptr(scroller(el), 'pointerup', { ...p, button: 0 });
    await frame();
    expect(sel(el).ref).toBe('B3');
    expect(boxes(el)).toHaveLength(2); // selecting a cell leaves the highlight
  });

  it('tones per range, sheet-qualified refs; a bad ref or a missing sheet is skipped; each call replaces the last', async () => {
    const el = await mountBook(40, 8, { two: true });
    expect(el.highlight([{ ref: 'B3', tone: 'pass' }, "'S'!C4", 'S!D5:D6', 'nope', 'Missing!B3', 'B3:'], { tone: 'info' })).toBe(3);
    await frame();
    expect(boxes(el).map((b) => b.className)).toEqual(['hlbox pass', 'hlbox info', 'hlbox info']);
    expect(el.highlight('E7')).toBe(1);
    await frame();
    expect(boxes(el).map((b) => b.className)).toEqual(['hlbox info']);
    expect(el.highlight(['zz'])).toBe(0);
    await frame();
    expect(boxes(el)).toHaveLength(0);
    el.highlight('B3');
    await frame();
    el.clearHighlight();
    await frame();
    expect(shadow(el).querySelector('.overlay > .hl')).toBeNull();
  });

  it('a sheet switch clears it unless pinned; a pinned one shows again on its sheet; a new file clears it', async () => {
    const el = await mountBook(40, 8, { two: true });
    el.highlight('B3');
    el.select('T', 'A1');
    await frame();
    el.select('S', 'A1');
    await frame();
    expect(boxes(el)).toHaveLength(0);
    // pinned, with a range on the other sheet too
    expect(el.highlight(['B3', 'T!C2'], { pinned: true })).toBe(2);
    await frame();
    expect(boxes(el)).toHaveLength(1);
    el.select('T', 'A1');
    await frame();
    expect(boxes(el)).toHaveLength(1);
    const c2 = cellEl(el, 1, 2)!.getBoundingClientRect();
    expect(rect(boxes(el)[0]!).slice(0, 2)).toEqual([Math.round(c2.left - 2), Math.round(c2.top - 2)]);
    el.select('S', 'A1');
    await frame();
    expect(boxes(el)).toHaveLength(1);
    await el.load(await toXlsx({ sheets: [{ name: 'S', rows: [['a', 'b'], [1, 2], [3, 4]] }] }), 'other.xlsx');
    await frame();
    expect(boxes(el)).toHaveLength(0);
    // before a file is loaded there is nothing to point at
    const empty = document.createElement('sheetpane-excel');
    document.body.append(empty);
    expect(empty.highlight('B3')).toBe(0);
  });

  it('follows zoom, and draws nothing for a range wholly in hidden rows', async () => {
    const el = await mountBook();
    el.highlight('C5');
    const zoom = shadow(el).querySelector<HTMLSelectElement>('.zoom')!;
    zoom.value = '1.5'; zoom.dispatchEvent(new Event('change'));
    await frame();
    const c5 = cellEl(el, 4, 2)!.getBoundingClientRect();
    expect(rect(boxes(el)[0]!)).toEqual([Math.round(c5.left - 2), Math.round(c5.top - 2), Math.round(c5.width + 4), Math.round(c5.height + 4)]);
    el.workbook!.setHidden('S', 'rows', [4], true);
    await frame();
    expect(boxes(el)).toHaveLength(0);
  });
});

describe('reveal (W-56 step 3)', () => {
  it('{ reveal: true } scrolls the first range on the sheet shown into view; a hidden row under it is shown for viewing', async () => {
    const el = await mountBook(400, 30);
    const sc = scroller(el);
    el.highlight('X300', { reveal: true });
    await frame();
    expect(sc.scrollTop).toBeGreaterThan(0);
    expect(sc.scrollLeft).toBeGreaterThan(0);
    // the outline and its 2 px halo inside the scroller's client area (scrollbars excluded)
    const box = boxes(el)[0]!.getBoundingClientRect(), v = sc.getBoundingClientRect(), top = v.top + sc.clientTop, left = v.left + sc.clientLeft;
    expect(box.top - 2).toBeGreaterThanOrEqual(top);
    expect(box.bottom + 2).toBeLessThanOrEqual(top + sc.clientHeight + 0.5);
    expect(box.left - 2).toBeGreaterThanOrEqual(left);
    expect(box.right + 2).toBeLessThanOrEqual(left + sc.clientWidth + 0.5);
    expect(sel(el).ref).toBe('A1');
    // without reveal nothing scrolls
    sc.scrollTop = 0; sc.scrollLeft = 0;
    el.highlight('B350');
    await frame();
    expect(sc.scrollTop).toBe(0);
    // a hidden row under the range
    el.workbook!.setHidden('S', 'rows', [9], true);
    await frame();
    expect(cellEl(el, 9, 1)).toBeNull();
    el.highlight('B10', { reveal: true });
    await frame();
    expect(cellEl(el, 9, 1)).not.toBeNull();
    expect(boxes(el)).toHaveLength(1);
  });
});

describe('the label (W-56 DoD 3)', () => {
  it('is shown in the status line and said once: the live region is not rewritten while it stays', async () => {
    const el = await mountBook(200);
    const status = shadow(el).querySelector<HTMLElement>('.status')!;
    expect(status.getAttribute('role')).toBe('status');
    el.highlight('B3', { label: 'Box 4 · Total units', tone: 'pass' });
    await frame();
    expect(status.textContent).toContain('Box 4 · Total units');
    let writes = 0;
    const mo = new MutationObserver((m) => { writes += m.length; });
    mo.observe(status, { childList: true, subtree: true, characterData: true });
    scroller(el).scrollTop = 300; // renders again
    await frame();
    el.highlight('B3', { label: 'Box 4 · Total units', tone: 'pass' }); // the same label again
    await frame();
    await Promise.resolve();
    expect(writes).toBe(0);
    el.clearHighlight();
    await frame();
    await Promise.resolve();
    mo.disconnect();
    expect(writes).toBeGreaterThan(0);
    expect(status.textContent).not.toContain('Box 4');
  });

  it('has no axe violations with a labelled highlight, in View and Edit', async () => {
    const el = await mountBook(30, 6, { attrs: { mode: 'edit' } });
    el.highlight(['B2', 'C4:D5'], { label: 'Spec row 12', tone: 'fail' });
    await frame();
    const rules = { 'scrollable-region-focusable': { enabled: true } };
    let r = await axe.run(el, { rules });
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    el.setAttribute('mode', 'view');
    await frame();
    r = await axe.run(el, { rules });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
});

describe('speed (W-56 hazard)', () => {
  it('a fast pointer over 250,000 rows while scrolling, the host highlighting each hovered cell — frame times reported', async () => {
    const lines = ['id,client,units,price,value'];
    for (let i = 0; i < 250_000; i++) lines.push(`AC-${i},Client ${i % 97},${i % 1000},${(i % 300) + 0.25},${i * 3}`);
    const el = await mountExcel({}, new TextEncoder().encode(lines.join('\r\n')), 'transactions-q3.csv');
    const sc = scroller(el), r = sc.getBoundingClientRect();
    let told = 0;
    // the host's side of "the other follows": every hover outlines its cell
    el.addEventListener('sheetpane-hover', (e) => { told++; const d = (e as CustomEvent<Hover>).detail; if (d) el.highlight(d.ref, { tone: 'info' }); else el.clearHighlight(); });
    const gaps: number[] = [];
    let last = performance.now(), i = 0;
    const end = last + 5000;
    await new Promise<void>((done) => {
      const step = (t: number) => {
        gaps.push(t - last); last = t;
        sc.scrollTop += 900;
        // four moves a frame, across the visible cells
        for (let k = 0; k < 4; k++, i++) ptr(sc, 'pointermove', { clientX: r.left + 80 + ((i * 37) % 400), clientY: r.top + 60 + ((i * 53) % 400) });
        if (t < end) requestAnimationFrame(step); else done();
      };
      requestAnimationFrame(step);
    });
    const iv = gaps.slice(2).sort((a, b) => a - b), vs = iv[Math.floor(iv.length / 2)]!;
    const over = iv.filter((x) => x > vs * 1.5).length;
    console.info(`W-56 hover + highlight, 250k rows, 4 moves a frame while scrolling: ${gaps.length} frames, ${told} hover events, worst ${iv[iv.length - 1]!.toFixed(1)} ms, p95 ${iv[Math.floor(iv.length * 0.95)]!.toFixed(1)} ms, dropped ${over}, scrolled ${Math.round(sc.scrollTop)} px — ${navigator.userAgent}, ${navigator.hardwareConcurrency} cores`);
    expect(told).toBeGreaterThan(0);
    expect(told).toBeLessThanOrEqual(gaps.length + 1); // once per frame at most
    if (budgets) expect(sc.scrollTop).toBeGreaterThan(100_000);
    expect(boxes(el).length).toBeLessThanOrEqual(1);
  }, 60_000);
});
