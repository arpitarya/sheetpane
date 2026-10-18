// W-47: resizing columns and rows — drag a header edge, double-click to fit, several at once, the
// header menu by keyboard, per-row heights from the file, and sizes as a view setting.
import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { inflateEntry, readZip, toXlsx, writeZip } from '@sheetpane/export';
import type { ImportedSheet } from '@sheetpane/import';
import { registerPlugin, type Plugin, type SheetpaneExcel } from '../src/index.js';
import { ROW_H, rowAt, sheetGeometry } from '../src/excel/geometry.js';
import { cellEl, cleanup, frame, mountExcel, shadow } from './helpers.js';

afterEach(cleanup);

const ptr = (target: Element, type: string, o: PointerEventInit = {}) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, cancelable: true, pointerId: 9, pointerType: 'mouse', button: 0, buttons: 1, ...o }));
const sc = (el: Element) => shadow(el).querySelector<HTMLElement>('.scroller')!;
const colEdge = (el: Element, c: number) => shadow(el).querySelector<HTMLElement>(`.ch .rze[data-rz-c="${c}"]`)!;
const rowEdge = (el: Element, r: number) => shadow(el).querySelector<HTMLElement>(`.rh .rze[data-rz-r="${r}"]`)!;
const head = (el: Element, c: number) => shadow(el).querySelector<HTMLElement>(`.ch[data-hc="${c}"]`)!;
const width = (el: Element, c: number) => Math.round(head(el, c).getBoundingClientRect().width);
const key = (el: Element, k: string, o: KeyboardEventInit = {}) => shadow(el).querySelector('.grid')!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...o }));
const mid = (e: Element) => { const r = e.getBoundingClientRect(); return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }; };

/** Drags an edge by dx / dy and releases; returns the resize events. */
async function dragEdge(el: SheetpaneExcel, edge: Element, dx: number, dy: number, release = true): Promise<CustomEvent[]> {
  const seen: CustomEvent[] = [];
  el.addEventListener('sheetpane-resize', (e) => seen.push(e as CustomEvent));
  const p = mid(edge);
  ptr(edge, 'pointerdown', p);
  ptr(sc(el), 'pointermove', { clientX: p.clientX + dx / 2, clientY: p.clientY + dy / 2 });
  await frame();
  ptr(sc(el), 'pointermove', { clientX: p.clientX + dx, clientY: p.clientY + dy });
  await frame();
  if (release) { ptr(sc(el), 'pointerup', { clientX: p.clientX + dx, clientY: p.clientY + dy }); await frame(); }
  return seen;
}

async function mountBook(rows: (string | number)[][], o: { merges?: string[]; attrs?: Record<string, string> } = {}): Promise<SheetpaneExcel> {
  return mountExcel(o.attrs ?? {}, await toXlsx({ sheets: [{ name: 'S', rows, merges: o.merges ?? [] }] }), 'book.xlsx');
}
const grid = (r: number, c: number) => Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => (i === 0 ? `T${j}` : i * 10 + j)));

describe('geometry (W-47 DoD 5)', () => {
  it('rowAt is a binary search over mixed heights: it agrees with a linear scan', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 12, max: 600 }), { minLength: 1, maxLength: 60 }), fc.double({ min: 0, max: 1, noNaN: true }), (heights, f) => {
      const sh = { rows: heights.map(() => ['x']), text: heights.map(() => ['x']), rowHeights: [], merges: [], path: 'x', styleIndex: {} } as unknown as ImportedSheet;
      const g = sheetGeometry(sh, [], { rows: Object.fromEntries(heights.map((h, i) => [i, h])) });
      const y = f * g.rowY[g.rows]!;
      let linear = 0;
      while (linear < g.rows - 1 && g.rowY[linear + 1]! <= y) linear++;
      expect(rowAt(g, y)).toBe(linear);
    }));
  });
  it('the file’s custom row heights are drawn (points × 96 / 72); the user’s win', () => {
    const sh = { rows: [['a'], ['b'], ['c']], text: [['a'], ['b'], ['c']], rowHeights: [undefined, 30], merges: [], path: 'x', styleIndex: {} } as unknown as ImportedSheet;
    const g = sheetGeometry(sh);
    expect([g.rowY[1], g.rowY[2]! - g.rowY[1]!, g.rowY[3]! - g.rowY[2]!]).toEqual([ROW_H, 40, ROW_H]);
    expect(sheetGeometry(sh, [], { rows: { 1: 90 } }).rowY[2]! - ROW_H).toBe(90);
  });
});

