// SR-IMPORT decision 8: without DOMParser, .xlsx parts are read by the built-in reader — the same
// workbook as the browser reads, malformed XML refused as `corrupt`, a DOCTYPE never expanded.
import { describe, expect, it } from 'vitest';
import { parseMiniXml } from '../packages/import/src/minixml.js';

describe('the built-in XML reader', () => {
  it('reads elements, prefixes, attributes, entities, CDATA and text in order', () => {
    const doc = parseMiniXml('﻿<?xml version="1.0"?>\n<!-- c --><x:a xmlns:x="u" r:id=\'1\' v="&lt;&amp;&#65;&#x42;"><x:b>one<c/>two</x:b><![CDATA[<raw>]]><b>3</b></x:a>');
    const a = doc.documentElement;
    expect([a.localName, a.prefix, a.tagName]).toEqual(['a', 'x', 'x:a']);
    expect(a.getAttribute('v')).toBe('<&AB');
    expect(a.getAttribute('missing')).toBeNull();
    expect([...a.attributes].map((x) => [x.localName, x.prefix])).toEqual([['x', 'xmlns'], ['id', 'r'], ['v', null]]);
    expect(a.textContent).toBe('onetwo<raw>3');
    expect(Array.from(doc.getElementsByTagNameNS('*', 'b')).map((e) => e.textContent)).toEqual(['onetwo', '3']);
    expect(Array.from(doc.getElementsByTagNameNS('*', 'a'))).toEqual([a]);
    expect(a.children[0]!.children[0]!.parentElement!.parentElement).toBe(a);
    expect(a.parentElement).toBeNull();
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
  });
  it('refuses what is not well-formed, and any DOCTYPE', () => {
    for (const bad of ['<a><b></a>', '<a>', '<a/><b/>', '<a x=1/>', '<a>&nbsp;</a>', '<a>& b</a>', 'text', '<!DOCTYPE a [<!ENTITY e "x">]><a>&e;</a>', '<a x="1" x="2"/>']) {
      expect(() => parseMiniXml(bad), bad).toThrow();
    }
  });
});
