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

/**
 * What is done before rendering. The showcase's first rent figure is changed, so the changed corner and the stale mark
 * show; and its Numbers sheet gets the later marks: results at the `marks` level (W-50) — one where a rule's error
 * wins — an accepted deviation (W-69), an error about the whole sheet and one about the workbook (W-55), and one in a
 * layer the pane does not show (W-51).
 */
export function edit(id: string, store: WorkbookStore): void {
  if (id !== 'showcase.xlsx') return;
  store.setCell('Formulas', 'B2', '1300');
  store.setResults('marks');
  const add = (range: string, severity: 'pass' | 'skipped' | 'warning' | 'note' | 'error', message: string, layer = 'pdf', sheet = 'Numbers') => store.addError({ sheet, range, type: 'other', severity, message, author: 'pdf-check', layer });
  add('A2', 'pass', 'Currency label matches the PDF');
  add('A4:A5', 'skipped', 'Not on the PDF page');
  add('B3', 'pass', 'Percent read'); // Numbers!B3 breaks a rule: the problem wins
  const ok = add('B6', 'warning', 'Rounded to two places');
  store.acceptError(ok.id, 'The custodian rounds fractions', { by: 'Priya' });
  add('', 'warning', 'Page 2 of the PDF is missing');
  add('', 'note', 'Checked against the Q3 PDF', 'pdf', '');
  add('A7', 'error', 'Only in the draft layer', 'draft');
  store.setVisibleLayers(['review', 'pdf']);
}

/** Every sheet, in both themes: `sheet|theme` → the static HTML. */
export type Rendered = Record<string, string>;
