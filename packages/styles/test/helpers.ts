import { readZip, inflateEntry, utf8, fromUtf8, writeZip } from '@sheetpane/export';
import { fromXlsx } from '@sheetpane/import';
import { createWorkbook, type Plugin, type SheetpaneExcel, type WorkbookStore } from '@sheetpane/grid';
import features from '../../import/test/fixtures/exceljs-features.xlsx?inline';

export const fromDataUrl = (u: string) => Uint8Array.from(atob(u.slice(u.indexOf(',') + 1)), (c) => c.charCodeAt(0));
/** ExcelJS fixture: Holdings!A3 bold, colour FF2346C8, fill FFFFF2CC, bottom thin border; A1:E1 merged and centred. */
export const featuresXlsx = () => fromDataUrl(features);

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';

/** The Office 2013+ theme's colour scheme, in a minimal theme part. `over` replaces scheme entries by name. */
export function themeXml(over: Record<string, string> = {}): string {
  const c: Record<string, string> = { dk1: '000000', lt1: 'FFFFFF', dk2: '44546A', lt2: 'E7E6E6', accent1: '4472C4', accent2: 'ED7D31', accent3: 'A5A5A5', accent4: 'FFC000', accent5: '5B9BD5', accent6: '70AD47', hlink: '0563C1', folHlink: '954F72', ...over };
  const el = (n: string) => n === 'dk1' || n === 'lt1' ? `<a:${n}><a:sysClr val="${n === 'dk1' ? 'windowText' : 'window'}" lastClr="${c[n]}"/></a:${n}>` : `<a:${n}><a:srgbClr val="${c[n]}"/></a:${n}>`;
  return `<?xml version="1.0"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="T"><a:themeElements><a:clrScheme name="T">${['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'].map(el).join('')}</a:clrScheme></a:themeElements></a:theme>`;
}

export interface HandMade {
  /** `<sheetData>` inner XML. */
  rows: string;
  /** styles.xml inner sections (fonts, fills, borders, cellXfs, …); omitted = no styles part at all. */
  styles?: string;
  theme?: string;
  /** Extra worksheet XML after sheetData. */
  after?: string;
}

/** A hand-written one-sheet package ("Data"), zipped with @sheetpane/export's writer. */
export async function handMade(o: HandMade): Promise<Uint8Array> {
  const rels = [`<Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/>`];
  const types = ['<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>', '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'];
  const parts: Record<string, string> = {
    '_rels/.rels': `<?xml version="1.0"?><Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0"?><workbook xmlns="${NS}" xmlns:r="${R}"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/worksheets/sheet1.xml': `<?xml version="1.0"?><worksheet xmlns="${NS}" xmlns:r="${R}"><sheetData>${o.rows}</sheetData>${o.after ?? ''}</worksheet>`,
  };
  if (o.styles !== undefined) {
    parts['xl/styles.xml'] = `<?xml version="1.0"?><styleSheet xmlns="${NS}">${o.styles}</styleSheet>`;
    rels.push(`<Relationship Id="rId2" Type="${R}/styles" Target="styles.xml"/>`);
    types.push('<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>');
  }
  if (o.theme !== undefined) {
    parts['xl/theme/theme1.xml'] = o.theme;
    rels.push(`<Relationship Id="rId3" Type="${R}/theme" Target="theme/theme1.xml"/>`);
    types.push('<Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>');
  }
  parts['xl/_rels/workbook.xml.rels'] = `<?xml version="1.0"?><Relationships xmlns="${PR}">${rels.join('')}</Relationships>`;
  parts['[Content_Types].xml'] = `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${types.join('')}</Types>`;
  return writeZip(Object.entries(parts).map(([name, s]) => ({ name, data: utf8(s) })));
}

/** The default sections Excel writes: font 0 Calibri 11 (theme 1), fills none + gray125, an empty border, xf 0. `extra` adds xfs after 0. */
export function stylesWith(o: { fonts?: string[]; fills?: string[]; borders?: string[]; xfs?: string[]; dxfs?: string; indexed?: string }): string {
  const fonts = ['<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>', ...(o.fonts ?? [])];
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>', ...(o.fills ?? [])];
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>', ...(o.borders ?? [])];
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>', ...(o.xfs ?? [])];
  return `<fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>${o.dxfs ?? ''}${o.indexed ? `<colors><indexedColors>${o.indexed}</indexedColors></colors>` : ''}`;
}

/** A row of cells `A1, B1, …` with `s` = 1, 2, … (one per extra xf). */
export const styledRow = (n: number, row = 1) => `<row r="${row}">${Array.from({ length: n }, (_, i) => `<c r="${String.fromCharCode(65 + i)}${row}" s="${i + 1}" t="inlineStr"><is><t>x</t></is></c>`).join('')}</row>`;

export async function storeWith(bytes: Uint8Array, plugins: Plugin[], name = 'book.xlsx'): Promise<WorkbookStore> {
  const s = createWorkbook({ plugins });
  await s.load(bytes, name);
  return s;
}

/** Reads one part of a package as text. */
export async function partText(bytes: Uint8Array, path: string): Promise<string | undefined> {
  const e = readZip(bytes).find((x) => x.name === path);
  return e ? fromUtf8(await inflateEntry(bytes, e)) : undefined;
}

export async function exported(s: WorkbookStore): Promise<Uint8Array> {
  const { blob } = await s.exportFile();
  return new Uint8Array(await blob.arrayBuffer());
}
export const readBack = (b: Uint8Array) => fromXlsx(b);

export const frame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

export async function mount(s: WorkbookStore, mode: 'view' | 'edit' = 'edit'): Promise<SheetpaneExcel> {
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
