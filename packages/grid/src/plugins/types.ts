// The plugin contract (plugins verdict decisions 2–7; W-14): six hooks, six slots.
// A plugin is a plain object; everything it may touch goes through the store.
import type { Cell, PatchContext, StructureOpName } from '@sheetpane/export';
import type { ImportedSheet, ImportedWorkbook, TextRun } from '@sheetpane/import';
import type { Mode, Selection, SheetpaneError, Snapshot } from '../pane/types.js';
import type { WorkbookStore } from '../pane/store.js';

/** The six hooks a plugin may provide (SR-GRID decision 17). */
export type HookName = 'format' | 'decorate' | 'derive' | 'validate' | 'overlay' | 'exportPatch';
/** {@link HookName} as a list. */
export const HOOKS: readonly HookName[] = ['format', 'decorate', 'derive', 'validate', 'overlay', 'exportPatch'];
/** Hooks with exactly one provider per pane; a second provider throws at registration. */
export const SINGLE_PROVIDER: readonly HookName[] = ['format', 'derive'];

/** The CSS a `decorate` hook may return — and never `font-family` (SR-LAW-5). */
export const STYLE_PROPS = [
  'background-color', 'background-image', 'color', 'font-weight', 'font-style', 'font-size', 'text-decoration', 'text-align', 'vertical-align', 'white-space',
  'border-top', 'border-right', 'border-bottom', 'border-left', 'padding-left',
] as const;
/** One CSS property a `decorate` hook may set. */
export type StyleProp = (typeof STYLE_PROPS)[number];
/** A `decorate` result: CSS properties from {@link STYLE_PROPS} to their values. */
export type StyleSubset = Partial<Record<StyleProp, string>>;

/** One cell, as a hook sees it. */
export interface CellContext {
  readonly store: WorkbookStore;
  readonly book: ImportedWorkbook;
  readonly sheet: ImportedSheet;
  readonly ref: string;
  readonly row: number;
  readonly col: number;
  /** The current value (a user change applied). */
  readonly value: Cell;
  /** The cell's style index (`s`), the change map's `style` entry applied by plugins themselves. */
  readonly styleIndex: number | undefined;
  /** A rich-text cell's runs from the file (W-53) — only while the cell still holds the file's value; absent once it is edited. */
  readonly runs?: readonly TextRun[];
}

/** One styled piece of a rich-text cell (W-53): a run's text and its CSS from {@link STYLE_PROPS}, never `font-family`. */
export interface RunStyle {
  text: string;
  style?: StyleSubset;
}

/** What every plugin hook but `format` and `decorate` is given. */
export interface PluginContext {
  readonly store: WorkbookStore;
  readonly book: ImportedWorkbook;
  snapshot(): Snapshot;
  /** During `exportPatch`: the options the host passed to `export(options)` (e.g. `{ comments: false }`, `{ layers: ['pdf'] }` — W-51). */
  readonly exportOptions?: Readonly<Record<string, unknown>>;
}

/**
 * What `derive` is told: the workbook loaded, cells changed (by the user, or by undo), or rows or
 * columns were inserted or deleted (W-52) — `ctx.book` is then the moved workbook and, as on a
 * load, the provider returns every derived cell (the store replaces its derived set with them).
 */
export type DeriveInput =
  | { kind: 'load' }
  | { kind: 'change'; cells: { sheet: string; ref: string; value: Cell }[] }
  | { kind: 'restructure'; sheet: string; op: StructureOpName; at: number; count: number };

/** One recalculated cell. `clear: true` removes the cell's derived entry (its value and text are then ignored). */
export interface DerivedChange { sheet: string; ref: string; value: Cell; text: string; clear?: boolean }

/** What `validate` returns: an error without the fields the store owns. */
/** `key` tells apart a provider's findings that share a sheet, range and type (several notes on one cell); it is not stored on the error. `layer` (W-51) puts the error in that review layer; without it, `review`. */
export type ErrorDraft = Omit<SheetpaneError, 'v' | 'id' | 'matchesExpected' | 'createdAt' | 'status' | 'cellChanged' | 'acceptedBy' | 'acceptedAt' | 'reason'> & { status?: 'open' | 'resolved'; cellChanged?: boolean; key?: string };

/** One switch a plugin offers in the Download menu; its `key` reaches `exportPatch` as `ctx.exportOptions[key]`. */
export interface ExportOption {
  key: string;
  label: string;
  default: boolean;
  /**
   * Whether the switch has anything to do for this workbook (W-58). When it returns `false` the menu leaves the switch
   * out; when it returns `true` and the switch is on, Download exports even an untouched workbook instead of handing back
   * the original bytes. Absent: always shown, and Download decides by changes and errors alone.
   */
  applies?(store: WorkbookStore): boolean;
}

