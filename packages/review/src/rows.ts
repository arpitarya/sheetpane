// Which errors the review lists, in which order, and the text of each row
// (W-59 DoD 1, 5). Pure functions over the store's errors: no XML here.
import { BUILTIN_TYPE_NAMES, DEFAULT_ERROR_TYPES, SEVERITY, errorScope, layerOf, type ProblemSeverity, type Severity, type SheetpaneError } from '@sheetpane/grid';
import { parseRange } from '@sheetpane/export';

/** The severities that are problems — what the review lists and colours unless `severities` names others. */
export const PROBLEM_SEVERITIES: readonly ProblemSeverity[] = ['error', 'warning', 'note'];

/** The Review sheet's columns, left to right. */
export const COLUMNS = ['ID', 'Sheet', 'Cell', 'Severity', 'Type', 'Found', 'Expected', 'Message', 'Author', 'Status', 'Accepted', 'Accepted by', 'Accepted at'] as const;

/** Column widths in Excel's character units, one per {@link COLUMNS} entry. */
export const WIDTHS: readonly number[] = [11, 16, 12, 10, 18, 18, 18, 60, 14, 10, 40, 14, 18];

/** One row of the Review sheet: the cells' text, and where the Cell column links to. */
export interface ReviewRow {
  /** The error. */
  error: SheetpaneError;
  /** One string per {@link COLUMNS} entry; `''` leaves the cell empty. */
  cells: string[];
  /** The internal hyperlink of the Cell column (`'Holdings'!I6`), or undefined for none. */
  link: string | undefined;
}

/** What the export lists. */
export interface Selection {
  /** The severities listed; default {@link PROBLEM_SEVERITIES}. */
  severities?: readonly Severity[] | undefined;
  /** The layers listed (an error with no `layer` is `review`); default every layer. */
  layers?: readonly string[] | undefined;
}

/** A sheet name quoted for a reference: `'Q3 ''final'''!`. */
export const quoteSheet = (name: string): string => `'${name.replace(/'/g, "''")}'`;

const typeName = (id: string) => DEFAULT_ERROR_TYPES.find((t) => t.id === id)?.name ?? BUILTIN_TYPE_NAMES[id] ?? id;
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
/** A severity's name as the panel shows it — `Passed` and `Not checked` for W-50's results; one from an old saved review that is no severity, capitalised. */
const severityName = (s: Severity): string => SEVERITY[s]?.name ?? cap(s);

/** `2026-10-19T09:12:00.000Z` → `2026-10-19 09:12 UTC`; anything unreadable as it is. */
export function when(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/**
 * The errors one export lists: not the file's own comments (`author: 'file'`), only the severities and layers
 * asked for; the workbook's errors first, then each sheet in the file's order — its whole-sheet errors, then its
 * cells top to bottom, left to right.
 *
 * @param errors - The store's errors.
 * @param sel - The severities and layers to list.
 * @param sheetOrder - The file's sheet names, in order.
 * @returns The errors to list, in order.
 */
export function selectErrors(errors: readonly SheetpaneError[], sel: Selection, sheetOrder: readonly string[]): SheetpaneError[] {
  const sev = new Set(sel.severities ?? PROBLEM_SEVERITIES);
  const layers = sel.layers ? new Set(sel.layers) : undefined;
  const picked = errors.filter((e) => e.author !== 'file' && sev.has(e.severity) && (!layers || layers.has(layerOf(e))));
  const sheetIx = (s: string) => { const i = sheetOrder.indexOf(s); return i < 0 ? sheetOrder.length : i; };
  const key = (e: SheetpaneError): number[] => {
    const scope = errorScope(e);
    if (scope === 'workbook') return [0, 0, 0, 0];
    const r = scope === 'cell' ? parseRange(e.range) : undefined;
    return [1, sheetIx(e.sheet), scope === 'sheet' ? -1 : (r?.top ?? Number.MAX_SAFE_INTEGER), r?.left ?? 0];
  };
  const keyed = picked.map((e, i) => ({ e, i, k: key(e) }));
  keyed.sort((a, b) => a.k[0]! - b.k[0]! || a.k[1]! - b.k[1]! || (a.k[1] === sheetOrder.length ? a.e.sheet.localeCompare(b.e.sheet) : 0) || a.k[2]! - b.k[2]! || a.k[3]! - b.k[3]! || a.i - b.i);
  return keyed.map((x) => x.e);
}

/**
 * The Review sheet's row for one error. An accepted error (W-69) reads *Accepted: <reason>*, with who and when.
 *
 * @param e - The error.
 * @param hasSheet - Whether the file has a sheet by this name (no link otherwise).
 * @returns The row's cells and its link.
 */
export function rowOf(e: SheetpaneError, hasSheet: (name: string) => boolean): ReviewRow {
  const scope = errorScope(e);
  const range = e.range.trim().toUpperCase().replace(/\$/g, '');
  const cell = scope === 'workbook' ? 'Whole workbook' : scope === 'sheet' ? 'Whole sheet' : range;
  const accepted = e.status === 'accepted';
  const cells = [
    e.id, e.sheet, cell, severityName(e.severity), typeName(e.type), e.found, e.expected, e.message, e.author, cap(e.status),
    accepted ? `Accepted: ${e.reason ?? ''}` : '',
    accepted ? (e.acceptedBy?.trim() || e.author) : '',
    accepted ? when(e.acceptedAt) : '',
  ];
  let link: string | undefined;
  if (scope !== 'workbook' && hasSheet(e.sheet)) {
    if (scope === 'sheet') link = `${quoteSheet(e.sheet)}!A1`;
    else if (parseRange(range)) link = `${quoteSheet(e.sheet)}!${range}`;
  }
  return { error: e, cells, link };
}
