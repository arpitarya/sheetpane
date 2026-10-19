import { describe, expect, it } from 'vitest';
import { createWorkbook, layerOf, type Severity, type SheetpaneError, type WorkbookStore } from '@sheetpane/grid';
import { read } from '@sheetpane/import';
import { readFile, valueAt } from '@sheetpane/testing';
import { COLUMNS, REVIEW_NAME, review, reviewSheetOf, type ReviewPlugin } from '../src/index.js';
import { selectErrors } from '../src/rows.js';
import { cleanSheetName, uniqueSheetName } from '../src/sheet.js';
import { blobBytes, parseXml, unzip, workbook } from './helpers.js';

const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

async function storeOn(data: Uint8Array, plugin: ReviewPlugin = review()) {
  const s = createWorkbook({ plugins: [plugin] });
  await s.load(data, 'holdings.xlsx');
  return s;
}
const exported = async (s: WorkbookStore, options: Record<string, unknown> = {}) => blobBytes((await s.exportFile({ options })).blob);
const plain = () => workbook({ sheets: [{ name: 'Holdings', cells: { A1: 'Account', B2: 'AC-1O044', I6: '7.5%', C4: 12 } }, { name: 'Pages', cells: { A1: 1 } }] });

/** One of each scope, out of order: a cell error, a workbook error, a whole-sheet error, a second cell above the first. */
function seed(s: WorkbookStore) {
  const a = s.addError({ sheet: 'Holdings', range: 'I6', type: 'wrong-value', severity: 'error', expected: '0.75%', message: 'Fee rate is 10× the tier & above the cap <2%>.', author: 'Arpit' });
  const w = s.addError({ sheet: '', range: '', type: 'other', severity: 'warning', message: 'A listed tab has no sheet' });
  const p = s.addError({ sheet: 'Pages', range: '', type: 'other', severity: 'error', message: 'No Pages List' });
  const b = s.addError({ sheet: 'Holdings', range: 'B2', type: 'wrong-format', severity: 'warning', expected: 'AC-10044', author: 'S. Kapoor' });
  return { a, w, p, b };
}

/** The Review sheet's cell text, `A1` → text, read with the browser's own parser. */
function grid(xml: string): Record<string, string> {
  const d = parseXml(xml);
  return Object.fromEntries([...d.getElementsByTagName('c')].map((c) => [c.getAttribute('r')!, c.textContent ?? '']));
}

