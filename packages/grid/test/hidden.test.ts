// W-49 (core): the file's hidden rows, columns and sheets are honoured, marked and revealable for
// viewing; keys and range acts skip them; find and errors still see them. No plugin here — the
// plugin's Hide / Unhide are tested in @sheetpane/visibility.
import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import axe from 'axe-core';
import { inflateEntry, patchXlsx, readZip, toXlsx, writeZip } from '@sheetpane/export';
import type { ImportedSheet } from '@sheetpane/import';
import type { SheetpaneExcel } from '../src/index.js';
import { rowAt, sheetGeometry } from '../src/excel/geometry.js';
import { budgets, cellEl, cleanup, frame, mountExcel, shadow } from './helpers.js';

afterEach(cleanup);

const grid = (r: number, c: number) => Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => (i === 0 ? `T${j}` : i * 10 + j)));
const key = (el: Element, k: string, o: KeyboardEventInit = {}) => shadow(el).querySelector('.grid')!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true, ...o }));
const sel = (el: SheetpaneExcel) => el.workbook!.getSnapshot().selection;

/** Three sheets: S (rows 3–5 and column C hidden), Secret (hidden), Vault (very hidden). */
async function hiddenBook(activeTab?: number): Promise<Uint8Array> {
  const bytes = await toXlsx({ sheets: [{ name: 'S', rows: grid(12, 5) }, { name: 'Secret', rows: grid(4, 2) }, { name: 'Vault', rows: grid(3, 2) }] });
  const out = await patchXlsx(bytes, [], { hidden: [{ sheet: 'S', rows: [2, 3, 4], cols: [2] }, { sheet: 'Secret', state: 'hidden' }, { sheet: 'Vault', state: 'veryHidden' }] });
  if (activeTab === undefined) return out;
  // a file saved with its active tab on a hidden sheet (patchXlsx never writes one)
  const files = await Promise.all(readZip(out).map(async (e) => ({ name: e.name, data: await inflateEntry(out, e) })));
  const wb = files.find((f) => f.name === 'xl/workbook.xml')!;
  wb.data = new TextEncoder().encode(new TextDecoder().decode(wb.data).replace(/activeTab="\d+"/, `activeTab="${activeTab}"`));
  return writeZip(files);
}

describe('geometry with hidden rows (W-49 DoD 3)', () => {
  it('rowAt never lands on a hidden row: a fast-check property against a linear scan', () => {
    fc.assert(fc.property(fc.array(fc.boolean(), { minLength: 2, maxLength: 80 }), fc.double({ min: 0, max: 0.999, noNaN: true }), (hide, f) => {
      if (hide.every(Boolean)) return;
      const sh = { rows: hide.map(() => ['x']), text: hide.map(() => ['x']), rowHeights: [], merges: [], path: 'x', styleIndex: {} } as unknown as ImportedSheet;
      const g = sheetGeometry(sh, [], {}, { rows: new Set(hide.flatMap((h, i) => (h ? [i] : []))) });
      const y = f * g.rowY[g.rows]!;
      let linear = 0;
      while (linear < g.rows - 1 && g.rowY[linear + 1]! <= y) linear++;
      expect(rowAt(g, y)).toBe(linear);
      if (g.rowY[g.rows]! > 0 && linear < hide.length) expect(hide[linear]).not.toBe(true);
    }));
  });
});

