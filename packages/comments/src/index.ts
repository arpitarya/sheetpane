// @sheetpane/comments — Excel's comments and sheetpane's errors, both ways
// (W-22). On load (`validate`): the file's notes and threaded comments become
// read-only `file` notes in <sheetpane-errors>. On export (`exportPatch`):
// every other error is written as an Excel threaded comment at its cell, with
// the legacy comment and VML parts older Excel needs. Headless; no runtime
// dependency; `@sheetpane/grid` is a peer.
import { BUILTIN_TYPE_NAMES, DEFAULT_ERROR_TYPES, registerPlugin, type Plugin, type PluginContext, type SheetpaneError } from '@sheetpane/grid';
import { errorGuids } from './guid.js';
import { readComments } from './read.js';
import { writeReview, type WriteReport } from './write.js';

/** Options for {@link comments}. */
export interface CommentsOptions {
  /** Write the review into the file on export. Default `true`; `export({ comments: false })` skips one export. */
  write?: boolean;
}

/** What one export wrote (`written`: error ids) and skipped, with the reason (`note-at-cell`, `no-cell` with SP-5804, `no-sheet`, `bad-range`, `unreadable-part`). */
export type CommentsReport = WriteReport;

/** The comments plugin, plus the report of its most recent export. */
export interface CommentsPlugin extends Plugin {
  /** What the most recent export wrote and skipped; undefined until one runs (or when it wrote nothing). */
  readonly lastExport: CommentsReport | undefined;
}

/** Names for the types the core and the plugins write; the host's own `errorTypes` live on the element, not the store. */
const typeName = (id: string) => DEFAULT_ERROR_TYPES.find((t) => t.id === id)?.name ?? BUILTIN_TYPE_NAMES[id] ?? id;

/** The review in the store this plugin writes: every error not read from the file. */
const reviewOf = (ctx: PluginContext): SheetpaneError[] => ctx.snapshot().errors.filter((e) => e.author !== 'file');

/**
 * The comments plugin, both ways. On load (`validate`), the file's notes and threaded comments become read-only
 * `file` notes in the error pane. On export (`exportPatch`), every other error is written as an Excel threaded
 * comment at the top-left cell of its range — with the legacy comment and VML parts older Excel needs — extending
 * existing parts, never replacing them. A cell holding someone's note is left alone, and an error about a whole sheet
 * or the workbook (no cell, W-55) is not written; both are reported in `lastExport`.
 * String XML only, so it runs in Node. Importing this module registers it as `comments`.
 *
 * @param options - `write: false` never writes the review; `export({ comments: false })` skips one export.
 * @returns The plugin (`id: 'comments'`) with `lastExport`.
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0112_COMMENTS.md
 * @example
 * ```ts
 * import { createWorkbook } from '@sheetpane/grid';
 * import { comments } from '@sheetpane/comments';
 *
 * const plugin = comments();
 * const book = createWorkbook({ plugins: [plugin] });
 * await book.load(bytes, 'review.xlsx');
 * ```
 * @example
 * ```ts
 * import '@sheetpane/comments'; // registers `comments`
 * excel.setAttribute('plugins', 'comments');
 * const withReview = await excel.export();
 * const withoutReview = await excel.export({ comments: false }); // this export only
 * ```
 */
export function comments(options: CommentsOptions = {}): CommentsPlugin {
  let last: CommentsReport | undefined;
  return {
    id: 'comments',
    provides: ['validate', 'exportPatch'],
    // the Download menu's switch for this export (W-34): `export({ comments: false })` skips the parts
    exportOptions: options.write === false ? [] : [{ key: 'comments', label: 'Write review as Excel comments', default: true }],
    get lastExport() { return last; },
    validate(sheet, ctx) {
      const ours = new Set(reviewOf(ctx).flatMap((e) => Object.values(errorGuids(e))));
      return readComments(sheet, ctx, ours);
    },
    async exportPatch(patch, ctx) {
      last = undefined;
      if (options.write === false || ctx.exportOptions?.comments === false) return;
      const review = reviewOf(ctx);
      if (!review.length) return;
      last = await writeReview(patch, review, { typeName });
    },
  };
}

registerPlugin('comments', () => comments());

export { errorGuids, personGuid, uuidv5 } from './guid.js';
export { PLACEHOLDER, DEFAULT_AUTHOR } from './write.js';
