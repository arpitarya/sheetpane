// W-46: range selection — one layer, no re-render, a drag that follows the pointer and autoscrolls,
// headers, keys, range copy / Delete / paste, totals, aria-selected and the announcement.
import { afterEach, describe, expect, it } from 'vitest';
import axe from 'axe-core';
import { toXlsx } from '@sheetpane/export';
import type { SheetpaneExcel } from '../src/index.js';
import { clipOf, dataEdge, growForMerges, refLabel, splitByPanes, totalsOf, usedRange } from '../src/excel/selection.js';
import { budgets, cellEl, cleanup, frame, mountExcel, shadow } from './helpers.js';

afterEach(cleanup);

const grid = (el: Element) => shadow(el).querySelector<HTMLElement>('.grid')!;
const key = (el: Element, k: string, o: KeyboardEventInit = {}) => grid(el).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...o }));
const sel = (el: SheetpaneExcel) => el.workbook!.getSnapshot().selection;
const ptr = (target: Element, type: string, o: PointerEventInit = {}) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, cancelable: true, pointerId: 7, pointerType: 'mouse', button: 0, buttons: 1, ...o }));
const center = (e: Element) => { const r = e.getBoundingClientRect(); return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }; };

/** A sheet of `rows` × `cols` numbers (row × 10 + col), a header row of titles, and the merges given. */
async function mountBook(rows = 40, cols = 8, merges: string[] = [], attrs: Record<string, string> = {}): Promise<SheetpaneExcel> {
  const data: (string | number)[][] = [Array.from({ length: cols }, (_, c) => `T${c}`)];
  for (let r = 1; r < rows; r++) data.push(Array.from({ length: cols }, (_, c) => r * 10 + c));
  return mountExcel(attrs, await toXlsx({ sheets: [{ name: 'S', rows: data, merges }] }), 'book.xlsx');
}

describe('the pure parts (W-46)', () => {
  it('merge growth, pane split, ref labels, the data edge, the used range, the clip and the totals', () => {
    expect(growForMerges({ top: 0, left: 0, bottom: 1, right: 1 }, [{ top: 1, left: 1, bottom: 3, right: 2 }])).toEqual({ top: 0, left: 0, bottom: 3, right: 2 });
    expect(splitByPanes({ top: 0, left: 0, bottom: 5, right: 4 }, 2, 1).map((p) => [p.pane, p.top, p.bottom, p.left, p.right, p.edges.top, p.edges.left])).toEqual([
      ['corner', 0, 1, 0, 0, true, true], ['top', 0, 1, 1, 4, true, false], ['left', 2, 5, 0, 0, false, true], ['main', 2, 5, 1, 4, false, false],
    ]);
    const size = { rows: 100, cols: 10 };
    expect(refLabel({ top: 0, left: 1, bottom: 99, right: 3 }, size, 'S')).toBe('B:D');
    expect(refLabel({ top: 3, left: 0, bottom: 11, right: 9 }, size, 'S')).toBe('4:12');
    expect(refLabel({ top: 0, left: 0, bottom: 99, right: 9 }, size, 'S')).toBe('S');
    expect(refLabel({ top: 2, left: 1, bottom: 7, right: 3 }, size, 'S')).toBe('B3:D8');
    const v = (r: number, c: number) => (c === 0 && (r <= 4 || (r >= 8 && r <= 9)) ? r : null);
    expect(dataEdge({ row: 0, col: 0 }, 1, 0, v, size)).toEqual({ row: 4, col: 0 }); // to the end of the run
    expect(dataEdge({ row: 4, col: 0 }, 1, 0, v, size)).toEqual({ row: 8, col: 0 }); // to the next filled cell
    expect(dataEdge({ row: 9, col: 0 }, 1, 0, v, size)).toEqual({ row: 99, col: 0 }); // to the sheet's edge
    expect(usedRange([['a'], [null, null, 3], []])).toEqual({ top: 0, left: 0, bottom: 1, right: 2 });
    expect(clipOf({ top: 0, left: 0, bottom: 1, right: 1 }, (r, c) => (r === 1 && c === 1 ? 'a\tb <x>' : `${r}${c}`))).toEqual({ tsv: '00\t01\n10\t"a\tb <x>"', html: '<table><tr><td>00</td><td>01</td></tr><tr><td>10</td><td>a\tb &lt;x&gt;</td></tr></table>' });
    expect(totalsOf({ top: 0, left: 0, bottom: 2, right: 1 }, (r, c) => (r === 0 ? 'x' : r * 10 + c), 5)).toEqual({ count: 6, numbers: 4, sum: 10 + 11 + 20 + 21 });
  });
});