describe('honoured and marked (W-49 DoD 3, 4, 12)', () => {
  it('hidden rows and columns are not drawn; markers name the span; indexes stay true; the status line counts them', async () => {
    const el = await mountExcel({}, await hiddenBook(), 'h.xlsx');
    const root = shadow(el);
    expect(cellEl(el, 3, 0)).toBeNull();
    expect(cellEl(el, 1, 2)).toBeNull();
    expect(cellEl(el, 5, 3)).not.toBeNull();
    expect(cellEl(el, 5, 0)!.closest('[role=row]')!.getAttribute('aria-rowindex')).toBe('7'); // row 6 is still row 6
    expect(root.querySelector('.grid')!.getAttribute('aria-rowcount')).toBe(String(Number(root.querySelector('.grid')!.getAttribute('aria-rowcount'))));
    const col = root.querySelector<HTMLElement>('.hmk[data-hid="cols:2-2"]')!, rows = root.querySelector<HTMLElement>('.hmk[data-hid="rows:2-4"]')!;
    expect(col.getAttribute('aria-label')).toBe('Column C hidden — click to show');
    expect(rows.getAttribute('aria-label')).toBe('Rows 3–5 hidden (3) — click to show');
    expect(root.querySelectorAll('.hline').length).toBe(2);
    expect(root.querySelector('.status')!.textContent).toContain('1 column, 3 rows hidden · Show hidden');
  });

  it('a marker reveals for viewing (hatched, not a change); Show hidden toggles everything; sheetpane-visibility says so', async () => {
    const el = await mountExcel({}, await hiddenBook(), 'h.xlsx');
    const seen: unknown[] = [];
    el.addEventListener('sheetpane-visibility', (e) => seen.push((e as CustomEvent).detail));
    shadow(el).querySelector<HTMLElement>('.hmk[data-hid="rows:2-4"]')!.click();
    await frame();
    expect(cellEl(el, 3, 0)!.classList.contains('rev')).toBe(true);
    expect(el.workbook!.changeCount).toBe(0);
    expect(seen).toEqual([{ sheet: 'S', axis: 'row', indexes: [2, 3, 4], hidden: false, via: 'reveal' }]);
    expect(shadow(el).querySelector('.selsay')!.textContent).toBe('Rows 3 to 5 shown');
    shadow(el).querySelector<HTMLElement>('[data-act=show-hidden]')!.click();
    await frame();
    expect(cellEl(el, 1, 2)).not.toBeNull();
    expect(shadow(el).querySelector('[data-act=show-hidden]')!.textContent).toBe('Hide them again');
    shadow(el).querySelector<HTMLElement>('[data-act=show-hidden]')!.click();
    await frame();
    expect(cellEl(el, 3, 0)).toBeNull();
  });
});

describe('keys and range acts skip hidden cells (W-49 DoD 7)', () => {
  it('arrows step over hidden rows and columns; copy, Delete and totals leave hidden cells out and say so', async () => {
    const el = await mountExcel({ mode: 'edit' }, await hiddenBook(), 'h.xlsx');
    el.select('S', 'A2');
    await frame();
    key(el, 'ArrowDown');
    expect(sel(el).ref).toBe('A6');
    key(el, 'ArrowUp');
    expect(sel(el).ref).toBe('A2');
    el.select('S', 'B2');
    key(el, 'ArrowRight');
    expect(sel(el).ref).toBe('D2');
    // totals over A2:D7 = rows 2, 6, 7 × columns A, B, D
    el.workbook!.select({ sheet: 'S', ref: 'A2', range: 'A2:D7' });
    await frame();
    const t = shadow(el).querySelector('[data-sp=totals]')!.textContent!;
    expect(t).toContain('Count 9');
    expect(t).toContain('(15 hidden cells left out)');
    const written: string[] = [];
    const real = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async (items: ClipboardItem[]) => { written.push(await (await items[0]!.getType('text/plain')).text()); }, writeText: async () => undefined } });
    try {
      key(el, 'c', { ctrlKey: true });
      await new Promise((r) => setTimeout(r, 20));
      expect(written[0]).toBe('10\t11\t13\n50\t51\t53\n60\t61\t63');
    } finally { if (real) Object.defineProperty(navigator, 'clipboard', real); }
    key(el, 'Delete');
    const wb = el.workbook!;
    expect([wb.value('S', 'A2'), wb.value('S', 'A4'), wb.value('S', 'C2')]).toEqual([null, 30, 12]); // hidden cells kept
  });
});

describe('hidden sheets (W-49 DoD 6)', () => {
  it('not tabs: a ⊘ button lists them (very hidden tagged); opening one shows a dashed tab and a banner; Hide again', async () => {
    const el = await mountExcel({}, await hiddenBook(), 'h.xlsx');
    const root = shadow(el);
    expect([...root.querySelectorAll<HTMLElement>('.tab[data-sheet]')].map((t) => t.dataset.sheet)).toEqual(['S']);
    const btn = root.querySelector<HTMLElement>('[data-act=hidden-sheets]')!;
    expect(btn.textContent).toContain('⊘ 2 hidden');
    btn.click();
    await frame();
    const items = [...root.querySelectorAll<HTMLElement>('.hidmenu [role=menuitem]')];
    expect(items.map((i) => i.dataset.openSheet)).toEqual(['Secret', 'Vault']);
    expect(items[1]!.textContent).toContain('very hidden');
    items[0]!.click();
    await frame();
    expect(sel(el).sheet).toBe('Secret');
    expect(root.querySelector('.tab.hid')!.textContent).toContain('Secret');
    expect(root.querySelector('.hidbar')!.textContent).toContain('This sheet is hidden in the file');
    root.querySelector<HTMLElement>('[data-act=hide-sheet-again]')!.click();
    await frame();
    expect(sel(el).sheet).toBe('S');
    expect(root.querySelector('.tab.hid')).toBeNull();
  });

  it('a file whose active sheet is hidden opens on the first visible one', async () => {
    const el = await mountExcel({}, await hiddenBook(1), 'h.xlsx');
    await frame();
    expect(sel(el).sheet).toBe('S');
  });
});

