// @sheetpane/numfmt/ui — the controls this plugin adds to the grid's slots:
// a number-format dropdown and ± decimals in `format-row` (Edit mode). Opt-in:
// the headless entry never imports this file. Importing it makes
// `plugins="numfmt"` enable the plugin *with* its controls.
import { cellKey, registerPlugin } from '@sheetpane/grid';
import type { ControlDescriptor, Plugin, Selection, Snapshot, WorkbookStore } from '@sheetpane/grid';
import { numfmt, originalCode, type NumfmtOptions } from './index.js';
import { adjustDecimals, categoryOf, CATEGORIES, documentLocale, fixedCode, generalDecimals, isValidCode, presetCode, type Category } from './fmt.js';

export interface UiOptions extends NumfmtOptions {
  /** Asks for a custom code (the dropdown's "Custom…"). Default: `window.prompt`. Return null to cancel. */
  ask?: (current: string) => string | null;
}

/** Cells above this are not formatted in one go: every cell is one change (and one undo step) in the store. */
export const MAX_CELLS = 10_000;

const colIndex = (s: string) => [...s.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const colName = (i: number) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

/** The selection as cells that hold a number — the only cells a number format shows on — within the sheet's data. */
function numericCells(store: WorkbookStore, sel: Selection): { ref: string; value: number }[] {
  const sheet = store.sheet(sel.sheet);
  if (!sheet) return [];
  const [a, b = a] = (sel.range ?? sel.ref).split(':') as [string, string?];
  const pa = /^([A-Za-z]+)(\d+)$/.exec(a), pb = /^([A-Za-z]+)(\d+)$/.exec(b ?? a);
  if (!pa || !pb) return [];
  const r0 = Math.min(+pa[2]!, +pb[2]!) - 1, r1 = Math.max(+pa[2]!, +pb[2]!) - 1;
  const c0 = Math.min(colIndex(pa[1]!), colIndex(pb[1]!)), c1 = Math.max(colIndex(pa[1]!), colIndex(pb[1]!));
  const out: { ref: string; value: number }[] = [];
  for (let r = r0; r <= Math.min(r1, sheet.rows.length - 1); r++) {
    const row = sheet.rows[r] ?? [];
    for (let c = c0; c <= Math.min(c1, row.length - 1); c++) {
      const ref = `${colName(c)}${r + 1}`;
      const v = store.value(sel.sheet, ref);
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      // A cell the user edited holds that edit in the one change slot the grid gives it; a format would replace it.
      const ch = store.changeOf(sel.sheet, ref);
      if (ch && ch.kind !== 'numFmt') continue;
      out.push({ ref, value: v });
      if (out.length >= MAX_CELLS) { console.warn(`sheetpane numfmt: the selection is larger than ${MAX_CELLS} cells; only the first ${MAX_CELLS} were formatted`); return out; }
    }
  }
  return out;
}

/** The code a cell shows with right now, from a snapshot (the controls read state, never the store's caches). */
function currentCode(snap: Snapshot, sheet: string, ref: string, locale: string): string {
  const ch = snap.changes.get(cellKey(sheet, ref));
  if (ch?.kind === 'numFmt' && typeof ch.now === 'string') return ch.now;
  const b = snap.book;
  if (!b) return 'General';
  const s = b.sheets.find((x) => x.name === sheet);
  return originalCode(b, s?.styleIndex[ref], locale);
}


const ICON = (inner: string) => `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
// ".0" with an arrow pointing left (fewer) / ".00" with one pointing right (more), drawn, not typeset (SR-LAW-5).
const ICON_LESS = ICON('<path d="M2 5.5 5 8l-3 2.5M5 8h4"/><circle cx="12" cy="11.5" r=".6" fill="currentColor"/>');
const ICON_MORE = ICON('<path d="M9 5.5 12 8l-3 2.5M12 8H8"/><circle cx="4" cy="11.5" r=".6" fill="currentColor"/>');

export function ui(options: UiOptions = {}): Plugin {
  const locale = () => options.locale ?? documentLocale();
  const ask = options.ask ?? ((cur: string) => (typeof globalThis.prompt === 'function' ? globalThis.prompt('Custom number format', cur) : null));

  const apply = (store: WorkbookStore, sel: Selection, code: string | ((cur: string, v: number) => string)) => {
    const loc = locale();
    const snap = store.getSnapshot(), b = store.book!, sh = store.sheet(sel.sheet);
    const batch: { sheet: string; ref: string; kind: 'numFmt'; now: unknown; was: unknown }[] = [];
    for (const c of numericCells(store, sel)) {
      const cur = currentCode(snap, sel.sheet, c.ref, loc);
      const next = typeof code === 'string' ? code : code(cur, c.value);
      if (next !== cur) batch.push({ sheet: sel.sheet, ref: c.ref, kind: 'numFmt', now: next, was: originalCode(b, sh?.styleIndex[c.ref], loc) });
    }
    store.setChanges(batch); // one undo step for the whole selection
  };

  const decimals = (delta: 1 | -1) => (store: WorkbookStore, sel: Selection) => {
    const loc = locale();
    apply(store, sel, (cur, v) => {
      if (cur === 'General') {
        const n = generalDecimals(v, { locale: loc, date1904: store.book?.date1904 ?? false });
        return fixedCode(Math.max(0, n + delta));
      }
      return adjustDecimals(cur, delta);
    });
  };

  const controls: ControlDescriptor[] = [
    {
      id: 'numfmt-format', slot: 'format-row', group: 'number', label: 'Number format', mode: 'edit',
      options: () => CATEGORIES.map((c) => ({ value: c.key, label: c.label })),
      value: (snap, sel) => categoryOf(currentCode(snap, sel.sheet, sel.ref, locale())),
      choose(store, sel, value) {
        if (value === 'custom') {
          const entered = ask(currentCode(store.getSnapshot(), sel.sheet, sel.ref, locale()));
          if (entered === null || entered.trim() === '') return;
          if (!isValidCode(entered)) { if (typeof globalThis.alert === 'function') globalThis.alert(`“${entered}” is not a number format.`); return; }
          apply(store, sel, entered);
          return;
        }
        if (CATEGORIES.some((c) => c.key === value)) apply(store, sel, presetCode(value as Exclude<Category, 'custom'>, locale()));
      },
    },
    { id: 'numfmt-dec-less', slot: 'format-row', group: 'number', label: 'Decrease decimals', icon: ICON_LESS, mode: 'edit', run: decimals(-1) },
    { id: 'numfmt-dec-more', slot: 'format-row', group: 'number', label: 'Increase decimals', icon: ICON_MORE, mode: 'edit', run: decimals(1) },
  ];

  return { id: 'numfmt-ui', provides: [], controls };
}

// `plugins="numfmt"` with this file imported enables the plugin and its controls.
registerPlugin('numfmt', () => [numfmt(), ui()]);
