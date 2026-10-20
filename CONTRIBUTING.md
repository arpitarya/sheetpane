# Contributing to sheetpane

Thanks for helping. **The most useful thing you can send is a file that opens wrongly**, or a minimal copy of one. Every reader fix starts there.

---

## Ways to help

| you have | do this |
|---|---|
| A file that opens, shows or exports wrongly | [Open a file issue](https://github.com/arpitarya/sheetpane/issues/new?template=file_issue.yml), with the file (or a minimal copy) attached and the app that saved it |
| A bug in the grid, the errors panel or a plugin | [Open a bug report](https://github.com/arpitarya/sheetpane/issues/new?template=bug_report.yml): version, browser, the smallest host page that shows it |
| An idea or a missing feature | [Open a feature request](https://github.com/arpitarya/sheetpane/issues/new?template=feature_request.yml) |
| A fix of your own | Open a pull request (below) |
| A security issue | Don't open a public issue — see [SECURITY.md](SECURITY.md) |

**Never attach a file with real personal or client data.** Replace names and numbers first; the structure is what matters.

---

## Build and test

You need **Node 22+**, **pnpm 10** and [**just**](https://just.systems).

```sh
git clone https://github.com/arpitarya/sheetpane.git
cd sheetpane
just install       # pnpm install --frozen-lockfile
just check         # type-check, test (Node + Chromium) and build
```

| command | does |
|---|---|
| `just test-pkg <name>` | one package's tests, e.g. `just test-pkg grid` |
| `just test-browsers` | the browser suites in Chromium, Firefox and WebKit |
| `just demo-html` | the plain HTML demo at http://127.0.0.1:5173 |
| `just demo-react` | the React 19 demo at http://127.0.0.1:5174 |
| `just demo-check` | both demos driven end to end in Chromium |
| `just pack-check` | every package packed as npm would publish it, and checked |

---

## The rules a change must keep

sheetpane is governed by **laws**, each stated once in [`records/`](records/README.md). The ones a contribution meets most often:

- **XLSX and CSV only** — anything else is refused with a reason, never half-read ([L3](records/0005_LAW-3-xlsx-and-csv-only.md)).
- **The workbook never leaves the browser** — no upload, beacon or telemetry, and a test checks it ([L11](records/0013_LAW-11-workbook-stays-in-the-browser.md)).
- **Every change is held in memory, and export carries it** ([L6](records/0008_LAW-6-edits-in-memory-export-with-changes.md)).
- **The sheet and the errors panel are always in sync** ([L7](records/0009_LAW-7-surfaces-always-in-sync.md)).
- **The examples change with the packages** ([L10](records/0012_LAW-10-examples-maintained.md)), and **every plugin is in the demos** ([L12](records/0014_LAW-12-every-plugin-in-the-demos.md)).
- **Every dropdown is wholly visible**, inside the viewport, on top ([L13](records/0015_LAW-13-popups-always-visible.md)).
- **Every dependency is free and open source** ([L2](records/0004_LAW-2-foss-dependencies.md)).

**The records are the spec.** A change to a package updates the record that owns it — the owner is in the register's Ownership table. Install the guard once:

```sh
ln -sf ../../scripts/sr-guard.sh .git/hooks/commit-msg
```

The map of the code is [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); the live queue is [`work/OPEN-WORK.md`](work/OPEN-WORK.md).

---

## Pull requests

1. **One change per PR** — a reader fix, a grid behaviour, or one plugin.
2. **Add a test** that fails without your change. For a reader fix, add the minimal file as a fixture.
3. **Run** `just check`, and `just demo-check` if the UI changed.
4. **Update** the owning record, the package README if its API changed, the examples (L10), and [CHANGELOG.md](CHANGELOG.md) under *Unreleased* when users will notice.

Releases are cut by the maintainer only — [RELEASING.md](RELEASING.md).

By contributing you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
