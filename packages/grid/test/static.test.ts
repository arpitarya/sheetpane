// W-67: renderStatic() — what it leaves out, how it marks, what it refuses (DoD 1), and DoD 3: an
// escaping fuzz. Whatever a file, a plugin or a host puts in a cell's text, a sheet's name, an
// error or a decorate value, the output parses to exactly one <table> of the allowed elements and
// attributes, carries no script, event handler, URL or font, and every text reads back unchanged.
// (Fidelity against the grid's computed styles: packages/fixtures/test/static.test.ts.)
import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { toXlsx, type Cell } from '@sheetpane/export';
import { createWorkbook, type Plugin, type SheetpaneError, type StyleSubset } from '../src/index.js';
import { renderStatic, STATIC_MARKS, TOKENS, DARK_TOKENS } from '../src/static.js';
import { cleanup } from './helpers.js';

afterEach(cleanup);

const turn = () => new Promise<void>((r) => setTimeout(r, 0));
async function bookOf(rows: Cell[][], o: { name?: string; merges?: string[]; plugins?: Plugin[] } = {}) {
  const store = createWorkbook({ plugins: o.plugins ?? [] });
  await store.load(await toXlsx({ sheets: [{ name: o.name ?? 'Data', rows, ...(o.merges ? { merges: o.merges } : {}) }] }), 'w.xlsx');
  await turn();
  return store;
}
const parse = (html: string) => { const t = document.createElement('template'); t.innerHTML = html; return t.content; };
const err = (range: string, severity: SheetpaneError['severity'], message: string, more: Partial<SheetpaneError> = {}): SheetpaneError => ({
  v: 1, id: 'ERR-0001', sheet: 'Data', range, type: 'wrong-value', severity, found: '', expected: '', message, cellChanged: false, status: 'open', matchesExpected: false, author: 'host', createdAt: '2026-10-19T00:00:00Z', ...more,
});

