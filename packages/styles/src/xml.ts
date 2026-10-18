// exportPatch: style changes written into the package (W-17 DoD 6). New
// <font>, <fill>, <border> and <xf> entries are appended to xl/styles.xml —
// deduplicated against what is already there — and each style-changed cell's
// `s` is repointed. Every other cell keeps its `s`; every other byte of
// styles.xml is kept as written.
import type { Plugin, PluginContext } from '@sheetpane/grid';
import { SIDES, type Side } from './css.js';
import { a1, parseA1, styleChanges, type BorderEdge, type StylePatch } from './model.js';

export type PatchContext = Parameters<NonNullable<Plugin['exportPatch']>>[0];

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_STYLES = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles';
const CT_STYLES = 'application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml';

// ── tiny XML helpers (attribute values only ever come from this module or the file) ──

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const unesc = (s: string) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
export function getAttr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name.replace(/[.:]/g, '\\$&')}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(tag);
  return m ? unesc(m[1] ?? m[2] ?? '') : undefined;
}
export function setAttr(tag: string, name: string, value: string): string {
  const re = new RegExp(`(\\s${name.replace(/[.:]/g, '\\$&')}\\s*=\\s*)(?:"[^"]*"|'[^']*')`);
  if (re.test(tag)) return tag.replace(re, `$1"${escAttr(value)}"`);
  return tag.replace(/\s*(\/?)>$/, ` ${name}="${escAttr(value)}"$1>`);
}
export function removeAttr(tag: string, name: string): string {
  return tag.replace(new RegExp(`\\s${name.replace(/[.:]/g, '\\$&')}\\s*=\\s*(?:"[^"]*"|'[^']*')`), '');
}
/** The elements `<P name …/>` or `<P name …>…</P name>` in order (no nesting of the same name). */
function elements(xml: string, P: string, name: string): RegExpExecArray[] {
  return [...xml.matchAll(new RegExp(`<${P}${name}(?=[\\s>/])[^>]*?(?:/>|>[\\s\\S]*?</${P}${name}>)`, 'g'))];
}
const squash = (x: string) => x.replace(/>\s+</g, '><').trim();
const argb = (rgb: string) => `FF${rgb.toUpperCase()}`;

// ── xl/styles.xml ───────────────────────────────────────────────────────────

/** Section order in CT_Stylesheet. */
const ORDER = ['numFmts', 'fonts', 'fills', 'borders', 'cellStyleXfs', 'cellXfs', 'cellStyles', 'dxfs', 'tableStyles', 'colors', 'extLst'];
type Section = 'fonts' | 'fills' | 'borders' | 'cellXfs';
const ITEM: Record<Section, string> = { fonts: 'font', fills: 'fill', borders: 'border', cellXfs: 'xf' };

/** A minimal stylesheet for a package that has none (one default font, the two reserved fills, one empty border, one xf). */
export const MINIMAL_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="${NS_MAIN}"><fonts count="1"><font><sz val="11"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

/** `xl/styles.xml` held as its sections' item strings; appends dedupe; `toString()` rewrites only the four sections it may have grown. */
export class StyleSheet {
  readonly P: string;
  private xml: string;
  private readonly items: Record<Section, string[]>;
  private readonly keys: Record<Section, Map<string, number>>;
  private readonly grown = new Set<Section>();

  constructor(xml: string) {
    this.P = /<(\w+:)?styleSheet\b/.exec(xml)?.[1] ?? '';
    this.xml = xml;
    for (const s of ['fonts', 'fills', 'borders', 'cellXfs'] as const) this.ensure(s);
    this.items = { fonts: this.read('fonts'), fills: this.read('fills'), borders: this.read('borders'), cellXfs: this.read('cellXfs') };
    this.keys = { fonts: new Map(), fills: new Map(), borders: new Map(), cellXfs: new Map() };
    for (const s of ['fonts', 'fills', 'borders', 'cellXfs'] as const) this.items[s].forEach((x, i) => { const k = squash(x); if (!this.keys[s].has(k)) this.keys[s].set(k, i); });
  }

