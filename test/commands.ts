// Server-side browser commands for the real-download tests (SR-DOWNLOAD, W-12 DoD 6):
// arm a listener for the page's next download, then take what the browser saved.
import { readFile } from 'node:fs/promises';
import type { BrowserCommand } from 'vitest/node';
import type { Download } from 'playwright';
import type {} from '@vitest/browser-playwright';

export interface SavedDownload { name: string; size: number; head: number[]; text: string | null; failure: string | null }

const armed = new Map<string, Promise<Download>>();

export const armDownload: BrowserCommand<[timeoutMs?: number]> = async (ctx, timeoutMs = 10_000) => {
  armed.set(ctx.sessionId, ctx.page.waitForEvent('download', { timeout: timeoutMs }));
};

export const takeDownload: BrowserCommand<[]> = async (ctx): Promise<SavedDownload> => {
  const pending = armed.get(ctx.sessionId);
  armed.delete(ctx.sessionId);
  if (!pending) throw new Error('takeDownload() without armDownload()');
  const d = await pending;
  const failure = await d.failure();
  const path = failure ? null : await d.path();
  const bytes = path ? new Uint8Array(await readFile(path)) : new Uint8Array();
  const isText = /\.csv$/i.test(d.suggestedFilename());
  return { name: d.suggestedFilename(), size: bytes.length, head: [...bytes.subarray(0, 8)], text: isText ? new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes) : null, failure };
};
