import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { cellRef, toXlsx } from '@sheetpane/export';
import { read } from '@sheetpane/import';
import { createWorkbook, errorScope, isLayerName, layerOf, type SheetpaneError, type StoreEvent, formulaRefs, parseInput, ERROR_META_MAX, HISTORY_CAP, type Plugin } from '../src/index.js';
import { sampleCsv, sampleXlsx, until } from './helpers.js';
import { minimalPackage } from '../../export/test/helpers.js';

async function loaded(data?: Uint8Array, name = 'sample.xlsx') {
  const s = createWorkbook();
  await s.load(data ?? (await sampleXlsx()), name);
  return s;
}

describe('the store: loading and reading', () => {
  it('loads the sample, selects A1 of the active sheet, holds the upload untouched', async () => {
    const bytes = await sampleXlsx();
    const copy = bytes.slice();
    const s = await loaded(bytes);
    const snap = s.getSnapshot();
    expect(snap.load.status).toBe('ready');
    expect(snap.selection).toEqual({ sheet: 'Holdings', ref: 'A1' });
    expect(s.text('Holdings', 'G7')).toBe('286.4');
    expect(s.value('Holdings', 'F3')).toBe(1200);
    expect(snap.source!.bytes).toEqual(copy);
  });
  it('puts a refusal into the load state, with the reader’s code', async () => {
    const s = createWorkbook();
    await s.load(new Uint8Array([1, 2, 3]), 'old.xls');
    expect(s.getSnapshot().load).toMatchObject({ status: 'error', code: 'unsupported-format', name: 'old.xls' });
  });
  it('the load state carries the SP code beside the reader’s code, and the human message without it (W-40)', async () => {
    const s = createWorkbook();
    await s.load(new Uint8Array([1, 2, 3]), 'old.xls');
    expect(s.getSnapshot().load).toMatchObject({ status: 'error', code: 'unsupported-format', spCode: 'SP-1001', message: '"old.xls" is a .xls file — sheetpane opens .xlsx and .csv only' });
    s.failLoad('x.xlsx', 'could not read x.xlsx (HTTP 404)');
    expect(s.getSnapshot().load).toMatchObject({ status: 'error', code: 'unreadable', spCode: 'SP-3015' });
    await expect(createWorkbook().exportFile()).rejects.toMatchObject({ code: 'SP-3001', spCode: 'SP-3001' });
  });
});

describe('cell changes (SR-LAW-6)', () => {
  it('parses typed text as the cell stores it', () => {
    expect(parseInput('1,234.5', 1, 'xlsx')).toBe(1234.5);
    expect(parseInput('12', null, 'xlsx')).toBe(12);
    expect(parseInput('12', 'x', 'xlsx')).toBe('12');
    expect(parseInput('TRUE', false, 'xlsx')).toBe(true);
    expect(parseInput('12', '7', 'csv')).toBe('12');
    expect(parseInput('', 'x', 'xlsx')).toBeNull();
  });
  it('holds a change with was/now, reverts, and clears when the original is typed back', async () => {
    const s = await loaded();
    expect(s.setCell('Holdings', 'G7', '268.40')).toBe(true);
    expect(s.changeOf('Holdings', 'G7')).toEqual({ kind: 'value', was: 286.4, now: 268.4 });
    expect(s.text('Holdings', 'G7')).toBe('268.4');
    expect(s.changeCount).toBe(1);
    s.setCell('Holdings', 'G7', '286.4');
    expect(s.changeCount).toBe(0);
    s.setCell('Holdings', 'A8', 'AC-10044');
    s.revert('Holdings', 'A8');
    expect(s.text('Holdings', 'A8')).toBe('AC-1O044');
    expect(s.setCell('Holdings', 'A8', 'AC-1O044')).toBe(false);
  });
  it('emits one change event per action, with was and now', async () => {
    const s = await loaded();
    const seen: unknown[] = [];
    s.on((e) => { if (e.type === 'change') seen.push([e.sheet, e.ref, e.was, e.now]); });
    s.setCell('Holdings', 'I6', '0.75%');
    expect(seen).toEqual([['Holdings', 'I6', '7.5%', '0.75%']]);
  });
});