  private section(s: string): RegExpExecArray | null {
    return new RegExp(`<${this.P}${s}\\b[^>]*?(?:/>|>[\\s\\S]*?</${this.P}${s}>)`).exec(this.xml);
  }
  /** Adds an empty section in schema order when the file has none. */
  private ensure(s: Section): void {
    if (this.section(s)) return;
    const el = `<${this.P}${s} count="0"></${this.P}${s}>`;
    for (const next of ORDER.slice(ORDER.indexOf(s) + 1)) {
      const at = this.xml.search(new RegExp(`<${this.P}${next}\\b`));
      if (at >= 0) { this.xml = this.xml.slice(0, at) + el + this.xml.slice(at); return; }
    }
    const end = this.xml.lastIndexOf(`</${this.P}styleSheet>`);
    this.xml = this.xml.slice(0, end) + el + this.xml.slice(end);
  }
  private read(s: Section): string[] {
    const m = this.section(s)!;
    return elements(m[0].replace(/^<[^>]*>/, ''), this.P, ITEM[s]).map((x) => x[0]);
  }

  get(s: Section, i: number): string | undefined { return this.items[s][i]; }
  count(s: Section): number { return this.items[s].length; }
  /** The index of an identical item, else a new one at the end. */
  add(s: Section, item: string): number {
    const k = squash(item);
    const hit = this.keys[s].get(k);
    if (hit !== undefined) return hit;
    const i = this.items[s].push(item) - 1;
    this.keys[s].set(k, i);
    this.grown.add(s);
    return i;
  }

  toString(): string {
    let xml = this.xml;
    for (const s of this.grown) {
      const m = new RegExp(`<${this.P}${s}\\b[^>]*?(?:/>|>[\\s\\S]*?</${this.P}${s}>)`).exec(xml)!;
      const open = setAttr(/^<[^>]*?(?=\/?>)/.exec(m[0])![0].replace(/\s*\/$/, '') + '>', 'count', String(this.items[s].length));
      xml = xml.slice(0, m.index) + `${open}${this.items[s].join('')}</${this.P}${s}>` + xml.slice(m.index + m[0].length);
    }
    return xml;
  }
}

/** A font with b / i / u / strike / colour set from the patch; everything else (size, name, scheme) kept. */
export function patchFont(font: string, p: StylePatch, P: string): string {
  let open = /^<[^>]*?(?=\/?>)/.exec(font)![0].replace(/\s*\/$/, '');
  let inner = /\/>$/.test(font) ? '' : font.slice(font.indexOf('>') + 1, font.lastIndexOf('<'));
  const drop = (name: string) => { inner = inner.replace(new RegExp(`<${P}${name}(?=[\\s>/])[^>]*?(?:/>|>[\\s\\S]*?</${P}${name}>)`, 'g'), ''); };
  let lead = '';
  for (const [k, el] of [['b', 'b'], ['i', 'i'], ['strike', 'strike'], ['u', 'u']] as const) {
    if (p[k] === undefined) {
      const m = new RegExp(`<${P}${el}(?=[\\s>/])[^>]*?(?:/>|>[\\s\\S]*?</${P}${el}>)`).exec(inner);
      if (m) { lead += m[0]; drop(el); }
      continue;
    }
    drop(el);
    if (p[k]) lead += `<${P}${el}/>`;
  }
  if (p.color !== undefined) {
    drop('color');
    if (p.color) {
      const c = `<${P}color rgb="${argb(p.color)}"/>`;
      const at = inner.search(new RegExp(`<${P}(name|family|charset|scheme)\\b`));
      inner = at >= 0 ? inner.slice(0, at) + c + inner.slice(at) : inner + c;
    }
  }
  open = open.replace(/\s+$/, '');
  return `${open}>${lead}${inner}</${P}font>`;
}

