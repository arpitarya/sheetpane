// SpreadsheetML font / fill / border / alignment → the allow-listed CSS subset
// (W-17 DoD 2). A font's family is read by nobody here: the host's font is the
// font (SR-LAW-5). Shared with @sheetpane/condfmt for dxf rendering.
import type { CellContext, StyleProp, StyleSubset } from '@sheetpane/grid';
import { mix, resolveColor, type Palette } from './color.js';

type Tables = CellContext['book']['styles'];
export type XlFont = NonNullable<Tables['fonts'][number]>;
export type XlFill = NonNullable<Tables['fills'][number]>;
export type XlBorder = NonNullable<Tables['borders'][number]>;
export type XlBorderSide = NonNullable<XlBorder['top']>;
export type XlAlignment = NonNullable<NonNullable<Tables['cellXfs'][number]>['alignment']>;
export type XlXf = NonNullable<Tables['cellXfs'][number]>;
export type XlDxf = NonNullable<Tables['dxfs'][number]>;

/** The only properties this plugin ever returns (W-17 DoD 2) — a strict subset of the grid's `STYLE_PROPS`, and never a font family. */
export const ALLOWED_PROPS = [
  'background-color', 'color', 'font-weight', 'font-style', 'font-size', 'text-decoration', 'text-align', 'vertical-align', 'white-space',
  'border-top', 'border-right', 'border-bottom', 'border-left',
] as const satisfies readonly StyleProp[];
export type AllowedProp = (typeof ALLOWED_PROPS)[number];
const ALLOWED = new Set<string>(ALLOWED_PROPS);

/** Drops anything outside the allow-list (a font family included, whatever its spelling). */
export function allowListed(style: StyleSubset): StyleSubset {
  const out: StyleSubset = {};
  for (const [k, v] of Object.entries(style) as [StyleProp, string | undefined][]) if (ALLOWED.has(k) && v !== undefined && v !== '') out[k] = v;
  return out;
}

/** The grid draws cell text at this many `em` of the host's size; a workbook size scales it (`sz / base`). */
export const CELL_EM = 0.93;
/** Excel's default size when a file names none. */
export const DEFAULT_SZ = 11;

/** Excel border style → CSS `width style`. */
export const BORDER_CSS: Readonly<Record<string, string>> = {
  thin: '1px solid', medium: '2px solid', thick: '3px solid',
  hair: '1px dotted', dotted: '1px dotted',
  dashed: '1px dashed', dashDot: '1px dashed', dashDotDot: '1px dashed',
  mediumDashed: '2px dashed', mediumDashDot: '2px dashed', mediumDashDotDot: '2px dashed', slantDashDot: '2px dashed',
  double: '3px double',
};
/** Every border style SpreadsheetML names, `none` aside. */
export const BORDER_STYLES = Object.keys(BORDER_CSS);

/** Automatic text and border colour: Excel's system foreground. */
export const AUTO_INK = '#000000';

/** `text-decoration` from underline and strike; `undefined` when neither. */
export function decoration(u: string | boolean | undefined, strike: boolean | undefined): string | undefined {
  const parts: string[] = [];
  if (u && u !== 'none') parts.push('underline');
  if (strike) parts.push('line-through');
  if (!parts.length) return undefined;
  if (typeof u === 'string' && /^double/.test(u)) parts.push('double');
  return parts.join(' ');
}

const sameColor = (a: XlFont['color'], b: XlFont['color']) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * A font's CSS. With `base` (the workbook's default font, `fonts[0]`), size and
 * colour are emitted only where they differ from it — a plain cell stays plain
 * and keeps the host's colour (dark themes included). Without `base` (a dxf),
 * everything the font names is emitted. The family is never read.
 */
