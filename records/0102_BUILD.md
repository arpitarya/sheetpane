---
type: Standing Record
kind: component
name: SR-BUILD
title: "SR-BUILD (0102) — the monorepo build: pnpm, just, tsc, Vitest, CI, lockstep release"
description: "How the monorepo installs, type-checks, builds, tests, runs in CI and publishes every package under packages/ at one version."
status: accepted
date: 2026-10-18
feature: the monorepo toolchain
owns: [package.json, pnpm-lock.yaml, pnpm-workspace.yaml, justfile, tsconfig.base.json, tsconfig.json, vitest.config.ts, test/, scripts/build-grid-css.mjs, scripts/pack-check.mjs, scripts/release.mjs, scripts/npm-trust.sh, scripts/check-version-parity.mjs, scripts/smoke-built.mjs, scripts/release-notes.mjs, scripts/test-durations.mjs, .github/actions/, RELEASING.md, scripts/serve.mjs, scripts/demo-check.mjs, scripts/demo-packed.mjs, scripts/build-site.mjs, scripts/build-llms.mjs, scripts/build-manifest.mjs, scripts/build-starters.mjs, scripts/build-starters.d.mts, llms.txt, llms-full.txt, examples/, README.md, .github/workflows/]
laws: [L2, L4, L5, L8, L10]
timestamp: 2026-10-19T15:00:00Z
content_sha: ""
ratifies: W-04
---

# SR-BUILD — the monorepo build

## §1 — For humans

**One command per job, from a clean clone.** `just install`, `just typecheck`,
`just test`, `just build`, `just check` (all three). The `justfile` only wraps
the pnpm scripts, so nothing *needs* just.

**Every package is published at the same version.** `just release 1.2.3`
bumps every package under `packages/`, runs the checks and pushes a tag; CI
publishes them together from that tag. A plugin always pins the exact grid it was tested with.

**Tests run where the code runs.** `@sheetpane/export` in Node; every package
that touches the DOM in a real browser (Chromium on every push, Firefox and
WebKit nightly). No simulated DOM.

```mermaid
flowchart LR
    C["clean clone"] --> I["pnpm install --frozen-lockfile"]
    I --> B["build: tsc → dist/ + .d.ts; grid style.css"]
    B --> T["typecheck: tsc per package, strict"]
    T --> V["test: Vitest — Node + Chromium, coverage"]
    V --> P["pack-check: tarballs as npm sees them"]
    P --> R["release: one version, tag; CI publishes"]
```

<details>
<summary><b>ASCII twin</b> — the same diagram, for terminals and diffs</summary>

```text
   clean clone -> pnpm install --frozen-lockfile -> build (tsc -> dist/, style.css)
     -> typecheck (tsc, strict) -> test (Vitest: Node + Chromium, coverage)
     -> pack-check (tarballs as npm sees them) -> release (one version, tag; CI publishes)
```

</details>

---

## §2 — For agents

### Context

W-04 asked for a repo that builds, tests and type-checks every package from a
clean clone, locally and in CI, before feature code lands. W-10 moved it to
pnpm and a justfile; the testing verdict chose the runner.

### Decision

1. **Package manager:** pnpm, pinned by `packageManager` in the root
   `package.json`; the workspace is `packages/*`, `examples/*` and
   `.fux/node` (`pnpm-workspace.yaml`).
   Internal dependencies and peers use `workspace:*`; `pnpm publish` rewrites
   them to the exact version.
1a. **The docs index (fux, 2026-10-19):** `fux.toml` (policy) and `.fux/`
   (the committed index, its sources, decoders and the Node reader
   `.fux/node`, which pulls `fux-engine` from npm — MIT, L2) index the
   records, `work/`, `docs/` and the top-level docs, with `archive/` marked
   archived. Agent files are Claude-only (`.claude/agents`, `commands`,
   `rules`, `output-styles`, `skills/fux-*`). `.claude/hooks/fux-index-hint.sh`
   is fux's advisory grep hint and is not wired. The index is not kept
   current by any hook: a doc edit leaves it stale until `fux ingest` runs.
   The `.fux/node` package is private and never published.
