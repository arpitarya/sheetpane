// W-66: the cell a page opens at — the `ref` attribute's text and the opt-in `link="hash"` fragment,
// `#sheetpane=<pane>:<Sheet>!<ref>`. Pure string work, no DOM: the element reads `location.hash` and
// writes it back with `history.replaceState`. A URL fragment is never sent to a server (SR-LAW-11).
import { parseRange, type RangePos } from '@sheetpane/export';

/** The key of sheetpane's part of a URL fragment: `sheetpane=<pane>:<Sheet>!<ref>`. */
export const LINK_KEY = 'sheetpane';

/** A cell or range to open at: the sheet it names (none: the sheet shown) and its A1 corners. */
export interface LinkTarget { sheet?: string; range: RangePos }

/** `Data!B3` → `{ sheet: 'Data', ref: 'B3' }`; `'Q3 data'!B3` is unquoted; `B3` names no sheet. */
export function splitSheetRef(text: string): { sheet?: string; ref: string } {
  const i = text.lastIndexOf('!');
  if (i < 0) return { ref: text.trim() };
  let sheet = text.slice(0, i).trim();
  if (sheet.length >= 2 && sheet.startsWith("'") && sheet.endsWith("'")) sheet = sheet.slice(1, -1).replace(/''/g, "'");
  return { sheet, ref: text.slice(i + 1).trim() };
}

/**
 * Reads `B4`, `Data!B4`, `'Q3 data'!B4:D8` — a cell or an A1 range, with or without its sheet.
 * @param text - The reference as a host or a link writes it.
 * @returns The target, or `undefined` when the text is not a cell or range (the sheet is checked by the caller).
 */
export function parseTarget(text: string): LinkTarget | undefined {
  const at = splitSheetRef(text), range = parseRange(at.ref);
  if (!range || at.sheet === '') return undefined;
  return at.sheet === undefined ? { range } : { sheet: at.sheet, range };
}

// The value is `<pane>:<Sheet>!<ref>`, the pane and sheet percent-encoded with `!` too, so the last literal `!`
// ends the sheet and the one literal `:` before it ends the pane (a range's own `:` comes after the `!`).
// No pane: `<Sheet>!<ref>`. No sheet (written by hand; sheetpane always writes it): `<pane>:<ref>`.
const enc = (s: string) => encodeURIComponent(s).replace(/!/g, '%21').replace(/'/g, '%27');
const dec = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

/** The fragment's parts: a hash router's path (`/reports/12`, `!/x`) and the `&`-separated parameters after it. */
function partsOf(hash: string): { path: string | undefined; params: string[] } {
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  if (/^!?\//.test(h)) { const q = h.indexOf('?'); return { path: q < 0 ? h : h.slice(0, q), params: q < 0 ? [] : h.slice(q + 1).split('&').filter(Boolean) }; }
  return { path: undefined, params: h.split('&').filter(Boolean) };
}
/** A `sheetpane=` parameter's pane (`''` for none), sheet and ref — `undefined` when the parameter is not ours. */
function valueOf(param: string): { pane: string; sheet?: string; ref: string } | undefined {
  if (!param.startsWith(`${LINK_KEY}=`)) return undefined;
  const v = param.slice(LINK_KEY.length + 1), j = v.lastIndexOf('!');
  const head = j < 0 ? v : v.slice(0, j), i = head.indexOf(':');
  if (j < 0) return i < 0 ? { pane: '', ref: dec(v) } : { pane: dec(v.slice(0, i)), ref: dec(v.slice(i + 1)) };
  const sheet = dec(i < 0 ? head : head.slice(i + 1));
  return { pane: i < 0 ? '' : dec(head.slice(0, i)), sheet, ref: dec(v.slice(j + 1)) };
}

/**
 * The link for a pane in a URL fragment, as `Sheet!B4` text.
 * @param hash - `location.hash`, with or without its `#`.
 * @param pane - The element's `pane` (`''` when it has none).
 * @returns The reference text (`'Q3 data'!B4` when the sheet needs quoting), or `undefined` when the fragment names nothing for this pane.
 */
export function readLink(hash: string, pane: string): string | undefined {
  const at = partsOf(hash).params.map(valueOf).find((x) => x?.pane === pane);
  if (!at) return undefined;
  if (at.sheet === undefined) return at.ref;
  return `${/^[\w.]+$/.test(at.sheet) ? at.sheet : `'${at.sheet.replace(/'/g, "''")}'`}!${at.ref}`;
}

/**
 * A fragment with this pane's link set (or removed), every other part kept as it was: the link replaces the
 * pane's old one where it stood; a new one goes after a hash router's path with `?` (`#/reports/12?sheetpane=…`),
 * after anything else with `&`, or alone.
 * @param hash - `location.hash`, with or without its `#`.
 * @param pane - The element's `pane` (`''` when it has none).
 * @param at - The sheet and the cell or range (`B4`, `B4:D8`) to link to; `undefined` removes the pane's link.
 * @returns The new fragment, without its `#` (`''`: no fragment).
 */
export function writeLink(hash: string, pane: string, at: { sheet: string; ref: string } | undefined): string {
  const { path, params } = partsOf(hash);
  const mine = at && `${LINK_KEY}=${pane ? `${enc(pane)}:` : ''}${enc(at.sheet)}!${at.ref}`;
  const i = params.findIndex((x) => valueOf(x)?.pane === pane);
  const kept = params.flatMap((x, k) => (valueOf(x)?.pane !== pane ? [x] : k === i && mine ? [mine] : []));
  if (i < 0 && mine) kept.push(mine);
  return path === undefined ? kept.join('&') : `${path}${kept.length ? `?${kept.join('&')}` : ''}`;
}
