// A small XML reader for when `DOMParser` is absent (Node, workers): it builds just the part of
// the DOM that the .xlsx reader touches — `documentElement`, `children`, `parentElement`,
// `localName`, `attributes`, `getAttribute`, `hasAttribute`, `textContent` and `getElementsByTagNameNS('*', …)` —
// so one reading path serves the browser and Node (SR-IMPORT decision 8). Namespaces are kept as
// prefixes only, which is all `dom.ts` asks of them. A DOCTYPE is refused: OOXML parts never carry
// one, and refusing it means no entity expansion.

/** One attribute, as `Element.attributes` lists it. */
interface MiniAttr { readonly name: string; readonly localName: string; readonly prefix: string | null; readonly value: string }

/** The element shape `dom.ts` and `xlsx.ts` read; cast to `Element` at the boundary. */
class MiniElement {
  readonly localName: string;
  readonly prefix: string | null;
  readonly children: MiniElement[] = [];
  readonly attributes: MiniAttr[] = [];
  /** Text and child elements in document order, for `textContent`. */
  readonly nodes: (string | MiniElement)[] = [];
  parentElement: MiniElement | null = null;
  constructor(readonly tagName: string) {
    const i = tagName.indexOf(':');
    this.prefix = i < 0 ? null : tagName.slice(0, i);
    this.localName = i < 0 ? tagName : tagName.slice(i + 1);
  }
  getAttribute(name: string): string | null {
    for (const a of this.attributes) if (a.name === name) return a.value;
    return null;
  }
  hasAttribute(name: string): boolean {
    return this.getAttribute(name) !== null;
  }
  get textContent(): string {
    let s = '';
    for (const n of this.nodes) s += typeof n === 'string' ? n : n.textContent;
    return s;
  }
  getElementsByTagNameNS(_ns: string, local: string): MiniElement[] {
    const out: MiniElement[] = [];
    collect(this, (e) => local === '*' || e.localName === local, out);
    return out;
  }
  getElementsByTagName(name: string): MiniElement[] {
    const out: MiniElement[] = [];
    collect(this, (e) => name === '*' || e.tagName === name, out);
    return out;
  }
}

/** Descendants in document order, iteratively — a deep part never overflows the stack. */
function collect(from: MiniElement, test: (e: MiniElement) => boolean, out: MiniElement[]): void {
  const stack: MiniElement[] = [];
  for (let i = from.children.length - 1; i >= 0; i--) stack.push(from.children[i]!);
  while (stack.length) {
    const e = stack.pop()!;
    if (test(e)) out.push(e);
    for (let i = e.children.length - 1; i >= 0; i--) stack.push(e.children[i]!);
  }
}

/** The document shape: its root element, and lookups that include the root itself. */
class MiniDocument {
  constructor(readonly documentElement: MiniElement) {}
  getElementsByTagNameNS(ns: string, local: string): MiniElement[] {
    const r = this.documentElement;
    return [...(local === '*' || r.localName === local ? [r] : []), ...r.getElementsByTagNameNS(ns, local)];
  }
  getElementsByTagName(name: string): MiniElement[] {
    const r = this.documentElement;
    return [...(name === '*' || r.tagName === name ? [r] : []), ...r.getElementsByTagName(name)];
  }
}

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function decode(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&([^;&\s]*);?/g, (whole, name: string) => {
    if (!whole.endsWith(';')) throw new Error('a bare &');
    if (name[0] === '#') {
      const cp = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) throw new Error(`a bad character reference &${name};`);
      return String.fromCodePoint(cp);
    }
    const v = ENTITIES[name];
    if (v === undefined) throw new Error(`an unknown entity &${name};`);
    return v;
  });
}

const NAME = /[^\s/>=]+/y;
const SPACE = /\s*/y;

/**
 * Parses an XML document into the DOM subset the .xlsx reader uses.
 * @param text - The XML text.
 * @returns The document, cast to `Document` for the reader.
 * @throws Error when the text is not well-formed — the caller names the part.
 */
