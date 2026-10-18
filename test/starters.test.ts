// W-44 DoD 2: the StackBlitz starters are exactly what the CLI scaffolds now, and each link opens a
// folder with a dev script. (StackBlitz itself is not loaded here: it installs from npm, so a starter
// runs once its version is published — SR-BUILD decision 8b.)
import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OUT, buildStarters, stackblitz, tree } from '../scripts/build-starters.mjs';
import { TEMPLATES } from '../packages/create-sheetpane/bin/create-sheetpane.mjs';

describe('the starters (W-44)', () => {
  it('are fresh — run `just starters` after changing a template or the version', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sp-starters-check-'));
    try {
      await buildStarters(dir);
      expect(tree(OUT)).toEqual(tree(dir));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 60_000);
  it.each(Object.keys(TEMPLATES))('%s: a folder with dev and build scripts, linked from the index', (t) => {
    const pkg = JSON.parse(readFileSync(join(OUT, t, 'package.json'), 'utf8'));
    expect(pkg.scripts.dev).toBeTruthy();
    expect(pkg.scripts.build).toBeTruthy();
    expect(Object.keys(pkg.dependencies)).toContain('@sheetpane/grid');
    expect(existsSync(join(OUT, t, 'node_modules'))).toBe(false);
    expect(readFileSync(join(OUT, 'README.md'), 'utf8')).toContain(stackblitz(t));
    expect(stackblitz(t)).toMatch(/^https:\/\/stackblitz\.com\/github\/arpitarya\/sheetpane\/tree\/(main|v\d+\.\d+\.\d+[^/]*)\/examples\/starters\//);
  });
});
