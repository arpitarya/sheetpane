// @sheetpane/validation — the workbook's own `<dataValidations>` rules, checked on
// load and on every edit through the `validate` hook (W-18). A cell that breaks a
// rule is one error: type `validation`, author `workbook`; the store resolves it
// when the cell passes and reopens it when it fails again.
// Headless: this entry never imports ./ui.js. Importing it in Node is safe; the
// same plugin with no registration is `@sheetpane/validation/check` (W-54).
import { registerPlugin } from '@sheetpane/grid';
import { PLUGIN_ID, validation } from './plugin.js';

export type { Book, Rule, RuleKind, Operator, SkipReason, Evaluate } from './rules.js';
export { rulesOf, listOptions, ruleWords, check, shiftFormula, parseOperand } from './rules.js';
export { PLUGIN_ID, ERROR_TYPE, AUTHOR, skippedRules, lastReport, validateSheet, validation, listRuleAt, type ValidationOptions, type SkippedRule, type SkipReport } from './plugin.js';

registerPlugin(PLUGIN_ID, () => validation());
