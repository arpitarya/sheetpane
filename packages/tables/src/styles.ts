// The table styles this plugin draws (W-61; SR-TABLES decision 3): Excel's built-in Light 1–7 and
// Medium 1–7, approximated from the workbook's theme — style 1 is in the theme's dark text colour,
// styles 2–7 in accents 1–6. Any other style name draws a bold header row only.

/** Office's default theme (lt1, dk1, lt2, dk2, accents 1–6), used when a workbook names none. */
export const DEFAULT_THEME: readonly string[] = ['FFFFFF', '000000', 'E7E6E6', '44546A', '4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47'];

/** Every style name this plugin draws in full; any other draws a bold header row only. */
export const TABLE_STYLES: readonly string[] = [1, 2, 3, 4, 5, 6, 7].flatMap((n) => [`TableStyleLight${n}`, `TableStyleMedium${n}`]);

/** What one table style paints: `#RRGGBB` colours, or `undefined` for a style outside the subset. */
export interface TablePalette {
  kind: 'light' | 'medium';
  /** The style's colour: the header fill (Medium), the outer and header lines (Light), the totals row's double line. */
  accent: string;
  /** The line between rows (Medium). */
  line: string;
  /** The banded rows' and columns' fill. */
  stripe: string;
  /** Text on a filled cell: the theme's dark text colour (a filled cell never takes the host's ink). */
  ink: string;
  /** Text on the header fill (Medium): the theme's light colour. */
  onAccent: string;
}

/**
 * Excel's tint (ECMA-376 Part 1, §18.8.19): in HSL, a negative tint darkens (`L·(1+tint)`), a positive one
 * lightens (`L·(1−tint) + tint`). The same tint as `@sheetpane/styles`' `applyTint`, kept here so this plugin
 * needs no peer.
 *
 * @param rgb - The colour, `RRGGBB` (no `#`).
 * @param tint - The tint, -1 to 1.
 * @returns The tinted colour, `RRGGBB` upper case.
 */
export function tint(rgb: string, tint: number): string {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(rgb.slice(i, i + 2), 16) / 255) as [number, number, number];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l0 = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l0 - 1));
  const h = d === 0 ? 0 : mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const t = Math.max(-1, Math.min(1, tint));
  const l = t < 0 ? l0 * (1 + t) : l0 * (1 - t) + t;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h % 2) - 1)), m = l - c / 2;
  const [p, q, w] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  return [p, q, w].map((v) => Math.round(Math.max(0, Math.min(1, v + m)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

const STYLE = /^TableStyle(Light|Medium)([1-7])$/;

/**
 * The colours a built-in table style paints with, from the workbook's theme.
 *
 * @param name - The style's name, e.g. `TableStyleMedium2`.
 * @param theme - The workbook's theme colours by SpreadsheetML index (`RRGGBB`); Office's when empty.
 * @returns The palette, or `undefined` when the style is outside the subset ({@link TABLE_STYLES}).
 */
export function paletteOf(name: string | undefined, theme: readonly string[] = []): TablePalette | undefined {
  const m = name ? STYLE.exec(name) : null;
  if (!m) return undefined;
  const th = (i: number) => (theme[i] ?? DEFAULT_THEME[i]!).toUpperCase();
  const n = Number(m[2]);
  const base = n === 1 ? th(1) : th(n + 2); // style 1: the dark text colour; 2–7: accents 1–6
  const dark = n === 1; // a black or grey base takes lighter tints to read as grey
  return {
    kind: m[1] === 'Light' ? 'light' : 'medium',
    accent: `#${base}`,
    line: `#${tint(base, dark ? 0.5 : 0.4)}`,
    stripe: `#${tint(base, dark ? 0.85 : 0.8)}`,
    ink: `#${th(1)}`,
    onAccent: `#${th(0)}`,
  };
}
