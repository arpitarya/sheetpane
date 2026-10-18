# sheetpane

**Open, edit and review `.xlsx` and `.csv` files inside any web page — without
uploading them anywhere.**

Two web components, `<sheetpane-excel>` (the sheet) and `<sheetpane-errors>`
(what's wrong with it), stay in sync through one in-memory workbook. Download
hands back a copy of the original file with your changes written into it.

```html
<script type="module">import '@sheetpane/grid';</script>
<sheetpane-excel pane="q3" src="holdings.xlsx" mode="edit"></sheetpane-excel>
<sheetpane-errors pane="q3"></sheetpane-errors>
```

---

## Status — read this first

**sheetpane is young.** The first release, `0.1.0`, is being published; until
it is on npm, the install commands below will not work yet. Until 1.0, the API
may change between minor versions; the [CHANGELOG](CHANGELOG.md) says when it
does.

**What is tested.** Each feature below has tests in this repo, run in Node and
in a real browser: Chromium on every change, Chromium, Firefox and WebKit
nightly. The two demos are driven end to end in Chromium, also from the packed
tarballs npm would publish.

**What is not yet proven** — honest gaps, tracked in
[`work/OPEN-WORK.md`](work/OPEN-WORK.md):

- **Files saved by real apps.** The reader is tested against generated and
  library-written files, not yet against files saved by Excel, Google Sheets,
  LibreOffice and Numbers (W-30).
- **The round trip in Excel.** Exported files are read back by independent
  libraries in CI; opening them in desktop Excel is still a manual check.
- **Phones.** Touch selection and download are built, but have not been
  checked on a real iPhone.

If you hit a file that opens wrongly, an issue with the file attached (or a
minimal copy of it) is the most useful thing you can send.

---

## What it does

- **Reads in the browser tab.** Nothing is sent to a server; there is no server.
- **View or edit.** Typing, paste, undo/redo, range selection, find, zoom,
  freeze panes, resize, hidden rows/columns/sheets — the spreadsheet basics.
- **Review.** Errors are flagged on cells and listed beside the sheet: from
  your own column rules, a JSON rules file, or the workbook's own validation.
- **Download keeps the file.** An untouched file comes back byte for byte; an
  edited one is the original with only the changes patched in.
- **Large files stay usable.** A 250,000-row CSV scrolls without dropped frames
  in headless Chromium on a MacBook — a measurement, not a guarantee for your
  hardware.
- **Any framework, or none.** Plain HTML, React, Vue, Svelte, Solid, Angular;
  typings and editor data are generated for each.
- **Your look.** No font of its own; light, dark or auto theme.

## What it does not do

**XLSX and CSV only — by design** ([law L3](records/0005_LAW-3-xlsx-and-csv-only.md)).
`.xls`, `.xlsm`, `.xlsb`, `.ods` and `.numbers` are refused with a clear message,
never half-read.

- **No macros**, and macro-enabled workbooks are refused.
- **No password-protected files** — they are detected and refused, not unlocked.
- **No real-time collaboration** and no storage: the workbook lives in memory;
  saving it somewhere is your app's job.
- **Pivot tables** are shown as their values with a badge, not recalculated.

---

## Get started

**A new app:**

```sh
npm create sheetpane@latest
```

Vanilla, React, Next.js, Vue, Angular or Svelte — with both elements, a sample
file, a rules file and one test ([`create-sheetpane`](packages/create-sheetpane/README.md)).

**An existing app:**

```sh
npm install @sheetpane/grid
```

Then follow the [`@sheetpane/grid` README](packages/grid/README.md).

**Try it first:** the [live playground](https://arpitarya.github.io/sheetpane/)
(plain HTML) and its [React version](https://arpitarya.github.io/sheetpane/react/),
or a [starter in StackBlitz](examples/starters/README.md). These go live with
the first release.

---

## Packages

**One version for all**, ESM with types. Plugins are opt-in, so you only ship
what you use.

| package | what it is |
|---|---|
| [`@sheetpane/grid`](packages/grid/README.md) | the two web components, the pane's workbook, the plugin host |
| [`@sheetpane/import`](packages/import/README.md) | `.xlsx` / `.csv` in, a plain JavaScript workbook out |
| [`@sheetpane/export`](packages/export/README.md) | a workbook in, `.xlsx` / `.csv` out — build, patch the original, `download()` |
| [`create-sheetpane`](packages/create-sheetpane/README.md) | `npm create sheetpane` — a working app to start from |

**Plugins:**

| package | adds |
|---|---|
| [`@sheetpane/numfmt`](packages/numfmt/README.md) | every Excel number format, with locales |
| [`@sheetpane/formulas`](packages/formulas/README.md) | recalculation as you edit (IronCalc, WebAssembly, lazy-loaded) |
| [`@sheetpane/styles`](packages/styles/README.md) | fills, bold, borders, alignment, merges |
| [`@sheetpane/condfmt`](packages/condfmt/README.md) | conditional formatting, colour scales, data bars |
| [`@sheetpane/validation`](packages/validation/README.md) | the workbook's own data-validation rules |
| [`@sheetpane/images`](packages/images/README.md) | pictures anchored in the sheet |
| [`@sheetpane/charts`](packages/charts/README.md) | bar, column, line, pie, doughnut and scatter charts |
| [`@sheetpane/comments`](packages/comments/README.md) | notes and threaded comments, read and written |
| [`@sheetpane/visibility`](packages/visibility/README.md) | hide, unhide and group rows, columns and sheets |

**For hosts and their tools:**

| package | what it is |
|---|---|
| [`@sheetpane/testing`](packages/testing/README.md) | locators and actions for Playwright and Vitest browser mode |
| [`@sheetpane/fixtures`](packages/fixtures/README.md) | known workbooks for your tests |
| [`@sheetpane/skills`](packages/skills/README.md) | agent skills for Claude Code, Kiro and Codex |
| [`@sheetpane/mcp`](packages/mcp/README.md) | a read-only MCP server describing the API and inspecting workbooks |

**Dependencies:** none at runtime outside the project, except the two engines
two plugins use — [`numfmt`](https://github.com/borgar/numfmt) and
[IronCalc](https://github.com/ironcalc/IronCalc). Every dependency is free and
open source ([law L2](records/0004_LAW-2-foss-dependencies.md)).

---

## Develop

Requires **Node 20+**, **pnpm 10** and [**just**](https://just.systems).

| command | does |
|---|---|
| `just install` | `pnpm install --frozen-lockfile` |
| `just check` | type-check, test (Node + Chromium, with coverage) and build |
| `just test-pkg <name>` | one package's tests, e.g. `just test-pkg grid` |
| `just test-browsers` | the browser suites in Chromium, Firefox and WebKit |
| `just demo-html` | the plain HTML demo at http://127.0.0.1:5173 |
| `just demo-react` | the React 19 demo at http://127.0.0.1:5174 |
| `just demo-check` | both demos driven end to end in Chromium |
| `just pack-check` | every package packed as npm would publish it, and checked |
| `just release <version>` | bump every package together, check, tag; CI publishes |

**How the project is run.** Every rule lives in one record under
[`records/`](records/README.md); the live queue is
[`work/OPEN-WORK.md`](work/OPEN-WORK.md); the map is
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Much of the code was written
with AI coding agents working under those records — the tests, not the prose,
are the evidence. Start at [`CLAUDE.md`](CLAUDE.md) if you are one.

**Contributions are welcome**, especially failing files and bug reports.

## Licence

[MIT](LICENSE) © Arpit Arya
