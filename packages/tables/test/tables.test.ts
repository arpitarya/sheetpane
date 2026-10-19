// W-61 DoD 3: @sheetpane/tables — each table drawn by its style: header, bands, first / last column,
// totals; the subset and its fallback; a cell's own format over the table; registered as `tables`.
import { afterEach, describe, expect, it } from 'vitest';
import { writeZip } from '@sheetpane/export';
import '@sheetpane/grid';
import { createWorkbook, pluginsFromIds, type SheetpaneExcel } from '@sheetpane/grid';
import { styles } from '@sheetpane/styles';
import { TABLE_STYLES, findTable, paletteOf, tableAt, tableCss, tables, tint, type Table } from '../src/index.js';

afterEach(() => document.body.replaceChildren());
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';

const table = (o: Partial<Table> & Pick<Table, 'ref'>): Table => ({
  name: 'T', id: 1, headerRowCount: 1, totalsRowCount: 0, columns: [], path: 'xl/tables/table1.xml',
  style: { name: 'TableStyleMedium2', showFirstColumn: false, showLastColumn: false, showRowStripes: true, showColumnStripes: false }, ...o,
});

// Office's default theme: accent 1 is 4472C4
const BLUE = '#4472C4', STRIPE = `#${tint('4472C4', 0.8)}`, LINE = `#${tint('4472C4', 0.4)}`;

describe('the style subset (DoD 3)', () => {
  it('Light 1–7 and Medium 1–7; style 1 in the dark text colour, 2–7 in accents 1–6, from the workbook theme', () => {
    expect(TABLE_STYLES).toHaveLength(14);
    expect(paletteOf('TableStyleMedium2')).toMatchObject({ kind: 'medium', accent: BLUE, ink: '#000000', onAccent: '#FFFFFF' });
    expect(paletteOf('TableStyleLight7')!.accent).toBe('#70AD47');
    expect(paletteOf('TableStyleMedium1')).toMatchObject({ accent: '#000000', stripe: '#D9D9D9' });
    const theme = ['FFFFFF', '111111', 'EEEEEE', '222222', 'AA0000'];
    expect(paletteOf('TableStyleMedium2', theme)).toMatchObject({ accent: '#AA0000', ink: '#111111' });
    for (const n of ['TableStyleMedium9', 'TableStyleDark1', 'TableStyleLight8', 'MyStyle', undefined]) expect(paletteOf(n), String(n)).toBeUndefined();
  });
  it('tint is Excel’s HSL tint', () => {
    expect(tint('4472C4', 0.8)).toBe('DAE3F3');
    expect(tint('000000', 0.85)).toBe('D9D9D9');
    expect(tint('FFFFFF', -0.5)).toBe('808080');
  });
});

describe('tableCss: one cell’s look (DoD 3)', () => {
  // A1:C6 — header, four data rows, a totals row
  const t = table({ ref: 'A1:C6', totalsRowCount: 1 });
  it('Medium: the header filled in the accent, white and bold; a line under every row', () => {
    expect(tableCss(t, 0, 0)).toEqual({ 'font-weight': '700', 'border-top': `1px solid ${LINE}`, 'border-bottom': `1px solid ${LINE}`, 'background-color': BLUE, color: '#FFFFFF' });
  });
  it('banded rows: the first data row and every other one filled, in the dark ink', () => {
    expect(tableCss(t, 1, 1)).toEqual({ 'border-bottom': `1px solid ${LINE}`, 'background-color': STRIPE, color: '#000000' });
    expect(tableCss(t, 2, 1)).toEqual({ 'border-bottom': `1px solid ${LINE}` });
    expect(tableCss(t, 3, 1)!['background-color']).toBe(STRIPE);
  });
  it('the totals row: bold under a double line, never banded', () => {
    expect(tableCss(t, 5, 2)).toEqual({ 'font-weight': '700', 'border-top': `3px double ${BLUE}`, 'border-bottom': `1px solid ${LINE}` });
  });
  it('banded columns, and the first and last columns bold', () => {
    const c = table({ ref: 'B2:D4', style: { name: 'TableStyleMedium2', showFirstColumn: true, showLastColumn: true, showRowStripes: false, showColumnStripes: true } });
    expect(tableCss(c, 2, 1)).toMatchObject({ 'font-weight': '700', 'background-color': STRIPE });
    expect(tableCss(c, 2, 2)).toEqual({ 'border-bottom': `1px solid ${LINE}` });
    expect(tableCss(c, 2, 3)).toMatchObject({ 'font-weight': '700', 'background-color': STRIPE });
  });
  it('Light: lines over and under the table and under the header, no header fill', () => {
    const l = table({ ref: 'A1:A3', style: { name: 'TableStyleLight2', showFirstColumn: false, showLastColumn: false, showRowStripes: true, showColumnStripes: false } });
    expect(tableCss(l, 0, 0)).toEqual({ 'font-weight': '700', 'border-top': `1px solid ${BLUE}`, 'border-bottom': `1px solid ${BLUE}` });
    expect(tableCss(l, 1, 0)).toEqual({ 'background-color': STRIPE, color: '#000000' });
    expect(tableCss(l, 2, 0)).toEqual({ 'border-bottom': `1px solid ${BLUE}` });
  });
  it('no header row: banding starts at the top', () => {
    const n = table({ ref: 'A1:A3', headerRowCount: 0 });
    expect(tableCss(n, 0, 0)!['background-color']).toBe(STRIPE);
    expect(tableCss(n, 0, 0)!['font-weight']).toBeUndefined();
  });
  it('a style outside the subset: a bold header only; no style: nothing; outside the table: nothing', () => {
    const other = table({ ref: 'A1:A3', style: { name: 'TableStyleDark4', showFirstColumn: false, showLastColumn: false, showRowStripes: true, showColumnStripes: false } });
    expect(tableCss(other, 0, 0)).toEqual({ 'font-weight': '700' });
    expect(tableCss(other, 1, 0)).toBeUndefined();
    const none = table({ ref: 'A1:A3', style: { showFirstColumn: false, showLastColumn: false, showRowStripes: true, showColumnStripes: false } });
    expect(tableCss(none, 0, 0)).toBeUndefined();
    expect(tableCss(t, 6, 0)).toBeUndefined();
    expect(tableCss(t, 0, 3)).toBeUndefined();
  });
});

