import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { cellRef, toXlsx } from '@sheetpane/export';
import { createWorkbook, registerPlugin, type Plugin, type SheetpaneExcel, type SheetpaneErrors } from '../src/index.js';
import { cellEl, cleanup, frame, mountExcel, sampleXlsx, shadow } from './helpers.js';

afterEach(cleanup);
const $ = (el: Element, sel: string) => shadow(el).querySelector(sel) as HTMLElement;

const fmt: Plugin = { id: 'fmt', provides: ['format'], format: (c) => (typeof c.value === 'number' ? `#${c.value}` : undefined) };
const bold: Plugin = { id: 'bold', provides: ['decorate'], decorate: (c) => (c.ref === 'A2' ? { 'font-weight': '700', color: 'rgb(255, 0, 0)' } : undefined) };
const blue: Plugin = { id: 'blue', provides: ['decorate'], after: ['bold'], decorate: (c) => (c.ref === 'A2' ? { color: 'rgb(0, 0, 255)' } : undefined) };
const twice: Plugin = { id: 'twice', provides: ['derive'], derive: (input, ctx) => {
  if (input.kind === 'load') return [];
  return input.cells.filter((c) => c.sheet === 'Holdings' && c.ref === 'F3').map((c) => ({ sheet: 'Holdings', ref: 'H3', value: Number(c.value) * 2, text: String(Number(c.value) * 2) }));
} };
const positive: Plugin = { id: 'positive', provides: ['validate'], validate: (sheet, ctx) => {
  if (sheet !== 'Holdings') return [];
  const out = [];
  for (let r = 2; r < 15; r++) { const ref = cellRef(r, 5); const v = ctx.store.value(sheet, ref); if (typeof v === 'number' && v < 0) out.push({ sheet, range: ref, type: 'validation', severity: 'warning' as const, found: String(v), expected: '≥ 0', message: 'Units must be positive', author: 'workbook' }); }
  return out;
} };
const box: Plugin = { id: 'box', provides: ['overlay'], overlay: (sheet, ctx) => sheet === 'Holdings' ? [{ id: 'b1', sheet, rect: { x: ctx.geometry.colX(2), y: ctx.geometry.rowY(3), width: 40, height: 20 }, alt: 'a box', render: () => Object.assign(document.createElement('span'), { textContent: 'BOX' }) }] : [] };
let exported = 0;
const extra: Plugin = { id: 'extra', provides: ['exportPatch'], exportPatch: (p) => { exported++; p.write('xl/extra.xml', '<x/>'); } };
const ui: Plugin = { id: 'ui', provides: [], controls: [
  { id: 'ui-bold', slot: 'format-row', group: 'text', label: 'Bold', shortcut: 'Mod+B', mode: 'edit', isActive: () => false, run: (s, sel) => s.setChange(sel.sheet, sel.ref, 'style', { b: true }, undefined) },
  { id: 'ui-sel', slot: 'selbar', group: 'x', label: 'Shout', mode: 'edit', run: () => {} },
  { id: 'ui-cb', slot: 'cellbar', group: 'x', label: 'fx', mode: 'both' },
  { id: 'ui-status', slot: 'status', group: 'x', label: 'Sum', mode: 'both', text: (snap, sel) => `Sum ${sel.ref}` },
  { id: 'ui-mark', slot: 'cell', group: 'x', label: 'Choose', mode: 'edit', appliesTo: (c) => c.ref === 'J3', run: (s, sel) => s.setCell(sel.sheet, sel.ref, 'picked') },
] };