describe('dragging a header edge (W-47 DoD 1, 6)', () => {
  it('the size follows live, with a guide and a tip; release fires sheetpane-resize and says it; sizes round-trip', async () => {
    const el = await mountBook(grid(10, 5));
    const w0 = width(el, 1);
    const seen = await dragEdge(el, colEdge(el, 1), 60, 0, false);
    expect(width(el, 1)).toBe(w0 + 60);
    expect(shadow(el).querySelector('.rzguide')).not.toBeNull();
    expect(shadow(el).querySelector('.rztip')!.textContent).toBe(`Width ${w0 + 60} px`);
    expect(seen).toEqual([]); // not during the drag
    ptr(sc(el), 'pointerup', {});
    await frame();
    expect(seen.map((e) => e.detail)).toEqual([{ sheet: 'S', axis: 'col', indexes: [1], px: w0 + 60, via: 'drag' }]);
    expect(shadow(el).querySelector('.selsay')!.textContent).toBe(`Column B, ${w0 + 60} pixels`);
    expect(el.sizes).toEqual({ S: { cols: { B: w0 + 60 }, rows: {} } });
    expect(shadow(el).querySelector('.rzguide')).toBeNull();
    // a host restores what it saved
    el.sizes = { S: { cols: { C: 200 }, rows: { 3: 50 } } };
    await frame();
    expect(width(el, 2)).toBe(200);
    expect(width(el, 1)).toBe(w0);
    expect(Math.round(cellEl(el, 2, 0)!.getBoundingClientRect().height)).toBe(50);
  });

  it('Esc cancels; the limits hold; a click on the edge changes nothing and selects nothing', async () => {
    const el = await mountBook(grid(10, 5));
    const w0 = width(el, 1), before = el.workbook!.getSnapshot().selection;
    await dragEdge(el, colEdge(el, 1), 80, 0, false);
    key(el, 'Escape');
    await frame();
    expect(width(el, 1)).toBe(w0);
    await dragEdge(el, colEdge(el, 1), -2000, 0);
    expect(width(el, 1)).toBe(16);
    await dragEdge(el, rowEdge(el, 2), 0, 5000);
    expect(Math.round(cellEl(el, 2, 0)!.getBoundingClientRect().height)).toBe(600);
    const seen = await dragEdge(el, colEdge(el, 3), 1, 0);
    expect(seen).toEqual([]);
    expect(el.workbook!.getSnapshot().selection).toEqual(before);
  });

  it('a resize is not a change: nothing to undo, and the download is the file as opened', async () => {
    const el = await mountBook(grid(10, 5));
    await dragEdge(el, colEdge(el, 0), 90, 0);
    const wb = el.workbook!;
    expect(wb.changeCount).toBe(0);
    expect(wb.getSnapshot().canUndo).toBe(false);
    let original: unknown;
    el.addEventListener('sheetpane-export', (e) => { original = (e as CustomEvent).detail.original; e.preventDefault(); });
    shadow(el).querySelector<HTMLElement>('[data-sp=download]')!.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(original).toBe(true);
    // a new file resets the sizes
    await el.load(await toXlsx({ sheets: [{ name: 'S', rows: grid(4, 3) }] }), 'other.xlsx');
    expect(el.sizes).toEqual({});
  });

  it('overlays follow: a plugin sees the new row tops through Geometry', async () => {
    const el = await mountBook(grid(10, 5));
    await dragEdge(el, rowEdge(el, 1), 0, 40);
    const g = el.geometryFor('S')!;
    expect(g.rowHeight(1)).toBe(ROW_H + 40);
    expect(g.rowY(3)).toBe(ROW_H * 3 + 40);
  });
});