export function fillXml(rgb: string | null, P: string): string {
  return rgb
    ? `<${P}fill><${P}patternFill patternType="solid"><${P}fgColor rgb="${argb(rgb)}"/><${P}bgColor indexed="64"/></${P}patternFill></${P}fill>`
    : `<${P}fill><${P}patternFill patternType="none"/></${P}fill>`;
}

const BORDER_SEQ = ['left', 'right', 'top', 'bottom', 'diagonal', 'vertical', 'horizontal'] as const;
const ALIAS: Partial<Record<string, string>> = { left: 'start', right: 'end' };
const edgeXml = (side: string, e: BorderEdge | null, P: string) =>
  e ? `<${P}${side} style="${escAttr(e.style)}"><${P}color ${e.color ? `rgb="${argb(e.color)}"` : 'indexed="64"'}/></${P}${side}>` : `<${P}${side}/>`;

/** A border with the patch's sides replaced, in CT_Border's sequence; untouched sides kept as written. */
export function patchBorder(border: string | undefined, sides: Partial<Record<Side, BorderEdge | null>>, P: string): string {
  const src = border ?? `<${P}border/>`;
  const open = /^<[^>]*?(?=\/?>)/.exec(src)![0].replace(/\s*\/$/, '').replace(/\s+$/, '');
  const inner = /\/>$/.test(src) ? '' : src.slice(src.indexOf('>') + 1, src.lastIndexOf('<'));
  const parts: string[] = [];
  for (const name of BORDER_SEQ) {
    if ((SIDES as readonly string[]).includes(name) && name in sides) { parts.push(edgeXml(name, sides[name as Side] ?? null, P)); continue; }
    const m = [name, ALIAS[name]].filter(Boolean).map((n) => elements(inner, P, n!)[0]).find(Boolean);
    if (m) parts.push(m[0]);
    else if (name === 'left' || name === 'right' || name === 'top' || name === 'bottom' || name === 'diagonal') parts.push(`<${P}${name}/>`);
  }
  return `${open}>${parts.join('')}</${P}border>`;
}

const H_XML: Record<string, string> = { left: 'left', center: 'center', right: 'right' };
const V_XML: Record<string, string> = { top: 'top', middle: 'center', bottom: 'bottom' };

/** An `<xf>` pointed at new font / fill / border ids with the patch's alignment; numFmtId and protection kept. */
export function patchXf(xf: string, ids: { fontId?: number; fillId?: number; borderId?: number }, p: StylePatch, P: string): string {
  let open = /^<[^>]*?(?=\/?>)/.exec(xf)![0].replace(/\s*\/$/, '').replace(/\s+$/, '') + '>';
  let inner = /\/>$/.test(xf) ? '' : xf.slice(xf.indexOf('>') + 1, xf.lastIndexOf('<'));
  if (p.clear) { open = setAttr(open, 'xfId', '0'); }
  for (const [k, apply] of [['fontId', 'applyFont'], ['fillId', 'applyFill'], ['borderId', 'applyBorder']] as const) {
    const v = ids[k];
    if (v === undefined) continue;
    open = setAttr(open, k, String(v));
    open = setAttr(open, apply, '1');
  }
  const touchesAlign = p.clear || p.align !== undefined || p.valign !== undefined || p.wrap !== undefined;
  if (touchesAlign) {
    const cur = elements(inner, P, 'alignment')[0];
    let al = p.clear || !cur ? `<${P}alignment/>` : cur[0].replace(/>[\s\S]*$/, '>').replace(/\s*\/?>$/, '/>');
    if (p.align !== undefined) al = p.align ? setAttr(al, 'horizontal', H_XML[p.align]!) : removeAttr(al, 'horizontal');
    if (p.valign !== undefined) al = p.valign ? setAttr(al, 'vertical', V_XML[p.valign]!) : removeAttr(al, 'vertical');
    if (p.wrap !== undefined) al = p.wrap ? setAttr(al, 'wrapText', '1') : removeAttr(al, 'wrapText');
    const rest = cur ? inner.replace(cur[0], '') : inner;
    const empty = !/\s\w+\s*=/.test(al);
    inner = (empty ? '' : al) + rest;
    open = empty ? removeAttr(open, 'applyAlignment') : setAttr(open, 'applyAlignment', '1');
  }
  return inner ? `${open}${inner}</${P}xf>` : open.replace(/>$/, '/>');
}

