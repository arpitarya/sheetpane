// fromXlsx: an .xlsx in, the ImportedWorkbook out (reading verdict decisions 2, 4, 6;
// W-13 DoD 3, 4, 12). ZIP, inflate, CRC and A1 helpers come from @sheetpane/export.
import {
  DEFAULT_LIMITS, ExportError, MAX_COLS, MAX_ROWS, cellRef, decodeOoxmlString, fromUtf8, inflateEntry, isZip, parseRef, readZip, resolveTarget, relsPathOf, shiftFormula,
  type Cell, type ZipEntry, type ZipLimits,
} from '@sheetpane/export';
import { all, bool, first, kid, kids, num, parseXml, relAttr, str } from './dom.js';
import { ImportError } from './errors.js';
import { formatCode, general, subsetCode } from './numfmt.js';
import { color, font, parseStyles, parseTheme } from './styles.js';
import type { AnchorPoint, CfRule, Cfvo, ConditionalFormat, DataValidation, DrawingAnchor, ImportedSheet, ImportedWorkbook, Note, OutlineEntry, Person, PivotTable, SheetState, StyleTables, Table, TextRun, ThreadedComment } from './types.js';

/** Options for reading an .xlsx: the ZIP size limits that refuse a ZIP bomb. */
export interface ReadOptions extends ZipLimits {}

const CT_MAIN = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml';
const REL_THREADED = 'http://schemas.microsoft.com/office/2017/10/relationships/threadedComment';
const REL_PERSON = 'http://schemas.microsoft.com/office/2017/10/relationships/person';

export const isCfb = (b: Uint8Array) => b.length >= 4 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;

/** An encrypted .xlsx is an OLE file holding an `EncryptedPackage` stream (its directory names are UTF-16LE). */
export function cfbRefusal(b: Uint8Array, name: string | undefined): ImportError {
  const needle = Array.from('EncryptedPackage', (ch) => [ch.charCodeAt(0), 0]).flat();
  let found = false;
  outer: for (let i = 0; i + needle.length <= b.length; i++) {
    for (let k = 0; k < needle.length; k++) if (b[i + k] !== needle[k]) continue outer;
    found = true; break;
  }
  const who = name ? `"${name}"` : 'this workbook';
  return found
    ? new ImportError('password-or-legacy', `${who} is password-protected — remove the password in Excel and open it again`, 'password')
    : new ImportError('password-or-legacy', `${who} is the older Excel format (.xls) — save it as .xlsx or .csv and open it again`, 'legacy');
}

export async function toBytes(data: ArrayBuffer | Uint8Array | Blob): Promise<Uint8Array> {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(await data.arrayBuffer());
}

function mapZipError(e: unknown): never {
  if (e instanceof ExportError) {
    switch (e.code) {
      case 'zip64': case 'over-limit': throw new ImportError('too-large', e.spDetail);
      case 'encrypted': throw new ImportError('password-or-legacy', e.spDetail);
      case 'not-zip': throw new ImportError('not-workbook', e.spDetail);
      default: throw new ImportError('corrupt', e.spDetail);
    }
  }
  throw e;
}

interface Rel { id: string; type: string; target: string; external: boolean }

class Pkg {
  private readonly entries = new Map<string, ZipEntry>();
  private readonly texts = new Map<string, Promise<string | undefined>>();
  constructor(readonly bytes: Uint8Array, list: ZipEntry[], private readonly limits: ZipLimits) {
    for (const e of list) this.entries.set(e.name, e);
  }
  has(p: string) { return this.entries.has(p); }
  async bytesOf(p: string): Promise<Uint8Array | undefined> {
    const e = this.entries.get(p);
    if (!e) return undefined;
    try { return await inflateEntry(this.bytes, e, this.limits); } catch (err) { return mapZipError(err); }
  }
  text(p: string): Promise<string | undefined> {
    let t = this.texts.get(p);
    if (!t) this.texts.set(p, (t = this.bytesOf(p).then((b) => b && fromUtf8(b))));
    return t;
  }
  async doc(p: string): Promise<Document | undefined> {
    const t = await this.text(p);
    return t === undefined ? undefined : parseXml(t, p);
  }
  async rels(part: string): Promise<Rel[]> {
    const d = await this.doc(relsPathOf(part));
    if (!d) return [];
    return all(d, 'Relationship').map((r) => {
      const external = r.getAttribute('TargetMode') === 'External';
      const target = r.getAttribute('Target') ?? '';
      return { id: r.getAttribute('Id') ?? '', type: r.getAttribute('Type') ?? '', target: external ? target : resolveTarget(part, target), external };
    });
  }
}

