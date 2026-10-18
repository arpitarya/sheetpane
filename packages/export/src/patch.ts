// patchXlsx: the uploaded .xlsx in, the same file with only the changed cells
// rewritten out (export verdict decision 2; SR-LAW-6 fidelity ruling). Every
// part nobody touched is copied byte for byte, compressed data and all.
import { ExportError } from './errors.js';
import { shiftFormula } from './formula.js';
import { CT, NS_PKG_REL, REL, XML_DECL } from './ooxml.js';
import { MAX_COLS, MAX_ROWS, cellRef, parseRange, parseRef, rangeRef, rangesIntersect, type RangePos } from './refs.js';
import type { Cell, Change, SheetState } from './types.js';
import { checkCell } from './validate.js';
import { cellXml, paneXml } from './xlsx.js';
import { escapeAttr, fromUtf8, unescapeXml, utf8 } from './xml.js';
import { DEFAULT_LIMITS, inflateEntry, readZip, writeZip, type WriteOptions, type ZipEntry, type ZipInput, type ZipLimits } from './zip.js';

/** What an `exportPatch` hook (a plugin) may do inside `patchXlsx`, after the core has written its changes. */
export interface PatchContext {
  readonly changes: readonly Change[];
  /** Every part name in the package, e.g. `xl/worksheets/sheet1.xml`. */
  list(): string[];
  has(path: string): boolean;
  readText(path: string): Promise<string | undefined>;
  readBytes(path: string): Promise<Uint8Array | undefined>;
  write(path: string, data: string | Uint8Array): void;
  remove(path: string): void;
  workbookPath(): string;
  sheetNames(): string[];
  /** The worksheet part of a sheet, e.g. `xl/worksheets/sheet2.xml`. */
  sheetPath(name: string): string | undefined;
  /** `xl/worksheets/sheet1.xml` → `xl/worksheets/_rels/sheet1.xml.rels`. */
  relsPathOf(part: string): string;
  /** Adds a relationship from a part and returns its new `rId`. The rels part is created when missing. */
  addRelationship(fromPart: string, type: string, target: string, targetMode?: 'External'): Promise<string>;
  /** An `<Override>` in `[Content_Types].xml` for one part. */
  setContentType(part: string, contentType: string): Promise<void>;
  /** A `<Default>` in `[Content_Types].xml` for an extension. */
  setDefaultContentType(extension: string, contentType: string): Promise<void>;
}

/** A plugin's `exportPatch` hook: it edits the package through the context after the core's own writes. */
export type ExportPatchHook = (ctx: PatchContext) => void | Promise<void>;

/** Options for `patchXlsx`: compression, size limits, plugin hooks, and freeze, merge and hidden-state rewrites. */
export interface PatchOptions extends WriteOptions, ZipLimits {
  /** Plugin hooks, run in order after the core's own writes (plugins verdict, `exportPatch`). */
  exportPatch?: ExportPatchHook[];
  /** Called with every `Sheet!A1` whose text lost characters XML forbids. */
  onStripped?: (refs: string[]) => void;
  /** Freeze panes to write (W-24); `rows: 0, cols: 0` unfreezes. Sheets not named keep their `<pane>` untouched. */
  freeze?: { sheet: string; rows: number; cols: number }[];
  /** A sheet's merged ranges, whole: its `<mergeCells>` is rewritten to exactly these. Sheets not named keep theirs. */
  merges?: { sheet: string; ranges: string[] }[];
  /**
   * Hidden rows, columns, outline levels and sheet state to write (W-49). Each list is whole:
   * the named indexes carry the setting and every other index loses it. Sheets, and fields,
   * not given are left as the file has them. Hiding every sheet is refused (`sheet-count`).
   */
  hidden?: HiddenPatch[];
}

/** One sheet's hidden state for `patchXlsx`'s `hidden` option. Indexes are 0-based; every list is the whole set after the edit. */
export interface HiddenPatch {
  /** The sheet's name. */
  sheet: string;
  /** Every hidden row (0 = row 1). Rows listed get `hidden="1"`, missing `<row>` elements are created in order; every other row loses `hidden` (and a zero `ht`). */
  rows?: number[];
  /** Every hidden column (0 = A). `<col>` spans are split and merged so exactly these carry `hidden="1"`; width and style are kept on each piece. */
  cols?: number[];
  /** `<sheet state>` in the workbook part; `visible` removes the attribute. A hidden active sheet hands `activeTab` to the first visible one. */
  state?: SheetState;
  /** Outline (group) levels 0–7 by index; indexes not listed go back to level 0. `sheetFormatPr outlineLevelRow` / `outlineLevelCol` follow the deepest level. */
  outline?: { rows?: Record<number, number>; cols?: Record<number, number> };
}

const dirOf = (p: string) => p.slice(0, p.lastIndexOf('/') + 1);
const baseOf = (p: string) => p.slice(p.lastIndexOf('/') + 1);
/** The relationships part of a part: `xl/worksheets/sheet1.xml` → `xl/worksheets/_rels/sheet1.xml.rels`. */
export const relsPathOf = (part: string) => `${dirOf(part)}_rels/${baseOf(part)}.rels`;

/**
 * Resolves a relationship target against the folder of the part that owns the rels.
 *
 * @param fromPart - The part that owns the relationship, e.g. `xl/workbook.xml`.
 * @param target - The `Target`, relative or starting with `/`.
 * @returns The target's part name, without a leading `/`.
 */
export function resolveTarget(fromPart: string, target: string): string {
  const segs = (target.startsWith('/') ? target.slice(1) : dirOf(fromPart) + target).split('/');
  const out: string[] = [];
  for (const s of segs) {
    if (s === '..') out.pop();
    else if (s !== '.' && s !== '') out.push(s);
  }
  return out.join('/');
}

/**
 * An attribute's unescaped value; `name` may be `*:id` for any namespace prefix.
 *
 * @param tag - One opening or empty tag's text.
 * @param name - The attribute's name.
 * @returns The value, or `undefined` when the attribute is absent.
 */
