import { describe, expect, it } from 'vitest';
import { createWorkbook, type WorkbookStore } from '@sheetpane/grid';
import { codeOf } from '@sheetpane/export';
import { DEFAULT_FILLS, MAX_FILL_CELLS, review, type ReviewPlugin } from '../src/index.js';
import { blobBytes, cellsOf, parseXml, styleOf, unzip, workbook } from './helpers.js';

async function storeOn(data: Uint8Array, plugin: ReviewPlugin = review({ fill: true })) {
  const s = createWorkbook({ plugins: [plugin] });
  await s.load(data, 'holdings.xlsx');
  return { s, plugin };
}
const exported = async (s: WorkbookStore, options: Record<string, unknown> = {}) => unzip(await blobBytes((await s.exportFile({ options })).blob));

/** Cells with formats 0, 1 and 2; a row with spans; a styled column G; a <dimension>. */
const book = () => workbook({
  sheets: [
    {
      name: 'Holdings', spans: true,
      head: '<dimension ref="A1:I6"/>', cells: { A1: 'Account', B2: { v: 'AC-1O044', s: 2 }, C2: 5, I6: { v: 0.075, s: 1 }, C4: 12, G3: 1 },
      rowAttrs: { 9: 'customFormat="1" s="2"' },
    },
    { name: 'Pages', cells: { A1: 1 } },
  ],
});

/** cellXfs and fills of a styles part, as the browser parses them. */
function styles(xml: string) {
  const d = parseXml(xml);
  const xfs = [...d.getElementsByTagName('cellXfs')[0]!.getElementsByTagName('xf')];
  const fills = [...d.getElementsByTagName('fills')[0]!.getElementsByTagName('fill')];
  const rgbOf = (fillId: number) => fills[fillId]?.getElementsByTagName('fgColor')[0]?.getAttribute('rgb') ?? null;
  return { d, xfs, fills, rgbOf, xf: (i: number) => xfs[i]! };
}

