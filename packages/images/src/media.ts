// Picture bytes → object URLs. The only file in this package that touches `URL.createObjectURL`
// (SR-DOWNLOAD's veto check counts such files — keep it to this one).
//
// Decoding is lazy: nothing is read from the ZIP until a picture is asked for, one URL is made per
// media part however many pictures show it, and `revoke()` frees every URL when the workbook goes.
import type { PluginContext } from '@sheetpane/grid';

type Book = PluginContext['book'];

export type MediaResult =
  /** The browser can draw it. */
  | { kind: 'image'; url: string; mime: string }
  /** A format a browser cannot draw (EMF, WMF, TIFF …): the item shows a labelled frame. */
  | { kind: 'unsupported'; format: string }
  /** The part is missing from the package, or the cache was closed while it was being read. */
  | { kind: 'missing' };

const BY_EXTENSION: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', jpe: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', bmp: 'image/bmp', webp: 'image/webp',
};

/** `xl/media/image1.PNG` → `png`. */
export const extensionOf = (path: string): string => /\.([A-Za-z0-9]+)$/.exec(path)?.[1]?.toLowerCase() ?? '';

/** The part's file name, for labels: `xl/media/logo.emf` → `logo.emf`. */
export const fileName = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

/** True when the extension alone says a browser cannot draw it — no bytes need reading to know. */
export function isUnsupportedPath(path: string): boolean {
  return !(extensionOf(path) in BY_EXTENSION);
}

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/** What the bytes are, by their signature — the file name lies more often than the header. */
export function sniff(bytes: Uint8Array, path: string): { mime: string } | { format: string } {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return { mime: 'image/png' };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg' };
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return { mime: 'image/gif' };
  if (startsWith(bytes, [0x42, 0x4d]) && extensionOf(path) !== 'svg') return { mime: 'image/bmp' };
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return { mime: 'image/webp' };
  if (startsWith(bytes, [0x20, 0x45, 0x4d, 0x46], 40)) return { format: 'emf' };
  if (startsWith(bytes, [0xd7, 0xcd, 0xc6, 0x9a]) || startsWith(bytes, [0x01, 0x00, 0x09, 0x00]) || startsWith(bytes, [0x02, 0x00, 0x09, 0x00])) return { format: 'wmf' };
  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) return { format: 'tiff' };
  const head = new TextDecoder().decode(bytes.subarray(0, 1024));
  if (/<svg[\s>]/i.test(head)) return { mime: 'image/svg+xml' };
  // Unrecognised bytes: trust the extension; a lie there fails in <img> and shows the labelled frame.
  const mime = BY_EXTENSION[extensionOf(path)];
  return mime ? { mime } : { format: extensionOf(path) || 'unknown' };
}

/** The object URLs made for one workbook. Closed (`revoke()`) when the workbook is replaced. */
export class MediaCache {
  private readonly results = new Map<string, Promise<MediaResult>>();
  private readonly urls = new Set<string>();
  private closed = false;

  constructor(private readonly book: Book) {}

  get isClosed(): boolean { return this.closed; }
  /** How many object URLs are alive. */
  get size(): number { return this.urls.size; }

  /** Reads the part on first ask; every later ask for the same part shares the answer. */
  get(path: string): Promise<MediaResult> {
    if (this.closed) return Promise.resolve({ kind: 'missing' });
    let p = this.results.get(path);
    if (!p) { p = this.load(path); this.results.set(path, p); }
    return p;
  }

  private async load(path: string): Promise<MediaResult> {
    let bytes: Uint8Array | undefined;
    try { bytes = await this.book.part(path); } catch { return { kind: 'missing' }; }
    if (this.closed || !bytes) return { kind: 'missing' };
    const s = sniff(bytes, path);
    if ('format' in s) return { kind: 'unsupported', format: s.format };
    // A picture is only ever shown through an <img> (SVG included): no script in it can run.
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: s.mime }));
    this.urls.add(url);
    return { kind: 'image', url, mime: s.mime };
  }

  /** Frees every object URL and refuses new ones. Safe to call twice. */
  revoke(): void {
    this.closed = true;
    for (const u of this.urls) URL.revokeObjectURL(u);
    this.urls.clear();
    this.results.clear();
  }
}
