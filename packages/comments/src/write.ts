// exportPatch: the review written into the .xlsx as Excel threaded comments
// (W-22 DoD 3, 5). Four parts per sheet — the threaded comments, the legacy
// comment Excel 2019 and older read (with Excel's "[Threaded comment]"
// placeholder text), the VML note shape Excel needs to show either, and the
// workbook's person list — plus their rels and content types. A part the file
// already has is extended, never replaced. String-level XML only: this runs in
// browsers and in Node.
import { spError, spMessage, type Plugin, type SheetpaneError } from '@sheetpane/grid';
import { errorGuids, personGuid } from './guid.js';
import {
  XML_DECL, anchorOf, attr, cleanXml, escAttr, escText, freeName, parseCellRef, parseRels, relativeTarget, resolveTarget, unesc, withAttr,
} from './xml.js';

export type PatchContext = Parameters<NonNullable<Plugin['exportPatch']>>[0];

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_TC = 'http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments';
export const REL = {
  threaded: 'http://schemas.microsoft.com/office/2017/10/relationships/threadedComment',
  person: 'http://schemas.microsoft.com/office/2017/10/relationships/person',
  comments: `${NS_R}/comments`,
  vml: `${NS_R}/vmlDrawing`,
} as const;
export const CT = {
  threaded: 'application/vnd.ms-excel.threadedcomments+xml',
  person: 'application/vnd.ms-excel.person+xml',
  comments: 'application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml',
  vml: 'application/vnd.openxmlformats-officedocument.vmlDrawing',
} as const;

/** What Excel writes into the legacy comment of every thread, for versions that cannot show threads. */
export const PLACEHOLDER = '[Threaded comment]\n\nYour version of Excel allows you to read this threaded comment; however, any edits to it will get removed if the file is opened in a newer version of Excel. Learn more: https://go.microsoft.com/fwlink/?linkid=870924';

/** The author written for an error whose `author` is empty. */
export const DEFAULT_AUTHOR = 'Reviewer';

export interface WriteReport {
  /** Error ids written as a thread entry. */
  written: string[];
  /**
   * Errors not written, and why: `note-at-cell` — the cell already carries a note, and a cell holds one
   * comment; `no-sheet` / `bad-range` — nowhere to anchor it; `unreadable-part` — the sheet's comment parts
   * could not be parsed, so that sheet's parts are left exactly as they were.
   */
  skipped: { id: string; reason: 'note-at-cell' | 'no-sheet' | 'bad-range' | 'unreadable-part' }[];
}

export interface WriteOptions {
  /** A display name for an error type id (`wrong-value` → `Wrong value`). */
  typeName(id: string): string;
}

interface Entry {
  id: string;
  ref: string;
  parentId: string | undefined;
  text: string;
  /** The element as written; undefined for an entry this plugin is about to write. */
  xml: string | undefined;
  personId: string;
  dT: string;
  done: boolean;
}

/** `2026-10-18T09:12:00.12` — Excel's `dT` form (UTC, hundredths). */
function excelDate(iso: string): string {
  const d = new Date(iso);
  return (Number.isNaN(d.getTime()) ? new Date() : d).toISOString().replace(/(\.\d{2})\d*Z$/, '$1');
}

const authorOf = (e: SheetpaneError) => e.author.trim() || DEFAULT_AUTHOR;
const nl = (s: string) => cleanXml(s.replace(/\r\n?/g, '\n'));

/** The severity as the comment names it; `pass` and `skipped` are written only when the host asks (W-50). */
const SEV_NAME: Record<SheetpaneError['severity'], string> = { error: 'Error', warning: 'Warning', note: 'Note', pass: 'Passed', skipped: 'Not checked' };

function rootText(e: SheetpaneError, o: WriteOptions): string {
  const sev = SEV_NAME[e.severity];
  const head = [e.id, sev, o.typeName(e.type), `Found: ${e.found}`].filter(Boolean).join(' · ');
  return nl(e.message ? `${head}\n${e.message}` : head);
}

