// The Review sheet (W-59 DoD 2): a new worksheet part, its relationship and
// content type, a <sheet> in the workbook, and a defined name that marks it so a
// host can skip it when the file comes back. Every cell is an inline string, so
// sharedStrings is never touched. Links are internal hyperlinks (`location`),
// which need no relationship.
import { cellRef, escapeAttr, escapeText, getAttr, parseRels, relsPathOf, resolveTarget, setAttr, spError, unescapeXml } from '@sheetpane/export';
import { COLUMNS, WIDTHS, quoteSheet, type ReviewRow } from './rows.js';
import {
  CT_WORKSHEET, NS_MAIN, NS_R, REL_WORKSHEET, XML_DECL, freeName, inlineText, prefixOf, relativeTarget, type PatchContext,
} from './xml.js';

/** The defined name that marks the Review sheet: workbook-scoped, hidden, over the table (`'Review'!$A$1:$M$4`). */
export const REVIEW_NAME = '_sheetpane_review';

/** Characters a sheet name may not hold. */
const BAD = /[[\]:*?/\\]/g;

/**
 * A usable sheet name from what the host asked for: forbidden characters dropped, apostrophes trimmed from the ends,
 * at most 31 characters; `Review` when nothing is left.
 *
 * @param name - The name asked for.
 * @returns A name Excel accepts.
 */
