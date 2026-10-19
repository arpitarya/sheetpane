// W-53 DoD 1: rich text — the runs of a shared or an inline string, phonetic runs left out, read the
// same by DOMParser and the built-in XML reader; `rows` and `text` unchanged.
import { afterEach, describe, expect, it } from 'vitest';
import { fromCsv, read } from '../src/index.js';
import { pkg, XML } from './helpers.js';

const { NS, R } = XML;
const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
const rPr = (inner: string) => `<rPr>${inner}<rFont val="Calibri"/><family val="2"/><scheme val="minor"/></rPr>`;

/** Shared strings: 0 rich (plain run + italic run + phonetic), 1 plain, 2 one formatted run, 3 one plain run, 4 every property. */
function runsPkg(): Uint8Array {
  const sst = `<sst xmlns="${NS}" count="6" uniqueCount="5">`
    + `<si><r><t xml:space="preserve">Net </t></r><r>${rPr('<i/><sz val="11"/><color theme="1"/>')}<t>of tax</t></r><rPh sb="0" eb="1"><t>ネット</t></rPh></si>`
    + '<si><t>plain</t></si>'
    + `<si><r>${rPr('<b/><sz val="11"/>')}<t>all bold</t></r></si>`
    + '<si><r><t>one plain run</t></r></si>'
    + `<si><r>${rPr('<b/><i/><u/><strike/><sz val="14"/><color rgb="FFFF0000"/>')}<t>E=mc</t></r><r>${rPr('<vertAlign val="superscript"/><sz val="11"/><u val="double"/>')}<t>2</t></r><r><t>_x0021_</t></r></si>`
    + '</sst>';
  const sheet = `<worksheet xmlns="${NS}"><sheetData>`
    + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="s"><v>4</v></c></row>'
    + '<row r="2"><c r="A2" t="s"><v>0</v></c>'
    + `<c r="B2" t="inlineStr"><is><r><t>see </t></r><r>${rPr('<i/>')}<t>Annex</t></r><rPh sb="0" eb="1"><t>シー</t></rPh></is></c>`
    + '<c r="C2" t="inlineStr"><is><t>inline plain</t></is></c></row>'
    + '</sheetData></worksheet>';
  return pkg(sheet, {
    'xl/sharedStrings.xml': sst,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${R}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
  });
}

describe('rich-text runs (W-53 DoD 1)', async () => {
  const s = (await read(runsPkg(), { name: 'runs.xlsx' })).sheets[0]!;
  it('a shared string of two runs: each run\'s text and formatting; the family never read; rows and text unchanged', () => {
    expect(s.runs.A1).toEqual([{ text: 'Net ' }, { text: 'of tax', i: true, sz: 11, color: { theme: 1 } }]);
    expect(s.rows[0]![0]).toBe('Net of tax');
    expect(s.text[0]![0]).toBe('Net of tax');
    expect(JSON.stringify(s.runs)).not.toMatch(/Calibri|rFont|name/);
  });
  it('phonetic runs are not runs and not text', () => {
    expect(s.runs.A1!.map((r) => r.text).join('')).toBe(s.rows[0]![0]);
    expect(s.runs.B2).toEqual([{ text: 'see ' }, { text: 'Annex', i: true }]);
    expect(s.rows[1]![1]).toBe('see Annex');
  });
  it('a plain string, and one run with no formatting, have no runs; one formatted run has', () => {
    expect(s.runs.B1).toBeUndefined();
    expect(s.runs.D1).toBeUndefined();
    expect(s.rows[0]![3]).toBe('one plain run');
    expect(s.runs.C2).toBeUndefined();
    expect(s.runs.C1).toEqual([{ text: 'all bold', b: true, sz: 11 }]);
  });
  it('every property a run may name: bold, italic, underline, strike, colour, size, vertical alignment; escapes decoded', () => {
    expect(s.runs.E1).toEqual([
      { text: 'E=mc', b: true, i: true, u: 'single', strike: true, sz: 14, color: { rgb: 'FFFF0000' } },
      { text: '2', u: 'double', sz: 11, vertAlign: 'superscript' },
      { text: '!' },
    ]);
    expect(s.rows[0]![4]).toBe('E=mc2!');
  });
  it('cells sharing a string share one array (memory)', () => {
    expect(s.runs.A2).toBe(s.runs.A1);
    expect(Object.keys(s.runs).sort()).toEqual(['A1', 'A2', 'B2', 'C1', 'E1']);
  });
  it('a CSV has none', async () => {
    expect((await fromCsv('a,b', { name: 'x.csv' })).sheets[0]!.runs).toEqual({});
  });
});

const real = globalThis.DOMParser;
afterEach(() => { globalThis.DOMParser = real; });

describe('the built-in XML reader reads the same runs (W-53 DoD 1 parity)', () => {
  it('DOMParser and minixml give one workbook', async () => {
    const bytes = runsPkg();
    const withDom = await read(bytes, { name: 'f.xlsx' });
    // @ts-expect-error — a runtime without DOMParser
    delete globalThis.DOMParser;
    const without = await read(bytes, { name: 'f.xlsx' });
    const { part: _a, ...a } = without, { part: _b, ...b } = withDom;
    expect(a).toEqual(b);
    expect(a.sheets[0]!.runs.E1).toHaveLength(3);
  });
});
