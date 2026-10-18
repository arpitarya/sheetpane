// Every throw names what it is about: the sheet, the cell, the file part.

export type ExportErrorCode =
  | 'sheet-name' | 'sheet-count' | 'too-large' | 'bad-ref' | 'bad-value' | 'no-sheet' | 'bad-merge'
  | 'not-zip' | 'zip64' | 'encrypted' | 'unsupported-compression' | 'corrupt' | 'over-limit' | 'not-workbook';

export class ExportError extends Error {
  readonly code: ExportErrorCode;
  readonly sheet: string | undefined;
  readonly ref: string | undefined;
  constructor(code: ExportErrorCode, message: string, where: { sheet?: string; ref?: string } = {}) {
    super(message);
    this.name = 'ExportError';
    this.code = code;
    this.sheet = where.sheet;
    this.ref = where.ref;
  }
}
