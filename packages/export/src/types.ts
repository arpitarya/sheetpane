// The one shape for both directions (export verdict, decisions 1–6).

/** A cell's stored value. Text, a number, a boolean, or empty. */
export type Cell = string | number | boolean | null;

export interface Sheet {
  /** 1–31 characters, none of `[ ] : * ? / \`, unique ignoring case. */
  name: string;
  /** Row-major: `rows[0][0]` is A1. Ragged rows are allowed. */
  rows: Cell[][];
  /** A1-style ranges, e.g. `['A1:J1']`. The top-left cell is centred (merge-and-centre). */
  merges?: string[];
  /** Column widths in Excel's character units (`<col width>`), index 0 = column A. */
  columnWidths?: number[];
  hidden?: boolean;
  /** Frozen rows and columns (top-left), written as `<pane state="frozen">`. */
  freeze?: { rows: number; cols: number };
}

export interface Workbook {
  sheets: Sheet[];
}

/** One cell's new value, for `patchXlsx`. */
export interface Change {
  sheet: string;
  ref: string;
  value: Cell;
}
