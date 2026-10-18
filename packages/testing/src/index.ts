// @sheetpane/testing — helpers for hosts that test an app embedding sheetpane (W-41).
// `@sheetpane/testing/playwright` drives a page from Playwright; `@sheetpane/testing/dom` drives
// the element itself in Vitest browser mode. Both find things through the grid's committed test
// hooks — roles, labels and `data-sp-*` attributes (SR-GRID decision 9a) — never CSS classes.
export { readFile, changesBetween, valueAt, type Value, type Values } from './read.js';
export { matchers, type ErrorMatch } from './matchers.js';
export type { SheetpaneDriver, FlagDraft, Download } from './driver.js';