/** Something drawn in sheet space (pictures, charts). `rect` is in pixels at 100 % zoom from the top-left of A1. */
export interface OverlayItem {
  id: string;
  sheet: string;
  rect: { x: number; y: number; width: number; height: number };
  render(): HTMLElement;
  /** The item's accessible name; re-read on every overlay pass, so it may change (W-21). */
  alt?: string;
  /** `img` (default): a picture; `group`: an item holding controls a keyboard or a screen reader can reach. */
  role?: 'img' | 'group';
  /** Pointer events pass through to the cells below (an outline, a highlight). */
  passThrough?: boolean;
}

/** Sheet geometry a plugin needs to place things (W-20). Pixels at 100 % zoom. */
export interface Geometry {
  colX(col: number): number;
  colWidth(col: number): number;
  rowY(row: number): number;
  rowHeight(row: number): number;
}

/** The six places a plugin's controls render (SR-GRID decision 19). */
export type SlotName = 'format-row' | 'selbar' | 'cellbar' | 'status' | 'cell' | 'overlay';
/** {@link SlotName} as a list. */
export const SLOTS: readonly SlotName[] = ['format-row', 'selbar', 'cellbar', 'status', 'cell', 'overlay'];

/** A control a plugin describes and the grid renders (plugins verdict, slots). */
export interface ControlDescriptor {
  id: string;
  slot: SlotName;
  /** Controls render in group order, then in the order given. */
  group: string;
  label: string;
  /** Inline SVG markup (no external URL). */
  icon?: string;
  shortcut?: string;
  mode: Mode | 'both';
  isActive?(snap: Snapshot, sel: Selection): boolean;
  /** Greyed out and not runnable for this selection (Merge on one cell, the format row on a CSV). */
  disabled?(snap: Snapshot, sel: Selection): boolean;
  /** A label that follows the selection (Merge ↔ Unmerge); `label` otherwise. */
  labelFor?(snap: Snapshot, sel: Selection): string;
  run?(store: WorkbookStore, sel: Selection): void;
  /** `status` slot: the text to show; `cell` slot: whether the cell carries the mark. */
  text?(snap: Snapshot, sel: Selection): string;
  appliesTo?(cell: CellContext): boolean;
  /** A dropdown instead of a button (format-row, selbar, cellbar): its choices, the current one, what choosing does. */
  options?(snap: Snapshot, sel: Selection): { value: string; label: string }[];
  value?(snap: Snapshot, sel: Selection): string;
  choose?(store: WorkbookStore, sel: Selection, value: string): void;
  /** `cell` slot: the choices the mark's menu offers for this cell (W-18's list arrow); picking calls `choose`. */
  cellOptions?(cell: CellContext): string[];
  /**
   * `selbar` controls: the menus the control also joins (W-49) — the cell's right-click menu, the
   * header menu (right-click a column or row header) and the tab menu (right-click a sheet tab, where
   * `run` gets that tab's sheet). Absent: the cell menu only, as before.
   */
  menus?: readonly ('cell' | 'header' | 'tab')[];
  /** Why the control is disabled, said in its tooltip (W-49: "CSV can't store hidden rows"). */
  disabledReason?(snap: Snapshot, sel: Selection): string | undefined;
}

/**
 * A plugin: a plain object naming the hooks it provides, the functions for them and its
 * controls (SR-GRID decisions 17–19). Register it with {@link registerPlugin}.
 */
export interface Plugin {
  id: string;
  /** The hooks this plugin provides. */
  provides: HookName[];
  /** For `decorate`: the plugins whose result this one overrides, per property. */
  after?: string[];
  format?(cell: CellContext): string | undefined;
  decorate?(cell: CellContext): StyleSubset | undefined;
  /**
   * Part of the `decorate` hook (W-53): a rich-text cell (`cell.runs`) drawn as styled spans inside the cell. The
   * pieces' text joined must be the cell's display text, or the grid draws it plain. Later providers win.
   */
  decorateRuns?(cell: CellContext): RunStyle[] | undefined;
  derive?(input: DeriveInput, ctx: PluginContext): DerivedChange[] | Promise<DerivedChange[]>;
  validate?(sheet: string, ctx: PluginContext): ErrorDraft[];
  overlay?(sheet: string, ctx: PluginContext & { geometry: Geometry }): OverlayItem[];
  exportPatch?(patch: PatchContext, ctx: PluginContext): void | Promise<void>;
  controls?: ControlDescriptor[];
  /** Options this plugin reads from `ctx.exportOptions`, offered as checkboxes in the Download menu (W-34): `{ comments: true }`. */
  exportOptions?: readonly ExportOption[];
}
