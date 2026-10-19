// @sheetpane/tables (W-61) — a workbook's Excel tables, drawn: each table's header row, banded rows and
// columns, first and last column and totals row, from its built-in table style, through the `decorate`
// hook. Reading the tables is @sheetpane/import's (`ImportedSheet.tables`); resolving `Units[Name]` is
// @sheetpane/export's `resolveStructuredRef`. Draw-only: no control, no change, nothing exported.
// Spec: records/0122_TABLES.md (SR-TABLES).
import { registerPlugin, type CellContext, type Plugin, type StyleSubset } from '@sheetpane/grid';
import { parseRange, type RangePos } from '@sheetpane/export';
import { paletteOf, type TablePalette } from './styles.js';

export { TABLE_STYLES, DEFAULT_THEME, paletteOf, tint, type TablePalette } from './styles.js';

/** The plugin's id, and the name `plugins="…"` takes. */
export const PLUGIN_ID = 'tables';

/** A sheet, as a hook sees it. */
export type Sheet = CellContext['sheet'];
/** The workbook, as a hook sees it. */
export type Book = CellContext['book'];
/** One Excel table: `@sheetpane/import`'s `Table`. */
export type Table = Sheet['tables'][number];

interface Placed { table: Table; box: RangePos }
const placed = new WeakMap<Sheet, Placed[]>();

function placedOf(sheet: Sheet): Placed[] {
  let list = placed.get(sheet);
  if (!list) {
    list = [];
    for (const table of sheet.tables ?? []) { const box = parseRange(table.ref); if (box) list.push({ table, box }); }
    placed.set(sheet, list);
  }
  return list;
}

/**
 * The table a cell sits in, if any.
 *
 * @param sheet - The sheet.
 * @param row - The cell's row, 0-based.
 * @param col - The cell's column, 0-based.
 * @returns The table, or `undefined`.
 */
export function tableAt(sheet: Sheet, row: number, col: number): Table | undefined {
  return placedOf(sheet).find(({ box }) => row >= box.top && row <= box.bottom && col >= box.left && col <= box.right)?.table;
}

/**
 * A table by its name — the name formulas use — case-insensitive, and the sheet it sits on.
 *
 * @param book - The workbook.
 * @param name - The table's name, e.g. `Units`.
 * @returns The table and its sheet's name, or `undefined`.
 */
export function findTable(book: Book, name: string): { sheet: string; table: Table } | undefined {
  const want = name.toLowerCase();
  for (const s of book.sheets) {
    const table = (s.tables ?? []).find((t) => t.name.toLowerCase() === want);
    if (table) return { sheet: s.name, table };
  }
  return undefined;
}

/**
 * One cell's look inside a table: the header row bold (filled, for a Medium style), banded rows and columns
 * filled, the first and last columns bold, the totals row bold under a double line, the style's lines. A
 * style outside {@link TABLE_STYLES} draws a bold header row only; a table that names no style draws nothing,
 * as Excel's *None*. A filled cell is given the theme's dark text colour, so it reads in a dark host too.
 *
 * @param table - The table.
 * @param row - The cell's row, 0-based.
 * @param col - The cell's column, 0-based.
 * @param theme - The workbook's theme colours (`RRGGBB` by SpreadsheetML index); Office's when empty.
 * @returns The CSS, or `undefined` when the cell is outside the table or nothing is drawn there.
 */
export function tableCss(table: Table, row: number, col: number, theme: readonly string[] = []): StyleSubset | undefined {
  const box = parseRange(table.ref);
  if (!box || row < box.top || row > box.bottom || col < box.left || col > box.right) return undefined;
  const h = Math.max(0, table.headerRowCount), t = Math.max(0, table.totalsRowCount);
  const header = row < box.top + h, totals = row > box.bottom - t;
  const style = table.style;
  if (!style.name) return undefined;
  const p = paletteOf(style.name, theme);
  if (!p) return header ? { 'font-weight': '700' } : undefined;
  const css: StyleSubset = {};
  const bold = header || totals || (style.showFirstColumn && col === box.left) || (style.showLastColumn && col === box.right);
  if (bold) css['font-weight'] = '700';
  draw(css, p, { header, totals, top: row === box.top, bottom: row === box.bottom });
  if (!header && !totals) {
    const r = row - box.top - h, c = col - box.left;
    if ((style.showRowStripes && r % 2 === 0) || (style.showColumnStripes && c % 2 === 0)) css['background-color'] = p.stripe;
  }
  if (css['background-color'] && !css.color) css.color = p.ink;
  return Object.keys(css).length ? css : undefined;
}

/** The lines and the header fill: Light — a line over and under the table and under the header; Medium — the header filled, a line under every row. */
function draw(css: StyleSubset, p: TablePalette, at: { header: boolean; totals: boolean; top: boolean; bottom: boolean }): void {
  if (p.kind === 'light') {
    if (at.top) css['border-top'] = `1px solid ${p.accent}`;
    if (at.bottom || at.header) css['border-bottom'] = `1px solid ${p.accent}`;
  } else {
    if (at.top) css['border-top'] = `1px solid ${p.line}`;
    css['border-bottom'] = `1px solid ${p.line}`;
    if (at.header) { css['background-color'] = p.accent; css.color = p.onAccent; }
  }
  if (at.totals) css['border-top'] = `3px double ${p.accent}`;
}

/**
 * The tables plugin: each Excel table in the workbook drawn as its style draws it — header row, banded rows
 * and columns, first and last column, totals row — through the `decorate` hook. A cell's own format
 * (`@sheetpane/styles`) and conditional formats (`@sheetpane/condfmt`) draw over it, as in Excel. Importing
 * this module registers it as `tables`.
 *
 * @returns The plugin (`id: 'tables'`).
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0122_TABLES.md
 * @example
 * ```ts
 * import { createWorkbook } from '@sheetpane/grid';
 * import { tables } from '@sheetpane/tables';
 *
 * excel.workbook = createWorkbook({ plugins: [tables()] });
 * ```
 * @example
 * ```ts
 * import '@sheetpane/tables'; // registers `tables`
 * excel.setAttribute('plugins', 'tables styles');
 * ```
 */
export function tables(): Plugin {
  return {
    id: PLUGIN_ID,
    provides: ['decorate'],
    decorate(cell: CellContext): StyleSubset | undefined {
      const table = tableAt(cell.sheet, cell.row, cell.col);
      return table && tableCss(table, cell.row, cell.col, cell.book.themeColors);
    },
  };
}

registerPlugin(PLUGIN_ID, () => tables());
