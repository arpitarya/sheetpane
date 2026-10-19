// W-57: data validation and conditional formatting written by toXlsx (DoD 1) and rewritten by patchXlsx
// (DoD 2) — schema order, the dxfs in styles.xml, read back through ExcelJS, refused with SP-2015.
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import {
  ExportError, patchXlsx, rawData, readZip, setConditionalFormats, setDataValidations, toXlsx,
  type ConditionalFormat, type DataValidation, type Dxf, type Sheet,
} from '../src/index.js';
import { minimalPackage, readBack, unzipText } from './helpers.js';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

const list: DataValidation = {
  sqref: ['B2:B20'], type: 'list', allowBlank: true, showErrorMessage: true, showDropDown: false,
  errorTitle: 'Unit', error: 'Pick a unit from the list', promptTitle: 'Unit', prompt: 'Line one\nline two', formula1: 'Lists!$A$2:$A$9',
};
const whole: DataValidation = { sqref: ['C2:C20', 'E5'], type: 'whole', operator: 'between', allowBlank: false, showErrorMessage: true, showDropDown: false, errorStyle: 'warning', formula1: '1', formula2: '100' };
const red: Dxf = { font: { b: true, color: { rgb: 'FF9C0006' } }, fill: { patternType: 'solid', bgColor: { rgb: 'FFFFC7CE' } } };
const missingUnit: ConditionalFormat = { sqref: ['B2:B20'], rules: [{ type: 'expression', priority: 1, stopIfTrue: false, dxfId: 0, formulas: ['AND($A2<>"",$B2="")'] }] };
const scale: ConditionalFormat = {
  sqref: ['D2:D20'],
  rules: [{ type: 'colorScale', priority: 2, stopIfTrue: false, formulas: [], colorScale: { cfvo: [{ type: 'min' }, { type: 'max' }], colors: [{ rgb: 'FFF8696B' }, { rgb: 'FF63BE7B' }] } }],
};

const sheet = (extra: Partial<Sheet> = {}): Sheet => ({ name: 'Spec', rows: [['Name', 'Unit', 'Qty', 'Score'], ['a', 'kg', 3, 10]], ...extra });
const order = (xml: string, ...tags: string[]) => tags.map((t) => xml.indexOf(`<${t}`));

