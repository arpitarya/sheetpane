// @sheetpane/grid — the web components <sheetpane-excel> and <sheetpane-errors>
// and the in-memory workbook they share. Importing this module registers the
// elements where `customElements` exists (SR-LAW-4, SR-LAW-8).
import { SheetpaneExcel } from './excel/element.js';
import { SheetpaneErrors } from './errors/element.js';
import { define } from './shared/dom.js';

export { SheetpaneExcel, SheetpaneErrors };
export { WorkbookStore, createWorkbook, parseInput, formulaRefs, key as cellKey, splitKey, kindRef, baseRef, SLOTTED_KINDS, HISTORY_CAP, type StoreOptions, type StoreEvent, type Origin } from './pane/store.js';
export { acquirePane, releasePane, paneStore } from './pane/registry.js';
export { DEFAULT_ERROR_TYPES, SEVERITY } from './pane/types.js';
export type { SheetpaneError, Severity, Mode, ChangeKind, ChangeEntry, DerivedCell, Selection, Composing, LoadState, Source, Snapshot, ErrorType } from './pane/types.js';
export { registerPlugin, registeredPluginIds, pluginsFromIds, checkPlugins, mergeDecorations, controlsFor, type PluginFactory } from './plugins/host.js';
export { HOOKS, SLOTS, SINGLE_PROVIDER, STYLE_PROPS } from './plugins/types.js';
export type { Plugin, HookName, SlotName, ControlDescriptor, CellContext, PluginContext, DeriveInput, DerivedChange, ErrorDraft, OverlayItem, Geometry, StyleSubset, StyleProp } from './plugins/types.js';
export { sheetGeometry, charsToPx, ROW_H, HEAD_H, ROWHEAD_W } from './excel/geometry.js';
export { DARK_TOKENS, TOKENS, TOKENS_CSS, type Theme, type TokenName } from './tokens.js';

define('sheetpane-excel', SheetpaneExcel);
define('sheetpane-errors', SheetpaneErrors);

declare global {
  interface HTMLElementTagNameMap { 'sheetpane-excel': SheetpaneExcel; 'sheetpane-errors': SheetpaneErrors }
}
