// @sheetpane/condfmt/ui — the legend and the count (W-19 DoD 7). Colour never
// carries meaning alone: hovering a rule-coloured cell names the rule and its
// range; the selected cell's rules are named in the cell bar (keyboard and
// screen-reader users reach that one); the status line counts the file's rules.
// Opt-in: the headless entry never imports this file. Nothing here runs at
// import time but the registration; the DOM is touched only when the grid
// draws the overlay.
import { registerPlugin, type ControlDescriptor, type OverlayItem, type Plugin, type PluginContext, type Selection, type Snapshot, type WorkbookStore } from '@sheetpane/grid';
import { condfmt, skippedRules, storeOf } from './index.js';
import { legendAt, usedRange } from './evaluate.js';
import { parseA1, rulesOf } from './rules.js';

/** The controls plugin's id. */
export const UI_ID = 'condfmt-ui';

/**
 * The status line: `3 conditional rules from the file`, plus `· 1 not shown` when some are skipped.
 *
 * @param snap - A snapshot of the store.
 * @returns The text; `''` when the file has no rules.
 */
export function statusText(snap: Snapshot): string {
  const book = snap.book;
  if (!book) return '';
  const report = skippedRules(storeOf(book) ?? book);
  if (!report.rules) return '';
  const n = report.rules, k = report.skipped.length;
  return `${n} conditional rule${n === 1 ? '' : 's'} from the file${k ? ` · ${k} not shown` : ''}`;
}

/**
 * The legend for one cell: `Conditional: greater than 1000 · F3:F15` for each rule that drew it (`; ` between).
 *
 * @param store - The workbook store.
 * @param sheet - The sheet's name.
 * @param ref - The cell, `A1`.
 * @returns The text; `''` when no rule drew the cell.
 */
export function legendText(store: WorkbookStore, sheet: string, ref: string): string {
  const p = parseA1(ref);
  if (!p) return '';
  const hits = legendAt(store, sheet, p.row, p.col);
  return hits.length ? `Conditional: ${hits.map((h) => `${h.words} · ${h.range}`).join('; ')}` : '';
}

const selectedLegend = (snap: Snapshot, sel: Selection): string => {
  const store = storeOf(snap.book);
  return store && snap.book ? legendText(store, sel.sheet, sel.ref) : '';
};

const status: ControlDescriptor = {
  id: 'condfmt-status',
  slot: 'status',
  group: 'condfmt',
  label: 'Conditional formatting',
  mode: 'both',
  text: (snap) => statusText(snap),
};

const cellbar: ControlDescriptor = {
  id: 'condfmt-legend',
  slot: 'cellbar',
  group: 'condfmt',
  label: 'Conditional formatting at this cell',
  mode: 'both',
  text: (snap, sel) => selectedLegend(snap, sel),
};

// ── the hover legend (overlay) ────────────────────────────────────────────
/**
 * The plugin host has no per-cell hover text (a `cell` control's label is
 * fixed; `title` is not a `decorate` property), so the legend is one
 * pass-through overlay item over the rule ranges. It listens for `pointerover`
 * on the grid's shadow root and draws a tooltip under the hovered cell.
 */
const TIP_CSS = 'position:absolute;z-index:9;display:flex;flex-direction:column;gap:2px;max-width:320px;padding:5px 8px;border-radius:var(--sp-r,6px);background:var(--sp-surface);color:var(--sp-ink);border:1px solid var(--sp-line);box-shadow:var(--sp-shadow);font-size:12px;line-height:1.35;white-space:normal;pointer-events:none';

