// The `derive` hook with tiny workbooks (W-16 DoD 2, 3, 6, 9).
import { describe, expect, it, vi } from 'vitest';
import { createWorkbook } from '@sheetpane/grid';
import { formulas, sameValue } from '../src/index.js';
import { recalculatedCount } from '../src/ui.js';
import { book, loaded, until } from './helpers.js';

/** Holdings: B units, C price, D = B*C, D6 = SUM(D3:D5). Cached values as Excel would save them. */
const holdings = () => book({
  Holdings: [
    ['Account', 'Units', 'Price', 'Value'],
    [],
    ['AC-1', 1200, 268.4, { f: 'B3*C3', v: 322080 }],
    ['AC-2', 150, 214.57, { f: 'B4*C4', v: 32185.5 }],
    ['AC-3', 800, 41.84, { f: 'B5*C5', v: 33472 }],
    [null, null, 'Total', { f: 'SUM(D3:D5)', v: 387737.5 }],
  ],
});

const derived = (store: ReturnType<typeof createWorkbook>, ref: string, sheet = 'Holdings') => store.getSnapshot().derived.get(`${sheet}!${ref}`);

describe('derive on load', () => {
  it('builds the model and returns only the cells where IronCalc disagrees with the saved value', async () => {
    const f = formulas();
    const store = await loaded(await holdings(), [f]);
    await f.ready();
    expect(f.built()).toBe(true);
    expect(store.getSnapshot().derived.size).toBe(0);
  });

  it('fills in formula cells saved without a cached value', async () => {
    const f = formulas();
    const store = await loaded(await book({ S: [[2, 3, { f: 'A1*B1' }, { f: 'C1+1', v: 999 }]] }), [f]);
    await until(() => store.getSnapshot().derived.size === 2);
    expect(derived(store, 'C1', 'S')).toEqual({ value: 6, text: '6' });
    expect(derived(store, 'D1', 'S')?.value).toBe(7);
  });
});

