# svelte

A Svelte 5 (Vite) app with [sheetpane](https://github.com/arpitarya/sheetpane):
`<sheetpane-excel>` and `<sheetpane-errors>` on one `pane`, side by side in the
page and the same sheet again in a pop-up, loading the showcase workbook and
its rules file from `@sheetpane/fixtures`. Edit a cell, flag one, download the
file with your changes in it.

```sh
npm run dev      # http://127.0.0.1:5173
npm run build
npm run test     # one Playwright test; the first time: npx playwright install chromium
```

## What is where

| file | what it holds |
|---|---|
| `src/App.svelte` | the sheet, the errors panel and the pop-up button |
| `scripts/sample.mjs` | copies `showcase.xlsx` and `showcase.rules.json` from `@sheetpane/fixtures` into `public/` before `dev` and `build` |
| `e2e/review.spec.ts` | one test on `@sheetpane/testing`: the file loads, the rules flag a cell, an edit reaches the download |
| `playwright.config.ts` | runs that test against the built app |

## Make it yours

- **Your file:** point `src` at its URL, or set the sheet's `file` property to
  a `File` from an `<input type="file">`. Then delete `scripts/sample.mjs` and
  its call in `package.json`.
- **Your rules:** copy `public/showcase.rules.json` to a file of your own
  (`public/` is rewritten from the sample on every build), change it, and
  point `rules-src` at it. The `$schema` line gives your editor autocomplete.
- **The font** is the page's: nothing here sets one, so the sheet uses the
  browser's default until you set a font on `body` or the element.
- **All attributes, properties and events:** the
  [`@sheetpane/grid` README](https://github.com/arpitarya/sheetpane/blob/main/packages/grid/README.md).

## With an AI coding agent

```sh
npx sheetpane-skills install --all --skip contributor
```

puts sheetpane's skills into `.claude/`, `.kiro/` and `.agents/`, a short
block into `CLAUDE.md` and `AGENTS.md`, and registers the sheetpane MCP server
(`@sheetpane/mcp`, run with `npx`) in each tool's config — add `--no-mcp` to
leave it out. `npx sheetpane-skills uninstall` removes exactly what it wrote.
