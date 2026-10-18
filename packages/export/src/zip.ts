// The ZIP subset an .xlsx needs (work/reference/specs/zip/zip-subset-notes.md):
// read the central directory, inflate an entry, write store or deflate. No ZIP64.
import { crc32 } from './crc32.js';
import { deflateRaw, inflateRaw } from './deflate.js';
import { ExportError } from './errors.js';
import { fromUtf8, utf8 } from './xml.js';

export interface ZipEntry {
  name: string;
  method: number;
  flags: number;
  crc: number;
  compressedSize: number;
  size: number;
  time: number;
  date: number;
  /** Offset of the entry's data (after its local header) in the archive. */
  dataOffset: number;
}

export interface ZipLimits {
  /** Largest inflated size of one entry, bytes. Default 512 MB (reading verdict decision 4). */
  maxEntrySize?: number;
  /** Largest inflated size of the whole archive, bytes. Default 1 GB. */
  maxTotalSize?: number;
}

export const DEFAULT_LIMITS = { maxEntrySize: 512 * 2 ** 20, maxTotalSize: 2 ** 30 } as const;

const SIG_LOCAL = 0x04034b50, SIG_CENTRAL = 0x02014b50, SIG_EOCD = 0x06054b50, SIG_ZIP64_LOC = 0x07064b50;

/** True when the bytes begin like a ZIP archive. */
export function isZip(b: Uint8Array): boolean {
  return b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5) && (b[3] === 4 || b[3] === 6);
}

