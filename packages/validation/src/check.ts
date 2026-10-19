// @sheetpane/validation/check — the workbook's own `<dataValidations>`, checked with no page (W-54):
// the plugin and its evaluator, registering nothing and importing no element, and `check()` — the
// grid's `@sheetpane/grid/check` with this plugin on. Runs in Node, a worker or a page. The
// one-rule `check(rule, …)` of the main entry is not re-exported here: `check` names the workbook check.
import { check as checkPane, type CheckOptions, type Plugin, type SheetpaneError } from '@sheetpane/grid/check';
import { PLUGIN_ID, validation, type ValidationOptions } from './plugin.js';

export type { Book, Rule, RuleKind, Operator, SkipReason, Evaluate } from './rules.js';
export { rulesOf, listOptions, ruleWords, shiftFormula, parseOperand } from './rules.js';
export { PLUGIN_ID, ERROR_TYPE, AUTHOR, skippedRules, lastReport, validateSheet, validation, listRuleAt, type ValidationOptions, type SkippedRule, type SkipReport } from './plugin.js';

/**
 * The errors a pane running this plugin holds once a file has loaded — the workbook's own
 * validation rules, plus whatever else `options` names (a rules file, column rules, other plugins) —
 * computed with no page (SR-VALIDATION decision 9). `@sheetpane/grid/check`'s `check()` with
 * `validation({ severity })` added (an id `"validation"` in `plugins` means the same plugin). Give a
 * formula engine (`formulas()`) in `plugins` for `custom` rules, as in a pane.
 * @param file - The `.xlsx` or `.csv` bytes.
 * @param options - `@sheetpane/grid/check`'s options, and `severity` — what a broken rule gets (default `warning`).
 * @returns The errors, SheetpaneError v1, in the grid check's order.
 * @example
 * ```ts
 * import { check } from '@sheetpane/validation/check';
 *
 * // `bytes`: the file as your runtime reads it — `await readFile(path)` in Node
 * const found = await check(bytes, { name: 'budget.xlsx', severity: 'error' });
 * for (const e of found) console.log(`${e.sheet}!${e.range}: ${e.message}`);
 * ```
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0108_VALIDATION.md
 */
export function check(file: Uint8Array | ArrayBuffer | Blob, options: CheckOptions & ValidationOptions = {}): Promise<SheetpaneError[]> {
  const { severity, ...rest } = options;
  const own = () => validation(severity ? { severity } : {});
  const plugins: (Plugin | string)[] = (rest.plugins ?? []).map((p) => (p === PLUGIN_ID ? own() : p));
  if (!plugins.some((p) => typeof p !== 'string' && p.id === PLUGIN_ID)) plugins.unshift(own());
  return checkPane(file, { ...rest, plugins });
}