export function getAttr(tag: string, name: string): string | undefined {
  const n = name.startsWith('*:') ? `[\\w.-]+:${name.slice(2)}` : name.replace(/[.:]/g, '\\$&');
  const m = new RegExp(`\\s${n}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(tag);
  return m ? unescapeXml(m[1] ?? m[2] ?? '') : undefined;
}

/**
 * Sets (or adds) an attribute on an opening or empty tag.
 *
 * @param tag - The tag's text.
 * @param name - The attribute's name.
 * @param value - The plain value; it is escaped.
 * @returns The rewritten tag.
 */
export function setAttr(tag: string, name: string, value: string): string {
  const re = new RegExp(`(\\s${name.replace(/[.:]/g, '\\$&')}\\s*=\\s*)(?:"[^"]*"|'[^']*')`);
  if (re.test(tag)) return tag.replace(re, `$1"${escapeAttr(value)}"`);
  return tag.replace(/\s*(\/?)>$/, ` ${name}="${escapeAttr(value)}"$1>`);
}

/**
 * Removes an attribute from an opening or empty tag.
 *
 * @param tag - The tag's text.
 * @param name - The attribute's name.
 * @returns The tag without it.
 */
export function removeAttr(tag: string, name: string): string {
  return tag.replace(new RegExp(`\\s${name.replace(/[.:]/g, '\\$&')}\\s*=\\s*(?:"[^"]*"|'[^']*')`), '');
}

/** One `<Relationship>` of a rels part. */
export interface Relationship {
  /** The `Id`, e.g. `rId1`. */
  id: string;
  /** The relationship type URI. */
  type: string;
  /** The `Target`, as written. */
  target: string;
  /** The `TargetMode`, e.g. `External`. */
  mode: string | undefined;
}

/**
 * Reads every `<Relationship>` of a rels part.
 *
 * @param xml - The rels part's XML.
 * @returns The relationships, in document order.
 */
export function parseRels(xml: string): Relationship[] {
  return [...xml.matchAll(/<(?:\w+:)?Relationship\b[^>]*>/g)].map((m) => ({
    id: getAttr(m[0], 'Id') ?? '', type: getAttr(m[0], 'Type') ?? '', target: getAttr(m[0], 'Target') ?? '', mode: getAttr(m[0], 'TargetMode'),
  }));
}

/** The package's parts, read lazily, written in memory, in the original order. */
class Parts {
  private readonly entries = new Map<string, ZipEntry>();
  private readonly cache = new Map<string, Uint8Array>();
  private readonly written = new Map<string, Uint8Array>();
  private readonly order: string[];
  private readonly gone = new Set<string>();
  constructor(private readonly src: Uint8Array, list: ZipEntry[], private readonly limits: ZipLimits) {
    for (const e of list) this.entries.set(e.name, e);
    this.order = [...this.entries.keys()];
  }
  list(): string[] { return this.order.filter((n) => !this.gone.has(n)); }
  has(p: string): boolean { return !this.gone.has(p) && (this.written.has(p) || this.entries.has(p)); }
  async bytes(p: string): Promise<Uint8Array | undefined> {
    if (this.gone.has(p)) return undefined;
    const w = this.written.get(p) ?? this.cache.get(p);
    if (w) return w;
    const e = this.entries.get(p);
    if (!e) return undefined;
    const b = await inflateEntry(this.src, e, this.limits);
    this.cache.set(p, b);
    return b;
  }
  async text(p: string): Promise<string | undefined> {
    const b = await this.bytes(p);
    return b && fromUtf8(b);
  }
  write(p: string, data: string | Uint8Array): void {
    this.gone.delete(p);
    this.written.set(p, typeof data === 'string' ? utf8(data) : data);
    if (!this.order.includes(p)) this.order.push(p);
  }
  remove(p: string): void { this.gone.add(p); this.written.delete(p); }
  zipInputs(): ZipInput[] {
    return this.list().map((name) => {
      const w = this.written.get(name);
      return w ? { name, data: w } : { name, copy: this.entries.get(name)!, from: this.src };
    });
  }
}

interface SheetRef { name: string; path: string }

async function locateWorkbook(parts: Parts): Promise<{ wbPath: string; sheets: SheetRef[] }> {
  const root = await parts.text('_rels/.rels');
  const office = root && parseRels(root).find((r) => r.type.endsWith('/officeDocument'));
  const wbPath = office ? resolveTarget('', office.target) : 'xl/workbook.xml';
  const wb = await parts.text(wbPath);
  if (!wb) throw new ExportError('not-workbook', 'not a workbook (no xl/workbook.xml)');
  const rels = parseRels((await parts.text(relsPathOf(wbPath))) ?? '');
  const sheets: SheetRef[] = [];
  for (const m of wb.matchAll(/<(?:\w+:)?sheet\b[^>]*>/g)) {
    const name = getAttr(m[0], 'name'), id = getAttr(m[0], '*:id');
    const rel = rels.find((r) => r.id === id);
    if (name !== undefined && rel) sheets.push({ name, path: resolveTarget(wbPath, rel.target) });
  }
  return { wbPath, sheets };
}

interface ParsedCell { col: number; attrs: string; body: string | undefined; xml: string }
interface ParsedRow { num: number; open: string; body: string | undefined }

function parseRows(inner: string, P: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const re = new RegExp(`<${P}row\\b[^>]*?(/?)>`, 'g');
  const close = `</${P}row>`;
  let m: RegExpExecArray | null, prev = 0;
  while ((m = re.exec(inner))) {
    const r = getAttr(m[0], 'r');
    const num = r ? Number(r) : prev + 1;
    if (m[1] === '/') {
      rows.push({ num, open: m[0].replace(/\s*\/>$/, '>'), body: undefined });
    } else {
      const end = inner.indexOf(close, re.lastIndex);
      if (end < 0) throw new ExportError('corrupt', `row ${num} is not closed`);
      rows.push({ num, open: m[0], body: inner.slice(re.lastIndex, end) });
      re.lastIndex = end + close.length;
    }
    prev = num;
  }
  return rows;
}

function parseCells(body: string, rowNum: number, P: string): ParsedCell[] {
  const cells: ParsedCell[] = [];
  const re = new RegExp(`<${P}c(?=[\\s>/])([^>]*?)(?:/>|>([\\s\\S]*?)</${P}c>)`, 'g');
  let m: RegExpExecArray | null, prev = -1;
  while ((m = re.exec(body))) {
    const r = getAttr(m[0], 'r');
    const pos = r ? parseRef(r) : undefined;
    const col = pos ? pos.col : prev + 1;
    cells.push({ col, attrs: m[1] ?? '', body: m[2], xml: r ? m[0] : m[0].replace(new RegExp(`^<${P}c`), `<${P}c r="${cellRef(rowNum - 1, col)}"`) });
    prev = col;
  }
  return cells;
}

const fTag = (P: string) => new RegExp(`<${P}f\\b[^>]*?(?:/>|>([\\s\\S]*?)</${P}f>)`);

interface SheetPatch { xml: string; formulaTouched: boolean }

/** Rewrites the changed `<c>` elements of one worksheet's XML; everything else is kept as written. */
export function patchSheetXml(xml: string, sheetName: string, changes: Map<string, Cell>, stripped: string[] = []): SheetPatch {
  const P = /<(\w+:)?worksheet\b/.exec(xml)?.[1] ?? '';
  const open = new RegExp(`<${P}sheetData\\b[^>]*?(/?)>`).exec(xml);
  if (!open) throw new ExportError('corrupt', `sheet "${sheetName}" has no <sheetData>`, { sheet: sheetName });
  const closeTag = `</${P}sheetData>`;
  let before: string, inner: string, after: string, openTag: string;
  if (open[1] === '/') {
    before = xml.slice(0, open.index); inner = ''; after = xml.slice(open.index + open[0].length); openTag = `<${P}sheetData>`;
  } else {
    const cEnd = xml.indexOf(closeTag, open.index);
    if (cEnd < 0) throw new ExportError('corrupt', `sheet "${sheetName}" has an unclosed <sheetData>`, { sheet: sheetName });
    before = xml.slice(0, open.index); openTag = open[0];
    inner = xml.slice(open.index + open[0].length, cEnd); after = xml.slice(cEnd + closeTag.length);
  }
  const byRow = new Map<number, Map<number, Cell>>();
  for (const [ref, v] of changes) {
    const p = parseRef(ref)!;
    let m = byRow.get(p.row + 1);
    if (!m) byRow.set(p.row + 1, (m = new Map()));
    m.set(p.col, v);
  }
  const rows = parseRows(inner, P);
  const F = fTag(P);
  let formulaTouched = false;
  // Shared-formula masters being overwritten: si → { formula, row, col }.
  const masters = new Map<string, { f: string; row: number; col: number }>();
  const cellsOf = new Map<number, ParsedCell[]>();
  const getCells = (r: ParsedRow) => {
    let c = cellsOf.get(r.num);
    if (!c) cellsOf.set(r.num, (c = r.body === undefined ? [] : parseCells(r.body, r.num, P)));
    return c;
  };
  for (const r of rows) {
    const ch = byRow.get(r.num);
    if (!ch) continue;
    for (const c of getCells(r)) {
      if (!ch.has(c.col) || c.body === undefined) continue;
      const f = F.exec(c.body);
      if (!f) continue;
      formulaTouched = true;
      if (getAttr(f[0], 't') === 'shared' && getAttr(f[0], 'ref') && f[1]) masters.set(getAttr(f[0], 'si')!, { f: f[1], row: r.num - 1, col: c.col });
    }
  }
  // Promote the first remaining dependent of each overwritten master.
  const promote = new Map<string, { row: number; col: number; xml: string }>(); // `${row},${col}` → new cell xml
  if (masters.size) {
    const deps = new Map<string, { row: number; col: number; c: ParsedCell }[]>();
    for (const r of rows) for (const c of getCells(r)) {
      if (c.body === undefined || byRow.get(r.num)?.has(c.col)) continue;
      const f = F.exec(c.body);
      const si = f && getAttr(f[0], 't') === 'shared' ? getAttr(f[0], 'si') : undefined;
      if (si !== undefined && masters.has(si)) {
        let l = deps.get(si);
        if (!l) deps.set(si, (l = []));
        l.push({ row: r.num - 1, col: c.col, c });
      }
    }
    for (const [si, list] of deps) {
      const m = masters.get(si)!, first = list[0]!;
      const box: RangePos = { top: first.row, left: first.col, bottom: first.row, right: first.col };
      for (const d of list) { box.top = Math.min(box.top, d.row); box.bottom = Math.max(box.bottom, d.row); box.left = Math.min(box.left, d.col); box.right = Math.max(box.right, d.col); }
      const text = shiftFormula(unescapeXml(m.f), first.row - m.row, first.col - m.col);
      const xmlNew = first.c.xml.replace(F, `<${P}f t="shared" ref="${rangeRef(box)}" si="${si}">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</${P}f>`);
      promote.set(`${first.row},${first.col}`, { row: first.row, col: first.col, xml: xmlNew });
    }
  }
  const touched = new Set([...byRow.keys(), ...[...promote.values()].map((p) => p.row + 1)]);
  const out: string[] = [];
  const pushRow = (num: number, openTagRow: string, cells: { col: number; xml: string }[]) => {
    let o = removeAttr(openTagRow, 'spans');
    if (!getAttr(o, 'r')) o = setAttr(o, 'r', String(num));
    cells.sort((a, b) => a.col - b.col);
    out.push(cells.length ? `${o}${cells.map((c) => c.xml).join('')}</${P}row>` : o.replace(/>$/, '/>'));
  };
  const newRow = (num: number) => {
    const cells: { col: number; xml: string }[] = [];
    for (const [col, v] of byRow.get(num)!) {
      const ref = cellRef(num - 1, col);
      const x = cellXml(ref, v, undefined, P, () => stripped.push(`${sheetName}!${ref}`));
      if (x) cells.push({ col, xml: x });
    }
    if (cells.length) pushRow(num, `<${P}row r="${num}">`, cells);
  };
  const pending = [...byRow.keys()].filter((n) => !rows.some((r) => r.num === n)).sort((a, b) => a - b);
  for (const r of rows) {
    while (pending.length && pending[0]! < r.num) newRow(pending.shift()!);
    if (!touched.has(r.num)) {
      const o = getAttr(r.open, 'r') ? r.open : setAttr(r.open, 'r', String(r.num));
      out.push(r.body === undefined ? o.replace(/>$/, '/>') : `${o}${r.body}</${P}row>`);
      continue;
    }
    const ch = byRow.get(r.num) ?? new Map<number, Cell>();
    const cells: { col: number; xml: string }[] = [];
    const seen = new Set<number>();
    for (const c of getCells(r)) {
      seen.add(c.col);
      const pr = promote.get(`${r.num - 1},${c.col}`);
      if (pr) { cells.push({ col: c.col, xml: pr.xml }); continue; }
      if (!ch.has(c.col)) { cells.push({ col: c.col, xml: c.xml }); continue; }
      const ref = cellRef(r.num - 1, c.col);
      const x = cellXml(ref, ch.get(c.col)!, getAttr(`<c${c.attrs}>`, 's'), P, () => stripped.push(`${sheetName}!${ref}`));
      if (x) cells.push({ col: c.col, xml: x });
    }
    for (const [col, v] of ch) if (!seen.has(col)) {
      const ref = cellRef(r.num - 1, col);
      const x = cellXml(ref, v, undefined, P, () => stripped.push(`${sheetName}!${ref}`));
      if (x) cells.push({ col, xml: x });
    }
    pushRow(r.num, r.open, cells);
  }
  while (pending.length) newRow(pending.shift()!);
  let result = `${before}${openTag}${out.join('')}${closeTag}${after}`;
  // Widen <dimension> to cover every new value.
  const dim = new RegExp(`<${P}dimension\\b[^>]*>`).exec(result);
  if (dim) {
    const cur = parseRange(getAttr(dim[0], 'ref') ?? 'A1') ?? { top: 0, left: 0, bottom: 0, right: 0 };
    let grown = false;
    for (const [ref, v] of changes) if (v !== null) {
      const p = parseRef(ref)!;
      if (p.row < cur.top || p.row > cur.bottom || p.col < cur.left || p.col > cur.right) grown = true;
      cur.top = Math.min(cur.top, p.row); cur.bottom = Math.max(cur.bottom, p.row); cur.left = Math.min(cur.left, p.col); cur.right = Math.max(cur.right, p.col);
    }
    if (grown) result = result.replace(dim[0], setAttr(dim[0], 'ref', rangeRef(cur)));
  }
  return { xml: result, formulaTouched };
}

/**
 * Replaces the first sheet view's `<pane>` (and its pane selections) with a frozen pane, or removes it.
 *
 * @param xml - The worksheet's XML.
 * @param f - Frozen rows and columns; `0, 0` removes the pane.
 * @returns The rewritten worksheet XML.
 */
export function setPane(xml: string, f: { rows: number; cols: number }): string {
  const P = /<(\w+:)?worksheet\b/.exec(xml)?.[1] ?? '';
  const pane = paneXml(f, P);
  const view = new RegExp(`<${P}sheetView\\b[^>]*?(/>|>[\\s\\S]*?</${P}sheetView>)`).exec(xml);
  if (!view) {
    if (!pane) return xml;
    const el = `<${P}sheetViews><${P}sheetView workbookViewId="0">${pane}</${P}sheetView></${P}sheetViews>`;
    const at = xml.search(new RegExp(`<${P}(sheetFormatPr|cols|sheetData)\\b`));
    return xml.slice(0, at) + el + xml.slice(at);
  }
  const open = /^<[^>]*?(?=\/?>)/.exec(view[0])![0].replace(/\s*\/$/, '');
  const inner = view[1] === '/>' ? '' : view[0].slice(view[0].indexOf('>') + 1, view[0].lastIndexOf('<'));
  const kept = inner.replace(new RegExp(`<${P}pane\\b[^>]*/>`), '').replace(new RegExp(`<${P}selection\\b[^>]*\\bpane="(?:bottomRight|bottomLeft|topRight)"[^>]*/>`, 'g'), '');
  return xml.replace(view[0], `${open}>${pane}${kept}</${P}sheetView>`);
}

/**
 * Rewrites a worksheet's `<mergeCells>` to exactly these ranges (removed when empty), in schema position.
 *
 * @param xml - The worksheet's XML.
 * @param ranges - A1 ranges, e.g. `['A1:J1']`.
 * @returns The rewritten worksheet XML.
 */
export function setMergeCells(xml: string, ranges: string[]): string {
  const P = /<(\w+:)?worksheet\b/.exec(xml)?.[1] ?? '';
  const cur = new RegExp(`<${P}mergeCells\\b[^>]*?(?:/>|>[\\s\\S]*?</${P}mergeCells>)`).exec(xml);
  const el = ranges.length ? `<${P}mergeCells count="${ranges.length}">${ranges.map((r) => `<${P}mergeCell ref="${escapeAttr(r)}"/>`).join('')}</${P}mergeCells>` : '';
  if (cur) return xml.replace(cur[0], el);
  if (!el) return xml;
  const close = xml.indexOf(`</${P}sheetData>`);
  let at = close >= 0 ? close + `</${P}sheetData>`.length : -1;
  if (close < 0) { const self = new RegExp(`<${P}sheetData\\b[^>]*/>`).exec(xml); at = self ? self.index + self[0].length : xml.lastIndexOf(`</${P}worksheet>`); }
  // skip elements that come between sheetData and mergeCells (sheetCalcPr … customSheetViews)
  const before = ['sheetCalcPr', 'sheetProtection', 'protectedRanges', 'scenarios', 'autoFilter', 'sortState', 'dataConsolidate', 'customSheetViews'];
  for (;;) {
    const m = new RegExp(`^\\s*<${P}(${before.join('|')})\\b[^>]*?(?:/>|>[\\s\\S]*?</${P}\\1>)`).exec(xml.slice(at));
    if (!m) break;
    at += m[0].length;
  }
  return xml.slice(0, at) + el + xml.slice(at);
}

/** Elements that follow `<calcPr>` in CT_Workbook's sequence. */
const AFTER_CALCPR = ['oleSize', 'customWorkbookViews', 'pivotCaches', 'smartTagPr', 'smartTagTypes', 'webPublishing', 'fileRecoveryPr', 'webPublishObjects', 'extLst'];

/** Sets `fullCalcOnLoad="1"` on `<calcPr>`, adding the element in schema order when missing. */
export function setFullCalcOnLoad(wb: string): string {
  const P = /<(\w+:)?workbook\b/.exec(wb)?.[1] ?? '';
  const calc = new RegExp(`<${P}calcPr\\b[^>]*?/?>`).exec(wb);
  if (calc) return wb.replace(calc[0], setAttr(calc[0], 'fullCalcOnLoad', '1'));
  const el = `<${P}calcPr fullCalcOnLoad="1"/>`;
  for (const n of AFTER_CALCPR) {
    const i = wb.search(new RegExp(`<${P}${n}\\b`));
    if (i >= 0) return wb.slice(0, i) + el + wb.slice(i);
  }
  const end = wb.lastIndexOf(`</${P}workbook>`);
  return wb.slice(0, end) + el + wb.slice(end);
}

// ── Hidden rows, columns, outline levels and sheet state (W-49 DoD 10) ──────

const MAX_OUTLINE = 7;
const STATES: readonly SheetState[] = ['visible', 'hidden', 'veryHidden'];
/** The namespace prefix of a worksheet or chartsheet root, e.g. `x:` or `''`. */
const rootPrefix = (xml: string) => /<(\w+:)?(?:worksheet|chartsheet)\b/.exec(xml)?.[1] ?? '';
const isZero = (tag: string, attr: string) => { const v = getAttr(tag, attr); return v !== undefined && Number(v) === 0; };
/** `{ 3: 1 }` (0-based) → `Map { 4 → 1 }` (1-based, as `r` and `min`/`max` count). */
const levelMap = (rec: Record<number, number> | undefined) => rec && new Map(Object.entries(rec).filter(([, l]) => l !== undefined).map(([k, l]) => [Number(k) + 1, l] as [number, number]));
const deepest = (m: Map<number, number> | undefined) => m && Math.max(0, ...m.values());

function checkHidden(h: HiddenPatch, sheets: SheetRef[]): void {
  const where = { sheet: h.sheet };
  if (!sheets.some((s) => s.name === h.sheet)) throw new ExportError('no-sheet', `no sheet named "${h.sheet}" in the workbook`, where);
  const indexes = (list: Iterable<number>, max: number, axis: string) => {
    for (const i of list) if (!Number.isInteger(i) || i < 0 || i >= max) throw new ExportError('bad-ref', `sheet "${h.sheet}" ${axis} index ${i} is not one of 0–${max - 1}`, where);
  };
  const levels = (rec: Record<number, number> | undefined, max: number, axis: string) => {
    if (!rec) return;
    indexes(Object.keys(rec).map(Number), max, axis);
    for (const l of Object.values(rec)) if (!Number.isInteger(l) || l < 0 || l > MAX_OUTLINE) throw new ExportError('bad-value', `sheet "${h.sheet}" ${axis} outline level ${l} is not one of 0–${MAX_OUTLINE}`, where);
  };
  indexes(h.rows ?? [], MAX_ROWS, 'row');
  indexes(h.cols ?? [], MAX_COLS, 'column');
  levels(h.outline?.rows, MAX_ROWS, 'row');
  levels(h.outline?.cols, MAX_COLS, 'column');
  if (h.state !== undefined && !STATES.includes(h.state)) throw new ExportError('bad-value', `sheet "${h.sheet}" state ${JSON.stringify(h.state)} is not visible, hidden or veryHidden`, where);
}

/**
 * Sets `hidden` and `outlineLevel` on a worksheet's rows. `hidden` (0-based) is the whole set:
 * rows not in it lose `hidden` and a zero `ht`. Missing rows are created empty, in order.
 */
function setRowsHidden(xml: string, sheet: string, hidden: number[] | undefined, levels: Map<number, number> | undefined): string {
  const P = rootPrefix(xml);
  const open = new RegExp(`<${P}sheetData\\b[^>]*?(/?)>`).exec(xml);
  if (!open) throw new ExportError('corrupt', `sheet "${sheet}" has no <sheetData>`, { sheet });
  const closeTag = `</${P}sheetData>`;
  let inner = '', end = open.index + open[0].length;
  if (open[1] !== '/') {
    const c = xml.indexOf(closeTag, open.index);
    if (c < 0) throw new ExportError('corrupt', `sheet "${sheet}" has an unclosed <sheetData>`, { sheet });
    inner = xml.slice(end, c);
    end = c + closeTag.length;
  }
  const hide = hidden && new Set(hidden.map((i) => i + 1));
  const rows = parseRows(inner, P);
  const have = new Set(rows.map((r) => r.num));
  const wanted = new Set(hide);
  for (const [n, l] of levels ?? []) if (l > 0) wanted.add(n);
  const need = [...wanted].filter((n) => !have.has(n)).sort((a, b) => a - b);
  const mark = (tag: string, n: number) => {
    let t = tag;
    if (hide) {
      if (hide.has(n)) t = setAttr(t, 'hidden', '1');
      else {
        t = removeAttr(t, 'hidden');
        if (isZero(t, 'ht')) t = removeAttr(removeAttr(t, 'ht'), 'customHeight'); // a zero height hides too
      }
    }
    if (levels) { const l = levels.get(n) ?? 0; t = l > 0 ? setAttr(t, 'outlineLevel', String(l)) : removeAttr(t, 'outlineLevel'); }
    return t;
  };
  const out: string[] = [];
  let i = 0;
  for (const r of rows) {
    while (i < need.length && need[i]! < r.num) { const n = need[i++]!; out.push(mark(`<${P}row r="${n}"/>`, n)); }
    const o = mark(getAttr(r.open, 'r') ? r.open : setAttr(r.open, 'r', String(r.num)), r.num);
    out.push(r.body === undefined ? o.replace(/>$/, '/>') : `${o}${r.body}</${P}row>`);
  }
  while (i < need.length) { const n = need[i++]!; out.push(mark(`<${P}row r="${n}"/>`, n)); }
  if (!out.length && open[1] === '/') return xml;
  const openTag = open[1] === '/' ? `<${P}sheetData>` : open[0];
  return `${xml.slice(0, open.index)}${openTag}${out.join('')}${closeTag}${xml.slice(end)}`;
}

/**
 * Splits and merges a worksheet's `<col>` spans so exactly the `hidden` columns (0-based, the
 * whole set) carry `hidden="1"` and each column its outline level. Every other attribute of a
 * span (width, style, customWidth) is kept on each piece; equal neighbours are merged.
 */
function setColsHidden(xml: string, sheet: string, hidden: number[] | undefined, levels: Map<number, number> | undefined): string {
  const P = rootPrefix(xml);
  const cur = new RegExp(`<${P}cols\\b[^>]*?(?:/>|>([\\s\\S]*?)</${P}cols>)`).exec(xml);
  const tmpl: (string | undefined)[] = []; // per column (1-based): the <col/> without min and max
  let top = 0;
  for (const m of (cur?.[1] ?? '').matchAll(new RegExp(`<${P}col\\b[^>]*?/?>`, 'g'))) {
    const min = Math.max(1, Number(getAttr(m[0], 'min') ?? 1)), max = Math.min(Number(getAttr(m[0], 'max') ?? min), MAX_COLS);
    const rest = removeAttr(removeAttr(m[0], 'min'), 'max').replace(/\s*\/?>$/, '/>');
    for (let c = min; c <= max; c++) tmpl[c] = rest;
    top = Math.max(top, max);
  }
  const hide = hidden && new Set(hidden.map((i) => i + 1));
  for (const c of hide ?? []) top = Math.max(top, c);
  for (const [c, l] of levels ?? []) if (l > 0) top = Math.max(top, c);
  const bare = new RegExp(`^<${P}col\\s*/>$`);
  const head = new RegExp(`^<${P}col`);
  const pieces: string[] = [];
  let run: { from: number; tag: string } | undefined;
  const flush = (to: number) => {
    if (run && !bare.test(run.tag)) pieces.push(run.tag.replace(head, `<${P}col min="${run.from}" max="${to}"`));
    run = undefined;
  };
  for (let c = 1; c <= top; c++) {
    let t = tmpl[c];
    const h = hide?.has(c) ?? false, l = levels?.get(c) ?? 0;
    if (t === undefined && (h || l > 0)) t = `<${P}col/>`;
    if (t !== undefined) {
      if (hide) {
        if (h) t = setAttr(t, 'hidden', '1');
        else {
          t = removeAttr(t, 'hidden');
          if (isZero(t, 'width')) t = removeAttr(removeAttr(t, 'width'), 'customWidth'); // a zero width hides too
        }
      }
      if (levels) t = l > 0 ? setAttr(t, 'outlineLevel', String(l)) : removeAttr(t, 'outlineLevel');
    }
    if (run && run.tag === t) continue;
    flush(c - 1);
    if (t !== undefined) run = { from: c, tag: t };
  }
  flush(top);
  const el = pieces.length ? `<${P}cols>${pieces.join('')}</${P}cols>` : ''; // an empty <cols> is invalid
  if (cur) return xml.replace(cur[0], () => el);
  if (!el) return xml;
  const at = xml.search(new RegExp(`<${P}sheetData\\b`)); // CT_Worksheet: … sheetFormatPr, cols, sheetData
  if (at < 0) throw new ExportError('corrupt', `sheet "${sheet}" has no <sheetData>`, { sheet });
  return xml.slice(0, at) + el + xml.slice(at);
}

/** Sets (or removes, at 0) `sheetFormatPr outlineLevelRow` / `outlineLevelCol`; adds the element in schema order when needed. */
function setOutlineLevels(xml: string, row: number | undefined, col: number | undefined): string {
  const P = rootPrefix(xml);
  const apply = (tag: string) => {
    let t = tag;
    if (row !== undefined) t = row > 0 ? setAttr(t, 'outlineLevelRow', String(row)) : removeAttr(t, 'outlineLevelRow');
    if (col !== undefined) t = col > 0 ? setAttr(t, 'outlineLevelCol', String(col)) : removeAttr(t, 'outlineLevelCol');
    return t;
  };
  const cur = new RegExp(`<${P}sheetFormatPr\\b[^>]*?/?>`).exec(xml);
  if (cur) return xml.replace(cur[0], () => apply(cur[0]));
  if (!row && !col) return xml;
  const at = xml.search(new RegExp(`<${P}(?:cols|sheetData)\\b`));
  return at < 0 ? xml : xml.slice(0, at) + apply(`<${P}sheetFormatPr defaultRowHeight="15"/>`) + xml.slice(at);
}

/** Sets `tabSelected` on a sheet's first `<sheetView>` (adding the view when missing), or clears it on every view. */
function setTabSelected(xml: string, on: boolean): string {
  const P = rootPrefix(xml);
  const tag = new RegExp(`<${P}sheetView\\b[^>]*?/?>`, 'g');
  if (!on) return xml.replace(tag, (v) => removeAttr(v, 'tabSelected'));
  const view = new RegExp(tag.source).exec(xml);
  if (view) return xml.replace(view[0], () => setAttr(view[0], 'tabSelected', '1'));
  const at = xml.search(new RegExp(`<${P}(?:sheetFormatPr|cols|sheetData)\\b`));
  const el = `<${P}sheetViews><${P}sheetView tabSelected="1" workbookViewId="0"/></${P}sheetViews>`;
  return at < 0 ? xml : xml.slice(0, at) + el + xml.slice(at);
}

/**
 * Writes `<sheet state>` and keeps the workbook openable: refuses a workbook with no visible
 * sheet, and when the active sheet is hidden moves `activeTab` (and `firstSheet`) to the first
 * visible sheet and `tabSelected` with it — or Excel opens to a blank window.
 */
async function applySheetStates(parts: Parts, wbPath: string, sheets: SheetRef[], states: Map<string, SheetState>): Promise<void> {
  const wb = (await parts.text(wbPath))!;
  const tags = [...wb.matchAll(/<(?:\w+:)?sheet\b[^>]*>/g)];
  const names = tags.map((m) => getAttr(m[0], 'name') ?? '');
  const stateOf = (tag: string): SheetState => { const s = getAttr(tag, 'state'); return s === 'hidden' || s === 'veryHidden' ? s : 'visible'; };
  const before = tags.map((m) => stateOf(m[0]));
  const after = names.map((n, i) => states.get(n) ?? before[i]!);
  const firstVisible = after.indexOf('visible');
  if (firstVisible < 0) throw new ExportError('sheet-count', 'every sheet would be hidden; a workbook needs at least one visible sheet');
  let out = wb;
  for (let i = tags.length - 1; i >= 0; i--) {
    if (after[i] === before[i]) continue;
    const m = tags[i]!;
    const t = after[i] === 'visible' ? removeAttr(m[0], 'state') : setAttr(m[0], 'state', after[i]!);
    out = out.slice(0, m.index) + t + out.slice(m.index + m[0].length);
  }
  let moved: number | undefined;
  out = out.replace(/<(?:\w+:)?workbookView\b[^>]*>/g, (v) => {
    let t = v;
    const active = Number(getAttr(v, 'activeTab') ?? 0);
    if (after[active] !== 'visible') {
      t = setAttr(t, 'activeTab', String(firstVisible));
      moved = firstVisible;
      if (getAttr(t, 'firstSheet') !== undefined) t = setAttr(t, 'firstSheet', String(firstVisible));
    }
    const first = getAttr(t, 'firstSheet');
    if (first !== undefined && after[Number(first)] !== 'visible') t = setAttr(t, 'firstSheet', String(firstVisible));
    return t;
  });
  if (!/<(?:\w+:)?workbookView\b/.test(out) && after[0] !== 'visible') {
    // No view at all: activeTab defaults to 0, which is now hidden — add the view.
    const P = /<(\w+:)?workbook\b/.exec(out)?.[1] ?? '';
    const el = `<${P}bookViews><${P}workbookView activeTab="${firstVisible}"/></${P}bookViews>`;
    const at = out.search(new RegExp(`<${P}sheets\\b`));
    if (at >= 0) { out = out.slice(0, at) + el + out.slice(at); moved = firstVisible; }
  }
  if (out !== wb) parts.write(wbPath, out);
  const pathOf = (i: number) => sheets.find((s) => s.name === names[i])?.path;
  for (let i = 0; i < tags.length; i++) {
    const p = pathOf(i);
    if (!p || after[i] === 'visible' || before[i] !== 'visible') continue;
    const x = await parts.text(p);
    if (x !== undefined) { const y = setTabSelected(x, false); if (y !== x) parts.write(p, y); }
  }
  const p = moved !== undefined ? pathOf(moved) : undefined;
  const x = p && (await parts.text(p));
  if (p && x) parts.write(p, setTabSelected(x, true));
}

/**
 * Patches the original .xlsx: only the changed cells are rewritten; shared
 * strings stay in place and new text goes in as inline strings; every other part
 * is copied byte for byte. Excel is asked to recalculate on open, and every
 * pivot cache whose source meets a changed cell to refresh.
 *
 * @param original - The uploaded .xlsx file's bytes.
 * @param changes - The cells to rewrite; a missing sheet or a bad reference throws an `ExportError`.
 * @param o - Compression, size limits, plugin hooks, freeze panes, merges and hidden rows, columns and sheets.
 * @returns The patched .xlsx file's bytes.
 * @example
 * ```ts
 * import { patchXlsx } from '@sheetpane/export';
 * const patched = await patchXlsx(bytes, [{ sheet: 'Sales', ref: 'B2', value: 1300 }]);
 * ```
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0103_EXPORT.md
 */
export async function patchXlsx(original: Uint8Array, changes: Change[], o: PatchOptions = {}): Promise<Uint8Array> {
  const limits: ZipLimits = { maxEntrySize: o.maxEntrySize ?? DEFAULT_LIMITS.maxEntrySize, maxTotalSize: o.maxTotalSize ?? DEFAULT_LIMITS.maxTotalSize };
  const parts = new Parts(original, readZip(original, limits), limits);
  const { wbPath, sheets } = await locateWorkbook(parts);
  const grouped = new Map<string, Map<string, Cell>>();
  for (const c of changes) {
    const sheet = sheets.find((s) => s.name === c.sheet);
    if (!sheet) throw new ExportError('no-sheet', `no sheet named "${c.sheet}" in the workbook`, { sheet: c.sheet });
    const p = parseRef(c.ref);
    if (!p) throw new ExportError('bad-ref', `${c.sheet}!${c.ref} is not a cell reference`, { sheet: c.sheet, ref: c.ref });
    const ref = cellRef(p.row, p.col);
    checkCell(c.value, c.sheet, ref);
    let m = grouped.get(c.sheet);
    if (!m) grouped.set(c.sheet, (m = new Map()));
    m.set(ref, c.value);
  }
  const stripped: string[] = [];
  let formulaTouched = false;
  for (const [name, cells] of grouped) {
    const path = sheets.find((s) => s.name === name)!.path;
    const xml = await parts.text(path);
    if (xml === undefined) throw new ExportError('corrupt', `sheet "${name}" points at a missing part ${path}`, { sheet: name });
    const r = patchSheetXml(xml, name, cells, stripped);
    formulaTouched ||= r.formulaTouched;
    parts.write(path, r.xml);
  }
  for (const m of o.merges ?? []) {
    const sheet = sheets.find((s) => s.name === m.sheet);
    if (!sheet) throw new ExportError('no-sheet', `no sheet named "${m.sheet}" in the workbook`, { sheet: m.sheet });
    for (const r of m.ranges) if (!parseRange(r) || !r.includes(':')) throw new ExportError('bad-merge', `sheet "${m.sheet}" merge "${r}" is not a range`, { sheet: m.sheet, ref: r });
    parts.write(sheet.path, setMergeCells((await parts.text(sheet.path))!, m.ranges));
  }
  for (const f of o.freeze ?? []) {
    const sheet = sheets.find((s) => s.name === f.sheet);
    if (!sheet) throw new ExportError('no-sheet', `no sheet named "${f.sheet}" in the workbook`, { sheet: f.sheet });
    parts.write(sheet.path, setPane((await parts.text(sheet.path))!, f));
  }
  await applyHidden(parts, wbPath, sheets, o.hidden ?? []);
  if (changes.length) {
    parts.write(wbPath, setFullCalcOnLoad((await parts.text(wbPath))!));
    await refreshPivots(parts, grouped);
  }
  if (formulaTouched) await dropCalcChain(parts, wbPath);
  const ctx = context(parts, changes, wbPath, sheets);
  for (const hook of o.exportPatch ?? []) await hook(ctx);
  if (stripped.length) o.onStripped?.(stripped);
  return writeZip(parts.zipInputs(), o);
}

/** The `hidden` option: every entry checked first, then rows, columns and outline per sheet, then the workbook's sheet states. */
async function applyHidden(parts: Parts, wbPath: string, sheets: SheetRef[], list: HiddenPatch[]): Promise<void> {
  for (const h of list) checkHidden(h, sheets);
  const states = new Map<string, SheetState>();
  for (const h of list) {
    if (h.state !== undefined) states.set(h.sheet, h.state);
    const rowLv = levelMap(h.outline?.rows), colLv = levelMap(h.outline?.cols);
    if (!h.rows && !h.cols && !rowLv && !colLv) continue;
    const path = sheets.find((s) => s.name === h.sheet)!.path;
    let xml = await parts.text(path);
    if (xml === undefined) throw new ExportError('corrupt', `sheet "${h.sheet}" points at a missing part ${path}`, { sheet: h.sheet });
    if (h.rows || rowLv) xml = setRowsHidden(xml, h.sheet, h.rows, rowLv);
    if (h.cols || colLv) xml = setColsHidden(xml, h.sheet, h.cols, colLv);
    if (rowLv || colLv) xml = setOutlineLevels(xml, deepest(rowLv), deepest(colLv));
    parts.write(path, xml);
  }
  if (states.size) await applySheetStates(parts, wbPath, sheets, states);
}

async function refreshPivots(parts: Parts, grouped: Map<string, Map<string, Cell>>): Promise<void> {
  for (const p of parts.list().filter((n) => /pivotCacheDefinition[^/]*\.xml$/.test(n))) {
    const xml = (await parts.text(p))!;
    const ws = /<(?:\w+:)?worksheetSource\b[^>]*>/.exec(xml);
    if (!ws) continue;
    const sheet = getAttr(ws[0], 'sheet'), ref = getAttr(ws[0], 'ref');
    let meets: boolean;
    if (sheet !== undefined && ref !== undefined) {
      const range = parseRange(ref), cells = grouped.get(sheet);
      meets = !!range && !!cells && [...cells.keys()].some((k) => { const q = parseRef(k)!; return rangesIntersect(range, { top: q.row, left: q.col, bottom: q.row, right: q.col }); });
    } else {
      meets = true; // a named or table source: refresh whenever anything changed
    }
    if (!meets) continue;
    const root = /<(?:\w+:)?pivotCacheDefinition\b[^>]*>/.exec(xml);
    if (root) parts.write(p, xml.replace(root[0], setAttr(root[0], 'refreshOnLoad', '1')));
  }
}

/** A formula became a value: the calculation chain may now name a cell without a formula, which Excel repairs. Excel rebuilds it. */
async function dropCalcChain(parts: Parts, wbPath: string): Promise<void> {
  const relsPath = relsPathOf(wbPath);
  const rels = await parts.text(relsPath);
  const chain = rels && parseRels(rels).find((r) => r.type === REL.calcChain);
  if (!chain) return;
  const target = resolveTarget(wbPath, chain.target);
  parts.remove(target);
  parts.write(relsPath, rels!.replace(new RegExp(`<(?:\\w+:)?Relationship\\b[^>]*\\sId="${chain.id}"[^>]*>`), ''));
  const ct = await parts.text('[Content_Types].xml');
  if (ct) parts.write('[Content_Types].xml', ct.replace(new RegExp(`<(?:\\w+:)?Override\\b[^>]*PartName="/${target.replace(/[.]/g, '\\.')}"[^>]*>`), ''));
}

function context(parts: Parts, changes: Change[], wbPath: string, sheets: SheetRef[]): PatchContext {
  const ctFile = '[Content_Types].xml';
  return {
    changes,
    list: () => parts.list(),
    has: (p) => parts.has(p),
    readText: (p) => parts.text(p),
    readBytes: (p) => parts.bytes(p),
    write: (p, d) => parts.write(p, d),
    remove: (p) => parts.remove(p),
    workbookPath: () => wbPath,
    sheetNames: () => sheets.map((s) => s.name),
    sheetPath: (n) => sheets.find((s) => s.name === n)?.path,
    relsPathOf,
    async addRelationship(fromPart, type, target, targetMode) {
      const path = relsPathOf(fromPart);
      const xml = (await parts.text(path)) ?? `${XML_DECL}<Relationships xmlns="${NS_PKG_REL}"></Relationships>`;
      const used = new Set(parseRels(xml).map((r) => r.id));
      let n = 1;
      while (used.has(`rId${n}`)) n++;
      const id = `rId${n}`;
      const el = `<Relationship Id="${id}" Type="${escapeAttr(type)}" Target="${escapeAttr(target)}"${targetMode ? ` TargetMode="${targetMode}"` : ''}/>`;
      parts.write(path, xml.includes('</Relationships>') ? xml.replace('</Relationships>', `${el}</Relationships>`) : xml.replace(/<Relationships\b([^>]*)\/>/, `<Relationships$1>${el}</Relationships>`));
      return id;
    },
    async setContentType(part, contentType) {
      const xml = (await parts.text(ctFile))!;
      const name = '/' + part.replace(/^\//, '');
      const re = new RegExp(`<Override\\b[^>]*PartName="${name.replace(/[.[\]]/g, '\\$&')}"[^>]*/>`);
      const el = `<Override PartName="${escapeAttr(name)}" ContentType="${escapeAttr(contentType)}"/>`;
      parts.write(ctFile, re.test(xml) ? xml.replace(re, el) : xml.replace('</Types>', `${el}</Types>`));
    },
    async setDefaultContentType(extension, contentType) {
      const xml = (await parts.text(ctFile))!;
      if (new RegExp(`<Default\\b[^>]*Extension="${extension}"`, 'i').test(xml)) return;
      parts.write(ctFile, xml.replace('</Types>', `<Default Extension="${escapeAttr(extension)}" ContentType="${escapeAttr(contentType)}"/></Types>`));
    },
  };
}

export { CT };
