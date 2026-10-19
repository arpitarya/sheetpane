// W-67 DoD 2, shared by both sides: the workbooks `renderStatic` is held to, the pane's settings
// for each, and the one change made before rendering. `static.test.ts` opens each in
// `<sheetpane-excel>` in Chromium and compares the static table, cell by cell, with the grid's
// computed styles; `static.node.test.ts` renders the same workbooks in Node. Both equal
// golden/static.json, so the HTML made in Node is the HTML the browser was checked against.
import type { WorkbookStore } from '@sheetpane/grid/check';
import { bytes, type FixtureName } from '../src/index.js';
import { rulesSample } from './parity.js';

/** The plugins that change what a cell shows or how it looks, and the two that write errors. */
export const PLUGIN_IDS = ['numfmt', 'styles', 'condfmt', 'validation', 'comments'] as const;

/** The workbooks: the showcase (every plugin's sheet), merges, hidden rows/columns/sheets, names, the 1904 system, a CSV. */
export const FILES: FixtureName[] = ['showcase.xlsx', 'edge/merged.xlsx', 'edge/hidden-sheet.xlsx', 'edge/unicode-names.xlsx', 'edge/date1904.xlsx', 'csv/comma.csv'];

/** One case: a file, its name, the rules sample on it. */
export interface StaticCase { id: FixtureName; name: string; data(): Promise<Uint8Array>; rules: unknown }

export async function staticCases(): Promise<StaticCase[]> {
  const rules = await rulesSample();
  return FILES.map((id) => ({ id, name: id.split('/').pop()!, data: () => bytes(id), rules }));
}

/** The change made before rendering, so the changed corner and the stale mark show: the showcase's first rent figure. */
export function edit(id: string, store: WorkbookStore): void {
  if (id === 'showcase.xlsx') store.setCell('Formulas', 'B2', '1300');
}

/** Every sheet, in both themes: `sheet|theme` → the static HTML. */
export type Rendered = Record<string, string>;
