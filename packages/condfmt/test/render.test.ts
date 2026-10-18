import { afterEach, describe, expect, it } from 'vitest';
import '@sheetpane/grid';
import { pluginsFromIds, type WorkbookStore } from '@sheetpane/grid';
import { styles } from '@sheetpane/styles';
import { condfmt } from '../src/index.js';
import { condfmtWithUi, legendText, statusText } from '../src/ui.js';
import { RED_DXF, cellEl, cellIs, col, colorScale, dataBar, frame, iconSet, mount, rgb, shadow, storeOf, workbook } from './helpers.js';

afterEach(() => { document.body.replaceChildren(); });

// The board's sheet: a colour scale on Price (G), data bars on Market value (H),
// a dark fill where Units (F) is greater than 1000 — and an icon set, not drawn.
const DARK_DXF = '<font><color rgb="FFFFFFFF"/></font><fill><patternFill><bgColor rgb="FF1F3864"/></patternFill></fill>';
const bytes = () => workbook({
  dxfs: [DARK_DXF, RED_DXF],
  fonts: ['<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/></font>'],
  xfs: ['<xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1"/>'],
  sheets: [{
    name: 'Holdings',
    cells: {
      F1: 'Units', G1: 'Price', H1: 'Market value',
      F2: 500, F3: 2000, F4: 800, F5: 1500,
      G2: 10, G3: 20, G4: 30, G5: 40,
      H2: 100, H3: 400, H4: 250, H5: 1000,
    },
    s: { F1: 1, G1: 1, H1: 1, F3: 1 },
    cf: [
      { sqref: 'F2:F5', rules: [cellIs('greaterThan', ['1000'], { dxfId: 0 })] },
      { sqref: 'G2:G5', rules: [colorScale([[{ type: 'min' }, 'F8696B'], [{ type: 'percentile', val: '50' }, 'FFEB84'], [{ type: 'max' }, '63BE7B']])] },
      { sqref: 'H2:H5', rules: [dataBar({ type: 'min' }, { type: 'max' })] },
      { sqref: 'H2:H5', rules: [iconSet()] },
    ],
  }],
});
const REFS = [...col('F', 1, 5), ...col('G', 1, 5), ...col('H', 1, 5)];
const at = (ref: string) => { const m = /^([A-Z])(\d+)$/.exec(ref)!; return { r: Number(m[2]) - 1, c: m[1]!.charCodeAt(0) - 65 }; };

async function pane(mode: 'view' | 'edit' = 'view', ui = false): Promise<{ s: WorkbookStore; el: HTMLElement }> {
  const s = await storeOf(bytes(), ui ? [styles(), ...condfmtWithUi()] : [styles(), condfmt()]);
  s.select({ sheet: 'Holdings', ref: 'A1' });
  const el = await mount(s, mode);
  return { s, el };
}

