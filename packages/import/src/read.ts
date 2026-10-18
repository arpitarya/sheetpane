// read(): any upload in — extension and magic bytes both checked (reading verdict decision 4; SR-LAW-3).
import { isZip } from '@sheetpane/export';
import { fromCsv } from './csv.js';
import { ImportError } from './errors.js';
import type { ImportedWorkbook } from './types.js';
import { fromXlsx, isCfb, toBytes, type ReadOptions } from './xlsx.js';

export interface ReadAnyOptions extends ReadOptions {
  /** The file name, when the source is not a File (decides the extension check and the CSV sheet name). */
  name?: string;
}

export async function read(source: File | Blob | ArrayBuffer | Uint8Array, o: ReadAnyOptions = {}): Promise<ImportedWorkbook> {
  const name = o.name ?? (typeof File !== 'undefined' && source instanceof File ? source.name : undefined);
  const ext = name && /\.([^./\\]+)$/.exec(name)?.[1]?.toLowerCase();
  if (ext && ext !== 'xlsx' && ext !== 'csv') {
    throw new ImportError('unsupported-format', `"${name}" is a .${ext} file — sheetpane opens .xlsx and .csv only`);
  }
  const bytes = await toBytes(source);
  if (isCfb(bytes)) throw new ImportError('password-or-legacy', `${name ? `"${name}" ` : 'this file '}is password-protected or a legacy .xls — sheetpane opens .xlsx and .csv only`);
  const zip = isZip(bytes);
  if (ext === 'csv' && zip) throw new ImportError('unsupported-format', `"${name}" is named .csv but holds a ZIP archive`);
  if (ext === 'xlsx' || (!ext && zip)) {
    if (!zip) throw new ImportError('not-workbook', `${name ? `"${name}"` : 'this file'} is not an .xlsx workbook`);
    return fromXlsx(bytes, o);
  }
  if (!ext && bytes.subarray(0, 8192).includes(0)) throw new ImportError('unsupported-format', 'this file is neither an .xlsx workbook nor CSV text');
  return fromCsv(new TextDecoder('utf-8').decode(bytes), name ? { name } : {});
}