describe('toXlsx writes data validation and conditional formats (W-57 DoD 1)', () => {
  it('writes both blocks in schema order: mergeCells, conditionalFormatting, dataValidations', async () => {
    const bytes = await toXlsx({ sheets: [sheet({ merges: ['A1:B1'], dataValidations: [list, whole], conditionalFormats: [missingUnit, scale] })], dxfs: [red] }, { compression: 'store' });
    const xml = unzipText(bytes)['xl/worksheets/sheet1.xml']!;
    const [mc, cf, dv] = order(xml, 'mergeCells', 'conditionalFormatting', 'dataValidations');
    expect(mc).toBeGreaterThan(xml.indexOf('</sheetData>'));
    expect(cf).toBeGreaterThan(mc!);
    expect(dv).toBeGreaterThan(xml.lastIndexOf('</conditionalFormatting>'));
    expect(xml.match(/<conditionalFormatting /g)).toHaveLength(2);
    expect(xml).toContain('<dataValidations count="2">');
    // a prompt is shown (showInputMessage), its line break survives attribute parsing, the formula is escaped
    expect(xml).toContain('showInputMessage="1"');
    expect(xml).toContain('prompt="Line one&#10;line two"');
    expect(xml).toContain('<formula>AND($A2&lt;&gt;"",$B2="")</formula>');
    expect(xml).toContain('sqref="C2:C20 E5"');
  });

  it('appends the dxfs to styles.xml after cellStyles, and writes none when there are none', async () => {
    const styled = unzipText(await toXlsx({ sheets: [sheet({ conditionalFormats: [missingUnit] })], dxfs: [red, { numFmt: { id: 164, code: '0.0%' } }] }))['xl/styles.xml']!;
    expect(styled).toMatch(/<\/cellStyles><dxfs count="2"><dxf><font><b\/><color rgb="FF9C0006"\/><\/font><fill><patternFill patternType="solid"><bgColor rgb="FFFFC7CE"\/><\/patternFill><\/fill><\/dxf><dxf><numFmt numFmtId="164" formatCode="0.0%"\/><\/dxf><\/dxfs><\/styleSheet>$/);
    const plain = unzipText(await toXlsx({ sheets: [sheet()] }))['xl/styles.xml']!;
    expect(plain).not.toContain('dxfs');
  });

  it('a sheet without rules is written exactly as before', async () => {
    const a = await toXlsx({ sheets: [sheet()] }, { compression: 'store' });
    const b = await toXlsx({ sheets: [sheet({ dataValidations: [], conditionalFormats: [] })], dxfs: [] }, { compression: 'store' });
    expect(b).toEqual(a);
  });

  it('ExcelJS reads the rules and the format back', async () => {
    const wb = await readBack(await toXlsx({ sheets: [sheet({ dataValidations: [list, whole], conditionalFormats: [missingUnit, scale] }), { name: 'Lists', rows: [['Unit'], ['kg'], ['m']] }], dxfs: [red] }));
    const ws = wb.getWorksheet('Spec')!;
    expect(ws.getCell('B5').dataValidation).toMatchObject({ type: 'list', allowBlank: true, showErrorMessage: true, showInputMessage: true, formulae: ['Lists!$A$2:$A$9'], promptTitle: 'Unit', prompt: 'Line one\nline two' });
    expect(ws.getCell('E5').dataValidation).toMatchObject({ type: 'whole', operator: 'between', errorStyle: 'warning', formulae: [1, 100] });
    const cfs = (ws as unknown as { conditionalFormattings: { ref: string; rules: { type: string; formulae?: string[]; style?: { fill?: { bgColor?: { argb?: string } } } }[] }[] }).conditionalFormattings;
    expect(cfs.map((c) => [c.ref, c.rules[0]!.type])).toEqual([['B2:B20', 'expression'], ['D2:D20', 'colorScale']]);
    expect(cfs[0]!.rules[0]!.formulae).toEqual(['AND($A2<>"",$B2="")']);
    expect(cfs[0]!.rules[0]!.style?.fill?.bgColor?.argb).toBe('FFFFC7CE');
  });

  it('writes a data bar, an icon set and the rule attributes import reads', async () => {
    const cf: ConditionalFormat = {
      sqref: ['A1:A9'],
      rules: [
        { type: 'dataBar', priority: 1, stopIfTrue: true, formulas: [], dataBar: { cfvo: [{ type: 'num', val: '0', gte: false }, { type: 'max' }], color: { theme: 4, tint: -0.25 }, minLength: 10, maxLength: 90 } },
        { type: 'iconSet', priority: 2, stopIfTrue: false, formulas: [], iconSet: { iconSet: '3Arrows', cfvo: [{ type: 'percent', val: '0' }, { type: 'percent', val: '33' }, { type: 'percent', val: '67' }] } },
        { type: 'top10', priority: 3, stopIfTrue: false, formulas: [], rank: 5, percent: true, bottom: false, dxfId: 0 },
        { type: 'aboveAverage', priority: 4, stopIfTrue: false, formulas: [], aboveAverage: false, dxfId: 0 },
        { type: 'containsText', priority: 5, stopIfTrue: false, operator: 'containsText', text: 'a&b', formulas: ['NOT(ISERROR(SEARCH("a&b",A1)))'], dxfId: 0 },
        { type: 'timePeriod', priority: 6, stopIfTrue: false, timePeriod: 'last7Days', formulas: [], dxfId: 0 },
      ],
    };
    const xml = unzipText(await toXlsx({ sheets: [sheet({ conditionalFormats: [cf] })], dxfs: [{}] }))['xl/worksheets/sheet1.xml']!;
    expect(xml).toContain('<cfRule type="dataBar" priority="1" stopIfTrue="1"><dataBar minLength="10" maxLength="90"><cfvo type="num" val="0" gte="0"/><cfvo type="max"/><color theme="4" tint="-0.25"/></dataBar></cfRule>');
    expect(xml).toContain('<iconSet iconSet="3Arrows">');
    expect(xml).toContain('<cfRule type="top10" dxfId="0" priority="3" percent="1" bottom="0" rank="5"/>');
    expect(xml).toContain('aboveAverage="0"');
    expect(xml).toContain('text="a&amp;b"');
    expect(xml).toContain('timePeriod="last7Days"');
  });

  it('refuses a rule Excel would repair, with SP-2015 and the sheet', async () => {
    const bad = async (s: Partial<Sheet>, dxfs?: Dxf[]) => {
      const e = await toXlsx({ sheets: [sheet(s)], ...(dxfs && { dxfs }) }).catch((x: unknown) => x);
      expect(e).toBeInstanceOf(ExportError);
      expect(e).toMatchObject({ code: 'bad-rule', spCode: 'SP-2015', sheet: 'Spec' });
      return (e as ExportError).spDetail;
    };
    expect(await bad({ dataValidations: [{ ...list, sqref: [] }] })).toMatch(/covers no range/);
    expect(await bad({ dataValidations: [{ ...list, sqref: ['B2:nope'] }] })).toMatch(/not a cell or range/);
    expect(await bad({ dataValidations: [{ ...list, type: 'regex' }] })).toMatch(/type "regex"/);
    expect(await bad({ dataValidations: [{ ...list, operator: 'like' }] })).toMatch(/operator "like"/);
    expect(await bad({ dataValidations: [{ ...list, errorStyle: 'loud' }] })).toMatch(/errorStyle/);
    expect(await bad({ dataValidations: [{ ...list, errorTitle: 'x'.repeat(33) }] })).toMatch(/errorTitle has 33 characters; Excel allows 32/);
    expect(await bad({ dataValidations: [{ ...list, prompt: 'x'.repeat(256) }] })).toMatch(/prompt has 256/);
    expect(await bad({ dataValidations: [{ ...list, formula1: 5 as unknown as string }] })).toMatch(/formula1 is not text/);
    expect(await bad({ dataValidations: [{ ...list, formula1: `"${'a,'.repeat(128)}"` }] })).toMatch(/Excel allows 255/);
    expect(await bad({ dataValidations: {} as DataValidation[] })).toMatch(/not an array/);
    expect(await bad({ conditionalFormats: [{ sqref: ['A1'], rules: [] }] })).toMatch(/at least one rule/);
    expect(await bad({ conditionalFormats: [missingUnit] })).toMatch(/dxfId 0 names no differential format \(the workbook has 0\)/);
    expect(await bad({ conditionalFormats: [{ ...missingUnit, rules: [{ ...missingUnit.rules[0]!, type: 'magic' }] }] }, [red])).toMatch(/type "magic"/);
    expect(await bad({ conditionalFormats: [{ ...missingUnit, rules: [{ ...missingUnit.rules[0]!, priority: 1.5 }] }] }, [red])).toMatch(/priority/);
    expect(await bad({ conditionalFormats: [{ ...missingUnit, rules: [{ ...missingUnit.rules[0]!, operator: 'like' }] }] }, [red])).toMatch(/operator "like"/);
    expect(await bad({ conditionalFormats: [{ ...missingUnit, rules: [{ ...missingUnit.rules[0]!, timePeriod: 'someday' }] }] }, [red])).toMatch(/timePeriod/);
    expect(await bad({ conditionalFormats: [{ ...missingUnit, rules: [{ ...missingUnit.rules[0]!, formulas: ['1', '2', '3', '4'] }] }] }, [red])).toMatch(/up to three formulas/);
    expect(await bad({ conditionalFormats: [{ ...scale, rules: [{ ...scale.rules[0]!, colorScale: { cfvo: [{ type: 'min' }], colors: [{}] } }] }] })).toMatch(/2–3 thresholds/);
    expect(await bad({ conditionalFormats: [{ ...scale, rules: [{ ...scale.rules[0]!, colorScale: { cfvo: [{ type: 'min' }, { type: 'max' }], colors: [{}] } }] }] })).toMatch(/one colour per threshold/);
    expect(await bad({ conditionalFormats: [{ ...scale, rules: [{ ...scale.rules[0]!, colorScale: { cfvo: [{ type: 'min' }, { type: 'top' }], colors: [{}, {}] } }] }] })).toMatch(/cfvo type "top"/);
    expect(await bad({ conditionalFormats: [{ sqref: ['A1'], rules: [{ type: 'dataBar', priority: 1, stopIfTrue: false, formulas: [], dataBar: { cfvo: [{ type: 'min' }, { type: 'max' }] } }] }] })).toMatch(/needs a colour/);
    expect(await bad({ conditionalFormats: [{ sqref: ['A1'], rules: [{ type: 'iconSet', priority: 1, stopIfTrue: false, formulas: [], iconSet: { iconSet: '9Moons', cfvo: [{ type: 'min' }, { type: 'max' }] } }] }] })).toMatch(/icon set "9Moons"/);
    const e = await toXlsx({ sheets: [sheet()], dxfs: [null as unknown as Dxf] }).catch((x: unknown) => x);
    expect(e).toMatchObject({ code: 'bad-rule', spCode: 'SP-2015' });
  });
});