/** The thread entries one error becomes: its comment, then `expected` as a reply. */
function entriesOf(e: SheetpaneError, ref: string, o: WriteOptions): Entry[] {
  const g = errorGuids(e), personId = personGuid(authorOf(e)), dT = excelDate(e.createdAt);
  const out: Entry[] = [{ id: g.comment, ref, parentId: undefined, text: rootText(e, o), xml: undefined, personId, dT, done: false }];
  if (e.expected) out.push({ id: g.expected, ref, parentId: undefined, text: nl(`Should be: ${e.expected}`), xml: undefined, personId, dT, done: false });
  return out;
}

// ── parsing the parts the file already has ────────────────────────────────

const elementRe = (name: string) => new RegExp(`<(?:\\w+:)?${name}\\b[^>]*?(?:/>|>[\\s\\S]*?</(?:\\w+:)?${name}>)`, 'g');
const openTag = (xml: string) => /^<[^>]*>/.exec(xml)![0];

function parseThreads(xml: string): Entry[] {
  return [...xml.matchAll(elementRe('threadedComment'))].map((m) => {
    const tag = openTag(m[0]);
    const text = /<(?:\w+:)?text\b[^>]*>([\s\S]*?)<\/(?:\w+:)?text>/.exec(m[0]);
    const done = attr(tag, 'done');
    return {
      id: attr(tag, 'id') ?? '', ref: (attr(tag, 'ref') ?? '').toUpperCase(), parentId: attr(tag, 'parentId'), text: unesc(text?.[1] ?? ''),
      xml: m[0], personId: attr(tag, 'personId') ?? '', dT: attr(tag, 'dT') ?? '', done: done === '1' || done === 'true',
    };
  });
}

/** Rebuilds an element list inside a container part: `<root …>` + items + `</root>`; a self-closed root opens. */
function fillContainer(xml: string, root: string, items: string): string {
  const open = new RegExp(`<(\\w+:)?${root}\\b[^>]*?(/?)>`).exec(xml);
  if (!open) throw spError('SP-5801', `sheetpane comments: no <${root}> element`);
  const P = open[1] ?? '';
  const start = open.index, headEnd = start + open[0].length;
  const tag = open[2] === '/' ? open[0].replace(/\s*\/>$/, '>') : open[0];
  const close = `</${P}${root}>`;
  const end = open[2] === '/' ? headEnd : xml.lastIndexOf(close);
  const after = open[2] === '/' ? xml.slice(headEnd) : xml.slice(end + close.length);
  return `${xml.slice(0, start)}${tag}${items}${close}${after}`;
}

/** The text a legacy comment carries for a thread: Excel's placeholder, then the comment and its replies. */
export function placeholderText(entries: { text: string }[]): string {
  const indent = (t: string) => t.split('\n').map((l) => `    ${l}`).join('\n');
  const [root, ...replies] = entries;
  return `${PLACEHOLDER}\n\nComment:\n${indent(root?.text ?? '')}${replies.map((r) => `\nReply:\n${indent(r.text)}`).join('')}`;
}

// ── the worksheet ──────────────────────────────────────────────────────────

/** CT_Worksheet children that follow `<legacyDrawing>`. */
const AFTER_LEGACY = ['legacyDrawingHF', 'drawingHF', 'picture', 'oleObjects', 'controls', 'webPublishItems', 'tableParts', 'extLst'];

/** The worksheet's direct children after `<sheetData>`, by name and offset. */
function tailChildren(xml: string): { name: string; start: number }[] {
  const P = /<(\w+:)?worksheet\b/.exec(xml)?.[1] ?? '';
  const close = xml.indexOf(`</${P}sheetData>`);
  let from = close >= 0 ? close + `</${P}sheetData>`.length : -1;
  if (close < 0) { const self = new RegExp(`<${P}sheetData\\b[^>]*/>`).exec(xml); from = self ? self.index + self[0].length : 0; }
  const out: { name: string; start: number }[] = [];
  const re = /<(\/?)([\w.:-]+)[^>]*?(\/?)>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>/g;
  re.lastIndex = from;
  let depth = 1, m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (!m[2]) continue;
    if (m[1]) { depth--; if (depth === 0) break; continue; }
    if (depth === 1) out.push({ name: m[2].replace(/^\w+:/, ''), start: m.index });
    if (!m[3]) depth++;
  }
  return out;
}

