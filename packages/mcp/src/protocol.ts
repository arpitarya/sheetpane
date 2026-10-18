// A Model Context Protocol server over stdio, hand-written (W-39): JSON-RPC 2.0, one message per
// line. It speaks the 2026-07-28 revision — stateless: no handshake, each request carries
// `io.modelcontextprotocol/protocolVersion` in `_meta`, `server/discover` advertises versions and
// capabilities, every result has `resultType`, `tools/list` is cacheable (`ttlMs`, `cacheScope`).
// Clients on 2025-11-25 still work: `initialize` is answered and a request without the version
// meta is taken as that revision. Tools only: no resources, prompts, sampling or roots.
import { TOOLS, callTool } from './tools.js';

export const LATEST = '2026-07-28';
export const SUPPORTED = [LATEST, '2025-11-25', '2025-06-18'] as const;
export const SERVER_INFO = { name: 'sheetpane-mcp', title: 'sheetpane', version: '0.0.0' };
const UNSUPPORTED_PROTOCOL_VERSION = -32022;

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export interface Request { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: { _meta?: Record<string, unknown>; [k: string]: unknown } }
export interface Response { jsonrpc: '2.0'; id: string | number | null; result?: unknown; error?: { code: number; message: string; data?: unknown } }

const ok = (id: Response['id'], result: Record<string, unknown>, legacy: boolean): Response =>
  ({ jsonrpc: '2.0', id, result: legacy ? result : { resultType: 'complete', ...result, _meta: { 'io.modelcontextprotocol/serverInfo': SERVER_INFO } } });
const fail = (id: Response['id'], code: number, message: string, data?: unknown): Response => ({ jsonrpc: '2.0', id, error: { code, message, ...(data === undefined ? {} : { data }) } });

/** Answers one message; a notification (no `id`) gets no answer. */
export async function handle(msg: unknown): Promise<Response | undefined> {
  if (!msg || typeof msg !== 'object' || (msg as Request).jsonrpc !== '2.0' || typeof (msg as Request).method !== 'string') return fail(null, -32600, 'Invalid Request');
  const req = msg as Request;
  if (req.id === undefined) return undefined; // notifications (e.g. notifications/initialized): nothing to say
  const id = req.id;
  // the revision: from the request's _meta (2026-07-28), else an older client
  const asked = req.params?._meta?.['io.modelcontextprotocol/protocolVersion'];
  const legacy = asked === undefined || asked !== LATEST;
  if (typeof asked === 'string' && !(SUPPORTED as readonly string[]).includes(asked)) {
    return fail(id, UNSUPPORTED_PROTOCOL_VERSION, `Unsupported protocol version ${asked}`, { supported: [...SUPPORTED], requested: asked });
  }
  const capabilities = { tools: { listChanged: false } };
  switch (req.method) {
    case 'server/discover':
      return ok(id, { supportedVersions: [...SUPPORTED], capabilities, ttlMs: 3_600_000, cacheScope: 'public' }, false);
    case 'initialize': { // 2025 clients
      const want = String((req.params as { protocolVersion?: string } | undefined)?.protocolVersion ?? '2025-11-25');
      const version = (SUPPORTED as readonly string[]).includes(want) && want !== LATEST ? want : '2025-11-25';
      return ok(id, { protocolVersion: version, capabilities, serverInfo: SERVER_INFO, instructions: 'sheetpane tools: describe its API, inspect a workbook, draft or check a rules file, explain an SP code, find the right skill. Read-only.' }, true);
    }
    case 'ping':
      return ok(id, {}, legacy);
    case 'tools/list':
      return ok(id, { tools: TOOLS.map(({ name, title, description, inputSchema }) => ({ name, title, description, inputSchema })), ...(legacy ? {} : { ttlMs: 3_600_000, cacheScope: 'public' }) }, legacy);
    case 'tools/call': {
      const p = req.params as { name?: unknown; arguments?: Record<string, unknown> } | undefined;
      if (typeof p?.name !== 'string' || !TOOLS.some((t) => t.name === p.name)) return fail(id, -32602, `Unknown tool: ${String(p?.name)}`);
      const r = await callTool(p.name, p.arguments ?? {});
      return ok(id, r as unknown as Record<string, Json>, legacy);
    }
    default:
      return fail(id, -32601, `Method not found: ${req.method}`);
  }
}