/** The `<xf>` index a cell gets: its current xf with the patch applied, every new piece deduplicated. Memoised per (xf, patch). */
export function restyleIndex(sheet: StyleSheet, cur: number, p: StylePatch, memo: Map<string, number>): number {
  const key = `${cur}|${JSON.stringify(p)}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const P = sheet.P;
  const xf = sheet.get('cellXfs', cur) ?? sheet.get('cellXfs', 0) ?? `<${P}xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`;
  const num = (n: string) => Number(getAttr(xf, n) ?? 0);
  const ids: { fontId?: number; fillId?: number; borderId?: number } = {};
  const fontTouched = p.b !== undefined || p.i !== undefined || p.u !== undefined || p.strike !== undefined || p.color !== undefined;
  const fontBase = p.clear ? 0 : num('fontId');
  if (fontTouched) ids.fontId = sheet.add('fonts', patchFont(sheet.get('fonts', fontBase) ?? sheet.get('fonts', 0) ?? `<${P}font/>`, p, P));
  else if (p.clear) ids.fontId = 0;
  if (p.fill !== undefined) {
    ids.fillId = p.fill === null ? noneFill(sheet) : solidFill(sheet, p.fill) ?? sheet.add('fills', fillXml(p.fill, P));
  } else if (p.clear) ids.fillId = noneFill(sheet);
  const borderBase = p.clear ? 0 : num('borderId');
  if (p.border && Object.keys(p.border).length) {
    const base = p.clear ? undefined : sheet.get('borders', borderBase);
    ids.borderId = sheet.add('borders', patchBorder(base, p.border, P));
  } else if (p.clear) ids.borderId = sheet.add('borders', patchBorder(undefined, {}, P));
  const i = sheet.add('cellXfs', patchXf(xf, ids, p, P));
  memo.set(key, i);
  return i;
}

/** An existing solid fill of this colour, however it was written (with or without a bgColor). */
function solidFill(sheet: StyleSheet, rgb: string): number | undefined {
  for (let i = 0; i < sheet.count('fills'); i++) {
    const f = squash(sheet.get('fills', i)!);
    if (!/patternType\s*=\s*["']solid["']/.test(f) || /gradientFill/.test(f)) continue;
    const fg = /<(?:\w+:)?fgColor\b[^>]*>/.exec(f);
    if (fg && (getAttr(fg[0], 'rgb') ?? '').toUpperCase() === argb(rgb) && getAttr(fg[0], 'tint') === undefined) return i;
  }
  return undefined;
}

/** The first `none` fill (Excel keeps one at index 0), else a new one. */
function noneFill(sheet: StyleSheet): number {
  for (let i = 0; i < sheet.count('fills'); i++) {
    const f = sheet.get('fills', i)!;
    if (/patternType\s*=\s*["']none["']/.test(f) || /^<[^>]*><(\w+:)?patternFill\s*\/>/.test(squash(f))) return i;
  }
  return sheet.add('fills', fillXml(null, sheet.P));
}

// ── worksheet XML: repoint `s` ──────────────────────────────────────────────

/**
 * Sets `s` on each listed cell — `style(ref, current)` returns the new index —
 * adding `<c r s/>` (and its `<row>`) where the cell has no element yet. Rows
 * without a listed cell are kept byte for byte, and so is every other cell.
 */
export function restyleSheetXml(xml: string, refs: readonly string[], style: (ref: string, current: number) => number): string {
  const P = /<(\w+:)?worksheet\b/.exec(xml)?.[1] ?? '';
  const open = new RegExp(`<${P}sheetData\\b[^>]*?(/?)>`).exec(xml);
  if (!open) return xml;
  const closeTag = `</${P}sheetData>`;
  let inner: string, start: number, end: number;
  if (open[1] === '/') { inner = ''; start = open.index; end = open.index + open[0].length; }
  else {
    const c = xml.indexOf(closeTag, open.index);
    if (c < 0) return xml;
    inner = xml.slice(open.index + open[0].length, c); start = open.index; end = c + closeTag.length;
  }
  const want = new Map<number, Map<number, string>>();
  for (const ref of refs) {
    const p = parseA1(ref);
    if (!p) continue;
    let m = want.get(p.row + 1);
    if (!m) want.set(p.row + 1, (m = new Map()));
    m.set(p.col, ref);
  }
  const rowRe = new RegExp(`<${P}row\\b[^>]*?(/?)>`, 'g');
  const rowClose = `</${P}row>`;
  const out: string[] = [];
  let last = 0, prevNum = 0, m: RegExpExecArray | null;
  const pending = [...want.keys()].sort((a, b) => a - b);
  const done = new Set<number>();
  const newRow = (num: number) => {
    const cells = [...want.get(num)!].sort((a, b) => a[0] - b[0]).map(([, ref]) => `<${P}c r="${ref}" s="${style(ref, 0)}"/>`);
    done.add(num);
    return `<${P}row r="${num}">${cells.join('')}</${P}row>`;
  };
  while ((m = rowRe.exec(inner))) {
    const r = getAttr(m[0], 'r');
    const num = r ? Number(r) : prevNum + 1;
    prevNum = num;
    let rowEnd = rowRe.lastIndex, body: string | undefined;
    if (m[1] !== '/') {
      const e = inner.indexOf(rowClose, rowRe.lastIndex);
      if (e < 0) return xml;
      body = inner.slice(rowRe.lastIndex, e);
      rowEnd = e + rowClose.length;
      rowRe.lastIndex = rowEnd;
    }
    out.push(inner.slice(last, m.index));
    last = rowEnd;
    while (pending.length && pending[0]! < num) { const n = pending.shift()!; if (!done.has(n)) out.push(newRow(n)); }
    const cols = want.get(num);
    if (!cols) { out.push(inner.slice(m.index, rowEnd)); continue; }
    if (pending[0] === num) pending.shift();
    done.add(num);
    const rowS = getAttr(m[0], 'customFormat') === '1' ? Number(getAttr(m[0], 's') ?? 0) : 0;
    const cellRe = new RegExp(`<${P}c(?=[\\s>/])([^>]*?)(/?)>`, 'g');
    const src = body ?? '';
    const cells: { col: number; xml: string }[] = [];
    let cm: RegExpExecArray | null, prevCol = -1, cLast = 0;
    const between: string[] = [];
    while ((cm = cellRe.exec(src))) {
      between.push(src.slice(cLast, cm.index));
      let cEnd = cellRe.lastIndex;
      if (cm[2] !== '/') {
        const e = src.indexOf(`</${P}c>`, cellRe.lastIndex);
        cEnd = e < 0 ? src.length : e + `</${P}c>`.length;
        cellRe.lastIndex = cEnd;
      }
      const rr = getAttr(cm[0], 'r');
      const col = rr ? parseA1(rr)?.col ?? prevCol + 1 : prevCol + 1;
      prevCol = col;
      let cx = src.slice(cm.index, cEnd);
      const ref = cols.get(col);
      if (ref !== undefined) {
        let tag = cm[0];
        const cur = Number(getAttr(tag, 's') ?? rowS);
        tag = setAttr(rr ? tag : tag.replace(new RegExp(`^<${P}c`), `<${P}c r="${a1(num - 1, col)}"`), 's', String(style(ref, cur)));
        cx = tag + cx.slice(cm[0].length);
        cols.delete(col);
      }
      cells.push({ col, xml: cx });
      cLast = cEnd;
    }
    const tail = src.slice(cLast);
    for (const [col, ref] of cols) cells.push({ col, xml: `<${P}c r="${ref}" s="${style(ref, rowS)}"/>` });
    const sorted = [...cells].sort((a, b) => a.col - b.col);
    const orderKept = sorted.every((c, i) => c === cells[i]);
    // Keep the original spacing between cells when nothing was inserted out of order.
    const bodyOut = orderKept && cells.length === between.length ? cells.map((c, i) => between[i] + c.xml).join('') + tail : sorted.map((c) => c.xml).join('') + tail;
    let rowOpen = m[0].replace(/\s*\/>$/, '>');
    if (!r) rowOpen = setAttr(rowOpen, 'r', String(num));
    rowOpen = removeAttr(rowOpen, 'spans');
    out.push(`${rowOpen}${bodyOut}${rowClose}`);
  }
  out.push(inner.slice(last));
  for (const n of pending) if (!done.has(n)) out.push(newRow(n));
  const sdOpen = open[1] === '/' ? open[0].replace(/\s*\/>$/, '>') : open[0];
  return xml.slice(0, start) + `${sdOpen}${out.join('')}${closeTag}` + xml.slice(end);
}

// ── the hook ────────────────────────────────────────────────────────────────

async function stylesPathOf(patch: PatchContext): Promise<string | undefined> {
  const wb = patch.workbookPath();
  const rels = await patch.readText(patch.relsPathOf(wb));
  const m = rels && [...rels.matchAll(/<(?:\w+:)?Relationship\b[^>]*>/g)].map((x) => x[0]).find((t) => (getAttr(t, 'Type') ?? '').endsWith('/styles'));
  if (!m) return undefined;
  const target = getAttr(m, 'Target') ?? '';
  if (target.startsWith('/')) return target.slice(1);
  const segs = (wb.slice(0, wb.lastIndexOf('/') + 1) + target).split('/');
  const out: string[] = [];
  for (const s of segs) { if (s === '..') out.pop(); else if (s && s !== '.') out.push(s); }
  return out.join('/');
}

/** Writes every style change in the pane into the package. */
export async function writeStyles(patch: PatchContext, ctx: PluginContext): Promise<void> {
  const list = styleChanges(ctx.snapshot().changes).filter((c) => Object.keys(c.patch).length);
  if (!list.length) return;
  let path = await stylesPathOf(patch);
  let src = path ? await patch.readText(path) : undefined;
  if (!path || src === undefined) {
    path ??= 'xl/styles.xml';
    src = MINIMAL_STYLES;
    if (!(await stylesPathOf(patch))) {
      const wb = patch.workbookPath();
      const dir = wb.slice(0, wb.lastIndexOf('/') + 1);
      await patch.addRelationship(wb, REL_STYLES, path.startsWith(dir) ? path.slice(dir.length) : `/${path}`);
    }
    await patch.setContentType(path, CT_STYLES);
  }
  const sheet = new StyleSheet(src);
  const memo = new Map<string, number>();
  const bySheet = new Map<string, Map<string, StylePatch>>();
  for (const c of list) {
    let m = bySheet.get(c.sheet);
    if (!m) bySheet.set(c.sheet, (m = new Map()));
    m.set(c.ref, c.patch);
  }
  for (const [name, cells] of bySheet) {
    const sp = patch.sheetPath(name);
    const xml = sp && (await patch.readText(sp));
    if (!sp || !xml) continue;
    patch.write(sp, restyleSheetXml(xml, [...cells.keys()], (ref, cur) => restyleIndex(sheet, cur, cells.get(ref)!, memo)));
  }
  patch.write(path, sheet.toString());
}
