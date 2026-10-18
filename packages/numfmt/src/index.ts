// @sheetpane/numfmt — Excel number formats for sheetpane: a plugin on the
// `format` hook (and `exportPatch`, `decorate`). Importing this module
// registers it as `numfmt`; nothing here touches the DOM at import time, so
// Node can import it. The controls are in ./ui, which this file never imports.
// Spec: work/open/W-15-numfmt.md.
import { registerPlugin } from '@sheetpane/grid';
import type { CellContext, Plugin, StyleSubset } from '@sheetpane/grid';
import type { ImportedWorkbook } from '@sheetpane/import';
import { codeOfId, documentLocale, formatValue, type FormatEnv } from './fmt.js';
import { applyFormatEdits, type FormatEdit } from './patch.js';

export { formatValue, codeOfId, builtinCode, builtinIdOf, categoryOf, presetCode, adjustDecimals, resolveLocale, CATEGORIES, type Category, type FormatEnv } from './fmt.js';

export interface NumfmtOptions {
  /** A BCP 47 tag (`de-DE`, `en-IN`). Default: the page's `<html lang>`, read when a cell is formatted. */
  locale?: string;
}

/** The plugin, plus what it cannot say through the plugin contract. */
export interface NumfmtPlugin extends Plugin {
  /** `Sheet!A1` of every cell whose format the library rejected, so the core subset's text was shown instead (W-15 DoD 3). */
  fallbacks(book?: ImportedWorkbook): string[];
}

/** The code a cell shows with: the user's `numFmt` change, else the style's `numFmtId`. */
export function cellCode(c: CellContext, locale: string): string {
  const ch = c.store.changeOf(c.sheet.name, c.ref, 'numFmt');
  if (ch?.kind === 'numFmt' && typeof ch.now === 'string') return ch.now;
  return originalCode(c.book, c.styleIndex, locale);
}

/** The code the upload gave a cell: `numFmtId` of its xf (a cell with no `s` has xf 0). */
export function originalCode(book: ImportedWorkbook, styleIndex: number | undefined, locale: string): string {
  const xf = book.styles.cellXfs[styleIndex ?? 0];
  return xf ? codeOfId(xf.numFmtId, book.styles.numFmts, locale) : 'General';
}

const PADDED = /[_*?]/;

export function numfmt(options: NumfmtOptions = {}): NumfmtPlugin {
  const locale = () => options.locale ?? documentLocale();
  const failed = new WeakMap<ImportedWorkbook, Set<string>>();
  let lastBook: ImportedWorkbook | undefined;

  return {
    id: 'numfmt',
    provides: ['format', 'decorate', 'exportPatch'],

    format(c) {
      const v = c.value;
      if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
      const loc = locale();
      const code = cellCode(c, loc);
      const env: FormatEnv = { locale: loc, date1904: c.book.date1904 };
      try {
        return formatValue(code, v, env);
      } catch {
        // The library rejects the code: say nothing, so the core subset shows its text — and count it.
        let set = failed.get(c.book);
        if (!set) failed.set(c.book, (set = new Set()));
        set.add(`${c.sheet.name}!${c.ref}`);
        lastBook = c.book;
        return undefined;
      }
    },

    // Accounting and `?` formats pad with spaces that HTML collapses (W-15 hazard 2).
    decorate(c): StyleSubset | undefined {
      if (typeof c.value !== 'number') return undefined;
      return PADDED.test(cellCode(c, locale())) ? { 'white-space': 'pre' } : undefined;
    },

    fallbacks(book) {
      const b = book ?? lastBook;
      return b ? [...(failed.get(b) ?? [])] : [];
    },

    async exportPatch(patch, ctx) {
      const edits: FormatEdit[] = [];
      for (const [k, ch] of ctx.store.getSnapshot().changes) {
        if (ch.kind !== 'numFmt' || typeof ch.now !== 'string') continue;
        const bang = k.lastIndexOf('!');
        const sheet = k.slice(0, bang), slot = k.slice(bang + 1);
        if (!slot.startsWith('#numFmt:')) continue;
        const ref = slot.slice('#numFmt:'.length);
        const s = ctx.book.sheets.find((x) => x.name === sheet);
        if (!s) continue;
        edits.push({ sheet, ref, was: s.styleIndex[ref] ?? 0, code: ch.now });
      }
      await applyFormatEdits(patch, edits);
    },
  };
}

registerPlugin('numfmt', () => numfmt());
