import { describe, expect, it } from 'vitest';
import { createWorkbook, type Plugin, type SheetpaneError } from '@sheetpane/grid';
import features from '../../import/test/fixtures/exceljs-features.xlsx?inline';
import { skippedRules, validation } from '../src/index.js';
import { shiftFormula } from '../src/rules.js';
import { fromDataUrl, workbook, type Dv, type SheetSpec } from './helpers.js';

const open = (es: readonly SheetpaneError[]) => es.filter((e) => e.status === 'open');
const at = (es: readonly SheetpaneError[], sheet: string, range: string) => es.find((e) => e.sheet === sheet && e.range === range);

async function storeWith(sheets: SheetSpec[], names: { name: string; formula: string; localSheetId?: number }[] = [], plugins: Plugin[] = [validation()]) {
  const s = createWorkbook({ plugins });
  await s.load(await workbook(sheets, names), 'rules.xlsx');
  return s;
}

describe('the ExcelJS fixture: whole > 0 on B3:B5, list "Core,Income,Cap" on J3:J5 (DoD 3, 7)', () => {
  const load = async () => { const s = createWorkbook({ plugins: [validation()] }); await s.load(fromDataUrl(features), 'features.xlsx'); return s; };

  it('loads clean: every cell passes', async () => {
    const s = await load();
    expect(s.getErrors()).toEqual([]);
  });

  it('an edit that breaks a rule is one workbook warning; the rule text and the file’s own message', async () => {
    const s = await load();
    s.setCell('Holdings', 'B4', '-5');
    expect(s.getErrors()).toEqual([expect.objectContaining({
      sheet: 'Holdings', range: 'B4', type: 'validation', severity: 'warning', author: 'workbook', status: 'open',
      found: '-5', expected: 'whole number > 0', message: 'Units: Units must be positive',
    })]);
  });

  it('edit → resolve; edit back → reopen, the same error; undo and redo follow', async () => {
    const s = await load();
    s.setCell('Holdings', 'B4', '-5');
    const id = s.getErrors()[0]!.id;
    s.setCell('Holdings', 'B4', '430');
    expect(s.getErrors()).toEqual([expect.objectContaining({ id, status: 'resolved' })]);
    s.setCell('Holdings', 'B4', '0');
    expect(s.getErrors()).toEqual([expect.objectContaining({ id, status: 'open' })]);
    s.setCell('Holdings', 'B4', '12.5');
    expect(s.getErrors()).toEqual([expect.objectContaining({ id, status: 'open' })]); // not a whole number
    s.undo();
    expect(open(s.getErrors())).toHaveLength(1); // back to 0
    s.undo(); // back to 430
    expect(s.getErrors()).toEqual([expect.objectContaining({ id, status: 'resolved' })]);
    s.redo();
    expect(s.getErrors()).toEqual([expect.objectContaining({ id, status: 'open' })]);
  });

  it('a list cell outside the list fails; a choice in any case passes; a blank passes (allowBlank)', async () => {
    const s = await load();
    s.setCell('Holdings', 'J3', 'Bogus');
    expect(at(s.getErrors(), 'Holdings', 'J3')).toMatchObject({ found: 'Bogus', expected: 'list — Core, Income, Cap', message: 'list — Core, Income, Cap', status: 'open' });
    s.setCell('Holdings', 'J3', 'income');
    expect(at(s.getErrors(), 'Holdings', 'J3')!.status).toBe('resolved');
    s.setCell('Holdings', 'J3', null);
    expect(at(s.getErrors(), 'Holdings', 'J3')!.status).toBe('resolved');
  });

  it('counts nothing skipped', async () => {
    const s = await load();
    expect(skippedRules(s)).toEqual({ rules: 2, checked: 2, skipped: [] });
  });
});

