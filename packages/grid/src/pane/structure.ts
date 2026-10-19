// Rows and columns inserted or deleted (W-52), as the store applies them: what is refused, and
// how the store's own tables move — the change map, the errors, the derived values, the
// selection and the plugin-error index. The imported workbook itself moves through
// @sheetpane/import's restructureWorkbook; patchXlsx moves the file. Pure functions; the
// store owns the one commit path.
import {
  MAX_COLS, MAX_ROWS, cellRef, isInsertOp, isRowOp, movesRange, parseRange, parseRef, rangeRef, restructureFormula, shiftCount, shiftIndex, shiftRangePos, shiftRefText, splitsRange, tableRefusal,
  type SpCode, type StructureOp,
} from '@sheetpane/export';
import type { ImportedSheet, ImportedWorkbook } from '@sheetpane/import';
import type { ChangeEntry, Composing, DerivedCell, Selection, SheetpaneError } from './types.js';

/** The change-map ref that holds a sheet's operations, in order: `Sheet1!#structure`. */
export const STRUCTURE_REF = '#structure';

/** Why the store refuses an operation: its SP code and a sentence for the person. */
export interface StructureRefusal { code: SpCode; message: string }

const splitKey = (k: string) => { const i = k.lastIndexOf('!'); return { sheet: k.slice(0, i), ref: k.slice(i + 1) }; };
const what = (o: StructureOp) => `${o.count} ${isRowOp(o) ? 'row' : 'column'}${o.count === 1 ? '' : 's'}`;

/**
 * W-61: the Excel tables of a sheet, once @sheetpane/import reads them into `ImportedSheet.tables`.
 * Read defensively until then (the field does not exist yet), so the refusal below already applies
 * when it does.
 */
function tablesOf(s: ImportedSheet): { name?: string; ref: string; headerRowCount?: number; totalsRowCount?: number }[] {
  const t = (s as { tables?: unknown }).tables;
  return Array.isArray(t) ? (t as { name?: string; ref: string }[]).filter((x) => x && typeof x.ref === 'string') : [];
}

/**
 * What Excel refuses, sheetpane refuses (W-52 DoD 5): a delete that cuts a merged range (SP-3017),
 * anything that would move a pivot table or its source (SP-3018), an insert that would push cells
 * off the sheet (SP-3019), and a cut a table cannot follow (SP-3020).
 * @param book - The workbook.
 * @param merges - The sheet's merged ranges as they are now (the file's, with merge changes).
 * @param o - The operation.
 * @returns The refusal, or `undefined` when the operation may go ahead.
 */
export function structureRefusal(book: ImportedWorkbook, merges: readonly string[], o: StructureOp): StructureRefusal | undefined {
  const s = book.sheets.find((x) => x.name === o.sheet);
  if (!s) return undefined;
  if (!isInsertOp(o)) {
    const cut = merges.find((m) => { const r = parseRange(m); return r && splitsRange(r, o); });
    if (cut) return { code: 'SP-3017', message: `Deleting ${what(o)} would split the merged cells ${cut} — unmerge them first.` };
  }
  for (const sh of book.sheets) for (const p of sh.pivotTables) {
    const at = sh.name === o.sheet ? parseRange(p.ref) : undefined;
    if (at && movesRange(at, o)) return { code: 'SP-3018', message: `This would move the pivot table ${p.name || p.ref} — sheetpane does not rewrite pivot tables.` };
    const src = p.source && p.source.sheet.toUpperCase() === o.sheet.toUpperCase() ? parseRange(p.source.ref) : undefined;
    if (src && movesRange(src, o)) return { code: 'SP-3018', message: `This would move ${p.source!.ref}, the source of the pivot table ${p.name || p.ref} — sheetpane does not rewrite pivot sources.` };
  }
  if (isInsertOp(o)) {
    const used = isRowOp(o) ? s.rows.length : s.rows.reduce((m, r) => Math.max(m, r.length), 0);
    if (used > o.at && used + o.count > (isRowOp(o) ? MAX_ROWS : MAX_COLS)) return { code: 'SP-3019', message: `Inserting ${what(o)} would push cells off the end of the sheet.` };
  }
  for (const t of tablesOf(s)) {
    const r = parseRange(t.ref);
    const why = r && tableRefusal(r, o, { name: t.name ?? t.ref, header: (t.headerRowCount ?? 1) > 0, totals: (t.totalsRowCount ?? 0) > 0 });
    if (why) return { code: 'SP-3020', message: `This ${why}.` };
  }
  return undefined;
}

