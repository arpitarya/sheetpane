// exportPatch: the whole review write — fills first (each sheet's flagged
// cells), then the Review sheet, then the styles part once with every fill and
// cloned format appended. A part that cannot be read is left as it was, and
// what was not written is reported (W-59 DoD 2, 3, 5).
import { errorScope, spMessage, type Severity, type SheetpaneError, type SpCode } from '@sheetpane/grid';
import { parseRange, spError } from '@sheetpane/export';
import { HEADER_FILL, StyleBook, fillSheet, planRange, type FillPlan } from './fills.js';
import { rowOf } from './rows.js';
import { stylesPath, writeReviewSheet } from './sheet.js';
import type { PatchContext } from './xml.js';

/** Why an error's cells were not (or not all) coloured. */
export type SkipReason = 'no-cell' | 'no-sheet' | 'bad-range' | 'range-capped' | 'no-styles' | 'unreadable-part';

/** What one export wrote. */
export interface ReviewReport {
  /** The Review sheet's name as written (`Review`, or `Review (2)` beside a user's own *Review*); undefined when none was written. */
  sheet: string | undefined;
  /** The ids listed on the Review sheet, in its order. */
  listed: string[];
  /** The listed errors by status: an accepted error (W-69) is never counted with the open ones. */
  counts: { open: number; accepted: number; resolved: number };
  /** The ids whose cells were coloured. */
  filled: string[];
  /**
   * Errors whose cells were not coloured, and why: `no-cell` — about a whole sheet or the workbook (W-55), listed,
   * never coloured; `no-sheet` / `bad-range` — nowhere to colour; `range-capped` — over 10,000 cells, so only the
   * cells the file has were coloured (SP-5003); `no-styles` — the file has no readable styles part (SP-5004);
   * `unreadable-part` — the sheet could not be read, so it was left as it was (SP-5002).
   */
  skipped: { id: string; reason: SkipReason; code?: SpCode }[];
}

/** How one export writes. */
export interface WriteOptions {
  /** Write the Review sheet. */
  sheet: boolean;
  /** Colour flagged cells. */
  fill: boolean;
  /** The Review sheet's name, as asked for. */
  sheetName: string;
  /** Severity → ARGB fill; a severity not named is not coloured. */
  fills: Readonly<Record<string, string>>;
  /** Severities, worst first: on a cell flagged twice, the worse one's fill wins. */
  order: readonly Severity[];
}

/**
 * Writes the review into the package.
 *
 * @param patch - The export's package.
 * @param errors - The errors to list, in order (already selected).
 * @param o - What to write.
 * @returns What was written and skipped.
 */
export async function writeReview(patch: PatchContext, errors: readonly SheetpaneError[], o: WriteOptions): Promise<ReviewReport> {
  const report: ReviewReport = { sheet: undefined, listed: [], filled: [], skipped: [], counts: { open: 0, accepted: 0, resolved: 0 } };
  const rank = (s: string) => { const i = o.order.findIndex((x) => x === s); return i < 0 ? o.order.length : i; };

  const sp = await stylesPath(patch);
  let book: StyleBook | undefined;
  try { const x = sp ? await patch.readText(sp) : undefined; book = x === undefined ? undefined : new StyleBook(x); } catch { book = undefined; }

  // 1 · the flagged cells: open errors at a cell, with a fill for their severity
  if (o.fill) {
    const bySheet = new Map<string, { e: SheetpaneError; r: NonNullable<ReturnType<typeof parseRange>> }[]>();
    for (const e of errors) {
      if (e.status !== 'open' || !o.fills[e.severity]) continue; // an accepted or resolved error is not a problem
      if (errorScope(e) !== 'cell') { report.skipped.push({ id: e.id, reason: 'no-cell' }); continue; }
      if (!patch.sheetPath(e.sheet)) { report.skipped.push({ id: e.id, reason: 'no-sheet' }); continue; }
      const r = parseRange(e.range.replace(/\$/g, ''));
      if (!r) { report.skipped.push({ id: e.id, reason: 'bad-range' }); continue; }
      if (!book) { report.skipped.push({ id: e.id, reason: 'no-styles', code: 'SP-5004' }); continue; }
      (bySheet.get(e.sheet) ?? bySheet.set(e.sheet, []).get(e.sheet)!).push({ e, r });
    }
    for (const [sheet, items] of bySheet) {
      const path = patch.sheetPath(sheet)!;
      const plan: FillPlan = { cells: new Map(), wide: [] };
      const capped: string[] = [];
      for (const { e, r } of items) if (!planRange(plan, r, e.severity, rank)) capped.push(e.id);
      try {
        const xml = await patch.readText(path);
        if (xml === undefined) throw spError('SP-5002', `sheetpane review: no part ${path}`);
        patch.write(path, fillSheet(xml, plan, rank, (s, sev) => book!.clone(s, o.fills[sev]!)));
        report.filled.push(...items.map(({ e }) => e.id));
        for (const id of capped) report.skipped.push({ id, reason: 'range-capped', code: 'SP-5003' });
      } catch (err) {
        console.error(spMessage('SP-5002', `sheetpane review: cells on sheet "${sheet}" not coloured`), err);
        for (const { e } of items) report.skipped.push({ id: e.id, reason: 'unreadable-part', code: 'SP-5002' });
      }
    }
  }

  // 2 · the Review sheet
  if (o.sheet) {
    const names = new Set(patch.sheetNames());
    const rows = errors.map((e) => rowOf(e, (n) => names.has(n)));
    try {
      const written = await writeReviewSheet(patch, rows, { name: o.sheetName, headerStyle: book?.clone(0, HEADER_FILL) });
      report.sheet = written.name;
      report.listed = errors.map((e) => e.id);
      for (const e of errors) if (e.status === 'open' || e.status === 'accepted' || e.status === 'resolved') report.counts[e.status]++;
    } catch (err) {
      console.error(spMessage('SP-5001', 'sheetpane review: the Review sheet was not written'), err);
    }
  }

  // 3 · the styles part, once
  if (sp && book?.changed) patch.write(sp, book.toXml());
  return report;
}