// Row i: A{i} passes, B{i} fails — the rule covers both cells.
const cases: { rule: Omit<Dv, 'sqref'>; pass: number | string; fail: number | string; words?: string }[] = [
  { rule: { type: 'whole', operator: 'between', f1: '1', f2: '10' }, pass: 5, fail: 11, words: 'whole number between 1 and 10' },
  { rule: { type: 'whole', f1: '1', f2: '10' }, pass: 10, fail: 0, words: 'whole number between 1 and 10' }, // no operator = between
  { rule: { type: 'whole', operator: 'notBetween', f1: '1', f2: '10' }, pass: 11, fail: 5, words: 'whole number not between 1 and 10' },
  { rule: { type: 'whole', operator: 'equal', f1: '3' }, pass: 3, fail: 4, words: 'whole number = 3' },
  { rule: { type: 'whole', operator: 'notEqual', f1: '3' }, pass: 4, fail: 3, words: 'whole number ≠ 3' },
  { rule: { type: 'whole', operator: 'greaterThan', f1: '0' }, pass: 1, fail: 0, words: 'whole number > 0' },
  { rule: { type: 'whole', operator: 'lessThan', f1: '10' }, pass: 9, fail: 10, words: 'whole number < 10' },
  { rule: { type: 'whole', operator: 'greaterThanOrEqual', f1: '0' }, pass: 0, fail: -1, words: 'whole number ≥ 0' },
  { rule: { type: 'whole', operator: 'lessThanOrEqual', f1: '10' }, pass: 10, fail: 11, words: 'whole number ≤ 10' },
  { rule: { type: 'whole', operator: 'between', f1: '1', f2: '10' }, pass: 5, fail: 5.5 },
  { rule: { type: 'whole', operator: 'greaterThan', f1: '0' }, pass: 2, fail: 'two' },
  { rule: { type: 'decimal', operator: 'between', f1: '0', f2: '0.02' }, pass: 0.0075, fail: 0.075, words: 'decimal between 0 and 0.02' },
  { rule: { type: 'decimal', operator: 'notBetween', f1: '0', f2: '1' }, pass: 1.5, fail: 0.5 },
  { rule: { type: 'decimal', operator: 'equal', f1: '1.5' }, pass: 1.5, fail: 1.25 },
  { rule: { type: 'decimal', operator: 'notEqual', f1: '1.5' }, pass: 1.25, fail: 1.5 },
  { rule: { type: 'decimal', operator: 'greaterThan', f1: '1.5' }, pass: 2, fail: 1.5 },
  { rule: { type: 'decimal', operator: 'lessThan', f1: '1.5' }, pass: 1, fail: 1.5 },
  { rule: { type: 'decimal', operator: 'greaterThanOrEqual', f1: '-0.5' }, pass: -0.5, fail: -0.6 },
  { rule: { type: 'decimal', operator: 'lessThanOrEqual', f1: '2.5' }, pass: 2.5, fail: 2.6, words: 'decimal ≤ 2.5' },
  { rule: { type: 'date', operator: 'between', f1: '46204', f2: '46295' }, pass: 46295, fail: 46296, words: 'date between 01-Jul-2026 and 30-Sep-2026' },
  { rule: { type: 'date', operator: 'notBetween', f1: '46204', f2: '46295' }, pass: 46296, fail: 46204 },
  { rule: { type: 'date', operator: 'equal', f1: 'DATE(2026,9,30)' }, pass: 46295, fail: 46294, words: 'date = 30-Sep-2026' },
  { rule: { type: 'date', operator: 'notEqual', f1: '46295' }, pass: 46294, fail: 46295 },
  { rule: { type: 'date', operator: 'greaterThan', f1: '46295' }, pass: 46296, fail: 46295 },
  { rule: { type: 'date', operator: 'lessThan', f1: '46295' }, pass: 46294, fail: 46295 },
  { rule: { type: 'date', operator: 'greaterThanOrEqual', f1: 'DATE(2026,7,1)' }, pass: 46204, fail: 46203, words: 'date ≥ 01-Jul-2026' },
  { rule: { type: 'date', operator: 'lessThanOrEqual', f1: '46295' }, pass: 46295, fail: 'soon' },
  { rule: { type: 'time', operator: 'between', f1: '0.375', f2: '0.75' }, pass: 0.5, fail: 0.8, words: 'time between 09:00 and 18:00' },
  { rule: { type: 'time', operator: 'notBetween', f1: '0.375', f2: '0.75' }, pass: 0.25, fail: 0.5 },
  { rule: { type: 'time', operator: 'equal', f1: 'TIME(12,0,0)' }, pass: 0.5, fail: 0.25, words: 'time = 12:00' },
  { rule: { type: 'time', operator: 'notEqual', f1: '0.5' }, pass: 0.25, fail: 0.5 },
  { rule: { type: 'time', operator: 'greaterThan', f1: '0.5' }, pass: 0.75, fail: 0.5 },
  { rule: { type: 'time', operator: 'lessThan', f1: '0.5' }, pass: 0.25, fail: 0.5 },
  { rule: { type: 'time', operator: 'greaterThanOrEqual', f1: 'TIME(9,30,15)' }, pass: 0.5, fail: 0.25, words: 'time ≥ 09:30:15' },
  { rule: { type: 'time', operator: 'lessThanOrEqual', f1: '0.5' }, pass: 0.5, fail: 0.75 },
  { rule: { type: 'textLength', operator: 'between', f1: '2', f2: '4' }, pass: 'abc', fail: 'abcde', words: 'text length between 2 and 4 characters' },
  { rule: { type: 'textLength', operator: 'notBetween', f1: '2', f2: '4' }, pass: 'a', fail: 'abc' },
  { rule: { type: 'textLength', operator: 'equal', f1: '3' }, pass: 123, fail: 1234 },
  { rule: { type: 'textLength', operator: 'notEqual', f1: '3' }, pass: 'ab', fail: 'abc' },
  { rule: { type: 'textLength', operator: 'greaterThan', f1: '3' }, pass: 'abcd', fail: 'abc' },
  { rule: { type: 'textLength', operator: 'lessThan', f1: '3' }, pass: 'ab', fail: 'abc' },
  { rule: { type: 'textLength', operator: 'greaterThanOrEqual', f1: '3' }, pass: 'abc', fail: 'ab' },
  { rule: { type: 'textLength', operator: 'lessThanOrEqual', f1: '5' }, pass: 'abcde', fail: 'abcdef', words: 'text length ≤ 5 characters' },
  { rule: { type: 'list', f1: '"a,b,c"' }, pass: 'b', fail: 'd', words: 'list — a, b, c' },
  { rule: { type: 'list', f1: '"1,2,3"' }, pass: 2, fail: 4 },
  { rule: { type: 'whole', operator: 'lessThanOrEqual', f1: '$G$1' }, pass: 100, fail: 101, words: 'whole number ≤ 100' },
  { rule: { type: 'whole', operator: 'greaterThan', f1: 'Floor' }, pass: 6, fail: 5, words: 'whole number > 5' }, // a defined name
  { rule: { type: 'whole', operator: 'greaterThan', f1: '0', showErrorMessage: false }, pass: 1, fail: -1 }, // still validates
];

