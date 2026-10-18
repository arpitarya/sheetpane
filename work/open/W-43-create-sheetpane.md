---
type: Handoff
name: W-43
description: "Arpit, 2026-10-18: a scaffolder that creates a working host app — vanilla, React, Next.js, Vue, Angular or Svelte — with the grid and errors panel in a tab, a sample file, a rules file, one test and the agent skills installed."
item: W-43
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-43 — `npm create sheetpane`: starter templates

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Write `create-sheetpane` (no dependencies; `node:readline` prompts) | one command to a running app | ⏳ |
| 2 | Six templates, each with grid + errors in a tab, the showcase file, a rules file, one `@sheetpane/testing` test, the W-37 typing | start right instead of copying a README | ⏳ |
| 3 | Offer `--skills claude,kiro,codex` and `--mcp` | the agent knows sheetpane from the first prompt | ⏳ |
| 4 | CI scaffolds each template, installs from the packed tarballs, builds and runs its test | a template can't rot | ⏳ |

**Arpit, 2026-10-18:** *"Other than codemods. File work item for everything else. Research and then file work items."* — answering the chat list (same session as [W-35](W-35-agent-skills-package.md)) of what helps a consumer beyond skills.

**Model:** Sonnet — six small apps and a prompt loop.

## Goal

A new consumer types one command, picks a framework, and has a running, tested, agent-ready sheetpane app.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · CLI | `packages/create-sheetpane` (unscoped, so `npm create sheetpane` works); prompts for name, template, skills, MCP; a flag for each (`--template react --skills all --yes`) | ⏳ |
| 2 · templates | vanilla (Vite), react (Vite), next (App Router, client-only import), vue (Vite, `isCustomElement`), angular (`CUSTOM_ELEMENTS_SCHEMA`), svelte | ⏳ |
| 3 · contents | grid + errors in a tab and a pop-up button; showcase and rules files from [W-42](W-42-fixtures-package.md); one test on [W-41](W-41-testing-package.md); typings from [W-37](W-37-custom-elements-manifest.md); a README pointing at the skills | ⏳ |
| 4 · agent-ready | runs `sheetpane-skills install` ([W-35](W-35-agent-skills-package.md)) and registers [W-39](W-39-mcp-server.md) when asked | ⏳ |
| 5 · CI | each template scaffolded into a temp dir, installed from `demo-packed` tarballs, built, its test run | ⏳ |
| 6 · versions | templates pin the framework versions CI proved; the release script bumps sheetpane's version in them | ⏳ |
| 7 · record | new record SR-CREATE; SR-BUILD (CI job) | ⏳ |

## Blockers

None to start; templates pick up W-35, W-37, W-39, W-41 and W-42 as each lands.

## Record affected

New **SR-CREATE** (next free number) · [SR-BUILD](../../records/0102_BUILD.md).

## Hazards

- **npm name** `create-sheetpane` — check it is free first; fallback `@sheetpane/create` (`npm create @sheetpane`).
- **Six frameworks move fast** — CI on every push keeps them honest; drop a template rather than ship a broken one.
- **SR-LAW-2** covers the templates' dependencies too (all FOSS).

## Research

- `npm create <name>` runs the package `create-<name>`; `npm create @scope` runs `@scope/create`.
- Framework catches: Next.js needs a client-only dynamic import; Vue needs `compilerOptions.isCustomElement`; Angular needs `CUSTOM_ELEMENTS_SCHEMA`; React 19 passes properties and custom events natively.

## Reference

- [W-37](W-37-custom-elements-manifest.md) · [W-41](W-41-testing-package.md) · [W-42](W-42-fixtures-package.md) · [W-35](W-35-agent-skills-package.md) · [W-39](W-39-mcp-server.md) · `examples/`

## Prompt — paste into Claude Code

```text
You are building W-43 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, examples/html, examples/react, scripts/demo-packed.mjs, records/0102_BUILD.md and this file
   (work/open/W-43-create-sheetpane.md). Check the state of: W-35, W-37, W-39, W-41, W-42.
2. Plan the CLI, the skeleton shared by all six templates, and the CI job before writing code. Re-check the external formats linked under Research; note anything that changed.
3. Implement packages/create-sheetpane and its templates.
4. Verify: just check; every DoD row above. Then do what SR-WORK-DOCS decision 10 says every task owes.
```
