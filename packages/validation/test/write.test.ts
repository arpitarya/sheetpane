// W-58: the host's rules file written into the download as the workbook's own data validation.
// DoD 1 — the mapping, rule by rule; DoD 2 — the export option, the console and the status line;
// DoD 3 — parity on the fixtures' rules sample: export with the rules, open the file again, and the
// validation plugin flags the cells the rules engine flags (minus the rules Excel cannot hold).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorkbook, paneStore, type ColumnRule, type SheetpaneExcel, type WorkbookStore } from '@sheetpane/grid';
import { readZip, inflateEntry, fromUtf8 } from '@sheetpane/export';
import showcase from '../../fixtures/files/showcase.xlsx?inline';
import showcaseRules from '../../fixtures/files/showcase.rules.json';
import '../src/ui.js';
import { lastRulesWrite, mainBlockCount, rulesAsValidations, validation, validationOf, RULES_OPTION, type RulesWriteReport } from '../src/index.js';
import { statusText } from '../src/ui.js';
import { frame, fromDataUrl, workbook, type SheetSpec } from './helpers.js';

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

const until = async (ok: () => boolean, ms = 5000) => { const end = performance.now() + ms; while (!ok()) { if (performance.now() > end) throw new Error('timed out'); await new Promise((r) => setTimeout(r, 10)); } };
const dvOf = (rule: ColumnRule, title = 'T') => { const m = validationOf(rule, { title }); if (!m?.dv) throw new Error(`not mapped: ${JSON.stringify(m)}`); return m.dv; };
const skipOf = (rule: ColumnRule) => validationOf(rule)?.skip;

