// The imported workbook: @sheetpane/export's Workbook (raw values, what export
// writes back) plus display text and the parsed tables plugins read
// (W-13 DoD 3, 4, 12; plugins verdict Consequences).
import type { Alignment, Border, BorderSide, Cell, CfRule, Cfvo, Color, ConditionalFormat, DataValidation, Dxf, Fill, Font, Sheet, SheetState } from '@sheetpane/export';

/** One cell format (`<xf>` of `cellXfs`); a cell's `s` indexes these. */
export interface CellXf { numFmtId: number; fontId: number; fillId: number; borderId: number; alignment?: Alignment; applyNumberFormat?: boolean; applyFont?: boolean; applyFill?: boolean; applyBorder?: boolean; applyAlignment?: boolean }

/** `xl/styles.xml`, parsed. */
export interface StyleTables {
  numFmts: Record<number, string>;
  cellXfs: CellXf[];
  fonts: Font[];
  fills: Fill[];
  borders: Border[];
  dxfs: Dxf[];
  /** `<indexedColors>` when the file overrides the default palette. */
  indexedColors?: string[];
}

/**
 * One run of a rich-text string (`<r>` of a shared or inline string, W-53): its text and the formatting its
 * `<rPr>` names. A run with no `<rPr>` carries `text` alone and takes the cell's own font. The font's family
 * (`<rFont>`) is never read — the host's font is the font (SR-LAW-5).
 */
export interface TextRun {
  /** The run's text, SpreadsheetML escapes decoded. */
  text: string;
  b?: boolean;
  i?: boolean;
  /** The underline: `single`, `double`, `singleAccounting`, `doubleAccounting`. */
  u?: string;
  strike?: boolean;
  color?: Color;
  /** Size in points. */
  sz?: number;
  /** `superscript`, `subscript` or `baseline`. */
  vertAlign?: string;
}

/** One position in a drawing: column / row, zero-based, plus an offset in EMU. */
export interface AnchorPoint { col: number; colOff: number; row: number; rowOff: number }
/** A picture, chart or shape anchored on a worksheet's drawing. */
export interface DrawingAnchor {
  kind: 'picture' | 'chart' | 'shape';
  anchor: 'twoCell' | 'oneCell' | 'absolute';
  from?: AnchorPoint;
  to?: AnchorPoint;
  /** Size in EMU (oneCell, absolute). */
  ext?: { cx: number; cy: number };
  /** Position in EMU from the sheet origin (absolute). */
  pos?: { x: number; y: number };
  name: string;
  descr: string;
  /** Package path of the picture, e.g. `xl/media/image1.png`. */
  media?: string;
  /** Package path of the chart part, e.g. `xl/charts/chart1.xml`. */
  chart?: string;
}

/** A legacy note (`<comment>`) on a cell. */
export interface Note { ref: string; author: string; text: string }
/** One threaded comment or reply on a cell. */
export interface ThreadedComment { id: string; ref: string; personId: string; parentId?: string; date?: string; done: boolean; text: string }
/** An author of threaded comments. */
export interface Person { id: string; displayName: string; userId?: string; providerId?: string }
/** A pivot table on a worksheet: its name and where it sits. */
export interface PivotTable { name: string; ref: string }

/** One row's or column's place in an outline: its group level and whether its group is collapsed. */
export interface OutlineEntry {
  /** The `outlineLevel`, 1–7; 0 only when the entry exists for `collapsed` alone. */
  level: number;
  /** `collapsed="1"`: set on the summary row or column of a collapsed group. */
  collapsed?: boolean;
}

/** A sheet's outline settings: `sheetFormatPr outlineLevelRow/Col` and `sheetPr/outlinePr`. */
export interface OutlineSettings {
  /** The deepest row level (`outlineLevelRow`; the deepest row read when the file omits it); 0 when none. */
  levelRow: number;
  /** The deepest column level (`outlineLevelCol`; the deepest column read when the file omits it); 0 when none. */
  levelCol: number;
  /** Summary rows sit below their detail (`summaryBelow`, default `true`). */
  summaryBelow: boolean;
  /** Summary columns sit right of their detail (`summaryRight`, default `true`). */
  summaryRight: boolean;
}

