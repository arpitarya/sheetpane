# create-sheetpane

**A working sheetpane app in one command.**

```sh
npm create sheetpane@latest               # asks: folder, template, skills, MCP server
npm create sheetpane@latest my-app -- --template react --skills host --yes
pnpm create sheetpane my-app --template vue
```

| template | what you get |
|---|---|
| `vanilla` | Vite + TypeScript, no framework |
| `react` | React 19 on Vite; `onsheetpane-…` props typed by `@sheetpane/grid/jsx` |
| `next` | Next.js App Router; the sheet loads on the client only (`next/dynamic`, `ssr: false`) |
| `vue` | Vue 3 on Vite; `isCustomElement` set, typed by `@sheetpane/grid/vue` |
| `angular` | Angular, a standalone component with `CUSTOM_ELEMENTS_SCHEMA` (needs Node ^22.22.3 or ^24.15.0) |
| `svelte` | Svelte 5 on Vite; typed by `@sheetpane/grid/svelte` |

Every template has the same app: `<sheetpane-excel>` and `<sheetpane-errors>`
on one `pane`, side by side, and the sheet again behind an **Open in a pop-up**
button (`display="popup"`); the showcase workbook and its rules file from
`@sheetpane/fixtures`; one Playwright test on `@sheetpane/testing` (the file
loads, the rules flag a cell, an edit reaches the download); and a README.
Framework versions are pinned exactly — the ones CI built and tested — and
every `@sheetpane/*` package at this package's version (they are released
together).

| option | does |
|---|---|
| `--template <t>` | one of the six above |
| `--skills all \| host \| none` | runs `sheetpane-skills install --all` after installing — `host` leaves out the two skills for contributing to sheetpane itself; `none` skips it |
| `--mcp`, `--no-mcp` | register the sheetpane MCP server (`@sheetpane/mcp`) with Claude Code, Kiro and Codex, or not |
| `--pm npm \| pnpm \| yarn` | the package manager (default: the one that ran `create`) |
| `--no-install` | copy the files only |
| `-y`, `--yes` | no questions; defaults: `sheetpane-app`, `vanilla`, `host`, MCP on |

The folder must be new or empty; nothing outside it is written. No
dependencies, no `postinstall`.

Every template is also in the repository, scaffolded by this CLI, with an
**Open in StackBlitz** link: [`examples/starters`](https://github.com/arpitarya/sheetpane/blob/main/examples/starters/README.md)
(they install from npm, so they run once the version is published).

The spec is the record SR-CREATE; the repo checks every template on each push
with `just create-check` (scaffold, install from the packed tarballs, build,
test).
