import { strToU8, zipSync } from 'fflate';

export const fromDataUrl = (u: string) => Uint8Array.from(atob(u.slice(u.indexOf(',') + 1)), (c) => c.charCodeAt(0));

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
export const XML = { NS, R };

/** A hand-written package: one sheet unless `sheets` says otherwise; `extra` adds or replaces parts. */
export function pkg(sheetXml: string, extra: Record<string, string> = {}, o: { mainType?: string; sheets?: string } = {}): Uint8Array {
  const parts: Record<string, string> = {
    '[Content_Types].xml': `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${o.mainType ?? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'}"/></Types>`,
    '_rels/.rels': `<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${NS}" xmlns:r="${R}"><sheets>${o.sheets ?? '<sheet name="Data" sheetId="1" r:id="rId1"/>'}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': sheetXml,
    ...extra,
  };
  return zipSync(Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, strToU8(v)])));
}
