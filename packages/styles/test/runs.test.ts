// W-53 DoD 2 and 3: the styles plugin draws a rich-text cell's runs — weight, style, decoration, size,
// colour, super- and subscript, never a font family (SR-LAW-5) — and an edit's plain text exports while
// every untouched rich cell, and the shared strings, stay byte for byte through patchXlsx.
import { afterEach, describe, expect, it } from 'vitest';
import { ALLOWED_PROPS, styleRef, styles, type StylePatch } from '../src/index.js';
import { cellEl, exported, handMade, mount, partText, readBack, storeWith, stylesWith } from './helpers.js';

afterEach(() => document.body.replaceChildren());

const FAMILY = 'font' + '-family';
const rPr = (inner: string) => `<rPr>${inner}<rFont val="Calibri"/><family val="2"/><scheme val="minor"/></rPr>`;
const PLAIN_RUN = { 'font-weight': '400', 'font-style': 'normal', 'text-decoration': 'none' };

/** Shared strings 0–2 rich; A1, A2, D1 share string 0; D1's own font is bold red; B2 inline plain. */
const richBook = () => handMade({
  sst: `<si><r><t xml:space="preserve">Net </t></r><r>${rPr('<i/><sz val="11"/><color theme="1"/>')}<t>of tax</t></r></si>`
    + `<si><r>${rPr('<sz val="11"/><color theme="1"/>')}<t>E=mc</t></r><r>${rPr('<vertAlign val="superscript"/><sz val="11"/><color theme="1"/>')}<t>2</t></r></si>`
    + `<si><r>${rPr('<u/><sz val="14"/><color rgb="FF0070C0"/>')}<t xml:space="preserve">big </t></r><r>${rPr('<strike/><sz val="11"/><color theme="1"/>')}<t>struck</t></r></si>`,
  rows: '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" s="1" t="s"><v>0</v></c></row>'
    + '<row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2" t="inlineStr"><is><t>x</t></is></c></row>',
  styles: stylesWith({ fonts: ['<font><b/><sz val="11"/><color rgb="FFC00000"/><name val="Calibri"/></font>'], xfs: ['<xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1"/>'] }),
});

describe('decorateRuns (W-53 DoD 2)', () => {
  it('a formatted run states weight, style and decoration; a run with none takes the cell\'s look', async () => {
    const s = await storeWith(await richBook(), [styles()]);
    expect(s.decorateRuns('Data', 'A1')).toEqual([{ text: 'Net ' }, { text: 'of tax', style: { ...PLAIN_RUN, 'font-style': 'italic' } }]);
  });
  it('superscript: vertical-align super at three quarters of the size', async () => {
    const s = await storeWith(await richBook(), [styles()]);
    expect(s.decorateRuns('Data', 'B1')).toEqual([{ text: 'E=mc', style: PLAIN_RUN }, { text: '2', style: { ...PLAIN_RUN, 'font-size': '0.75em', 'vertical-align': 'super' } }]);
  });
  it('size in em of the cell\'s, colour, underline and strike — the default ink left to the host', async () => {
    const s = await storeWith(await richBook(), [styles()]);
    expect(s.decorateRuns('Data', 'C1')).toEqual([
      { text: 'big ', style: { ...PLAIN_RUN, 'text-decoration': 'underline', 'font-size': '1.273em', color: '#0070C0' } },
      { text: 'struck', style: { ...PLAIN_RUN, 'text-decoration': 'line-through' } },
    ]);
  });
  it('measured against the cell\'s own font: a run in the default ink inside a red bold cell is drawn black, not bold', async () => {
    const s = await storeWith(await richBook(), [styles()]);
    expect(s.decorate('Data', 'D1')).toMatchObject({ 'font-weight': '700', color: '#C00000' });
    expect(s.decorateRuns('Data', 'D1')).toEqual([{ text: 'Net ' }, { text: 'of tax', style: { ...PLAIN_RUN, 'font-style': 'italic', color: '#000000' } }]);
  });
  it('never a font family; only allow-listed properties', async () => {
    const s = await storeWith(await richBook(), [styles()]);
    const allowed = new Set<string>(ALLOWED_PROPS);
    for (const ref of ['A1', 'B1', 'C1', 'D1', 'A2']) for (const p of s.decorateRuns('Data', ref)!) {
      for (const k of Object.keys(p.style ?? {})) { expect(k).not.toBe(FAMILY); expect(allowed.has(k)).toBe(true); }
    }
  });
  it('fileStyles: false draws the runs plain, as without the plugin', async () => {
    const s = await storeWith(await richBook(), [styles({ fileStyles: false })]);
    expect(s.decorateRuns('Data', 'A1')).toBeUndefined();
  });
});

