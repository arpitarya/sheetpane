// Tiny workbooks with formulas, written by hand: `toXlsx` writes no formulas.
import { utf8, writeZip } from '@sheetpane/export';
import { createWorkbook, type Plugin, type WorkbookStore } from '@sheetpane/grid';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';

/** A cell: a value, or `{ f, v }` — a formula and Excel's cached value (omit `v` for none). */
export type C = string | number | boolean | null | { f: string; v?: string | number | boolean; t?: 'e' | 'str' | 'b' };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const col = (i: number) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

function cellXml(ref: string, c: C): string {
  if (c === null) return '';
  if (typeof c === 'number') return `<c r="${ref}"><v>${c}</v></c>`;
  if (typeof c === 'boolean') return `<c r="${ref}" t="b"><v>${c ? 1 : 0}</v></c>`;
  if (typeof c === 'string') return `<c r="${ref}" t="inlineStr"><is><t>${esc(c)}</t></is></c>`;
  const t = c.t ?? (typeof c.v === 'string' ? 'str' : typeof c.v === 'boolean' ? 'b' : undefined);
  const v = c.v === undefined ? '' : `<v>${typeof c.v === 'boolean' ? (c.v ? 1 : 0) : esc(String(c.v))}</v>`;
  return `<c r="${ref}"${t ? ` t="${t}"` : ''}><f>${esc(c.f)}</f>${v}</c>`;
}

export function sheetXml(rows: C[][]): string {
  const body = rows.map((row, r) => `<row r="${r + 1}">${row.map((c, i) => cellXml(`${col(i)}${r + 1}`, c)).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS}" xmlns:r="${R}"><sheetData>${body}</sheetData></worksheet>`;
}

/** An .xlsx with one sheet per entry; `names` are defined names (`{ name: formula }`). */
export function book(sheets: Record<string, C[][]>, names: Record<string, string> = {}): Promise<Uint8Array> {
  const list = Object.keys(sheets);
  const dn = Object.keys(names).length ? `<definedNames>${Object.entries(names).map(([n, f]) => `<definedName name="${n}">${esc(f)}</definedName>`).join('')}</definedNames>` : '';
  const parts: Record<string, string> = {
    '[Content_Types].xml': `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${list.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels': `<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${NS}" xmlns:r="${R}"><sheets>${list.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${dn}<calcPr calcId="191029"/></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${PR}">${list.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
  };
  list.forEach((n, i) => { parts[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(sheets[n]!); });
  return writeZip(Object.entries(parts).map(([name, s]) => ({ name, data: utf8(s) })), { compression: 'store' });
}

export async function until(cond: () => boolean, ms = 10_000): Promise<void> {
  const t0 = performance.now();
  while (!cond()) {
    if (performance.now() - t0 > ms) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** A store with these plugins, the workbook loaded and the first recalculation done. */
export async function loaded(bytes: Uint8Array, plugins: Plugin[], name = 'book.xlsx'): Promise<WorkbookStore> {
  const store = createWorkbook({ plugins });
  await store.load(bytes, name);
  return store;
}

export const fromDataUrl = (u: string) => Uint8Array.from(atob(u.slice(u.indexOf(',') + 1)), (c) => c.charCodeAt(0));
