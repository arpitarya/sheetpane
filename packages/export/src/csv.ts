// toCsv: one sheet in, RFC 4180 text out (export verdict decision 8).
import { cellRef } from './refs.js';
import type { Cell, Sheet } from './types.js';

/** Options for `toCsv`. */
export interface ToCsvOptions {
  /** Default `,`. */
  delimiter?: ',' | ';' | '\t';
  /** UTF-8 byte-order mark first, so Excel reads accents correctly. Default true. */
  bom?: boolean;
  /** The line ending, also written after the last line. Default `\r\n`. */
  eol?: '\r\n' | '\n';
  /** Prefix `'` to text that a spreadsheet would run as a formula. Default true. */
  guardFormulas?: boolean;
}

/** Text that looks like a plain number is data, not a formula, even with a leading sign. */
const NUMBER_LIKE = /^(?=[^0-9]*[0-9])[+-]?(\d{1,3}(,\d{3})+|\d+)?([.,]\d+)?([eE][+-]?\d+)?%?$/;
const RISKY = /^[=+\-@\t\r]/;

function text(v: Cell): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return Object.is(v, -0) ? '0' : String(v);
  return v;
}

/**
 * Writes one sheet as RFC 4180 CSV that Excel opens with accents intact and formulas defused.
 * Ragged rows are padded to one width; booleans are `TRUE` / `FALSE`.
 *
 * @param sheet - The sheet to write; only its rows are read.
 * @param o - Delimiter, BOM, line ending and the formula guard.
 * @returns The CSV `text`, and the A1 refs of the cells the guard prefixed with `'`.
 * @example
 * ```ts
 * import { toCsv } from '@sheetpane/export';
 * const { text, guarded } = toCsv({ name: 'Sales', rows: [['Region', 'Total'], ['North', '=1+1']] });
 * // guarded is ['B2']
 * ```
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0103_EXPORT.md
 */
export function toCsv(sheet: Sheet, o: ToCsvOptions = {}): { text: string; guarded: string[] } {
  const d = o.delimiter ?? ',', eol = o.eol ?? '\r\n', guard = o.guardFormulas ?? true;
  const width = sheet.rows.reduce((w, r) => Math.max(w, r.length), 0);
  const guarded: string[] = [];
  const lines = sheet.rows.map((row, r) => {
    const out: string[] = [];
    for (let c = 0; c < width; c++) {
      const v = row[c] ?? null;
      let s = text(v);
      if (guard && typeof v === 'string' && RISKY.test(s) && !NUMBER_LIKE.test(s.trim())) {
        s = "'" + s;
        guarded.push(cellRef(r, c));
      }
      if (s.includes(d) || s.includes('"') || s.includes('\r') || s.includes('\n')) s = `"${s.replace(/"/g, '""')}"`;
      out.push(s);
    }
    return out.join(d);
  });
  const body = lines.length ? lines.join(eol) + eol : '';
  return { text: (o.bom ?? true ? '﻿' : '') + body, guarded };
}