describe('undo / redo (W-23)', () => {
  it('undoes and redoes changes and errors on one stack; typing in one cell is one step', async () => {
    const s = await loaded();
    s.setCell('Holdings', 'B3', 'R', { coalesce: true });
    s.setCell('Holdings', 'B3', 'R. M', { coalesce: true });
    s.setCell('Holdings', 'B3', 'R. Mehra', { coalesce: true });
    s.endCoalesce();
    const e = s.addError({ sheet: 'Holdings', range: 'A8', type: 'wrong-format', severity: 'warning', expected: 'AC-10044' });
    expect(s.getSnapshot().canUndo).toBe(true);
    s.undo();
    expect(s.getErrors()).toEqual([]);
    expect(s.text('Holdings', 'B3')).toBe('R. Mehra');
    s.undo();
    expect(s.text('Holdings', 'B3')).toBe('R. Mehta');
    expect(s.getSnapshot().canUndo).toBe(false);
    s.redo(); s.redo();
    expect(s.getErrors().map((x) => x.id)).toEqual([e.id]);
    const e2 = s.addError({ sheet: 'Holdings', range: 'A9', type: 'other', severity: 'note' });
    expect(e2.id).not.toBe(e.id); // ids are never reused
    expect(s.getSnapshot().canRedo).toBe(false);
  });
  it('returns to the starting state after any sequence of mutations and as many undos (property)', async () => {
    const s0 = await loaded();
    const start = { changes: s0.getSnapshot().changes, errors: s0.getSnapshot().errors };
    const action = fc.oneof(
      fc.record({ k: fc.constant('cell'), ref: fc.constantFrom('A3', 'B4', 'G7', 'K20'), v: fc.constantFrom('x', '1', '', '286.4') }),
      fc.record({ k: fc.constant('err'), ref: fc.constantFrom('A3', 'G7') }),
      fc.record({ k: fc.constant('resolve') }),
      fc.record({ k: fc.constant('freeze'), n: fc.integer({ min: 0, max: 3 }) }),
    );
    await fc.assert(fc.asyncProperty(fc.array(action, { maxLength: 12 }), async (acts) => {
      const s = await loaded();
      let steps = 0;
      for (const a of acts) {
        const before = s.getSnapshot().version;
        if (a.k === 'cell') s.setCell('Holdings', a.ref, a.v);
        else if (a.k === 'err') s.addError({ sheet: 'Holdings', range: a.ref, type: 'other', severity: 'note', expected: 'x', cellChanged: true });
        else if (a.k === 'resolve') { const e = s.getErrors()[0]; if (e) s.updateError(e.id, { status: e.status === 'open' ? 'resolved' : 'open' }); }
        else s.setFreeze('Holdings', { rows: a.n, cols: 0 });
        if (s.getSnapshot().version !== before) steps++;
      }
      for (let i = 0; i < steps; i++) s.undo();
      expect([...s.getSnapshot().changes]).toEqual([...start.changes]);
      expect(s.getErrors()).toEqual([...start.errors]);
    }), { seed: 8, numRuns: 40 });
  });
  it('caps the stack at 500 entries', async () => {
    const s = await loaded();
    for (let i = 0; i < HISTORY_CAP + 20; i++) s.setCell('Holdings', 'A3', `v${i}`);
    let n = 0;
    while (s.getSnapshot().canUndo) { s.undo(); n++; }
    expect(n).toBe(HISTORY_CAP);
  });
});

describe('errors (contract verdict decisions 5–8)', () => {
  it('freezes found as the uploaded text, numbers ERR-0001…, never resolves on a matching edit', async () => {
    const s = await loaded();
    const e = s.addError({ sheet: 'Holdings', range: 'G7', type: 'mismatch-source', severity: 'error', expected: '268.4', message: 'transposed', author: 'Arpit' });
    expect(e).toMatchObject({ v: 1, id: 'ERR-0001', found: '286.4', expected: '268.4', status: 'open', matchesExpected: false, author: 'Arpit', cellChanged: false });
    s.setCell('Holdings', 'G7', '268.4');
    const after = s.getErrors()[0]!;
    expect(after).toMatchObject({ status: 'open', matchesExpected: true, found: '286.4' });
    expect(s.addError({ sheet: 'Holdings', range: 'C11', type: 'missing-value', severity: 'warning' }).found).toBe('(blank)');
  });
  it('"Also change the cell" writes the fix in; deleting the error keeps the change', async () => {
    const s = await loaded();
    const e = s.addError({ sheet: 'Holdings', range: 'I6', type: 'wrong-value', severity: 'error', expected: '0.75%', cellChanged: true });
    expect(s.text('Holdings', 'I6')).toBe('0.75%');
    expect(s.getErrors()[0]!.matchesExpected).toBe(true);
    s.deleteError(e.id);
    expect(s.text('Holdings', 'I6')).toBe('0.75%');
    expect(s.changeCount).toBe(1);
  });
  it('restores a saved review with setErrors, clears history, tags a moved cell stale', async () => {
    const s = await loaded();
    s.setCell('Holdings', 'A3', 'x');
    const saved = [{ v: 1 as const, id: 'ERR-0007', sheet: 'Holdings', range: 'G7', type: 'other', severity: 'note' as const, found: '999', expected: '', message: '', cellChanged: false, status: 'open' as const, matchesExpected: false, author: '', createdAt: '2026-10-18T09:00:00Z' }];
    s.setErrors(saved);
    expect(s.getSnapshot().canUndo).toBe(false);
    expect(s.isStale(s.getErrors()[0]!)).toBe(true);
    expect(s.addError({ sheet: 'Holdings', range: 'A3', type: 'other', severity: 'note' }).id).toBe('ERR-0008');
  });
});

