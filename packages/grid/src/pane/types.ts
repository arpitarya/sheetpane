// The shared state of one pane (contract verdict decisions 1–9; plugins verdict
// decisions 2–6; W-23 undo; W-24 freeze). Everything here is plain objects (L9).
import type { Cell } from '@sheetpane/export';
import type { ImportedWorkbook } from '@sheetpane/import';

export type Mode = 'view' | 'edit';
export type Severity = 'error' | 'warning' | 'note';

/** SheetpaneError v1 — exactly the contract verdict's schema. */
export interface SheetpaneError {
  v: 1;
  /** `"ERR-0003"` — stable, never reused in a session. */
  id: string;
  sheet: string;
  /** A1 cell `"I6"` or a whole row `"A14:J14"`. */
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
  status: 'open' | 'resolved';
  /** Computed: the cell now shows `expected` (B-022 — it does not resolve the error). */
  matchesExpected: boolean;
  /** The element's `author`, `"workbook"` (validation) or `"file"` (comments), or `""`. */
  author: string;
  /** ISO 8601. */
  createdAt: string;
}

/** Plugins verdict decision 6. */
export type ChangeKind = 'value' | 'style' | 'numFmt' | 'formula' | 'merge' | 'freeze';

/** One entry of the change map, keyed `sheet!ref` (or `sheet!#freeze`). */
export interface ChangeEntry {
  kind: ChangeKind;
  /** The uploaded value (for `value`: the stored cell; for others: the plugin's own shape). */
  was: unknown;
  now: unknown;
}

/** A value a plugin's `derive` hook computed (W-16): never a user change. */
export interface DerivedCell { value: Cell; text: string }

export interface Selection {
  sheet: string;
  /** The active cell, A1. */
  ref: string;
  /** A range when more than one cell is selected (`A1:C4`); otherwise undefined. */
  range?: string;
}

export interface Composing { sheet: string; ref: string; range?: string }

export type LoadState =
  | { status: 'empty' }
  | { status: 'loading'; name: string }
  | { status: 'ready' }
  | { status: 'error'; code: string; detail?: string; message: string; name: string };

export interface Source {
  name: string;
  kind: 'xlsx' | 'csv';
  size: number;
  /** The uploaded bytes, never modified (L6 decision 4). */
  bytes: Uint8Array;
  /** Milliseconds the read took. */
  readMs: number;
}

export interface Snapshot {
  readonly load: LoadState;
  readonly source: Source | undefined;
  readonly book: ImportedWorkbook | undefined;
  /** `sheet!ref` → entry. Never a derived cell. */
  readonly changes: ReadonlyMap<string, ChangeEntry>;
  /** `sheet!ref` → a value a plugin derived. */
  readonly derived: ReadonlyMap<string, DerivedCell>;
  readonly errors: readonly SheetpaneError[];
  readonly selection: Selection;
  readonly mode: Mode;
  readonly composing: Composing | null;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Bumped on every change of state; elements compare it to skip work. */
  readonly version: number;
}

export interface ErrorType { id: string; name: string; severity: Severity; why: string; expected: string }

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
export const BUILTIN_TYPE_NAMES: Readonly<Record<string, string>> = { validation: 'Workbook rule', comment: 'Comment', 'column-rule': 'Column rule' };

/** Errors the workbook, the file or a host rule wrote: shown, never resolved or deleted by hand. */
export const machineAuthored = (author: string) => author === 'workbook' || author === 'file' || author === 'host';

export const SEVERITY: Record<Severity, { name: string; glyph: string; help: string }> = {
  error: { name: 'Error', glyph: '✕', help: 'Must be fixed before this file is accepted.' },
  warning: { name: 'Warning', glyph: '!', help: 'Needs a second look; may be fine.' },
  note: { name: 'Note', glyph: 'i', help: 'For information — nothing blocks.' },
};
