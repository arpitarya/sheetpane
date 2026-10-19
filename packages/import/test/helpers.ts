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

/**
 * W-61: a sheet with two Excel tables — Units (A1:B5, Medium 2, banded rows) and Readings (D1:F6, a totals
 * row, Light 9, first column and banded columns, an escaped column name) — a defined name over a table
 * column, a list rule using it, and a tablePart whose relationship is missing (skipped).
 */
export function tablesPkg(): Uint8Array {
  const T = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/table';
  const s = (r: string, t: string) => `<c r="${r}" t="inlineStr"><is><t>${t}</t></is></c>`;
  return pkg(
    `<worksheet xmlns="${NS}" xmlns:r="${R}"><sheetData>`
      + `<row r="1">${s('A1', 'Unit')}${s('B1', 'Meaning')}${s('D1', 'Parameter')}${s('E1', 'Value')}${s('F1', 'Unit')}</row>`
      + `<row r="2">${s('A2', 'mg/L')}${s('B2', 'milligrams per litre')}${s('D2', 'Lead')}<c r="E2"><v>3</v></c>${s('F2', 'mg/L')}</row>`
      + `<row r="3">${s('A3', 'ug/L')}${s('B3', 'micrograms per litre')}${s('D3', 'Zinc')}<c r="E3"><v>4</v></c>${s('F3', 'ug/L')}</row>`
      + `<row r="4">${s('A4', '%')}${s('B4', 'percent')}${s('D4', 'Iron')}<c r="E4"><v>5</v></c>${s('F4', '%')}</row>`
      + `<row r="5">${s('A5', 'ppm')}${s('B5', 'parts per million')}${s('D5', 'Copper')}<c r="E5"><v>6</v></c>${s('F5', 'ppm')}</row>`
      + `<row r="6">${s('D6', 'Total')}<c r="E6"><f>SUBTOTAL(109,Readings[Value])</f><v>18</v></c></row>`
      + '</sheetData><dataValidations count="1"><dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="F2:F5"><formula1>UnitList</formula1></dataValidation></dataValidations>'
      + '<tableParts count="3"><tablePart r:id="rId1"/><tablePart r:id="rId2"/><tablePart r:id="rId9"/></tableParts></worksheet>',
    {
      'xl/workbook.xml': `<workbook xmlns="${NS}" xmlns:r="${R}"><sheets><sheet name="Lists" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="UnitList">Units[Unit]</definedName></definedNames></workbook>`,
      'xl/worksheets/_rels/sheet1.xml.rels': `<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${T}" Target="../tables/table1.xml"/><Relationship Id="rId2" Type="${T}" Target="/xl/tables/table2.xml"/></Relationships>`,
      'xl/tables/table1.xml': `<table xmlns="${NS}" id="1" name="Table1" displayName="Units" ref="A1:B5" totalsRowShown="0"><autoFilter ref="A1:B5"/><tableColumns count="2"><tableColumn id="1" name="Unit"/><tableColumn id="2" name="Meaning"/></tableColumns><tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`,
      'xl/tables/table2.xml': `<table xmlns="${NS}" id="2" name="Readings" displayName="Readings" ref="D1:F6" totalsRowCount="1"><tableColumns count="3"><tableColumn id="1" name="Parameter" totalsRowLabel="Total"/><tableColumn id="2" name="Value" totalsRowFunction="sum"/><tableColumn id="3" name="Unit_x0020_#"/></tableColumns><tableStyleInfo name="TableStyleLight9" showFirstColumn="1" showLastColumn="0" showRowStripes="0" showColumnStripes="1"/></table>`,
    },
  );
}