/** Adds `<legacyDrawing r:id>` in schema position (and `xmlns:r` on the root when missing). */
export function addLegacyDrawing(xml: string, rId: string): string {
  const root = /<(\w+:)?worksheet\b[^>]*>/.exec(xml);
  if (!root) throw spError('SP-5802', 'sheetpane comments: not a worksheet');
  const P = root[1] ?? '';
  let out = xml;
  let rp = 'r';
  const bound = [...root[0].matchAll(/\sxmlns:([\w.-]+)\s*=\s*"([^"]*)"/g)].find((m) => m[2] === NS_R);
  if (bound) rp = bound[1]!;
  else if (/\sxmlns:r\s*=/.test(root[0])) rp = 'spr';
  if (!bound) out = out.replace(root[0], withAttr(root[0], `xmlns:${rp}`, NS_R));
  const el = `<${P}legacyDrawing ${rp}:id="${rId}"/>`;
  const next = tailChildren(out).find((c) => AFTER_LEGACY.includes(c.name));
  const at = next ? next.start : out.lastIndexOf(`</${P}worksheet>`);
  return out.slice(0, at) + el + out.slice(at);
}

// ── VML ────────────────────────────────────────────────────────────────────

const SHAPETYPE = '<v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>';

/** The hidden note shape Excel draws a comment in — copied from the one Excel writes; position comes from `x:Anchor`. */
export function noteShape(id: number, row: number, col: number): string {
  const top = Math.max(row - 1, 0);
  const left = ((col + 1) * 48 + 11.25).toFixed(2), mt = (top * 15 + 1.5).toFixed(2);
  return `<v:shape id="_x0000_s${id}" type="#_x0000_t202" style="position:absolute;margin-left:${left}pt;margin-top:${mt}pt;width:108pt;height:59.25pt;z-index:${id % 1024};visibility:hidden" fillcolor="infoBackground [80]" strokecolor="none [81]" o:insetmode="auto"><v:fill color2="infoBackground [80]"/><v:shadow color="none [81]" obscured="t"/><v:path o:connecttype="none"/><v:textbox style="mso-direction-alt:auto"><div style="text-align:left"/></v:textbox><x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/><x:Anchor>${col + 1}, 15, ${top}, 10, ${col + 3}, 15, ${top + 4}, 4</x:Anchor><x:AutoFill>False</x:AutoFill><x:Row>${row}</x:Row><x:Column>${col}</x:Column></x:ClientData></v:shape>`;
}

/** Cells that already have a note shape in a VML part: `row,col`. */
function noteCells(vml: string): Set<string> {
  const out = new Set<string>();
  for (const m of vml.matchAll(/<(?:\w+:)?ClientData\b[^>]*ObjectType\s*=\s*"Note"[^>]*>([\s\S]*?)<\/(?:\w+:)?ClientData>/g)) {
    const r = /<(?:\w+:)?Row>\s*(\d+)\s*</.exec(m[1]!), c = /<(?:\w+:)?Column>\s*(\d+)\s*</.exec(m[1]!);
    if (r && c) out.add(`${r[1]},${c[1]}`);
  }
  return out;
}

/** The `o:idmap` blocks every VML part in the package claims (shape ids are 1024 per block). */
async function usedIdBlocks(patch: PatchContext): Promise<Set<number>> {
  const used = new Set<number>();
  for (const p of patch.list().filter((n) => /\.vml$/i.test(n))) {
    const x = (await patch.readText(p)) ?? '';
    for (const m of x.matchAll(/<(?:\w+:)?idmap\b[^>]*>/g)) for (const n of (attr(m[0], 'data') ?? '').split(',')) if (/^\d+$/.test(n.trim())) used.add(Number(n));
  }
  return used;
}

