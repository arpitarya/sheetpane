import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import axe from 'axe-core';
import type { SheetpaneErrors, SheetpaneExcel } from '../src/index.js';
import { cellEl, cleanup, frame, sampleXlsx, shadow } from './helpers.js';

afterEach(cleanup);
const $ = (el: Element, sel: string) => shadow(el).querySelector(sel) as HTMLElement;
let paneN = 0;

/** Sheet and errors on one pane, in two containers — the errors one inside a <dialog> — in either order (testing verdict decision 9). */
async function pair(order: 'excel-first' | 'errors-first' = 'excel-first', attrs: Record<string, string> = {}) {
  const pane = `p${++paneN}`;
  const left = document.createElement('div');
  const dialog = document.createElement('dialog');
  document.body.append(left, dialog);
  dialog.show();
  const excel = document.createElement('sheetpane-excel') as SheetpaneExcel;
  excel.setAttribute('pane', pane); excel.setAttribute('mode', 'edit'); excel.style.height = '600px';
  const errors = document.createElement('sheetpane-errors') as SheetpaneErrors;
  errors.setAttribute('pane', pane); errors.style.height = '600px';
  for (const [k, v] of Object.entries(attrs)) errors.setAttribute(k, v);
  if (order === 'excel-first') { left.append(excel); dialog.append(errors); } else { dialog.append(errors); left.append(excel); }
  await excel.load(await sampleXlsx(), 'Client holdings — Q3 2026.xlsx');
  await frame();
  return { excel, errors };
}

