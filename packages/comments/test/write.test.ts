import { describe, expect, it } from 'vitest';
import { createWorkbook, type SheetpaneError, type WorkbookStore } from '@sheetpane/grid';
import { fromXlsx } from '@sheetpane/import';
import features from '../../import/test/fixtures/exceljs-features.xlsx?inline';
import { comments, errorGuids, personGuid, PLACEHOLDER, type CommentsPlugin } from '../src/index.js';
import { blobBytes, fromDataUrl, parseXml, unzip, workbook } from './helpers.js';

const TC_REL = 'http://schemas.microsoft.com/office/2017/10/relationships/threadedComment';
const PERSON_REL = 'http://schemas.microsoft.com/office/2017/10/relationships/person';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

async function storeOn(data: Uint8Array, plugin: CommentsPlugin = comments()) {
  const s = createWorkbook({ plugins: [plugin] });
  await s.load(data, 'review.xlsx');
  return s;
}
const exported = async (s: WorkbookStore, options: Record<string, unknown> = {}) => blobBytes((await s.exportFile({ options })).blob);
const count = (xml: string, re: RegExp) => [...xml.matchAll(re)].length;
const plain = () => workbook({ sheets: [{ name: 'Holdings', cells: { A1: 'Account', B2: 'AC-1O044', I6: '7.5%', C4: 12 } }, { name: 'Other', cells: { A1: 1 } }] });

/** Two people's errors and one with no author, on two cells; one resolved. */
function review(s: WorkbookStore) {
  const a = s.addError({ sheet: 'Holdings', range: 'I6', type: 'wrong-value', severity: 'error', expected: '0.75%', message: 'Fee rate is 10× the tier & above the cap <2%>.', author: 'Arpit' });
  const b = s.addError({ sheet: 'Holdings', range: 'A14:J14', type: 'duplicate-row', severity: 'note', message: 'Same as row 5.', author: '' });
  const c = s.addError({ sheet: 'Holdings', range: 'B2', type: 'wrong-format', severity: 'warning', expected: 'AC-10044', author: 'S. Kapoor' });
  s.updateError(c.id, { status: 'resolved' });
  return { a, b, c };
}

