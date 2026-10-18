// The `style` change: its shape, where it lives in the change map, how it
// combines with the file's own format, and how a selection's worth of them is
// committed as one undo step.
import { cellKey, type ChangeEntry, type ChangeKind, type Origin, type Selection, type SheetpaneError, type Snapshot, type StoreEvent, type StyleSubset, type WorkbookStore } from '@sheetpane/grid';
import { paletteOf, resolveColor, type Palette } from './color.js';
import { AUTO_INK, BORDER_CSS, SIDES, decoration, xfCss, type Side, type XlBorderSide, type XlFont } from './css.js';

/** A border edge a user drew: an Excel border style and an optional `RRGGBB` colour (absent = automatic). */
export interface BorderEdge { style: string; color?: string }

/**
 * What a user changed about one cell's look — the `now` of a change of kind
 * `style`, a plain JSON object (SR-LAW-9). Every field is optional and
 * overrides the file's format; `null` turns a thing off (automatic colour, no
 * fill, no border side, general alignment). `clear` drops the file's font,
 * fill, border and alignment first (the number format stays).
 */
export interface StylePatch {
  clear?: true;
  b?: boolean;
  i?: boolean;
  u?: boolean;
  strike?: boolean;
  /** Text colour, `RRGGBB`; `null` = automatic. */
  color?: string | null;
  /** Solid fill, `RRGGBB`; `null` = no fill. */
  fill?: string | null;
  border?: Partial<Record<Side, BorderEdge | null>>;
  align?: 'left' | 'center' | 'right' | null;
  valign?: 'top' | 'middle' | 'bottom' | null;
  wrap?: boolean;
}

/**
 * Style changes live at `sheet!#style:A1`, not `sheet!A1`: the change map holds
 * one entry per key, and a cell's value change already owns `sheet!A1` — the
 * two would overwrite each other (see the W-17 report).
 */
export const STYLE_PREFIX = '#style:';
export const styleRef = (ref: string) => `${STYLE_PREFIX}${ref}`;

/** The cell's style change, if any — from a store, or from a snapshot (what `isActive` and `text` are given). */
export function patchOf(from: WorkbookStore | Snapshot, sheet: string, ref: string): StylePatch | undefined {
  const c = 'changeOf' in from ? from.changeOf(sheet, styleRef(ref)) : from.changes.get(cellKey(sheet, styleRef(ref)));
  return c && c.kind === 'style' ? (c.now as StylePatch) : undefined;
}

/** Every style change in the map: `{ sheet, ref, patch }`. */
export function styleChanges(changes: ReadonlyMap<string, ChangeEntry>): { sheet: string; ref: string; patch: StylePatch }[] {
  const out: { sheet: string; ref: string; patch: StylePatch }[] = [];
  for (const [k, c] of changes) {
    if (c.kind !== 'style') continue;
    const at = k.lastIndexOf(`!${STYLE_PREFIX}`);
    if (at < 0) continue;
    out.push({ sheet: k.slice(0, at), ref: k.slice(at + 1 + STYLE_PREFIX.length), patch: c.now as StylePatch });
  }
  return out;
}

// ── the look: what a toggle reads, what a patch is compared against ─────────

/** A cell's look, flattened: what the format row shows as on or off. Colours are `#RRGGBB`; `undefined` is automatic / none. */
export interface Look {
  b: boolean; i: boolean; u: boolean; strike: boolean;
  color: string | undefined;
  fill: string | undefined;
  border: Partial<Record<Side, { style: string; color: string }>>;
  align: string | undefined;
  valign: string | undefined;
  wrap: boolean;
}

export const PLAIN: Look = Object.freeze({ b: false, i: false, u: false, strike: false, color: undefined, fill: undefined, border: Object.freeze({}), align: undefined, valign: undefined, wrap: false }) as Look;

