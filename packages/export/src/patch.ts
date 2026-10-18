// patchXlsx: the uploaded .xlsx in, the same file with only the changed cells
// rewritten out (export verdict decision 2; SR-LAW-6 fidelity ruling). Every
// part nobody touched is copied byte for byte, compressed data and all.
import { ExportError } from './errors.js';
import { shiftFormula } from './formula.js';
import { CT, NS_PKG_REL, REL, XML_DECL } from './ooxml.js';
import { cellRef, parseRange, parseRef, rangeRef, rangesIntersect, type RangePos } from './refs.js';
import type { Cell, Change } from './types.js';
import { checkCell } from './validate.js';
import { cellXml } from './xlsx.js';
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

export type ExportPatchHook = (ctx: PatchContext) => void | Promise<void>;

export interface PatchOptions extends WriteOptions, ZipLimits {
  /** Plugin hooks, run in order after the core's own writes (plugins verdict, `exportPatch`). */
  exportPatch?: ExportPatchHook[];
  /** Called with every `Sheet!A1` whose text lost characters XML forbids. */
  onStripped?: (refs: string[]) => void;
}

const dirOf = (p: string) => p.slice(0, p.lastIndexOf('/') + 1);
const baseOf = (p: string) => p.slice(p.lastIndexOf('/') + 1);
export const relsPathOf = (part: string) => `${dirOf(part)}_rels/${baseOf(part)}.rels`;

/** Resolves a relationship target against the folder of the part that owns the rels. */
export function resolveTarget(fromPart: string, target: string): string {
  const segs = (target.startsWith('/') ? target.slice(1) : dirOf(fromPart) + target).split('/');
  const out: string[] = [];
  for (const s of segs) {
    if (s === '..') out.pop();
    else if (s !== '.' && s !== '') out.push(s);
  }
  return out.join('/');
}

/** An attribute's unescaped value; `name` may be `*:id` for any namespace prefix. */
export function getAttr(tag: string, name: string): string | undefined {
  const n = name.startsWith('*:') ? `[\\w.-]+:${name.slice(2)}` : name.replace(/[.:]/g, '\\$&');
  const m = new RegExp(`\\s${n}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(tag);
  return m ? unescapeXml(m[1] ?? m[2] ?? '') : undefined;
}

/** Sets (or adds) an attribute on an opening or empty tag. */
export function setAttr(tag: string, name: string, value: string): string {
  const re = new RegExp(`(\\s${name.replace(/[.:]/g, '\\$&')}\\s*=\\s*)(?:"[^"]*"|'[^']*')`);
  if (re.test(tag)) return tag.replace(re, `$1"${escapeAttr(value)}"`);
  return tag.replace(/\s*(\/?)>$/, ` ${name}="${escapeAttr(value)}"$1>`);
}

export function removeAttr(tag: string, name: string): string {
  return tag.replace(new RegExp(`\\s${name.replace(/[.:]/g, '\\$&')}\\s*=\\s*(?:"[^"]*"|'[^']*')`), '');
}

export interface Relationship { id: string; type: string; target: string; mode: string | undefined }

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

/**
 * Patches the original .xlsx: only the changed cells are rewritten; shared
 * strings stay in place and new text goes in as inline strings; every other part
 * is copied byte for byte. Excel is asked to recalculate on open, and every
 * pivot cache whose source meets a changed cell to refresh.
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
