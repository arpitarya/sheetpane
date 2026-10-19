// Every throw names what it is about: the sheet, the cell, the file part.
// `code` stays the typed reason hosts already read; `spCode` is its stable
// SP code (W-40) and the message starts with it and ends with its docs link.
import { spMessage, type SpCode, type SpCoded } from './codes.js';

/** Why an `ExportError` was thrown — the typed reason hosts switch on. */
export type ExportErrorCode =
  | 'sheet-name' | 'sheet-count' | 'too-large' | 'bad-ref' | 'bad-value' | 'no-sheet' | 'bad-merge' | 'bad-rule'
  | 'not-zip' | 'zip64' | 'encrypted' | 'unsupported-compression' | 'corrupt' | 'over-limit' | 'not-workbook';

/** One SP code per typed reason (docs/ERRORS.md). */
export const EXPORT_SP_CODES: Readonly<Record<ExportErrorCode, SpCode>> = {
  'sheet-name': 'SP-2001', 'sheet-count': 'SP-2002', 'too-large': 'SP-2003', 'bad-ref': 'SP-2004', 'bad-value': 'SP-2005',
  'no-sheet': 'SP-2006', 'bad-merge': 'SP-2007', 'not-zip': 'SP-2008', zip64: 'SP-2009', encrypted: 'SP-2010',
  'unsupported-compression': 'SP-2011', corrupt: 'SP-2012', 'over-limit': 'SP-2013', 'not-workbook': 'SP-2014',
  'bad-rule': 'SP-2015',
};

/**
 * What every writer and the ZIP reader throw: a typed `code`, its stable SP code,
 * and the sheet and cell it is about.
 *
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0103_EXPORT.md
 */
export class ExportError extends Error implements SpCoded {
  /** The typed reason. */
  readonly code: ExportErrorCode;
  /** The stable `SP-2xxx` code; the message starts with it. */
  readonly spCode: SpCode;
  /** The message without its code, title or link. */
  readonly spDetail: string;
  /** The sheet the error is about, when there is one. */
  readonly sheet: string | undefined;
  /** The cell or range the error is about, when there is one. */
  readonly ref: string | undefined;
  constructor(code: ExportErrorCode, message: string, where: { sheet?: string; ref?: string } = {}) {
    const sp = EXPORT_SP_CODES[code];
    super(spMessage(sp, message));
    this.name = 'ExportError';
    this.code = code;
    this.spCode = sp;
    this.spDetail = message;
    this.sheet = where.sheet;
    this.ref = where.ref;
  }
}
