// The imported workbook after an insert or delete of rows or columns (W-52): a new
// ImportedWorkbook in which every table a plugin reads has moved — cells, display text,
// styles, formulas (every sheet's, and the defined names), merges, sizes, hidden and
// outline state, freeze, the autofilter, validations, conditional formats, drawings,
// notes, threaded comments, pivot tables, and the chart parts `part()` returns. The
// workbook given is never changed (SR-LAW-6: the upload stays as read).
import {
  cellRef, isInsertOp, isRowOp, parseRange, parseRef, rangeRef, restructureChartXml, restructureFormula, shiftCount, shiftIndex, shiftRangePos, shiftRefText, shiftSqref,
  fromUtf8, utf8, type StructureOp,
} from '@sheetpane/export';
import type { AnchorPoint, CfRule, ConditionalFormat, DataValidation, DrawingAnchor, ImportedSheet, ImportedWorkbook, OutlineEntry } from './types.js';

/** A cell key (`B3`) moved by the operation; undefined when deleted. */
function moveKey(ref: string, o: StructureOp): string | undefined {
  const p = parseRef(ref);
  if (!p) return ref;
  const rows = isRowOp(o);
  const i = shiftIndex(rows ? p.row : p.col, o);
  return i === undefined ? undefined : rows ? cellRef(i, p.col) : cellRef(p.row, i);
}

/** Inserts `count` fillers at `at`, or deletes `count` entries at `at` — only where the array reaches `at`. */
function spliceAxis<T>(list: T[], o: StructureOp, filler: () => T): T[] {
  const out = list.slice();
  if (out.length <= o.at) return out;
  if (isInsertOp(o)) out.splice(o.at, 0, ...Array.from({ length: o.count }, filler));
  else out.splice(o.at, o.count);
  return out;
}

/** A row as a read leaves it: it ends at its last value (a deleted column can leave empty cells at the end). */
function trimEnd<T>(row: (T | null)[]): (T | null)[] {
  let n = row.length;
  while (n > 0 && row[n - 1] === null) n--;
  return n === row.length ? row : row.slice(0, n);
}

/** A sparse per-index list (heights, widths, outline): its entries move, inserted indexes are empty. */
function spliceSparse<T>(list: readonly (T | undefined)[] | undefined, o: StructureOp): (T | undefined)[] {
  const out: (T | undefined)[] = [];
  (list ?? []).forEach((v, i) => { const j = shiftIndex(i, o); if (j !== undefined && v !== undefined) out[j] = v; });
  return out;
}

/** A sorted index list (hidden rows or columns) moved; deleted indexes go. */
const moveIndexes = (list: readonly number[] | undefined, o: StructureOp): number[] =>
  (list ?? []).flatMap((i) => { const j = shiftIndex(i, o); return j === undefined ? [] : [j]; });

/** An object keyed by A1 refs (styleIndex, formulas), rekeyed; `value` may change each entry. */
function rekey<T>(rec: Record<string, T>, o: StructureOp, value: (v: T) => T = (v) => v): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(rec)) { const n = moveKey(k, o); if (n !== undefined) out[n] = value(v); }
  return out;
}

/** A drawing point: a deleted row or column pulls it to the first row (column) after the gap, offset 0. */
function movePoint(p: AnchorPoint | undefined, o: StructureOp): AnchorPoint | undefined {
  if (!p) return p;
  const rows = isRowOp(o);
  const i = rows ? p.row : p.col;
  const j = shiftIndex(i, o);
  if (j !== undefined) return rows ? { ...p, row: j } : { ...p, col: j };
  return rows ? { ...p, row: o.at, rowOff: 0 } : { ...p, col: o.at, colOff: 0 };
}

function moveDrawing(d: DrawingAnchor, o: StructureOp): DrawingAnchor {
  if (d.anchor === 'absolute') return d;
  const out: DrawingAnchor = { ...d };
  const from = movePoint(d.from, o), to = d.anchor === 'twoCell' ? movePoint(d.to, o) : d.to;
  if (from) out.from = from;
  if (to) out.to = to;
  return out;
}