describe('drawn in the grid (W-53 DoD 2)', () => {
  it('spans with the run\'s look; the cell\'s text whole', async () => {
    const el = await mount(await storeWith(await richBook(), [styles()]), 'view');
    const v = cellEl(el, 0, 0)!.querySelector('.v')!;
    expect(v.textContent).toBe('Net of tax');
    const span = v.querySelector('span')!;
    expect(span.textContent).toBe('of tax');
    expect(getComputedStyle(span).fontStyle).toBe('italic');
    const big = cellEl(el, 0, 2)!.querySelector('.v span')!;
    expect(getComputedStyle(big).color).toBe('rgb(0, 112, 192)');
    expect(getComputedStyle(big).textDecorationLine).toBe('underline');
    expect(cellEl(el, 0, 1)!.querySelector('.v span:last-child')!.getAttribute('style')).toMatch(/vertical-align:super/);
  });
});

const cellXml = (sheet: string, ref: string) => new RegExp(`<c r="${ref}"[^>]*?(?:/>|>.*?</c>)`).exec(sheet)?.[0];

describe('export (W-53 DoD 3)', () => {
  it('an edited rich cell writes plain text; the shared strings and every untouched rich cell stay byte for byte', async () => {
    const up = await richBook();
    const s = await storeWith(up, [styles()]);
    s.setCell('Data', 'A1', 'Net of all tax');
    const out = await exported(s);
    const before = (await partText(up, 'xl/worksheets/sheet1.xml'))!, after = (await partText(out, 'xl/worksheets/sheet1.xml'))!;
    expect(cellXml(after, 'A1')).toBe('<c r="A1" t="inlineStr"><is><t>Net of all tax</t></is></c>');
    for (const ref of ['A2', 'B1', 'C1', 'D1']) expect(cellXml(after, ref)).toBe(cellXml(before, ref));
    expect(await partText(out, 'xl/sharedStrings.xml')).toBe(await partText(up, 'xl/sharedStrings.xml'));
    const back = (await readBack(out)).sheets[0]!;
    expect(back.runs.A1).toBeUndefined();
    expect(back.rows[0]![0]).toBe('Net of all tax');
    expect(back.runs.A2).toEqual((await readBack(up)).sheets[0]!.runs.A2);
    expect(back.runs.C1).toHaveLength(2);
  });
  it('a restyle elsewhere leaves the rich cells and the shared strings untouched', async () => {
    const up = await richBook();
    const s = await storeWith(up, [styles()]);
    s.setChange('Data', styleRef('B2'), 'style', { b: true } satisfies StylePatch, {});
    const out = await exported(s);
    const before = (await partText(up, 'xl/worksheets/sheet1.xml'))!, after = (await partText(out, 'xl/worksheets/sheet1.xml'))!;
    for (const ref of ['A1', 'A2', 'B1', 'C1', 'D1']) expect(cellXml(after, ref)).toBe(cellXml(before, ref));
    expect(await partText(out, 'xl/sharedStrings.xml')).toBe(await partText(up, 'xl/sharedStrings.xml'));
    expect((await readBack(out)).sheets[0]!.runs.B1).toHaveLength(2);
  });
  it('a restyled rich cell keeps its runs, drawn and exported', async () => {
    const s = await storeWith(await richBook(), [styles()]);
    s.setChange('Data', styleRef('A1'), 'style', { b: true } satisfies StylePatch, {});
    expect(s.decorateRuns('Data', 'A1')).toHaveLength(2);
    const back = (await readBack(await exported(s))).sheets[0]!;
    expect(back.runs.A1).toHaveLength(2);
  });
});
