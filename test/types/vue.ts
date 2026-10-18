// W-37: `@sheetpane/grid/vue` — what Vue's language tools read from GlobalComponents (stubbed vue: not installed).
import type {} from '@sheetpane/grid/vue';
import type { GlobalComponents } from 'vue';
import type { SheetpaneExcel } from '@sheetpane/grid';

type ExcelProps = InstanceType<GlobalComponents['sheetpane-excel']>['$props'];
type ErrorsProps = InstanceType<GlobalComponents['sheetpane-errors']>['$props'];
const excel: ExcelProps = {
  pane: 'q3', mode: 'edit', 'header-row': 2, theme: 'auto', class: 'grow', file: null, flagging: 'on',
  onSheetpaneChange: (e) => console.log(e.detail.sheet, e.detail.ref, e.detail.now),
  onSheetpaneEditcancel: (e) => { if ('reason' in e.detail) console.log(e.detail.code); },
};
const errors: ErrorsProps = { pane: 'q3', readonly: true, onSheetpaneErrors: (e) => console.log(e.detail.errors.length, e.detail.plugins) };
const el: SheetpaneExcel = new (null as unknown as GlobalComponents['sheetpane-excel'])();
// @ts-expect-error — not a mode
const bad: ExcelProps = { mode: 'write' };
// @ts-expect-error — the history payload has no `sheet`
const bad2: ExcelProps = { onSheetpaneHistory: (e) => e.detail.sheet };
export { excel, errors, el, bad, bad2 };
