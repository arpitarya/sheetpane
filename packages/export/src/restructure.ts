// patchXlsx's `structure` option (W-52): rows and columns inserted or deleted in the
// uploaded package itself, before any cell is written. Every part that names a cell is
// rewritten — the worksheet's rows and cells, formulas in every sheet, merges, column
// spans, the autofilter, validations, conditional formats, hyperlinks, the sheet view,
// tables, drawing anchors, notes and their VML shapes, threaded comments, chart series,
// defined names. What cannot be moved without corrupting the file — a pivot table or its
// source, a table or an array formula cut in two — is refused (`bad-structure`).
// Each rewrite of an existing block lives in its own function, so later whole-block
// options (W-57's dataValidations / conditionalFormats) compose after it.
import { ExportError } from './errors.js';
import { shiftFormula } from './formula.js';
import { getAttr, parseCells, parseRels, parseRows, relsPathOf, removeAttr, resolveTarget, setAttr } from './patch.js';
import { cellRef, parseRange, parseRef, rangeRef, type RangePos } from './refs.js';
import { isInsertOp, isRowOp, movesRange, restructureFormula, shiftCount, shiftIndex, shiftRangePos, shiftRefText, shiftSpan, shiftSqref, splitsRange, tableRefusal, type StructureOp } from './structure.js';
import { unescapeXml } from './xml.js';

