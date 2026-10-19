// @sheetpane/formulas/ui — what the formulas plugin adds to the grid's slots:
//   cellbar  `fx =B3*C3` — the selected cell's formula (read-only: the core's input edits it)
//   status   Sum · Avg · Count of the selection; "⟳ N cells recalculated"; a circular reference
//   cell     ⟳ on a recalculated cell; ↻ on a cell in a cycle; ≈ where IronCalc cannot calculate
//   overlay  the ranges the selected formula reads, outlined in Edit (updates as you type)
// Opt-in: the headless entry never imports this file. Importing it makes
// `plugins="formulas"` enable the plugin *with* these controls.
import { cellKey, formulaHiddenIn, formulaRefs, registerPlugin } from '@sheetpane/grid';
import type { ControlDescriptor, OverlayItem, Plugin, Selection, Snapshot, WorkbookStore } from '@sheetpane/grid';
import { cellRef, formulaIn, parseBox, valueIn } from './cells.js';
import { formulas, sameValue, type FormulasOptions, type FormulasPlugin } from './index.js';

/** Selections larger than this are not summed (the status line is recomputed on every change). */
export const MAX_STAT_CELLS = 2_000_000;

/** Reference outline colours, in formula order; a host or theme overrides `--sp-ref-1` … `--sp-ref-6`. */
const REF_COLOURS = ['#2346C8', '#B42318', '#16703E', '#875600', '#7A2EB8', '#0E7490'];

const general = (n: number) => (Math.abs(n) >= 1e15 || (n !== 0 && Math.abs(n) < 1e-9) ? n.toPrecision(10).replace(/\.?0+e/, 'e') : Number(n.toPrecision(15)).toLocaleString('en-US', { maximumFractionDigits: 10 }));

/** A selection's status-bar figures: `count` non-empty cells, of which `numbers` are numbers; their `sum` and `avg`. */
export interface Stats { sum: number; avg: number | undefined; count: number; numbers: number }

/**
 * Sum, average and count of a selection, as Excel's status bar counts them: Count is every non-empty cell; Sum and Avg the numbers.
 *
 * @param snap - A snapshot of the store.
 * @param sel - The selection.
 * @returns The figures (`avg` is `undefined` with no numbers), or `undefined` for no sheet or a selection over 2,000,000 cells.
 */
export function selectionStats(snap: Snapshot, sel: Selection): Stats | undefined {
  const sheet = snap.book?.sheets.find((s) => s.name === sel.sheet);
  const box = parseBox(sel.range ?? sel.ref);
  if (!sheet || !box) return undefined;
  const bottom = Math.min(box.bottom, sheet.rows.length - 1);
  const right = Math.min(box.right, sheet.rows.reduce((m, r) => Math.max(m, r.length), 0) - 1);
  if ((bottom - box.top + 1) * (right - box.left + 1) > MAX_STAT_CELLS) return undefined;
  let sum = 0, count = 0, numbers = 0;
  const add = (row: number, col: number) => {
    const v = valueIn(snap, sel.sheet, cellRef(row, col));
    if (v === null || v === '') return;
    count++;
    if (typeof v === 'number' && Number.isFinite(v)) { sum += v; numbers++; }
  };
  for (let r = box.top; r <= bottom; r++) for (let c = box.left; c <= right; c++) add(r, c);
  // Cells typed beyond the file's data are in the change map only.
  for (const k of snap.changes.keys()) {
    if (!k.startsWith(`${sel.sheet}!`)) continue;
    const p = parseBox(k.slice(sel.sheet.length + 1));
    if (p && p.top >= box.top && p.top <= box.bottom && p.left >= box.left && p.left <= box.right && (p.top > bottom || p.left > right)) add(p.top, p.left);
  }
  return { sum, avg: numbers ? sum / numbers : undefined, count, numbers };
}

/**
 * Formula cells whose value now differs from the one saved in the file — what the user's changes recalculated.
 *
 * @param snap - A snapshot of the store.
 * @returns The count (the status line's `⟳ N cells recalculated`).
 */
export function recalculatedCount(snap: Snapshot): number {
  const b = snap.book;
  if (!b) return 0;
  let n = 0;
  for (const [key, d] of snap.derived) {
    if (snap.changes.has(key)) continue;
    const i = key.lastIndexOf('!'), sheet = b.sheets.find((s) => s.name === key.slice(0, i)), p = sheet && parseBox(key.slice(i + 1));
    const saved = (p && sheet!.rows[p.top]?.[p.left]) ?? null;
    if (!sameValue(d.value, saved)) n++;
  }
  return n;
}

