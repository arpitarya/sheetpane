// W-37: `@sheetpane/grid/solid` — the JSX.IntrinsicElements entries (stubbed solid-js: not installed).
import type {} from '@sheetpane/grid/solid';
import type { JSX } from 'solid-js';

const excel: JSX.IntrinsicElements['sheetpane-excel'] = {
  'attr:pane': 'q3', 'attr:header-row': '2', mode: 'edit', 'prop:file': null, ref: (el) => el.select('Sheet1', 'A1'),
  'attr:ref': 'Data!F9', link: 'hash', // W-66: Solid's `ref` is its own; the attribute goes through `attr:`
  'on:sheetpane-change': (e) => console.log(e.detail.sheet, e.detail.kind),
};
const errors: JSX.IntrinsicElements['sheetpane-errors'] = { 'attr:pane': 'q3', 'on:sheetpane-errors': (e) => console.log(e.detail.errors) };
// @ts-expect-error — not a theme
const bad: JSX.IntrinsicElements['sheetpane-excel'] = { theme: 'sepia' };
// @ts-expect-error — the mode payload has no `ref`
const bad2: JSX.IntrinsicElements['sheetpane-excel'] = { 'on:sheetpane-mode': (e) => e.detail.ref };
export { excel, errors, bad, bad2 };
