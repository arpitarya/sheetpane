// Writes every hand-built fixture in packages/fixtures/files/ (W-42; first written
// for the plugin gallery, W-32): the showcase workbook — one sheet per plugin —
// its rules sample, CSV dialects and edge cases, each part written here and
// zipped by @sheetpane/export's writeZip, plus fixtures.json and src/manifest.ts
// (what each file holds). The 250,000-row case is a generator in src/, not a file.
//
// ⚠ Hand-built, not saved by Excel: they prove behaviour, not Excel
// compatibility — that is W-30's real-app files, listed by the app that saved them.
//
// Run after `just build`:  just fixtures   (or: node packages/fixtures/scripts/make.mjs)
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { writeZip } from '@sheetpane/export';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const TC = 'http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ── styles: number formats, fonts, fills, borders, alignment, two dxfs ────
const NUMFMTS = { 164: '"$"#,##0.00', 165: 'd mmm yyyy', 166: '[Blue]#,##0;[Red]-#,##0', 167: '0.0%', 168: '# ?/?' };
const XF = { currency: 1, percent: 2, date: 3, custom: 4, fraction: 5, bold: 6, yellowBox: 7, redItalic: 8, banner: 9, thickBottom: 10, wrapTop: 11, green: 12 };
const styles = `${XML}<styleSheet xmlns="${NS}">
<numFmts count="5">${Object.entries(NUMFMTS).map(([id, code]) => `<numFmt numFmtId="${id}" formatCode="${esc(code)}"/>`).join('')}</numFmts>
<fonts count="4"><font><sz val="11"/><color theme="1"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><i/><sz val="11"/><color rgb="FFC00000"/><name val="Calibri"/></font><font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2346C8"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6F2EA"/></patternFill></fill></fills>
<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border><border><left/><right/><top/><bottom style="thick"/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="13"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="168" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="2" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="2" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
<dxfs count="1"><dxf><font><color rgb="FF9C0006"/></font><fill><patternFill><bgColor rgb="FFFFC7CE"/></patternFill></fill></dxf></dxfs>
</styleSheet>`;

