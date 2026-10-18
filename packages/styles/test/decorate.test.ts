import { describe, expect, it } from 'vitest';
import { STYLE_PROPS, type StyleSubset, type WorkbookStore } from '@sheetpane/grid';
import { ALLOWED_PROPS, BORDER_CSS, BORDER_STYLES, CELL_EM, mix, styleRef, styles, type StylePatch } from '../src/index.js';
import { featuresXlsx, handMade, storeWith, styledRow, stylesWith, themeXml } from './helpers.js';

// Spelled in pieces so the L5 veto grep (SR-LAW-5) stays clean over this file too.
const FAMILY = 'font' + '-family';
const FACE = '@font' + '-face';
const deco = (s: WorkbookStore, ref: string, sheet = s.getSnapshot().book!.sheets[0]!.name): StyleSubset => s.decorate(sheet, ref);
const xfs = (n: number, f: (i: number) => string) => Array.from({ length: n }, (_, i) => f(i));
/** Every decorate result seen in this file — checked for the allow-list and the family at the end. */
const seen: StyleSubset[] = [];
const track = (s: WorkbookStore) => { const d = s.decorate.bind(s); s.decorate = (sh, r) => { const o = d(sh, r); seen.push(o); return o; }; return s; };

async function book(o: Parameters<typeof stylesWith>[0], cells: number, extra: { theme?: string } = {}) {
  return track(await storeWith(await handMade({ rows: styledRow(cells), styles: stylesWith(o), ...extra }), [styles()]));
}

describe('decorate from the ExcelJS fixture (W-17 DoD 2)', () => {
  it('Holdings!A3: bold, colour FF2346C8, fill FFFFF2CC, bottom thin border — property by property, nothing else', async () => {
    const s = track(await storeWith(featuresXlsx(), [styles()]));
    expect(deco(s, 'A3', 'Holdings')).toEqual({ 'font-weight': '700', color: '#2346C8', 'background-color': '#FFF2CC', 'border-bottom': '1px solid #000000' });
  });
  it('A1 (merged header) is centred; a number-format-only cell and an unstyled cell stay plain', async () => {
    const s = track(await storeWith(featuresXlsx(), [styles()]));
    expect(deco(s, 'A1', 'Holdings')).toEqual({ 'text-align': 'center' });
    expect(deco(s, 'B3', 'Holdings')).toEqual({});
    expect(deco(s, 'A2', 'Holdings')).toEqual({});
    expect(deco(s, 'Z99', 'Holdings')).toEqual({});
  });
  it('fileStyles: false draws only the user\'s own changes', async () => {
    const s = await storeWith(featuresXlsx(), [styles({ fileStyles: false })]);
    expect(deco(s, 'A3', 'Holdings')).toEqual({});
    s.setChange('Holdings', styleRef('B3'), 'style', { i: true } satisfies StylePatch, {});
    expect(deco(s, 'B3', 'Holdings')).toEqual({ 'font-style': 'italic' });
  });
});