const H: Readonly<Record<string, Look['align']>> = { left: 'left', center: 'center', right: 'right', centerContinuous: 'center', fill: 'left' };
const V: Readonly<Record<string, Look['valign']>> = { top: 'top', center: 'middle', bottom: 'bottom' };

type Book = NonNullable<Snapshot['book']>;

/** The look the file gives a cell (`cellXfs[s]`). */
export function fileLook(book: Book, s: number | undefined, palette: Palette = paletteOf(book)): Look {
  const t = book.styles;
  const xf = s === undefined ? undefined : t.cellXfs[s];
  if (!xf) return PLAIN;
  const f: XlFont = t.fonts[xf.fontId] ?? {};
  const base = t.fonts[0];
  const fill = t.fills[xf.fillId];
  const border: Look['border'] = {};
  const b = t.borders[xf.borderId];
  for (const side of SIDES) {
    const e: XlBorderSide | undefined = b?.[side];
    if (e?.style && BORDER_CSS[e.style]) border[side] = { style: e.style, color: resolveColor(e.color, palette) ?? AUTO_INK };
  }
  const a = xf.alignment;
  return {
    b: !!f.b, i: !!f.i, u: !!f.u && f.u !== 'none', strike: !!f.strike,
    color: f.color && JSON.stringify(f.color) !== JSON.stringify(base?.color) ? resolveColor(f.color, palette) : undefined,
    fill: fill && fill.patternType === 'solid' ? resolveColor(fill.fgColor, palette) ?? resolveColor(fill.bgColor, palette) : fill?.patternType && fill.patternType !== 'none' ? '#808080' : undefined,
    border,
    align: a?.horizontal ? H[a.horizontal] : undefined,
    valign: a?.vertical ? V[a.vertical] : undefined,
    wrap: !!a?.wrapText,
  };
}

const hex = (c: string | null | undefined) => (c ? `#${c.toUpperCase()}` : undefined);
const edgeLook = (e: BorderEdge | null | undefined) => (e ? { style: e.style, color: hex(e.color) ?? AUTO_INK } : undefined);

/** The look after a patch. */
export function applyLook(base: Look, p: StylePatch | undefined): Look {
  if (!p) return base;
  const from = p.clear ? PLAIN : base;
  const border = { ...from.border };
  for (const s of SIDES) if (p.border && s in p.border) { const e = edgeLook(p.border[s]); if (e) border[s] = e; else delete border[s]; }
  return {
    b: p.b ?? from.b, i: p.i ?? from.i, u: p.u ?? from.u, strike: p.strike ?? from.strike,
    color: p.color !== undefined ? hex(p.color) : from.color,
    fill: p.fill !== undefined ? hex(p.fill) : from.fill,
    border,
    align: p.align !== undefined ? p.align ?? undefined : from.align,
    valign: p.valign !== undefined ? p.valign ?? undefined : from.valign,
    wrap: p.wrap ?? from.wrap,
  };
}

const sameEdge = (a: Look['border'][Side], b: Look['border'][Side]) => (!a && !b) || (!!a && !!b && a.style === b.style && a.color === b.color);
export const sameLook = (a: Look, b: Look) =>
  a.b === b.b && a.i === b.i && a.u === b.u && a.strike === b.strike && a.color === b.color && a.fill === b.fill &&
  a.align === b.align && a.valign === b.valign && a.wrap === b.wrap && SIDES.every((s) => sameEdge(a.border[s], b.border[s]));

/**
 * The smallest patch with the same effect, in a fixed key order (the store
 * compares by JSON): fields equal to what the file already shows are dropped;
 * `undefined` when nothing is left — the cell is back to its file look.
 */
