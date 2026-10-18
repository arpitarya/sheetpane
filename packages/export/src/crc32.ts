// CRC-32 (reflected polynomial 0xEDB88320) — the one implementation the
// export and import packages share (reading verdict decision 5).

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/**
 * The CRC-32 a ZIP entry records.
 *
 * @param data - The bytes to check.
 * @param seed - A previous CRC, to continue across chunks; default 0.
 * @returns The CRC as an unsigned 32-bit number.
 */
export function crc32(data: Uint8Array, seed = 0): number {
  let c = ~seed >>> 0;
  for (let i = 0; i < data.length; i++) c = TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return ~c >>> 0;
}
