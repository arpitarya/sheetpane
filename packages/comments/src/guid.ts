// Stable GUIDs for the threads this plugin writes (W-22 DoD 5): an RFC 4122
// version-5 UUID (SHA-1 of a namespace and a name), in Excel's `{…}` form.
// Synchronous on purpose: `validate` recognises the plugin's own threads, and
// `validate` is synchronous. No dependency — SHA-1 is short.

function sha1(bytes: Uint8Array): Uint8Array {
  const ml = bytes.length * 8;
  const len = (((bytes.length + 8) >> 6) + 1) << 6;
  const m = new Uint8Array(len);
  m.set(bytes);
  m[bytes.length] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(len - 8, Math.floor(ml / 0x100000000));
  dv.setUint32(len - 4, ml >>> 0);
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n));
  for (let off = 0; off < len; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!, 1);
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      const f = i < 20 ? (b & c) | (~b & d) : i < 40 ? b ^ c ^ d : i < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
      const k = i < 20 ? 0x5a827999 : i < 40 ? 0x6ed9eba1 : i < 60 ? 0x8f1bbcdc : 0xca62c1d6;
      const t = (rotl(a, 5) + f + e + k + w[i]!) >>> 0;
      e = d; d = c; c = rotl(b, 30) >>> 0; b = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  const out = new Uint8Array(20);
  const ov = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((h, i) => ov.setUint32(i * 4, h));
  return out;
}

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const uuidBytes = (u: string) => Uint8Array.from(u.replace(/[{}-]/g, '').match(/../g)!, (h) => parseInt(h, 16));

/** RFC 4122 §4.3: the version-5 UUID of `name` in `namespace` (lowercase, no braces). */
export function uuidv5(namespace: string, name: string): string {
  const ns = uuidBytes(namespace), nm = new TextEncoder().encode(name);
  const buf = new Uint8Array(ns.length + nm.length);
  buf.set(ns); buf.set(nm, ns.length);
  const h = sha1(buf).slice(0, 16);
  h[6] = (h[6]! & 0x0f) | 0x50;
  h[8] = (h[8]! & 0x3f) | 0x80;
  const s = hex(h);
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/** RFC 4122's URL namespace. */
const NS_URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
/** sheetpane's own namespace: the v5 UUID of the package's URL. */
const NS_SHEETPANE = uuidv5(NS_URL, 'https://github.com/arpitarya/sheetpane#comments');

const cache = new Map<string, string>();
/** `{XXXXXXXX-XXXX-5XXX-XXXX-XXXXXXXXXXXX}` for a name — what Excel writes in `id` and `personId`. */
export function guid(name: string): string {
  let g = cache.get(name);
  if (!g) {
    g = `{${uuidv5(NS_SHEETPANE, name).toUpperCase()}}`;
    if (cache.size > 10000) cache.clear();
    cache.set(name, g);
  }
  return g;
}

/**
 * The ids of one error's thread entries: the comment, and the `expected` reply.
 * Named by the error's `id` and `createdAt` — ids restart at ERR-0001 each
 * session, so the id alone would collide with an earlier review's threads.
 */
export function errorGuids(e: { id: string; createdAt: string }): { comment: string; expected: string } {
  const base = `sheetpane:${e.id}:${e.createdAt}`;
  return { comment: guid(base), expected: guid(`${base}#expected`) };
}

/** The person an author is written as. */
export const personGuid = (displayName: string) => guid(`sheetpane-person:${displayName}`);
