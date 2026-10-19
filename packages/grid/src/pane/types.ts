// The shared state of one pane (contract verdict decisions 1–9; plugins verdict
// decisions 2–6; W-23 undo; W-24 freeze). Everything here is plain objects (L9).
import type { Cell, SpCode } from '@sheetpane/export';
import type { ImportedWorkbook } from '@sheetpane/import';

/** The pane's mode, shared by its elements: `view` reads, `edit` changes cells and flags errors. */
export type Mode = 'view' | 'edit';
/**
 * How serious an error is — or, for `pass` and `skipped` (not checked), a result rather than a
 * problem (W-50); see {@link SEVERITY} for its name, glyph and help line.
 */
export type Severity = 'error' | 'warning' | 'note' | 'pass' | 'skipped';
/** The severities that ask for action: everything but a result. */
export type ProblemSeverity = 'error' | 'warning' | 'note';
/** A result, not a problem: a passed check or a cell that was not checked (W-50). */
export type ResultSeverity = 'pass' | 'skipped';
/**
 * How much of the results a pane shows (W-50, the `results` attribute): `off` drops `pass` and
 * `skipped` entries on arrival; `summary` (the default) counts them in the errors panel and marks
 * nothing on the sheet; `marks` also puts a ✓ or — in each result cell's bottom-left corner.
 */
export type ResultsLevel = 'off' | 'summary' | 'marks';
/** The results levels, in order. */
export const RESULTS_LEVELS: readonly ResultsLevel[] = ['off', 'summary', 'marks'];
/** The `results` attribute's level: `off` or `marks`, else `summary`. */
export const resultsLevelOf = (v: string | null | undefined): ResultsLevel => (v === 'off' || v === 'marks' ? v : 'summary');

/** SheetpaneError v1 — exactly the contract verdict's schema. */
export interface SheetpaneError {
  v: 1;
  /** `"ERR-0003"` — stable, never reused in a session. */
  id: string;
  /** The sheet's name; `""` (with `range: ""`) for an error about the whole workbook (W-55). */
  sheet: string;
  /** A1 cell `"I6"` or a whole row `"A14:J14"`; `""` for an error about the whole sheet, or the workbook (W-55) — see {@link errorScope}. */
  range: string;
  /** An id from `errorTypes`, e.g. `"wrong-value"`. */
  type: string;
  severity: Severity;
  /** The UPLOADED display text — never the edit. */
  found: string;
  expected: string;
  message: string;
  /** "Also change the cell" was ticked. */
  cellChanged: boolean;
  /** `accepted` (W-69): a known deviation someone approved — kept, never counted as open; it carries `acceptedBy`, `acceptedAt` and a `reason`. */
  status: ErrorStatus;
  /** Computed: the cell now shows `expected` (B-022 — it does not resolve the error). */
  matchesExpected: boolean;
  /** The element's `author`, `"workbook"` (validation) or `"file"` (comments), or `""`. */
  author: string;
  /** ISO 8601. */
  createdAt: string;
  /** The stable SP code (W-40) when sheetpane itself raised the error — a rules-engine note, e.g. `"SP-6023"`; see docs/ERRORS.md. Optional: v1 stays valid without it. */
  code?: SpCode;
  /**
   * The host's own data about the error (W-68) — what `renderDetail` reads, e.g. a PDF page and box, a measured and an
   * expected size. Any JSON value up to {@link ERROR_META_MAX} bytes; kept as its JSON round trip, carried by
   * `getErrors()`, `setErrors()` and the `sheetpane-errors` envelope, and never written into the file. Optional: v1
   * stays valid without it.
   */
  meta?: ErrorMeta;
  /** Who accepted the deviation (W-69): the element's `author`, or what the host passed; `""` when nobody was named. Only while `status` is `accepted`. */
  acceptedBy?: string;
  /** When it was accepted, ISO 8601 (W-69). Only while `status` is `accepted`. */
  acceptedAt?: string;
  /** Why it was accepted (W-69) — required, never blank, while `status` is `accepted`; written into the export as *Accepted: <reason>*. */
  reason?: string;
  /**
   * The review layer the error belongs to (W-51), e.g. `"validation"` or `"pdf"`: a named set of errors the host replaces
   * whole with `setErrors(list, { layer })` and the user shows with the layers switch. Every error the store holds carries
   * one; an error given without it (a review saved before W-51) is in {@link DEFAULT_LAYER}. A name is 1–64 characters
   * with no spaces ({@link isLayerName}). An edit never moves an error to another layer.
   */
  layer?: string;
}

