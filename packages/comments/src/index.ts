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

export interface CommentsOptions {
  /** Write the review into the file on export. Default `true`; `export({ comments: false })` skips one export. */
  write?: boolean;
}

export type CommentsReport = WriteReport;

export interface CommentsPlugin extends Plugin {
  /** What the most recent export wrote and skipped; undefined until one runs (or when it wrote nothing). */
  readonly lastExport: CommentsReport | undefined;
}

/** Names for the types the core and the plugins write; the host's own `errorTypes` live on the element, not the store. */
const typeName = (id: string) => DEFAULT_ERROR_TYPES.find((t) => t.id === id)?.name ?? BUILTIN_TYPE_NAMES[id] ?? id;

/** The review in the store this plugin writes: every error not read from the file. */
const reviewOf = (ctx: PluginContext): SheetpaneError[] => ctx.snapshot().errors.filter((e) => e.author !== 'file');

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
