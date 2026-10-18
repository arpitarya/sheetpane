// The Proof design tokens as `--sp-*` custom properties (grid verdict decision 3;
// W-29). One source: the shadow roots adopt TOKENS_CSS, and the build writes
// TOKENS_STYLESHEET to dist/style.css. No font is named anywhere (SR-LAW-5).
// Two themes: light (the default) and dark — every dark colour is a mix of
// Proof's ink #16171A and ground #F6F6F4 with the light hues, shipped as hex
// (no color-mix() at runtime). A host may override any --sp-* on the element.

/** The light theme's design tokens, applied as `--sp-<name>` on both elements (SR-GRID decision 15a). */
export const TOKENS = {
  ground: '#F6F6F4', surface: '#FFFFFF', sunken: '#EFEFEB', line: '#E2E2DD', 'line-strong': '#CBCBC5',
  cell: '#FFFFFF', head: '#F3F3F0', grid: '#E6E6E1',
  ink: '#16171A', 'ink-2': '#45484F', 'ink-3': '#63666E',
  accent: '#2346C8', 'accent-ink': '#1A36A0', 'accent-soft': '#EBEEFB',
  pass: '#16703E', 'pass-soft': '#E6F2EA', fail: '#B42318', 'fail-soft': '#FBE9E7', warn: '#875600', 'warn-soft': '#FBF0D9',
  changed: '#C46A00', 'changed-soft': '#FDF1E3', note: '#6B55CC',
  'ref-1': '#2346C8', 'ref-2': '#6B55CC', 'ref-3': '#C46A00', 'on-solid': '#FFFFFF',
  hit: '#FFF4C2', 'hit-current': '#FFE07A',
  'r-sm': '4px', r: '6px', 'r-lg': '10px', 'r-xl': '14px',
  shadow: '0 1px 2px rgba(22,23,26,.06),0 6px 20px rgba(22,23,26,.08)',
  'shadow-lg': '0 24px 64px rgba(22,23,26,.22)',
} as const;

/** A token's name; its custom property is `--sp-<name>`. */
export type TokenName = keyof typeof TOKENS;

/** The `theme` attribute on both elements. */
export type Theme = 'light' | 'dark' | 'auto';

/** The dark set (W-29 DoD 3, accepted by the decider 2026-10-18 from sp-plugins.css `.spx-dark`). */
export const DARK_TOKENS: Partial<Record<TokenName, string>> = {
  ground: '#16171A', surface: '#262729', cell: '#262729', sunken: '#3A3B3D', head: '#313234', grid: '#3E3F41',
  line: '#47484A', 'line-strong': '#6B6C6D', ink: '#F6F6F4', 'ink-2': '#C9C9C8', 'ink-3': '#A1A1A1',
  accent: '#8C9EDE', 'accent-ink': '#B7C1E7', 'accent-soft': '#1A254E',
  pass: '#86B399', 'pass-soft': '#163225', fail: '#D2827B', 'fail-soft': '#451B19', warn: '#CAB692', 'warn-soft': '#412F10',
  changed: '#D39449', 'changed-soft': '#4A3012', note: '#AA9DDE',
  'ref-1': '#8C9EDE', 'ref-2': '#AA9DDE', 'ref-3': '#D8A262', 'on-solid': '#16171A',
  hit: '#4A3D12', 'hit-current': '#7A5F12',
  shadow: '0 1px 2px rgba(0,0,0,.4),0 6px 20px rgba(0,0,0,.45)',
  'shadow-lg': '0 24px 64px rgba(0,0,0,.6)',
};

const decls = (t: Partial<Record<string, string>>) => Object.entries(t).map(([k, v]) => `--sp-${k}:${v};`).join('');

/** Token defaults on the host element, then the dark set for `theme="dark"` and, when the page prefers dark, `theme="auto"`. */
export const TOKENS_CSS = `:host{${decls(TOKENS)}color-scheme:light}
:host([theme=dark]){${decls(DARK_TOKENS)}color-scheme:dark}
@media (prefers-color-scheme:dark){:host([theme=auto]){${decls(DARK_TOKENS)}color-scheme:dark}}`;

/** The same for light-DOM use (dist/style.css). */
export const TOKENS_STYLESHEET = `sheetpane-excel,sheetpane-errors{${decls(TOKENS)}}
sheetpane-excel[theme=dark],sheetpane-errors[theme=dark]{${decls(DARK_TOKENS)}}
@media (prefers-color-scheme:dark){sheetpane-excel[theme=auto],sheetpane-errors[theme=auto]{${decls(DARK_TOKENS)}}}
`;