describe('export carries every change (SR-LAW-6, B-017)', () => {
  it('.xlsx: patched, read back with the change; everything else as uploaded', async () => {
    const s = await loaded();
    s.setCell('Holdings', 'G7', '268.4');
    s.setCell('Fee tiers', 'D4', '0.45%');
    const r = await s.exportFile();
    expect(r.kind).toBe('xlsx');
    const back = await read(new Uint8Array(await r.blob.arrayBuffer()), { name: 'x.xlsx' });
    expect(back.sheets[0]!.rows[6]![6]).toBe(268.4);
    expect(back.sheets[1]!.rows[3]![3]).toBe('0.45%');
    expect(back.sheets[0]!.merges).toEqual(['A1:J1']);
  });
  it('.csv: the sheet with its changes, same delimiter', async () => {
    const s = await loaded(new TextEncoder().encode('a;b\n1;2\n'), 'semi.csv');
    s.setCell('semi', 'B2', '3');
    const r = await s.exportFile();
    expect(r.kind).toBe('csv');
    expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(await r.blob.arrayBuffer())).toBe('﻿a;b\r\n1;3\r\n');
  });
  it('round-trips: edits exported and loaded again are all there (property)', async () => {
    await fc.assert(fc.asyncProperty(fc.array(fc.tuple(fc.integer({ min: 0, max: 8 }), fc.integer({ min: 0, max: 6 }), fc.stringMatching(/^[a-z]{1,5}$/)), { maxLength: 8 }), async (edits) => {
      const s = await loaded(await toXlsx({ sheets: [{ name: 'S', rows: [['a', 1], [2, 'b']] }] }));
      const want = new Map<string, string>();
      for (const [r, c, v] of edits) { const ref = String.fromCharCode(65 + c) + (r + 1); s.setCell('S', ref, v); want.set(ref, v); }
      const back = createWorkbook();
      await back.load(new Uint8Array(await (await s.exportFile()).blob.arrayBuffer()), 'S.xlsx');
      for (const [ref, v] of want) expect(back.text('S', ref)).toBe(v);
    }), { seed: 9, numRuns: 25 });
  });
  it('writes a changed freeze as <pane>', async () => {
    const s = await loaded();
    s.setFreeze('Holdings', { rows: 2, cols: 1 });
    const back = await read(new Uint8Array(await (await s.exportFile()).blob.arrayBuffer()), { name: 'x.xlsx' });
    expect(back.sheets[0]!.freeze).toEqual({ rows: 2, cols: 1 });
  });
});

describe('stale formula marks without a formulas plugin (W-01 DoD 15)', () => {
  it('reads the ranges a formula refers to', () => {
    expect(formulaRefs('SUM(B2:B9)*$C$1+\'Fee tiers\'!D3+Sheet2!A:A+"A1"', 'S').map((r) => r.sheet)).toEqual(['S', 'S', 'Fee tiers', 'Sheet2']);
  });
  it('marks a formula cell that reads a changed cell, and nothing else', async () => {
    const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const s = await loaded(minimalPackage(`<worksheet xmlns="${NS}"><sheetData><row r="1"><c r="A1"><v>2</v></c><c r="B1"><f>A1*2</f><v>4</v></c><c r="C1"><f>5*2</f><v>10</v></c></row></sheetData></worksheet>`), 'f.xlsx');
    expect(s.mayBeStale('Data', 'B1')).toBe(false);
    s.setCell('Data', 'A1', '3');
    expect(s.mayBeStale('Data', 'B1')).toBe(true);
    expect(s.mayBeStale('Data', 'C1')).toBe(false);
  });
});

describe('a CSV upload', () => {
  it('keeps every cell as text', async () => {
    const s = await loaded(sampleCsv(), 'holdings.csv');
    s.setCell('holdings', 'F2', '1300');
    expect(s.value('holdings', 'F2')).toBe('1300');
  });
});

describe('errors with no cell (W-55)', () => {
  it('range "" is the whole sheet and sheet "" the workbook: found "", never stale, never matched, round-trips', async () => {
    const s = await loaded();
    const sh = s.addError({ sheet: 'Fee tiers', range: '', type: 'other', severity: 'error', expected: 'a Pages List sheet', message: 'No Pages List', cellChanged: true });
    const wb = s.addError({ sheet: '', range: '', type: 'other', severity: 'warning', message: 'A listed tab has no sheet' });
    const cell = s.addError({ sheet: 'Holdings', range: 'G7', type: 'wrong-value', severity: 'error', expected: '268.4' });
    expect([sh, wb, cell].map(errorScope)).toEqual(['sheet', 'workbook', 'cell']);
    expect(sh).toMatchObject({ sheet: 'Fee tiers', range: '', found: '', cellChanged: true, matchesExpected: false });
    expect(wb).toMatchObject({ sheet: '', range: '', found: '' });
    expect(cell.found).toBe('286.4'); // existing errors unaffected
    expect(s.exportChanges().length).toBe(0); // "Also change the cell" has no cell to change
    expect(s.isStale(sh)).toBe(false);
    expect(s.isStale(wb)).toBe(false);
    s.undo();
    s.undo();
    expect(s.getErrors().map((e) => e.id)).toEqual([sh.id]);
    s.redo(); s.redo();
    const saved = s.getErrors();
    const t = await loaded();
    t.setErrors(saved);
    expect(t.getErrors()).toEqual(saved);
  });
  it('a validate draft may be about a whole sheet; it resolves itself when it goes', async () => {
    let missing = true;
    const p: Plugin = { id: 'sheets', provides: ['validate'], validate: (sheet) => (missing && sheet === 'Fee tiers' ? [{ sheet, range: '', type: 'other', severity: 'error', found: '', expected: '', message: 'No Pages List', author: 'host' }] : []) };
    const s = createWorkbook({ plugins: [p] });
    await s.load(await sampleXlsx(), 'sample.xlsx');
    expect(s.getErrors()).toMatchObject([{ sheet: 'Fee tiers', range: '', status: 'open', author: 'host' }]);
    missing = false;
    s.setCell('Fee tiers', 'A1', 'x');
    expect(s.getErrors()).toMatchObject([{ sheet: 'Fee tiers', range: '', status: 'resolved' }]);
  });
});

