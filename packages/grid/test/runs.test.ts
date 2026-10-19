// W-53 DoD 2 and 3, the core's half: a rich-text cell's runs reach `decorateRuns` while the cell holds
// the file's value; the grid draws the pieces as spans (allow-listed, never a font family, plain when
// the text does not match); an edit drops the runs, warns in the cell bar and on sheetpane-editstart.
import { afterEach, describe, expect, it } from 'vitest';
import { utf8, writeZip } from '@sheetpane/export';
import { createWorkbook, type Plugin, type SheetpaneExcel } from '../src/index.js';
import { cellEl, cleanup, frame, shadow } from './helpers.js';

afterEach(cleanup);

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';

/** Data!A1 rich (`Net ` + italic `of tax`), B1 plain — inline strings, no styles part. */
function richBook(): Promise<Uint8Array> {
  const parts: Record<string, string> = {
    '[Content_Types].xml': `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>`,
    '_rels/.rels': `<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${NS}" xmlns:r="${R}"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${NS}"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><r><t xml:space="preserve">Net </t></r><r><rPr><i/></rPr><t>of tax</t></r></is></c><c r="B1" t="inlineStr"><is><t>plain</t></is></c></row></sheetData></worksheet>`,
  };
  return writeZip(Object.entries(parts).map(([name, s]) => ({ name, data: utf8(s) })));
}

/** A decorate plugin whose pieces italicise each formatted run — or whatever `pieces` returns. */
const runsPlugin = (pieces?: Plugin['decorateRuns']): Plugin => ({
  id: 'runs', provides: ['decorate'], decorate: () => undefined,
  decorateRuns: pieces ?? ((cell) => cell.runs?.map((r) => (r.i ? { text: r.text, style: { 'font-style': 'italic' } } : { text: r.text }))),
});

async function mount(plugins: Plugin[], mode: 'view' | 'edit' = 'view'): Promise<SheetpaneExcel> {
  const s = createWorkbook({ plugins });
  await s.load(await richBook(), 'rich.xlsx');
  const el = document.createElement('sheetpane-excel');
  el.style.height = '400px';
  document.body.append(el);
  el.workbook = s;
  s.setMode(mode);
  await frame();
  return el;
}
const v = (el: Element, r: number, c: number) => cellEl(el, r, c)!.querySelector('.v')!;

describe('the store hands a rich cell\'s runs to decorateRuns (W-53 DoD 2)', () => {
  it('runs() and the cell context carry the file\'s runs; a plain cell has none', async () => {
    const s = createWorkbook({ plugins: [runsPlugin()] });
    await s.load(await richBook(), 'rich.xlsx');
    expect(s.runs('Data', 'A1')).toEqual([{ text: 'Net ' }, { text: 'of tax', i: true }]);
    expect(s.cellContext('Data', 'A1')!.runs).toBe(s.runs('Data', 'A1'));
    expect(s.runs('Data', 'B1')).toBeUndefined();
    expect('runs' in s.cellContext('Data', 'B1')!).toBe(false);
    expect(s.decorateRuns('Data', 'A1')).toEqual([{ text: 'Net ' }, { text: 'of tax', style: { 'font-style': 'italic' } }]);
    expect(s.decorateRuns('Data', 'B1')).toBeUndefined();
  });
  it('an edit writes plain text: the runs go, and come back with undo', async () => {
    const s = createWorkbook({ plugins: [runsPlugin()] });
    await s.load(await richBook(), 'rich.xlsx');
    s.setCell('Data', 'A1', 'Net of all tax');
    expect(s.runs('Data', 'A1')).toBeUndefined();
    expect(s.decorateRuns('Data', 'A1')).toBeUndefined();
    s.undo();
    expect(s.runs('Data', 'A1')).toHaveLength(2);
  });
  it('a style change keeps the runs (only the value carries them)', async () => {
    const s = createWorkbook({ plugins: [runsPlugin()] });
    await s.load(await richBook(), 'rich.xlsx');
    s.setChange('Data', '#style:A1', 'style', { b: true }, {});
    expect(s.runs('Data', 'A1')).toHaveLength(2);
  });
  it('pieces whose text is not the cell\'s are drawn plain; CSS outside the allow-list is dropped', async () => {
    const s = createWorkbook({ plugins: [runsPlugin(() => [{ text: 'Net' }])] });
    await s.load(await richBook(), 'rich.xlsx');
    expect(s.decorateRuns('Data', 'A1')).toBeUndefined();
    const t = createWorkbook({ plugins: [runsPlugin((c) => c.runs!.map((r) => ({ text: r.text, style: { color: '#123456', position: 'absolute' } as never })))] });
    await t.load(await richBook(), 'rich.xlsx');
    expect(t.decorateRuns('Data', 'A1')!.map((p) => p.style)).toEqual([{ color: '#123456' }, { color: '#123456' }]);
  });
  it('a font family in a piece throws SP-3010 (SR-LAW-5)', async () => {
    const fam = 'font' + '-family';
    const s = createWorkbook({ plugins: [runsPlugin((c) => c.runs!.map((r) => ({ text: r.text, style: { [fam]: 'serif' } as never })))] });
    await s.load(await richBook(), 'rich.xlsx');
    expect(() => s.decorateRuns('Data', 'A1')).toThrow(/SP-3010/);
  });
});

