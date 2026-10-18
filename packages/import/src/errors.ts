// Typed refusals the grid maps to its "Can't open" and password states (W-13 DoD 6; SR-LAW-3).
// `code` stays the typed reason hosts already read; `spCode` is its stable SP
// code (W-40) and the message starts with it and ends with its docs link.
import { spMessage, type SpCode, type SpCoded } from '@sheetpane/export';

export type ImportErrorCode =
  /** Not .xlsx or .csv — .xls, .xlsm, .xlsb, .ods, .numbers, .tsv, anything else. */
  | 'unsupported-format'
  /** An OLE compound file: a password-protected .xlsx, or a legacy .xls. */
  | 'password-or-legacy'
  /** A ZIP that is not a workbook, or bytes that are not one. */
  | 'not-workbook'
  /** ZIP64, past the inflate caps, or past 1,048,576 rows / 16,384 columns. */
  | 'too-large'
  /** Damaged: bad DEFLATE, a CRC mismatch, broken XML. */
  | 'corrupt'
  /** Reading .xlsx needs DOMParser, which Node lacks. */
  | 'needs-dom';

/** The SP code of a typed refusal; `password-or-legacy` splits by what the OLE file holds. */
export function importSpCode(code: ImportErrorCode, detail?: 'password' | 'legacy'): SpCode {
  switch (code) {
    case 'unsupported-format': return 'SP-1001';
    case 'password-or-legacy': return detail === 'password' ? 'SP-1002' : detail === 'legacy' ? 'SP-1003' : 'SP-1004';
    case 'not-workbook': return 'SP-1005';
    case 'too-large': return 'SP-1006';
    case 'corrupt': return 'SP-1007';
    case 'needs-dom': return 'SP-1008';
  }
}

export class ImportError extends Error implements SpCoded {
  readonly code: ImportErrorCode;
  readonly spCode: SpCode;
  /** The message without its code, title or link — what the grid's "Can't open" state shows. */
  readonly spDetail: string;
  /** For `password-or-legacy`: which of the two the OLE file holds, when it can be told. */
  readonly detail: 'password' | 'legacy' | undefined;
  constructor(code: ImportErrorCode, message: string, detail?: 'password' | 'legacy') {
    const sp = importSpCode(code, detail);
    super(spMessage(sp, message));
    this.name = 'ImportError';
    this.code = code;
    this.spCode = sp;
    this.spDetail = message;
    this.detail = detail;
  }
}
