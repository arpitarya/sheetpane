// Reading a workbook back as plain values, for assertions (W-41 DoD 4) — through
// @sheetpane/import, which reads .xlsx and .csv in a page and in Node alike (SR-IMPORT decision 8).
import { read } from '@sheetpane/import';

/** One cell's value as read back: text, a number, a boolean, or `null` for empty. */
export type Value = string | number | boolean | null;
/** A workbook as values: `sheets[name][A1] = value` (empty cells absent), sheet names in order. */
export interface Values { names: string[]; sheets: Record<string, Record<string, Value>> }

const colName = (i: number) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

/**
 * Reads `.xlsx` or `.csv` bytes into values. `name` tells the kind (default: by the ZIP signature).
 * `@sheetpane/import` reads it, in a page or in Node.
 *
 * @param bytes - The file's bytes, e.g. a `Download`'s.
 * @param name - The file name; its extension tells .xlsx from .csv.
 * @returns The workbook as values, sheet names in order.
 * @example
 * ```ts
 * import { readFile, valueAt } from '@sheetpane/testing';
 * const values = await readFile(bytes, 'sales.xlsx');
 * const total = valueAt(values, 'Sales!B2');
 * ```
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0118_TESTING.md
 */
export async function readFile(bytes: Uint8Array, name?: string): Promise<Values> {
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const fileName = name ?? (isZip ? 'workbook.xlsx' : 'data.csv');
  const book = await read(bytes, { name: fileName });
  const out: Values = { names: book.sheets.map((s) => s.name), sheets: {} };
  for (const s of book.sheets) {
    const m: Record<string, Value> = (out.sheets[s.name] = {});
    s.rows.forEach((row, r) => row.forEach((v, c) => { if (v !== null && v !== '') m[`${colName(c)}${r + 1}`] = v as Value; }));
  }
  return out;
}

/**
 * The cells whose value differs between two readings: `{ sheet, ref, was, now }`.
 *
 * @param before - The earlier reading.
 * @param after - The later reading.
 * @returns One entry per changed cell; an empty cell is `null`.
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0118_TESTING.md
 */
export function changesBetween(before: Values, after: Values): { sheet: string; ref: string; was: Value; now: Value }[] {
  const out: { sheet: string; ref: string; was: Value; now: Value }[] = [];
  for (const sheet of new Set([...before.names, ...after.names])) {
    const a = before.sheets[sheet] ?? {}, b = after.sheets[sheet] ?? {};
    for (const ref of new Set([...Object.keys(a), ...Object.keys(b)])) if ((a[ref] ?? null) !== (b[ref] ?? null)) out.push({ sheet, ref, was: a[ref] ?? null, now: b[ref] ?? null });
  }
  return out;
}

/**
 * `Sheet1!B2` → its value (`B2` alone means the first sheet).
 *
 * @param book - The values `readFile` returned.
 * @param address - An A1 address, with or without its sheet; `$` signs are ignored.
 * @returns The value, or `null` when the cell is empty.
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0118_TESTING.md
 */
export function valueAt(book: Values, address: string): Value {
  const i = address.lastIndexOf('!');
  const sheet = i < 0 ? book.names[0]! : address.slice(0, i).replace(/^'(.*)'$/, '$1').replace(/''/g, "'"), ref = address.slice(i + 1).replace(/\$/g, '');
  return book.sheets[sheet]?.[ref] ?? null;
}