export function fontCss(font: XlFont | undefined, palette: Palette, base?: XlFont): StyleSubset {
  const out: StyleSubset = {};
  if (!font) return out;
  if (font.b) out['font-weight'] = '700';
  else if (base?.b) out['font-weight'] = '400';
  if (font.i) out['font-style'] = 'italic';
  const td = decoration(font.u, font.strike);
  if (td) out['text-decoration'] = td;
  if (font.sz !== undefined && font.sz > 0) {
    const ref = base ? base.sz ?? DEFAULT_SZ : DEFAULT_SZ;
    if (!base || font.sz !== ref) out['font-size'] = `${round3((font.sz / ref) * CELL_EM)}em`;
  }
  if (font.color && (!base || !sameColor(font.color, base.color))) {
    const c = resolveColor(font.color, palette);
    if (c) out.color = c;
  }
  return out;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** How much of the pattern colour each pattern shows over its background. */
const PATTERN_DENSITY: Readonly<Record<string, number>> = {
  solid: 1, darkGray: 0.75, mediumGray: 0.5, lightGray: 0.25, gray125: 0.125, gray0625: 0.0625,
  darkHorizontal: 0.5, darkVertical: 0.5, darkDown: 0.5, darkUp: 0.5, darkGrid: 0.5, darkTrellis: 0.75,
  lightHorizontal: 0.25, lightVertical: 0.25, lightDown: 0.25, lightUp: 0.25, lightGrid: 0.25, lightTrellis: 0.25,
};

/**
 * A fill's CSS: one `background-color`. Solid fills take `fgColor` (a dxf's
 * solid fill takes `bgColor`, as Excel writes it); other patterns blend the
 * pattern colour over the background by their density; a gradient shows the
 * midpoint of its first and last stops (no `background-image` — DoD 2).
 */
export function fillCss(fill: XlFill | undefined, palette: Palette, o: { dxf?: boolean } = {}): StyleSubset {
  if (!fill) return {};
  if (fill.gradient && fill.gradient.stops.length) {
    const stops = fill.gradient.stops.map((s) => resolveColor(s.color, palette) ?? '#FFFFFF');
    return { 'background-color': stops.length > 1 ? mix(stops[0]!, stops[stops.length - 1]!, 0.5) : stops[0]! };
  }
  const type = fill.patternType ?? (o.dxf && (fill.fgColor || fill.bgColor) ? 'solid' : undefined);
  if (!type || type === 'none') return {};
  const fg = resolveColor(fill.fgColor, palette), bg = resolveColor(fill.bgColor, palette);
  if (type === 'solid') {
    const c = o.dxf ? bg ?? fg : fg ?? bg;
    return c ? { 'background-color': c } : {};
  }
  const d = PATTERN_DENSITY[type] ?? 0.5;
  return { 'background-color': mix(fg ?? AUTO_INK, bg ?? '#FFFFFF', d) };
}

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
export type Side = (typeof SIDES)[number];
export { SIDES };

/** One border side as CSS, e.g. `1px solid #000000`; `undefined` for none. */
export function sideCss(side: XlBorderSide | undefined, palette: Palette): string | undefined {
  const w = side?.style ? BORDER_CSS[side.style] : undefined;
  if (!w) return undefined;
  return `${w} ${resolveColor(side!.color, palette) ?? AUTO_INK}`;
}

/** A border's CSS: `border-top` … `border-left`. Diagonals have no CSS twin and are not drawn. */
export function borderCss(border: XlBorder | undefined, palette: Palette): StyleSubset {
  const out: StyleSubset = {};
  if (!border) return out;
  for (const s of SIDES) {
    const v = sideCss(border[s], palette);
    if (v) out[`border-${s}`] = v;
  }
  return out;
}

const H_ALIGN: Readonly<Record<string, string>> = { left: 'left', center: 'center', right: 'right', justify: 'justify', distributed: 'justify', fill: 'left', centerContinuous: 'center' };
const V_ALIGN: Readonly<Record<string, string>> = { top: 'top', center: 'middle', bottom: 'bottom', justify: 'middle', distributed: 'middle' };

/** Alignment's CSS: `text-align`, `vertical-align`, and `white-space: pre-wrap` for wrapped text. Indent and rotation are not drawn. */
export function alignmentCss(a: XlAlignment | undefined): StyleSubset {
  const out: StyleSubset = {};
  if (!a) return out;
  const h = a.horizontal && H_ALIGN[a.horizontal];
  if (h) out['text-align'] = h;
  const v = a.vertical && V_ALIGN[a.vertical];
  if (v) out['vertical-align'] = v;
  if (a.wrapText) out['white-space'] = 'pre-wrap';
  return out;
}

/** A cell format (`cellXfs[s]`) as CSS, measured against the workbook's default font. */
export function xfCss(tables: Tables, s: number | undefined, palette: Palette): StyleSubset {
  const xf = s === undefined ? undefined : tables.cellXfs[s];
  if (!xf) return {};
  const base = tables.fonts[0];
  return {
    ...fontCss(tables.fonts[xf.fontId], palette, base),
    ...fillCss(tables.fills[xf.fillId], palette),
    ...borderCss(tables.borders[xf.borderId], palette),
    ...alignmentCss(xf.alignment),
  };
}

/** A differential format (conditional formatting) as CSS — for @sheetpane/condfmt. */
export function dxfCss(dxf: XlDxf | undefined, palette: Palette): StyleSubset {
  if (!dxf) return {};
  return { ...fontCss(dxf.font, palette), ...fillCss(dxf.fill, palette, { dxf: true }), ...borderCss(dxf.border, palette), ...alignmentCss(dxf.alignment) };
}
