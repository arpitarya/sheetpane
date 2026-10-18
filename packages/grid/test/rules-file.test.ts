// W-33: the rules file — per sheet ("*" and named), columns, cells and ranges, notes for its own
// problems, rules-src, the JSON Schema, and flagging="off".
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { toXlsx } from '@sheetpane/export';
import { createWorkbook, type SheetpaneExcel, type WorkbookStore } from '../src/index.js';
import schema from '../rules.schema.json';
import { budgets, cellEl, cleanup, frame, shadow, until } from './helpers.js';
import { README_RULES } from './rules-fixture.js';

afterEach(cleanup);

const BOOK = () => toXlsx({ sheets: [
  { name: 'Accounts', rows: [
    ['Report', 'Q3 review', null, null, null, null, null, 'Rate'],
    ['Account ID', 'Email', 'Units', 'Status', null, null, null, 'Rate'],
    ['AC-10021', 'a@x.io', 10, 'Active', null, null, null, 0.5],
    ['AC-1O044', 'b@x', -1, 'TBD', null, null, null, 1.5],
    ['AC-10042', 'a@x.io', 3, 'Gone', null, null, null, 0.2],
  ] },
  { name: 'People', rows: [['Name', 'Email'], ['Ada', 'ada@x.io'], ['Bo', 'bo@x']] },
] });

async function storeWith(doc: unknown, extra: { columns?: Record<string, object> } = {}): Promise<WorkbookStore> {
  const s = createWorkbook();
  s.setColumnRules({ document: doc, ...(extra.columns ? { columns: extra.columns } : {}) });
  await s.load(await BOOK(), 'q3.xlsx');
  await until(() => !s.ruleProgress);
  return s;
}
const host = (s: WorkbookStore) => s.getErrors().filter((e) => e.author === 'host');
const open = (s: WorkbookStore) => host(s).filter((e) => e.status === 'open' && e.severity !== 'note').map((e) => `${e.sheet}!${e.range} ${e.message}`);
const notes = (s: WorkbookStore) => host(s).filter((e) => e.severity === 'note').map((e) => e.message);

describe('the document (DoD 1, 2, 5)', () => {
  it('"*" applies to every sheet, a named sheet adds its own; headerRow per sheet; columns, cells and ranges', async () => {
    const s = await storeWith(README_RULES);
    expect(open(s).sort()).toEqual([
      'Accounts!A4 Account IDs are AC- and five digits',
      'Accounts!B3 Email: “a@x.io” appears more than once (unique)',
      'Accounts!B4 Email: does not match the expected format (pattern)',
      'Accounts!B5 Email: “a@x.io” appears more than once (unique)',
      'Accounts!C4 Units: must be at least 0 (min)',
      'Accounts!D4 Status: must be one of Active, Inactive (oneOf)',
      'Accounts!D5 Status: must be one of Active, Inactive (oneOf)',
      'Accounts!H4 H4: must be at most 1 (max)',
      'People!B3 Email: does not match the expected format (pattern)',
    ].sort());
    expect(host(s).find((e) => e.range === 'H4')).toMatchObject({ type: 'cell-rule', expected: 'a number from 0 to 1' });
    expect(host(s).find((e) => e.range === 'D4')!.severity).toBe('warning');
    expect(notes(s)).toEqual([]);
  });

  it('equals and noneOf; a blank cell fails equals; note is never the message', async () => {
    const s = await storeWith({ version: 1, sheets: { Accounts: { headerRow: 2, columns: { Status: { noneOf: ['TBD', 'n/a'] } }, cells: { B1: { equals: 'Q4 review', note: 'title' }, C1: { equals: 'x' } } } } });
    expect(open(s).sort()).toEqual([
      'Accounts!B1 B1: must be Q4 review (equals)',
      'Accounts!C1 C1: must be x (equals)',
      'Accounts!D4 Status: “TBD” is not allowed (noneOf)',
    ]);
  });

  it('a fix resolves the error; breaking it again reopens it', async () => {
    const s = await storeWith(README_RULES);
    s.setCell('Accounts', 'H4', '0.9');
    expect(host(s).find((e) => e.range === 'H4')!.status).toBe('resolved');
    s.setCell('Accounts', 'B1', 'Q3 draft');
    expect(open(s)).toContain('Accounts!B1 B1: must be Q3 review (equals)');
    s.setCell('Accounts', 'B1', 'Q3 review');
    expect(host(s).find((e) => e.range === 'B1')!.status).toBe('resolved');
  });

  it('its own problems are notes, each its own error; the rest still applies; nothing throws', async () => {
    const s = await storeWith({ version: 1, colour: 'red', sheets: { Ghost: { columns: { X: { required: true } } }, Accounts: { headerRow: 2, rows: 3, columns: { Units: { type: 'decimal', minimum: 1, pattern: '(' }, Phone: { required: true } }, cells: { 'not a ref': { required: true } } } } });
    expect(notes(s).sort()).toEqual([
      'No column is titled “Phone” in row 2 of “Accounts” — its rule is not checked',
      'No sheet is named “Ghost” — its rules are not checked',
      'The pattern for column “Units” is not a regular expression (Invalid regular expression: /(/: Unterminated group) — it is not tested',
      'Unknown key “colour” in the rules file',
      'Unknown key “rows” in sheet “Accounts”',
      'Unknown rule word “minimum” for column “Units”',
      'Unknown type “decimal” for column “Units” (text, number, integer, date, boolean)',
      '“not a ref” in sheet “Accounts” is not a cell or a range',
    ].sort());
    expect(new Set(host(s).filter((e) => e.severity === 'note').map((e) => e.id)).size).toBe(8);
    // W-40: every note names its stable code
    expect(host(s).filter((e) => e.severity === 'note').map((e) => e.code).sort()).toEqual(['SP-6013', 'SP-6013', 'SP-6016', 'SP-6017', 'SP-6018', 'SP-6021', 'SP-6022', 'SP-6023']);
  });

  it('an unknown version is one note and no rule applies', async () => {
    const s = await storeWith({ version: 2, sheets: { '*': { columns: { Email: { required: true } } } } });
    expect(notes(s)).toEqual(['Rules file version 2 is not one this grid reads (1) — no rule from it is checked']);
    expect(open(s)).toEqual([]);
  });

  it('merges with the element’s columns: the file’s rule wins for the same title, with one note', async () => {
    const s = await storeWith({ version: 1, sheets: { People: { columns: { Email: { required: true } } } } }, { columns: { email: { pattern: '^x' }, Name: { minLength: 3 } } });
    expect(open(s).filter((x) => x.startsWith('People'))).toEqual(['People!A3 Name: must be at least 3 characters (minLength)']); // Ada passes, Bo does not
    expect(notes(s)).toContain('The rules file’s rule for “Email” replaces the one set on the element'.replace('’', "'"));
  });
});