describe('fit to data (W-47 DoD 2)', () => {
  it('double-click fits long text, numbers and bold; merged cells are ignored; a row fits its wrapped text', async () => {
    const bold: Plugin = { id: 'fit-bold', provides: ['decorate'], decorate: (c) => (c.ref === 'C2' ? { 'font-weight': '700' } : undefined) };
    registerPlugin('fit-bold', () => bold);
    const rows: (string | number)[][] = [['a', 'b', 'c', 'd', 'merged'], ['A rather long piece of text in one cell', 123456789.125, 'Bold text here', 'Bold text here', ''], ['x', 1, 'y', 'z', ''], ['line one\nline two\nline three', 2, '', '', '']];
    const el = await mountBook(rows, { merges: ['E2:F2'], attrs: { plugins: 'fit-bold' } });
    el.workbook!.setCell('S', 'E2', 'a very very very long text inside a merge that must not widen E');
    await frame();
    for (const c of [0, 1, 2, 3, 4]) { colEdge(el, c).dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true })); await frame(); }
    const [a, b, cBold, dPlain, e] = [0, 1, 2, 3, 4].map((c) => width(el, c)) as [number, number, number, number, number];
    expect(a).toBeGreaterThan(200);
    expect(b).toBeGreaterThan(64);
    expect(cBold).toBeGreaterThan(dPlain); // the same text, bold, is wider
    expect(e).toBe(64); // the merge is ignored: the default width stays the floor
    expect(a).toBeLessThanOrEqual(480);
    rowEdge(el, 3).dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
    await frame();
    expect(Math.round(cellEl(el, 3, 0)!.getBoundingClientRect().height)).toBeGreaterThan(ROW_H * 1.5);
  });
});

describe('several at once, and the header menu by keyboard (W-47 DoD 3, 4, 8)', () => {
  it('a drag on one selected column sizes them all; Shift+F10 opens the menu; Column width… applies to every one; Reset goes back', async () => {
    const el = await mountBook(grid(10, 6));
    const w0 = width(el, 1);
    ptr(head(el, 1), 'pointerdown', mid(head(el, 1)));
    ptr(sc(el), 'pointerup', {});
    ptr(head(el, 3), 'pointerdown', { ...mid(head(el, 3)), shiftKey: true });
    await frame();
    const seen = await dragEdge(el, colEdge(el, 2), 30, 0);
    expect([width(el, 1), width(el, 2), width(el, 3)]).toEqual([w0 + 30, w0 + 30, w0 + 30]);
    expect(seen[0]!.detail.indexes).toEqual([1, 2, 3]);
    // the menu, by keyboard
    key(el, 'F10', { shiftKey: true });
    await frame();
    const menu = shadow(el).querySelector('[data-sp=header-menu]')!;
    expect([...menu.querySelectorAll('[role=menuitem]')].map((b) => b.textContent)).toEqual(['Fit to data', 'Column width…', 'Reset to the file’s size']);
    menu.querySelector<HTMLElement>('[data-act=hsize]')!.click();
    await frame();
    const field = shadow(el).querySelector<HTMLInputElement>('.szpop input')!;
    expect(field.getAttribute('aria-label')).toBe('Column width in pixels');
    field.value = '100';
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true, composed: true, cancelable: true }));
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, cancelable: true }));
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }));
    await frame();
    expect([width(el, 1), width(el, 2), width(el, 3)]).toEqual([109, 109, 109]);
    expect(seen.at(-1)!.detail).toMatchObject({ axis: 'col', indexes: [1, 2, 3], via: 'menu' });
    key(el, 'F10', { shiftKey: true });
    await frame();
    shadow(el).querySelector<HTMLElement>('[data-act=hreset]')!.click();
    await frame();
    expect([width(el, 1), width(el, 2), width(el, 3)]).toEqual([w0, w0, w0]);
    expect(el.sizes).toEqual({});
    const help = el.shortcuts().map((s) => s.keys);
    expect(help).toContain('Shift + F10 on a whole column or row');
  });

  it('right-click on a row header opens its size menu', async () => {
    const el = await mountBook(grid(10, 4));
    const rh = shadow(el).querySelector('.rh[data-hr="4"]')!;
    rh.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true }));
    await frame();
    expect(el.workbook!.getSnapshot().selection.range).toBe('A5:D5'.replace('D5', `${String.fromCharCode(64 + Number(shadow(el).querySelector('.grid')!.getAttribute('aria-colcount')) - 1)}5`));
    expect([...shadow(el).querySelectorAll('[data-sp=header-menu] [role=menuitem]')].map((b) => b.textContent)).toContain('Row height…');
  });
});