// ── patchXlsx (DoD 2) ───────────────────────────────────────────────────────

async function upload(): Promise<Uint8Array> {
  return toXlsx({
    sheets: [sheet({ merges: ['A1:B1'], dataValidations: [list], conditionalFormats: [missingUnit] }), { name: 'Other', rows: [[1]], dataValidations: [whole] }],
    dxfs: [red],
  });
}

describe('patchXlsx rewrites or removes each block (W-57 DoD 2)', () => {
  it('rewrites a sheet\'s validation and formats whole; other sheets and parts stay byte for byte', async () => {
    const orig = await upload();
    const out = await patchXlsx(orig, [], {
      dataValidations: [{ sheet: 'Spec', rules: [whole] }],
      conditionalFormats: [{ sheet: 'Spec', formats: [scale, missingUnit] }],
    });
    const xml = unzipText(out)['xl/worksheets/sheet1.xml']!;
    expect(xml.match(/<dataValidation /g)).toHaveLength(1);
    expect(xml).toContain('type="whole"');
    expect(xml.match(/<conditionalFormatting /g)).toHaveLength(2);
    expect(xml.indexOf('sqref="D2:D20"')).toBeLessThan(xml.indexOf('sqref="B2:B20"'));
    const [mc, cf, dv] = order(xml, 'mergeCells', 'conditionalFormatting', 'dataValidations');
    expect(mc! < cf! && cf! < dv!).toBe(true);
    const before = new Map(readZip(orig).map((e) => [e.name, rawData(orig, e)]));
    for (const e of readZip(out)) if (e.name !== 'xl/worksheets/sheet1.xml') expect(rawData(out, e), e.name).toEqual(before.get(e.name));
  });

  it('removes each block when given an empty list', async () => {
    const out = await patchXlsx(await upload(), [], { dataValidations: [{ sheet: 'Spec', rules: [] }], conditionalFormats: [{ sheet: 'Spec', formats: [] }] });
    const xml = unzipText(out)['xl/worksheets/sheet1.xml']!;
    expect(xml).not.toMatch(/dataValidation|conditionalFormatting/);
    expect(xml).toContain('<mergeCells count="1">');
  });

  it('adds the blocks in schema position to a sheet that had none, after mergeCells and phoneticPr, before hyperlinks', async () => {
    const sx = `<worksheet xmlns="${NS}"><sheetData/><autoFilter ref="A1:B2"/><mergeCells count="1"><mergeCell ref="A1:B1"/></mergeCells><phoneticPr fontId="1"/><hyperlinks/><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
    const out = await patchXlsx(minimalPackage(sx), [], { dataValidations: [{ sheet: 'Data', rules: [list] }], conditionalFormats: [{ sheet: 'Data', formats: [scale] }] });
    const xml = unzipText(out)['xl/worksheets/sheet1.xml']!;
    expect(xml).toMatch(/<phoneticPr fontId="1"\/><conditionalFormatting sqref="D2:D20">.*<\/conditionalFormatting><dataValidations count="1">.*<\/dataValidations><hyperlinks\/>/);
  });

  it('adds dataValidations after the formats a sheet keeps, and leaves Excel 2010 rules in extLst alone', async () => {
    const ext = '<extLst><ext uri="{CCE6A557-97BC-4b89-ADB6-D9C93CAAB3DF}" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"><x14:dataValidations count="1"><x14:dataValidation type="list"><x14:formula1><xm:f xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main">Lists!A1:A3</xm:f></x14:formula1><xm:sqref xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main">C1</xm:sqref></x14:dataValidation></x14:dataValidations><x14:conditionalFormattings><x14:conditionalFormatting/></x14:conditionalFormattings></ext></extLst>';
    const sx = `<worksheet xmlns="${NS}"><sheetData/><conditionalFormatting sqref="A1"><cfRule type="expression" priority="1"><formula>TRUE</formula></cfRule></conditionalFormatting>${ext}</worksheet>`;
    const out = await patchXlsx(minimalPackage(sx), [], { dataValidations: [{ sheet: 'Data', rules: [list] }] });
    const xml = unzipText(out)['xl/worksheets/sheet1.xml']!;
    expect(xml).toContain(`</conditionalFormatting><dataValidations count="1">`);
    expect(xml).toContain(ext);
    const cleared = unzipText(await patchXlsx(minimalPackage(sx), [], { conditionalFormats: [{ sheet: 'Data', formats: [] }] }))['xl/worksheets/sheet1.xml']!;
    expect(cleared).toBe(`<worksheet xmlns="${NS}"><sheetData/>${ext}</worksheet>`);
  });

  it('keeps a prefixed namespace (x:)', () => {
    const sx = `<x:worksheet xmlns:x="${NS}"><x:sheetData/><x:dataValidations count="1"><x:dataValidation type="whole" sqref="A1"/></x:dataValidations></x:worksheet>`;
    const xml = setConditionalFormats(setDataValidations(sx, [list]), [scale], 0);
    expect(xml).toMatch(/^<x:worksheet [^>]*><x:sheetData\/><x:conditionalFormatting sqref="D2:D20"><x:cfRule type="colorScale"[^>]*><x:colorScale><x:cfvo type="min"\/>.*<x:dataValidations count="1"><x:dataValidation type="list"[^>]*><x:formula1>Lists!\$A\$2:\$A\$9<\/x:formula1><\/x:dataValidation><\/x:dataValidations><\/x:worksheet>$/);
  });

  it('appends dxfs after the file\'s own; a rule names them by the id after the file\'s last', async () => {
    const out = await patchXlsx(await upload(), [], {
      dxfs: [{ fill: { patternType: 'solid', bgColor: { rgb: 'FFC6EFCE' } } }],
      conditionalFormats: [{ sheet: 'Other', formats: [{ sqref: ['A1'], rules: [{ type: 'cellIs', operator: 'greaterThan', priority: 1, stopIfTrue: false, dxfId: 1, formulas: ['0'] }] }] }],
    });
    const styles = unzipText(out)['xl/styles.xml']!;
    expect(styles).toMatch(/<dxfs count="2"><dxf>.*FFFFC7CE.*<\/dxf><dxf><fill><patternFill patternType="solid"><bgColor rgb="FFC6EFCE"\/><\/patternFill><\/fill><\/dxf><\/dxfs>/);
    const ws = (await readBack(out)).getWorksheet('Other')!;
    expect(ws.getCell('A1').value).toBe(1);
    await expect(patchXlsx(await upload(), [], { conditionalFormats: [{ sheet: 'Other', formats: [{ sqref: ['A1'], rules: [{ type: 'cellIs', operator: 'greaterThan', priority: 1, stopIfTrue: false, dxfId: 1, formulas: ['0'] }] }] }] }))
      .rejects.toMatchObject({ code: 'bad-rule', spCode: 'SP-2015', sheet: 'Other' });
  });

  it('creates <dxfs> in schema position, and a style sheet when the package has none', async () => {
    const styles = `<styleSheet xmlns="${NS}"><fonts count="1"><font/></fonts><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><tableStyles count="0"/></styleSheet>`;
    const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const withStyles = minimalPackage(`<worksheet xmlns="${NS}"><sheetData/></worksheet>`, {
      'xl/styles.xml': styles,
      'xl/_rels/workbook.xml.rels': `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${R}/styles" Target="styles.xml"/></Relationships>`,
    });
    const a = unzipText(await patchXlsx(withStyles, [], { dxfs: [{ font: { i: true } }] }))['xl/styles.xml']!;
    expect(a).toContain('</cellStyles><dxfs count="1"><dxf><font><i/></font></dxf></dxfs><tableStyles count="0"/>');

    const bare = await patchXlsx(minimalPackage(`<worksheet xmlns="${NS}"><sheetData/></worksheet>`), [], { dxfs: [red], conditionalFormats: [{ sheet: 'Data', formats: [missingUnit] }] });
    const parts = unzipText(bare);
    expect(parts['xl/styles.xml']).toContain('<dxfs count="1">');
    expect(parts['xl/_rels/workbook.xml.rels']).toContain('Target="styles.xml"');
    expect(parts['[Content_Types].xml']).toContain('PartName="/xl/styles.xml"');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bare as unknown as ArrayBuffer);
    expect(wb.getWorksheet('Data')).toBeDefined();
  });

  it('refuses an unknown sheet, a bad rule and a bad dxfs list before writing anything', async () => {
    const orig = await upload();
    await expect(patchXlsx(orig, [], { dataValidations: [{ sheet: 'Nope', rules: [] }] })).rejects.toMatchObject({ code: 'no-sheet', spCode: 'SP-2006' });
    await expect(patchXlsx(orig, [], { conditionalFormats: [{ sheet: 'Nope', formats: [] }] })).rejects.toMatchObject({ code: 'no-sheet' });
    await expect(patchXlsx(orig, [], { dataValidations: [{ sheet: 'Spec', rules: [{ ...list, sqref: ['?'] }] }] })).rejects.toMatchObject({ code: 'bad-rule', sheet: 'Spec', ref: '?' });
    await expect(patchXlsx(orig, [], { dxfs: 'red' as unknown as Dxf[] })).rejects.toMatchObject({ code: 'bad-rule' });
  });
});