describe('through a real <sheetpane-excel> (DoD 6)', () => {
  it('every cell shows exactly the plugin’s fill, colour, weight and bar, cell by cell', async () => {
    const { s, el } = await pane();
    for (const ref of REFS) {
      const { r, c } = at(ref);
      const cell = cellEl(el, r, c)!;
      expect(cell, ref).toBeTruthy();
      const d = s.decorate('Holdings', ref);
      expect(cell.style.backgroundColor, ref).toBe(d['background-color'] ? rgb(d['background-color']) : '');
      expect(cell.style.color, ref).toBe(d.color ? rgb(d.color) : '');
      expect(cell.style.fontWeight, ref).toBe(d['font-weight'] ?? '');
      const img = cell.style.backgroundImage;
      if (d['background-image']) {
        const len = /transparent ([\d.]+)%\)$/.exec(d['background-image'])![1];
        expect(img, ref).toMatch(/^linear-gradient\(90deg, rgb\(99, 142, 198\) 0%/);
        expect(img, ref).toContain(`transparent ${len}%`);
      } else expect(img, ref).toBe('');
    }
    // spot checks against the board
    expect(cellEl(el, 2, 5)!.style.backgroundColor).toBe('rgb(31, 56, 100)'); // F3 = 2000 > 1000
    expect(cellEl(el, 2, 5)!.style.fontWeight).toBe('700'); // F3's own bold stays under the rule's fill
    expect(cellEl(el, 1, 5)!.style.backgroundColor).toBe(''); // F2 = 500
    expect(cellEl(el, 1, 6)!.style.backgroundColor).toBe(rgb('#F8696B')); // the lowest price
    expect(cellEl(el, 4, 6)!.style.backgroundColor).toBe(rgb('#63BE7B')); // the highest
  });
  it('the text stays the text, and the value is not touched', async () => {
    const { s, el } = await pane();
    expect(cellEl(el, 2, 5)!.querySelector('.v')!.textContent).toBe('2000');
    expect(s.changeCount).toBe(0);
  });
  it('a live edit repaints the rule’s cells', async () => {
    const { s, el } = await pane();
    s.setCell('Holdings', 'F2', '5000');
    await frame();
    expect(cellEl(el, 1, 5)!.style.backgroundColor).toBe('rgb(31, 56, 100)');
    s.setCell('Holdings', 'G5', '5'); // the scale's max moves: G4 becomes the highest
    await frame();
    expect(cellEl(el, 3, 6)!.style.backgroundColor).toBe(rgb('#63BE7B'));
    expect(cellEl(el, 4, 6)!.style.backgroundColor).toBe(rgb('#F8696B'));
  });
});

