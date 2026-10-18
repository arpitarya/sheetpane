#!/usr/bin/env node
// sheetpane-mcp: the MCP server over stdio — one JSON-RPC message per line in, one per line out.
// stdout carries protocol messages only; anything else goes to stderr.
import { createInterface } from 'node:readline';
import { handle } from './protocol.js';

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
let queue = Promise.resolve();
rl.on('line', (line) => {
  if (!line.trim()) return;
  // answer in arrival order, one at a time: the tools are quick and the order stays predictable
  queue = queue.then(async () => {
    let msg: unknown;
    try { msg = JSON.parse(line); } catch {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n');
      return;
    }
    // JSON-RPC batches left MCP in 2025-06-18: an array is an invalid request (handle says so)
    try {
      const res = await handle(msg);
      if (res) process.stdout.write(JSON.stringify(res) + '\n');
    } catch (e) {
      const id = (msg as { id?: unknown } | null)?.id ?? null;
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32603, message: `Internal error: ${(e as Error).message}` } }) + '\n');
    }
  });
});
rl.on('close', () => { void queue.then(() => process.exit(0)); });
