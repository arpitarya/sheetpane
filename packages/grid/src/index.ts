// @sheetpane/grid — the web components <sheetpane-excel> and <sheetpane-errors>
// and the in-memory workbook they share. Importing this module registers the
// elements where `customElements` exists (SR-LAW-4, SR-LAW-8).
import { SheetpaneExcel } from './excel/element.js';
import { SheetpaneErrors } from './errors/element.js';
import { define } from './shared/dom.js';

// re-exported from their modules (not `export { X }` of the import) so the published .d.ts points
// tooling at the declarations and their TSDoc (W-36)
export { SheetpaneExcel } from './excel/element.js';
export { SheetpaneErrors } from './errors/element.js';
export type { HighlightOptions, HighlightRange, HighlightTone } from './excel/element.js';
export { WorkbookStore, createWorkbook, parseInput, formulaRefs, key as cellKey, splitKey, kindRef, baseRef, SLOTTED_KINDS, HISTORY_CAP, type StoreOptions, type StoreEvent, type Origin, type ResultCounts } from './pane/store.js';
export { acquirePane, releasePane, paneStore } from './pane/registry.js';
export { checkDocument, describeRule, RULE_TYPE, CELL_RULE_TYPE, type RulesDocument, type DocProblem, type ColumnRule, type ColumnRules, type ColumnRulesConfig, type OnInvalid, type RuleContext, type RuleOutcome, type RulePhase, type RuleResult, type ValidateFn } from './pane/rules.js';
export { BUILTIN_TYPE_NAMES, DEFAULT_ERROR_TYPES, ERROR_META_MAX, SEVERITY, SEVERITY_ORDER, RESULTS_LEVELS, errorScope, isResult, resultsLevelOf, machineAuthored } from './pane/types.js';
// for plugins whose rules are written against a range's top-left (validation, condfmt): the one implementation
export { shiftFormula } from '@sheetpane/export';
// Stable error codes (W-40), re-exported for plugins that do not depend on @sheetpane/export.
export { CODES, ERRORS_DOC_URL, codeUrl, spMessage, spError, codeOf, detailOf, type CodeInfo, type SpCode, type SpCoded, type SpError } from '@sheetpane/export';
export type { SheetpaneError, Severity, ProblemSeverity, ResultSeverity, ResultsLevel, Mode, ChangeKind, ChangeEntry, DerivedCell, Selection, Composing, LoadState, Source, Snapshot, ErrorType, ErrorScope, ErrorMeta, ErrorStatus, RenderDetail } from './pane/types.js';
export { registerPlugin, registeredPluginIds, pluginsFromIds, checkPlugins, mergeDecorations, controlsFor, type PluginFactory } from './plugins/host.js';
export { HOOKS, SLOTS, SINGLE_PROVIDER, STYLE_PROPS } from './plugins/types.js';
export type { Plugin, HookName, SlotName, ControlDescriptor, CellContext, PluginContext, DeriveInput, DerivedChange, ErrorDraft, OverlayItem, Geometry, StyleSubset, StyleProp, RunStyle } from './plugins/types.js';
export { sheetGeometry, charsToPx, ROW_H, HEAD_H, ROWHEAD_W } from './excel/geometry.js';
export { DARK_TOKENS, TOKENS, TOKENS_CSS, type Theme, type TokenName } from './tokens.js';

define('sheetpane-excel', SheetpaneExcel);
define('sheetpane-errors', SheetpaneErrors);

declare global {
  interface HTMLElementTagNameMap { 'sheetpane-excel': SheetpaneExcel; 'sheetpane-errors': SheetpaneErrors }
}
