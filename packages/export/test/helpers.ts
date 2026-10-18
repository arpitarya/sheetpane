// Test helpers: an independent ZIP reader (fflate) and reader of workbooks (ExcelJS).
import { unzipSync, strFromU8, zipSync, strToU8 } from 'fflate';
import ExcelJS from 'exceljs';

export function unzipText(bytes: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(unzipSync(bytes))) out[k] = strFromU8(v);
  return out;
}

/** Builds an .xlsx from part texts with fflate — for hand-written edge cases. */
export function zipParts(parts: Record<string, string>): Uint8Array {
  return zipSync(Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, strToU8(v)])));
}

export async function readBack(bytes: Uint8Array) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  return wb;
}

export function values(ws: ExcelJS.Worksheet): (string | number | boolean | null)[][] {
  const rows: (string | number | boolean | null)[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, r) => {
    const out: (string | number | boolean | null)[] = [];
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      const v = cell.value as unknown;
      out[c - 1] = v === null || v === undefined ? null : typeof v === 'object' && v && 'richText' in v ? (v as { richText: { text: string }[] }).richText.map((t) => t.text).join('') : typeof v === 'object' && v && 'result' in v ? ((v as { result: string | number }).result ?? null) : (v as string | number | boolean);
    });
    rows[r - 1] = Array.from(out, (x) => x ?? null);
  });
  return Array.from(rows, (r) => r ?? []);
}

/** A minimal hand-written package around one worksheet XML. */
export function minimalPackage(sheetXml: string, extra: Record<string, string> = {}, workbookXml?: string): Uint8Array {
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  return zipParts({
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': workbookXml ?? `<?xml version="1.0"?><workbook xmlns="${NS}" xmlns:r="${R}"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': sheetXml,
    ...extra,
  });
}
