// W-49 DoD 10: patchXlsx's `hidden` option — rows, column spans, outline levels and sheet
// state, with the workbook view kept on a visible sheet. Read back as XML and through ExcelJS.
import { describe, expect, it } from 'vitest';
import { ExportError, patchXlsx, rawData, readZip, toXlsx } from '../src/index.js';
import { minimalPackage, readBack, unzipText, zipParts } from './helpers.js';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
const sheetData = (xml: string) => /<sheetData>[\s\S]*<\/sheetData>/.exec(xml)?.[0];
const cols = (xml: string) => /<cols>[\s\S]*?<\/cols>/.exec(xml)?.[0];

/** Three sheets; the first is active and tab-selected. `views` replaces `<bookViews>`. */
function threeSheets(views = '<bookViews><workbookView activeTab="0" firstSheet="0"/></bookViews>'): Uint8Array {
  const ws = (body: string) => `<worksheet xmlns="${NS}">${body}<sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData></worksheet>`;
  return zipParts({
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
    '_rels/.rels': `<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${NS}" xmlns:r="${R}">${views}<sheets><sheet name="One" sheetId="1" r:id="rId1"/><sheet name="Two" sheetId="2" r:id="rId2"/><sheet name="Three" sheetId="3" r:id="rId3"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${PR}">${[1, 2, 3].map((n) => `<Relationship Id="rId${n}" Type="${R}/worksheet" Target="worksheets/sheet${n}.xml"/>`).join('')}</Relationships>`,
    'xl/worksheets/sheet1.xml': ws('<sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews>'),
    'xl/worksheets/sheet2.xml': ws('<sheetFormatPr defaultRowHeight="15"/>'),
    'xl/worksheets/sheet3.xml': ws('<sheetViews><sheetView workbookViewId="0"/></sheetViews>'),
  });
}

describe('hidden rows (W-49 DoD 10)', () => {
  const sheet = `<worksheet xmlns="${NS}"><sheetData><row r="1"><c r="A1"><v>1</v></c></row><row r="3" hidden="1" spans="1:1"><c r="A3"><v>3</v></c></row><row r="5" ht="0" customHeight="1"/></sheetData></worksheet>`;
  it('sets hidden on the listed rows, creates missing rows in order, clears the rest (zero height too)', async () => {
    const z = unzipText(await patchXlsx(minimalPackage(sheet), [], { hidden: [{ sheet: 'Data', rows: [1, 3, 7] }] }));
    expect(sheetData(z['xl/worksheets/sheet1.xml']!)).toBe('<sheetData><row r="1"><c r="A1"><v>1</v></c></row><row r="2" hidden="1"/><row r="3" spans="1:1"><c r="A3"><v>3</v></c></row><row r="4" hidden="1"/><row r="5"/><row r="8" hidden="1"/></sheetData>');
  });
  it('keeps a hidden row hidden and its other attributes; ExcelJS reads the rows hidden', async () => {
    const out = await patchXlsx(minimalPackage(sheet), [{ sheet: 'Data', ref: 'A2', value: 2 }], { hidden: [{ sheet: 'Data', rows: [1, 2, 4] }] });
    const xml = unzipText(out)['xl/worksheets/sheet1.xml']!;
    expect(xml).toContain('<row r="2" hidden="1"><c r="A2"><v>2</v></c></row>');
    expect(xml).toContain('<row r="3" hidden="1" spans="1:1">');
    expect(xml).toContain('<row r="5" ht="0" customHeight="1" hidden="1"/>');
    const ws = (await readBack(out)).getWorksheet('Data')!;
    expect([1, 2, 3, 4, 5].map((r) => ws.getRow(r).hidden)).toEqual([false, true, true, false, true]);
  });
  it('fills an empty or self-closing sheetData', async () => {
    const z = unzipText(await patchXlsx(minimalPackage(`<worksheet xmlns="${NS}"><sheetData/></worksheet>`), [], { hidden: [{ sheet: 'Data', rows: [0] }] }));
    expect(z['xl/worksheets/sheet1.xml']).toContain('<sheetData><row r="1" hidden="1"/></sheetData>');
  });
});