function moveRule(r: CfRule, host: string, o: StructureOp): CfRule {
  const out: CfRule = { ...r, formulas: r.formulas.map((f) => restructureFormula(f, host, o)) };
  const cfvo = <V extends { type: string; val?: string }>(list: V[]) => list.map((v) => (v.type === 'formula' && v.val !== undefined ? { ...v, val: restructureFormula(v.val, host, o) } : v));
  if (r.colorScale) out.colorScale = { ...r.colorScale, cfvo: cfvo(r.colorScale.cfvo) };
  if (r.dataBar) out.dataBar = { ...r.dataBar, cfvo: cfvo(r.dataBar.cfvo) };
  if (r.iconSet) out.iconSet = { ...r.iconSet, cfvo: cfvo(r.iconSet.cfvo) };
  return out;
}

/** The formula-bearing tables of a sheet that is not the operation's: only references to that sheet move. */
function otherSheet(s: ImportedSheet, o: StructureOp): ImportedSheet {
  const formulas = Object.fromEntries(Object.entries(s.formulas).map(([k, f]) => [k, restructureFormula(f, s.name, o)]));
  const dataValidations = s.dataValidations.map((d) => { const x = { ...d }; if (d.formula1 !== undefined) x.formula1 = restructureFormula(d.formula1, s.name, o); if (d.formula2 !== undefined) x.formula2 = restructureFormula(d.formula2, s.name, o); return x; });
  const conditionalFormats = s.conditionalFormats.map((c) => ({ ...c, rules: c.rules.map((r) => moveRule(r, s.name, o)) }));
  const pivotTables = s.pivotTables.map((p) => movePivotSource(p, o));
  return { ...s, formulas, dataValidations, conditionalFormats, pivotTables };
}

function movePivotSource<P extends { source?: { sheet: string; ref: string } }>(p: P, o: StructureOp): P {
  if (!p.source || p.source.sheet.toUpperCase() !== o.sheet.toUpperCase()) return p;
  const ref = shiftRefText(p.source.ref, o);
  return ref === undefined ? p : { ...p, source: { ...p.source, ref } };
}

/**
 * W-61: shift ImportedSheet.tables — the Excel tables @sheetpane/import reads once W-61 lands.
 * Until then a sheet has no `tables` field and this returns it as given; the orchestrator wires
 * the shift (each table's `ref` and autofilter through `shiftRangePos`, its columns on a column
 * operation) here after the merge.
 * @param s - The sheet, already shifted.
 * @param _o - The operation.
 * @returns The sheet with its tables moved.
 */
export function shiftTables(s: ImportedSheet, _o: StructureOp): ImportedSheet {
  return s;
}

