import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { pluginsFromIds, type WorkbookStore } from '@sheetpane/grid';
import { styleChanges, styles } from '../src/index.js';
import { DEFAULT_FILLS, borderEdges, describe as describePatch, ui } from '../src/ui.js';
import { cellEl, featuresXlsx, frame, mount, shadow, storeWith } from './helpers.js';

afterEach(() => document.body.replaceChildren());
const $ = (el: Element, sel: string) => shadow(el).querySelector(sel) as HTMLElement;
const H = 'Holdings';

async function setup(mode: 'view' | 'edit' = 'edit') {
  const s = await storeWith(featuresXlsx(), [styles(), ui()]);
  const el = await mount(s, mode);
  return { s, el };
}
const choose = (el: Element, id: string, value: string) => {
  const sel = $(el, `select[data-control=${id}]`) as HTMLSelectElement;
  sel.value = value;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
};
const select = async (s: WorkbookStore, ref: string, range?: string) => { s.select(range ? { sheet: H, ref, range } : { sheet: H, ref }); await frame(); };
const luminance = (rgb: string) => {
  const [r, g, b] = rgb.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };

describe('the format row (W-17 DoD 4)', () => {
  it('is absent in View and present in Edit, groups in order: text · colour · fill · border · align · wrap · clear', async () => {
    const { s, el } = await setup('view');
    expect($(el, '.frow').hidden).toBe(true);
    s.setMode('edit');
    await frame();
    expect($(el, '.frow').hidden).toBe(false);
    const ids = [...shadow(el).querySelectorAll('.plug-frow [data-control]')].map((x) => (x as HTMLElement).dataset.control);
    expect(ids).toEqual([
      'styles-bold', 'styles-italic', 'styles-underline', 'styles-strike', 'styles-colour', 'styles-fill', 'styles-border',
      'styles-align-left', 'styles-align-center', 'styles-align-right', 'styles-valign-top', 'styles-valign-middle', 'styles-valign-bottom', 'styles-merge',
      'styles-wrap', 'styles-clear',
    ]);
    expect(shadow(el).querySelectorAll('.plug-frow .sep').length).toBe(6);
    expect($(el, '[data-control=styles-bold]').getAttribute('aria-label')).toBe('Bold (Mod+B)');
    expect($(el, '[data-control=styles-italic]').getAttribute('aria-label')).toBe('Italic (Mod+I)');
    expect($(el, '[data-control=styles-underline]').getAttribute('aria-label')).toBe('Underline (Mod+U)');
    expect($(el, '[data-control=styles-colour]').tagName).toBe('SELECT');
    // no font picker, ever
    expect(shadow(el).querySelector('.plug-frow')!.textContent!.toLowerCase()).not.toContain('font');
  });
  it('Bold restyles the whole selection, shows pressed, and one undo reverts it all', async () => {
    const { s, el } = await setup();
    await select(s, 'B3', 'B3:C4');
    expect($(el, '[data-control=styles-bold]').getAttribute('aria-pressed')).toBe('false');
    $(el, '[data-control=styles-bold]').click();
    await frame();
    expect(styleChanges(s.getSnapshot().changes)).toHaveLength(4);
    for (const [r, c] of [[2, 1], [2, 2], [3, 1], [3, 2]] as const) expect(cellEl(el, r, c)!.style.fontWeight).toBe('700');
    expect($(el, '[data-control=styles-bold]').getAttribute('aria-pressed')).toBe('true');
    expect($(el, '.status').textContent).toContain('Style changed · Bold');
    s.undo();
    await frame();
    expect(s.getSnapshot().changes.size).toBe(0);
    expect(cellEl(el, 2, 1)!.style.fontWeight).toBe('');
  });
  it('shortcuts run from the grid: Mod+B, Mod+I, Mod+U', async () => {
    const { s, el } = await setup();
    await select(s, 'B3');
    $(el, '.grid').focus();
    await userEvent.keyboard('{Control>}b{/Control}');
    await userEvent.keyboard('{Control>}i{/Control}');
    await userEvent.keyboard('{Control>}u{/Control}');
    expect(styleChanges(s.getSnapshot().changes).map((c) => c.patch)).toEqual([{ b: true, i: true, u: true }]);
    await frame();
    expect(cellEl(el, 2, 1)!.style.fontStyle).toBe('italic');
    expect(cellEl(el, 2, 1)!.style.textDecoration).toContain('underline');
  });
  it('colour, fill and border pickers apply to the selection; Automatic and No fill turn them off', async () => {
    const { s, el } = await setup();
    await select(s, 'B3', 'B3:C3');
    choose(el, 'styles-colour', 'C00000');
    choose(el, 'styles-fill', 'DDEBF7');
    await frame();
    expect(cellEl(el, 2, 2)!.style.color).toBe('rgb(192, 0, 0)');
    expect(cellEl(el, 2, 2)!.style.backgroundColor).toBe('rgb(221, 235, 247)');
    choose(el, 'styles-border', 'outside');
    await frame();
    expect(cellEl(el, 2, 1)!.style.borderLeft).toBe('1px solid rgb(0, 0, 0)');
    expect(cellEl(el, 2, 1)!.style.borderRight).toBe('');
    expect(cellEl(el, 2, 2)!.style.borderRight).toBe('1px solid rgb(0, 0, 0)');
    choose(el, 'styles-colour', 'auto');
    choose(el, 'styles-fill', 'none');
    choose(el, 'styles-border', 'none');
    await frame();
    expect(s.getSnapshot().changes.size).toBe(0); // back to the file look: no change left
    expect(($(el, 'select[data-control=styles-colour]') as HTMLSelectElement).value).toBe('');
  });
  it('align, wrap and clear', async () => {
    const { s, el } = await setup();
    await select(s, 'A3');
    $(el, '[data-control=styles-align-right]').click();
    $(el, '[data-control=styles-wrap]').click();
    await frame();
    expect(cellEl(el, 2, 0)!.style.textAlign).toBe('right');
    expect(cellEl(el, 2, 0)!.style.whiteSpace).toBe('pre-wrap');
    expect($(el, '[data-control=styles-align-right]').getAttribute('aria-pressed')).toBe('true');
    $(el, '[data-control=styles-clear]').click();
    await frame();
    const c = cellEl(el, 2, 0)!;
    expect([c.style.fontWeight, c.style.backgroundColor, c.style.borderBottom, c.style.textAlign]).toEqual(['', '', '', '']);
  });
});

