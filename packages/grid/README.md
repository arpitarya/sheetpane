# @sheetpane/grid

**View and edit `.xlsx` and `.csv` files inside any web page, and review them.**
Two web components, always in sync through one in-memory workbook:

- `<sheetpane-excel>` — the sheet. View or Edit; every change stays in memory;
  Export writes a copy of the uploaded file with the changes in it.
- `<sheetpane-errors>` — the errors flagged on the sheet: what's wrong, what it
  should be. Put it anywhere — beside the sheet, in a side column, in another tab.

Nothing is uploaded: the file is read in the browser tab. No framework inside
or outside; no font of its own — yours is used.

```sh
pnpm add @sheetpane/grid      # or npm / yarn
```

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
| property | `file` | a `File`, `Blob`, `ArrayBuffer` or `Uint8Array` to read |
| property | `workbook` | the pane's store (get, or set your own from `createWorkbook()`) |
| property | `errors`, `errorTypes` | the review; the error-type catalog |
| method | `load(src, name?)` | read a file (any of the above) |
| method | `export()` | `Promise<Blob>` — the upload with every change |
| method | `select(sheet, ref)`, `getErrors()`, `setErrors(list)`, `undo()`, `redo()` | |
| event | `sheetpane-load`, `sheetpane-change {sheet, ref, kind, was, now}`, `sheetpane-errors {errors, plugins}`, `sheetpane-select {sheet, ref}`, `sheetpane-mode {mode}`, `sheetpane-history`, `sheetpane-export {blob, kind, name}` (cancelable — prevent it to save the file yourself), `sheetpane-close` | bubbling, composed |

**Keys:** arrows, Shift+arrows, Home/End, Ctrl+Home/End, PageUp/PageDown;
Enter or F2 edits; typing replaces; Delete clears; **F flags an issue**; Esc
cancels or closes the pop-up; Ctrl/⌘+Z undo, Ctrl+Y / ⌘+Shift+Z redo. The `?`
button lists them, plugins' shortcuts included.

## `<sheetpane-errors>`

| kind | name | what |
|---|---|---|
| attribute | `pane`, `author`, `plugins` | as above |
| attribute | `readonly` | hides the form, Resolve and Delete — a sign-off screen |
| property / method | `errors`, `errorTypes`, `getErrors()`, `setErrors(list, { plugins })` | |
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

## Plugins

Features beyond review — every Excel number format, live formulas, cell
styles, data validation, conditional formatting, pictures, charts, comments —
are separate packages that plug into six hooks and six slots. With none
installed the grid is the plain review tool.

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
lists the defaults. The font is yours: set it on the element or any ancestor.

The specs are the records [SR-GRID](../../records/0105_GRID.md) and
[SR-ERRORS](../../records/0106_ERRORS.md).
