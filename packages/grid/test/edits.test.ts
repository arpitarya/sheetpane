// W-64: the Edits view in <sheetpane-errors> — every change in the pane, before → after, revert one or all,
// and the errors each edit cleared or raised. A view over the store's change map (SR-GRID 24, SR-ERRORS 17).
import { afterEach, describe, expect, it } from 'vitest';
import axe from 'axe-core';
import { userEvent } from 'vitest/browser';
import { createWorkbook, editRef, type Plugin, type SheetpaneErrors, type SheetpaneExcel } from '../src/index.js';
import { cleanup, frame, sampleXlsx, shadow } from './helpers.js';

afterEach(cleanup);
const $ = (el: Element, sel: string) => shadow(el).querySelector(sel) as HTMLElement;
const $$ = (el: Element, sel: string) => Array.from(shadow(el).querySelectorAll<HTMLElement>(sel));
let paneN = 0;

/** A validate plugin: a negative Units cell (column F, rows 3–15 of Holdings) is a workbook error. */
const units: Plugin = {
  id: 'units', provides: ['validate'],
  validate: (sheet, ctx) => {
    if (sheet !== 'Holdings') return [];
    const out = [];
    for (let r = 3; r <= 15; r++) {
      const v = ctx.store.value(sheet, `F${r}`);
      if (typeof v === 'number' && v < 0) out.push({ sheet, range: `F${r}`, type: 'out-of-range', severity: 'error' as const, found: String(v), expected: '', message: 'Units can’t be negative', author: 'workbook' });
    }
    return out;
  },
};

async function book(plugins: Plugin[] = []) {
  const s = createWorkbook({ plugins });
  await s.load(await sampleXlsx(), 'q3.xlsx');
  s.setMode('edit');
  return s;
}

async function pair(o: { mode?: 'view' | 'edit'; errors?: Record<string, string> } = {}) {
  const pane = `ed${++paneN}`;
  const excel = document.createElement('sheetpane-excel') as SheetpaneExcel;
  excel.setAttribute('pane', pane); excel.setAttribute('mode', o.mode ?? 'edit'); excel.style.height = '500px';
  const errors = document.createElement('sheetpane-errors') as SheetpaneErrors;
  errors.setAttribute('pane', pane); errors.style.height = '600px';
  for (const [k, v] of Object.entries(o.errors ?? {})) errors.setAttribute(k, v);
  document.body.append(excel, errors);
  await excel.load(await sampleXlsx(), 'Client holdings — Q3 2026.xlsx');
  await frame();
  return { excel, errors, s: excel.workbook! };
}
const openEdits = async (errors: SheetpaneErrors) => { $(errors, '[data-act=view][data-v=edits]').click(); await frame(); };
const rows = (errors: SheetpaneErrors) => $$(errors, '.list [data-sp-edit]').map((r) => r.dataset.spEdit);

describe('the store’s edits (W-64 DoD 1, SR-GRID 24)', () => {
  it('lists every change-map entry, newest first, with its place, kind, was, now and time; one step’s edits keep their order', async () => {
    const s = await book();
    const t0 = Date.now();
    s.setCell('Holdings', 'F3', '1250');
    s.setCells([{ sheet: 'Holdings', ref: 'G3', input: '270' }, { sheet: 'Holdings', ref: 'G4', input: '102' }]);
    s.setChange('Holdings', 'B3', 'style', { bold: true }, undefined);
    s.setFreeze('Holdings', { rows: 2, cols: 0 });
    s.setMerge('Holdings', 'A1:J1', false);
    const list = s.edits();
    expect(list.map((e) => [e.key, e.ref, e.kind])).toEqual([
      ['Holdings!#merge:A1:J1', 'A1:J1', 'merge'],
      ['Holdings!#freeze', '', 'freeze'],
      ['Holdings!#style:B3', 'B3', 'style'],
      ['Holdings!G3', 'G3', 'value'],
      ['Holdings!G4', 'G4', 'value'],
      ['Holdings!F3', 'F3', 'value'],
    ]);
    expect(list.at(-1)).toMatchObject({ sheet: 'Holdings', was: 1200, now: 1250 });
    expect(Date.parse(list.at(-1)!.at)).toBeGreaterThanOrEqual(t0 - 1);
    expect(list).toHaveLength(s.changeCount); // one entry per change-map key: derived cells are not edits
    expect([editRef('#numFmt:C4'), editRef('#hiddenRows'), editRef('#merge:A1:C1'), editRef('D9')]).toEqual(['C4', '', 'A1:C1', 'D9']);
  });
  it('W-52’s inserts and deletes on a sheet are one entry, its operations in order; reverting it reverts them all', async () => {
    const s = await book();
    const rowsRead = s.sheet('Holdings')!.rows.length;
    expect(s.insertRows('Holdings', 4, 2)).toBe(true);
    expect(s.insertRows('Holdings', 20, 1)).toBe(true);
    expect(s.edits()).toMatchObject([{ key: 'Holdings!#structure', ref: '', kind: 'structure', was: [], now: [{ op: 'insertRows', at: 4, count: 2 }, { op: 'insertRows', at: 20, count: 1 }] }]);
    expect(s.revertEdits(['Holdings!#structure'])).toBe(1);
    expect(s.edits()).toEqual([]);
    expect(s.sheet('Holdings')!.rows.length).toBe(rowsRead);
  });
});

