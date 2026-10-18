// Reading a workbook back as plain values, for assertions (W-41 DoD 4).
// Where a DOM exists (Vitest browser mode, a page) @sheetpane/import reads it; in Node
// — Playwright's test process — a values-only reader over @sheetpane/export's ZIP reader
// does, because the import package needs DOMParser for .xlsx (SP-1008).
import { inflateEntry, readZip } from '@sheetpane/export';
import { read } from '@sheetpane/import';

export type Value = string | number | boolean | null;
/** A workbook as values: `sheets[name][A1] = value` (empty cells absent), sheet names in order. */
export interface Values { names: string[]; sheets: Record<string, Record<string, Value>> }

const colName = (i: number) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const unesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');
const texts = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unesc(m[1]!)).join('');

/** Reads `.xlsx` or `.csv` bytes into values. `name` tells the kind (default: by the ZIP signature). */
export async function readFile(bytes: Uint8Array, name?: string): Promise<Values> {
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const fileName = name ?? (isZip ? 'workbook.xlsx' : 'data.csv');
  if (!isZip || typeof (globalThis as { DOMParser?: unknown }).DOMParser === 'function') {
    const book = await read(bytes, { name: fileName });
    const out: Values = { names: book.sheets.map((s) => s.name), sheets: {} };
    for (const s of book.sheets) {
      const m: Record<string, Value> = (out.sheets[s.name] = {});
      s.rows.forEach((row, r) => row.forEach((v, c) => { if (v !== null && v !== '') m[`${colName(c)}${r + 1}`] = v as Value; }));
    }
    return out;
  }
  // Node: the parts that hold values, read as text
  const entries = readZip(bytes);
  const text = async (path: string) => { const e = entries.find((x) => x.name === path); return e ? new TextDecoder().decode(await inflateEntry(bytes, e)) : ''; };
  const wb = await text('xl/workbook.xml'), rels = await text('xl/_rels/workbook.xml.rels');
  const shared = [...(await text('xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]!));
  const target = (id: string) => /Target="([^"]+)"/.exec([...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((r) => r.includes(`Id="${id}"`)) ?? '')?.[1] ?? '';
  const out: Values = { names: [], sheets: {} };
  for (const m of wb.matchAll(/<sheet\b[^>]*\bname="([^"]*)"[^>]*\br:id="([^"]+)"[^>]*\/?>/g)) {
    const name = unesc(m[1]!), path = target(m[2]!).replace(/^\/?(xl\/)?/, 'xl/');
    out.names.push(name);
    const cells: Record<string, Value> = (out.sheets[name] = {});
    const xml = await text(path);
    for (const c of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1]!, body = c[2] ?? '';
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1], t = /\bt="([^"]+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      if (!ref) continue;
      let val: Value = null;
      if (t === 'inlineStr') val = texts(body);
      else if (v === undefined) continue;
      else if (t === 's') val = shared[Number(v)] ?? '';
      else if (t === 'str' || t === 'e') val = unesc(v);
      else if (t === 'b') val = v === '1';
      else val = Number(v);
      if (val !== null && val !== '') cells[ref] = val;
    }
  }
  return out;
}

/** The cells whose value differs between two readings: `{ sheet, ref, was, now }`. */
export function changesBetween(before: Values, after: Values): { sheet: string; ref: string; was: Value; now: Value }[] {
  const out: { sheet: string; ref: string; was: Value; now: Value }[] = [];
  for (const sheet of new Set([...before.names, ...after.names])) {
    const a = before.sheets[sheet] ?? {}, b = after.sheets[sheet] ?? {};
    for (const ref of new Set([...Object.keys(a), ...Object.keys(b)])) if ((a[ref] ?? null) !== (b[ref] ?? null)) out.push({ sheet, ref, was: a[ref] ?? null, now: b[ref] ?? null });
  }
  return out;
}

/** `Sheet1!B2` → its value (`B2` alone means the first sheet). */
export function valueAt(book: Values, address: string): Value {
  const i = address.lastIndexOf('!');
  const sheet = i < 0 ? book.names[0]! : address.slice(0, i).replace(/^'(.*)'$/, '$1').replace(/''/g, "'"), ref = address.slice(i + 1).replace(/\$/g, '');
  return book.sheets[sheet]?.[ref] ?? null;
}