/** The layer an error is in when nobody names one (W-51): `"review"` — people's errors and the plugins' land here. */
export const DEFAULT_LAYER = 'review';

/**
 * Whether a value may name a review layer (W-51): a string of 1–64 characters with no whitespace, so the `layers`
 * attribute can list several separated by spaces.
 *
 * @param x - Any value.
 * @returns True for a usable layer name.
 * @example
 * ```ts
 * import { isLayerName } from '@sheetpane/grid';
 * isLayerName('pdf'); // true
 * isLayerName('PDF check'); // false — a space
 * ```
 */
export const isLayerName = (x: unknown): x is string => typeof x === 'string' && /^\S{1,64}$/.test(x);

/**
 * The layer an error is in (W-51): its `layer`, else {@link DEFAULT_LAYER}.
 *
 * @param e - The error, or just its `layer`.
 * @returns The layer's name.
 * @example
 * ```ts
 * import { layerOf } from '@sheetpane/grid';
 * layerOf({ layer: 'pdf' }); // 'pdf'
 * layerOf({}); // 'review'
 * ```
 */
export const layerOf = (e: Pick<SheetpaneError, 'layer'>): string => e.layer ?? DEFAULT_LAYER;

/**
 * What `sheetpane-errors` carries and a host saves to restore a review (W-51 bumps it to `v: 2`): every error with its
 * `layer`, the pane's plugin ids, and the pane's layers in order — an empty one included, so a check that found nothing
 * comes back as a layer. `changed` names the layers whose errors changed in this event (ignored on restore).
 * `setErrors(envelope)` restores it; an envelope saved before W-51 (`{ errors, plugins }`, no `v`) restores into
 * `review`.
 *
 * @example
 * ```ts
 * import '@sheetpane/grid';
 * import type { ErrorsEnvelope } from '@sheetpane/grid';
 * const list = document.querySelector('sheetpane-errors')!;
 * list.addEventListener('sheetpane-errors', (e) => localStorage.setItem('review', JSON.stringify((e as CustomEvent<ErrorsEnvelope>).detail)));
 * const saved = JSON.parse(localStorage.getItem('review') ?? 'null') as ErrorsEnvelope | null;
 * if (saved) list.setErrors(saved);
 * ```
 */
export interface ErrorsEnvelope {
  /** `2` since W-51; absent in an envelope saved before it. */
  v?: 2;
  errors: SheetpaneError[];
  plugins?: string[];
  /** The pane's layers in the order they were first named. */
  layers?: string[];
  /** The layers whose errors changed in this event. */
  changed?: string[];
}

/**
 * Where an error stands: `open` counts as a problem; `resolved` is fixed; `accepted` (W-69) is a known deviation someone
 * approved with a reason — kept in the review and the download, never counted as open.
 */
export type ErrorStatus = 'open' | 'resolved' | 'accepted';

/** A JSON value: what `SheetpaneError.meta` holds (W-68). */
export type ErrorMeta = null | boolean | number | string | ErrorMeta[] | { [key: string]: ErrorMeta };

/** The most an error's `meta` may weigh, in bytes of its JSON text (UTF-8): 64 KiB. Over it, the meta is dropped with SP-3016 (W-68). */
export const ERROR_META_MAX = 65536;

/**
 * The host's extra detail for one error (W-68), drawn in the sheet's error card and the error list's open row, after the
 * message, in a region the host styles as `::part(detail)`. A string is shown as text, never parsed as HTML; a Node is
 * the host's own and is placed as it is; `null`, `undefined` or `''` shows nothing. It is called again only when the
 * error changes (its `meta` included) or the hook is replaced. A throw is logged as SP-3017 and shows nothing.
 *
 * @example
 * ```ts
 * import '@sheetpane/grid';
 * import type { RenderDetail } from '@sheetpane/grid';
 * const detail: RenderDetail = (e) => {
 *   const m = e.meta as { measured?: string; expected?: string } | null | undefined;
 *   return m?.measured ? `The PDF measures ${m.measured}; the sheet says ${m.expected}.` : null;
 * };
 * document.querySelector('sheetpane-excel')!.renderDetail = detail;
 * document.querySelector('sheetpane-errors')!.renderDetail = detail;
 * ```
 */
export type RenderDetail = (error: SheetpaneError) => Node | string | null | undefined;

/** A copy of an error the host may change freely: its `meta` is cloned too (W-68). */
export const copyError = (e: SheetpaneError): SheetpaneError => (e.meta !== null && typeof e.meta === 'object' ? { ...e, meta: structuredClone(e.meta) } : { ...e });