describe('registration (W-14 DoD 1, 2)', () => {
  it('a single-provider hook with two providers throws, naming both', () => {
    expect(() => createWorkbook({ plugins: [fmt, { ...fmt, id: 'fmt2' }] })).toThrow(/"format" has one provider per pane — fmt and fmt2/);
    expect(() => createWorkbook({ plugins: [fmt, { ...fmt, id: 'fmt2' }] })).toThrow(/^SP-3006: Hook has one provider per pane — /); // W-40
    expect(() => createWorkbook({ plugins: [twice, { ...twice, id: 't2' }] })).toThrow(/derive/);
  });
  it('a duplicate control id, a missing hook function or a decorate loop throws', () => {
    expect(() => createWorkbook({ plugins: [ui, { id: 'ui2', provides: [], controls: [ui.controls![0]!] }] })).toThrow(/two controls share the id "ui-bold"/);
    expect(() => createWorkbook({ plugins: [{ id: 'x', provides: ['format'] }] })).toThrow(/no format\(\) function/);
    expect(() => createWorkbook({ plugins: [{ ...bold, after: ['blue'] }, blue] })).toThrow(/loops/);
  });
  it('the plugins attribute enables only listed, registered plugins; an unknown id throws', async () => {
    registerPlugin('fmt', () => fmt);
    registerPlugin('bold', () => bold);
    const el = await mountExcel({ plugins: 'fmt' });
    expect(el.workbook!.pluginIds).toEqual(['fmt']);
    expect(() => createWorkbook({ plugins: [] }).pluginIds).not.toThrow();
    const bad = document.createElement('sheetpane-excel');
    bad.setAttribute('plugins', 'nope');
    let reported = '';
    const onErr = (e: ErrorEvent) => { reported = e.message; e.preventDefault(); };
    addEventListener('error', onErr);
    document.body.append(bad); // a custom element's connectedCallback error is reported, not thrown to append()
    removeEventListener('error', onErr);
    expect(reported).toMatch(/no plugin "nope" is registered/);
  });
});

