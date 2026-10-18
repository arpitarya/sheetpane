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

/**
 * W-49: a workbook that hides things every way a file can — sheet states, `hidden` rows and
 * columns, zero height and width, outline levels and `collapsed`, `outlinePr`, an autoFilter.
 */
export function hiddenPkg(): Uint8Array {
  const rel = (n: number) => `<Relationship Id="rId${n}" Type="${R}/worksheet" Target="worksheets/sheet${n}.xml"/>`;
  const plain = (rows: string) => `<worksheet xmlns="${NS}"><sheetData>${rows}</sheetData></worksheet>`;
  return pkg(
    `<worksheet xmlns="${NS}"><sheetPr><outlinePr summaryBelow="0" summaryRight="1"/></sheetPr><dimension ref="A1:I7"/><sheetFormatPr defaultRowHeight="15" outlineLevelRow="2" outlineLevelCol="1"/>`
      + '<cols><col min="2" max="4" width="0" customWidth="1"/><col min="6" max="8" width="12" hidden="1" outlineLevel="1" customWidth="1"/><col min="9" max="9" width="10" collapsed="1"/></cols>'
      + '<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Name</t></is></c><c r="B1" t="inlineStr"><is><t>Qty</t></is></c></row>'
      + '<row r="2" outlineLevel="1"><c r="A2"><v>1</v></c></row><row r="3" outlineLevel="2" hidden="1"><c r="A3"><v>2</v></c></row>'
      + '<row r="4" ht="0" customHeight="1"/><row r="5" collapsed="1"/><row r="7" hidden="1"><c r="A7"><v>7</v></c></row></sheetData>'
      + '<autoFilter ref="A1:C7"/></worksheet>',
    {
      'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${PR}">${[1, 2, 3, 4].map(rel).join('')}</Relationships>`,
      'xl/worksheets/sheet2.xml': plain('<row r="1"><c r="A1"><v>2</v></c></row>'),
      'xl/worksheets/sheet3.xml': plain('<row r="1"><c r="A1"><v>3</v></c></row>'),
      'xl/worksheets/sheet4.xml': plain('<row r="2" outlineLevel="3"/><row r="3" outlineLevel="9"/>'),
    },
    { sheets: '<sheet name="Data" sheetId="1" r:id="rId1"/><sheet name="Hid" sheetId="2" state="hidden" r:id="rId2"/><sheet name="Very" sheetId="3" state="veryHidden" r:id="rId3"/><sheet name="Bare" sheetId="4" state="visible" r:id="rId4"/>' },
  );
}
