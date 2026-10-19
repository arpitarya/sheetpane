// The one shape for both directions (export verdict, decisions 1–6).

/** A cell's stored value. Text, a number, a boolean, or empty. */
export type Cell = string | number | boolean | null;

/** One worksheet: its name, its rows of cells, and how it is laid out. */
export interface Sheet {
  /** 1–31 characters, none of `[ ] : * ? / \`, unique ignoring case. */
  name: string;
  /** Row-major: `rows[0][0]` is A1. Ragged rows are allowed. */
  rows: Cell[][];
  /** A1-style ranges, e.g. `['A1:J1']`. The top-left cell is centred (merge-and-centre). */
  merges?: string[];
  /** Column widths in Excel's character units (`<col width>`), index 0 = column A. */
  columnWidths?: number[];
  /** Written as `state="hidden"`; at least one sheet must stay visible. */
  hidden?: boolean;
  /** Frozen rows and columns (top-left), written as `<pane state="frozen">`. */
  freeze?: { rows: number; cols: number };
  /** Data-validation rules — dropdowns, number, date and length checks — written as `<dataValidations>` (W-57). */
  dataValidations?: DataValidation[];
  /** Conditional formats, written as `<conditionalFormatting>` blocks; a rule's `dxfId` indexes `Workbook.dxfs` (W-57). */
  conditionalFormats?: ConditionalFormat[];
}

/**
 * A sheet's visibility, as `<sheet state>` stores it. A `veryHidden` sheet is left out of
 * Excel's own Unhide list; only code can show it again.
 */
export type SheetState = 'visible' | 'hidden' | 'veryHidden';

/** The plain object both directions share: `@sheetpane/import` reads into it, the writers write from it. */
export interface Workbook {
  /** In tab order; at least one. */
  sheets: Sheet[];
  /** The differential formats conditional formats apply, by `dxfId`; written as `styles.xml`'s `<dxfs>` (W-57). */
  dxfs?: Dxf[];
}

/** One cell's new value, for `patchXlsx`. */
export interface Change {
  /** The sheet's name. */
  sheet: string;
  /** An A1 reference, e.g. `B3`. */
  ref: string;
  value: Cell;
}

// ── Data validation, conditional formats and the formats they apply (W-57) ──
// One shape for both directions: `@sheetpane/import` reads these, the writers write them.

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
/** A differential format (`<dxf>`), used by conditional formats. In a `dxf`, a solid fill's colour is `bgColor`. */
export interface Dxf { font?: Font; fill?: Fill; border?: Border; numFmt?: { id: number; code: string }; alignment?: Alignment }

/** One `<dataValidation>` rule of a worksheet. */
export interface DataValidation {
  /** Ranges the rule covers, e.g. `['B2:B100', 'D2']`. */
  sqref: string[];
  /** `none`, `whole`, `decimal`, `list`, `date`, `time`, `textLength` or `custom`. */
  type: string;
  /** `between` (the default), `notBetween`, `equal`, `notEqual`, `lessThan`, `lessThanOrEqual`, `greaterThan`, `greaterThanOrEqual`. */
  operator?: string;
  allowBlank: boolean;
  showErrorMessage: boolean;
  /** OOXML's inverted flag: `true` means Excel HIDES the in-cell list arrow. */
  showDropDown: boolean;
  /** `stop` (the default), `warning` or `information`. */
  errorStyle?: string;
  /** At most 32 characters. */
  errorTitle?: string;
  /** At most 255 characters. */
  error?: string;
  /** At most 32 characters. */
  promptTitle?: string;
  /** At most 255 characters; written with `showInputMessage="1"`. */
  prompt?: string;
  /** A formula without `=`, or a list in quotes: `"Yes,No"` (at most 255 characters) or a range: `Lists!$A$2:$A$9`. */
  formula1?: string;
  formula2?: string;
}

/** A conditional-format value object: a threshold of a colour scale, data bar or icon set. */
export interface Cfvo { type: string; val?: string; gte?: boolean }
/** One `<cfRule>` of a conditional format. */
export interface CfRule {
  /** `expression`, `cellIs`, `colorScale`, `dataBar`, `iconSet`, `top10`, `containsText`, … (ST_CfType). */
  type: string;
  priority: number;
  stopIfTrue: boolean;
  /** The format to apply: an index into the workbook's differential formats. */
  dxfId?: number;
  operator?: string;
  text?: string;
  rank?: number;
  percent?: boolean;
  bottom?: boolean;
  aboveAverage?: boolean;
  timePeriod?: string;
  /** Up to three formulas, without `=`. */
  formulas: string[];
  colorScale?: { cfvo: Cfvo[]; colors: Color[] };
  dataBar?: { cfvo: Cfvo[]; color?: Color; minLength?: number; maxLength?: number };
  iconSet?: { iconSet?: string; cfvo: Cfvo[] };
}
/** One `<conditionalFormatting>`: the ranges and their rules. */
export interface ConditionalFormat { sqref: string[]; rules: CfRule[] }
