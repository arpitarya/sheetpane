// W-52 DoD 4: patchXlsx's `structure` option — every part that names a cell moved in the
// package itself; pivots, tables and array formulas refused when they would be cut; and the
// property: inserting then deleting the same span gives back the same values, merges and rules.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { ExportError, patchXlsx, type StructureOp } from '../src/index.js';
import { structureBook, structureParts } from './fixtures/structure.js';
import { readBack, unzipText } from './helpers.js';

const op = (o: Partial<StructureOp> & Pick<StructureOp, 'op' | 'at'>): StructureOp => ({ sheet: 'Data', count: 1, ...o });
const patched = async (ops: StructureOp[], extra?: Record<string, string>, changes: Parameters<typeof patchXlsx>[1] = []) => unzipText(await patchXlsx(await structureBook(extra), changes, { structure: ops }));

describe('insert rows (W-52 DoD 4)', async () => {
  const z = await patched([op({ op: 'insertRows', at: 2, count: 2 })]);
  const sheet = z['xl/worksheets/sheet1.xml']!;
  it('renumbers rows and cells and moves their formulas', () => {
    expect(sheet).toContain('<row r="2"><c r="A2" t="inlineStr"><is><t>a</t></is></c><c r="B2"><v>1.5</v></c><c r="C2"><v>2</v></c><c r="D2"><f>B2*C2</f>');
    expect(sheet).toContain('<row r="5"><c r="A5" t="inlineStr"><is><t>b</t></is></c><c r="B5"><v>2</v></c><c r="C5"><v>3</v></c><c r="D5"><f>B5*C5</f>');
    expect(sheet).toContain('<c r="D8"><f>SUM(D2:D7)</f>');
    expect(sheet).not.toContain('<row r="3">');
  });
  it('moves merges, rules, validations, hyperlinks, the filter, the view and the dimension', () => {
    expect(sheet).toContain('<mergeCell ref="A8:C8"/>');
    expect(sheet).toContain('<conditionalFormatting sqref="D2:D7"><cfRule type="expression" priority="1"><formula>D2&gt;$B$2*2</formula>');
    expect(sheet).toContain('<dataValidation type="decimal" allowBlank="1" showErrorMessage="1" sqref="B2:B7"><formula1>0</formula1><formula2>$D$8</formula2>');
    expect(sheet).toContain('<hyperlink ref="A5" location="Other!A1" display="go"/>');
    expect(sheet).toContain('<autoFilter ref="A1:D7"/>');
    expect(sheet).toContain('<dimension ref="A1:D8"/>');
    expect(sheet).toContain('<selection pane="bottomLeft" activeCell="B5" sqref="B5"/>');
    expect(sheet).toContain('<pane ySplit="1" topLeftCell="A2"'); // the frozen header is above the insert
  });
  it('moves formulas on other sheets, defined names, chart series, drawings, notes, VML and threads', () => {
    expect(z['xl/worksheets/sheet2.xml']).toContain('<f>Data!D8*2</f>');
    expect(z['xl/worksheets/sheet2.xml']).toContain('<f>SUM(Data!B2:B7)</f>');
    expect(z['xl/worksheets/sheet2.xml']).toContain('<f>Data!B5+A1</f>');
    expect(z['xl/workbook.xml']).toContain('<definedName name="Rates">Data!$B$2:$B$7</definedName>');
    expect(z['xl/workbook.xml']).toContain('localSheetId="0" hidden="1">Data!$A$1:$D$7</definedName>');
    expect(z['xl/workbook.xml']).toContain('fullCalcOnLoad="1"');
    expect(z['xl/charts/chart1.xml']).toContain('<c:f>Data!$A$2:$A$7</c:f>');
    expect(z['xl/charts/chart1.xml']).toContain('<c:f>Data!$D$1</c:f>');
    expect(z['xl/drawings/drawing1.xml']).toContain('<xdr:from><xdr:col>5</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row>');
    expect(z['xl/drawings/drawing1.xml']).toContain('<xdr:to><xdr:col>9</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>12</xdr:row>');
    expect(z['xl/comments1.xml']).toContain('<comment ref="C5" authorId="0">');
    expect(z['xl/drawings/vmlDrawing1.vml']).toContain('<x:Anchor>3, 15, 1, 10, 5, 15, 7, 4</x:Anchor><x:Row>4</x:Row><x:Column>2</x:Column>');
    expect(z['xl/threadedComments/threadedComment1.xml']).toContain('ref="B6"');
  });
  it('opens in ExcelJS with the values where they belong', async () => {
    const wb = await readBack(await patchXlsx(await structureBook(), [{ sheet: 'Data', ref: 'A3', value: 'new' }], { structure: [op({ op: 'insertRows', at: 2, count: 2 })] }));
    const ws = wb.getWorksheet('Data')!;
    expect(['A2', 'A3', 'A4', 'A5', 'A8'].map((r) => ws.getCell(r).value)).toEqual(['a', 'new', null, 'b', 'Sum']);
    expect((ws.getCell('D8').value as { formula: string }).formula).toBe('SUM(D2:D7)');
  });
});