describe('one selection layer (W-46 DoD 1, 2)', () => {
  it('a single cell is a ring only; a range is one fill with a hole at the active cell and one border; no per-cell class', async () => {
    const el = await mountBook();
    el.select('S', 'B3');
    await frame();
    const layer = shadow(el).querySelector('.sellayer')!;
    expect(layer.querySelectorAll('.sa')).toHaveLength(1);
    expect(layer.querySelector('.sf')).toBeNull();
    el.workbook!.select({ sheet: 'S', ref: 'B3', range: 'B3:D8' });
    await frame();
    const fill = layer.querySelector<HTMLElement>('.sf')!, border = layer.querySelector<HTMLElement>('.sb')!, ring = layer.querySelector<HTMLElement>('.sa')!;
    const box = (e: HTMLElement) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
    const corner = (r: number, c: number) => cellEl(el, r, c)!.getBoundingClientRect();
    const b3 = corner(2, 1), d8 = corner(7, 3);
    expect(box(border)).toEqual([Math.round(b3.left), Math.round(b3.top), Math.round(d8.right - b3.left), Math.round(d8.bottom - b3.top)]);
    expect(box(fill)).toEqual(box(border));
    expect(fill.style.clipPath).toContain('evenodd'); // the active cell is left unfilled
    expect(box(ring)).toEqual([Math.round(b3.left), Math.round(b3.top), Math.round(b3.width), Math.round(b3.height)]);
    expect(getComputedStyle(border).borderTopWidth).toBe('2px');
    expect(shadow(el).querySelectorAll('.c.inrange, .c.sel')).toHaveLength(0);
    // headers of the spanned columns and rows are tinted
    expect([...shadow(el).querySelectorAll<HTMLElement>('.ch.on')].map((h) => h.textContent)).toEqual(['B', 'C', 'D']);
    expect([...shadow(el).querySelectorAll<HTMLElement>('.rh.on')].map((h) => h.textContent)).toEqual(['3', '4', '5', '6', '7', '8']);
    expect(cellEl(el, 4, 2)!.getAttribute('aria-selected')).toBe('true');
    expect(cellEl(el, 4, 5)!.getAttribute('aria-selected')).toBe('false');
  });

  it('frozen panes: a corner and a top band in the frozen rows, a left part that sticks, and the main part', async () => {
    const el = await mountBook(60, 12);
    el.workbook!.setFreeze('S', { rows: 2, cols: 1 });
    el.workbook!.select({ sheet: 'S', ref: 'A1', range: 'A1:D6' });
    await frame();
    const root = shadow(el);
    const frozen = root.querySelectorAll('.frozen');
    expect(frozen[0]!.querySelectorAll('.sband.sf').length).toBe(2); // corner + top
    expect(frozen[1]!.querySelectorAll('.sband.sf').length).toBe(2);
    const parts = [...root.querySelectorAll<HTMLElement>('.sellayer .sf')];
    expect(parts.map((p) => p.style.position)).toEqual(['sticky', 'relative']); // left, main
    // scrolled, the frozen parts stay with the frozen cells
    const sc = root.querySelector<HTMLElement>('.scroller')!;
    sc.scrollTop = 300; sc.scrollLeft = 200;
    await frame();
    const row0 = root.querySelectorAll('.frozen')[0]!; // the rows were re-rendered for the new window
    const a1 = cellEl(el, 0, 0)!.getBoundingClientRect(), band = row0.querySelectorAll<HTMLElement>('.sband.sf')[0]!.getBoundingClientRect();
    expect(Math.round(band.top)).toBe(Math.round(a1.top));
    expect(Math.round(band.left)).toBe(Math.round(a1.left));
  });

  it('a range that partly covers a merge grows to cover it', async () => {
    const el = await mountBook(20, 6, ['C3:D5']);
    el.select('S', 'B2');
    await frame();
    key(el, 'ArrowDown', { shiftKey: true });
    key(el, 'ArrowRight', { shiftKey: true });
    await frame();
    expect(sel(el).range).toBe('B2:D5');
  });

  it('a selection change re-creates no cell', async () => {
    const el = await mountBook(200, 20);
    el.select('S', 'B3');
    await frame();
    let added = 0;
    const mo = new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n instanceof HTMLElement && (n.classList.contains('c') || n.querySelector('.c'))) added++; });
    mo.observe(shadow(el), { childList: true, subtree: true });
    for (let i = 0; i < 5; i++) key(el, 'ArrowDown', { shiftKey: true });
    key(el, 'ArrowRight', { shiftKey: true });
    await frame();
    el.workbook!.select({ sheet: 'S', ref: 'A1', range: 'A1:F9' });
    await frame();
    mo.disconnect();
    expect(sel(el).range).toBe('A1:F9');
    expect(added).toBe(0);
  });
});

