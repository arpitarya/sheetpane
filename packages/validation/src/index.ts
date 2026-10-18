// @sheetpane/validation — the workbook's own `<dataValidations>` rules, checked on
// load and on every edit through the `validate` hook (W-18). A cell that breaks a
// rule is one error: type `validation`, author `workbook`; the store resolves it
// when the cell passes and reopens it when it fails again.
// Headless: this entry never imports ./ui.js. Importing it in Node is safe.
import { registerPlugin, type ErrorDraft, type Plugin, type PluginContext, type Severity, type WorkbookStore } from '@sheetpane/grid';
import { a1, check, covers, evaluatorOf, ruleWords, rulesOf, skipOf, textAt, usedRange, type Book, type Rule, type SkipReason } from './rules.js';

export type { Book, Rule, RuleKind, Operator, SkipReason, Evaluate } from './rules.js';
export { rulesOf, listOptions, ruleWords, check, shiftFormula, parseOperand } from './rules.js';

/** The plugin's id, and the name `plugins="…"` takes. */
export const PLUGIN_ID = 'validation';
/** The `type` of every error this plugin raises. */
export const ERROR_TYPE = 'validation';
/** The `author` of every error this plugin raises: the workbook's own rules, not a person. */
export const AUTHOR = 'workbook';

/** Options for {@link validation}. */
export interface ValidationOptions {
  /** The severity a broken rule gets; `warning` by default. */
  severity?: Severity;
}

/** A rule that is not checked: where it is, its type, and why (`custom`, `operand`, `operator`, `type`, `source`). */
export interface SkippedRule { sheet: string; sqref: string; type: string; reason: SkipReason; detail: string }
/** How many of a workbook's rules are checked, and the ones that are not. */
export interface SkipReport {
  /** Rules the workbook holds (`type="none"` excluded). */
  rules: number;
  /** Rules this pane checks. */
  checked: number;
  /** Rules it cannot check, and why. `skipped.length` is the count `sheetpane-load` would carry. */
  skipped: SkippedRule[];
}

const reports = new WeakMap<Book, SkipReport>();

/**
 * The rules a workbook holds that are not checked, and why. Given a store, a
 * `custom` rule counts as checked when its `derive` plugin offers `evaluate()`;
 * given a bare workbook, every `custom` rule is skipped.
 *
 * @param from - The workbook, or the store holding it.
 * @returns The report; all zero when no workbook is loaded.
 */
export function skippedRules(from: Book | WorkbookStore): SkipReport {
  const store = 'getSnapshot' in from ? from : undefined;
  const book = store ? store.book : (from as Book);
  const out: SkipReport = { rules: 0, checked: 0, skipped: [] };
  if (!book) return out;
  for (const s of book.sheets) {
    for (const r of rulesOf(book, s.name)) {
      out.rules++;
      const skip = skipOf(r, store);
      if (skip) out.skipped.push({ sheet: s.name, sqref: r.dv.sqref.join(' '), type: r.dv.type, reason: skip.reason, detail: skip.detail });
      else out.checked++;
    }
  }
  return out;
}

/**
 * The last report `validate` made for a workbook (the status line reads it).
 *
 * @param book - The workbook, or `undefined`.
 * @returns The report, or `undefined` before the first `validate`.
 */
export function lastReport(book: Book | undefined): SkipReport | undefined {
  return book ? reports.get(book) : undefined;
}

/** The rule's own error text — `errorTitle: error`, either alone — else the rule in words. */
function messageOf(rule: Rule, words: string): string {
  const t = rule.dv.errorTitle?.trim(), e = rule.dv.error?.trim();
  return t && e ? `${t}: ${e}` : t || e || words;
}

/**
 * Every failing cell on one sheet: one error draft per cell (the first rule it breaks), within the used range.
 *
 * @param sheet - The sheet's name.
 * @param store - The workbook store.
 * @param severity - The drafts' severity; default `warning`.
 * @returns The drafts — `type: 'validation'`, `author: 'workbook'`, `found`, `expected` and `message` filled.
 */
export function validateSheet(sheet: string, store: WorkbookStore, severity: Severity = 'warning'): ErrorDraft[] {
  const book = store.book, s = store.sheet(sheet);
  if (!book || !s) return [];
  const rules = rulesOf(book, sheet).filter((r) => !skipOf(r, store));
  if (!rules.length) return [];
  const evaluate = evaluatorOf(store);
  const used = usedRange(store, s);
  const out: ErrorDraft[] = [];
  const flagged = new Set<string>();
  const memo = new Map<Rule, string[]>(); // a fixed list source is read once per run
  for (const rule of rules) {
    for (const b of rule.boxes) {
      for (let r = b.top; r <= Math.min(b.bottom, used.rows - 1); r++) {
        for (let c = b.left; c <= Math.min(b.right, used.cols - 1); c++) {
          const ref = a1(r, c);
          if (flagged.has(ref) || check(rule, store, r, c, evaluate, memo) !== 'fail') continue;
          flagged.add(ref);
          const expected = ruleWords(rule, store, r, c);
          out.push({ sheet, range: ref, type: ERROR_TYPE, severity, found: textAt(store, sheet, ref) || '(blank)', expected, message: messageOf(rule, expected), author: AUTHOR });
        }
      }
    }
  }
  return out;
}

/**
 * The data-validation plugin: checks the workbook's own `<dataValidations>` rules on load and after every change,
 * through the `validate` hook. A cell that breaks a rule is one error (`type: 'validation'`, `author: 'workbook'`)
 * that resolves when the cell passes and reopens when it fails again. `custom` rules need a formula engine
 * (`@sheetpane/formulas`); rules it cannot check are listed by {@link skippedRules}. Importing this module
 * registers it as `validation`; the list arrow and status count are in `@sheetpane/validation/ui`.
 *
 * @param o - The severity a broken rule gets; default `warning`.
 * @returns The plugin (`id: 'validation'`).
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0108_VALIDATION.md
 * @example
 * ```ts
 * import { createWorkbook } from '@sheetpane/grid';
 * import { formulas } from '@sheetpane/formulas';
 * import { skippedRules, validation } from '@sheetpane/validation';
 *
 * const book = createWorkbook({ plugins: [validation({ severity: 'error' }), formulas()] });
 * await book.load(bytes, 'budget.xlsx');
 * console.log(skippedRules(book).skipped);
 * ```
 * @example
 * ```ts
 * import '@sheetpane/validation'; // registers `validation`
 * excel.setAttribute('plugins', 'validation formulas');
 * ```
 */
export function validation(o: ValidationOptions = {}): Plugin {
  const severity = o.severity ?? 'warning';
  return {
    id: PLUGIN_ID,
    provides: ['validate'],
    validate(sheet: string, ctx: PluginContext): ErrorDraft[] {
      if (ctx.book && !reports.has(ctx.book)) reports.set(ctx.book, skippedRules(ctx.store));
      return validateSheet(sheet, ctx.store, severity);
    },
  };
}

/**
 * The checkable `list` rule covering a cell, if any — the list arrow's `appliesTo`.
 *
 * @param store - The workbook store.
 * @param sheet - The sheet's name.
 * @param row - The cell's row, 0-based.
 * @param col - The cell's column, 0-based.
 * @returns The rule, or `undefined`.
 */
export function listRuleAt(store: WorkbookStore, sheet: string, row: number, col: number): Rule | undefined {
  const book = store.book;
  if (!book) return undefined;
  return rulesOf(book, sheet).find((r) => r.kind === 'list' && !r.skip && covers(r, row, col));
}

registerPlugin(PLUGIN_ID, () => validation());
