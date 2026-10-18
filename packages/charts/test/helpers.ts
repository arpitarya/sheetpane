// Hand-built packages with charts: a data sheet, a drawing whose graphicFrames point at chart
// parts (`c:chartSpace`), rels and content types — zipped with @sheetpane/export's writeZip.
// No chart fixture saved by Excel exists yet (W-30 owes it); these follow the DrawingML chart
// schema as Excel writes it.
import { writeZip } from '@sheetpane/export';
import '@sheetpane/grid';
import type { SheetpaneExcel } from '@sheetpane/grid';

const utf8 = (s: string) => new TextEncoder().encode(s);
const xe = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
const C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';

/** The data sheet: A1:D1 headers, A2:A5 months, B2:B5 sales, C2:C5 costs, D2:D5 x values. */
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr'];
export const SALES = [10, 20, 30, 40];
export const COSTS = [5, 15, -5, 25];
export const XS = [1, 2, 4, 8];

export interface SerSpec {
  name?: string;
  nameRef?: string;
  catRef?: string;
  cats?: (string | number)[];
  catNumeric?: boolean;
  valRef?: string;
  vals?: (number | null)[];
  /** `srgb:FF0000` or `scheme:accent2`. */
  fill?: string;
  line?: string;
  noLine?: boolean;
  dPt?: Record<number, string>;
}

export interface ChartSpec {
  /** `barChart`, `lineChart`, `pieChart`, `doughnutChart`, `scatterChart`, `areaChart`, `radarChart` … */
  type: string;
  barDir?: 'bar' | 'col';
  grouping?: string;
  varyColors?: boolean;
  title?: string;
  /** Leave out `c:title` and set autoTitleDeleted. */
  noTitle?: boolean;
  legend?: 'r' | 'b' | false;
  series: SerSpec[];
  /** A second plot-area group (combination chart). */
  extra?: string;
  pivot?: boolean;
  scatterStyle?: string;
  valFormat?: string;
}

const color = (spec: string) => {
  const [k, v] = spec.split(':');
  return k === 'scheme' ? `<a:schemeClr val="${v}"/>` : `<a:srgbClr val="${v}"/>`;
};

function cache(kind: 'num' | 'str', pts: readonly (string | number | null)[]): string {
  const body = pts.map((p, i) => (p === null ? '' : `<c:pt idx="${i}"><c:v>${xe(String(p))}</c:v></c:pt>`)).join('');
  return kind === 'num' ? `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${pts.length}"/>${body}</c:numCache>` : `<c:strCache><c:ptCount val="${pts.length}"/>${body}</c:strCache>`;
}