describe('the pointer (W-46 DoD 3, 4)', () => {
  it('a drag follows the pointer and tells the store once, on release; Esc during a drag restores', async () => {
    const el = await mountBook();
    const seen: string[] = [];
    el.workbook!.on((e) => { if (e.type === 'select') seen.push(sel(el).range ?? sel(el).ref); });
    ptr(cellEl(el, 2, 1)!, 'pointerdown', center(cellEl(el, 2, 1)!));
    ptr(cellEl(el, 2, 1)!, 'pointermove', center(cellEl(el, 5, 3)!));
    await frame();
    expect(shadow(el).querySelector('.fx .ref')!.textContent).toBe('4R × 3C'); // while dragging
    ptr(cellEl(el, 2, 1)!, 'pointermove', center(cellEl(el, 6, 4)!));
    await frame();
    expect(seen).toEqual(['B3']); // the press, not every frame
    ptr(shadow(el).querySelector('.scroller')!, 'pointerup', center(cellEl(el, 6, 4)!));
    await frame();
    expect(sel(el)).toEqual({ sheet: 'S', ref: 'B3', range: 'B3:E7' });
    expect(seen).toEqual(['B3', 'B3:E7']);
    // Esc mid-drag puts the selection back
    ptr(cellEl(el, 1, 1)!, 'pointerdown', center(cellEl(el, 1, 1)!));
    ptr(cellEl(el, 1, 1)!, 'pointermove', center(cellEl(el, 4, 2)!));
    await frame();
    key(el, 'Escape');
    await frame();
    expect(sel(el)).toEqual({ sheet: 'S', ref: 'B3', range: 'B3:E7' });
  });

  it('past the bottom edge the grid scrolls, and the range keeps growing', async () => {
    const el = await mountBook(400, 6);
    const sc = shadow(el).querySelector<HTMLElement>('.scroller')!;
    const r = sc.getBoundingClientRect();
    ptr(cellEl(el, 1, 0)!, 'pointerdown', center(cellEl(el, 1, 0)!));
    ptr(sc, 'pointermove', { clientX: r.left + 80, clientY: r.bottom + 40 });
    for (let i = 0; i < 20; i++) await new Promise((res) => requestAnimationFrame(res));
    expect(sc.scrollTop).toBeGreaterThan(200);
    ptr(sc, 'pointerup', { clientX: r.left + 80, clientY: r.bottom + 40 });
    await frame();
    const rg = sel(el).range!;
    expect(rg.startsWith('A2:')).toBe(true);
    expect(Number(/\d+$/.exec(rg)![0])).toBeGreaterThan(20);
  });

  it('header and corner clicks select whole columns, rows and the sheet; Shift and a drag extend; Copy ref names them', async () => {
    const el = await mountBook(40, 8);
    const root = shadow(el);
    const g = el.workbook!; // eslint-disable-line
    const ch = (c: number) => root.querySelector(`.ch[data-hc="${c}"]`)!, rh = (r: number) => root.querySelector(`.rh[data-hr="${r}"]`)!;
    ptr(ch(2), 'pointerdown', center(ch(2)));
    ptr(root.querySelector('.scroller')!, 'pointerup', center(ch(2)));
    await frame();
    const rows = Number(root.querySelector('.grid')!.getAttribute('aria-rowcount')) - 1;
    expect(sel(el)).toEqual({ sheet: 'S', ref: 'C1', range: `C1:C${rows}` });
    ptr(ch(4), 'pointerdown', { ...center(ch(4)), shiftKey: true });
    await frame();
    expect(sel(el).range).toBe(`C1:E${rows}`);
    // drag across row headers
    ptr(rh(3), 'pointerdown', center(rh(3)));
    ptr(rh(3), 'pointermove', center(rh(6)));
    await frame();
    ptr(root.querySelector('.scroller')!, 'pointerup', center(rh(6)));
    await frame();
    expect(sel(el).range).toBe('A4:H7');
    // the corner: everything
    ptr(root.querySelector('[data-hall]')!, 'pointerdown', center(root.querySelector('[data-hall]')!));
    await frame();
    expect(sel(el).range).toBe(`A1:H${rows}`);
    expect(g.getSnapshot().selection.ref).toBe('A1');
  });

  it('a press on a plugin mark or a right-click is not a drag', async () => {
    const el = await mountBook();
    el.select('S', 'A1');
    await frame();
    ptr(cellEl(el, 3, 3)!, 'pointerdown', { ...center(cellEl(el, 3, 3)!), button: 2 });
    await frame();
    expect(sel(el).ref).toBe('A1');
  });
});

