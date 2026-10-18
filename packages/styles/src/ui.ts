// @sheetpane/styles/ui — the format row and selection-bar controls (W-17 DoD 3, 4).
// Opt-in: the headless entry never imports this file. Every control restyles
// the whole selection as one undo step; the row shows in Edit only (the grid
// decides). No font picker — the host's font is the font (SR-LAW-5).
import { registerPlugin, type ControlDescriptor, type Plugin, type Selection, type Snapshot, type WorkbookStore } from '@sheetpane/grid';
import { styles, type StylesOptions } from './index.js';
import { a1, lookAt, mergesIn, parseBox, patchOf, restyle, setChanges, type BorderEdge, type Box, type StylePatch } from './model.js';
import type { Side } from './css.js';

/** One colour a picker offers: `RRGGBB` and its name (the name is what the `<select>` shows and a screen reader reads). */
export interface Swatch { value: string; label: string }

/** Options for {@link ui}: the swatches the pickers offer. */
export interface StylesUiOptions {
  /** Text colours the colour picker offers. */
  colours?: readonly Swatch[];
  /** Fills the fill picker offers. */
  fills?: readonly Swatch[];
  /** The fill the selection bar's Fill button applies (`RRGGBB`); default the first of `fills`. */
  highlight?: string;
}

/** The text colours the colour picker offers by default. */
export const DEFAULT_COLOURS: readonly Swatch[] = [
  { value: '000000', label: 'Black' }, { value: '595959', label: 'Dark grey' }, { value: 'C00000', label: 'Red' }, { value: 'C65911', label: 'Orange' },
  { value: '375623', label: 'Green' }, { value: '2346C8', label: 'Blue' }, { value: '7030A0', label: 'Purple' },
];
/** Light fills: each keeps the grid's changed-corner mark (#C46A00) at 3:1 or more (W-17 DoD 7). */
export const DEFAULT_FILLS: readonly Swatch[] = [
  { value: 'FFF2CC', label: 'Yellow' }, { value: 'E2EFDA', label: 'Green' }, { value: 'DDEBF7', label: 'Blue' }, { value: 'FCE4D6', label: 'Orange' },
  { value: 'FCE8E8', label: 'Red' }, { value: 'EDEDED', label: 'Grey' },
];

const svg = (d: string, w = 1.75) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
/** The controls' icons: inline SVG drawn in `currentColor`, keyed by control. */
export const ICONS = {
  bold: svg('M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z', 2.5),
  italic: svg('M10 5h8M6 19h8M15 5L9 19'),
  underline: svg('M7 4v7a5 5 0 0 0 10 0V4M5 20h14'),
  strike: svg('M4 12h16M16 7a4 3 0 0 0-4-2c-2.5 0-4 1.3-4 3M8 17a4 3 0 0 0 4 2c2.5 0 4-1.3 4-3'),
  left: svg('M4 6h16M4 10h10M4 14h16M4 18h10'),
  center: svg('M4 6h16M7 10h10M4 14h16M7 18h10'),
  right: svg('M4 6h16M10 10h10M4 14h16M10 18h10'),
  top: svg('M4 4h16M12 20V8M8 12l4-4 4 4'),
  middle: svg('M4 12h16M12 3v5M9 6l3 2 3-2M12 21v-5M9 18l3-2 3 2'),
  bottom: svg('M4 20h16M12 4v12M8 12l4 4 4-4'),
  wrap: svg('M4 6h16M4 12h13a3 3 0 0 1 0 6h-4M15 16l-2 2 2 2M4 18h5'),
  merge: svg('M3 5h18v14H3zM4 12h5M15 12h5M7 10l2 2-2 2M17 10l-2 2 2 2'),
  fill: svg('M5 11l6-6 7 7-6 6a2 2 0 0 1-3 0l-4-4a2 2 0 0 1 0-3zM19 15s2 2.2 2 3.5a2 2 0 0 1-4 0c0-1.3 2-3.5 2-3.5z'),
  clear: svg('M6 19h7M9 5h10M14 5l-4 14M4 4l16 16'),
};

const isXlsx = (snap: Snapshot) => snap.book?.source === 'xlsx';

