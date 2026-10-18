---
type: Handoff
name: W-39
description: "Arpit, 2026-10-18: a Model Context Protocol server with deterministic tools — describe the API, inspect a workbook, draft and check a rules file, explain an error code — so agents ask instead of guess."
item: W-39
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-39 — `@sheetpane/mcp`: an MCP server agents can ask

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Build a stdio MCP server, tools only, to the 2026-07-28 spec | agents query sheetpane instead of inventing attributes | ✅ |
| 2 | Tools: `describe_api`, `inspect_workbook`, `draft_rules`, `check_rules`, `explain_code`, `find_skill` | answers computed from the manifest, the workbook and the schema — never generated | ⏳ `describe_api` built; it answers once W-37 ships the manifest |
| 3 | Register it from `sheetpane-skills install` for Claude Code, Kiro and Codex | one command sets it up | ✅ |

**Arpit, 2026-10-18:** *"Other than codemods. File work item for everything else. Research and then file work items."* — answering the chat list (same session as [W-35](W-35-agent-skills-package.md)) of what helps a consumer beyond skills.

**Model:** Opus — a protocol implementation on a new spec revision, plus workbook parsing in Node.

## Goal

`npx @sheetpane/mcp` starts a server any MCP client can use. Every tool is deterministic: the same input gives the same output, computed from the shipped manifest, the import package and the rules schema.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · package | `packages/mcp`, bin `sheetpane-mcp`; depends on `@sheetpane/import`, `@sheetpane/grid` (data files only: manifest, rules schema) and `@sheetpane/skills` | ✅ `packages/mcp`, bin `sheetpane-mcp`; runtime deps import, grid (its rules checker and code registry), skills; the build copies ERRORS.md, the manifest and a plugin table into `dist/` |
| 2 · protocol | stdio; the 2026-07-28 revision (stateless core); tool input schemas valid JSON Schema 2020-12; clients on the previous revision handled if the spec allows; checked with the MCP Inspector | ✅ stdio; 2026-07-28 stateless (`server/discover`, `_meta` version, `resultType`, cacheable `tools/list`, −32022) and 2025 `initialize`; schemas 2020-12. **Not** run in the MCP Inspector (interactive) — a spawned-server test stands in |
| 3 · `describe_api(name)` | attribute, property, method, event, CSS token or plugin → its manifest entry, TSDoc and record link | ⏳ built (`api.ts`, reads `custom-elements.json` + the plugin table); its golden waits on W-37 |
| 4 · `inspect_workbook(path)` | sheets, dimensions, header-row guess, titles, inferred column types, merges, which plugins the file would use — via `@sheetpane/import` in Node | ✅ via `@sheetpane/import`, which now reads `.xlsx` in Node (`minixml.ts`, SR-IMPORT 8; SP-1008 retired) |
| 5 · `draft_rules(path, sheet?)` | a W-33 rules file from headers and inferred types (`required` where no blanks, `type`, `oneOf` for ≤ 12 distinct values); always marked a draft | ✅ `draft: true`; a draft checks clean against its own file (tested) |
| 6 · `check_rules(json, path?)` | validates against the rules schema; with a workbook, lists sheets and titles the file names but the workbook lacks | ✅ the grid's `checkDocument` (the rules schema's hand check) + SP-6022/6023/6024 against a workbook |
| 7 · `explain_code(code)` | the [W-40](W-40-error-codes.md) entry: meaning, cause, fix, link | ✅ registry + `docs/ERRORS.md` |
| 8 · `find_skill(task)` | keyword match over the skills' descriptions → name and path (no model) | ✅ name ×3 + description words, the "Not for" clause excluded |
| 9 · registration | [W-35](W-35-agent-skills-package.md)'s installer adds the server for Claude Code (`.mcp.json`), Kiro and Codex (their MCP config files, paths confirmed at build) | ✅ `sheetpane-skills install`: `.mcp.json`, `.kiro/settings/mcp.json`, `.codex/config.toml` (paths confirmed: Kiro docs, OpenAI Codex docs); `--no-mcp` |
| 10 · tests | each tool on the showcase workbook and rules sample; golden outputs; a malformed file is a tool error, never a crash | ✅ `packages/mcp/test/mcp.node.test.ts` (17) with 12 goldens; malformed files, missing paths and bad args are tool errors with SP codes |
| 11 · record | new record SR-MCP; SR-BUILD; ownership row | ✅ SR-MCP (0119); SR-SKILLS 4a; SR-IMPORT 8; SR-TESTING 5; SR-CODES 7xxx (SP-7001…7007); register + ownership; compare doc |

## Blockers

Waiting on W-37 (the manifest `describe_api` reads). Tools 5–6 need [W-33](W-33-rules-file.md); tool 7 needs [W-40](W-40-error-codes.md) — each ships as its source lands.

## Record affected

New **SR-MCP** (next free number) · [SR-BUILD](../../records/0102_BUILD.md) · [`records/README.md`](../../records/README.md) §Ownership.

## Hazards

- **SDK or hand-written?** The official TypeScript SDK brings several runtime dependencies; a hand-written JSON-RPC-over-stdio server is small and dependency-free but owns spec compliance. Read in: hand-written, tools only, verified with the Inspector; record the fork in `work/compare/mcp-server.compare.md` with a reopen-trigger (a second transport, or resources/prompts).
- **The spec just changed** (2026-07-28: sessions and `initialize` out of the core, stricter schemas). Re-read the spec before building.
- **`@sheetpane/import` in Node** — confirm it runs without DOM globals.
- **Paths come from the agent** — read-only, no writes, no network.

## Research

- MCP **2026-07-28**: stateless core (no required `initialize` or session ID), `Mcp-Method` routing header over HTTP, tool input schemas as full JSON Schema 2020-12; Roots, Sampling and Logging deprecated.
- Claude Code reads project MCP servers from `.mcp.json`; Kiro and Codex have their own MCP config files — confirm paths at build.

## Reference

- [MCP blog — 2026-07-28 specification](https://blog.modelcontextprotocol.io/tags/protocol/) · [2026-07-28 breaking changes](https://www.developersdigest.tech/blog/mcp-2026-07-28-breaking-changes)
- [W-33](W-33-rules-file.md) · [W-37](W-37-custom-elements-manifest.md) · [W-40](W-40-error-codes.md) · [W-35](W-35-agent-skills-package.md)

## Prompt — paste into Claude Code

```text
You are building W-39 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, packages/import/README.md, packages/grid/README.md, records/0102_BUILD.md, records/0104_IMPORT.md and this file
   (work/open/W-39-mcp-server.md). Check the state of: W-33, W-35, W-37, W-40.
2. Plan the transport, each tool's input and output schema, and the SDK-vs-hand-written compare doc before writing code. Re-check the external formats linked under Research; note anything that changed.
3. Implement packages/mcp and its tests.
4. Verify: just check; every DoD row above. Then do what SR-WORK-DOCS decision 10 says every task owes.
```
