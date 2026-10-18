// download(): export output in, a saved .xlsx or .csv out — SR-DOWNLOAD.
// The only place in the project that makes an object URL for a download.
import { spError } from '../codes.js';

export const MIME = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv;charset=utf-8',
} as const;

/** How long the object URL lives after the click (SR-DOWNLOAD decision 6, measured by W-12). */
export const REVOKE_DELAY_MS = 30_000;

export interface DownloadOptions {
  /** Overrides the MIME type taken from the extension. */
  type?: string;
}

type Ext = keyof typeof MIME;

const isBlob = (d: unknown): d is Blob => typeof Blob !== 'undefined' && d instanceof Blob;

/** Cleans a file name and settles its extension; throws on anything SR-DOWNLOAD decisions 4–5 refuse. */
export function fileNameFor(data: Uint8Array | Blob | string, filename: string): { name: string; ext: Ext } {
  if (typeof filename !== 'string') throw spError('SP-2101', 'download() needs a file name string as its second argument', TypeError);
  let name = filename
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/^ +/, '')
    .replace(/[ .]+$/, '');
  const m = /\.([A-Za-z0-9]+)$/.exec(name);
  let ext: Ext;
  if (m) {
    const e = m[1]!.toLowerCase();
    if (e !== 'xlsx' && e !== 'csv') throw spError('SP-2102', `"${filename}" — sheetpane saves .xlsx or .csv only`);
    ext = e;
  } else {
    if (typeof data === 'string') ext = 'csv';
    else if (isBlob(data)) {
      const t = data.type.toLowerCase();
      if (t.startsWith(MIME.xlsx)) ext = 'xlsx';
      else if (t.startsWith('text/csv')) ext = 'csv';
      else throw spError('SP-2103', `"${filename}" — add .xlsx or .csv; the type can't be told from this Blob`);
    } else ext = 'xlsx';
    name = `${name}.${ext}`;
  }
  if (typeof data === 'string' && ext === 'xlsx') throw spError('SP-2104', `"${filename}" — text can't be saved as .xlsx; use .csv`);
  const suffix = name.slice(name.length - ext.length - 1);
  let base = name.slice(0, name.length - suffix.length).replace(/[ .]+$/, '');
  if (!base) throw spError('SP-2105', `"${filename}" — nothing is left of the name once unsafe characters are removed`);
  base = base.slice(0, 200 - suffix.length).replace(/[ .]+$/, '');
  return { name: base + suffix, ext };
}

/** Hands a Blob to the browser as a saved file. Internal: `delay` lets W-12's test measure the revoke timing. */
export function save(blob: Blob, name: string, delay = REVOKE_DELAY_MS): void {
  const doc = (globalThis as { document?: Document }).document;
  if (!doc?.body) throw spError('SP-2106', 'download() needs a browser page (no document); write the bytes yourself');
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  a.style.display = 'none';
  doc.body.appendChild(a);
  a.click();
  a.remove();
  if (delay < 0) URL.revokeObjectURL(url);
  else setTimeout(() => URL.revokeObjectURL(url), delay);
}

/**
 * Saves export output as a file: bytes from `toXlsx` / `patchXlsx`, text from
 * `toCsv`, or a Blob. `.xlsx` or `.csv` only; a missing extension is added;
 * unsafe characters in the name are replaced; the bytes are never altered.
 */
export function download(data: Uint8Array | Blob | string, filename: string, options: DownloadOptions = {}): void {
  if (!(data instanceof Uint8Array) && !isBlob(data) && typeof data !== 'string') {
    throw spError('SP-2107', `"${String(filename)}" — download() takes a Uint8Array, a Blob or a string`, TypeError);
  }
  const { name, ext } = fileNameFor(data, filename);
  if (!(globalThis as { document?: unknown }).document) throw spError('SP-2106', 'download() needs a browser page (no document); write the bytes yourself');
  const type = options.type ?? MIME[ext];
  const blob = isBlob(data) && !options.type && data.type ? data : new Blob([data as BlobPart], { type });
  save(blob, name);
}