describe('rows from the file (W-47 DoD 5)', () => {
  it('a row the file gave a custom height is drawn that tall', async () => {
    const bytes = await toXlsx({ sheets: [{ name: 'S', rows: grid(6, 3) }] });
    const entries = readZip(bytes);
    const files = await Promise.all(entries.map(async (e) => ({ name: e.name, data: await inflateEntry(bytes, e) })));
    const sheet = files.find((f) => f.name === 'xl/worksheets/sheet1.xml')!;
    sheet.data = new TextEncoder().encode(new TextDecoder().decode(sheet.data).replace(/<row r="3"([^>]*)>/, '<row r="3"$1 ht="45" customHeight="1">'));
    const el = await mountExcel({}, await writeZip(files), 'tall.xlsx');
    expect(Math.round(cellEl(el, 2, 0)!.getBoundingClientRect().height)).toBe(60);
    expect(Math.round(cellEl(el, 3, 0)!.getBoundingClientRect().top - cellEl(el, 2, 0)!.getBoundingClientRect().top)).toBe(60);
  });
});

describe('speed (W-47 DoD 7)', () => {
  it('a column-edge drag on 250,000 rows — frame times reported', async () => {
    const lines = ['id,client,units,price,value'];
    for (let i = 0; i < 250_000; i++) lines.push(`AC-${i},Client ${i % 97},${i % 1000},${(i % 300) + 0.25},${i * 3}`);
    const el = await mountExcel({}, new TextEncoder().encode(lines.join('\r\n')), 'transactions-q3.csv');
    const edge = colEdge(el, 1), p = mid(edge);
    ptr(edge, 'pointerdown', p);
    const gaps: number[] = [];
    let last = performance.now(), i = 0;
    const end = last + 3000;
    await new Promise<void>((done) => { const step = (t: number) => { gaps.push(t - last); last = t; ptr(sc(el), 'pointermove', { clientX: p.clientX + 10 + (i++ % 120), clientY: p.clientY }); if (t < end) requestAnimationFrame(step); else done(); }; requestAnimationFrame(step); });
    ptr(sc(el), 'pointerup', {});
    const iv = gaps.slice(2).sort((a, b) => a - b), vsync = iv[Math.floor(iv.length / 2)]!;
    const report = `W-47 column drag, 250k rows: ${gaps.length} frames, vsync ${vsync.toFixed(1)} ms, worst ${iv[iv.length - 1]!.toFixed(1)} ms, p95 ${iv[Math.floor(iv.length * 0.95)]!.toFixed(1)} ms, dropped ${iv.filter((x) => x > vsync * 1.5).length} — ${navigator.hardwareConcurrency} cores`;
    console.info(report);
    expect(el.sizes['transactions-q3']!.cols.B!).toBeGreaterThan(64);
  }, 60_000);
});
