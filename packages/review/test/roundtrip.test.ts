import { describe, expect, it } from 'vitest';
import { createWorkbook } from '@sheetpane/grid';
import { comments } from '@sheetpane/comments';
import { read } from '@sheetpane/import';
import { readFile, valueAt } from '@sheetpane/testing';
import showcase from '../../fixtures/files/showcase.xlsx?inline';
import features from '../../import/test/fixtures/exceljs-features.xlsx?inline';
import { review, reviewSheetOf } from '../src/index.js';
import { blobBytes, parseXml, unzip } from './helpers.js';

const fromDataUrl = (u: string) => Uint8Array.from(atob(u.slice(u.indexOf(',') + 1)), (c) => c.charCodeAt(0));

describe('real files, with the other export plugins (DoD 4)', () => {
  it.each([['showcase.xlsx', showcase], ['exceljs-features.xlsx', features]])('%s: Review sheet and fills beside comments; every part well-formed; read back by @sheetpane/import and @sheetpane/testing', async (name, url) => {
    const data = fromDataUrl(url);
    const plugin = review({ fill: true });
    const s = createWorkbook({ plugins: [comments(), plugin] });
    await s.load(data, name);
    const first = s.getSnapshot().book!.sheets[0]!.name;
    const e = s.addError({ sheet: first, range: 'A1:B2', type: 'other', severity: 'error', message: 'checked' });
    const bytes = await blobBytes((await s.exportFile()).blob);
    const parts = await unzip(bytes);
    for (const [part, xml] of parts) if (/\.(xml|rels|vml)$/.test(part)) parseXml(xml, part);
    expect(plugin.lastExport).toMatchObject({ sheet: 'Review', listed: [e.id], filled: [e.id], skipped: [] });
    const book = await read(bytes, { name });
    expect(reviewSheetOf(book)).toBe('Review');
    expect(book.sheets.at(-1)!.name).toBe('Review');
    // the original sheets read back with their values
    const before = await read(data, { name });
    for (const sh of before.sheets) expect(book.sheets.find((x) => x.name === sh.name)!.rows, sh.name).toEqual(sh.rows);
    const values = await readFile(bytes, name);
    expect(valueAt(values, 'Review!A2')).toBe(e.id);
    expect(valueAt(values, 'Review!C2')).toBe('A1:B2');
    // comments wrote its thread too
    expect([...parts.keys()].some((k) => k.startsWith('xl/threadedComments/'))).toBe(true);
  });
});
