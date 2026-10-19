// W-50: results as well as faults — `pass` and `skipped` (not checked) entries, quiet by default
// (summary), marked on the sheet only when asked (marks or Show ▸), listed apart from problems.
import { afterEach, describe, expect, it } from 'vitest';
import axe from 'axe-core';
import { createWorkbook, SEVERITY, SEVERITY_ORDER, isResult, type Plugin, type SheetpaneError, type SheetpaneErrors, type SheetpaneExcel } from '../src/index.js';
import { cellEl, cleanup, frame, sampleXlsx, shadow, until } from './helpers.js';

afterEach(cleanup);
const $ = (el: Element, sel: string) => shadow(el).querySelector(sel) as HTMLElement;
const $$ = (el: Element, sel: string) => Array.from(shadow(el).querySelectorAll<HTMLElement>(sel));
let paneN = 0;

const FEE = 'Fee rate 0.00%–2.00%';
let idN = 0;
/** A host's result entry, as a saved review carries it. */
const result = (range: string, severity: 'pass' | 'skipped', message: string, extra: Partial<SheetpaneError> = {}): SheetpaneError => ({
  v: 1, id: `ERR-${String(++idN).padStart(4, '0')}`, sheet: 'Holdings', range, type: 'spec', severity, found: '', expected: '', message,
  cellChanged: false, status: 'open', matchesExpected: false, author: 'host', createdAt: '2026-10-19T09:00:00.000Z', ...extra,
});
/** The design's review: Fee rate checked on I3:I15 — I6 (7.5%) fails, I7 not checked, the rest pass; Ticker E3:E5 passes. */
function review(): SheetpaneError[] {
  const out: SheetpaneError[] = [];
  for (let r = 3; r <= 15; r++) {
    if (r === 6) out.push(result(`I${r}`, 'pass', FEE, { severity: 'error', type: 'wrong-value', message: 'Fee rate above 2.00%' }));
    else if (r === 7) out.push(result(`I${r}`, 'skipped', 'Blank in the source'));
    else out.push(result(`I${r}`, 'pass', FEE));
  }
  out.push(result('E3:E5', 'pass', 'Ticker in the master list'));
  out.push(result('K3', 'skipped', 'Column not in the spec'), result('K4', 'skipped', 'Column not in the spec'));
  return out;
}

async function pair(attrs: { excel?: Record<string, string>; errors?: Record<string, string> } = {}) {
  const pane = `r${++paneN}`;
  const excel = document.createElement('sheetpane-excel') as SheetpaneExcel;
  excel.setAttribute('pane', pane); excel.setAttribute('mode', 'edit'); excel.style.height = '600px';
  const errors = document.createElement('sheetpane-errors') as SheetpaneErrors;
  errors.setAttribute('pane', pane); errors.style.height = '600px';
  for (const [k, v] of Object.entries(attrs.excel ?? {})) excel.setAttribute(k, v);
  for (const [k, v] of Object.entries(attrs.errors ?? {})) errors.setAttribute(k, v);
  document.body.append(excel, errors);
  await excel.load(await sampleXlsx(), 'Client holdings — Q3 2026.xlsx');
  await frame();
  return { excel, errors };
}