describe('the JSON Schema (DoD 3)', () => {
  // a small 2020-12 subset — the schema uses only these words
  type S = Record<string, unknown>;
  const resolve = (s: S): S => (typeof s.$ref === 'string' ? (schema as S & { $defs: Record<string, S> }).$defs[s.$ref.split('/').pop()!]! : s);
  function check(v: unknown, s0: S, path = '$'): string[] {
    const s = resolve(s0), out: string[] = [];
    const t = Array.isArray(v) ? 'array' : v === null ? 'null' : Number.isInteger(v) ? 'integer' : typeof v;
    const types = s.type === undefined ? undefined : ([] as string[]).concat(s.type as string);
    if (types && !types.some((x) => x === t || (x === 'number' && t === 'integer'))) return [`${path}: ${t} is not ${types.join('|')}`];
    if ('const' in s && v !== s.const) out.push(`${path}: not ${String(s.const)}`);
    if (s.enum && !(s.enum as unknown[]).includes(v)) out.push(`${path}: not one of ${String(s.enum)}`);
    if (typeof s.minimum === 'number' && typeof v === 'number' && v < s.minimum) out.push(`${path}: below ${s.minimum}`);
    if (t === 'object') {
      const o = v as S, props = (s.properties ?? {}) as Record<string, S>;
      for (const r of (s.required ?? []) as string[]) if (!(r in o)) out.push(`${path}: missing ${r}`);
      for (const [k, x] of Object.entries(o)) {
        if (s.propertyNames && !new RegExp((s.propertyNames as S).pattern as string).test(k)) out.push(`${path}.${k}: bad name`);
        if (props[k]) out.push(...check(x, props[k]!, `${path}.${k}`));
        else if (s.additionalProperties === false) out.push(`${path}.${k}: not allowed`);
        else if (typeof s.additionalProperties === 'object') out.push(...check(x, s.additionalProperties as S, `${path}.${k}`));
      }
    }
    if (t === 'array' && s.items) (v as unknown[]).forEach((x, i) => out.push(...check(x, s.items as S, `${path}[${i}]`)));
    return out;
  }
  it('the README example is valid; a typo is caught where the editor would underline it', async () => {
    expect(check(README_RULES, schema as S)).toEqual([]);
    const shared = (await import('../../fixtures/files/showcase.rules.json')).default;
    expect(check(shared, schema as S)).toEqual([]);
    expect(check({ version: 1, sheets: { S: { columns: { A: { reqired: true } }, cells: { 'B 1': {} } } } }, schema as S)).toEqual(['$.sheets.S.columns.A.reqired: not allowed', '$.sheets.S.cells.B 1: bad name']);
  });
});

async function mount(attrs: Record<string, string>): Promise<SheetpaneExcel> {
  const el = document.createElement('sheetpane-excel');
  el.style.height = '500px';
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  await el.load(await BOOK(), 'q3.xlsx');
  await until(() => !el.workbook!.ruleProgress);
  await frame();
  return el;
}

