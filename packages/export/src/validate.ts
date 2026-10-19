// Input rules (export verdict decision 9): sheet names, sizes, values, merges.
import { ExportError } from './errors.js';
import { checkConditionalFormats, checkDataValidations, checkDxfs } from './rules.js';
import { MAX_COLS, MAX_ROWS, cellRef, parseRange, rangesIntersect, type RangePos } from './refs.js';
import type { Cell, Sheet, Workbook } from './types.js';

export const MAX_TEXT = 32_767;

/**
 * Throws an `ExportError` unless the name is a valid sheet name: 1–31 characters, none of `[ ] : * ? / \`,
 * no apostrophe at either end, and unique ignoring case.
 *
 * @param name - The candidate name.
 * @param seen - Lower-cased names already used; the name is added when it passes.
 * @returns Nothing; on return `name` is known to be a string.
 */
export function checkSheetName(name: unknown, seen?: Set<string>): asserts name is string {
  if (typeof name !== 'string' || name.length < 1 || name.length > 31) {
    throw new ExportError('sheet-name', `sheet name ${JSON.stringify(name)} must be 1–31 characters`, { sheet: String(name) });
  }
  if (/[[\]:*?/\\]/.test(name)) throw new ExportError('sheet-name', `sheet name "${name}" may not contain [ ] : * ? / \\`, { sheet: name });
  if (name.startsWith("'") || name.endsWith("'")) throw new ExportError('sheet-name', `sheet name "${name}" may not start or end with an apostrophe`, { sheet: name });
  if (seen) {
    const k = name.toLowerCase();
    if (seen.has(k)) throw new ExportError('sheet-name', `sheet name "${name}" is used twice (names are compared ignoring case)`, { sheet: name });
    seen.add(k);
  }
}

export function checkCell(v: Cell, sheet: string, ref: string): void {
  if (v === null || typeof v === 'boolean') return;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new ExportError('bad-value', `${sheet}!${ref} holds ${v}, which a workbook cannot store`, { sheet, ref });
    return;
  }
  if (typeof v === 'string') {
    if (v.length > MAX_TEXT) throw new ExportError('bad-value', `${sheet}!${ref} holds ${v.length} characters; a cell holds at most ${MAX_TEXT}`, { sheet, ref });
    return;
  }
  throw new ExportError('bad-value', `${sheet}!${ref} holds a ${typeof v}; a cell is text, a number, a boolean or null`, { sheet, ref });
}

export function checkSheet(s: Sheet): RangePos[] {
  if (!Array.isArray(s.rows)) throw new ExportError('bad-value', `sheet "${s.name}" has no rows array`, { sheet: s.name });
  if (s.rows.length > MAX_ROWS) {
    throw new ExportError('too-large', `sheet "${s.name}" has ${s.rows.length} rows; the limit is ${MAX_ROWS} (first over: ${cellRef(MAX_ROWS, 0)})`, { sheet: s.name, ref: cellRef(MAX_ROWS, 0) });
  }
  s.rows.forEach((row, r) => {
    if (!Array.isArray(row)) throw new ExportError('bad-value', `sheet "${s.name}" row ${r + 1} is not an array`, { sheet: s.name });
    if (row.length > MAX_COLS) {
      throw new ExportError('too-large', `sheet "${s.name}" row ${r + 1} has ${row.length} columns; the limit is ${MAX_COLS} (first over: ${cellRef(r, MAX_COLS)})`, { sheet: s.name, ref: cellRef(r, MAX_COLS) });
    }
    row.forEach((v, c) => checkCell(v ?? null, s.name, cellRef(r, c)));
  });
  const merges: RangePos[] = [];
  for (const m of s.merges ?? []) {
    const r = parseRange(m);
    if (!r || !m.includes(':') || (r.top === r.bottom && r.left === r.right)) {
      throw new ExportError('bad-merge', `sheet "${s.name}" merge "${m}" is not a range of two or more cells`, { sheet: s.name, ref: m });
    }
    const clash = merges.find((x) => rangesIntersect(x, r));
    if (clash) throw new ExportError('bad-merge', `sheet "${s.name}" merges "${m}" overlaps another merge`, { sheet: s.name, ref: m });
    merges.push(r);
  }
  return merges;
}

export function checkWorkbook(book: Workbook): RangePos[][] {
  if (!book || !Array.isArray(book.sheets) || book.sheets.length === 0) throw new ExportError('sheet-count', 'a workbook needs at least one sheet');
  const seen = new Set<string>();
  for (const s of book.sheets) checkSheetName(s.name, seen);
  if (book.sheets.every((s) => s.hidden)) throw new ExportError('sheet-count', 'at least one sheet must be visible');
  checkDxfs(book.dxfs);
  return book.sheets.map((s) => {
    const merges = checkSheet(s);
    if (s.dataValidations !== undefined) checkDataValidations(s.dataValidations, s.name);
    if (s.conditionalFormats !== undefined) checkConditionalFormats(s.conditionalFormats, s.name, book.dxfs?.length ?? 0);
    return merges;
  });
}
