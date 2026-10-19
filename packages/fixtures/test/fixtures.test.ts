// W-42: every fixture is what the manifest says — read in a real browser with @sheetpane/import;
// the refused ones are refused; the rules sample on the showcase gives exactly the listed errors.
import { describe, expect, it } from 'vitest';
import { read } from '@sheetpane/import';
import { createWorkbook } from '@sheetpane/grid';
import { bytes, info, MANIFEST, url, type FixtureName } from '../src/index.js';

const until = async (cond: () => boolean, ms = 5000) => { const t0 = performance.now(); while (!cond()) { if (performance.now() - t0 > ms) throw new Error('timed out'); await new Promise((r) => setTimeout(r, 10)); } };

describe('the manifest (DoD 2, 3)', () => {
  for (const f of MANIFEST.files.filter((x) => x.kind === 'xlsx' || x.kind === 'csv')) {
    it(`${f.name}: sheets and titles as listed`, async () => {
      const book = await read(await bytes(f.name), { name: f.name.split('/').pop()! });
      const listed = (f as { sheets: readonly { name: string; headers?: readonly unknown[] }[] }).sheets;
      if (f.kind === 'xlsx') expect(book.sheets.map((s) => s.name)).toEqual(listed.map((s) => s.name));
      listed.forEach((s, i) => { if (s.headers?.length) expect(book.sheets[i]!.text[0]!.slice(0, s.headers.length)).toEqual(s.headers.map(String)); });
    });
  }
  for (const f of MANIFEST.files.filter((x) => x.kind === 'refused')) {
    it(`${f.name} is refused`, async () => {
      await expect(read(await bytes(f.name), { name: f.name.split('/').pop()! })).rejects.toThrow();
    });
  }
  it('the hidden sheet is marked hidden; 1904 is read as 1904', async () => {
    expect((await read(await bytes('edge/hidden-sheet.xlsx'), { name: 'h.xlsx' })).sheets[1]!.hidden).toBe(true);
    expect((await read(await bytes('edge/date1904.xlsx'), { name: 'd.xlsx' })).date1904).toBe(true);
  });
  it('the showcase’s Tables sheet holds two Excel tables, one with a totals row (W-61)', async () => {
    const t = (await read(await bytes('showcase.xlsx'), { name: 's.xlsx' })).sheets.find((x) => x.name === 'Tables')!;
    expect(t.tables.map((x) => [x.name, x.ref, x.totalsRowCount, x.style.name])).toEqual([['Units', 'A1:B5', 0, 'TableStyleMedium2'], ['Readings', 'A8:C13', 1, 'TableStyleMedium7']]);
    expect(t.dataValidations[0]!.formula1).toBe('UnitList');
  });
  it('protected.xlsx: Spec and Lists protected with a password, Spec’s Value column open, the structure locked (W-62)', async () => {
    const b = await read(await bytes('protected.xlsx'), { name: 'p.xlsx' });
    expect(b.sheets.map((x) => [x.name, !!x.protection, x.state])).toEqual([['Spec', true, 'visible'], ['Lists', true, 'visible'], ['Notes', false, 'visible'], ['Archive', false, 'hidden']]);
    expect(b.workbookProtection).toEqual({ lockStructure: true, lockWindows: false, hasPassword: true });
    const s = createWorkbook();
    await s.load(await bytes('protected.xlsx'), 'protected.xlsx');
    expect(['A2', 'B2', 'C2', 'D2', 'E2', 'B9'].map((r) => s.isLocked('Spec', r))).toEqual([true, false, false, false, true, false]);
    expect(s.isFormulaHidden('Spec', 'E2')).toBe(true);
  });
});

describe('the rules sample (DoD 3)', () => {
  it('on the showcase it gives exactly the errors the manifest lists', async () => {
    const s = createWorkbook();
    s.setColumnRules({ document: JSON.parse(new TextDecoder().decode(await bytes('showcase.rules.json'))) });
    await s.load(await bytes('showcase.xlsx'), 'showcase.xlsx');
    await until(() => !s.ruleProgress && s.getErrors().length > 0);
    const got = s.getErrors().filter((e) => e.author === 'host' && e.severity !== 'note').map((e) => `${e.sheet}!${e.range}`).sort();
    expect(got).toEqual([...(info('showcase.rules.json') as { errors: readonly string[] }).errors].sort());
  });
});

describe('the API (DoD 4)', () => {
  it('url() resolves beside the package, and bytes() fetches it in a browser', async () => {
    expect(url('showcase.xlsx').pathname).toMatch(/\/packages\/fixtures\/files\/showcase\.xlsx$/);
    const b = await bytes('csv/bom.csv');
    expect([...b.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const names: FixtureName[] = MANIFEST.files.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
