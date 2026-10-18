// SR-IMPORT decision 8: without DOMParser the built-in reader reads .xlsx parts — and gives the
// very workbook DOMParser gives, on Excel-family files and on what toXlsx writes.
import { afterEach, describe, expect, it } from 'vitest';
import { toXlsx } from '@sheetpane/export';
import features from './fixtures/exceljs-features.xlsx?inline';
import d1904 from './fixtures/exceljs-1904.xlsx?inline';
import freezeFx from './fixtures/exceljs-freeze.xlsx?inline';
import { read } from '../src/index.js';
import { SAMPLE_BOOK } from '../../export/test/fixtures/sample.js';
import { fromDataUrl, hiddenPkg } from './helpers.js';

const real = globalThis.DOMParser;
afterEach(() => { globalThis.DOMParser = real; });

describe('the built-in XML reader matches DOMParser (SR-IMPORT decision 8)', () => {
  const files: [string, () => Promise<Uint8Array>][] = [
    ['exceljs-features.xlsx', async () => fromDataUrl(features)],
    ['exceljs-1904.xlsx', async () => fromDataUrl(d1904)],
    ['exceljs-freeze.xlsx', async () => fromDataUrl(freezeFx)],
    ['the design sample, written by toXlsx', () => toXlsx(SAMPLE_BOOK)],
    ['hidden sheets, rows, columns and outlines (W-49)', async () => hiddenPkg()],
  ];
  it.each(files)('%s', async (name, load) => {
    const bytes = await load();
    const withDom = await read(bytes, { name: 'f.xlsx' });
    // @ts-expect-error — a runtime without DOMParser
    delete globalThis.DOMParser;
    expect(typeof DOMParser).toBe('undefined');
    const without = await read(bytes, { name: 'f.xlsx' });
    // `part` reads raw parts on demand: a closure per read, so it is compared by what it returns
    const { part: pa, ...a } = without, { part: pb, ...b } = withDom;
    expect(a).toEqual(b);
    expect(await pa('xl/workbook.xml')).toEqual(await pb('xl/workbook.xml'));
  });
});
