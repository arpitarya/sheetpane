// DOMParser helpers that ignore namespace prefixes (files use x:, none, or others).
import { ImportError } from './errors.js';
import { parseMiniXml } from './minixml.js';

export function parseXml(text: string, what: string): Document {
  if (typeof DOMParser === 'undefined') {
    // Node and workers: the built-in reader (SR-IMPORT decision 8)
    try { return parseMiniXml(text); } catch (e) { throw new ImportError('corrupt', `${what} is not well-formed XML — ${(e as Error).message}`); }
  }
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new ImportError('corrupt', `${what} is not well-formed XML`);
  return doc;
}

/** Every descendant element with this local name. */
export const all = (n: Document | Element, local: string): Element[] => Array.from(n.getElementsByTagNameNS('*', local));
/** Direct children with this local name. */
export const kids = (n: Element, local: string): Element[] => Array.from(n.children).filter((c) => c.localName === local);
export const kid = (n: Element, local: string): Element | undefined => Array.from(n.children).find((c) => c.localName === local);
export const first = (n: Document | Element, local: string): Element | undefined => n.getElementsByTagNameNS('*', local)[0];

export const num = (e: Element | undefined, a: string): number | undefined => {
  const v = e?.getAttribute(a);
  return v === null || v === undefined || v === '' ? undefined : Number(v);
};
export const bool = (e: Element | undefined, a: string, dflt = false): boolean => {
  const v = e?.getAttribute(a);
  return v === null || v === undefined ? dflt : v === '1' || v === 'true';
};
export const str = (e: Element | undefined, a: string): string | undefined => e?.getAttribute(a) ?? undefined;

/** An attribute in the relationships namespace, whatever its prefix (`r:id`, `r:embed`). */
export function relAttr(e: Element, local: string): string | undefined {
  for (const a of Array.from(e.attributes)) if (a.localName === local && a.prefix) return a.value;
  return undefined;
}
