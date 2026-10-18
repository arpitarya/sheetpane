---
type: Register
description: "The SR register: the convention, the ownership table, and the state of every record."
---

# SRs — the decision records

**How to use this file.** The naming convention, the record shape, the
ownership table and the rules every record obeys. Read it before writing a
record, before citing one, and before adding a module under `scripts/` and `.claude/hooks/` and the package code — the root build files and `packages/` — owned by their open `W-nn` items until each writes its record.

One record per completed feature or ruled measurement. **Every record is cited
by NAME in prose, never by number.**

## What an SR is — and what it is not

A Standing Record is a **maintained specification**, not a decision-log entry:
amended in the same change as the code (law zero); superseded records are
rewritten or deleted; retired records are archived (L1); cited by name because
the content moves; it **owns** components and carries a veto condition to check
*today*. The decision-log role lives in `work/compare/` (the fork, its verdict,
its reopen-trigger) and `work/WORKLOG.md`.

## One directory, one state

`records/` is the only home a LIVE record has. A superseded record is rewritten
or deleted in the change that supersedes it; a **retired** record is moved to
`archive/records/` with `status: archived`, a dated banner and an
`archive/README.md` row (L1), and from then on is named, never cited.

Three files here are NOT records and carry no number: this register,
`TEMPLATE.md`, and `RULE-SINCE`.

## The three kinds

Every record declares a `kind`; it answers *what would have to change for this
record to become wrong?*

| `kind` | becomes wrong when | the gate the kind selects |
|---|---|---|
| `law` | The decider rules differently | precedence: a record conflicting with a law is void in the conflicting part |
| `component` | the code changes | `scripts/sr-guard.sh` — the owning record is touched in the same change |
| `process` | the way work is done changes | it owns its enforcement — a hook or script today, a test once tests exist |

## The convention

**Path.** `records/NNNN_<short-name>.md`, on three ranges:

| range | holds | a new record takes |
|---|---|---|
| `0001`–`0050` | the **Law** records only — `0001` SR-LAWS, `0002` SR-LAW-0, `0003` SR-LAW-1, `0004` SR-LAW-2, `0005` SR-LAW-3, `0006` SR-LAW-4, `0007` SR-LAW-5, `0008` SR-LAW-6, `0009` SR-LAW-7, `0010` SR-LAW-8, `0011` SR-LAW-9, `0012` SR-LAW-10 | the next free number after the highest law |
| `0051`–`0100` | the **WORK** records only — how work is done | the next free number after the highest |
| `0101`– | every other record | the next free number after the highest |

Gaps are reservations; no placeholder files. The number is a filename ordinal,
**not an identity**. **Cite by NAME, never by number.**

### Frontmatter is the metadata, and the body never restates it

Keys, in this order: `type` · `kind` · `name` · `title` · `description` ·
`status` · `date` · `feature` · `owns` · `laws` · `timestamp` · `content_sha`;
optional `supersedes`, `ratifies`. See `TEMPLATE.md` for each value. **Quote
any value containing `: `.** The body opens at §1 and restates none of it.

### A record states what is true now. It carries no history.

No `Amended` sections. When a decision changes, rewrite the sentence in place,
in the same commit. The one exception is an argument that still binds — it
belongs in *Alternatives considered*.

### Two sections and a bibliography

**§1 — For humans**: one screen; a diagram (Mermaid and a collapsed ASCII
twin, updated together). **§2 — For agents**: Context · Decision (numbered) ·
Consequences · Alternatives considered · Reference (required) · Veto
condition. **References**: every source cited, grouped; nothing new; never an
archived document.

**The reference is grounded** — never an archived doc. **The veto condition is
a condition, not an event** — checkable today with a command.

**A record that restates a cross-cutting principle is a bug.** Each law lives
in its own `SR-LAW-n` record; every other record names it in `laws:` and moves
on.

### Records are kept current by a check, not by good intentions