function legendLayer(store: WorkbookStore, sheet: string): HTMLElement {
  const root = document.createElement('div');
  root.className = 'cf-legend';
  root.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  const tip = document.createElement('div');
  tip.className = 'cf-tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  tip.style.cssText = TIP_CSS;
  root.append(tip);
  let bound: ShadowRoot | undefined;
  const hide = () => { tip.hidden = true; };
  const onOver = (e: Event) => {
    if (!root.isConnected) return hide();
    const cell = (e.target as Element | null)?.closest?.('[role="gridcell"][data-r][data-c]') as HTMLElement | null;
    if (!cell) return hide();
    const row = Number(cell.dataset.r), col = Number(cell.dataset.c);
    const hits = legendAt(store, sheet, row, col);
    if (!hits.length) return hide();
    tip.replaceChildren(...hits.flatMap((h) => {
      const w = document.createElement('span'); w.className = 'cf-words'; w.textContent = `Conditional: ${h.words}`;
      const r = document.createElement('span'); r.className = 'cf-range'; r.textContent = h.range; r.style.cssText = 'color:var(--sp-ink-3);font-size:11px';
      return [w, r];
    }));
    tip.hidden = false;
    const base = root.getBoundingClientRect(), box = cell.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let top = box.bottom - base.top + 4;
    if (top + th > base.height) top = Math.max(0, box.top - base.top - th - 4);
    const left = Math.max(0, Math.min(box.left - base.left, base.width - tw));
    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
  };
  const onOut = (e: Event) => {
    const to = (e as PointerEvent).relatedTarget as Node | null;
    if (!to || !bound?.contains(to)) hide();
  };
  // The grid appends the item's element right after render(); bind once it is in the shadow root.
  let tries = 0;
  const bind = () => {
    if (bound) return;
    const rn = root.getRootNode();
    if (rn instanceof ShadowRoot) {
      bound = rn;
      rn.addEventListener('pointerover', onOver);
      rn.addEventListener('pointerout', onOut);
      return;
    }
    if (tries++ < 20) requestAnimationFrame(bind);
  };
  queueMicrotask(bind);
  return root;
}

/** The overlay: one pass-through item spanning the sheet's rule ranges, clipped to the cells it uses. */
function overlay(sheet: string, ctx: PluginContext & { geometry: { colX(c: number): number; rowY(r: number): number } }): OverlayItem[] {
  const book = ctx.book, s = book?.sheets.find((x) => x.name === sheet);
  if (!book || !s) return [];
  const rules = rulesOf(book, sheet);
  if (!rules.length) return [];
  const used = usedRange(ctx.snapshot(), s);
  let rows = 0, cols = 0;
  for (const r of rules) for (const b of r.boxes) { rows = Math.max(rows, Math.min(b.bottom, used.rows - 1) + 1); cols = Math.max(cols, Math.min(b.right, used.cols - 1) + 1); }
  // room for the tooltip under the last row and right of the last column
  const g = ctx.geometry;
  const rect = { x: 0, y: 0, width: g.colX(cols + 4), height: g.rowY(rows + 3) };
  return [{ id: 'condfmt-legend', sheet, rect, passThrough: true, role: 'group', alt: 'Conditional formatting legend', render: () => legendLayer(ctx.store, sheet) }];
}

/**
 * The conditional-formatting legend and count, so colour never carries meaning alone: hovering a rule-coloured cell
 * names the rule and its range (an overlay), the cell bar names the selected cell's rules, the status line counts
 * the file's rules. Pair it with {@link condfmt}; importing this module makes `plugins="condfmt"` enable both.
 *
 * @returns The controls plugin (`id: 'condfmt-ui'`).
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0114_CONDFMT.md
 * @example
 * ```ts
 * import { createWorkbook } from "@sheetpane/grid";
 * import { condfmt } from "@sheetpane/condfmt";
 * import { ui } from "@sheetpane/condfmt/ui";
 *
 * const book = createWorkbook({ plugins: [condfmt(), ui()] });
 * ```
 * @example
 * ```ts
 * import "@sheetpane/condfmt/ui"; // registers `condfmt` with its legend
 * excel.setAttribute('plugins', 'condfmt');
 * ```
 */
export function ui(): Plugin {
  return { id: UI_ID, provides: ['overlay'], overlay, controls: [cellbar, status] };
}

/**
 * The conditional-formatting plugin and its legend together.
 *
 * @returns `[condfmt(), ui()]`.
 * @example
 * ```ts
 * import { createWorkbook } from "@sheetpane/grid";
 * import { condfmtWithUi } from "@sheetpane/condfmt/ui";
 *
 * const book = createWorkbook({ plugins: condfmtWithUi() });
 * ```
 */
export function condfmtWithUi(): Plugin[] {
  return [condfmt(), ui()];
}

registerPlugin('condfmt', () => [condfmt(), ui()]);
