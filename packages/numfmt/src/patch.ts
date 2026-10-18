// exportPatch: a user's number-format changes written into the .xlsx — new
// `<numFmt>` and `<xf>` entries appended to xl/styles.xml (deduplicated), and
// each changed cell's `s` repointed. Nothing else in the package is touched
// (SR-LAW-6 fidelity). Text-level edits, like the core's: no XML round trip.
import type { PatchContext } from '@sheetpane/export';
import { spError } from '@sheetpane/grid';
import { builtinIdOf } from './fmt.js';

/** A change to apply: the cell, the style index it had, the code it now shows. */
export interface FormatEdit { sheet: string; ref: string; was: number; code: string }

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unesc = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|quot|apos|amp);/gi, (_, e: string) => {
  switch (e.toLowerCase()) {
    case 'lt': return '<'; case 'gt': return '>'; case 'quot': return '"'; case 'apos': return "'"; case 'amp': return '&';
    default: return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  }
});

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(tag);
  return m ? unesc(m[1] ?? m[2] ?? '') : undefined;
}
function withAttr(tag: string, name: string, value: string): string {
  const re = new RegExp(`(\\s${name}\\s*=\\s*)(?:"[^"]*"|'[^']*')`);
  return re.test(tag) ? tag.replace(re, `$1"${escAttr(value)}"`) : tag.replace(/\s*(\/?)>$/, ` ${name}="${escAttr(value)}"$1>`);
}

