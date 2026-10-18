// Perf (W-16 DoD 8): the W-01 250,000-row data, as an .xlsx with 10,000 formulas
// (F2:F10001 = C*D). Reported, not gating — headless Chromium on the build machine,
// not the reference machine. Load = read + first recalculation; edit = one
// input changed until its dependents are back.
import { describe, expect, it } from 'vitest';
import { createWorkbook } from '@sheetpane/grid';
import { utf8, writeZip } from '@sheetpane/export';
import { formulas } from '../src/index.js';
import { until } from './helpers.js';

const ROWS = 250_000, FORMULAS = 10_000;

async function bigBook(): Promise<Uint8Array> {
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const rows: string[] = ['<row r="1"><c r="A1" t="inlineStr"><is><t>Account</t></is></c><c r="B1" t="inlineStr"><is><t>Client</t></is></c><c r="C1" t="inlineStr"><is><t>Units</t></is></c><c r="D1" t="inlineStr"><is><t>Price</t></is></c><c r="E1" t="inlineStr"><is><t>Id</t></is></c><c r="F1" t="inlineStr"><is><t>Value</t></is></c></row>'];
  for (let i = 0; i < ROWS; i++) {
    const r = i + 2, units = i % 1000, price = (i % 300) + 0.25;
    const f = i < FORMULAS ? `<c r="F${r}"><f>C${r}*D${r}</f><v>${units * price}</v></c>` : '';
    rows.push(`<row r="${r}"><c r="A${r}" t="inlineStr"><is><t>AC-${i}</t></is></c><c r="B${r}" t="inlineStr"><is><t>Client ${i % 97}</t></is></c><c r="C${r}"><v>${units}</v></c><c r="D${r}"><v>${price}</v></c><c r="E${r}"><v>${i * 3}</v></c>${f}</row>`);
  }
  const parts: Record<string, string> = {
    '[Content_Types].xml': `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    '_rels/.rels': `<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${NS}" xmlns:r="${R}"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${NS}"><sheetData>${rows.join('')}</sheetData></worksheet>`,
  };
  return writeZip(Object.entries(parts).map(([name, s]) => ({ name, data: utf8(s) })));
}

describe('perf: 250,000 rows, 10,000 formulas', () => {
  it('load with and without the plugin; one edit', async () => {
    const bytes = await bigBook();
    let t0 = performance.now();
    const plain = createWorkbook();
    await plain.load(bytes, 'big.xlsx');
    const loadPlain = performance.now() - t0;

    const f = formulas({ preload: true });
    await until(() => true);
    t0 = performance.now();
    const store = createWorkbook({ plugins: [f] });
    await store.load(bytes, 'big.xlsx');
    const read = performance.now() - t0;
    await f.ready();
    const loadWith = performance.now() - t0;
    expect(store.getSnapshot().derived.size).toBe(0);

    t0 = performance.now();
    store.setCell('Data', 'C2', '7');
    await until(() => store.getSnapshot().derived.has('Data!F2'), 60_000);
    const edit = performance.now() - t0;
    expect(store.getSnapshot().derived.get('Data!F2')?.value).toBeCloseTo(7 * 0.25, 12);

    t0 = performance.now();
    store.setCell('Data', 'C3', '9');
    await until(() => store.getSnapshot().derived.has('Data!F3'), 60_000);
    const edit2 = performance.now() - t0;

    console.info(`perf (${navigator.userAgent}, ${navigator.hardwareConcurrency} cores; .xlsx ${(bytes.length / 2 ** 20).toFixed(1)} MiB): load without plugin ${Math.round(loadPlain)} ms; with plugin: read ${Math.round(read)} ms, + model built and evaluated → ${Math.round(loadWith)} ms; first edit ${Math.round(edit)} ms; second edit ${Math.round(edit2)} ms`);
  }, 180_000);
});
