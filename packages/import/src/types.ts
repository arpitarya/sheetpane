// The imported workbook: @sheetpane/export's Workbook (raw values, what export
// writes back) plus display text and the parsed tables plugins read
// (W-13 DoD 3, 4, 12; plugins verdict Consequences).
import type { Cell, Sheet, SheetState } from '@sheetpane/export';

/** A colour as SpreadsheetML stores it. */
export interface Color { rgb?: string; theme?: number; tint?: number; indexed?: number; auto?: boolean }

/** One `<font>` of `xl/styles.xml`. */
export interface Font { b?: boolean; i?: boolean; u?: string; strike?: boolean; sz?: number; color?: Color; name?: string; vertAlign?: string }
/** One `<fill>` of `xl/styles.xml`: a pattern or a gradient. */
export interface Fill { patternType?: string; fgColor?: Color; bgColor?: Color; gradient?: { type?: string; degree?: number; stops: { position: number; color: Color }[] } }
/** One side of a border: its line style and colour. */
export interface BorderSide { style?: string; color?: Color }
/** One `<border>` of `xl/styles.xml`. */
export interface Border { left?: BorderSide; right?: BorderSide; top?: BorderSide; bottom?: BorderSide; diagonal?: BorderSide }
/** A cell format's `<alignment>`. */
export interface Alignment { horizontal?: string; vertical?: string; wrapText?: boolean; indent?: number; textRotation?: number; shrinkToFit?: boolean }
/** One cell format (`<xf>` of `cellXfs`); a cell's `s` indexes these. */
export interface CellXf { numFmtId: number; fontId: number; fillId: number; borderId: number; alignment?: Alignment; applyNumberFormat?: boolean; applyFont?: boolean; applyFill?: boolean; applyBorder?: boolean; applyAlignment?: boolean }
/** A differential format (`<dxf>`), used by conditional formats. */
export interface Dxf { font?: Font; fill?: Fill; border?: Border; numFmt?: { id: number; code: string }; alignment?: Alignment }

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

/** One `<dataValidation>` rule of a worksheet. */
export interface DataValidation {
  /** Ranges the rule covers, e.g. `['B2:B100', 'D2']`. */
  sqref: string[];
  type: string;
  operator?: string;
  allowBlank: boolean;
  showErrorMessage: boolean;
  /** OOXML's inverted flag: `true` means Excel HIDES the in-cell list arrow. */
  showDropDown: boolean;
  errorStyle?: string;
  errorTitle?: string;
  error?: string;
  promptTitle?: string;
  prompt?: string;
  formula1?: string;
  formula2?: string;
}

/** A conditional-format value object: a threshold of a colour scale, data bar or icon set. */
export interface Cfvo { type: string; val?: string; gte?: boolean }
/** One `<cfRule>` of a conditional format. */
export interface CfRule {
  type: string;
  priority: number;
  stopIfTrue: boolean;
  dxfId?: number;
  operator?: string;
  text?: string;
  rank?: number;
  percent?: boolean;
  bottom?: boolean;
  aboveAverage?: boolean;
  timePeriod?: string;
  formulas: string[];
  colorScale?: { cfvo: Cfvo[]; colors: Color[] };
  dataBar?: { cfvo: Cfvo[]; color?: Color; minLength?: number; maxLength?: number };
  iconSet?: { iconSet?: string; cfvo: Cfvo[] };
}
/** One `<conditionalFormatting>`: the ranges and their rules. */
export interface ConditionalFormat { sqref: string[]; rules: CfRule[] }

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

export type { Cell, SheetState };
