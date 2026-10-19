// W-63 DoD 1 (SR-COMPARE decisions 2–6): diffWorkbooks — the two properties (a workbook diffed
// with itself is empty; the diff applied to the older workbook gives the newer one's values, keyed
// or not, on random workbooks) and the cases the alignment must get right.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Cell } from '@sheetpane/export';
import { applyDiff, diffWorkbooks, relativeFormula, summaryText, type CompareSheet, type CompareWorkbook } from '../src/index.js';

const book = (...sheets: CompareSheet[]): CompareWorkbook => ({ sheets });
const sheet = (name: string, rows: readonly (readonly Cell[])[], more: Partial<CompareSheet> = {}): CompareSheet => ({ name, rows, ...more });

/** Values as compared: blanks null, trailing blanks and blank rows trimmed. */
function values(rows: readonly (readonly Cell[])[]): Cell[][] {
  const out = rows.map((r) => { const x = r.map((v) => (v === '' || v === undefined ? null : v)); while (x.length && x[x.length - 1] === null) x.pop(); return x; });
  while (out.length && !out[out.length - 1]!.length) out.pop();
  return out;
}
const asValues = (b: CompareWorkbook) => b.sheets.map((s) => ({ name: s.name, rows: values(s.rows) }));

// a small cell domain so rows repeat, collide and look alike — what makes alignment hard
const cell = fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 4 }), fc.constantFrom('a', 'b', 'c', 'x'), fc.boolean());
const rows = fc.array(fc.array(cell, { maxLength: 4 }), { maxLength: 9 });
const names = fc.uniqueArray(fc.constantFrom('One', 'Two', 'Three', 'Four'), { minLength: 1, maxLength: 3 });
const workbook = names.chain((ns) => fc.tuple(...ns.map((n) => rows.map((r) => sheet(n, r))))).map((ss) => book(...ss));
// keyed sheets: a header row, then a unique id in column A
const keyed = fc.uniqueArray(fc.integer({ min: 1, max: 30 }), { maxLength: 12 }).chain((ids) => fc.tuple(...ids.map(() => fc.array(cell, { minLength: 2, maxLength: 2 }))).map((rest) => sheet('Data', [['Id', 'P', 'Q'], ...ids.map((id, i) => [`K${id}`, ...rest[i]!])])));

describe('properties (DoD 1)', () => {
  it('a workbook diffed with itself is empty', () => {
    fc.assert(fc.property(workbook, (w) => {
      const d = diffWorkbooks(w, w);
      expect(d.summary).toEqual({ sheets: 0, rows: 0, cells: 0, sheetsAdded: 0, sheetsRemoved: 0, sheetsRenamed: 0 });
      expect(d.sheets.every((s) => s.status === 'same' && !s.rows.length && !s.cells.length)).toBe(true);
    }), { numRuns: 300 });
  });
  it('applying the diff to a gives b’s values — any two workbooks', () => {
    fc.assert(fc.property(workbook, workbook, (a, b) => {
      expect(applyDiff(a, diffWorkbooks(a, b)).map((s) => ({ name: s.name, rows: values(s.rows) }))).toEqual(asValues(b));
    }), { numRuns: 500 });
  });
  it('applying the diff to a gives b’s values — keyed, rows shuffled, added and removed', () => {
    fc.assert(fc.property(keyed, keyed, (x, y) => {
      const a = book(x), b = book(y);
      const d = diffWorkbooks(a, b, { key: 'Id' });
      expect(d.sheets[0]!.keyed).toBe(true);
      expect(applyDiff(a, d).map((s) => ({ name: s.name, rows: values(s.rows) }))).toEqual(asValues(b));
    }), { numRuns: 300 });
  });
  it('a keyed sheet diffed with a shuffle of itself: only moves, no cell changes', () => {
    fc.assert(fc.property(keyed, fc.infiniteStream(fc.double({ min: 0, max: 1, noNaN: true })), (x, rnd) => {
      const [head, ...data] = x.rows;
      const shuffled = data.map((r) => ({ r, k: rnd.next().value as number })).sort((p, q) => p.k - q.k).map((p) => p.r);
      const s = diffWorkbooks(book(x), book(sheet('Data', [head!, ...shuffled])), { key: 'Id' }).sheets[0]!;
      expect(s.cells).toEqual([]);
      expect(s.rows.every((r) => r.op === 'moved')).toBe(true);
    }), { numRuns: 200 });
  });
});

