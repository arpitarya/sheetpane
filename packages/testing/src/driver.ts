// The one API both drivers implement (W-41 DoD 2, 3).
import type { Values } from './read.js';

/** What `flag` fills into the new-error form; a field left out keeps the form's default. */
export interface FlagDraft { type?: string; expected?: string; message?: string; severity?: 'error' | 'warning' | 'note' }
/** A file the Download button produced. */
export interface Download {
  /** The file name the sheet offered. */
  name: string;
  /** The file's bytes. */
  bytes: Uint8Array;
}
/** A cell by A1 ref (`B3`, `Sheet1!B3`) or by column title and row number (1-based, as Excel shows it). */
export type CellAt = string | { column: string; row: number; sheet?: string };

/**
 * The one API both drivers implement: act on a `<sheetpane-excel>` as a person would, and read what it holds.
 *
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0118_TESTING.md
 */
export interface SheetpaneDriver {
  /** Resolves once the sheet has read its file (`sheetpane-load` ready), and its rule checks have finished. */
  waitForLoad(): Promise<void>;
  /** The A1 ref (with its sheet) a cell spec names, e.g. `{ column: 'Units', row: 4 }` → `Holdings!F4`. */
  ref(at: CellAt): Promise<string>;
  /** Selects a cell by clicking it. */
  select(at: CellAt): Promise<void>;
  /** Selects a cell, types `value` into the cell bar and presses Enter. */
  edit(at: CellAt, value: string): Promise<void>;
  /** Pastes tab-separated rows from `at`, as Ctrl/⌘+V would. */
  paste(at: CellAt, rows: string[][]): Promise<void>;
  /** Flag issue on a cell and fill the form (in `<sheetpane-errors>` when one is connected, else inline). */
  flag(at: CellAt, draft?: FlagDraft): Promise<void>;
  /** Resolves the error on a cell (`ref`) or the n-th row of the error list (0-based). */
  resolve(which: CellAt | number): Promise<void>;
  /** Presses Undo. */
  undo(): Promise<void>;
  /** Clicks a sheet's tab. */
  switchSheet(name: string): Promise<void>;
  /** Presses Download and returns the file. */
  download(): Promise<Download>;
  /** Presses Download and reads the file back as values. */
  readDownload(): Promise<Values>;
  /** The pane's errors, as `getErrors()` returns them. */
  errors(): Promise<{ sheet: string; range: string; type: string; severity: string; status: string; author: string; message: string; code?: string; id: string }[]>;
  /** A cell's value in the store. */
  value(at: CellAt): Promise<unknown>;
  /** A cell's shown text in the store. */
  text(at: CellAt): Promise<string>;
}