describe('nothing hides an error (W-49 DoD 5, 11)', () => {
  it('selecting an error in a hidden row shows it with a note; the errors panel tags it; find counts hidden hits', async () => {
    const el = await mountExcel({ mode: 'edit', pane: 'h' }, await hiddenBook(), 'h.xlsx');
    const errs = document.createElement('sheetpane-errors');
    errs.setAttribute('pane', 'h');
    document.body.append(errs);
    const wb = el.workbook!;
    wb.addError({ sheet: 'S', range: 'A4', type: 'other', severity: 'error', expected: '1' });
    await frame();
    expect(errs.shadowRoot!.querySelector('[data-sp-error]')!.textContent).toContain('hidden row');
    expect(shadow(el).querySelector<HTMLElement>('.hmk[data-hid="rows:2-4"]')!.getAttribute('aria-label')).toContain('1 open error inside');
    wb.select({ sheet: 'S', ref: 'A4' });
    await frame();
    expect(cellEl(el, 3, 0)).not.toBeNull();
    expect(shadow(el).querySelector('.hidbar')!.textContent).toContain('Shown for ERR-');
    shadow(el).querySelector<HTMLElement>('[data-act=hide-again]')!.click();
    await frame();
    expect(cellEl(el, 3, 0)).toBeNull();
    const find = shadow(el).querySelector<HTMLInputElement>('.findin')!;
    find.value = '3';
    find.dispatchEvent(new Event('input'));
    await frame();
    expect(shadow(el).querySelector('.find .cnt')!.textContent).toMatch(/in hidden cells\)$/);
  });

  it('has no axe violations with hidden parts, in View and Edit', async () => {
    const el = await mountExcel({ mode: 'edit' }, await hiddenBook(), 'h.xlsx');
    const rules = { 'scrollable-region-focusable': { enabled: true } };
    let r = await axe.run(el, { rules });
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    el.setAttribute('mode', 'view');
    await frame();
    r = await axe.run(el, { rules });
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
});

describe('store (W-49 DoD 2)', () => {
  it('setHidden is one change per sheet and axis, undoable, and the download carries it', async () => {
    const el = await mountExcel({ mode: 'edit' }, await hiddenBook(), 'h.xlsx');
    const wb = el.workbook!;
    wb.setHidden('S', 'rows', [7, 8], true);
    wb.setHidden('S', 'rows', [9], true);
    wb.setHidden('S', 'rows', [3], false);
    expect(wb.hidden('S').rows).toEqual([2, 4, 7, 8, 9]);
    expect(wb.changeCount).toBe(1);
    expect(wb.setSheetState('S', 'hidden')).toBe(false); // the last visible sheet stays
    const { blob } = await wb.exportFile();
    const { read } = await import('@sheetpane/import');
    const back = await read(new Uint8Array(await blob.arrayBuffer()), { name: 'h.xlsx' });
    expect(back.sheets[0]!.hiddenRows).toEqual([2, 4, 7, 8, 9]);
    expect(back.sheets.map((s) => s.state)).toEqual(['visible', 'hidden', 'veryHidden']);
    wb.undo(); wb.undo(); wb.undo();
    expect(wb.hidden('S').rows).toEqual([2, 3, 4]);
    expect(wb.changeCount).toBe(0);
  });
});

describe('outline groups (W-49 DoD 9)', () => {
  /** Rows 3–8 grouped at level 1, rows 5–6 at level 2, the inner group collapsed in the file. */
  async function outlined(): Promise<Uint8Array> {
    const bytes = await toXlsx({ sheets: [{ name: 'S', rows: grid(12, 3) }] });
    return patchXlsx(bytes, [], { hidden: [{ sheet: 'S', rows: [4, 5], outline: { rows: { 2: 1, 3: 1, 4: 2, 5: 2, 6: 1, 7: 1 } } }] });
  }
  it('a gutter with brackets, +/− and level buttons; expand and collapse are a view setting; Alt+Shift+↓ / ↑', async () => {
    const el = await mountExcel({}, await outlined(), 'o.xlsx');
    const root = shadow(el);
    expect(Math.round(root.querySelector<HTMLElement>('.rh')!.getBoundingClientRect().width)).toBe(52 + 18 * 3);
    expect([...root.querySelectorAll<HTMLElement>('[data-olvl^="rows:"]')].map((b) => b.textContent)).toEqual(['1', '2', '3']);
    const inner = root.querySelector<HTMLElement>('[data-og="rows:4-5:0"]')!;
    expect(inner.textContent).toBe('+');
    expect(cellEl(el, 4, 0)).toBeNull();
    inner.click();
    await frame();
    expect(cellEl(el, 4, 0)).not.toBeNull();
    expect(el.workbook!.changeCount).toBe(0);
    root.querySelector<HTMLElement>('[data-olvl="rows:1"]')!.click();
    await frame();
    expect(cellEl(el, 2, 0)).toBeNull(); // level 1: every group closed
    expect(cellEl(el, 8, 0)).not.toBeNull();
    root.querySelector<HTMLElement>('[data-olvl="rows:3"]')!.click();
    await frame();
    expect(cellEl(el, 5, 0)).not.toBeNull(); // level 3: all open
    el.select('S', 'A6');
    await frame();
    key(el, 'ArrowUp', { altKey: true, shiftKey: true });
    await frame();
    expect(cellEl(el, 4, 0)).toBeNull(); // the innermost group at A6 collapsed
    key(el, 'ArrowDown', { altKey: true, shiftKey: true });
    await frame();
    expect(cellEl(el, 4, 0)).not.toBeNull();
  });
  it('setOutline groups and ungroups as one change per axis, and the download carries the levels', async () => {
    const el = await mountExcel({ mode: 'edit' }, await outlined(), 'o.xlsx');
    const wb = el.workbook!;
    wb.setOutline('S', 'rows', [9, 10], 1);
    wb.setOutline('S', 'rows', [2], -1);
    expect(wb.outline('S').rows).toEqual({ 3: 1, 4: 2, 5: 2, 6: 1, 7: 1, 9: 1, 10: 1 });
    expect(wb.changeCount).toBe(1);
    const { blob } = await wb.exportFile();
    const { read } = await import('@sheetpane/import');
    const back = (await read(new Uint8Array(await blob.arrayBuffer()), { name: 'o.xlsx' })).sheets[0]!;
    expect(Object.fromEntries(back.rowOutline.flatMap((o, i) => (o && o.level ? [[i, o.level]] : [])))).toEqual({ 3: 1, 4: 2, 5: 2, 6: 1, 7: 1, 9: 1, 10: 1 });
  });
});

describe('speed (W-49 DoD 13)', () => {
  it('250,000 rows with every other row hidden: a 5 s scroll — frame times reported', async () => {
    const lines = ['id,client,units,price,value'];
    for (let i = 0; i < 250_000; i++) lines.push(`AC-${i},Client ${i % 97},${i % 1000},${(i % 300) + 0.25},${i * 3}`);
    const el = await mountExcel({}, new TextEncoder().encode(lines.join('\r\n')), 'transactions-q3.csv');
    const sheet = el.workbook!.getSnapshot().selection.sheet;
    el.workbook!.setHidden(sheet, 'rows', Array.from({ length: 125_000 }, (_, i) => i * 2 + 1), true);
    await frame();
    const sc = shadow(el).querySelector<HTMLElement>('.scroller')!;
    const gaps: number[] = [];
    let last = performance.now();
    const end = last + 5000;
    await new Promise<void>((done) => { const step = (t: number) => { gaps.push(t - last); last = t; sc.scrollTop += 900; if (t < end) requestAnimationFrame(step); else done(); }; requestAnimationFrame(step); });
    const iv = gaps.slice(2).sort((a, b) => a - b), vs = iv[Math.floor(iv.length / 2)]!;
    console.info(`W-49 scroll, 250k rows, every other hidden: ${gaps.length} frames, worst ${iv[iv.length - 1]!.toFixed(1)} ms, dropped ${iv.filter((x) => x > vs * 1.5).length}`);
    if (budgets) expect(sc.scrollTop).toBeGreaterThan(100_000);
    expect(shadow(el).querySelectorAll('.row').length).toBeLessThan(120); // the virtualiser renders no hidden row
  }, 60_000);
});
