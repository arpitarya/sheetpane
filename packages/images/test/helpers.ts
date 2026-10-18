import { writeZip } from '@sheetpane/export';
import '@sheetpane/grid';
import type { SheetpaneExcel } from '@sheetpane/grid';

export const fromDataUrl = (u: string) => Uint8Array.from(atob(u.slice(u.indexOf(',') + 1)), (c) => c.charCodeAt(0));
export const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const utf8 = (s: string) => new TextEncoder().encode(s);

/** 1×1 images, each in the format its name says. */
export const PNG = b64('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
export const GIF = b64('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
export const SVG = utf8('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#2346C8"/></svg>');
/** A 1×1 24-bit BMP. */
export const BMP = (() => {
  const b = new Uint8Array(58), v = new DataView(b.buffer);
  b.set([0x42, 0x4d]); v.setUint32(2, 58, true); v.setUint32(10, 54, true);
  v.setUint32(14, 40, true); v.setInt32(18, 1, true); v.setInt32(22, 1, true); v.setUint16(26, 1, true); v.setUint16(28, 24, true); v.setUint32(34, 4, true);
  b.set([200, 70, 35], 54);
  return b;
})();
/** Enough of an EMF header to be one: " EMF" at byte 40. */
export const EMF = (() => { const b = new Uint8Array(88); b.set([1, 0, 0, 0, 88, 0, 0, 0]); b.set([0x20, 0x45, 0x4d, 0x46], 40); return b; })();

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';

const point = (c: number, co: number, r: number, ro: number) => `<xdr:col>${c}</xdr:col><xdr:colOff>${co}</xdr:colOff><xdr:row>${r}</xdr:row><xdr:rowOff>${ro}</xdr:rowOff>`;
const pic = (id: number, name: string, descr: string, rid: string) =>
  `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${id}" name="${name}"${descr ? ` descr="${descr}"` : ''}/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr/></xdr:pic>`;

export interface Pic { name: string; descr?: string; media: string; bytes: Uint8Array; at: 'one' | 'two' | 'abs'; from?: [number, number, number, number]; to?: [number, number, number, number]; pos?: [number, number]; ext?: [number, number] }

/** A one-sheet package whose drawing holds the given pictures. Sizes and offsets are in EMU, cells zero-based. */
export async function pictureBook(pics: Pic[], o: { sheet?: string } = {}): Promise<Uint8Array> {
  const anchors = pics.map((p, i) => {
    const body = pic(i + 1, p.name, p.descr ?? '', `rId${i + 1}`);
    if (p.at === 'two') return `<xdr:twoCellAnchor><xdr:from>${point(...p.from!)}</xdr:from><xdr:to>${point(...p.to!)}</xdr:to>${body}<xdr:clientData/></xdr:twoCellAnchor>`;
    if (p.at === 'one') return `<xdr:oneCellAnchor><xdr:from>${point(...p.from!)}</xdr:from><xdr:ext cx="${p.ext![0]}" cy="${p.ext![1]}"/>${body}<xdr:clientData/></xdr:oneCellAnchor>`;
    return `<xdr:absoluteAnchor><xdr:pos x="${p.pos![0]}" y="${p.pos![1]}"/><xdr:ext cx="${p.ext![0]}" cy="${p.ext![1]}"/>${body}<xdr:clientData/></xdr:absoluteAnchor>`;
  }).join('');
  const rows = Array.from({ length: 30 }, (_, r) => `<row r="${r + 1}">${Array.from({ length: 12 }, (_, c) => `<c r="${String.fromCharCode(65 + c)}${r + 1}"><v>${r * 12 + c}</v></c>`).join('')}</row>`).join('');
  const files: Record<string, Uint8Array | string> = {
    '[Content_Types].xml': `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="svg" ContentType="image/svg+xml"/><Default Extension="bmp" ContentType="image/bmp"/><Default Extension="emf" ContentType="image/x-emf"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`,
    '_rels/.rels': `<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${NS}" xmlns:r="${R}"><sheets><sheet name="${o.sheet ?? 'Pics'}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${NS}" xmlns:r="${R}"><sheetData>${rows}</sheetData><drawing r:id="rId1"/></worksheet>`,
    'xl/worksheets/_rels/sheet1.xml.rels': `<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`,
    'xl/drawings/drawing1.xml': `<?xml version="1.0"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${R}">${anchors}</xdr:wsDr>`,
    'xl/drawings/_rels/drawing1.xml.rels': `<Relationships xmlns="${PR}">${pics.map((p, i) => `<Relationship Id="rId${i + 1}" Type="${R}/image" Target="../media/${p.media}"/>`).join('')}</Relationships>`,
  };
  for (const p of pics) files[`xl/media/${p.media}`] = p.bytes;
  return writeZip(Object.entries(files).map(([name, d]) => ({ name, data: typeof d === 'string' ? utf8(d) : d })));
}

export const frame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
export async function until(cond: () => boolean, ms = 4000): Promise<void> {
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

export function mount(): SheetpaneExcel {
  const el = document.createElement('sheetpane-excel');
  el.style.height = '600px';
  document.body.append(el);
  return el;
}
export const cleanup = () => document.body.replaceChildren();
