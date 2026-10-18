// @sheetpane/validation — the workbook's own `<dataValidations>` rules, checked on
// load and on every edit through the `validate` hook (W-18). A cell that breaks a
// rule is one error: type `validation`, author `workbook`; the store resolves it
// when the cell passes and reopens it when it fails again.
// Headless: this entry never imports ./ui.js. Importing it in Node is safe.
import { registerPlugin, type ErrorDraft, type Plugin, type PluginContext, type Severity, type WorkbookStore } from '@sheetpane/grid';
import { a1, check, covers, evaluatorOf, ruleWords, rulesOf, skipOf, textAt, usedRange, type Book, type Rule, type SkipReason } from './rules.js';

export type { Book, Rule, RuleKind, Operator, SkipReason, Evaluate } from './rules.js';
export { rulesOf, listOptions, ruleWords, check, shiftFormula, parseOperand } from './rules.js';

export const PLUGIN_ID = 'validation';
export const ERROR_TYPE = 'validation';
export const AUTHOR = 'workbook';

export interface ValidationOptions {
  /** The severity a broken rule gets; `warning` by default. */
  severity?: Severity;
}

export interface SkippedRule { sheet: string; sqref: string; type: string; reason: SkipReason; detail: string }
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

/** The last report `validate` made for a workbook (the status line reads it). */
export function lastReport(book: Book | undefined): SkipReport | undefined {
  return book ? reports.get(book) : undefined;
}

/** The rule's own error text — `errorTitle: error`, either alone — else the rule in words. */
function messageOf(rule: Rule, words: string): string {
  const t = rule.dv.errorTitle?.trim(), e = rule.dv.error?.trim();
  return t && e ? `${t}: ${e}` : t || e || words;
}

/** Every failing cell on one sheet: one draft per cell (the first rule it breaks). */
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

/** The plugin: `validate` on the `workbook` author's behalf. */
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

/** Is a cell covered by a checkable `list` rule? (The list arrow's `appliesTo`.) */
export function listRuleAt(store: WorkbookStore, sheet: string, row: number, col: number): Rule | undefined {
  const book = store.book;
  if (!book) return undefined;
  return rulesOf(book, sheet).find((r) => r.kind === 'list' && !r.skip && covers(r, row, col));
}

registerPlugin(PLUGIN_ID, () => validation());
