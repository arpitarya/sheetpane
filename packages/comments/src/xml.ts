// String-level XML helpers for the write path: `exportPatch` runs in browsers
// and in Node, so no DOMParser. The plugin has no runtime dependency, so these
// few are its own (the same shapes as @sheetpane/export's).

export const escText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const escAttr = (s: string) => escText(s).replace(/"/g, '&quot;').replace(/\r?\n/g, '&#10;');
/** Characters XML 1.0 forbids (C0 controls other than tab, LF, CR; lone surrogates; U+FFFE/F). */
export const cleanXml = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');

export function unesc(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|quot|apos|amp);/gi, (_, e: string) => {
    switch (e.toLowerCase()) {
      case 'lt': return '<'; case 'gt': return '>'; case 'quot': return '"'; case 'apos': return "'"; case 'amp': return '&';
      default: return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    }
  });
}

/** An attribute's unescaped value; `name` may be `*:id` for any prefix. */
export function attr(tag: string, name: string): string | undefined {
  const n = name.startsWith('*:') ? `[\\w.-]+:${name.slice(2)}` : name.replace(/[.:]/g, '\\$&');
  const m = new RegExp(`\\s${n}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(tag);
  return m ? unesc(m[1] ?? m[2] ?? '') : undefined;
}

/** Sets (or adds) an attribute on an opening or empty tag. */
export function withAttr(tag: string, name: string, value: string): string {
  const re = new RegExp(`(\\s${name.replace(/[.:]/g, '\\$&')}\\s*=\\s*)(?:"[^"]*"|'[^']*')`);
  if (re.test(tag)) return tag.replace(re, `$1"${escAttr(value)}"`);
  return tag.replace(/\s*(\/?)>$/, ` ${name}="${escAttr(value)}"$1>`);
}

export interface Rel { id: string; type: string; target: string; external: boolean }
export function parseRels(xml: string | undefined): Rel[] {
  return [...(xml ?? '').matchAll(/<(?:\w+:)?Relationship\b[^>]*>/g)].map((m) => ({
    id: attr(m[0], 'Id') ?? '', type: attr(m[0], 'Type') ?? '', target: attr(m[0], 'Target') ?? '', external: attr(m[0], 'TargetMode') === 'External',
  }));
}

const dirOf = (p: string) => p.slice(0, p.lastIndexOf('/') + 1);

/** A relationship target resolved against the folder of the part that owns the rels. */
export function resolveTarget(fromPart: string, target: string): string {
  const out: string[] = [];
  for (const s of (target.startsWith('/') ? target.slice(1) : dirOf(fromPart) + target).split('/')) {
    if (s === '..') out.pop();
    else if (s !== '.' && s !== '') out.push(s);
  }
  return out.join('/');
}

/** The relative target from one part to another: `xl/worksheets/sheet1.xml` → `xl/comments1.xml` is `../comments1.xml`. */
export function relativeTarget(fromPart: string, toPart: string): string {
  const from = dirOf(fromPart).split('/').filter(Boolean), to = toPart.split('/');
  let i = 0;
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i++;
  return [...Array<string>(from.length - i).fill('..'), ...to.slice(i)].join('/');
}

/** `A1` → zero-based row and column; undefined for anything else. */
export function parseCellRef(ref: string): { row: number; col: number } | undefined {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(ref.trim());
  if (!m) return undefined;
  const col = [...m[1]!.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const row = Number(m[2]) - 1;
  return row >= 0 && col >= 0 ? { row, col } : undefined;
}

export function cellName(row: number, col: number): string {
  let s = '', n = col + 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return `${s}${row + 1}`;
}

/** The top-left cell of `A1` or `A1:C4`, normalised (`a1` → `A1`); undefined when not a reference. */
export function anchorOf(range: string): string | undefined {
  const p = parseCellRef(range.split(':')[0] ?? '');
  return p && cellName(p.row, p.col);
}

/** A part name that does not exist yet: `xl/comments` + n + `.xml`, smallest n from 1. */
export function freeName(has: (p: string) => boolean, prefix: string, suffix: string): string {
  let n = 1;
  while (has(`${prefix}${n}${suffix}`)) n++;
  return `${prefix}${n}${suffix}`;
}

export const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
