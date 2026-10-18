// toXlsx: a plain Workbook object in, a new .xlsx out (export verdict decisions 1, 5–7).
import { CT, NS_CT, NS_MAIN, NS_PKG_REL, NS_R, REL, XML_DECL } from './ooxml.js';
import { cellRef, colName, rangeRef, type RangePos } from './refs.js';
import type { Cell, Sheet, Workbook } from './types.js';
import { checkWorkbook } from './validate.js';
import { cleanXmlChars, escapeAttr, tElement, utf8 } from './xml.js';
import { writeZip, type WriteOptions } from './zip.js';

/** Options for `toXlsx`: the ZIP compression, and a report of stripped characters. */
export interface ToXlsxOptions extends WriteOptions {
  /** Called with every `Sheet!A1` whose text lost characters XML forbids. */
  onStripped?: (refs: string[]) => void;
}

/** Style 1 is the one format sheetpane keeps: merge-and-centre. */
export const STYLES_XML = `${XML_DECL}<styleSheet xmlns="${NS_MAIN}"><fonts count="1"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

/** One `<c>` element for a value; `undefined` for an empty, unstyled cell. */
export function cellXml(ref: string, v: Cell, style: number | string | undefined, prefix = '', stripped?: () => void): string | undefined {
  const s = style !== undefined && style !== '0' && style !== 0 ? ` s="${style}"` : '';
  const P = prefix;
  if (v === null || v === undefined) return s ? `<${P}c r="${ref}"${s}/>` : undefined;
  if (typeof v === 'number') return `<${P}c r="${ref}"${s}><${P}v>${Object.is(v, -0) ? 0 : v}</${P}v></${P}c>`;
  if (typeof v === 'boolean') return `<${P}c r="${ref}"${s} t="b"><${P}v>${v ? 1 : 0}</${P}v></${P}c>`;
  const { text, stripped: lost } = cleanXmlChars(v);
  if (lost) stripped?.();
  return `<${P}c r="${ref}"${s} t="inlineStr"><${P}is>${tElement(text, P)}</${P}is></${P}c>`;
}

function sheetXml(sheet: Sheet, merges: RangePos[], selected: boolean, stripped: string[]): string {
  const centred = new Set(merges.map((m) => `${m.top},${m.left}`));
  let maxRow = -1, maxCol = -1;
  const rows: string[] = [];
  sheet.rows.forEach((row, r) => {
    const cells: string[] = [];
    row.forEach((v, c) => {
      const ref = cellRef(r, c);
      const x = cellXml(ref, v ?? null, centred.has(`${r},${c}`) ? 1 : undefined, '', () => stripped.push(`${sheet.name}!${ref}`));
      if (x) { cells.push(x); maxCol = Math.max(maxCol, c); }
    });
    for (const m of merges) if (m.top === r && (row[m.left] ?? null) === null) {
      cells.push(`<c r="${cellRef(r, m.left)}" s="1"/>`);
      maxCol = Math.max(maxCol, m.left);
    }
    if (cells.length) {
      cells.sort((a, b) => colOf(a) - colOf(b));
      rows.push(`<row r="${r + 1}">${cells.join('')}</row>`);
      maxRow = r;
    }
  });
  for (const m of merges) { maxRow = Math.max(maxRow, m.bottom); maxCol = Math.max(maxCol, m.right); }
  const dim = maxRow < 0 ? 'A1' : rangeRef({ top: 0, left: 0, bottom: maxRow, right: Math.max(maxCol, 0) });
  const cols = (sheet.columnWidths ?? [])
    .map((w, i) => (Number.isFinite(w) && w > 0 ? `<col min="${i + 1}" max="${i + 1}" width="${Math.min(w, 255)}" customWidth="1"/>` : ''))
    .join('');
  const pane = paneXml(sheet.freeze);
  const view = `<sheetViews><sheetView workbookViewId="0"${selected ? ' tabSelected="1"' : ''}${pane ? `>${pane}</sheetView>` : '/>'}</sheetViews>`;
  const mc = merges.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${rangeRef(m)}"/>`).join('')}</mergeCells>` : '';
  return `${XML_DECL}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_R}"><dimension ref="${dim}"/>${view}<sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${rows.join('')}</sheetData>${mc}</worksheet>`;
}