describe('the six hooks (W-14 DoD 1, 4, 5)', () => {
  it('format: every numeric cell goes through it', async () => {
    const s = createWorkbook({ plugins: [fmt] });
    await s.load(await sampleXlsx(), 's.xlsx');
    expect(s.text('Holdings', 'F3')).toBe('#1200');
    s.setCell('Holdings', 'F3', '5');
    expect(s.text('Holdings', 'F3')).toBe('#5');
    expect(s.text('Holdings', 'A3')).toBe('AC-10021');
  });
  it('decorate: ordered by after, later wins per property; font-family is refused', async () => {
    const s = createWorkbook({ plugins: [blue, bold] });
    await s.load(await sampleXlsx(), 's.xlsx');
    expect(s.decorate('Holdings', 'A2')).toEqual({ 'font-weight': '700', color: 'rgb(0, 0, 255)' });
    const bad = createWorkbook({ plugins: [{ id: 'serif', provides: ['decorate'], decorate: () => ({ 'font-family': 'serif' } as never) }] });
    await bad.load(await sampleXlsx(), 's.xlsx');
    expect(() => bad.decorate('Holdings', 'A2')).toThrow(/font-family/);
  });
  it('derive: derived cells are marked, never in the change map or the count; undo re-derives', async () => {
    const el = await mountExcel({}, undefined);
    const s = createWorkbook({ plugins: [twice] });
    el.workbook = s;
    await s.load(await sampleXlsx(), 's.xlsx');
    s.setCell('Holdings', 'F3', '10');
    await frame();
    expect(s.text('Holdings', 'H3')).toBe('20');
    expect(s.changeCount).toBe(1);
    expect(s.getSnapshot().changes.has('Holdings!H3')).toBe(false);
    expect(cellEl(el, 2, 7)!.classList.contains('derived')).toBe(true);
    s.undo();
    await frame();
    expect(s.text('Holdings', 'H3')).toBe('2400');
  });
  it('validate: workbook errors appear on load, resolve themselves when the cell passes, reopen when it fails again', async () => {
    const s = createWorkbook({ plugins: [positive] });
    await s.load(await sampleXlsx(), 's.xlsx');
    expect(s.getErrors()).toMatchObject([{ range: 'F10', author: 'workbook', status: 'open', type: 'validation', found: '-150' }]);
    s.setCell('Holdings', 'F10', '150');
    expect(s.getErrors()[0]!.status).toBe('resolved');
    s.setCell('Holdings', 'F10', '-1');
    expect(s.getErrors()[0]!.status).toBe('open');
    // a person's error never auto-resolves (B-022)
    s.addError({ sheet: 'Holdings', range: 'F11', type: 'other', severity: 'error', expected: '1' });
    s.setCell('Holdings', 'F11', '1');
    expect(s.getErrors()[1]!.status).toBe('open');
  });
  it('validate after setErrors: a restored person’s error with the same id is never taken over; a restored rule error is adopted, not doubled', async () => {
    const s = createWorkbook({ plugins: [positive] });
    await s.load(await sampleXlsx(), 's.xlsx');
    const rule = s.getErrors()[0]!; // ERR-0001, the plugin's own
    const person = { ...rule, range: 'C3', type: 'wrong-value', author: 'Arpit', found: '268.40', expected: '268.50', message: 'Price is stale' };
    s.setErrors([person]);
    s.setCell('Holdings', 'F10', '-2'); // the rule fires again
    const after = s.getErrors();
    expect(after.find((e) => e.id === 'ERR-0001')).toMatchObject({ range: 'C3', author: 'Arpit', message: 'Price is stale', found: '268.40' });
    expect(after.filter((e) => e.author === 'workbook')).toMatchObject([{ id: 'ERR-0002', range: 'F10', found: '-2' }]);
    // restoring a review that already holds the rule's error: adopted, not added twice
    s.setErrors([person, { ...rule, id: 'ERR-0007' }]);
    expect(s.getErrors().filter((e) => e.author === 'workbook').map((e) => e.id)).toEqual(['ERR-0007']);
    s.setCell('Holdings', 'F10', '5');
    expect(s.getErrors().find((e) => e.id === 'ERR-0007')!.status).toBe('resolved');
  });
  it('overlay: items drawn in sheet space, under pins', async () => {
    const el = await mountExcel();
    const s = createWorkbook({ plugins: [box] });
    el.workbook = s;
    await s.load(await sampleXlsx(), 's.xlsx');
    await frame();
    const item = $(el, '.overlay .plug .olay');
    expect(item.textContent).toBe('BOX');
    expect(item.getAttribute('aria-label')).toBe('a box');
    expect(item.getBoundingClientRect().left - cellEl(el, 3, 2)!.getBoundingClientRect().left).toBeCloseTo(0, 0);
  });
  it('overlay: role, a name that follows the item, pointer pass-through; geometry keeps growing past the drawn columns', async () => {
    let name = 'loading';
    const live: Plugin = { id: 'live', provides: ['overlay'], overlay: (sheet, ctx) => {
      const g = ctx.geometry;
      expect(g.colX(200) - g.colX(199)).toBe(64); // far past the data: x grows, 64 px a column
      expect(g.colWidth(200)).toBe(64);
      return sheet === 'Holdings' ? [
        { id: 'grp', sheet, rect: { x: g.colX(2), y: g.rowY(3), width: 40, height: 20 }, alt: name, role: 'group' as const, render: () => document.createElement('span') },
        { id: 'line', sheet, rect: { x: g.colX(4), y: g.rowY(3), width: 40, height: 20 }, passThrough: true, render: () => document.createElement('span') },
      ] : [];
    } };
    const el = await mountExcel();
    const s = createWorkbook({ plugins: [live] });
    el.workbook = s;
    await s.load(await sampleXlsx(), 's.xlsx');
    await frame();
    const [grp, line] = [...shadow(el).querySelectorAll<HTMLElement>('.overlay .plug .olay')];
    expect(grp!.getAttribute('role')).toBe('group');
    expect(grp!.getAttribute('aria-label')).toBe('loading');
    expect(line!.getAttribute('role')).toBe('img');
    expect(line!.hasAttribute('aria-label')).toBe(false);
    expect(line!.style.pointerEvents).toBe('none');
    expect(grp!.style.pointerEvents).toBe('auto');
    name = 'Sales and costs';
    s.select({ sheet: 'Holdings', ref: 'B2' });
    await frame();
    expect(grp!.getAttribute('aria-label')).toBe('Sales and costs');
  });
  it('the grid reaches a drawing anchored past the data', async () => {
    const { sheetGeometry } = await import('../src/excel/geometry.js');
    const sh = { name: 'S', rows: [[1, 2]], text: [['1', '2']], drawings: [{ kind: 'chart', anchor: 'twoCell', from: { col: 4, colOff: 0, row: 2, rowOff: 0 }, to: { col: 11, colOff: 9525, row: 40, rowOff: 0 }, name: 'Chart 1', descr: '' }] } as never;
    const g = sheetGeometry(sh);
    expect(g.cols).toBe(12); // to.col 11 with an offset reaches into column L (index 11)
    expect(g.rows).toBe(40); // to.row 40 at offset 0 ends at row 41's top edge
  });
  it('exportPatch: runs inside patchXlsx after the core', async () => {
    const s = createWorkbook({ plugins: [extra] });
    await s.load(await sampleXlsx(), 's.xlsx');
    await s.exportFile();
    expect(exported).toBe(1);
  });
  it('the change map carries a kind; sheetpane-change carries it', async () => {
    const el = await mountExcel({ mode: 'edit' });
    const kinds: string[] = [];
    el.addEventListener('sheetpane-change', (e) => kinds.push((e as CustomEvent).detail.kind));
    el.workbook!.setChange('Holdings', 'A3', 'style', { b: true }, undefined, el);
    el.workbook!.setCell('Holdings', 'A3', 'x', { origin: el });
    expect(kinds).toEqual(['style', 'value']);
    expect(el.workbook!.changeOf('Holdings', 'A3')!.kind).toBe('value');
    expect(el.workbook!.changeOf('Holdings', 'A3', 'style')).toMatchObject({ kind: 'style', now: { b: true } }); // its own slot
    expect(el.workbook!.changesAt('Holdings', 'A3')).toHaveLength(2);
  });
});

