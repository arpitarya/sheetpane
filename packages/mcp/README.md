# @sheetpane/mcp

**A Model Context Protocol server for sheetpane: agents ask, it answers from what ships — never a guess.**

```bash
npx -y @sheetpane/mcp        # stdio; any MCP client
npx sheetpane-skills install # registers it for Claude Code, Kiro and Codex (with the skills)
```

| tool | ask | answer, computed from |
|---|---|---|
| `describe_api` | `{ "name": "flagging" }` — an element, attribute, property, method, event, `--sp-*` property, slot, part or plugin | its entry in `custom-elements.json` (with its TSDoc) and the record that specifies it |
| `inspect_workbook` | `{ "path": "data/q3.xlsx" }` | sheets, size, header-row guess, titles, each column's type, blanks and values, merges, and which plugins the file would use — `@sheetpane/import` |
| `draft_rules` | `{ "path": "data/q3.xlsx", "sheet"?: "Sales" }` | a rules file for `<sheetpane-excel rules-src>`: `required`, `type`, `oneOf` per titled column — **a draft to review** |
| `check_rules` | `{ "rules": {…} or "…json…", "path"?: "data/q3.xlsx" }` | the grid's own check, each rule in words; with a workbook, the pane's own `check()` over it — the sheets and titles it lacks, and the cells that fail |
| `explain_code` | `{ "code": "SP-1002" }` | meaning, likely cause, fix and link — [docs/ERRORS.md](../../docs/ERRORS.md) |
| `find_skill` | `{ "task": "validate columns from a JSON file" }` | the skill to read, with its `SKILL.md` path |

## Registering it by hand

| tool | file | entry |
|---|---|---|
| Claude Code | `.mcp.json` | `{ "mcpServers": { "sheetpane": { "command": "npx", "args": ["-y", "@sheetpane/mcp"] } } }` |
| Kiro | `.kiro/settings/mcp.json` | the same |
| Codex | `.codex/config.toml` (trusted projects) | `[mcp_servers.sheetpane]` · `command = "npx"` · `args = ["-y", "@sheetpane/mcp"]` |

## What it is and is not

- **Protocol:** MCP revision 2026-07-28 — stateless, `server/discover`, the version in each request's `_meta` — and 2025-11-25 / 2025-06-18 clients through `initialize`. JSON-RPC over stdio, one message per line. **Tools only.**
- **Read-only:** paths are only read; `.xlsx` and `.csv` only; 256 MB at most; no network, no writes.
- **Deterministic:** the same input gives the same output (the tests compare against golden files).
- **Errors** are tool results with `isError: true` and an SP code first — `SP-7001`…`SP-7007`, or the reader's own `SP-10xx`.

Spec: [SR-MCP](../../records/0119_MCP.md). MIT.