describe('delete rows and columns (W-52 DoD 4)', () => {
  it('a deleted row takes its cells, notes and threads; references to it become #REF!', async () => {
    const z = await patched([op({ op: 'deleteRows', at: 2 })]);
    const sheet = z['xl/worksheets/sheet1.xml']!;
    expect(sheet).not.toContain('<t>b</t>');
    expect(sheet).toContain('<c r="D5"><f>SUM(D2:D4)</f>');
    expect(sheet).not.toContain('<hyperlinks>'); // the link sat on A3, which went
    expect(z['xl/worksheets/sheet2.xml']).toContain('<f>Data!#REF!+A1</f>');
    expect(z['xl/comments1.xml']).not.toContain('<comment ');
    expect(z['xl/drawings/vmlDrawing1.vml']).not.toContain('<v:shape');
    expect(z['xl/threadedComments/threadedComment1.xml']).toContain('ref="B3"');
    expect(sheet).toContain('<selection pane="bottomLeft" activeCell="B3" sqref="B3"/>');
  });
  it('a deleted column clips spans, moves filters and validations, drops what sat on it', async () => {
    const z = await patched([op({ op: 'deleteCols', at: 1 })]);
    const sheet = z['xl/worksheets/sheet1.xml']!;
    expect(sheet).toContain('<cols><col min="1" max="1" width="14" customWidth="1"/><col min="2" max="3" width="10" customWidth="1"/></cols>');
    expect(sheet).toContain('<c r="C2"><f>#REF!*B2</f>');
    expect(sheet).not.toContain('<dataValidations');
    expect(sheet).toContain('<autoFilter ref="A1:C5"/>');
    expect(sheet).toContain('<mergeCell ref="A6:B6"/>');
    expect(sheet).toContain('<formula>C2&gt;#REF!*2</formula>');
    expect(z['xl/workbook.xml']).toContain('<definedName name="Rates">Data!#REF!</definedName>');
    expect(z['xl/drawings/drawing1.xml']).toContain('<xdr:col>4</xdr:col>');
  });
  it('an inserted column splits a span: the new columns take the default width', async () => {
    const z = await patched([op({ op: 'insertCols', at: 2, count: 2 })]);
    expect(z['xl/worksheets/sheet1.xml']).toContain('<cols><col min="1" max="1" width="14" customWidth="1"/><col min="2" max="2" width="10" customWidth="1"/><col min="5" max="6" width="10" customWidth="1"/></cols>');
    expect(z['xl/worksheets/sheet1.xml']).toContain('<c r="F2"><f>B2*E2</f>');
  });
  it('a merge wholly deleted goes, the container with it', async () => {
    const z = await patched([op({ op: 'deleteRows', at: 5 })]);
    expect(z['xl/worksheets/sheet1.xml']).not.toContain('mergeCell');
  });
  it('a frozen header row deleted unfreezes the pane', async () => {
    const z = await patched([op({ op: 'deleteRows', at: 0 })]);
    expect(z['xl/worksheets/sheet1.xml']).toMatch(/<pane topLeftCell="A1" activePane="bottomLeft" state="frozen"\/>/);
  });
  it('the cell changes come after the structure, in the sheet as it stands then', async () => {
    const z = await patched([op({ op: 'insertRows', at: 0 })], undefined, [{ sheet: 'Data', ref: 'A1', value: 'top' }]);
    expect(z['xl/worksheets/sheet1.xml']).toContain('<row r="1"><c r="A1" t="inlineStr"><is><t>top</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Name</t>');
  });
});