describe('revert (W-64 DoD 2)', () => {
  it('one edit or all of them, each one undo step; undo brings the edits back with their times', async () => {
    const s = await book();
    s.setCell('Holdings', 'F3', '1250');
    s.setCell('Holdings', 'F4', '900');
    s.setChange('Holdings', 'F4', 'style', { bold: true }, undefined);
    const before = s.edits();
    expect(s.revertEdits(['Holdings!F4'])).toBe(1); // the value only: the style on F4 stays
    expect(s.edits().map((e) => e.key)).toEqual(['Holdings!#style:F4', 'Holdings!F3']);
    expect(s.value('Holdings', 'F4')).toBe(850);
    s.undo();
    expect(s.edits()).toEqual(before);
    s.redo();
    expect(s.edits()).toHaveLength(2);
    expect(s.revertEdits()).toBe(2); // Revert all
    expect(s.edits()).toEqual([]);
    expect(s.getSnapshot().canUndo).toBe(true);
    s.undo();
    expect(s.edits().map((e) => e.key)).toEqual(['Holdings!#style:F4', 'Holdings!F3']);
    expect(s.revertEdits(['Holdings!Z99'])).toBe(0); // nothing to revert: no undo step
  });
  it('fires sheetpane-change for each reverted cell on the element that asked', async () => {
    const { errors, s } = await pair();
    s.setCell('Holdings', 'F3', '1250');
    await frame();
    const seen: unknown[] = [];
    errors.addEventListener('sheetpane-change', (e) => seen.push((e as CustomEvent).detail));
    await openEdits(errors);
    $(errors, '[data-sp=revert-edit]').click();
    await frame();
    expect(seen).toEqual([{ sheet: 'Holdings', ref: 'F3', kind: 'value', was: 1250, now: 1200 }]);
  });
});

