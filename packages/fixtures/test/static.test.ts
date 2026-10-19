// W-67 DoD 2, the browser side: every case opened in `<sheetpane-excel>` (Chromium) in Edit, with
// the plugins that format, decorate and check, the one edit made; then for every sheet, in both
// themes, `renderStatic()` of the element's own workbook is put in the page and each of its cells
// is compared with the grid's cell of the same ref — computed text, colours, weight, style, size,
// alignment, borders, padding, the mark's ring and tint, width and height — and so are the headers.
// The HTML itself equals golden/static.json, which `static.node.test.ts` renders in Node.
import { afterEach, describe, expect, it } from 'vitest';
import type { SheetpaneExcel } from '@sheetpane/grid';
import { renderStatic } from '@sheetpane/grid/static';
import '@sheetpane/comments';
import '@sheetpane/condfmt';
import '@sheetpane/numfmt';
import '@sheetpane/styles';
import '@sheetpane/validation';
import goldenText from './golden/static.json?raw';
import { edit, PLUGIN_IDS, staticCases, type Rendered } from './static.js';

const turn = () => new Promise<void>((r) => setTimeout(r, 0));
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
afterEach(() => document.body.replaceChildren());

type RGB = [number, number, number, number];
const rgb = (c: string): RGB => { const m = /rgba?\(([^)]+)\)/.exec(c); const p = (m?.[1] ?? '0,0,0,0').split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0]!, p[1]!, p[2]!, p[3] ?? 1]; };
/** The grid's tint (`::before`, its colour at its opacity) laid over the cell's own background — what the static cell's background must be. */
function tinted(cell: Element): RGB {
  const base = rgb(getComputedStyle(cell).backgroundColor), b = getComputedStyle(cell, '::before');
  const soft = rgb(b.backgroundColor), a = Number(b.opacity) * soft[3];
  return [0, 1, 2].map((i) => Math.round(soft[i]! * a + base[i]! * (1 - a))).concat(1) as RGB;
}
const near = (a: RGB, b: RGB) => a.every((x, i) => Math.abs(x - b[i]!) <= (i === 3 ? 0.01 : 1));
/** One spelling for values that draw alike: `start` is `left` in a left-to-right page (mail clients know `left`). */
const same = (v: string) => (v === 'start' ? 'left' : v === 'end' ? 'right' : v);
const VALIGN: Record<string, string> = { 'flex-start': 'top', 'flex-end': 'bottom', center: 'middle', normal: 'middle' };

/** The properties compared on the element that holds the cell's box. */
const BOX = ['textAlign', 'whiteSpace', 'textDecorationLine', 'paddingLeft', 'paddingRight', 'boxShadow',
  'borderTopWidth', 'borderTopStyle', 'borderTopColor', 'borderRightWidth', 'borderRightStyle', 'borderRightColor',
  'borderBottomWidth', 'borderBottomStyle', 'borderBottomColor', 'borderLeftWidth', 'borderLeftStyle', 'borderLeftColor', 'backgroundImage'] as const;
/** … and on the element that holds its text. */
const TEXT = ['color', 'fontWeight', 'fontStyle', 'fontSize', 'fontVariantNumeric'] as const;