describe('writing the review (DoD 3)', () => {
  it('a file with no comments gets all four parts, their rels and content types, and <legacyDrawing> in the sheet', async () => {
    const s = await storeOn(await plain());
    const { a, b, c } = review(s);
    const parts = await unzip(await exported(s));
    for (const [name, xml] of parts) if (/\.(xml|rels|vml)$/.test(name)) parseXml(xml, name); // well-formed, every part
    const tc = parts.get('xl/threadedComments/threadedComment1.xml')!;
    const cm = parts.get('xl/comments1.xml')!;
    const vml = parts.get('xl/drawings/vmlDrawing1.vml')!;
    const ppl = parts.get('xl/persons/person.xml')!;
    expect([tc, cm, vml, ppl].every(Boolean)).toBe(true);

    // threads: the message, then `expected` as a reply; done="1" when resolved
    const doc = parseXml(tc);
    const ts = [...doc.getElementsByTagName('threadedComment')];
    expect(doc.documentElement.namespaceURI).toBe('http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments');
    expect(ts.map((t) => [t.getAttribute('ref'), t.getAttribute('id'), t.getAttribute('parentId'), t.getAttribute('done')])).toEqual([
      ['B2', errorGuids(c).comment, null, '1'],
      ['B2', errorGuids(c).expected, errorGuids(c).comment, null],
      ['I6', errorGuids(a).comment, null, null],
      ['I6', errorGuids(a).expected, errorGuids(a).comment, null],
      ['A14', errorGuids(b).comment, null, null],
    ]);
    expect(ts[2]!.textContent).toBe(`${a.id} · Error · Wrong value · Found: 7.5%\nFee rate is 10× the tier & above the cap <2%>.`);
    expect(ts[3]!.textContent).toBe('Should be: 0.75%');
    expect(ts[4]!.getAttribute('personId')).toBe(personGuid('Reviewer'));
    expect(ts[2]!.getAttribute('dT')).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d\d$/);

    // persons: one per author; the empty author is "Reviewer"
    const people = [...parseXml(ppl).getElementsByTagName('person')].map((p) => [p.getAttribute('displayName'), p.getAttribute('id'), p.getAttribute('providerId')]);
    expect(people).toEqual(expect.arrayContaining([['Arpit', personGuid('Arpit'), 'None'], ['Reviewer', personGuid('Reviewer'), 'None'], ['S. Kapoor', personGuid('S. Kapoor'), 'None']]));
    expect(people).toHaveLength(3);

    // legacy comments: one per thread, author tc={root id}, Excel's placeholder text
    const cdoc = parseXml(cm);
    const authors = [...cdoc.getElementsByTagName('author')].map((x) => x.textContent);
    const list = [...cdoc.getElementsByTagName('comment')];
    expect(list.map((x) => [x.getAttribute('ref'), authors[Number(x.getAttribute('authorId'))], x.getAttribute('shapeId')])).toEqual([
      ['B2', `tc=${errorGuids(c).comment}`, '0'], ['I6', `tc=${errorGuids(a).comment}`, '0'], ['A14', `tc=${errorGuids(b).comment}`, '0'],
    ]);
    expect(list[1]!.textContent).toBe(`${PLACEHOLDER}\n\nComment:\n    ${a.id} · Error · Wrong value · Found: 7.5%\n    Fee rate is 10× the tier & above the cap <2%>.\nReply:\n    Should be: 0.75%`);

    // VML: one hidden Note shape per commented cell, zero-based row and column
    const vdoc = parseXml(vml);
    const cd = [...vdoc.getElementsByTagNameNS('urn:schemas-microsoft-com:office:excel', 'ClientData')];
    expect(cd.map((x) => [x.getAttribute('ObjectType'), x.getElementsByTagNameNS('urn:schemas-microsoft-com:office:excel', 'Row')[0]!.textContent, x.getElementsByTagNameNS('urn:schemas-microsoft-com:office:excel', 'Column')[0]!.textContent])).toEqual([
      ['Note', '1', '1'], ['Note', '5', '8'], ['Note', '13', '0'],
    ]);
    expect(vml).toContain('<o:idmap v:ext="edit" data="1"/>');
    expect(vml).not.toMatch(/font/i); // nothing about fonts goes into the file (SR-LAW-5)
    expect(cm).not.toMatch(/<rFont|<font/);

    // rels and content types
    const srels = parts.get('xl/worksheets/_rels/sheet1.xml.rels')!;
    expect(srels).toContain(`Type="${TC_REL}" Target="../threadedComments/threadedComment1.xml"`);
    expect(srels).toContain(`Type="${R}/comments" Target="../comments1.xml"`);
    expect(srels).toContain(`Type="${R}/vmlDrawing" Target="../drawings/vmlDrawing1.vml"`);
    expect(parts.get('xl/_rels/workbook.xml.rels')).toContain(`Type="${PERSON_REL}" Target="persons/person.xml"`);
    const ct = parts.get('[Content_Types].xml')!;
    expect(ct).toContain('<Override PartName="/xl/threadedComments/threadedComment1.xml" ContentType="application/vnd.ms-excel.threadedcomments+xml"/>');
    expect(ct).toContain('<Override PartName="/xl/persons/person.xml" ContentType="application/vnd.ms-excel.person+xml"/>');
    expect(ct).toContain('<Override PartName="/xl/comments1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/>');
    expect(ct).toContain('<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>');

    // the sheet: <legacyDrawing> pointing at the VML rel
    const sheet = parts.get('xl/worksheets/sheet1.xml')!;
    const rid = /<legacyDrawing r:id="(rId\d+)"\/>/.exec(sheet)![1];
    expect(srels).toContain(`Id="${rid}" Type="${R}/vmlDrawing"`);
    // the sheet with no errors is untouched
    expect(parts.has('xl/worksheets/_rels/sheet2.xml.rels')).toBe(false);
    expect(parts.get('xl/worksheets/sheet2.xml')).not.toContain('legacyDrawing');
  });

  it('several errors on one cell are one thread (a cell holds one comment): one legacy comment, one shape', async () => {
    const s = await storeOn(await plain());
    const a = s.addError({ sheet: 'Holdings', range: 'C4', type: 'out-of-range', severity: 'warning', expected: '150', author: 'Arpit' });
    const b = s.addError({ sheet: 'Holdings', range: 'C4', type: 'other', severity: 'note', message: 'Ask ops.', author: 'Lee' });
    s.updateError(a.id, { status: 'resolved' });
    const parts = await unzip(await exported(s));
    const ts = [...parseXml(parts.get('xl/threadedComments/threadedComment1.xml')!).getElementsByTagName('threadedComment')];
    expect(ts.map((t) => [t.getAttribute('id'), t.getAttribute('parentId'), t.getAttribute('done')])).toEqual([
      [errorGuids(a).comment, null, null], // not done: b is still open
      [errorGuids(a).expected, errorGuids(a).comment, null],
      [errorGuids(b).comment, errorGuids(a).comment, null],
    ]);
    expect(count(parts.get('xl/comments1.xml')!, /<comment\b/g)).toBe(1);
    expect(count(parts.get('xl/drawings/vmlDrawing1.vml')!, /<v:shape\b/g)).toBe(1);
  });

  it('the sheet’s <legacyDrawing> goes in schema position, before <tableParts> and <extLst>', async () => {
    const tail = '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/><drawing r:id="rId9"/><tableParts count="0"/><extLst><ext uri="{X}"><x14:y xmlns:x14="urn:x"/></ext></extLst>';
    const s = await storeOn(await workbook({ sheets: [{ name: 'S', cells: { A1: 1 }, tail }] }));
    s.addError({ sheet: 'S', range: 'A1', type: 'other', severity: 'note', author: 'A' });
    const sheet = (await unzip(await exported(s))).get('xl/worksheets/sheet1.xml')!;
    expect(sheet).toMatch(/<drawing r:id="rId9"\/><legacyDrawing r:id="rId\d+"\/><tableParts count="0"\/><extLst>/);
  });
});

