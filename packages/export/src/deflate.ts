// Raw DEFLATE both ways with what the platform ships (export verdict decision 7):
// `zlib` in Node, `CompressionStream` / `DecompressionStream('deflate-raw')` in browsers.
import { ExportError } from './errors.js';

interface Zlib {
  deflateRawSync(b: Uint8Array): Uint8Array;
  inflateRawSync(b: Uint8Array, o?: { maxOutputLength?: number }): Uint8Array;
}

const proc = (globalThis as { process?: { versions?: { node?: string } } }).process;
const IN_NODE = !!proc?.versions?.node && typeof (globalThis as { document?: unknown }).document === 'undefined';

let zlib: Promise<Zlib> | undefined;
function nodeZlib(): Promise<Zlib> {
  const spec = 'node:zlib'; // a variable, so browser bundlers leave it alone
  return (zlib ??= import(/* @vite-ignore */ spec) as Promise<Zlib>);
}

async function through(stream: { writable: WritableStream<BufferSource>; readable: ReadableStream<Uint8Array> }, data: Uint8Array, cap: number, what: string): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  writer.write(data as Uint8Array<ArrayBuffer>).catch(() => {});
  writer.close().catch(() => {});
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > cap) {
        await reader.cancel().catch(() => {});
        throw new ExportError('over-limit', `${what} inflates past ${cap} bytes — refused`);
      }
      chunks.push(value);
    }
  } catch (e) {
    if (e instanceof ExportError) throw e;
    throw new ExportError('corrupt', `${what} is not valid DEFLATE data`);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

export async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (IN_NODE) return new Uint8Array((await nodeZlib()).deflateRawSync(data));
  return through(new CompressionStream('deflate-raw'), data, Number.MAX_SAFE_INTEGER, 'data');
}

/** Inflates raw DEFLATE, refusing output past `cap` bytes (a ZIP bomb guard). */
export async function inflateRaw(data: Uint8Array, cap: number, what = 'a ZIP entry'): Promise<Uint8Array> {
  if (IN_NODE) {
    try {
      return new Uint8Array((await nodeZlib()).inflateRawSync(data, { maxOutputLength: cap }));
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'ERR_BUFFER_TOO_LARGE') throw new ExportError('over-limit', `${what} inflates past ${cap} bytes — refused`);
      throw new ExportError('corrupt', `${what} is not valid DEFLATE data`);
    }
  }
  return through(new DecompressionStream('deflate-raw'), data, cap, what);
}
