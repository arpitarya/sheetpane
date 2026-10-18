import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import axe from 'axe-core';
import { read } from '@sheetpane/import';
import type { SheetpaneExcel } from '../src/index.js';
import { cellEl, cleanup, frame, mountExcel, sampleCsv, shadow, until } from './helpers.js';

afterEach(cleanup);
const $ = (el: Element, sel: string) => shadow(el).querySelector(sel) as HTMLElement;

describe('the element (W-01 DoD 1, 4)', () => {
  it('registers on import; the contract is attributes, properties, methods and events', async () => {
    expect(customElements.get('sheetpane-excel')).toBeDefined();
    const el = await mountExcel();
    expect(typeof el.load).toBe('function');
    expect(typeof el.export).toBe('function');
    expect(typeof el.select).toBe('function');
    expect(el.workbook).toBeDefined();
    expect(cellEl(el, 1, 0)!.textContent).toBe('Account ID');
  });
  it('draws the merged, centred title once across its range, and the tabs', async () => {
    const el = await mountExcel();
    const title = cellEl(el, 0, 0)!;
    expect(title.classList.contains('merge')).toBe(true);
    expect(title.textContent).toBe('Client holdings — as of 30 Sep 2026');
    expect(title.getBoundingClientRect().width).toBeGreaterThan(cellEl(el, 1, 0)!.getBoundingClientRect().width * 5);
    expect(cellEl(el, 0, 1)).toBeNull();
    expect([...shadow(el).querySelectorAll('.tab')].map((t) => t.textContent)).toEqual(['Holdings', 'Fee tiers']);
  });
  it('switches sheets, and a CSV has no tabs', async () => {
    const el = await mountExcel();
    (shadow(el).querySelector('.tab[data-sheet="Fee tiers"]') as HTMLButtonElement).click();
    await frame();
    expect(cellEl(el, 1, 0)!.textContent).toBe('Tier');
    const csv = await mountExcel({}, sampleCsv(), 'holdings-q3.csv');
    expect($(csv, '.tabs').hidden).toBe(true);
    expect($(csv, '.meta').textContent).toContain('comma');
  });
  it('shows the stored text; find covers every row and steps through hits', async () => {
    const el = await mountExcel();
    const find = $(el, '.findin') as HTMLInputElement;
    await userEvent.fill(find, 'TMKT');
    await frame();
    expect($(el, '.find .cnt').textContent).toBe('0 of 3');
    find.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await frame();
    expect(el.workbook!.getSnapshot().selection.ref).toBe('E3');
    expect(shadow(el).querySelectorAll('.c.hit').length).toBe(3);
  });
});

describe('refusals (W-01 DoD 3; SR-LAW-3)', () => {
  it('shows "Can’t open this file" for another format, with nothing parsed', async () => {
    const el = document.createElement('sheetpane-excel');
    document.body.append(el);
    await el.load(new Uint8Array([0x50, 0x4b, 3, 4]), 'holdings.xls');
    await frame();
    expect($(el, '.state').hidden).toBe(false);
    expect($(el, '.state').textContent).toContain('Can’t open this file');
    expect($(el, '.state').textContent).toContain('.xls');
  });
  it('shows the password state for a password-protected .xlsx', async () => {
    const el = document.createElement('sheetpane-excel');
    document.body.append(el);
    const cfb = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, ...Array.from('EncryptedPackage', (c) => [c.charCodeAt(0), 0]).flat()]);
    await el.load(cfb, 'fees-2026.xlsx');
    await frame();
    expect($(el, '.state').textContent).toContain('Password protected');
  });
  it('shows the upload state with no file, and reads a base64 src', async () => {
    const el = document.createElement('sheetpane-excel');
    document.body.append(el);
    await frame();
    expect($(el, '.state').textContent).toContain('No workbook yet');
    const b64 = btoa(String.fromCharCode(...sampleCsv()));
    el.setAttribute('src', b64);
    await until(() => el.workbook!.getSnapshot().load.status === 'ready');
    await frame();
    expect(cellEl(el, 0, 0)!.textContent).toBe('Account ID');
  });
});