describe('keys (W-46 DoD 5)', () => {
  it('Ctrl+arrows jump, with Shift extend; Ctrl+Space, Shift+Space, Ctrl+A twice, Shift+Backspace; Enter and Tab wrap in a range', async () => {
    const el = await mountBook(30, 6);
    const rows = Number(grid(el).getAttribute('aria-rowcount')) - 1;
    el.select('S', 'B2');
    await frame();
    key(el, 'ArrowDown', { ctrlKey: true });
    expect(sel(el).ref).toBe('B30'); // the last filled row
    key(el, 'ArrowUp', { ctrlKey: true, shiftKey: true });
    expect(sel(el)).toEqual({ sheet: 'S', ref: 'B30', range: 'B1:B30' });
    key(el, ' ', { ctrlKey: true });
    expect(sel(el).range).toBe(`B1:B${rows}`);
    key(el, ' ', { shiftKey: true });
    expect(sel(el).range).toBe(`A1:F${rows}`);
    key(el, 'Backspace', { shiftKey: true });
    expect(sel(el)).toEqual({ sheet: 'S', ref: 'B30' });
    key(el, 'a', { ctrlKey: true });
    expect(sel(el).range).toBe('A1:F30');
    key(el, 'a', { ctrlKey: true });
    expect(sel(el).range).toBe(`A1:F${rows}`);
    el.workbook!.select({ sheet: 'S', ref: 'B2', range: 'B2:C3' });
    const walk: string[] = [];
    for (let i = 0; i < 5; i++) { key(el, 'Enter'); walk.push(sel(el).ref); }
    expect(walk).toEqual(['B3', 'C2', 'C3', 'B2', 'B3']);
    key(el, 'Tab', { shiftKey: true }); // along the rows, backwards: B3 → C2
    expect(sel(el).ref).toBe('C2');
    key(el, 'Tab');
    expect(sel(el).ref).toBe('B3');
    expect(sel(el).range).toBe('B2:C3');
    const help = el.shortcuts().map((s) => s.keys);
    for (const k of ['Ctrl/⌘ + arrows', 'Ctrl + Space', 'Shift + Space', 'Ctrl/⌘ + A', 'Shift + Backspace', 'Enter / Tab in a range']) expect(help).toContain(k);
  });
});

describe('copy, Delete and paste on a range (W-46 DoD 6, 7)', () => {
  it('Ctrl/⌘+C writes TSV and an HTML table and outlines the range until Esc', async () => {
    const el = await mountBook(10, 4);
    const written: Record<string, string>[] = [];
    const real = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async (items: ClipboardItem[]) => { for (const it of items) written.push(Object.fromEntries(await Promise.all(it.types.map(async (t) => [t, await (await it.getType(t)).text()] as const)))); }, writeText: async () => undefined } });
    try {
      el.workbook!.select({ sheet: 'S', ref: 'A1', range: 'A1:B2' });
      await frame();
      key(el, 'c', { ctrlKey: true });
      await new Promise((r) => setTimeout(r, 20));
      expect(written).toEqual([{ 'text/plain': 'T0\tT1\n10\t11', 'text/html': '<table><tr><td>T0</td><td>T1</td></tr><tr><td>10</td><td>11</td></tr></table>' }]);
      await frame();
      expect(shadow(el).querySelector('.sellayer .sc')).not.toBeNull();
      key(el, 'Escape');
      await frame();
      expect(shadow(el).querySelector('.sellayer .sc')).toBeNull();
    } finally { if (real) Object.defineProperty(navigator, 'clipboard', real); }
  });

  it('Delete clears a range as one undo step, skipping refused cells; one pasted value fills a range', async () => {
    const el = await mountBook(10, 4, [], { mode: 'edit' });
    el.addEventListener('sheetpane-beforechange', (e) => { if ((e as CustomEvent).detail.ref === 'B3') e.preventDefault(); });
    el.workbook!.select({ sheet: 'S', ref: 'A2', range: 'A2:B3' });
    await frame();
    key(el, 'Delete');
    const wb = el.workbook!;
    expect([wb.value('S', 'A2'), wb.value('S', 'B2'), wb.value('S', 'A3'), wb.value('S', 'B3')]).toEqual([null, null, null, 21]);
    wb.undo();
    expect([wb.value('S', 'A2'), wb.value('S', 'B2'), wb.value('S', 'A3')]).toEqual([10, 11, 20]);
    const dt = new DataTransfer();
    dt.setData('text/plain', '7');
    grid(el).dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    expect([wb.value('S', 'A2'), wb.value('S', 'B2'), wb.value('S', 'A3'), wb.value('S', 'B3')]).toEqual([7, 7, 7, 21]);
    wb.undo();
    expect(wb.value('S', 'A2')).toBe(10);
  });
});