/** A toggle: on when the active cell has it; pressing sets the opposite on the whole selection (Excel's rule). */
function toggle(id: string, slot: 'format-row' | 'selbar', group: string, label: string, icon: string, key: 'b' | 'i' | 'u' | 'strike' | 'wrap', shortcut?: string): ControlDescriptor {
  const c: ControlDescriptor = {
    id, slot, group, label, icon, mode: 'edit',
    isActive: (snap, sel) => isXlsx(snap) && lookAt(snap, sel.sheet, sel.ref)[key],
    run: (s, sel) => {
      const on = lookAt(s, sel.sheet, sel.ref)[key];
      restyle(s, sel, () => ({ [key]: !on }) as StylePatch);
    },
  };
  if (shortcut) c.shortcut = shortcut;
  return c;
}

function alignButton(id: string, label: string, icon: string, key: 'align' | 'valign', v: string, shortcut?: string): ControlDescriptor {
  const c: ControlDescriptor = {
    id, slot: 'format-row', group: 'align', label, icon, mode: 'edit',
    isActive: (snap, sel) => isXlsx(snap) && lookAt(snap, sel.sheet, sel.ref)[key] === v,
    run: (s, sel) => {
      const on = lookAt(s, sel.sheet, sel.ref)[key] === v;
      restyle(s, sel, () => ({ [key]: on ? null : v }) as StylePatch);
    },
  };
  if (shortcut) c.shortcut = shortcut;
  return c;
}

const THIN: BorderEdge = { style: 'thin' };
/**
 * The border edges a `Borders` choice gives one cell of the selection box (`outside` draws only the box's edges).
 *
 * @param choice - A {@link BORDER_CHOICES} value (`all`, `outside`, `top`, … `none`).
 * @param row - The cell's row, 0-based.
 * @param col - The cell's column, 0-based.
 * @param box - The selection box.
 * @returns The sides to set (`null` removes one), or `undefined` when the choice gives this cell none.
 */
export function borderEdges(choice: string, row: number, col: number, box: Box): StylePatch['border'] | undefined {
  const edge = (on: boolean, e: BorderEdge = THIN) => (on ? e : undefined);
  const pick = (sides: Partial<Record<Side, BorderEdge | null | undefined>>) => {
    const out: NonNullable<StylePatch['border']> = {};
    for (const [k, v] of Object.entries(sides) as [Side, BorderEdge | null | undefined][]) if (v !== undefined) out[k] = v;
    return Object.keys(out).length ? out : undefined;
  };
  switch (choice) {
    case 'all': return { top: THIN, right: THIN, bottom: THIN, left: THIN };
    case 'outside': return pick({ top: edge(row === box.top), bottom: edge(row === box.bottom), left: edge(col === box.left), right: edge(col === box.right) });
    case 'top': return pick({ top: edge(row === box.top) });
    case 'bottom': return pick({ bottom: edge(row === box.bottom) });
    case 'left': return pick({ left: edge(col === box.left) });
    case 'right': return pick({ right: edge(col === box.right) });
    case 'thick-bottom': return pick({ bottom: edge(row === box.bottom, { style: 'thick' }) });
    case 'double-bottom': return pick({ bottom: edge(row === box.bottom, { style: 'double' }) });
    case 'none': return { top: null, right: null, bottom: null, left: null };
    default: return undefined;
  }
}

/** The Borders menu's choices; the first (`''`) names the menu. */
export const BORDER_CHOICES: readonly Swatch[] = [
  { value: '', label: 'Borders' }, { value: 'all', label: 'All borders' }, { value: 'outside', label: 'Outside borders' },
  { value: 'top', label: 'Top border' }, { value: 'bottom', label: 'Bottom border' }, { value: 'left', label: 'Left border' }, { value: 'right', label: 'Right border' },
  { value: 'thick-bottom', label: 'Thick bottom border' }, { value: 'double-bottom', label: 'Double bottom border' }, { value: 'none', label: 'No border' },
];

/** The merged range the active cell sits in, if any. */
function mergeAt(snap: Snapshot, sheet: string, ref: string): string | undefined {
  const p = parseBox(ref);
  if (!p) return undefined;
  return mergesIn(snap, sheet).find((m) => { const b = parseBox(m); return !!b && p.top >= b.top && p.top <= b.bottom && p.left >= b.left && p.left <= b.right; });
}
const overlaps = (a: Box, b: Box) => a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom;

