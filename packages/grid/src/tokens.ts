// The Proof design tokens as `--sp-*` custom properties (grid verdict decision 3).
// One source: the shadow roots adopt TOKENS_CSS, and the build writes it to
// dist/style.css for hosts that want to read or override the defaults.
// No font is named anywhere (SR-LAW-5): the host's font is inherited.

export const TOKENS = {
  ground: '#F6F6F4', surface: '#FFFFFF', sunken: '#EFEFEB', line: '#E2E2DD', 'line-strong': '#CBCBC5',
  ink: '#16171A', 'ink-2': '#45484F', 'ink-3': '#63666E',
  accent: '#2346C8', 'accent-ink': '#1A36A0', 'accent-soft': '#EBEEFB',
  pass: '#16703E', 'pass-soft': '#E6F2EA', fail: '#B42318', 'fail-soft': '#FBE9E7', warn: '#875600', 'warn-soft': '#FBF0D9',
  changed: '#C46A00', 'changed-soft': '#FDF1E3',
  'r-sm': '4px', r: '6px', 'r-lg': '10px', 'r-xl': '14px',
  shadow: '0 1px 2px rgba(22,23,26,.06),0 6px 20px rgba(22,23,26,.08)',
  'shadow-lg': '0 24px 64px rgba(22,23,26,.22)',
} as const;

const decls = Object.entries(TOKENS).map(([k, v]) => `--sp-${k}:${v};`).join('');

/** Token defaults on the host element; a host overrides any of them on the element or an ancestor rule. */
export const TOKENS_CSS = `:host{${decls}}`;

/** The same defaults for light-DOM use (dist/style.css). */
export const TOKENS_STYLESHEET = `sheetpane-excel,sheetpane-errors{${decls}}\n`;
