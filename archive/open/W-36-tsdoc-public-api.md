---
type: Handoff
name: W-36
description: "Arpit, 2026-10-18: agents read the .d.ts files first, so every public export of every package carries TSDoc with an example, and a test fails when one does not."
item: W-36
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-36 — TSDoc on every public export, checked

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Write TSDoc on every public export of every package: a one-line summary, `@param`/`@returns`, the events an element fires, one `@example`, a `@see` to its record | an agent reading `dist/*.d.ts` gets the contract, not a guess | ✅ |
| 2 | Add a test using the TypeScript compiler API that walks each package's public entry and fails on an export without a summary or an element without `@example` | it stays documented | ✅ |

**Arpit, 2026-10-18:** *"Other than codemods. File work item for everything else. Research and then file work items."* — answering the chat list (same session as [W-35](W-35-agent-skills-package.md)) of what helps a consumer beyond skills.

**Model:** Sonnet — wide but mechanical; the contracts already exist in the records and READMEs.

## Goal

`dist/*.d.ts` is the most-read documentation an agent ever sees. Every exported function, class, type and custom element in export, import, grid and the eight plugins carries TSDoc that survives into the published `.d.ts`, and a check keeps it that way.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · coverage | every symbol reachable from each package's `exports` has a summary; functions have `@param`/`@returns`; each custom element class lists its attributes, properties, methods and events (`@fires sheetpane-…`) and has one `@example` | ✅ every symbol the walker reaches in the 13 packages (export, import, grid, the eight plugins, fixtures, testing); both elements list Attributes, members and `@fires` per dispatched event, with an `@example` |
| 2 · links | each element and top-level function has `@see` to its record (e.g. `records/0105_GRID.md`) and its README section | ✅ elements and plugin factories `@see` their record and README section; top-level functions `@see` their record (checked for elements only) |
| 3 · survives the build | `removeComments` stays off; a test reads the built `.d.ts` and finds them | ✅ `removeComments` off; the test reads the built `.d.ts` |
| 4 · check | `test/tsdoc.test.ts` walks every package entry with the TypeScript compiler API (already a dev dependency — no API Extractor) and fails on a missing summary or element `@example`, naming the symbol | ✅ `test/tsdoc.test.ts` with `test/tsdoc-walk.ts` — **not** the compiler API: TypeScript 7 has none stable in JavaScript, so the walker reads the declaration files and follows re-exports itself (SR-BUILD 7a) |
| 5 · examples compile | every `@example` block is extracted and type-checked against the built packages | ✅ every `@example` ```ts block type-checked against the built packages |
| 6 · record | SR-BUILD gains the TSDoc check | ✅ SR-BUILD decision 7a |

## Blockers

None.

## Record affected

[SR-BUILD](../../records/0102_BUILD.md) — the TSDoc check.

## Hazards

- **A second source of truth.** TSDoc summarises; the record rules. Keep each comment short and link the record (SR-LAW-0).
- **Concurrent sessions** edit `packages/*/src`; re-derive `git status` before staging.

## Research

- TSDoc tags (`@param`, `@returns`, `@example`, `@see`, `@deprecated`) are read by editor hover, the TypeScript language service and the Custom Elements Manifest analyzer ([W-37](W-37-custom-elements-manifest.md) reuses them).
- No new dependency: the TypeScript compiler API is enough to walk exports and read their docs.

## Reference

- [tsdoc.org](https://tsdoc.org/) · [W-37](W-37-custom-elements-manifest.md) · [W-35](W-35-agent-skills-package.md)

## Prompt — paste into Claude Code

```text
You are building W-36 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, every package README, packages/*/src/index.ts, records/0102_BUILD.md and this file
   (work/open/W-36-tsdoc-public-api.md). Check the state of: W-37.
2. Plan the comment shape per symbol kind and the check before writing code. Re-check the external formats linked under Research; note anything that changed.
3. Implement TSDoc across packages/*/src and test/tsdoc.test.ts.
4. Verify: just check; every DoD row above. Then do what SR-WORK-DOCS decision 10 says every task owes.
```
