// The imported workbook: @sheetpane/export's Workbook (raw values, what export
// writes back) plus display text and the parsed tables plugins read
// (W-13 DoD 3, 4, 12; plugins verdict Consequences).
import type { Alignment, Border, BorderSide, Cell, CfRule, Cfvo, Color, ConditionalFormat, DataValidation, Dxf, Fill, Font, Sheet, SheetState } from '@sheetpane/export';

/**
 * A cell format's `<protection>` (W-62): what it does once its sheet is protected. Excel's default, when an `<xf>`
 * has no `<protection>`, is `{ locked: true, hidden: false }` — every cell is locked until someone unlocks it.
 */
export interface CellProtection {
  /** `locked` (default `true`): a protected sheet refuses edits to the cell. */
  locked: boolean;
  /** `hidden` (default `false`): a protected sheet shows the cell's value, never its formula. */
  hidden: boolean;
}

/** One cell format (`<xf>` of `cellXfs`); a cell's `s` indexes these. */
export interface CellXf {
  numFmtId: number; fontId: number; fillId: number; borderId: number; alignment?: Alignment;
  /** The `<protection>` child (W-62); absent when the format has none, which means locked and not hidden. */
  protection?: CellProtection;
  applyNumberFormat?: boolean; applyFont?: boolean; applyFill?: boolean; applyBorder?: boolean; applyAlignment?: boolean; applyProtection?: boolean;
}

/**
 * A protected sheet's `<sheetProtection>` (W-62), present only while `sheet="1"`. Each switch is as the file stores
 * it: **`true` means the action is refused while the sheet is protected**, `false` that the file allows it. The
 * defaults are the schema's: `objects`, `scenarios`, `selectLockedCells` and `selectUnlockedCells` `false`, every
 * other switch `true`. The password is never read — only whether one is stored (sheetpane never checks or removes it).
 */
export interface SheetProtection {
  objects: boolean;
  scenarios: boolean;
  formatCells: boolean;
  formatColumns: boolean;
  formatRows: boolean;
  insertColumns: boolean;
  insertRows: boolean;
  insertHyperlinks: boolean;
  deleteColumns: boolean;
  deleteRows: boolean;
  selectLockedCells: boolean;
  selectUnlockedCells: boolean;
  sort: boolean;
  autoFilter: boolean;
  pivotTables: boolean;
  /** Whether the file stores a password hash (`password` or `hashValue`) — never the hash itself. */
  hasPassword: boolean;
}

/**
 * The workbook's `<workbookProtection>` (W-62), present when the file has one. `lockStructure`: sheets may not be
 * added, removed, renamed, moved, hidden or unhidden; `lockWindows`: the window layout is fixed. The password is
 * never read — only whether one is stored.
 */
export interface WorkbookProtection {
  lockStructure: boolean;
  lockWindows: boolean;
  /** Whether the file stores a password hash (`workbookPassword` or `workbookHashValue`) — never the hash itself. */
  hasPassword: boolean;
}

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
/** A pivot table on a worksheet: its name, where it sits and, when its cache reads a worksheet range, that source. */
export interface PivotTable {
  name: string;
  ref: string;
  /** The cache's `worksheetSource` (W-52): the sheet and range it summarises; absent for a named or table source. */
  source?: { sheet: string; ref: string };
}

/** One column of an Excel table (`<tableColumn>`): its header text and its totals-row entry. */
export interface TableColumn {
  /** The column's name — its header text, and the name a structured reference uses (`Units[Name]`). */
  name: string;
  /** The totals row's function (`sum`, `count`, `average`, `custom` …); absent when the column has none. */
  totalsRowFunction?: string;
  /** The totals row's text label (`Total`); absent when the column has none. */
  totalsRowLabel?: string;
}

/** How a table is drawn: `<tableStyleInfo>`. */
export interface TableStyleInfo {
  /** The style's name, e.g. `TableStyleMedium2`; absent when the table names none (Excel then draws it plain). */
  name?: string;
  /** Bold first column (`showFirstColumn`). */
  showFirstColumn: boolean;
  /** Bold last column (`showLastColumn`). */
  showLastColumn: boolean;
  /** Banded rows (`showRowStripes`). */
  showRowStripes: boolean;
  /** Banded columns (`showColumnStripes`). */
  showColumnStripes: boolean;
}

/** An Excel table (a ListObject): its own part, `xl/tables/tableN.xml`, linked from the sheet's `<tableParts>`. */
export interface Table {
  /** The name formulas use — `displayName` (the `name` attribute when it is absent), e.g. `Units`. */
  name: string;
  /** The table's `id`, unique in the workbook. */
  id: number;
  /** The whole table, header and totals rows included, e.g. `A1:C10`. */
  ref: string;
  /** Header rows: 1, or 0 when the header row is turned off (`headerRowCount`, default 1). */
  headerRowCount: number;
  /** Totals rows: 0, or 1 when the totals row is on (`totalsRowCount`, default 0). */
  totalsRowCount: number;
  /** The columns, left to right. */
  columns: TableColumn[];
  /** The style and its four switches. */
  style: TableStyleInfo;
  /** The table's own `<autoFilter ref>`; absent when its filter buttons are off. */
  autoFilter?: string;
  /** The part this table came from, e.g. `xl/tables/table1.xml`. */
  path: string;
}

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
  /** The sheet's Excel tables, in `<tableParts>` order (W-61); `[]` for CSV. */
  tables: Table[];
  /**
   * Each row's own format (`<row s customFormat="1">`), sparse, index 0 = row 1 (W-62): the format an empty cell of
   * the row takes. `[]` for CSV.
   */
  rowStyles: (number | undefined)[];
  /** Each column's own format (`<col style>`), sparse, index 0 = column A, spans expanded (W-62). `[]` for CSV. */
  colStyles: (number | undefined)[];
  /** The sheet's protection (`<sheetProtection sheet="1">`, W-62); absent when the sheet is not protected, and for CSV. */
  protection?: SheetProtection;
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
  /** The workbook's protection (`<workbookProtection>`, W-62); absent when the file has none, and for CSV. */
  workbookProtection?: WorkbookProtection;
  /** Reads any part of the package (media, chart XML) without re-walking the ZIP. Resolves undefined for CSV. */
  part(path: string): Promise<Uint8Array | undefined>;
}

// The rule and format shapes are @sheetpane/export's, so what is read is what is written (W-57).
export type { Alignment, Border, BorderSide, Cell, CfRule, Cfvo, Color, ConditionalFormat, DataValidation, Dxf, Fill, Font, SheetState };