/** One imported sheet: `@sheetpane/export`'s `Sheet` plus display text and what the plugins read. */
export interface ImportedSheet extends Sheet {
  /** Display text per cell — what the grid shows (number-format subset applied). Same shape as `rows`. */
  text: string[][];
  /** The part this sheet came from (`xl/worksheets/sheet1.xml`); `''` for CSV. */
  path: string;
  /** Each styled cell's `s` (index into `cellXfs`), sparse: `{ B2: 3 }`. */
  styleIndex: Record<string, number>;
  /**
   * Rich-text cells' runs, sparse: `{ B4: [{ text: 'Net ' }, { text: 'of tax', i: true, sz: 11 }] }` (W-53). Only a
   * string of two or more runs, or of one run that carries formatting, is listed; phonetic runs are left out. The
   * runs' text joined is the cell's value. Cells sharing a string share one array. `{}` for CSV.
   */
  runs: Record<string, TextRun[]>;
  /** Each formula cell's formula text, without the `=`, shared formulas expanded: `{ D2: 'B2*C2' }`. */
  formulas: Record<string, string>;
  /** Frozen rows and columns from `<sheetView><pane state="frozen">`; `{0,0}` when none. */
  freeze: { rows: number; cols: number };
  /** Whether the sheet shows in the tab bar: `<sheet state>`; always `visible` for CSV. */
  state: SheetState;
  /**
   * `true` when `state` is `hidden` or `veryHidden`.
   *
   * @deprecated Use `state`, which tells `hidden` from `veryHidden`. Kept, in sync with `state`, for one minor release.
   */
  hidden: boolean;
  /** Hidden rows, 0-based and sorted: `<row hidden="1">` and zero-height rows (`ht="0"`), filtered rows included. */
  hiddenRows: number[];
  /** Hidden columns, 0-based and sorted: every column of a `<col hidden="1">` or `width="0"` span. */
  hiddenCols: number[];
  /** Each row's outline (group) level, sparse, index 0 = row 1; only rows with a level or `collapsed` are set. */
  rowOutline: (OutlineEntry | undefined)[];
  /** Each column's outline (group) level, sparse, index 0 = column A; `<col>` spans are expanded per column. */
  colOutline: (OutlineEntry | undefined)[];
  /** The sheet's outline settings: deepest levels and where the summary rows and columns sit. */
  outline: OutlineSettings;
  /** The `<autoFilter ref>` range, e.g. `A1:F200`; a hidden row inside it is a filtered row. Absent when the sheet has no filter. */
  autoFilter?: string;
  /** Row heights in points, sparse, index 0 = row 1. */
  rowHeights: (number | undefined)[];
  defaultRowHeight: number;
  /** Excel character units; `undefined` when the file names none. */
  defaultColWidth: number | undefined;
  dataValidations: DataValidation[];
  conditionalFormats: ConditionalFormat[];
  drawings: DrawingAnchor[];
  notes: Note[];
  threadedComments: ThreadedComment[];
  pivotTables: PivotTable[];
}

/** What `read`, `fromXlsx` and `fromCsv` return: the sheets plus the workbook-wide tables. */
export interface ImportedWorkbook {
  sheets: ImportedSheet[];
  source: 'xlsx' | 'csv';
  /** Index of the sheet the file opens on. */
  activeSheet: number;
  date1904: boolean;
  styles: StyleTables;
  /** Theme colours by SpreadsheetML theme index (0 lt1, 1 dk1, 2 lt2, 3 dk2, 4–9 accents, 10 hlink, 11 folHlink), `RRGGBB`. */
  themeColors: string[];
  persons: Person[];
  definedNames: { name: string; formula: string; localSheetId?: number }[];
  /** The CSV delimiter that was detected; undefined for `.xlsx`. */
  delimiter?: ',' | ';' | '\t';
  /** The SHA-256 of the bytes `read()` was given, 64 lowercase hex digits (W-65). Absent from `fromXlsx` / `fromCsv`, and where Web Crypto is missing (SP-1009). */
  sha256?: string;
  /** Reads any part of the package (media, chart XML) without re-walking the ZIP. Resolves undefined for CSV. */
  part(path: string): Promise<Uint8Array | undefined>;
}

// The rule and format shapes are @sheetpane/export's, so what is read is what is written (W-57).
export type { Alignment, Border, BorderSide, Cell, CfRule, Cfvo, Color, ConditionalFormat, DataValidation, Dxf, Fill, Font, SheetState };