/** The text of a rich-text container, phonetic runs left out, SpreadsheetML escapes decoded. */
function richText(e: Element): string {
  let s = '';
  for (const t of all(e, 't')) {
    let p = t.parentElement, phonetic = false;
    while (p && p !== e) { if (p.localName === 'rPh') { phonetic = true; break; } p = p.parentElement; }
    if (!phonetic) s += t.textContent ?? '';
  }
  return decodeOoxmlString(s);
}

const RUN_KEYS = ['b', 'i', 'u', 'strike', 'color', 'sz', 'vertAlign'] as const;

/** One `<r>`: its text and what its `<rPr>` names — never the family (`<rFont>`, SR-LAW-5). */
function textRun(r: Element): TextRun {
  const run: TextRun = { text: decodeOoxmlString(kids(r, 't').map((t) => t.textContent ?? '').join('')) };
  const pr = kid(r, 'rPr');
  if (pr) {
    const f = font(pr);
    for (const k of RUN_KEYS) if (f[k] !== undefined) (run as unknown as Record<string, unknown>)[k] = f[k];
  }
  return run;
}

/**
 * A string container (`<si>`, `<is>`): its text, and its runs when it is rich text (W-53) — two or more runs, or
 * one run that carries formatting. Phonetic runs (`<rPh>`) are not runs.
 */
function richString(e: Element): { text: string; runs?: TextRun[] } {
  const text = richText(e);
  const rs = kids(e, 'r');
  if (!rs.length) return { text };
  const runs = rs.map(textRun);
  return runs.length > 1 || Object.keys(runs[0]!).length > 1 ? { text, runs } : { text };
}

const cfvo = (e: Element): Cfvo => {
  const o: Cfvo = { type: str(e, 'type') ?? 'num' };
  const v = str(e, 'val');
  if (v !== undefined) o.val = v;
  if (e.hasAttribute('gte')) o.gte = bool(e, 'gte', true);
  return o;
};

function point(e: Element | undefined): AnchorPoint | undefined {
  if (!e) return undefined;
  const t = (n: string) => Number(kid(e, n)?.textContent ?? 0);
  return { col: t('col'), colOff: t('colOff'), row: t('row'), rowOff: t('rowOff') };
}

/** `"A1:B2 D4"` → `['A1:B2', 'D4']`. */
const sqref = (s: string | null | undefined) => (s ?? '').trim().split(/\s+/).filter(Boolean);

async function parseDrawing(pkg: Pkg, path: string): Promise<DrawingAnchor[]> {
  const doc = await pkg.doc(path);
  if (!doc) return [];
  const rels = await pkg.rels(path);
  const target = (id: string | undefined) => rels.find((r) => r.id === id)?.target;
  const out: DrawingAnchor[] = [];
  for (const kind of ['twoCellAnchor', 'oneCellAnchor', 'absoluteAnchor'] as const) {
    for (const a of all(doc, kind)) {
      const nv = first(a, 'cNvPr');
      const pic = first(a, 'pic'), chart = first(a, 'chart');
      const d: DrawingAnchor = {
        kind: pic ? 'picture' : chart ? 'chart' : 'shape',
        anchor: kind === 'twoCellAnchor' ? 'twoCell' : kind === 'oneCellAnchor' ? 'oneCell' : 'absolute',
        name: str(nv, 'name') ?? '',
        descr: str(nv, 'descr') ?? '',
      };
      const from = point(kid(a, 'from')), to = point(kid(a, 'to')), ext = kid(a, 'ext'), pos = kid(a, 'pos');
      if (from) d.from = from;
      if (to) d.to = to;
      if (ext) d.ext = { cx: num(ext, 'cx') ?? 0, cy: num(ext, 'cy') ?? 0 };
      if (pos) d.pos = { x: num(pos, 'x') ?? 0, y: num(pos, 'y') ?? 0 };
      if (pic) { const blip = first(pic, 'blip'); const m = blip && target(relAttr(blip, 'embed')); if (m) d.media = m; }
      if (chart) { const c = target(relAttr(chart, 'id')); if (c) d.chart = c; }
      out.push(d);
    }
  }
  return out;
}