describe('shared, array and data-table formulas', () => {
  const shared = (rows: string) => structureParts({ 'xl/worksheets/sheet2.xml': `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>` });
  it('a shared group pointing at the sheet is written out per cell', async () => {
    const extra = shared('<row r="1"><c r="A1"><f t="shared" ref="A1:A3" si="0">Data!B2*2</f><v>3</v></c></row><row r="2"><c r="A2"><f t="shared" si="0"/><v>4</v></c></row><row r="3"><c r="A3"><f t="shared" si="0"/><v>8</v></c></row>');
    const z = unzipText(await patchXlsx(await structureBook({ 'xl/worksheets/sheet2.xml': extra['xl/worksheets/sheet2.xml']! }), [], { structure: [op({ op: 'insertRows', at: 2 })] }));
    expect(z['xl/worksheets/sheet2.xml']).toContain('<c r="A1"><f>Data!B2*2</f><v>3</v></c>');
    expect(z['xl/worksheets/sheet2.xml']).toContain('<c r="A2"><f>Data!B4*2</f><v>4</v></c>');
    expect(z['xl/worksheets/sheet2.xml']).toContain('<c r="A3"><f>Data!B5*2</f><v>8</v></c>');
  });
  it('a shared group that names another sheet is left shared', async () => {
    const extra = shared('<row r="1"><c r="A1"><f t="shared" ref="A1:A2" si="0">B1*2</f><v>3</v></c></row><row r="2"><c r="A2"><f t="shared" si="0"/><v>4</v></c></row>');
    const z = unzipText(await patchXlsx(await structureBook({ 'xl/worksheets/sheet2.xml': extra['xl/worksheets/sheet2.xml']! }), [], { structure: [op({ op: 'insertRows', at: 0 })] }));
    expect(z['xl/worksheets/sheet2.xml']).toContain('<f t="shared" ref="A1:A2" si="0">B1*2</f>');
  });
  it('an array formula moves; cut in two it is refused', async () => {
    const rows = '<row r="8"><c r="A8"><f t="array" ref="A8:A9">B2:B3*2</f><v>3</v></c></row><row r="9"><c r="A9"><v>4</v></c></row>';
    const parts = structureParts();
    const sheet = parts['xl/worksheets/sheet1.xml']!.replace('</sheetData>', `${rows}</sheetData>`);
    const book = await structureBook({ 'xl/worksheets/sheet1.xml': sheet });
    const z = unzipText(await patchXlsx(book, [], { structure: [op({ op: 'insertRows', at: 0 })] }));
    expect(z['xl/worksheets/sheet1.xml']).toContain('<c r="A9"><f t="array" ref="A9:A10">B3:B4*2</f>');
    await expect(patchXlsx(book, [], { structure: [op({ op: 'deleteRows', at: 8 })] })).rejects.toMatchObject({ code: 'bad-structure', spCode: 'SP-2015' });
  });
});