| where | what it does |
|---|---|
| `scripts/sr-guard.sh` | a `commit-msg` hook: refuses a commit that changes an owned component without staging its owning record and every describer — unless the message carries `no SR affected` on its own line. Install: `ln -sf ../../scripts/sr-guard.sh .git/hooks/commit-msg` |
| `scripts/rename-only-guard.sh` | run first by the same hook: refuses a commit made only of pure renames unless the message says `rename only` on its own line (SR-WORK-SESSION decision 13) |
| `records/RULE-SINCE` | the baseline commit sha from which the rule applies, for a CI replay once one exists |

**The escape hatch is a claim in git history under your name**, not a silent
skip. What none of this proves: that a touched record is **coherent**.

Start from `TEMPLATE.md`.

---

## The register

| # | name | title | status | built |
|---|------|-------|--------|-------|
| [0001](0001_LAWS.md) | **SR-LAWS** | The laws have exactly one home each; this record routes the handles | accepted | yes |
| [0002](0002_LAW-0-authority.md) | **SR-LAW-0** | **L0** — records are the only source of truth; Law records outrank every other record | accepted | yes |
| [0003](0003_LAW-1-retired-records-archived.md) | **SR-LAW-1** | **L1** — a retired record is archived, never deleted | accepted | yes |
| [0004](0004_LAW-2-foss-dependencies.md) | **SR-LAW-2** | **L2** — every dependency is free and open source | accepted | no — nothing checks it yet (B-008) |
| [0005](0005_LAW-3-xlsx-and-csv-only.md) | **SR-LAW-3** | **L3** — sheetpane supports XLSX and CSV only | accepted | yes — other formats refused by name and bytes (SR-IMPORT tests) |
| [0006](0006_LAW-4-web-component.md) | **SR-LAW-4** | **L4** — sheetpane is always a web component | accepted | yes — no framework peer (SR-BUILD decision 7); both elements register on import (SR-GRID tests) |
| [0007](0007_LAW-5-host-font.md) | **SR-LAW-5** | **L5** — the font is the browser's default unless the host sets one | accepted | yes — no font in any package source is tested (SR-BUILD decision 7) |
| [0008](0008_LAW-6-edits-in-memory-export-with-changes.md) | **SR-LAW-6** | **L6** — every change is held in memory and export carries it | accepted | yes — edits exported and read back (SR-GRID round-trip property) |
| [0009](0009_LAW-7-surfaces-always-in-sync.md) | **SR-LAW-7** | **L7** — the view, edit and error components are always in sync | accepted | yes — the two elements in sync, both mount orders (SR-ERRORS) |
| [0010](0010_LAW-8-npm-package.md) | **SR-LAW-8** | **L8** — sheetpane is consumed as an npm package | accepted | yes — publishable, lockstep and packed manifests are tested (SR-BUILD decisions 7, 10) |
| [0011](0011_LAW-9-memory-is-a-javascript-object.md) | **SR-LAW-9** | **L9** — memory means a JavaScript object, for now | accepted | yes — nothing stores data yet; L6's veto command checks it |
| [0012](0012_LAW-10-examples-maintained.md) | **SR-LAW-10** | **L10** — the examples are maintained with every package change | accepted | partly — the examples working is checked (`just demo-check`, the React recipes, `test/starters.test.ts`); being current is not (B-035) |
| [0051](0051_WORK-open-queue.md) | **SR-WORK-OPEN-QUEUE** | How `OPEN-WORK.md` works — the queue discipline in ten groups | accepted | yes |
| [0052](0052_WORK-backlog.md) | **SR-WORK-BACKLOG** | How `BACKLOG.md` works — the named-but-unclaimed in five classes | accepted | yes |
| [0053](0053_WORK-lifecycle.md) | **SR-WORK-LIFECYCLE** | How a feature travels — compare, proposal, handoff in the item file, the model line, one record | accepted | yes |
| [0054](0054_WORK-session.md) | **SR-WORK-SESSION** | What a session owes before it ends; the two-strikes rule | accepted | yes |
| [0055](0055_WORK-docs.md) | **SR-WORK-DOCS** | The documentation contract — form, steering-file edits, the documents every task updates | accepted | yes |
| [0056](0056_WORK-blockers.md) | **SR-WORK-BLOCKERS** | A blocker is a file, not a remark — `work/BLOCKED.json` and the three hooks | accepted | yes |
| [0057](0057_WORK-archive.md) | **SR-WORK-ARCHIVE** | One archive; named, never cited | accepted | yes |
| [0058](0058_WORK-ownership.md) | **SR-WORK-OWNERSHIP** | `owns` and `describes`, and the commit guard | accepted | yes |
| [0059](0059_WORK-governance.md) | **SR-WORK-GOVERNANCE** | The governance map — which file governs what; no counts | accepted | yes |
| [0060](0060_WORK-registry.md) | **SR-WORK-REGISTRY** | The doc registry — rules in §2, the table in §3 | accepted | yes |
| [0101](0101_DOWNLOAD.md) | **SR-DOWNLOAD** | `download()` — export output in, a saved `.xlsx` or `.csv` out | accepted | yes — Chromium, WebKit, Firefox; iOS Safari checked in W-09 |
| [0102](0102_BUILD.md) | **SR-BUILD** | The monorepo build — pnpm, just, tsc, Vitest, CI, lockstep release | accepted | yes |
| [0103](0103_EXPORT.md) | **SR-EXPORT** | `@sheetpane/export` — toXlsx, patchXlsx, toCsv, the shared ZIP and XML code | accepted | yes |
| [0104](0104_IMPORT.md) | **SR-IMPORT** | `@sheetpane/import` — an .xlsx or .csv in, the workbook object out | accepted | yes |
| [0105](0105_GRID.md) | **SR-GRID** | `@sheetpane/grid` — the pane's workbook store, `<sheetpane-excel>`, the plugin host, undo, freeze panes | accepted | yes |
| [0106](0106_ERRORS.md) | **SR-ERRORS** | `<sheetpane-errors>` — the error list and the New error form | accepted | yes |
| [0107](0107_IMAGES.md) | **SR-IMAGES** | `@sheetpane/images` — pictures drawn through the overlay hook | accepted | yes |
| [0108](0108_VALIDATION.md) | **SR-VALIDATION** | `@sheetpane/validation` — the workbook's own rules as errors | accepted | yes |
| [0109](0109_NUMFMT.md) | **SR-NUMFMT** | `@sheetpane/numfmt` — every Excel number format | accepted | yes |
| [0110](0110_STYLES.md) | **SR-STYLES** | `@sheetpane/styles` — cell styles, the format row | accepted | yes |
| [0111](0111_FORMULAS.md) | **SR-FORMULAS** | `@sheetpane/formulas` — recalculation through IronCalc | accepted | yes |
| [0112](0112_COMMENTS.md) | **SR-COMMENTS** | `@sheetpane/comments` — file comments in, the review out | accepted | yes |
| [0113](0113_CHARTS.md) | **SR-CHARTS** | `@sheetpane/charts` — charts as frames and SVG | accepted | yes |
| [0114](0114_CONDFMT.md) | **SR-CONDFMT** | `@sheetpane/condfmt` — conditional formatting, drawn | accepted | yes |
| [0115](0115_FIXTURES.md) | **SR-FIXTURES** | `@sheetpane/fixtures` — known workbooks and their manifest | accepted | yes |
| [0116](0116_SKILLS.md) | **SR-SKILLS** | `@sheetpane/skills` — agent skills and their installer | accepted | yes |
| [0118](0118_TESTING.md) | **SR-TESTING** | `@sheetpane/testing` — helpers for testing a host app | accepted | yes |
| [0119](0119_MCP.md) | **SR-MCP** | `@sheetpane/mcp` — an MCP server agents can ask | accepted | yes |
| [0120](0120_CREATE.md) | **SR-CREATE** | `create-sheetpane` — a working app in one command | accepted | yes |
| [0121](0121_VISIBILITY.md) | **SR-VISIBILITY** | `@sheetpane/visibility` — hide and unhide as changes | accepted | yes |
| [0117](0117_CODES.md) | **SR-CODES** | stable `SP-xxxx` error codes, one registry, `docs/ERRORS.md` | accepted | yes |

