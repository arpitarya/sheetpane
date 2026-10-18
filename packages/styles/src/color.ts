// SpreadsheetML colours → CSS hex: rgb (ARGB), theme + tint, indexed, auto.
// Shared with @sheetpane/condfmt (it resolves dxf colours the same way).
import type { CellContext } from '@sheetpane/grid';

type Book = CellContext['book'];
/** A colour as SpreadsheetML stores it (`@sheetpane/import`'s `Color`). */
export type XlColor = NonNullable<NonNullable<Book['styles']['fonts'][number]>['color']>;

/** Where theme and indexed colours come from: the workbook's own, else the defaults. */
export interface Palette {
  /** Theme colours by SpreadsheetML theme index (0 lt1, 1 dk1, 2 lt2, 3 dk2, 4–9 accent1–6, 10 hlink, 11 folHlink), `RRGGBB`. */
  theme?: readonly string[];
  /** `<indexedColors>` when the file overrides the default 64-colour palette, `AARRGGBB` or `RRGGBB`. */
  indexed?: readonly string[];
}

/** The default Office theme (2013 and later), in SpreadsheetML theme-index order. */
export const DEFAULT_THEME: readonly string[] = [
  'FFFFFF', '000000', 'E7E6E6', '44546A', '4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47', '0563C1', '954F72',
];

/** The legacy 64-colour palette `indexed="n"` points into (ECMA-376 Part 1, §18.8.27). */
export const DEFAULT_INDEXED: readonly string[] = [
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '800000', '008000', '000080', '808000', '800080', '008080', 'C0C0C0', '808080',
  '9999FF', '993366', 'FFFFCC', 'CCFFFF', '660066', 'FF8080', '0066CC', 'CCCCFF',
  '000080', 'FF00FF', 'FFFF00', '00FFFF', '800080', '800000', '008080', '0000FF',
  '00CCFF', 'CCFFFF', 'CCFFCC', 'FFFF99', '99CCFF', 'FF99CC', 'CC99FF', 'FFCC99',
  '3366FF', '33CCCC', '99CC00', 'FFCC00', 'FF9900', 'FF6600', '666699', '969696',
  '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333',
];
/** `indexed="64"` is the system foreground (text), `65` the system background. */
const SYSTEM_FG = '000000', SYSTEM_BG = 'FFFFFF';

/**
 * A workbook's palette: its theme and its indexed override, when it has them.
 *
 * @param book - The imported workbook (its `themeColors` and `styles.indexedColors`).
 * @returns The palette; a field is absent when the file has none, so the defaults apply.
 */
export function paletteOf(book: Pick<Book, 'themeColors' | 'styles'>): Palette {
  const p: Palette = {};
  if (book.themeColors.length) p.theme = book.themeColors;
  if (book.styles.indexedColors?.length) p.indexed = book.styles.indexedColors;
  return p;
}

const six = (s: string | undefined): string | undefined => {
  if (!s) return undefined;
  const h = s.replace(/^#/, '').toUpperCase();
  if (/^[0-9A-F]{8}$/.test(h)) return h.slice(2); // ARGB: Excel ignores the alpha byte
  if (/^[0-9A-F]{6}$/.test(h)) return h;
  return undefined;
};

/**
 * Resolves a SpreadsheetML colour to `#RRGGBB`. `auto` and an absent colour
 * resolve to `undefined` — the caller decides what automatic means (text: the
 * host's colour; a border: black). Theme colours take their tint.
 *
 * @param c - The colour as SpreadsheetML stores it (`rgb`, `theme`, `indexed` or `auto`, with an optional `tint`).
 * @param palette - The workbook's theme and indexed colours; default: Office's.
 * @returns `#RRGGBB`, or `undefined` for `auto`, an absent colour or one that does not resolve.
 */
export function resolveColor(c: XlColor | undefined, palette: Palette = {}): string | undefined {
  if (!c || c.auto) return undefined;
  let hex: string | undefined;
  if (c.rgb !== undefined) hex = six(c.rgb);
  else if (c.theme !== undefined) hex = six((palette.theme?.length ? palette.theme : DEFAULT_THEME)[c.theme] ?? DEFAULT_THEME[c.theme]);
  else if (c.indexed !== undefined) {
    if (c.indexed === 64) hex = SYSTEM_FG;
    else if (c.indexed === 65) hex = SYSTEM_BG;
    else hex = six((palette.indexed?.length ? palette.indexed : DEFAULT_INDEXED)[c.indexed]);
  }
  if (!hex) return undefined;
  if (c.tint) hex = applyTint(hex, c.tint);
  return `#${hex}`;
}

/**
 * Excel's tint (ECMA-376 Part 1, §18.8.19 `tint`): in HSL, a negative tint
 * darkens (`L·(1+tint)`), a positive one lightens (`L·(1−tint) + tint`).
 *
 * @param rgb - The colour, `RRGGBB` (no `#`).
 * @param tint - The tint, -1 to 1 (clamped).
 * @returns The tinted colour, `RRGGBB` upper case.
 */
export function applyTint(rgb: string, tint: number): string {
  const n = [0, 2, 4].map((i) => parseInt(rgb.slice(i, i + 2), 16) / 255) as [number, number, number];
  const [h, s, l0] = toHsl(...n);
  const t = Math.max(-1, Math.min(1, tint));
  const l = t < 0 ? l0 * (1 + t) : l0 * (1 - t) + t;
  return fromHsl(h, s, l).map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function toHsl(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h /= 6;
  return [h, s, l];
}

function fromHsl(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const ch = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [ch(h + 1 / 3), ch(h), ch(h - 1 / 3)];
}

/**
 * Mixes two `#RRGGBB` colours: `amount` of `a` over `b`.
 *
 * @param a - The colour laid over, `#RRGGBB`.
 * @param b - The colour beneath, `#RRGGBB`.
 * @param amount - How much of `a`, 0 to 1.
 * @returns The mix, `#RRGGBB` upper case.
 */
export function mix(a: string, b: string, amount: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v * amount + pb[i]! * (1 - amount)).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
