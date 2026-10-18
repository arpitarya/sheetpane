---
name: sheetpane-frameworks
description: Use when embedding sheetpane in Vue, Svelte, Solid, Angular, Next.js or plain HTML with typed props and events - the custom-element setup, @sheetpane/grid/vue|svelte|solid typings, editor data. Not for React (sheetpane-react).
license: MIT
metadata:
  audience: host
---

# sheetpane in other frameworks

`<sheetpane-excel>` and `<sheetpane-errors>` are standard custom elements
([SR-LAW-4](https://github.com/arpitarya/sheetpane/blob/main/records/0006_LAW-4-web-component.md)).
Every framework renders them once `import '@sheetpane/grid'` has run **in the
browser**. There is no wrapper package; one `import type` line per app types
the tags. Everything below is generated from
[`custom-elements.json`](https://github.com/arpitarya/sheetpane/blob/main/packages/grid/custom-elements.json)
(the elements' contract in machine form) and checked against the elements by
a test, so it cannot drift.

| framework | register the tags | typings | event binding |
|---|---|---|---|
| plain HTML | — | editor data (below) | `addEventListener('sheetpane-change', …)` |
| Vue 3 | `isCustomElement` | `@sheetpane/grid/vue` | `@sheetpane-change` |
| Svelte 4 / 5 | — | `@sheetpane/grid/svelte` | `on:sheetpane-change` / `onsheetpane-change` |
| Solid | — | `@sheetpane/grid/solid` | `on:sheetpane-change` |
| Angular | `CUSTOM_ELEMENTS_SCHEMA` | none needed | `(sheetpane-change)` |
| React 19 | — | `@sheetpane/grid/jsx` | `onsheetpane-change` — see [sheetpane-react](../sheetpane-react/SKILL.md) |

The typings are **types only**: the framework is never a dependency of
`@sheetpane/grid`, and nothing runs when they are imported.

## Vue 3

Tell the template compiler the tags are not Vue components, then type them:

```js
// vite.config.js
import vue from '@vitejs/plugin-vue';
export default { plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('sheetpane-') } } })] };
```

```vue
<script setup lang="ts">
import '@sheetpane/grid';
import type {} from '@sheetpane/grid/vue';
import type { SheetpaneError } from '@sheetpane/grid';
const props = defineProps<{ file: File | null }>();
const save = (errors: SheetpaneError[]) => localStorage.setItem('review', JSON.stringify(errors));
</script>
<template>
  <sheetpane-excel pane="q3" mode="edit" header-row="2" :file.prop="props.file"
    @sheetpane-change="(e) => console.log(e.detail.sheet, e.detail.ref, e.detail.now)" />
  <sheetpane-errors pane="q3" @sheetpane-errors="(e) => save(e.detail.errors)" />
</template>
```

- `@sheetpane/grid/vue` augments `GlobalComponents`, which Volar / vue-tsc
  read: attributes, properties and `onSheetpane…` listeners are checked.
- Objects (`rules`, `columns`, `file`) go in with `.prop` (or `:rules` — Vue
  sets a property when the element has one). Keep a `rules` object stable; a
  new object re-checks every row.

## Svelte

`import type {} from '@sheetpane/grid/svelte';` once, e.g. in `src/app.d.ts`.

```svelte
<script lang="ts">
  import '@sheetpane/grid';
  let { file }: { file: File | null } = $props();
</script>

<sheetpane-excel pane="q3" mode="edit" {file} onsheetpane-change={(e) => console.log(e.detail.ref)}></sheetpane-excel>
<sheetpane-errors pane="q3" onsheetpane-errors={(e) => save(e.detail.errors)}></sheetpane-errors>
```

Svelte 5 listens with `onsheetpane-…`; Svelte 4 with `on:sheetpane-…`. Both
set a property when the element has one (`file`, `rules`), else an attribute.
In SvelteKit the import is safe during SSR; the tags upgrade in the browser.

## Solid

`import type {} from '@sheetpane/grid/solid';` once, e.g. in `src/env.d.ts`.
Solid sets a custom element's props as **properties**, so an attribute with
no property (`pane`, `plugins`, `author`, `header-row`, `rules-src`) is
written with `attr:`:

```tsx
import '@sheetpane/grid';

export function Review(props: { file: File | null }) {
  return (
    <sheetpane-excel attr:pane="q3" attr:header-row="2" mode="edit" prop:file={props.file}
      on:sheetpane-change={(e) => console.log(e.detail.sheet, e.detail.ref)} />
  );
}
```

## Angular

No typings to import — Angular checks custom elements only through the
schema. Add `CUSTOM_ELEMENTS_SCHEMA`, bind properties with `[…]` and events
with `(…)`:

```ts
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import '@sheetpane/grid';

@Component({
  selector: 'app-review',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <sheetpane-excel pane="q3" mode="edit" [file]="file" (sheetpane-change)="changed($event)"></sheetpane-excel>
    <sheetpane-errors pane="q3" (sheetpane-errors)="saved($event)"></sheetpane-errors>`,
})
export class ReviewComponent {
  file: File | null = null;
  changed(e: Event) { console.log((e as CustomEvent<{ ref: string }>).detail.ref); }
  saved(e: Event) { console.log((e as CustomEvent).detail.errors); }
}
```

Type a payload with the exported maps, e.g.
`SheetpaneExcelEventMap['sheetpane-change']` from `@sheetpane/grid/jsx`
(any of the typing entries exports them).

## Next.js and other SSR

The import is safe on the server — the elements just do not register — but
render the tags only on the client: import `@sheetpane/grid` in a
`'use client'` component, or load that component with
`dynamic(() => import('./Review'), { ssr: false })`.

## Plain HTML and editor support

```html
<script type="module">import '@sheetpane/grid';</script>
<sheetpane-excel pane="q3" src="/files/holdings.xlsx" mode="edit"></sheetpane-excel>
<sheetpane-errors pane="q3"></sheetpane-errors>
```

Autocomplete for the tags, attribute values and `--sp-*` properties:

- **VS Code** — in `.vscode/settings.json`:
  `"html.customData": ["./node_modules/@sheetpane/grid/dist/vscode.html-custom-data.json"]`,
  `"css.customData": ["./node_modules/@sheetpane/grid/dist/vscode.css-custom-data.json"]`.
- **JetBrains** — nothing to do: `package.json`'s `web-types` field points
  the IDE at `dist/web-types.json`.
- **Other tools** (Storybook, linters, docs generators) read the manifest
  through `package.json`'s `customElements` field.

## Pitfalls

- **Vue without `isCustomElement`** warns "Failed to resolve component" and
  renders nothing useful.
- **Solid: `pane="q3"` without `attr:`** sets a `pane` property the element
  never reads; the elements then each get their own store.
- **JSX never rejects an unknown dashed name** (`onsheetpane-typo`), so a
  misspelt event prop is silent: copy the name from the typings.
- **One `pane` per file.** Two components on the same `pane` share one
  workbook, by design (SR-GRID decision 1).

## Spec

[SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md)
decision 9 (the element contract) ·
[grid README, Vue, Svelte, Solid, Angular](https://github.com/arpitarya/sheetpane/blob/main/packages/grid/README.md#vue-svelte-solid-angular).
