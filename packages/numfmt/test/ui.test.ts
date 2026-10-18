import { afterEach, describe, expect, it } from 'vitest';
import { createWorkbook, pluginsFromIds, type SheetpaneExcel } from '@sheetpane/grid';
import { cleanup, frame, mountExcel, shadow } from '../../grid/test/helpers.js';
import { numfmt } from '../src/index.js';
import { ui, MAX_CELLS } from '../src/ui.js';
import { adjustDecimals } from '../src/fmt.js';
import { styledBook } from './helpers.js';

afterEach(cleanup);
const $ = (el: Element, sel: string) => shadow(el).querySelector(sel) as HTMLElement;

const CELLS = [
  { ref: 'A1', value: 1234.5, code: '#,##0.00' },
  { ref: 'A2', value: 0.256, code: '0%' },
  { ref: 'A3', value: 1234.5 },
  { ref: 'A5', value: 45000, id: 14 },
  { ref: 'B1', value: 9, code: '0' },
];

async function pane(plugins = [numfmt(), ui()], cells = CELLS): Promise<{ el: SheetpaneExcel; store: ReturnType<typeof createWorkbook> }> {
  const el = await mountExcel({ mode: 'edit' });
  const store = createWorkbook({ plugins });
  el.workbook = store;
  await store.load(styledBook(cells), 'f.xlsx');
  store.setMode('edit');
  await frame();
  return { el, store };
}
const choose = async (el: Element, value: string) => {
  const sel = $(el, 'select[data-control=numfmt-format]') as HTMLSelectElement;
  sel.value = value;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  await frame();
};
const click = async (el: Element, id: string) => { $(el, `[data-control=${id}]`).click(); await frame(); };