/**
 * One table part (`xl/tables/tableN.xml`, W-61): its name as formulas use it, its range, header and totals
 * rows, columns and `tableStyleInfo`. Undefined when the part is missing or names no range.
 */
async function parseTable(pkg: Pkg, path: string): Promise<Table | undefined> {
  const d = await pkg.doc(path);
  const root = d?.documentElement;
  const ref = root?.getAttribute('ref');
  if (!root || !ref) return undefined;
  const info = kid(root, 'tableStyleInfo');
  const style: Table['style'] = {
    showFirstColumn: bool(info, 'showFirstColumn'),
    showLastColumn: bool(info, 'showLastColumn'),
    showRowStripes: bool(info, 'showRowStripes'),
    showColumnStripes: bool(info, 'showColumnStripes'),
  };
  const sn = str(info, 'name');
  if (sn) style.name = sn;
  const cols = kid(root, 'tableColumns');
  const t: Table = {
    name: str(root, 'displayName') || str(root, 'name') || '',
    id: num(root, 'id') ?? 0,
    ref,
    headerRowCount: num(root, 'headerRowCount') ?? 1,
    totalsRowCount: num(root, 'totalsRowCount') ?? 0,
    columns: (cols ? kids(cols, 'tableColumn') : []).map((c) => {
      const col: Table['columns'][number] = { name: decodeOoxmlString(c.getAttribute('name') ?? '') };
      const fn = str(c, 'totalsRowFunction'), label = str(c, 'totalsRowLabel');
      if (fn) col.totalsRowFunction = fn;
      if (label !== undefined) col.totalsRowLabel = decodeOoxmlString(label);
      return col;
    }),
    style,
    path,
  };
  const af = kid(root, 'autoFilter')?.getAttribute('ref');
  if (af) t.autoFilter = af;
  return t;
}

interface SheetCtx { pkg: Pkg; sst: string[]; sstRuns: (TextRun[] | undefined)[]; styles: StyleTables; date1904: boolean; name: string; path: string; state: SheetState }

/** An `outlineLevel` / `collapsed` pair, or undefined when the element carries neither. Levels are clamped to Excel's 0–7. */
function outlineOf(e: Element): OutlineEntry | undefined {
  const level = Math.min(7, Math.max(0, Math.trunc(num(e, 'outlineLevel') ?? 0)) || 0);
  const collapsed = bool(e, 'collapsed');
  if (!level && !collapsed) return undefined;
  return collapsed ? { level, collapsed } : { level };
}