describe('the file’s own parts are extended, never replaced (DoD 3)', () => {
  it('the ExcelJS fixture: its note at A3 and its VML shape stay; the review joins them', async () => {
    const src = fromDataUrl(features);
    const before = await unzip(src);
    const s = await storeOn(src);
    const e = s.addError({ sheet: 'Holdings', range: 'B4', type: 'wrong-value', severity: 'error', expected: '430', author: 'Arpit' });
    const parts = await unzip(await exported(s));
    for (const [name, xml] of parts) if (/\.(xml|rels|vml)$/.test(name)) parseXml(xml, name);
    const cm = parts.get('xl/comments1.xml')!;
    expect(cm).toContain('Checked against the custodian file.');
    expect([...parseXml(cm).getElementsByTagName('author')].map((x) => x.textContent)).toEqual(['Author', `tc=${errorGuids(e).comment}`]);
    expect([...parseXml(cm).getElementsByTagName('comment')].map((x) => x.getAttribute('ref'))).toEqual(['A3', 'B4']);
    const vml = parts.get('xl/drawings/vmlDrawing1.vml')!;
    expect(vml.startsWith(before.get('xl/drawings/vmlDrawing1.vml')!.replace(/<\/xml>$/, ''))).toBe(true); // the original, then the new shape
    expect([...vml.matchAll(/id="(_x0000_s\d+)"/g)].map((m) => m[1])).toEqual(['_x0000_s1025', '_x0000_s1026']);
    expect(count(vml, /id="_x0000_t202"/g)).toBe(1); // the shapetype is not declared twice
    expect([...parts.keys()].filter((p) => p.endsWith('.vml'))).toEqual(['xl/drawings/vmlDrawing1.vml']);
    const sheet = parts.get('xl/worksheets/sheet1.xml')!;
    expect(count(sheet, /<legacyDrawing\b/g)).toBe(1);
    expect(parts.get('xl/drawings/drawing1.xml')).toBe(before.get('xl/drawings/drawing1.xml')); // the picture's drawing untouched
    expect(parts.get('xl/worksheets/_rels/sheet1.xml.rels')).toContain('Target="../threadedComments/threadedComment1.xml"');
  });

  it('existing threads and persons: kept, the review added; a cell with someone’s thread gets the error as replies', async () => {
    const P1 = '{11111111-1111-4111-8111-111111111111}', T1 = '{AAAAAAAA-0000-4000-8000-000000000001}', T2 = '{AAAAAAAA-0000-4000-8000-000000000002}';
    const src = await workbook({
      persons: [{ id: P1, displayName: 'R. Mehta' }],
      sheets: [{ name: 'S', cells: { A1: 'x', H3: 1200, D9: 'TIPS' }, threads: [
        { id: T1, ref: 'H3', personId: P1, text: 'Includes 200 transferred units.' },
        { id: T2, ref: 'H3', personId: P1, parentId: T1, text: 'From the custodian.' },
      ], notes: [{ ref: 'D9', author: 'R. Mehta', text: 'Inflation-linked.' }] }],
    });
    const plugin = comments();
    const s = await storeOn(src, plugin);
    const onThread = s.addError({ sheet: 'S', range: 'H3', type: 'wrong-value', severity: 'error', expected: '1000', author: 'Arpit' });
    const fresh = s.addError({ sheet: 'S', range: 'A1', type: 'other', severity: 'note', message: 'ok?', author: 'Arpit' });
    const onNote = s.addError({ sheet: 'S', range: 'D9', type: 'other', severity: 'note', message: 'units?', author: 'Arpit' });
    const parts = await unzip(await exported(s));
    const ts = [...parseXml(parts.get('xl/threadedComments/threadedComment1.xml')!).getElementsByTagName('threadedComment')];
    expect(ts.map((t) => [t.getAttribute('ref'), t.getAttribute('id'), t.getAttribute('parentId')])).toEqual([
      ['A1', errorGuids(fresh).comment, null],
      ['H3', T1, null], ['H3', T2, T1],
      ['H3', errorGuids(onThread).comment, T1], ['H3', errorGuids(onThread).expected, T1],
    ]);
    // the legacy placeholder of the joined thread now carries every reply
    const h3 = [...parseXml(parts.get('xl/comments1.xml')!).getElementsByTagName('comment')].find((c) => c.getAttribute('ref') === 'H3')!;
    expect(h3.textContent).toContain('Comment:\n    Includes 200 transferred units.\nReply:\n    From the custodian.\nReply:\n    ERR-');
    // D9 holds a note: a cell carries one comment, so that error is reported, not written over the note
    expect(plugin.lastExport).toEqual({ written: [onThread.id, fresh.id], skipped: [{ id: onNote.id, reason: 'note-at-cell' }] });
    expect(parts.get('xl/comments1.xml')).toContain('Inflation-linked.');
    // persons: R. Mehta kept, Arpit added, one list
    const ppl = [...parseXml(parts.get('xl/persons/person.xml')!).getElementsByTagName('person')].map((p) => p.getAttribute('displayName'));
    expect(ppl).toEqual(['R. Mehta', 'Arpit']);
    expect(count(parts.get('xl/_rels/workbook.xml.rels')!, new RegExp(PERSON_REL, 'g'))).toBe(1);
    expect(count(parts.get('[Content_Types].xml')!, /threadedcomments\+xml/g)).toBe(1);
    // the VML: one shape per commented cell — H3 and D9 had one; A1 is new
    expect(count(parts.get('xl/drawings/vmlDrawing1.vml')!, /<v:shape\b/g)).toBe(3);
  });

  it('a second VML part takes a free id block', async () => {
    const src = await workbook({ sheets: [{ name: 'A', cells: { A1: 1 }, notes: [{ ref: 'A1', author: 'x', text: 'n' }] }, { name: 'B', cells: { A1: 2 } }] });
    const s = await storeOn(src);
    s.addError({ sheet: 'B', range: 'A1', type: 'other', severity: 'note', author: 'Arpit' });
    const parts = await unzip(await exported(s));
    expect(parts.get('xl/drawings/vmlDrawing2.vml')).toContain('data="2"');
    expect(parts.get('xl/drawings/vmlDrawing2.vml')).toContain('id="_x0000_s2049"');
    expect(parts.get('xl/comments2.xml')).toBeDefined();
  });
});