/**
 * The formula plugin's controls: `fx =…` in the cell bar; Sum · Avg · Count, `⟳ N cells recalculated` and circular
 * references in the status line; ⟳ ↻ ≈ marks on cells; coloured outlines of the ranges a formula reads while it is
 * edited. Importing this module makes `plugins="formulas"` enable the plugin with these controls.
 *
 * @param engine - The headless plugin, so the marks and status can read its state; without it, no ↻ or ≈ marks and no circular-reference status.
 * @returns The controls plugin (`id: 'formulas-ui'`).
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0111_FORMULAS.md
 * @example
 * ```ts
 * import { createWorkbook } from '@sheetpane/grid';
 * import { formulas } from '@sheetpane/formulas';
 * import { ui } from '@sheetpane/formulas/ui';
 *
 * const engine = formulas();
 * const book = createWorkbook({ plugins: [engine, ui(engine)] });
 * ```
 * @example
 * ```ts
 * import '@sheetpane/formulas/ui'; // registers `formulas` with its controls
 * excel.setAttribute('plugins', 'formulas');
 * ```
 */
export function ui(engine?: FormulasPlugin): Plugin {
  let seen: WorkbookStore | undefined;
  const storeOf = () => engine?.store ?? seen;
  let memo: { snap: Snapshot; sel: string; text: string } | undefined;
  const fmt = (snap: Snapshot, sel: Selection, n: number) => {
    const s = storeOf();
    return s && typeof valueIn(snap, sel.sheet, sel.ref) === 'number' ? s.format(sel.sheet, sel.ref, n) : general(n);
  };
  const state = (sheet: string, ref: string) => engine?.stateOf(sheet, ref);

  // View: the formula as read-only text beside the value (the core draws it dashed). Edit: the core's
  // cell input itself holds the formula (SR-GRID decision 9), so this shows nothing there.
  const fx: ControlDescriptor = {
    id: 'formulas-fx', slot: 'cellbar', group: 'formulas', mode: 'view', label: 'Formula',
    text(snap, sel) { const f = formulaHiddenIn(snap, sel.sheet, sel.ref) ? undefined : formulaIn(snap, sel.sheet, sel.ref); return f ? `fx ${f}` : ''; }, // W-62: a hidden formula is not shown
  };

  const stats: ControlDescriptor = {
    id: 'formulas-stats', slot: 'status', group: 'formulas', mode: 'both', label: 'Sum, average and count of the selection',
    text(snap, sel) {
      const key = `${sel.sheet}|${sel.ref}|${sel.range ?? ''}`;
      if (memo && memo.snap === snap && memo.sel === key) return memo.text;
      const st = selectionStats(snap, sel);
      const text = !st || st.count < 2 ? '' : st.numbers ? `Sum ${fmt(snap, sel, st.sum)} · Avg ${fmt(snap, sel, st.avg!)} · Count ${st.count}` : `Count ${st.count}`;
      memo = { snap, sel: key, text };
      return text;
    },
  };

  const recalc: ControlDescriptor = {
    id: 'formulas-recalc', slot: 'status', group: 'formulas', mode: 'edit', label: 'Cells your changes recalculated',
    text(snap) { const n = recalculatedCount(snap); return n ? `⟳ ${n} cell${n === 1 ? '' : 's'} recalculated` : ''; },
  };

  const cycle: ControlDescriptor = {
    id: 'formulas-cycle', slot: 'status', group: 'formulas', mode: 'both', label: 'Circular references',
    text(snap) {
      const c = engine?.cycles() ?? [];
      if (!c.length) return '';
      const at = c.slice(0, 3).map((x) => (x.sheet === snap.selection.sheet ? x.ref : `${x.sheet}!${x.ref}`)).join(', ');
      return `Circular reference${c.length === 1 ? '' : 's'}: ${at}${c.length > 3 ? ` +${c.length - 3}` : ''}`;
    },
  };

  const derivedMark: ControlDescriptor = {
    id: 'formulas-derived', slot: 'cell', group: 'formulas', mode: 'both', icon: '⟳',
    label: 'Recalculated — a cell this formula reads changed',
    appliesTo(cell) {
      seen = cell.store;
      const k = cellKey(cell.sheet.name, cell.ref), snap = cell.store.getSnapshot(), d = snap.derived.get(k);
      // Back at its saved value (an undo), a cell is not "recalculated" any more, though the store keeps the entry.
      return !!d && !snap.changes.has(k) && !state(cell.sheet.name, cell.ref) && !sameValue(d.value, cell.sheet.rows[cell.row]?.[cell.col] ?? null);
    },
  };
  const cycleMark: ControlDescriptor = {
    id: 'formulas-cycle-mark', slot: 'cell', group: 'formulas', mode: 'both', icon: '↻',
    label: 'Circular reference — the formula reads its own result; Excel shows 0',
    appliesTo: (cell) => state(cell.sheet.name, cell.ref) === 'cycle',
  };
  const unsupportedMark: ControlDescriptor = {
    id: 'formulas-unsupported', slot: 'cell', group: 'formulas', mode: 'both', icon: '≈',
    label: 'Not recalculated — IronCalc cannot calculate this formula; the saved value is shown and Excel recalculates on open',
    appliesTo: (cell) => state(cell.sheet.name, cell.ref) === 'unsupported',
  };

  return {
    id: 'formulas-ui',
    provides: ['overlay'],
    controls: [fx, stats, recalc, cycle, derivedMark, cycleMark, unsupportedMark],
    overlay(sheet, ctx): OverlayItem[] {
      seen = ctx.store;
      const snap = ctx.snapshot(), sel = snap.selection;
      if (snap.mode !== 'edit' || sel.sheet !== sheet || formulaHiddenIn(snap, sel.sheet, sel.ref)) return []; // W-62: a hidden formula's references are not outlined
      const f = formulaIn(snap, sel.sheet, sel.ref);
      if (!f) return [];
      const g = ctx.geometry, rows = ctx.book.sheets.find((s) => s.name === sheet)?.rows.length ?? 0;
      const items: OverlayItem[] = [];
      const seenRanges = new Set<string>();
      let n = 0;
      for (const r of formulaRefs(f, sheet)) {
        if (!r.range) continue;
        const i = n++ % REF_COLOURS.length;
        if (r.sheet !== sheet) continue;
        const box = { ...r.range, bottom: Math.min(r.range.bottom, Math.max(rows - 1, r.range.top)) };
        const name = box.top === box.bottom && box.left === box.right ? cellRef(box.top, box.left) : `${cellRef(box.top, box.left)}:${cellRef(box.bottom, box.right)}`;
        if (seenRanges.has(name)) continue;
        seenRanges.add(name);
        const x = g.colX(box.left), y = g.rowY(box.top);
        const w = g.colX(box.right) + g.colWidth(box.right) - x, h = g.rowY(box.bottom) + g.rowHeight(box.bottom) - y;
        const colour = `var(--sp-ref-${i + 1}, ${REF_COLOURS[i]})`;
        const edge = (id: string, rect: OverlayItem['rect']): OverlayItem => ({
          id: `formulas-ref|${name}|${i}|${id}`, sheet, rect,
          render: () => { const d = document.createElement('div'); d.style.cssText = `width:100%;height:100%;background:${colour}`; return d; },
        });
        // Four thin edges, not a box: the cells inside stay clickable.
        items.push(edge('t', { x, y, width: w, height: 2 }), edge('b', { x, y: y + h - 2, width: w, height: 2 }), edge('l', { x, y, width: 2, height: h }), edge('r', { x: x + w - 2, y, width: 2, height: h }));
        items.push({
          id: `formulas-ref|${name}|${i}|label`, sheet, alt: `${f} reads ${name}`,
          rect: { x, y: y >= 14 ? y - 14 : y + 2, width: Math.min(Math.max(w, 28), 7 * name.length + 8), height: 14 },
          render: () => { const d = document.createElement('div'); d.textContent = name; d.style.cssText = `font-size:10px;line-height:14px;padding:0 3px;color:#fff;background:${colour};white-space:nowrap;border-radius:2px 2px 0 0`; return d; },
        });
      }
      return items;
    },
  };
}

/**
 * The headless plugin and its controls, sharing state — what `plugins="formulas"` enables once this module is imported.
 *
 * @param o - The headless plugin's options.
 * @returns `[formulas(o), ui(thatPlugin)]`.
 * @example
 * ```ts
 * import { createWorkbook } from '@sheetpane/grid';
 * import { formulasWithUi } from '@sheetpane/formulas/ui';
 *
 * const book = createWorkbook({ plugins: formulasWithUi({ preload: true }) });
 * ```
 */
export function formulasWithUi(o: FormulasOptions = {}): Plugin[] {
  const f = formulas(o);
  return [f, ui(f)];
}

registerPlugin('formulas', () => formulasWithUi());