async function parseSheet(c: SheetCtx): Promise<ImportedSheet> {
  const doc = await c.pkg.doc(c.path);
  if (!doc) throw new ImportError('corrupt', `sheet "${c.name}" points at a missing part ${c.path}`);
  const root = doc.documentElement;
  const rows: Cell[][] = [], text: string[][] = [];
  const styleIndex: Record<string, number> = {}, formulas: Record<string, string> = {}, runs: Record<string, TextRun[]> = {};
  const rowHeights: (number | undefined)[] = [], hiddenRows: number[] = [], rowOutline: (OutlineEntry | undefined)[] = [];
  const shared = new Map<string, { f: string; row: number; col: number }>();
  const tooBig = (what: string) => new ImportError('too-large', `sheet "${c.name}" has a cell past Excel's limits (${what}) — refused`);
  const sheetData = kid(root, 'sheetData');
  let prevRow = 0;
  for (const rowEl of sheetData ? kids(sheetData, 'row') : []) {
    const rn = num(rowEl, 'r') ?? prevRow + 1;
    prevRow = rn;
    if (rn > MAX_ROWS) throw tooBig(`row ${rn}`);
    const r = rn - 1;
    const ht = num(rowEl, 'ht');
    if (ht !== undefined && bool(rowEl, 'customHeight', true)) rowHeights[r] = ht;
    if (bool(rowEl, 'hidden') || ht === 0) hiddenRows.push(r); // a zero height hides the row as well
    const ro = outlineOf(rowEl);
    if (ro) rowOutline[r] = ro;
    let prevCol = -1;
    for (const ce of kids(rowEl, 'c')) {
      const ref = ce.getAttribute('r');
      const pos = ref ? parseRef(ref) : undefined;
      if (ref && !pos) throw tooBig(ref);
      const col = pos ? pos.col : prevCol + 1;
      prevCol = col;
      if (col >= MAX_COLS) throw tooBig(`column ${col + 1}`);
      const a1 = cellRef(r, col);
      const s = num(ce, 's');
      if (s) styleIndex[a1] = s;
      const t = ce.getAttribute('t') ?? 'n';
      const vEl = kid(ce, 'v');
      const v = vEl?.textContent ?? undefined;
      const fEl = kid(ce, 'f');
      if (fEl) {
        const ft = fEl.getAttribute('t'), si = fEl.getAttribute('si'), body = fEl.textContent ?? '';
        if (ft === 'shared' && si !== null) {
          if (body) { shared.set(si, { f: body, row: r, col }); formulas[a1] = body; }
          else { const m = shared.get(si); if (m) formulas[a1] = shiftFormula(m.f, r - m.row, col - m.col); }
        } else if (body) formulas[a1] = body;
      }
      let value: Cell = null, shown = '';
      switch (t) {
        case 's': { const i = Number(v); value = c.sst[i] ?? ''; shown = value; const ru = c.sstRuns[i]; if (ru) runs[a1] = ru; break; }
        case 'inlineStr': { const is = kid(ce, 'is'); const rs = is ? richString(is) : { text: '' }; value = rs.text; shown = value; if (rs.runs) runs[a1] = rs.runs; break; }
        case 'str': value = v !== undefined ? decodeOoxmlString(v) : ''; shown = value; break;
        case 'b': value = v === '1' || v === 'true'; shown = value ? 'TRUE' : 'FALSE'; break;
        case 'e': value = v ?? '#N/A'; shown = value; break;
        case 'd': value = v ?? ''; shown = value; break;
        default:
          if (v !== undefined && v !== '') {
            value = Number(v);
            const xf = c.styles.cellXfs[s ?? 0];
            const code = xf ? subsetCode(xf.numFmtId, c.styles.numFmts) : 'General';
            shown = code === undefined ? v : code === 'General' ? general(value) : formatCode(value, code, c.date1904);
          }
      }
      if (value === null && !shown) continue;
      (rows[r] ??= [])[col] = value;
      (text[r] ??= [])[col] = shown;
    }
  }
  // Dense rows: holes become null / ''.
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [], tr = text[r] ?? [];
    rows[r] = Array.from(row, (x) => (x === undefined ? null : x));
    text[r] = Array.from({ length: row.length }, (_, i) => tr[i] ?? '');
  }
  const merges = (() => { const m = kid(root, 'mergeCells'); return m ? kids(m, 'mergeCell').map((e) => e.getAttribute('ref') ?? '').filter(Boolean) : []; })();
  const columnWidths: number[] = [], colOutline: (OutlineEntry | undefined)[] = [];
  const hiddenColSet = new Set<number>();
  const cols = kid(root, 'cols');
  for (const col of cols ? kids(cols, 'col') : []) {
    const min = Math.max(1, num(col, 'min') ?? 1), max = Math.min(num(col, 'max') ?? min, MAX_COLS);
    const w = num(col, 'width'), hidden = bool(col, 'hidden') || w === 0; // a zero width hides the column as well
    const co = outlineOf(col);
    for (let i = min - 1; i < max; i++) {
      if (w !== undefined) columnWidths[i] = w;
      if (hidden) hiddenColSet.add(i);
      if (co) colOutline[i] = { ...co };
    }
  }
  const hiddenCols = [...hiddenColSet].sort((a, b) => a - b);
  hiddenRows.sort((a, b) => a - b);
  const fmt = kid(root, 'sheetFormatPr');
  const sheetPr = kid(root, 'sheetPr');
  const outlinePr = sheetPr && kid(sheetPr, 'outlinePr');
  const deepest = (list: (OutlineEntry | undefined)[]) => list.reduce((m, e) => Math.max(m, e?.level ?? 0), 0);
  const outline = {
    levelRow: num(fmt, 'outlineLevelRow') ?? deepest(rowOutline),
    levelCol: num(fmt, 'outlineLevelCol') ?? deepest(colOutline),
    summaryBelow: bool(outlinePr, 'summaryBelow', true),
    summaryRight: bool(outlinePr, 'summaryRight', true),
  };
  const autoFilter = kid(root, 'autoFilter')?.getAttribute('ref') ?? undefined;
  const pane = first(root, 'pane');
  const paneState = pane?.getAttribute('state');
  const frozen = paneState === 'frozen' || paneState === 'frozenSplit';
  const freeze = frozen ? { rows: num(pane, 'ySplit') ?? 0, cols: num(pane, 'xSplit') ?? 0 } : { rows: 0, cols: 0 };

  const dataValidations: DataValidation[] = all(root, 'dataValidation').map((e) => {
    const formula = (n: string) => { const f = kid(e, n); if (!f) return undefined; const inner = kid(f, 'f'); return (inner ?? f).textContent ?? undefined; };
    const dv: DataValidation = {
      sqref: sqref(e.getAttribute('sqref') ?? kid(e, 'sqref')?.textContent),
      type: str(e, 'type') ?? 'none',
      allowBlank: bool(e, 'allowBlank'),
      showErrorMessage: bool(e, 'showErrorMessage'),
      showDropDown: bool(e, 'showDropDown'),
    };
    for (const k of ['operator', 'errorStyle', 'errorTitle', 'error', 'promptTitle', 'prompt'] as const) { const v = str(e, k); if (v !== undefined) dv[k] = v; }
    const f1 = formula('formula1'), f2 = formula('formula2');
    if (f1 !== undefined) dv.formula1 = f1;
    if (f2 !== undefined) dv.formula2 = f2;
    return dv;
  });

  const conditionalFormats: ConditionalFormat[] = kids(root, 'conditionalFormatting').map((cf) => ({
    sqref: sqref(cf.getAttribute('sqref')),
    rules: kids(cf, 'cfRule').map((e) => {
      const r: CfRule = { type: str(e, 'type') ?? '', priority: num(e, 'priority') ?? 0, stopIfTrue: bool(e, 'stopIfTrue'), formulas: kids(e, 'formula').map((f) => f.textContent ?? '') };
      const dxf = num(e, 'dxfId'), rank = num(e, 'rank');
      if (dxf !== undefined) r.dxfId = dxf;
      if (rank !== undefined) r.rank = rank;
      for (const k of ['operator', 'text', 'timePeriod'] as const) { const v = str(e, k); if (v !== undefined) r[k] = v; }
      if (e.hasAttribute('percent')) r.percent = bool(e, 'percent');
      if (e.hasAttribute('bottom')) r.bottom = bool(e, 'bottom');
      if (e.hasAttribute('aboveAverage')) r.aboveAverage = bool(e, 'aboveAverage', true);
      const cs = kid(e, 'colorScale'), db = kid(e, 'dataBar'), is = kid(e, 'iconSet');
      if (cs) r.colorScale = { cfvo: kids(cs, 'cfvo').map(cfvo), colors: kids(cs, 'color').map((x) => color(x) ?? {}) };
      if (db) {
        r.dataBar = { cfvo: kids(db, 'cfvo').map(cfvo) };
        const col = color(kid(db, 'color'));
        if (col) r.dataBar.color = col;
        const mn = num(db, 'minLength'), mx = num(db, 'maxLength');
        if (mn !== undefined) r.dataBar.minLength = mn;
        if (mx !== undefined) r.dataBar.maxLength = mx;
      }
      if (is) { r.iconSet = { cfvo: kids(is, 'cfvo').map(cfvo) }; const n = str(is, 'iconSet'); if (n) r.iconSet.iconSet = n; }
      return r;
    }),
  }));

  const rels = await c.pkg.rels(c.path);
  const drawings: DrawingAnchor[] = [];
  const notes: Note[] = [], threadedComments: ThreadedComment[] = [], pivotTables: PivotTable[] = [];
  for (const rel of rels) {
    if (rel.external) continue;
    if (rel.type.endsWith('/drawing')) drawings.push(...(await parseDrawing(c.pkg, rel.target)));
    else if (rel.type.endsWith('/comments')) {
      const d = await c.pkg.doc(rel.target);
      if (!d) continue;
      const authors = all(d, 'author').map((a) => a.textContent ?? '');
      for (const cm of all(d, 'comment')) {
        const t = kid(cm, 'text');
        notes.push({ ref: cm.getAttribute('ref') ?? '', author: authors[num(cm, 'authorId') ?? 0] ?? '', text: t ? richText(t) : '' });
      }
    } else if (rel.type === REL_THREADED) {
      const d = await c.pkg.doc(rel.target);
      for (const tc of d ? all(d, 'threadedComment') : []) {
        const x: ThreadedComment = { id: tc.getAttribute('id') ?? '', ref: tc.getAttribute('ref') ?? '', personId: tc.getAttribute('personId') ?? '', done: bool(tc, 'done'), text: kid(tc, 'text')?.textContent ?? '' };
        const p = tc.getAttribute('parentId'), dt = tc.getAttribute('dT');
        if (p) x.parentId = p;
        if (dt) x.date = dt;
        threadedComments.push(x);
      }
    } else if (rel.type.endsWith('/pivotTable')) {
      const d = await c.pkg.doc(rel.target);
      const loc = d && first(d, 'location');
      if (!d || !loc) continue;
      const pt: PivotTable = { name: d.documentElement.getAttribute('name') ?? '', ref: loc.getAttribute('ref') ?? '' };
      // the cache it reads: a worksheet range is what an insert or delete must not move (W-52)
      const cache = (await c.pkg.rels(rel.target)).find((r) => r.type.endsWith('/pivotCacheDefinition'));
      const cd = cache && await c.pkg.doc(cache.target);
      const ws = cd && first(cd, 'worksheetSource');
      const sheet = ws?.getAttribute('sheet'), ref = ws?.getAttribute('ref');
      if (sheet && ref) pt.source = { sheet, ref };
      pivotTables.push(pt);
    }
  }
  // Excel tables (W-61): in <tableParts> order, each its own part
  const tables: Table[] = [];
  const parts = kid(root, 'tableParts');
  for (const tp of parts ? kids(parts, 'tablePart') : []) {
    const rel = rels.find((r) => r.id === relAttr(tp, 'id') && !r.external && r.type.endsWith('/table'));
    const t = rel && (await parseTable(c.pkg, rel.target));
    if (t) tables.push(t);
  }
  const dcw = num(fmt, 'defaultColWidth');
  return {
    name: c.name, rows, text, path: c.path, merges, columnWidths, state: c.state, hidden: c.state !== 'visible',
    styleIndex, runs, formulas, freeze, hiddenRows, hiddenCols, rowOutline, colOutline, outline, ...(autoFilter ? { autoFilter } : {}), rowHeights,
    defaultRowHeight: num(fmt, 'defaultRowHeight') ?? 15,
    defaultColWidth: dcw ?? (num(fmt, 'baseColWidth') !== undefined ? num(fmt, 'baseColWidth')! + 0.71 : undefined),
    dataValidations, conditionalFormats, drawings, notes, threadedComments, pivotTables, tables,
  };
}

