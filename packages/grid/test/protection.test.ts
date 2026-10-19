// W-62 DoD 2: a protected sheet's locked cells refuse typing, paste and Delete with SP-3020 ("Locked in the file");
// its unlocked cells stay editable; a hidden formula shows its value only; `protection="ignore"` is the host's call.
// The structure lock (DoD 3) in the store; its controls are tested in @sheetpane/visibility. The download keeps the
// file's protection untouched (Hazards).
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { fromUtf8, inflateEntry, readZip } from '@sheetpane/export';
import protectedXlsx from '../../fixtures/files/protected.xlsx?inline';
import { createWorkbook, lockedIn, structureLockedIn, type Plugin, type SheetpaneExcel, type WorkbookStore } from '../src/index.js';
import { cellEl, cleanup, frame, mountExcel, shadow } from './helpers.js';

afterEach(cleanup);

const bytes = () => Uint8Array.from(atob(protectedXlsx.slice(protectedXlsx.indexOf(',') + 1)), (c) => c.charCodeAt(0));
const $ = (el: Element, q: string) => shadow(el).querySelector(q) as HTMLElement;
const key = (el: Element, k: string) => $(el, '.grid').dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, cancelable: true }));
const record = (el: Element, names: string[]) => { const out: { name: string; detail: Record<string, unknown> }[] = []; for (const n of names) el.addEventListener(n, (e) => out.push({ name: n, detail: (e as CustomEvent).detail })); return out; };
const paste = (el: Element, text: string) => { const dt = new DataTransfer(); dt.setData('text/plain', text); $(el, '.grid').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); };
async function store(plugins: Plugin[] = []): Promise<WorkbookStore> { const s = createWorkbook({ plugins }); await s.load(bytes(), 'protected.xlsx'); return s; }

describe('the store honours the file’s protection (W-62 DoD 2, 3)', () => {
  it('locked cells of a protected sheet; unlocked cells, columns and other sheets stay open', async () => {
    const s = await store();
    expect(['A1', 'A2', 'E2', 'A10'].map((r) => s.isLocked('Spec', r))).toEqual([true, true, true, true]);
    expect(['B2', 'C3', 'D4', 'B10', 'D40'].map((r) => s.isLocked('Spec', r))).toEqual([false, false, false, false, false]); // D4, B10, D40: empty cells of an unlocked column
    expect(s.isLocked('Lists', 'B3')).toBe(true);
    expect(s.isLocked('Notes', 'A2')).toBe(false);
    expect(s.sheetProtection('Spec')).toMatchObject({ hasPassword: true, formatCells: true, selectLockedCells: false });
    expect(s.sheetProtection('Notes')).toBeUndefined();
    expect(lockedIn(s.getSnapshot(), 'Spec', 'A2')).toBe(true);
  });
  it('setCell, setCells and “Also change the cell” leave a locked cell as it is; an unlocked one changes', async () => {
    const s = await store();
    expect(s.setCell('Spec', 'A2', 'Iron')).toBe(false);
    expect(s.setCells([{ sheet: 'Spec', ref: 'A3', input: 'x' }, { sheet: 'Spec', ref: 'B3', input: '41' }])).toBe(1);
    expect([s.value('Spec', 'A3'), s.value('Spec', 'B3')]).toEqual(['Zinc', 41]);
    s.addError({ sheet: 'Spec', range: 'A4', type: 'wrong-value', severity: 'error', expected: 'Nickel', cellChanged: true });
    expect(s.value('Spec', 'A4')).toBe('Copper');
    expect(s.setCell('Notes', 'A2', 'free')).toBe(true);
    expect(s.changeCount).toBe(2);
  });
  it('a hidden formula shows its value only, even with a formula engine installed', async () => {
    const calc: Plugin = { id: 'calc', provides: ['derive'], derive: () => [] };
    const s = await store([calc]);
    expect(s.isFormulaHidden('Spec', 'E2')).toBe(true);
    expect(s.formula('Spec', 'E2')).toBe('=B2*1.1'); // the data is kept: only what is shown changes
    expect(s.input('Spec', 'E2')).toBe('3.3');
    s.setProtection('ignore');
    expect(s.input('Spec', 'E2')).toBe('=B2*1.1');
  });
  it('the structure lock: structureLocked() — the predicate W-52’s insert and delete ask — and setSheetState refused', async () => {
    const s = await store();
    expect(s.structureLocked()).toBe(true);
    expect(structureLockedIn(s.getSnapshot())).toBe(true);
    expect(s.setSheetState('Archive', 'visible')).toBe(false);
    expect(s.setSheetState('Notes', 'hidden')).toBe(false);
    expect(s.hidden('Archive').state).toBe('hidden');
    expect(s.changeCount).toBe(0);
  });
  it('protection "ignore": nothing is locked, the structure is open — and it is no change and no undo step', async () => {
    const s = await store();
    const v = s.getSnapshot().version;
    s.setProtection('ignore');
    expect(s.getSnapshot().version).toBe(v + 1);
    expect(s.getSnapshot().protection).toBe('ignore');
    expect([s.isLocked('Spec', 'A2'), s.isFormulaHidden('Spec', 'E2'), s.structureLocked(), s.sheetProtection('Spec')]).toEqual([false, false, false, undefined]);
    expect(s.setCell('Spec', 'A2', 'Iron')).toBe(true);
    expect(s.setSheetState('Archive', 'visible')).toBe(true);
    expect(s.getSnapshot().canUndo).toBe(true);
    s.undo(); s.undo();
    expect(s.protection).toBe('ignore');
    s.setProtection('honour');
    expect(s.isLocked('Spec', 'A2')).toBe(true);
  });
});

