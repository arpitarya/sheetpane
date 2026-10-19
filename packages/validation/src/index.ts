// @sheetpane/validation — the workbook's own `<dataValidations>` rules, checked on
// load and on every edit through the `validate` hook (W-18). A cell that breaks a
// rule is one error: type `validation`, author `workbook`; the store resolves it
// when the cell passes and reopens it when it fails again.
// Headless: this entry never imports ./ui.js. Importing it in Node is safe; the
// same plugin with no registration, and without the Download switch, is
// `@sheetpane/validation/check` (W-54).
import { registerPlugin, type Plugin, type Severity, type WorkbookStore } from '@sheetpane/grid';
import { PLUGIN_ID, validation as checking } from './plugin.js';
import { RULES_OPTION, RULES_OPTION_LABEL, writeRules } from './write.js';

export type { Book, Rule, RuleKind, Operator, SkipReason, Evaluate } from './rules.js';
export { rulesOf, listOptions, ruleWords, check, shiftFormula, parseOperand } from './rules.js';
export { PLUGIN_ID, ERROR_TYPE, AUTHOR, skippedRules, lastReport, validateSheet, listRuleAt, type SkippedRule, type SkipReport } from './plugin.js';
export { RULES_OPTION, RULES_OPTION_LABEL, validationOf, rulesAsValidations, writeRules, lastRulesWrite, mainBlockCount, type MappedRule, type RuleConflict, type RulesWritePlan, type RulesWriteReport, type UnwrittenReason, type UnwrittenRule } from './write.js';

/** Options for {@link validation}. */
export interface ValidationOptions {
  /** The severity a broken rule gets; `warning` by default. */
  severity?: Severity;
  /**
   * The Download menu's *Write rules as Excel dropdowns* switch, on or off at first (W-58): the host's rules file (and
   * the element's `columns`) written into the `.xlsx` as the workbook's own data validation. Off by default;
   * `export({ rulesAsValidation: true })` turns it on for one export.
   */
  rulesAsValidation?: boolean;
}

/**
 * The data-validation plugin: checks the workbook's own `<dataValidations>` rules on load and after every change,
 * through the `validate` hook. A cell that breaks a rule is one error (`type: 'validation'`, `author: 'workbook'`)
 * that resolves when the cell passes and reopens when it fails again. `custom` rules need a formula engine
 * (`@sheetpane/formulas`); rules it cannot check are listed by {@link skippedRules}. Importing this module
 * registers it as `validation`; the list arrow and status count are in `@sheetpane/validation/ui`.
 *
 * On export (`exportPatch`, W-58) it can also write the host's rules file, and the element's `columns`, into the
 * `.xlsx` as the workbook's own data validation — the Download menu's *Write rules as Excel dropdowns*, or
 * `export({ rulesAsValidation: true })`. What Excel cannot hold is listed on the console and the status line.
 *
 * @param o - The severity a broken rule gets (default `warning`); whether the rules are written by default (no).
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
 * @example
 * ```ts
 * import { lastRulesWrite } from '@sheetpane/validation';
 *
 * // the rules file written into the download as Excel's own dropdowns and checks
 * excel.rules = { version: 1, sheets: { '*': { columns: { Status: { oneOf: ['Active', 'Inactive'] } } } } };
 * const blob = await excel.export({ rulesAsValidation: true });
 * console.log(lastRulesWrite(excel.workbook?.book)); // { written, merged, skipped, conflicts }
 * ```
 */
export function validation(o: ValidationOptions = {}): Plugin {
  const writeByDefault = o.rulesAsValidation ?? false;
  return {
    ...checking(o),
    provides: ['validate', 'exportPatch'],
    // W-58: the host's rules into the download as Excel's own dropdowns and checks, when the switch is on
    async exportPatch(patch, ctx): Promise<void> {
      if ((ctx.exportOptions?.[RULES_OPTION] ?? writeByDefault) !== true || !hostRules(ctx.store)) return;
      await writeRules(patch, ctx.store);
    },
    exportOptions: [{ key: RULES_OPTION, label: RULES_OPTION_LABEL, default: writeByDefault, applies: hostRules }],
  };
}

/** Does the pane hold rules to write — a rules file, or column rules on the element? */
function hostRules(store: WorkbookStore): boolean {
  const c = store.columnRules;
  return c.document !== undefined || Object.keys(c.columns ?? {}).length > 0;
}

registerPlugin(PLUGIN_ID, () => validation());