async function storeWith(bytes: Uint8Array, doc: unknown, name = 'book.xlsx', plugins = [validation()]): Promise<WorkbookStore> {
  const s = createWorkbook({ plugins });
  if (doc !== undefined) s.setColumnRules({ document: doc });
  await s.load(bytes, name);
  await until(() => !s.ruleProgress);
  return s;
}
/** Export with the rules written, and open the result again with the validation plugin alone. */
async function roundTrip(s: WorkbookStore, options: Record<string, unknown> = { [RULES_OPTION]: true }): Promise<{ again: WorkbookStore; bytes: Uint8Array }> {
  const r = await s.exportFile({ options });
  const bytes = new Uint8Array(await r.blob.arrayBuffer());
  return { again: await storeWith(bytes, undefined, r.name), bytes };
}
const sheetXml = async (bytes: Uint8Array, n: number) => { const e = readZip(bytes).find((x) => x.name === `xl/worksheets/sheet${n}.xml`)!; return fromUtf8(await inflateEntry(bytes, e)); };
const flags = (s: WorkbookStore, author: string) => s.getErrors().filter((e) => e.author === author && e.status === 'open' && e.severity !== 'note').map((e) => `${e.sheet}!${e.range}`).sort();
const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('DoD 1 · the mapping: one rule, one Excel rule', () => {
  it('oneOf and equals → a typed-out list; required and equals clear "ignore blank"', () => {
    expect(dvOf({ oneOf: ['Active', 'Inactive'], severity: 'warning' }, 'Status')).toEqual({
      type: 'list', formula1: '"Active,Inactive"', allowBlank: true, showErrorMessage: true, showDropDown: false, errorStyle: 'warning',
      error: 'one of Active, Inactive', errorTitle: 'Status', promptTitle: 'Status', prompt: 'one of Active, Inactive',
    });
    expect(dvOf({ equals: 'Item' })).toMatchObject({ type: 'list', formula1: '"Item"', allowBlank: false });
    expect(dvOf({ oneOf: [1, 2, 3], type: 'integer', required: true })).toMatchObject({ type: 'list', formula1: '"1,2,3"', allowBlank: false });
    expect(dvOf({ oneOf: ['say "hi"', true] })).toMatchObject({ formula1: '"say ""hi"",TRUE"' });
    expect(dvOf({ type: 'boolean' })).toMatchObject({ type: 'list', formula1: '"TRUE,FALSE"' });
  });

  it('number and integer → decimal and whole; min, max or both; a bound alone is a number', () => {
    expect(dvOf({ type: 'integer', min: 1 })).toMatchObject({ type: 'whole', operator: 'greaterThanOrEqual', formula1: '1', allowBlank: true });
    expect(dvOf({ type: 'number', max: 5000 })).toMatchObject({ type: 'decimal', operator: 'lessThanOrEqual', formula1: '5000' });
    expect(dvOf({ min: 0, max: '0.5' })).toMatchObject({ type: 'decimal', operator: 'between', formula1: '0', formula2: '0.5' });
    expect(dvOf({ type: 'number' })).toMatchObject({ type: 'decimal', operator: 'between', formula1: '-9.99E+307', formula2: '9.99E+307' });
  });

  it('date → a date rule with DATE() or a serial; minLength / maxLength → text length; required alone → length ≥ 1', () => {
    expect(dvOf({ type: 'date', min: '2026-07-01', max: '2026-09-30' })).toMatchObject({ type: 'date', operator: 'between', formula1: 'DATE(2026,7,1)', formula2: 'DATE(2026,9,30)' });
    expect(dvOf({ type: 'date', max: 46296 })).toMatchObject({ type: 'date', operator: 'lessThanOrEqual', formula1: '46296' });
    expect(dvOf({ type: 'date' })).toMatchObject({ operator: 'between', formula1: 'DATE(1900,1,1)', formula2: 'DATE(9999,12,31)' });
    expect(dvOf({ minLength: 2, maxLength: 5, type: 'text' })).toMatchObject({ type: 'textLength', operator: 'between', formula1: '2', formula2: '5' });
    expect(dvOf({ maxLength: 40 })).toMatchObject({ type: 'textLength', operator: 'lessThanOrEqual', formula1: '40' });
    expect(dvOf({ required: true })).toMatchObject({ type: 'textLength', operator: 'greaterThanOrEqual', formula1: '1', allowBlank: false });
  });

  it('message, severity and onInvalid: the error text, and Stop, Warning or Information; titles cut to Excel’s 32', () => {
    expect(dvOf({ type: 'integer', message: 'Whole units only', onInvalid: 'block' })).toMatchObject({ error: 'Whole units only', errorStyle: 'stop', prompt: 'a whole number' });
    expect(dvOf({ type: 'integer', severity: 'note' })).toMatchObject({ errorStyle: 'information' });
    expect(validationOf({ type: 'integer' }, { onInvalid: 'block' })?.dv).toMatchObject({ errorStyle: 'stop' });
    const long = dvOf({ maxLength: 3, message: 'x'.repeat(300) }, 'A column title that runs past thirty-two');
    expect([long.errorTitle!.length, long.error!.length, long.errorTitle!.endsWith('…')]).toEqual([32, 255, true]);
  });

  it('what Excel cannot hold is skipped with its code; a rule that checks nothing is not a rule', () => {
    expect(skipOf({ pattern: '^AC-\\d{5}$', required: true })).toMatchObject({ code: 'SP-5401', reason: 'pattern' });
    expect(skipOf({ noneOf: ['TBD'] })).toMatchObject({ code: 'SP-5401', reason: 'noneOf' });
    expect(skipOf({ unique: true })).toMatchObject({ code: 'SP-5401', reason: 'unique' });
    for (const r of [{ oneOf: ['a'], min: 1 }, { type: 'number', maxLength: 3 }, { equals: 'a', oneOf: ['a'] }, { type: 'integer', oneOf: [1.5] }, { type: 'date', oneOf: ['2026-01-01'] }] as ColumnRule[]) {
      expect(skipOf(r), JSON.stringify(r)).toMatchObject({ code: 'SP-5402', reason: 'combination' });
    }
    expect(skipOf({ oneOf: ['a,b'] })).toMatchObject({ code: 'SP-5403', reason: 'list' });
    expect(skipOf({ oneOf: [] })).toMatchObject({ code: 'SP-5403' });
    expect(skipOf({ oneOf: Array.from({ length: 60 }, (_, i) => `value${i}`) })).toMatchObject({ code: 'SP-5403' });
    expect(skipOf({ type: 'date', min: '31/01/2026' })).toMatchObject({ code: 'SP-5404', reason: 'bound' });
    expect(skipOf({ type: 'date', min: '2026-02-30' })).toMatchObject({ code: 'SP-5404' });
    expect(skipOf({ min: 'ten' })).toMatchObject({ code: 'SP-5404' });
    expect(skipOf({ min: 5, max: 1 })).toMatchObject({ code: 'SP-5404' });
    expect(skipOf({ minLength: 1.5 })).toMatchObject({ code: 'SP-5404' });
    expect(validationOf({ type: 'text', note: 'free text' })).toBeUndefined();
    expect(validationOf({ message: 'x' })).toBeUndefined();
  });
});

