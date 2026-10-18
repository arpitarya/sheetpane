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

# bump every package to one version, check, tag and publish them together (lockstep)
release version:
    git diff --quiet && git diff --cached --quiet || (echo "commit first" && exit 1)
    node scripts/release.mjs {{version}}
    just check pack-check
    git commit -am "release v{{version}}"
    git tag v{{version}}
    pnpm -r publish --access public --no-git-checks
    git push --follow-tags

# remove build output and installed modules
clean:
    rm -rf node_modules packages/*/node_modules packages/*/dist