describe('every rule type and every operator (DoD 2)', () => {
  const cells: Record<string, string | number> = { G1: 100, G2: 5 };
  cases.forEach((c, i) => { cells[`A${i + 1}`] = c.pass; cells[`B${i + 1}`] = c.fail; });
  const rules: Dv[] = cases.map((c, i) => ({ ...c.rule, sqref: `A${i + 1}:B${i + 1}` }));
  const names = [{ name: 'Floor', formula: 'Rules!$G$2' }];

  it('each A cell passes and each B cell fails, with the rule in words', async () => {
    const s = await storeWith([{ name: 'Rules', cells, rules }], names);
    const errs = s.getErrors();
    expect(errs.map((e) => e.range).sort()).toEqual(cases.map((_, i) => `B${i + 1}`).sort());
    cases.forEach((c, i) => {
      const e = at(errs, 'Rules', `B${i + 1}`)!;
      expect(e, `case ${i}: ${JSON.stringify(c.rule)}`).toMatchObject({ type: 'validation', severity: 'warning', author: 'workbook', status: 'open' });
      if (c.words) expect(e.expected, `case ${i}`).toBe(c.words);
    });
    expect(skippedRules(s).skipped).toEqual([]);
  });

  it('a reference operand is read live: changing the limit re-checks the cells', async () => {
    const s = await storeWith([{ name: 'Rules', cells, rules }], names);
    const i = cases.findIndex((c) => c.rule.f1 === '$G$1');
    s.setCell('Rules', 'G1', '101');
    expect(at(s.getErrors(), 'Rules', `B${i + 1}`)!.status).toBe('resolved');
    s.setCell('Rules', 'G1', '99');
    expect(at(s.getErrors(), 'Rules', `B${i + 1}`)!.status).toBe('open');
    expect(at(s.getErrors(), 'Rules', `A${i + 1}`)).toMatchObject({ status: 'open', expected: 'whole number ≤ 99' });
  });

  it('relative operands shift with the cell, as Excel writes them', async () => {
    const s = await storeWith([{ name: 'S', cells: { C1: 5, D1: 10, C2: 11, D2: 10, C3: 3, D3: 1 }, rules: [{ sqref: 'C1:C3', type: 'whole', operator: 'lessThanOrEqual', f1: 'D1' }] }]);
    expect(s.getErrors().map((e) => [e.range, e.expected])).toEqual([['C2', 'whole number ≤ 10'], ['C3', 'whole number ≤ 1']]);
  });

  it('blank cells pass with allowBlank and fail without it — "(blank)" found', async () => {
    const s = await storeWith([{ name: 'S', cells: { A1: 'x', A2: 'y', B1: 1, D1: 'z' }, rules: [
      { sqref: 'B1:B2', type: 'whole', operator: 'greaterThan', f1: '0', allowBlank: true },
      { sqref: 'C1:C2', type: 'list', f1: '"p,q"' },
    ] }]);
    expect(s.getErrors().map((e) => [e.range, e.found])).toEqual([['C1', '(blank)'], ['C2', '(blank)']]);
    s.setCell('S', 'C1', 'q');
    expect(open(s.getErrors()).map((e) => e.range)).toEqual(['C2']);
  });

  it('a whole-column rule checks the used range only', async () => {
    const s = await storeWith([{ name: 'S', cells: { A1: 1, A2: -1, B3: 'x' }, rules: [{ sqref: 'A:A', type: 'whole', operator: 'greaterThan', f1: '0', allowBlank: true }] }]);
    expect(s.getErrors().map((e) => e.range)).toEqual(['A2']);
    s.setCell('S', 'A40', '-3');
    expect(open(s.getErrors()).map((e) => e.range)).toEqual(['A2', 'A40']);
  });

  it('a cell under two rules is one error (the first rule it breaks)', async () => {
    const s = await storeWith([{ name: 'S', cells: { A1: -1 }, rules: [
      { sqref: 'A1', type: 'whole', operator: 'greaterThan', f1: '0', error: 'first' },
      { sqref: 'A1', type: 'whole', operator: 'greaterThan', f1: '5', error: 'second' },
    ] }]);
    expect(s.getErrors()).toEqual([expect.objectContaining({ range: 'A1', message: 'first' })]);
  });
});