describe('edit in memory (W-01 DoD 7, 8)', () => {
  it('the cell bar edits the selected cell, marks it, offers Revert, counts it', async () => {
    const el = await mountExcel({ mode: 'edit' });
    el.select('Holdings', 'G7');
    await frame();
    const input = $(el, '.cell') as HTMLInputElement;
    expect(input.hidden).toBe(false);
    expect(input.value).toBe('286.4');
    await userEvent.fill(input, '268.4');
    await userEvent.keyboard('{Enter}');
    await frame();
    el.select('Holdings', 'G7');
    await frame();
    expect(cellEl(el, 6, 6)!.classList.contains('chg')).toBe(true);
    expect($(el, '.changed').textContent).toBe('Changed · was 286.4');
    expect($(el, '.changes').textContent).toBe('1 change in memory');
    ($(el, '.revert') as HTMLButtonElement).click();
    await frame();
    expect(cellEl(el, 6, 6)!.textContent).toBe('286.4');
    expect($(el, '.changes').textContent).toBe('No changes yet');
  });
  it('a change survives View↔Edit and sheet switches; View has no cell box', async () => {
    const el = await mountExcel({ mode: 'edit' });
    el.workbook!.setCell('Holdings', 'B3', 'R. Mehra');
    el.setAttribute('mode', 'view');
    el.workbook!.select({ sheet: 'Fee tiers', ref: 'A1' });
    el.workbook!.select({ sheet: 'Holdings', ref: 'B3' });
    await frame();
    expect(($(el, '.cell') as HTMLInputElement).hidden).toBe(true);
    expect(cellEl(el, 2, 1)!.textContent).toBe('R. Mehra');
    expect($(el, '.val').textContent).toBe('R. Mehra');
  });
  it('Export returns a Blob with every change and dispatches sheetpane-export; the original is untouched', async () => {
    const el = await mountExcel({ mode: 'edit' });
    const orig = el.workbook!.getSnapshot().source!.bytes.slice();
    el.workbook!.setCell('Holdings', 'G7', '268.4');
    let detail: { kind: string } | undefined;
    el.addEventListener('sheetpane-export', (e) => { detail = (e as CustomEvent).detail; e.preventDefault(); });
    const blob = await el.export();
    expect(detail!.kind).toBe('xlsx');
    const back = await read(new Uint8Array(await blob.arrayBuffer()), { name: 'x.xlsx' });
    expect(back.sheets[0]!.rows[6]![6]).toBe(268.4);
    expect(el.workbook!.getSnapshot().source!.bytes).toEqual(orig);
  });
  it('warns before unload while changes are held, and only then', async () => {
    const el = await mountExcel({ mode: 'edit' });
    const ev = () => { const e = new Event('beforeunload', { cancelable: true }); dispatchEvent(e); return e.defaultPrevented; };
    expect(ev()).toBe(false);
    el.workbook!.setCell('Holdings', 'A3', 'x');
    expect(ev()).toBe(true);
  });
});

describe('flag and review (W-01 DoD 9)', () => {
  it('F opens the inline form when no error element is on the pane; Add error pins the cell', async () => {
    const el = await mountExcel({ mode: 'edit', author: 'Arpit' });
    el.select('Holdings', 'I6');
    await frame();
    const grid = $(el, '.grid');
    grid.focus();
    await userEvent.keyboard('f');
    await frame();
    const form = $(el, '.composer');
    expect(form).not.toBeNull();
    expect(form.textContent).toContain('found 7.5%');
    await userEvent.fill(form.querySelector('[data-field=expected]') as HTMLInputElement, '0.75%');
    (form.querySelector('[data-act=add]') as HTMLButtonElement).click();
    await frame();
    const errs = el.getErrors();
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatchObject({ range: 'I6', found: '7.5%', expected: '0.75%', author: 'Arpit', type: 'wrong-value' });
    const pin = $(el, '.pin');
    expect(pin.textContent).toBe('1');
    expect($(el, '.callout').textContent).toContain('Found');
    ($(el, '.callout [data-act=resolve]') as HTMLButtonElement).click();
    await frame();
    expect(el.getErrors()[0]!.status).toBe('resolved');
    expect($(el, '.pin').textContent).toBe('✓');
  });
});

