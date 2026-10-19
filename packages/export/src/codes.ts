// Stable error codes (W-40): every thrown error, console warning, rules-engine
// note and refused load carries an `SP-xxxx` code with an entry in
// docs/ERRORS.md. A code is permanent: it is never renumbered or reused; a code
// no longer raised stays here marked `retired`. Titles only — the long text
// lives in the docs (bundle size).
//
// Ranges: 1xxx import · 2xxx export · 3xxx grid · 4xxx errors element ·
// 5xxx plugins (5100 numfmt · 5200 formulas · 5300 styles · 5400 validation ·
// 5500 condfmt · 5600 images · 5700 charts · 5800 comments) · 6xxx rules ·
// 7xxx mcp.

/** One registry entry: a code's short title and how serious it is. */
export interface CodeInfo {
  /** A few words; the long text lives in docs/ERRORS.md. */
  readonly title: string;
  /** An `error` is thrown or refuses a load; a `warning` or `note` is reported and work goes on. */
  readonly severity: 'error' | 'warning' | 'note';
  /** No longer raised; kept so the code is never reused. */
  readonly retired?: true;
}

const TABLE = {
  // ── 1xxx · @sheetpane/import ─────────────────────────────────────────────
  'SP-1001': { title: 'Not an .xlsx or .csv file', severity: 'error' },
  'SP-1002': { title: 'Password-protected workbook', severity: 'error' },
  'SP-1003': { title: 'Legacy .xls workbook', severity: 'error' },
  'SP-1004': { title: 'Encrypted or OLE file', severity: 'error' },
  'SP-1005': { title: 'Not a workbook', severity: 'error' },
  'SP-1006': { title: 'File too large', severity: 'error' },
  'SP-1007': { title: 'Damaged file', severity: 'error' },
  'SP-1008': { title: 'Reading .xlsx needs a DOM', severity: 'error', retired: true },

  // ── 2xxx · @sheetpane/export ─────────────────────────────────────────────
  'SP-2001': { title: 'Invalid sheet name', severity: 'error' },
  'SP-2002': { title: 'No visible sheet', severity: 'error' },
  'SP-2003': { title: 'Sheet past Excel’s limits', severity: 'error' },
  'SP-2004': { title: 'Not a cell reference', severity: 'error' },
  'SP-2005': { title: 'Value a workbook cannot store', severity: 'error' },
  'SP-2006': { title: 'No such sheet', severity: 'error' },
  'SP-2007': { title: 'Invalid merge', severity: 'error' },
  'SP-2008': { title: 'Not a ZIP archive', severity: 'error' },
  'SP-2009': { title: 'ZIP64 archive refused', severity: 'error' },
  'SP-2010': { title: 'Encrypted ZIP entry', severity: 'error' },
  'SP-2011': { title: 'Unsupported ZIP compression', severity: 'error' },
  'SP-2012': { title: 'Damaged archive', severity: 'error' },
  'SP-2013': { title: 'Archive over the size limit', severity: 'error' },
  'SP-2014': { title: 'Not a workbook package', severity: 'error' },
  // 21xx · download()
  'SP-2101': { title: 'download() needs a file name', severity: 'error' },
  'SP-2102': { title: 'Only .xlsx or .csv can be saved', severity: 'error' },
  'SP-2103': { title: 'File type cannot be told', severity: 'error' },
  'SP-2104': { title: 'Text cannot be saved as .xlsx', severity: 'error' },
  'SP-2105': { title: 'File name is empty once cleaned', severity: 'error' },
  'SP-2106': { title: 'download() needs a browser page', severity: 'error' },
  'SP-2107': { title: 'download() data type not accepted', severity: 'error' },

  // ── 3xxx · @sheetpane/grid (store, plugin host, <sheetpane-excel>) ──────
  'SP-3001': { title: 'Nothing is loaded to export', severity: 'error' },
  'SP-3002': { title: 'Unknown plugin', severity: 'error' },
  'SP-3003': { title: 'Not a plugin', severity: 'error' },
  'SP-3004': { title: 'Plugin listed twice', severity: 'error' },
  'SP-3005': { title: 'Plugin hook without its function', severity: 'error' },
  'SP-3006': { title: 'Hook has one provider per pane', severity: 'error' },
  'SP-3007': { title: 'Duplicate control id', severity: 'error' },
  'SP-3008': { title: 'Unknown control slot', severity: 'error' },
  'SP-3009': { title: 'Decorate order loops', severity: 'error' },
  'SP-3010': { title: 'Plugin set a font family', severity: 'error' },
  'SP-3011': { title: 'Plugin set fixed per pane', severity: 'warning' },
  'SP-3012': { title: 'Plugin derive failed', severity: 'error' },
  'SP-3013': { title: 'Plugin validate failed', severity: 'error' },
  'SP-3014': { title: 'Plugin overlay failed', severity: 'error' },
  'SP-3015': { title: 'Source could not be read', severity: 'error' },
  'SP-3019': { title: 'Cell to open at not found', severity: 'warning' },

  // ── 4xxx · <sheetpane-errors> — none raised yet ─────────────────────────

  // ── 5xxx · plugins ───────────────────────────────────────────────────────
  // 5100 · @sheetpane/numfmt
  'SP-5101': { title: 'Selection too large to format', severity: 'warning' },
  'SP-5102': { title: 'Not a style sheet', severity: 'error' },
  'SP-5103': { title: 'Workbook has no style sheet', severity: 'error' },
  // 5200 · @sheetpane/formulas
  'SP-5201': { title: 'Recalculation failed', severity: 'error' },
  'SP-5202': { title: 'Formula engine did not load', severity: 'error' },
  // 5300 styles · 5400 validation · 5500 condfmt · 5600 images — none raised yet
  // 5700 · @sheetpane/charts
  'SP-5701': { title: 'Chart part is not well-formed XML', severity: 'error' },
  'SP-5702': { title: 'Chart part holds no chart', severity: 'error' },
  // 5800 · @sheetpane/comments
  'SP-5801': { title: 'Comment part has no container', severity: 'error' },
  'SP-5802': { title: 'Not a worksheet', severity: 'error' },
  'SP-5803': { title: 'Comments not written for a sheet', severity: 'error' },

  // ── 6xxx · column rules and the rules file ──────────────────────────────
  'SP-6001': { title: 'Column rule pattern is not a regular expression', severity: 'error' },
  'SP-6002': { title: 'Column-rules validate function failed', severity: 'error' },
  'SP-6003': { title: 'Value refused by a rule', severity: 'warning' },
  'SP-6010': { title: 'Rules file is not a JSON object', severity: 'note' },
  'SP-6011': { title: 'Rules file could not be read', severity: 'note' },
  'SP-6012': { title: 'Unknown rules file version', severity: 'note' },
  'SP-6013': { title: 'Unknown key in the rules file', severity: 'note' },
  'SP-6014': { title: 'Rules file has no sheets', severity: 'note' },
  'SP-6015': { title: 'Rule is not an object', severity: 'note' },
  'SP-6016': { title: 'Unknown rule word', severity: 'note' },
  'SP-6017': { title: 'Unknown rule type', severity: 'note' },
  'SP-6018': { title: 'Rules file pattern is not a regular expression', severity: 'note' },
  'SP-6019': { title: 'Rule list is not a list', severity: 'note' },
  'SP-6020': { title: 'Header row is not a row number', severity: 'note' },
  'SP-6021': { title: 'Not a cell or a range', severity: 'note' },
  'SP-6022': { title: 'Rules name a missing sheet', severity: 'note' },
  'SP-6023': { title: 'No column has this title', severity: 'note' },
  'SP-6024': { title: 'Two columns share a title', severity: 'note' },
  'SP-6025': { title: 'Rules file rule replaces the element’s', severity: 'note' },

  // ── 7xxx · @sheetpane/mcp — tool errors (W-39) ──────────────────────────
  'SP-7001': { title: 'Tool input is missing or malformed', severity: 'error' },
  'SP-7002': { title: 'No file at that path', severity: 'error' },
  'SP-7003': { title: 'File too large for the tool', severity: 'error' },
  'SP-7004': { title: 'Workbook could not be read', severity: 'error' },
  'SP-7005': { title: 'No sheet by that name', severity: 'error' },
  'SP-7006': { title: 'Not a sheetpane code', severity: 'error' },
  'SP-7007': { title: 'Server data file missing', severity: 'error' },
} as const satisfies Record<`SP-${number}`, CodeInfo>;

