---
name: sheetpane-frameworks
description: Use when embedding sheetpane in Vue, Angular, Svelte, Solid or Next.js - registering custom elements, client-only imports, typed props; completed by W-37's typings. Not for React (sheetpane-react).
license: MIT
metadata:
  audience: host
---

# Frameworks

> **Being written with W-37** (the custom-elements manifest and generated
> typings for each framework). Until it lands, these are the essentials.

`<sheetpane-excel>` and `<sheetpane-errors>` are standard custom elements
([SR-LAW-4](https://github.com/arpitarya/sheetpane/blob/main/records/0006_LAW-4-web-component.md)): any framework can render
them once `import '@sheetpane/grid'` has run in the browser.

| framework | what to do |
|---|---|
| Vue | treat `sheetpane-*` as custom elements (`compilerOptions.isCustomElement: (tag) => tag.startsWith('sheetpane-')`); bind properties with `.prop` |
| Angular | add `CUSTOM_ELEMENTS_SCHEMA` to the component |
| Svelte, Solid | use the tags directly; set properties on a `ref` |
| Next.js | import `@sheetpane/grid` in a client component (`'use client'`) or a dynamic import with `ssr: false` |

React: [sheetpane-react](../sheetpane-react/SKILL.md).