/** The operation's own sheet, every table moved. */
function targetSheet(s: ImportedSheet, o: StructureOp): ImportedSheet {
  const rows = isRowOp(o);
  const out: ImportedSheet = { ...otherSheet(s, o) };
  out.rows = rows ? spliceAxis(s.rows, o, () => []) : s.rows.map((r) => trimEnd(spliceAxis(r, o, () => null)));
  out.text = rows ? spliceAxis(s.text, o, () => []) : s.text.map((r, i) => spliceAxis(r, o, () => '').slice(0, out.rows[i]?.length ?? 0));
  let last = out.rows.length; // and the sheet ends at its last row with a value, as a read leaves it
  while (last > 0 && !out.rows[last - 1]!.length) last--;
  if (last < out.rows.length) { out.rows = out.rows.slice(0, last); out.text = out.text.slice(0, last); }
  out.styleIndex = rekey(s.styleIndex, o);
  out.formulas = rekey(out.formulas, o);
  out.merges = (s.merges ?? []).flatMap((m) => { const r = shiftRefText(m, o); return r === undefined || !r.includes(':') ? [] : [r]; });
  out.freeze = rows ? { ...s.freeze, rows: shiftCount(s.freeze.rows, o) } : { ...s.freeze, cols: shiftCount(s.freeze.cols, o) };
  if (rows) {
    out.hiddenRows = moveIndexes(s.hiddenRows, o);
    out.rowOutline = spliceSparse<OutlineEntry>(s.rowOutline, o);
    out.rowHeights = spliceSparse<number>(s.rowHeights, o);
  } else {
    out.hiddenCols = moveIndexes(s.hiddenCols, o);
    out.colOutline = spliceSparse<OutlineEntry>(s.colOutline, o);
    if (s.columnWidths) out.columnWidths = spliceSparse<number>(s.columnWidths, o) as number[];
  }
  if (s.autoFilter !== undefined) {
    const r = parseRange(s.autoFilter), moved = r && shiftRangePos(r, o);
    if (moved) out.autoFilter = rangeRef(moved);
    else delete out.autoFilter;
  }
  out.dataValidations = out.dataValidations.flatMap((d): DataValidation[] => { const sq = shiftSqref(d.sqref, o); return sq.length ? [{ ...d, sqref: sq }] : []; });
  out.conditionalFormats = out.conditionalFormats.flatMap((c): ConditionalFormat[] => { const sq = shiftSqref(c.sqref, o); return sq.length ? [{ ...c, sqref: sq }] : []; });
  out.drawings = s.drawings.map((d) => moveDrawing(d, o));
  out.notes = s.notes.flatMap((n) => { const r = moveKey(n.ref, o); return r === undefined ? [] : [{ ...n, ref: r }]; });
  out.threadedComments = s.threadedComments.flatMap((t) => { const r = moveKey(t.ref, o); return r === undefined ? [] : [{ ...t, ref: r }]; });
  out.pivotTables = out.pivotTables.map((p) => { const r = shiftRefText(p.ref, o); return r === undefined ? p : { ...p, ref: r }; });
  return shiftTables(out, o);
}

/**
 * The workbook after one insert or delete of rows or columns: a new object, every table a plugin
 * reads moved, every formula in the workbook that points at the sheet rewritten (`#REF!` for a
 * deleted target), and `part()` returning chart parts with their series references moved. The
 * workbook given is not changed.
 *
 * It does not refuse anything: a caller that must not split a merge, a table or a pivot checks
 * first (the grid's store does, W-52).
 *
 * @param book - The workbook as it is now.
 * @param o - The operation; `o.sheet` must name one of the workbook's sheets.
 * @returns The moved workbook, or the same object when the sheet is not in it.
 * @example
 * ```ts
 * import { read, restructureWorkbook } from '@sheetpane/import';
 * const book = await read(bytes, { name: 'q3.xlsx' });
 * const next = restructureWorkbook(book, { sheet: 'Data', op: 'insertRows', at: 4, count: 2 });
 * ```
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0104_IMPORT.md
 */
export function restructureWorkbook(book: ImportedWorkbook, o: StructureOp): ImportedWorkbook {
  const target = o.sheet.toUpperCase();
  if (!book.sheets.some((s) => s.name.toUpperCase() === target)) return book;
  const sheets = book.sheets.map((s) => (s.name.toUpperCase() === target ? targetSheet(s, o) : otherSheet(s, o)));
  const definedNames = book.definedNames.map((n) => {
    const host = n.localSheetId !== undefined ? book.sheets[n.localSheetId]?.name : undefined;
    const formula = restructureFormula(n.formula, host, o);
    return formula === n.formula ? n : { ...n, formula };
  });
  const prev = book.part;
  const part = async (path: string): Promise<Uint8Array | undefined> => {
    const bytes = await prev(path);
    if (!bytes || !/^xl\/charts\/[^/]+\.xml$/.test(path)) return bytes;
    const xml = fromUtf8(bytes), moved = restructureChartXml(xml, o);
    return moved === xml ? bytes : utf8(moved);
  };
  return { ...book, sheets, definedNames, part };
}