describe('a part this plugin cannot read', () => {
  it('leaves that sheet’s parts as they were and reports the errors', async () => {
    const src = await workbook({ sheets: [{ name: 'S', cells: { A1: 1 }, threads: [{ id: '{AAAAAAAA-0000-4000-8000-000000000001}', ref: 'A1', personId: '{X}', text: 't' }] }] });
    const parts = await unzip(src);
    parts.set('xl/threadedComments/threadedComment1.xml', '<?xml version="1.0"?><Garbage/>');
    const { writeZip } = await import('@sheetpane/export');
    const broken = await writeZip([...parts].map(([name, t]) => ({ name, data: new TextEncoder().encode(t) })));
    const plugin = comments();
    const s = await storeOn(broken, plugin);
    const e = s.addError({ sheet: 'S', range: 'B2', type: 'other', severity: 'note', author: 'A' });
    const out = await unzip(await exported(s));
    expect(plugin.lastExport!.skipped).toEqual([{ id: e.id, reason: 'unreadable-part' }]);
    for (const k of ['xl/threadedComments/threadedComment1.xml', 'xl/comments1.xml', 'xl/drawings/vmlDrawing1.vml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/_rels/sheet1.xml.rels']) expect(out.get(k), k).toBe(parts.get(k));
  });
});

