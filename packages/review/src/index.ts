// @sheetpane/review — the review written into the download as a sheet of its
// own, and optionally each flagged cell filled by severity (W-59). Export-only:
// one `exportPatch` hook on the existing context, no seventh hook, no controls
// beyond the Download menu's two switches. String XML only, so it runs in Node.
// Nothing leaves the page (SR-LAW-11): the parts are written into the bytes the
// browser saves.
import { registerPlugin, spError, type Plugin } from '@sheetpane/grid';
import { DEFAULT_FILLS, argb } from './fills.js';
import { PROBLEM_SEVERITIES, selectErrors } from './rows.js';
import { writeReview, type ReviewReport } from './write.js';

/** Options for {@link review}. Each switch is the default for the Download menu's item; a host flips one per export with `export({ … })`. */
export interface ReviewOptions {
  /** Add the Review sheet. Default `true`; `export({ review: false })` leaves it out of one export. */
  sheet?: boolean;
  /** Colour each flagged cell by severity. Default `false`; `export({ reviewFills: true })` colours one export. */
  fill?: boolean;
  /** The Review sheet's name. Default `Review`; beside a sheet of that name it becomes `Review (2)`. */
  sheetName?: string;
  /**
   * The severities listed and coloured. Default the problems — `error`, `warning`, `note`; results such as `pass`
   * and `skipped` (W-50) only when listed. `export({ reviewSeverities: […] })` overrides it for one export.
   */
  severities?: readonly string[];
  /**
   * The layers listed and coloured (W-51); an error with no `layer` is `review`. Default every layer.
   * `export({ reviewLayers: […] })` overrides it for one export.
   */
  layers?: readonly string[];
  /** A fill per severity — `#RRGGBB`, `RRGGBB` or ARGB — over the defaults (`error` pale red, `warning` pale yellow, `note` pale blue); `null` colours none. */
  fills?: Readonly<Record<string, string | null>>;
}

/** What one export wrote: the sheet's name, the ids listed, the counts by status, the ids coloured and what was skipped. */
export type { ReviewReport, SkipReason } from './write.js';

/** The review plugin, plus the report of its most recent export. */
export interface ReviewPlugin extends Plugin {
  /** What the most recent export wrote and skipped; undefined until one runs (or when there was nothing to write). */
  readonly lastExport: ReviewReport | undefined;
}

const strings = (v: unknown): string[] | undefined => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : undefined);
const flag = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

/**
 * The review plugin. On export (`exportPatch`), it adds a *Review* sheet listing every error — id, sheet, cell (a link
 * to it), severity, type, found, expected, message, author, status, and for an accepted error *Accepted: <reason>*
 * with who and when — and, when asked, fills each open error's cells by severity, cloning each cell's format so its
 * own formatting stays. Whole-sheet and workbook errors are listed, never coloured. A defined name marks the sheet
 * ({@link reviewSheetOf}). An `.xlsx` export only. Importing this module registers it as `review`.
 *
 * @param options - Defaults for the Download menu's *Add a Review sheet* and *Colour flagged cells*, the sheet's
 *   name, the severities and layers written, and the fills.
 * @returns The plugin (`id: 'review'`) with `lastExport`.
 * @throws SP-5005 when a `fills` colour is not a hex colour.
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0123_REVIEW.md
 * @example
 * ```ts
 * import { createWorkbook } from '@sheetpane/grid';
 * import { review } from '@sheetpane/review';
 *
 * const plugin = review({ fill: true });
 * const book = createWorkbook({ plugins: [plugin] });
 * await book.load(bytes, 'holdings.xlsx');
 * const { blob } = await book.exportFile();
 * plugin.lastExport?.counts; // { open, accepted, resolved }
 * ```
 * @example
 * ```ts
 * import '@sheetpane/review'; // registers `review`
 * excel.setAttribute('plugins', 'review');
 * const annotated = await excel.export({ reviewFills: true });
 * const listOnly = await excel.export({ reviewSeverities: ['error'] });
 * ```
 */
export function review(options: ReviewOptions = {}): ReviewPlugin {
  const fills: Record<string, string> = { ...DEFAULT_FILLS };
  for (const [sev, c] of Object.entries(options.fills ?? {})) {
    if (c === null) { delete fills[sev]; continue; }
    const v = argb(c);
    if (!v) throw spError('SP-5005', `sheetpane review: fill for "${sev}" is not a colour: ${JSON.stringify(c)}`, TypeError);
    fills[sev] = v;
  }
  let last: ReviewReport | undefined;
  return {
    id: 'review',
    provides: ['exportPatch'],
    // the Download menu's switches for this export (W-34)
    exportOptions: [
      { key: 'review', label: 'Add a Review sheet', default: options.sheet !== false },
      { key: 'reviewFills', label: 'Colour flagged cells', default: options.fill === true },
    ],
    get lastExport() { return last; },
    async exportPatch(patch, ctx) {
      last = undefined;
      const x = ctx.exportOptions ?? {};
      const sheet = flag(x.review, options.sheet !== false), fill = flag(x.reviewFills, options.fill === true);
      if (!sheet && !fill) return;
      const severities = strings(x.reviewSeverities) ?? options.severities ?? PROBLEM_SEVERITIES;
      const layers = strings(x.reviewLayers) ?? options.layers;
      const errors = selectErrors(ctx.snapshot().errors, { severities, layers }, patch.sheetNames());
      if (!errors.length) return;
      last = await writeReview(patch, errors, { sheet, fill, sheetName: options.sheetName ?? 'Review', fills, order: [...PROBLEM_SEVERITIES, ...severities] });
    },
  };
}

registerPlugin('review', () => review());

export { reviewSheetOf, REVIEW_NAME } from './sheet.js';
export { COLUMNS, PROBLEM_SEVERITIES } from './rows.js';
export { DEFAULT_FILLS, MAX_FILL_CELLS } from './fills.js';
