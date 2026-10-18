import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { ImportError, read } from '../src/index.js';
import { pkg, XML } from './helpers.js';

const { NS, R } = XML;
const code = (p: Promise<unknown>) => p.then(() => 'ok', (e: ImportError) => e.code);

describe('refusals (reading verdict decision 4; SR-LAW-3)', () => {
  it.each(['xls', 'xlsm', 'xlsb', 'ods', 'numbers', 'tsv', 'pdf'])('refuses a .%s by its extension, before reading', async (ext) => {
    expect(await code(read(new Uint8Array([1, 2, 3]), { name: `f.${ext}` }))).toBe('unsupported-format');
  });
  it('refuses an OLE compound file as password-protected or legacy, whatever its name', async () => {
    const cfb = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(await code(read(cfb, { name: 'locked.xlsx' }))).toBe('password-or-legacy');
    expect(await code(read(cfb))).toBe('password-or-legacy');
  });
  it('refuses a ZIP that is not a workbook, text named .xlsx, and a ZIP named .csv', async () => {
    const notWb = zipSync({ 'a.txt': strToU8('hi') });
    expect(await code(read(notWb, { name: 'x.xlsx' }))).toBe('not-workbook');
    expect(await code(read(strToU8('a,b'), { name: 'x.xlsx' }))).toBe('not-workbook');
    expect(await code(read(notWb, { name: 'x.csv' }))).toBe('unsupported-format');
  });
  it('refuses a macro-enabled workbook renamed .xlsx', async () => {
    const xlsm = pkg(`<worksheet xmlns="${NS}"><sheetData/></worksheet>`, {}, { mainType: 'application/vnd.ms-excel.sheet.macroEnabled.main+xml' });
    const e = await read(xlsm, { name: 'renamed.xlsx' }).catch((x: ImportError) => x);
    expect(e).toMatchObject({ code: 'unsupported-format', message: expect.stringContaining('.xlsm') });
  });
  it('refuses ZIP64, past the inflate cap, and cells past Excel\'s limits as too-large', async () => {
    const z = pkg(`<worksheet xmlns="${NS}"><sheetData/></worksheet>`);
    const z64 = z.slice();
    new DataView(z64.buffer).setUint16(z64.length - 22 + 10, 0xffff, true);
    expect(await code(read(z64))).toBe('too-large');
    expect(await code(read(z, { maxTotalSize: 100 }))).toBe('too-large');
    expect(await code(read(pkg(`<worksheet xmlns="${NS}"><sheetData><row r="1048577"><c r="A1048577"><v>1</v></c></row></sheetData></worksheet>`)))).toBe('too-large');
    expect(await code(read(pkg(`<worksheet xmlns="${NS}"><sheetData><row r="1"><c r="XFE1"><v>1</v></c></row></sheetData></worksheet>`)))).toBe('too-large');
  });
  it('calls broken XML corrupt and binary without a name unsupported', async () => {
    expect(await code(read(pkg(`<worksheet xmlns="${NS}"><sheetData>`)))).toBe('corrupt');
    expect(await code(read(new Uint8Array([0x00, 0xff, 0x10, 0x00])))).toBe('unsupported-format');
  });
});