describe('the schema (W-50 DoD 1)', () => {
  it('two more severities, named, ordered error › warning › note › skipped › pass; v1 entries without them load as before', async () => {
    expect(SEVERITY.pass).toMatchObject({ name: 'Passed', glyph: '✓' });
    expect(SEVERITY.skipped).toMatchObject({ name: 'Not checked', glyph: '—' });
    expect((['pass', 'skipped', 'note', 'warning', 'error'] as const).map((s) => SEVERITY_ORDER[s])).toEqual([1, 2, 3, 4, 5]);
    expect(isResult({ severity: 'pass' }) && isResult({ severity: 'skipped' }) && !isResult({ severity: 'note' })).toBe(true);
    const s = createWorkbook();
    await s.load(await sampleXlsx(), 'q3.xlsx');
    const v1 = [result('I6', 'pass', '', { severity: 'error', type: 'wrong-value' })];
    s.setErrors(v1);
    expect(s.getErrors()).toMatchObject([{ v: 1, severity: 'error' }]);
    s.setErrors(review());
    expect(s.resultCounts()).toEqual({ problems: 1, open: 1, pass: 14, skipped: 3 });
  });
  it('a validate plugin can report results; one it stops reporting goes (it never resolves)', async () => {
    let failing = false;
    const check: Plugin = { id: 'spec', provides: ['validate'], validate: (sheet) => (sheet === 'Holdings' ? [{ sheet, range: 'I3', type: 'fee', severity: failing ? 'error' : 'pass', found: '0.75%', expected: '', message: FEE, author: 'workbook' }, ...(failing ? [] : [{ sheet, range: 'I4', type: 'fee', severity: 'skipped' as const, found: '', expected: '', message: 'Blank', author: 'workbook' }])] : []) };
    const s = createWorkbook({ plugins: [check] });
    await s.load(await sampleXlsx(), 'q3.xlsx');
    expect(s.getErrors().map((e) => [e.range, e.severity])).toEqual([['I3', 'pass'], ['I4', 'skipped']]);
    failing = true;
    s.setCell('Holdings', 'B3', 'x');
    expect(s.getErrors().map((e) => [e.range, e.severity, e.status])).toEqual([['I3', 'error', 'open']]);
  });
  it('results="off": results are dropped on arrival — setErrors, validate, addError — and switching to off drops those held', async () => {
    const s = createWorkbook();
    await s.load(await sampleXlsx(), 'q3.xlsx');
    s.setErrors(review());
    s.setResults('off');
    expect(s.getErrors().map((e) => e.severity)).toEqual(['error']);
    s.setErrors(review());
    expect(s.getErrors().filter(isResult)).toHaveLength(0);
    s.addError({ sheet: 'Holdings', range: 'I3', type: 'spec', severity: 'pass' });
    expect(s.getErrors().filter(isResult)).toHaveLength(0);
    const check: Plugin = { id: 'spec2', provides: ['validate'], validate: (sheet) => [{ sheet, range: 'A1', type: 'x', severity: 'pass', found: '', expected: '', message: '', author: 'workbook' }] };
    const t = createWorkbook({ plugins: [check] });
    t.setResults('off');
    await t.load(await sampleXlsx(), 'q3.xlsx');
    expect(t.getErrors()).toHaveLength(0);
  });
  it('resultAt: a problem always wins; a range result covers its cells', async () => {
    const s = createWorkbook();
    await s.load(await sampleXlsx(), 'q3.xlsx');
    s.setErrors([...review(), result('I3', 'pass', '', { severity: 'note', type: 'other' })]);
    expect(s.resultAt('Holdings', 2, 8)).toBeUndefined(); // I3: a note there
    expect(s.resultAt('Holdings', 5, 8)).toBeUndefined(); // I6: the error
    expect(s.resultAt('Holdings', 3, 8)?.severity).toBe('pass');
    expect(s.resultAt('Holdings', 6, 8)?.severity).toBe('skipped');
    expect(s.resultAt('Holdings', 3, 4)?.message).toBe('Ticker in the master list'); // E4 inside E3:E5
  });
});

