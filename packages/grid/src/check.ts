// @sheetpane/grid/check — the checks the pane runs on load, with no page (W-54): the rules
// file, the column rules and every plugin's `validate`, over the same store the elements share,
// giving the same SheetpaneError[]. One engine, two entry points: this one never imports an
// element, registers nothing and touches no DOM, so it runs in Node, in a worker and in a page
// (SR-GRID decision 22f).
import { parseRange, spError } from '@sheetpane/export';
import { pluginsFromIds } from './plugins/host.js';
import type { DeriveInput, Plugin, PluginContext } from './plugins/types.js';
import type { ColumnRules, ColumnRulesConfig, OnInvalid, ValidateFn } from './pane/rules.js';
import { createWorkbook, type WorkbookStore } from './pane/store.js';
import type { SheetpaneError } from './pane/types.js';

// what a DOM-free host or plugin needs, from the modules the elements use (the same instances)
export { WorkbookStore, createWorkbook, parseInput, key as cellKey, splitKey, kindRef, baseRef, SLOTTED_KINDS, HISTORY_CAP, type StoreOptions, type StoreEvent, type Origin } from './pane/store.js';
export { checkDocument, describeRule, RULE_TYPE, CELL_RULE_TYPE, type RulesDocument, type DocProblem, type ColumnRule, type ColumnRules, type ColumnRulesConfig, type OnInvalid, type RuleContext, type RuleOutcome, type RulePhase, type RuleResult, type ValidateFn } from './pane/rules.js';
export { BUILTIN_TYPE_NAMES, DEFAULT_ERROR_TYPES, SEVERITY, machineAuthored } from './pane/types.js';
export type { SheetpaneError, Severity, Mode, ChangeKind, ChangeEntry, DerivedCell, Selection, Composing, LoadState, Source, Snapshot, ErrorType } from './pane/types.js';
export { registerPlugin, registeredPluginIds, pluginsFromIds, checkPlugins, type PluginFactory } from './plugins/host.js';
export { HOOKS, SLOTS, SINGLE_PROVIDER, STYLE_PROPS } from './plugins/types.js';
export type { Plugin, HookName, SlotName, ControlDescriptor, CellContext, PluginContext, DeriveInput, DerivedChange, ErrorDraft, OverlayItem, Geometry, StyleSubset, StyleProp } from './plugins/types.js';
export { shiftFormula } from '@sheetpane/export';
export { CODES, ERRORS_DOC_URL, codeUrl, spMessage, spError, codeOf, detailOf, type CodeInfo, type SpCode, type SpCoded, type SpError } from '@sheetpane/export';

/** What {@link check} takes besides the file: the pane's own settings, by the same names. */
export interface CheckOptions {
  /** The file's name; `.csv` reads it as CSV. Default: `workbook.xlsx` for a ZIP, else `data.csv` — as `<sheetpane-excel>`'s `load()` names unnamed bytes. */
  name?: string;
  /** A rules file (W-33): the object the element's `rules` takes, or its JSON text (text that is not JSON is the SP-6011 note `rules-src` gives). */
  rules?: unknown;
  /** Rules by column title — the element's `columns`. */
  columns?: ColumnRules;
  /** The host's own check per cell — the element's `validate`, the same signature `(ctx, signal)`, sync or async. */
  validate?: ValidateFn;
  /** Every rule's default, as `on-invalid`; at load both `flag` and `block` report a failure the same way. Default `flag`. */
  onInvalid?: OnInvalid;
  /** The row holding the titles, 1-based — `header-row`. Default 1. */
  headerRow?: number;
  /** The pane's plugins: plugin objects, or ids registered with `registerPlugin` (an unknown id throws SP-3002). */
  plugins?: readonly (Plugin | string)[];
}

/**
 * The errors a pane holds once a file has loaded and its checks have finished — the rules file, the
 * column rules (including an async `validate`, awaited) and every plugin's `validate`, after a
 * `derive` plugin has recalculated — computed with no page (SR-GRID decision 22f). Same file, same
 * options → the same errors as `<sheetpane-excel>` in a browser; only `id` and `createdAt` are per
 * run. Sorted by sheet (workbook order), row, column, then type and message.
 * @param file - The `.xlsx` or `.csv` bytes.
 * @param options - The pane's settings: `rules`, `columns`, `validate`, `onInvalid`, `headerRow`, `plugins`, and the file's `name`.
 * @returns The errors, SheetpaneError v1.
 * @throws SP-3020 when `file` is not bytes; the reader's own code (SP-10xx) when the file cannot be read.
 * @example
 * ```ts
 * import { check } from '@sheetpane/grid/check';
 * import { validation } from '@sheetpane/validation/check';
 *
 * // `bytes`: the file as your runtime reads it — `await readFile(path)` in Node
 * const found = await check(bytes, {
 *   name: 'q3.xlsx',
 *   rules: { version: 1, sheets: { '*': { columns: { Units: { type: 'integer', min: 0 } } } } },
 *   plugins: [validation()],
 * });
 * const blocking = found.filter((e) => e.severity === 'error');
 * ```
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md
 */
