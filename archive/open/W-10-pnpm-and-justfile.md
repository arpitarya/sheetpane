---
type: Handoff
name: W-10
description: "Arpit asked on 2026-10-18 to move the monorepo from npm workspaces to pnpm and to add a justfile as the one place to run its commands."
item: W-10
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-10 — Move to pnpm and add a justfile

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Swap npm workspaces for pnpm workspaces and a pnpm lockfile | strict installs — a package can only import what it declares | ✅ |
| 2 | Link the UI package to the export package through pnpm's workspace protocol | `@sheetpane/grid` always uses the local `@sheetpane/export` | ✅ |
| 3 | Add a `justfile` at the root with one recipe per everyday command | `just build`, `just test`, `just check` — one place to look | ✅ |
| 4 | Change every live doc and command from `npm …` to `pnpm …` / `just …` | no stale instructions | ✅ |

**Arpit, 2026-10-18:** *"I want to use PNPM and set up just file as well."*

**Model:** Sonnet — every step has a command that proves it.

## Goal

A clean clone installs with `pnpm install --frozen-lockfile`, and `just` lists
and runs the repo's commands. npm workspaces and `package-lock.json` are gone.
This overrides W-04's original choice of npm workspaces.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · pnpm | `pnpm-workspace.yaml` lists `packages/*`; root `package.json` drops `workspaces` and pins `"packageManager": "pnpm@<exact version>"`; `package-lock.json` deleted, `pnpm-lock.yaml` committed | ✅ `pnpm-workspace.yaml` (`packages/*`); `packageManager: pnpm@10.28.2`; `package-lock.json` removed, `pnpm-lock.yaml` committed |
| 2 · protocol | `packages/grid/package.json` depends on `@sheetpane/export` through `workspace:` (`*` or `^`, with the reason written here) | ✅ **`workspace:*`** for every internal dependency and peer (grid → export; plugins → grid). Why: versions are lockstep (SR-LAW-8), so the published pin must be the *exact* same version — `pnpm publish` rewrites `workspace:*` to `0.0.0`-style exact versions, `workspace:^` would publish a range |
| 3 · scripts | root scripts fan out with `pnpm -r` (`build`, `test`, `typecheck`); `package.json` scripts stay the real commands, so nothing *needs* `just` to build | ✅ root `build` / `test` / `typecheck` are `pnpm -r --if-present …`; the justfile only wraps them |
| 4 · justfile | root `justfile`: the default recipe runs `just --list`; recipes `install`, `build`, `test`, `typecheck`, `check` (typecheck + test + build), `clean`; each one calls pnpm, with a one-line comment that `just --list` shows | ✅ `justfile`: `default` (`just --list`), `install`, `build`, `test`, `typecheck`, `check`, `clean`, each with its `just --list` comment |
| 5 · getting just | how a contributor and CI get `just` is decided and written here — a system install (`brew`, `cargo`, a prebuilt binary) or an npm-distributed binary as a dev dependency so `pnpm exec just` works with no global install; licence checked (L2) | ✅ **a system install** — `brew install just` (macOS), `cargo install just`, or a prebuilt binary; CI uses `taiki-e/install-action` (just). Not an npm binary: one more dev dependency for a tool the repo never *needs* (DoD 3). Licences: pnpm MIT, just CC0-1.0 — both OSI-approved (L2) |
| 6 · docs | every live `npm install` / `npm ci` / `npm run` becomes pnpm or just — W-04 (table, prompt), W-09, INTERVIEW, both package READMEs; archived and past WORKLOG text is left alone | ✅ CLAUDE.md layout line, W-04 (step-1 note, DoD 1), INTERVIEW §1, the register; W-09 and both package READMEs carried no npm command |
| 7 · register | Ownership rows in `records/README.md`: `package-lock.json` → `pnpm-lock.yaml`; new rows for `pnpm-workspace.yaml` and `justfile` (owner W-04 until the build record exists); registry row for any new doc | ✅ Ownership rows: `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `justfile` → W-04; SR-LAW-2's veto command now reads `pnpm-lock.yaml` |
| 8 · proof | from a clean clone: `pnpm install --frozen-lockfile && just --list && just check` — `check` may be a no-op until W-04 adds real build and test steps, but it must exit 0 | ✅ 2026-10-18, Claude Code on Arpit's MacBook (Node 24.13.0, pnpm 10.28.2, just 1.49.0): a copy of the tracked tree without `node_modules` ran `pnpm install --frozen-lockfile && just --list && just check` — exit 0 (check is a no-op until W-04) |

## Blockers

None.

## Record affected

**No SR affected.** The build files stay owned by W-04 until its build record
exists. SR-LAW-2 applies: pnpm (MIT) and just (CC0-1.0) must both be confirmed
FOSS in DoD 5.

## Hazards

- **Never `npm publish` a package with `workspace:` dependencies.** Only
  `pnpm publish` rewrites `workspace:*` to a real version; npm ships the
  literal string, so the published package cannot install. W-04 DoD 6 must say
  so.
- **just is not a JavaScript tool.** It is a separate binary. CI needs an
  install step, or it calls pnpm scripts directly. DoD 3 keeps the repo
  buildable without just.
- **Don't rely on Corepack being present.** Newer Node releases are dropping
  it from the default install (check before relying on it). Pin
  `packageManager` anyway, and install pnpm explicitly in CI.
- **pnpm 10 blocks dependency install scripts by default.** Any dev dependency
  that needs one has to be allow-listed (`onlyBuiltDependencies`), with the
  reason written down.
- **Strict installs will expose undeclared imports.** That is the point: fix
  the manifest, never hoist to hide it.
- **Concurrent sessions.** This rewrites W-04-owned root files. Re-check
  `git status` before staging (SR-WORK-SESSION decision 10).

## Reference

- pnpm workspaces — https://pnpm.io/workspaces
- pnpm `workspace:` protocol and publishing — https://pnpm.io/workspaces#publishing-workspace-packages
- just manual — https://just.systems/man/en/
- [W-04](W-04-monorepo-toolchain.md) — the toolchain item this feeds

## Prompt — paste into Claude Code

```text
You are working W-10 in the sheetpane monorepo: move from npm workspaces to
pnpm and add a justfile.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, this file
   (work/open/W-10-pnpm-and-justfile.md), work/open/W-04-monorepo-toolchain.md,
   package.json, package-lock.json and packages/*/package.json.
2. Plan DoD 1–7; write the choices for DoD 2 and DoD 5, and the reasons, into
   this file.
3. Implement. Dev dependencies only, every one FOSS (L2).
4. Verify DoD 8 from a clean clone. Tick each DoD row with its evidence, then
   do what SR-WORK-DOCS decision 10 says every task owes.
```
