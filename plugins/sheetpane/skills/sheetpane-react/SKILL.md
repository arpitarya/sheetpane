---
name: sheetpane-react
description: Use when sheetpane is used from React 18 or 19 - props and onsheetpane-* events on the custom elements, refs, the copy-in hook recipes, JSX typing. Not for plain HTML (sheetpane-embed) or Vue, Angular, Svelte, Next.js (sheetpane-frameworks).
license: MIT
metadata:
  audience: host
---

# sheetpane in React

There is **no React package** — the elements are web components and their
contract is the DOM's
([SR-LAW-4](https://github.com/arpitarya/sheetpane/blob/main/records/0006_LAW-4-web-component.md)).
React 19 speaks that contract natively; React 18 needs a `ref`. The working
reference is the repo's React demo:
[`examples/react/src/App.tsx`](https://github.com/arpitarya/sheetpane/blob/main/examples/react/src/App.tsx).

## React 19

React 19 sets **properties** and listens to **custom events** on custom
elements. An event prop is `on` + the event name, unchanged:

```tsx
import '@sheetpane/grid';
import type { SheetpaneError } from '@sheetpane/grid';

export function Review({ file, onSave }: { file: File | null; onSave: (e: SheetpaneError[]) => void }) {
  return (
    <div style={{ display: 'flex', gap: 16, height: 640 }}>
      <sheetpane-excel pane="q3" mode="edit" file={file} style={{ flex: 1, minWidth: 0 }}
        onsheetpane-change={(e) => console.log(e.detail.sheet, e.detail.ref, e.detail.now)} />
      <sheetpane-errors pane="q3" style={{ width: 340 }}
        onsheetpane-errors={(e) => onSave(e.detail.errors)} />
    </div>
  );
}
```

- `src={undefined}` or `src=""` removes the attribute (SR-GRID decision 9),
  so switching from `src` to `file` is safe.
- `open={popup}` drives the pop-up; update `popup` from
  `onsheetpane-close`.
- Attribute names with a dash (`header-row`, `on-invalid`, `rules-src`) are
  written as they are: `header-row="2"`.

## React 18

React 18 sets attributes only. Set properties and listen through a `ref`:

```tsx
const ref = useRef<SheetpaneExcel>(null);
useEffect(() => {
  const excel = ref.current!;
  if (file) excel.file = file;
  const on = (e: Event) => save((e as CustomEvent).detail.errors);
  excel.addEventListener('sheetpane-errors', on);
  return () => excel.removeEventListener('sheetpane-errors', on);
}, [file]);
return <sheetpane-excel ref={ref} pane="q3" />;
```

## Hooks — recipes, not a package

Copy [`examples/react/src/sheetpane-hooks.ts`](https://github.com/arpitarya/sheetpane/blob/main/examples/react/src/sheetpane-hooks.ts)
into your app. Each hook takes a `ref` to `<sheetpane-excel>`, is built on
`useSyncExternalStore` with a stable selector, cleans up on unmount and is
StrictMode-safe (grid README, *React hooks*).

| hook | returns |
|---|---|
| `useSheetpane(ref, select, fallback, equal?)` | any value selected from the pane's store — the primitive |
| `useWorkbook(ref)` | the pane's `WorkbookStore` |
| `useSelection(ref)` | `{ sheet, ref, range, column, value, text }` |
| `useCellEdit(ref)` | `{ editing, sheet, ref, column, draft }` while the user types |
| `useChanges(ref)` | `{ count, changes, canUndo, canRedo }` |
| `useErrors(ref)` | `{ errors, open }` |
| `useColumnRules(ref, columns, { validate?, onInvalid? })` | `{ checking, done, total }` — see [sheetpane-column-rules](../sheetpane-column-rules/SKILL.md) |
| `useSheetpaneEvent(ref, name, handler)` | — one listener for the element's life; may `preventDefault()` |

```tsx
const sheet = useRef<SheetpaneExcel>(null);
const { count } = useChanges(sheet);
useSheetpaneEvent(sheet, 'sheetpane-beforechange', (e) => { if (Number(e.detail.now) < 0) e.preventDefault(); });
return <sheetpane-excel ref={sheet} pane="r1" mode="edit" src="/people.xlsx" />;
```

## Typing the JSX

The package ships the typing (generated from its `custom-elements.json`).
Add one file to the app, e.g. `src/sheetpane.d.ts`:

```ts
import type {} from '@sheetpane/grid/jsx';
```

Both tags then type-check in `React.JSX.IntrinsicElements`: every attribute
(`mode`, `header-row`, `theme`…), every settable property (`file`, `rules`,
`columns`, `validate`…) and an `onsheetpane-…` prop per event with its
payload (`e.detail.ref`). The same entry exports `SheetpaneExcelEventMap`
for typing your own handlers. The repo's demo uses exactly this:
[`examples/react/src/sheetpane.d.ts`](https://github.com/arpitarya/sheetpane/blob/main/examples/react/src/sheetpane.d.ts).

## Pitfalls

- **An inline object for `rules` or `columns` re-checks every row on each
  render.** Keep it in a module constant or `useMemo`, or use
  `useColumnRules` (it compares by value).
- **Next.js / SSR:** the import is safe on the server (the elements just do
  not register), but render the tags only on the client — see
  [sheetpane-frameworks](../sheetpane-frameworks/SKILL.md).
- **`sheetpane-editstart` and `sheetpane-beforechange` are cancellable;**
  call `e.preventDefault()` synchronously in the handler — see
  [sheetpane-events](../sheetpane-events/SKILL.md).
- **One `pane` per file.** Two components rendering the same `pane` share one
  workbook, by design (SR-GRID decision 1).

## Spec

[SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md)
decision 9 (the element's contract) ·
[SR-BUILD](https://github.com/arpitarya/sheetpane/blob/main/records/0102_BUILD.md)
decision 6 (the hook recipes are tested against React 19).
