// W-52: a hand-written workbook with every part an insert or delete of rows or columns must
// move — formulas on two sheets, a defined name, a frozen pane and a selection, column spans,
// an autofilter, a merge, a conditional format, a validation, a hyperlink, a drawing anchoring a
// chart, a legacy note with its VML shape, and a threaded comment. Built with the package's own
// ZIP writer, so the export, import and grid tests share it without another dependency.
import { utf8, writeZip } from '../../src/index.js';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
const XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const TC = 'http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments';

const s = (ref: string, t: string) => `<c r="${ref}" t="inlineStr"><is><t>${t}</t></is></c>`;
const n = (ref: string, v: number) => `<c r="${ref}"><v>${v}</v></c>`;
const f = (ref: string, formula: string, v: number) => `<c r="${ref}"><f>${formula}</f><v>${v}</v></c>`;

/** The Data sheet's rows: a header, four items (rate × qty = total) and a sum. */
function dataRows(): string {
  const items: [string, number, number][] = [['a', 1.5, 2], ['b', 2, 3], ['c', 4, 1], ['d', 0.5, 8]];
  const body = items.map(([name, rate, qty], i) => {
    const r = i + 2;
    return `<row r="${r}">${s(`A${r}`, name)}${n(`B${r}`, rate)}${n(`C${r}`, qty)}${f(`D${r}`, `B${r}*C${r}`, rate * qty)}</row>`;
  }).join('');
  const total = items.reduce((t, [, rate, qty]) => t + rate * qty, 0);
  return `<row r="1">${s('A1', 'Name')}${s('B1', 'Rate')}${s('C1', 'Qty')}${s('D1', 'Total')}</row>${body}<row r="6">${s('A6', 'Sum')}${f('D6', 'SUM(D2:D5)', total)}</row>`;
}

/**
 * The parts of the workbook, as text.
 * @param extra - Parts to add or replace.
 * @returns Every part's text by path.
 */
export function structureParts(extra: Record<string, string> = {}): Record<string, string> {
  const ct = (part: string, type: string) => `<Override PartName="/${part}" ContentType="application/vnd.openxmlformats-officedocument.${type}"/>`;
  return {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>${ct('xl/workbook.xml', 'spreadsheetml.sheet.main+xml')}${ct('xl/worksheets/sheet1.xml', 'spreadsheetml.worksheet+xml')}${ct('xl/worksheets/sheet2.xml', 'spreadsheetml.worksheet+xml')}${ct('xl/drawings/drawing1.xml', 'drawing+xml')}${ct('xl/charts/chart1.xml', 'drawingml.chart+xml')}${ct('xl/comments1.xml', 'spreadsheetml.comments+xml')}<Override PartName="/xl/threadedComments/threadedComment1.xml" ContentType="application/vnd.ms-excel.threadedcomments+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${NS}" xmlns:r="${R}"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="Data" sheetId="1" r:id="rId1"/><sheet name="Other" sheetId="2" r:id="rId2"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">Data!$A$1:$D$5</definedName><definedName name="Rates">Data!$B$2:$B$5</definedName></definedNames></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${R}/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS}" xmlns:r="${R}"><dimension ref="A1:D6"/><sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="B3" sqref="B3"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="14" customWidth="1"/><col min="2" max="4" width="10" customWidth="1"/></cols><sheetData>${dataRows()}</sheetData><autoFilter ref="A1:D5"/><mergeCells count="1"><mergeCell ref="A6:C6"/></mergeCells><conditionalFormatting sqref="D2:D5"><cfRule type="expression" priority="1"><formula>D2&gt;$B$2*2</formula></cfRule></conditionalFormatting><dataValidations count="1"><dataValidation type="decimal" allowBlank="1" showErrorMessage="1" sqref="B2:B5"><formula1>0</formula1><formula2>$D$6</formula2></dataValidation></dataValidations><hyperlinks><hyperlink ref="A3" location="Other!A1" display="go"/></hyperlinks><drawing r:id="rId1"/><legacyDrawing r:id="rId3"/></worksheet>`,
    'xl/worksheets/_rels/sheet1.xml.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/drawing" Target="../drawings/drawing1.xml"/><Relationship Id="rId2" Type="${R}/comments" Target="../comments1.xml"/><Relationship Id="rId3" Type="${R}/vmlDrawing" Target="../drawings/vmlDrawing1.vml"/><Relationship Id="rId4" Type="http://schemas.microsoft.com/office/2017/10/relationships/threadedComment" Target="../threadedComments/threadedComment1.xml"/></Relationships>`,
    'xl/worksheets/sheet2.xml': `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS}"><sheetData><row r="1">${f('A1', 'Data!D6*2', 64)}${f('B1', 'SUM(Data!B2:B5)', 8)}${f('C1', 'Data!B3+A1', 66)}</row></sheetData></worksheet>`,
    'xl/drawings/drawing1.xml': `<?xml version="1.0" encoding="UTF-8"?><xdr:wsDr xmlns:xdr="${XDR}" xmlns:a="${A}"><xdr:twoCellAnchor><xdr:from><xdr:col>5</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>9</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>10</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Chart 1"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${C}"><c:chart xmlns:c="${C}" xmlns:r="${R}" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`,
    'xl/drawings/_rels/drawing1.xml.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/chart" Target="../charts/chart1.xml"/></Relationships>`,
    'xl/charts/chart1.xml': `<?xml version="1.0" encoding="UTF-8"?><c:chartSpace xmlns:c="${C}" xmlns:a="${A}"><c:chart><c:plotArea><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:strRef><c:f>Data!$D$1</c:f></c:strRef></c:tx><c:cat><c:strRef><c:f>Data!$A$2:$A$5</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>Data!$D$2:$D$5</c:f></c:numRef></c:val></c:ser></c:barChart></c:plotArea></c:chart></c:chartSpace>`,
    'xl/comments1.xml': `<?xml version="1.0" encoding="UTF-8"?><comments xmlns="${NS}"><authors><author>Ann</author></authors><commentList><comment ref="C3" authorId="0"><text><t>check qty</t></text></comment></commentList></comments>`,
    'xl/drawings/vmlDrawing1.vml': '<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><v:shape id="_x0000_s1025" type="#_x0000_t202"><x:ClientData ObjectType="Note"><x:Anchor>3, 15, 1, 10, 5, 15, 5, 4</x:Anchor><x:Row>2</x:Row><x:Column>2</x:Column></x:ClientData></v:shape></xml>',
    'xl/threadedComments/threadedComment1.xml': `<?xml version="1.0" encoding="UTF-8"?><ThreadedComments xmlns="${TC}"><threadedComment ref="B4" dT="2026-01-01T00:00:00.00" personId="{00000000-0000-0000-0000-000000000001}" id="{00000000-0000-0000-0000-0000000000A1}"><text>is this rate right?</text></threadedComment></ThreadedComments>`,
    ...extra,
  };
}

/**
 * The workbook's bytes.
 * @param extra - Parts to add or replace.
 * @returns An .xlsx.
 */
export function structureBook(extra: Record<string, string> = {}): Promise<Uint8Array> {
  return writeZip(Object.entries(structureParts(extra)).map(([name, text]) => ({ name, data: utf8(text) })));
}
