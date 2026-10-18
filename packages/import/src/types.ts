// The imported workbook: @sheetpane/export's Workbook (raw values, what export
// writes back) plus display text and the parsed tables plugins read
// (W-13 DoD 3, 4, 12; plugins verdict Consequences).
import type { Cell, Sheet } from '@sheetpane/export';

/** A colour as SpreadsheetML stores it. */
export interface Color { rgb?: string; theme?: number; tint?: number; indexed?: number; auto?: boolean }

export interface Font { b?: boolean; i?: boolean; u?: string; strike?: boolean; sz?: number; color?: Color; name?: string; vertAlign?: string }
export interface Fill { patternType?: string; fgColor?: Color; bgColor?: Color; gradient?: { type?: string; degree?: number; stops: { position: number; color: Color }[] } }
export interface BorderSide { style?: string; color?: Color }
export interface Border { left?: BorderSide; right?: BorderSide; top?: BorderSide; bottom?: BorderSide; diagonal?: BorderSide }
export interface Alignment { horizontal?: string; vertical?: string; wrapText?: boolean; indent?: number; textRotation?: number; shrinkToFit?: boolean }
export interface CellXf { numFmtId: number; fontId: number; fillId: number; borderId: number; alignment?: Alignment; applyNumberFormat?: boolean; applyFont?: boolean; applyFill?: boolean; applyBorder?: boolean; applyAlignment?: boolean }
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

export interface DataValidation {
  /** Ranges the rule covers, e.g. `['B2:B100', 'D2']`. */
  sqref: string[];
  type: string;
  operator?: string;
  allowBlank: boolean;
  showErrorMessage: boolean;
  errorStyle?: string;
  errorTitle?: string;
  error?: string;
  promptTitle?: string;
  prompt?: string;
  formula1?: string;
  formula2?: string;
}

export interface Cfvo { type: string; val?: string; gte?: boolean }
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
export interface ConditionalFormat { sqref: string[]; rules: CfRule[] }

/** One position in a drawing: column / row, zero-based, plus an offset in EMU. */
export interface AnchorPoint { col: number; colOff: number; row: number; rowOff: number }
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

export interface Note { ref: string; author: string; text: string }
export interface ThreadedComment { id: string; ref: string; personId: string; parentId?: string; date?: string; done: boolean; text: string }
export interface Person { id: string; displayName: string; userId?: string; providerId?: string }
export interface PivotTable { name: string; ref: string }

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
  hiddenRows: number[];
  hiddenCols: number[];
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
  /** Reads any part of the package (media, chart XML) without re-walking the ZIP. Resolves undefined for CSV. */
  part(path: string): Promise<Uint8Array | undefined>;
}

export type { Cell };