/** `<pane>` for frozen rows/columns; `topLeftCell` is required or Excel ignores the pane (W-24). */
export function paneXml(f: { rows: number; cols: number } | undefined, prefix = ''): string {
  if (!f || (f.rows <= 0 && f.cols <= 0)) return '';
  const active = f.rows > 0 && f.cols > 0 ? 'bottomRight' : f.rows > 0 ? 'bottomLeft' : 'topRight';
  return `<${prefix}pane${f.cols > 0 ? ` xSplit="${f.cols}"` : ''}${f.rows > 0 ? ` ySplit="${f.rows}"` : ''} topLeftCell="${cellRef(Math.max(0, f.rows), Math.max(0, f.cols))}" activePane="${active}" state="frozen"/>`;
}

function colOf(cellTag: string): number {
  const m = /r="([A-Z]+)/.exec(cellTag)!;
  let n = 0;
  for (const ch of m[1]!) n = n * 26 + ch.charCodeAt(0) - 64;
  return n;
}

/**
 * Builds a new .xlsx from the object: text as inline strings, numbers and booleans typed, merges centred.
 * The same input gives the same bytes in `store` mode.
 *
 * @param book - The workbook; it is checked first and an `ExportError` names what is wrong.
 * @param o - Compression and the `onStripped` report.
 * @returns The .xlsx file's bytes.
 * @example
 * ```ts
 * import { toXlsx } from '@sheetpane/export';
 * const xlsx = await toXlsx({
 *   sheets: [{ name: 'Sales', rows: [['Region', 'Total'], ['North', 1200]], merges: ['A1:B1'] }],
 * });
 * ```
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0103_EXPORT.md
 */
export async function toXlsx(book: Workbook, o: ToXlsxOptions = {}): Promise<Uint8Array> {
  const merges = checkWorkbook(book);
  const active = book.sheets.findIndex((s) => !s.hidden);
  const stripped: string[] = [];
  const n = book.sheets.length;
  const files = [
    { name: '[Content_Types].xml', data: utf8(`${XML_DECL}<Types xmlns="${NS_CT}"><Default Extension="rels" ContentType="${CT.rels}"/><Default Extension="xml" ContentType="${CT.xml}"/><Override PartName="/xl/workbook.xml" ContentType="${CT.workbook}"/>${book.sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${CT.worksheet}"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="${CT.styles}"/></Types>`) },
    { name: '_rels/.rels', data: utf8(`${XML_DECL}<Relationships xmlns="${NS_PKG_REL}"><Relationship Id="rId1" Type="${REL.officeDocument}" Target="xl/workbook.xml"/></Relationships>`) },
    { name: 'xl/workbook.xml', data: utf8(`${XML_DECL}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_R}"><bookViews><workbookView activeTab="${active}"/></bookViews><sheets>${book.sheets.map((s, i) => `<sheet name="${escapeAttr(s.name)}" sheetId="${i + 1}"${s.hidden ? ' state="hidden"' : ''} r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`) },
    { name: 'xl/_rels/workbook.xml.rels', data: utf8(`${XML_DECL}<Relationships xmlns="${NS_PKG_REL}">${book.sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL.worksheet}" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${n + 1}" Type="${REL.styles}" Target="styles.xml"/></Relationships>`) },
    ...book.sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: utf8(sheetXml(s, merges[i]!, i === active, stripped)) })),
    { name: 'xl/styles.xml', data: utf8(STYLES_XML) },
  ];
  if (stripped.length) o.onStripped?.(stripped);
  return writeZip(files, o);
}

export { colName };