describe('the levels and the mark (W-50 DoD 2)', () => {
  it('summary (the default): nothing on the sheet, the status line says how much was checked', async () => {
    const { excel } = await pair();
    excel.setErrors(review());
    await frame();
    expect(excel.results).toBe('summary');
    expect($$(excel, '.rmk')).toHaveLength(0);
    expect($(excel, '.status').textContent).toContain('15 of 18 checked · 1 problem');
  });
  it('results="marks" on the errors element marks the sheet (pane-wide, L7): a 9 px ✓ or — at the bottom-left, labelled, no fill, no pin', async () => {
    const { excel, errors } = await pair({ errors: { results: 'marks' } });
    excel.setErrors(review());
    await frame();
    expect(excel.results).toBe('marks');
    const i4 = cellEl(excel, 3, 8)!, mk = i4.querySelector<HTMLElement>('.rmk')!;
    expect(mk.textContent).toBe('✓');
    expect(mk.getAttribute('role')).toBe('img');
    expect(mk.getAttribute('aria-label')).toBe(`Passed: ${FEE}`);
    const cs = getComputedStyle(mk), cell = i4.getBoundingClientRect(), box = mk.getBoundingClientRect();
    expect(Math.abs(parseFloat(cs.fontSize) - 9)).toBeLessThan(0.6);
    expect(box.left - cell.left).toBeLessThan(6);
    expect(cell.bottom - box.bottom).toBeLessThan(6);
    expect(cs.color).toBe('rgb(22, 112, 62)'); // --sp-pass
    expect([...i4.classList].some((c) => c.startsWith('m-'))).toBe(false); // no fill, no border
    const i7 = cellEl(excel, 6, 8)!.querySelector('.rmk')!;
    expect(i7.textContent).toBe('—');
    expect(i7.getAttribute('aria-label')).toBe('Not checked: Blank in the source');
    expect(cellEl(excel, 5, 8)!.querySelector('.rmk')).toBeNull(); // a problem always wins
    expect(cellEl(excel, 5, 8)!.classList.contains('m-error')).toBe(true);
    expect($$(excel, '.pin')).toHaveLength(1); // the error's pin only
    expect($(excel, '.rh[data-hr="3"]').textContent).toBe('4'); // nothing in the row header for a result
    expect($(excel, '.rh[data-hr="5"] .g-error')).not.toBeNull();
    errors.results = 'summary';
    await frame();
    expect($$(excel, '.rmk')).toHaveLength(0);
  });
  it('the marks show in View too', async () => {
    const { excel } = await pair({ excel: { results: 'marks', mode: 'view' } });
    excel.setErrors(review());
    await frame();
    expect(cellEl(excel, 3, 8)!.querySelector('.rmk')).not.toBeNull();
  });
  it('the On sheet switch moves summary ↔ marks; it is no change and no undo step', async () => {
    const { excel, errors } = await pair();
    excel.setErrors(review());
    await frame();
    const sw = $(errors, '.summary [role=switch]');
    expect(sw.getAttribute('aria-checked')).toBe('false');
    sw.click();
    await frame();
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect($$(excel, '.rmk').length).toBeGreaterThan(0);
    expect(excel.workbook!.getSnapshot().canUndo).toBe(false);
    expect(excel.workbook!.changeCount).toBe(0);
    sw.click();
    await frame();
    expect($$(excel, '.rmk')).toHaveLength(0);
  });
  it('selecting a result cell names its check in the cell bar', async () => {
    const { excel } = await pair();
    excel.setErrors(review());
    excel.select('Holdings', 'I4');
    await frame();
    expect($(excel, '.fx .result').hidden).toBe(false);
    expect($(excel, '.fx .result').textContent).toBe(`✓ Passed · ${FEE}`);
    excel.select('Holdings', 'I7');
    await frame();
    expect($(excel, '.fx .result').textContent).toBe('— Not checked · Blank in the source');
    excel.select('Holdings', 'I6');
    await frame();
    expect($(excel, '.fx .result').hidden).toBe(true);
    expect($(excel, '.fx .chip-fail').textContent).toContain('Error'); // the problem's chip instead
  });
  it('axe: clean with the marks on and with the Passed group open', async () => {
    const { excel, errors } = await pair({ excel: { results: 'marks' } });
    excel.setErrors(review());
    excel.select('Holdings', 'I4');
    await frame();
    ($(errors, '[data-act=view][data-v=pass]')).click();
    await frame();
    ($(errors, '.rgrp [data-act=group]')).click();
    await frame();
    for (const el of [excel, errors]) {
      const r = await axe.run(el);
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    }
  });
});

describe('counts ask for action: problems only (W-50 DoD 3)', () => {
  it('tab counts, the toolbar counts, the panel header and the severity filters leave results out; results alone never make a review to download', async () => {
    const seen: unknown[] = [];
    const writer: Plugin = { id: 'writer', provides: ['exportPatch'], exportPatch: () => { seen.push(1); } };
    const { excel, errors } = await pair();
    excel.workbook = createWorkbook({ plugins: [writer] });
    errors.workbook = excel.workbook;
    await excel.load(await sampleXlsx(), 'Client holdings — Q3 2026.xlsx');
    excel.setErrors(review().filter(isResult));
    await frame();
    expect($(excel, '.tab[data-sheet="Holdings"] .cnt')).toBeNull();
    expect($(excel, '.counts').textContent).toContain('✕ 0');
    expect($(errors, '.opencount').textContent).toBe('0 open');
    expect($(excel, 'button.export').title).toBe('Download the file as it was opened');
    excel.setErrors(review());
    await frame();
    expect($(excel, '.tab[data-sheet="Holdings"] .cnt').textContent).toBe('1');
    expect($(errors, '.opencount').textContent).toBe('1 open');
    expect($(errors, '[data-act=filter][data-v=all]').textContent).toBe('All 1');
    expect($(excel, 'button.export .badge-n').hidden).toBe(true);
  });
});