describe('the six slots (W-14 DoD 3, 8)', () => {
  it('renders controls as labelled buttons; format-row only in Edit; shortcuts run and are listed', async () => {
    const el = await mountExcel({ mode: 'view' });
    const s = createWorkbook({ plugins: [ui] });
    el.workbook = s;
    await s.load(await sampleXlsx(), 's.xlsx');
    await frame();
    expect($(el, '.frow').hidden).toBe(true);
    expect($(el, '.plug-cellbar [data-control=ui-cb]').getAttribute('aria-label')).toBe('fx');
    expect($(el, '.status').textContent).toContain('Sum A1');
    s.setMode('edit');
    s.select({ sheet: 'Holdings', ref: 'B3' });
    await frame();
    expect($(el, '.frow').hidden).toBe(false);
    expect($(el, '[data-control=ui-bold]').getAttribute('aria-label')).toBe('Bold (Mod+B)');
    expect($(el, '.dock [data-control=ui-sel]')).not.toBeNull();
    $(el, '.grid').focus();
    await userEvent.keyboard('{Control>}b{/Control}');
    expect(s.changeOf('Holdings', 'B3', 'style')!.kind).toBe('style');
    ($(el, '.help') as HTMLButtonElement).click();
    await frame();
    expect($(el, '.card.help').textContent).toContain('Mod+B');
    const mk = cellEl(el, 2, 9)!.querySelector('.mk') as HTMLElement;
    mk.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
    expect(s.text('Holdings', 'J3')).toBe('picked');
  });
  it('the host gets a light-DOM format-row slot', async () => {
    const el = await mountExcel({ mode: 'edit' });
    const b = document.createElement('button');
    b.slot = 'format-row'; b.textContent = 'Host action';
    el.append(b);
    await frame(); await frame();
    expect($(el, '.frow').hidden).toBe(false);
    expect(b.assignedSlot).not.toBeNull();
  });
  it('with no plugin, the grid carries no plugin control, row or mark (DoD 7)', async () => {
    const el = await mountExcel({ mode: 'edit' });
    await frame();
    expect($(el, '.frow').hidden).toBe(true);
    expect(shadow(el).querySelectorAll('[data-control], .mk, .olay, .c.derived').length).toBe(0);
    expect([...shadow(el).querySelectorAll('.dock button')].map((b) => b.getAttribute('aria-label'))).toEqual(['Flag issue (F)', 'More actions (Shift+F10)']);
  });
});