describe('DoD 1 · placing the rules: columns, cells, and the workbook’s own rules', () => {
  const BOOK = (rules: SheetSpec['rules'] = [], x14: SheetSpec['x14'] = []): Promise<Uint8Array> => workbook([
    { name: 'S', cells: { A1: 'Fund', B1: 'Kind', C1: 'Units', A2: 'TMKT', B2: 'Core', C2: 5, A3: 'GOVT', B3: 'Bogus', C3: -1 }, rules, x14 },
    { name: 'Other', cells: { A1: 'Units', A2: 3 } },
  ]);

  it('a column rule covers its column under the titles; a cell rule its range; `*` reaches every sheet that has the title', async () => {
    const s = await storeWith(await BOOK(), { version: 1, sheets: { '*': { columns: { Units: { type: 'integer', min: 0 } } }, S: { columns: { Kind: { oneOf: ['Core', 'Cap'] } }, cells: { 'A1:A3': { maxLength: 4 } } } } });
    const plan = rulesAsValidations(s);
    expect(plan.sheets.map((x) => [x.sheet, x.rules.map((r) => `${r.type} ${r.sqref.join(' ')}`)])).toEqual([
      ['S', ['textLength A1:A3', 'list B2:B1048576', 'whole C2:C1048576']],
      ['Other', ['whole A2:A1048576']],
    ]);
    expect(plan).toMatchObject({ written: 4, merged: 0, skipped: [], conflicts: [] });
  });

  it('the workbook’s own rule wins: a different one keeps its cells (listed); the same check joins it, never repeated', async () => {
    const s = await storeWith(await BOOK([
      { sqref: 'B2:B3', type: 'list', f1: '"Core,Cap"', allowBlank: true, error: 'Pick one' },
      { sqref: 'C2:C3', type: 'whole', operator: 'greaterThan', f1: '0', allowBlank: true },
    ]), { version: 1, sheets: { S: { columns: { Kind: { oneOf: ['Core', 'Cap'] }, Units: { type: 'integer', min: 0 } } } } });
    const plan = rulesAsValidations(s);
    expect(plan.sheets[0]!.rules.map((r) => `${r.type} ${r.operator ?? ''} ${r.sqref.join(' ')}`)).toEqual([
      'list  B2:B3 B4:B1048576', // joined: the workbook's own list, its message kept
      'whole greaterThan C2:C3', // the workbook's own, untouched
      'whole greaterThanOrEqual C4:C1048576', // the file's rule, where the workbook has none
    ]);
    expect(plan.sheets[0]!.rules[0]!.error).toBe('Pick one');
    expect(plan).toMatchObject({ written: 2, merged: 1, conflicts: [{ code: 'SP-5406', sheet: 'S', cells: 'C2:C3', where: 'column “Units”', kept: "the workbook's own whole rule" }] });
  });

  it('a cell rule wins over a column rule, a named sheet’s over `*`’s; a rule wholly covered is not written', async () => {
    const s = await storeWith(await BOOK(), { version: 1, sheets: { '*': { cells: { C2: { type: 'integer', max: 9 } } }, S: { columns: { Units: { type: 'integer', min: 0 } }, cells: { 'C2:C3': { type: 'integer', max: 100 } } } } });
    const plan = rulesAsValidations(s);
    expect(plan.sheets.find((x) => x.sheet === 'S')!.rules.map((r) => `${r.formula1} ${r.sqref.join(' ')}`)).toEqual(['100 C2:C3', '0 C4:C1048576']);
    expect(plan.conflicts.map((c) => `${c.where} ${c.cells} ← ${c.kept}`)).toEqual(['cell C2 C2 ← cells C2:C3', 'column “Units” C2:C3 ← cells C2:C3']);
    expect(plan.written).toBe(3); // S's cells, S's column, and "*"'s C2 on Other
  });

  it('a title or sheet the workbook lacks is listed (SP-5405), once', async () => {
    const s = await storeWith(await BOOK(), { version: 1, sheets: { '*': { columns: { Email: { maxLength: 80 } } }, S: { columns: { Price: { min: 0 } } }, Missing: { columns: { Units: { min: 0 } } } } });
    expect(rulesAsValidations(s).skipped.map((x) => [x.code, x.sheet, x.where])).toEqual([
      ['SP-5405', 'Missing', 'sheet “Missing”'], ['SP-5405', 'S', 'column “Price”'], ['SP-5405', '*', 'column “Email”'],
    ]);
  });

  it('the element’s columns are written too, under the file’s (the rules engine’s order)', async () => {
    const s = createWorkbook({ plugins: [validation()] });
    s.setColumnRules({ columns: { Units: { type: 'number' }, Fund: { maxLength: 4 } }, document: { version: 1, sheets: { S: { columns: { Units: { type: 'integer', min: 0 } } } } } });
    await s.load(await BOOK(), 'b.xlsx');
    const rules = rulesAsValidations(s).sheets.find((x) => x.sheet === 'S')!.rules;
    expect(rules.map((r) => `${r.type} ${r.sqref.join(' ')}`)).toEqual(['textLength A2:A1048576', 'whole C2:C1048576']);
  });

  it('Excel 2010 x14 rules stay in extLst, never copied into the main block; they still keep their cells', async () => {
    quiet();
    const s = await storeWith(await BOOK([], [{ sqref: 'B2:B3', type: 'list', f1: 'Other!$A$2:$A$9', allowBlank: true }]), { version: 1, sheets: { S: { columns: { Kind: { oneOf: ['Core'] }, Units: { min: 0 } } } } });
    const { again, bytes } = await roundTrip(s);
    const xml = await sheetXml(bytes, 1);
    expect(mainBlockCount(xml)).toBe(2);
    expect(xml.match(/<x14:dataValidation /g)).toHaveLength(1);
    expect(again.book!.sheets[0]!.dataValidations.map((d) => `${d.type} ${d.sqref.join(' ')}`).sort()).toEqual(['decimal C2:C1048576', 'list B2:B3', 'list B4:B1048576']);
    expect(lastRulesWrite(s.book)!.conflicts).toEqual([expect.objectContaining({ cells: 'B2:B3', kept: "the workbook's own list rule" })]);
  });

  it('a sheet whose own rules export refuses keeps its block; the rules meant for it are listed (SP-5407)', async () => {
    const warn = quiet();
    const s = await storeWith(await BOOK([{ sqref: 'D2', type: 'whole', operator: 'greaterThan', f1: '0', errorTitle: 'A title much longer than thirty-two characters' }]), { version: 1, sheets: { S: { columns: { Units: { min: 0 } } } } });
    const { bytes } = await roundTrip(s);
    expect(await sheetXml(bytes, 1)).toContain('sqref="D2"');
    expect(lastRulesWrite(s.book)).toMatchObject({ written: 0, skipped: [expect.objectContaining({ code: 'SP-5407', sheet: 'S', reason: 'workbook' })] });
    expect(warn.mock.calls.map((c) => String(c[0]).slice(0, 8))).toEqual(['SP-5407:']);
  });
});