/** A cell ref moved; `undefined` when deleted. */
function moveCell(ref: string, o: StructureOp): string | undefined {
  const p = parseRef(ref);
  if (!p) return ref;
  const i = shiftIndex(isRowOp(o) ? p.row : p.col, o);
  return i === undefined ? undefined : isRowOp(o) ? cellRef(i, p.col) : cellRef(p.row, i);
}

const isFormula = (c: ChangeEntry) => c.kind === 'formula' || (c.kind === 'value' && typeof c.now === 'string' && c.now.startsWith('='));
const moveIndexes = (v: unknown, o: StructureOp) => (Array.isArray(v) ? (v as number[]).flatMap((i) => { const j = shiftIndex(i, o); return j === undefined ? [] : [j]; }) : v);
const moveLevels = (v: unknown, o: StructureOp) => {
  if (!v || typeof v !== 'object') return v;
  const out: Record<number, number> = {};
  for (const [k, l] of Object.entries(v as Record<number, number>)) { const j = shiftIndex(Number(k), o); if (j !== undefined) out[j] = l; }
  return out;
};
const moveFreeze = (v: unknown, o: StructureOp) => {
  const f = v as { rows: number; cols: number } | undefined;
  if (!f || typeof f !== 'object') return v;
  return isRowOp(o) ? { ...f, rows: shiftCount(f.rows, o) } : { ...f, cols: shiftCount(f.cols, o) };
};

/**
 * The change map after the operation: entries of the sheet rekeyed (deleted cells' entries go),
 * formulas everywhere that point at the sheet rewritten, sheet-wide entries (freeze, hidden,
 * outline) moved, and the operation appended to the sheet's `#structure` entry.
 * @param changes - The change map now.
 * @param o - The operation.
 * @returns A new change map.
 */
export function shiftChanges(changes: ReadonlyMap<string, ChangeEntry>, o: StructureOp): Map<string, ChangeEntry> {
  const out = new Map<string, ChangeEntry>();
  const rows = isRowOp(o);
  for (const [k, c] of changes) {
    const { sheet, ref } = splitKey(k);
    let next: ChangeEntry = c;
    if (isFormula(c)) { const f = String(c.now); const g = `=${restructureFormula(f.slice(1), sheet, o)}`; if (g !== f) next = { ...c, now: g }; }
    if (sheet !== o.sheet) { out.set(k, next); continue; }
    let key = ref;
    const slot = /^#(style|numFmt):(.+)$/.exec(ref);
    if (slot) { const m = moveCell(slot[2]!, o); if (m === undefined) continue; key = `#${slot[1]}:${m}`; }
    else if (ref.startsWith('#merge:')) { const m = shiftRefText(ref.slice(7), o); if (m === undefined || !m.includes(':')) continue; key = `#merge:${m}`; }
    else if (ref === '#freeze') next = { ...next, now: moveFreeze(next.now, o), was: moveFreeze(next.was, o) };
    else if (ref === (rows ? '#hiddenRows' : '#hiddenCols')) next = { ...next, now: moveIndexes(next.now, o), was: moveIndexes(next.was, o) };
    else if (ref === (rows ? '#outlineRows' : '#outlineCols')) next = { ...next, now: moveLevels(next.now, o), was: moveLevels(next.was, o) };
    else if (!ref.startsWith('#')) { const m = moveCell(ref, o); if (m === undefined) continue; key = m; }
    out.set(`${sheet}!${key}`, next);
  }
  const sk = `${o.sheet}!${STRUCTURE_REF}`, prev = out.get(sk);
  out.set(sk, { kind: 'structure', was: [], now: [...((prev?.now as StructureOp[] | undefined) ?? []), { sheet: o.sheet, op: o.op, at: o.at, count: o.count }] });
  return out;
}