describe('list sources: a range, another sheet, a defined name, x14 (DoD 2)', () => {
  const sheets = (): SheetSpec[] => [
    { name: 'Main', cells: { H1: 'x', H2: 'y', H3: 'z', A1: 'y', A2: 'w', B1: 'Gold', B2: 'Tin', C1: 'Silver', C2: 'Lead', D1: 'Gold', D2: 'Zinc' },
      rules: [{ sqref: 'A1:A2', type: 'list', f1: '$H$1:$H$3' }, { sqref: 'B1:B2', type: 'list', f1: 'Lists!$A$1:$A$3' }, { sqref: 'C1:C2', type: 'list', f1: 'Metals' }],
      x14: [{ sqref: 'D1:D2', type: 'list', f1: 'Lists!$A$1:$A$3', allowBlank: true }] },
    { name: 'Lists', cells: { A1: 'Gold', A2: 'Silver', A3: 'Copper' } },
  ];
  const names = [{ name: 'Metals', formula: 'Lists!$A$1:$A$3' }];

  it('each source is read; the failures are the cells outside it', async () => {
    const s = await storeWith(sheets(), names);
    expect(s.getErrors().map((e) => [e.range, e.expected])).toEqual([
      ['A2', 'list — x, y, z'], ['B2', 'list — Gold, Silver, Copper'], ['C2', 'list — Gold, Silver, Copper'], ['D2', 'list — Gold, Silver, Copper'],
    ]);
  });

  it('a range on the same sheet is read live: changing the source re-checks', async () => {
    const s = await storeWith(sheets(), names);
    s.setCell('Main', 'H3', 'w');
    expect(at(s.getErrors(), 'Main', 'A2')!.status).toBe('resolved');
    expect(at(s.getErrors(), 'Main', 'A2')).toBeDefined();
  });

  it('a list source naming no sheet is skipped and counted', async () => {
    const s = await storeWith([{ name: 'S', cells: { A1: 'q' }, rules: [{ sqref: 'A1', type: 'list', f1: 'Nowhere!$A$1:$A$3' }, { sqref: 'A2', type: 'list', f1: 'OFFSET($A$1,0,0,3,1)' }] }]);
    expect(s.getErrors()).toEqual([]);
    expect(skippedRules(s).skipped.map((r) => [r.sqref, r.reason])).toEqual([['A1', 'source'], ['A2', 'source']]);
  });
});

