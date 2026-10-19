// String-level XML helpers the review's write path needs beyond @sheetpane/export's:
// `exportPatch` runs in browsers and in Node, so no DOMParser.
import { cleanXmlChars, encodeOoxmlString, escapeText } from '@sheetpane/export';
import type { Plugin } from '@sheetpane/grid';

/** What `exportPatch` is handed: the package, through `@sheetpane/export`'s context. */
export type PatchContext = Parameters<NonNullable<Plugin['exportPatch']>>[0];

export const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
export const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
export const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const REL_WORKSHEET = `${NS_R}/worksheet`;
export const CT_WORKSHEET = 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml';

/** The most text a cell holds. */
export const MAX_TEXT = 32767;

/** An element, self-closed or not, by local name (any prefix): `<x:xf …/>` or `<xf …>…</xf>`. */
export const elementRe = (name: string, flags = 'g') => new RegExp(`<(?:\\w+:)?${name}\\b[^>]*?(?:/>|>[\\s\\S]*?</(?:\\w+:)?${name}>)`, flags);

/** The opening tag of an element's text. */
export const openTag = (xml: string): string => /^<[^>]*>/.exec(xml)![0];

/** A cell's text as an inline-string body: cleaned of what XML forbids, at most 32,767 characters, SpreadsheetML-escaped. */
export function inlineText(s: string, P = ''): string {
  let text = cleanXmlChars(s.replace(/\r\n?/g, '\n')).text;
  if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT);
  const keep = /^\s|\s$|\n|\t| {2}/.test(text) ? ' xml:space="preserve"' : '';
  return `<${P}is><${P}t${keep}>${escapeText(encodeOoxmlString(text))}</${P}t></${P}is>`;
}

const dirOf = (p: string) => p.slice(0, p.lastIndexOf('/') + 1);

/** The relative target from one part to another: `xl/workbook.xml` → `xl/worksheets/sheet3.xml` is `worksheets/sheet3.xml`. */
export function relativeTarget(fromPart: string, toPart: string): string {
  const from = dirOf(fromPart).split('/').filter(Boolean), to = toPart.split('/');
  let i = 0;
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i++;
  return [...Array<string>(from.length - i).fill('..'), ...to.slice(i)].join('/');
}

/** A part name that does not exist yet: `prefix` + n + `suffix`, smallest n from 1. */
export function freeName(has: (p: string) => boolean, prefix: string, suffix: string): string {
  let n = 1;
  while (has(`${prefix}${n}${suffix}`)) n++;
  return `${prefix}${n}${suffix}`;
}

/** The namespace prefix (with its colon, or `''`) the root element of a part uses. */
export const prefixOf = (xml: string, root: string): string => new RegExp(`<(\\w+:)?${root}\\b`).exec(xml)?.[1] ?? '';