---

## Ownership — which record owns which component

**This table is the answer, not a judgement call.** Every component under
`scripts/` and `.claude/hooks/` and the package code — the root build files and `packages/` — owned by their open `W-nn` items until each writes its record appears here exactly once. Most specific wins; a carve-out is
justified by a *different decision*. A component with no decision yet is owned
by an open `W-nn`. A record's `owns:` key and this table agree in both
directions.

<!-- OWNERSHIP-TABLE-START -->

| component | owner | note |
|---|---|---|
| `scripts/sr-guard.sh` | SR-WORK-OWNERSHIP | the guard is the executable form of decisions 3 and 6 |
| `scripts/rename-only-guard.sh` | SR-WORK-SESSION | decision 13's gate for commits that carry only a move (run first by the commit-msg hook) |
| `scripts/check-open-work-inbox.py` | SR-WORK-OPEN-QUEUE | rule 45a's check |
| `.claude/hooks/guard-open-work-inbox.sh` | SR-WORK-OPEN-QUEUE | rule 45a, in-session |
| `.claude/hooks/inject-inbox.sh` | SR-WORK-BLOCKERS | decision 7 |
| `.claude/hooks/stop-if-blocked.sh` | SR-WORK-BLOCKERS | decision 7 |
| `.claude/hooks/session-lock.sh` | SR-WORK-BLOCKERS | decision 7 |
| `.claude/hooks/require-progress.sh` | SR-WORK-SESSION | decision 5 |
| `package.json` | SR-BUILD | the private monorepo root and its scripts |
| `pnpm-lock.yaml` | SR-BUILD | the workspace lockfile |
| `pnpm-workspace.yaml` | SR-BUILD | the pnpm workspace — `packages/*` |
| `justfile` | SR-BUILD | the one place to run install, build, test, typecheck, check, release |
| `tsconfig.base.json` | SR-BUILD | the shared strict TypeScript settings |
| `tsconfig.json` | SR-BUILD | the root type-check over `test/` and the Vitest config |
| `vitest.config.ts` | SR-BUILD | the one test runner config — Node and browser projects |
| `test/` | SR-BUILD | repo-level package checks (lockstep, no framework peer, no font, runtime allow-list) |
| `scripts/build-grid-css.mjs` | SR-BUILD | writes `@sheetpane/grid`'s `dist/style.css` from its tokens and copies `rules.schema.json` into `dist/` |
| `scripts/pack-check.mjs` | SR-BUILD | the tarballs as npm sees them |
| `scripts/release.mjs` | SR-BUILD | one version on every package |
| `.github/workflows/` | SR-BUILD | CI on every push; the three-engine nightly |
| `scripts/serve.mjs` | SR-BUILD | the demos' static server |
| `scripts/build-site.mjs` | SR-BUILD | the live playground's static site (W-44) |
| `scripts/build-manifest.mjs`, `packages/grid/custom-elements.json` | SR-BUILD · SR-GRID | the manifest, editor data and framework typings, generated at grid build (W-37) |
| `test/tsdoc.test.ts`, `test/tsdoc-walk.ts` | SR-BUILD | the TSDoc check (W-36, decision 7a) |
| `test/worklog.test.ts` | SR-WORK-SESSION | the worklog gate: no entry inside a code fence (decision 13) |
| `scripts/build-llms.mjs` | SR-BUILD | writes `llms.txt` and `llms-full.txt` (W-38) |
| `llms.txt`, `llms-full.txt` | SR-BUILD | the generated contract index for agents |
| `scripts/demo-check.mjs` | SR-BUILD | both demos used in Chromium (W-09 DoD 4, 8) |
| `scripts/demo-packed.mjs` | SR-BUILD | both demos installed from tarballs (W-09 DoD 6) |
| `examples/` | SR-BUILD | the plain-HTML and React 19 demos (SR-BUILD decision 11) |
| `README.md` | SR-BUILD | the root README: packages, demos, commands |
| `packages/export/src/download/` | SR-DOWNLOAD | `download()` — a different decision from the writers |
| `packages/export/` | SR-EXPORT | `@sheetpane/export` — the writers and the shared ZIP / XML code |
| `packages/export/src/codes.ts` | SR-CODES | the code registry (carved out of SR-EXPORT's package) |
| `docs/ERRORS.md` | SR-CODES | one entry per `SP-xxxx` code |
| `test/error-codes.test.ts` | SR-CODES | the code check (carved out of SR-BUILD's `test/`) |
| `test/error-codes.lock.json` | SR-CODES | every code ever issued, append-only |
| `packages/import/` | SR-IMPORT | `@sheetpane/import` — the reader |
| `packages/grid/` | SR-GRID | `@sheetpane/grid` — the store, the sheet, the plugin host, undo, freeze |
| `packages/grid/src/errors/` | SR-ERRORS | `<sheetpane-errors>` — a different element from the sheet |
| `packages/numfmt/` | SR-NUMFMT | `@sheetpane/numfmt` — number formats |
| `packages/styles/` | SR-STYLES | `@sheetpane/styles` — cell styles |
| `packages/formulas/` | SR-FORMULAS | `@sheetpane/formulas` — recalculation |
| `packages/validation/` | SR-VALIDATION | `@sheetpane/validation` — workbook rules as errors |
| `packages/condfmt/` | SR-CONDFMT | `@sheetpane/condfmt` — conditional formatting |
| `packages/images/` | SR-IMAGES | `@sheetpane/images` — pictures, view only |
| `packages/charts/` | SR-CHARTS | `@sheetpane/charts` — charts |
| `packages/comments/` | SR-COMMENTS | `@sheetpane/comments` — comments in and out |
| `packages/fixtures/` | SR-FIXTURES | `@sheetpane/fixtures` — test workbooks |
| `packages/testing/` | SR-TESTING | `@sheetpane/testing` — host test helpers |
| `packages/mcp/` | SR-MCP | `@sheetpane/mcp` — the MCP server (W-39) |
| `packages/visibility/` | SR-VISIBILITY | `@sheetpane/visibility` — hide, unhide, group (W-49) |
| `plugins/sheetpane/`, `.claude-plugin/marketplace.json`, `scripts/build-plugin.mjs` | SR-SKILLS | the Claude Code plugin and marketplace, generated from `@sheetpane/skills` (W-45) |
| `packages/create-sheetpane/`, `scripts/create-check.mjs` | SR-CREATE | `npm create sheetpane` and its end-to-end check (W-43) |
| `packages/skills/` | SR-SKILLS | `@sheetpane/skills` — agent skills, the installer |
| `packages/grid/src/skills-bin.ts` | SR-SKILLS | the grid's forwarding `sheetpane-skills` bin |
| `test/skills.test.ts` | SR-SKILLS | the drift check and the installer tests |

<!-- OWNERSHIP-TABLE-END -->

## Describes — which record's subject REACHES INTO a component it does not own

Ownership stays one record per component; **describes is any number**, and the
guard demands the owner **and every describer**. Every row states its reason.
A component may be narrowed to symbols: `` `path::name,name` ``.

<!-- DESCRIBES-TABLE-START -->

| component | describer | why |
|---|---|---|

<!-- DESCRIBES-TABLE-END -->