2. **Commands:** the root `package.json` scripts are the real commands
   (`build`, `test`, `typecheck`); the `justfile` wraps them and adds
   `check`, `test-pkg`, `test-export`, `test-grid`, `test-browsers`,
   `pack-check`, `release`, `clean`.
3. **Build:** plain `tsc` per package (`tsconfig.build.json`, `src/` →
   `dist/`, ESM with `.d.ts` and maps). No bundler: consumers bundle; the
   output is native ESM with `.js` import specifiers, so it also loads from
   plain HTML (SR-LAW-4). `@sheetpane/grid` also writes `dist/style.css` from
   its token module.
4. **Type-check:** `tsc --noEmit` per package over `src/` and `test/`, and
   at the root over `test/` and `vitest.config.ts`; `tsconfig.base.json` is
   strict, with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
   The examples are the exception to decision 5: they type-check against the
   built `dist/`, as a host app does, so `just check` builds first (a clean
   clone failed every CI run while it type-checked first).
5. **Source condition:** every `exports` entry carries a `source` condition
   pointing at `src/`, so type-check and tests read sibling packages without a
   build. `publishConfig.exports` drops it from the published manifest. The
   grid's framework typings (W-37) are generated `.d.ts` files
   committed in `src/frameworks/`: `source` points at the `.d.ts`, the build
   copies them into `dist/frameworks/` with an empty `.js` for `import`.
5a. **Entries** (each with its `source` condition, decision 5):

    | entry | what | DOM |
    |---|---|---|
    | `@sheetpane/grid` | the elements, registered on import, and the API | a page (imports anywhere) |
    | `@sheetpane/grid/check` | the pane's checks with no page — `check()`, `loadWorkbook()`, the store, the rules checker (W-54, SR-GRID 22f) | none |
    | `@sheetpane/grid/static` | a range as one static HTML `<table>` — `renderStatic()`, `loadWorkbook()` (W-67, SR-GRID 22g) | none |
    | `@sheetpane/grid/jsx` · `/vue` · `/svelte` · `/solid` | framework typings (W-37) | types only |
    | `@sheetpane/grid/style.css` · `/rules.schema.json` · `/llms.txt` · `/custom-elements.json` · `/vscode.*-custom-data.json` · `/web-types.json` | data | — |
    | `@sheetpane/<plugin>` | the plugin, registered on import | none |
    | `@sheetpane/<plugin>/ui` | its controls (numfmt, formulas, styles, validation, condfmt, charts, visibility) | a page |
    | `@sheetpane/validation/check` | the plugin unregistered (checking only, no export switch), and `check()` with it on (W-54, SR-VALIDATION 11) | none |
    | `@sheetpane/fixtures/files/*` | the fixture files | — |

    A `/check` or `/static` entry's import graph holds no element module and names no
    `customElements`, `document` or `window` (`test/check-entries.test.ts`).
