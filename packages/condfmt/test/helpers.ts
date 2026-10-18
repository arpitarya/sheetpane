// Hand-written workbooks: cells, cell formats, dxfs and `<conditionalFormatting>`,
// zipped with @sheetpane/export's writeZip — no fixture generator, no dependency.
import { utf8, writeZip } from '@sheetpane/export';
import { createWorkbook, type Plugin, type SheetpaneExcel, type StyleSubset, type WorkbookStore } from '@sheetpane/grid';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';

export type V = string | number | boolean | null;
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** One `<conditionalFormatting>` block: its ranges and its `<cfRule>` elements (raw XML). */
export interface Block { sqref: string; rules: string[] }

export interface SheetSpec {
  name?: string;
  cells: Record<string, V>;
  /** Formula cells: ref → formula (without `=`); the cell's `cells` entry is its cached value. */
  formulas?: Record<string, string>;
  /** Cell format index (`s`) per cell. */
  s?: Record<string, number>;
  cf?: Block[];
}

export interface BookSpec {
  sheets: SheetSpec[];
  /** `<dxf>` inner XML, one per dxf. */
  dxfs?: string[];
  fonts?: string[];
  fills?: string[];
  borders?: string[];
  /** Extra `<xf>`s after xf 0. */
  xfs?: string[];
}

const ERR = /^#(NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A)$/;
function cellXml(ref: string, v: V, f: string | undefined, s: number | undefined): string {
  const sa = s !== undefined ? ` s="${s}"` : '';
  const fx = f !== undefined ? `<f>${esc(f)}</f>` : '';
  if (v === null) return f !== undefined || s !== undefined ? `<c r="${ref}"${sa}>${fx}</c>` : '';
  if (typeof v === 'number') return `<c r="${ref}"${sa}>${fx}<v>${v}</v></c>`;
  if (typeof v === 'boolean') return `<c r="${ref}"${sa} t="b">${fx}<v>${v ? 1 : 0}</v></c>`;
  if (ERR.test(v)) return `<c r="${ref}"${sa} t="e">${fx}<v>${esc(v)}</v></c>`;
  if (f !== undefined) return `<c r="${ref}"${sa} t="str">${fx}<v>${esc(v)}</v></c>`;
  return `<c r="${ref}"${sa} t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
}

function sheetData(o: SheetSpec): string {
  const refs = new Set([...Object.keys(o.cells), ...Object.keys(o.formulas ?? {}), ...Object.keys(o.s ?? {})]);
  const rows = new Map<number, { col: string; xml: string }[]>();
  for (const ref of refs) {
    const m = /^([A-Z]+)(\d+)$/.exec(ref)!;
    const xml = cellXml(ref, o.cells[ref] ?? null, o.formulas?.[ref], o.s?.[ref]);
    if (!xml) continue;
    const r = Number(m[2]);
    (rows.get(r) ?? rows.set(r, []).get(r)!).push({ col: m[1]!, xml });
  }
  const order = (a: string, b: string) => a.length - b.length || a.localeCompare(b);
  return `<sheetData>${[...rows].sort(([a], [b]) => a - b).map(([r, cs]) => `<row r="${r}">${cs.sort((a, b) => order(a.col, b.col)).map((c) => c.xml).join('')}</row>`).join('')}</sheetData>`;
}

const cfXml = (blocks: Block[] = []) => blocks.map((b) => `<conditionalFormatting sqref="${b.sqref}">${b.rules.join('')}</conditionalFormatting>`).join('');

/** styles.xml: Excel's defaults (font 0 Calibri 11, theme 1; fills none + gray125; one empty border; xf 0), the extras, and the dxfs. */
function stylesXml(o: BookSpec): string {
  const fonts = ['<font><sz val="11"/><color theme="1"/><name val="Calibri"/></font>', ...(o.fonts ?? [])];
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>', ...(o.fills ?? [])];
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>', ...(o.borders ?? [])];
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>', ...(o.xfs ?? [])];
  const dxfs = o.dxfs ?? [];
  return `<?xml version="1.0"?><styleSheet xmlns="${NS}"><fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="${dxfs.length}">${dxfs.map((d) => `<dxf>${d}</dxf>`).join('')}</dxfs></styleSheet>`;
}

/** A hand-written package, zipped with @sheetpane/export's writer. */
export function workbook(o: BookSpec): Promise<Uint8Array> {
  const names = o.sheets.map((s, i) => s.name ?? (i ? `Sheet${i + 1}` : 'Data'));
  const parts: Record<string, string> = {
    '[Content_Types].xml': `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels': `<?xml version="1.0"?><Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0"?><workbook xmlns="${NS}" xmlns:r="${R}"><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0"?><Relationships xmlns="${PR}">${names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rIdS" Type="${R}/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': stylesXml(o),
  };
  o.sheets.forEach((s, i) => { parts[`xl/worksheets/sheet${i + 1}.xml`] = `<?xml version="1.0"?><worksheet xmlns="${NS}" xmlns:r="${R}">${sheetData(s)}${cfXml(s.cf)}</worksheet>`; });
  return writeZip(Object.entries(parts).map(([name, s]) => ({ name, data: utf8(s) })));
}