const HOLD = [['Account', 'Units', 'Price'], ['AC-1', 10, 2.5], ['AC-2', 20, 3], ['AC-3', 30, 4], ['AC-4', 40, 5]] as Cell[][];

describe('rows', () => {
  it('a changed cell is one changed row and one cell, with was and now', () => {
    const now = HOLD.map((r) => [...r]); now[2]![2] = 3.25;
    const d = diffWorkbooks(book(sheet('H', HOLD)), book(sheet('H', now)));
    expect(d.sheets[0]!.rows).toEqual([{ op: 'changed', a: 2, b: 2 }]);
    expect(d.sheets[0]!.cells).toEqual([{ row: 2, col: 2, ref: 'C3', wasRef: 'C3', was: { value: 3, text: '3' }, now: { value: 3.25, text: '3.25' }, what: ['value', 'text'] }]);
    expect(summaryText(d.summary)).toBe('1 sheet · 1 row · 1 cell changed');
  });
  it('an inserted and a deleted row: added + removed, the rest unchanged', () => {
    const now = [HOLD[0]!, HOLD[1]!, ['AC-9', 90, 9], HOLD[2]!, HOLD[4]!];
    const s = diffWorkbooks(book(sheet('H', HOLD)), book(sheet('H', now))).sheets[0]!;
    expect(s.rows).toEqual([{ op: 'added', b: 2, values: ['AC-9', 90, 9] }, { op: 'removed', a: 3, after: 3 }]);
    expect(s.cells).toEqual([]);
  });
  it('without a key a reordered row is added + removed, never moved (the hazard); with one it is moved', () => {
    const now = [HOLD[0]!, HOLD[3]!, HOLD[1]!, HOLD[2]!, HOLD[4]!];
    const loose = diffWorkbooks(book(sheet('H', HOLD)), book(sheet('H', now))).sheets[0]!;
    expect(loose.rows.map((r) => r.op).sort()).toEqual(['added', 'removed']);
    const keyedS = diffWorkbooks(book(sheet('H', HOLD)), book(sheet('H', now)), { key: 'account' }).sheets[0]!;
    expect(keyedS).toMatchObject({ keyed: true, key: ['account'], rows: [{ op: 'moved', a: 3, b: 1 }], counts: { rowsMoved: 1 } });
  });
  it('a key matches the same account even when every other cell changed', () => {
    const now = [HOLD[0]!, ['AC-1', 11, 2.6], ...HOLD.slice(2)];
    const s = diffWorkbooks(book(sheet('H', HOLD)), book(sheet('H', now)), { key: ['Account'] }).sheets[0]!;
    expect(s.rows).toEqual([{ op: 'changed', a: 1, b: 1 }]);
    expect(s.cells.map((c) => c.ref)).toEqual(['B2', 'C2']);
  });
  it('a key by column letter, per sheet with a fallback; a missing per-sheet key is SP-5901, a missing global key a note', () => {
    expect(diffWorkbooks(book(sheet('H', HOLD)), book(sheet('H', HOLD)), { key: { H: 'A' } }).sheets[0]!.keyed).toBe(true);
    expect(diffWorkbooks(book(sheet('H', HOLD)), book(sheet('H', HOLD)), { key: { '*': 'Units' } }).sheets[0]!.key).toEqual(['Units']);
    expect(() => diffWorkbooks(book(sheet('H', HOLD)), book(sheet('H', HOLD)), { key: { H: 'Nope' } })).toThrow(/^SP-5901: /);
    const s = diffWorkbooks(book(sheet('H', HOLD)), book(sheet('H', HOLD)), { key: 'Nope' }).sheets[0]!;
    expect(s.keyed).toBe(false);
    expect(s.note).toMatch(/no key column/);
  });
  it('trailing blank rows do not count', () => {
    expect(diffWorkbooks(book(sheet('H', HOLD)), book(sheet('H', [...HOLD, [], [null, '']]))).summary.rows).toBe(0);
  });
});