describe('the Review sheet (DoD 2)', () => {
  it('a new worksheet part, its relationship, its content type, a <sheet> in the workbook and the marker name; every part well-formed', async () => {
    const s = await storeOn(await plain());
    const { a, w, p, b } = seed(s);
    const parts = await unzip(await exported(s));
    for (const [name, xml] of parts) if (/\.(xml|rels)$/.test(name)) parseXml(xml, name);
    const wb = parseXml(parts.get('xl/workbook.xml')!);
    const sheets = [...wb.getElementsByTagName('sheet')].map((x) => [x.getAttribute('name'), x.getAttribute('sheetId'), x.getAttributeNS(R, 'id')]);
    expect(sheets.map((x) => x[0])).toEqual(['Holdings', 'Pages', 'Review']);
    expect(sheets[2]![1]).toBe('3');
    const rels = parseXml(parts.get('xl/_rels/workbook.xml.rels')!);
    const rel = [...rels.getElementsByTagName('Relationship')].find((r) => r.getAttribute('Id') === sheets[2]![2])!;
    expect(rel.getAttribute('Type')).toBe(`${R}/worksheet`);
    expect(rel.getAttribute('Target')).toBe('worksheets/sheet3.xml');
    expect(parts.get('[Content_Types].xml')).toContain('<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>');
    // the marker: workbook-scoped, hidden, over the table; <definedNames> in schema position (after <sheets>, before <calcPr>)
    const dn = [...wb.getElementsByTagName('definedName')];
    expect(dn.map((d) => [d.getAttribute('name'), d.getAttribute('hidden'), d.getAttribute('localSheetId'), d.textContent])).toEqual([[REVIEW_NAME, '1', null, "'Review'!$A$1:$M$5"]]);
    expect(parts.get('xl/workbook.xml')!.indexOf('<definedNames>')).toBeGreaterThan(parts.get('xl/workbook.xml')!.indexOf('</sheets>'));
    expect(parts.get('xl/workbook.xml')!.indexOf('<definedNames>')).toBeLessThan(parts.get('xl/workbook.xml')!.indexOf('<calcPr'));

    // the table: a header, then the workbook's errors, each sheet's whole-sheet errors, its cells top to bottom
    const sheet = parts.get('xl/worksheets/sheet3.xml')!;
    const g = grid(sheet);
    expect(COLUMNS.map((_, c) => g[`${String.fromCharCode(65 + c)}1`])).toEqual([...COLUMNS]);
    expect(['A2', 'A3', 'A4', 'A5'].map((r) => g[r])).toEqual([w.id, b.id, a.id, p.id]);
    expect(['A5', 'B5', 'C5', 'D5', 'E5'].map((r) => g[r])).toEqual([p.id, 'Pages', 'Whole sheet', 'Error', 'Other']);
    expect(['B2', 'C2', 'D2'].map((r) => g[r])).toEqual([undefined, 'Whole workbook', 'Warning']);
    expect(['C4', 'D4', 'E4', 'F4', 'G4', 'H4', 'I4', 'J4'].map((r) => g[r])).toEqual(['I6', 'Error', 'Wrong value', '7.5%', '0.75%', 'Fee rate is 10× the tier & above the cap <2%>.', 'Arpit', 'Open']);
    expect(sheet).toContain('above the cap &lt;2%&gt;.'); // escaped, an inline string
    expect(sheet).not.toMatch(/t="s"/); // sharedStrings is never touched
    expect(parts.has('xl/sharedStrings.xml')).toBe(false);

    // links: internal hyperlinks on the Cell column — none for the workbook, A1 for a whole sheet
    const links = [...parseXml(sheet).getElementsByTagName('hyperlink')].map((h) => [h.getAttribute('ref'), h.getAttribute('location'), h.getAttribute('display'), h.getAttributeNS(R, 'id')]);
    expect(links).toEqual([['C3', "'Holdings'!B2", 'B2', null], ['C4', "'Holdings'!I6", 'I6', null], ['C5', "'Pages'!A1", 'Whole sheet', null]]);
    expect(parts.has('xl/worksheets/_rels/sheet3.xml.rels')).toBe(false); // internal links need no relationship
    // a frozen header row; no font (SR-LAW-5)
    expect(sheet).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
    expect(sheet).not.toMatch(/font/i);
    expect(s.plugins[0] && (s.plugins[0] as ReviewPlugin).lastExport).toMatchObject({ sheet: 'Review', listed: [w.id, b.id, a.id, p.id], counts: { open: 4, accepted: 0, resolved: 0 } });
  });

  it('parts it does not own are untouched: every other part is byte-identical to the export without the plugin', async () => {
    const data = await plain();
    const s = await storeOn(data);
    seed(s);
    const bare = createWorkbook();
    await bare.load(data, 'holdings.xlsx');
    const [mine, theirs] = [await unzip(await exported(s)), await unzip(await blobBytes((await bare.exportFile()).blob))];
    const changed = [...mine.keys()].filter((k) => mine.get(k) !== theirs.get(k)).sort();
    expect(changed).toEqual(['[Content_Types].xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet3.xml']);
    expect(mine.get('xl/worksheets/sheet1.xml')).toBe(theirs.get('xl/worksheets/sheet1.xml'));
  });

  it("a user's own sheet named Review (any case) is never overwritten: the new one is Review (2)", async () => {
    const data = await workbook({ sheets: [{ name: 'Holdings', cells: { A1: 1 } }, { name: 'review', cells: { A1: 'mine' } }] });
    const s = await storeOn(data);
    s.addError({ sheet: 'Holdings', range: 'A1', type: 'other', severity: 'note', message: 'x' });
    const parts = await unzip(await exported(s));
    expect([...parseXml(parts.get('xl/workbook.xml')!).getElementsByTagName('sheet')].map((x) => x.getAttribute('name'))).toEqual(['Holdings', 'review', 'Review (2)']);
    expect(parts.get('xl/worksheets/sheet2.xml')).toContain('<t>mine</t>');
    expect(parts.get('xl/workbook.xml')).toContain(`<definedName name="${REVIEW_NAME}" hidden="1">'Review (2)'!$A$1:$M$2</definedName>`);
  });

  it('names: forbidden characters dropped, 31 characters at most, a suffix that still fits', () => {
    expect(cleanSheetName('Q3: review [draft]?')).toBe('Q3 review draft');
    expect(cleanSheetName("'''")).toBe('Review');
    expect(cleanSheetName('x'.repeat(40))).toHaveLength(31);
    expect(uniqueSheetName('x'.repeat(31), ['x'.repeat(31)])).toBe(`${'x'.repeat(27)} (2)`);
    expect(uniqueSheetName('Review', ['REVIEW', 'Review (2)'])).toBe('Review (3)');
  });

  it("a sheet name with an apostrophe, the option's own name, and a link that quotes it", async () => {
    const data = await workbook({ sheets: [{ name: "Q3 'final'", cells: { B2: 1 } }] });
    const s = await storeOn(data, review({ sheetName: 'Checks' }));
    s.addError({ sheet: "Q3 'final'", range: 'b2', type: 'other', severity: 'error' });
    const parts = await unzip(await exported(s));
    expect(parts.get('xl/worksheets/sheet2.xml')).toContain(`location="'Q3 ''final'''!B2"`);
    expect(parts.get('xl/workbook.xml')).toContain('<sheet name="Checks" sheetId="2"');
  });

  it('exported twice: the second export rewrites its own Review sheet in place, not a second one', async () => {
    const s = await storeOn(await plain());
    seed(s);
    const first = await exported(s);
    const again = await storeOn(first);
    expect(reviewSheetOf(again.getSnapshot().book!)).toBe('Review');
    again.addError({ sheet: 'Holdings', range: 'C4', type: 'other', severity: 'note', message: 'second pass' });
    const parts = await unzip(await exported(again));
    const wb = parts.get('xl/workbook.xml')!;
    expect([...parseXml(wb).getElementsByTagName('sheet')].map((x) => x.getAttribute('name'))).toEqual(['Holdings', 'Pages', 'Review']);
    expect(wb.match(new RegExp(REVIEW_NAME, 'g'))).toHaveLength(1);
    expect(wb).toContain("'Review'!$A$1:$M$2");
    expect(grid(parts.get('xl/worksheets/sheet3.xml')!).H2).toBe('second pass');
    expect([...parts.keys()].filter((k) => k.startsWith('xl/worksheets/sheet'))).toHaveLength(3);
  });

  it('switched off for one export, or nothing to list: nothing is written', async () => {
    const plugin = review();
    const s = await storeOn(await plain(), plugin);
    expect(plugin.exportOptions).toEqual([{ key: 'review', label: 'Add a Review sheet', default: true }, { key: 'reviewFills', label: 'Colour flagged cells', default: false }]);
    await exported(s);
    expect(plugin.lastExport).toBeUndefined();
    seed(s);
    const parts = await unzip(await exported(s, { review: false }));
    expect(parts.has('xl/worksheets/sheet3.xml')).toBe(false);
    expect(plugin.lastExport).toBeUndefined();
    expect(review({ sheet: false }).exportOptions![0]!.default).toBe(false);
  });

  it('the file’s own comments are not listed; severities and layers filter (W-50’s pass/skipped, W-51’s layer)', async () => {
    const e = (id: string, severity: Severity, extra: Partial<SheetpaneError> = {}): SheetpaneError => ({ v: 1, id, sheet: 'S', range: 'A1', type: 'other', severity, found: '', expected: '', message: '', cellChanged: false, status: 'open', matchesExpected: false, author: '', createdAt: '', ...extra });
    const list = [e('E1', 'error'), e('E2', 'pass'), e('E3', 'note', { author: 'file' }), e('E4', 'warning', { layer: 'spec' }), e('E5', 'skipped', { layer: 'spec' })];
    expect(selectErrors(list, {}, ['S']).map((x) => x.id)).toEqual(['E1', 'E4']);
    expect(selectErrors(list, { severities: ['error', 'pass', 'skipped'] }, ['S']).map((x) => x.id)).toEqual(['E1', 'E2', 'E5']);
    expect(selectErrors(list, { layers: ['review'] }, ['S']).map((x) => x.id)).toEqual(['E1']);
    expect(selectErrors(list, { layers: ['spec'], severities: ['warning', 'skipped'] }, ['S']).map((x) => x.id)).toEqual(['E4', 'E5']);

    const s = await storeOn(await plain(), review({ severities: ['error'] }));
    seed(s);
    let parts = await unzip(await exported(s));
    expect(grid(parts.get('xl/worksheets/sheet3.xml')!).A4).toBeUndefined(); // two errors listed: rows 2 and 3
    parts = await unzip(await exported(s, { reviewSeverities: ['warning'] }));
    expect(Object.keys(grid(parts.get('xl/worksheets/sheet3.xml')!)).filter((k) => k.startsWith('A'))).toEqual(['A1', 'A2', 'A3']);
    // a list naming something that is not a severity is ignored: the plugin's own `severities` stand
    parts = await unzip(await exported(s, { reviewSeverities: ['warning', 'fatal'] }));
    expect(grid(parts.get('xl/worksheets/sheet3.xml')!).A4).toBeUndefined();
    expect(selectErrors(list, { layers: ['review'] }, ['S']).every((x) => layerOf(x) === 'review')).toBe(true);
  });
});

