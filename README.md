<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/logo-dark.svg">
  <img src="docs/readme/logo-light.svg" alt="sheetpane" width="460">
</picture>

### Open, edit and review `.xlsx` and `.csv` files inside your web app.<br>Nothing is uploaded. Download gives back the original file, with only your edits patched in.

[![CI](https://github.com/arpitarya/sheetpane/actions/workflows/ci.yml/badge.svg)](https://github.com/arpitarya/sheetpane/actions/workflows/ci.yml)
[![MIT licence](https://img.shields.io/badge/licence-MIT-2346C8)](LICENSE)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-2346C8)](packages/grid/README.md#typings-and-editor-support)
[![Web components](https://img.shields.io/badge/works%20with-any%20framework-2346C8)](#works-where-you-work)

[**Playground**](https://arpitarya.github.io/sheetpane/) ·
[**Get started**](#get-started) ·
[**Docs**](packages/grid/README.md) ·
[**Starters**](examples/starters/README.md) ·
[**Changelog**](CHANGELOG.md)

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/screenshot-dark.png">
  <img src="docs/readme/screenshot-light.png" alt="A holdings workbook open in sheetpane: four cells flagged by a rules file, listed with the expected value in the errors panel beside the sheet" width="100%">
</picture>

<sub>A real capture, not a mock-up: <code>sample.xlsx</code> checked by <a href="docs/readme/holdings.rules.json">a 9-line rules file</a>. Regenerate it with <code>node docs/readme/capture.mjs</code>.</sub>

</div>

---

## In plain words

- Your users have spreadsheets. You want them to open one **inside your app**, fix it, and get it back.
- sheetpane is a spreadsheet you drop into a web page. It opens `.xlsx` and `.csv`, lets people edit, and **points at the cells that are wrong**, with what the right value should be.
- It all happens in the browser tab: **the file is never uploaded anywhere.**
- When they press Download, they get **their own file back**, with only the cells they changed updated.

---

## Three lines of HTML

```html
<script type="module">import '@sheetpane/grid';</script>

<sheetpane-excel pane="q3" src="holdings.xlsx" mode="edit" rules-src="rules.json"></sheetpane-excel>
<sheetpane-errors pane="q3"></sheetpane-errors>
```

**That is the whole integration.** A spreadsheet, an error list, kept in sync by
the shared `pane` id — put them side by side, in tabs, or in a dialog.

---

## Why sheetpane

|  |  |
|---|---|
| 🔒 **Private by construction** | The file is read, edited and checked in the browser tab. sheetpane sends nothing to any server — no file, cell, edit or telemetry ([law L11](records/0013_LAW-11-workbook-stays-in-the-browser.md), checked by a test). |
| 📄 **The file survives the round trip** | Untouched → back **byte for byte**. Edited → the original with only the changed cells patched in. |
| ✅ **Review built in** | Errors are flagged on the cell *and* listed beside the sheet — from a JSON rules file, your own column rules, or the workbook's own validation. |
| ⚡ **Big files stay smooth** | A 250,000-row CSV scrolls with **0 dropped frames** (measured in headless Chromium on a MacBook — not a promise for your hardware). |
| 🧩 **Pay for what you use** | Formulas, styles, charts, images and more are opt-in plugins — you ship only what you import. |
| 🎨 **Looks like your app** | No font of its own — it inherits yours. Light, dark or auto. |

---

## Fix it in place

Edit a flagged cell and its error resolves in the panel — every change held in
memory until you download.

<p align="center">
  <img src="docs/readme/demo.gif" alt="Typing a missing advisor, a positive unit count and an approved fee rate; each error in the panel turns green as resolved" width="100%">
</p>

The rules behind it are [this JSON file](docs/readme/holdings.rules.json), with a [schema](packages/grid/README.md#rules-file) your editor completes:

```json
{
  "version": 1,
  "sheets": { "Holdings": { "headerRow": 2, "columns": {
    "Advisor":  { "required": true },
    "Units":    { "type": "integer", "min": 0 },
    "Fee rate": { "oneOf": ["0.40%", "0.75%", "0.85%"] },
    "As of":    { "type": "date", "min": "2026-09-01", "max": "2026-09-30", "severity": "warning" }
  } } }
}
```

---

## Get started

**`0.5.0` is on npm**, with all 20 packages on one version, published from CI with signed provenance.

```sh
npm install @sheetpane/grid
```

Then follow the [`@sheetpane/grid` guide](packages/grid/README.md). Or try it
first: the [playground](https://arpitarya.github.io/sheetpane/), its
[React version](https://arpitarya.github.io/sheetpane/react/), or a
[starter in StackBlitz](examples/starters/README.md).

---

## Works where you work

The elements are standard web components, so they render in any framework — or
none. **No wrapper packages**; one `import type` line gives typed tags, props
and events.

| | |
|---|---|
| **Plain HTML** | `import '@sheetpane/grid'` — no build step needed |
| **React 19 / 18** | typed JSX, plus [copy-in hooks](packages/grid/README.md#react-hooks-recipes) (`useSelection`, `useErrors`, `useChanges`…) |
| **Vue · Svelte · Solid · Angular** | [one line of setup each](packages/grid/README.md#vue-svelte-solid-angular) |
| **Your tests** | [`@sheetpane/testing`](packages/testing/README.md) — locators and actions for Playwright and Vitest |
| **Your AI agent** | [skills](packages/skills/README.md) for Claude Code, Kiro and Codex · a read-only [MCP server](packages/mcp/README.md) · [`llms.txt`](llms.txt) |

---

## Plugins

**Opt-in, one import each.** Ship only what your users need.

| plugin | adds |
|---|---|
| [`numfmt`](packages/numfmt/README.md) | every Excel number format, with locales |
| [`formulas`](packages/formulas/README.md) | recalculation as you edit — IronCalc, WebAssembly, lazy-loaded |
| [`styles`](packages/styles/README.md) | fills, fonts, borders, alignment, merges |
| [`condfmt`](packages/condfmt/README.md) | conditional formatting, colour scales, data bars |
| [`validation`](packages/validation/README.md) | the workbook's own data-validation rules |
| [`charts`](packages/charts/README.md) | bar, column, line, pie, doughnut and scatter |
| [`images`](packages/images/README.md) | pictures anchored in the sheet |
| [`comments`](packages/comments/README.md) | notes and threaded comments, read and written |
| [`visibility`](packages/visibility/README.md) | hide, unhide and group rows, columns and sheets |
| [`tables`](packages/tables/README.md) | Excel tables drawn in their style — header, bands, totals |
| [`compare`](packages/compare/README.md) | what changed since a base version — tinted, summed up, stepped through; `diffWorkbooks` headless |
| [`review`](packages/review/README.md) | the review as a sheet in the download, flagged cells filled |

```html
<script type="module">import '@sheetpane/grid'; import '@sheetpane/formulas/ui';</script>
<sheetpane-excel src="model.xlsx" plugins="formulas"></sheetpane-excel>
```

---

## The editing basics, included

Typing and paste · undo/redo · range selection with Count · Sum · Average ·
find · zoom · freeze panes · resize rows and columns · hidden rows, columns and
sheets · a pop-up mode · keyboard and touch.

---

## What it deliberately does not do

**XLSX and CSV only** ([law L3](records/0005_LAW-3-xlsx-and-csv-only.md)).
Anything else is refused with a clear message — never half-read.

| not supported | what happens |
|---|---|
| `.xls`, `.xlsm`, `.xlsb`, `.ods`, `.numbers` | refused, with the reason |
| macros, password-protected files | detected and refused |
| sending your file anywhere | never — sheetpane makes no upload, beacon or telemetry call ([law L11](records/0013_LAW-11-workbook-stays-in-the-browser.md)); its only requests are the GETs for the `src` and `rules-src` you set |
| real-time collaboration, storage | the workbook lives in memory; saving it is your app's job |
| pivot tables | shown as their values, with a badge — not recalculated |

---

## Is sheetpane for you?

**Choose sheetpane when:**

- your users bring **their own `.xlsx` or `.csv`** and must review or correct it inside your app (uploads, imports, reconciliations, data checks);
- the file **must not leave the browser**, for compliance, privacy or simply trust;
- you need the download to be **their file**, not a re-generated copy that loses their formatting;
- you want one component that works in **any framework**, typed, and testable.

**Look elsewhere when:**

- you need a **full spreadsheet app**: real-time collaboration, server storage, pivot recalculation, macros;
- your files are **`.xls`, `.xlsm`, `.ods` or `.numbers`**. They are refused by design;
- you need a **data grid for your own records** (sorting and paging an API's rows). sheetpane is built around a workbook file.

---

## How far it is proven

**Every feature has tests**, in Node and a real browser: Chromium on every
change; Chromium, Firefox and WebKit nightly. Both demos are driven end to end —
also from the packed tarballs npm would publish.

<details>
<summary><b>The honest gaps</b> — tracked in <a href="work/OPEN-WORK.md"><code>OPEN-WORK</code></a></summary>

<br>

- **Files saved by real apps.** The reader is tested on generated and
  library-written files; not yet on files saved by Excel, Google Sheets,
  LibreOffice and Numbers (W-30).
- **The round trip in desktop Excel.** Exports are read back by independent
  libraries in CI; opening them in Excel is still a manual check.
- **Phones.** Touch selection and download are built, not yet checked on a real
  iPhone.

Until 1.0 the API may change between minor versions — the
[CHANGELOG](CHANGELOG.md) says when.

</details>

**Found a file that opens wrongly?** [Open a file issue](https://github.com/arpitarya/sheetpane/issues/new?template=file_issue.yml)
with the file (or a minimal copy) attached — it is the most useful thing you can send.

---

## Roadmap

From the live queue ([`OPEN-WORK`](work/OPEN-WORK.md)) and the [backlog](work/BACKLOG.md). Nothing here is promised by a date.

| | what | state |
|---|---|---|
| 🔜 | **Files saved by Excel, Google Sheets, LibreOffice and Numbers** in the import tests (W-30) | needs those files saved by hand |
| 🔜 | **Firefox and WebKit green every night**, not just Chromium (W-70) | in progress |
| 🔜 | **The agent skills tried in Claude Code, Kiro and Codex** on a real prompt (W-48) | needs a hands-on run |
| 🔜 | Every sheet-protection switch honoured in Edit: format, sort, filter (B-038) | named |
| 🔜 | Excel 2010 `x14:` validation and conditional-format rules read and written (B-041) | named |
| 💭 | **Live pivot tables**, recalculated in the grid ([proposal](work/proposals/pivots.md)) | waiting for a host to ask |
| 💭 | **Dismiss** a workbook's own validation warning for one review ([proposal](work/proposals/dismiss-workbook-errors.md)) | proposed |
| 💭 | Keep the workbook in IndexedDB as well as memory (B-025) | deferred |

---

## FAQ

**Is my file uploaded anywhere?**
No. sheetpane reads, edits and checks it in the tab. Its only network requests are the GETs for the `src` and `rules-src` you set ([law L11](records/0013_LAW-11-workbook-stays-in-the-browser.md)).

**Do formulas work?**
With the [`formulas`](packages/formulas/README.md) plugin, yes: it recalculates as you edit, using IronCalc in WebAssembly, loaded only when you use it. Without it, a formula cell shows the value saved in the file.

**How do I save the edited file?**
Press Download, or call `export()` on `<sheetpane-excel>` for a `Blob` with every change. sheetpane keeps every change in memory; storing the file is your app's job ([law L6](records/0008_LAW-6-edits-in-memory-export-with-changes.md)).

**Can I use the reader and writer without the UI?**
Yes. [`@sheetpane/import`](packages/import/README.md) reads `.xlsx` / `.csv` into a plain JavaScript object, in a page or in Node. [`@sheetpane/export`](packages/export/README.md) turns one back into a file.

**Which frameworks?**
Any. The elements are standard web components; React, Vue, Svelte, Solid and Angular each need one line of setup ([guide](packages/grid/README.md#vue-svelte-solid-angular)).

**Will the API change?**
Until 1.0 it can change between minor versions. The [CHANGELOG](CHANGELOG.md) says what changed and what to do, under *Before you upgrade*.

**Where do the error rules come from?**
Three places: a JSON rules file, column rules you set in code, and the workbook's own data validation (with the [`validation`](packages/validation/README.md) plugin). Every error code is listed in [`docs/ERRORS.md`](docs/ERRORS.md).

---

## Packages

**One version for all**, ESM with types.

| package | what it is |
|---|---|
| [`@sheetpane/grid`](packages/grid/README.md) | the two web components, the pane's workbook, the plugin host |
| [`@sheetpane/import`](packages/import/README.md) | `.xlsx` / `.csv` in, a plain JavaScript workbook out |
| [`@sheetpane/export`](packages/export/README.md) | a workbook in, `.xlsx` / `.csv` out — build, patch the original, `download()` |
| [`@sheetpane/testing`](packages/testing/README.md) | locators and actions for Playwright and Vitest browser mode |
| [`@sheetpane/fixtures`](packages/fixtures/README.md) | known workbooks for your tests |
| [`@sheetpane/skills`](packages/skills/README.md) | agent skills for Claude Code, Kiro and Codex |
| [`@sheetpane/mcp`](packages/mcp/README.md) | a read-only MCP server: the API, and workbook inspection |

**Dependencies:** none at runtime outside the project, except the engines two
plugins use — [`numfmt`](https://github.com/borgar/numfmt) and
[IronCalc](https://github.com/ironcalc/IronCalc). Every dependency is free and
open source ([law L2](records/0004_LAW-2-foss-dependencies.md)).

---

## Contributing

**Welcome — especially failing files and bug reports.** Read [CONTRIBUTING.md](CONTRIBUTING.md); report security issues privately ([SECURITY.md](SECURITY.md)); everyone follows the [Code of Conduct](CODE_OF_CONDUCT.md).

You need **Node 22+**, **pnpm 10** and [**just**](https://just.systems).

```sh
just install     # pnpm install --frozen-lockfile
just check       # type-check, test (Node + Chromium) and build
just demo-html   # the plain HTML demo at http://127.0.0.1:5173
```

<details>
<summary><b>Every command</b></summary>

<br>

| command | does |
|---|---|
| `just test-pkg <name>` | one package's tests, e.g. `just test-pkg grid` |
| `just test-browsers` | the browser suites in Chromium, Firefox and WebKit |
| `just demo-react` | the React 19 demo at http://127.0.0.1:5174 |
| `just demo-check` | both demos driven end to end in Chromium |
| `just pack-check` | every package packed as npm would publish it, and checked |
| `just release <version>` | bump every package together, check, push; a GitHub Release publishes ([RELEASING.md](RELEASING.md)) |

</details>

**How the project is run.** Every rule lives in one record under
[`records/`](records/README.md); the live queue is
[`work/OPEN-WORK.md`](work/OPEN-WORK.md); the map is
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Much of the code was written by
AI coding agents working under those records — **the tests, not the prose, are
the evidence**. Start at [`CLAUDE.md`](CLAUDE.md) if you are one.

---

<div align="center">

[MIT licence](LICENSE) © Arpit Arya — free for commercial and private use

</div>
