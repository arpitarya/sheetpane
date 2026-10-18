// exportPatch (W-16 DoD 4): `<f>` and the new cached `<v>`, readable by @sheetpane/import.
import { describe, expect, it } from 'vitest';
import { inflateEntry, readZip } from '@sheetpane/export';
import { read } from '@sheetpane/import';
import features from '../../import/test/fixtures/exceljs-features.xlsx?inline';
import { formulas } from '../src/index.js';
import { fullCalcOnLoad, patchSheet } from '../src/export.js';
import { book, fromDataUrl, loaded, until } from './helpers.js';

async function part(bytes: Uint8Array, name: string): Promise<string> {
  const e = readZip(bytes).find((x) => x.name === name)!;
  return new TextDecoder().decode(await inflateEntry(bytes, e));
}
const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

describe('export round trip (ExcelJS fixture, shared formula D3:D5)', () => {
  it('an edited input: the recalculated formula cells get new cached values; their <f> stays as written', async () => {
    const f = formulas();
    const store = await loaded(fromDataUrl(features), [f]);
    await f.ready();
    expect(store.getSnapshot().derived.size).toBe(0);
    store.setCell('Holdings', 'B3', '1000');
    store.setCell('Holdings', 'C4', '200');
    await until(() => store.getSnapshot().derived.has('Holdings!D4'));
    const out = await bytesOf((await store.exportFile()).blob);
    const xml = await part(out, 'xl/worksheets/sheet1.xml');
    expect(xml).toMatch(/<c r="D3" s="5"><f t="shared" ref="D3:D5" si="0">B3\*C3<\/f><v>268400<\/v><\/c>/);
    expect(xml).toMatch(/<c r="D4"[^>]*><f t="shared" si="0"\/><v>86000<\/v><\/c>/);
    expect(xml).toMatch(/<c r="D5"[^>]*><f t="shared" si="0"\/><v>33472<\/v><\/c>/); // unchanged
    expect(await part(out, 'xl/workbook.xml')).toMatch(/<calcPr calcId="171027" fullCalcOnLoad="1"\/>/);
    const back = await read(out, { name: 'back.xlsx' });
    const s = back.sheets[0]!;
    expect(s.formulas).toMatchObject({ D3: 'B3*C3', D4: 'B4*C4', D5: 'B5*C5' });
    expect(s.rows[2]![3]).toBe(268400);
    expect(s.rows[3]![3]).toBe(86000); // B4 430 × 200
    expect(s.rows[2]![1]).toBe(1000);
  });

  it('a typed formula is written as <f> with its cached value, not as the text "=…"', async () => {
    const f = formulas();
    const store = await loaded(fromDataUrl(features), [f]);
    await f.ready();
    store.setCell('Holdings', 'J7', '=D3*2');
    store.setCell('Holdings', 'K7', '=1/0');
    store.setCell('Holdings', 'K8', '="a"&"b"');
    store.setCell('Holdings', 'K9', '=D3>0');
    store.setCell('Holdings', 'K10', '=D3<1 & "x"'); // escaped in XML
    await until(() => store.getSnapshot().derived.get('Holdings!K9')?.value === true && store.getSnapshot().derived.has('Holdings!K10'));
    const out = await bytesOf((await store.exportFile()).blob);
    const xml = await part(out, 'xl/worksheets/sheet1.xml');
    expect(xml).toContain('<c r="J7"><f>D3*2</f><v>644160</v></c>');
    expect(xml).toContain('<c r="K7" t="e"><f>1/0</f><v>#DIV/0!</v></c>');
    expect(xml).toContain('<c r="K8" t="str"><f>"a"&amp;"b"</f><v>ab</v></c>');
    expect(xml).toContain('<c r="K9" t="b"><f>D3&gt;0</f><v>1</v></c>');
    expect(xml).toContain('<f>D3&lt;1 &amp; "x"</f>');
    expect(xml).not.toContain('inlineStr"><is><t>=');
    const back = await read(out, { name: 'back.xlsx' });
    const s = back.sheets[0]!;
    expect(s.formulas).toMatchObject({ J7: 'D3*2', K7: '1/0', K8: '"a"&"b"', K9: 'D3>0', K10: 'D3<1 & "x"' });
    expect(s.rows[6]![9]).toBe(644160);
    expect(s.rows[6]![10]).toBe('#DIV/0!');
    expect(s.rows[7]![10]).toBe('ab');
    expect(s.rows[8]![10]).toBe(true);
  });

  it('a value typed over a formula is a plain value in the file (the core writes it; nothing of ours)', async () => {
    const f = formulas();
    const store = await loaded(await book({ S: [[2, { f: 'A1*2', v: 4 }, { f: 'B1+1', v: 5 }]] }), [f]);
    await f.ready();
    store.setCell('S', 'B1', '10');
    await until(() => store.getSnapshot().derived.get('S!C1')?.value === 11);
    const out = await bytesOf((await store.exportFile()).blob);
    const back = await read(out);
    expect(back.sheets[0]!.formulas).toEqual({ C1: 'B1+1' });
    expect(back.sheets[0]!.rows[0]).toEqual([2, 10, 11]);
  });

  it('an untouched workbook exports byte-identical sheets', async () => {
    const f = formulas();
    const bytes = fromDataUrl(features);
    const store = await loaded(bytes, [f]);
    await f.ready();
    const out = await bytesOf((await store.exportFile()).blob);
    expect(await part(out, 'xl/worksheets/sheet1.xml')).toBe(await part(bytes, 'xl/worksheets/sheet1.xml'));
    expect(await part(out, 'xl/workbook.xml')).toBe(await part(bytes, 'xl/workbook.xml'));
  });
});

describe('the XML helpers', () => {
  it('patchSheet keeps prefixes, styles and other cells', () => {
    const xml = '<x:worksheet xmlns:x="ns"><x:sheetData><x:row r="1"><x:c r="A1" s="3" t="inlineStr"><x:is><x:t>=B1</x:t></x:is></x:c><x:c r="B1"><x:v>1</x:v></x:c><x:c r="C1"><x:f>B1</x:f><x:v>1</x:v></x:c></x:row></x:sheetData></x:worksheet>';
    const r = patchSheet(xml, new Map([['A1', { formula: 'B1', value: 2 }], ['C1', { value: 'x' }], ['B1', { value: 9 }]]));
    expect(r.count).toBe(3);
    expect(r.xml).toContain('<x:c r="A1" s="3"><x:f>B1</x:f><x:v>2</x:v></x:c>');
    expect(r.xml).toContain('<x:c r="B1"><x:v>1</x:v></x:c>'); // not a formula cell: left alone
    expect(r.xml).toContain('<x:c r="C1" t="str"><x:f>B1</x:f><x:v>x</x:v></x:c>');
  });
  it('fullCalcOnLoad adds or sets the attribute, in schema order', () => {
    expect(fullCalcOnLoad('<workbook><sheets/><calcPr calcId="1"/></workbook>')).toBe('<workbook><sheets/><calcPr calcId="1" fullCalcOnLoad="1"/></workbook>');
    expect(fullCalcOnLoad('<workbook><sheets/><extLst/></workbook>')).toBe('<workbook><sheets/><calcPr fullCalcOnLoad="1"/><extLst/></workbook>');
    expect(fullCalcOnLoad('<workbook><calcPr fullCalcOnLoad="1"/></workbook>')).toBe('<workbook><calcPr fullCalcOnLoad="1"/></workbook>');
  });
});