6. **Tests:** Vitest, one root config. Project `repo` and `export` run in
   Node; every other package runs in browser mode on Playwright, and so do
   `@sheetpane/export`'s `*.browser.test.ts` files (project `export-browser`,
   the engine-determinism proof), and so do the React hook recipes'
   tests under `examples/react/test` (project `react-recipes`, against the
   demo's own React). `SP_BROWSERS` selects the engines.
   Browser tests run at a 1280 × 800 viewport. Node projects carry the
   `source` condition in `ssr.resolve` as well, so
   they never read a stale `dist/`. `.xlsx` and `.csv` fixtures load as assets
   (`?inline`). `coverage/` and `.vitest/` are ignored output. Two browser
   commands (`test/commands.ts`), `armDownload` and `takeDownload`, let a test
   catch a real download through Playwright. Dev-only readers
   for read-back tests (ExcelJS, PapaParse, fflate) are dev dependencies of
   the package that uses them; so is any `@sheetpane/*` package a test
   imports (`workspace:*`). Coverage (v8) is reported on every `just test`;
   90 % lines on `packages/export/src/**` fails the run — in CI, the
   `coverage` job runs `@sheetpane/export`'s tests with coverage and holds that
   line, while the sharded test jobs collect none. CI shards (`--shard=k/n`)
   are balanced by measured time, not Vitest's path hash: `vitest.config.ts`'s
   sequencer puts the longest file first, each into the lightest shard, from
   `test/durations.json` (`just test-durations` re-measures it; an unlisted
   file counts 1 s). A wall-clock budget (a frame gap,
   pixels scrolled in 5 s) is asserted on a developer machine and only
   reported on a shared CI runner or under `--coverage` (`just check`; the
   instrumented code is not the code being timed): `vitest.config.ts`
   provides `timingBudgets` (off when `CI` or `SP_NO_BUDGETS` is set — the
   config sets the latter under `--coverage`, and Node tests read it), the
   grid's test helpers export it as `budgets`, and the test logs its numbers
   either way. Every structural
   assertion in the same test still holds everywhere.
7. **Package checks** (`test/packages.test.ts`): each package is public,
   `@sheetpane/<dir>`, MIT, ESM with types; one version across all (lockstep);
   `workspace:*` for `@sheetpane/*`; no UI framework as a dependency or peer;
   no third-party runtime dependency except `numfmt` and `@ironcalc/wasm`,
   each pinned exactly; no font file, `@font-face`, web-font URL or named
   `font-family` in any package source; no network call in any package's
   shipped code but the three reads [SR-LAW-11](0013_LAW-11-workbook-stays-in-the-browser.md) decision 4 allows. Each package ships `dist` only —
   except `@sheetpane/fixtures`, which ships `files/` too, so that `url()`
   reaches them from `src/` and `dist/` alike (W-42), and `@sheetpane/skills`,
   which ships `skills/`, `entry/` and `bin/`, has no build and is a
   dependency of every other package (W-35, SR-SKILLS). A plugin that writes
   into the package at export depends on `@sheetpane/export` (`workspace:*`):
   `@sheetpane/visibility` (W-49) and `@sheetpane/validation` (W-58) — and
   `@sheetpane/grid`, which ships `custom-elements.json` beside `dist` (W-37).
   **`create-sheetpane`** (W-43, SR-CREATE) is the one unscoped package — `npm
   create sheetpane` resolves that name — with `files: ['bin', 'templates']`,
   a bin, no dependencies and no build; the font scan walks its `bin/` and
   `templates/`.
   Grid's build is `tsc` → `build-grid-css.mjs` → `build-manifest.mjs` (the
   manifest, the editor data, the framework typings; no dependency); grid has
   `@types/react` as a dev dependency so the React augmentation type-checks in
   the workspace. `test/types/` type-checks a usage per framework — React
   against the real `@types/react`, Vue, Svelte and Solid against stubs (none
   is installed in the repo); the root `tsconfig.json` excludes it.
7a. **TSDoc (W-36):** every symbol reachable from a package's `exports`
    carries TSDoc that survives into the built `.d.ts` (`removeComments`
    stays off): a summary; for a function `@param` per top-level parameter
    and `@returns` unless it returns `void`; a custom element class lists its
    Attributes, a `@fires` per event it dispatches, an `@example` and a `@see`
    to its record. `test/tsdoc.test.ts` reads the built declaration files —
    TypeScript 7 has no stable JavaScript compiler API, so `test/tsdoc-walk.ts`
    follows `export … from`, `export *`, aliases, re-exported imports and
    `@sheetpane/<pkg>` re-exports itself — and fails naming each symbol; it
    also type-checks every `@example` code block against the built packages.
