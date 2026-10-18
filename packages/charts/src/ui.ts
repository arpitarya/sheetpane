// @sheetpane/charts/ui — what charts adds to the grid's slots (W-21 DoD 1, "the action").
// Opt-in: the headless entry never imports this file.
//
// The action itself — **Show source cells** — is a button on each chart's frame, in both modes:
// it is the only place that knows which chart is meant. This entry adds two things the frame
// cannot give:
// - the status line: `Chart source: Holdings!E3:E15, H3:H15` while the selection lies in a
//   chart's plotted cells or under its frame, else `2 charts` on a sheet that has some;
// - a keyboard path to the same action (Mod+Shift+U, listed in the grid's keyboard help): it
//   shows the source of the chart over the active cell, or of the sheet's only chart. The frame
//   sits inside the grid's `role="img"` overlay wrapper, where a screen reader does not reach its
//   button — the shortcut is the accessible route until the overlay contract lets an item be a group.
// Not a `selbar` button: a selbar control has no "applies here" test, so it would show on every
// selection, chart or not.
import { registerPlugin, type ControlDescriptor, type Plugin, type Selection, type Snapshot, type WorkbookStore } from '@sheetpane/grid';
import { chartAt, chartModel, chartModelNow, charts, chartsOn, showSource, type ChartsOptions } from './index.js';
import { intersects, parseArea, parseCell, qualified, uniqueRanges, type SourceRange } from './refs.js';
import type { ChartModel } from './model.js';

/** The controls plugin's id. */
export const UI_ID = 'charts-ui';
/** The keyboard shortcut for Show source cells. */
export const SHORTCUT = 'Mod+Shift+U';

/**
 * The ranges a chart reads, categories before values — the order the status line names them in.
 *
 * @param m - The chart model.
 * @returns The ranges, without duplicates.
 */
export function sourceList(m: ChartModel): SourceRange[] {
  return uniqueRanges(m.series.flatMap((s) => [...(s.cat?.ranges ?? []), ...(s.val?.ranges ?? [])]));
}

/** Every parsed chart in the workbook whose plotted cells meet the selection. */
function chartsReading(snap: Snapshot, sel: Selection): ChartModel[] {
  const book = snap.book;
  const area = parseArea(sel.range ?? sel.ref);
  if (!book || !area) return [];
  const out: ChartModel[] = [];
  for (const s of book.sheets) {
    for (const { path } of chartsOn(book, s.name)) {
      const m = chartModelNow(book, path);
      if (m && m.plotted.some((r) => r.sheet === sel.sheet && intersects(r, area))) out.push(m);
    }
  }
  return out;
}

/**
 * The status line's text for a selection: `Chart source: Holdings!E3:E15, H3:H15` while it lies in a chart's plotted
 * cells or under its frame, else `2 charts` on a sheet that has some. Charts not yet read count, but cannot be named.
 *
 * @param snap - A snapshot of the store.
 * @param sel - The selection.
 * @returns The text, or `''`.
 */
export function statusText(snap: Snapshot, sel: Selection): string {
  const book = snap.book;
  if (!book) return '';
  let m = chartsReading(snap, sel)[0];
  if (!m) {
    const p = parseCell(sel.ref), hit = p && chartAt(book, sel.sheet, p.row, p.col);
    m = (hit && chartModelNow(book, hit.path)) || undefined;
  }
  if (m) {
    const list = sourceList(m);
    return list.length ? `Chart source: ${list.map(qualified).join(', ')}` : 'Chart source: values stored in the chart';
  }
  const n = chartsOn(book, sel.sheet).length;
  return n ? `${n} ${n === 1 ? 'chart' : 'charts'}` : '';
}

/**
 * The chart the shortcut acts on: the one over the active cell, else the sheet's only chart.
 *
 * @param store - The workbook store.
 * @param sel - The selection.
 * @returns The chart part's path, or `undefined`.
 */
export function targetChart(store: WorkbookStore, sel: Selection): string | undefined {
  const p = parseCell(sel.ref);
  const hit = p && chartAt(store.book, sel.sheet, p.row, p.col);
  if (hit) return hit.path;
  const all = chartsOn(store.book, sel.sheet);
  return all.length === 1 ? all[0]!.path : undefined;
}

const source: ControlDescriptor = {
  id: 'charts-source',
  slot: 'status',
  group: 'charts',
  label: 'Show chart source cells',
  shortcut: SHORTCUT,
  mode: 'both',
  text: (snap, sel) => statusText(snap, sel),
  run: (store, sel) => {
    const book = store.book, path = book && targetChart(store, sel);
    if (!book || !path) return;
    void chartModel(book, path).then((m) => { if (m && store.book === book) showSource(store, m); });
  },
};

/**
 * The charts controls: no hooks; a status line naming the source of the chart under the selection (or the sheet's
 * chart count), and Mod+Shift+U for Show source cells — the keyboard route to each frame's button. Pair it with
 * {@link charts}; importing this module makes `plugins="charts"` enable both.
 *
 * @returns The controls plugin (`id: 'charts-ui'`).
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0113_CHARTS.md
 * @example
 * ```ts
 * import { createWorkbook } from '@sheetpane/grid';
 * import { charts } from '@sheetpane/charts';
 * import { ui } from '@sheetpane/charts/ui';
 *
 * const book = createWorkbook({ plugins: [charts(), ui()] });
 * ```
 * @example
 * ```ts
 * import '@sheetpane/charts/ui'; // registers `charts` with its controls
 * excel.setAttribute('plugins', 'charts');
 * ```
 */
export function ui(): Plugin {
  return { id: UI_ID, provides: [], controls: [source] };
}

/**
 * The charts plugin and its controls together.
 *
 * @param o - The charts plugin's options.
 * @returns `[charts(o), ui()]`.
 * @example
 * ```ts
 * import { createWorkbook } from '@sheetpane/grid';
 * import { chartsWithUi } from '@sheetpane/charts/ui';
 *
 * const book = createWorkbook({ plugins: chartsWithUi({ draw: false }) });
 * ```
 */
export function chartsWithUi(o: ChartsOptions = {}): Plugin[] {
  return [charts(o), ui()];
}

registerPlugin('charts', () => chartsWithUi());