describe('renderStatic() (W-67)', () => {
  const ROWS: Cell[][] = [['Name', 'Units', 'Price'], ['a', 1, 2], ['b', 3, 4], ['c', 5, 6], ['d', 7, 8]];

  it('the used range by default, a given range, no headers; hidden rows and columns left out', async () => {
    const book = await bookOf(ROWS);
    expect(parse(renderStatic(book)).querySelector('table')!.dataset.spRange).toBe('A1:C5');
    const part = parse(renderStatic(book, { range: 'B2:C3', headers: false }));
    expect([...part.querySelectorAll('td')].map((td) => td.dataset.spRef)).toEqual(['B2', 'C2', 'B3', 'C3']);
    expect(part.querySelector('th')).toBeNull();
    book.setHidden('Data', 'rows', [2], true);
    book.setHidden('Data', 'cols', [1], true);
    const out = parse(renderStatic(book));
    expect([...out.querySelectorAll('th[data-sp-row]')].map((th) => th.textContent)).toEqual(['1', '2', '4', '5']);
    expect([...out.querySelectorAll('th[data-sp-col]')].map((th) => th.textContent)).toEqual(['A', 'C']);
    expect(out.querySelector('td[data-sp-ref="B1"], td[data-sp-ref="A3"]')).toBeNull();
    expect(out.querySelectorAll('col')).toHaveLength(3);
  });

  it('a merge is one cell spanning its shown rows and columns, clipped to the range, holding its top-left value', async () => {
    const book = await bookOf([['Title', null, null], ['x', 'y', 'z'], ['p', 'q', 'r']], { merges: ['A1:C2'] });
    let td = parse(renderStatic(book)).querySelector<HTMLTableCellElement>('td[data-sp-ref="A1"]')!;
    expect([td.colSpan, td.rowSpan, td.textContent]).toEqual([3, 2, 'Title']);
    book.setHidden('Data', 'cols', [1], true);
    td = parse(renderStatic(book, { range: 'B2:C3' })).querySelector<HTMLTableCellElement>('td[data-sp-ref="A1"]')!;
    expect([td.colSpan, td.rowSpan, td.textContent]).toEqual([1, 1, 'Title']);
  });

  it('marks: ring, tint, a numbered glyph in the cell and a labelled line in the footer; the higher rank wins a shared cell', async () => {
    const book = await bookOf(ROWS);
    const errors = [err('B3', 'note', 'just so you know'), err('B3', 'error', 'negative', { expected: '3' }), err('C2:C3', 'warning', 'check'), err('A5', 'error', 'fixed', { status: 'resolved' }), err('Z99', 'error', 'elsewhere')];
    const out = parse(renderStatic(book, { errors }));
    const mark = (ref: string) => out.querySelector<HTMLElement>(`td[data-sp-ref="${ref}"]`)!.dataset.spMark;
    expect([mark('B3'), mark('C2'), mark('C3'), mark('A5'), mark('A2')]).toEqual(['error', 'warning', 'warning', 'resolved', undefined]);
    const b3 = out.querySelector<HTMLElement>('td[data-sp-ref="B3"]')!;
    expect(b3.style.boxShadow).toContain('1.5px');
    expect(b3.style.backgroundColor).not.toBe(out.querySelector<HTMLElement>('td[data-sp-ref="A2"]')!.style.backgroundColor);
    expect([...b3.querySelectorAll('[data-sp-badge]')].map((b) => b.textContent)).toEqual(['i2', '✕3']); // numbered in reading order (row, column, type, message): C2 is 1
    const notes = [...out.querySelectorAll('[data-sp-note]')].map((n) => n.textContent);
    expect(notes).toEqual(['!1 Warning · C2:C3 · Wrong value — check', 'i2 Note · B3 · Wrong value — just so you know', '✕3 Error · B3 · Wrong value — negative · should be 3', '✓4 Resolved · A5 · Wrong value — fixed']);
    expect(out.querySelector('th[data-sp-row="2"] [data-sp-badge]')!.getAttribute('aria-label')).toBe('Error');
    expect(out.querySelector('th[data-sp-row="4"] [data-sp-badge]')).toBeNull(); // a resolved error marks its cell, not its row
    expect(Object.keys(STATIC_MARKS)).toEqual(['error', 'warning', 'note', 'resolved']);
    // the workbook's own errors by default; [] marks nothing
    book.addError({ sheet: 'Data', range: 'A2', type: 'other', severity: 'warning', message: 'own' });
    expect(parse(renderStatic(book)).querySelector('td[data-sp-ref="A2"]')!.getAttribute('data-sp-mark')).toBe('warning');
    expect(parse(renderStatic(book, { errors: [] })).querySelector('[data-sp-mark], tfoot')).toBeNull();
  });

  it('the theme: light and dark tokens as inline colours; a decorate fill as saved in both', async () => {
    const fill: Plugin = { id: 'st-fill', provides: ['decorate'], decorate: (c) => (c.ref === 'A2' ? { 'background-color': '#123456', color: 'var(--sp-accent)' } : undefined) };
    const book = await bookOf(ROWS, { plugins: [fill] });
    for (const [theme, T] of [['light', TOKENS], ['dark', { ...TOKENS, ...DARK_TOKENS }]] as const) {
      const out = parse(renderStatic(book, { theme }));
      const probe = document.createElement('div'); probe.style.color = T.cell; probe.style.backgroundColor = T.accent;
      expect(out.querySelector<HTMLElement>('td[data-sp-ref="B2"]')!.style.backgroundColor).toBe(probe.style.color);
      const a2 = out.querySelector<HTMLElement>('td[data-sp-ref="A2"]')!;
      expect(a2.style.backgroundColor).toBe('rgb(18, 52, 86)');
      expect(a2.style.color).toBe(probe.style.backgroundColor); // var(--sp-accent) resolved to the theme
    }
  });

  it('a decorate value that loads or escapes is dropped; a font family throws SP-3010 as in the grid; a derived value and an overlay plugin', async () => {
    const bad: Plugin = { id: 'st-bad', provides: ['decorate'], decorate: () => ({ 'background-image': 'url(https://example.com/x.png)', color: 'red;background:url(x)', 'font-weight': '700', position: 'fixed' }) as StyleSubset };
    const derive: Plugin = { id: 'st-derive', provides: ['derive'], derive: (i) => (i.kind === 'load' ? [{ sheet: 'Data', ref: 'D1', value: 42, text: '42.0' }] : []) };
    const overlay: Plugin = { id: 'st-pics', provides: ['overlay'], overlay: () => [] };
    const book = await bookOf(ROWS, { plugins: [bad, derive, overlay] });
    await turn();
    const html = renderStatic(book, { range: 'A1:D2' });
    expect(html).not.toMatch(/url\(|position|red;/);
    const out = parse(html);
    expect(out.querySelector<HTMLElement>('td[data-sp-ref="A1"]')!.style.fontWeight).toBe('700');
    const d1 = out.querySelector<HTMLElement>('td[data-sp-ref="D1"] [data-sp-v]')!;
    expect([d1.textContent, d1.style.color]).toEqual(['42.0', 'rgb(26, 54, 160)']);
    expect(out.querySelector('table')!.dataset.spSkipped).toBe('st-pics');
    expect(out.querySelector('[data-sp-skipped-note]')!.textContent).toContain('st-pics');
    const font: Plugin = { id: 'st-font', provides: ['decorate'], decorate: () => ({ ['font-family' as 'color']: 'serif' }) };
    const fonted = await bookOf(ROWS, { plugins: [font] });
    expect(() => renderStatic(fonted)).toThrow(/^SP-3010: /);
  });

  it('refuses what it cannot draw: SP-3017, SP-3018', async () => {
    expect(() => renderStatic(createWorkbook())).toThrow(/^SP-3017: /);
    const book = await bookOf(ROWS);
    expect(() => renderStatic(book, { sheet: 'Other' })).toThrow(/^SP-3018: .*Other/);
    expect(() => renderStatic(book, { range: 'nonsense' })).toThrow(/^SP-3018: /);
  });
});

describe('W-67 DoD 3 — nothing a file, a plugin or a host says escapes the table', () => {
  const ALLOWED_TAGS = new Set(['TABLE', 'COLGROUP', 'COL', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'SPAN', 'DIV', 'B']);
  const ALLOWED_ATTRS = /^(style|scope|rowspan|colspan|title|aria-label|data-sp-[a-z-]+)$/;
  const nasty = fc.oneof(
    fc.string({ unit: 'binary', maxLength: 40 }),
    fc.constantFrom('<script>alert(1)</script>', '"><img src=x onerror=alert(1)>', "'; color:red", '</td></tr></table><b>x', '&amp;&lt;', '<!--', ']]>', 'url(javascript:1)', 'expression(alert(1))', ' \u0000￿', '{{x}}', 'var(--sp-ink)'),
    fc.string({ unit: fc.constantFrom('<', '>', '&', '"', "'", '/', '=', ';', ':', '(', ')', ' ', 'a', 'u', 'r', 'l', '\\'), maxLength: 30 }),
  );
  // a sheet name the writer accepts: 1–31 characters, none of [ ] : * ? / \
  const sheetName = nasty.map((s) => s.replace(/[[\]:*?/\\\u0000-\u001F\uD800-\uDFFF￾￿]/g, '').slice(0, 31)).filter((s) => s.trim().length > 0 && !s.startsWith("'") && !s.endsWith("'"));

  it('every text reads back unchanged; only the allowed elements and attributes; no script, handler, URL or font', async () => {
    await fc.assert(fc.asyncProperty(sheetName, fc.array(nasty, { minLength: 1, maxLength: 6 }), nasty, nasty, nasty, async (name, texts, message, cssValue, typeId) => {
      const shown = (ref: string) => `${texts[(ref.charCodeAt(0) + Number(ref.slice(1))) % texts.length]}`;
      const plugin: Plugin = {
        id: 'fz', provides: ['format', 'decorate'],
        format: (c) => shown(c.ref),
        decorate: (c) => (c.col === 0 ? { color: cssValue, 'background-image': cssValue, 'text-align': cssValue } : { 'background-color': cssValue }),
      };
      const store = createWorkbook({ plugins: [plugin] });
      await store.load(await toXlsx({ sheets: [{ name, rows: [[1, 2], [3, 4]] }] }), 'f.xlsx');
      const errors = [err('A1:B1', 'error', message, { sheet: name, type: typeId, expected: message }), err('B2', 'note', typeId, { sheet: name })];
      const html = renderStatic(store, { sheet: name, errors });
      const out = parse(html);
      expect(out.children).toHaveLength(1);
      const table = out.firstElementChild as HTMLTableElement;
      expect(table.tagName).toBe('TABLE');
      expect(table.dataset.spSheet).toBe(name);
      for (const el of table.querySelectorAll('*')) {
        expect(ALLOWED_TAGS.has(el.tagName), el.tagName).toBe(true);
        for (const a of el.attributes) expect(ALLOWED_ATTRS.test(a.name), a.name).toBe(true);
      }
      for (const el of [table, ...table.querySelectorAll<HTMLElement>('[style]')]) expect(el.getAttribute('style')).not.toMatch(/url\(|expression|font-family|javascript|@import|\\/i);
      // HTML has no NUL: the parser reads it as U+FFFD, so that is what is written
      const read = (t: string) => t.replace(/\0/g, '\uFFFD');
      for (const ref of ['A1', 'B1', 'A2', 'B2']) expect(table.querySelector(`td[data-sp-ref="${ref}"] [data-sp-v]`)!.textContent).toBe(read(shown(ref)));
      const notes = [...table.querySelectorAll('[data-sp-note]')].map((n) => n.textContent!);
      expect(notes[0]).toContain(read(message));
      expect(notes[1]).toContain(read(typeId));
    }), { numRuns: 150 });
  }, 60_000);
});