describe('the host’s data on an error (W-68)', () => {
  const crop = { pdf: 'spec.pdf', page: 3, box: [72, 144, 288, 216], measured: '6.63 in', expected: '6.50 in ± 0.06 in', ok: false, note: null };
  it('meta is kept as JSON: added, read as a copy, round-tripped through a saved review', async () => {
    const s = await loaded();
    const e = s.addError({ sheet: 'Holdings', range: 'G7', type: 'wrong-value', severity: 'error', meta: crop });
    expect(e.meta).toEqual(crop);
    const read = s.getErrors()[0]!;
    (read.meta as { page: number }).page = 99; // a copy: the host may change what it reads
    expect(s.getErrors()[0]!.meta).toEqual(crop);
    const saved = JSON.parse(JSON.stringify({ errors: s.getErrors() })) as { errors: ReturnType<typeof s.getErrors> };
    const t = await loaded();
    t.setErrors(saved.errors);
    expect(t.getErrors()).toEqual(s.getErrors());
    (saved.errors[0]!.meta as { page: number }).page = 7; // and setErrors keeps its own copy
    expect(t.getErrors()[0]!.meta).toEqual(crop);
    // an error with no meta has no meta key: v1 unchanged
    expect('meta' in s.addError({ sheet: 'Holdings', range: 'A8', type: 'other', severity: 'note' })).toBe(false);
  });
  it('meta is kept as its JSON round trip: a Date becomes its text, a function inside an object goes', async () => {
    const s = await loaded();
    const at = new Date('2026-10-19T10:00:00Z');
    const e = s.addError({ sheet: 'Holdings', range: 'G7', type: 'other', severity: 'note', meta: { at, f: (() => 1) as unknown as string } as never });
    expect(e.meta).toEqual({ at: '2026-10-19T10:00:00.000Z' });
  });
  it('updateError sets, replaces and removes meta, as one undo step each', async () => {
    const s = await loaded();
    const e = s.addError({ sheet: 'Holdings', range: 'G7', type: 'other', severity: 'note' });
    s.updateError(e.id, { meta: crop });
    expect(s.getErrors()[0]!.meta).toEqual(crop);
    s.updateError(e.id, { meta: { measured: '6.70 in' } });
    expect(s.getErrors()[0]!.meta).toEqual({ measured: '6.70 in' });
    s.updateError(e.id, { meta: undefined });
    expect('meta' in s.getErrors()[0]!).toBe(false);
    s.undo();
    expect(s.getErrors()[0]!.meta).toEqual({ measured: '6.70 in' });
    s.undo();
    expect(s.getErrors()[0]!.meta).toEqual(crop);
  });
  it('a meta over the cap, or not JSON, is dropped with SP-3016 — the error is kept', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const s = await loaded();
      const at = { blob: 'x'.repeat(ERROR_META_MAX - 11) }; // {"blob":"…"} is exactly the cap
      expect(JSON.stringify(at).length).toBe(ERROR_META_MAX);
      expect(s.addError({ sheet: 'Holdings', range: 'G7', type: 'other', severity: 'note', meta: at }).meta).toEqual(at);
      expect(warn).not.toHaveBeenCalled();
      const over = s.addError({ sheet: 'Holdings', range: 'A8', type: 'other', severity: 'note', meta: { blob: 'é'.repeat(ERROR_META_MAX / 2) } }); // 2 bytes each in UTF-8
      expect('meta' in over).toBe(false);
      expect(warn).toHaveBeenLastCalledWith(expect.stringMatching(/^SP-3016: Error meta dropped — ERR-\d+: its meta is \d+ bytes of JSON, over the 65536-byte cap/));
      const loop: Record<string, unknown> = {};
      loop.self = loop;
      s.setErrors([...s.getErrors(), { ...over, id: 'ERR-0100', meta: loop as never }]);
      expect('meta' in s.getErrors().find((e) => e.id === 'ERR-0100')!).toBe(false);
      expect(warn).toHaveBeenLastCalledWith(expect.stringMatching(/^SP-3016: .*ERR-0100: its meta is not JSON/));
      s.updateError(s.getErrors()[0]!.id, { meta: { n: 10n } as never }); // a BigInt: refused, the error keeps its own
      expect(s.getErrors()[0]!.meta).toEqual(at);
      expect(warn).toHaveBeenCalledTimes(3);
    } finally { warn.mockRestore(); }
  });
});