describe('rules-src and the element (DoD 4)', () => {
  it('rules-src reads the file with a GET; setting rules re-checks; a file that cannot be read is a note', async () => {
    const url = `data:application/json,${encodeURIComponent(JSON.stringify(README_RULES))}`;
    const el = await mount({ 'rules-src': url, mode: 'edit' });
    await until(() => open(el.workbook!).length === 9);
    el.rules = { version: 1, sheets: { People: { columns: { Name: { minLength: 3 } } } } };
    await until(() => open(el.workbook!).length === 1); // only Bo is under three letters
    el.setAttribute('rules-src', 'data:application/json,{not json');
    await until(() => notes(el.workbook!).some((m) => m.startsWith('The rules file could not be read')));
    expect(open(el.workbook!)).toEqual([]);
  });
});

describe('flagging="off" (DoD 6, 7)', () => {
  it('no Flag issue anywhere, no F, no composer, no callout card; the error mark stays and selects its row in the panel', async () => {
    const el = await mount({ mode: 'edit', flagging: 'off', pane: 'rf' });
    el.rules = README_RULES;
    const errors = document.createElement('sheetpane-errors');
    errors.setAttribute('pane', 'rf');
    document.body.append(errors);
    await until(() => open(el.workbook!).length === 9);
    await frame();
    const s = el.workbook!;
    // select a failing cell
    cellEl(el, 3, 0)!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
    await frame();
    expect(shadow(el).querySelector('.dock [data-act=flag]')).toBeNull();
    expect(shadow(el).querySelector('.cardslot')!.innerHTML).toBe(''); // no callout card
    expect(shadow(el).querySelector('.pin, .c.m-error')).not.toBeNull(); // the mark stays
    shadow(el).querySelector<HTMLElement>('.grid')!.focus();
    await userEvent.keyboard('f');
    await frame();
    expect(s.getSnapshot().composing).toBeNull();
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    await frame(); await frame();
    expect([...shadow(el).querySelectorAll('.ctxmenu [role=menuitem]')].map((x) => x.firstChild!.textContent)).toEqual(['Copy ref', 'Copy value']);
    expect(el.shortcuts().some((x) => x.keys === 'F')).toBe(false);
    s.compose({ sheet: 'Accounts', ref: 'C3' }); // a host compose: still no form anywhere
    await frame();
    expect(shadow(errors).querySelector('.form')).toBeNull();
    // the panel: the selected cell's row is on; the host filter is "Rules file" and groups by sheet
    expect(shadow(errors).querySelector('.item.on')).not.toBeNull();
    const filter = [...shadow(errors).querySelectorAll<HTMLButtonElement>('[data-act=author]')].find((b) => b.textContent === 'Rules file')!;
    filter.click();
    await frame();
    expect([...shadow(errors).querySelectorAll('.grp')].map((g) => g.textContent)).toEqual(['Accounts', 'People']);
    // flagging back on: Flag issue returns
    el.flagging = 'on';
    await frame();
    expect(shadow(el).querySelector('.dock [data-act=flag]')).toBeNull(); // A4 has an error: still no Flag issue on it
    cellEl(el, 2, 4)!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
    await frame();
    expect(shadow(el).querySelector('.dock [data-act=flag]')).not.toBeNull();
  });
});

describe('scale (DoD 10)', () => {
  const rows: (string | number | null)[][] = [['Report', 'Q3 review'], ['Account ID', 'Email', 'Units', 'Status']];
  for (let i = 0; i < 250_000; i++) rows.push([`AC-${String(10000 + (i % 90000)).padStart(5, '0')}`, `p${i}@x.io`, i % 500, i % 1000 === 0 ? 'TBD' : 'Active']);
  /** Loads, then counts painted frames and the longest gap while the rules run. */
  async function measure(bytes: Uint8Array, name: string) {
    const s = createWorkbook();
    s.setColumnRules({ document: README_RULES });
    const t0 = performance.now();
    await s.load(bytes, name);
    const loaded = performance.now();
    let worst = 0, last = performance.now(), frames = 0, going = true, where = '';
    const tick = () => { const t = performance.now(); if (t - last > worst) { worst = t - last; where = `+${Math.round(last - loaded)} ms, ${JSON.stringify(s.ruleProgress)}`; } last = t; frames++; if (going) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    await until(() => !s.ruleProgress, 60_000);
    going = false;
    console.log(`W-33 scale (${name}): read ${Math.round(loaded - t0)} ms; rules ${Math.round(performance.now() - loaded)} ms over ${frames} frames; longest frame gap ${Math.round(worst)} ms (${where})`);
    expect(host(s).filter((e) => e.status === 'open' && e.range.startsWith('D'))).toHaveLength(250);
    return worst;
  }
  it('250,000 rows × the README file (Accounts.csv): checked in slices, no frame gap over 50 ms', async () => {
    const csv = rows.map((r) => r.map((v) => v ?? '').join(',')).join('\n');
    const worst = await measure(new TextEncoder().encode(csv), 'Accounts.csv');
    if (budgets) expect(worst).toBeLessThan(50);
  }, 180_000);
  it('the same as .xlsx: checked in slices; the read’s own garbage collection is measured, not asserted', async () => {
    await measure(await toXlsx({ sheets: [{ name: 'Accounts', rows }] }), 'Accounts.xlsx');
  }, 180_000);
});
