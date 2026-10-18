---
name: sheetpane-setup
description: Use when adding sheetpane to a project - which @sheetpane packages to install, a bundler import or a plain-HTML import map, one version for all. Not for placing the elements (sheetpane-embed) or choosing plugins (sheetpane-plugins).
license: MIT
metadata:
  audience: host
---

# Installing sheetpane

sheetpane is a set of npm packages, versioned together. A host normally
installs one — `@sheetpane/grid` — and imports it once. The specs are the
records; this skill points at them and restates none of their rules.

## Which packages

| you want | install | spec |
|---|---|---|
| the sheet and the errors panel (`<sheetpane-excel>`, `<sheetpane-errors>`) | `@sheetpane/grid` (brings `@sheetpane/export` and `@sheetpane/import`) | [SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) |
| write `.xlsx` / `.csv` from JavaScript, or save a file | `@sheetpane/export` (`toXlsx()`, `patchXlsx()`, `toCsv()`, `download()`) | [SR-EXPORT](https://github.com/arpitarya/sheetpane/blob/main/records/0103_EXPORT.md) · [SR-DOWNLOAD](https://github.com/arpitarya/sheetpane/blob/main/records/0101_DOWNLOAD.md) |
| read `.xlsx` / `.csv` into an object, no UI | `@sheetpane/import` (`read()`, `fromXlsx()`, `fromCsv()`) | [SR-IMPORT](https://github.com/arpitarya/sheetpane/blob/main/records/0104_IMPORT.md) |
| number formats, formulas, styles, workbook rules, conditional formats, pictures, charts, comments | one plugin package each — see [sheetpane-plugins](../sheetpane-plugins/SKILL.md) | the plugin records |
| known workbooks for your own tests | `@sheetpane/fixtures` (dev dependency) | [SR-FIXTURES](https://github.com/arpitarya/sheetpane/blob/main/records/0115_FIXTURES.md) |
| these agent skills in your repo | nothing extra — `@sheetpane/grid` exposes `npx sheetpane-skills install` | — |

## Steps

**A new app?** `npm create sheetpane@latest` scaffolds one — vanilla, React,
Next.js, Vue, Angular or Svelte — with both elements on one pane, the
`@sheetpane/fixtures` sample and rules file, one `@sheetpane/testing` test,
and these skills; the steps below are what it did for you.

1. **Install** with any npm client (SR-LAW-8):

   ```sh
   npm install @sheetpane/grid
   ```

2. **Import once, for its side effect.** Importing the package registers both
   elements where `customElements` exists ([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md)
   decision 9). Put it in your app's entry or the component that renders the
   sheet:

   ```js
   import '@sheetpane/grid';
   ```

3. **Plain HTML, no bundler:** the packages ship native ESM with `.js`
   specifiers ([SR-BUILD](https://github.com/arpitarya/sheetpane/blob/main/records/0102_BUILD.md)
   decision 3), so an import map onto their `dist/` files is enough. The
   repo's [`examples/html/index.html`](https://github.com/arpitarya/sheetpane/blob/main/examples/html/index.html)
   is the working reference:

   ```html
   <script type="importmap">
   { "imports": {
     "@sheetpane/grid": "./node_modules/@sheetpane/grid/dist/index.js",
     "@sheetpane/export": "./node_modules/@sheetpane/export/dist/index.js",
     "@sheetpane/import": "./node_modules/@sheetpane/import/dist/index.js"
   } }
   </script>
   <script type="module">import '@sheetpane/grid';</script>
   ```

   A plugin adds its own entries (and `/ui` when you load its controls).
   `@sheetpane/numfmt` needs `"numfmt"` mapped to that library's ESM build
   (`dist/index.mjs`); `@sheetpane/formulas` needs `"@ironcalc/wasm"`
   ([SR-BUILD](https://github.com/arpitarya/sheetpane/blob/main/records/0102_BUILD.md)
   decision 11a).

4. **One version for every `@sheetpane/*` package.** They are released in
   lockstep (SR-BUILD decision 9). Pin them to the same version in your
   `package.json`; a plugin's `peerDependencies` names `@sheetpane/grid`.

5. **Optional — the agent skills:** `npx sheetpane-skills install` (see
   [sheetpane-upgrade](../sheetpane-upgrade/SKILL.md) for re-running it after
   an upgrade).

## Where it runs

- **Browsers** for the elements; **Node** may import every package without a
  DOM ([SR-LAW-8](https://github.com/arpitarya/sheetpane/blob/main/records/0010_LAW-8-npm-package.md)
  Consequences) — the elements simply do not register there.
- **Reading `.xlsx` needs `DOMParser`** — a browser
  ([SR-IMPORT](https://github.com/arpitarya/sheetpane/blob/main/records/0104_IMPORT.md)
  decision 8). CSV reads anywhere.
- **Runtime dependencies** are only `numfmt` and `@ironcalc/wasm`, each in
  its plugin (SR-BUILD decision 7; licences under
  [SR-LAW-2](https://github.com/arpitarya/sheetpane/blob/main/records/0004_LAW-2-foss-dependencies.md)).

## Pitfalls

- **`import type { SheetpaneExcel } from '@sheetpane/grid'` registers
  nothing.** A type-only import is erased; keep one value import.
- **Two copies of `@sheetpane/grid`** (mismatched versions, a nested install)
  mean two module-level registries: a plugin can register in the copy the
  elements do not use, and `plugins="…"` then throws that the id is not
  registered. Dedupe to one version (`npm ls @sheetpane/grid`).
- **No framework wrapper exists, by law** —
  [SR-LAW-4](https://github.com/arpitarya/sheetpane/blob/main/records/0006_LAW-4-web-component.md).
  React notes are in [sheetpane-react](../sheetpane-react/SKILL.md); other
  frameworks in [sheetpane-frameworks](../sheetpane-frameworks/SKILL.md).

## Next

Place the elements: [sheetpane-embed](../sheetpane-embed/SKILL.md).
