// @sheetpane/validation/ui — the controls validation adds to the grid's slots
// (W-18 DoD 4): a list arrow in every cell a `list` rule covers (Edit), and the
// count of open validation warnings in the status line (both modes).
// Opt-in: the headless entry never imports this file.
import { registerPlugin, type ControlDescriptor, type Plugin, type Snapshot } from '@sheetpane/grid';
import { AUTHOR, ERROR_TYPE, lastReport, listRuleAt, validation, type ValidationOptions } from './index.js';
import { listOptions } from './rules.js';

export const UI_ID = 'validation-ui';
const ARROW = '<svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg>';

/** Open validation warnings in a snapshot. */
export function openWarnings(snap: Snapshot): number {
  return snap.errors.filter((e) => e.author === AUTHOR && e.type === ERROR_TYPE && e.status === 'open').length;
}

/** The status line: `3 validation warnings`, plus `· 1 rule not checked` when some are skipped. */
export function statusText(snap: Snapshot): string {
  const report = lastReport(snap.book);
  if (!report?.rules) return '';
  const n = openWarnings(snap), k = report.skipped.length;
  return `${n} validation warning${n === 1 ? '' : 's'}${k ? ` · ${k} rule${k === 1 ? '' : 's'} not checked` : ''}`;
}

const listArrow: ControlDescriptor = {
  id: 'validation-list',
  slot: 'cell',
  group: 'validation',
  label: 'Choose from the list',
  icon: ARROW,
  mode: 'edit',
  appliesTo: (cell) => !!listRuleAt(cell.store, cell.sheet.name, cell.row, cell.col),
  cellOptions: (cell) => {
    const rule = listRuleAt(cell.store, cell.sheet.name, cell.row, cell.col);
    return rule ? listOptions(rule, cell.store, cell.row, cell.col) : [];
  },
  choose: (store, sel, value) => { store.setCell(sel.sheet, sel.ref, value); },
};

const status: ControlDescriptor = {
  id: 'validation-status',
  slot: 'status',
  group: 'validation',
  label: 'Validation warnings',
  mode: 'both',
  text: (snap) => statusText(snap),
};

/** The UI plugin: no hooks, two controls. Pair it with `validation()`. */
export function ui(): Plugin {
  return { id: UI_ID, provides: [], controls: [listArrow, status] };
}

/** Both plugins, for `createWorkbook({ plugins: validationWithUi() })`. */
export function validationWithUi(o: ValidationOptions = {}): Plugin[] {
  return [validation(o), ui()];
}

registerPlugin('validation', () => [validation(), ui()]);