describe('<sheetpane-excel> refuses edits to locked cells (W-62 DoD 2)', () => {
  const mount = (attrs: Record<string, string> = {}) => mountExcel({ mode: 'edit', ...attrs }, bytes(), 'protected.xlsx');
  it('typing into a locked cell: editcancel {reason: locked, code: SP-3020}, no beforechange, the chip says why', async () => {
    const el = await mount();
    const ev = record(el, ['sheetpane-editcancel', 'sheetpane-beforechange', 'sheetpane-editstart']);
    el.select('Spec', 'A2');
    await frame();
    expect(($(el, '.cell') as HTMLInputElement).hidden).toBe(true);
    expect($(el, '[data-sp=locked]').hidden).toBe(false);
    expect($(el, '[data-sp=locked]').textContent).toContain('Locked in the file');
    $(el, '.grid').focus();
    key(el, 'x');
    key(el, 'Delete');
    expect(ev.map((e) => e.name)).toEqual(['sheetpane-editcancel', 'sheetpane-editcancel']);
    expect(ev[0]!.detail).toEqual({ sheet: 'Spec', ref: 'A2', reason: 'locked', code: 'SP-3020', message: 'Locked in the file' });
    expect(el.workbook!.text('Spec', 'A2')).toBe('Lead');
    expect(el.workbook!.changeCount).toBe(0);
  });
  it('an unlocked cell edits as usual; a view shows no chip', async () => {
    const el = await mount();
    el.select('Spec', 'B2');
    await frame();
    expect($(el, '[data-sp=locked]').hidden).toBe(true);
    await userEvent.fill($(el, '.cell') as HTMLInputElement, '4');
    await userEvent.keyboard('{Enter}');
    expect(el.workbook!.value('Spec', 'B2')).toBe(4);
    el.mode = 'view';
    el.select('Spec', 'A2');
    await frame();
    expect($(el, '[data-sp=locked]').hidden).toBe(true);
  });
  it('paste and Delete over a range change the unlocked cells only, one undo step, and say how many were left', async () => {
    const el = await mount();
    const cancels = record(el, ['sheetpane-editcancel']);
    const wb = el.workbook!;
    el.select('Spec', 'A2');
    await frame();
    paste(el, 'Iron\t5\r\nTin\t6\r\n');
    expect(cancels.map((e) => e.detail.ref)).toEqual(['A2', 'A3']);
    expect(['A2', 'B2', 'A3', 'B3'].map((r) => wb.value('Spec', r))).toEqual(['Lead', 5, 'Zinc', 6]);
    await frame();
    expect($(el, '.status').textContent).toContain('2 locked cells left as they were — Locked in the file');
    wb.undo();
    expect(wb.changeCount).toBe(0);
    wb.select({ sheet: 'Spec', ref: 'A2', range: 'A2:C3' });
    await frame();
    key(el, 'Delete');
    expect(['A2', 'B2', 'C2', 'A3', 'B3', 'C3'].map((r) => wb.value('Spec', r))).toEqual(['Lead', null, null, 'Zinc', null, null]);
    expect(wb.changeCount).toBe(4);
  });
  it('a value picker (a cell control with choose, e.g. a list arrow) is not drawn on a locked cell, and Alt+↓ opens nothing', async () => {
    const p: Plugin = { id: 'pick', provides: [], controls: [{ id: 'pick-arrow', slot: 'cell', group: 'v', label: 'Choose', mode: 'edit', appliesTo: (c) => c.sheet.name === 'Spec' && (c.ref === 'A2' || c.ref === 'B2'), cellOptions: () => ['one'], choose: (st, sel, v) => st.setCell(sel.sheet, sel.ref, v) }] };
    const el = await mount();
    const s = createWorkbook({ plugins: [p] });
    el.workbook = s;
    await s.load(bytes(), 'protected.xlsx');
    s.setMode('edit');
    s.select({ sheet: 'Spec', ref: 'A2' });
    await frame();
    expect(cellEl(el, 1, 0)!.querySelector('.mk')).toBeNull();
    expect(cellEl(el, 1, 1)!.querySelector('.mk')).not.toBeNull();
    $(el, '.grid').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true, composed: true, cancelable: true }));
    await frame();
    expect(shadow(el).querySelector('.menu [data-act=pick-option]')).toBeNull();
  });
  it('the Notes sheet is not protected: every cell edits', async () => {
    const el = await mount();
    el.select('Notes', 'A1');
    await frame();
    expect($(el, '[data-sp=locked]').hidden).toBe(true);
    await userEvent.fill($(el, '.cell') as HTMLInputElement, 'Notes!');
    await userEvent.keyboard('{Enter}');
    expect(el.workbook!.value('Notes', 'A1')).toBe('Notes!');
  });
  it('protection="ignore": the host’s decision — locked cells edit; switching back locks them again', async () => {
    const el = await mount({ protection: 'ignore' }) as SheetpaneExcel;
    expect(el.protection).toBe('ignore');
    el.select('Spec', 'A2');
    await frame();
    expect($(el, '[data-sp=locked]').hidden).toBe(true);
    await userEvent.fill($(el, '.cell') as HTMLInputElement, 'Iron');
    await userEvent.keyboard('{Enter}');
    expect(el.workbook!.value('Spec', 'A2')).toBe('Iron');
    el.protection = 'honour';
    await frame();
    expect(el.getAttribute('protection')).toBe('honour');
    el.select('Spec', 'A3');
    await frame();
    expect($(el, '[data-sp=locked]').hidden).toBe(false);
  });
  it('the download keeps <sheetProtection> and <workbookProtection> exactly as the file had them', async () => {
    const el = await mount();
    el.select('Spec', 'B2');
    await frame();
    await userEvent.fill($(el, '.cell') as HTMLInputElement, '9');
    await userEvent.keyboard('{Enter}');
    const out = new Uint8Array(await (await el.export()).arrayBuffer());
    const src = bytes();
    const part = async (b: Uint8Array, n: string) => fromUtf8(await inflateEntry(b, readZip(b).find((e) => e.name === n)!));
    const tag = (xml: string, t: string) => new RegExp(`<${t}\\b[^>]*/>`).exec(xml)?.[0];
    for (const [n, t] of [['xl/worksheets/sheet1.xml', 'sheetProtection'], ['xl/worksheets/sheet2.xml', 'sheetProtection'], ['xl/workbook.xml', 'workbookProtection']] as const) {
      expect(tag(await part(out, n), t)).toBe(tag(await part(src, n), t));
      expect(tag(await part(out, n), t)).toContain('="CC7D"');
    }
    expect(await part(out, 'xl/styles.xml')).toBe(await part(src, 'xl/styles.xml'));
  });
});