describe('the selection bar and merges (W-17 DoD 3, 4)', () => {
  it('selbar controls (Bold, Fill, Merge) are docked in the cell bar after Flag issue; Fill applies the highlight', async () => {
    const { s, el } = await setup();
    await select(s, 'B3', 'B3:C3');
    const ids = [...shadow(el).querySelectorAll('.dock [data-control]')].map((x) => (x as HTMLElement).dataset.control);
    expect(ids).toEqual(['styles-sel-bold', 'styles-sel-fill', 'styles-sel-merge']);
    $(el, '.dock [data-control=styles-sel-fill]').click();
    await frame();
    expect(cellEl(el, 2, 1)!.style.backgroundColor).toBe('rgb(255, 242, 204)');
    $(el, '.dock [data-control=styles-sel-fill]').click();
    await frame();
    expect(cellEl(el, 2, 1)!.style.backgroundColor).toBe('');
  });
  it('Merge calls store.setMerge (a change of kind merge); the core draws it; again unmerges; undo works', async () => {
    const { s, el } = await setup();
    const spy = vi.spyOn(s, 'setMerge');
    await select(s, 'A3', 'A3:B4');
    $(el, '[data-control=styles-merge]').click();
    expect(spy).toHaveBeenCalledWith(H, 'A3:B4', true);
    expect(s.changeOf(H, '#merge:A3:B4')!.kind).toBe('merge');
    await frame();
    expect(cellEl(el, 2, 0)!.classList.contains('merge')).toBe(true);
    expect(cellEl(el, 2, 1)).toBeNull(); // covered
    await select(s, 'A3');
    expect($(el, '[data-control=styles-merge]').getAttribute('aria-pressed')).toBe('true');
    $(el, '.dock [data-control=styles-sel-merge]').click();
    expect(spy).toHaveBeenLastCalledWith(H, 'A3:B4', false);
    expect(s.merges(H)).toEqual(['A1:E1']);
    // the file's own merge unmerges too, and undo restores it
    await select(s, 'C1');
    $(el, '[data-control=styles-merge]').click();
    expect(s.merges(H)).toEqual([]);
    s.undo();
    expect(s.merges(H)).toEqual(['A1:E1']);
  });
  it('merging over an existing merge replaces it in one undo step', async () => {
    const { s } = await setup();
    s.select({ sheet: H, ref: 'D1', range: 'D1:F2' });
    ui().controls!.find((c) => c.id === 'styles-merge')!.run!(s, s.getSnapshot().selection);
    expect(s.merges(H)).toEqual(['D1:F2']);
    s.undo();
    expect(s.merges(H)).toEqual(['A1:E1']);
  });
  it('one cell, not merged: Merge does nothing', async () => {
    const { s } = await setup();
    const spy = vi.spyOn(s, 'setMerge');
    ui().controls!.find((c) => c.id === 'styles-merge')!.run!(s, { sheet: H, ref: 'C4' });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('rendering, L5 and contrast (W-17 DoD 2, 7)', () => {
  it('the file look reaches the cells; no cell style ever names a font family', async () => {
    const { s, el } = await setup();
    s.setCell(H, 'A3', 'changed');
    await frame();
    const a3 = cellEl(el, 2, 0)!;
    expect(a3.style.backgroundColor).toBe('rgb(255, 242, 204)');
    expect(a3.style.color).toBe('rgb(35, 70, 200)');
    expect(a3.style.borderBottom).toBe('1px solid rgb(0, 0, 0)');
    for (const c of shadow(el).querySelectorAll<HTMLElement>('.c')) expect(c.getAttribute('style') ?? '').not.toMatch(/font-?family/i);
    // DoD 7: on a filled cell, the changed corner mark keeps its shape and contrast against every offered fill
    expect(a3.classList.contains('chg')).toBe(true);
    const mark = getComputedStyle(a3, '::after').borderRightColor;
    for (const f of DEFAULT_FILLS) {
      const hex = f.value;
      const rgb = `rgb(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)})`;
      expect(contrast(mark, rgb), f.label).toBeGreaterThanOrEqual(3);
    }
  });
  it('the core cell layout shows what decorate says: alignment and wrap reach the text, tints sit above the fill', async () => {
    const { s, el } = await setup();
    await select(s, 'A3');
    $(el, '[data-control=styles-valign-top]').click();
    $(el, '[data-control=styles-align-right]').click();
    $(el, '[data-control=styles-wrap]').click();
    await frame();
    const a3 = cellEl(el, 2, 0)!, v = a3.querySelector('.v')!;
    expect(getComputedStyle(a3).justifyContent).toBe('flex-start'); // vertical-align: top
    expect(getComputedStyle(v).textAlign).toBe('right');
    expect(getComputedStyle(v).whiteSpace).toBe('pre-wrap');
    await select(s, 'B4', 'A3:B4');
    const r = cellEl(el, 2, 0)!;
    expect(r.getAttribute('aria-selected')).toBe('true');
    expect(getComputedStyle(r).backgroundColor).toBe('rgb(255, 242, 204)'); // the file's fill, kept
    // the range tint is the selection layer's one fill, drawn above the cells (W-46)
    const fill = el.shadowRoot!.querySelector<HTMLElement>('.sellayer .sf')!;
    expect(fill).not.toBeNull();
    expect(Number(getComputedStyle(fill).zIndex)).toBeGreaterThan(0);
  });
  it('the plugins attribute route: importing the ui entry registers styles with its controls', async () => {
    const list = pluginsFromIds(['styles']);
    expect(list.map((p) => p.id)).toEqual(['styles', 'styles-ui']);
  });
  it('helpers: border edges by position; the status wording', () => {
    const box = { top: 0, left: 0, bottom: 1, right: 1 };
    expect(borderEdges('outside', 0, 0, box)).toEqual({ top: { style: 'thin' }, left: { style: 'thin' } });
    expect(borderEdges('outside', 1, 1, box)).toEqual({ bottom: { style: 'thin' }, right: { style: 'thin' } });
    expect(borderEdges('thick-bottom', 0, 0, box)).toBeUndefined();
    expect(borderEdges('double-bottom', 1, 0, box)).toEqual({ bottom: { style: 'double' } });
    expect(describePatch({ b: true, fill: 'FFF2CC' })).toBe('Style changed · Bold, Fill');
    expect(describePatch(undefined)).toBe('');
  });
});
