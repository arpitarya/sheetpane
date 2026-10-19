// fromCsv: one CSV in, one sheet out (reading verdict decision 3): delimiter
// detected among , ; tab; UTF-8 with or without BOM; CRLF, LF, CR; RFC 4180 quotes.
import { MAX_COLS, MAX_ROWS, type Cell } from '@sheetpane/export';
import { ImportError } from './errors.js';
import type { ImportedWorkbook } from './types.js';

/** A CSV field separator sheetpane detects and reads. */
export type Delimiter = ',' | ';' | '\t';
/** Options for `fromCsv`. */
export interface CsvOptions {
  /** The file name; the sheet is named after it. */
  name?: string;
  /** Skips detection. */
  delimiter?: Delimiter;
}

const CANDIDATES: Delimiter[] = [',', ';', '\t'];

/** Field counts per line for one delimiter over the first `lines` records, quotes respected. */
function counts(text: string, d: string, lines: number): number[] {
  const out: number[] = [];
  let n = 1, q = false;
  for (let i = 0; i < text.length && out.length < lines; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') i++; else q = false; } continue; }
    if (ch === '"') q = true;
    else if (ch === d) n++;
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; out.push(n); n = 1; }
  }
  if (out.length < lines && text.length) out.push(n);
  return out;
}

/**
 * The delimiter that splits the first 20 lines most consistently into more than one field; `,` when none does.
 *
 * @param text - The CSV text.
 * @returns `,`, `;` or tab.
 */
export function detectDelimiter(text: string): Delimiter {
  let best: Delimiter = ',', bestScore = 0, bestWidth = 1;
  for (const d of CANDIDATES) {
    const c = counts(text, d, 20).filter((x, i, a) => !(i === a.length - 1 && x === 1 && a.length > 1));
    if (!c.length) continue;
    const freq = new Map<number, number>();
    for (const x of c) freq.set(x, (freq.get(x) ?? 0) + 1);
    const [width, hits] = [...freq].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]!;
    if (width < 2) continue;
    const score = hits / c.length;
    if (score > bestScore || (score === bestScore && width > bestWidth)) { best = d; bestScore = score; bestWidth = width; }
  }
  return best;
}

/**
 * Splits CSV text into rows of fields in one pass, RFC 4180: `""` inside quotes is a quote; a stray quote mid-field is kept as text.
 * CRLF, LF and CR all end a row; past Excel's limits it throws an `ImportError`.
 *
 * @param text - The CSV text, BOM already removed.
 * @param d - The delimiter.
 * @returns The rows, every field a string.
 */
export function parseCsv(text: string, d: Delimiter): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', q = false, quoted = false;
  const endField = () => { row.push(field); field = ''; quoted = false; };
  const endRow = () => {
    endField();
    if (rows.length >= MAX_ROWS) throw new ImportError('too-large', `the CSV has more than ${MAX_ROWS} rows — refused`);
    if (row.length > MAX_COLS) throw new ImportError('too-large', `row ${rows.length + 1} of the CSV has ${row.length} columns; the limit is ${MAX_COLS} — refused`);
    rows.push(row); row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
      continue;
    }
    if (ch === '"' && field === '' && !quoted) { q = true; quoted = true; }
    else if (ch === d) endField();
    else if (ch === '\r' || ch === '\n') { if (ch === '\r' && text[i + 1] === '\n') i++; endRow(); }
    else field += ch;
  }
  if (field !== '' || row.length || quoted) endRow();
  return rows;
}

/**
 * A sheet name from a file name: extension dropped, forbidden characters replaced, 31 characters at most.
 *
 * @param file - The file name or path, or `undefined`.
 * @returns The name; `Sheet1` when nothing is left.
 */
export function sheetNameFrom(file: string | undefined): string {
  const base = (file ?? '').replace(/^.*[\\/]/, '').replace(/\.csv$/i, '').replace(/[[\]:*?/\\]/g, '_').replace(/^'+|'+$/g, '').trim().slice(0, 31).trim();
  return base || 'Sheet1';
}

/**
 * Reads CSV text into a one-sheet workbook: the delimiter detected, the BOM dropped,
 * every cell text, an empty field `null`.
 *
 * @param input - The CSV text, or a Blob read as UTF-8.
 * @param o - The sheet's name and, to skip detection, the delimiter.
 * @returns The workbook, `source: 'csv'`, with the detected `delimiter`.
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0104_IMPORT.md
 */
export async function fromCsv(input: string | Blob, o: CsvOptions = {}): Promise<ImportedWorkbook> {
  let text = typeof input === 'string' ? input : new TextDecoder('utf-8').decode(await input.arrayBuffer());
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const delimiter = o.delimiter ?? detectDelimiter(text);
  const raw = parseCsv(text, delimiter);
  const rows: Cell[][] = raw.map((r) => (r.length === 1 && r[0] === '' ? [] : r.map((s) => (s === '' ? null : s))));
  const name = sheetNameFrom(o.name ?? (typeof File !== 'undefined' && input instanceof File ? input.name : undefined));
  return {
    sheets: [{
      name, rows, text: rows.map((r) => r.map((v) => (v === null ? '' : (v as string)))), path: '', merges: [], columnWidths: [], state: 'visible', hidden: false,
      styleIndex: {}, runs: {}, formulas: {}, freeze: { rows: 0, cols: 0 }, hiddenRows: [], hiddenCols: [], rowOutline: [], colOutline: [], outline: { levelRow: 0, levelCol: 0, summaryBelow: true, summaryRight: true }, rowHeights: [], defaultRowHeight: 15, defaultColWidth: undefined,
      dataValidations: [], conditionalFormats: [], drawings: [], notes: [], threadedComments: [], pivotTables: [], tables: [], rowStyles: [], colStyles: [],
    }],
    source: 'csv', activeSheet: 0, date1904: false,
    styles: { numFmts: {}, cellXfs: [], fonts: [], fills: [], borders: [], dxfs: [] },
    themeColors: [], persons: [], definedNames: [], delimiter,
    part: async () => undefined,
  };
}
