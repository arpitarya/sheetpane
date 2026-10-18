import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import ExcelJS from 'exceljs';
import { ExportError, patchXlsx, rawData, readZip, type Change } from '../src/index.js';
import { minimalPackage, readBack, unzipText, values } from './helpers.js';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

/** An original written by ExcelJS: shared strings, a style, a formula, a merge, two sheets. */
async function original(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const a = wb.addWorksheet('Data');
  a.addRows([['Name', 'Qty', 'Price', 'Total'], ['Pen', 2, 1.5, null], ['Ink', 3, 4, null]]);
  a.getCell('D2').value = { formula: 'B2*C2', result: 3 };
  a.getCell('D3').value = { formula: 'B3*C3', result: 12 };
  a.getCell('A2').font = { bold: true };
  a.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  a.mergeCells('F1:G1');
  a.getCell('F1').value = 'Merged';
  const b = wb.addWorksheet('Notes');
  b.addRow(['keep me']);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

describe('patchXlsx', () => {
  it('changes only the named cells; the style of a changed cell survives', async () => {
    const orig = await original();
    const out = await patchXlsx(orig, [
      { sheet: 'Data', ref: 'A2', value: 'Pencil' },
      { sheet: 'Data', ref: 'B3', value: 5 },
      { sheet: 'Data', ref: 'E5', value: true },
      { sheet: 'Data', ref: 'C2', value: null },
    ]);
    const wb = await readBack(out);
    const v = values(wb.getWorksheet('Data')!);
    expect(v[0]!.slice(0, 6)).toEqual(['Name', 'Qty', 'Price', 'Total', null, 'Merged']);
    expect(v[1]!.slice(0, 4)).toEqual(['Pencil', 2, null, 3]);
    expect(v[2]!.slice(0, 4)).toEqual(['Ink', 5, 4, 12]);
    expect(v[4]![4]).toBe(true);
    expect(wb.getWorksheet('Data')!.getCell('A2').font).toMatchObject({ bold: true });
    expect(wb.getWorksheet('Data')!.getCell('D3').formula).toBe('B3*C3');
    expect(wb.getWorksheet('Data')!.model.merges).toEqual(['F1:G1']);
    expect(values(wb.getWorksheet('Notes')!)).toEqual([['keep me']]);
  });
  it('copies every untouched part byte for byte, compressed data and all', async () => {
    const orig = await original();
    const out = await patchXlsx(orig, [{ sheet: 'Data', ref: 'A2', value: 'x' }]);
    const before = new Map(readZip(orig).map((e) => [e.name, rawData(orig, e)]));
    const after = readZip(out);
    const touched = new Set(['xl/worksheets/sheet1.xml', 'xl/workbook.xml']);
    for (const e of after) if (!touched.has(e.name)) expect(rawData(out, e), e.name).toEqual(before.get(e.name));
    expect(after.map((e) => e.name)).toEqual(readZip(orig).map((e) => e.name));
  });
  it('asks Excel to recalculate on open whenever a cell changed, and not otherwise', async () => {
    const orig = await original();
    expect(unzipText(await patchXlsx(orig, [{ sheet: 'Data', ref: 'A1', value: 'N' }]))['xl/workbook.xml']).toMatch(/<calcPr[^>]*fullCalcOnLoad="1"/);
    expect(unzipText(await patchXlsx(orig, []))['xl/workbook.xml']).not.toContain('fullCalcOnLoad');
  });
  it('drops the calculation chain when a formula cell becomes a value', async () => {
    const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const sheet = `<worksheet xmlns="${NS}"><sheetData><row r="1"><c r="A1"><v>2</v></c><c r="B1"><f>A1*2</f><v>4</v></c></row></sheetData></worksheet>`;
    const pkg = minimalPackage(sheet, {
      'xl/calcChain.xml': `<calcChain xmlns="${NS}"><c r="B1" i="1"/></calcChain>`,
      'xl/_rels/workbook.xml.rels': `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId9" Type="${R}/calcChain" Target="calcChain.xml"/></Relationships>`,
      '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/></Types>',
    });
    const z = unzipText(await patchXlsx(pkg, [{ sheet: 'Data', ref: 'B1', value: 99 }]));
    expect(Object.keys(z)).not.toContain('xl/calcChain.xml');
    expect(z['xl/_rels/workbook.xml.rels']).not.toContain('calcChain');
    expect(z['[Content_Types].xml']).not.toContain('calcChain');
    expect(z['xl/worksheets/sheet1.xml']).toContain('<c r="B1"><v>99</v></c>');
    // a plain value change keeps the chain
    expect(Object.keys(unzipText(await patchXlsx(pkg, [{ sheet: 'Data', ref: 'A1', value: 3 }])))).toContain('xl/calcChain.xml');
  });
  it('promotes the next cell when the master of a shared formula is overwritten', async () => {
    const sheet = `<worksheet xmlns="${NS}"><sheetData><row r="1"><c r="A1"><v>1</v></c><c r="B1"><f t="shared" ref="B1:B3" si="0">A1*2</f><v>2</v></c></row><row r="2"><c r="A2"><v>2</v></c><c r="B2"><f t="shared" si="0"/><v>4</v></c></row><row r="3"><c r="A3"><v>3</v></c><c r="B3"><f t="shared" si="0"/><v>6</v></c></row></sheetData></worksheet>`;
    const z = unzipText(await patchXlsx(minimalPackage(sheet), [{ sheet: 'Data', ref: 'B1', value: 0 }]));
    const s = z['xl/worksheets/sheet1.xml']!;
    expect(s).toContain('<c r="B1"><v>0</v></c>');
    expect(s).toContain('<c r="B2"><f t="shared" ref="B2:B3" si="0">A2*2</f><v>4</v></c>');
    expect(s).toContain('<c r="B3"><f t="shared" si="0"/><v>6</v></c>');
  });
  it('handles rows and cells without r, self-closing rows, a prefixed namespace and an empty sheetData', async () => {
    const s1 = `<x:worksheet xmlns:x="${NS}"><x:dimension ref="A1:B2"/><x:sheetData><x:row><x:c><x:v>1</x:v></x:c><x:c><x:v>2</x:v></x:c></x:row><x:row spans="1:2"/><x:row><x:c t="b"><x:v>0</x:v></x:c></x:row></x:sheetData></x:worksheet>`;
    const s = unzipText(await patchXlsx(minimalPackage(s1), [{ sheet: 'Data', ref: 'B1', value: 'two' }, { sheet: 'Data', ref: 'C5', value: 5 }]))['xl/worksheets/sheet1.xml']!;
    expect(s).toBe(`<x:worksheet xmlns:x="${NS}"><x:dimension ref="A1:C5"/><x:sheetData><x:row r="1"><x:c r="A1"><x:v>1</x:v></x:c><x:c r="B1" t="inlineStr"><x:is><x:t>two</x:t></x:is></x:c></x:row><x:row spans="1:2" r="2"/><x:row r="3"><x:c t="b"><x:v>0</x:v></x:c></x:row><x:row r="5"><x:c r="C5"><x:v>5</x:v></x:c></x:row></x:sheetData></x:worksheet>`);
    const empty = unzipText(await patchXlsx(minimalPackage(`<worksheet xmlns="${NS}"><sheetData/></worksheet>`), [{ sheet: 'Data', ref: 'A1', value: 'x' }]))['xl/worksheets/sheet1.xml']!;
    expect(empty).toBe(`<worksheet xmlns="${NS}"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>x</t></is></c></row></sheetData></worksheet>`);
  });
  it('sets refreshOnLoad on a pivot cache whose source meets a changed cell, and only then', async () => {
    const pc = (ref: string) => `<pivotCacheDefinition xmlns="${NS}" r:id="rId1" xmlns:r="x"><cacheSource type="worksheet"><worksheetSource ref="${ref}" sheet="Data"/></cacheSource></pivotCacheDefinition>`;
    const pkg = minimalPackage(`<worksheet xmlns="${NS}"><sheetData/></worksheet>`, { 'xl/pivotCache/pivotCacheDefinition1.xml': pc('A1:B10'), 'xl/pivotCache/pivotCacheDefinition2.xml': pc('D1:E10') });
    const z = unzipText(await patchXlsx(pkg, [{ sheet: 'Data', ref: 'B4', value: 1 }]));
    expect(z['xl/pivotCache/pivotCacheDefinition1.xml']).toContain('refreshOnLoad="1"');
    expect(z['xl/pivotCache/pivotCacheDefinition2.xml']).not.toContain('refreshOnLoad');
  });
  it('runs exportPatch hooks after the core: parts, relationships, content types', async () => {
    const out = await patchXlsx(await original(), [{ sheet: 'Data', ref: 'A1', value: 'N' }], {
      exportPatch: [async (ctx) => {
        expect(ctx.sheetNames()).toEqual(['Data', 'Notes']);
        const path = ctx.sheetPath('Data')!;
        expect(await ctx.readText(path)).toContain('<t>N</t>');
        ctx.write('xl/extra/note.xml', '<note/>');
        const id = await ctx.addRelationship(path, 'urn:test', '../extra/note.xml');
        await ctx.setContentType('xl/extra/note.xml', 'application/x-test+xml');
        await ctx.setDefaultContentType('png', 'image/png');
        expect(id).toMatch(/^rId\d+$/);
      }],
    });
    const z = unzipText(out);
    expect(z['xl/extra/note.xml']).toBe('<note/>');
    expect(z['xl/worksheets/_rels/sheet1.xml.rels']).toContain('Target="../extra/note.xml"');
    expect(z['[Content_Types].xml']).toContain('PartName="/xl/extra/note.xml"');
    expect(z['[Content_Types].xml']).toContain('Extension="png"');
    await readBack(out);
  });
  it('refuses an unknown sheet and a malformed ref, naming them', async () => {
    const orig = await original();
    await expect(patchXlsx(orig, [{ sheet: 'Nope', ref: 'A1', value: 1 }])).rejects.toMatchObject({ code: 'no-sheet', spCode: 'SP-2006', sheet: 'Nope' });
    await expect(patchXlsx(orig, [{ sheet: 'Data', ref: 'A0', value: 1 }])).rejects.toThrow(ExportError);
    await expect(patchXlsx(orig, [{ sheet: 'Data', ref: 'A1', value: Infinity }])).rejects.toThrow(/Data!A1/);
  });
  it('changes exactly the named cells and nothing else (property, independent reader)', async () => {
    const orig = await original();
    const before = values((await readBack(orig)).getWorksheet('Data')!);
    const change = fc.record({
      sheet: fc.constant('Data'),
      ref: fc.tuple(fc.integer({ min: 0, max: 7 }), fc.integer({ min: 1, max: 8 })).map(([c, r]) => 'ABCDEFGH'[c]! + r),
      value: fc.oneof(fc.integer({ min: -999, max: 999 }), fc.boolean(), fc.stringMatching(/^[a-z]{1,6}$/)),
    });
    await fc.assert(fc.asyncProperty(fc.array(change, { maxLength: 6 }), async (changes: Change[]) => {
      const got = values((await readBack(await patchXlsx(orig, changes, { compression: 'store' }))).getWorksheet('Data')!);
      const want = before.map((r) => [...r]);
      for (const c of changes) {
        const col = c.ref.charCodeAt(0) - 65, row = Number(c.ref.slice(1)) - 1;
        (want[row] ??= [])[col] = c.value as string | number | boolean;
      }
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const w = want[r]?.[c] ?? null;
        if (r === 0 && c === 6) continue; // inside the merge; ExcelJS mirrors F1
        expect(got[r]?.[c] ?? null, 'ABCDEFGH'[c]! + (r + 1)).toEqual(w);
      }
    }), { seed: 5, numRuns: 40 });
  });
});