export function normalize(p: StylePatch | undefined, base: Look): StylePatch | undefined {
  if (!p) return undefined;
  const clear = !!p.clear && !sameLook(base, PLAIN);
  const ref = clear ? PLAIN : base;
  const out: StylePatch = {};
  if (clear) out.clear = true;
  for (const k of ['b', 'i', 'u', 'strike'] as const) if (p[k] !== undefined && p[k] !== ref[k]) out[k] = p[k];
  if (p.color !== undefined && hex(p.color) !== ref.color) out.color = p.color === null ? null : p.color.toUpperCase();
  if (p.fill !== undefined && hex(p.fill) !== ref.fill) out.fill = p.fill === null ? null : p.fill.toUpperCase();
  if (p.border) {
    const b: NonNullable<StylePatch['border']> = {};
    for (const s of SIDES) {
      if (!(s in p.border)) continue;
      const e = p.border[s] ?? null;
      if (sameEdge(edgeLook(e), ref.border[s])) continue;
      b[s] = e ? (e.color ? { style: e.style, color: e.color.toUpperCase() } : { style: e.style }) : null;
    }
    if (Object.keys(b).length) out.border = b;
  }
  if (p.align !== undefined && (p.align ?? undefined) !== ref.align) out.align = p.align;
  if (p.valign !== undefined && (p.valign ?? undefined) !== ref.valign) out.valign = p.valign;
  if (p.wrap !== undefined && p.wrap !== ref.wrap) out.wrap = p.wrap;
  return Object.keys(out).length ? out : undefined;
}

/** Merges a new partial patch over the cell's current one (a later `border` side wins side by side). */
export function combine(cur: StylePatch | undefined, next: StylePatch): StylePatch {
  if (next.clear) return { ...next };
  const out: StylePatch = { ...cur, ...next };
  if (cur?.border || next.border) out.border = { ...cur?.border, ...next.border };
  return out;
}

/** The CSS a patch adds over the file's CSS (`clear` starts from nothing). */
export function patchCss(fileCss: StyleSubset, p: StylePatch, look: Look): StyleSubset {
  const out: StyleSubset = p.clear ? {} : { ...fileCss };
  if (p.b !== undefined) out['font-weight'] = p.b ? '700' : '400';
  if (p.i !== undefined) out['font-style'] = p.i ? 'italic' : 'normal';
  if (p.u !== undefined || p.strike !== undefined) out['text-decoration'] = decoration(look.u, look.strike) ?? 'none';
  if (p.color !== undefined) { if (p.color) out.color = `#${p.color}`; else delete out.color; }
  if (p.fill !== undefined) { if (p.fill) out['background-color'] = `#${p.fill}`; else delete out['background-color']; }
  if (p.border) for (const s of SIDES) {
    if (!(s in p.border)) continue;
    const e = p.border[s];
    const w = e ? BORDER_CSS[e.style] : undefined;
    if (e && w) out[`border-${s}`] = `${w} ${hex(e.color) ?? AUTO_INK}`; else delete out[`border-${s}`];
  }
  if (p.align !== undefined) { if (p.align) out['text-align'] = p.align; else delete out['text-align']; }
  if (p.valign !== undefined) { if (p.valign) out['vertical-align'] = p.valign; else delete out['vertical-align']; }
  if (p.wrap !== undefined) out['white-space'] = p.wrap ? 'pre-wrap' : 'nowrap';
  return out;
}

/** The file CSS of `cellXfs[s]`, cached per workbook. */
const cssCache = new WeakMap<object, Map<number, StyleSubset>>();
export function cachedXfCss(book: Book, s: number | undefined, palette: Palette): StyleSubset {
  if (s === undefined) return {};
  let m = cssCache.get(book.styles);
  if (!m) cssCache.set(book.styles, (m = new Map()));
  let v = m.get(s);
  if (!v) m.set(s, (v = xfCss(book.styles, s, palette)));
  return v;
}

// ── selections ──────────────────────────────────────────────────────────────