describe('ui: format-row (DoD 4)', () => {
  it('registers: plugins="numfmt" enables the plugin and its controls once ui is imported', () => {
    const list = pluginsFromIds(['numfmt']);
    expect(list.map((p) => p.id)).toEqual(['numfmt', 'numfmt-ui']);
    expect(list[0]!.provides).toEqual(['format', 'decorate', 'exportPatch']);
    expect(list[1]!.provides).toEqual([]);
  });

  it('the dropdown lists the eleven categories in order, shows the current one, and sits in the Edit-only format row', async () => {
    const { el, store } = await pane();
    store.select({ sheet: 'Data', ref: 'A1' });
    await frame();
    const sel = $(el, 'select[data-control=numfmt-format]') as HTMLSelectElement;
    expect([...sel.options].map((o) => o.textContent)).toEqual(['General', 'Number', 'Currency', 'Accounting', 'Date', 'Time', 'Percentage', 'Fraction', 'Scientific', 'Text', 'Custom…']);
    expect(sel.getAttribute('aria-label')).toBe('Number format');
    expect(sel.value).toBe('number');
    store.select({ sheet: 'Data', ref: 'A2' }); await frame();
    expect(($(el, 'select[data-control=numfmt-format]') as HTMLSelectElement).value).toBe('percentage');
    store.select({ sheet: 'Data', ref: 'A5' }); await frame();
    expect(($(el, 'select[data-control=numfmt-format]') as HTMLSelectElement).value).toBe('date');
    store.select({ sheet: 'Data', ref: 'A3' }); await frame();
    expect(($(el, 'select[data-control=numfmt-format]') as HTMLSelectElement).value).toBe('general');
    expect(($(el, '.frow') as HTMLElement).hidden).toBe(false);
    store.setMode('view'); await frame();
    expect(($(el, '.frow') as HTMLElement).hidden).toBe(true);
  });

  it('choosing a format is a numFmt change: the cell re-renders, the bar says it changed, the cell bar keeps the raw value, undo reverts', async () => {
    const { el, store } = await pane();
    store.select({ sheet: 'Data', ref: 'A1' }); await frame();
    await choose(el, 'percentage');
    expect(store.changeOf('Data', 'A1', 'numFmt')).toMatchObject({ kind: 'numFmt', was: '#,##0.00', now: '0.00%' });
    expect(store.text('Data', 'A1')).toBe('123450.00%');
    expect($(el, '#c0_0').textContent).toContain('123450.00%');
    expect($(el, '.changed').textContent).toBe('Changed · was 1,234.50');
    expect(($(el, 'input.cell') as HTMLInputElement).value).toBe('1234.5'); // raw, not formatted
    expect($(el, '.val').textContent).toBe('123450.00%');
    store.undo(); await frame();
    expect(store.text('Data', 'A1')).toBe('1,234.50');
    expect(store.changeOf('Data', 'A1', 'numFmt')).toBeUndefined();
  });

  it('the presets give Excel’s defaults', async () => {
    const { el, store } = await pane();
    store.select({ sheet: 'Data', ref: 'A3' }); await frame();
    const want: Record<string, string> = { number: '1234.50', currency: '$1,234.50 ', accounting: ' $1,234.50 ', percentage: '123450.00%', scientific: '1.23E+03', general: '1234.5' };
    for (const [k, v] of Object.entries(want)) { await choose(el, k); expect(store.text('Data', 'A3'), k).toBe(v); }
    await choose(el, 'date'); expect(store.text('Data', 'A3')).toBe('5/18/1903');
    await choose(el, 'time'); expect(store.text('Data', 'A3')).toBe('12:00:00 PM');
    await choose(el, 'fraction'); expect(store.text('Data', 'A3')).toBe('1234 1/2');
    await choose(el, 'text'); expect(store.text('Data', 'A3')).toBe('1234.5');
  });

  it('a range applies to every numeric cell in it, leaving blanks alone', async () => {
    const { el, store } = await pane();
    store.select({ sheet: 'Data', ref: 'A1', range: 'A1:B5' }); await frame();
    await choose(el, 'currency');
    const changed = [...store.getSnapshot().changes.keys()].sort();
    expect(changed).toEqual(['Data!#numFmt:A1', 'Data!#numFmt:A2', 'Data!#numFmt:A3', 'Data!#numFmt:A5', 'Data!#numFmt:B1']); // A4 is blank: no change
    expect(store.text('Data', 'B1')).toBe('$9.00 ');
  });

  it('a cell the user has edited keeps its edit and takes the format: each kind has its own slot (SR-GRID 3)', async () => {
    const { el, store } = await pane();
    store.setCell('Data', 'A3', '99');
    store.select({ sheet: 'Data', ref: 'A3', range: 'A3:A3' }); await frame();
    await choose(el, 'percentage');
    expect(store.changeOf('Data', 'A3')).toMatchObject({ kind: 'value', now: 99 });
    expect(store.changeOf('Data', 'A3', 'numFmt')).toMatchObject({ kind: 'numFmt', now: '0.00%' });
    expect(store.text('Data', 'A3')).toBe('9900.00%');
    store.revert('Data', 'A3'); // Revert takes back every kind on the cell, as one step
    expect(store.changesAt('Data', 'A3')).toEqual([]);
  });

  it('Custom… asks for a code, applies it, and refuses an invalid one', async () => {
    const asked: string[] = [];
    let answer: string | null = '0.0 "kg"';
    const { el, store } = await pane([numfmt(), ui({ ask: (cur) => { asked.push(cur); return answer; } })]);
    const alerts: string[] = [];
    const realAlert = globalThis.alert;
    globalThis.alert = (m?: string) => { alerts.push(String(m)); };
    try {
      store.select({ sheet: 'Data', ref: 'A1' }); await frame();
      await choose(el, 'custom');
      expect(asked).toEqual(['#,##0.00']);
      expect(store.text('Data', 'A1')).toBe('1234.5 kg');
      answer = 'bad"'; await choose(el, 'custom');
      expect(store.text('Data', 'A1')).toBe('1234.5 kg');
      expect(alerts.length).toBe(1);
      answer = null; await choose(el, 'custom');
      expect(store.text('Data', 'A1')).toBe('1234.5 kg');
      expect(alerts.length).toBe(1);
    } finally { globalThis.alert = realAlert; }
  });

  it('± decimals: General reads the value’s own decimals; formats gain and lose a 0; dates are left alone', async () => {
    const { el, store } = await pane();
    store.select({ sheet: 'Data', ref: 'A3' }); await frame();
    await click(el, 'numfmt-dec-more'); expect(store.text('Data', 'A3')).toBe('1234.50');
    await click(el, 'numfmt-dec-more'); expect(store.text('Data', 'A3')).toBe('1234.500');
    await click(el, 'numfmt-dec-less'); await click(el, 'numfmt-dec-less'); await click(el, 'numfmt-dec-less');
    expect(store.text('Data', 'A3')).toBe('1235');
    await click(el, 'numfmt-dec-less'); expect(store.text('Data', 'A3')).toBe('1235'); // nothing left to remove
    store.select({ sheet: 'Data', ref: 'A2' }); await frame();
    await click(el, 'numfmt-dec-more'); expect(store.text('Data', 'A2')).toBe('25.6%');
    store.select({ sheet: 'Data', ref: 'A5' }); await frame();
    await click(el, 'numfmt-dec-more'); expect(store.text('Data', 'A5')).toBe('3/15/2023');
    expect(store.changeOf('Data', 'A5', 'numFmt')).toBeUndefined();
    // a range: each cell moves from its own format
    store.select({ sheet: 'Data', ref: 'A1', range: 'A1:A2' }); await frame();
    await click(el, 'numfmt-dec-more');
    expect([store.text('Data', 'A1'), store.text('Data', 'A2')]).toEqual(['1,234.500', '25.60%']);
    expect($(el, '[data-control=numfmt-dec-more]').getAttribute('aria-label')).toBe('Increase decimals');
    expect($(el, '[data-control=numfmt-dec-less]').innerHTML).not.toMatch(/font/i);
  });

  it('adjustDecimals on codes', () => {
    const inc = (c: string) => adjustDecimals(c, 1), dec = (c: string) => adjustDecimals(c, -1);
    expect(inc('0')).toBe('0.0');
    expect(inc('#,##0')).toBe('#,##0.0');
    expect(inc('0.00')).toBe('0.000');
    expect(dec('0.00')).toBe('0.0');
    expect(dec('0.0')).toBe('0');
    expect(dec('0')).toBe('0');
    expect(inc('0%')).toBe('0.0%');
    expect(inc('$#,##0.00_);($#,##0.00)')).toBe('$#,##0.000_);($#,##0.000)');
    expect(dec('$#,##0.00_);[Red]($#,##0.00)')).toBe('$#,##0.0_);[Red]($#,##0.0)');
    expect(inc('0.00E+00')).toBe('0.000E+00');
    expect(inc('0.0,,"M"')).toBe('0.00,,"M"');
    expect(inc('"x.y" 0')).toBe('"x.y" 0.0');
    expect(inc('#,##0;"neg"')).toBe('#,##0.0;"neg"');
    for (const c of ['m/d/yyyy', 'h:mm', '@', 'General', '# ?/?', '[h]:mm']) expect(inc(c)).toBe(c);
  });
});

