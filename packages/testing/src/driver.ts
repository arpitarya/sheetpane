// The one API both drivers implement (W-41 DoD 2, 3).
import type { Values } from './read.js';

export interface FlagDraft { type?: string; expected?: string; message?: string; severity?: 'error' | 'warning' | 'note' }
export interface Download { name: string; bytes: Uint8Array }
/** A cell by A1 ref (`B3`, `Sheet1!B3`) or by column title and row number (1-based, as Excel shows it). */
export type CellAt = string | { column: string; row: number; sheet?: string };

export interface SheetpaneDriver {
  /** Resolves once the sheet has read its file (`sheetpane-load` ready), and its rule checks have finished. */
  waitForLoad(): Promise<void>;
  /** The A1 ref (with its sheet) a cell spec names, e.g. `{ column: 'Units', row: 4 }` → `Holdings!F4`. */
  ref(at: CellAt): Promise<string>;
  select(at: CellAt): Promise<void>;
  edit(at: CellAt, value: string): Promise<void>;
  /** Pastes tab-separated rows from `at`, as Ctrl/⌘+V would. */
  paste(at: CellAt, rows: string[][]): Promise<void>;
  /** Flag issue on a cell and fill the form (in `<sheetpane-errors>` when one is connected, else inline). */
  flag(at: CellAt, draft?: FlagDraft): Promise<void>;
  /** Resolves the error on a cell (`ref`) or the n-th row of the error list (0-based). */
  resolve(which: CellAt | number): Promise<void>;
  undo(): Promise<void>;
  switchSheet(name: string): Promise<void>;
  /** Presses Download and returns the file. */
  download(): Promise<Download>;
  /** Presses Download and reads the file back as values. */
  readDownload(): Promise<Values>;
  /** The pane's errors, as `getErrors()` returns them. */
  errors(): Promise<{ sheet: string; range: string; type: string; severity: string; status: string; author: string; message: string; code?: string; id: string }[]>;
  /** A cell's value and shown text in the store. */
  value(at: CellAt): Promise<unknown>;
  text(at: CellAt): Promise<string>;
}