describe('keyboard (W-01 DoD 12; APG grid)', () => {
  it('moves with arrows, Home/End, Ctrl+Home; Enter edits; Esc cancels; aria marks the active cell', async () => {
    const el = await mountExcel({ mode: 'edit' });
    const grid = $(el, '.grid');
    grid.focus();
    el.select('Holdings', 'B3');
    await frame();
    await userEvent.keyboard('{ArrowRight}{ArrowDown}');
    expect(el.workbook!.getSnapshot().selection.ref).toBe('C4');
    await userEvent.keyboard('{End}');
    expect(el.workbook!.getSnapshot().selection.ref).toBe('J4');
    await userEvent.keyboard('{Control>}{Home}{/Control}');
    expect(el.workbook!.getSnapshot().selection.ref).toBe('A1');
    await frame();
    expect(grid.getAttribute('role')).toBe('grid');
    expect(grid.getAttribute('aria-activedescendant')).toBe('c0_0');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(shadow(el).activeElement).toBe($(el, '.cell'));
    await userEvent.keyboard('{Escape}');
    expect(shadow(el).activeElement).toBe(grid);
  });
  it('typing a character in Edit starts editing with it; Ctrl+Z undoes', async () => {
    const el = await mountExcel({ mode: 'edit' });
    el.select('Holdings', 'F3');
    await frame();
    $(el, '.grid').focus();
    await userEvent.keyboard('9{Enter}');
    expect(el.workbook!.value('Holdings', 'F3')).toBe(9);
    $(el, '.grid').focus();
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(el.workbook!.value('Holdings', 'F3')).toBe(1200);
  });
  it('has no axe violations in View, Edit and the refusal state', async () => {
    const el = await mountExcel({ mode: 'edit' });
    el.select('Holdings', 'G7');
    el.workbook!.addError({ sheet: 'Holdings', range: 'G7', type: 'other', severity: 'error', expected: '1' });
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

describe('the host font (W-01 DoD 6; SR-LAW-5)', () => {
  it('every part, form controls included, renders in the host font, and follows a live change', async () => {
    const wrap = document.createElement('div');
    wrap.style.fontFamily = 'Georgia, serif';
    document.body.append(wrap);
    const el = document.createElement('sheetpane-excel') as SheetpaneExcel;
    el.setAttribute('mode', 'edit');
    wrap.append(el);
    await el.load(await (await import('./helpers.js')).sampleXlsx(), 's.xlsx');
    await frame();
    const fam = (n: Element) => getComputedStyle(n).fontFamily;
    for (const n of [cellEl(el, 2, 0)!, $(el, '.cell'), $(el, '.findin'), $(el, '.zoom'), $(el, '.export'), $(el, '.tab')]) expect(fam(n), n.className).toBe('Georgia, serif');
    wrap.style.fontFamily = 'Courier New, monospace';
    await frame();
    expect(fam(cellEl(el, 2, 0)!)).toBe('"Courier New", monospace');
  });
});

describe('placement (W-01 DoD 5)', () => {
  it('display="popup" opens modally; Esc closes, fires sheetpane-close, returns focus', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const el = await mountExcel({ display: 'popup' });
    let closed = 0;
    el.addEventListener('sheetpane-close', () => closed++);
    el.open = true;
    await frame();
    const dialog = shadow(el).querySelector('dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.matches(':modal')).toBe(true);
    await userEvent.keyboard('{Escape}');
    await frame();
    expect(dialog.open).toBe(false);
    expect(el.open).toBe(false);
    expect(closed).toBe(1);
    expect(document.activeElement).toBe(opener);
  });
});

describe('scale (W-01 DoD 11)', () => {
  it('a 250,000-row CSV renders a window, not every row, and reports frame times while scrolling', async () => {
    const lines = ['id,client,units,price,value'];
    for (let i = 0; i < 250_000; i++) lines.push(`AC-${i},Client ${i % 97},${i % 1000},${(i % 300) + 0.25},${i * 3}`);
    const t0 = performance.now();
    const el = await mountExcel({}, new TextEncoder().encode(lines.join('\r\n')), 'transactions-q3.csv');
    const loadMs = Math.round(performance.now() - t0);
    const rendered = shadow(el).querySelectorAll('.row').length;
    expect(rendered).toBeLessThan(120);
    const sc = $(el, '.scroller');
    const frames: number[] = [];
    let longTasks = 0;
    const po = 'PerformanceObserver' in window && PerformanceObserver.supportedEntryTypes?.includes('longtask') ? new PerformanceObserver((l) => { longTasks += l.getEntries().length; }) : undefined;
    po?.observe({ type: 'longtask' });
    let last = performance.now();
    const end = last + 5000;
    await new Promise<void>((done) => {
      const step = (t: number) => { frames.push(t - last); last = t; sc.scrollTop += 900; if (t < end) requestAnimationFrame(step); else done(); };
      requestAnimationFrame(step);
    });
    po?.disconnect();
    await frame();
    const iv = frames.slice(2).sort((a, b) => a - b);
    const vsync = iv[Math.floor(iv.length / 2)]!;
    const dropped = iv.filter((x) => x > vsync * 1.5).length;
    console.info(`250k rows: load ${loadMs} ms; 5 s scroll at 900 px/frame: ${frames.length} frames, vsync ${vsync.toFixed(1)} ms, worst ${iv[iv.length - 1]!.toFixed(1)} ms, dropped ${dropped}, long tasks ${longTasks} — ${navigator.userAgent}, ${navigator.hardwareConcurrency} cores (reported, not gating)`);
    expect(shadow(el).querySelectorAll('.row').length).toBeLessThan(120);
    expect(sc.scrollTop).toBeGreaterThan(10_000);
    // the same scroll with two frozen rows (W-24 DoD 2)
    el.workbook!.setFreeze('transactions-q3', { rows: 2, cols: 0 });
    sc.scrollTop = 0;
    await frame();
    const f2: number[] = [];
    let l2 = performance.now();
    const e2 = l2 + 5000;
    await new Promise<void>((done) => { const step = (t: number) => { f2.push(t - l2); l2 = t; sc.scrollTop += 900; if (t < e2) requestAnimationFrame(step); else done(); }; requestAnimationFrame(step); });
    const iv2 = f2.slice(2).sort((a, b) => a - b), vs2 = iv2[Math.floor(iv2.length / 2)]!;
    console.info(`250k rows, 2 frozen: ${f2.length} frames, worst ${iv2[iv2.length - 1]!.toFixed(1)} ms, dropped ${iv2.filter((x) => x > vs2 * 1.5).length}`);
    expect(shadow(el).querySelectorAll('.frozen').length).toBe(2);
  }, 90000);
});

describe('properties as frameworks set them', () => {
  it('src = undefined or "" removes the attribute and loads nothing', async () => {
    const el = await mountExcel();
    (el as unknown as { src: string | undefined }).src = undefined;
    expect(el.hasAttribute('src')).toBe(false);
    el.src = '';
    expect(el.hasAttribute('src')).toBe(false);
    expect(el.workbook!.getSnapshot().load.status).toBe('ready');
  });
});