describe('decorate: padded formats keep their spaces (W-15 hazard 2)', () => {
  it('white-space: pre on accounting and ?-formats only', async () => {
    const { store } = await pane([numfmt()], [
      { ref: 'A1', value: 1234.5, id: 44 }, { ref: 'A2', value: 1234.5, code: '#,##0.00' }, { ref: 'A3', value: 0.5, id: 12 }, { ref: 'A4', value: 1, id: 0 },
    ]);
    expect(store.decorate('Data', 'A1')).toEqual({ 'white-space': 'pre' });
    expect(store.decorate('Data', 'A2')).toEqual({});
    expect(store.decorate('Data', 'A3')).toEqual({ 'white-space': 'pre' });
    expect(store.decorate('Data', 'A4')).toEqual({});
  });
});

describe('limits', () => {
  it('a selection beyond MAX_CELLS formats the first MAX_CELLS cells and warns once', async () => {
    const cells = Array.from({ length: MAX_CELLS + 200 }, (_, i) => ({ ref: `A${i + 1}`, value: i }));
    const { el, store } = await pane([numfmt(), ui()], cells);
    const warn = console.warn;
    const said: string[] = [];
    console.warn = (m?: unknown) => { said.push(String(m)); };
    try {
      store.select({ sheet: 'Data', ref: 'A1', range: `A1:A${MAX_CELLS + 200}` });
      await choose(el, 'percentage');
    } finally { console.warn = warn; }
    expect(store.changeCount).toBe(MAX_CELLS);
    expect(said).toHaveLength(1);
    expect(said[0]).toMatch(/larger than 10000 cells/);
  }, 60_000);
});