8. **CI:** `.github/workflows/ci.yml` runs on every push to any branch, every
   PR and on demand, every job in parallel and set up by
   `.github/actions/setup` (Node; the pinned pnpm, installed with npm; the
   pnpm store cached by the lockfile; Playwright's Chromium cached by its
   version, without apt dependencies — the Ubuntu image carries them). Jobs:
   `lint` (version parity, build, typecheck — the repo's lint); `test` (the
   whole suite, Node + Chromium, in four balanced shards, decision 6);
   `coverage`; `package` (`pack-check` and `demo-check` in Chromium);
   `portable` (ubuntu, macos and windows × Node 22 and the current LTS:
   version parity, build, typecheck, the Node unit tests, and
   `scripts/smoke-built.mjs`, which installs every package from its packed
   tarball with npm into an empty folder and imports it from plain Node (and
   runs each `/check` entry on a CSV, W-54, and renders one with
   `/static`, W-67), so
   the BUILT package is what is tested); and `create` — a matrix over the six
   `create-sheetpane` templates running `scripts/create-check.mjs`
   (SR-CREATE decision 5). A branch's newer push cancels its older run; on
   `main` every run finishes, since `publish.yml` reads each commit's verdict.
   The target is about two minutes of wall time. Every package's `engines.node` is `>=22` (the
   decider, 2026-10-19; Node 20 is past end of life). Build scripts resolve
   paths with `fileURLToPath`, never `URL.pathname`, so they run on Windows;
   `nightly.yml` runs the browser suites in Chromium, Firefox and WebKit;
   `pages.yml` (W-44) on a release tag builds the live playground — `just
   site` → `site/` (`scripts/build-site.mjs`: the HTML gallery at `/` with
   every file its import map names copied in, the React gallery at `/react/`
   with a relative base, the version in both headers, no third-party script)
   — checks it with `demo-check`, and deploys it to GitHub Pages;
   `publish.yml` publishes the packages when a GitHub Release is published
   (decision 9).
8b. **Starters and links (W-44):** `scripts/build-starters.mjs` (`just
    starters`) scaffolds every `create-sheetpane` template with the CLI itself
    into `examples/starters/<template>` (not workspace members) with an index
    of **Open in StackBlitz** links pinned like `llms.txt` (`v<version>`, `main`
    before the first release); `release.mjs` reruns it; `test/starters.test.ts`
    fails when they are stale and checks each has `dev` and `build`. StackBlitz
    installs from npm, so a starter runs once its version is published — the
    test checks the folders, not StackBlitz. The root README, the grid and
    `create-sheetpane` READMEs, `llms.txt` and the setup skill link the live
    playground (`https://arpitarya.github.io/sheetpane/`, decision 8) and the
    starters.
