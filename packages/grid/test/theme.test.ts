import { afterEach, describe, expect, it } from 'vitest';
import { DARK_TOKENS, registerPlugin, TOKENS, TOKENS_CSS, type Plugin, type TokenName } from '../src/index.js';
import { cellEl, cleanup, frame, mountExcel, shadow } from './helpers.js';

afterEach(cleanup);

// WCAG 2 relative luminance and contrast ratio, from a #RRGGBB token.
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number]; return (x + 0.05) / (y + 0.05); };

const THEMES = { light: TOKENS as Record<TokenName, string>, dark: { ...TOKENS, ...DARK_TOKENS } as Record<TokenName, string> };

describe('the token table (W-29 DoD 2, 3, 6)', () => {
  it('every token has a dark value, every colour is hex (no color-mix at runtime) and none names a font', () => {
    for (const k of Object.keys(TOKENS) as TokenName[]) {
      if (/^r(-|$)/.test(k)) continue; // radii are not colours
      expect(DARK_TOKENS[k], k).toBeDefined();
    }
    for (const t of Object.values(THEMES)) for (const [k, v] of Object.entries(t)) if (!/^r(-|$)|shadow/.test(k)) expect(v, k).toMatch(/^#[0-9A-F]{6}$/);
    expect(TOKENS_CSS).not.toMatch(/font|color-mix/);
  });
});

describe('contrast (W-29 DoD 5)', () => {
  for (const [name, t] of Object.entries(THEMES)) {
    it(`${name}: text 4.5:1 on every ground it sits on`, () => {
      for (const ground of ['cell', 'surface', 'head', 'ground'] as const)
        for (const ink of ['ink', 'ink-2', 'ink-3'] as const) expect(ratio(t[ink], t[ground]), `${ink} on ${ground}`).toBeGreaterThanOrEqual(4.5);
      // sunken carries segments, chips and badges: ink and ink-2 only (ink-3 never sits on it)
      for (const ink of ['ink', 'ink-2'] as const) expect(ratio(t[ink], t.sunken), `${ink} on sunken`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t['accent-ink'], t.cell), 'derived text').toBeGreaterThanOrEqual(4.5);
      expect(ratio(t['accent-ink'], t['accent-soft']), 'accent-ink on accent-soft').toBeGreaterThanOrEqual(4.5);
      for (const s of ['pass', 'fail', 'warn'] as const) expect(ratio(t[s], t[`${s}-soft`]), `${s} on ${s}-soft`).toBeGreaterThanOrEqual(4.5);
    });
    it(`${name}: glyphs, pins, the changed mark, references and the focus ring 3:1 against the cell`, () => {
      for (const k of ['accent', 'pass', 'fail', 'warn', 'changed', 'note', 'ref-1', 'ref-2', 'ref-3'] as const) {
        expect(ratio(t[k], t.cell), `${k} on cell`).toBeGreaterThanOrEqual(3);
        expect(ratio(t['on-solid'], t[k]), `on-solid on ${k}`).toBeGreaterThanOrEqual(3);
      }
      expect(ratio(t.ink, t.hit), 'text on a find hit').toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.ink, t['hit-current']), 'text on the current hit').toBeGreaterThanOrEqual(4.5);
    });
  }
});

const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
const fill: Plugin = { id: 'theme-fill', provides: ['decorate'], decorate: (c) => (c.ref === 'B3' ? { background: 'rgb(255, 255, 0)', color: 'rgb(0, 0, 0)' } : undefined) };

describe('the theme attribute (W-29 DoD 3, 4, 7)', () => {
  it('light by default; dark and auto restyle the chrome; the file’s own colours stay as saved', async () => {
    registerPlugin('theme-fill', () => fill);
    const el = await mountExcel({ plugins: 'theme-fill' });
    const cs = (sel: string) => getComputedStyle(shadow(el).querySelector(sel)!);
    expect(el.theme).toBe('light');
    const plain = cellEl(el, 3, 3)!, filled = cellEl(el, 2, 1)!;
    expect(getComputedStyle(plain).backgroundColor).toBe(rgb(TOKENS.cell));
    expect(getComputedStyle(plain).color).toBe(rgb(TOKENS.ink));
    expect(cs('.scroller').backgroundColor).toBe(rgb(TOKENS.cell));
    expect(getComputedStyle(filled).backgroundColor).toBe('rgb(255, 255, 0)');

    el.theme = 'dark';
    await frame();
    expect(el.getAttribute('theme')).toBe('dark');
    expect(getComputedStyle(plain).backgroundColor).toBe(rgb(DARK_TOKENS.cell!));
    expect(getComputedStyle(plain).color).toBe(rgb(DARK_TOKENS.ink!));
    expect(cs('.scroller').backgroundColor).toBe(rgb(DARK_TOKENS.cell!));
    expect(cs('.ch').backgroundColor).toBe(rgb(DARK_TOKENS.head!));
    expect(getComputedStyle(el).colorScheme).toBe('dark');
    // data is not chrome: the decorate fill and colour are untouched
    expect(getComputedStyle(filled).backgroundColor).toBe('rgb(255, 255, 0)');
    expect(getComputedStyle(filled).color).toBe('rgb(0, 0, 0)');

    // auto follows the page; in this run the page is light
    el.theme = 'auto';
    await frame();
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    expect(getComputedStyle(plain).backgroundColor).toBe(rgb(dark ? DARK_TOKENS.cell! : TOKENS.cell));

    // a host override of any --sp-* still wins
    el.theme = 'dark';
    el.style.setProperty('--sp-cell', '#000000');
    await frame();
    expect(getComputedStyle(plain).backgroundColor).toBe('rgb(0, 0, 0)');
  });

  it('the error list takes the same theme', async () => {
    const el = await mountExcel({ pane: 'th' });
    const errors = document.createElement('sheetpane-errors');
    errors.setAttribute('pane', 'th');
    errors.setAttribute('theme', 'dark');
    document.body.append(errors);
    await frame();
    expect(errors.theme).toBe('dark');
    expect(getComputedStyle(errors).getPropertyValue('--sp-ink').trim()).toBe(DARK_TOKENS.ink);
    expect(getComputedStyle(el).getPropertyValue('--sp-ink').trim()).toBe(TOKENS.ink);
  });
});