describe('the errors each edit cleared or raised (W-64 DoD 3)', () => {
  it('a workbook error resolved by the edit is cleared; one the edit causes is raised; a person’s suggestion matched', async () => {
    const s = await book([units]);
    const neg = s.getErrors().find((e) => e.range === 'F10')!;
    expect(neg).toMatchObject({ status: 'open', author: 'workbook' });
    s.setCell('Holdings', 'F10', '150');
    expect(s.editEffects('Holdings!F10')).toEqual({ cleared: [neg.id], raised: [], matched: [] });
    s.setCell('Holdings', 'F3', '-5');
    const raised = s.getErrors().find((e) => e.range === 'F3')!;
    expect(s.editEffects('Holdings!F3')).toEqual({ cleared: [], raised: [raised.id], matched: [] });
    const mine = s.addError({ sheet: 'Holdings', range: 'G3', type: 'wrong-value', severity: 'error', expected: '268.5', author: 'Asha' });
    s.setCell('Holdings', 'G3', '268.5');
    expect(s.editEffects('Holdings!G3')).toEqual({ cleared: [], raised: [], matched: [mine.id] });
    // typing on: still compared with before the cell first changed
    s.setCell('Holdings', 'F10', '160');
    expect(s.editEffects('Holdings!F10').cleared).toEqual([neg.id]);
    // an edit about a whole sheet has none
    s.setFreeze('Holdings', { rows: 1, cols: 0 });
    expect(s.editEffects('Holdings!#freeze')).toEqual({ cleared: [], raised: [], matched: [] });
    // reverted, the error is open again and the edit is gone
    s.revertEdits(['Holdings!F10']);
    expect(s.getErrors().find((e) => e.id === neg.id)!.status).toBe('open');
    expect(s.editEffects('Holdings!F10')).toEqual({ cleared: [], raised: [], matched: [] });
  });
  it('the row names them; a link opens the error in Problems and selects its cell', async () => {
    const wb = await book([units]);
    const errors = document.createElement('sheetpane-errors') as SheetpaneErrors;
    errors.workbook = wb; // a host-made store: its plugins are its own
    document.body.append(errors);
    const neg = wb.getErrors().find((e) => e.range === 'F10')!;
    wb.setCell('Holdings', 'F10', '150');
    await frame();
    await openEdits(errors);
    const row = $(errors, '[data-sp-edit="Holdings!F10"]');
    expect(row.querySelector('.m')!.textContent).toMatch(/1 cleared$/);
    const link = row.querySelector<HTMLElement>('[data-act=goto-error]')!;
    expect(link.textContent).toBe(`✓ Cleared error ${Number(neg.id.slice(4))}: Out of range`);
    link.click();
    await frame();
    expect($(errors, '[data-act=view][data-v=problems]').getAttribute('aria-pressed')).toBe('true');
    expect($(errors, `[data-id="${neg.id}"] .issue`).getAttribute('aria-expanded')).toBe('true');
    expect(shadow(errors).activeElement).toBe($(errors, `[data-id="${neg.id}"] .issue`));
    expect(wb.getSnapshot().selection).toEqual({ sheet: 'Holdings', ref: 'F10' });
  });
  it('with W-51: an error in a layer not shown is named, not linked', async () => {
    const wb = await book([units]);
    const errors = document.createElement('sheetpane-errors') as SheetpaneErrors;
    errors.workbook = wb;
    document.body.append(errors);
    const neg = wb.getErrors().find((e) => e.range === 'F10')!; // in `review`
    wb.setErrors([{ ...neg, id: 'P-1', range: 'B2', author: 'checker', type: 'other' }], { layer: 'pdf' });
    wb.setCell('Holdings', 'F10', '150');
    wb.setVisibleLayers(['pdf']);
    await frame();
    await openEdits(errors);
    const row = $(errors, '[data-sp-edit="Holdings!F10"]');
    expect(row.querySelector('[data-act=goto-error]')).toBeNull();
    expect(row.querySelector('.fx')!.textContent).toBe(`✓ Cleared error ${Number(neg.id.slice(4))}: Out of range`);
    wb.setVisibleLayers(null);
    await frame();
    expect($(errors, '[data-sp-edit="Holdings!F10"] [data-act=goto-error]')).not.toBeNull();
  });
});