describe('round trip and ids (DoD 4 — the sheetpane half; DoD 5)', () => {
  it('the exported file, loaded again with this plugin: every error is back as a file note at its cell', async () => {
    const s = await storeOn(await plain());
    const { a, b, c } = review(s);
    const out = await exported(s);
    const book = await fromXlsx(out);
    expect(book.persons.map((p) => p.displayName).sort()).toEqual(['Arpit', 'Reviewer', 'S. Kapoor']);
    const again = await storeOn(out);
    const notes = again.getErrors();
    expect(notes.every((e) => e.author === 'file' && e.type === 'comment' && e.severity === 'note')).toBe(true);
    expect(notes.map((e) => [e.range, e.message])).toEqual([
      ['B2', `S. Kapoor: ${c.id} · Warning · Wrong format · Found: AC-1O044\nS. Kapoor: Should be: AC-10044`],
      ['I6', `Arpit: ${a.id} · Error · Wrong value · Found: 7.5%\nFee rate is 10× the tier & above the cap <2%>.\nArpit: Should be: 0.75%`],
      ['A14', `Reviewer: ${b.id} · Note · Duplicate row · Found: row 14\nSame as row 5.`],
    ]);
  });

  it('a second export of the same review updates its threads instead of repeating them; the review restored hides its own threads', async () => {
    const s = await storeOn(await plain());
    review(s);
    const first = await exported(s);
    const saved: SheetpaneError[] = s.getErrors();

    // the exported file comes back, with the saved review restored on top
    const s2 = await storeOn(first);
    s2.setErrors(saved);
    s2.setCell('Holdings', 'C4', 13); // any change re-runs validate
    expect(s2.getErrors().filter((e) => e.author === 'file')).toEqual([]); // its own threads are the review, not file notes
    s2.updateError(saved[0]!.id, { status: 'resolved', message: 'Fixed upstream.' });
    const second = await unzip(await exported(s2));
    const a = await unzip(first);
    const tc1 = a.get('xl/threadedComments/threadedComment1.xml')!, tc2 = second.get('xl/threadedComments/threadedComment1.xml')!;
    const ids = (x: string) => [...parseXml(x).getElementsByTagName('threadedComment')].map((t) => t.getAttribute('id'));
    expect(ids(tc2)).toEqual(ids(tc1));
    expect(tc2).toContain('Fixed upstream.');
    expect(count(second.get('xl/comments1.xml')!, /<comment\b/g)).toBe(3);
    expect(count(second.get('xl/comments1.xml')!, /<author>/g)).toBe(3);
    expect(count(second.get('xl/drawings/vmlDrawing1.vml')!, /<v:shape\b/g)).toBe(3);
    expect(count(second.get('xl/persons/person.xml')!, /<person\b/g)).toBe(3);
    expect(count(second.get('xl/worksheets/sheet1.xml')!, /<legacyDrawing\b/g)).toBe(1);
    expect([...second.keys()].sort()).toEqual([...a.keys()].sort());
    const root = [...parseXml(tc2).getElementsByTagName('threadedComment')].find((t) => t.getAttribute('id') === errorGuids(saved[0]!).comment)!;
    expect(root.getAttribute('done')).toBe('1');
  });

  it('a reply someone added in Excel to an exported thread survives the next export', async () => {
    const s = await storeOn(await plain());
    // Ids clear of ERR-0001: the store keeps a plugin error's key → id map across setErrors(), so a restored
    // error that reuses the id of a file note loaded first is taken for it (a core gap; see the W-22 report).
    for (let i = 0; i < 2; i++) s.deleteError(s.addError({ sheet: 'Holdings', range: 'A1', type: 'other', severity: 'note' }).id);
    const e = s.addError({ sheet: 'Holdings', range: 'I6', type: 'wrong-value', severity: 'error', expected: '0.75%', author: 'Arpit' });
    const parts = await unzip(await exported(s));
    // "Excel": a colleague replies to the thread
    const reply = `<threadedComment ref="I6" dT="2026-10-19T08:00:00.00" personId="{99999999-9999-4999-8999-999999999999}" id="{BBBBBBBB-0000-4000-8000-000000000001}" parentId="${errorGuids(e).comment}"><text>Agreed.</text></threadedComment>`;
    parts.set('xl/threadedComments/threadedComment1.xml', parts.get('xl/threadedComments/threadedComment1.xml')!.replace('</ThreadedComments>', `${reply}</ThreadedComments>`));
    const { writeZip } = await import('@sheetpane/export');
    const edited = await writeZip([...parts].map(([name, t]) => ({ name, data: new TextEncoder().encode(t) })));
    const s2 = await storeOn(edited);
    expect(s2.getErrors()).toEqual([expect.objectContaining({ range: 'I6', author: 'file', message: expect.stringContaining('Agreed.') })]);
    s2.setErrors([...s.getErrors()]);
    s2.setCell('Holdings', 'C4', 1);
    // the review owns the thread; only the colleague's reply is still a file note
    expect(s2.getErrors().filter((x) => x.author === 'file').map((x) => x.message)).toEqual([expect.stringMatching(/Agreed\.$/)]);
    const tc = (await unzip(await exported(s2))).get('xl/threadedComments/threadedComment1.xml')!;
    expect([...parseXml(tc).getElementsByTagName('threadedComment')].map((t) => t.getAttribute('id'))).toEqual([errorGuids(e).comment, errorGuids(e).expected, '{BBBBBBBB-0000-4000-8000-000000000001}']);
  });
});

