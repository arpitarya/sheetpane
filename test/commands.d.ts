import type { SavedDownload } from './commands.js';
declare module 'vitest/browser' {
  interface BrowserCommands {
    armDownload(timeoutMs?: number): Promise<void>;
    takeDownload(): Promise<SavedDownload>;
  }
}
