import { describe, expect, it } from 'vitest';
import { STYLE_PREFIX, restyle, styleChanges, styleRef, styles, type StylePatch } from '../src/index.js';
import { exported, featuresXlsx, handMade, partText, readBack, storeWith, styledRow, stylesWith } from './helpers.js';

const H = 'Holdings';
const sel = (ref: string, range?: string) => (range ? { sheet: H, ref, range } : { sheet: H, ref });
const fontOf = (b: Awaited<ReturnType<typeof readBack>>, s: number | undefined) => b.styles.fonts[b.styles.cellXfs[s!]!.fontId]!;
const fillOf = (b: Awaited<ReturnType<typeof readBack>>, s: number | undefined) => b.styles.fills[b.styles.cellXfs[s!]!.fillId]!;
const xfOf = (b: Awaited<ReturnType<typeof readBack>>, s: number | undefined) => b.styles.cellXfs[s!]!;

describe('exportPatch (W-17 DoD 6)', () => {
  it('a style edit exports: new font and fill read back; number formats kept; every other cell keeps its s', async () => {
    const src = featuresXlsx();
    const before = await readBack(src);
    const s = await storeWith(src, [styles()]);
    restyle(s, sel('B3', 'B3:C3'), () => ({ b: true, fill: 'FFC7CE' }));
    const out = await exported(s);
    const b = await readBack(out);
    const sh = b.sheets[0]!, was = before.sheets[0]!;
    for (const ref of ['B3', 'C3']) {
      expect(sh.styleIndex[ref]).not.toBe(was.styleIndex[ref]);
      expect(fontOf(b, sh.styleIndex[ref])).toMatchObject({ b: true, sz: 11, color: { theme: 1 }, name: 'Calibri' });
      expect(fillOf(b, sh.styleIndex[ref])).toMatchObject({ patternType: 'solid', fgColor: { rgb: 'FFFFC7CE' } });
      expect(xfOf(b, sh.styleIndex[ref]).numFmtId).toBe(xfOf(before, was.styleIndex[ref]).numFmtId);
    }
    const others = Object.keys({ ...was.styleIndex, ...sh.styleIndex }).filter((r) => r !== 'B3' && r !== 'C3');
    for (const r of others) expect(sh.styleIndex[r], r).toBe(was.styleIndex[r]);
    expect(sh.rows[2]![1]).toBe(1200);
    // the original entries are untouched: appended only, counts updated
    expect(b.styles.fonts.slice(0, before.styles.fonts.length)).toEqual(before.styles.fonts);
    expect(b.styles.fills.slice(0, before.styles.fills.length)).toEqual(before.styles.fills);
    expect(b.styles.cellXfs.slice(0, before.styles.cellXfs.length)).toEqual(before.styles.cellXfs);
    const xml = (await partText(out, 'xl/styles.xml'))!;
    expect(xml).toMatch(new RegExp(`<cellXfs count="${b.styles.cellXfs.length}"`));
    expect(xml).toMatch(new RegExp(`<fonts count="${b.styles.fonts.length}"`));
    expect(xml).toContain('<extLst>'); // the rest of styles.xml is kept as written
    // the other sheet's part is byte-identical
    expect(await partText(out, 'xl/worksheets/sheet2.xml')).toBe(await partText(src, 'xl/worksheets/sheet2.xml'));
  });
  it('deduplicates: same patch on same format = one new xf; an existing identical fill is reused', async () => {
    const s = await storeWith(featuresXlsx(), [styles()]);
    const before = await readBack(featuresXlsx());
    restyle(s, sel('B4', 'B4:B5'), () => ({ i: true }));
    restyle(s, sel('A4'), () => ({ fill: 'FFF2CC' }));
    const b = await readBack(await exported(s));
    const sh = b.sheets[0]!;
    expect(sh.styleIndex.B4).toBe(sh.styleIndex.B5);
    expect(b.styles.cellXfs.length).toBe(before.styles.cellXfs.length + 2);
    expect(b.styles.fills.length).toBe(before.styles.fills.length);
    expect(xfOf(b, sh.styleIndex.A4).fillId).toBe(2);
  });
  it('a value change and a style change on the same cell both export', async () => {
    const s = await storeWith(featuresXlsx(), [styles()]);
    s.setCell(H, 'B3', '999');
    restyle(s, sel('B3'), () => ({ b: true }));
    s.setCell(H, 'C3', '5');
    expect(s.changeOf(H, 'B3')!.kind).toBe('value');
    expect(s.changeOf(H, styleRef('B3'))!.kind).toBe('style');
    const b = await readBack(await exported(s));
    expect(b.sheets[0]!.rows[2]![1]).toBe(999);
    expect(fontOf(b, b.sheets[0]!.styleIndex.B3).b).toBe(true);
    expect(xfOf(b, b.sheets[0]!.styleIndex.B3).numFmtId).toBe(3);
  });
  it('styling cells with no element adds <c r s/> in order, in a new or an existing row', async () => {
    const s = await storeWith(featuresXlsx(), [styles()]);
    restyle(s, sel('F1'), () => ({ fill: 'DDEBF7' }));
    restyle(s, sel('H10'), () => ({ b: true }));
    const out = await exported(s);
    const xml = (await partText(out, 'xl/worksheets/sheet1.xml'))!;
    expect(xml).toMatch(/<c r="E1" s="1"\/><c r="F1" s="\d+"\/><\/row>/);
    expect(xml).toMatch(/<\/row><row r="10"><c r="H10" s="\d+"\/><\/row><\/sheetData>/);
    const b = await readBack(out);
    expect(fillOf(b, b.sheets[0]!.styleIndex.F1).fgColor).toEqual({ rgb: 'FFDDEBF7' });
    expect(fontOf(b, b.sheets[0]!.styleIndex.H10).b).toBe(true);
  });
  it('clear formatting: the default font, no fill, no border, no alignment — the number format stays', async () => {
    const s = await storeWith(featuresXlsx(), [styles()]);
    restyle(s, sel('A3'), () => ({ clear: true }));
    restyle(s, sel('A1'), () => ({ clear: true }));
    const b = await readBack(await exported(s));
    const x = xfOf(b, b.sheets[0]!.styleIndex.A3);
    expect([x.fontId, x.fillId, x.borderId, x.alignment]).toEqual([0, 0, 0, undefined]);
    expect(xfOf(b, b.sheets[0]!.styleIndex.A1).alignment).toBeUndefined();
  });
  it('borders, alignment and wrap round-trip; untouched sides are kept', async () => {
    const bytes = await handMade({ rows: styledRow(1), styles: stylesWith({ borders: ['<border><left style="thick"><color rgb="FFFF0000"/></left><right/><top/><bottom/><diagonal/></border>'], xfs: ['<xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyBorder="1"/>'] }) });
    const s = await storeWith(bytes, [styles()]);
    restyle(s, { sheet: 'Data', ref: 'A1' }, () => ({ border: { bottom: { style: 'double' }, top: { style: 'thin', color: '2346C8' } }, align: 'center', valign: 'top', wrap: true }));
    const b = await readBack(await exported(s));
    const x = xfOf(b, b.sheets[0]!.styleIndex.A1);
    expect(x.alignment).toEqual({ horizontal: 'center', vertical: 'top', wrapText: true });
    expect(b.styles.borders[x.borderId]).toEqual({ left: { style: 'thick', color: { rgb: 'FFFF0000' } }, top: { style: 'thin', color: { rgb: 'FF2346C8' } }, bottom: { style: 'double', color: { indexed: 64 } } });
  });
  it('a package without styles.xml gets one, with its relationship and content type', async () => {
    const s = await storeWith(await handMade({ rows: '<row r="1"><c r="A1" t="inlineStr"><is><t>x</t></is></c></row>' }), [styles()]);
    restyle(s, { sheet: 'Data', ref: 'A1' }, () => ({ b: true }));
    const out = await exported(s);
    expect(await partText(out, 'xl/_rels/workbook.xml.rels')).toMatch(/relationships\/styles" Target="styles.xml"/);
    expect(await partText(out, '[Content_Types].xml')).toContain('/xl/styles.xml');
    const b = await readBack(out);
    expect(fontOf(b, b.sheets[0]!.styleIndex.A1).b).toBe(true);
  });
  it('no style change: styles.xml and the sheets are left byte for byte', async () => {
    const src = featuresXlsx();
    const s = await storeWith(src, [styles()]);
    restyle(s, sel('A3'), () => ({ b: true })); // already bold: no change at all
    expect(styleChanges(s.getSnapshot().changes)).toEqual([]);
    const out = await exported(s);
    expect(await partText(out, 'xl/styles.xml')).toBe(await partText(src, 'xl/styles.xml'));
    expect(await partText(out, 'xl/worksheets/sheet1.xml')).toBe(await partText(src, 'xl/worksheets/sheet1.xml'));
  });
});

describe('the style change (W-17 DoD 4, 5)', () => {
  it('lives at sheet!#style:REF, normalised against the file, removed when back to the file look', async () => {
    const s = await storeWith(featuresXlsx(), [styles()]);
    restyle(s, sel('A3'), () => ({ b: false, fill: 'FFF2CC' }));
    expect(styleChanges(s.getSnapshot().changes)).toEqual([{ sheet: H, ref: 'A3', patch: { b: false } satisfies StylePatch }]);
    expect([...s.getSnapshot().changes.keys()]).toEqual([`${H}!${STYLE_PREFIX}A3`]);
    restyle(s, sel('A3'), () => ({ b: true }));
    expect(s.getSnapshot().changes.size).toBe(0);
  });
  it('a range restyle is one undo step; redo brings it back', async () => {
    const s = await storeWith(featuresXlsx(), [styles()]);
    restyle(s, sel('B3', 'B3:D5'), () => ({ b: true }));
    expect(styleChanges(s.getSnapshot().changes)).toHaveLength(9);
    s.undo();
    expect(s.getSnapshot().changes.size).toBe(0);
    s.redo();
    expect(styleChanges(s.getSnapshot().changes)).toHaveLength(9);
    s.undo();
    const out = await exported(s);
    expect(await partText(out, 'xl/styles.xml')).toBe(await partText(featuresXlsx(), 'xl/styles.xml'));
  });
  it('one undo step per action — a second action undoes on its own', async () => {
    const s = await storeWith(featuresXlsx(), [styles()]);
    restyle(s, sel('B3', 'B3:C3'), () => ({ b: true }));
    restyle(s, sel('B3', 'B3:C3'), () => ({ i: true }));
    s.undo();
    expect(styleChanges(s.getSnapshot().changes).map((c) => c.patch)).toEqual([{ b: true }, { b: true }]);
  });
  it('a CSV is never restyled (it cannot carry a style — SR-LAW-3, SR-LAW-6)', async () => {
    const s = await storeWith(new TextEncoder().encode('a,b\n1,2\n'), [styles()], 'x.csv');
    restyle(s, { sheet: s.getSnapshot().book!.sheets[0]!.name, ref: 'A1' }, () => ({ b: true }));
    expect(s.getSnapshot().changes.size).toBe(0);
  });
});