export function parseMiniXml(text: string): Document {
  const n = text.length;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const stack: MiniElement[] = [];
  let root: MiniElement | undefined;
  const fail = (why: string): never => { throw new Error(why); };
  const addText = (s: string) => {
    const top = stack[stack.length - 1];
    if (top) top.nodes.push(decode(s));
    else if (s.trim()) fail('text outside the root element');
  };
  while (i < n) {
    const lt = text.indexOf('<', i);
    if (lt < 0) { addText(text.slice(i)); break; }
    if (lt > i) addText(text.slice(i, lt));
    const c1 = text.charCodeAt(lt + 1);
    if (c1 === 63 /* ? */) { const e = text.indexOf('?>', lt + 2); if (e < 0) fail('an unclosed processing instruction'); i = e + 2; continue; }
    if (c1 === 33 /* ! */) {
      if (text.startsWith('<!--', lt)) { const e = text.indexOf('-->', lt + 4); if (e < 0) fail('an unclosed comment'); i = e + 3; continue; }
      if (text.startsWith('<![CDATA[', lt)) {
        const e = text.indexOf(']]>', lt + 9); if (e < 0) fail('an unclosed CDATA section');
        const top = stack[stack.length - 1]; if (!top) fail('CDATA outside the root element');
        top!.nodes.push(text.slice(lt + 9, e)); i = e + 3; continue;
      }
      fail('a DOCTYPE or declaration (not read, so no entity is ever expanded)');
    }
    if (c1 === 47 /* / */) {
      const e = text.indexOf('>', lt + 2); if (e < 0) fail('an unclosed end tag');
      const name = text.slice(lt + 2, e).trim();
      const top = stack.pop();
      if (!top || top.tagName !== name) fail(`</${name}> does not close <${top?.tagName ?? ''}>`);
      i = e + 1; continue;
    }
    // a start tag
    NAME.lastIndex = lt + 1;
    const name = NAME.exec(text)?.[0];
    if (!name) fail('a tag with no name');
    const el = new MiniElement(name!);
    let j = NAME.lastIndex, closed = false;
    for (;;) {
      SPACE.lastIndex = j; SPACE.exec(text); j = SPACE.lastIndex;
      if (j >= n) fail(`an unclosed <${name}>`);
      if (text.charCodeAt(j) === 62 /* > */) { j++; break; }
      if (text.startsWith('/>', j)) { j += 2; closed = true; break; }
      NAME.lastIndex = j;
      const an = NAME.exec(text)?.[0];
      if (!an) fail(`a bad attribute in <${name}>`);
      j = NAME.lastIndex;
      SPACE.lastIndex = j; SPACE.exec(text); j = SPACE.lastIndex;
      if (text[j] !== '=') fail(`attribute ${an} in <${name}> has no value`);
      SPACE.lastIndex = j + 1; SPACE.exec(text); j = SPACE.lastIndex;
      const q = text[j];
      if (q !== '"' && q !== "'") fail(`attribute ${an} in <${name}> is not quoted`);
      const end = text.indexOf(q!, j + 1); if (end < 0) fail(`attribute ${an} in <${name}> is not closed`);
      const ci = an!.indexOf(':');
      if (el.getAttribute(an!) !== null) fail(`attribute ${an} repeats in <${name}>`);
      el.attributes.push({ name: an!, localName: ci < 0 ? an! : an!.slice(ci + 1), prefix: ci < 0 ? null : an!.slice(0, ci), value: decode(text.slice(j + 1, end)) });
      j = end + 1;
    }
    const parent = stack[stack.length - 1];
    if (parent) { el.parentElement = parent; parent.children.push(el); parent.nodes.push(el); }
    else if (root) fail('a second root element');
    else root = el;
    if (!closed) stack.push(el);
    i = j;
  }
  if (stack.length) fail(`an unclosed <${stack[stack.length - 1]!.tagName}>`);
  if (!root) fail('no root element');
  return new MiniDocument(root!) as unknown as Document;
}