describe('custom rules, unsupported operands and operators: skipped and counted (DoD 2, 6)', () => {
  const sheet: SheetSpec = { name: 'S', cells: { A1: 5, A2: -5, B1: 1 }, rules: [
    { sqref: 'A1:A2', type: 'custom', f1: 'A1>0', error: 'positive' },
    { sqref: 'B1', type: 'whole', operator: 'greaterThan', f1: 'SUM($C$1:$C$3)' },
    { sqref: 'B1', type: 'whole', operator: 'roughly', f1: '1' },
    { sqref: 'B2', type: 'whole', operator: 'greaterThan', f1: '0', allowBlank: true },
  ] };

  it('without a formula plugin, custom is skipped; the rest are counted with a reason', async () => {
    const s = await storeWith([sheet]);
    expect(s.getErrors()).toEqual([]);
    const r = skippedRules(s);
    expect(r).toMatchObject({ rules: 4, checked: 1 });
    expect(r.skipped.map((x) => [x.sqref, x.reason])).toEqual([['A1:A2', 'custom'], ['B1', 'operand'], ['B1', 'operator']]);
  });

  it('skippedRules(book) — the workbook alone — counts custom as skipped too', async () => {
    const s = await storeWith([sheet]);
    expect(skippedRules(s.book!).skipped).toHaveLength(3);
  });

  it('with a derive plugin offering evaluate(), custom rules are checked, relative refs shifted per cell', async () => {
    const seen: string[] = [];
    const formulas: Plugin & { evaluate(f: string, at: { sheet: string; ref: string }): boolean | undefined } = {
      id: 'formulas', provides: ['derive'], derive: () => [],
      evaluate(f, at) {
        seen.push(`${at.ref}:${f}`);
        const m = /^([A-Z]+\d+)>0$/.exec(f);
        if (!m) return undefined;
        const v = s.value(at.sheet, m[1]!);
        return typeof v === 'number' && v > 0;
      },
    };
    const s = createWorkbook({ plugins: [validation(), formulas] });
    await s.load(await workbook([sheet]), 'c.xlsx');
    expect(seen).toEqual(expect.arrayContaining(['A1:A1>0', 'A2:A2>0']));
    expect(s.getErrors()).toEqual([expect.objectContaining({ range: 'A2', expected: 'custom — =A1>0', message: 'positive' })]);
    expect(skippedRules(s).skipped.map((x) => x.reason)).toEqual(['operand', 'operator']);
    s.setCell('S', 'A2', '3');
    expect(s.getErrors()[0]!.status).toBe('resolved');
  });

  it('a derive plugin without evaluate() still skips custom, saying why', async () => {
    const s = createWorkbook({ plugins: [validation(), { id: 'formulas', provides: ['derive'], derive: () => [] }] });
    await s.load(await workbook([sheet]), 'c.xlsx');
    expect(skippedRules(s).skipped[0]).toMatchObject({ reason: 'custom', detail: expect.stringMatching(/no evaluate/) });
  });
});

describe('the engine', () => {
  it('shiftFormula moves relative refs, keeps $-fixed parts, strings and function names', () => {
    expect(shiftFormula('AND(A1>0,$B$2<A$3,"A1",LOG10(C1))', 2, 1)).toBe('AND(B3>0,$B$2<B$3,"A1",LOG10(D3))');
  });
  it('a sheet with no rules costs nothing and validates nothing', async () => {
    const s = await storeWith([{ name: 'S', cells: { A1: 1 } }]);
    expect(s.getErrors()).toEqual([]);
    expect(skippedRules(s)).toEqual({ rules: 0, checked: 0, skipped: [] });
  });
  it('5,000 rows under a number rule and a 50-item range list validate on every edit without a pause', async () => {
    const cells: Record<string, string | number> = {};
    for (let r = 1; r <= 5000; r++) { cells[`A${r}`] = r % 100 === 0 ? -r : r; cells[`B${r}`] = `k${r % 60}`; }
    for (let r = 1; r <= 50; r++) cells[`D${r}`] = `k${r}`;
    const s = await storeWith([{ name: 'S', cells, rules: [
      { sqref: 'A1:A5000', type: 'whole', operator: 'greaterThan', f1: '0' },
      { sqref: 'B1:B5000', type: 'list', f1: '$D$1:$D$50' },
    ] }]);
    expect(open(s.getErrors()).length).toBe(50 + 830); // every 100th A is negative; k0 and k51–k59 are not in D1:D50 (10 in every 60 rows, 83 full cycles)
    const t0 = performance.now();
    s.setCell('S', 'A100', '100');
    expect(performance.now() - t0).toBeLessThan(500);
  });
  it('the severity is the host’s to set', async () => {
    const s = createWorkbook({ plugins: [validation({ severity: 'error' })] });
    await s.load(await workbook([{ name: 'S', cells: { A1: -1 }, rules: [{ sqref: 'A1', type: 'whole', operator: 'greaterThan', f1: '0' }] }]), 'x.xlsx');
    expect(s.getErrors()[0]!.severity).toBe('error');
  });
});