describe('undo across elements (W-23 DoD 3, 4)', () => {
  it('Undo in the errors pane reverts an edit made in the sheet; Revert is itself undoable', async () => {
    const excel = document.createElement('sheetpane-excel') as SheetpaneExcel;
    excel.setAttribute('pane', 'u1'); excel.setAttribute('mode', 'edit');
    const errors = document.createElement('sheetpane-errors') as SheetpaneErrors;
    errors.setAttribute('pane', 'u1');
    document.body.append(excel, errors);
    await excel.load(await sampleXlsx(), 's.xlsx');
    excel.select('Holdings', 'G7');
    await frame();
    await userEvent.fill($(excel, '.cell') as HTMLInputElement, '268.4');
    await userEvent.keyboard('{Enter}');
    await frame();
    ($(errors, '[data-act=undo]') as HTMLButtonElement).click();
    expect(excel.workbook!.text('Holdings', 'G7')).toBe('286.4');
    await frame();
    ($(errors, '[data-act=redo]') as HTMLButtonElement).click();
    expect(excel.workbook!.text('Holdings', 'G7')).toBe('268.4');
    excel.select('Holdings', 'G7');
    await frame();
    ($(excel, '.revert') as HTMLButtonElement).click();
    expect(excel.workbook!.text('Holdings', 'G7')).toBe('286.4');
    excel.undo();
    expect(excel.workbook!.text('Holdings', 'G7')).toBe('268.4');
    let hist: unknown;
    errors.addEventListener('sheetpane-history', (e) => { hist = (e as CustomEvent).detail; });
    errors.setErrors([]);
    expect(hist).toMatchObject({ reason: 'cleared', canUndo: false });
  });
});

describe('freeze panes (W-24 DoD 2, 3, 5)', () => {
  it('reads <pane>, keeps frozen rows and columns in place while scrolling, toggles as an undoable change', async () => {
    const rows = Array.from({ length: 400 }, (_, r) => Array.from({ length: 12 }, (_, c) => (r === 0 ? `H${c}` : r * 100 + c)));
    const el = await mountExcel({ mode: 'edit' }, await toXlsx({ sheets: [{ name: 'Big', rows, freeze: { rows: 1, cols: 1 } }] }), 'big.xlsx');
    await frame();
    const head = () => cellEl(el, 0, 3)!.getBoundingClientRect().top;
    const left = () => cellEl(el, 150, 0)?.getBoundingClientRect().left;
    const top0 = head();
    const sc = $(el, '.scroller');
    sc.scrollTop = 4000; sc.scrollLeft = 300;
    await frame();
    expect(head()).toBeCloseTo(top0, 0);
    expect(left()).toBeCloseTo($(el, '.scroller').getBoundingClientRect().left + 52 + 1, -1);
    // arrows move through frozen and scrolling cells as one grid
    el.select('Big', 'A2');
    $(el, '.grid').focus();
    await userEvent.keyboard('{ArrowUp}{ArrowRight}');
    expect(el.workbook!.getSnapshot().selection.ref).toBe('B1');
    // toggle
    ($(el, '.freeze') as HTMLButtonElement).click();
    expect(el.workbook!.freeze('Big')).toEqual({ rows: 0, cols: 0 });
    expect(el.workbook!.changeOf('Big', '#freeze')!.kind).toBe('freeze');
    el.undo();
    expect(el.workbook!.freeze('Big')).toEqual({ rows: 1, cols: 1 });
  });
});

describe('W-01 DoD 15 — stale marks and the pivot badge', () => {
  it('marks a formula reading a changed cell "may be stale"; badges a pivot range', async () => {
    const { minimalPackage } = await import('../../export/test/helpers.js');
    const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const pkg = minimalPackage(`<worksheet xmlns="${NS}"><sheetData><row r="1"><c r="A1"><v>2</v></c><c r="B1"><f>A1*2</f><v>4</v></c></row></sheetData></worksheet>`, {
      'xl/worksheets/_rels/sheet1.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/pivotTable" Target="../pivotTables/pivotTable1.xml"/></Relationships>`,
      'xl/pivotTables/pivotTable1.xml': `<pivotTableDefinition xmlns="${NS}" name="P1"><location ref="D3:E8"/></pivotTableDefinition>`,
    });
    const el = await mountExcel({ mode: 'edit' }, pkg, 'f.xlsx');
    el.workbook!.setCell('Data', 'A1', '5');
    await frame();
    expect(cellEl(el, 0, 1)!.classList.contains('stale')).toBe(true);
    expect(cellEl(el, 0, 1)!.title).toContain('May be stale');
    expect($(el, '.badge').textContent).toBe('pivot table — refreshes in Excel');
  });
});