/**
 * Merge / Unmerge — core merges (SR-GRID 21a): a merged range under the
 * selection is unmerged; otherwise a selected range is merged (merges it
 * overlaps are unmerged in the same undo step). One cell, not merged: nothing.
 *
 * @param store - The workbook store.
 * @param sel - The selection.
 */
export function toggleMerge(store: WorkbookStore, sel: Selection): void {
  const snap = store.getSnapshot();
  if (!isXlsx(snap)) return;
  const hit = mergeAt(snap, sel.sheet, sel.ref);
  const box = sel.range ? parseBox(sel.range) : undefined;
  const range = box && `${a1(box.top, box.left)}:${a1(box.bottom, box.right)}`;
  if (hit && (!range || range === hit || (box && contains(parseBox(hit)!, box)))) { store.setMerge(sel.sheet, hit, false); return; }
  if (!box || !range || (box.top === box.bottom && box.left === box.right)) return;
  const over = store.merges(sel.sheet).filter((m) => { const b = parseBox(m); return !!b && overlaps(b, box); });
  if (!over.length) { store.setMerge(sel.sheet, range, true); return; }
  const fileMerges = store.sheet(sel.sheet)?.merges ?? [];
  setChanges(store, [
    ...over.map((m) => ({ sheet: sel.sheet, ref: `#merge:${m}`, kind: 'merge' as const, now: false, was: fileMerges.includes(m) })),
    { sheet: sel.sheet, ref: `#merge:${range}`, kind: 'merge' as const, now: true, was: fileMerges.includes(range) },
  ]);
}
const contains = (outer: Box, inner: Box) => inner.top >= outer.top && inner.bottom <= outer.bottom && inner.left >= outer.left && inner.right <= outer.right;

function mergeControl(id: string, slot: 'format-row' | 'selbar', group: string): ControlDescriptor {
  return {
    id, slot, group, label: 'Merge / Unmerge', icon: ICONS.merge, mode: 'edit',
    isActive: (snap, sel) => isXlsx(snap) && !!mergeAt(snap, sel.sheet, sel.ref),
    labelFor: (snap, sel) => (mergeAt(snap, sel.sheet, sel.ref) ? 'Unmerge' : 'Merge'),
    disabled: (snap, sel) => !isXlsx(snap) || (!sel.range && !mergeAt(snap, sel.sheet, sel.ref)),
    run: (s, sel) => toggleMerge(s, sel),
  };
}

/**
 * What changed, in words, for the status line: "Style changed · Bold, Fill".
 *
 * @param p - The cell's patch, or `undefined`.
 * @returns The sentence, or `''` when nothing changed.
 */
export function describe(p: StylePatch | undefined): string {
  if (!p) return '';
  const w: string[] = [];
  if (p.clear) w.push('Cleared');
  const on = (k: 'b' | 'i' | 'u' | 'strike' | 'wrap', yes: string, no: string) => { if (p[k] !== undefined) w.push(p[k] ? yes : no); };
  on('b', 'Bold', 'Not bold'); on('i', 'Italic', 'Not italic'); on('u', 'Underline', 'No underline'); on('strike', 'Strikethrough', 'No strikethrough');
  if (p.color !== undefined) w.push(p.color ? 'Text colour' : 'Automatic colour');
  if (p.fill !== undefined) w.push(p.fill ? 'Fill' : 'No fill');
  if (p.border) w.push('Borders');
  if (p.align !== undefined || p.valign !== undefined) w.push('Alignment');
  on('wrap', 'Wrap', 'No wrap');
  return w.length ? `Style changed · ${w.join(', ')}` : '';
}

/**
 * The opt-in controls for Edit mode: the format row (text · colour · fill · border · align · merge · wrap · clear),
 * the selection bar (Bold · Fill · Merge) and a status note. Every action restyles the selection as one undo step.
 * Pair it with {@link styles}; importing this module makes `plugins="styles"` enable both. No font picker.
 *
 * @param o - The colour and fill swatches, and the selection bar's highlight.
 * @returns The controls plugin (`id: 'styles-ui'`).
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0110_STYLES.md
 * @example
 * ```ts
 * import { createWorkbook } from '@sheetpane/grid';
 * import { styles } from '@sheetpane/styles';
 * import { ui } from '@sheetpane/styles/ui';
 *
 * const book = createWorkbook({ plugins: [styles(), ui({ highlight: 'E2EFDA' })] });
 * ```
 * @example
 * ```ts
 * import '@sheetpane/styles/ui'; // registers `styles` with its controls
 * excel.setAttribute('plugins', 'styles');
 * ```
 */