// ── cells ─────────────────────────────────────────────────────────────────
/** A cell: a value, or `{ v, s }` (a style), or `{ f, v }` (a formula with Excel's cached value). */
function cellXml(ref, c) {
  if (c === null || c === undefined) return '';
  const o = typeof c === 'object' ? c : { v: c };
  const s = o.s ? ` s="${o.s}"` : '';
  const f = o.f ? `<f>${esc(o.f)}</f>` : '';
  if (typeof o.v === 'number') return `<c r="${ref}"${s}>${f}<v>${o.v}</v></c>`;
  if (typeof o.v === 'boolean') return `<c r="${ref}"${s} t="b">${f}<v>${o.v ? 1 : 0}</v></c>`;
  if (o.f) return `<c r="${ref}"${s} t="str">${f}<v>${esc(o.v ?? '')}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(o.v)}</t></is></c>`;
}
function sheetXml({ cells, cols = [], tail = '' }) {
  const rows = new Map();
  for (const [ref, c] of Object.entries(cells)) {
    const r = Number(/\d+/.exec(ref)[0]);
    if (!rows.has(r)) rows.set(r, []);
    rows.get(r).push([ref, c]);
  }
  const colIdx = (ref) => [.../^[A-Z]+/.exec(ref)[0]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  const body = [...rows].sort(([a], [b]) => a - b).map(([r, cs]) => `<row r="${r}">${cs.sort(([a], [b]) => colIdx(a) - colIdx(b)).map(([ref, c]) => cellXml(ref, c)).join('')}</row>`).join('');
  const colsXml = cols.length ? `<cols>${cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  return `${XML}<worksheet xmlns="${NS}" xmlns:r="${R}">${colsXml}<sheetData>${body}</sheetData>${tail}</worksheet>`;
}

// ── a small PNG, drawn here (no third-party image is committed) ─────────────
function png(w, h, pixel) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const [r, g, b] = pixel(x, y); raw.set([r, g, b], y * (w * 3 + 1) + 1 + x * 3); } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
// a blue-to-teal band with a white stripe: obviously a picture, obviously not a cell
const LOGO = png(240, 96, (x, y) => (y > 40 && y < 56 ? [255, 255, 255] : [35 + Math.round((x / 240) * 20), 70 + Math.round((x / 240) * 110), 200 - Math.round((x / 240) * 40)]));

// ── charts ────────────────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], SALES = [120, 135, 128, 160, 172, 190], COSTS = [80, 88, 95, 90, 101, 110];
const strCache = (pts) => `<c:strCache><c:ptCount val="${pts.length}"/>${pts.map((p, i) => `<c:pt idx="${i}"><c:v>${esc(p)}</c:v></c:pt>`).join('')}</c:strCache>`;
const numCache = (pts) => `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${pts.length}"/>${pts.map((p, i) => `<c:pt idx="${i}"><c:v>${p}</c:v></c:pt>`).join('')}</c:numCache>`;
const ser = (i, nameRef, name, col, vals) => `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:strRef><c:f>${nameRef}</c:f>${strCache([name])}</c:strRef></c:tx><c:cat><c:strRef><c:f>Charts!$A$2:$A$7</c:f>${strCache(MONTHS)}</c:strRef></c:cat><c:val><c:numRef><c:f>Charts!$${col}$2:$${col}$7</c:f>${numCache(vals)}</c:numRef></c:val></c:ser>`;
const chartXml = (title, group) => `${XML}<c:chartSpace xmlns:c="${C}" xmlns:a="${A}" xmlns:r="${R}"><c:roundedCorners val="0"/><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:t>${esc(title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${group}<c:catAx><c:axId val="1"/><c:crossAx val="2"/></c:catAx><c:valAx><c:axId val="2"/><c:crossAx val="1"/></c:valAx></c:plotArea><c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/></c:chart></c:chartSpace>`;
const bars = chartXml('Sales and costs by month', `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${ser(0, 'Charts!$B$1', 'Sales', 'B', SALES)}${ser(1, 'Charts!$C$1', 'Costs', 'C', COSTS)}<c:gapWidth val="150"/><c:axId val="1"/><c:axId val="2"/></c:barChart>`);
const line = chartXml('Sales trend', `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${ser(0, 'Charts!$B$1', 'Sales', 'B', SALES)}<c:marker val="1"/><c:axId val="1"/><c:axId val="2"/></c:lineChart>`);

const pt = (col, row) => `<xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff>`;
const frame = (id, name, rid, from, to) => `<xdr:twoCellAnchor><xdr:from>${pt(...from)}</xdr:from><xdr:to>${pt(...to)}</xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id}" name="${name}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${C}"><c:chart xmlns:c="${C}" r:id="${rid}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
const picAnchor = `<xdr:twoCellAnchor editAs="oneCell"><xdr:from>${pt(1, 2)}</xdr:from><xdr:to>${pt(5, 9)}</xdr:to><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Logo" descr="The showcase logo: a blue band with a white stripe"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr/></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>`;
const drawing = (body) => `${XML}<xdr:wsDr xmlns:xdr="${XDR}" xmlns:a="${A}" xmlns:r="${R}">${body}</xdr:wsDr>`;

// ── comments: a note and a thread with a reply ──────────────────────────────
const PLACEHOLDER = '[Threaded comment]\n\nYour version of Excel allows you to read this threaded comment; however, any edits to it will get removed if the file is opened in a newer version of Excel. Learn more: https://go.microsoft.com/fwlink/?linkid=870924';
const PERSONS = [{ id: '{1F0C2D1E-6A5B-4B1C-9E2F-0A1B2C3D4E5F}', name: 'Arpit' }, { id: '{2A1D3E2F-7B6C-4C2D-8F3A-1B2C3D4E5F60}', name: 'Priya' }];
const THREAD_ID = '{8C1B2A3D-4E5F-4061-8273-9A0B1C2D3E4F}';

// ── tables (W-61) ─────────────────────────────────────────────────────────────
const UNITS = [['mg/L', 'milligrams per litre'], ['ug/L', 'micrograms per litre'], ['%', 'percent'], ['ppm', 'parts per million']];
const READINGS = [['Lead', 3, 'mg/L'], ['Zinc', 40, 'ug/L'], ['Moisture', 12, '%'], ['Copper', 7, 'ppm']];
/** A table part: its range, the filter range (the totals row left out), columns, `tableStyleInfo` and extra attributes. */
const tableXml = (id, name, ref, filter, columns, style, extra = '') => `${XML}<table xmlns="${NS}" id="${id}" name="${name}" displayName="${name}" ref="${ref}"${extra}><autoFilter ref="${filter}"/><tableColumns count="${columns.length}">${columns.map((c, i) => `<tableColumn id="${i + 1}" name="${esc(c.name)}"${c.label ? ` totalsRowLabel="${esc(c.label)}"` : ''}${c.fn ? ` totalsRowFunction="${c.fn}"` : ''}/>`).join('')}</tableColumns><tableStyleInfo ${style}/></table>`;

// ── the sheets ────────────────────────────────────────────────────────────
const sheets = [
  { name: 'Numbers', cols: [26, 18], cells: {
    A1: { v: 'What it is', s: XF.bold }, B1: { v: 'Value', s: XF.bold },
    A2: 'Currency', B2: { v: 1234.5, s: XF.currency },
    A3: 'Percent', B3: { v: 0.1234, s: XF.percent },
    A4: 'Date', B4: { v: 46296, s: XF.date },
    A5: 'Colour by sign', B5: { v: -987, s: XF.custom },
    A6: 'Fraction', B6: { v: 1.25, s: XF.fraction },
    A7: 'General', B7: 1234.5678,
  } },
  { name: 'Styles', cols: [22, 26], cells: {
    A1: { v: 'Style', s: XF.bold }, B1: { v: 'Example', s: XF.bold },
    A2: 'Fill and border', B2: { v: 'Yellow fill, thin box', s: XF.yellowBox },
    A3: 'Italic, coloured', B3: { v: 'Red italic', s: XF.redItalic },
    A4: { v: 'Banner', s: XF.banner }, B4: { v: 'White on blue, centred', s: XF.banner },
    A5: 'Thick bottom border', B5: { v: 'Underlined cell', s: XF.thickBottom },
    A6: 'Right, top, wrapped', B6: { v: 'A long line that wraps inside its cell', s: XF.wrapTop },
    A7: 'Green fill', B7: { v: 'Green', s: XF.green },
  } },
  { name: 'Formulas', cols: [18, 14], cells: {
    A1: { v: 'Item', s: XF.bold }, B1: { v: 'Amount', s: XF.bold },
    A2: 'Rent', B2: 1200, A3: 'Salaries', B3: 5400, A4: 'Software', B4: 380, A5: 'Travel', B5: 620,
    A6: { v: 'Total', s: XF.bold }, B6: { f: 'SUM(B2:B5)', v: 7600 },
    A7: 'Doubled', B7: { f: 'B6*2', v: 15200 },
    A8: 'From Numbers', B8: { f: 'Numbers!B2*2', v: 2469 },
  } },
  { name: 'Validation', cols: [14, 12, 10], cells: {
    A1: { v: 'Account', s: XF.bold }, B1: { v: 'Status', s: XF.bold }, C1: { v: 'Units', s: XF.bold },
    A2: 'AC-10021', B2: 'Active', C2: 1200,
    A3: 'AC-10037', B3: 'Inactive', C3: -2,
    A4: 'AC-10042', B4: 'Bogus', C4: 300,
    A5: 'AC-10051', B5: 'Active', C5: 640,
  }, tail: `<dataValidations count="2"><dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Status" error="Pick Active or Inactive" sqref="B2:B5"><formula1>"Active,Inactive"</formula1></dataValidation><dataValidation type="whole" operator="greaterThan" allowBlank="1" showErrorMessage="1" errorTitle="Units" error="Units must be positive" sqref="C2:C5"><formula1>0</formula1></dataValidation></dataValidations>` },
  { name: 'CondFmt', cols: [12, 12, 12], cells: {
    A1: { v: 'Scale', s: XF.bold }, B1: { v: 'Bars', s: XF.bold }, C1: { v: 'Over 50', s: XF.bold },
    ...Object.fromEntries([12, 45, 30, 88, 64, 5, 71, 50].flatMap((n, i) => [[`A${i + 2}`, n], [`B${i + 2}`, n], [`C${i + 2}`, n]])),
  }, tail: `<conditionalFormatting sqref="A2:A9"><cfRule type="colorScale" priority="1"><colorScale><cfvo type="min"/><cfvo type="max"/><color rgb="FFF8696B"/><color rgb="FF63BE7B"/></colorScale></cfRule></conditionalFormatting><conditionalFormatting sqref="B2:B9"><cfRule type="dataBar" priority="2"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="FF638EC6"/></dataBar></cfRule></conditionalFormatting><conditionalFormatting sqref="C2:C9"><cfRule type="cellIs" dxfId="0" priority="3" operator="greaterThan"><formula>50</formula></cfRule></conditionalFormatting>` },
  { name: 'Images', cols: [30], cells: { A1: { v: 'A picture anchored to B3:E9', s: XF.bold } }, tail: '<drawing r:id="rId1"/>',
    rels: [['rId1', `${R}/drawing`, '../drawings/drawing1.xml']] },
  { name: 'Charts', cols: [10, 10, 10], cells: {
    A1: { v: 'Month', s: XF.bold }, B1: { v: 'Sales', s: XF.bold }, C1: { v: 'Costs', s: XF.bold },
    ...Object.fromEntries(MONTHS.flatMap((m, i) => [[`A${i + 2}`, m], [`B${i + 2}`, SALES[i]], [`C${i + 2}`, COSTS[i]]])),
  }, tail: '<drawing r:id="rId1"/>', rels: [['rId1', `${R}/drawing`, '../drawings/drawing2.xml']] },
  { name: 'Comments', cols: [14, 34], cells: {
    A1: { v: 'Account', s: XF.bold }, B1: { v: 'Price', s: XF.bold },
    A2: 'AC-10021', B2: 268.4, A3: 'AC-10037', B3: 74.85,
  }, tail: '<legacyDrawing r:id="rId2"/>', rels: [
    ['rId1', `${R}/comments`, '../comments1.xml'],
    ['rId2', `${R}/vmlDrawing`, '../drawings/vmlDrawing1.vml'],
    ['rId3', 'http://schemas.microsoft.com/office/2017/10/relationships/threadedComment', '../threadedComments/threadedComment1.xml'],
  ] },
  // W-61: two Excel tables; Readings' Unit column is a list over Units[Unit], through the defined name UnitList
  // Units at A1:B5; Readings at A8:C13, under it, with a totals row
  { name: 'Tables', cols: [12, 22, 10], cells: {
    A1: 'Unit', B1: 'Meaning',
    ...Object.fromEntries(UNITS.flatMap(([u, m], i) => [[`A${i + 2}`, u], [`B${i + 2}`, m]])),
    A8: 'Parameter', B8: 'Value', C8: 'Unit',
    ...Object.fromEntries(READINGS.flatMap(([p, v, u], i) => [[`A${i + 9}`, p], [`B${i + 9}`, v], [`C${i + 9}`, u]])),
    A13: 'Total', B13: { f: 'SUM(B9:B12)', v: READINGS.reduce((n, r) => n + r[1], 0) },
  }, tail: '<dataValidations count="1"><dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Unit" error="Pick a unit from the Units table" sqref="C9:C12"><formula1>UnitList</formula1></dataValidation></dataValidations><tableParts count="2"><tablePart r:id="rId1"/><tablePart r:id="rId2"/></tableParts>',
    rels: [['rId1', `${R}/table`, '../tables/table1.xml'], ['rId2', `${R}/table`, '../tables/table2.xml']] },
];

const parts = {};
const overrides = [];
sheets.forEach((s, i) => {
  parts[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s);
  overrides.push(`<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
  if (s.rels) parts[`xl/worksheets/_rels/sheet${i + 1}.xml.rels`] = `${XML}<Relationships xmlns="${PR}">${s.rels.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`).join('')}</Relationships>`;
});
parts['xl/drawings/drawing1.xml'] = drawing(picAnchor);
parts['xl/drawings/_rels/drawing1.xml.rels'] = `${XML}<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/image" Target="../media/image1.png"/></Relationships>`;
parts['xl/media/image1.png'] = LOGO;
parts['xl/drawings/drawing2.xml'] = drawing(frame(2, 'Sales and costs', 'rId1', [4, 0], [11, 15]) + frame(3, 'Sales trend', 'rId2', [4, 16], [11, 31]));
parts['xl/drawings/_rels/drawing2.xml.rels'] = `${XML}<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/chart" Target="../charts/chart1.xml"/><Relationship Id="rId2" Type="${R}/chart" Target="../charts/chart2.xml"/></Relationships>`;
parts['xl/charts/chart1.xml'] = bars;
parts['xl/charts/chart2.xml'] = line;
parts['xl/comments1.xml'] = `${XML}<comments xmlns="${NS}"><authors><author>Priya</author><author>tc=${THREAD_ID}</author></authors><commentList><comment ref="A2" authorId="0"><text><r><t xml:space="preserve">Priya:\nChecked against the custodian file.</t></r></text></comment><comment ref="B3" authorId="1" shapeId="0"><text><t xml:space="preserve">${esc(`${PLACEHOLDER}\n\nComment:\n    Is this the September price?\nReply:\n    Yes — the 30 Sep close.`)}</t></text></comment></commentList></comments>`;
const shape = (id, row, col) => `<v:shape id="_x0000_s${id}" type="#_x0000_t202" style="position:absolute;visibility:hidden" fillcolor="infoBackground [80]" strokecolor="none [81]" o:insetmode="auto"><v:fill color2="infoBackground [80]"/><v:shadow color="none [81]" obscured="t"/><v:path o:connecttype="none"/><v:textbox style="mso-direction-alt:auto"><div style="text-align:left"/></v:textbox><x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/><x:Anchor>${col + 1}, 15, ${row}, 2, ${col + 3}, 15, ${row + 4}, 4</x:Anchor><x:AutoFill>False</x:AutoFill><x:Row>${row}</x:Row><x:Column>${col}</x:Column></x:ClientData></v:shape>`;
parts['xl/drawings/vmlDrawing1.vml'] = `<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout><v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>${shape(1025, 1, 0)}${shape(1026, 2, 1)}</xml>`;
parts['xl/threadedComments/threadedComment1.xml'] = `${XML}<ThreadedComments xmlns="${TC}" xmlns:x="${NS}"><threadedComment ref="B3" dT="2026-09-30T10:00:00.00" personId="${PERSONS[0].id}" id="${THREAD_ID}"><text>Is this the September price?</text></threadedComment><threadedComment ref="B3" dT="2026-09-30T11:30:00.00" personId="${PERSONS[1].id}" id="{9D2C3B4E-5F60-4172-9384-AB1C2D3E4F50}" parentId="${THREAD_ID}"><text>Yes — the 30 Sep close.</text></threadedComment></ThreadedComments>`;
parts['xl/persons/person.xml'] = `${XML}<personList xmlns="${TC}" xmlns:x="${NS}">${PERSONS.map((p) => `<person displayName="${p.name}" id="${p.id}" userId="${p.name}" providerId="None"/>`).join('')}</personList>`;
parts['xl/tables/table1.xml'] = tableXml(1, 'Units', 'A1:B5', 'A1:B5', [{ name: 'Unit' }, { name: 'Meaning' }], 'name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"', ' totalsRowShown="0"');
parts['xl/tables/table2.xml'] = tableXml(2, 'Readings', 'A8:C13', 'A8:C12', [{ name: 'Parameter', label: 'Total' }, { name: 'Value', fn: 'sum' }, { name: 'Unit' }], 'name="TableStyleMedium7" showFirstColumn="1" showLastColumn="0" showRowStripes="1" showColumnStripes="0"', ' totalsRowCount="1"');
parts['xl/styles.xml'] = styles;
const n = sheets.length;
parts['xl/workbook.xml'] = `${XML}<workbook xmlns="${NS}" xmlns:r="${R}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><definedNames><definedName name="UnitList">Units[Unit]</definedName></definedNames></workbook>`;
parts['xl/_rels/workbook.xml.rels'] = `${XML}<Relationships xmlns="${PR}">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${n + 1}" Type="${R}/styles" Target="styles.xml"/><Relationship Id="rId${n + 2}" Type="http://schemas.microsoft.com/office/2017/10/relationships/person" Target="persons/person.xml"/></Relationships>`;
parts['_rels/.rels'] = `${XML}<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
parts['[Content_Types].xml'] = `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides.join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/drawings/drawing2.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/><Override PartName="/xl/charts/chart2.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/><Override PartName="/xl/comments1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/><Override PartName="/xl/threadedComments/threadedComment1.xml" ContentType="application/vnd.ms-excel.threadedcomments+xml"/><Override PartName="/xl/persons/person.xml" ContentType="application/vnd.ms-excel.person+xml"/>${[1, 2].map((i) => `<Override PartName="/xl/tables/table${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`).join('')}</Types>`;

const enc = (x) => (typeof x === 'string' ? new TextEncoder().encode(x) : new Uint8Array(x));
const files = new URL('../files/', import.meta.url);
const out = (name, data) => { const u = new URL(name, files); mkdirSync(new URL('.', u), { recursive: true }); writeFileSync(u, typeof data === 'string' ? data : data); };
// writeZip stamps every entry 1980-01-01, so every file is the same byte for byte on every run
const zip = (p) => writeZip(Object.entries(p).map(([name, data]) => ({ name, data: enc(data) })));
out('showcase.xlsx', await zip(parts));

// ── a minimal workbook for the edge cases ──────────────────────────────────────
async function book(spec) {
  const p = {
    '_rels/.rels': `${XML}<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `${XML}<workbook xmlns="${NS}" xmlns:r="${R}">${spec.date1904 ? '<workbookPr date1904="1"/>' : ''}<sheets>${spec.sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}"${s.hidden ? ' state="hidden"' : ''} r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `${XML}<Relationships xmlns="${PR}">${spec.sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${spec.sheets.length + 1}" Type="${R}/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': styles,
    '[Content_Types].xml': `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${spec.sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
  };
  spec.sheets.forEach((s, i) => { p[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s); });
  return zip(p);
}
const EDGE = [
  { name: 'edge/empty.xlsx', spec: { sheets: [{ name: 'Sheet1', cells: {} }] }, features: ['an empty sheet'] },
  { name: 'edge/hidden-sheet.xlsx', spec: { sheets: [{ name: 'Visible', cells: { A1: 'Shown' } }, { name: 'Secret', hidden: true, cells: { A1: 'Hidden in Excel' } }] }, features: ['a hidden sheet'] },
  { name: 'edge/unicode-names.xlsx', spec: { sheets: [{ name: 'Übersicht', cells: { A1: 'Größe', B1: 'Prix (€)' } }, { name: '数据', cells: { A1: '名前', A2: 'たなか' } }] }, features: ['non-ASCII sheet names and text'] },
  { name: 'edge/merged.xlsx', spec: { sheets: [{ name: 'Merged', cells: { A1: { v: 'A banner over three columns', s: XF.banner }, A2: 'a', B2: 'b', C2: 'c' }, tail: '<mergeCells count="1"><mergeCell ref="A1:C1"/></mergeCells>' }] }, features: ['a merged range'] },
  { name: 'edge/date1904.xlsx', spec: { date1904: true, sheets: [{ name: 'Dates', cells: { A1: 'Date', A2: { v: 44834, s: XF.date } } }] }, features: ['the 1904 date system'] },
  { name: 'edge/formula-errors.xlsx', spec: { sheets: [{ name: 'Errors', cells: { A1: 0, B1: { f: '1/A1', v: '#DIV/0!' }, C1: { f: '#REF!+1', v: '#REF!' }, D1: { f: 'NA()', v: '#N/A' } } }] }, features: ['cached formula errors'] },
];
for (const e of EDGE) out(e.name, await book(e.spec));
// refused on purpose (SR-LAW-3: .xlsx and .csv only)
out('edge/legacy.xls', new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...new Array(504).fill(0)]));
out('edge/not-a-zip.xlsx', 'this is not a workbook');

// ── CSV dialects ──────────────────────────────────────────────────────────────
const ROWS = [['Account', 'Units', 'Price'], ['AC-10021', '1200', '268.4'], ['AC-10037', '430', '74.85']];
const CSV = {
  'csv/comma.csv': ROWS.map((r) => r.join(',')).join('\r\n'),
  'csv/semicolon.csv': ROWS.map((r) => r.map((v) => v.replace('.', ',')).join(';')).join('\r\n'),
  'csv/tab.csv': ROWS.map((r) => r.join('\t')).join('\n'),
  'csv/bom.csv': `﻿${ROWS.map((r) => r.join(',')).join('\r\n')}`,
  'csv/quoted.csv': 'Name,Note\r\n"Smith, Jane","She said ""yes"""\r\n"Lee","two\nlines"',
  'csv/formula-guard.csv': 'Cell,Text\r\nA,=1+1\r\nB,+SUM(1)\r\nC,-2\r\nD,@user',
};
for (const [name, text] of Object.entries(CSV)) out(name, text);

// ── the manifest: what each file holds ────────────────────────────────────────
const headersOf = (cells) => Object.entries(cells).filter(([ref]) => /^[A-Z]+1$/.test(ref)).sort(([a], [b]) => a.length - b.length || a.localeCompare(b)).map(([, c]) => (c !== null && typeof c === 'object' ? c.v : c));
const manifest = {
  version: 1,
  note: 'Hand-built by scripts/make.mjs unless appSaved names the app that saved it; hand-built files prove behaviour, not Excel compatibility.',
  files: [
    { name: 'showcase.xlsx', kind: 'xlsx', appSaved: null, sheets: sheets.map((s) => ({ name: s.name, headers: headersOf(s.cells) })), features: ['number formats', 'styles', 'formulas with cached values', 'data validation (two cells fail)', 'conditional formats', 'a picture', 'two charts', 'a note and a thread', 'two Excel tables, a list rule over a table column'] },
    { name: 'showcase.rules.json', kind: 'rules', appSaved: null, for: 'showcase.xlsx', errors: ['Validation!C3', 'Validation!B4', 'Formulas!B3', 'Formulas!B6', 'Formulas!B7', 'Numbers!B3'] },
    ...EDGE.map((e) => ({ name: e.name, kind: 'xlsx', appSaved: null, sheets: e.spec.sheets.map((s) => ({ name: s.name, hidden: !!s.hidden, headers: headersOf(s.cells) })), features: e.features })),
    { name: 'edge/legacy.xls', kind: 'refused', appSaved: null, features: ['a legacy .xls (compound file) header'] },
    { name: 'edge/not-a-zip.xlsx', kind: 'refused', appSaved: null, features: ['not a ZIP package'] },
    ...Object.keys(CSV).map((name) => ({ name, kind: 'csv', appSaved: null, sheets: [{ name: name.slice(4, -4), headers: name === 'csv/quoted.csv' ? ['Name', 'Note'] : name === 'csv/formula-guard.csv' ? ['Cell', 'Text'] : ROWS[0] }], features: [name.slice(4, -4)] })),
  ],
};
out('fixtures.json', `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(new URL('../src/manifest.ts', import.meta.url), `// Generated by scripts/make.mjs beside files/fixtures.json — do not edit by hand.\n/** What every fixture file holds — its name, kind, the app that saved it, and each sheet with its headers; the same data as \`files/fixtures.json\`. @see records/0115_FIXTURES.md */\nexport const MANIFEST = ${JSON.stringify(manifest, null, 2)} as const;\n`);
// one literal `new URL(…, import.meta.url)` per file: bundlers copy each as an asset (a template string would not reach subfolders)
writeFileSync(new URL('../src/urls.ts', import.meta.url), `// Generated by scripts/make.mjs — do not edit by hand.\nexport const URLS = {\n${manifest.files.map((f) => `  '${f.name}': () => new URL('../files/${f.name}', import.meta.url),`).join('\n')}\n} as const;\n`);
console.log(`fixtures: ${manifest.files.length} files → packages/fixtures/files`);