describe('drawing the runs (W-53 DoD 2)', () => {
  it('with a decorate plugin: one span per styled run, the text whole', async () => {
    const el = await mount([runsPlugin()]);
    const a1 = v(el, 0, 0);
    expect(a1.textContent).toBe('Net of tax');
    const spans = a1.querySelectorAll('span');
    expect(spans).toHaveLength(1);
    expect(spans[0]!.textContent).toBe('of tax');
    expect(getComputedStyle(spans[0]!).fontStyle).toBe('italic');
    expect(v(el, 0, 1).children).toHaveLength(0);
  });
  it('with no plugin the cell is plain text', async () => {
    const el = await mount([]);
    expect(v(el, 0, 0).children).toHaveLength(0);
    expect(v(el, 0, 0).textContent).toBe('Net of tax');
  });
  it('an edited cell is drawn plain', async () => {
    const el = await mount([runsPlugin()], 'edit');
    el.workbook!.setCell('Data', 'A1', 'Net');
    await frame();
    expect(v(el, 0, 0).children).toHaveLength(0);
  });
});

describe('editing a rich cell warns (W-53 DoD 3)', () => {
  const focusCell = async (el: SheetpaneExcel, ref: string) => {
    el.workbook!.select({ sheet: 'Data', ref });
    await frame();
    (shadow(el).querySelector('[data-sp="cell-input"]') as HTMLInputElement).focus();
    await frame();
  };
  const chip = (el: Element) => shadow(el).querySelector<HTMLElement>('[data-sp="rich-text"]')!;
  it('the cell bar says the edit saves plain text; sheetpane-editstart carries richText', async () => {
    const el = await mount([], 'edit');
    const starts: Record<string, unknown>[] = [];
    el.addEventListener('sheetpane-editstart', (e) => starts.push((e as CustomEvent).detail));
    await focusCell(el, 'A1');
    expect(chip(el).hidden).toBe(false);
    expect(chip(el).textContent).toMatch(/Mixed formatting — an edit saves plain text/);
    expect(chip(el).getAttribute('role')).toBe('status');
    expect(starts[0]).toMatchObject({ ref: 'A1', richText: true });
    const input = shadow(el).querySelector('[data-sp="cell-input"]') as HTMLInputElement;
    input.value = 'Net of all tax';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await frame();
    expect(el.workbook!.value('Data', 'A1')).toBe('Net of all tax');
    expect(el.workbook!.runs('Data', 'A1')).toBeUndefined();
    expect(chip(el).hidden).toBe(true);
  });
  it('a plain cell: no warning, no richText key', async () => {
    const el = await mount([], 'edit');
    const starts: Record<string, unknown>[] = [];
    el.addEventListener('sheetpane-editstart', (e) => starts.push((e as CustomEvent).detail));
    await focusCell(el, 'B1');
    expect(chip(el).hidden).toBe(true);
    expect(starts[0]).not.toHaveProperty('richText');
  });
  it('View shows no warning', async () => {
    const el = await mount([], 'view');
    el.workbook!.select({ sheet: 'Data', ref: 'A1' });
    await frame();
    expect(chip(el).hidden).toBe(true);
  });
});