describe('derive on change (DoD 3)', () => {
  it('edit B3 → D3 and the total recalculate; derived cells never enter the change map', async () => {
    const f = formulas();
    const store = await loaded(await holdings(), [f]);
    await f.ready();
    store.setCell('Holdings', 'B3', '1000');
    await until(() => !!derived(store, 'D3'));
    await f.ready();
    expect(derived(store, 'D3')?.value).toBeCloseTo(268400, 9);
    expect(derived(store, 'D6')?.value).toBeCloseTo(268400 + 32185.5 + 33472, 9);
    expect(derived(store, 'D4')).toBeUndefined(); // unchanged → not derived
    expect(store.changeCount).toBe(1);
    expect([...store.getSnapshot().changes.keys()]).toEqual(['Holdings!B3']);
    expect(store.value('Holdings', 'D3')).toBeCloseTo(268400, 9);
    expect(store.text('Holdings', 'D3')).toBe('268400');
    expect(recalculatedCount(store.getSnapshot())).toBe(2);
    expect(store.mayBeStale('Holdings', 'D3')).toBe(false);
  });

  it('undo puts the recalculated values back', async () => {
    const f = formulas();
    const store = await loaded(await holdings(), [f]);
    await f.ready();
    store.setCell('Holdings', 'C4', '300');
    await until(() => !!derived(store, 'D4'));
    store.undo();
    await until(() => derived(store, 'D4') === undefined); // back at the saved value: the derived entry is cleared
    expect(store.value('Holdings', 'D4')).toBe(32185.5);
    expect(derived(store, 'D6')).toBeUndefined();
    expect(store.value('Holdings', 'D6')).toBeCloseTo(387737.5, 9);
    expect(store.changeCount).toBe(0);
    expect(recalculatedCount(store.getSnapshot())).toBe(0); // back to the saved values: no ⟳
  });

  it('typing "=" makes a formula change that evaluates, and later edits recalculate it (GRID 21b)', async () => {
    const f = formulas();
    const store = await loaded(await holdings(), [f]);
    await f.ready();
    store.setCell('Holdings', 'E3', '=D3/D6');
    expect(store.changeOf('Holdings', 'E3')?.kind).toBe('formula');
    await until(() => !!derived(store, 'E3'));
    expect(derived(store, 'E3')?.value).toBeCloseTo(322080 / 387737.5, 12);
    store.setCell('Holdings', 'B3', '0');
    await until(() => derived(store, 'E3')?.value === 0);
    expect(derived(store, 'D6')?.value).toBeCloseTo(32185.5 + 33472, 9);
  });

  it('a value typed over a file formula stops it being a formula; reverting brings the formula back', async () => {
    const f = formulas();
    const store = await loaded(await holdings(), [f]);
    await f.ready();
    store.setCell('Holdings', 'D3', '5');
    await until(() => !!derived(store, 'D6'));
    expect(derived(store, 'D6')?.value).toBeCloseTo(5 + 32185.5 + 33472, 9);
    store.setCell('Holdings', 'B3', '2'); // D3 is a value now: no recalculation of D3
    await f.ready();
    await until(() => store.getSnapshot().changes.size === 2);
    expect(store.value('Holdings', 'D3')).toBe(5);
    store.revert('Holdings', 'D3');
    await until(() => sameValue(derived(store, 'D3')?.value ?? null, 2 * 268.4));
  });

  it('a typed formula reverted to empty does not leave its value behind', async () => {
    const f = formulas();
    const store = await loaded(await holdings(), [f]);
    await f.ready();
    store.setCell('Holdings', 'F9', '=1+1');
    await until(() => derived(store, 'F9')?.value === 2);
    store.revert('Holdings', 'F9');
    await until(() => derived(store, 'F9') === undefined); // the derived entry is cleared, not overwritten
    expect(store.value('Holdings', 'F9')).toBe(null);
  });

  it('a formula over cells no formula read before feeds them into the model on demand', async () => {
    const f = formulas();
    const store = await loaded(await book({ S: [[1, { f: 'A1*2', v: 2 }], [10], [100], ['text']] }), [f]);
    await f.ready();
    store.setCell('S', 'C1', '=SUM(A1:A4)');
    await until(() => derived(store, 'C1', 'S')?.value === 111);
    store.setCell('S', 'C2', '=INDIRECT("A"&3)*2');
    await until(() => derived(store, 'C2', 'S')?.value === 200);
    store.setCell('S', 'C3', '=COUNTA(A:A)');
    await until(() => derived(store, 'C3', 'S')?.value === 4);
  });

  it('a paste (setCells) is one recalculation', async () => {
    const f = formulas();
    const store = await loaded(await holdings(), [f]);
    await f.ready();
    store.setCells([{ sheet: 'Holdings', ref: 'B3', input: '1' }, { sheet: 'Holdings', ref: 'B4', input: '1' }, { sheet: 'Holdings', ref: 'B5', input: '1' }]);
    await until(() => !!derived(store, 'D6'));
    await f.ready();
    expect(derived(store, 'D6')?.value).toBeCloseTo(268.4 + 214.57 + 41.84, 9);
  });

  it('reads across sheets with quoted names, and through defined names', async () => {
    const f = formulas();
    const bytes = await book({ 'Fee tiers': [['Tier', 'Rate'], ['Core', 0.0075]], "Q3 '26": [[1000, { f: "A1*'Fee tiers'!B2", v: 7.5 }, { f: 'A1*Rate', v: 7.5 }]] }, { Rate: "'Fee tiers'!$B$2" });
    const store = await loaded(bytes, [f]);
    await f.ready();
    expect(store.getSnapshot().derived.size).toBe(0);
    store.setCell('Fee tiers', 'B2', '0.01');
    await until(() => derived(store, 'C1', "Q3 '26")?.value === 10);
    expect(derived(store, 'B1', "Q3 '26")?.value).toBe(10);
  });

  it('a .csv: numbers stored as text still add up in a typed formula', async () => {
    const f = formulas();
    const store = createWorkbook({ plugins: [f] });
    await store.load(new TextEncoder().encode('a,b\n2,3\n'), 'x.csv');
    await f.ready();
    expect(f.built()).toBe(false);
    store.setCell(store.book!.sheets[0]!.name, 'C2', '=A2*B2');
    await until(() => derived(store, 'C2', store.book!.sheets[0]!.name)?.value === 6);
  });

  it('a new workbook rebuilds the model from the new JavaScript objects', async () => {
    const f = formulas();
    const store = await loaded(await holdings(), [f]);
    await f.ready();
    store.setCell('Holdings', 'B3', '1');
    await until(() => !!derived(store, 'D3'));
    await store.load(await book({ Other: [[4, { f: 'A1^2' }]] }), 'other.xlsx');
    await until(() => store.getSnapshot().derived.get('Other!B1')?.value === 16);
    expect(store.getSnapshot().derived.has('Holdings!D3')).toBe(false);
    store.setCell('Other', 'A1', '5');
    await until(() => store.getSnapshot().derived.get('Other!B1')?.value === 25);
  });
});