describe('Edit: a severity ring over a rule’s fill, and the fill stays (DoD 7; SR-GRID 15b)', () => {
  it('a flagged rule-filled cell keeps its fill and gets the ring and the tint above it', async () => {
    const { s, el } = await pane('edit');
    const before = cellEl(el, 2, 5)!.style.backgroundColor;
    expect(before).toBe('rgb(31, 56, 100)');
    s.addError({ sheet: 'Holdings', range: 'F3', type: 'wrong-value', severity: 'warning', expected: '200', author: 'Arpit' });
    s.select({ sheet: 'Holdings', ref: 'A1' });
    await frame();
    const cell = cellEl(el, 2, 5)!;
    expect(cell.classList.contains('m-warning')).toBe(true);
    expect(cell.style.backgroundColor).toBe(before);
    expect(getComputedStyle(cell).backgroundColor).toBe(before);
    expect(getComputedStyle(cell).boxShadow).toMatch(/inset/);
    const tint = getComputedStyle(cell, '::before');
    expect(tint.content).not.toBe('none');
    expect(tint.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    // a data-bar cell flagged as an error: the bar stays too
    s.addError({ sheet: 'Holdings', range: 'H3', type: 'wrong-value', severity: 'error', expected: '1', author: 'Arpit' });
    await frame();
    const bar = cellEl(el, 2, 7)!;
    expect(bar.classList.contains('m-error')).toBe(true);
    expect(getComputedStyle(bar).backgroundImage).toMatch(/^linear-gradient/);
    expect(getComputedStyle(bar).boxShadow).toMatch(/inset/);
  });
});

describe('the legend and the count (DoD 7)', () => {
  const tip = (el: HTMLElement) => shadow(el).querySelector<HTMLElement>('.cf-tip');
  const hover = (target: Element) => target.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, composed: true }));
  it('hovering a rule-coloured cell names the rule and its range; another cell hides it', async () => {
    const { el } = await pane('view', true);
    await frame();
    expect(tip(el)).toBeTruthy();
    expect(tip(el)!.hidden).toBe(true);
    hover(cellEl(el, 2, 5)!);
    expect(tip(el)!.hidden).toBe(false);
    expect(tip(el)!.querySelector('.cf-words')!.textContent).toBe('Conditional: greater than 1000');
    expect(tip(el)!.querySelector('.cf-range')!.textContent).toBe('F2:F5');
    // placed under the hovered cell
    const cellBox = cellEl(el, 2, 5)!.getBoundingClientRect(), tipBox = tip(el)!.getBoundingClientRect();
    expect(Math.abs(tipBox.top - (cellBox.bottom + 4))).toBeLessThan(2);
    expect(Math.abs(tipBox.left - cellBox.left)).toBeLessThan(2);
    hover(cellEl(el, 2, 6)!);
    expect(tip(el)!.querySelector('.cf-words')!.textContent).toBe('Conditional: colour scale: lowest → 50th percentile → highest');
    hover(cellEl(el, 2, 7)!);
    expect(tip(el)!.querySelector('.cf-words')!.textContent).toBe('Conditional: data bar: lowest → highest');
    hover(cellEl(el, 1, 5)!); // F2 = 500: in the range, the rule does not hold
    expect(tip(el)!.hidden).toBe(true);
    hover(cellEl(el, 2, 5)!);
    hover(cellEl(el, 0, 0)!);
    expect(tip(el)!.hidden).toBe(true);
  });
  it('the legend layer lets clicks through to the cells', async () => {
    const { s, el } = await pane('view', true);
    await frame();
    const layer = tip(el)!.closest('.olay') as HTMLElement;
    expect(layer.style.pointerEvents).toBe('none');
    expect(layer.getAttribute('role')).toBe('group');
    expect(layer.getAttribute('aria-label')).toBe('Conditional formatting legend');
    const box = cellEl(el, 2, 5)!.getBoundingClientRect();
    const hit = shadow(el).elementFromPoint(box.left + 5, box.top + 5);
    expect(hit?.closest('[role="gridcell"]')?.id).toBe('c2_5');
    expect(s.getSnapshot().selection.ref).toBe('A1');
  });
  it('the selected cell’s rules show in the cell bar (keyboard and screen readers reach them)', async () => {
    const { s, el } = await pane('view', true);
    s.select({ sheet: 'Holdings', ref: 'F3' });
    await frame();
    const t = shadow(el).querySelector('[data-control="condfmt-legend"]');
    expect(t?.textContent).toBe('Conditional: greater than 1000 · F2:F5');
    expect(legendText(s, 'Holdings', 'F3')).toBe('Conditional: greater than 1000 · F2:F5');
    s.select({ sheet: 'Holdings', ref: 'F2' });
    await frame();
    expect(shadow(el).querySelector('[data-control="condfmt-legend"]')).toBeNull(); // absent when empty
  });
  it('the status line counts the file’s rules and the ones not shown', async () => {
    const { s, el } = await pane('view', true);
    await frame();
    expect(statusText(s.getSnapshot())).toBe('4 conditional rules from the file · 1 not shown');
    expect(shadow(el).querySelector('.status')!.textContent).toContain('4 conditional rules from the file · 1 not shown');
    s.setMode('edit');
    await frame();
    expect(shadow(el).querySelector('.status')!.textContent).toContain('4 conditional rules from the file · 1 not shown');
  });
  it('one rule, nothing skipped: singular, no tail; a file without rules: no text', async () => {
    const one = await storeOf(workbook({ dxfs: [RED_DXF], sheets: [{ cells: { A1: 5 }, cf: [{ sqref: 'A1', rules: [cellIs('greaterThan', ['1'], { dxfId: 0 })] }] }] }), condfmtWithUi());
    one.decorate('Data', 'A1');
    expect(statusText(one.getSnapshot())).toBe('1 conditional rule from the file');
    const none = await storeOf(workbook({ sheets: [{ cells: { A1: 5 } }] }), condfmtWithUi());
    expect(statusText(none.getSnapshot())).toBe('');
  });
  it('importing ./ui makes plugins="condfmt" the plugin and its UI', () => {
    expect(pluginsFromIds(['condfmt']).map((p) => p.id)).toEqual(['condfmt', 'condfmt-ui']);
  });
});