describe('the list (W-50 DoD 4)', () => {
  it('the summary line and the chips show only when results exist; Problems is the default', async () => {
    const { excel, errors } = await pair();
    expect($(errors, '.summary').hidden).toBe(true);
    expect($$(errors, '[data-act=view]').map((b) => b.dataset.v)).toEqual(['problems', 'edits']); // no result chips; Edits in Edit mode (W-64)
    excel.setErrors(review());
    await frame();
    expect($(errors, '.summary').hidden).toBe(false);
    expect($(errors, '.summary .sumtext').textContent).toBe('1 problem✓ 14 passed— 3 not checked');
    expect($$(errors, '[data-act=view]').map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([['Problems 1', 'true'], ['✓ Passed 14', 'false'], ['— Not checked 3', 'false'], ['Edits 0', 'false']]);
    expect($$(errors, '.list [data-sp-error]').map((r) => r.dataset.spRef)).toEqual(['Holdings!I6']);
  });
  it('Passed groups by check, Not checked by reason — a count, the range, Show ▸', async () => {
    const { excel, errors } = await pair();
    excel.setErrors(review());
    await frame();
    $(errors, '[data-act=view][data-v=pass]').click();
    await frame();
    const rows = () => $$(errors, '.rgrp').map((g) => g.querySelector('.issue')!.textContent);
    expect(rows()).toEqual([`✓Passed: ${FEE}11 cells · I3, I4, I5 …`, '✓Passed: Ticker in the master list3 cells · E3:E5']);
    expect($$(errors, '[data-act=filter]')).toHaveLength(0); // severity filters belong to Problems
    $(errors, '[data-act=view][data-v=skipped]').click();
    await frame();
    expect(rows()).toEqual(['—Not checked: Column not in the spec2 cells · K3:K4', '—Not checked: Blank in the source1 cell · I7']);
  });
  it('with W-55 and W-69: the Problems view keeps the Workbook / whole-sheet groups and the Accepted chip; counts leave out results and accepted errors alike', async () => {
    const { excel, errors } = await pair();
    const extra = [
      result('', 'pass', 'No Pages List', { severity: 'error', type: 'other', author: 'Arpit' }), // whole sheet
      result('', 'pass', 'A listed tab has no sheet', { sheet: '', severity: 'warning', type: 'other', author: 'Arpit' }), // workbook
      result('C4', 'pass', 'Known', { severity: 'note', type: 'other', author: 'Arpit', status: 'accepted', acceptedBy: 'Ravi', acceptedAt: '2026-10-19T09:00:00.000Z', reason: 'Approved' }),
    ];
    excel.setErrors([...review(), ...extra]);
    await frame();
    expect($(errors, '.opencount').textContent).toBe('3 open');
    expect($(errors, '.summary .sumtext').textContent).toBe('3 problems✓ 14 passed— 3 not checked');
    expect($$(errors, '[data-act=view]').map((b) => b.textContent)).toEqual(['Problems 3', '✓ Passed 14', '— Not checked 3', 'Edits 0']);
    expect($(errors, '[data-act=filter][data-v=all]').textContent).toBe('All 3');
    expect($(errors, '[data-act=status][data-v=accepted]').textContent).toBe('Accepted 1');
    expect($$(errors, '.list .grp').map((g) => g.textContent)).toEqual(['Workbook', 'Holdings · whole sheet', 'Cells']);
    expect($(excel, '.tab[data-sheet="Holdings"] .cnt').textContent).toBe('2'); // I6 and the whole-sheet error
    $(errors, '[data-act=view][data-v=pass]').click();
    await frame();
    expect($$(errors, '[data-act=filter], [data-act=status]')).toHaveLength(0); // the problem filters belong to Problems
    expect($$(errors, '.list .grp')).toHaveLength(0);
    expect($$(errors, '.rgrp')).toHaveLength(2);
  });
  it('Show ▸ selects the group’s range and marks it, even at summary; Show in sheet works from a result row', async () => {
    const { excel, errors } = await pair();
    excel.setErrors(review());
    await frame();
    const reveals: SheetpaneError[] = [];
    errors.addEventListener('sheetpane-reveal', (e) => reveals.push((e as CustomEvent).detail.error));
    $(errors, '[data-act=view][data-v=pass]').click();
    await frame();
    $$(errors, '.rgrp')[1]!.querySelector<HTMLElement>('[data-act=show-group]')!.click();
    await frame();
    expect(excel.workbook!.getSnapshot().selection).toMatchObject({ sheet: 'Holdings', ref: 'E3', range: 'E3:E5' });
    expect(reveals[0]).toMatchObject({ range: 'E3:E5', severity: 'pass' });
    expect(excel.results).toBe('summary');
    expect(cellEl(excel, 3, 4)!.querySelector('.rmk')).not.toBeNull(); // E4: in the shown range
    expect(cellEl(excel, 3, 8)!.querySelector('.rmk')).toBeNull(); // I4: not shown
    $$(errors, '.rgrp')[0]!.querySelector<HTMLElement>('[data-act=group]')!.click();
    await frame();
    const row = $(errors, '.cellrow[data-sp-ref="Holdings!I9"]');
    row.click();
    await frame();
    expect(excel.workbook!.getSnapshot().selection).toMatchObject({ sheet: 'Holdings', ref: 'I9' });
    expect(reveals[1]).toMatchObject({ range: 'I9', severity: 'pass' });
    expect(cellEl(excel, 8, 8)!.querySelector('.rmk')).not.toBeNull();
  });
  it('Show in sheet works for all five severities', async () => {
    const { excel, errors } = await pair();
    const list = [result('A3', 'pass', 'x', { severity: 'error' }), result('A4', 'pass', 'x', { severity: 'warning' }), result('A5', 'pass', 'x', { severity: 'note' }), result('A6', 'pass', 'p'), result('A7', 'skipped', 's')];
    excel.setErrors(list);
    await frame();
    const reveals: string[] = [];
    errors.addEventListener('sheetpane-reveal', (e) => reveals.push((e as CustomEvent).detail.error.severity));
    for (const id of list.slice(0, 3).map((e) => e.id)) {
      $(errors, `[data-sp-error="${id}"] [data-act=pick]`).click();
      await frame();
      $(errors, `[data-sp-error="${id}"] [data-act=reveal]`).click();
    }
    for (const v of ['pass', 'skipped']) {
      $(errors, `[data-act=view][data-v=${v}]`).click();
      await frame();
      $(errors, '.rgrp [data-act=show-group]').click();
    }
    expect(reveals).toEqual(['error', 'warning', 'note', 'pass', 'skipped']);
  });
  it('thousands of passes: two list rows, and an opened group draws only the rows it shows', async () => {
    const rows = Array.from({ length: 5000 }, (_, i) => `${i},v${i}`).join('\n');
    const pane = `r${++paneN}`;
    const excel = document.createElement('sheetpane-excel') as SheetpaneExcel;
    excel.setAttribute('pane', pane); excel.style.height = '600px';
    const errors = document.createElement('sheetpane-errors') as SheetpaneErrors;
    errors.setAttribute('pane', pane); errors.style.height = '600px';
    document.body.append(excel, errors);
    await excel.load(new TextEncoder().encode(rows), 'many.csv');
    const list: SheetpaneError[] = [];
    const sheet = excel.workbook!.getSnapshot().book!.sheets[0]!.name;
    for (let i = 0; i < 5000; i++) list.push({ ...result(`B${i + 1}`, 'pass', i % 2 ? 'Even check' : 'Odd check'), sheet });
    excel.setErrors(list);
    await frame();
    $(errors, '[data-act=view][data-v=pass]').click();
    await frame();
    expect($$(errors, '.list > .rgrp')).toHaveLength(2);
    expect($(errors, '.rgrp .m').textContent).toBe('2500 cells · B2, B4, B6 …'); // Even check sorts first
    $(errors, '.rgrp [data-act=group]').click();
    await frame();
    const box = $(errors, '.cells');
    expect($$(errors, '.cellrow').length).toBeLessThan(20);
    box.scrollTop = 2400 * 28;
    await until(() => !!shadow(errors).querySelector(`.cellrow[data-sp-ref="${sheet}!B4802"]`));
    expect($$(errors, '.cellrow').length).toBeLessThan(20);
    expect(shadow(errors).activeElement?.getAttribute('data-act')).toBe('group'); // the toggled group keeps focus
  });
});
