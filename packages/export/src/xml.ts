// XML text and SpreadsheetML string escaping, shared by the writers and the reader.

const ENC = new TextEncoder();
const DEC = new TextDecoder('utf-8', { fatal: false });

/** Encodes text as UTF-8 bytes. */
export const utf8 = (s: string): Uint8Array => ENC.encode(s);
/** Decodes UTF-8 bytes; bad sequences become U+FFFD instead of throwing. */
export const fromUtf8 = (b: Uint8Array): string => DEC.decode(b);

/** Characters XML 1.0 forbids: C0 controls except tab, LF, CR; U+FFFE, U+FFFF; lone surrogates. */
const FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/**
 * Removes what XML forbids; `stripped` says whether anything went.
 *
 * @param s - The text.
 * @returns The cleaned `text` and whether anything was `stripped`.
 */
export function cleanXmlChars(s: string): { text: string; stripped: boolean } {
  const text = s.replace(FORBIDDEN, '');
  return { text, stripped: text.length !== s.length };
}

/**
 * Escapes `&`, `<` and `>` for XML element text.
 *
 * @param s - The text.
 * @returns The escaped text.
 */
export function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Escapes text for a double-quoted XML attribute value.
 *
 * @param s - The text.
 * @returns The escaped text.
 */
export function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, '&quot;');
}

/**
 * Resolves the five predefined XML entities and numeric character references.
 *
 * @param s - The escaped text.
 * @returns The plain text.
 */
export function unescapeXml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (_, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[e]!;
  });
}

/**
 * SpreadsheetML's own escape for a cell string (ECMA-376 §22.4.2.4, ST_Xstring):
 * a carriage return is written `_x000D_` (XML parsing would turn a raw CR into LF),
 * and a literal `_xHHHH_` in the text is protected as `_x005F_xHHHH_`.
 *
 * @param s - The cell text.
 * @returns The encoded text, still to be XML-escaped.
 */
export function encodeOoxmlString(s: string): string {
  return s.replace(/_(x[0-9A-Fa-f]{4}_)/g, '_x005F_$1').replace(/\r/g, '_x000D_');
}

/**
 * Reverses SpreadsheetML's `_xHHHH_` escape in a cell string read from a file.
 *
 * @param s - The text, already XML-unescaped.
 * @returns The cell text.
 */
export function decodeOoxmlString(s: string): string {
  return s.replace(/_x([0-9A-Fa-f]{4})_/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

/** A `<t>` element for a cell string, `xml:space="preserve"` when whitespace would otherwise be lost. */
export function tElement(s: string, prefix = ''): string {
  const keep = /^\s|\s$|\n|\t| {2}/.test(s) ? ' xml:space="preserve"' : '';
  return `<${prefix}t${keep}>${escapeText(encodeOoxmlString(s))}</${prefix}t>`;
}