describe('hidden columns: <col> spans split and merged (W-49 DoD 10)', () => {
  const sheet = `<worksheet xmlns="${NS}"><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="5" width="12" style="3" customWidth="1"/><col min="6" max="6" width="9" hidden="1"/><col min="7" max="7" width="0" customWidth="1"/></cols><sheetData/></worksheet>`;
  it('splits a span so exactly the listed columns are hidden, keeping width and style on each piece', async () => {
    const out = await patchXlsx(minimalPackage(sheet), [], { hidden: [{ sheet: 'Data', cols: [2, 6] }] });
    expect(cols(unzipText(out)['xl/worksheets/sheet1.xml']!)).toBe('<cols>'
      + '<col min="1" max="2" width="12" style="3" customWidth="1"/>'
      + '<col min="3" max="3" width="12" style="3" customWidth="1" hidden="1"/>'
      + '<col min="4" max="5" width="12" style="3" customWidth="1"/>'
      + '<col min="6" max="6" width="9"/>'
      + '<col min="7" max="7" width="0" customWidth="1" hidden="1"/></cols>');
    // ExcelJS needs a styles part for `style`; read the same spans without it
    const plain = await patchXlsx(minimalPackage(sheet.replace(' style="3"', '')), [], { hidden: [{ sheet: 'Data', cols: [2, 6] }] });
    const ws = (await readBack(plain)).getWorksheet('Data')!;
    expect([1, 2, 3, 4, 5, 6, 7].map((c) => ws.getColumn(c).hidden)).toEqual([false, false, true, false, false, false, true]);
  });
  it('merges the pieces back on unhide; a zero width loses its width', async () => {
    const once = await patchXlsx(minimalPackage(sheet), [], { hidden: [{ sheet: 'Data', cols: [2] }] });
    const back = await patchXlsx(once, [], { hidden: [{ sheet: 'Data', cols: [] }] });
    expect(cols(unzipText(back)['xl/worksheets/sheet1.xml']!)).toBe('<cols><col min="1" max="5" width="12" style="3" customWidth="1"/><col min="6" max="6" width="9"/></cols>');
  });
  it('creates <cols> after sheetFormatPr and before sheetData when there is none, and drops it when emptied', async () => {
    const bare = `<worksheet xmlns="${NS}"><sheetFormatPr defaultRowHeight="15"/><sheetData/></worksheet>`;
    const out = await patchXlsx(minimalPackage(bare), [], { hidden: [{ sheet: 'Data', cols: [0, 1, 3] }] });
    const xml = unzipText(out)['xl/worksheets/sheet1.xml']!;
    expect(xml).toContain('<sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="2" hidden="1"/><col min="4" max="4" hidden="1"/></cols><sheetData/>');
    expect(unzipText(await patchXlsx(out, [], { hidden: [{ sheet: 'Data', cols: [] }] }))['xl/worksheets/sheet1.xml']).not.toContain('<cols');
  });
  it('splits what toXlsx wrote, and leaves sheets not named byte for byte', async () => {
    const orig = await toXlsx({ sheets: [{ name: 'A', rows: [[1, 2, 3]], columnWidths: [10, 10, 10] }, { name: 'B', rows: [[1]] }] });
    const out = await patchXlsx(orig, [], { hidden: [{ sheet: 'A', cols: [1] }] });
    const ws = (await readBack(out)).getWorksheet('A')!;
    expect([1, 2, 3].map((c) => ws.getColumn(c).hidden)).toEqual([false, true, false]);
    expect([1, 2, 3].map((c) => Math.round(ws.getColumn(c).width ?? 0))).toEqual([10, 10, 10]);
    const raw = (b: Uint8Array) => rawData(b, readZip(b).find((e) => e.name === 'xl/worksheets/sheet2.xml')!);
    expect(raw(out)).toEqual(raw(orig));
  });
});

describe('outline levels (W-49 DoD 10)', () => {
  it('writes outlineLevel on rows and columns and the deepest level on sheetFormatPr; clears levels not listed', async () => {
    const sheet = `<worksheet xmlns="${NS}"><sheetFormatPr defaultRowHeight="15"/><sheetData><row r="1" outlineLevel="3"/><row r="2"/></sheetData></worksheet>`;
    const out = await patchXlsx(minimalPackage(sheet), [], { hidden: [{ sheet: 'Data', outline: { rows: { 1: 1, 2: 2 }, cols: { 0: 1, 1: 1 } } }] });
    const xml = unzipText(out)['xl/worksheets/sheet1.xml']!;
    expect(xml).toContain('<sheetFormatPr defaultRowHeight="15" outlineLevelRow="2" outlineLevelCol="1"/>');
    expect(sheetData(xml)).toBe('<sheetData><row r="1"/><row r="2" outlineLevel="1"/><row r="3" outlineLevel="2"/></sheetData>');
    expect(cols(xml)).toBe('<cols><col min="1" max="2" outlineLevel="1"/></cols>');
    const ws = (await readBack(out)).getWorksheet('Data')!;
    expect([2, 3].map((r) => ws.getRow(r).outlineLevel)).toEqual([1, 2]);
    expect(ws.properties.outlineLevelRow).toBe(2);
    const flat = unzipText(await patchXlsx(out, [], { hidden: [{ sheet: 'Data', outline: { rows: {}, cols: {} } }] }))['xl/worksheets/sheet1.xml']!;
    expect(flat).toContain('<sheetFormatPr defaultRowHeight="15"/>');
    expect(flat).not.toContain('outlineLevel');
    expect(flat).not.toContain('<cols');
  });
  it('adds sheetFormatPr in schema order when the sheet has none', async () => {
    const out = await patchXlsx(minimalPackage(`<worksheet xmlns="${NS}"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetData/></worksheet>`), [], { hidden: [{ sheet: 'Data', outline: { cols: { 2: 1 } } }] });
    expect(unzipText(out)['xl/worksheets/sheet1.xml']).toContain('</sheetViews><sheetFormatPr defaultRowHeight="15" outlineLevelCol="1"/><cols><col min="3" max="3" outlineLevel="1"/></cols><sheetData/>');
  });
});