/**
 * Reads an .xlsx. Throws ImportError with a typed code for anything it refuses.
 * Formula cells hold their cached values, never evaluated. Reads in any runtime (SR-IMPORT decision 8).
 *
 * @param data - The file's bytes, or a Blob.
 * @param o - The ZIP size limits.
 * @returns The workbook.
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0104_IMPORT.md
 */
export async function fromXlsx(data: ArrayBuffer | Uint8Array | Blob, o: ReadOptions = {}): Promise<ImportedWorkbook> {
  const bytes = await toBytes(data);
  if (isCfb(bytes)) throw cfbRefusal(bytes, undefined);
  if (!isZip(bytes)) throw new ImportError('not-workbook', 'not an .xlsx workbook (no ZIP signature)');
  const limits = { maxEntrySize: o.maxEntrySize ?? DEFAULT_LIMITS.maxEntrySize, maxTotalSize: o.maxTotalSize ?? DEFAULT_LIMITS.maxTotalSize };
  let list: ZipEntry[];
  try { list = readZip(bytes, limits); } catch (e) { mapZipError(e); }
  const pkg = new Pkg(bytes, list, limits);
  const types = await pkg.text('[Content_Types].xml');
  const rootRels = await pkg.rels('');
  const office = rootRels.find((r) => r.type.endsWith('/officeDocument'));
  const wbPath = office?.target ?? 'xl/workbook.xml';
  if (!pkg.has(wbPath)) throw new ImportError('not-workbook', 'not a workbook (no xl/workbook.xml)');
  const ct = types && /<Override\b[^>]*>/g;
  if (types && ct) {
    for (const m of types.matchAll(ct)) {
      if (!m[0].includes(`PartName="/${wbPath}"`)) continue;
      const t = /ContentType="([^"]*)"/.exec(m[0])?.[1] ?? '';
      if (t !== CT_MAIN) throw new ImportError('unsupported-format', /macroEnabled/i.test(t) ? 'this is a macro-enabled workbook (.xlsm) — sheetpane opens .xlsx and .csv only' : `this package is not an .xlsx workbook (${t}) — sheetpane opens .xlsx and .csv only`);
    }
  }
  const wb = (await pkg.doc(wbPath))!;
  const wbRels = await pkg.rels(wbPath);
  const relOf = (suffix: string) => wbRels.find((r) => r.type.endsWith(suffix) || r.type === suffix)?.target;
  const date1904 = bool(first(wb, 'workbookPr'), 'date1904');
  const stylesPath = relOf('/styles'), sstPath = relOf('/sharedStrings'), themePath = relOf('/theme'), personPath = relOf(REL_PERSON);
  const styles = parseStyles(stylesPath ? await pkg.doc(stylesPath) : undefined);
  const themeColors = parseTheme(themePath ? await pkg.doc(themePath) : undefined);
  const sstDoc = sstPath ? await pkg.doc(sstPath) : undefined;
  const strings = sstDoc ? kids(sstDoc.documentElement, 'si').map(richString) : [];
  const sst = strings.map((x) => x.text), sstRuns = strings.map((x) => x.runs);
  const persons: Person[] = [];
  const pd = personPath ? await pkg.doc(personPath) : undefined;
  for (const p of pd ? all(pd, 'person') : []) {
    const x: Person = { id: p.getAttribute('id') ?? '', displayName: p.getAttribute('displayName') ?? '' };
    const u = p.getAttribute('userId'), pr = p.getAttribute('providerId');
    if (u) x.userId = u;
    if (pr) x.providerId = pr;
    persons.push(x);
  }
  const definedNames = all(wb, 'definedName').map((d) => {
    const n: ImportedWorkbook['definedNames'][number] = { name: d.getAttribute('name') ?? '', formula: d.textContent ?? '' };
    const l = num(d, 'localSheetId');
    if (l !== undefined) n.localSheetId = l;
    return n;
  });
  const sheets: ImportedSheet[] = [];
  const sheetEls = all(wb, 'sheet').filter((s) => s.parentElement?.localName === 'sheets');
  let activeTab = num(first(wb, 'workbookView'), 'activeTab') ?? 0;
  const keptIndex: number[] = [];
  for (const [i, s] of sheetEls.entries()) {
    const rel = wbRels.find((r) => r.id === relAttr(s, 'id'));
    if (!rel || !rel.type.endsWith('/worksheet')) continue; // chartsheets and dialog sheets hold no cells
    keptIndex.push(i);
    const st = s.getAttribute('state');
    const state: SheetState = st === 'hidden' || st === 'veryHidden' ? st : 'visible';
    sheets.push(await parseSheet({ pkg, sst, sstRuns, styles, date1904, name: s.getAttribute('name') ?? `Sheet${i + 1}`, path: rel.target, state }));
  }
  if (!sheets.length) throw new ImportError('not-workbook', 'the workbook has no worksheets');
  activeTab = Math.max(0, keptIndex.indexOf(activeTab));
  return {
    sheets, source: 'xlsx', activeSheet: activeTab, date1904, styles, themeColors, persons, definedNames,
    part: (path) => pkg.bytesOf(path),
  };
}