function extendVml(vml: string, cells: { row: number; col: number }[]): string {
  const have = noteCells(vml);
  const todo = cells.filter((c) => !have.has(`${c.row},${c.col}`));
  if (!todo.length) return vml;
  let next = Math.max(1024, ...[...vml.matchAll(/_x0000_s(\d+)/g)].map((m) => Number(m[1]))) + 1;
  const shapes = todo.map((c) => noteShape(next++, c.row, c.col)).join('');
  let out = vml;
  if (!/id\s*=\s*"_x0000_t202"/.test(out)) {
    const first = out.search(/<v:shape\b/);
    out = first >= 0 ? out.slice(0, first) + SHAPETYPE + out.slice(first) : out.replace(/<\/xml>\s*$/, `${SHAPETYPE}</xml>`);
  }
  const end = out.lastIndexOf('</xml>');
  return end >= 0 ? out.slice(0, end) + shapes + out.slice(end) : out + shapes;
}

function newVml(block: number, cells: { row: number; col: number }[]): string {
  return `<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="${block}"/></o:shapelayout>${SHAPETYPE}${cells.map((c, i) => noteShape(block * 1024 + 1 + i, c.row, c.col)).join('')}</xml>`;
}

// ── the legacy comments part ───────────────────────────────────────────────

function writeLegacy(xml: string | undefined, threads: Map<string, { rootId: string; entries: { text: string }[] }>): string {
  const base = xml ?? `${XML_DECL}<comments xmlns="${NS_MAIN}"><authors/><commentList/></comments>`;
  const P = /<(\w+:)?comments\b/.exec(base)?.[1] ?? '';
  const authors = [...base.matchAll(new RegExp(`<${P}author\\b[^>]*?(?:/>|>([\\s\\S]*?)</${P}author>)`, 'g'))].map((m) => unesc(m[1] ?? ''));
  const list = [...base.matchAll(elementRe('comment'))].map((m) => {
    const tag = openTag(m[0]);
    return { ref: (attr(tag, 'ref') ?? '').toUpperCase(), author: authors[Number(attr(tag, 'authorId') ?? 0)] ?? '', xml: m[0] };
  });
  const kept = list.filter((c) => !threads.has(c.ref) || !c.author.startsWith('tc='));
  for (const [ref, t] of threads) {
    const a = `tc=${t.rootId}`;
    let id = authors.indexOf(a);
    if (id < 0) { id = authors.length; authors.push(a); }
    kept.push({ ref, author: a, xml: `<${P}comment ref="${ref}" authorId="${id}" shapeId="0"><${P}text><${P}t xml:space="preserve">${escText(placeholderText(t.entries))}</${P}t></${P}text></${P}comment>` });
  }
  const pos = (r: string) => parseCellRef(r) ?? { row: Infinity, col: Infinity };
  kept.sort((a, b) => pos(a.ref).row - pos(b.ref).row || pos(a.ref).col - pos(b.ref).col);
  let out = fillContainer(base, 'authors', authors.map((a) => `<${P}author>${escText(a)}</${P}author>`).join(''));
  out = /<(?:\w+:)?commentList\b/.test(out) ? fillContainer(out, 'commentList', kept.map((c) => c.xml).join('')) : out.replace(new RegExp(`</${P}comments>`), `<${P}commentList>${kept.map((c) => c.xml).join('')}</${P}commentList></${P}comments>`);
  return out;
}

// ── the whole patch ────────────────────────────────────────────────────────