describe('the Edits view (W-64 DoD 1)', () => {
  it('a sibling of Problems: in Edit mode always, in View mode only with edits', async () => {
    const view = await pair({ mode: 'view' });
    expect($(view.errors, '[data-act=view]')).toBeNull();
    view.s.setCell('Holdings', 'F3', '1250'); // a host may change cells in View
    await frame();
    expect($$(view.errors, '[data-act=view]').map((b) => b.textContent)).toEqual(['Problems 0', 'Edits 1']);
    cleanup();
    const { errors, s } = await pair();
    expect($$(errors, '[data-act=view]').map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([['Problems 0', 'true'], ['Edits 0', 'false']]);
    await openEdits(errors);
    expect($(errors, '.list .empty').textContent).toMatch(/^No edits yet/);
    expect($(errors, '.edbar').hidden).toBe(true);
    expect($$(errors, '[data-act=filter]')).toHaveLength(0); // the severity filters are Problems'
    s.setMode('view'); // no edits in View: back to Problems
    await frame();
    expect($(errors, '[data-act=view]')).toBeNull();
  });
  it('each row: sheet!ref · kind, was → now, the time; picking it selects the cell or range', async () => {
    const { errors, s } = await pair();
    s.setCell('Holdings', 'F3', '1250');
    s.setCell('Holdings', 'D4', '');
    s.setMerge('Holdings', 'A1:J1', false);
    s.setFreeze('Holdings', { rows: 2, cols: 1 });
    await frame();
    await openEdits(errors);
    expect($(errors, '[data-act=view][data-v=edits]').textContent).toBe('Edits 4');
    expect($(errors, '.edbar').textContent).toBe('4 edits · newest firstRevert all');
    expect($$(errors, '.list [data-act=edit-pick] .ty').map((x) => x.textContent)).toEqual(['Holdings · whole sheet · Freeze panes', 'Holdings!A1:J1 · Merge', 'Holdings!D4 · Value', 'Holdings!F3 · Value']);
    expect($$(errors, '.list [data-act=edit-pick] .ba').map((x) => x.textContent)).toEqual(['was none → now 2 rows, 1 column', 'was merged → now not merged', 'was Short-Term Bond Fund → now (blank)', 'was 1200 → now 1250']);
    const time = $(errors, '[data-sp-edit="Holdings!F3"] time');
    expect(Date.parse(time.getAttribute('datetime')!)).toBeGreaterThan(0);
    $(errors, '[data-sp-edit="Holdings!F3"] [data-act=edit-pick]').click();
    expect(s.getSnapshot().selection).toEqual({ sheet: 'Holdings', ref: 'F3' });
    $(errors, '[data-sp-edit="Holdings!#merge:A1:J1"] [data-act=edit-pick]').click();
    expect(s.getSnapshot().selection).toEqual({ sheet: 'Holdings', ref: 'A1', range: 'A1:J1' });
    s.select({ sheet: 'Fee tiers', ref: 'B3' });
    $(errors, '[data-sp-edit="Holdings!#freeze"] [data-act=edit-pick]').click(); // a whole-sheet edit opens its tab
    expect(s.getSnapshot().selection).toEqual({ sheet: 'Holdings', ref: 'A1' });
  });
  it('Revert one row, then Revert all: focus moves on, undo brings them back; Revert is gone in View mode and readonly', async () => {
    const { excel, errors, s } = await pair();
    s.setCell('Holdings', 'F3', '1250');
    s.setCell('Holdings', 'F4', '900');
    s.setCell('Holdings', 'F5', '440');
    await frame();
    await openEdits(errors);
    expect(rows(errors)).toEqual(['Holdings!F5', 'Holdings!F4', 'Holdings!F3']);
    $(errors, '[data-sp-edit="Holdings!F4"] [data-sp=revert-edit]').click();
    await frame();
    expect(rows(errors)).toEqual(['Holdings!F5', 'Holdings!F3']);
    expect(shadow(errors).activeElement).toBe($(errors, '[data-sp-edit="Holdings!F3"] [data-sp=revert-edit]'));
    expect(excel.workbook!.value('Holdings', 'F4')).toBe(850);
    await userEvent.keyboard('{Control>}z{/Control}'); // the panel's own undo: the row comes back
    await frame();
    expect(rows(errors)).toEqual(['Holdings!F5', 'Holdings!F4', 'Holdings!F3']);
    $(errors, '[data-sp=revert-all]').click();
    await frame();
    expect(rows(errors)).toEqual([]);
    expect(shadow(errors).activeElement).toBe($(errors, '[data-act=view][data-v=edits]'));
    expect($(errors, '[data-act=view][data-v=edits]').textContent).toBe('Edits 0');
    s.undo();
    await frame();
    expect(rows(errors)).toHaveLength(3);
    s.setMode('view');
    await frame();
    expect($(errors, '[data-sp=revert-edit]')).toBeNull();
    expect($(errors, '[data-sp=revert-all]')).toBeNull();
    s.setMode('edit');
    errors.readOnly = true;
    await frame();
    expect($(errors, '[data-sp=revert-edit]')).toBeNull();
    expect(rows(errors)).toHaveLength(3);
  });
  it('keyboard: ↓ ↑ Home End move between rows; Enter picks; the row’s Revert is the next Tab stop', async () => {
    const { errors, s } = await pair();
    for (const [ref, v] of [['F3', '1'], ['F4', '2'], ['F5', '3']] as const) s.setCell('Holdings', ref, v);
    await frame();
    await openEdits(errors);
    const picks = $$(errors, '.list [data-act=edit-pick]');
    picks[0]!.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(shadow(errors).activeElement).toBe(picks[1]);
    await userEvent.keyboard('{End}');
    expect(shadow(errors).activeElement).toBe(picks[2]);
    await userEvent.keyboard('{ArrowUp}{Home}');
    expect(shadow(errors).activeElement).toBe(picks[0]);
    await userEvent.keyboard('{Enter}');
    expect(s.getSnapshot().selection).toEqual({ sheet: 'Holdings', ref: 'F5' });
    await userEvent.keyboard('{Tab}');
    expect(shadow(errors).activeElement).toBe($(errors, '[data-sp-edit="Holdings!F5"] [data-sp=revert-edit]'));
  });
  it('W-52: a sheet’s inserts and deletes are one row — Rows and columns, what was done — and its Revert is one undo step', async () => {
    const { excel, errors, s } = await pair();
    const before = s.sheet('Holdings')!.rows.length;
    s.setCell('Holdings', 'F5', '440');
    expect(s.insertRows('Holdings', 2, 2)).toBe(true);
    expect(s.insertCols('Holdings', 10, 1)).toBe(true);
    await frame();
    await openEdits(errors);
    expect(rows(errors)).toEqual(['Holdings!#structure', 'Holdings!F7']);
    const row = $(errors, '[data-sp-edit="Holdings!#structure"]');
    expect(row.querySelector('.ty')!.textContent).toBe('Holdings · whole sheet · Rows and columns');
    expect(row.querySelector('.ba')!.textContent).toBe('was as read → now 2 rows inserted at 3, 1 column inserted at K');
    expect(row.querySelector('time')).not.toBeNull();
    row.querySelector<HTMLElement>('[data-sp=revert-edit]')!.click();
    await frame();
    expect(rows(errors)).toEqual(['Holdings!F5']);
    expect(excel.workbook!.sheet('Holdings')!.rows.length).toBe(before);
    expect(s.value('Holdings', 'F5')).toBe(440);
    s.undo();
    await frame();
    expect(rows(errors)).toEqual(['Holdings!#structure', 'Holdings!F7']);
  });
  it('a page at a time: 250 edits draw 100 rows and Show more', async () => {
    const { errors, s } = await pair();
    const cells = [];
    for (let r = 0; r < 250; r++) cells.push({ sheet: 'Fee tiers', ref: `G${r + 1}`, input: String(r) });
    s.setCells(cells);
    await frame();
    await openEdits(errors);
    expect(rows(errors)).toHaveLength(100);
    $(errors, '[data-act=edits-more]').click();
    await frame();
    expect(rows(errors)).toHaveLength(200);
    expect(shadow(errors).activeElement).toBe($$(errors, '.list [data-act=edit-pick]')[100]);
    expect($(errors, '[data-act=edits-more]').textContent).toBe('Show 50 more of 50');
  });
  it('L7: an edit in the sheet shows here at once, and a revert here shows in the sheet', async () => {
    const { excel, errors } = await pair();
    await openEdits(errors);
    excel.workbook!.setCell('Holdings', 'G3', '270', { origin: excel });
    await frame();
    expect(rows(errors)).toEqual(['Holdings!G3']);
    $(errors, '[data-sp=revert-edit]').click();
    await frame();
    expect(excel.workbook!.changeCount).toBe(0);
    expect(shadow(excel).querySelector('[data-sp-ref="G3"]')!.textContent).toBe('268.4');
  });
  it('axe: clean with edits listed, the links shown and in View mode', async () => {
    const wb = await book([units]);
    const errors = document.createElement('sheetpane-errors') as SheetpaneErrors;
    errors.workbook = wb;
    errors.style.height = '600px';
    document.body.append(errors);
    wb.setCell('Holdings', 'F10', '150');
    wb.setCell('Holdings', 'F3', '-5');
    wb.setFreeze('Holdings', { rows: 2, cols: 0 });
    await frame();
    await openEdits(errors);
    expect($$(errors, '[data-act=goto-error]')).toHaveLength(2);
    const r1 = await axe.run(errors, { rules: { 'label-content-name-mismatch': { enabled: false } } }); // the view chips' names (SR-ERRORS Consequences, known gap)
    expect(r1.violations.map((v) => v.id)).toEqual([]);
    wb.setMode('view');
    await frame();
    const r2 = await axe.run(errors, { rules: { 'label-content-name-mismatch': { enabled: false } } });
    expect(r2.violations.map((v) => v.id)).toEqual([]);
  });
});
