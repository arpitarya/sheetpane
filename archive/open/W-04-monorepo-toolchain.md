---
type: Handoff
name: W-04
description: "Arpit asked on 2026-10-18 for the repo to be a monorepo with two packages — export, and the UI (Excel and errors). The skeleton landed the same day; the toolchain is what is left."
item: W-04
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-04 — Make the monorepo build and test

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Lay out the monorepo: npm workspaces, two packages, shared TypeScript settings | one repo, two packages, linked locally | ✅ 2026-10-18 |
| 2 | Add the build, the test runner and type-checking, on pnpm and just (W-10) with the runner W-11 picks | `just build` / `just test` / `just typecheck` that mean something | ✅ |
| 3 | Run the same checks on every push | a red build before a bad merge | ✅ |
| 4 | Set up publishing for the two packages — one version, released together | `just release <v>` publishes every package from one tag | ✅ recipe; first publish waits on the npm org |

**Arpit, 2026-10-18:** *"Create this repo as a mono repo. We will have
multiple packages. One for Excel and CSV export, the other one for the UI
component, Excel and error."*

**Model:** Sonnet — every step has a command that proves it.

## Goal

The repo builds, tests and type-checks both packages from a clean clone with
one command each, in CI as well as locally, before any feature code lands.

## What step 1 landed (2026-10-18)

| path | what it is |
|---|---|
| `package.json` | private root; **npm workspaces** `packages/export`, `packages/grid`; `build` / `test` / `typecheck` fan out with `--workspaces --if-present` |
| `package-lock.json` | lockfile; both workspaces resolve |
| `tsconfig.base.json` | strict TypeScript shared by both packages |
| `packages/export/` | `@sheetpane/export` — manifest, `tsconfig.json`, README, empty `src/index.ts` |
| `packages/grid/` | `@sheetpane/grid` — depends on `@sheetpane/export`; `src/pane/`, `src/excel/`, `src/errors/` stubs; `./style.css` export reserved |

**Why npm workspaces (superseded):** it ships with Node and adds no tool to
install. **Arpit overruled this on 2026-10-18: pnpm, plus a justfile — W-10.**
The table above shows step 1 as it landed, before that switch. **W-10 landed it:** `pnpm-workspace.yaml` (`packages/*`), `pnpm-lock.yaml` (the lockfile; `package-lock.json` is gone), a root `justfile`; root scripts fan out with `pnpm -r --if-present`.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · skeleton | the layout above; `pnpm install --frozen-lockfile` resolves every workspace package (W-10) | ✅ |
| 2 · build | each package builds to `dist/` with `.d.ts`; `@sheetpane/grid` builds `dist/style.css` from the Proof tokens | ✅ `tsc -p tsconfig.build.json` per package → `dist/` with `.d.ts` and maps; `@sheetpane/grid` writes `dist/style.css` from `src/tokens.ts` (Proof tokens as `--sp-*`, fonts dropped) — `just build` green |
| 3 · test | **Vitest**, one root config, two projects — `export` in Node, `grid` in browser mode on Playwright (Chromium per push; Firefox and WebKit nightly); no jsdom; coverage reported, 90 % lines gating `export` ([`testing.compare.md`](../compare/testing.compare.md)) | ✅ Vitest 5.0.5, one root `vitest.config.ts`: `repo` + `export` in Node, every other package in browser mode on Playwright 1.64.1 (Chromium per push; `just test-browsers` / nightly for Firefox and WebKit); no jsdom; v8 coverage on every run, 90 % lines gating `packages/export/src/**` — `just test`: 45 tests green |
| 4 · typecheck | `just typecheck` (`pnpm -r typecheck`) is strict and green | ✅ `pnpm -r typecheck` (TypeScript 7.0.2, strict) plus the root over `test/` — green |
| 5 · CI | a workflow runs install, typecheck, test and build on every push and PR | ✅ `.github/workflows/ci.yml` (install, `just check`, `just pack-check`, Chromium) on push and PR; `nightly.yml` three engines — green on GitHub Actions run 39122100445 (`0be1bfa`, 2026-10-18) |
| 6 · publish | **lockstep versioning** (ruled 2026-10-18, SR-LAW-8 Consequences): one version for both packages, bumped together; `@sheetpane/grid` pins `@sheetpane/export` to the same version; a release recipe bumps, tags and publishes both; SR-LAW-8's veto command (reads `packages/*/package.json`) runs green | ✅ `just release <v>` + `scripts/release.mjs` (one version on every package), `pnpm -r publish`; `scripts/pack-check.mjs` proves packed manifests pin `@sheetpane/*` exactly and drop `source`; SR-LAW-8's veto command (now `packages/*/`) prints `publishable` for all ten. **Not run:** the first publish needs the `@sheetpane` npm org (the decider's) |
| 7 · guard | the commit guard is installed (`ln -sf ../../scripts/sr-guard.sh .git/hooks/commit-msg`) and the hooks in `.claude-pending/` are reviewed for moving to `.claude/` | ✅ `.git/hooks/commit-msg → ../../scripts/sr-guard.sh` installed 2026-10-18; the hooks already moved from `.claude-pending/` to `.claude/` (committed `3642c13`) and are wired in `.claude/settings.json` |

## Blockers

None. The first real publish waits on the `@sheetpane` npm organisation — the
decider's, and not part of this item's DoD.

## Record affected

**[SR-BUILD](../../records/0102_BUILD.md)** — written by this item; it owns
the root build files, `test/`, the build scripts and the workflows.

## Hazards

- **The laws now have checks owed** that a toolchain makes possible — B-008
  (FOSS licence check), B-012 (custom element, no framework peer), B-015 (no
  fonts), B-023 (publishable package). They stay backlog rows until Arpit
  promotes one; promoting one into this item deletes its row in the same change.
- **The root `package.json` is `private`** (the monorepo root); the two packages
  under `packages/` are the publishable ones (L8).
- **No dependency creep into `dependencies`.** Toolchain goes in `devDependencies` only.
- **Browser APIs in Node tests** — `CompressionStream('deflate-raw')` and
  `DOMParser` differ between Node, jsdom and browsers; test where it runs.

## Reference

- [`../../package.json`](../../package.json) · [`../../tsconfig.base.json`](../../tsconfig.base.json)
- [`../reference/README.md`](../reference/README.md)

## Prompt — paste into Claude Code

```text
You are working W-04 in the sheetpane monorepo: make it build and test.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, this file
   (work/open/W-04-monorepo-toolchain.md), package.json, tsconfig.base.json
   and packages/*/package.json.
2. Plan the build tool, test runner and CI workflow; write the plan and why
   into this file's body. Dev dependencies only, every one FOSS (L2).
3. Implement DoD 2–7. Lockstep versioning is decided; do not add changesets.
4. Verify from a clean clone: pnpm install --frozen-lockfile && just check
   (W-10 defines the recipes). Tick each DoD row with its evidence, then do what
   SR-WORK-DOCS decision 10 says every task owes.
```