/** Writes every error given as threaded comments. `errors` excludes the file's own (`author: 'file'`). */
export async function writeReview(patch: PatchContext, errors: readonly SheetpaneError[], o: WriteOptions): Promise<WriteReport> {
  const report: WriteReport = { written: [], skipped: [] };
  const bySheet = new Map<string, { anchor: string; e: SheetpaneError }[]>();
  for (const e of errors) {
    const anchor = anchorOf(e.range);
    if (!patch.sheetPath(e.sheet)) { report.skipped.push({ id: e.id, reason: 'no-sheet' }); continue; }
    if (!anchor) { report.skipped.push({ id: e.id, reason: 'bad-range' }); continue; }
    (bySheet.get(e.sheet) ?? bySheet.set(e.sheet, []).get(e.sheet)!).push({ anchor, e });
  }
  const people = new Set<string>();

  for (const [sheet, items] of bySheet) {
    const sheetPath = patch.sheetPath(sheet)!;
    const rels = parseRels(await patch.readText(patch.relsPathOf(sheetPath)));
    const relPath = (pred: (t: string) => boolean) => { const r = rels.find((x) => !x.external && pred(x.type)); return r && resolveTarget(sheetPath, r.target); };
    const threadedPath = relPath((t) => t === REL.threaded);
    const commentsPath = relPath((t) => t === REL.comments || t.endsWith('/comments'));
    let sheetXml = (await patch.readText(sheetPath))!;
    const legacyTag = /<(?:\w+:)?legacyDrawing\b[^>]*>/.exec(sheetXml);
    const legacyRel = legacyTag && rels.find((r) => r.id === attr(legacyTag[0], '*:id'));
    const vmlPath = legacyRel ? resolveTarget(sheetPath, legacyRel.target) : undefined;

    const threadedXml = threadedPath ? await patch.readText(threadedPath) : undefined;
    const commentsXml = commentsPath ? await patch.readText(commentsPath) : undefined;

    // Every id this review writes on this sheet: an earlier export's copy is replaced, not repeated.
    const ourIds = new Set(items.flatMap(({ e }) => Object.values(errorGuids(e))));
    const existing = threadedXml ? parseThreads(threadedXml) : [];
    const kept = existing.filter((t) => !ourIds.has(t.id));
    const keptIds = new Set(kept.map((t) => t.id));
    const foreignRoot = new Map<string, Entry>();
    for (const t of kept) if ((!t.parentId || !keptIds.has(t.parentId)) && !ourIds.has(t.parentId ?? '') && !foreignRoot.has(t.ref)) foreignRoot.set(t.ref, t);
    // Cells holding a note that is not a thread's placeholder: a cell carries one comment, so those are left alone.
    const noteRefs = new Set<string>();
    if (commentsXml) {
      const authors = [...commentsXml.matchAll(/<(?:\w+:)?author\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?author>)/g)].map((m) => unesc(m[1] ?? ''));
      for (const m of commentsXml.matchAll(elementRe('comment'))) {
        const tag = openTag(m[0]);
        if (!(authors[Number(attr(tag, 'authorId') ?? 0)] ?? '').startsWith('tc=')) noteRefs.add((attr(tag, 'ref') ?? '').toUpperCase());
      }
    }

    const groups = new Map<string, SheetpaneError[]>();
    for (const { anchor, e } of items) (groups.get(anchor) ?? groups.set(anchor, []).get(anchor)!).push(e);

    // root id → the thread: root entry, then replies in order. First the file's own threads as they are.
    const threads = new Map<string, Entry[]>();
    for (const t of kept) if (foreignRoot.get(t.ref)?.id === t.id) threads.set(t.id, [t]);
    const strays: Entry[] = []; // replies to a root this review rewrites (an Excel user answered an exported thread)
    for (const t of kept) {
      if (threads.has(t.id)) continue;
      const root = foreignRoot.get(t.ref);
      if (root && t.parentId === root.id) threads.get(root.id)!.push(t);
      else strays.push(t);
    }
    const touched = new Set<string>(); // anchors whose thread this export writes
    for (const [anchor, errs] of groups) {
      const root = foreignRoot.get(anchor);
      if (!root && noteRefs.has(anchor)) { for (const e of errs) report.skipped.push({ id: e.id, reason: 'note-at-cell' }); continue; }
      const mine = errs.flatMap((e) => entriesOf(e, anchor, o));
      for (const e of errs) { report.written.push(e.id); people.add(authorOf(e)); }
      touched.add(anchor);
      if (root) {
        // the cell already holds someone's thread: the review joins it as replies
        for (const m of mine) m.parentId = root.id;
        threads.get(root.id)!.push(...mine);
      } else {
        const [first, ...rest] = mine;
        first!.done = errs.every((e) => e.status === 'resolved');
        for (const m of rest) m.parentId = first!.id;
        threads.set(first!.id, [first!, ...rest]);
      }
    }
    if (!touched.size) continue;
    const rootAt = new Map([...threads.values()].map((t) => [t[0]!.ref, t[0]!]));
    for (const t of strays) {
      const root = rootAt.get(t.ref);
      if (!root) { threads.set(t.id, [t]); continue; } // no root at its cell: kept where it was
      if (t.parentId !== root.id) t.xml = t.xml!.replace(openTag(t.xml!), withAttr(openTag(t.xml!), 'parentId', root.id));
      threads.get(root.id)!.push(t);
    }

    // Every part is built first, then written: a part this code cannot read leaves the file as it was.
    let tcXml: string, cmXml: string, vmlXml: string | undefined;
    const legacy = new Map<string, { rootId: string; entries: { text: string }[] }>();
    try {
      // 1 · xl/threadedComments/threadedCommentN.xml
      const P = threadedXml ? /<(\w+:)?ThreadedComments\b/.exec(threadedXml)?.[1] ?? '' : '';
      const ser = (t: Entry) => t.xml ?? `<${P}threadedComment ref="${t.ref}" dT="${t.dT}" personId="${t.personId}" id="${t.id}"${t.parentId ? ` parentId="${t.parentId}"` : ''}${t.done ? ' done="1"' : ''}><${P}text>${escText(t.text)}</${P}text></${P}threadedComment>`;
      const pos = (r: string) => parseCellRef(r) ?? { row: Infinity, col: Infinity };
      const ordered = [...threads.values()].sort((a, b) => pos(a[0]!.ref).row - pos(b[0]!.ref).row || pos(a[0]!.ref).col - pos(b[0]!.ref).col);
      // the part's own extLst (after the last thread) is kept; a thread's own extLst lives inside its element
      const lastEnd = threadedXml ? Math.max(0, ...[...threadedXml.matchAll(elementRe('threadedComment'))].map((m) => m.index + m[0].length)) : 0;
      const ext = threadedXml && /<(?:\w+:)?extLst\b[\s\S]*<\/(?:\w+:)?extLst>/.exec(threadedXml.slice(lastEnd));
      const body = ordered.flat().map(ser).join('') + (ext ? ext[0] : '');
      tcXml = threadedXml ? fillContainer(threadedXml, 'ThreadedComments', body) : `${XML_DECL}<ThreadedComments xmlns="${NS_TC}" xmlns:x="${NS_MAIN}">${body}</ThreadedComments>`;
      // 2 · xl/commentsN.xml — the placeholder for each thread this export touched
      for (const t of ordered) if (touched.has(t[0]!.ref)) legacy.set(t[0]!.ref, { rootId: t[0]!.id, entries: t });
      cmXml = writeLegacy(commentsXml, legacy);
      // 3 · the VML the sheet already has, extended
      const existingVml = vmlPath && patch.has(vmlPath) ? await patch.readText(vmlPath) : undefined;
      vmlXml = existingVml === undefined ? undefined : extendVml(existingVml, [...legacy.keys()].map((r) => parseCellRef(r)!));
      if (vmlXml === undefined && !/<(?:\w+:)?worksheet\b/.test(sheetXml)) throw spError('SP-5802', `sheetpane comments: sheet "${sheet}" is not a worksheet`);
    } catch (err) {
      console.error(spMessage('SP-5803', `sheetpane comments: sheet "${sheet}" not written`), err);
      const ids = new Set(items.map(({ e }) => e.id));
      report.written = report.written.filter((id) => !ids.has(id));
      for (const id of ids) if (!report.skipped.some((x) => x.id === id)) report.skipped.push({ id, reason: 'unreadable-part' });
      continue;
    }

    const tcPath = threadedPath ?? freeName((p) => patch.has(p), 'xl/threadedComments/threadedComment', '.xml');
    patch.write(tcPath, tcXml);
    if (!threadedPath) {
      await patch.addRelationship(sheetPath, REL.threaded, relativeTarget(sheetPath, tcPath));
      await patch.setContentType(tcPath, CT.threaded);
    }
    const cmPath = commentsPath ?? freeName((p) => patch.has(p), 'xl/comments', '.xml');
    patch.write(cmPath, cmXml);
    if (!commentsPath) {
      await patch.addRelationship(sheetPath, REL.comments, relativeTarget(sheetPath, cmPath));
      await patch.setContentType(cmPath, CT.comments);
    }
    // 3 · xl/drawings/vmlDrawingN.vml and <legacyDrawing>
    if (vmlXml !== undefined) {
      patch.write(vmlPath!, vmlXml);
    } else {
      const used = await usedIdBlocks(patch);
      let block = 1;
      while (used.has(block)) block++;
      const vp = freeName((p) => patch.has(p), 'xl/drawings/vmlDrawing', '.vml');
      patch.write(vp, newVml(block, [...legacy.keys()].map((r) => parseCellRef(r)!)));
      await patch.setDefaultContentType('vml', CT.vml);
      const rId = await patch.addRelationship(sheetPath, REL.vml, relativeTarget(sheetPath, vp));
      if (legacyTag) sheetXml = sheetXml.replace(legacyTag[0], withAttr(legacyTag[0], `${/\s(\w+):id\s*=/.exec(legacyTag[0])?.[1] ?? 'r'}:id`, rId));
      else sheetXml = addLegacyDrawing(sheetXml, rId);
      patch.write(sheetPath, sheetXml);
    }
  }

  // 4 · xl/persons/person.xml — one person per author, added to the list the file has
  if (people.size) await writePersons(patch, [...people]);
  return report;
}