describe('DoD 2 · the export option', () => {
  const BOOK = () => workbook([{ name: 'S', cells: { A1: 'Units', A2: 5, A3: -1 } }]);
  const DOC = { version: 1, sheets: { S: { columns: { Units: { type: 'integer', min: 0 } }, cells: { B1: { pattern: '^x$' } } } } };

  it('off by default: export() writes nothing; { rulesAsValidation: true } writes; validation({ rulesAsValidation: true }) makes it the default', async () => {
    quiet();
    const s = await storeWith(await BOOK(), DOC);
    expect((await roundTrip(s, {})).again.book!.sheets[0]!.dataValidations).toEqual([]);
    expect((await roundTrip(s)).again.book!.sheets[0]!.dataValidations).toEqual([expect.objectContaining({ type: 'whole', sqref: ['A2:A1048576'] })]);
    const on = await storeWith(await BOOK(), DOC, 'b.xlsx', [validation({ rulesAsValidation: true })]);
    expect((await roundTrip(on, {})).again.book!.sheets[0]!.dataValidations).toHaveLength(1);
    expect((await roundTrip(on, { [RULES_OPTION]: false })).again.book!.sheets[0]!.dataValidations).toEqual([]);
  });

  it('what is not written goes to the console with its code, and to the status line', async () => {
    const warn = quiet();
    const s = await storeWith(await BOOK(), DOC);
    await roundTrip(s);
    expect(warn.mock.calls.map((c) => String(c[0]))).toEqual([expect.stringMatching(/^SP-5401: Rule check Excel validation cannot hold — sheetpane validation: cell B1 on “S” not written to Excel: a pattern/)]);
    const report: RulesWriteReport | undefined = lastRulesWrite(s.book);
    expect(report).toMatchObject({ written: 1, skipped: [{ code: 'SP-5401', sheet: 'S', where: 'cell B1', reason: 'pattern' }] });
    expect(statusText(s.getSnapshot())).toBe('1 rule not written to Excel');
  });

  it('the Download menu offers the switch only with rules; on, an untouched workbook is exported with them', async () => {
    quiet();
    const excel = document.createElement('sheetpane-excel') as SheetpaneExcel;
    excel.setAttribute('pane', 'w58'); excel.setAttribute('plugins', 'validation'); excel.style.height = '500px';
    document.body.append(excel);
    await excel.load(await BOOK(), 'units.xlsx');
    await frame();
    const sh = excel.shadowRoot!;
    const openMenu = async () => { if (sh.querySelector('.dlmore')!.getAttribute('aria-expanded') !== 'true') (sh.querySelector('.dlmore') as HTMLButtonElement).click(); await frame(); };
    await openMenu();
    expect(sh.querySelector('.dlmenu [data-opt=rulesAsValidation]')).toBeNull(); // no rules: no switch
    const got: Record<string, unknown>[] = [];
    excel.addEventListener('sheetpane-export', (e) => { got.push((e as CustomEvent).detail); e.preventDefault(); });
    (sh.querySelector('button.export') as HTMLButtonElement).click();
    await until(() => got.length === 1);
    expect(got[0]).toMatchObject({ original: true });
    excel.rules = DOC;
    const store = paneStore('w58')!;
    await until(() => !store.ruleProgress && store.hasRulesDocument);
    await frame();
    await openMenu();
    const box = sh.querySelector('.dlmenu [data-opt=rulesAsValidation]') as HTMLElement;
    expect([box.getAttribute('role'), box.getAttribute('aria-checked'), box.textContent]).toEqual(['menuitemcheckbox', 'false', 'Write rules as Excel dropdowns']);
    box.click();
    await frame();
    (sh.querySelector('button.export') as HTMLButtonElement).click();
    await until(() => got.length === 2);
    expect(got[1]!.original).toBeUndefined();
    const again = await storeWith(new Uint8Array(await (got[1]!.blob as Blob).arrayBuffer()), undefined);
    expect(again.book!.sheets[0]!.dataValidations).toEqual([expect.objectContaining({ type: 'whole', sqref: ['A2:A1048576'] })]);
    await frame();
    expect(sh.querySelector('.status')!.textContent).toContain('1 rule not written to Excel');
  });
});