describe('freeze panes (W-24 DoD 4)', () => {
  it('toXlsx writes <pane> with topLeftCell; ExcelJS reads it back frozen', async () => {
    const { toXlsx } = await import('../src/index.js');
    const z = unzipText(await toXlsx({ sheets: [{ name: 'S', rows: [[1]], freeze: { rows: 2, cols: 1 } }] }));
    expect(z['xl/worksheets/sheet1.xml']).toContain('<pane xSplit="1" ySplit="2" topLeftCell="B3" activePane="bottomRight" state="frozen"/>');
    const wb = await readBack(await toXlsx({ sheets: [{ name: 'S', rows: [[1]], freeze: { rows: 1, cols: 0 } }] }));
    expect(wb.worksheets[0]!.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
  });
  it('patchXlsx writes a changed freeze, removes one set to 0, and leaves other sheets untouched', async () => {
    const orig = await original();
    const out = await patchXlsx(orig, [], { freeze: [{ sheet: 'Data', rows: 1, cols: 2 }] });
    const z = unzipText(out);
    expect(z['xl/worksheets/sheet1.xml']).toMatch(/<pane xSplit="2" ySplit="1" topLeftCell="C2" activePane="bottomRight" state="frozen"\/>/);
    expect(rawData(out, readZip(out).find((e) => e.name === 'xl/worksheets/sheet2.xml')!)).toEqual(rawData(orig, readZip(orig).find((e) => e.name === 'xl/worksheets/sheet2.xml')!));
    const back = await readBack(out);
    expect(back.getWorksheet('Data')!.views[0]).toMatchObject({ state: 'frozen', xSplit: 2, ySplit: 1 });
    const un = unzipText(await patchXlsx(out, [], { freeze: [{ sheet: 'Data', rows: 0, cols: 0 }] }));
    expect(un['xl/worksheets/sheet1.xml']).not.toContain('<pane');
  });
});

describe('merged ranges (core)', () => {
  it('rewrites <mergeCells> to exactly the given ranges, in schema position, and removes it when empty', async () => {
    const orig = await original();
    const z = unzipText(await patchXlsx(orig, [], { merges: [{ sheet: 'Notes', ranges: ['A1:B1'] }, { sheet: 'Data', ranges: [] }] }));
    expect(z['xl/worksheets/sheet2.xml']).toContain('<mergeCells count="1"><mergeCell ref="A1:B1"/></mergeCells>');
    expect(z['xl/worksheets/sheet1.xml']).not.toContain('mergeCell');
    const wb = await readBack(await patchXlsx(orig, [], { merges: [{ sheet: 'Notes', ranges: ['A1:B1'] }] }));
    expect(wb.getWorksheet('Notes')!.model.merges).toEqual(['A1:B1']);
  });
});