export async function check(file: Uint8Array | ArrayBuffer | Blob, options: CheckOptions = {}): Promise<SheetpaneError[]> {
  const isBlob = typeof Blob !== 'undefined' && file instanceof Blob;
  if (!(file instanceof Uint8Array || file instanceof ArrayBuffer || isBlob)) {
    throw spError('SP-3020', `check() takes the file's bytes — a Uint8Array, an ArrayBuffer or a Blob, not ${file === null ? 'null' : typeof file}`, TypeError);
  }
  const deriving = new Set<Promise<unknown>>();
  const plugins = (options.plugins ?? []).flatMap((p) => (typeof p === 'string' ? pluginsFromIds([p]) : [p])).map((p) => tracked(p, deriving));
  const store = createWorkbook({ plugins });
  const rules = rulesConfig(options);
  if (rules) store.setColumnRules(rules); // before the file, as an element given rules binds them first
  await store.load(file, options.name ?? (await nameOf(file)));
  const load = store.getSnapshot().load;
  if (load.status === 'error') throw spError(load.spCode, load.message);
  await settled(store, deriving);
  return sorted(store);
}

/** The element's `applyRules()`, from options: undefined when none is given (a pane with no rules has none). */
function rulesConfig(o: CheckOptions): ColumnRulesConfig | undefined {
  if (o.rules === undefined && o.columns === undefined && o.validate === undefined) return undefined;
  const c: ColumnRulesConfig = { columns: o.columns ?? {}, validate: o.validate, onInvalid: o.onInvalid ?? 'flag', headerRow: Math.max(1, Number(o.headerRow ?? 1) || 1) };
  if (o.rules !== undefined) c.document = documentOf(o.rules);
  return c;
}

/** A rules file given as text is parsed; text that is not JSON becomes the SP-6011 note, as a failed `rules-src` read does. */
function documentOf(rules: unknown): unknown {
  if (typeof rules !== 'string') return rules;
  try { return JSON.parse(rules) as unknown; } catch (e) { return { __error: `not JSON — ${(e as Error).message}` }; }
}

/** Unnamed bytes are named as `<sheetpane-excel>.load()` names them: a ZIP is `.xlsx`, anything else `.csv`. */
async function nameOf(file: Uint8Array | ArrayBuffer | Blob): Promise<string> {
  const head = file instanceof Uint8Array ? file.subarray(0, 2) : file instanceof ArrayBuffer ? new Uint8Array(file, 0, Math.min(2, file.byteLength)) : new Uint8Array(await file.slice(0, 2).arrayBuffer());
  return head[0] === 0x50 && head[1] === 0x4b ? 'workbook.xlsx' : 'data.csv';
}

/**
 * The plugin with its `derive` watched, so {@link check} knows when recalculation is done; the
 * plugin itself is the prototype — its id, hooks and anything else it offers (`evaluate()`) unchanged.
 */
function tracked(p: Plugin, deriving: Set<Promise<unknown>>): Plugin {
  if (typeof p?.derive !== 'function') return p;
  const w = Object.create(p) as Plugin;
  w.derive = (input: DeriveInput, ctx: PluginContext) => {
    const out = p.derive!.call(w, input, ctx);
    const done = Promise.resolve(out).then(() => undefined, () => undefined); // a failure is the store's to log (SP-3012)
    deriving.add(done);
    void done.then(() => deriving.delete(done));
    return out;
  };
  return w;
}

/** A turn of the event loop: the store's own continuations after a `derive` or a load-phase slice have run. */
const turn = () => new Promise<void>((r) => setTimeout(r, 0));

/** Resolves once the rules' load phase is idle (`ruleProgress` undefined) — it reports every step through the store. */
function rulesIdle(store: WorkbookStore): Promise<void> {
  if (store.ruleProgress === undefined) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const off = store.subscribe(() => { if (store.ruleProgress === undefined) { off(); resolve(); } });
  });
}

/** Waits until nothing is left to run: every `derive` landed and the rules' load phase finished, then once more. */
async function settled(store: WorkbookStore, deriving: Set<Promise<unknown>>): Promise<void> {
  for (;;) {
    await Promise.all([...deriving]);
    await rulesIdle(store);
    await turn();
    if (!deriving.size && store.ruleProgress === undefined) return;
  }
}

/** The store's errors in a fixed order: sheet (workbook order), row, column, type, message. */
function sorted(store: WorkbookStore): SheetpaneError[] {
  const order = new Map((store.book?.sheets ?? []).map((s, i) => [s.name, i]));
  const at = (e: SheetpaneError) => { const r = parseRange(e.range); return [order.get(e.sheet) ?? order.size, r?.top ?? -1, r?.left ?? -1] as const; };
  return store.getErrors().map((e) => ({ e, k: at(e) })).sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.k[2] - b.k[2] || (a.e.type < b.e.type ? -1 : a.e.type > b.e.type ? 1 : 0) || (a.e.message < b.e.message ? -1 : a.e.message > b.e.message ? 1 : 0)).map((x) => x.e);
}
