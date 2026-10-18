---
type: Compare
title: How the MCP server is built
description: "How the MCP server is built: the official TypeScript SDK or a hand-written JSON-RPC server; which surfaces it offers. Verdict for W-39."
status: decided
decided: 2026-10-18
decided_by: "Arpit (Cowork) read in hand-written in W-39's hazards; built by Claude Code, open to override"
---

# MCP server — SDK or hand-written; tools or more

> **Verdict:** decided and built (W-39, 2026-10-18) · **hand-written JSON-RPC over stdio, tools only** · confidence: high for today's six read-only tools ·
> **reopen-trigger:** a second transport (Streamable HTTP) is wanted, or resources / prompts / sampling are, or a spec revision changes the stateless request shape.

## Context

W-39 asks for an MCP server agents can query: six deterministic, read-only tools. The spec revised on 2026-07-28 (stateless core: no `initialize`; the version in each request's `_meta`; `server/discover`; `resultType`; cacheable `tools/list`), and 2025 clients still send `initialize`.

## Options

| | A · `@modelcontextprotocol/sdk` | B · hand-written (chosen) |
|---|---|---|
| runtime dependencies | the SDK and its own (schema validation, transports) — MIT | none beyond `@sheetpane/*` |
| spec compliance | the SDK's; follows each revision when it ships | ours: `protocol.ts` (~70 lines), tested over a spawned server |
| 2026-07-28 + 2025 clients at once | as the SDK version supports | both, explicitly (SR-MCP decisions 3, 4) |
| transports | stdio, Streamable HTTP | stdio only |
| surfaces | tools, resources, prompts, sampling… | tools only |
| install size for `npx -y @sheetpane/mcp` | larger | the import, grid and skills packages |

## Consequences

- We own spec compliance: the stdio test (`packages/mcp/test/mcp.node.test.ts`) pins discover, legacy initialize, list, call and each error code.
- Not checked with the MCP Inspector (interactive); the spawned-server test stands in.

## References

- [SR-MCP](../../records/0119_MCP.md) · [W-39](../../archive/open/W-39-mcp-server.md)
- [MCP 2026-07-28 schema](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/schema/2026-07-28/schema.ts)

## Reopen-trigger

A second transport, a resource or prompt surface, or a spec revision that changes what a stateless request carries.