9. **Release** (`RELEASING.md` is the walkthrough): `just release <version>`
   — clean tree required; every package set to the version
   (`scripts/release.mjs`, which then rebuilds the starters, the Claude Code
   plugin and `llms.txt`); version parity; `just check pack-check`; a commit
   pushed to `main` as `chore(release): v<version>` (commits follow
   Conventional Commits, the decider, 2026-10-19), no tag; it refuses unless
   `CHANGELOG.md` has a `## <version>` section. After `ci.yml` is green on
   that commit, `just publish <version>` publishes the GitHub Release
   `v<version> — <summary>` (the heading's summary) with that section as its
   notes (`scripts/release-notes.mjs`),
   and that alone runs
   `.github/workflows/publish.yml`. Its `build` job refuses unless `ci.yml`
   concluded `success` on the commit on `main`, checks version parity and that
   the tag is the packages' version, builds once and packs every public
   package (`pnpm pack` rewrites `workspace:*`) into one artifact. Its
   `publish-npm` job (environment `npm`) never rebuilds: it checks each
   tarball (README, LICENSE and the build output present; no `src/`, `test/`
   or `workspace:`) and publishes it with npm ≥ 11.5.1, `--provenance`, the
   `next` dist-tag for a version with a `-` and `latest` otherwise; a version
   already on npm is skipped, so a failed run is re-run. **No token** — npm
   trusted publishing (OIDC; the decider's ruling, 2026-10-19: no
   `NPM_TOKEN`). Trusted publishing needs the package to exist: the first
   version is published once by hand, then each package trusts `publish.yml`
   and environment `npm` (npmjs.com, or `scripts/npm-trust.sh`). Neither name
   may change: npmjs.com is bound to both. Never `npm publish` from a package
   folder: npm ships `workspace:*` literally.
9a. **llms.txt (W-38):** `scripts/build-llms.mjs` (`just llms`, no
    dependencies, deterministic) writes `llms.txt` (llmstxt.org: an H1, a
    summary, sections Start · Elements · Plugins · Rules and errors · Testing
    and tooling · Skills · Records of absolute links) and `llms-full.txt` (the
    package READMEs, the docs, the laws and the component records inlined,
    each under its source path — never `work/` or `archive/`) at the repo
    root; the grid build copies both into `dist/` (`@sheetpane/grid/llms.txt`).
    Links are GitHub URLs pinned to `v<version>` (`main` before the first
    release); `release.mjs` rewrites them with the version, and
    `test/llms.test.ts` fails when either is stale (it prints the full file's
    size — over 200 KB is a hint to split per package).
9b. **Version parity:** `scripts/check-version-parity.mjs` (`just
    version-parity`; Node standard library only) fails when any file holding
    the version disagrees: every `packages/*/package.json`, the plugin's
    `plugin.json`, each starter's `@sheetpane/*` pins and `tree/v…` links, and
    `blob/v…` in `llms.txt` and `llms-full.txt`. It runs in `ci.yml` (every
    job) and in `publish.yml`.
10. **Pack check:** `scripts/pack-check.mjs` packs each package as publish
    would and fails on a surviving `workspace:` or `source` entry or a missing
    exported file (for a subpath pattern such as `./files/*`, its folder).
11. **Demos:** `examples/html` (one `index.html`, an import map onto the
    packages' `dist/`, served by `scripts/serve.mjs`) and `examples/react`
    (Vite + React 19) are workspace members that depend on the packages by
    name and import only their public exports. `scripts/demo-check.mjs` uses
    both in Chromium (flag, resolve, edit + Download read back, font, pop-up,
    CSV, refusal; in React also the hooks strip and the column rules; the
    review steps driven by `@sheetpane/testing`, SR-TESTING) —
    `just demo-check`, on every push; `scripts/demo-packed.mjs`
    installs both from `pnpm pack` tarballs (every package, the eight plugins
    included) outside the workspace and runs the same check — `just
    demo-packed`, nightly. Both share one look (2026-10-19): a host bar
    (Views, Open file…, the CSV sample, the pop-up, Font, and Theme — light ·
    dark · auto, set on every component), the components filling the window,
    and a footer of host events (the `sheetpane-export` line names the file,
    the format and the first 12 hex digits of its SHA-256, W-65);
    `examples/react/src/demo.css` is the
    stylesheet the HTML demo inlines.
11a. **The plugin gallery (W-32):** both demos carry a second tab row —
    Review (the demo above) · Vanilla · Number formats · Styles · Formulas ·
    Validation · Conditional formats · Images · Charts · Comments · All
    plugins · Hide and show (W-49: `@sheetpane/visibility` — hide a row from
    its header menu, the marker unhides it) · Tables (W-61: `tables
    validation` on the showcase's Tables sheet — both tables in their style
    colours, and C9 typed "furlong" fails the list over `Units[Unit]`) · Compare (W-63:
    `@sheetpane/compare` — the fixtures' `compare/now.xlsx` against
    `compare/base.xlsx`, which the host fetches and hands to `compareWith`;
    `demo-check` reads the status line's 4 sheets · 7 rows · 2 cells, the
    amber price, the 7 listed changes and Alt+F5 to D4) · Review sheet (W-59:
    `@sheetpane/review` — the download gains a Review sheet listing the
    review, flagged cells coloured) · Rules file (W-33: the showcase's rules sample — `rules-src` in
    HTML, the `rules` prop in React — with `flagging="off"`). Every gallery
    tab opens one showcase workbook from `@sheetpane/fixtures` (SR-FIXTURES:
    the HTML import path `./node_modules/@sheetpane/fixtures/files/…`, a
    `?url` import in React; W-42) on its
    own `pane`, mounted when the tab first opens and kept after; a plugin's
    peer loads with it (condfmt with styles, charts with images). Both demos
    depend on all eight plugins, and the HTML import map lists them with
    `numfmt` (its ESM build, `dist/index.mjs`) and `@ironcalc/wasm`.
    `demo-check` asserts per tab: Vanilla plain (1.25, no overlay, no errors);
    1 1/4; the yellow fill; B6 recalculated; two rule errors; a data bar; the
    picture; both charts; the note and the thread; all of them together; lazy
    mounting and edits kept; the Rules file tab's six errors with no Flag issue
    and no card on F or a click; the Tables tab's two header fills and C9's
    list.

### Consequences

- **Codes (W-40):** `test/error-codes.test.ts` and its append-only `test/error-codes.lock.json` are SR-CODES' (carved out of `test/`); `test/ssr.test.ts` asserts the SSR refusal's code.
- **Enforced today:** decisions 6, 7 and 10 by `just check` / `just
  pack-check`, locally and in CI.
- **Owed by the decider:** the first publish by hand (any package not yet on
  npm), a trusted publisher per package (`publish.yml`, environment `npm`,
  *Allow npm publish*) and the `npm` environment in GitHub — `RELEASING.md`
  §One time; the `@sheetpane` organisation exists.
- **Still open:** the licence check over the whole lockfile (backlog B-008);
  decision 7 checks only the runtime allow-list.
- **Plugins must keep `@sheetpane/grid` as a dev dependency too** (a peer is
  not installed for the package's own tests).

### Alternatives considered

- A bundler (tsup, Vite library mode) — rejected: `tsc` output is already
  valid ESM; a bundler adds a tool and hides import mistakes.
- Building before type-checking siblings (project references) — rejected for
  the `source` condition: no build step in the edit–test loop.
- jsdom/happy-dom for DOM tests — rejected by the testing verdict.
- Changesets — rejected: lockstep needs one version, not per-package bumps.

### Reference (required)

- [`justfile`](../justfile) · [`vitest.config.ts`](../vitest.config.ts) ·
  [`test/packages.test.ts`](../test/packages.test.ts) ·
  [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
- [`work/compare/testing.compare.md`](../work/compare/testing.compare.md) — the runner.

### Veto condition

**Reopen this decision if:** a clean clone cannot run `just check` and
`just pack-check` green, or two packages carry different versions.

**How to check it:** `pnpm install --frozen-lockfile && just check pack-check`

---

## References

*Every source this record cites, gathered in one place. An archived document
is never listed here.*

**Records** — [SR-LAW-10](0012_LAW-10-examples-maintained.md) · [SR-LAW-2](0004_LAW-2-foss-dependencies.md) · [SR-LAW-4](0006_LAW-4-web-component.md) · [SR-LAW-5](0007_LAW-5-host-font.md) · [SR-LAW-8](0010_LAW-8-npm-package.md)

**Code**

- [`package.json`](../package.json) · [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) · [`justfile`](../justfile) · [`tsconfig.base.json`](../tsconfig.base.json)
- [`vitest.config.ts`](../vitest.config.ts) · [`test/packages.test.ts`](../test/packages.test.ts)
- [`scripts/pack-check.mjs`](../scripts/pack-check.mjs) · [`scripts/release.mjs`](../scripts/release.mjs) · [`scripts/build-grid-css.mjs`](../scripts/build-grid-css.mjs)
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) · [`.github/workflows/nightly.yml`](../.github/workflows/nightly.yml) · [`.github/workflows/publish.yml`](../.github/workflows/publish.yml) · [`RELEASING.md`](../RELEASING.md)

**Project docs**

- [`work/compare/testing.compare.md`](../work/compare/testing.compare.md)