describe('sheet state and the active sheet (W-49 DoD 10)', () => {
  it('hides the active sheet: activeTab, firstSheet and tabSelected move to the first visible sheet', async () => {
    const out = await patchXlsx(threeSheets(), [], { hidden: [{ sheet: 'One', state: 'hidden' }, { sheet: 'Three', state: 'veryHidden' }] });
    const z = unzipText(out);
    expect(z['xl/workbook.xml']).toContain('<workbookView activeTab="1" firstSheet="1"/>');
    expect(z['xl/workbook.xml']).toContain('<sheet name="One" sheetId="1" r:id="rId1" state="hidden"/>');
    expect(z['xl/workbook.xml']).toContain('<sheet name="Three" sheetId="3" r:id="rId3" state="veryHidden"/>');
    expect(z['xl/worksheets/sheet1.xml']).toContain('<sheetView workbookViewId="0"/>');
    expect(z['xl/worksheets/sheet2.xml']).toContain('<sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews><sheetFormatPr');
    const wb = await readBack(out);
    expect(wb.worksheets.map((w) => w.state)).toEqual(['hidden', 'visible', 'veryHidden']);
  });
  it('visible removes the attribute; an active sheet that stays visible is not moved', async () => {
    const hidden = await patchXlsx(threeSheets(), [], { hidden: [{ sheet: 'Two', state: 'hidden' }] });
    expect(unzipText(hidden)['xl/workbook.xml']).toContain('<workbookView activeTab="0" firstSheet="0"/>');
    const shown = unzipText(await patchXlsx(hidden, [], { hidden: [{ sheet: 'Two', state: 'visible' }] }))['xl/workbook.xml']!;
    expect(shown).toContain('<sheet name="Two" sheetId="2" r:id="rId2"/>');
  });
  it('adds a workbook view when there is none and sheet 0 is hidden', async () => {
    const z = unzipText(await patchXlsx(threeSheets(''), [], { hidden: [{ sheet: 'One', state: 'hidden' }] }));
    expect(z['xl/workbook.xml']).toContain('<bookViews><workbookView activeTab="1"/></bookViews><sheets>');
  });
  it('refuses to hide every sheet, a bad index or level or state, and an unknown sheet, with SP codes', async () => {
    const err = async (h: Parameters<typeof patchXlsx>[2]) => { try { await patchXlsx(threeSheets(), [], h); } catch (e) { return e as ExportError; } throw new Error('did not throw'); };
    const all = await err({ hidden: [{ sheet: 'One', state: 'hidden' }, { sheet: 'Two', state: 'hidden' }, { sheet: 'Three', state: 'veryHidden' }] });
    expect([all.code, all.spCode]).toEqual(['sheet-count', 'SP-2002']);
    expect((await err({ hidden: [{ sheet: 'One', rows: [-1] }] })).code).toBe('bad-ref');
    expect((await err({ hidden: [{ sheet: 'One', cols: [16_384] }] })).code).toBe('bad-ref');
    expect((await err({ hidden: [{ sheet: 'One', outline: { rows: { 0: 8 } } }] })).code).toBe('bad-value');
    // @ts-expect-error — not a state
    expect((await err({ hidden: [{ sheet: 'One', state: 'gone' }] })).code).toBe('bad-value');
    const none = await err({ hidden: [{ sheet: 'Nope', rows: [] }] });
    expect([none.code, none.sheet]).toEqual(['no-sheet', 'Nope']);
  });
});
