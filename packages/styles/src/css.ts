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
/** One CSS property of {@link ALLOWED_PROPS}. */
export type AllowedProp = (typeof ALLOWED_PROPS)[number];
const ALLOWED = new Set<string>(ALLOWED_PROPS);

/**
 * Drops anything outside the allow-list (a font family included, whatever its spelling) and empty values.
 *
 * @param style - CSS declarations, property → value.
 * @returns A new object holding only {@link ALLOWED_PROPS} with a value.
 */
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

/**
 * `text-decoration` from a font's underline and strike.
 *
 * @param u - The underline (`true`, `single`, `double`, `singleAccounting`, `doubleAccounting`, `none`), or absent.
 * @param strike - Whether the font is struck through.
 * @returns `underline`, `line-through` or both (plus `double` for a double underline); `undefined` when neither.
 */
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
 *
 * @param font - The font, or `undefined`.
 * @param palette - The workbook's palette, for its colour.
 * @param base - The workbook's default font; omit for a dxf.
 * @returns `font-weight`, `font-style`, `text-decoration`, `font-size` (in `em`) and `color`, as they apply.
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

/** A rich-text run as the grid hands it to `decorateRuns` (SR-IMPORT decision 12). */
export type XlRun = NonNullable<CellContext['runs']>[number];

/**
 * One rich-text run's CSS, for a span inside its cell (W-53). A run with no formatting returns `{}` (it takes the
 * cell's look). A formatted run states its weight, style and decoration outright — an Excel run's `<rPr>` is its
 * whole font — and its size (in `em` of the cell's) and colour only where they differ from the cell's own font.
 * Superscript and subscript are `vertical-align` at three quarters of the size. The family is never read.
 *
 * @param run - The run.
 * @param palette - The workbook's palette, for its colour.
 * @param own - The cell's font (`fonts[cellXfs[s].fontId]`).
 * @param base - The workbook's default font (`fonts[0]`): a colour the cell's font leaves unset is measured against it,
 *   so a run in the default ink keeps the host's ink (dark themes included).
 * @returns The CSS.
 */
export function runCss(run: XlRun, palette: Palette, own: XlFont | undefined, base?: XlFont): StyleSubset {
  const out: StyleSubset = {};
  if (Object.keys(run).length === 1) return out;
  out['font-weight'] = run.b ? '700' : '400';
  out['font-style'] = run.i ? 'italic' : 'normal';
  out['text-decoration'] = decoration(run.u, run.strike) ?? 'none';
  const sup = run.vertAlign === 'superscript' ? 'super' : run.vertAlign === 'subscript' ? 'sub' : undefined;
  const ref = own?.sz ?? DEFAULT_SZ;
  const ratio = (run.sz !== undefined && run.sz > 0 ? run.sz / ref : 1) * (sup ? 0.75 : 1);
  if (ratio !== 1) out['font-size'] = `${round3(ratio)}em`;
  if (sup) out['vertical-align'] = sup;
  if (run.color && !sameColor(run.color, own?.color ?? base?.color)) {
    const c = resolveColor(run.color, palette);
    if (c) out.color = c;
  }
  return out;
}

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
 *
 * @param fill - The fill, or `undefined`.
 * @param palette - The workbook's palette, for its colours.
 * @param o - `{ dxf: true }` for a conditional format's fill.
 * @returns `{ 'background-color' }`, or `{}` for no fill.
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

/**
 * One border side as CSS, e.g. `1px solid #000000`; an automatic colour is black.
 *
 * @param side - The side (`style` and `color`), or `undefined`.
 * @param palette - The workbook's palette, for its colour.
 * @returns The CSS value, or `undefined` for no border.
 */
export function sideCss(side: XlBorderSide | undefined, palette: Palette): string | undefined {
  const w = side?.style ? BORDER_CSS[side.style] : undefined;
  if (!w) return undefined;
  return `${w} ${resolveColor(side!.color, palette) ?? AUTO_INK}`;
}

/**
 * A border's CSS: `border-top` … `border-left`. Diagonals have no CSS twin and are not drawn.
 *
 * @param border - The border, or `undefined`.
 * @param palette - The workbook's palette, for its colours.
 * @returns One property per drawn side.
 */
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

/**
 * Alignment's CSS: `text-align`, `vertical-align`, and `white-space: pre-wrap` for wrapped text. Indent and rotation are not drawn.
 *
 * @param a - A cell format's alignment, or `undefined`.
 * @returns The properties that apply.
 */
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

/**
 * A cell format (`cellXfs[s]`) as CSS — font, fill, border and alignment — measured against the workbook's default font.
 *
 * @param tables - The workbook's style tables.
 * @param s - The cell's style index, or `undefined`.
 * @param palette - The workbook's palette.
 * @returns The CSS; `{}` when the xf does not exist.
 */
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

/**
 * A differential format (conditional formatting) as CSS — for `@sheetpane/condfmt`. Everything it names is emitted.
 *
 * @param dxf - The differential format, or `undefined`.
 * @param palette - The workbook's palette.
 * @returns The CSS; `{}` for none.
 */
export function dxfCss(dxf: XlDxf | undefined, palette: Palette): StyleSubset {
  if (!dxf) return {};
  return { ...fontCss(dxf.font, palette), ...fillCss(dxf.fill, palette, { dxf: true }), ...borderCss(dxf.border, palette), ...alignmentCss(dxf.alignment) };
}
