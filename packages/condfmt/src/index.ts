// @sheetpane/condfmt — conditional formatting for sheetpane, as a plugin (W-19).
// A second `decorate` provider, ordered after @sheetpane/styles, so a rule's dxf
// overrides the static style per property, as in Excel. Render only: the rules
// come from the file; nothing here writes them.
// Never a font family (SR-LAW-5): the host's font is the font.
// Headless: this entry never imports ./ui.js. Importing it in Node is safe.
import { registerPlugin, type CellContext, type Plugin, type StyleSubset, type WorkbookStore } from '@sheetpane/grid';
import { cellResult } from './evaluate.js';
import { rulesOf, skipOf, type Book, type SkipReason } from './rules.js';

/** The plugin's id, and the name `plugins="…"` takes. */
export const PLUGIN_ID = 'condfmt';

export type { Book, Rule, RuleKind, Operator, Operand, SkipReason, Evaluate, Box, CfRule, Cfvo, ConditionalFormat } from './rules.js';
export { rulesOf, ruleWords, shiftFormula, parseOperand, parseBox, RULE_KINDS, RANGE_KINDS } from './rules.js';
export { cellResult, legendAt, evaluations, dxfStyle, compareCells, percentile, lerpColor, scaleColor, barLength, barImage, DEFAULT_BAR, type CellResult } from './evaluate.js';

/** A rule that is not drawn: where it is, its type and priority, and why (`iconSet`, `formula`, `type`, `malformed`). */
export interface SkippedRule { sheet: string; sqref: string; type: string; priority: number; reason: SkipReason; detail: string }
/** How many of a workbook's conditional rules are drawn, and the ones that are not. */
export interface SkipReport {
  /** Rules the workbook holds, on every sheet. */
  rules: number;
  /** Rules this pane draws. */
  shown: number;
  /** Rules it does not draw, and why. */
  skipped: SkippedRule[];
}

/**
 * The rules a workbook holds that are not drawn, and why. Given a store, a
 * formula rule counts as shown when its `derive` plugin offers `evaluate()`;
 * given a bare workbook, every formula rule is skipped.
 *
 * @param from - The workbook, or the store holding it.
 * @returns The report; all zero when no workbook is loaded.
 */
export function skippedRules(from: Book | WorkbookStore): SkipReport {
  const store = 'getSnapshot' in from ? from : undefined;
  const book = store ? store.book : (from as Book);
  const out: SkipReport = { rules: 0, shown: 0, skipped: [] };
  if (!book) return out;
  for (const s of book.sheets) {
    for (const r of rulesOf(book, s.name)) {
      out.rules++;
      const skip = skipOf(r, store);
      if (skip) out.skipped.push({ sheet: s.name, sqref: r.sqref, type: r.kind, priority: r.cf.priority, reason: skip.reason, detail: skip.detail });
      else out.shown++;
    }
  }
  return out;
}

const stores = new WeakMap<Book, WorkbookStore>();
/**
 * The store that first drew a workbook (the status line and the legend read it: a control is handed the snapshot, not the store).
 *
 * @param book - The workbook, or `undefined`.
 * @returns The store, or `undefined` before any cell of the workbook is drawn.
 */
export function storeOf(book: Book | undefined): WorkbookStore | undefined {
  return book ? stores.get(book) : undefined;
}

/**
 * One cell's CSS: every rule of the sheet that matches it, in priority order.
 *
 * @param cell - The cell, as the `decorate` hook receives it.
 * @returns The CSS, or `undefined` when no rule matched.
 */
export function decorateCell(cell: CellContext): StyleSubset | undefined {
  if (!stores.has(cell.book)) stores.set(cell.book, cell.store);
  return cellResult(cell.store, cell.sheet.name, cell.row, cell.col).css;
}

/**
 * The conditional-formatting plugin: a second `decorate` provider, ordered after `styles`, so a rule's dxf overrides
 * the static style per property, as in Excel. Render only — the rules come from the file. Draws `cellIs`, text,
 * blank, error, duplicate / unique, top / bottom, above-average, colour-scale, data-bar and `expression` rules
 * (formulas need `@sheetpane/formulas`); icon sets and time periods are skipped and counted by {@link skippedRules}.
 * Never a font family. Importing this module registers it as `condfmt`; the legend and the count are in
 * `@sheetpane/condfmt/ui`.
 *
 * @returns The plugin (`id: 'condfmt'`).
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0114_CONDFMT.md
 * @example
 * ```ts
 * import { createWorkbook } from "@sheetpane/grid";
 * import { condfmt } from "@sheetpane/condfmt";
 * import { formulas } from "@sheetpane/formulas";
 * import { styles } from "@sheetpane/styles";
 *
 * const book = createWorkbook({ plugins: [styles(), condfmt(), formulas()] });
 * await book.load(bytes, 'scores.xlsx');
 * ```
 * @example
 * ```ts
 * import "@sheetpane/condfmt"; // registers `condfmt`
 * excel.setAttribute('plugins', 'styles condfmt');
 * ```
 */
export function condfmt(): Plugin {
  return {
    id: PLUGIN_ID,
    provides: ['decorate'],
    after: ['styles'],
    decorate: (cell) => decorateCell(cell),
  };
}

registerPlugin(PLUGIN_ID, () => condfmt());