async function writePersons(patch: PatchContext, names: string[]): Promise<void> {
  const wb = patch.workbookPath();
  const rel = parseRels(await patch.readText(patch.relsPathOf(wb))).find((r) => r.type === REL.person && !r.external);
  const path = rel ? resolveTarget(wb, rel.target) : 'xl/persons/person.xml';
  const xml = rel ? await patch.readText(path) : undefined;
  const have = new Set([...(xml ?? '').matchAll(/<(?:\w+:)?person\b[^>]*>/g)].map((m) => attr(m[0], 'id')));
  const P = xml ? /<(\w+:)?personList\b/.exec(xml)?.[1] ?? '' : '';
  const add = names.filter((n) => !have.has(personGuid(n)))
    .map((n) => `<${P}person displayName="${escAttr(cleanXml(n))}" id="${personGuid(n)}" userId="${escAttr(cleanXml(n))}" providerId="None"/>`).join('');
  if (xml) {
    if (!add) return;
    const close = new RegExp(`</${P}personList>`);
    patch.write(path, close.test(xml) ? xml.replace(close, `${add}</${P}personList>`) : xml.replace(/<((?:\w+:)?personList\b[^>]*?)\s*\/>/, `<$1>${add}</${P}personList>`));
    return;
  }
  patch.write(path, `${XML_DECL}<personList xmlns="${NS_TC}" xmlns:x="${NS_MAIN}">${add}</personList>`);
  await patch.addRelationship(wb, REL.person, relativeTarget(wb, path));
  await patch.setContentType(path, CT.person);
}
