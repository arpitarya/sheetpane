# @sheetpane/grid

**View and edit `.xlsx` and `.csv` files inside any web page, and review them.**
Two web components, always in sync through one in-memory workbook:

- `<sheetpane-excel>` — the sheet. View or Edit; every change stays in memory;
  **Download** hands back the file — as opened when nothing changed, else a
  copy of the uploaded file with the changes in it.
- `<sheetpane-errors>` — the errors flagged on the sheet: what's wrong, what it
  should be. Put it anywhere — beside the sheet, in a side column, in another tab.

Nothing is uploaded: the file is read in the browser tab. No framework inside
or outside; no font of its own — yours is used.

```sh
pnpm add @sheetpane/grid      # or npm / yarn
```

Try it first in the [live playground](https://arpitarya.github.io/sheetpane/) or
open a [starter in StackBlitz](https://github.com/arpitarya/sheetpane/blob/main/examples/starters/README.md)
(from the first published release).

## Plain HTML

```html
<script type="module">import '@sheetpane/grid';</script>

<sheetpane-excel pane="q3" src="/files/holdings.xlsx" mode="edit" author="Arpit" style="height:640px"></sheetpane-excel>
<sheetpane-errors pane="q3" author="Arpit" style="height:640px"></sheetpane-errors>
```

The same `pane` id links them. Mount order does not matter, and they may sit
in different containers, tabs or dialogs.

## React 19

React 19 sets properties and listens to custom events on custom elements
natively:

```tsx
import '@sheetpane/grid';

export function Review({ file }: { file: File }) {
  return (
    <>
      <sheetpane-excel pane="q3" mode="edit" file={file} onsheetpane-change={(e) => console.log(e.detail)} />
      <sheetpane-errors pane="q3" onsheetpane-errors={(e) => save(e.detail.errors)} />
    </>
  );
}
```

**Typed JSX:** add `import type {} from '@sheetpane/grid/jsx';` once — e.g. in
a `sheetpane.d.ts` beside your sources — and both tags, their attributes,
properties and `onsheetpane-…` props are typed, payloads included
(`e.detail.ref`). See [Typings and editor support](#typings-and-editor-support).

**React 18** sets attributes only: use a `ref` for properties and events.

```tsx
const ref = useRef<HTMLElement & { file?: File }>(null);
useEffect(() => {
  const el = ref.current!;
  el.file = file;
  const on = (e: Event) => save((e as CustomEvent).detail.errors);
  el.addEventListener('sheetpane-errors', on);
  return () => el.removeEventListener('sheetpane-errors', on);
}, [file]);
return <sheetpane-excel ref={ref} pane="q3" />;
```

### React hooks (recipes)

Not a package (SR-LAW-4: no framework wrappers in v1) — copy
[`examples/react/src/sheetpane-hooks.ts`](../../examples/react/src/sheetpane-hooks.ts)
into your app. Each hook takes a `ref` to `<sheetpane-excel>`, is built on
`useSyncExternalStore` with a stable selector (a component re-renders only
when what it reads changes), removes its listeners on unmount, and is safe
under StrictMode. React 19 and 18.

```tsx
const sheet = useRef<SheetpaneExcel>(null);
const sel = useSelection(sheet);         // { sheet, ref, range, column: { index, letter, header }, value, text }
const edit = useCellEdit(sheet);         // { editing, ref, column, draft } while the user types
const { count, canUndo } = useChanges(sheet);
const { errors, open } = useErrors(sheet);
const wb = useWorkbook(sheet);           // the pane's store
const rules = useColumnRules(sheet, { Age: { type: 'integer', min: 18 } }); // { checking, done, total }
useSheetpaneEvent(sheet, 'sheetpane-beforechange', (e) => { if (Number(e.detail.now) < 0) e.preventDefault(); });
return <sheetpane-excel ref={sheet} pane="r1" mode="edit" src="people.xlsx" />;
```

The primitive under all of them, for a hook of your own:

```ts
const units = useSheetpane(sheet, (store) => store.value('Holdings', 'F3'), null);
```

## Vue, Svelte, Solid, Angular

The elements are standard custom elements, so every framework renders them
once `import '@sheetpane/grid'` has run in the browser. No wrapper package;
an `import type` line types them.

**Vue 3** — tell the compiler the tags are custom elements, then bind
properties with `.prop` and listen with `@`:

```js
// vite.config.js
vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('sheetpane-') } } })
```

```vue
<script setup lang="ts">
import '@sheetpane/grid';
import type {} from '@sheetpane/grid/vue';   // GlobalComponents: props and @sheetpane-… typed
</script>
<template>
  <sheetpane-excel pane="q3" mode="edit" :file.prop="file" @sheetpane-change="(e) => log(e.detail.ref)" />
  <sheetpane-errors pane="q3" @sheetpane-errors="(e) => save(e.detail.errors)" />
</template>
```

**Svelte** — `import type {} from '@sheetpane/grid/svelte';` once (e.g. in
`src/app.d.ts`); Svelte 5 listens with `onsheetpane-change={…}`, Svelte 4 with
`on:sheetpane-change={…}`; both set properties when the element has one.

```svelte
<sheetpane-excel pane="q3" mode="edit" file={file} onsheetpane-change={(e) => log(e.detail.ref)}></sheetpane-excel>
```

**Solid** — `import type {} from '@sheetpane/grid/solid';` once. Solid sets a
custom element's props as properties, so write an attribute that has no
property with `attr:`, and listen with `on:`:

```tsx
<sheetpane-excel attr:pane="q3" attr:header-row="2" mode="edit" prop:file={file()} on:sheetpane-change={(e) => log(e.detail.ref)} />
```

**Angular** — no package and no typings to import: add
`CUSTOM_ELEMENTS_SCHEMA` to the component that renders the tags, bind
properties with `[…]` and events with `(…)`:

```ts
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import '@sheetpane/grid';

@Component({
  selector: 'app-review',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <sheetpane-excel pane="q3" mode="edit" [file]="file" (sheetpane-change)="onChange($event)"></sheetpane-excel>
    <sheetpane-errors pane="q3" (sheetpane-errors)="save($event.detail.errors)"></sheetpane-errors>`,
})
export class ReviewComponent { file: File | null = null; onChange(e: Event) { console.log((e as CustomEvent).detail); } save(errors: unknown[]) {} }
```

**Next.js and other SSR** — the import is safe on the server (the elements
just do not register); render the tags in a client component.

## Typings and editor support

| file | for |
|---|---|
| `@sheetpane/grid/custom-elements.json` | the [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest) (schema 2.1.0): every attribute, property, method, event (with its payload type), slot, CSS part and `--sp-*` property; `package.json`'s `customElements` points at it |
| `@sheetpane/grid/jsx` | React 19 — `React.JSX.IntrinsicElements` |
| `@sheetpane/grid/vue` | Vue 3 — `GlobalComponents` (Volar / vue-tsc) |
| `@sheetpane/grid/svelte` | Svelte 4 and 5 — `SvelteHTMLElements` |
| `@sheetpane/grid/solid` | Solid — `JSX.IntrinsicElements` |
| `@sheetpane/grid/vscode.html-custom-data.json` | VS Code: tags, attributes and their values in `.html` |
| `@sheetpane/grid/vscode.css-custom-data.json` | VS Code: the `--sp-*` properties in `.css` |
| `@sheetpane/grid/web-types.json` | JetBrains IDEs (WebStorm, IntelliJ) — read automatically through `package.json`'s `web-types` |

Each typing entry is types only (`import type {} from '…'`); the framework is
never a dependency. Each also exports the element types it builds on —
`SheetpaneExcelEventMap`, `SheetpaneExcelAttributes`,
`SheetpaneExcelProperties` and the same for `SheetpaneErrors` — for typing
your own wrappers.

**VS Code** — point the workspace settings at the editor data:

```json
// .vscode/settings.json
{
  "html.customData": ["./node_modules/@sheetpane/grid/dist/vscode.html-custom-data.json"],
  "css.customData": ["./node_modules/@sheetpane/grid/dist/vscode.css-custom-data.json"]
}
```

All of it is generated from the element sources and their TSDoc
(`scripts/build-manifest.mjs`, run by the build); a test fails when the
committed manifest drifts from the elements.

## `<sheetpane-excel>`

| kind | name | what |
|---|---|---|
| attribute | `pane` | the shared id; the same on both elements |
| attribute | `src` | a URL (read with a GET), a `data:` URL or base64 |
| attribute | `mode` | `view` (default) or `edit` |
| attribute | `display` | `tab` (default; fills its container) or `popup` (a modal dialog; `open` shows it) |
| attribute | `open` | shows the pop-up |
| attribute | `author` | written on errors flagged here |
| attribute | `plugins` | the enabled plugin ids, e.g. `numfmt formulas` |
| attribute | `header-row` | the row holding column titles (default `1`) — every event names the column by it, and column rules match by it |
| attribute | `theme` | `light` (default), `dark` or `auto` (follows the page's `prefers-color-scheme`) |
| attribute / property | `on-invalid` / `onInvalid` | what a failing column rule does by default: `flag` (default) or `block` |
| attribute / property | `rules-src` / `rules` | a rules file by URL, or as an object — see [Rules file](#rules-file) |
| attribute / property | `flagging` | `on` (default) or `off`: no Flag issue, no composer, no pop-up card — errors are read in `<sheetpane-errors>` |
| property | `columns`, `validate` | column rules by title, and a check function — see [Column rules](#column-rules) |
| property | `file` | a `File`, `Blob`, `ArrayBuffer` or `Uint8Array` to read |
| property | `workbook` | the pane's store (get, or set your own from `createWorkbook()`) |
| property | `errors`, `errorTypes` | the review; the error-type catalog |
| property | `renderDetail` | your extra detail in the error card (W-68, under *Saving and restoring a review*) |
| method | `load(src, name?)` | read a file (any of the above) |
| method | `export(options?, { format? })` | `Promise<Blob>` — the upload with every change; `format: 'csv'` from an `.xlsx` is the current sheet, `'xlsx'` from a `.csv` one sheet |
| method | `select(sheet, ref)`, `getErrors()`, `setErrors(list)`, `undo()`, `redo()` | |
| event | `sheetpane-load`, `sheetpane-errors {errors, plugins}`, `sheetpane-mode {mode}`, `sheetpane-history`, `sheetpane-export {blob, kind, name, format, converted, original?}` (cancelable — prevent it to save the file yourself; `original: true` when Download hands back the untouched file, `converted` when ▾ chose the other format), `sheetpane-close` | bubbling, composed |

### Following an edit

Every edit fires these, in this order, on the element where it happened;
every payload names the column `{ index, letter, header }` (the title from
`header-row`):

| event | fires | detail | cancel it to |
|---|---|---|---|
| `sheetpane-select` | the selected cell moves | `{sheet, ref, column, value}` | — |
| `sheetpane-editstart` | the cell bar opens on a cell | `{sheet, ref, column, value}` | keep the cell read-only |
| `sheetpane-input` | each keystroke, before saving | `{sheet, ref, column, draft, was}` | — |
| `sheetpane-beforechange` | Enter, Tab, blur, Delete, or each cell of a paste | `{sheet, ref, column, was, now}` | refuse the value |
| `sheetpane-change` | after saving | `{sheet, ref, kind, was, now}` | — |
| `sheetpane-editcancel` | Esc, or a column rule set to `block` refused the value | `{sheet, ref}` (refused: `{sheet, ref, reason: 'blocked', message}`) | — |
| `sheetpane-sheet` | the sheet tab changes | `{sheet}` | — |

A refused value never reaches the change map, undo or a plugin.

```js
excel.addEventListener('sheetpane-beforechange', (e) => {
  if (e.detail.column.header === 'Units' && Number(e.detail.now) < 0) e.preventDefault();
});
```

**Keys:** arrows, Shift+arrows, Home/End, Ctrl+Home/End, PageUp/PageDown;
Enter or F2 edits; typing replaces; Delete clears; Ctrl/⌘+V pastes tab-separated cells; **F flags an issue**;
**right-click, Shift+F10 or the Menu key** opens the selection actions (Flag issue, Copy ref, Copy value and
plugin actions) under the cell — the same actions sit at the right end of the cell bar, never over the cells; Esc
cancels or closes the pop-up; Ctrl/⌘+Z undo, Ctrl+Y / ⌘+Shift+Z redo. The `?`
button lists them, plugins' shortcuts included.

**Selecting a range:** drag (the grid scrolls when the pointer reaches an edge), Shift+click, or click a
column header, row header or the corner — drag or Shift+click headers for several. Ctrl/⌘+arrow jumps to
the edge of the data (with Shift: selects to it); Ctrl+Space selects the column, Shift+Space the row,
Ctrl/⌘+A the data and then the sheet; Shift+Backspace goes back to the active cell; Enter and Tab move
inside a range. On a range, Ctrl/⌘+C copies it so Excel and Google Sheets paste a grid, Delete clears it
(Edit, one undo step), one pasted value fills it, and the status line shows **Count · Sum · Average**.
`sheetpane-select` carries `range` (`B3:D8`) and fires once a drag is released. On a touch screen a finger
scrolls, a tap selects, and a range shows two handles to extend it.

**Resizing:** drag a column header's right edge or a row header's bottom edge; double-click it to fit the
text; with several whole columns or rows selected, one drag or fit sizes them all. Right-click a header (or
Shift+F10 with a whole column or row selected) for *Fit to data*, *Column width…* and *Reset*. Rows keep the
file's heights. Sizes are a view setting, like zoom — not a change, not in the download; save and restore
them with the `sizes` property and the `sheetpane-resize` event:

```js
excel.addEventListener('sheetpane-resize', () => localStorage.setItem('sizes', JSON.stringify(excel.sizes)));
excel.sizes = JSON.parse(localStorage.getItem('sizes') ?? '{}'); // { Sheet1: { cols: { B: 120 }, rows: { 4: 40 } } }
```

## Column rules

Check what a user types, by column title. Rules are plain JSON — save and load
them as a file if you like — and failures go into the one error list as
`author: "host"` errors that resolve themselves when the cell passes.

```js
excel.columns = {
  Name:   { required: true },
  Email:  { pattern: '^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$', unique: true },
  Age:    { type: 'integer', min: 18, max: 99, onInvalid: 'block' },
  Status: { oneOf: ['Active', 'Inactive'], severity: 'warning' },
};
excel.validate = async (ctx, signal) =>
  ctx.column.header === 'Email' && ctx.phase !== 'input' && (await api.taken(ctx.value, { signal }))
    ? { severity: 'error', message: 'Email already used' }
    : null;
```

| rule | passes when |
|---|---|
| `required` | the cell is not blank (every other rule skips a blank cell) |
| `type` | `text` · `number` · `integer` · `date` · `boolean` |
| `min`, `max` | a number in range; for `type: 'date'`, an ISO date or a serial |
| `minLength`, `maxLength` | the text's length |
| `pattern` | the text matches (values over 10,000 characters are not tested — **avoid patterns that backtrack catastrophically**: they run on the page) |
| `oneOf` | the value is one of the list (trimmed, case-insensitive) |
| `unique` | no other row of the column holds it |
| `message`, `severity`, `onInvalid` | replace the generated message; `error` (default) · `warning` · `note`; `flag` (default) · `block` |

- **Titles** match trimmed and case-insensitive (an exact title wins). A
  title the file lacks is one `note` error; a duplicated title checks the
  first column and adds one `note`. The file always loads.
- **`validate(ctx, signal)`** runs for every cell of a titled column, sync or
  async. `ctx` is `{phase, sheet, ref, row, column, value, was, original,
  rowValues}`, `rowValues` keyed by title, so a rule can read the row; editing
  any cell asks the row again. A newer edit to a cell aborts the older check
  (`signal`) and its result is dropped. Return `null` or `{severity, message,
  expected?}`.
- **Phases:** `input` — 150 ms after typing stops, an outline and a message
  at the cell bar, nothing stored; `commit` — on save, `flag` stores the value
  and adds an error, `block` refuses it (only a JSON rule or a synchronous
  result can block; an async result flags); `load` — every row, in slices,
  with the progress in the status line.
- Setting `columns`, `validate` or `onInvalid` again re-checks every row;
  host errors no longer produced are removed. People's errors are never
  touched, and a rule never edits a cell.
- Rules belong to the pane: `workbook.setColumnRules({ columns, validate,
  onInvalid, headerRow })` does the same without an element.

## Rules file

Ship the rules next to your code as JSON and point the sheet at them; every
cell they cover is checked on load and the failures are listed in
`<sheetpane-errors>`. With `flagging="off"` the sheet shows no Flag issue and
opens no pop-up — the errors panel is the one place errors are read.

```html
<sheetpane-excel pane="q3" src="./q3.xlsx" rules-src="./sheetpane.rules.json" flagging="off"></sheetpane-excel>
<sheetpane-errors pane="q3"></sheetpane-errors>
```

```json
{
  "$schema": "https://unpkg.com/@sheetpane/grid/rules.schema.json",
  "version": 1,
  "sheets": {
    "*": {
      "columns": { "Email": { "pattern": "^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$", "unique": true } }
    },
    "Accounts": {
      "headerRow": 2,
      "columns": {
        "Account ID": { "required": true, "pattern": "^AC-\\d{5}$", "message": "Account IDs are AC- and five digits" },
        "Units":      { "type": "integer", "min": 0 },
        "Status":     { "oneOf": ["Active", "Inactive"], "noneOf": ["TBD", "N/A"], "severity": "warning" }
      },
      "cells": {
        "B1":     { "equals": "Q3 review", "note": "the title cell the export pipeline reads" },
        "H3:H40": { "type": "number", "min": 0, "max": 1 }
      }
    }
  }
}
```

- **`sheets`** by name; `"*"` applies to every sheet and a named sheet's rule
  for the same title wins. Each sheet has `headerRow`, `columns` (by title,
  as [Column rules](#column-rules)) and `cells` (an A1 cell or range).
- **The words** are Column rules' plus `equals` (the one valid value; a blank
  cell fails it), `noneOf` (values never valid) and `note` (for whoever
  maintains the file — never shown as the message).
- **`$schema`** gives your editor autocomplete and red squiggles: the schema
  ships as `@sheetpane/grid/rules.schema.json`.
- **Never silent, never a throw:** an unknown key, word or version, a sheet,
  title or cell the workbook lacks, or a pattern that is not a regular
  expression becomes one `note` in the errors panel; the rest still applies.
- `rules-src` is read with a GET like `src`; `excel.rules = object` does the
  same without a fetch. Setting either checks every row again. The element's
  `columns` and `validate` still work beside it — the file's rule wins for the
  same title, with a note.
- **YAML or TOML:** parse it yourself and pass the object — the package reads
  JSON only, so it carries no parser:

  ```js
  import { parse } from 'yaml';      // or: import { parse } from 'smol-toml';
  excel.rules = parse(await (await fetch('./sheetpane.rules.yaml')).text());
  ```

## `<sheetpane-errors>`

| kind | name | what |
|---|---|---|
| attribute | `pane`, `author`, `plugins` | as above |
| attribute | `readonly` | hides the form, Resolve, Accept… and Delete — a sign-off screen |
| property / method | `errors`, `errorTypes`, `getErrors()`, `setErrors(list, { plugins })` | |
| property | `renderDetail` | your extra detail in an open row — see below (W-68) |
| event | `sheetpane-errors {errors, plugins}`, `sheetpane-reveal {error}` | **Show in sheet**: switch to the sheet's tab or open the pop-up |

## Saving and restoring a review

Errors are plain JSON (`SheetpaneError`, schema `v: 1`). Listen to
`sheetpane-errors`, store `detail.errors` and `detail.plugins` where you like,
and give them back after the file loads:

```js
excel.addEventListener('sheetpane-load', () => errors.setErrors(saved.errors, { plugins: saved.plugins }));
```

An error whose cell no longer shows what was found is tagged *stale*, never
moved.

**An error with no cell** (W-55): `range: ""` is about the whole sheet, and
`sheet: ""` with `range: ""` about the whole workbook — "no Pages List", "a
listed tab has no sheet". Add one with `setErrors()`, `workbook.addError()` or
a `validate` hook (a whole-sheet draft only). The list shows them first — a
*Workbook* group, then each sheet's — above the cell errors; a whole-sheet
error is counted on its tab and **Show in sheet** opens the tab; for a
workbook-level one it is disabled. They are never placed on A1; no pin, no
cell mark, no `found`. `errorScope(e)` says which (`cell` · `sheet` ·
`workbook`). **If your code reads `range` as an A1 reference, handle `""`.**

**Your data on an error, and your detail beside it** (W-68): `meta` holds any
JSON of yours (64 KiB at most, `ERROR_META_MAX`); it is saved and restored
with the error and never written into the file. `renderDetail(error)` — on
`<sheetpane-excel>` for the error card and on `<sheetpane-errors>` for the
open row, each its own — returns a string (shown as text, never HTML), a
Node (yours, placed as it is) or `null`. It is drawn after the message, in
`::part(detail)`, and runs again only when that error changes.

```js
workbook.addError({ sheet: 'Spec', range: 'C7', type: 'out-of-range', severity: 'error', meta: { page: 3, measured: '6.63 in' } });
const detail = (e) => (e.meta?.measured ? `The PDF measures ${e.meta.measured}, outside ± 0.06 in` : null);
excel.renderDetail = detail;
errors.renderDetail = detail;
```

A `meta` that is not JSON or is over the cap is dropped (SP-3016); a hook
that throws shows nothing (SP-3017).

**Accepted deviations** (W-69): a known, approved difference can be accepted
instead of deleted. **Accept…** in an open row of `<sheetpane-errors>` asks
for a reason (required) and records it with who (the element's `author`) and
when: `status: 'accepted'`, `acceptedBy`, `acceptedAt`, `reason`. Accepted
errors stay in the review and the download but are not counted — not in
"n open", the severity chips or the sheet's counts — and the **Accepted n**
chip lists them. Reopen takes an acceptance back; so does undo. From code:

```js
workbook.acceptError(id, 'Approved by the customer on 18 Oct', { by: 'Ravi' });
```

A blank reason is refused (SP-3018). Count open errors with
`status === 'open'`. With `@sheetpane/comments`, the export adds a reply
*Accepted: <reason>* to the error's comment thread.

## Plugins

Features beyond review — every Excel number format, live formulas, cell
styles, data validation, conditional formatting, pictures, charts, comments —
are separate packages that plug into six hooks and six slots. With none
installed the grid is the plain review tool. **See each one on the same
workbook:** the demos' plugin gallery (`just demo-html` or `just demo-react`)
has a tab per plugin, plus Vanilla and All plugins.

```js
import '@sheetpane/numfmt';     // registers "numfmt"
```

```html
<sheetpane-excel pane="q3" plugins="numfmt"></sheetpane-excel>
```

Or build the store yourself: `el.workbook = createWorkbook({ plugins: [...] })`.

## Styling

Colours, spacing and radii are `--sp-*` custom properties on the elements
(`--sp-accent`, `--sp-ink`, `--sp-line`, …); `@sheetpane/grid/style.css`
lists the defaults, and `theme="dark"` swaps in the dark set. The font is yours: set it on the element or any ancestor.

The specs are the records [SR-GRID](../../records/0105_GRID.md) and
[SR-ERRORS](../../records/0106_ERRORS.md).

**Using an AI coding agent?** `npx sheetpane-skills install` puts sheetpane's skills for Claude Code, Kiro and Codex into your repository.
