// W-37: `@sheetpane/grid/svelte` — the SvelteHTMLElements entries (stubbed svelte/elements: not installed).
import type {} from '@sheetpane/grid/svelte';
import type { SvelteHTMLElements } from 'svelte/elements';

const excel: SvelteHTMLElements['sheetpane-excel'] = {
  pane: 'q3', mode: 'edit', 'rules-src': '/rules.json', class: 'grow',
  'on:sheetpane-change': (e) => console.log(e.detail.ref, e.currentTarget.mode),
  'onsheetpane-select': (e) => console.log(e.detail.column.letter, e.detail.value),
};
const errors: SvelteHTMLElements['sheetpane-errors'] = { pane: 'q3', 'onsheetpane-reveal': (e) => console.log(e.detail.error.sheet) };
// @ts-expect-error — not a display
const bad: SvelteHTMLElements['sheetpane-excel'] = { display: 'inline' };
// @ts-expect-error — the select payload has no `now`
const bad2: SvelteHTMLElements['sheetpane-excel'] = { 'on:sheetpane-select': (e) => e.detail.now };
export { excel, errors, bad, bad2 };