describe('core support the plugins build on', () => {
  it('merge changes: drawn by the core, undoable, written to <mergeCells> on export', async () => {
    const el = await mountExcel({ mode: 'edit' });
    const s = el.workbook!;
    s.setMerge('Holdings', 'B3:C3', true);
    await frame();
    expect(cellEl(el, 2, 1)!.classList.contains('merge')).toBe(true);
    expect(cellEl(el, 2, 2)).toBeNull();
    const { read } = await import('@sheetpane/import');
    const back = await read(new Uint8Array(await (await s.exportFile()).blob.arrayBuffer()), { name: 'x.xlsx' });
    expect(back.sheets[0]!.merges!.sort()).toEqual(['A1:J1', 'B3:C3']);
    s.setMerge('Holdings', 'A1:J1', false);
    expect(s.merges('Holdings')).toEqual(['B3:C3']);
    s.undo(); s.undo();
    expect(s.merges('Holdings')).toEqual(['A1:J1']);
  });
  it('a control with options renders as a select and chooses', async () => {
    let chosen = '';
    const p: Plugin = { id: 'pick', provides: [], controls: [{ id: 'fmt-menu', slot: 'format-row', group: 'n', label: 'Number format', mode: 'edit', options: () => [{ value: 'g', label: 'General' }, { value: 'p', label: 'Percent' }], value: () => 'g', choose: (_s, _sel, v) => { chosen = v; } }] };
    const el = await mountExcel({ mode: 'edit' });
    const s = createWorkbook({ plugins: [p] });
    el.workbook = s;
    await s.load(await sampleXlsx(), 's.xlsx');
    s.setMode('edit');
    await frame();
    const sel = $(el, 'select[data-control=fmt-menu]') as HTMLSelectElement;
    expect(sel.getAttribute('aria-label')).toBe('Number format');
    sel.value = 'p';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(chosen).toBe('p');
  });
  it('a cell control with cellOptions opens a menu; picking calls choose', async () => {
    const p: Plugin = { id: 'list', provides: [], controls: [{ id: 'list-arrow', slot: 'cell', group: 'v', label: 'Choose a value', mode: 'edit', appliesTo: (c) => c.ref === 'J3', cellOptions: () => ['Core', 'Income'], choose: (s, sel, v) => s.setCell(sel.sheet, sel.ref, v) }] };
    const el = await mountExcel({ mode: 'edit' });
    const s = createWorkbook({ plugins: [p] });
    el.workbook = s;
    await s.load(await sampleXlsx(), 's.xlsx');
    s.setMode('edit');
    await frame();
    cellEl(el, 2, 9)!.querySelector('.mk')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
    await frame();
    const opts = [...shadow(el).querySelectorAll('.menu [data-act=pick-option]')] as HTMLButtonElement[];
    expect(opts.map((o) => o.textContent)).toEqual(['Core', 'Income']);
    opts[1]!.click();
    expect(s.text('Holdings', 'J3')).toBe('Income');
  });
  it('with a derive plugin, typing =… is a formula change', async () => {
    const s = createWorkbook({ plugins: [twice] });
    await s.load(await sampleXlsx(), 's.xlsx');
    s.setCell('Holdings', 'H3', '=F3*G3');
    expect(s.changeOf('Holdings', 'H3')!.kind).toBe('formula');
    const plain = createWorkbook();
    await plain.load(await sampleXlsx(), 's.xlsx');
    plain.setCell('Holdings', 'H3', '=F3*G3');
    expect(plain.changeOf('Holdings', 'H3')!.kind).toBe('value');
  });
});