describe('switching it off (DoD 3a)', () => {
  it('comments({ write: false }) writes nothing; the file’s notes are still read', async () => {
    const src = fromDataUrl(features);
    const s = await storeOn(src, comments({ write: false }));
    expect(s.getErrors()).toHaveLength(1);
    s.addError({ sheet: 'Holdings', range: 'B4', type: 'other', severity: 'note', author: 'Arpit' });
    const parts = await unzip(await exported(s));
    const orig = await unzip(src);
    expect([...parts.keys()]).toEqual([...orig.keys()]);
    for (const [k, v] of orig) expect(parts.get(k), k).toBe(v);
  });

  it('export({ comments: false }) skips the parts for that call only', async () => {
    const s = await storeOn(await plain());
    review(s);
    const off = await unzip(await exported(s, { comments: false }));
    expect([...off.keys()].some((k) => /threaded|comments\d|vml|person/.test(k))).toBe(false);
    const on = await unzip(await exported(s));
    expect(on.has('xl/threadedComments/threadedComment1.xml')).toBe(true);
  });

  it('a review of file notes only writes nothing', async () => {
    const src = fromDataUrl(features);
    const s = await storeOn(src);
    const parts = await unzip(await exported(s));
    expect([...parts.keys()]).toEqual([...(await unzip(src)).keys()]);
  });
});

describe('errors with no cell (W-55)', () => {
  it('a whole-sheet or workbook-level error is skipped with SP-5804, never written at A1; the cell errors are written', async () => {
    const plugin = comments();
    const s = await storeOn(await plain(), plugin);
    const cell = s.addError({ sheet: 'Holdings', range: 'I6', type: 'wrong-value', severity: 'error', expected: '0.75%', author: 'Arpit' });
    const sheet = s.addError({ sheet: 'Other', range: '', type: 'other', severity: 'error', message: 'No Pages List', author: 'Arpit' });
    const book = s.addError({ sheet: '', range: '', type: 'other', severity: 'warning', message: 'A listed tab has no sheet', author: 'Arpit' });
    const parts = await unzip(await exported(s));
    expect(plugin.lastExport).toEqual({ written: [cell.id], skipped: [{ id: sheet.id, reason: 'no-cell', code: 'SP-5804' }, { id: book.id, reason: 'no-cell', code: 'SP-5804' }] });
    const refs = [...parts].filter(([n]) => /threadedComment\d+\.xml$/.test(n)).flatMap(([, xml]) => [...parseXml(xml).getElementsByTagName('threadedComment')].map((t) => t.getAttribute('ref')));
    expect(refs).toEqual(['I6', 'I6']);
    expect([...parts.keys()].filter((n) => /threadedComment\d+\.xml$/.test(n))).toHaveLength(1); // nothing on the sheet "Other"
  });
});