/** Derived values keyed by cell, moved with their cells. */
export function shiftDerived(derived: ReadonlyMap<string, DerivedCell>, o: StructureOp): Map<string, DerivedCell> {
  const out = new Map<string, DerivedCell>();
  for (const [k, d] of derived) {
    const { sheet, ref } = splitKey(k);
    if (sheet !== o.sheet) { out.set(k, d); continue; }
    const m = moveCell(ref, o);
    if (m !== undefined) out.set(`${sheet}!${m}`, d);
  }
  return out;
}

/**
 * The errors after the operation: ranges on the sheet move; an error whose every cell was deleted
 * stays, `resolved`, with the message "row deleted" (or "column deleted"), its range as it was.
 * @param errors - The errors now.
 * @param o - The operation.
 * @returns The errors, and the ids of those whose cells were deleted.
 */
export function shiftErrors(errors: readonly SheetpaneError[], o: StructureOp): { errors: SheetpaneError[]; gone: Set<string> } {
  const gone = new Set<string>();
  const out = errors.map((e) => {
    if (e.sheet !== o.sheet) return e;
    const r = parseRange(e.range);
    if (!r) return e;
    const m = shiftRangePos(r, o);
    if (!m) { gone.add(e.id); return { ...e, status: 'resolved' as const, message: isRowOp(o) ? 'row deleted' : 'column deleted' }; }
    const range = e.range.includes(':') ? `${cellRef(m.top, m.left)}:${cellRef(m.bottom, m.right)}` : rangeRef(m);
    return range === e.range ? e : { ...e, range };
  });
  return { errors: out, gone };
}

/**
 * The plugin-error index (`plugin|sheet|range|type…` → id) with each key's range following its
 * error, so `validate` finds the moved error rather than adding a second one.
 * @param index - The index now.
 * @param before - The errors before the operation.
 * @param after - The errors after it.
 * @param gone - Ids of errors whose cells were deleted: their keys go.
 * @returns A new index.
 */
export function shiftPluginErrors(index: ReadonlyMap<string, string>, before: readonly SheetpaneError[], after: readonly SheetpaneError[], gone: ReadonlySet<string>): Map<string, string> {
  const was = new Map(before.map((e) => [e.id, e])), now = new Map(after.map((e) => [e.id, e]));
  const out = new Map<string, string>();
  for (const [k, id] of index) {
    if (gone.has(id)) continue;
    const a = was.get(id), b = now.get(id);
    if (!a || !b || a.range === b.range) { out.set(k, id); continue; }
    const from = `|${a.sheet}|${a.range}|`, i = k.indexOf(from);
    out.set(i < 0 ? k : `${k.slice(0, i)}|${b.sheet}|${b.range}|${k.slice(i + from.length)}`, id);
  }
  return out;
}

/** The selection after the operation: it moves with its cells; a deleted active cell lands on the row (column) that took its place. */
export function shiftSelection(sel: Selection, o: StructureOp): Selection {
  if (sel.sheet !== o.sheet) return sel;
  const p = parseRef(sel.ref);
  if (!p) return sel;
  const clamp = (i: number) => shiftIndex(i, o) ?? Math.max(0, Math.min(o.at, i));
  const ref = isRowOp(o) ? cellRef(clamp(p.row), p.col) : cellRef(p.row, clamp(p.col));
  const next: Selection = { sheet: sel.sheet, ref };
  const r = sel.range ? parseRange(sel.range) : undefined;
  const m = r && shiftRangePos(r, o);
  if (m && (m.top !== m.bottom || m.left !== m.right)) next.range = `${cellRef(m.top, m.left)}:${cellRef(m.bottom, m.right)}`;
  return next;
}

/** The open Flag issue form follows its cell, or closes when the cell was deleted. */
export function shiftComposing(c: Composing | null, o: StructureOp): Composing | null {
  if (!c || c.sheet !== o.sheet) return c;
  const ref = moveCell(c.ref, o);
  if (ref === undefined) return null;
  const next: Composing = { sheet: c.sheet, ref };
  const r = c.range ? parseRange(c.range) : undefined, m = r && shiftRangePos(r, o);
  if (m) next.range = rangeRef(m);
  return next;
}