describe('core fixes the plugin builds asked for', () => {
  const rule: Plugin = { id: 'rule', provides: ['validate'], validate: (sheet, ctx) => {
    if (sheet !== 'Holdings') return [];
    const limit = Number(ctx.store.value('Fee tiers', 'C3')); // reads another sheet
    const v = ctx.store.value('Holdings', 'H3');
    return typeof v === 'number' && v > limit ? [{ sheet, range: 'H3', type: 'validation', severity: 'warning', found: ctx.store.text(sheet, 'H3'), expected: `≤ ${limit}`, message: 'over the cap', author: 'workbook' }] : [];
  } };
  it('workbook errors: read-only in both elements, a square ⚠ pin at the right edge, a built-in type name', async () => {
    const excel = document.createElement('sheetpane-excel') as SheetpaneExcel;
    const errors = document.createElement('sheetpane-errors') as SheetpaneErrors;
    const s = createWorkbook({ plugins: [rule] });
    excel.workbook = errors.workbook = s;
    excel.setAttribute('mode', 'edit');
    document.body.append(excel, errors);
    await s.load(await sampleXlsx(), 's.xlsx');
    s.setMode('edit');
    s.setCell('Fee tiers', 'C3', '100000'); // H3 = 322080 is now over the cap on the other sheet
    s.select({ sheet: 'Holdings', ref: 'H3' });
    await frame();
    expect(s.getErrors()).toMatchObject([{ range: 'H3', status: 'open', found: '322080' }]);
    const pin = $(excel, '.pin.square');
    expect(pin.textContent).toBe('⚠');
    expect(pin.getBoundingClientRect().right).toBeCloseTo(cellEl(excel, 2, 7)!.getBoundingClientRect().right, -1);
    expect($(excel, '.callout [data-act=resolve]')).toBeNull();
    expect($(excel, '.callout').textContent).toContain('Workbook rule');
    ($(errors, '.issue') as HTMLButtonElement).click();
    await frame();
    expect($(errors, '[data-act=resolve]')).toBeNull();
    expect($(errors, '.ty').textContent).toBe('Workbook rule');
    s.setCell('Holdings', 'H3', '400000');
    expect(s.getErrors()[0]!.found).toBe('400000'); // found follows the cell for machine-authored errors
    s.setCell('Fee tiers', 'C3', '500000');
    expect(s.getErrors()[0]!.status).toBe('resolved'); // an edit on the other sheet re-validates
  });
  it('a typed formula reads as its derived result', async () => {
    const calc: Plugin = { id: 'calc', provides: ['derive'], derive: (input) => input.kind === 'change' ? input.cells.filter((c) => c.ref === 'H3').map((c) => ({ sheet: c.sheet, ref: c.ref, value: 42, text: '42' })) : [] };
    const s = createWorkbook({ plugins: [calc] });
    await s.load(await sampleXlsx(), 's.xlsx');
    s.setCell('Holdings', 'H3', '=F3*G3');
    await new Promise((r) => setTimeout(r, 0));
    expect(s.value('Holdings', 'H3')).toBe(42);
    expect(s.text('Holdings', 'H3')).toBe('42');
    expect(s.changeOf('Holdings', 'H3')!.now).toBe('=F3*G3');
  });
  it('Alt+↓ opens a cell menu and arrows move through it', async () => {
    const p: Plugin = { id: 'list2', provides: [], controls: [{ id: 'list2-arrow', slot: 'cell', group: 'v', label: 'Choose', mode: 'edit', appliesTo: (c) => c.ref === 'B3', cellOptions: () => ['one', 'two'], choose: (s, sel, v) => s.setCell(sel.sheet, sel.ref, v) }] };
    const el = await mountExcel({ mode: 'edit' });
    const s = createWorkbook({ plugins: [p] });
    el.workbook = s;
    await s.load(await sampleXlsx(), 's.xlsx');
    s.setMode('edit');
    el.select('Holdings', 'B3');
    await frame();
    $(el, '.grid').focus();
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    await frame();
    expect(shadow(el).activeElement?.textContent).toBe('one');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(s.text('Holdings', 'B3')).toBe('two');
  });
});

describe('export options reach exportPatch', () => {
  it('export({ comments: false }) arrives as ctx.exportOptions', async () => {
    let seen: unknown;
    const p: Plugin = { id: 'opt', provides: ['exportPatch'], exportPatch: (_patch, ctx) => { seen = ctx.exportOptions; } };
    const el = await mountExcel();
    el.workbook = createWorkbook({ plugins: [p] });
    await el.workbook.load(await sampleXlsx(), 's.xlsx');
    el.addEventListener('sheetpane-export', (e) => e.preventDefault());
    await el.export({ comments: false });
    expect(seen).toEqual({ comments: false });
  });
});