const colIndex = (letters: string) => [...letters.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
export const colName = (c: number): string => { let s = ''; for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
export function parseA1(ref: string): { row: number; col: number } | undefined {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(ref.trim());
  return m ? { row: Number(m[2]) - 1, col: colIndex(m[1]!) } : undefined;
}
export interface Box { top: number; left: number; bottom: number; right: number }
export function parseBox(range: string): Box | undefined {
  const [a, b = a] = range.split(':');
  const p = parseA1(a!), q = parseA1(b!);
  if (!p || !q) return undefined;
  return { top: Math.min(p.row, q.row), left: Math.min(p.col, q.col), bottom: Math.max(p.row, q.row), right: Math.max(p.col, q.col) };
}
export const a1 = (row: number, col: number) => `${colName(col)}${row + 1}`;

/** The most cells one control press restyles. */
export const MAX_CELLS = 50_000;

/** The selection's box: the range when there is one, else the active cell. */
export const selBox = (sel: Selection): Box | undefined => parseBox(sel.range ?? sel.ref);

// ── one undo step for many cells ────────────────────────────────────────────

export interface ChangeSpec { sheet: string; ref: string; kind: ChangeKind; now: unknown; was: unknown }

/** Applies several change-map entries as ONE undo step, through the store's public batch (SR-GRID 20a). */
export function setChanges(store: WorkbookStore, list: readonly ChangeSpec[], origin?: Origin): void {
  store.setChanges(list.map((c) => ({ sheet: c.sheet, ref: c.ref, kind: c.kind, now: c.now, was: c.was })), origin);
}

/** What a style change's `was` is: no patch. */
export const NO_PATCH: StylePatch = Object.freeze({}) as StylePatch;

/**
 * Restyles every cell of the selection: `edit` gets the cell's current look
 * and patch and returns the partial patch to merge in. One undo step.
 */
export function restyle(store: WorkbookStore, sel: Selection, edit: (cell: { ref: string; row: number; col: number; look: Look; box: Box }) => StylePatch | undefined, origin?: Origin): void {
  const snap = store.getSnapshot(), book = snap.book;
  const sheet = store.sheet(sel.sheet), box = selBox(sel);
  if (!book || !sheet || !box || book.source !== 'xlsx') return;
  if ((box.bottom - box.top + 1) * (box.right - box.left + 1) > MAX_CELLS) return;
  const palette = paletteOf(book);
  const list: ChangeSpec[] = [];
  for (let row = box.top; row <= box.bottom; row++) for (let col = box.left; col <= box.right; col++) {
    const ref = a1(row, col);
    const base = fileLook(book, sheet.styleIndex[ref], palette);
    const cur = patchOf(store, sel.sheet, ref);
    const delta = edit({ ref, row, col, look: applyLook(base, cur), box });
    if (!delta) continue;
    const next = normalize(combine(cur, delta), base);
    list.push({ sheet: sel.sheet, ref: styleRef(ref), kind: 'style', now: next, was: NO_PATCH });
  }
  setChanges(store, list, origin);
}

/** A cell's look, its change applied — from a store or a snapshot. */
export function lookAt(from: WorkbookStore | Snapshot, sheet: string, ref: string): Look {
  const snap = 'getSnapshot' in from ? from.getSnapshot() : from;
  const book = snap.book, s = book?.sheets.find((x) => x.name === sheet);
  if (!book || !s) return PLAIN;
  return applyLook(fileLook(book, s.styleIndex[ref]), patchOf(snap, sheet, ref));
}

/** A sheet's merged ranges, `merge` changes applied — what `store.merges()` returns, from a snapshot. */
export function mergesIn(snap: Snapshot, sheet: string): string[] {
  const out = new Set(snap.book?.sheets.find((x) => x.name === sheet)?.merges ?? []);
  const prefix = cellKey(sheet, '#merge:');
  for (const [k, c] of snap.changes) {
    if (c.kind !== 'merge' || !k.startsWith(prefix)) continue;
    const r = k.slice(prefix.length);
    if (c.now) out.add(r); else out.delete(r);
  }
  return [...out];
}
