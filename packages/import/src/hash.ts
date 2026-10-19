// The file's fingerprint (W-65): the SHA-256 of the bytes opened or handed back, through Web
// Crypto — no dependency. Where `crypto.subtle` is missing (a page that is not a secure
// context) the answer is `undefined` and a console warning (SP-1009) — never a substitute hash.
import { spMessage } from '@sheetpane/export';

/**
 * The SHA-256 of some bytes, as 64 lowercase hex digits (Web Crypto: every modern browser on a
 * secure page, Node 20 and later, workers). Hash once, when a file is read or written — never on
 * every edit.
 *
 * @param data - The bytes, or a Blob (read once).
 * @returns The hex digest, or `undefined` with a console warning (SP-1009) where `crypto.subtle` is missing or fails.
 * @example
 * ```ts
 * import { sha256 } from '@sheetpane/import';
 * await sha256(new TextEncoder().encode('abc')); // 'ba7816bf…f20015ad'
 * ```
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0104_IMPORT.md
 */
export async function sha256(data: Uint8Array | ArrayBuffer | Blob): Promise<string | undefined> {
  const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (!subtle) {
    console.warn(spMessage('SP-1009', 'sheetpane: crypto.subtle is missing (not a secure context — serve the page over https or from localhost), so the file has no SHA-256'));
    return undefined;
  }
  try {
    const bytes = data instanceof Blob ? await data.arrayBuffer() : data;
    const digest = new Uint8Array(await subtle.digest('SHA-256', bytes as BufferSource));
    let hex = '';
    for (const b of digest) hex += b.toString(16).padStart(2, '0');
    return hex;
  } catch (e) {
    console.warn(spMessage('SP-1009', `sheetpane: crypto.subtle.digest failed (${e instanceof Error ? e.message : String(e)}), so the file has no SHA-256`));
    return undefined;
  }
}