describe('accepted deviations (W-69)', () => {
  it('acceptError records who, when and why; the error stays, no longer open; one undo step', async () => {
    const s = await loaded();
    const e = s.addError({ sheet: 'Holdings', range: 'G7', type: 'out-of-range', severity: 'error', author: 'Asha' });
    const before = Date.now();
    expect(s.acceptError(e.id, '  Approved by the customer: 6.63 in is within their tolerance  ', { by: 'Ravi' })).toBe(true);
    const a = s.getErrors()[0]!;
    expect(a).toMatchObject({ id: e.id, status: 'accepted', acceptedBy: 'Ravi', reason: 'Approved by the customer: 6.63 in is within their tolerance', author: 'Asha' });
    expect(Date.parse(a.acceptedAt!)).toBeGreaterThanOrEqual(before - 1000);
    expect(s.getErrors().filter((x) => x.status === 'open')).toHaveLength(0);
    s.undo();
    expect(s.getErrors()[0]).toEqual(e); // back to open, with no acceptance fields
    s.redo();
    expect(s.getErrors()[0]).toEqual(a);
  });
  it('a reason is required: a blank one is refused with SP-3018 and nothing changes', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const s = await loaded();
      const e = s.addError({ sheet: 'Holdings', range: 'G7', type: 'other', severity: 'warning' });
      expect(s.acceptError(e.id, '   ')).toBe(false);
      expect(s.updateError(e.id, { status: 'accepted' })).toBe(false); // the generic path needs one too
      expect(s.getErrors()[0]).toEqual(e);
      expect(s.getSnapshot().canUndo).toBe(true); // only the add is on the stack
      s.undo();
      expect(s.getErrors()).toEqual([]);
      expect(warn).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenLastCalledWith(expect.stringMatching(/^SP-3018: Error not accepted — ERR-\d+: no reason was given/));
      expect(s.acceptError('ERR-9999', 'no such error')).toBe(false); // an unknown id: nothing to accept, nothing logged
      expect(warn).toHaveBeenCalledTimes(2);
    } finally { warn.mockRestore(); }
  });
  it('reopening or resolving drops who, when and why; a later accept stamps a new time', async () => {
    const s = await loaded();
    const e = s.addError({ sheet: 'Holdings', range: 'G7', type: 'other', severity: 'note' });
    s.acceptError(e.id, 'Known', { by: 'Ravi' });
    s.updateError(e.id, { status: 'open' });
    expect(s.getErrors()[0]).toEqual(e);
    s.acceptError(e.id, 'Known');
    expect(s.getErrors()[0]).toMatchObject({ status: 'accepted', acceptedBy: '', reason: 'Known' });
    s.updateError(e.id, { status: 'resolved' });
    expect(['acceptedBy', 'acceptedAt', 'reason'].some((k) => k in s.getErrors()[0]!)).toBe(false);
  });
  it('the workbook’s own errors (author workbook or file) are not accepted here — B-029', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const s = await loaded();
      s.setErrors([{ v: 1, id: 'ERR-0001', sheet: 'Holdings', range: 'B2', type: 'comment', severity: 'note', found: 'x', expected: '', message: 'Asha: check', cellChanged: false, status: 'open', matchesExpected: false, author: 'file', createdAt: '2026-10-19T08:00:00.000Z' }]);
      expect(s.acceptError('ERR-0001', 'fine')).toBe(false);
      expect(s.getErrors()[0]!.status).toBe('open');
      expect(warn).toHaveBeenLastCalledWith(expect.stringMatching(/^SP-3018: .*ERR-0001.*author "file"/));
    } finally { warn.mockRestore(); }
  });
  it('restore: an old envelope reads as before; an accepted error keeps its fields; one with no reason comes back open (SP-3018)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const s = await loaded();
      const base = { v: 1 as const, sheet: 'Holdings', range: 'G7', type: 'other', severity: 'warning' as const, found: '286.4', expected: '', message: '', cellChanged: false, matchesExpected: false, author: 'Asha', createdAt: '2026-10-18T09:00:00.000Z' };
      // a review saved before W-69: open and resolved, no acceptance fields
      const old = [{ ...base, id: 'ERR-0001', status: 'open' as const }, { ...base, id: 'ERR-0002', range: 'A8', found: '(blank)', status: 'resolved' as const }];
      s.setErrors(old);
      expect(s.getErrors()).toEqual(old.map((e) => ({ ...e, layer: 'review' }))); // W-51: as before, in the review layer
      const accepted = { ...base, id: 'ERR-0003', status: 'accepted' as const, acceptedBy: 'Ravi', acceptedAt: '2026-10-19T10:00:00.000Z', reason: 'Approved deviation' };
      const noReason = { ...base, id: 'ERR-0004', range: 'A9', found: '(blank)', status: 'accepted' as const, acceptedBy: 'Ravi', acceptedAt: '2026-10-19T10:00:00.000Z' };
      const stray = { ...base, id: 'ERR-0005', range: 'A10', found: '(blank)', status: 'open' as const, reason: 'left over' };
      s.setErrors([accepted, noReason, stray]);
      const got = s.getErrors();
      expect(got[0]).toEqual({ ...accepted, layer: 'review' });
      expect(got[1]).toEqual({ ...base, id: 'ERR-0004', range: 'A9', found: '(blank)', status: 'open', layer: 'review' });
      expect(got[2]).toEqual({ ...base, id: 'ERR-0005', range: 'A10', found: '(blank)', status: 'open', layer: 'review' }); // fields with no acceptance are dropped
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenLastCalledWith(expect.stringMatching(/^SP-3018: .*ERR-0004: no reason was given, so it was restored as open/));
      // and the round trip through JSON keeps an accepted error as it was
      const t = await loaded();
      t.setErrors(JSON.parse(JSON.stringify(s.getErrors())));
      expect(t.getErrors()).toEqual(s.getErrors());
    } finally { warn.mockRestore(); }
  });
  it('a host rule’s error stays accepted while the cell fails the same way; a new finding reopens it and a pass resolves it, each without the acceptance', async () => {
    const s = createWorkbook();
    s.setColumnRules({ columns: { Age: { type: 'integer', min: 18 } } });
    await s.load(new TextEncoder().encode('Name,Age\nBo,17\nCy,20'), 'people.csv');
    await until(() => !s.ruleProgress);
    const at = () => s.getErrors().find((e) => e.author === 'host' && e.range === 'B2')!;
    expect(at()).toMatchObject({ status: 'open', found: '17' });
    expect(s.acceptError(at().id, 'A minor with a guardian’s consent', { by: 'Ravi' })).toBe(true);
    s.setCell(s.getSnapshot().selection.sheet, 'A3', 'Cyd'); // an unrelated edit re-runs the rules
    expect(at()).toMatchObject({ status: 'accepted', reason: 'A minor with a guardian’s consent' });
    s.setCell(s.getSnapshot().selection.sheet, 'B2', '16'); // fails differently: the acceptance was for 17
    expect(at().status).toBe('open');
    expect(['acceptedBy', 'acceptedAt', 'reason'].some((k) => k in at())).toBe(false);
    s.acceptError(at().id, 'Still fine');
    s.setCell(s.getSnapshot().selection.sheet, 'B2', '30'); // passes: resolved like an open one
    expect(at().status).toBe('resolved');
    expect(['acceptedBy', 'acceptedAt', 'reason'].some((k) => k in at())).toBe(false);
  });
});