// ── the rules, as Excel writes them ───────────────────────────────────────
let pr = 0;
/** A fresh priority per call (Excel numbers rules 1, 2, 3 … across the sheet). Pass `priority` to set one. */
const prio = (p?: number) => p ?? ++pr;
const opt = (k: string, v: string | number | boolean | undefined) => (v === undefined ? '' : ` ${k}="${v === true ? 1 : v === false ? 0 : esc(String(v))}"`);
export interface RuleOpts { priority?: number; dxfId?: number; stopIfTrue?: boolean }
const head = (type: string, o: RuleOpts, extra = '') => `<cfRule type="${type}"${o.dxfId !== undefined ? ` dxfId="${o.dxfId}"` : ''} priority="${prio(o.priority)}"${o.stopIfTrue ? ' stopIfTrue="1"' : ''}${extra}>`;

export const cellIs = (operator: string, f: string[], o: RuleOpts = {}) => `${head('cellIs', o, opt('operator', operator))}${f.map((x) => `<formula>${esc(x)}</formula>`).join('')}</cfRule>`;
/** `containsText`, `notContainsText`, `beginsWith`, `endsWith` with Excel's formula (`A1` is the range's top-left). */
export function textRule(type: 'containsText' | 'notContainsText' | 'beginsWith' | 'endsWith', text: string, at: string, o: RuleOpts = {}): string {
  const t = `"${text.replace(/"/g, '""')}"`;
  const f = type === 'containsText' ? `NOT(ISERROR(SEARCH(${t},${at})))` : type === 'notContainsText' ? `ISERROR(SEARCH(${t},${at}))` : type === 'beginsWith' ? `LEFT(${at},LEN(${t}))=${t}` : `RIGHT(${at},LEN(${t}))=${t}`;
  const op = type === 'containsText' ? 'containsText' : type === 'notContainsText' ? 'notContains' : type;
  return `${head(type, o, `${opt('operator', op)}${opt('text', text)}`)}<formula>${esc(f)}</formula></cfRule>`;
}
export const simple = (type: string, o: RuleOpts = {}, attrs: Record<string, string | number | boolean> = {}) => `${head(type, o, Object.entries(attrs).map(([k, v]) => opt(k, v)).join(''))}</cfRule>`;
export const expression = (f: string, o: RuleOpts = {}) => `${head('expression', o)}<formula>${esc(f)}</formula></cfRule>`;
export const top10 = (rank: number, a: { percent?: boolean; bottom?: boolean } = {}, o: RuleOpts = {}) => simple('top10', o, { rank, ...(a.percent ? { percent: true } : {}), ...(a.bottom ? { bottom: true } : {}) });
export interface Threshold { type: string; val?: string }
const cfvo = (t: Threshold) => `<cfvo type="${t.type}"${t.val !== undefined ? ` val="${esc(t.val)}"` : ''}/>`;
export const colorScale = (stops: [Threshold, string][], o: RuleOpts = {}) => `${head('colorScale', o)}<colorScale>${stops.map(([t]) => cfvo(t)).join('')}${stops.map(([, c]) => `<color rgb="FF${c}"/>`).join('')}</colorScale></cfRule>`;
export const dataBar = (min: Threshold, max: Threshold, color = '638EC6', o: RuleOpts & { minLength?: number; maxLength?: number } = {}) =>
  `${head('dataBar', o)}<dataBar${opt('minLength', o.minLength)}${opt('maxLength', o.maxLength)}>${cfvo(min)}${cfvo(max)}<color rgb="FF${color}"/></dataBar></cfRule>`;
export const iconSet = (o: RuleOpts = {}) => `${head('iconSet', o)}<iconSet iconSet="3Arrows"><cfvo type="percent" val="0"/><cfvo type="percent" val="33"/><cfvo type="percent" val="67"/></iconSet></cfRule>`;

/** Excel's "Light Red Fill with Dark Red Text" — the dxf its UI writes. */
export const RED_DXF = '<font><color rgb="FF9C0006"/></font><fill><patternFill><bgColor rgb="FFFFC7CE"/></patternFill></fill>';
/** "Green Fill with Dark Green Text". */
export const GREEN_DXF = '<font><color rgb="FF006100"/></font><fill><patternFill><bgColor rgb="FFC6EFCE"/></patternFill></fill>';
/** Bold only. */
export const BOLD_DXF = '<font><b/></font>';
/** A fill only. */
export const fillDxf = (rgb: string) => `<fill><patternFill><bgColor rgb="FF${rgb}"/></patternFill></fill>`;
export const RED = { color: '#9C0006', 'background-color': '#FFC7CE' };
export const GREEN = { color: '#006100', 'background-color': '#C6EFCE' };

export async function storeOf(bytes: Uint8Array | Promise<Uint8Array>, plugins: Plugin[], name = 'book.xlsx'): Promise<WorkbookStore> {
  const s = createWorkbook({ plugins });
  await s.load(await bytes, name);
  return s;
}

/** Every rule's CSS for a column of refs, as a list (for cell-by-cell comparison). */
export const decorations = (s: WorkbookStore, refs: string[], sheet = 'Data'): StyleSubset[] => refs.map((r) => s.decorate(sheet, r));
export const col = (letter: string, from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `${letter}${from + i}`);

export const frame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
export async function mount(s: WorkbookStore, mode: 'view' | 'edit' = 'view'): Promise<SheetpaneExcel> {
  const el = document.createElement('sheetpane-excel');
  el.style.height = '600px';
  el.setAttribute('mode', mode);
  document.body.append(el);
  el.workbook = s;
  s.setMode(mode);
  await frame();
  return el;
}
export const shadow = (el: Element) => el.shadowRoot!;
export const cellEl = (el: Element, r: number, c: number) => shadow(el).getElementById(`c${r}_${c}`) as HTMLElement | null;
/** `#FFC7CE` → `rgb(255, 199, 206)`, as the browser reports a colour. */
export const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