/** Every code sheetpane has ever issued. */
export type SpCode = keyof typeof TABLE;

/** The registry: code → title and severity (W-40). Retired codes stay. */
export const CODES: Readonly<Record<SpCode, CodeInfo>> = TABLE;

/** Where every code is documented. */
export const ERRORS_DOC_URL = 'https://github.com/arpitarya/sheetpane/blob/main/docs/ERRORS.md';

/** The docs link for one code: `…/ERRORS.md#sp-3012`. */
export const codeUrl = (code: SpCode): string => `${ERRORS_DOC_URL}#${code.toLowerCase()}`;

/**
 * `SP-xxxx: <title> — <detail> (<docs link>)` — the text of a thrown error or a console line.
 *
 * @param code - The SP code.
 * @param detail - What happened, in words; left out, the message is the title and the link.
 * @returns The formatted message.
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0117_CODES.md
 */
export function spMessage(code: SpCode, detail?: string): string {
  const head = `${code}: ${CODES[code].title}`;
  return `${detail ? `${head} — ${detail}` : head} (${codeUrl(code)})`;
}

/** An error that carries a code: `spCode` always; `spDetail` is the human text without the code, title or link. */
export interface SpCoded {
  readonly spCode: SpCode;
  readonly spDetail: string;
}

/** What `spError` returns: an Error whose `code` and `spCode` are the SP code. */
export type SpError = Error & SpCoded & { readonly code: SpCode };