export function ui(o: StylesUiOptions = {}): Plugin {
  const colours = o.colours ?? DEFAULT_COLOURS, fills = o.fills ?? DEFAULT_FILLS;
  const highlight = (o.highlight ?? fills[0]?.value ?? 'FFF2CC').toUpperCase();
  const picker = (id: string, group: string, label: string, list: readonly Swatch[], none: Swatch, key: 'color' | 'fill'): ControlDescriptor => ({
    id, slot: 'format-row', group, label, mode: 'edit',
    // A menu, not a state display: the first option names it, and any pick — the same colour again on another range included — applies.
    options: () => [{ value: '', label }, none, ...list],
    value: () => '',
    choose: (s, sel, v) => {
      if (!v) return;
      const c = v === none.value ? null : v.toUpperCase();
      restyle(s, sel, () => ({ [key]: c }) as StylePatch);
    },
  });
  const controls: ControlDescriptor[] = [
    toggle('styles-bold', 'format-row', 'text', 'Bold', ICONS.bold, 'b', 'Mod+B'),
    toggle('styles-italic', 'format-row', 'text', 'Italic', ICONS.italic, 'i', 'Mod+I'),
    toggle('styles-underline', 'format-row', 'text', 'Underline', ICONS.underline, 'u', 'Mod+U'),
    toggle('styles-strike', 'format-row', 'text', 'Strikethrough', ICONS.strike, 'strike', 'Mod+5'),
    picker('styles-colour', 'colour', 'Text colour', colours, { value: 'auto', label: 'Automatic' }, 'color'),
    picker('styles-fill', 'fill', 'Fill', fills, { value: 'none', label: 'No fill' }, 'fill'),
    {
      id: 'styles-border', slot: 'format-row', group: 'border', label: 'Borders', mode: 'edit',
      options: () => [...BORDER_CHOICES],
      value: () => '',
      choose: (s, sel, v) => { if (v) restyle(s, sel, ({ row, col, box }) => { const b = borderEdges(v, row, col, box); return b ? { border: b } : undefined; }); },
    },
    alignButton('styles-align-left', 'Align left', ICONS.left, 'align', 'left', 'Mod+Shift+L'),
    alignButton('styles-align-center', 'Align centre', ICONS.center, 'align', 'center', 'Mod+Shift+E'),
    alignButton('styles-align-right', 'Align right', ICONS.right, 'align', 'right', 'Mod+Shift+R'),
    alignButton('styles-valign-top', 'Align top', ICONS.top, 'valign', 'top'),
    alignButton('styles-valign-middle', 'Align middle', ICONS.middle, 'valign', 'middle'),
    alignButton('styles-valign-bottom', 'Align bottom', ICONS.bottom, 'valign', 'bottom'),
    mergeControl('styles-merge', 'format-row', 'align'),
    toggle('styles-wrap', 'format-row', 'wrap', 'Wrap text', ICONS.wrap, 'wrap'),
    {
      id: 'styles-clear', slot: 'format-row', group: 'clear', label: 'Clear formatting', icon: ICONS.clear, shortcut: 'Mod+\\', mode: 'edit',
      run: (s, sel) => restyle(s, sel, () => ({ clear: true })),
    },
    toggle('styles-sel-bold', 'selbar', 'styles', 'Bold', ICONS.bold, 'b'),
    {
      id: 'styles-sel-fill', slot: 'selbar', group: 'styles', label: 'Fill', icon: ICONS.fill, mode: 'edit',
      isActive: (snap, sel) => isXlsx(snap) && !!lookAt(snap, sel.sheet, sel.ref).fill,
      run: (s, sel) => { const on = !!lookAt(s, sel.sheet, sel.ref).fill; restyle(s, sel, () => ({ fill: on ? null : highlight })); },
    },
    mergeControl('styles-sel-merge', 'selbar', 'styles'),
    {
      id: 'styles-status', slot: 'status', group: 'styles', label: 'Style', mode: 'edit',
      text: (snap, sel) => describe(patchOf(snap, sel.sheet, sel.ref)),
    },
  ];
  return { id: 'styles-ui', provides: [], controls };
}

export type { StylesOptions };

registerPlugin('styles', () => [styles(), ui()]);