describe('columns, cells, formulas', () => {
  it('a column inserted under its own title is one new column, not every cell changed', () => {
    const now = HOLD.map((r, i) => [r[0]!, i ? `T${i}` : 'Type', r[1]!, r[2]!]);
    const s = diffWorkbooks(book(sheet('H', HOLD)), book(sheet('H', now))).sheets[0]!;
    expect(s.columns).toMatchObject({ by: 'header', map: [0, -1, 1, 2], added: [1], removed: [] });
    expect(s.cells.map((c) => c.ref)).toEqual(['B1', 'B2', 'B3', 'B4', 'B5']);
    expect(s.cells.every((c) => c.was === null)).toBe(true);
  });
  it('a renamed title pairs with the leftover column; columns that swapped places are moved', () => {
    const renamed = HOLD.map((r, i) => (i ? r : ['Account', 'Quantity', 'Price']));
    expect(diffWorkbooks(book(sheet('H', HOLD)), book(sheet('H', renamed))).sheets[0]!).toMatchObject({ columns: { map: [0, 1, 2], added: [] }, cells: [{ ref: 'B1' }] });
    const swapped = HOLD.map((r) => [r[0]!, r[2]!, r[1]!]);
    const s = diffWorkbooks(book(sheet('H', HOLD)), book(sheet('H', swapped))).sheets[0]!;
    expect(s.columns.moved).toEqual([{ a: 1, b: 2 }]); // a swap: one of the two is out of order — Units, the first to have travelled
    expect(s.cells).toEqual([]);
  });
  it('text only (a number format) and formula only are changes; a formula that moved with its row is not', () => {
    const a = sheet('F', [[1, 2, 3], [4, 5, 9]], { text: [['1', '2', '3'], ['4', '5', '9']], formulas: { C2: 'A2+B2' } });
    const fmt = sheet('F', [[1, 2, 3], [4, 5, 9]], { text: [['1', '2', '3'], ['4', '5', '$9.00']], formulas: { C2: 'A2+B2' } });
    expect(diffWorkbooks(book(a), book(fmt)).sheets[0]!.cells[0]!.what).toEqual(['text']);
    const f2 = sheet('F', [[1, 2, 3], [4, 5, 9]], { text: a.text!, formulas: { C2: 'SUM(A2:B2)' } });
    expect(diffWorkbooks(book(a), book(f2)).sheets[0]!.cells[0]).toMatchObject({ ref: 'C2', what: ['formula'], was: { formula: 'A2+B2' }, now: { formula: 'SUM(A2:B2)' } });
    const shifted = sheet('F', [[0, 0, 0], [1, 2, 3], [4, 5, 9]], { formulas: { C3: 'A3+B3' } });
    const s = diffWorkbooks(book(sheet('F', a.rows, { formulas: a.formulas! })), book(shifted)).sheets[0]!;
    expect(s.rows).toEqual([{ op: 'added', b: 0, values: [0, 0, 0] }]);
    expect(s.cells).toEqual([]);
  });
  it('relativeFormula leaves strings, sheet names and functions alone and keeps $ absolute', () => {
    expect(relativeFormula('A2+$B$2+"C3"&LOG10(4)+\'My D4\'!E5', 1, 2)).toBe('R[0]C[-2]+R1C1+"C3"&LOG10(4)+\'My D4\'!R[3]C[2]');
  });
});

describe('sheets and structure', () => {
  it('added, removed and renamed sheets (renamed by content, over the threshold)', () => {
    const d = diffWorkbooks(book(sheet('Fees', HOLD), sheet('Old', [['gone']])), book(sheet('Fee schedule', HOLD.slice(0, 4)), sheet('New', [['here']])));
    expect(d.sheets.map((s) => [s.status, s.a, s.b, s.renamed])).toEqual([['changed', 'Fees', 'Fee schedule', 0.8], ['added', undefined, 'New', undefined], ['removed', 'Old', undefined, undefined]]);
    expect(d.summary).toMatchObject({ sheets: 3, sheetsAdded: 1, sheetsRemoved: 1, sheetsRenamed: 1, rows: 1 + 1 + 1 });
  });
  it('merges, hidden rows, columns and state, and rule counts', () => {
    const a = sheet('S', HOLD, { merges: ['A1:B1'], hiddenRows: [2], hiddenCols: [], state: 'visible', dataValidations: [{}], conditionalFormats: [] });
    const b = sheet('S', [HOLD[0]!, ['AC-0', 0, 0], ...HOLD.slice(1)], { merges: ['B1:C1'], hiddenRows: [3, 4], hiddenCols: [2], state: 'hidden', dataValidations: [{}], conditionalFormats: [{}] });
    const s = diffWorkbooks(book(a), book(b)).sheets[0]!;
    expect(s.merges).toEqual({ added: ['B1:C1'], removed: ['A1:B1'] });
    expect(s.hidden).toEqual({ rows: { hidden: [4], shown: [] }, cols: { hidden: [2], shown: [] }, state: { was: 'visible', now: 'hidden' } });
    expect(s.rules).toEqual({ dataValidations: { was: 1, now: 1 }, conditionalFormats: { was: 0, now: 1 } });
  });
});