export function cleanSheetName(name: string): string {
  const s = name.replace(BAD, '').replace(/^'+|'+$/g, '').trim().slice(0, 31).replace(/'+$/, '');
  return s || 'Review';
}

/**
 * A name no sheet has, compared as Excel compares them (ignoring case): `Review`, else `Review (2)`, `Review (3)`…
 * trimmed so the whole stays within 31 characters. A user's sheet is never overwritten.
 *
 * @param base - The clean name.
 * @param taken - The workbook's sheet names.
 * @returns A free name.
 */
export function uniqueSheetName(base: string, taken: readonly string[]): string {
  const have = new Set(taken.map((t) => t.toLowerCase()));
  if (!have.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const tail = ` (${n})`;
    const name = base.slice(0, 31 - tail.length).replace(/'+$/, '') + tail;
    if (!have.has(name.toLowerCase())) return name;
  }
}

/** The sheet a formula like `'Q3 ''x'''!$A$1:$M$9` (or `Review!A1`) points at. */
export function sheetOfFormula(formula: string): string | undefined {
  const f = formula.trim().replace(/^=/, '');
  const q = /^'((?:[^']|'')+)'!/.exec(f);
  if (q) return q[1]!.replace(/''/g, "'");
  const p = /^([^'!]+)!/.exec(f);
  return p ? p[1] : undefined;
}

/**
 * Which sheet of a workbook is a Review sheet sheetpane wrote, by its defined name — so a host can leave it out
 * when the annotated file is uploaded again.
 *
 * @param book - A workbook as `@sheetpane/import` reads it (its `definedNames` and `sheets`).
 * @returns The Review sheet's name, or undefined when the file has none.
 * @example
 * ```ts
 * import { read } from '@sheetpane/import';
 * import { reviewSheetOf } from '@sheetpane/review';
 *
 * const book = await read(bytes, { name: 'holdings.xlsx' });
 * const skip = reviewSheetOf(book); // 'Review', or undefined
 * const data = book.sheets.filter((s) => s.name !== skip);
 * ```
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0123_REVIEW.md
 */
export function reviewSheetOf(book: { definedNames: readonly { name: string; formula: string }[]; sheets: readonly { name: string }[] }): string | undefined {
  const d = book.definedNames.find((n) => n.name.toLowerCase() === REVIEW_NAME);
  const name = d && sheetOfFormula(d.formula);
  return name !== undefined && book.sheets.some((s) => s.name === name) ? name : undefined;
}

/** The worksheet XML: a frozen header row, column widths, one row per error, the Cell column's links. */
export function sheetXml(rows: readonly ReviewRow[], headerStyle: number | undefined): string {
  const last = cellRef(rows.length, COLUMNS.length - 1);
  const cell = (r: number, c: number, text: string, s?: number) => (text === '' ? '' : `<c r="${cellRef(r, c)}"${s ? ` s="${s}"` : ''} t="inlineStr">${inlineText(text)}</c>`);
  const head = `<row r="1">${COLUMNS.map((h, c) => cell(0, c, h, headerStyle)).join('')}</row>`;
  const body = rows.map((row, i) => `<row r="${i + 2}">${row.cells.map((t, c) => cell(i + 1, c, t)).join('')}</row>`).join('');
  const links = rows.map((row, i) => (row.link ? `<hyperlink ref="${cellRef(i + 1, 2)}" location="${escapeAttr(row.link)}" display="${escapeAttr(row.cells[2]!)}"/>` : '')).join('');
  const cols = WIDTHS.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  return `${XML_DECL}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_R}"><dimension ref="A1:${last}"/>`
    + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>'
    + `<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${head}${body}</sheetData>`
    + (links ? `<hyperlinks>${links}</hyperlinks>` : '')
    + '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>';
}

/** Puts the marker name in the workbook part, replacing an earlier one; `<definedNames>` is created in schema position when missing. */
export function setMarker(wb: string, formula: string): string {
  const P = prefixOf(wb, 'workbook');
  const el = `<${P}definedName name="${REVIEW_NAME}" hidden="1">${escapeText(formula)}</${P}definedName>`;
  let out = wb.replace(new RegExp(`<(?:\\w+:)?definedName\\b[^>]*\\bname\\s*=\\s*"${REVIEW_NAME}"[^>]*?(?:/>|>[\\s\\S]*?</(?:\\w+:)?definedName>)`, 'gi'), '');
  const self = /<(?:\w+:)?definedNames\b[^>]*\/>/.exec(out);
  if (self) return out.replace(self[0], `<${P}definedNames>${el}</${P}definedNames>`);
  const close = new RegExp(`</(?:\\w+:)?definedNames>`).exec(out);
  if (close) return out.slice(0, close.index) + el + out.slice(close.index);
  // CT_Workbook: … sheets, functionGroups, externalReferences, definedNames …
  for (const name of ['externalReferences', 'functionGroups', 'sheets']) {
    const m = new RegExp(`</(?:\\w+:)?${name}>|<(?:\\w+:)?${name}\\b[^>]*/>`).exec(out);
    if (m) { const at = m.index + m[0].length; return `${out.slice(0, at)}<${P}definedNames>${el}</${P}definedNames>${out.slice(at)}`; }
  }
  throw spError('SP-5001', 'sheetpane review: the workbook part has no <sheets>');
}

/** Adds `<sheet name sheetId r:id>` at the end of `<sheets>`, binding the relationships namespace on the root when missing. */
export function addSheet(wb: string, name: string, rId: string): string {
  const root = /<(\w+:)?workbook\b[^>]*>/.exec(wb);
  if (!root) throw spError('SP-5001', 'sheetpane review: not a workbook part');
  const P = root[1] ?? '';
  let out = wb, rp = 'r';
  const bound = [...root[0].matchAll(/\sxmlns:([\w.-]+)\s*=\s*"([^"]*)"/g)].find((m) => m[2] === NS_R);
  if (bound) rp = bound[1]!;
  else { if (/\sxmlns:r\s*=/.test(root[0])) rp = 'spr'; out = out.replace(root[0], setAttr(root[0], `xmlns:${rp}`, NS_R)); }
  const ids = [...out.matchAll(/<(?:\w+:)?sheet\b[^>]*>/g)].map((m) => Number(getAttr(m[0], 'sheetId') ?? 0)).filter(Number.isFinite);
  const el = `<${P}sheet name="${escapeAttr(name)}" sheetId="${Math.max(0, ...ids) + 1}" ${rp}:id="${rId}"/>`;
  const close = /<\/(?:\w+:)?sheets>/.exec(out);
  if (close) return out.slice(0, close.index) + el + out.slice(close.index);
  const self = /<(?:\w+:)?sheets\b[^>]*\/>/.exec(out);
  if (self) return out.replace(self[0], `<${P}sheets>${el}</${P}sheets>`);
  throw spError('SP-5001', 'sheetpane review: the workbook part has no <sheets>');
}

/**
 * Writes the Review sheet. An earlier Review sheet this plugin wrote (the marker names it, and it has no parts of
 * its own) is rewritten in place; otherwise a new sheet is added last, under a name no sheet has.
 *
 * @param patch - The export's package.
 * @param rows - The rows, in order.
 * @param o - The name asked for and the header's style index (none: unstyled).
 * @returns The name and part of the sheet written.
 */
export async function writeReviewSheet(patch: PatchContext, rows: readonly ReviewRow[], o: { name: string; headerStyle?: number | undefined }): Promise<{ name: string; path: string }> {
  const wbPath = patch.workbookPath();
  const wb = await patch.readText(wbPath);
  if (wb === undefined) throw spError('SP-5001', 'sheetpane review: no workbook part');
  const xml = sheetXml(rows, o.headerStyle);
  const range = `$A$1:$${cellRef(rows.length, COLUMNS.length - 1).replace(/(\d+)$/, '$$$1')}`;

  // an earlier export's Review sheet, found by its marker: replaced, not repeated
  const marker = [...wb.matchAll(/<(?:\w+:)?definedName\b[^>]*>([\s\S]*?)<\/(?:\w+:)?definedName>/g)].find((m) => (getAttr(m[0], 'name') ?? '').toLowerCase() === REVIEW_NAME);
  const earlier = marker && sheetOfFormula(unescapeXml(marker[1]!));
  const earlierPath = earlier !== undefined ? patch.sheetPath(earlier) : undefined;
  if (earlier !== undefined && earlierPath && !(await hasRelationships(patch, earlierPath))) {
    const next = setMarker(wb, `${quoteSheet(earlier)}!${range}`);
    patch.write(earlierPath, xml);
    patch.write(wbPath, next);
    return { name: earlier, path: earlierPath };
  }

  const name = uniqueSheetName(cleanSheetName(o.name), patch.sheetNames());
  setMarker(addSheet(wb, name, 'rId0'), ''); // the workbook part is checked before anything is written
  const path = freeName((p) => patch.has(p), 'xl/worksheets/sheet', '.xml');
  patch.write(path, xml);
  const rId = await patch.addRelationship(wbPath, REL_WORKSHEET, relativeTarget(wbPath, path));
  await patch.setContentType(path, CT_WORKSHEET);
  patch.write(wbPath, setMarker(addSheet(wb, name, rId), `${quoteSheet(name)}!${range}`));
  return { name, path };
}

/** Whether a part has any relationship of its own (a Review sheet someone gave comments or a drawing in Excel). */
async function hasRelationships(patch: PatchContext, part: string): Promise<boolean> {
  const rels = await patch.readText(relsPathOf(part));
  return !!rels && parseRels(rels).length > 0;
}

/** The workbook's styles part, through its relationship. */
export async function stylesPath(patch: PatchContext): Promise<string | undefined> {
  const wb = patch.workbookPath();
  const rels = await patch.readText(relsPathOf(wb));
  const r = rels && parseRels(rels).find((x) => x.type.endsWith('/styles') && x.mode !== 'External');
  return r ? resolveTarget(wb, r.target) : undefined;
}