function ser(s: SerSpec, i: number, scatter: boolean): string {
  const tx = s.nameRef ? `<c:tx><c:strRef><c:f>${xe(s.nameRef)}</c:f>${cache('str', [s.name ?? ''])}</c:strRef></c:tx>` : s.name ? `<c:tx><c:v>${xe(s.name)}</c:v></c:tx>` : '';
  const ln = s.noLine ? '<a:ln><a:noFill/></a:ln>' : s.line ? `<a:ln><a:solidFill>${color(s.line)}</a:solidFill></a:ln>` : '';
  const spPr = s.fill || ln ? `<c:spPr>${s.fill ? `<a:solidFill>${color(s.fill)}</a:solidFill>` : ''}${ln}</c:spPr>` : '';
  const dPt = Object.entries(s.dPt ?? {}).map(([j, c]) => `<c:dPt><c:idx val="${j}"/><c:bubble3D val="0"/><c:spPr><a:solidFill>${color(c)}</a:solidFill></c:spPr></c:dPt>`).join('');
  const catTag = scatter ? 'xVal' : 'cat', valTag = scatter ? 'yVal' : 'val';
  const cats = s.cats ? (s.catNumeric
    ? `<c:${catTag}><c:numRef>${s.catRef ? `<c:f>${xe(s.catRef)}</c:f>` : ''}${cache('num', s.cats)}</c:numRef></c:${catTag}>`
    : `<c:${catTag}><c:strRef>${s.catRef ? `<c:f>${xe(s.catRef)}</c:f>` : ''}${cache('str', s.cats)}</c:strRef></c:${catTag}>`) : '';
  const vals = s.vals ? (s.valRef
    ? `<c:${valTag}><c:numRef><c:f>${xe(s.valRef)}</c:f>${cache('num', s.vals)}</c:numRef></c:${valTag}>`
    : `<c:${valTag}><c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="${s.vals.length}"/>${s.vals.map((v, j) => (v === null ? '' : `<c:pt idx="${j}"><c:v>${v}</c:v></c:pt>`)).join('')}</c:numLit></c:${valTag}>`) : '';
  return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx}${spPr}${dPt}${cats}${vals}${scatter ? '<c:smooth val="0"/>' : ''}</c:ser>`;
}

/** A `c:chartSpace` part. */
export function chartXml(c: ChartSpec): string {
  const scatter = c.type === 'scatterChart';
  const title = c.noTitle ? '<c:autoTitleDeleted val="1"/>' : c.title !== undefined
    ? `<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:t>${xe(c.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>` : '';
  const head = [
    c.barDir ? `<c:barDir val="${c.barDir}"/>` : '',
    c.grouping ? `<c:grouping val="${c.grouping}"/>` : '',
    scatter ? `<c:scatterStyle val="${c.scatterStyle ?? 'lineMarker'}"/>` : '',
    `<c:varyColors val="${c.varyColors ? 1 : 0}"/>`,
  ].join('');
  const tail = c.type === 'barChart' ? '<c:gapWidth val="150"/><c:axId val="1"/><c:axId val="2"/>' : c.type === 'doughnutChart' ? '<c:firstSliceAng val="0"/><c:holeSize val="50"/>' : c.type === 'pieChart' ? '<c:firstSliceAng val="0"/>' : '<c:axId val="1"/><c:axId val="2"/>';
  const group = `<c:${c.type}>${head}${c.series.map((s, i) => ser(s, i, scatter)).join('')}${tail}</c:${c.type}>`;
  const axes = c.type === 'pieChart' || c.type === 'doughnutChart' ? '' : `<c:catAx><c:axId val="1"/><c:crossAx val="2"/></c:catAx><c:valAx><c:axId val="2"/>${c.valFormat ? `<c:numFmt formatCode="${xe(c.valFormat)}" sourceLinked="0"/>` : ''}<c:crossAx val="1"/></c:valAx>`;
  const legend = c.legend === false ? '' : `<c:legend><c:legendPos val="${c.legend ?? 'r'}"/><c:overlay val="0"/></c:legend>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="${C}" xmlns:a="${A}" xmlns:r="${R}"><c:roundedCorners val="0"/>${c.pivot ? '<c:pivotSource><c:name>[Book1]Sheet1!PivotTable1</c:name><c:fmtId val="0"/></c:pivotSource>' : ''}<c:chart>${title}<c:plotArea><c:layout/>${group}${c.extra ?? ''}${axes}</c:plotArea>${legend}<c:plotVisOnly val="1"/></c:chart></c:chartSpace>`;
}

/** Zero-based [col, colOff, row, rowOff], offsets in EMU. */
export type Pt = [number, number, number, number];
export interface Placed { chart: ChartSpec | string; from: Pt; to: Pt; name?: string; descr?: string }

const point = ([c, co, r, ro]: Pt) => `<xdr:col>${c}</xdr:col><xdr:colOff>${co}</xdr:colOff><xdr:row>${r}</xdr:row><xdr:rowOff>${ro}</xdr:rowOff>`;
const frameXml = (i: number, p: Placed) =>
  `<xdr:twoCellAnchor><xdr:from>${point(p.from)}</xdr:from><xdr:to>${point(p.to)}</xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="${xe(p.name ?? `Chart ${i + 1}`)}"${p.descr ? ` descr="${xe(p.descr)}"` : ''}/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${C}"><c:chart xmlns:c="${C}" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;

const cell = (ref: string, v: string | number) => (typeof v === 'number' ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${xe(v)}</t></is></c>`);

const THEME = `<a:theme xmlns:a="${A}" name="T"><a:themeElements><a:clrScheme name="T"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F1F1F"/></a:dk2><a:lt2><a:srgbClr val="EEEEEE"/></a:lt2><a:accent1><a:srgbClr val="112233"/></a:accent1><a:accent2><a:srgbClr val="445566"/></a:accent2><a:accent3><a:srgbClr val="778899"/></a:accent3><a:accent4><a:srgbClr val="AABBCC"/></a:accent4><a:accent5><a:srgbClr val="DDEEFF"/></a:accent5><a:accent6><a:srgbClr val="010203"/></a:accent6><a:hlink><a:srgbClr val="0000FF"/></a:hlink><a:folHlink><a:srgbClr val="800080"/></a:folHlink></a:clrScheme></a:themeElements></a:theme>`;
/** The accents the test theme declares, `RRGGBB`. */
export const THEME_ACCENTS = ['112233', '445566', '778899', 'AABBCC', 'DDEEFF', '010203'];

/** A package with a `Data` sheet and the given charts drawn on it (or on a second sheet, `Charts`, when `o.chartSheet`). */
export async function chartBook(placed: Placed[], o: { chartSheet?: boolean; theme?: boolean; sheetName?: string; narrow?: boolean } = {}): Promise<Uint8Array> {
  const data = o.sheetName ?? 'Data';
  const rows = [['Month', 'Sales', 'Costs', 'X'], ...MONTHS.map((m, i) => [m, SALES[i]!, COSTS[i]!, XS[i]!])];
  const sheetData = rows.map((r, i) => `<row r="${i + 1}">${r.map((v, j) => cell(`${'ABCD'[j]}${i + 1}`, v)).join('')}</row>`).join('')
    // filler from row 7, sixteen columns wide (A–P) unless `narrow`, so the charts sit on drawn cells
    + Array.from({ length: 30 }, (_, k) => `<row r="${k + 7}">${Array.from({ length: o.narrow ? 1 : 16 }, (_, c) => `<c r="${String.fromCharCode(65 + c)}${k + 7}"><v>${k}</v></c>`).join('')}</row>`).join('');
  const drawingSheet = o.chartSheet ? 2 : 1;
  const sheets = o.chartSheet ? [data, 'Charts'] : [data];
  const files: Record<string, string> = {
    '[Content_Types].xml': `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>${placed.map((_, i) => `<Override PartName="/xl/charts/chart${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`).join('')}${o.theme ? '<Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' : ''}</Types>`,
    '_rels/.rels': `<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${NS}" xmlns:r="${R}"><sheets>${sheets.map((n, i) => `<sheet name="${xe(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${PR}">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}${o.theme ? `<Relationship Id="rId9" Type="${R}/theme" Target="theme/theme1.xml"/>` : ''}</Relationships>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${NS}" xmlns:r="${R}"><sheetData>${sheetData}</sheetData>${drawingSheet === 1 ? '<drawing r:id="rId1"/>' : ''}</worksheet>`,
    [`xl/worksheets/_rels/sheet${drawingSheet}.xml.rels`]: `<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`,
    'xl/drawings/drawing1.xml': `<?xml version="1.0"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="${A}" xmlns:r="${R}">${placed.map((p, i) => frameXml(i, p)).join('')}</xdr:wsDr>`,
    'xl/drawings/_rels/drawing1.xml.rels': `<Relationships xmlns="${PR}">${placed.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${R}/chart" Target="../charts/chart${i + 1}.xml"/>`).join('')}</Relationships>`,
  };
  if (o.chartSheet) files['xl/worksheets/sheet2.xml'] = `<worksheet xmlns="${NS}" xmlns:r="${R}"><sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData><drawing r:id="rId1"/></worksheet>`;
  if (o.theme) files['xl/theme/theme1.xml'] = THEME;
  placed.forEach((p, i) => { files[`xl/charts/chart${i + 1}.xml`] = typeof p.chart === 'string' ? p.chart : chartXml(p.chart); });
  return writeZip(Object.entries(files).map(([name, d]) => ({ name, data: utf8(d) })));
}

/** The common series: Sales and Costs by month, on the `Data` sheet. */
export const sales = (o: Partial<SerSpec> = {}): SerSpec => ({ name: 'Sales', nameRef: 'Data!$B$1', catRef: 'Data!$A$2:$A$5', cats: MONTHS, valRef: 'Data!$B$2:$B$5', vals: SALES, ...o });
export const costs = (o: Partial<SerSpec> = {}): SerSpec => ({ name: 'Costs', nameRef: 'Data!$C$1', catRef: 'Data!$A$2:$A$5', cats: MONTHS, valRef: 'Data!$C$2:$C$5', vals: COSTS, ...o });

export const frame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
export async function until(cond: () => boolean, ms = 5000): Promise<void> {
  const t0 = performance.now();
  while (!cond()) {
    if (performance.now() - t0 > ms) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 15));
  }
}

export const shadow = (el: Element) => el.shadowRoot!;
export const cellEl = (el: Element, r: number, c: number) => shadow(el).getElementById(`c${r}_${c}`) as HTMLElement;
export const olays = (el: Element) => Array.from(shadow(el).querySelectorAll<HTMLElement>('.overlay .plug .olay'));
export const olay = (el: Element, n = 0) => olays(el)[n]!;
export const chartEl = (el: Element, n = 0) => olay(el, n).querySelector<HTMLElement>('.sp-chart')!;
export const svgOf = (el: Element, n = 0) => olay(el, n).querySelector<SVGSVGElement>('svg.sp-chart-svg')!;

export function mount(): SheetpaneExcel {
  const el = document.createElement('sheetpane-excel');
  el.style.height = '700px';
  document.body.append(el);
  return el;
}
export const cleanup = () => document.body.replaceChildren();
