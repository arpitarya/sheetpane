// Hand-written workbooks zipped with @sheetpane/export's writeZip — a styles part
// with real formats to clone, rows with spans, a <dimension>, a styled column —
// and the readers the tests need. No fixture generator, no extra dependency.
import { inflateEntry, readZip, writeZip } from '@sheetpane/export';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A cell: a value, or a value with a style index. */
export type V = string | number | { v: string | number; s: number };
export interface SheetSpec { name: string; cells: Record<string, V>; rowAttrs?: Record<number, string>; head?: string; tail?: string; spans?: boolean }
export interface BookSpec { sheets: SheetSpec[]; styles?: string | null; definedNames?: string }

/** Formats 0 (plain), 1 (a percent, centred) and 2 (bold, a border) — so a clone shows what it kept. */
export const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="${NS}"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.00%"/></numFmts><fonts count="2"><font><sz val="11"/></font><font><b/><sz val="11"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

const pos = (ref: string) => { const m = /^([A-Z]+)(\d+)$/.exec(ref)!; return { row: Number(m[2]), col: [...m[1]!].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) }; };

function sheetData(s: SheetSpec): string {
  const rows = new Map<number, { col: number; xml: string }[]>();
  for (const [ref, cell] of Object.entries(s.cells)) {
    const { v, s: st } = typeof cell === 'object' ? cell : { v: cell, s: undefined };
    const sa = st === undefined ? '' : ` s="${st}"`;
    const xml = typeof v === 'number' ? `<c r="${ref}"${sa}><v>${v}</v></c>` : `<c r="${ref}"${sa} t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
    const p = pos(ref);
    (rows.get(p.row) ?? rows.set(p.row, []).get(p.row)!).push({ col: p.col, xml });
  }
  for (const r of Object.keys(s.rowAttrs ?? {})) if (!rows.has(Number(r))) rows.set(Number(r), []);
  return `<sheetData>${[...rows].sort(([a], [b]) => a - b).map(([r, cs]) => {
    cs.sort((a, b) => a.col - b.col);
    const spans = s.spans && cs.length ? ` spans="${cs[0]!.col}:${cs[cs.length - 1]!.col}"` : '';
    const attrs = s.rowAttrs?.[r] ? ` ${s.rowAttrs[r]}` : '';
    return cs.length ? `<row r="${r}"${spans}${attrs}>${cs.map((c) => c.xml).join('')}</row>` : `<row r="${r}"${attrs}/>`;
  }).join('')}</sheetData>`;
}

/** A workbook from a spec, with a styles part unless `styles: null`. */
export async function workbook(spec: BookSpec): Promise<Uint8Array> {
  const ct: string[] = [`<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`];
  const rels = spec.sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`);
  const parts: Record<string, string> = {
    '_rels/.rels': `<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="${NS}" xmlns:r="${R}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${spec.sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${spec.definedNames ?? ''}<calcPr calcId="191029"/></workbook>`,
  };
  if (spec.styles !== null) {
    parts['xl/styles.xml'] = spec.styles ?? STYLES;
    rels.push(`<Relationship Id="rId${spec.sheets.length + 1}" Type="${R}/styles" Target="styles.xml"/>`);
    ct.push(`<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`);
  }
  parts['xl/_rels/workbook.xml.rels'] = `<Relationships xmlns="${PR}">${rels.join('')}</Relationships>`;
  spec.sheets.forEach((s, i) => {
    parts[`xl/worksheets/sheet${i + 1}.xml`] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="${NS}" xmlns:r="${R}">${s.head ?? ''}${sheetData(s)}${s.tail ?? ''}</worksheet>`;
    ct.push(`<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
  });
  parts['[Content_Types].xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${ct.join('')}</Types>`;
  const enc = (t: string) => new TextEncoder().encode(t);
  return writeZip(Object.entries(parts).map(([name, t]) => ({ name, data: enc(t) })));
}

/** Every part of a package, as text. */
export async function unzip(bytes: Uint8Array): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const e of readZip(bytes)) out.set(e.name, new TextDecoder().decode(await inflateEntry(bytes, e, { maxEntrySize: 1e8, maxTotalSize: 1e9 })));
  return out;
}

/** Parses XML; throws with the parser's message when it is not well-formed. */
export function parseXml(xml: string, name = 'part'): Document {
  const d = new DOMParser().parseFromString(xml, 'application/xml');
  const err = d.getElementsByTagName('parsererror')[0];
  if (err) throw new Error(`${name} is not well-formed: ${err.textContent}`);
  return d;
}

/** Every `<c>` element of a worksheet part, by its `r`. */
export function cellsOf(xml: string): Map<string, string> {
  return new Map([...xml.matchAll(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)].map((m) => [/\br="([A-Z]+\d+)"/.exec(m[0])![1]!, m[0]]));
}

/** A cell's `s`, or 0. */
export const styleOf = (cellXml: string | undefined): number => Number(/\ss="(\d+)"/.exec(cellXml ?? '')?.[1] ?? 0);

export const blobBytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
