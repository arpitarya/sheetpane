// The `exportPatch` half: after the core has written its changes (a `formula`
// change goes out as the inline string "=B3*C3"), rewrite those cells to `<f>`
// plus a cached `<v>`, and give every recalculated formula cell its new `<v>`.
// Pure string work on the worksheet XML; no WASM.
import type { Plugin } from '@sheetpane/grid';
import type { Cell } from './cells.js';
import { isError } from './cells.js';

export type PatchContext = Parameters<NonNullable<Plugin['exportPatch']>>[0];

/** One cell to rewrite: `formula` (without `=`) replaces the cell's `<f>`; `value` is the new cached `<v>`. */
export interface FormulaCell { formula?: string; value: Cell | undefined }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;');
// XML 1.0 forbids most C0 controls; a cached text value is not worth an unreadable file.
// eslint-disable-next-line no-control-regex
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');

function getAttr(attrs: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attrs);
  return m ? (m[1] ?? m[2] ?? '') : undefined;
}
function setAttr(attrs: string, name: string, value: string | undefined): string {
  const re = new RegExp(`\\s${name}\\s*=\\s*(?:"[^"]*"|'[^']*')`);
  const without = attrs.replace(re, '');
  return value === undefined ? without : `${without} ${name}="${escAttr(value)}"`;
}

/** `t` and the `<v>` text for a cached value. */
function cached(v: Cell): { t: string | undefined; v: string } | undefined {
  if (v === null) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? { t: undefined, v: String(Object.is(v, -0) ? 0 : v) } : undefined;
  if (typeof v === 'boolean') return { t: 'b', v: v ? '1' : '0' };
  if (isError(v)) return { t: 'e', v };
  return { t: 'str', v: esc(clean(v)) };
}

/** Rewrites the named cells of one worksheet; returns the XML and how many cells it rewrote. */
export function patchSheet(xml: string, cells: ReadonlyMap<string, FormulaCell>): { xml: string; count: number } {
  const P = /<(\w+:)?worksheet\b/.exec(xml)?.[1] ?? '';
  const re = new RegExp(`<${P}c\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${P}c>)`, 'g');
  const F = new RegExp(`<${P}f\\b[^>]*?(?:/>|>[\\s\\S]*?</${P}f>)`);
  const V = new RegExp(`<${P}v\\b[^>]*?(?:/>|>[\\s\\S]*?</${P}v>)`);
  let count = 0;
  const out = xml.replace(re, (whole, attrs: string, body: string | undefined) => {
    const r = getAttr(attrs, 'r');
    const it = r === undefined ? undefined : cells.get(r);
    if (!it) return whole;
    count++;
    const c = it.value === undefined ? undefined : cached(it.value);
    const v = c ? `<${P}v>${c.v}</${P}v>` : '';
    let inner: string;
    if (it.formula !== undefined) {
      inner = `<${P}f>${esc(clean(it.formula))}</${P}f>${v}`;
    } else {
      const f = body !== undefined ? F.exec(body)?.[0] : undefined;
      if (!f) return whole; // not a formula cell in the file: nothing of ours to write
      inner = body!.replace(new RegExp(`<${P}is\\b[\\s\\S]*?</${P}is>`), '');
      inner = V.test(inner) ? inner.replace(V, v) : inner.replace(f, f + v);
    }
    const a = setAttr(attrs, 't', c?.t);
    return `<${P}c${a}>${inner}</${P}c>`;
  });
  return { xml: out, count };
}

/** Elements that follow `<calcPr>` in CT_Workbook's sequence. */
const AFTER_CALCPR = ['oleSize', 'customWorkbookViews', 'pivotCaches', 'smartTagPr', 'smartTagTypes', 'webPublishing', 'fileRecoveryPr', 'webPublishObjects', 'extLst'];

/** `fullCalcOnLoad="1"` on `<calcPr>` — Excel re-verifies every value we cached. */
export function fullCalcOnLoad(wb: string): string {
  const P = /<(\w+:)?workbook\b/.exec(wb)?.[1] ?? '';
  const calc = new RegExp(`<${P}calcPr\\b([^>]*?)(/?)>`).exec(wb);
  if (calc) return getAttr(calc[1]!, 'fullCalcOnLoad') === '1' ? wb : wb.replace(calc[0], `<${P}calcPr${setAttr(calc[1]!, 'fullCalcOnLoad', '1')}${calc[2]}>`);
  const el = `<${P}calcPr fullCalcOnLoad="1"/>`;
  for (const n of AFTER_CALCPR) {
    const i = wb.search(new RegExp(`<${P}${n}\\b`));
    if (i >= 0) return wb.slice(0, i) + el + wb.slice(i);
  }
  const end = wb.lastIndexOf(`</${P}workbook>`);
  return end < 0 ? wb : wb.slice(0, end) + el + wb.slice(end);
}

/** Applies every sheet's cells inside `patchXlsx`; sets `fullCalcOnLoad` when anything was written. */
export async function patchWorkbook(patch: PatchContext, bySheet: ReadonlyMap<string, ReadonlyMap<string, FormulaCell>>): Promise<number> {
  let total = 0;
  for (const [sheet, cells] of bySheet) {
    if (!cells.size) continue;
    const path = patch.sheetPath(sheet);
    const xml = path ? await patch.readText(path) : undefined;
    if (!path || xml === undefined) continue;
    const r = patchSheet(xml, cells);
    if (r.count) { patch.write(path, r.xml); total += r.count; }
  }
  if (total) {
    const wbPath = patch.workbookPath();
    const wb = await patch.readText(wbPath);
    if (wb !== undefined) { const next = fullCalcOnLoad(wb); if (next !== wb) patch.write(wbPath, next); }
  }
  return total;
}
