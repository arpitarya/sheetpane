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

# run every test suite
test:
    pnpm -r --if-present test

# type-check every package, strict
typecheck:
    pnpm -r --if-present typecheck

# typecheck, test and build — what CI runs
check: typecheck test build

# remove build output and installed modules
clean:
    rm -rf node_modules packages/*/node_modules packages/*/dist