describe('colouring flagged cells (DoD 3)', () => {
  it('a flagged cell points at a clone of its own format with a solid fill; its value and every other cell are byte-identical', async () => {
    const { s, plugin } = await storeOn(await book());
    const a = s.addError({ sheet: 'Holdings', range: 'I6', type: 'wrong-value', severity: 'error' });
    const b = s.addError({ sheet: 'Holdings', range: 'B2', type: 'wrong-format', severity: 'warning' });
    const parts = await exported(s);
    const before = cellsOf((await unzip(await book())).get('xl/worksheets/sheet1.xml')!);
    const sheet = parts.get('xl/worksheets/sheet1.xml')!;
    const after = cellsOf(sheet);
    for (const [ref, xml] of before) if (ref !== 'I6' && ref !== 'B2') expect(after.get(ref), ref).toBe(xml);
    expect(after.get('I6')!.replace(/\ss="\d+"/, '')).toBe(before.get('I6')!.replace(/\ss="\d+"/, ''));
    const st = styles(parts.get('xl/styles.xml')!);
    const i6 = st.xf(styleOf(after.get('I6'))), b2 = st.xf(styleOf(after.get('B2')));
    // the clone keeps the number format, font, border and the alignment child; only fillId and applyFill differ
    expect([i6.getAttribute('numFmtId'), i6.getAttribute('applyNumberFormat'), i6.getAttribute('applyFill'), i6.getElementsByTagName('alignment')[0]?.getAttribute('horizontal')]).toEqual(['164', '1', '1', 'center']);
    expect(st.rgbOf(Number(i6.getAttribute('fillId')))).toBe(DEFAULT_FILLS.error);
    expect([b2.getAttribute('fontId'), b2.getAttribute('borderId')]).toEqual(['1', '1']);
    expect(st.rgbOf(Number(b2.getAttribute('fillId')))).toBe(DEFAULT_FILLS.warning);
    expect(st.d.getElementsByTagName('cellXfs')[0]!.getAttribute('count')).toBe(String(st.xfs.length));
    expect(st.d.getElementsByTagName('fills')[0]!.getAttribute('count')).toBe(String(st.fills.length));
    // the original formats are untouched: appended, never edited
    expect(parts.get('xl/styles.xml')!).toContain('<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center"/></xf>');
    expect(plugin.lastExport!.filled.sort()).toEqual([a.id, b.id].sort());
    expect(sheet).not.toMatch(/font/i);
  });

  it('a range: every cell, the missing ones added empty in order (row style, column style); a missing row created; spans and <dimension> widened', async () => {
    const { s } = await storeOn(await workbook({
      sheets: [{ name: 'Holdings', spans: true, head: '<dimension ref="A1:C4"/><cols><col min="7" max="7" width="9" style="2" customWidth="1"/></cols>', cells: { A1: 'a', C2: 5, C4: 12 }, rowAttrs: { 9: 'customFormat="1" s="1"' } }],
    }));
    s.addError({ sheet: 'Holdings', range: 'B2:D2', type: 'other', severity: 'note' });
    s.addError({ sheet: 'Holdings', range: 'F7:G7', type: 'other', severity: 'error' });
    s.addError({ sheet: 'Holdings', range: 'B9', type: 'other', severity: 'warning' });
    const parts = await exported(s);
    const sheet = parts.get('xl/worksheets/sheet1.xml')!;
    parseXml(sheet);
    const cells = cellsOf(sheet);
    const st = styles(parts.get('xl/styles.xml')!);
    const rgb = (ref: string) => st.rgbOf(Number(st.xf(styleOf(cells.get(ref))).getAttribute('fillId')));
    // row 2: B2 and D2 added around the file's C2, in column order; spans grown from 3:3 to 2:4
    expect(sheet).toMatch(/<row r="2" spans="2:4"><c r="B2" s="\d+"\/><c r="C2" s="\d+"><v>5<\/v><\/c><c r="D2" s="\d+"\/><\/row>/);
    expect(['B2', 'C2', 'D2'].map(rgb)).toEqual([DEFAULT_FILLS.note, DEFAULT_FILLS.note, DEFAULT_FILLS.note]);
    // row 7 did not exist: created between rows 4 and 9; G7 takes column G's style (2: bold, border)
    expect(sheet.indexOf('<row r="7">')).toBeGreaterThan(sheet.indexOf('<row r="4"'));
    expect(sheet.indexOf('<row r="7">')).toBeLessThan(sheet.indexOf('<row r="9"'));
    expect(st.xf(styleOf(cells.get('G7'))).getAttribute('borderId')).toBe('1');
    expect(st.xf(styleOf(cells.get('F7'))).getAttribute('borderId')).toBe('0');
    // row 9 is self-closed with customFormat s=1: B9 is added with the row's format (percent), filled
    expect(sheet).toMatch(/<row r="9" customFormat="1" s="1"><c r="B9" s="\d+"\/><\/row>/);
    expect(st.xf(styleOf(cells.get('B9'))).getAttribute('numFmtId')).toBe('164');
    expect(sheet).toContain('<dimension ref="A1:G9"/>');
  });

  it('two severities on one cell: the worse fill wins; accepted and resolved errors are never filled; a whole-sheet error is listed, not coloured', async () => {
    const { s, plugin } = await storeOn(await book());
    s.addError({ sheet: 'Holdings', range: 'C2', type: 'other', severity: 'note' });
    s.addError({ sheet: 'Holdings', range: 'B2:C2', type: 'other', severity: 'error' });
    const ac = s.addError({ sheet: 'Holdings', range: 'C4', type: 'other', severity: 'error' });
    s.acceptError(ac.id, 'Known, approved', { by: 'R. Mehta' });
    const rs = s.addError({ sheet: 'Holdings', range: 'A1', type: 'other', severity: 'error' });
    s.updateError(rs.id, { status: 'resolved' });
    const ws = s.addError({ sheet: 'Pages', range: '', type: 'other', severity: 'error', message: 'No Pages List' });
    const wb = s.addError({ sheet: '', range: '', type: 'other', severity: 'error' });
    const parts = await exported(s);
    const cells = cellsOf(parts.get('xl/worksheets/sheet1.xml')!);
    const st = styles(parts.get('xl/styles.xml')!);
    expect(st.rgbOf(Number(st.xf(styleOf(cells.get('C2'))).getAttribute('fillId')))).toBe(DEFAULT_FILLS.error);
    const orig = cellsOf((await unzip(await book())).get('xl/worksheets/sheet1.xml')!);
    expect(cells.get('C4')).toBe(orig.get('C4'));
    expect(cells.get('A1')).toBe(orig.get('A1'));
    expect(parts.get('xl/worksheets/sheet2.xml')).toBe((await unzip(await book())).get('xl/worksheets/sheet2.xml'));
    expect(plugin.lastExport!.skipped).toEqual([{ id: wb.id, reason: 'no-cell' }, { id: ws.id, reason: 'no-cell' }]); // the workbook's first, as listed
    expect(plugin.lastExport!.listed).toEqual(expect.arrayContaining([ac.id, rs.id, ws.id, wb.id]));
  });

  it('one clone per format and colour; switched on per export; colours by option; a bad colour is refused (SP-5905)', async () => {
    const { s, plugin } = await storeOn(await book(), review({ fills: { warning: '#00B050', note: null } }));
    s.addError({ sheet: 'Holdings', range: 'C2', type: 'other', severity: 'warning' });
    s.addError({ sheet: 'Holdings', range: 'C4', type: 'other', severity: 'warning' });
    s.addError({ sheet: 'Holdings', range: 'A1', type: 'other', severity: 'note' });
    let parts = await exported(s);
    expect(styleOf(cellsOf(parts.get('xl/worksheets/sheet1.xml')!).get('C2'))).toBe(0); // fill is off by default
    parts = await exported(s, { reviewFills: true });
    const cells = cellsOf(parts.get('xl/worksheets/sheet1.xml')!);
    const st = styles(parts.get('xl/styles.xml')!);
    expect(styleOf(cells.get('C2'))).toBe(styleOf(cells.get('C4')));
    expect(st.rgbOf(Number(st.xf(styleOf(cells.get('C2'))).getAttribute('fillId')))).toBe('FF00B050');
    expect(styleOf(cells.get('A1'))).toBe(0); // note: no fill
    expect(st.xfs).toHaveLength(3 + 2); // the header's grey and one green clone
    expect(plugin.lastExport!.filled).toHaveLength(2);
    let thrown: unknown;
    try { review({ fills: { error: 'red' } }); } catch (e) { thrown = e; }
    expect(codeOf(thrown)).toBe('SP-5905');
    expect(thrown).toBeInstanceOf(TypeError);
  });

  it(`a range over ${MAX_FILL_CELLS} cells colours only the cells the file has (SP-5903); no styles part → nothing coloured (SP-5904), the sheet still written`, async () => {
    const { s, plugin } = await storeOn(await book());
    const big = s.addError({ sheet: 'Holdings', range: 'A1:Z1000', type: 'other', severity: 'warning' });
    const parts = await exported(s);
    const cells = cellsOf(parts.get('xl/worksheets/sheet1.xml')!);
    expect([...cells.keys()].sort()).toEqual(['A1', 'B2', 'C2', 'C4', 'G3', 'I6']);
    for (const c of cells.values()) expect(styleOf(c)).toBeGreaterThan(2);
    expect(plugin.lastExport!.skipped).toEqual([{ id: big.id, reason: 'range-capped', code: 'SP-5903' }]);

    const bare = await storeOn(await workbook({ sheets: [{ name: 'Holdings', cells: { A1: 1 } }], styles: null }));
    const e = bare.s.addError({ sheet: 'Holdings', range: 'A1', type: 'other', severity: 'error' });
    const p2 = await exported(bare.s);
    expect(p2.get('xl/worksheets/sheet1.xml')).toBe((await unzip(await workbook({ sheets: [{ name: 'Holdings', cells: { A1: 1 } }], styles: null }))).get('xl/worksheets/sheet1.xml'));
    expect(bare.plugin.lastExport!.skipped).toEqual([{ id: e.id, reason: 'no-styles', code: 'SP-5904' }]);
    expect(bare.plugin.lastExport!.sheet).toBe('Review');
    expect(p2.get('xl/worksheets/sheet2.xml')).not.toMatch(/\ss="/); // the header is unstyled without a styles part
  });
});
