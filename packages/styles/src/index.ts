// @sheetpane/styles — cell styles for sheetpane, as a plugin (W-17).
// `decorate` draws each cell the way the workbook formats it — fill, weight,
// style, size, colour, decoration, borders, alignment, wrap — plus the user's
// own `style` changes; `exportPatch` writes those changes into styles.xml.
// Never a font family (SR-LAW-5): the host's font is the font.
// Headless: this entry never imports ./ui.js. Importing it in Node is safe.
import { registerPlugin, type CellContext, type Plugin, type StyleSubset } from '@sheetpane/grid';
import { paletteOf, resolveColor } from './color.js';
import { allowListed, AUTO_INK } from './css.js';
import { applyLook, cachedXfCss, fileLook, patchCss, patchOf } from './model.js';
import { writeStyles } from './xml.js';

export interface StylesOptions {
  /**
   * Draw the formats the file carries (default `true`). `false` draws only the
   * reviewer's own style changes — the grid otherwise looks as it does without
   * the plugin.
   */
  fileStyles?: boolean;
}

/** The headless plugin: `decorate` and `exportPatch`. Add `ui()` from `@sheetpane/styles/ui` for the format row. */
export function styles(o: StylesOptions = {}): Plugin {
  const fileStyles = o.fileStyles ?? true;
  return {
    id: 'styles',
    provides: ['decorate', 'exportPatch'],
    decorate: (cell) => decorateCell(cell, fileStyles),
    exportPatch: (patch, ctx) => writeStyles(patch, ctx),
  };
}

/** One cell's CSS: the file's format, then the user's change; allow-listed. */
export function decorateCell(cell: CellContext, fileStyles = true): StyleSubset | undefined {
  const book = cell.book;
  const patch = patchOf(cell.store, cell.sheet.name, cell.ref);
  if (!patch && (!fileStyles || cell.styleIndex === undefined)) return undefined;
  const palette = paletteOf(book);
  const s = fileStyles ? cell.styleIndex : undefined;
  const fileCss = cachedXfCss(book, s, palette);
  let css: StyleSubset = fileCss;
  if (patch) css = patchCss(fileCss, patch, applyLook(fileLook(book, s, palette), patch));
  // A filled cell whose text colour is automatic is drawn in the workbook's
  // default ink, not the host's (a light host ink on a light fill is unreadable).
  if (css['background-color'] && !css.color) {
    css = { ...css, color: resolveColor(book.styles.fonts[0]?.color, palette) ?? AUTO_INK };
  }
  const out = allowListed(css);
  return Object.keys(out).length ? out : undefined;
}

export { resolveColor, applyTint, mix, paletteOf, DEFAULT_THEME, DEFAULT_INDEXED, type Palette, type XlColor } from './color.js';
export { ALLOWED_PROPS, allowListed, fontCss, fillCss, borderCss, sideCss, alignmentCss, xfCss, dxfCss, decoration, BORDER_CSS, BORDER_STYLES, AUTO_INK, CELL_EM, DEFAULT_SZ, type AllowedProp } from './css.js';
export { STYLE_PREFIX, styleRef, patchOf, styleChanges, fileLook, applyLook, normalize, combine, restyle, lookAt, setChanges, PLAIN, type StylePatch, type BorderEdge, type Look, type ChangeSpec } from './model.js';
export { writeStyles, restyleSheetXml, StyleSheet, MINIMAL_STYLES } from './xml.js';

registerPlugin('styles', () => styles());