describe('accepted errors on the Review sheet (DoD 5, W-69)', () => {
  it('listed with their status and Accepted: <reason>, who and when; counted apart from the open ones', async () => {
    const plugin = review();
    const s = await storeOn(await plain(), plugin);
    const { a, b, p } = seed(s);
    expect(s.acceptError(a.id, 'Tier 3 carve-out, signed off', { by: 'R. Mehta' })).toBe(true);
    s.updateError(b.id, { status: 'resolved' });
    const at = s.getErrors().find((x) => x.id === a.id)!.acceptedAt!;
    const g = grid((await unzip(await exported(s))).get('xl/worksheets/sheet3.xml')!);
    expect(['J4', 'K4', 'L4', 'M4'].map((r) => g[r])).toEqual(['Accepted', 'Accepted: Tier 3 carve-out, signed off', 'R. Mehta', `${at.slice(0, 16).replace('T', ' ')} UTC`]);
    expect(['J3', 'K3', 'L3', 'M3'].map((r) => g[r])).toEqual(['Resolved', undefined, undefined, undefined]);
    expect(g.J5).toBe('Open');
    expect(plugin.lastExport!.counts).toEqual({ open: 2, accepted: 1, resolved: 1 });
    expect(plugin.lastExport!.listed).toContain(p.id);
  });
});

