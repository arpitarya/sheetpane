// DrawingML colours → `#RRGGBB`. Pure, no DOM: `srgbClr`, `schemeClr` (through the workbook
// theme) and `sysClr` with the modifiers Excel writes most (`lumMod`, `lumOff`, `tint`, `shade`).

/** Office's default accents, for a workbook whose theme names none. */
export const OFFICE_ACCENTS = ['4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47'] as const;

/** A colour element as the model keeps it, before the theme resolves it. */
export interface ColorSpec {
  kind: 'srgb' | 'scheme' | 'sys';
  val: string;
  mods: { name: string; val: number }[];
}

/** DrawingML scheme names → SpreadsheetML theme index (0 lt1, 1 dk1, 2 lt2, 3 dk2, 4–9 accents, 10 hlink, 11 folHlink). */
const SCHEME: Record<string, number> = {
  lt1: 0, bg1: 0, dk1: 1, tx1: 1, lt2: 2, bg2: 2, dk2: 3, tx2: 3,
  accent1: 4, accent2: 5, accent3: 6, accent4: 7, accent5: 8, accent6: 9, hlink: 10, folHlink: 11,
};
const SCHEME_FALLBACK: Record<number, string> = { 0: 'FFFFFF', 1: '000000', 2: 'E7E6E6', 3: '44546A', 10: '0563C1', 11: '954F72' };

const hex6 = (s: string | undefined) => (s && /^[0-9A-Fa-f]{6}$/.test(s) ? s.toUpperCase() : undefined);

/** The theme's six accents, Office's where the workbook has none. */
export function accents(themeColors: readonly string[]): string[] {
  return OFFICE_ACCENTS.map((d, i) => hex6(themeColors[4 + i]) ?? d);
}

function themeColor(themeColors: readonly string[], name: string): string | undefined {
  const i = SCHEME[name];
  if (i === undefined) return undefined;
  if (i >= 4 && i <= 9) return accents(themeColors)[i - 4];
  return hex6(themeColors[i]) ?? SCHEME_FALLBACK[i];
}

function toRgb(h: string): [number, number, number] {
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const toHex = (rgb: readonly number[]) => rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase();

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hslToRgb([h, s, l]: [number, number, number]): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

/** Applies DrawingML modifiers (values in 1/1000 of a percent: 75000 = 75 %). */
export function modify(hex: string, mods: readonly { name: string; val: number }[]): string {
  let rgb = toRgb(hex);
  const lumMod = mods.find((m) => m.name === 'lumMod'), lumOff = mods.find((m) => m.name === 'lumOff');
  if (lumMod || lumOff) {
    const hsl = rgbToHsl(rgb);
    hsl[2] = Math.min(1, Math.max(0, hsl[2] * ((lumMod?.val ?? 100000) / 100000) + (lumOff?.val ?? 0) / 100000));
    rgb = hslToRgb(hsl);
  }
  for (const m of mods) {
    const k = m.val / 100000;
    if (m.name === 'shade') rgb = rgb.map((v) => v * k) as [number, number, number];
    else if (m.name === 'tint') rgb = rgb.map((v) => v + (255 - v) * (1 - k)) as [number, number, number];
  }
  return toHex(rgb);
}

/** A colour spec → `#RRGGBB`, or undefined when it names nothing this resolver knows. */
export function resolveColor(c: ColorSpec | undefined, themeColors: readonly string[]): string | undefined {
  if (!c) return undefined;
  const base = c.kind === 'srgb' ? hex6(c.val) : c.kind === 'scheme' ? themeColor(themeColors, c.val) : hex6(c.val);
  return base ? `#${modify(base, c.mods)}` : undefined;
}

/**
 * The colour Excel's default chart style gives the n-th series (or pie slice) when the part
 * names none: accents 1–6, then the same six darker, then lighter.
 */
export function defaultColor(n: number, themeColors: readonly string[]): string {
  const a = accents(themeColors)[n % 6]!, round = Math.floor(n / 6) % 3;
  if (round === 0) return `#${a}`;
  return `#${modify(a, round === 1 ? [{ name: 'lumMod', val: 60000 }] : [{ name: 'lumMod', val: 80000 }, { name: 'lumOff', val: 20000 }])}`;
}