describe('what real writers produce', () => {
  it('reads inline strings, rich text without phonetic runs, str/e/b/d types, rows and cells without r', async () => {
    const s = `<x:worksheet xmlns:x="${NS}"><x:sheetData><x:row><x:c t="inlineStr"><x:is><x:r><x:t>Big </x:t></x:r><x:r><x:t>Co</x:t></x:r><x:rPh><x:t>ビッグ</x:t></x:rPh></x:is></x:c><x:c t="str"><x:f>"a"&amp;"b"</x:f><x:v>ab</x:v></x:c><x:c t="e"><x:v>#N/A</x:v></x:c><x:c t="b"><x:v>0</x:v></x:c></x:row><x:row><x:c t="d"><x:v>2026-09-30T00:00:00</x:v></x:c><x:c t="inlineStr"><x:is><x:t>cr_x000D_lf</x:t></x:is></x:c></x:row></x:sheetData></x:worksheet>`;
    const b = await read(pkg(s));
    expect(b.sheets[0]!.rows).toEqual([['Big Co', 'ab', '#N/A', false], ['2026-09-30T00:00:00', 'cr\rlf']]);
    expect(b.sheets[0]!.text[0]).toEqual(['Big Co', 'ab', '#N/A', 'FALSE']);
    expect(b.sheets[0]!.formulas).toEqual({ B1: '"a"&"b"' });
  });
  it('reads x14 data validations, threaded comments with persons, a pivot table location; skips chartsheets', async () => {
    const sheet = `<worksheet xmlns="${NS}" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"><sheetData/><extLst><ext uri="{CCE6A557-97BC-4b89-ADB6-D9C93CAAB3DF}"><x14:dataValidations count="1"><x14:dataValidation type="list" allowBlank="1" showErrorMessage="1"><x14:formula1><xm:f>Lists!$A$1:$A$3</xm:f></x14:formula1><xm:sqref>B2:B9</xm:sqref></x14:dataValidation></x14:dataValidations></ext></extLst></worksheet>`;
    const TC = 'http://schemas.microsoft.com/office/2017/10/relationships/threadedComment';
    const PERSON = 'http://schemas.microsoft.com/office/2017/10/relationships/person';
    const b = await read(pkg(sheet, {
      'xl/_rels/workbook.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${R}/chartsheet" Target="chartsheets/sheet1.xml"/><Relationship Id="rId3" Type="${PERSON}" Target="persons/person.xml"/></Relationships>`,
      'xl/worksheets/_rels/sheet1.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${TC}" Target="../threadedComments/threadedComment1.xml"/><Relationship Id="rId2" Type="${R}/pivotTable" Target="../pivotTables/pivotTable1.xml"/></Relationships>`,
      'xl/threadedComments/threadedComment1.xml': '<ThreadedComments xmlns="http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments"><threadedComment ref="B2" dT="2026-10-18T09:04:00.00" personId="{P1}" id="{T1}"><text>Price looks transposed</text></threadedComment><threadedComment ref="B2" personId="{P1}" id="{T2}" parentId="{T1}" done="1"><text>268.40</text></threadedComment></ThreadedComments>',
      'xl/persons/person.xml': '<personList xmlns="http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments"><person displayName="Arpit" id="{P1}" userId="arpit" providerId="None"/></personList>',
      'xl/pivotTables/pivotTable1.xml': `<pivotTableDefinition xmlns="${NS}" name="PivotTable1"><location ref="E3:G10" firstHeaderRow="1" firstDataRow="1" firstDataCol="1"/></pivotTableDefinition>`,
    }, { sheets: `<sheet name="Data" sheetId="1" r:id="rId1"/><sheet name="Chart1" sheetId="2" r:id="rId2"/>` }));
    const s = b.sheets[0]!;
    expect(b.sheets.map((x) => x.name)).toEqual(['Data']);
    expect(s.dataValidations).toEqual([expect.objectContaining({ type: 'list', sqref: ['B2:B9'], formula1: 'Lists!$A$1:$A$3', showErrorMessage: true })]);
    expect(s.threadedComments).toEqual([
      { id: '{T1}', ref: 'B2', personId: '{P1}', done: false, date: '2026-10-18T09:04:00.00', text: 'Price looks transposed' },
      { id: '{T2}', ref: 'B2', personId: '{P1}', parentId: '{T1}', done: true, text: '268.40' },
    ]);
    expect(b.persons).toEqual([{ id: '{P1}', displayName: 'Arpit', userId: 'arpit', providerId: 'None' }]);
    expect(s.pivotTables).toEqual([{ name: 'PivotTable1', ref: 'E3:G10' }]);
  });
});