describe('reading it back (DoD 4)', () => {
  it('@sheetpane/import reads the Review sheet and the marker; reviewSheetOf finds it so a host can skip it', async () => {
    const s = await storeOn(await plain());
    const { a } = seed(s);
    const bytes = await exported(s);
    const book = await read(bytes, { name: 'holdings.xlsx' });
    expect(book.sheets.map((x) => x.name)).toEqual(['Holdings', 'Pages', 'Review']);
    expect(book.definedNames).toContainEqual({ name: REVIEW_NAME, formula: "'Review'!$A$1:$M$5" });
    expect(reviewSheetOf(book)).toBe('Review');
    expect(book.sheets[2]!.rows[3]!.slice(0, 3)).toEqual([a.id, 'Holdings', 'I6']);
    expect(reviewSheetOf({ definedNames: [], sheets: book.sheets })).toBeUndefined();
    expect(reviewSheetOf({ definedNames: [{ name: REVIEW_NAME, formula: "'Gone'!$A$1" }], sheets: book.sheets })).toBeUndefined();
  });

  it('@sheetpane/testing reads the Review sheet back as values', async () => {
    const s = await storeOn(await plain());
    const { a, w } = seed(s);
    const values = await readFile(await exported(s), 'holdings.xlsx');
    expect(values.names).toContain('Review');
    expect(valueAt(values, 'Review!A1')).toBe('ID');
    expect(valueAt(values, 'Review!A2')).toBe(w.id);
    expect(valueAt(values, 'Review!H4')).toBe(a.message);
    expect(valueAt(values, 'Holdings!I6')).toBe('7.5%'); // the user's cells are as they were
  });
});
