// xl/styles.xml and xl/theme/theme1.xml as parsed objects (W-13 DoD 12).
import { all, bool, first, kid, kids, num, str } from './dom.js';
import type { Alignment, Border, BorderSide, CellXf, Color, Dxf, Fill, Font, StyleTables } from './types.js';

export function color(e: Element | undefined): Color | undefined {
  if (!e) return undefined;
  const c: Color = {};
  const rgb = str(e, 'rgb'), theme = num(e, 'theme'), tint = num(e, 'tint'), indexed = num(e, 'indexed');
  if (rgb !== undefined) c.rgb = rgb.toUpperCase();
  if (theme !== undefined) c.theme = theme;
  if (tint !== undefined) c.tint = tint;
  if (indexed !== undefined) c.indexed = indexed;
  if (bool(e, 'auto')) c.auto = true;
  return c;
}

function val(e: Element | undefined, dflt?: string): string | undefined {
  if (!e) return undefined;
  return e.getAttribute('val') ?? dflt;
}

export function font(e: Element): Font {
  const f: Font = {};
  const b = kid(e, 'b'), i = kid(e, 'i'), u = kid(e, 'u'), s = kid(e, 'strike');
  if (b && val(b, '1') !== '0' && val(b) !== 'false') f.b = true;
  if (i && val(i, '1') !== '0' && val(i) !== 'false') f.i = true;
  if (s && val(s, '1') !== '0' && val(s) !== 'false') f.strike = true;
  if (u && val(u, 'single') !== 'none') f.u = val(u, 'single')!;
  const sz = val(kid(e, 'sz'));
  if (sz) f.sz = Number(sz);
  const c = color(kid(e, 'color'));
  if (c) f.color = c;
  const name = val(kid(e, 'name'));
  if (name) f.name = name;
  const va = val(kid(e, 'vertAlign'));
  if (va) f.vertAlign = va;
  return f;
}

export function fill(e: Element): Fill {
  const p = kid(e, 'patternFill'), g = kid(e, 'gradientFill');
  const f: Fill = {};
  if (p) {
    const t = str(p, 'patternType');
    if (t) f.patternType = t;
    const fg = color(kid(p, 'fgColor')), bg = color(kid(p, 'bgColor'));
    if (fg) f.fgColor = fg;
    if (bg) f.bgColor = bg;
  }
  if (g) {
    const gr: NonNullable<Fill['gradient']> = { stops: kids(g, 'stop').map((s) => ({ position: num(s, 'position') ?? 0, color: color(kid(s, 'color')) ?? {} })) };
    const t = str(g, 'type'), d = num(g, 'degree');
    if (t) gr.type = t;
    if (d !== undefined) gr.degree = d;
    f.gradient = gr;
  }
  return f;
}

export function border(e: Element): Border {
  const b: Border = {};
  for (const side of ['left', 'right', 'top', 'bottom', 'diagonal'] as const) {
    const s = kid(e, side) ?? (side === 'left' ? kid(e, 'start') : side === 'right' ? kid(e, 'end') : undefined);
    const style = s && str(s, 'style');
    if (s && style) {
      const bs: BorderSide = { style };
      const c = color(kid(s, 'color'));
      if (c) bs.color = c;
      b[side] = bs;
    }
  }
  return b;
}

export function alignment(e: Element | undefined): Alignment | undefined {
  if (!e) return undefined;
  const a: Alignment = {};
  const h = str(e, 'horizontal'), v = str(e, 'vertical'), ind = num(e, 'indent'), rot = num(e, 'textRotation');
  if (h) a.horizontal = h;
  if (v) a.vertical = v;
  if (bool(e, 'wrapText')) a.wrapText = true;
  if (bool(e, 'shrinkToFit')) a.shrinkToFit = true;
  if (ind) a.indent = ind;
  if (rot) a.textRotation = rot;
  return a;
}

function xf(e: Element): CellXf {
  const x: CellXf = { numFmtId: num(e, 'numFmtId') ?? 0, fontId: num(e, 'fontId') ?? 0, fillId: num(e, 'fillId') ?? 0, borderId: num(e, 'borderId') ?? 0 };
  const a = alignment(kid(e, 'alignment'));
  if (a) x.alignment = a;
  for (const k of ['applyNumberFormat', 'applyFont', 'applyFill', 'applyBorder', 'applyAlignment'] as const) if (e.hasAttribute(k)) x[k] = bool(e, k);
  return x;
}

export function parseStyles(doc: Document | undefined): StyleTables {
  const t: StyleTables = { numFmts: {}, cellXfs: [], fonts: [], fills: [], borders: [], dxfs: [] };
  if (!doc) return t;
  const root = doc.documentElement;
  for (const n of all(root, 'numFmt')) {
    if (n.parentElement?.localName !== 'numFmts') continue;
    const id = num(n, 'numFmtId'), code = str(n, 'formatCode');
    if (id !== undefined && code !== undefined) t.numFmts[id] = code;
  }
  const list = (container: string, item: string) => { const c = kid(root, container); return c ? kids(c, item) : []; };
  t.fonts = list('fonts', 'font').map(font);
  t.fills = list('fills', 'fill').map(fill);
  t.borders = list('borders', 'border').map(border);
  t.cellXfs = list('cellXfs', 'xf').map(xf);
  t.dxfs = list('dxfs', 'dxf').map((d) => {
    const o: Dxf = {};
    const f = kid(d, 'font'), fl = kid(d, 'fill'), b = kid(d, 'border'), nf = kid(d, 'numFmt'), al = kid(d, 'alignment');
    if (f) o.font = font(f);
    if (fl) o.fill = fill(fl);
    if (b) o.border = border(b);
    if (nf) o.numFmt = { id: num(nf, 'numFmtId') ?? 0, code: str(nf, 'formatCode') ?? '' };
    const a = alignment(al);
    if (a) o.alignment = a;
    return o;
  });
  const idx = first(root, 'indexedColors');
  if (idx) t.indexedColors = kids(idx, 'rgbColor').map((c) => (str(c, 'rgb') ?? '').toUpperCase());
  return t;
}

/** Theme colours by SpreadsheetML theme index: the scheme's dk1/lt1 and dk2/lt2 swap places. */
export function parseTheme(doc: Document | undefined): string[] {
  const scheme = doc && first(doc, 'clrScheme');
  if (!scheme) return [];
  const get = (name: string) => {
    const e = kid(scheme, name);
    const c = e && (kid(e, 'srgbClr') ?? kid(e, 'sysClr'));
    return ((c && (str(c, 'val') && c.localName === 'srgbClr' ? str(c, 'val') : str(c, 'lastClr'))) ?? '000000').toUpperCase();
  };
  return ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'].map(get);
}