/** Plugins verdict decision 6. */
export type ChangeKind = 'value' | 'style' | 'numFmt' | 'formula' | 'merge' | 'freeze' | 'hidden' | 'sheetState' | 'outline' | 'structure';

/** Whether Excel shows a sheet: `veryHidden` is hidden from Excel's own Unhide list (W-49). */
export type { SheetState } from '@sheetpane/export';

/** One entry of the change map, keyed `sheet!ref` (or `sheet!#freeze`; `sheet!#structure` holds the sheet's inserts and deletes, in order, W-52). */
export interface ChangeEntry {
  kind: ChangeKind;
  /** The uploaded value (for `value`: the stored cell; for others: the plugin's own shape). */
  was: unknown;
  now: unknown;
}

/**
 * One change-map entry as the Edits view lists it (W-64, `store.edits()`): the edit's key, its place,
 * kind, before and after, and when it was made. A kind the view does not know is listed as it is.
 */
export interface Edit {
  /** The change-map key — `Sheet1!B3`, `Sheet1!#style:B3`, `Sheet1!#freeze` — what `revertEdits()` takes. */
  key: string;
  sheet: string;
  /** The cell or range the edit is about (`B3`; `A1:C1` for a merge); `''` for one about the whole sheet (freeze, hidden rows, its state). */
  ref: string;
  kind: ChangeKind;
  /** What the file had (for `value`: the stored cell). */
  was: unknown;
  /** What it holds now. */
  now: unknown;
  /** When the entry was last written, ISO 8601; undo brings back the entry with its time. */
  at: string;
}

/** What an edit did to the problems on its cells (W-64, `store.editEffects(key)`): error ids, compared with before its cell first changed. */
export interface EditEffects {
  /** Workbook, file or rule errors that were open and are now resolved or gone. */
  cleared: string[];
  /** Workbook, file or rule errors open now that were not open before. */
  raised: string[];
  /** A person's errors whose suggestion the cell now matches (they stay open — SR-GRID decision 5). */
  matched: string[];
}

/** A value a plugin's `derive` hook computed (W-16): never a user change. */
export interface DerivedCell { value: Cell; text: string }

/** The pane's selection, shared by its elements. */
export interface Selection {
  sheet: string;
  /** The active cell, A1. */
  ref: string;
  /** A range when more than one cell is selected (`A1:C4`); otherwise undefined. */
  range?: string;
}

/** The cell (or row range) whose Flag issue form is open. */
export interface Composing { sheet: string; ref: string; range?: string }

/** Where the pane is in reading a file (SR-GRID decision 2). */
export type LoadState =
  | { status: 'empty' }
  | { status: 'loading'; name: string }
  | { status: 'ready' }
  /** `code` is the reader's typed reason (`corrupt`, `password-or-legacy`, `unreadable`…); `spCode` its stable SP code (W-40). */
  | { status: 'error'; code: string; spCode: SpCode; detail?: string; message: string; name: string };

/** The file the pane read. */
export interface Source {
  name: string;
  kind: 'xlsx' | 'csv';
  size: number;
  /** The uploaded bytes, never modified (L6 decision 4). */
  bytes: Uint8Array;
  /** Milliseconds the read took. */
  readMs: number;
  /** The SHA-256 of `bytes`, 64 lowercase hex digits, hashed once on load (W-65); absent where Web Crypto is missing (SP-1009). */
  sha256?: string;
}

/** The pane's state at one moment: immutable, a new object per change (SR-GRID decision 2). */
export interface Snapshot {
  readonly load: LoadState;
  readonly source: Source | undefined;
  readonly book: ImportedWorkbook | undefined;
  /** `sheet!ref` → entry. Never a derived cell. */
  readonly changes: ReadonlyMap<string, ChangeEntry>;
  /** `sheet!ref` → a value a plugin derived. */
  readonly derived: ReadonlyMap<string, DerivedCell>;
  /** Every error in the pane, in every layer (W-51). */
  readonly errors: readonly SheetpaneError[];
  /** The pane's review layers in the order they were first named (W-51): by `setErrors(list, { layer })`, by the `layers` attribute, or by an error. */
  readonly layers: readonly string[];
  /** The layers shown (W-51): what the `layers` attribute or the switch chose, else every layer. */
  readonly visibleLayers: readonly string[];
  /** The errors in the visible layers — what every surface draws and counts (W-51, SR-LAW-7). The same array as `errors` while every layer is shown. */
  readonly visibleErrors: readonly SheetpaneError[];
  readonly selection: Selection;
  readonly mode: Mode;
  readonly composing: Composing | null;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Bumped on every change of state; elements compare it to skip work. */
  readonly version: number;
}