describe('the host’s data on an error (W-68)', () => {
  it('meta is never written into the file — not in a comment, not anywhere in the package — and the .csv is untouched', async () => {
    const s = await storeOn(await plain());
    const marker = 'pdfsuite-crop-7f3a';
    const e = s.addError({ sheet: 'Holdings', range: 'I6', type: 'wrong-value', severity: 'error', expected: '0.75%', message: 'Fee rate', author: 'Arpit', meta: { crop: marker, page: 3 } });
    expect(e.meta).toEqual({ crop: marker, page: 3 });
    const parts = await unzip(await exported(s));
    expect([...parts.values()].some((xml) => xml.includes('Fee rate'))).toBe(true); // the error itself is written
    expect([...parts.values()].filter((xml) => xml.includes(marker) || xml.includes('"page"'))).toEqual([]);
    const csv = new TextDecoder().decode(await blobBytes((await s.exportFile({ format: 'csv' })).blob));
    expect(csv).not.toContain(marker);
  });
});

describe('accepted deviations (W-69)', () => {
  it('an accepted error is written with a reply “Accepted: <reason>” by who accepted it, at that time; its thread is done', async () => {
    const s = await storeOn(await plain());
    const a = s.addError({ sheet: 'Holdings', range: 'I6', type: 'wrong-value', severity: 'error', expected: '0.75%', message: 'Fee rate', author: 'Arpit' });
    const b = s.addError({ sheet: 'Holdings', range: 'C4', type: 'other', severity: 'note', author: 'Arpit' });
    expect(s.acceptError(a.id, 'Grandfathered rate, approved by compliance', { by: 'Ravi' })).toBe(true);
    const at = s.getErrors()[0]!.acceptedAt!;
    const parts = await unzip(await exported(s));
    const ts = [...parseXml(parts.get('xl/threadedComments/threadedComment1.xml')!).getElementsByTagName('threadedComment')];
    expect(ts.map((t) => [t.getAttribute('ref'), t.getAttribute('id'), t.getAttribute('parentId'), t.getAttribute('done'), t.textContent])).toEqual([
      ['C4', errorGuids(b).comment, null, null, `${b.id} · Note · Other · Found: 12`],
      ['I6', errorGuids(a).comment, null, '1', `${a.id} · Error · Wrong value · Found: 7.5%\nFee rate`], // done: accepted is not a problem
      ['I6', errorGuids(a).expected, errorGuids(a).comment, null, 'Should be: 0.75%'],
      ['I6', errorGuids(a).accepted, errorGuids(a).comment, null, 'Accepted: Grandfathered rate, approved by compliance'],
    ]);
    expect(ts[3]!.getAttribute('personId')).toBe(personGuid('Ravi'));
    expect(ts[3]!.getAttribute('dT')).toBe(at.replace(/(\.\d{2})\d*Z$/, '$1'));
    expect([...parseXml(parts.get('xl/persons/person.xml')!).getElementsByTagName('person')].map((p) => p.getAttribute('displayName')).sort()).toEqual(['Arpit', 'Ravi']);
    expect(parts.get('xl/comments1.xml')).toContain('Reply:\n    Accepted: Grandfathered rate, approved by compliance');
  });
  it('nobody named: the reply is the error author’s; reopened, a second export drops the reply; the reading side skips it', async () => {
    const plugin = comments();
    const s = await storeOn(await plain(), plugin);
    const a = s.addError({ sheet: 'Holdings', range: 'I6', type: 'wrong-value', severity: 'error', author: 'Arpit' });
    s.acceptError(a.id, 'Known');
    let parts = await unzip(await exported(s));
    let ts = [...parseXml(parts.get('xl/threadedComments/threadedComment1.xml')!).getElementsByTagName('threadedComment')];
    expect(ts.map((t) => [t.getAttribute('id'), t.getAttribute('personId')])).toEqual([[errorGuids(a).comment, personGuid('Arpit')], [errorGuids(a).accepted, personGuid('Arpit')]]);
    // the exported file read back: our own entries are not file comments
    const back = await storeOn(await exported(s), plugin);
    back.setErrors(s.getErrors());
    expect(back.getErrors().filter((e) => e.author === 'file')).toEqual([]);
    expect(back.getErrors()[0]).toMatchObject({ status: 'accepted', reason: 'Known' });
    back.updateError(a.id, { status: 'open' });
    parts = await unzip(await exported(back));
    ts = [...parseXml(parts.get('xl/threadedComments/threadedComment1.xml')!).getElementsByTagName('threadedComment')];
    expect(ts.map((t) => [t.getAttribute('id'), t.getAttribute('done')])).toEqual([[errorGuids(a).comment, null]]);
  });
});
