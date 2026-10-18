import { describe, expect, it } from 'vitest';
import { createWorkbook } from '@sheetpane/grid';
import features from '../../import/test/fixtures/exceljs-features.xlsx?inline';
import { comments, errorGuids, uuidv5 } from '../src/index.js';
import { fromDataUrl, workbook } from './helpers.js';

const P1 = '{11111111-1111-4111-8111-111111111111}', P2 = '{22222222-2222-4222-8222-222222222222}';
const T1 = '{AAAAAAAA-0000-4000-8000-000000000001}', T2 = '{AAAAAAAA-0000-4000-8000-000000000002}', T3 = '{AAAAAAAA-0000-4000-8000-000000000003}';

const threaded = () => workbook({
  persons: [{ id: P1, displayName: 'R. Mehta' }, { id: P2, displayName: 'S. Kapoor' }],
  sheets: [{
    name: 'Holdings', cells: { A1: 'Account', H3: 1200, D9: 'TIPS', B2: 'x' },
    threads: [
      { id: T1, ref: 'H3', personId: P1, text: 'Includes 200 units transferred in on 28-Sep.' },
      { id: T2, ref: 'H3', personId: P2, parentId: T1, text: 'Confirmed with ops.' },
      { id: T3, ref: 'H3', personId: P1, parentId: T1, text: 'Thanks.' },
    ],
    notes: [{ ref: 'D9', author: 'R. Mehta', text: 'R. Mehta:\nInflation-linked; units revised quarterly.' }],
  }],
});

describe('GUIDs (DoD 5)', () => {
  it('uuidv5 is RFC 4122 version 5 (the RFC’s own www.example.com vector)', () => {
    expect(uuidv5('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'www.example.com')).toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2');
  });
  it('an error’s ids are stable, in Excel’s {…} form, and differ between reviews that reuse ERR-0001', () => {
    const a = errorGuids({ id: 'ERR-0001', createdAt: '2026-10-18T09:12:00.000Z' });
    expect(a).toEqual(errorGuids({ id: 'ERR-0001', createdAt: '2026-10-18T09:12:00.000Z' }));
    expect(a.comment).toMatch(/^\{[0-9A-F]{8}-[0-9A-F]{4}-5[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}\}$/);
    expect(a.comment).toBe('{B465D0FA-9701-5C2D-986B-743668F1591E}'); // Python: uuid5(uuid5(NAMESPACE_URL, 'https://github.com/arpitarya/sheetpane#comments'), name)
    expect(a.expected).not.toBe(a.comment);
    expect(errorGuids({ id: 'ERR-0001', createdAt: '2026-10-19T08:00:00.000Z' }).comment).not.toBe(a.comment);
  });
});

describe('reading (DoD 2)', () => {
  it('the ExcelJS fixture’s note at A3 lands as one read-only file note', async () => {
    const s = createWorkbook({ plugins: [comments()] });
    await s.load(fromDataUrl(features), 'features.xlsx');
    expect(s.getErrors()).toEqual([expect.objectContaining({
      sheet: 'Holdings', range: 'A3', type: 'comment', severity: 'note', author: 'file', status: 'open',
      found: 'AC-10021', expected: '', message: 'Author: Checked against the custodian file.',
    })]);
  });

  it('a thread is one note: the comment, then the replies in order, each led by its person; Excel’s placeholder note is not a second one', async () => {
    const s = createWorkbook({ plugins: [comments()] });
    await s.load(await threaded(), 'threads.xlsx');
    const es = s.getErrors();
    expect(es).toHaveLength(2);
    expect(es[0]).toMatchObject({
      range: 'H3', type: 'comment', severity: 'note', author: 'file', found: '1200', status: 'open',
      message: 'R. Mehta: Includes 200 units transferred in on 28-Sep.\nS. Kapoor: Confirmed with ops.\nR. Mehta: Thanks.',
    });
    // a note whose text already leads with its author is not signed twice
    expect(es[1]).toMatchObject({ range: 'D9', found: 'TIPS', message: 'R. Mehta:\nInflation-linked; units revised quarterly.' });
  });

  it('file notes are never resolved by an edit, and are not re-added', async () => {
    const s = createWorkbook({ plugins: [comments()] });
    await s.load(await threaded(), 'threads.xlsx');
    const before = s.getErrors();
    s.setCell('Holdings', 'H3', '999');
    s.setCell('Holdings', 'D9', '');
    expect(s.getErrors()).toEqual(before);
  });

  it('a blank commented cell reads (blank)', async () => {
    const s = createWorkbook({ plugins: [comments()] });
    await s.load(await workbook({ sheets: [{ name: 'S', cells: { A1: 1 }, notes: [{ ref: 'C5', author: '', text: 'look here' }] }] }), 'n.xlsx');
    expect(s.getErrors()).toEqual([expect.objectContaining({ range: 'C5', found: '(blank)', message: 'look here' })]);
  });
});
