// Typed refusals the grid maps to its "Can't open" and password states (W-13 DoD 6; SR-LAW-3).

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

export class ImportError extends Error {
  readonly code: ImportErrorCode;
  /** For `password-or-legacy`: which of the two the OLE file holds, when it can be told. */
  readonly detail: 'password' | 'legacy' | undefined;
  constructor(code: ImportErrorCode, message: string, detail?: 'password' | 'legacy') {
    super(message);
    this.name = 'ImportError';
    this.code = code;
    this.detail = detail;
  }
}
