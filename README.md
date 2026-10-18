# sheetpane

**View, edit and review `.xlsx` and `.csv` files inside any web page.** Two web
components — the sheet and its error list — always in sync through one
in-memory workbook, and an export that writes every change into a copy of the
uploaded file. Nothing is uploaded: files are read in the browser tab.

```html
<script type="module">import '@sheetpane/grid';</script>
<sheetpane-excel pane="q3" src="holdings.xlsx" mode="edit"></sheetpane-excel>
<sheetpane-errors pane="q3"></sheetpane-errors>
```

## Packages

| package | what it is |
|---|---|
| [`@sheetpane/grid`](packages/grid/README.md) | the web components `<sheetpane-excel>` and `<sheetpane-errors>`, the pane's workbook, the plugin host |
| [`@sheetpane/import`](packages/import/README.md) | `.xlsx` or `.csv` in, a plain JavaScript workbook out |
| [`@sheetpane/export`](packages/export/README.md) | a workbook in, `.xlsx` or `.csv` out — build, patch the original, CSV, `download()` |
| `@sheetpane/numfmt` · `formulas` · `styles` · `validation` · `condfmt` · `images` · `charts` · `comments` | optional plugins, each its own package |

All are published at one version, ESM with types, with no runtime dependency
outside the project except the two engines two plugins use.

## Try it

```sh
pnpm install
just demo-html     # the plain index.html demo — http://127.0.0.1:5173
just demo-react    # the React 19 demo — http://127.0.0.1:5174
just demo-check    # both demos, used in Chromium: flag, resolve, edit, export, font, pop-up, CSV, refusal
just demo-packed   # the same, with both demos installed from `pnpm pack` tarballs
```

`HOST=0.0.0.0 just demo-html` serves the plain demo to other devices on your
network (e.g. a phone).

## Develop

| command | does |
|---|---|
| `just install` | `pnpm install --frozen-lockfile` |
| `just check` | type-check, test (Node + Chromium, coverage) and build every package |
| `just test-pkg <name>` | one package's tests, e.g. `just test-pkg grid` |
| `just test-browsers` | the browser suites in Chromium, Firefox and WebKit |
| `just pack-check` | every package packed as npm would publish it, checked |
| `just release <version>` | bump every package together, check, tag, publish |

Requires Node 20+, pnpm 10 and [just](https://just.systems). How work is done
here — the records, the queue, the laws — starts at [`CLAUDE.md`](CLAUDE.md);
the map is [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Licence

MIT.