describe('decorate from hand-made styles.xml', () => {
  it('theme colours with tint (font and fill), and the file theme over the default', async () => {
    const s = await book({
      fonts: ['<font><sz val="11"/><color theme="4" tint="0.3999755851924192"/><name val="Calibri"/></font>', '<font><sz val="11"/><color theme="5"/><name val="Calibri"/></font>'],
      fills: ['<fill><patternFill patternType="solid"><fgColor theme="0" tint="-0.1499984740745262"/><bgColor indexed="64"/></patternFill></fill>'],
      xfs: ['<xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1"/>', '<xf numFmtId="0" fontId="0" fillId="2" borderId="0" applyFill="1"/>', '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" applyFont="1"/>'],
    }, 3, { theme: themeXml({ accent2: '123456' }) });
    expect(deco(s, 'A1').color).toMatch(/^#8[EF]A[9A]D[BC]$/);
    expect(deco(s, 'B1')).toEqual({ 'background-color': '#D9D9D9', color: '#000000' });
    expect(deco(s, 'C1')).toEqual({ color: '#123456' });
  });
  it('indexed colours: the default palette, and <indexedColors> when the file overrides it', async () => {
    const parts = { fonts: ['<font><sz val="11"/><color indexed="10"/></font>'], fills: ['<fill><patternFill patternType="solid"><fgColor indexed="43"/><bgColor indexed="64"/></patternFill></fill>'], xfs: ['<xf numFmtId="0" fontId="1" fillId="0" borderId="0"/>', '<xf numFmtId="0" fontId="0" fillId="2" borderId="0"/>'] };
    const s = await book(parts, 2);
    expect(deco(s, 'A1')).toEqual({ color: '#FF0000' });
    expect(deco(s, 'B1')).toEqual({ 'background-color': '#FFFF99', color: '#000000' });
    const custom = Array.from({ length: 64 }, (_, i) => `<rgbColor rgb="FF${i === 10 ? 'ABCDEF' : i === 43 ? '012345' : '000000'}"/>`).join('');
    const o = await book({ ...parts, indexed: custom }, 2);
    expect(deco(o, 'A1')).toEqual({ color: '#ABCDEF' });
    expect(deco(o, 'B1')['background-color']).toBe('#012345');
  });
  it('every border style, on every side, with automatic and explicit colours', async () => {
    const borders = BORDER_STYLES.map((st, i) => `<border><left style="${st}"><color auto="1"/></left><right style="${st}"><color rgb="FF00FF00"/></right><top style="${st}"/><bottom style="${st}"><color theme="4"/></bottom><diagonal style="${st}"/></border>`);
    const s = await book({ borders, xfs: xfs(BORDER_STYLES.length, (i) => `<xf numFmtId="0" fontId="0" fillId="0" borderId="${i + 1}" applyBorder="1"/>`) }, BORDER_STYLES.length);
    BORDER_STYLES.forEach((st, i) => {
      const w = BORDER_CSS[st]!;
      expect(deco(s, `${String.fromCharCode(65 + i)}1`), st).toEqual({ 'border-left': `${w} #000000`, 'border-right': `${w} #00FF00`, 'border-top': `${w} #000000`, 'border-bottom': `${w} #4472C4` });
    });
    expect(BORDER_STYLES).toEqual(expect.arrayContaining(['thin', 'medium', 'thick', 'dashed', 'dotted', 'double', 'hair', 'mediumDashed', 'dashDot', 'mediumDashDot', 'dashDotDot', 'mediumDashDotDot', 'slantDashDot']));
    expect(BORDER_CSS.thin).toBe('1px solid'); expect(BORDER_CSS.medium).toBe('2px solid'); expect(BORDER_CSS.thick).toBe('3px solid'); expect(BORDER_CSS.double).toBe('3px double');
  });
  it('alignment: horizontal, vertical, wrap', async () => {
    const al = ['horizontal="left"', 'horizontal="center"', 'horizontal="right"', 'horizontal="justify"', 'horizontal="general"', 'vertical="top"', 'vertical="center"', 'vertical="bottom"', 'wrapText="1"', 'horizontal="centerContinuous" vertical="center" wrapText="1"', 'indent="2" horizontal="left"', 'textRotation="90"'];
    const s = await book({ xfs: al.map((a) => `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment ${a}/></xf>`) }, al.length);
    const got = al.map((_, i) => deco(s, `${String.fromCharCode(65 + i)}1`));
    expect(got).toEqual([
      { 'text-align': 'left' }, { 'text-align': 'center' }, { 'text-align': 'right' }, { 'text-align': 'justify' }, {},
      { 'vertical-align': 'top' }, { 'vertical-align': 'middle' }, { 'vertical-align': 'bottom' }, { 'white-space': 'pre-wrap' },
      { 'text-align': 'center', 'vertical-align': 'middle', 'white-space': 'pre-wrap' }, { 'text-align': 'left' }, {},
    ]);
  });
  it('font: weight, style, size relative to the default font, underline, double underline, strike — and the family is never read', async () => {
    const fonts = ['<font><b/><sz val="11"/><name val="Arial Black"/></font>', '<font><i/><sz val="11"/><name val="Comic Sans MS"/></font>', '<font><sz val="22"/><name val="Calibri"/></font>', '<font><u/><sz val="11"/></font>', '<font><u val="double"/><sz val="11"/></font>', '<font><strike/><u/><sz val="11"/></font>', '<font><sz val="11"/><color theme="1"/></font>'];
    const s = await book({ fonts, xfs: xfs(fonts.length, (i) => `<xf numFmtId="0" fontId="${i + 1}" fillId="0" borderId="0" applyFont="1"/>`) }, fonts.length);
    const got = fonts.map((_, i) => deco(s, `${String.fromCharCode(65 + i)}1`));
    expect(got).toEqual([
      { 'font-weight': '700' }, { 'font-style': 'italic' }, { 'font-size': `${Math.round(2 * CELL_EM * 1000) / 1000}em` },
      { 'text-decoration': 'underline' }, { 'text-decoration': 'underline double' }, { 'text-decoration': 'underline line-through' },
      {}, // the default font's colour is the host's colour (dark themes keep their ink)
    ]);
  });
  it('fills: solid, a pattern blended by its density, a gradient at its midpoint; a filled cell with automatic text gets the workbook ink', async () => {
    const fills = ['<fill><patternFill patternType="darkGray"><fgColor rgb="FFFF0000"/><bgColor rgb="FFFFFFFF"/></patternFill></fill>', '<fill><gradientFill degree="90"><stop position="0"><color rgb="FF000000"/></stop><stop position="1"><color rgb="FFFFFFFF"/></stop></gradientFill></fill>', '<fill><patternFill patternType="solid"/></fill>'];
    const s = await book({ fills, xfs: xfs(fills.length, (i) => `<xf numFmtId="0" fontId="0" fillId="${i + 2}" borderId="0" applyFill="1"/>`) }, fills.length);
    expect(deco(s, 'A1')).toEqual({ 'background-color': mix('#FF0000', '#FFFFFF', 0.75), color: '#000000' });
    expect(deco(s, 'B1')).toEqual({ 'background-color': '#808080', color: '#000000' });
    expect(deco(s, 'C1')).toEqual({});
  });
  it('a workbook without styles.xml, and a CSV, decorate nothing', async () => {
    const s = await storeWith(await handMade({ rows: '<row r="1"><c r="A1" s="3"><v>1</v></c></row>' }), [styles()]);
    expect(deco(s, 'A1')).toEqual({});
    const c = await storeWith(new TextEncoder().encode('a,b\n1,2\n'), [styles()], 'x.csv');
    expect(deco(c, 'A1')).toEqual({});
  });
});

describe('decorate with a user style change', () => {
  it('the patch overrides the file property by property; clear drops the file format', async () => {
    const s = track(await storeWith(featuresXlsx(), [styles()]));
    const set = (ref: string, p: StylePatch) => s.setChange('Holdings', styleRef(ref), 'style', p, {});
    set('A3', { b: false, color: 'C00000', border: { bottom: null, top: { style: 'double', color: '00FF00' } } });
    expect(deco(s, 'A3', 'Holdings')).toEqual({ 'font-weight': '400', color: '#C00000', 'background-color': '#FFF2CC', 'border-top': '3px double #00FF00' });
    set('A3', { fill: null, u: true, strike: true, align: 'right', valign: 'top', wrap: true });
    expect(deco(s, 'A3', 'Holdings')).toEqual({ 'font-weight': '700', color: '#2346C8', 'border-bottom': '1px solid #000000', 'text-decoration': 'underline line-through', 'text-align': 'right', 'vertical-align': 'top', 'white-space': 'pre-wrap' });
    set('A3', { clear: true });
    expect(deco(s, 'A3', 'Holdings')).toEqual({});
    set('A3', { clear: true, fill: 'FFC7CE' });
    expect(deco(s, 'A3', 'Holdings')).toEqual({ 'background-color': '#FFC7CE', color: '#000000' });
    set('A1', { align: null, i: true });
    expect(deco(s, 'A1', 'Holdings')).toEqual({ 'font-style': 'italic' });
  });
});

describe('the allow-list and SR-LAW-5', () => {
  it('every decorate result in this file used only allow-listed properties, and never a font family', () => {
    expect(seen.length).toBeGreaterThan(20);
    for (const o of seen) for (const k of Object.keys(o)) {
      expect(ALLOWED_PROPS as readonly string[]).toContain(k);
      expect(k.toLowerCase()).not.toContain('family');
    }
    for (const p of ALLOWED_PROPS) expect(STYLE_PROPS as readonly string[]).toContain(p);
    expect(ALLOWED_PROPS as readonly string[]).not.toContain(FAMILY);
    expect(ALLOWED_PROPS as readonly string[]).not.toContain('background-image');
  });
  it('the L5 veto stays clean over the package source and README', () => {
    const veto = new RegExp(`${FACE}|\\.(woff2?|ttf|otf)\\b|fonts\\.(googleapis|gstatic)|${FAMILY}:[^;]*[A-Za-z]`);
    const files = {
      ...import.meta.glob('../src/**/*.ts', { query: '?raw', import: 'default', eager: true }),
      ...import.meta.glob('./**/*.ts', { query: '?raw', import: 'default', eager: true }),
      ...import.meta.glob('../README.md', { query: '?raw', import: 'default', eager: true }),
    } as Record<string, string>;
    expect(Object.keys(files).length).toBeGreaterThanOrEqual(7);
    for (const [path, text] of Object.entries(files)) {
      const hits = text.split('\n').filter((l) => veto.test(l) && !new RegExp(`${FAMILY}: *inherit`).test(l));
      expect(hits, path).toEqual([]);
      expect(text, path).not.toContain(FAMILY);
    }
  });
  it('a decorate result naming a font family would be refused by the host', async () => {
    const s = await storeWith(featuresXlsx(), [styles(), { id: 'bad', provides: ['decorate'], after: ['styles'], decorate: () => ({ [FAMILY]: 'serif' }) as StyleSubset }]);
    expect(() => s.decorate('Holdings', 'A3')).toThrow(/SR-LAW-5/);
  });
});
