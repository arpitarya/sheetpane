---
type: Handoff
name: W-38
description: "Arpit, 2026-10-18: an llms.txt index and an llms-full.txt bundle, in the repo and in @sheetpane/grid, generated from the READMEs and records so an agent can read all of sheetpane in one fetch."
item: W-38
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-38 — llms.txt and llms-full.txt, generated and kept fresh

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | A script builds `llms.txt` (H1, one-line summary, sections of links) and `llms-full.txt` (the same docs inlined) from the package READMEs, the records and the skills | one file an agent can fetch to learn all of sheetpane | ⏳ |
| 2 | Ship them at the repo root and inside `@sheetpane/grid`; a test regenerates and diffs | always matches the docs | ⏳ |

**Arpit, 2026-10-18:** *"Other than codemods. File work item for everything else. Research and then file work items."* — answering the chat list (same session as [W-35](W-35-agent-skills-package.md)) of what helps a consumer beyond skills.

**Model:** Haiku — a deterministic concatenation script and a freshness test.

## Goal

An agent given the repo URL or `node_modules/@sheetpane/grid` finds `llms.txt` and can read the whole public contract without crawling.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · format | `llms.txt` per llmstxt.org: `# sheetpane`, a `>` summary, `##` sections (Start · Elements · Plugins · Rules · Skills · Records) of `[title](url): note` links | ⏳ |
| 2 · full | `llms-full.txt` inlines the package READMEs, the laws and the consumer-facing records (not `work/`), each under a heading with its source path | ⏳ |
| 3 · where | repo root and `packages/grid/` (in `files`); links absolute (GitHub URLs pinned to the release tag) so they work from `node_modules` and the web | ⏳ |
| 4 · generator | `scripts/build-llms.mjs`, no dependencies, deterministic order; `just llms` | ⏳ |
| 5 · fresh | a test regenerates both and fails on any diff; the release script runs it | ⏳ |
| 6 · size | `llms-full.txt` size printed by the test; over 200 KB is a warning to split per package | ⏳ |
| 7 · record | SR-BUILD | ⏳ |

## Blockers

None. Picks up the skills once [W-35](W-35-agent-skills-package.md) lands.

## Record affected

[SR-BUILD](../../records/0102_BUILD.md).

## Hazards

- **`work/` and `archive/` are not product docs** — never bundle them (SR-WORK-ARCHIVE).
- **No docs site yet:** links point at GitHub; when [W-44](W-44-live-playground.md) adds a site, switch the base URL in one place.

## Research

- llms.txt is a proposal (llmstxt.org, 2024): a Markdown file with an H1, a blockquote summary and sections of links; `llms-full.txt` is a common convention for the inlined version. Claude Code's own docs publish one.

## Reference

- [llmstxt.org](https://llmstxt.org/)

## Prompt — paste into Claude Code

```text
You are building W-38 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, every package README, records/README.md, records/0102_BUILD.md and this file
   (work/open/W-38-llms-txt.md). Check the state of: W-35, W-44.
2. Plan the section list, the generator and the freshness test before writing code. Re-check the external formats linked under Research; note anything that changed.
3. Implement scripts/build-llms.mjs, the two files, the test.
4. Verify: just check; every DoD row above. Then do what SR-WORK-DOCS decision 10 says every task owes.
```