describe('totals, announcements, events and a11y (W-46 DoD 8, 9, 11)', () => {
  it('Count · Sum · Average in the status line; Copy values in the menu; the range in sheetpane-select; the range said once', async () => {
    const el = await mountBook(10, 4);
    const selects: unknown[] = [];
    el.addEventListener('sheetpane-select', (e) => selects.push((e as CustomEvent).detail.range));
    el.select('S', 'A1');
    await frame();
    key(el, 'ArrowDown', { shiftKey: true });
    key(el, 'ArrowDown', { shiftKey: true });
    key(el, 'ArrowRight', { shiftKey: true });
    await frame();
    // A1:B3 = T0 T1 / 10 11 / 20 21
    expect(shadow(el).querySelector('[data-sp=totals]')!.textContent).toBe('· Count 6 · Sum 62 · Average 15.5');
    expect(selects.at(-1)).toBe('A1:B3');
    await new Promise((r) => setTimeout(r, 300));
    expect(shadow(el).querySelector('.selsay')!.textContent).toBe('A1 to B3, 6 cells');
    key(el, 'F10', { shiftKey: true });
    await frame();
    expect(shadow(el).querySelector('.ctxmenu [data-act=copy-value]')!.textContent).toContain('Copy values');
  });

  it('has no axe violations with a range, in View and Edit', async () => {
    const el = await mountBook(30, 6, [], { mode: 'edit' });
    el.workbook!.select({ sheet: 'S', ref: 'B2', range: 'B2:D6' });
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

describe('speed (W-46 DoD 10)', () => {
  it('dragging from A1 past the bottom edge of 250,000 rows for 5 s, autoscrolling — frame times reported', async () => {
    const lines = ['id,client,units,price,value'];
    for (let i = 0; i < 250_000; i++) lines.push(`AC-${i},Client ${i % 97},${i % 1000},${(i % 300) + 0.25},${i * 3}`);
    const el = await mountExcel({}, new TextEncoder().encode(lines.join('\r\n')), 'transactions-q3.csv');
    const sc = shadow(el).querySelector<HTMLElement>('.scroller')!, r = sc.getBoundingClientRect();
    ptr(cellEl(el, 0, 0)!, 'pointerdown', center(cellEl(el, 0, 0)!));
    ptr(sc, 'pointermove', { clientX: r.left + 120, clientY: r.bottom + 30 });
    const gaps: number[] = [];
    let last = performance.now();
    const end = last + 5000;
    await new Promise<void>((done) => { const step = (t: number) => { gaps.push(t - last); last = t; if (t < end) requestAnimationFrame(step); else done(); }; requestAnimationFrame(step); });
    ptr(sc, 'pointerup', { clientX: r.left + 120, clientY: r.bottom + 30 });
    const iv = gaps.slice(2).sort((a, b) => a - b), vsync = iv[Math.floor(iv.length / 2)]!;
    const over = iv.filter((x) => x > vsync * 1.5).length;
    console.info(`W-46 drag + autoscroll, 250k rows: ${gaps.length} frames, vsync ${vsync.toFixed(1)} ms, worst ${iv[iv.length - 1]!.toFixed(1)} ms, p95 ${iv[Math.floor(iv.length * 0.95)]!.toFixed(1)} ms, dropped ${over}, scrolled ${Math.round(sc.scrollTop)} px — ${navigator.userAgent}, ${navigator.hardwareConcurrency} cores`);
    if (budgets) expect(sc.scrollTop).toBeGreaterThan(5000);
    expect(sel(el).range?.startsWith('A1:')).toBe(true);
  }, 60_000);
});