describe('errors never throw (DoD 6)', () => {
  it('#DIV/0!, #REF! and #N/A show as Excel shows them', async () => {
    const f = formulas();
    const store = await loaded(await book({ S: [[0, { f: '1/A1', v: '#DIV/0!', t: 'e' }, { f: '#REF!+1', v: '#REF!', t: 'e' }, { f: 'NA()', v: '#N/A', t: 'e' }]] }), [f]);
    await f.ready();
    expect(store.getSnapshot().derived.size).toBe(0);
    expect(store.text('S', 'B1')).toBe('#DIV/0!');
    store.setCell('S', 'A1', '4');
    await until(() => derived(store, 'B1', 'S')?.value === 0.25);
    store.setCell('S', 'A1', '0');
    await until(() => derived(store, 'B1', 'S') === undefined); // #DIV/0! again, as saved
    expect(store.text('S', 'B1')).toBe('#DIV/0!');
  });

  it('a circular reference shows 0, is listed, and clears when broken', async () => {
    const f = formulas();
    const err = vi.spyOn(console, 'error');
    const store = await loaded(await book({ S: [[1, { f: 'A1+C1', v: 0 }, { f: 'B1', v: 0 }]] }), [f]);
    await f.ready();
    expect(f.cycles().map((c) => c.ref).sort()).toEqual(['B1', 'C1']);
    expect(f.stateOf('S', 'B1')).toBe('cycle');
    expect(store.getSnapshot().derived.size).toBe(0); // Excel saved 0; IronCalc shows 0
    store.setCell('S', 'C1', '5');
    await until(() => derived(store, 'B1', 'S')?.value === 6);
    expect(f.cycles()).toEqual([]);
    store.setCell('S', 'D1', '=D1+1');
    await until(() => f.cycles().length === 1);
    expect(derived(store, 'D1', 'S')?.value).toBe(0);
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it('a half-typed formula evaluates to an error, never an exception', async () => {
    const f = formulas();
    const store = await loaded(await holdings(), [f]);
    await f.ready();
    for (const t of ['=', '=B3*', '=SUM(', '=B3*']) store.setCell('Holdings', 'G3', t, { coalesce: true });
    await f.ready();
    // IronCalc's own parse error; Excel would refuse the entry instead.
    await until(() => derived(store, 'G3')?.value === '#ERROR!');
    store.setCell('Holdings', 'G3', '=B3*2', { coalesce: true });
    await until(() => derived(store, 'G3')?.value === 2400);
  });

  it('a file formula IronCalc cannot calculate keeps its saved value and is listed', async () => {
    const f = formulas();
    const store = await loaded(await book({ S: [[1, 2, { f: 'AGGREGATE(9,0,A1:B1)', v: 3 }, { f: 'C1*2', v: 6 }]] }), [f]);
    await f.ready();
    // D1 reads C1, so IronCalc's #NAME? reaches it too: both keep Excel's saved values.
    expect(f.unsupported()).toEqual([{ sheet: 'S', ref: 'C1' }, { sheet: 'S', ref: 'D1' }]);
    expect(f.stateOf('S', 'C1')).toBe('unsupported');
    expect(store.value('S', 'C1')).toBe(3);
    expect(store.value('S', 'D1')).toBe(6);
    expect(store.getSnapshot().derived.size).toBe(0);
    // Typing a supported formula over it calculates again.
    store.setCell('S', 'C1', '=SUM(A1:B1)');
    await until(() => store.getSnapshot().derived.get('S!C1')?.value === 3);
    expect(f.unsupported()).toEqual([]);
    expect(store.value('S', 'D1')).toBe(6); // calculated, and equal to the saved value
  });

  it('a workbook with no formulas never builds a model', async () => {
    const f = formulas();
    const store = await loaded(await book({ S: [[1, 2]] }), [f]);
    await f.ready();
    store.setCell('S', 'A1', '3');
    await f.ready();
    expect(f.built()).toBe(false);
    expect(store.getSnapshot().derived.size).toBe(0);
  });
});