describe('DoD 3 · parity on the fixtures’ rules sample (showcase.xlsx + showcase.rules.json)', () => {
  it('re-opened, the validation plugin flags exactly the cells the rules engine flags, but for the rules Excel cannot hold', async () => {
    const warn = quiet();
    const s = await storeWith(fromDataUrl(showcase), showcaseRules, 'showcase.xlsx');
    s.setCell('Validation', 'C5', '0'); // an edit: fails "Units ≥ 1" in both
    s.setCell('Formulas', 'B5', '6000'); // fails "Amount ≤ 5,000"
    s.setCell('Numbers', 'B3', '0.05'); // now passes "≤ 0.1"
    await until(() => !s.ruleProgress);
    const engine = flags(s, 'host');
    const { again } = await roundTrip(s);
    const report = lastRulesWrite(s.book)!;
    // the one rule Excel cannot hold: Account's pattern (with required) — its cells are the only difference
    expect(report.skipped.map((x) => [x.code, x.sheet, x.where, x.reason])).toEqual([['SP-5401', 'Validation', 'column “Account”', 'pattern']]);
    const unwritten = (ref: string) => /^Validation!A\d+$/.test(ref);
    expect(flags(again, 'workbook')).toEqual(engine.filter((r) => !unwritten(r)));
    expect(engine.filter((r) => !unwritten(r))).toEqual([
      'Formulas!B3', 'Formulas!B5', 'Formulas!B6', 'Formulas!B7', 'Validation!C3', 'Validation!C5',
    ].concat('Validation!B4').sort());
    // Status joined the file's own identical list; Units kept the file's own "whole > 0" on C2:C5
    expect(report).toMatchObject({ written: 5, merged: 1 });
    expect(report.conflicts.map((c) => `${c.sheet}!${c.cells} ${c.where}`)).toEqual(['Validation!C2:C5 column “Units”']);
    const dvs = again.book!.sheets.find((x) => x.name === 'Validation')!.dataValidations;
    expect(dvs.map((d) => `${d.type} ${d.sqref.join(' ')}`)).toEqual(['list B2:B5 B6:B1048576', 'whole C2:C5', 'whole C6:C1048576']);
    expect(warn).toHaveBeenCalledTimes(2); // the pattern, and the Units conflict
  });
});