describe('review layers (W-51)', () => {
  const finding = (id: string, range: string, o: Partial<SheetpaneError> = {}): SheetpaneError => ({ v: 1, id, sheet: 'Holdings', range, type: 'other', severity: 'warning', found: '', expected: '', message: `${id} at ${range}`, cellChanged: false, status: 'open', matchesExpected: false, author: 'checker', createdAt: '2026-10-19T09:00:00.000Z', ...o });
  // a provider that names its layer: a negative unit is a "checks" finding
  const checks: Plugin = { id: 'checks', provides: ['validate'], validate: (sheet, ctx) => {
    if (sheet !== 'Holdings') return [];
    const out = [];
    for (let r = 2; r < 15; r++) { const ref = cellRef(r, 5); const v = ctx.store.value(sheet, ref); if (typeof v === 'number' && v < 0) out.push({ sheet, range: ref, type: 'validation', severity: 'warning' as const, found: String(v), expected: '≥ 0', message: 'Units must be positive', author: 'workbook', layer: 'checks' }); }
    return out;
  } };

  it('names: 1–64 characters, no spaces; layerOf reads review when none is given', () => {
    expect(['pdf', 'validation', 'a'.repeat(64)].every(isLayerName)).toBe(true);
    expect(['', 'PDF check', 'a'.repeat(65), 3, null, undefined].some(isLayerName)).toBe(false);
    expect(layerOf({})).toBe('review');
    expect(layerOf({ layer: 'pdf' })).toBe('pdf');
  });

  it('every error carries a layer; setErrors(list, { layer }) replaces that layer only; getErrors({ layer }) reads one', async () => {
    const s = await loaded();
    const mine = s.addError({ sheet: 'Holdings', range: 'G7', type: 'other', severity: 'note', author: 'Asha' });
    expect(mine.layer).toBe('review');
    s.setErrors([finding('V-1', 'C3'), finding('V-2', 'C4')], { layer: 'validation' });
    s.setErrors([finding('P-1', 'D5', { layer: 'ignored' })], { layer: 'pdf' }); // the option wins over the error's own
    expect(s.getSnapshot().layers).toEqual(['review', 'validation', 'pdf']);
    expect(s.getErrors({ layer: 'validation' }).map((e) => [e.id, e.layer])).toEqual([['V-1', 'validation'], ['V-2', 'validation']]);
    expect(s.getErrors({ layer: 'pdf' }).map((e) => [e.id, e.layer])).toEqual([['P-1', 'pdf']]);
    // replacing validation leaves pdf and review as they were — and an empty layer is still a layer
    s.setErrors([], { layer: 'validation' });
    expect(s.getErrors({ layer: 'validation' })).toEqual([]);
    expect(s.getErrors().map((e) => e.id)).toEqual([mine.id, 'P-1']);
    expect(s.getSnapshot().layers).toEqual(['review', 'validation', 'pdf']);
    expect(s.getErrors({ layer: 'nothing-here' })).toEqual([]);
  });

  it('the errors event names the layers that changed; the envelope is v2 with every layer', async () => {
    const s = await loaded();
    const seen: string[][] = [];
    s.on((e: StoreEvent) => { if (e.type === 'errors') seen.push(e.layers ?? []); });
    s.setErrors([finding('P-1', 'D5')], { layer: 'pdf' });
    const e = s.addError({ sheet: 'Holdings', range: 'G7', type: 'other', severity: 'note' });
    s.updateError('P-1', { status: 'resolved' });
    s.deleteError(e.id);
    s.undo();
    expect(seen).toEqual([['pdf'], ['review'], ['pdf'], ['review'], ['review']]);
    expect(s.envelope(['pdf'])).toMatchObject({ v: 2, plugins: [], layers: ['pdf', 'review'], changed: ['pdf'] });
    expect(s.envelope().errors.map((x) => x.layer)).toEqual(['pdf', 'review']);
  });

  it('ids stay unique across layers: one another layer holds, or a blank one, gets a new id past the counter', async () => {
    const s = await loaded();
    const mine = s.addError({ sheet: 'Holdings', range: 'G7', type: 'other', severity: 'note' }); // ERR-0001
    s.setErrors([finding('ERR-0001', 'D5'), finding('', 'D6'), finding('ERR-0040', 'D7')], { layer: 'pdf' });
    const pdf = s.getErrors({ layer: 'pdf' }).map((e) => e.id);
    expect(pdf).toEqual(['ERR-0041', 'ERR-0042', 'ERR-0040']);
    expect(s.getErrors().find((e) => e.id === mine.id)!.layer).toBe('review');
    // re-running the same check: its own ids are its own again
    s.setErrors([finding('ERR-0040', 'D7')], { layer: 'pdf' });
    expect(s.getErrors({ layer: 'pdf' }).map((e) => e.id)).toEqual(['ERR-0040']);
  });

  it('visible layers: what is shown, where a new error goes, and SP-3021 for a name that is not one', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const s = await loaded();
      s.setErrors([finding('V-1', 'C3')], { layer: 'validation' });
      s.setErrors([finding('P-1', 'D5'), finding('P-2', 'D6')], { layer: 'pdf' });
      const all = s.getSnapshot();
      expect(all.visibleLayers).toEqual(['validation', 'pdf']);
      expect(all.visibleErrors).toBe(all.errors); // every layer shown: the same array
      expect(s.setVisibleLayers(['pdf'])).toBe(true);
      expect(s.getSnapshot().visibleErrors.map((e) => e.id)).toEqual(['P-1', 'P-2']);
      expect(s.getSnapshot().visibleLayers).toEqual(['pdf']);
      // a person's error lands where they are looking
      expect(s.addError({ sheet: 'Holdings', range: 'G7', type: 'other', severity: 'note' }).layer).toBe('pdf');
      expect(s.addError({ sheet: 'Holdings', range: 'G8', type: 'other', severity: 'note', layer: 'validation' }).layer).toBe('validation');
      // naming a layer with no errors yet adds it to the pane's layers
      s.setVisibleLayers(['pdf', 'compare']);
      expect(s.getSnapshot().layers).toEqual(['validation', 'pdf', 'compare']);
      s.setVisibleLayers(null);
      expect(s.getSnapshot().visibleLayers).toEqual(['validation', 'pdf', 'compare']);
      expect(s.addError({ sheet: 'Holdings', range: 'G9', type: 'other', severity: 'note' }).layer).toBe('review');
      // names that are not names change nothing
      const before = s.getSnapshot();
      expect(s.setVisibleLayers(['PDF check'])).toBe(false);
      s.setErrors([finding('X-1', 'A1')], { layer: '' });
      expect(s.getErrors({ layer: 'a b' })).toEqual([]);
      expect(s.getSnapshot()).toBe(before);
      expect(s.addError({ sheet: 'Holdings', range: 'G10', type: 'other', severity: 'note', layer: 'no good' }).layer).toBe('review');
      expect(warn.mock.calls.map((c) => String(c[0]).slice(0, 7))).toEqual(['SP-3021', 'SP-3021', 'SP-3021', 'SP-3021']);
    } finally { warn.mockRestore(); }
  });

  it('plugins: a draft lands in review unless its plugin names a layer; validation keeps adopting its own per layer', async () => {
    const s = createWorkbook({ plugins: [checks] });
    await s.load(await sampleXlsx(), 's.xlsx');
    const found = s.getErrors().filter((e) => e.author === 'workbook');
    expect(found.map((e) => [e.range, e.layer])).toEqual([['F10', 'checks']]);
    s.setErrors(s.envelope()); // a restore: adopted again, not doubled
    expect(s.getErrors().filter((e) => e.author === 'workbook').map((e) => [e.id, e.layer])).toEqual([[found[0]!.id, 'checks']]);
    // replacing another layer leaves the provider's own alone
    s.setErrors([finding('P-1', 'D5')], { layer: 'pdf' });
    s.setCell('Holdings', 'A3', 'x');
    expect(s.getErrors().filter((e) => e.author === 'workbook')).toHaveLength(1);
  });

  it('undo across layers: a fix that resolves an error in a hidden layer undoes cleanly; no edit moves an error to another layer', async () => {
    const s = createWorkbook({ plugins: [checks] });
    await s.load(await sampleXlsx(), 's.xlsx');
    const id = s.getErrors()[0]!.id;
    s.setVisibleLayers(['review']); // the checks layer is hidden
    expect(s.getSnapshot().visibleErrors).toEqual([]);
    s.setCell('Holdings', 'F10', '150');
    expect(s.getErrors().find((e) => e.id === id)).toMatchObject({ status: 'resolved', layer: 'checks' });
    s.undo();
    expect(s.getErrors().find((e) => e.id === id)).toMatchObject({ status: 'open', layer: 'checks' });
    expect(s.getSnapshot().visibleLayers).toEqual(['review']); // undo never changes what is shown
    s.redo();
    expect(s.getErrors().find((e) => e.id === id)).toMatchObject({ status: 'resolved', layer: 'checks' });
    const mine = s.addError({ sheet: 'Holdings', range: 'G7', type: 'other', severity: 'note' });
    s.updateError(mine.id, { message: 'moved?', layer: 'checks' } as never);
    expect(s.getErrors().find((e) => e.id === mine.id)).toMatchObject({ message: 'moved?', layer: 'review' });
  });

  it('replacing a layer keeps the undo stack, and every step in it sees the new layer', async () => {
    const s = await loaded();
    s.setErrors([finding('P-1', 'D5')], { layer: 'pdf' });
    s.updateError('P-1', { status: 'resolved' }); // a step in the pdf layer
    s.setCell('Holdings', 'A3', 'x'); // a cell edit
    s.setErrors([finding('P-9', 'D9')], { layer: 'pdf' }); // the host re-runs its check
    expect(s.getSnapshot().canUndo).toBe(true);
    s.undo(); // the cell edit
    expect(s.text('Holdings', 'A3')).not.toBe('x');
    expect(s.getErrors({ layer: 'pdf' }).map((e) => e.id)).toEqual(['P-9']);
    s.undo(); // the resolve of the old P-1: nothing of it is brought back
    expect(s.getErrors({ layer: 'pdf' }).map((e) => [e.id, e.status])).toEqual([['P-9', 'open']]);
    s.redo(); s.redo();
    expect(s.text('Holdings', 'A3')).toBe('x');
    expect(s.getErrors({ layer: 'pdf' }).map((e) => e.id)).toEqual(['P-9']);
    // the whole review restored is not a user action: the stack is cleared, as before
    s.setErrors(s.envelope());
    expect(s.getSnapshot().canUndo).toBe(false);
  });

  it('envelope: save → restore round-trips three layers, an empty one included; a pre-layers envelope restores into review', async () => {
    const s = await loaded();
    s.addError({ sheet: 'Holdings', range: 'G7', type: 'other', severity: 'note', author: 'Asha' });
    s.setErrors([finding('V-1', 'C3')], { layer: 'validation' });
    s.setErrors([], { layer: 'pdf' });
    const saved = JSON.parse(JSON.stringify(s.envelope()));
    const t = await loaded();
    t.setErrors(saved);
    expect(t.getErrors()).toEqual(s.getErrors());
    expect(t.getSnapshot().layers).toEqual(['review', 'validation', 'pdf']);
    // a review saved before W-51: { errors, plugins }, no v and no layer on any error
    const old = { errors: [finding('ERR-0003', 'G7', { author: 'Asha' })].map(({ layer: _l, ...e }) => e), plugins: [] };
    const u = await loaded();
    u.setErrors(old as never);
    expect(u.getErrors()).toEqual([{ ...old.errors[0], layer: 'review' }]);
    expect(u.getSnapshot().layers).toEqual(['review']);
    // and the old way of passing a list still works
    const w = await loaded();
    w.setErrors(old.errors as SheetpaneError[]);
    expect(w.getErrors()).toEqual(u.getErrors());
  });
});
