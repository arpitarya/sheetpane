# sheetpane — the one place to run the repo's commands (W-10).
# Every recipe calls pnpm; the pnpm scripts are the real commands, so nothing needs just to build.

# list the recipes
default:
    @just --list

# install every workspace package from the lockfile
install:
    pnpm install --frozen-lockfile

# build every package to dist/
build:
    pnpm -r --if-present build

# run every test suite (Node + Chromium), coverage reported, export gated at 90 % lines
test *args:
    pnpm exec vitest run --coverage {{args}}

# run one package's tests, e.g. `just test-pkg export`
test-pkg name *args:
    pnpm exec vitest run --project {{name}} {{args}}

# @sheetpane/export's tests (Node)
test-export *args:
    pnpm exec vitest run --project export {{args}}

# @sheetpane/grid's tests (browser)
test-grid *args:
    pnpm exec vitest run --project grid {{args}}

# the browser suites in Chromium, Firefox and WebKit (nightly)
test-browsers:
    SP_BROWSERS=chromium,firefox,webkit pnpm exec vitest run

# type-check every package, strict
typecheck:
    pnpm -r --if-present typecheck

# typecheck, test and build — what CI runs
check: typecheck test build

# pack every package as npm would publish it and check the tarballs
pack-check: build
    node scripts/pack-check.mjs

# each `npm create sheetpane` template scaffolded, installed from `pnpm pack` tarballs, built and its test run (W-43), e.g. `just create-check react vue`
create-check *templates: build
    node scripts/create-check.mjs {{templates}}

# bump every package to one version, check, tag and publish them together (lockstep)
release version:
    git diff --quiet && git diff --cached --quiet || (echo "commit first" && exit 1)
    node scripts/release.mjs {{version}}
    just check pack-check
    git commit -am "release v{{version}}"
    git tag v{{version}}
    pnpm -r publish --access public --no-git-checks
    git push --follow-tags

# the plain-HTML demo at http://127.0.0.1:5173 (builds the packages first)
demo-html: build
    node scripts/serve.mjs examples/html 5173

# the React 19 demo at http://127.0.0.1:5174 (Vite dev server)
demo-react: build
    pnpm --filter sheetpane-example-react dev

# the live playground as a static site in site/ (W-44): `/` the HTML gallery, `/react/` the React one
site: build
    node scripts/build-site.mjs site

# llms.txt and llms-full.txt from the READMEs, docs, laws, records and skills (W-38)
llms:
    node scripts/build-llms.mjs

# rewrite @sheetpane/fixtures' files and manifest (W-42; hand-built, not Excel-saved)
fixtures: build
    node packages/fixtures/scripts/make.mjs

# open both demos in Chromium and use them: flag, resolve, edit, download, font, pop-up, CSV, refusal (W-09), every gallery tab (W-32)
demo-check: build
    node scripts/demo-check.mjs examples/html examples/react/dist

# the same, with both demos installed from `pnpm pack` tarballs instead of the workspace (W-09 DoD 6)
demo-packed: build
    node scripts/demo-packed.mjs

# remove build output and installed modules
clean:
    rm -rf node_modules packages/*/node_modules packages/*/dist examples/*/node_modules examples/react/dist
