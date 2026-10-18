// Hand-written workbooks with notes, threaded comments, persons and the VML
// Excel pairs with them, zipped with @sheetpane/export's writeZip — no fixture
// generator, no extra dependency. Shapes follow what Excel writes (W-22 brief);
// fixtures saved by Excel itself are the decider's (W-30).
import { inflateEntry, readZip, writeZip } from '@sheetpane/export';
import { PLACEHOLDER } from '../src/index.js';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
const TC = 'http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments';

export type V = string | number | boolean | null;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function sheetData(cells: Record<string, V>): string {
  const rows = new Map<number, string[]>();
  for (const [ref, v] of Object.entries(cells)) {
    if (v === null) continue;
    const r = Number(/\d+/.exec(ref)![0]);
    const xml = typeof v === 'number' ? `<c r="${ref}"><v>${v}</v></c>` : typeof v === 'boolean' ? `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
    (rows.get(r) ?? rows.set(r, []).get(r)!).push(xml);
  }
  return `<sheetData>${[...rows].sort(([a], [b]) => a - b).map(([r, cs]) => `<row r="${r}">${cs.join('')}</row>`).join('')}</sheetData>`;
}

export interface NoteSpec { ref: string; author: string; text: string }
export interface ThreadSpec { id: string; ref: string; personId: string; parentId?: string; done?: boolean; text: string; dT?: string }
export interface SheetSpec { name: string; cells: Record<string, V>; notes?: NoteSpec[]; threads?: ThreadSpec[]; tail?: string }
export interface BookSpec { sheets: SheetSpec[]; persons?: { id: string; displayName: string }[] }

const pos = (ref: string) => { const m = /^([A-Z]+)(\d+)$/.exec(ref)!; return { row: Number(m[2]) - 1, col: [...m[1]!].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1 }; };
const shape = (id: number, ref: string) => { const p = pos(ref); return `<v:shape id="_x0000_s${id}" type="#_x0000_t202" style="position:absolute;visibility:hidden" fillcolor="infoBackground [80]" strokecolor="none [81]" o:insetmode="auto"><v:fill color2="infoBackground [80]"/><v:shadow color="none [81]" obscured="t"/><v:path o:connecttype="none"/><v:textbox style="mso-direction-alt:auto"><div style="text-align:left"/></v:textbox><x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/><x:Anchor>1, 15, 0, 2, 3, 15, 4, 4</x:Anchor><x:AutoFill>False</x:AutoFill><x:Row>${p.row}</x:Row><x:Column>${p.col}</x:Column></x:ClientData></v:shape>`; };

export async function workbook(spec: BookSpec): Promise<Uint8Array> {
  const ct: string[] = [`<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`];
  const wbRels = spec.sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`);
  const parts: Record<string, string> = {
    '_rels/.rels': `<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${NS}" xmlns:r="${R}"><sheets>${spec.sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
  };
  if (spec.persons) {
    parts['xl/persons/person.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<personList xmlns="${TC}" xmlns:x="${NS}">${spec.persons.map((p) => `<person displayName="${esc(p.displayName)}" id="${p.id}" userId="${esc(p.displayName)}" providerId="None"/>`).join('')}</personList>`;
    wbRels.push(`<Relationship Id="rId${spec.sheets.length + 1}" Type="http://schemas.microsoft.com/office/2017/10/relationships/person" Target="persons/person.xml"/>`);
    ct.push(`<Override PartName="/xl/persons/person.xml" ContentType="application/vnd.ms-excel.person+xml"/>`);
  }
  parts['xl/_rels/workbook.xml.rels'] = `<Relationships xmlns="${PR}">${wbRels.join('')}</Relationships>`;
  spec.sheets.forEach((s, i) => {
    const n = i + 1, rels: string[] = [];
    let legacy = '';
    const threads = s.threads ?? [], notes = s.notes ?? [];
    const roots = threads.filter((t) => !t.parentId);
    if (threads.length) {
      parts[`xl/threadedComments/threadedComment${n}.xml`] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<ThreadedComments xmlns="${TC}" xmlns:x="${NS}">${threads.map((t) => `<threadedComment ref="${t.ref}" dT="${t.dT ?? '2026-09-30T10:00:00.00'}" personId="${t.personId}" id="${t.id}"${t.parentId ? ` parentId="${t.parentId}"` : ''}${t.done ? ' done="1"' : ''}><text>${esc(t.text)}</text></threadedComment>`).join('')}</ThreadedComments>`;
      rels.push(`<Relationship Id="rId3" Type="http://schemas.microsoft.com/office/2017/10/relationships/threadedComment" Target="../threadedComments/threadedComment${n}.xml"/>`);
      ct.push(`<Override PartName="/xl/threadedComments/threadedComment${n}.xml" ContentType="application/vnd.ms-excel.threadedcomments+xml"/>`);
    }
    if (threads.length || notes.length) {
      const authors = [...new Set([...notes.map((x) => x.author), ...roots.map((t) => `tc=${t.id}`)])];
      const list = [
        ...notes.map((x) => `<comment ref="${x.ref}" authorId="${authors.indexOf(x.author)}"><text><r><t xml:space="preserve">${esc(x.text)}</t></r></text></comment>`),
        ...roots.map((t) => `<comment ref="${t.ref}" authorId="${authors.indexOf(`tc=${t.id}`)}" shapeId="0"><text><t xml:space="preserve">${esc(`${PLACEHOLDER}\n\nComment:\n    ${t.text}`)}</t></text></comment>`),
      ];
      parts[`xl/comments${n}.xml`] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<comments xmlns="${NS}"><authors>${authors.map((a) => `<author>${esc(a)}</author>`).join('')}</authors><commentList>${list.join('')}</commentList></comments>`;
      const refs = [...notes.map((x) => x.ref), ...roots.map((t) => t.ref)];
      parts[`xl/drawings/vmlDrawing${n}.vml`] = `<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="${n}"/></o:shapelayout><v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>${refs.map((r, k) => shape(n * 1024 + 1 + k, r)).join('')}</xml>`;
      rels.push(`<Relationship Id="rId1" Type="${R}/comments" Target="../comments${n}.xml"/>`, `<Relationship Id="rId2" Type="${R}/vmlDrawing" Target="../drawings/vmlDrawing${n}.vml"/>`);
      ct.push(`<Override PartName="/xl/comments${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/>`);
      legacy = '<legacyDrawing r:id="rId2"/>';
    }
    parts[`xl/worksheets/sheet${n}.xml`] = `<worksheet xmlns="${NS}" xmlns:r="${R}">${sheetData(s.cells)}${legacy}${s.tail ?? ''}</worksheet>`;
    if (rels.length) parts[`xl/worksheets/_rels/sheet${n}.xml.rels`] = `<Relationships xmlns="${PR}">${rels.join('')}</Relationships>`;
  });
  const vml = spec.sheets.some((s) => s.notes?.length || s.threads?.length) ? `<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>` : '';
  parts['[Content_Types].xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${vml}${ct.join('')}</Types>`;
  const enc = (s: string) => new TextEncoder().encode(s);
  return writeZip(Object.entries(parts).map(([name, s]) => ({ name, data: enc(s) })));
}

/** Every part of a package, as text. */
export async function unzip(bytes: Uint8Array): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const e of readZip(bytes)) out.set(e.name, new TextDecoder().decode(await inflateEntry(bytes, e, { maxEntrySize: 1e8, maxTotalSize: 1e9 })));
  return out;
}

/** Parses XML; throws with the parser's message when it is not well-formed. */
export function parseXml(xml: string, name = 'part'): Document {
  const d = new DOMParser().parseFromString(xml, 'application/xml');
  const err = d.getElementsByTagName('parsererror')[0];
  if (err) throw new Error(`${name} is not well-formed: ${err.textContent}`);
  return d;
}

export const fromDataUrl = (u: string) => Uint8Array.from(atob(u.slice(u.indexOf(',') + 1)), (c) => c.charCodeAt(0));
export const blobBytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
export const frame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