/** What the rewrite needs of the package: read, write, remove and list parts. */
export interface StructureParts {
  list(): string[];
  text(path: string): Promise<string | undefined>;
  write(path: string, data: string): void;
  remove(path: string): void;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rootPrefix = (xml: string) => /<(\w+:)?(?:worksheet|chartsheet)\b/.exec(xml)?.[1] ?? '';
const refusal = (o: StructureOp, what: string) => `${verb(o)} on sheet "${o.sheet}" ${what} — refused, the file is left as it was`;
const verb = (o: StructureOp) => `${isInsertOp(o) ? 'inserting' : 'deleting'} ${o.count} ${isRowOp(o) ? 'row' : 'column'}${o.count === 1 ? '' : 's'} at ${isRowOp(o) ? o.at + 1 : cellRef(0, o.at).replace(/\d+$/, '')}`;

/** A formula as written in XML text, moved; the original text when nothing moved. */
function formulaText(xmlText: string, host: string | undefined, o: StructureOp): string {
  const f = unescapeXml(xmlText);
  const g = restructureFormula(f, host, o);
  return g === f ? xmlText : esc(g);
}

/** A formula in an attribute (a hyperlink location, a cfvo value), moved. */
function formulaAttr(tag: string, name: string, host: string | undefined, o: StructureOp): string {
  const v = getAttr(tag, name);
  if (v === undefined) return tag;
  const g = restructureFormula(v, host, o);
  return g === v ? tag : setAttr(tag, name, g);
}

/** A sqref-like attribute moved; `undefined` when every range was deleted. */
function sqrefAttr(tag: string, name: string, o: StructureOp): string | undefined {
  const v = getAttr(tag, name);
  if (v === undefined) return tag;
  const list = shiftSqref(v, o);
  if (!list.length) return undefined;
  const joined = list.join(' ');
  return joined === v ? tag : setAttr(tag, name, joined);
}

/** Replaces each element `<P name …/>` or `<P name …>…</P name>` (not nested) by `fn(whole, open)`. */
function eachElement(xml: string, name: string, fn: (whole: string, open: string) => string): string {
  const re = new RegExp(`<${name.replace(/[.:]/g, '\\$&')}\\b[^>]*?(?:/>|>[\\s\\S]*?</${name.replace(/[.:]/g, '\\$&')}>)`, 'g');
  return xml.replace(re, (whole) => fn(whole, /^<[^>]*>/.exec(whole)![0]));
}
/** An element with its opening tag replaced. */
const withOpen = (whole: string, open: string, next: string) => (next === open ? whole : next + whole.slice(open.length));

/** A container left without children goes; one with a `count` gets the new count. */
function tidyContainer(xml: string, container: string, child: string): string {
  return eachElement(xml, container, (whole, open) => {
    if (open.endsWith('/>')) return whole;
    const n = [...whole.matchAll(new RegExp(`<${child.replace(/[.:]/g, '\\$&')}\\b`, 'g'))].length;
    if (!n) return '';
    return getAttr(open, 'count') !== undefined ? withOpen(whole, open, setAttr(open, 'count', String(n))) : whole;
  });
}

/** Where a deleted row or column sends a cell that must stay (an active cell, a pane corner). */
const clampIndex = (i: number, o: StructureOp) => shiftIndex(i, o) ?? Math.max(0, Math.min(o.at, i));
function clampRef(ref: string, o: StructureOp): string {
  const p = parseRef(ref);
  if (!p) return ref;
  return isRowOp(o) ? cellRef(clampIndex(p.row, o), p.col) : cellRef(p.row, clampIndex(p.col, o));
}

// ── one worksheet ────────────────────────────────────────────────────────────

/** Whether a formula names the operation's sheet at all (so a shared group must be unshared). */
const namesSheet = (f: string, host: string, o: StructureOp) =>
  restructureFormula(f, host, { sheet: o.sheet, op: 'insertRows', at: 0, count: 1 }) !== f || restructureFormula(f, host, { sheet: o.sheet, op: 'insertCols', at: 0, count: 1 }) !== f;

/**
 * Rewrites one worksheet's `<sheetData>`: on the operation's sheet, rows and cells move and
 * deleted ones go; on every sheet, formulas that point at it move. A shared formula whose cells
 * would no longer follow one pattern is written out per cell.
 */
export function restructureSheetData(xml: string, sheet: string, o: StructureOp, own: boolean): string {
  const P = rootPrefix(xml);
  const open = new RegExp(`<${P}sheetData\\b[^>]*?(/?)>`).exec(xml);
  if (!open || open[1] === '/') return xml;
  const closeTag = `</${P}sheetData>`;
  const end = xml.indexOf(closeTag, open.index);
  if (end < 0) throw new ExportError('corrupt', `sheet "${sheet}" has an unclosed <sheetData>`, { sheet });
  const inner = xml.slice(open.index + open[0].length, end);
  const rows = parseRows(inner, P);
  const F = new RegExp(`<${P}f\\b[^>]*?(?:/>|>([\\s\\S]*?)</${P}f>)`);
  const cellsOf = new Map<number, ReturnType<typeof parseCells>>();
  const cells = (r: (typeof rows)[number]) => { let c = cellsOf.get(r.num); if (!c) cellsOf.set(r.num, (c = r.body === undefined ? [] : parseCells(r.body, r.num, P))); return c; };
  // shared formulas: the masters, and whether each group is written out per cell
  const masters = new Map<string, { f: string; row: number; col: number; unshare: boolean }>();
  for (const r of rows) for (const c of cells(r)) {
    const f = c.body !== undefined ? F.exec(c.body) : null;
    if (!f || getAttr(f[0], 't') !== 'shared' || getAttr(f[0], 'ref') === undefined || !f[1]) continue;
    const text = unescapeXml(f[1]);
    masters.set(getAttr(f[0], 'si')!, { f: text, row: r.num - 1, col: c.col, unshare: own || namesSheet(text, sheet, o) });
  }
  const rowOp = isRowOp(o);
  let changed = false;
  const out: string[] = [];
  for (const r of rows) {
    let num = r.num;
    if (own && rowOp) {
      const i = shiftIndex(r.num - 1, o);
      if (i === undefined) { changed = true; continue; }
      num = i + 1;
    }
    let openTag = r.open;
    if (num !== r.num || !getAttr(openTag, 'r')) openTag = setAttr(openTag, 'r', String(num));
    if (own) openTag = removeAttr(openTag, 'spans');
    if (openTag !== r.open) changed = true;
    if (r.body === undefined) { out.push(openTag.replace(/>$/, '/>')); continue; }
    const parts: string[] = [];
    let rowChanged = false;
    for (const c of cells(r)) {
      let col = c.col;
      if (own && !rowOp) {
        const j = shiftIndex(c.col, o);
        if (j === undefined) { rowChanged = true; continue; }
        col = j;
      }
      let x = c.xml;
      const ref = cellRef(num - 1, col);
      if (getAttr(x, 'r') !== ref) { const t = /^<[^>]*>/.exec(x)![0]; x = setAttr(t, 'r', ref) + x.slice(t.length); }
      const f = c.body !== undefined ? F.exec(c.body) : null;
      if (f) x = x.replace(F, (whole) => formulaElement(whole, f[1], P, sheet, o, own, masters, r.num - 1, c.col));
      if (x !== c.xml) rowChanged = true;
      parts.push(x);
    }
    if (rowChanged) changed = true;
    out.push(`${openTag}${rowChanged ? parts.join('') : r.body}</${P}row>`);
  }
  if (!changed) return xml;
  return `${xml.slice(0, open.index)}${open[0]}${out.join('')}${xml.slice(end)}`;
}

/** One `<f>` moved: shared groups unshared when needed, array and data-table ranges moved (or refused when cut). */
function formulaElement(whole: string, body: string | undefined, P: string, sheet: string, o: StructureOp, own: boolean, masters: Map<string, { f: string; row: number; col: number; unshare: boolean }>, row: number, col: number): string {
  const open = /^<[^>]*>/.exec(whole)![0];
  const t = getAttr(open, 't');
  if (t === 'shared') {
    const m = masters.get(getAttr(open, 'si') ?? '');
    if (!m) return whole; // a follower without a master: Excel's own problem, left as written
    if (!m.unshare) return whole;
    const text = row === m.row && col === m.col ? m.f : shiftFormula(m.f, row - m.row, col - m.col);
    const tag = removeAttr(removeAttr(removeAttr(open.replace(/\s*\/>$/, '>'), 't'), 'ref'), 'si');
    return `${tag}${esc(restructureFormula(text, sheet, o))}</${P}f>`;
  }
  let tag = open;
  if (own && (t === 'array' || t === 'dataTable')) {
    const ref = getAttr(open, 'ref'), r = ref ? parseRange(ref) : undefined;
    if (r) {
      if (splitsRange(r, o)) throw new ExportError('bad-structure', refusal(o, `cuts the ${t === 'array' ? 'array formula' : 'data table'} ${ref}`), { sheet: o.sheet });
      const moved = shiftRangePos(r, o);
      if (moved) tag = setAttr(tag, 'ref', rangeRef(moved));
    }
    for (const a of ['r1', 'r2']) { const v = getAttr(tag, a); if (v !== undefined) { const n = shiftRefText(v, o); if (n !== undefined) tag = setAttr(tag, a, n); } }
  }
  if (body === undefined) return tag === open ? whole : tag + whole.slice(open.length);
  const text = formulaText(body, sheet, o);
  if (tag === open && text === body) return whole;
  return `${tag}${text}</${P}f>`;
}

/** The formula-bearing blocks every sheet has (validations, conditional formats, hyperlinks, x14 formulas): only references to the operation's sheet move. */
export function restructureSheetFormulas(xml: string, sheet: string, o: StructureOp): string {
  const P = rootPrefix(xml);
  let out = xml;
  for (const name of ['formula1', 'formula2', 'formula']) {
    out = eachElement(out, `${P}${name}`, (whole, open) => {
      if (open.endsWith('/>')) return whole;
      const body = whole.slice(open.length, whole.lastIndexOf('<'));
      const text = formulaText(body, sheet, o);
      return text === body ? whole : `${open}${text}${whole.slice(whole.lastIndexOf('<'))}`;
    });
  }
  out = out.replace(new RegExp(`<${P}cfvo\\b[^>]*?/?>`, 'g'), (tag) => (/^-?[\d.]+(?:[eE][-+]?\d+)?$/.test(getAttr(tag, 'val') ?? '0') ? tag : formulaAttr(tag, 'val', sheet, o)));
  out = out.replace(new RegExp(`<${P}hyperlink\\b[^>]*?/?>`, 'g'), (tag) => formulaAttr(tag, 'location', sheet, o));
  out = out.replace(/<(\w+:)?f>([^<]*)<\/\1f>/g, (whole, p: string | undefined, body: string) => {
    if ((p ?? '') === P) return whole; // the sheet's own cells are done by restructureSheetData
    const text = formulaText(body, sheet, o);
    return text === body ? whole : `<${p ?? ''}f>${text}</${p ?? ''}f>`;
  });
  return out;
}

/** The existing `<dataValidations>` and `<conditionalFormatting>` blocks of the operation's own sheet: ranges moved, blocks wholly deleted removed. */
export function restructureRuleBlocks(xml: string, o: StructureOp): string {
  const P = rootPrefix(xml);
  let out = eachElement(xml, `${P}dataValidation`, (whole, open) => { const t = sqrefAttr(open, 'sqref', o); return t === undefined ? '' : withOpen(whole, open, t); });
  out = tidyContainer(out, `${P}dataValidations`, `${P}dataValidation`);
  out = eachElement(out, `${P}conditionalFormatting`, (whole, open) => { const t = sqrefAttr(open, 'sqref', o); return t === undefined ? '' : withOpen(whole, open, t); });
  // x14 extensions: <xm:sqref> inside a rule, a validation or a sparkline
  for (const el of ['x14:dataValidation', 'x14:conditionalFormatting', 'x14:sparkline']) {
    out = eachElement(out, el, (whole) => {
      let gone = false;
      const next = whole.replace(/<(\w+:)?sqref>([^<]*)<\/\1sqref>/g, (m, p: string | undefined, body: string) => {
        const list = shiftSqref(body, o);
        if (!list.length) { gone = true; return m; }
        return `<${p ?? ''}sqref>${list.join(' ')}</${p ?? ''}sqref>`;
      });
      return gone ? '' : next;
    });
  }
  out = tidyContainer(out, 'x14:dataValidations', 'x14:dataValidation');
  return out;
}

/** The operation's own sheet: everything outside `<sheetData>` that names a cell or a column. */
export function restructureSheetParts(xml: string, o: StructureOp): string {
  const P = rootPrefix(xml);
  const rowOp = isRowOp(o);
  let out = xml;
  // <dimension>
  out = out.replace(new RegExp(`<${P}dimension\\b[^>]*?/?>`), (tag) => { const r = parseRange(getAttr(tag, 'ref') ?? ''); const m = r && shiftRangePos(r, o); return r ? setAttr(tag, 'ref', rangeRef(m ?? { top: 0, left: 0, bottom: 0, right: 0 })) : tag; });
  // the sheet view: a frozen pane's split and corner, the selections
  out = out.replace(new RegExp(`<${P}pane\\b[^>]*?/?>`, 'g'), (tag) => {
    let t = tag;
    const state = getAttr(t, 'state');
    if (state === 'frozen' || state === 'frozenSplit') {
      const a = rowOp ? 'ySplit' : 'xSplit', v = getAttr(t, a);
      if (v !== undefined) { const n = shiftCount(Number(v), o); t = n > 0 ? setAttr(t, a, String(n)) : removeAttr(t, a); }
    }
    const tl = getAttr(t, 'topLeftCell');
    if (tl !== undefined) t = setAttr(t, 'topLeftCell', clampRef(tl, o));
    return t;
  });
  out = out.replace(new RegExp(`<${P}selection\\b[^>]*?/?>`, 'g'), (tag) => {
    let t = tag;
    const ac = getAttr(t, 'activeCell');
    if (ac !== undefined) t = setAttr(t, 'activeCell', clampRef(ac, o));
    const sq = getAttr(t, 'sqref');
    if (sq !== undefined) { const l = shiftSqref(sq, o); t = setAttr(t, 'sqref', l.length ? l.join(' ') : getAttr(t, 'activeCell') ?? 'A1'); }
    return t;
  });
  if (!rowOp) out = restructureCols(out, P, o);
  // merges
  out = eachElement(out, `${P}mergeCell`, (whole, open) => { const r = getAttr(open, 'ref'); const n = r === undefined ? r : shiftRefText(r, o); return n === undefined || !n.includes(':') ? '' : withOpen(whole, open, setAttr(open, 'ref', n)); });
  out = tidyContainer(out, `${P}mergeCells`, `${P}mergeCell`);
  // autofilter and sort state
  out = restructureAutoFilter(out, P, o);
  out = eachElement(out, `${P}sortState`, (whole, open) => restructureSortState(whole, open, P, o));
  out = restructureRuleBlocks(out, o);
  // hyperlinks, protected ranges, ignored errors, watches
  out = eachElement(out, `${P}hyperlink`, (whole, open) => { const r = getAttr(open, 'ref'); const n = r === undefined ? r : shiftSqref(r, o).join(' '); return !n ? '' : withOpen(whole, open, setAttr(open, 'ref', n)); });
  out = tidyContainer(out, `${P}hyperlinks`, `${P}hyperlink`);
  for (const [container, child] of [['protectedRanges', 'protectedRange'], ['ignoredErrors', 'ignoredError']]) {
    out = eachElement(out, `${P}${child}`, (whole, open) => { const t = sqrefAttr(open, 'sqref', o); return t === undefined ? '' : withOpen(whole, open, t); });
    out = tidyContainer(out, `${P}${container}`, `${P}${child}`);
  }
  out = eachElement(out, `${P}cellWatch`, (whole, open) => { const r = getAttr(open, 'r'); const n = r === undefined ? r : shiftRefText(r, o); return n === undefined ? '' : withOpen(whole, open, setAttr(open, 'r', n)); });
  out = tidyContainer(out, `${P}cellWatches`, `${P}cellWatch`);
  // page breaks: <brk id> is the row (column) the break follows
  const breaks = rowOp ? 'rowBreaks' : 'colBreaks';
  out = eachElement(out, `${P}${breaks}`, (whole) => {
    const next = whole.replace(new RegExp(`<${P}brk\\b[^>]*?/?>`, 'g'), (tag) => { const id = Number(getAttr(tag, 'id') ?? 0); const n = shiftIndex(id, o); return n === undefined ? '' : setAttr(tag, 'id', String(n)); });
    const n = [...next.matchAll(new RegExp(`<${P}brk\\b`, 'g'))].length;
    if (!n) return '';
    const open = /^<[^>]*>/.exec(next)![0];
    let t = open;
    if (getAttr(t, 'count') !== undefined) t = setAttr(t, 'count', String(n));
    if (getAttr(t, 'manualBreakCount') !== undefined) t = setAttr(t, 'manualBreakCount', String(n));
    return withOpen(next, open, t);
  });
  return out;
}

/** `<cols>`: spans after an inserted column start split around it (the new columns take the default width); deleted columns are clipped out. */
function restructureCols(xml: string, P: string, o: StructureOp): string {
  return eachElement(xml, `${P}cols`, (whole, open) => {
    if (open.endsWith('/>')) return whole;
    const pieces: { a: number; b: number; rest: string; tag: string }[] = [];
    for (const m of whole.matchAll(new RegExp(`<${P}col\\b[^>]*?/?>`, 'g'))) {
      const a = Number(getAttr(m[0], 'min') ?? 1) - 1, b = Number(getAttr(m[0], 'max') ?? a + 1) - 1;
      const rest = removeAttr(removeAttr(m[0], 'min'), 'max');
      const put = (x: number, y: number) => {
        const last = pieces[pieces.length - 1];
        // a span a delete closed up joins its twin on the left, as Excel would have written it
        if (last && last.b === x - 1 && last.rest === rest) { last.b = y; last.tag = setAttr(setAttr(m[0], 'min', String(last.a + 1)), 'max', String(y + 1)); return; }
        pieces.push({ a: x, b: y, rest, tag: setAttr(setAttr(m[0], 'min', String(x + 1)), 'max', String(y + 1)) });
      };
      if (isInsertOp(o) && a < o.at && b >= o.at) { put(a, o.at - 1); const s = shiftSpan(o.at, b, o); if (s) put(s[0], s[1]); continue; }
      const s = shiftSpan(a, b, o);
      if (s) put(s[0], s[1]);
    }
    return pieces.length ? `${open}${pieces.map((x) => x.tag).join('')}</${P}cols>` : '';
  });
}

/** The autofilter: its range moves; on a column operation, each filter column's `colId` (relative to the range) follows its column. */
function restructureAutoFilter(xml: string, P: string, o: StructureOp): string {
  return eachElement(xml, `${P}autoFilter`, (whole, open) => moveFilter(whole, open, P, o) ?? '');
}

function moveFilter(whole: string, open: string, P: string, o: StructureOp): string | undefined {
  const r = parseRange(getAttr(open, 'ref') ?? '');
  if (!r) return whole;
  const moved = shiftRangePos(r, o);
  if (!moved) return undefined;
  let next = withOpen(whole, open, setAttr(open, 'ref', rangeRef(moved)));
  if (!isRowOp(o)) {
    next = eachElement(next, `${P}filterColumn`, (fc, fo) => {
      const abs = r.left + Number(getAttr(fo, 'colId') ?? 0), n = shiftIndex(abs, o);
      return n === undefined ? '' : withOpen(fc, fo, setAttr(fo, 'colId', String(n - moved.left)));
    });
  }
  return next; // a <sortState> inside it is moved by the caller's own pass
}

function restructureSortState(whole: string, open: string, P: string, o: StructureOp): string {
  const ref = getAttr(open, 'ref'), n = ref === undefined ? ref : shiftRefText(ref, o);
  if (ref !== undefined && n === undefined) return '';
  let next = n === undefined ? whole : withOpen(whole, open, setAttr(open, 'ref', n));
  next = eachElement(next, `${P}sortCondition`, (w, so) => { const r = getAttr(so, 'ref'), m = r === undefined ? r : shiftRefText(r, o); return r !== undefined && m === undefined ? '' : m === undefined ? w : withOpen(w, so, setAttr(so, 'ref', m)); });
  return /<(\w+:)?sortCondition\b/.test(next) ? next : '';
}

// ── the parts a sheet's relationships name ──────────────────────────────────

/** A table part on the operation's sheet: its range moves; a cut it cannot follow is refused. */
export function restructureTable(xml: string, o: StructureOp): string {
  const P = /<(\w+:)?table\b/.exec(xml)?.[1] ?? '';
  const root = new RegExp(`<${P}table\\b[^>]*>`).exec(xml);
  const ref = root && getAttr(root[0], 'ref'), r = ref ? parseRange(ref) : undefined;
  if (!root || !r) return xml;
  const name = getAttr(root[0], 'displayName') ?? getAttr(root[0], 'name') ?? 'a table';
  const rowOp = isRowOp(o);
  if (!movesRange(r, o)) return xml;
  const end = o.at + o.count - 1;
  const why = tableRefusal(r, o, { name, header: Number(getAttr(root[0], 'headerRowCount') ?? 1) > 0, totals: Number(getAttr(root[0], 'totalsRowCount') ?? 0) > 0 });
  if (why) throw new ExportError('bad-structure', refusal(o, why), { sheet: o.sheet });
  const moved = shiftRangePos(r, o)!;
  let out = xml.replace(root[0], setAttr(root[0], 'ref', rangeRef(moved)));
  if (!rowOp && !isInsertOp(o)) {
    // the deleted columns' <tableColumn>s go, in order
    let i = -1;
    out = eachElement(out, `${P}tableColumn`, (whole) => { i++; const abs = r.left + i; return o.at <= abs && abs <= end ? '' : whole; });
    out = tidyContainer(out, `${P}tableColumns`, `${P}tableColumn`);
  }
  out = eachElement(out, `${P}autoFilter`, (whole, open) => moveFilter(whole, open, P, o) ?? '');
  out = eachElement(out, `${P}sortState`, (whole, open) => restructureSortState(whole, open, P, o));
  return out;
}

/** A table on any sheet: its calculated-column and totals formulas move with references to the operation's sheet. */
export function restructureTableFormulas(xml: string, host: string, o: StructureOp): string {
  return xml.replace(/<((?:\w+:)?(?:calculatedColumnFormula|totalsRowFormula))\b([^>]*)>([^<]*)<\/\1>/g, (whole, n: string, attrs: string, body: string) => {
    const text = formulaText(body, host, o);
    return text === body ? whole : `<${n}${attrs}>${text}</${n}>`;
  });
}

/** A drawing part: each anchor's from / to cell moves (a deleted row or column pulls it to the gap). */
export function restructureDrawing(xml: string, o: StructureOp): string {
  const rowOp = isRowOp(o);
  const axis = rowOp ? 'row' : 'col';
  const at = new RegExp(`<((?:\\w+:)?${axis})>\\s*(\\d+)\\s*</\\1>`), off = new RegExp(`<((?:\\w+:)?${axis}Off)>[^<]*</\\1>`);
  return xml.replace(/<((?:\w+:)?(?:from|to))>([\s\S]*?)<\/\1>/g, (whole) => {
    const m = at.exec(whole);
    if (!m) return whole;
    const j = shiftIndex(Number(m[2]), o);
    if (j === Number(m[2])) return whole;
    const next = whole.replace(m[0], `<${m[1]}>${j ?? o.at}</${m[1]}>`);
    return j === undefined ? next.replace(off, (x, n: string) => `<${n}>0</${n}>`) : next; // pulled to the gap: no offset into a row that is gone
  });
}

/** A legacy comments part: each `<comment ref>` moves; a deleted cell's comment goes. */
export function restructureComments(xml: string, o: StructureOp): string {
  const P = /<(\w+:)?comments\b/.exec(xml)?.[1] ?? '';
  return eachElement(xml, `${P}comment`, (whole, open) => { const r = getAttr(open, 'ref'), n = r === undefined ? r : shiftRefText(r, o); return n === undefined ? '' : withOpen(whole, open, setAttr(open, 'ref', n)); });
}

/** The VML part of a sheet's notes: each note shape's row, column and anchor move; a deleted cell's shape goes. */
export function restructureVml(xml: string, o: StructureOp): string {
  const rowOp = isRowOp(o);
  return xml.replace(/<(\w+:)?shape\b[\s\S]*?<\/\1shape>/g, (shape) => {
    if (!/ObjectType\s*=\s*"Note"/.test(shape)) return shape;
    const tag = rowOp ? 'Row' : 'Column';
    const cur = new RegExp(`<((?:\\w+:)?${tag})>\\s*(\\d+)\\s*</\\1>`).exec(shape);
    if (cur && shiftIndex(Number(cur[2]), o) === undefined) return '';
    let next = cur ? shape.replace(cur[0], `<${cur[1]}>${shiftIndex(Number(cur[2]), o)}</${cur[1]}>`) : shape;
    next = next.replace(/<((?:\w+:)?Anchor)>([^<]*)<\/\1>/, (m, n: string, body: string) => {
      const v = body.split(',').map((s) => Number(s.trim()));
      if (v.length !== 8 || v.some((x) => !Number.isFinite(x))) return m;
      for (const i of rowOp ? [2, 6] : [0, 4]) v[i] = clampIndex(v[i]!, o);
      return `<${n}>${v.join(', ')}</${n}>`;
    });
    return next;
  });
}

/** A threaded-comments part: each thread entry's `ref` moves; a deleted cell's thread goes. */
export function restructureThreads(xml: string, o: StructureOp): string {
  const P = /<(\w+:)?ThreadedComments\b/.exec(xml)?.[1] ?? '';
  return eachElement(xml, `${P}threadedComment`, (whole, open) => { const r = getAttr(open, 'ref'), n = r === undefined ? r : shiftRefText(r, o); return n === undefined ? '' : withOpen(whole, open, setAttr(open, 'ref', n)); });
}

/**
 * A chart part: the series' `<c:f>` references to the operation's sheet move (`#REF!` when the
 * cells were deleted). Shared with @sheetpane/import, which shifts the chart parts it serves.
 * @param xml - The chart part's XML.
 * @param o - The operation.
 * @returns The chart XML; the same string when nothing moved.
 */
export function restructureChartXml(xml: string, o: StructureOp): string {
  return xml.replace(/<((?:\w+:)?f)>([^<]*)<\/\1>/g, (whole, n: string, body: string) => {
    const text = formulaText(body, undefined, o);
    return text === body ? whole : `<${n}>${text}</${n}>`;
  });
}

/** The workbook's defined names (print areas, filters and the user's names) moved. */
export function restructureDefinedNames(wb: string, o: StructureOp): string {
  const names = [...wb.matchAll(/<(?:\w+:)?sheet\b[^>]*>/g)].map((m) => getAttr(m[0], 'name') ?? '');
  return wb.replace(/<((?:\w+:)?definedName)\b([^>]*)>([^<]*)<\/\1>/g, (whole, n: string, attrs: string, body: string) => {
    const local = getAttr(`<x${attrs}>`, 'localSheetId');
    const text = formulaText(body, local !== undefined ? names[Number(local)] : undefined, o);
    return text === body ? whole : `<${n}${attrs}>${text}</${n}>`;
  });
}

interface SheetRef { name: string; path: string }

/** Pivot tables and caches: an operation that would move a pivot's location or its worksheet source is refused (pivots are not rewritten). */
async function checkPivots(parts: StructureParts, sheets: SheetRef[], o: StructureOp): Promise<void> {
  const target = o.sheet.toUpperCase();
  for (const p of parts.list().filter((n) => /pivotCacheDefinition[^/]*\.xml$/.test(n))) {
    const ws = /<(?:\w+:)?worksheetSource\b[^>]*>/.exec((await parts.text(p)) ?? '');
    const sheet = ws && getAttr(ws[0], 'sheet'), ref = ws && getAttr(ws[0], 'ref'), r = ref ? parseRange(ref) : undefined;
    if (sheet && r && sheet.toUpperCase() === target && movesRange(r, o)) throw new ExportError('bad-structure', refusal(o, `moves the source ${ref} of a pivot table`), { sheet: o.sheet });
  }
  const own = sheets.find((s) => s.name.toUpperCase() === target);
  if (!own) return;
  for (const rel of parseRels((await parts.text(relsPathOf(own.path))) ?? '')) {
    if (!rel.type.endsWith('/pivotTable') || rel.mode === 'External') continue;
    const loc = /<(?:\w+:)?location\b[^>]*>/.exec((await parts.text(resolveTarget(own.path, rel.target))) ?? '');
    const ref = loc && getAttr(loc[0], 'ref'), r = ref ? parseRange(ref) : undefined;
    if (r && movesRange(r, o)) throw new ExportError('bad-structure', refusal(o, `moves the pivot table at ${ref}`), { sheet: o.sheet });
  }
}

/**
 * Applies the operations to the package, in order: each is checked (pivots), then every
 * sheet, the operation's sheet's own parts, every chart and the defined names are rewritten.
 * The caller drops the calculation chain and asks Excel to recalculate.
 * @param parts - The package.
 * @param wbPath - The workbook part.
 * @param sheets - The worksheets by name and path.
 * @param ops - The operations, in the order they were made.
 */
export async function applyStructure(parts: StructureParts, wbPath: string, sheets: SheetRef[], ops: readonly StructureOp[]): Promise<void> {
  for (const o of ops) {
    if (!Number.isInteger(o.at) || o.at < 0 || !Number.isInteger(o.count) || o.count < 1 || !['insertRows', 'deleteRows', 'insertCols', 'deleteCols'].includes(o.op)) {
      throw new ExportError('bad-structure', `${JSON.stringify(o)} is not an insert or delete of rows or columns`, { sheet: o.sheet });
    }
    const own = sheets.find((s) => s.name === o.sheet);
    if (!own) throw new ExportError('no-sheet', `no sheet named "${o.sheet}" in the workbook`, { sheet: o.sheet });
    await checkPivots(parts, sheets, o);
    const writes = new Map<string, string>();
    // every sheet's formulas and rule formulas; the own sheet's rows, cells and blocks
    for (const s of sheets) {
      const xml = await parts.text(s.path);
      if (xml === undefined) continue;
      const mine = s === own;
      let next = restructureSheetData(xml, s.name, o, mine);
      if (mine) next = restructureSheetParts(next, o);
      next = restructureSheetFormulas(next, s.name, o);
      if (next !== xml) writes.set(s.path, next);
      for (const rel of parseRels((await parts.text(relsPathOf(s.path))) ?? '')) {
        if (rel.mode === 'External') continue;
        const path = resolveTarget(s.path, rel.target), part = await parts.text(path);
        if (part === undefined) continue;
        let moved = part;
        if (rel.type.endsWith('/table')) { if (mine) moved = restructureTable(moved, o); moved = restructureTableFormulas(moved, s.name, o); }
        else if (mine && rel.type.endsWith('/drawing')) moved = restructureDrawing(moved, o);
        else if (mine && rel.type.endsWith('/comments')) moved = restructureComments(moved, o);
        else if (mine && rel.type.endsWith('/vmlDrawing')) moved = restructureVml(moved, o);
        else if (mine && rel.type.endsWith('/threadedComment')) moved = restructureThreads(moved, o);
        if (moved !== part) writes.set(path, moved);
      }
    }
    for (const p of parts.list().filter((n) => /^xl\/charts\/[^/]+\.xml$/.test(n))) {
      const xml = await parts.text(p);
      const next = xml === undefined ? xml : restructureChartXml(xml, o);
      if (next !== undefined && next !== xml) writes.set(p, next);
    }
    const wb = await parts.text(wbPath);
    if (wb !== undefined) { const next = restructureDefinedNames(wb, o); if (next !== wb) writes.set(wbPath, next); }
    for (const [p, x] of writes) parts.write(p, x); // all or nothing: a refusal above leaves every part as it was
  }
}

export type { RangePos };