const colIndex = (letters: string) => [...letters.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
function splitRef(ref: string): { col: number; row: number } | undefined {
  const m = /^([A-Za-z]{1,3})(\d+)$/.exec(ref);
  return m ? { col: colIndex(m[1]!), row: Number(m[2]) } : undefined;
}

/** The styles part's path: the workbook's relationship of type `…/styles`, else `xl/styles.xml`. */
async function stylesPath(patch: PatchContext): Promise<string> {
  const wb = patch.workbookPath();
  const rels = await patch.readText(patch.relsPathOf(wb));
  for (const m of rels?.matchAll(/<(?:\w+:)?Relationship\b[^>]*>/g) ?? []) {
    if (!(attr(m[0], 'Type') ?? '').endsWith('/styles')) continue;
    const target = attr(m[0], 'Target') ?? '';
    const dir = wb.slice(0, wb.lastIndexOf('/') + 1);
    const parts = (target.startsWith('/') ? target.slice(1) : dir + target).split('/');
    const out: string[] = [];
    for (const p of parts) { if (p === '..') out.pop(); else if (p !== '.' && p !== '') out.push(p); }
    return out.join('/');
  }
  return 'xl/styles.xml';
}

const XF_RE = /<xf\b[^>]*?\/>|<xf\b[^>]*?>[\s\S]*?<\/xf>/g;
const CELLXFS_RE = /<cellXfs\b[^>]*?(?:\/>|>([\s\S]*?)<\/cellXfs>)/;
const NUMFMTS_RE = /<numFmts\b[^>]*?(?:\/>|>([\s\S]*?)<\/numFmts>)/;
const DEFAULT_XF = '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>';

/** xl/styles.xml with the edits' formats added; returns the new text and the new `s` for every (was, code) pair. */
export function patchStyles(xml: string, edits: readonly FormatEdit[]): { xml: string; styleOf: (was: number, code: string) => number } {
  if (!/<styleSheet\b/.test(xml)) throw spError('SP-5102', 'sheetpane numfmt: xl/styles.xml is not a style sheet');
  // custom formats already in the file
  const nm = NUMFMTS_RE.exec(xml);
  const idOfCode = new Map<string, number>();
  let maxId = 163;
  const numFmtTags: string[] = [];
  for (const m of nm?.[1]?.matchAll(/<numFmt\b[^>]*?\/?>/g) ?? []) {
    const id = Number(attr(m[0], 'numFmtId')), code = attr(m[0], 'formatCode');
    numFmtTags.push(m[0]);
    if (Number.isFinite(id) && code !== undefined) { if (!idOfCode.has(code)) idOfCode.set(code, id); if (id > maxId) maxId = id; }
  }
  const newNumFmts: string[] = [];
  const idFor = (code: string): number => {
    if (code === 'General') return 0;
    const builtin = builtinIdOf(code);
    if (builtin !== undefined) return builtin;
    let id = idOfCode.get(code);
    if (id === undefined) {
      id = ++maxId;
      idOfCode.set(code, id);
      newNumFmts.push(`<numFmt numFmtId="${id}" formatCode="${escAttr(code)}"/>`);
    }
    return id;
  };

  // cell formats
  const cx = CELLXFS_RE.exec(xml);
  const xfs: string[] = cx ? [...(cx[1] ?? '').matchAll(XF_RE)].map((m) => m[0]) : [];
  const baseCount = xfs.length;
  const added = new Map<string, number>();
  const styleOf = (was: number, code: string): number => {
    const k = `${was}\u0000${code}`;
    let s = added.get(k);
    if (s !== undefined) return s;
    const base = xfs[was < baseCount ? was : 0] ?? DEFAULT_XF;
    const head = /^<xf\b[^>]*?\/?>/.exec(base)![0];
    const nh = withAttr(withAttr(head, 'numFmtId', String(idFor(code))), 'applyNumberFormat', '1');
    // A self-closing head is kept self-closing; an open one keeps its children.
    const xf = base === head ? nh : nh + base.slice(head.length);
    const same = xfs.indexOf(xf);
    s = same >= 0 ? same : xfs.push(xf) - 1;
    added.set(k, s);
    return s;
  };
  // Resolve every edit now, so the numFmt and xf lists are complete before we write them.
  for (const e of edits) styleOf(e.was, e.code);

  let out = xml;
  if (xfs.length > baseCount || !cx) {
    const block = `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>`;
    if (cx) out = out.replace(CELLXFS_RE, () => block);
    else {
      const at = /<cellStyles\b|<dxfs\b|<tableStyles\b|<colors\b|<extLst\b|<\/styleSheet>/.exec(out);
      out = at ? out.slice(0, at.index) + block + out.slice(at.index) : out;
    }
  }
  if (newNumFmts.length) {
    const all = [...numFmtTags, ...newNumFmts];
    const block = `<numFmts count="${all.length}">${all.join('')}</numFmts>`;
    if (nm) out = out.replace(NUMFMTS_RE, () => block);
    else out = out.replace(/(<styleSheet\b[^>]*>)/, (m) => m + block);
  }
  return { xml: out, styleOf };
}

/** A worksheet with the given cells' `s` set; a cell the sheet does not hold yet is inserted (in order, in its row). */
export function patchSheet(xml: string, styles: ReadonlyMap<string, number>): string {
  const left = new Map(styles);
  let out = xml.replace(/<c\b[^>]*>/g, (tag) => {
    const r = attr(tag, 'r');
    if (r === undefined) return tag;
    const s = left.get(r);
    if (s === undefined) return tag;
    left.delete(r);
    return withAttr(tag, 's', String(s));
  });
  for (const [ref, s] of left) out = insertCell(out, ref, s);
  return out;
}

function insertCell(xml: string, ref: string, s: number): string {
  const p = splitRef(ref);
  if (!p) return xml;
  const cell = `<c r="${ref}" s="${s}"/>`;
  // find the row, or the place it goes
  let rowAt = -1, rowEnd = -1, rowOpenEnd = -1, selfClosing = false;
  let after: RegExpExecArray | null = null;
  const rowRe = /<row\b[^>]*>/g;
  for (let m: RegExpExecArray | null; (m = rowRe.exec(xml)); ) {
    const n = Number(attr(m[0], 'r'));
    if (n === p.row) {
      rowAt = m.index; rowOpenEnd = m.index + m[0].length; selfClosing = /\/>$/.test(m[0]);
      rowEnd = selfClosing ? rowOpenEnd : xml.indexOf('</row>', rowOpenEnd);
      break;
    }
    if (n > p.row) { after = m; break; }
  }
  if (rowAt >= 0) {
    if (selfClosing) return xml.slice(0, rowOpenEnd - 2).replace(/\s*$/, '') + `>${cell}</row>` + xml.slice(rowOpenEnd);
    if (rowEnd < 0) return xml;
    const body = xml.slice(rowOpenEnd, rowEnd);
    for (const m of body.matchAll(/<c\b[^>]*>/g)) {
      const q = splitRef(attr(m[0], 'r') ?? '');
      if (q && q.col > p.col) { const at = rowOpenEnd + m.index; return xml.slice(0, at) + cell + xml.slice(at); }
    }
    return xml.slice(0, rowEnd) + cell + xml.slice(rowEnd);
  }
  const row = `<row r="${p.row}">${cell}</row>`;
  if (after) return xml.slice(0, after.index) + row + xml.slice(after.index);
  if (/<sheetData\s*\/>/.test(xml)) return xml.replace(/<sheetData\s*\/>/, `<sheetData>${row}</sheetData>`);
  const close = xml.lastIndexOf('</sheetData>');
  return close < 0 ? xml : xml.slice(0, close) + row + xml.slice(close);
}

/** Applies every edit to the package: styles first (it assigns the new `s` values), then each changed sheet. */
export async function applyFormatEdits(patch: PatchContext, edits: readonly FormatEdit[]): Promise<void> {
  if (!edits.length) return;
  const path = await stylesPath(patch);
  const text = await patch.readText(path);
  if (text === undefined) throw spError('SP-5103', `sheetpane numfmt: the package has no ${path}, so number formats cannot be written`);
  const { xml, styleOf } = patchStyles(text, edits);
  patch.write(path, xml);
  const bySheet = new Map<string, Map<string, number>>();
  for (const e of edits) {
    let m = bySheet.get(e.sheet);
    if (!m) bySheet.set(e.sheet, (m = new Map()));
    m.set(e.ref, styleOf(e.was, e.code));
  }
  for (const [sheet, cells] of bySheet) {
    const sp = patch.sheetPath(sheet);
    const sx = sp ? await patch.readText(sp) : undefined;
    if (!sp || sx === undefined) continue;
    patch.write(sp, patchSheet(sx, cells));
  }
}
