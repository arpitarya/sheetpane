// @sheetpane/compare (W-63) — what changed between two versions of a workbook. The root is the
// headless diff: pure, Node-safe, no side effects. `@sheetpane/compare/ui` is the grid plugin that
// shows it (decorations, a status summary, next/previous keys, the changes in the errors list).
export { diffWorkbooks, applyDiff, summaryText, relativeFormula, type CompareSheet, type CompareWorkbook, type KeySpec, type DiffOptions, type CellState, type CellChange, type RowOp, type SheetDiff, type DiffSummary, type WorkbookDiff } from './diff.js';
