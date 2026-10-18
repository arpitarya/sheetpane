// W-27: column rules by title — the four-column example (Name, Email, Age, Status) in a real browser.
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createWorkbook, describeRule, type ColumnRules, type RuleContext, type SheetpaneExcel, type ValidateFn } from '../src/index.js';
import { cleanup, frame, shadow, until } from './helpers.js';

afterEach(cleanup);

const PEOPLE = ['Name,Email,Age,Status', 'Ada,ada@x.io,36,Active', 'Bo,bo@x,17,Active', ',cy@x.io,44,Gone', 'Di,ada@x.io,51,Inactive'].join('\n');
const RULES: ColumnRules = {
  Name: { required: true },
  Email: { pattern: '^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$', unique: true },
  age: { type: 'integer', min: 18, max: 99 }, // titles match trimmed and case-insensitive
  Status: { oneOf: ['Active', 'Inactive'] },
};
const csv = (text: string) => new TextEncoder().encode(text);
async function people(columns: ColumnRules = RULES, extra: { validate?: ValidateFn; onInvalid?: 'flag' | 'block' } = {}, text = PEOPLE) {
  const s = createWorkbook();
  s.setColumnRules({ columns, ...extra });
  await s.load(csv(text), 'people.csv');
  await until(() => !s.ruleProgress);
  return s;
}
const hostErrors = (s: ReturnType<typeof createWorkbook>) => s.getErrors().filter((e) => e.author === 'host');
const openAt = (s: ReturnType<typeof createWorkbook>, range: string) => hostErrors(s).find((e) => e.range === range && e.status === 'open');