/** A choice in the Flag issue form: an id, its name, its default severity and an example (SR-ERRORS decisions 5–6). */
export interface ErrorType { id: string; name: string; severity: Severity; why: string; expected: string }

/** The seven error types and Other that `errorTypes` defaults to (SR-ERRORS decision 6). */
export const DEFAULT_ERROR_TYPES: readonly ErrorType[] = [
  { id: 'wrong-value', name: 'Wrong value', severity: 'error', why: 'Fee rate is 10× the account’s tier and above the 2.00% cap — a misplaced decimal.', expected: '0.75%' },
  { id: 'mismatch-source', name: 'Doesn’t match source', severity: 'error', why: 'Price differs from the 30-Sep pricing file for TMKT; digits look transposed.', expected: '268.40' },
  { id: 'wrong-format', name: 'Wrong format', severity: 'warning', why: 'Letter O instead of zero; account IDs follow the pattern AC-#####.', expected: 'AC-10044' },
  { id: 'invalid-date', name: 'Invalid date', severity: 'error', why: 'September has 30 days. Every other row is as of 30-Sep-2026.', expected: '30-Sep-2026' },
  { id: 'missing-value', name: 'Missing value', severity: 'warning', why: 'Advisor is required. The same account on row 10 is S. Kapoor.', expected: 'S. Kapoor' },
  { id: 'out-of-range', name: 'Out of range', severity: 'warning', why: 'Units can’t be negative for a holding — a sale belongs in the transactions file.', expected: '150' },
  { id: 'duplicate-row', name: 'Duplicate row', severity: 'note', why: 'Same account, security, units and price as row 5; it counts 32,185.50 twice.', expected: 'Delete row 14' },
  { id: 'other', name: 'Other', severity: 'warning', why: 'Say in plain words what you saw — “10× the tier rate” beats “wrong”.', expected: '' },
];

/** Names for the types plugins and the core write, shown when the host's `errorTypes` does not name them. */
export const BUILTIN_TYPE_NAMES: Readonly<Record<string, string>> = { validation: 'Workbook rule', comment: 'Comment', 'column-rule': 'Column rule', 'cell-rule': 'Cell rule' };

/** Where an error belongs (W-55). */
export type ErrorScope = 'cell' | 'sheet' | 'workbook';

/**
 * Where an error belongs: `workbook` when `sheet` is `""`, `sheet` when `range` is `""`, else `cell`.
 * A sheet- or workbook-level error has no cell — it is listed above the cell errors, never placed on A1.
 *
 * @param e - The error, or just its `sheet` and `range`.
 * @returns `cell`, `sheet` or `workbook`.
 * @example
 * ```ts
 * import { errorScope } from '@sheetpane/grid';
 * errorScope({ sheet: 'Pages', range: '' }); // 'sheet'
 * errorScope({ sheet: '', range: '' }); // 'workbook'
 * ```
 */
export const errorScope = (e: Pick<SheetpaneError, 'sheet' | 'range'>): ErrorScope => (e.sheet === '' ? 'workbook' : e.range === '' ? 'sheet' : 'cell');

/** Errors the workbook, the file or a host rule wrote: shown, never resolved or deleted by hand. */
export const machineAuthored = (author: string) => author === 'workbook' || author === 'file' || author === 'host';

/** Each severity's name, glyph and help line — a glyph and a colour, never colour alone. */
export const SEVERITY: Record<Severity, { name: string; glyph: string; help: string }> = {
  error: { name: 'Error', glyph: '✕', help: 'Must be fixed before this file is accepted.' },
  warning: { name: 'Warning', glyph: '!', help: 'Needs a second look; may be fine.' },
  note: { name: 'Note', glyph: 'i', help: 'For information — nothing blocks.' },
  pass: { name: 'Passed', glyph: '✓', help: 'A check ran on this cell and it passed — not a problem.' },
  skipped: { name: 'Not checked', glyph: '—', help: 'No check ran on this cell; the message says why — not a problem.' },
};

/** Severity order, worst first: error › warning › note › skipped › pass (W-50 DoD 4). */
export const SEVERITY_ORDER: Record<Severity, number> = { error: 5, warning: 4, note: 3, skipped: 2, pass: 1 };

/** A `pass` or `skipped` entry: a result, never counted where a count asks for action (W-50). */
export const isResult = (e: { severity: Severity }): boolean => e.severity === 'pass' || e.severity === 'skipped';