/** Lists the entries from the central directory. Sizes come from there, never the local header. */
export function readZip(bytes: Uint8Array, limits: ZipLimits = {}): ZipEntry[] {
  const maxTotal = limits.maxTotalSize ?? DEFAULT_LIMITS.maxTotalSize;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (v.getUint32(i, true) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new ExportError('not-zip', 'not a ZIP archive (no end-of-central-directory record)');
  if (eocd >= 20 && v.getUint32(eocd - 20, true) === SIG_ZIP64_LOC) throw new ExportError('zip64', 'ZIP64 archives are refused');
  const count = v.getUint16(eocd + 10, true);
  const cdSize = v.getUint32(eocd + 12, true);
  const cdOffset = v.getUint32(eocd + 16, true);
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new ExportError('zip64', 'ZIP64 archives are refused');
  if (cdOffset + cdSize > eocd) throw new ExportError('corrupt', 'the central directory lies outside the archive');
  const entries: ZipEntry[] = [];
  let p = cdOffset, total = 0;
  for (let n = 0; n < count; n++) {
    if (p + 46 > bytes.length || v.getUint32(p, true) !== SIG_CENTRAL) throw new ExportError('corrupt', `central directory entry ${n + 1} is damaged`);
    const flags = v.getUint16(p + 8, true);
    const method = v.getUint16(p + 10, true);
    const time = v.getUint16(p + 12, true), date = v.getUint16(p + 14, true);
    const crc = v.getUint32(p + 16, true);
    const compressedSize = v.getUint32(p + 20, true), size = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), commentLen = v.getUint16(p + 32, true);
    const localOffset = v.getUint32(p + 42, true);
    const name = fromUtf8(bytes.subarray(p + 46, p + 46 + nameLen));
    if (compressedSize === 0xffffffff || size === 0xffffffff || localOffset === 0xffffffff) throw new ExportError('zip64', `ZIP64 entry "${name}" is refused`);
    if (flags & 1) throw new ExportError('encrypted', `"${name}" is encrypted`);
    if (method !== 0 && method !== 8) throw new ExportError('unsupported-compression', `"${name}" uses compression method ${method}`);
    if (localOffset + 30 > bytes.length || v.getUint32(localOffset, true) !== SIG_LOCAL) throw new ExportError('corrupt', `the local header of "${name}" is damaged`);
    const dataOffset = localOffset + 30 + v.getUint16(localOffset + 26, true) + v.getUint16(localOffset + 28, true);
    if (dataOffset + compressedSize > bytes.length) throw new ExportError('corrupt', `"${name}" runs past the end of the archive`);
    total += size;
    if (total > maxTotal) throw new ExportError('over-limit', `the archive inflates past ${maxTotal} bytes — refused`);
    entries.push({ name, method, flags, crc, compressedSize, size, time, date, dataOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** The entry's stored (possibly compressed) bytes. */
export function rawData(bytes: Uint8Array, e: ZipEntry): Uint8Array {
  return bytes.subarray(e.dataOffset, e.dataOffset + e.compressedSize);
}

/** The entry's content, inflated and CRC-checked, within the size limit. */
export async function inflateEntry(bytes: Uint8Array, e: ZipEntry, limits: ZipLimits = {}): Promise<Uint8Array> {
  const cap = limits.maxEntrySize ?? DEFAULT_LIMITS.maxEntrySize;
  if (e.size > cap) throw new ExportError('over-limit', `"${e.name}" is ${e.size} bytes inflated — over the ${cap}-byte limit`);
  const raw = rawData(bytes, e);
  const out = e.method === 0 ? raw.slice() : await inflateRaw(raw, cap, `"${e.name}"`);
  if (out.length !== e.size || crc32(out) !== e.crc) throw new ExportError('corrupt', `"${e.name}" fails its CRC-32 check`);
  return out;
}

export type ZipInput =
  | { name: string; data: Uint8Array }
  /** An entry copied from another archive byte for byte, compressed data and all. */
  | { name: string; copy: ZipEntry; from: Uint8Array };

export interface WriteOptions { compression?: 'deflate' | 'store' }

const DOS_DATE_1980 = (0 << 9) | (1 << 5) | 1; // 1980-01-01
const DOS_TIME_0 = 0;

/** Writes a ZIP. New entries get a fixed 1980-01-01 timestamp and no extra fields, in the given order. */
export async function writeZip(files: ZipInput[], o: WriteOptions = {}): Promise<Uint8Array> {
  const compress = (o.compression ?? 'deflate') === 'deflate';
  if (files.length > 0xfffe) throw new ExportError('over-limit', 'more than 65,534 entries would need ZIP64');
  const parts: { name: Uint8Array; method: number; flags: number; crc: number; csize: number; size: number; time: number; date: number; data: Uint8Array }[] = [];
  for (const f of files) {
    const name = utf8(f.name);
    if ('copy' in f) {
      const e = f.copy;
      parts.push({ name, method: e.method, flags: 0x0800 | (e.flags & 0x0006), crc: e.crc, csize: e.compressedSize, size: e.size, time: e.time, date: e.date, data: rawData(f.from, e) });
    } else {
      const data = compress ? await deflateRaw(f.data) : f.data;
      parts.push({ name, method: compress ? 8 : 0, flags: 0x0800, crc: crc32(f.data), csize: data.length, size: f.data.length, time: DOS_TIME_0, date: DOS_DATE_1980, data });
    }
  }
  let localSize = 0, centralSize = 0;
  for (const p of parts) { localSize += 30 + p.name.length + p.csize; centralSize += 46 + p.name.length; }
  if (localSize + centralSize + 22 > 0xffffffff) throw new ExportError('over-limit', 'the archive would pass 4 GB, which needs ZIP64');
  const out = new Uint8Array(localSize + centralSize + 22);
  const v = new DataView(out.buffer);
  let p = 0;
  const offsets: number[] = [];
  for (const e of parts) {
    offsets.push(p);
    v.setUint32(p, SIG_LOCAL, true); v.setUint16(p + 4, e.method === 8 ? 20 : 10, true); v.setUint16(p + 6, e.flags, true);
    v.setUint16(p + 8, e.method, true); v.setUint16(p + 10, e.time, true); v.setUint16(p + 12, e.date, true);
    v.setUint32(p + 14, e.crc, true); v.setUint32(p + 18, e.csize, true); v.setUint32(p + 22, e.size, true);
    v.setUint16(p + 26, e.name.length, true); v.setUint16(p + 28, 0, true);
    out.set(e.name, p + 30); out.set(e.data, p + 30 + e.name.length);
    p += 30 + e.name.length + e.csize;
  }
  const cd = p;
  parts.forEach((e, i) => {
    v.setUint32(p, SIG_CENTRAL, true); v.setUint16(p + 4, 20, true); v.setUint16(p + 6, e.method === 8 ? 20 : 10, true);
    v.setUint16(p + 8, e.flags, true); v.setUint16(p + 10, e.method, true); v.setUint16(p + 12, e.time, true); v.setUint16(p + 14, e.date, true);
    v.setUint32(p + 16, e.crc, true); v.setUint32(p + 20, e.csize, true); v.setUint32(p + 24, e.size, true);
    v.setUint16(p + 28, e.name.length, true); // extra, comment, disk, internal attrs, external attrs: 0
    v.setUint32(p + 42, offsets[i]!, true);
    out.set(e.name, p + 46);
    p += 46 + e.name.length;
  });
  v.setUint32(p, SIG_EOCD, true);
  v.setUint16(p + 8, parts.length, true); v.setUint16(p + 10, parts.length, true);
  v.setUint32(p + 12, p - cd, true); v.setUint32(p + 16, cd, true);
  return out;
}