describe('<sheetpane-errors> (W-02)', () => {
  it('registers on import; DOM-only contract', () => {
    expect(customElements.get('sheetpane-errors')).toBeDefined();
  });
  it('Flag issue in the sheet opens the form here, not in the sheet; Add error lands in both', async () => {
    const { excel, errors } = await pair();
    excel.select('Holdings', 'G7');
    await frame();
    $(excel, '.grid').focus();
    await userEvent.keyboard('f');
    await frame();
    expect($(excel, '.composer')).toBeNull();
    expect($(excel, '.hint').hidden).toBe(false);
    const form = $(errors, '.form');
    expect(form.textContent).toContain('Price (G)');
    expect(form.textContent).toContain('Found286.4');
    ($(errors, '.tchip[data-v="mismatch-source"]') as HTMLButtonElement).click();
    await frame();
    await userEvent.fill($(errors, '[data-field=expected]') as HTMLInputElement, '268.4');
    ($(errors, '[data-field=change]') as HTMLInputElement).click();
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}');
    await frame();
    expect(errors.getErrors()).toMatchObject([{ range: 'G7', type: 'mismatch-source', severity: 'error', found: '286.4', expected: '268.4', cellChanged: true, matchesExpected: true }]);
    expect($(excel, '.pin').textContent).toBe('1');
    expect(cellEl(excel, 6, 6)!.textContent).toBe('268.4');
    expect($(errors, '.list').textContent).toContain('matches suggestion');
  });
  it('the list filters by severity; picking a row selects the cell; Resolve turns the pin ✓; Delete keeps the change', async () => {
    const { excel, errors } = await pair();
    const s = excel.workbook!;
    s.addError({ sheet: 'Holdings', range: 'G7', type: 'mismatch-source', severity: 'error', expected: '268.4' });
    const w = s.addError({ sheet: 'Holdings', range: 'A8', type: 'wrong-format', severity: 'warning', expected: 'AC-10044', cellChanged: true });
    await frame();
    expect($(errors, '.opencount').textContent).toBe('2 open');
    ($(errors, '[data-act=filter][data-v=warning]') as HTMLButtonElement).click();
    await frame();
    expect(shadow(errors).querySelectorAll('.item').length).toBe(1);
    ($(errors, `[data-id="${w.id}"] .issue`) as HTMLButtonElement).click();
    await frame();
    expect(s.getSnapshot().selection.ref).toBe('A8');
    ($(errors, '[data-act=resolve]') as HTMLButtonElement).click();
    await frame();
    expect([...shadow(excel).querySelectorAll('.pin')].map((p) => p.textContent).sort()).toEqual(['1', '✓']);
    ($(errors, '[data-act=delete]') as HTMLButtonElement).click();
    await frame();
    expect(errors.getErrors()).toHaveLength(1);
    expect(s.text('Holdings', 'A8')).toBe('AC-10044');
  });
  it('Show in sheet dispatches sheetpane-reveal (bubbling, composed) and selects the cell', async () => {
    const { excel, errors } = await pair();
    const e = excel.workbook!.addError({ sheet: 'Fee tiers', range: 'D6', type: 'other', severity: 'note' });
    await frame();
    let got: unknown;
    document.addEventListener('sheetpane-reveal', (ev) => { got = (ev as CustomEvent).detail; }, { once: true });
    ($(errors, `[data-id="${e.id}"] .issue`) as HTMLButtonElement).click();
    await frame();
    ($(errors, '[data-act=reveal]') as HTMLButtonElement).click();
    expect(got).toMatchObject({ error: { id: e.id, sheet: 'Fee tiers', range: 'D6' } });
    expect(excel.workbook!.getSnapshot().selection).toEqual({ sheet: 'Fee tiers', ref: 'D6' });
  });
  it('readonly hides the form, Resolve and Delete', async () => {
    const { excel, errors } = await pair('excel-first', { readonly: '' });
    excel.workbook!.addError({ sheet: 'Holdings', range: 'G7', type: 'other', severity: 'error' });
    excel.workbook!.compose({ sheet: 'Holdings', ref: 'G7' });
    await frame();
    expect($(errors, '.form')).toBeNull();
    ($(errors, '.issue') as HTMLButtonElement).click();
    await frame();
    expect($(errors, '[data-act=resolve]')).toBeNull();
    expect($(errors, '[data-act=delete]')).toBeNull();
    expect($(errors, '[data-act=reveal]')).not.toBeNull();
  });
  it('errorTypes replaces the catalog; setErrors / the errors property round-trip a saved review', async () => {
    const { excel, errors } = await pair();
    errors.errorTypes = [{ id: 'late', name: 'Late', severity: 'note', why: 'x', expected: '' }];
    excel.workbook!.compose({ sheet: 'Holdings', ref: 'B3' });
    await frame();
    expect([...shadow(errors).querySelectorAll('.tchip')].map((b) => b.textContent)).toEqual(['Late']);
    const saved = excel.workbook!.addError({ sheet: 'Holdings', range: 'B3', type: 'late', severity: 'note' });
    const list = errors.errors;
    excel.workbook!.deleteError(saved.id);
    errors.errors = list;
    expect(excel.getErrors().map((e) => e.id)).toEqual([saved.id]);
  });
  it('dispatches sheetpane-errors {errors, plugins} on every add, change, resolve and delete', async () => {
    const { excel, errors } = await pair();
    const seen: number[] = [];
    errors.addEventListener('sheetpane-errors', (e) => seen.push((e as CustomEvent).detail.errors.length));
    excel.workbook!.compose({ sheet: 'Holdings', ref: 'G7' });
    await frame();
    ($(errors, '[data-act=add]') as HTMLButtonElement).click();
    await frame();
    ($(errors, '.issue') as HTMLButtonElement).click();
    await frame();
    ($(errors, '[data-act=resolve]') as HTMLButtonElement).click();
    ($(errors, '[data-act=delete]') as HTMLButtonElement).click();
    expect(seen).toEqual([1, 1, 0]);
  });
  it('shows the "formatted differently" notice when a saved review used another plugin set', async () => {
    const { errors } = await pair();
    errors.setErrors([], { plugins: ['numfmt'] });
    await frame();
    expect($(errors, '.notice').textContent).toContain('formatted differently');
  });
  it('renders in the host font; no axe violations', async () => {
    const { excel, errors } = await pair();
    errors.style.fontFamily = 'Georgia, serif';
    excel.workbook!.addError({ sheet: 'Holdings', range: 'G7', type: 'other', severity: 'error' });
    excel.workbook!.compose({ sheet: 'Holdings', ref: 'B3' });
    await frame();
    for (const sel of ['.issue', '.tchip', 'textarea', 'input']) expect(getComputedStyle($(errors, sel)).fontFamily).toBe('Georgia, serif');
    const r = await axe.run(errors);
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
});

describe('always in sync (SR-LAW-7, B-020)', () => {
  for (const order of ['excel-first', 'errors-first'] as const) {
    it(`a change, an error, a resolve and a selection in one show in the other within a frame (${order})`, async () => {
      const { excel, errors } = await pair(order);
      const s = errors.workbook!;
      expect(s).toBe(excel.workbook);
      // a change through the sheet's cell bar …
      excel.select('Holdings', 'I6');
      await frame();
      await userEvent.fill($(excel, '.cell') as HTMLInputElement, '0.75%');
      await userEvent.keyboard('{Enter}');
      excel.select('Holdings', 'I6');
      // … an error made in the errors element, about it …
      s.compose({ sheet: 'Holdings', ref: 'I6' });
      await frame();
      await userEvent.fill($(errors, '[data-field=expected]') as HTMLInputElement, '0.75%');
      ($(errors, '[data-act=add]') as HTMLButtonElement).click();
      await frame();
      expect($(errors, '.list').textContent).toContain('matches suggestion');
      expect($(excel, '.pin').textContent).toBe('1');
      // … resolved in the sheet's callout …
      ($(excel, '.callout [data-act=resolve]') as HTMLButtonElement).click();
      await frame();
      expect($(errors, '.item').classList.contains('done')).toBe(true);
      // … and a selection from the list moves the sheet.
      const e2 = s.addError({ sheet: 'Fee tiers', range: 'D4', type: 'other', severity: 'note' });
      await frame();
      ($(errors, `[data-id="${e2.id}"] .issue`) as HTMLButtonElement).click();
      await frame();
      expect((shadow(excel).querySelector('.tab[aria-selected=true]') as HTMLElement).dataset.sheet).toBe('Fee tiers');
      expect(shadow(excel).querySelector('.grid')!.getAttribute('aria-activedescendant')).toBe('c3_3');
    });
  }
});

describe('stable codes (W-40)', () => {
  it('a rules-engine note shows its SP code in the expanded row', async () => {
    const { excel, errors } = await pair();
    excel.columns = { Nowhere: { required: true } };
    let note: { id: string; code?: string } | undefined;
    for (let i = 0; i < 100 && !note; i++) { await frame(); note = excel.getErrors().find((e) => e.severity === 'note'); }
    expect(note?.code).toBe('SP-6023');
    await frame();
    ($(errors, `[data-id="${note!.id}"] .issue`) as HTMLButtonElement).click();
    await frame();
    expect($(errors, '.detail').textContent).toContain('SP-6023');
  });
});