// Lists: Units at A1:B3 (Medium 2, banded rows), Plain at D1:D2 (no style); A1 carries the file's own fill
function bytes(): Promise<Uint8Array> {
  const s = (r: string, t: string, st = '') => `<c r="${r}"${st} t="inlineStr"><is><t>${t}</t></is></c>`;
  const T = `${R}/table`;
  const parts: Record<string, string> = {
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
    '_rels/.rels': `<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${NS}" xmlns:r="${R}"><sheets><sheet name="Lists" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${R}/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': `<styleSheet xmlns="${NS}"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/></patternFill></fill></fills><borders count="1"><border/></borders><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="0" fillId="2" borderId="0" applyFill="1"/></cellXfs></styleSheet>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${NS}" xmlns:r="${R}"><sheetData><row r="1">${s('A1', 'Unit', ' s="1"')}${s('B1', 'Meaning')}${s('D1', 'Plain')}</row><row r="2">${s('A2', 'mg/L')}${s('B2', 'milligrams')}${s('D2', 'x')}</row><row r="3">${s('A3', '%')}${s('B3', 'percent')}</row></sheetData><tableParts count="2"><tablePart r:id="rId1"/><tablePart r:id="rId2"/></tableParts></worksheet>`,
    'xl/worksheets/_rels/sheet1.xml.rels': `<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${T}" Target="../tables/table1.xml"/><Relationship Id="rId2" Type="${T}" Target="../tables/table2.xml"/></Relationships>`,
    'xl/tables/table1.xml': `<table xmlns="${NS}" id="1" name="Units" displayName="Units" ref="A1:B3"><tableColumns count="2"><tableColumn id="1" name="Unit"/><tableColumn id="2" name="Meaning"/></tableColumns><tableStyleInfo name="TableStyleMedium2" showRowStripes="1"/></table>`,
    'xl/tables/table2.xml': `<table xmlns="${NS}" id="2" name="Plain" displayName="Plain" ref="D1:D2"><tableColumns count="1"><tableColumn id="1" name="Plain"/></tableColumns></table>`,
  };
  return writeZip(Object.entries(parts).map(([name, x]) => ({ name, data: new TextEncoder().encode(x) })));
}

describe('the plugin on a workbook (DoD 3)', () => {
  it('decorate draws each table cell; tableAt and findTable find the table', async () => {
    const s = createWorkbook({ plugins: [tables()] });
    await s.load(await bytes(), 'tables.xlsx');
    expect(s.decorate('Lists', 'B1')).toMatchObject({ 'background-color': BLUE, color: '#FFFFFF', 'font-weight': '700' });
    expect(s.decorate('Lists', 'B2')).toMatchObject({ 'background-color': STRIPE });
    expect(s.decorate('Lists', 'B3')).toEqual({ 'border-bottom': `1px solid ${LINE}` });
    expect(s.decorate('Lists', 'D1')).toEqual({}); // a table with no style draws nothing
    expect(s.decorate('Lists', 'C2')).toEqual({});
    const sheet = s.book!.sheets[0]!;
    expect(tableAt(sheet, 2, 1)?.name).toBe('Units');
    expect(tableAt(sheet, 2, 2)).toBeUndefined();
    expect(findTable(s.book!, 'units')).toMatchObject({ sheet: 'Lists', table: { ref: 'A1:B3' } });
    expect(findTable(s.book!, 'nope')).toBeUndefined();
  });
  it('a cell’s own format draws over the table’s style, whatever order the plugins are listed in', async () => {
    for (const plugins of [[tables(), styles()], [styles(), tables()]]) {
      const s = createWorkbook({ plugins });
      await s.load(await bytes(), 'tables.xlsx');
      expect(s.decorate('Lists', 'A1')['background-color']).toBe('#FFF2CC');
      expect(s.decorate('Lists', 'B1')['background-color']).toBe(BLUE);
    }
  });
  it('importing the module registers `tables`; a real grid draws the header', async () => {
    expect(pluginsFromIds(['tables']).map((p) => p.id)).toEqual(['tables']);
    const el = document.createElement('sheetpane-excel') as SheetpaneExcel;
    el.style.height = '400px';
    el.setAttribute('plugins', 'tables');
    document.body.append(el);
    await el.load(await bytes(), 'tables.xlsx');
    await frame();
    const cell = el.shadowRoot!.querySelector<HTMLElement>('#c0_1')!;
    expect(cell.style.backgroundColor).toBe('rgb(68, 114, 196)');
    expect(cell.style.fontWeight).toBe('700');
  });
});
