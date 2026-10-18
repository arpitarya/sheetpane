// W-38: llms.txt and llms-full.txt are what the generator writes from the docs today — a stale
// one fails; the size is printed (over 200 KB is a hint to split per package).
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error — a plain .mjs script without types
import { outputs } from '../scripts/build-llms.mjs';

const root = join(import.meta.dirname, '..');

describe('llms.txt (W-38)', () => {
  for (const [name, text] of Object.entries(outputs as Record<string, string>)) {
    it(`${name} is fresh (run \`just llms\` after changing a README, a record or a skill)`, () => {
      expect(existsSync(join(root, name))).toBe(true);
      expect(readFileSync(join(root, name), 'utf8') === text, `${name} is stale`).toBe(true);
    });
  }
  it('follows llmstxt.org: an H1, a summary, sections of links; work/ and archive/ never inlined or indexed', () => {
    const index = (outputs as Record<string, string>)['llms.txt']!;
    expect(index.split('\n')[0]).toBe('# sheetpane');
    expect(index).toMatch(/^> /m);
    for (const h of ['## Start', '## Elements', '## Plugins', '## Rules and errors', '## Skills', '## Records']) expect(index).toContain(h);
    const full = (outputs as Record<string, string>)['llms-full.txt']!;
    expect(full).not.toMatch(/<!-- source: (work|archive)\//); // never inlined (SR-WORK-ARCHIVE)
    expect(index).not.toMatch(/\]\([^)]*\/blob\/[^/]+\/(work|archive)\//);
    const kb = Math.round(Buffer.byteLength(full) / 1024);
    console.log(`llms-full.txt: ${kb} KB${kb > 200 ? ' — over 200 KB: consider one file per package' : ''}`);
  });
});