/**
 * Builds (does not throw) an Error carrying `code` and `spCode`; its message is `spMessage(code, detail)`.
 *
 * @param code - The SP code.
 * @param detail - The human text, kept as `spDetail`.
 * @param Ctor - The Error class to build, e.g. `TypeError`; default `Error`.
 * @returns The error, ready to throw.
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0117_CODES.md
 */
export function spError(code: SpCode, detail?: string, Ctor: new (message: string) => Error = Error): SpError {
  const e = new Ctor(spMessage(code, detail)) as Error & { code: SpCode; spCode: SpCode; spDetail: string };
  e.code = code;
  e.spCode = code;
  e.spDetail = detail ?? '';
  return e;
}

const SP_RE = /^SP-\d{4}$/;
const isCode = (x: unknown): x is SpCode => typeof x === 'string' && SP_RE.test(x) && x in CODES;

/**
 * The SP code of anything sheetpane raised — a thrown error, a load state, a note, an event detail — or undefined.
 *
 * @param x - Anything; its `spCode`, else its `code`, is read when it is a known code.
 * @returns The code, or `undefined`.
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0117_CODES.md
 */
export function codeOf(x: unknown): SpCode | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const o = x as { spCode?: unknown; code?: unknown };
  return isCode(o.spCode) ? o.spCode : isCode(o.code) ? o.code : undefined;
}

/**
 * The human text of an error without its code, title or link (`spDetail`), else its message.
 *
 * @param x - An error or anything else; a non-object is turned into a string.
 * @returns The text.
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0117_CODES.md
 */
export function detailOf(x: unknown): string {
  if (x && typeof x === 'object') {
    const o = x as { spDetail?: unknown; message?: unknown };
    if (typeof o.spDetail === 'string' && o.spDetail) return o.spDetail;
    if (typeof o.message === 'string') return o.message;
  }
  return String(x);
}
