// Small hand-written workbooks: each sheet's cells and `<dataValidations>`, zipped
// with @sheetpane/export's writeZip — no fixture generator, no extra dependency.
import { writeZip } from '@sheetpane/export';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
const X14 = 'http://schemas.microsoft.com/office/spreadsheetml/2009/9/main';
const XM = 'http://schemas.microsoft.com/office/excel/2006/main';

export type V = string | number | boolean | null;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** `{ A1: 5, B1: 'x' }` → `<sheetData>`. */
function sheetData(cells: Record<string, V>): string {
  const rows = new Map<number, string[]>();
  const sorted = Object.entries(cells).sort(([a], [b]) => {
    const pa = /([A-Z]+)(\d+)/.exec(a)!, pb = /([A-Z]+)(\d+)/.exec(b)!;
    return Number(pa[2]) - Number(pb[2]) || pa[1]!.length - pb[1]!.length || pa[1]!.localeCompare(pb[1]!);
  });
  for (const [ref, v] of sorted) {
    if (v === null) continue;
    const r = Number(/\d+/.exec(ref)![0]);
    const xml = typeof v === 'number' ? `<c r="${ref}"><v>${v}</v></c>` : typeof v === 'boolean' ? `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
    (rows.get(r) ?? rows.set(r, []).get(r)!).push(xml);
  }
  return `<sheetData>${[...rows].sort(([a], [b]) => a - b).map(([r, cs]) => `<row r="${r}">${cs.join('')}</row>`).join('')}</sheetData>`;
}

export interface Dv {
  sqref: string;
  type: string;
  operator?: string;
  allowBlank?: boolean;
  showErrorMessage?: boolean;
  errorTitle?: string;
  error?: string;
  f1?: string;
  f2?: string;
}

const attrs = (d: Dv) => [`type="${d.type}"`, d.operator ? `operator="${d.operator}"` : '', d.allowBlank ? 'allowBlank="1"' : '', d.showErrorMessage === false ? 'showErrorMessage="0"' : 'showErrorMessage="1"', d.errorTitle ? `errorTitle="${esc(d.errorTitle)}"` : '', d.error ? `error="${esc(d.error)}"` : ''].filter(Boolean).join(' ');

/** The classic `<dataValidation>` element. */
export function dv(d: Dv): string {
  return `<dataValidation ${attrs(d)} sqref="${d.sqref}">${d.f1 !== undefined ? `<formula1>${esc(d.f1)}</formula1>` : ''}${d.f2 !== undefined ? `<formula2>${esc(d.f2)}</formula2>` : ''}</dataValidation>`;
}
/** The x14 form Excel writes when a list reads another sheet. */
export function x14(d: Dv): string {
  return `<x14:dataValidation ${attrs(d)}>${d.f1 !== undefined ? `<x14:formula1><xm:f>${esc(d.f1)}</xm:f></x14:formula1>` : ''}${d.f2 !== undefined ? `<x14:formula2><xm:f>${esc(d.f2)}</xm:f></x14:formula2>` : ''}<xm:sqref>${d.sqref}</xm:sqref></x14:dataValidation>`;
}

/** An Excel table on a sheet (W-61): its name, range (header row first) and column names. */
export interface TableSpec { name: string; ref: string; columns: string[]; totals?: boolean }
export interface SheetSpec { name: string; cells: Record<string, V>; rules?: Dv[]; x14?: Dv[]; tables?: TableSpec[] }

export async function workbook(sheets: SheetSpec[], definedNames: { name: string; formula: string; localSheetId?: number }[] = []): Promise<Uint8Array> {
  const enc = (s: string) => new TextEncoder().encode(s);
  const parts: Record<string, string> = {
    '[Content_Types].xml': `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>`,
    '_rels/.rels': `<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${NS}" xmlns:r="${R}"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${definedNames.length ? `<definedNames>${definedNames.map((n) => `<definedName name="${n.name}"${n.localSheetId !== undefined ? ` localSheetId="${n.localSheetId}"` : ''}>${esc(n.formula)}</definedName>`).join('')}</definedNames>` : ''}</workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${PR}">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
  };
  let tableId = 0;
  sheets.forEach((s, i) => {
    const tables = (s.tables ?? []).map((t) => {
      const id = ++tableId;
      parts[`xl/tables/table${id}.xml`] = `<table xmlns="${NS}" id="${id}" name="${t.name}" displayName="${t.name}" ref="${t.ref}"${t.totals ? ' totalsRowCount="1"' : ''}><tableColumns count="${t.columns.length}">${t.columns.map((c, k) => `<tableColumn id="${k + 1}" name="${esc(c)}"/>`).join('')}</tableColumns><tableStyleInfo name="TableStyleMedium2" showRowStripes="1"/></table>`;
      return id;
    });
    if (tables.length) parts[`xl/worksheets/_rels/sheet${i + 1}.xml.rels`] = `<Relationships xmlns="${PR}">${tables.map((id, k) => `<Relationship Id="rId${k + 1}" Type="${R}/table" Target="../tables/table${id}.xml"/>`).join('')}</Relationships>`;
    const tableParts = tables.length ? `<tableParts count="${tables.length}">${tables.map((_, k) => `<tablePart r:id="rId${k + 1}"/>`).join('')}</tableParts>` : '';
    const classic = s.rules?.length ? `<dataValidations count="${s.rules.length}">${s.rules.map(dv).join('')}</dataValidations>` : '';
    const ext = s.x14?.length ? `<extLst><ext uri="{CCE6A557-97BC-4b89-ADB6-D9C93CAAB3DF}" xmlns:x14="${X14}"><x14:dataValidations count="${s.x14.length}" xmlns:xm="${XM}">${s.x14.map(x14).join('')}</x14:dataValidations></ext></extLst>` : '';
    parts[`xl/worksheets/sheet${i + 1}.xml`] = `<worksheet xmlns="${NS}" xmlns:r="${R}">${sheetData(s.cells)}${classic}${tableParts}${ext}</worksheet>`;
  });
  return writeZip(Object.entries(parts).map(([name, s]) => ({ name, data: enc(s) })));
}

export const fromDataUrl = (u: string) => Uint8Array.from(atob(u.slice(u.indexOf(',') + 1)), (c) => c.charCodeAt(0));
export const frame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