describe('renderStatic() looks like the grid (W-67 DoD 2)', () => {
  it('every cell and header of every sheet, light and dark, matches the grid’s computed style; the HTML equals the Node golden', async () => {
    const golden = JSON.parse(goldenText) as Rendered;
    const got: Rendered = {};
    let cells = 0, marked = 0, merged = 0, results = 0;
    for (const c of await staticCases()) {
      const el = document.createElement('sheetpane-excel') as SheetpaneExcel;
      el.setAttribute('plugins', PLUGIN_IDS.join(' '));
      el.style.cssText = 'display:block;height:2400px;width:1260px';
      document.body.append(el);
      el.rules = c.rules;
      await el.load(await c.data(), c.name);
      const store = el.workbook!;
      edit(c.id, store);
      store.setMode('edit');
      for (let i = 0; i < 3; i++) { while (store.ruleProgress !== undefined) await turn(); await turn(); }
      for (const s of store.book!.sheets) {
        if (store.hidden(s.name).state !== 'visible') store.setSheetState(s.name, 'visible'); // the grid draws a hidden sheet once shown; the static copy draws it as asked
        store.select({ sheet: s.name, ref: 'A1' });
        for (const theme of ['light', 'dark'] as const) {
          el.theme = theme;
          await frame(); await frame();
          const html = renderStatic(store, { sheet: s.name, theme });
          got[`${c.id}|${s.name}|${theme}`] = html;
          const host = document.createElement('div');
          host.innerHTML = html;
          document.body.append(host);
          const root = el.shadowRoot!;
          const where = `${c.id} ${s.name} ${theme}`;
          for (const td of host.querySelectorAll<HTMLTableCellElement>('tbody td[data-sp-ref]')) {
            const ref = td.dataset.spRef!, at = `${where} ${ref}`;
            const gc = root.querySelector<HTMLElement>(`.c[data-sp-ref="${ref}"]`);
            expect(gc, `${at}: the grid draws the cell`).not.toBeNull();
            const gv = gc!.querySelector('.v')!, sv = td.querySelector<HTMLElement>('[data-sp-v]')!;
            const sText = [...sv.childNodes].filter((n) => !(n instanceof HTMLElement && n.dataset.spStale !== undefined)).map((n) => n.textContent).join('');
            expect(sText, `${at} text`).toBe(gv.textContent);
            const g = getComputedStyle(gc!), t = getComputedStyle(td);
            // the changed corner (the grid's ::after triangle) is the static cell's first background layer
            const corner = /^linear-gradient\(225deg, (rgb\([^)]*\)) 5px, rgba\(0, 0, 0, 0\) 5px\)(?:, )?/.exec(t.backgroundImage);
            expect(corner?.[1], `${at} changed corner`).toBe(gc!.classList.contains('chg') ? getComputedStyle(gc!, '::after').borderRightColor : undefined);
            const image = t.backgroundImage.slice(corner?.[0].length ?? 0) || 'none';
            expect(image, `${at} backgroundImage`).toBe(g.backgroundImage);
            for (const p of BOX) if (p !== 'backgroundImage') expect(same(t[p]), `${at} ${p}`).toBe(same(g[p]));
            const gt = getComputedStyle(gv), st = getComputedStyle(sv);
            for (const p of TEXT) expect(st[p], `${at} ${p}`).toBe(gt[p]);
            expect(t.verticalAlign, `${at} vertical-align`).toBe(VALIGN[g.justifyContent]);
            const mark = [...gc!.classList].find((k) => k.startsWith('m-'))?.slice(2);
            expect(td.dataset.spMark === 'resolved' ? 'pass' : td.dataset.spMark, `${at} mark`).toBe(mark);
            const bg = rgb(t.backgroundColor);
            expect(near(bg, mark && mark !== 'pass' ? tinted(gc!) : rgb(g.backgroundColor)), `${at} background ${t.backgroundColor}`).toBe(true);
            // a result's corner glyph (W-50): the same kind, glyph, colour and label as the grid's
            const sres = td.querySelector<HTMLElement>('[data-sp-result]'), gres = gc!.querySelector<HTMLElement>('.rmk');
            expect(sres?.dataset.spResult, `${at} result`).toBe(gres ? [...gres.classList].find((k) => k !== 'rmk') : undefined);
            if (sres && gres) {
              expect([sres.textContent, sres.getAttribute('aria-label')], `${at} result glyph`).toEqual([gres.textContent, gres.getAttribute('aria-label')]);
              for (const p of ['color', 'fontSize', 'fontWeight'] as const) expect(getComputedStyle(sres)[p], `${at} result ${p}`).toBe(getComputedStyle(gres)[p]);
              results++;
            }
            expect(td.dataset.spChanged !== undefined, `${at} changed`).toBe(gc!.classList.contains('chg'));
            expect(td.querySelector('[data-sp-stale]') !== null, `${at} stale`).toBe(gc!.classList.contains('stale'));
            const gr = gc!.getBoundingClientRect(), sr = td.getBoundingClientRect();
            expect(Math.abs(sr.width - gr.width), `${at} width ${sr.width} vs ${gr.width}`).toBeLessThanOrEqual(1);
            expect(Math.abs(sr.height - gr.height), `${at} height ${sr.height} vs ${gr.height}`).toBeLessThanOrEqual(1);
            cells++; if (mark) marked++; if (td.colSpan > 1 || td.rowSpan > 1) merged++;
          }
          for (const th of host.querySelectorAll<HTMLElement>('th[data-sp-col]')) {
            const gh = root.querySelector<HTMLElement>(`.ch[data-hc="${th.dataset.spCol}"]`)!, at = `${where} column ${th.dataset.spCol}`;
            expect(th.textContent, at).toBe(gh.firstChild!.textContent);
            if (gh.classList.contains('on')) continue; // the selected cell's header is highlighted — a live state, not the sheet's look
            for (const p of ['backgroundColor', 'color', 'fontSize', 'fontWeight', 'borderRightColor', 'borderBottomColor'] as const) expect(getComputedStyle(th)[p], `${at} ${p}`).toBe(getComputedStyle(gh)[p]);
          }
          for (const th of host.querySelectorAll<HTMLElement>('th[data-sp-row]')) {
            const gh = root.querySelector<HTMLElement>(`.rh[data-hr="${th.dataset.spRow}"]`)!, at = `${where} row ${th.dataset.spRow}`;
            expect(th.textContent!.replace(/^\S+ /, ''), at).toBe(String(Number(th.dataset.spRow) + 1));
            expect(th.querySelector('[data-sp-badge]') !== null, `${at} glyph`).toBe(gh.querySelector('.g') !== null);
            if (gh.classList.contains('on')) continue;
            for (const p of ['backgroundColor', 'color', 'fontSize', 'borderRightColor', 'borderBottomColor'] as const) expect(getComputedStyle(th)[p], `${at} ${p}`).toBe(getComputedStyle(gh)[p]);
          }
          host.remove();
        }
      }
      el.remove();
    }
    expect(cells).toBeGreaterThan(250);
    expect(marked).toBeGreaterThan(5);
    expect(merged).toBeGreaterThan(0);
    expect(results).toBeGreaterThanOrEqual(6); // A2, A4, A5 on Numbers, light and dark
    expect(got).toEqual(golden);
  }, 180_000);
});