describe('the JSON vocabulary (DoD 1, 4)', () => {
  it('load checks every row; each failure is a host error whose message names the rule', async () => {
    const s = await people();
    const open = hostErrors(s).filter((e) => e.status === 'open').map((e) => [e.range, e.message]);
    expect(open).toEqual([
      ['B3', 'Email: does not match the expected format (pattern)'],
      ['C3', 'Age: must be at least 18 (min)'],
      ['A4', 'Name: a value is required (required)'],
      ['D4', 'Status: must be one of Active, Inactive (oneOf)'],
      ['B2', 'Email: “ada@x.io” appears more than once (unique)'],
      ['B5', 'Email: “ada@x.io” appears more than once (unique)'],
    ].sort((a, b) => hostErrors(s).findIndex((e) => e.range === a[0]) - hostErrors(s).findIndex((e) => e.range === b[0])));
    expect(openAt(s, 'C3')).toMatchObject({ type: 'column-rule', severity: 'error', found: '17', expected: 'a whole number from 18 to 99' });
    expect(openAt(s, 'A4')!.found).toBe('(blank)');
    expect(s.changeCount).toBe(0); // a rule never edits a cell
  });

  it('every rule kind: required, type, min/max, lengths, pattern, oneOf, unique, message, severity', () => {
    expect(describeRule({ type: 'number', min: 1 })).toBe('a number of at least 1');
    expect(describeRule({ minLength: 2, maxLength: 5, required: true })).toBe('2–5 characters; required');
    expect(describeRule({ type: 'date', max: '2026-12-31' })).toBe('a date of at most 2026-12-31');
    expect(describeRule({ oneOf: ['a', 2, true], unique: true })).toBe('one of a, 2, true; unique in the column');
  });

  it('type, lengths, dates, booleans, a custom message and severity', async () => {
    const s = await people({
      N: { type: 'number' }, I: { type: 'integer' }, D: { type: 'date', min: '2026-01-01' }, B: { type: 'boolean' },
      T: { minLength: 2, maxLength: 3, message: 'Code is 2–3 letters', severity: 'warning' },
    }, {}, ['N,I,D,B,T', '1.5,2,2026-03-01,TRUE,ab', 'x,2.5,2025-12-31,maybe,abcd', '"1,200",3,soon,false,a'].join('\n'));
    const open = Object.fromEntries(hostErrors(s).filter((e) => e.status === 'open').map((e) => [e.range, e.message]));
    expect(open).toEqual({
      A3: 'N: must be a number (type: number)',
      B3: 'I: must be a whole number (type: integer)',
      C3: 'D: must be at least 2026-01-01 (min)',
      D3: 'B: must be TRUE or FALSE (type: boolean)',
      E3: 'Code is 2–3 letters',
      C4: 'D: must be a date (type: date)',
      E4: 'Code is 2–3 letters',
    });
    expect(openAt(s, 'E3')!.severity).toBe('warning');
  });

  it('a bad pattern throws at once; a pattern is not tested on values over 10,000 characters', async () => {
    const s = createWorkbook();
    expect(() => s.setColumnRules({ columns: { X: { pattern: '(' } } })).toThrow(/"X" column rule's pattern/);
    expect(() => s.setColumnRules({ columns: { X: { pattern: '(' } } })).toThrow(expect.objectContaining({ code: 'SP-6001', name: 'TypeError' })); // W-40
    const long = 'a'.repeat(10_001);
    const t = await people({ X: { pattern: '^b' } }, {}, `X\n${long}\na`);
    expect(hostErrors(t).filter((e) => e.status === 'open').map((e) => e.range)).toEqual(['A3']);
  });
});

describe('commit and undo (DoD 3, 4)', () => {
  it('a fix resolves the error by itself; breaking it again reopens it; undo too', async () => {
    const s = await people();
    s.setCell('people', 'C3', '18');
    expect(hostErrors(s).find((e) => e.range === 'C3')!.status).toBe('resolved');
    s.setCell('people', 'C3', '100');
    expect(openAt(s, 'C3')).toMatchObject({ found: '100', message: 'Age: must be at most 99 (max)' });
    s.undo();
    expect(hostErrors(s).find((e) => e.range === 'C3')!.status).toBe('resolved');
  });

  it('unique: fixing one duplicate resolves both; making a new one flags both', async () => {
    const s = await people();
    s.setCell('people', 'B5', 'di@x.io');
    expect(openAt(s, 'B2')).toBeUndefined();
    expect(openAt(s, 'B5')).toBeUndefined();
    s.setCell('people', 'B4', 'DI@x.io '); // case and spaces do not make it different
    expect(openAt(s, 'B4')).toBeDefined();
    expect(openAt(s, 'B5')).toBeDefined();
  });

  it('host errors survive setErrors() like any other, and are adopted rather than doubled', async () => {
    const s = await people();
    const saved = s.getErrors();
    s.setErrors(saved);
    expect(hostErrors(s).map((e) => e.id).sort()).toEqual(saved.filter((e) => e.author === 'host').map((e) => e.id).sort());
    s.setCell('people', 'C3', '20');
    expect(s.getErrors().find((e) => e.range === 'C3')!.status).toBe('resolved');
  });
});

describe('validate(ctx, signal) (DoD 2)', () => {
  it('sync: rowValues by title for cross-column checks; re-asked when another cell of the row changes', async () => {
    const seen: RuleContext[] = [];
    const validate: ValidateFn = (ctx) => {
      seen.push(ctx);
      return ctx.column.header === 'Status' && ctx.value === 'Active' && Number(ctx.rowValues.Age) < 18 ? { severity: 'warning', message: 'A minor cannot be Active' } : null;
    };
    const s = await people({}, { validate });
    expect(seen.find((c) => c.ref === 'D3')).toMatchObject({ phase: 'load', column: { index: 3, letter: 'D', header: 'Status' }, rowValues: { Name: 'Bo', Email: 'bo@x', Age: '17', Status: 'Active' } });
    expect(openAt(s, 'D3')).toMatchObject({ severity: 'warning', message: 'A minor cannot be Active' });
    s.setCell('people', 'C3', '30'); // the Age cell: the row is asked again, Status passes
    expect(seen.some((c) => c.phase === 'commit' && c.ref === 'D3')).toBe(true);
    expect(openAt(s, 'D3')).toBeUndefined();
  });

  it('async: results land later; a newer edit aborts the older check and its stale result is dropped', async () => {
    const taken = new Set(['bo@x']);
    const pending: { email: string; resolve: () => void; signal: AbortSignal }[] = [];
    const validate: ValidateFn = (ctx, signal) => {
      if (ctx.column.header !== 'Email') return null;
      const email = String(ctx.value);
      if (ctx.phase === 'load') return taken.has(email) ? { message: 'Email already used' } : null;
      return new Promise((resolve) => pending.push({ email, signal, resolve: () => resolve(taken.has(email) ? { message: 'Email already used' } : null) }));
    };
    const s = await people({}, { validate });
    expect(openAt(s, 'B3')!.message).toBe('Email already used');
    s.setCell('people', 'B2', 'bo@x'); // slow check #1
    s.setCell('people', 'B2', 'fresh@x.io'); // check #2 aborts #1
    const [first, second] = pending.filter((p) => p.email === 'bo@x' || p.email === 'fresh@x.io');
    expect(first!.signal.aborted).toBe(true);
    second!.resolve();
    first!.resolve(); // arrives last, but it is stale
    await frame();
    expect(openAt(s, 'B2')).toBeUndefined();
  });
});

describe('headers (DoD 6)', () => {
  it('a missing title is one note, a duplicated title another; the first column wins; the file loads anyway', async () => {
    const s = await people({ Phone: { required: true }, Age: { type: 'integer' } }, {}, 'Name,Age,Age\nAda,x,5');
    const notes = hostErrors(s).filter((e) => e.severity === 'note').map((e) => [e.range, e.message]);
    expect(notes).toEqual([
      ['C1', 'Two columns are titled “Age” — the rules check column B, the first'],
      ['A1', 'No column is titled “Phone” — its rule is not checked'],
    ]);
    expect(openAt(s, 'B2')!.message).toBe('Age: must be a whole number (type: integer)');
    expect(s.getSnapshot().load.status).toBe('ready');
  });

  it('header-row: titles in another row', async () => {
    const s = createWorkbook();
    s.setColumnRules({ columns: { Age: { type: 'integer' } }, headerRow: 2 });
    await s.load(csv('Q3 export,\nName,Age\nAda,x'), 'p.csv');
    await until(() => !s.ruleProgress);
    expect(hostErrors(s).filter((e) => e.status === 'open').map((e) => e.range)).toEqual(['B3']);
  });

  it('rules changed after load: re-checked; host errors no longer produced are removed; people’s errors stay', async () => {
    const s = await people();
    s.addError({ sheet: 'people', range: 'A2', type: 'other', severity: 'note', expected: '', message: 'check spelling', author: 'Arpit' });
    s.setColumnRules({ columns: { Age: { type: 'integer', min: 18 } } });
    await until(() => !s.ruleProgress);
    expect(hostErrors(s).map((e) => e.range)).toEqual(['C3']);
    expect(s.getErrors().find((e) => e.author === 'Arpit')).toBeDefined();
    s.setColumnRules({});
    await until(() => hostErrors(s).length === 0);
  });
});

async function mountPeople(attrs: Record<string, string>, columns: ColumnRules = RULES): Promise<{ el: SheetpaneExcel; errors: HTMLElement }> {
  const el = document.createElement('sheetpane-excel');
  el.style.height = '500px';
  for (const [k, v] of Object.entries({ pane: 'rules', mode: 'edit', ...attrs })) el.setAttribute(k, v);
  const errors = document.createElement('sheetpane-errors');
  errors.setAttribute('pane', 'rules');
  document.body.append(el, errors);
  el.columns = columns;
  await el.load(csv(PEOPLE), 'people.csv');
  await until(() => !el.workbook!.ruleProgress);
  await frame();
  return { el, errors };
}
const typeInto = async (el: SheetpaneExcel, ref: string, text: string) => {
  el.workbook!.select({ sheet: 'people', ref });
  await frame();
  const input = shadow(el).querySelector<HTMLInputElement>('input.cell')!;
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input'));
  return input;
};

describe('in <sheetpane-excel> (DoD 3, 5, 8, 9)', () => {
  it('input phase: after 150 ms an outline and a message; nothing is stored', async () => {
    const { el } = await mountPeople({});
    const input = await typeInto(el, 'C2', '12');
    const chip = shadow(el).querySelector<HTMLElement>('.rulemsg')!;
    await until(() => !chip.hidden);
    expect(chip.textContent).toBe('✕ Age: must be at least 18 (min)');
    expect(input.hasAttribute('aria-invalid')).toBe(true);
    expect(input.title).toBe('Age: must be at least 18 (min)');
    expect(el.workbook!.changeCount).toBe(0);
    input.value = '40';
    input.dispatchEvent(new Event('input'));
    await until(() => chip.hidden === true);
  });

  it('flag (the default): the value is stored and an error added', async () => {
    const { el } = await mountPeople({});
    const input = await typeInto(el, 'C2', '12');
    await userEvent.keyboard('{Enter}');
    expect(el.workbook!.value('people', 'C2')).toBe('12');
    expect(openAt(el.workbook!, 'C2')).toBeDefined();
    void input;
  });

  it('block: refused through beforechange — never stored, the message stays, editcancel says why', async () => {
    const { el } = await mountPeople({}, { ...RULES, Age: { type: 'integer', min: 18, onInvalid: 'block' } });
    const cancels: unknown[] = [];
    el.addEventListener('sheetpane-editcancel', (e) => cancels.push((e as CustomEvent).detail));
    const changes: unknown[] = [];
    el.addEventListener('sheetpane-change', (e) => changes.push((e as CustomEvent).detail));
    await typeInto(el, 'C2', '12');
    await userEvent.keyboard('{Enter}');
    expect(el.workbook!.value('people', 'C2')).toBe('36');
    expect(el.workbook!.changeCount).toBe(0);
    expect(changes).toEqual([]);
    expect(cancels).toEqual([{ sheet: 'people', ref: 'C2', reason: 'blocked', code: 'SP-6003', message: 'Age: must be at least 18 (min)' }]);
    // the element-wide default
    el.columns = { Status: { oneOf: ['Active', 'Inactive'] } };
    el.onInvalid = 'block';
    await until(() => !el.workbook!.ruleProgress);
    await typeInto(el, 'D2', 'Gone');
    await userEvent.keyboard('{Enter}');
    expect(el.workbook!.value('people', 'D2')).toBe('Active');
  });

  it('the error list shows host errors read-only, under a Column rules filter', async () => {
    const { errors } = await mountPeople({});
    await frame();
    const buttons = [...shadow(errors).querySelectorAll<HTMLButtonElement>('[data-act=author]')].map((b) => b.textContent);
    expect(buttons).toEqual(['Anyone', 'Column rules']);
    shadow(errors).querySelector<HTMLElement>('[data-act=pick]')!.click();
    await frame();
    expect(shadow(errors).querySelector('.detail')!.textContent).toContain('Column rule');
    expect(shadow(errors).querySelector('[data-act=resolve]')).toBeNull();
  });
});

describe('scale (DoD 7)', () => {
  it('250,000 rows × four rules: checked in slices — the page keeps painting', async () => {
    const rows = ['Name,Email,Age,Status'];
    for (let i = 0; i < 250_000; i++) rows.push(`P${i},p${i}@x.io,${18 + (i % 80)},${i % 1000 === 0 ? 'Gone' : 'Active'}`);
    const s = createWorkbook();
    s.setColumnRules({ columns: RULES });
    const t0 = performance.now();
    await s.load(csv(rows.join('\n')), 'big.csv');
    const loaded = performance.now();
    let frames = 0, worst = 0, last = performance.now();
    let going = true;
    const tick = () => { const t = performance.now(); worst = Math.max(worst, t - last); last = t; frames++; if (going) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    await until(() => !s.ruleProgress, 60_000);
    going = false;
    const done = performance.now();
    console.log(`W-27 scale: read ${Math.round(loaded - t0)} ms; rules ${Math.round(done - loaded)} ms over ${frames} frames; longest frame gap ${Math.round(worst)} ms`);
    expect(hostErrors(s).filter((e) => e.status === 'open')).toHaveLength(250);
    expect(frames).toBeGreaterThan(2);
  }, 120_000);
});