describe('refusals: pivots and tables (W-52)', () => {
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
  it('a pivot whose source would move is refused, the file untouched', async () => {
    const book = await structureBook({ 'xl/pivotCache/pivotCacheDefinition1.xml': '<pivotCacheDefinition xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cacheSource type="worksheet"><worksheetSource ref="A1:D5" sheet="Data"/></cacheSource></pivotCacheDefinition>' });
    const e = await patchXlsx(book, [], { structure: [op({ op: 'insertRows', at: 2 })] }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ExportError);
    expect(e).toMatchObject({ code: 'bad-structure', spCode: 'SP-2015', sheet: 'Data' });
    expect((e as Error).message).toContain('moves the source A1:D5 of a pivot table');
    // an insert below the source is fine
    await expect(patchXlsx(book, [], { structure: [op({ op: 'insertRows', at: 6 })] })).resolves.toBeInstanceOf(Uint8Array);
  });
  it('a pivot table on the sheet that would move is refused', async () => {
    const rels = structureParts()['xl/worksheets/_rels/sheet1.xml.rels']!.replace('</Relationships>', `<Relationship Id="rId9" Type="${R}/pivotTable" Target="../pivotTables/pivotTable1.xml"/></Relationships>`);
    const book = await structureBook({ 'xl/worksheets/_rels/sheet1.xml.rels': rels, 'xl/pivotTables/pivotTable1.xml': '<pivotTableDefinition xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" name="P"><location ref="H20:J30"/></pivotTableDefinition>' });
    await expect(patchXlsx(book, [], { structure: [op({ op: 'deleteCols', at: 0 })] })).rejects.toThrow(/moves the pivot table at H20:J30/);
  });
  const withTable = (table: string) => structureBook({
    'xl/worksheets/_rels/sheet1.xml.rels': structureParts()['xl/worksheets/_rels/sheet1.xml.rels']!.replace('</Relationships>', `<Relationship Id="rId8" Type="${R}/table" Target="../tables/table1.xml"/></Relationships>`),
    'xl/tables/table1.xml': table,
  });
  const T = (ref: string, cols: string, extra = '') => `<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" name="Items" displayName="Items" ref="${ref}"${extra}><autoFilter ref="${ref}"/><tableColumns count="${cols.split(',').length}">${cols.split(',').map((c, i) => `<tableColumn id="${i + 1}" name="${c}"/>`).join('')}</tableColumns><tableStyleInfo name="TableStyleMedium2"/></table>`;
  it('a table grows with rows inserted inside it and loses a deleted column', async () => {
    const book = await withTable(T('A1:D5', 'Name,Rate,Qty,Total'));
    let z = unzipText(await patchXlsx(book, [], { structure: [op({ op: 'insertRows', at: 3, count: 2 })] }));
    expect(z['xl/tables/table1.xml']).toContain('ref="A1:D7"><autoFilter ref="A1:D7"/>');
    z = unzipText(await patchXlsx(book, [], { structure: [op({ op: 'deleteCols', at: 2 })] }));
    expect(z['xl/tables/table1.xml']).toContain('ref="A1:C5"><autoFilter ref="A1:C5"/><tableColumns count="3"><tableColumn id="1" name="Name"/><tableColumn id="2" name="Rate"/><tableColumn id="4" name="Total"/></tableColumns>');
  });
  it('a table cut where it cannot follow is refused', async () => {
    const book = await withTable(T('A1:D5', 'Name,Rate,Qty,Total'));
    for (const [o, why] of [
      [op({ op: 'deleteRows', at: 0 }), 'header row'],
      [op({ op: 'deleteRows', at: 0, count: 5 }), 'deletes all of table Items'],
      [op({ op: 'deleteRows', at: 1, count: 4 }), 'without a data row'],
      [op({ op: 'insertCols', at: 2 }), 'inserts columns inside table Items'],
    ] as const) await expect(patchXlsx(book, [], { structure: [o] }), why).rejects.toThrow(why);
    void PR;
  });
  it('bad operations and unknown sheets are refused', async () => {
    const book = await structureBook();
    await expect(patchXlsx(book, [], { structure: [op({ op: 'insertRows', at: -1 })] })).rejects.toMatchObject({ code: 'bad-structure' });
    await expect(patchXlsx(book, [], { structure: [{ sheet: 'Nope', op: 'insertRows', at: 0, count: 1 }] })).rejects.toMatchObject({ code: 'no-sheet' });
  });
});

describe('property: insert then delete the same span is a byte-stable round trip (W-52 DoD 4)', () => {
  const blocks = (xml: string) => ({
    sheetData: /<sheetData>[\s\S]*<\/sheetData>/.exec(xml)?.[0],
    merges: /<mergeCells[\s\S]*?<\/mergeCells>/.exec(xml)?.[0],
    rules: /<conditionalFormatting[\s\S]*<\/dataValidations>/.exec(xml)?.[0],
    rest: xml,
  });
  it('values, merges, rules — and every part — come back as they were', async () => {
    const book = await structureBook();
    const before = unzipText(book);
    await fc.assert(fc.asyncProperty(fc.boolean(), fc.integer({ min: 0, max: 12 }), fc.integer({ min: 1, max: 4 }), async (rows, at, count) => {
      const ins: StructureOp = { sheet: 'Data', op: rows ? 'insertRows' : 'insertCols', at, count };
      const del: StructureOp = { ...ins, op: rows ? 'deleteRows' : 'deleteCols' };
      const after = unzipText(await patchXlsx(book, [], { structure: [ins, del] }));
      const strip = (x: string) => x.replace(/ fullCalcOnLoad="1"|<calcPr fullCalcOnLoad="1"\/>/g, '');
      expect(blocks(after['xl/worksheets/sheet1.xml']!)).toEqual(blocks(before['xl/worksheets/sheet1.xml']!));
      for (const p of Object.keys(before)) if (p !== 'xl/workbook.xml') expect(after[p], p).toBe(before[p]);
      expect(strip(after['xl/workbook.xml']!)).toBe(before['xl/workbook.xml']);
    }), { numRuns: 60 });
  });
});
