// SR-LAW-12: every plugin is in the demos — imported, on its own gallery tab, and on the "All plugins" tab —
// in both the plain-HTML and the React demo. A plugin is a package that registers one (`registerPlugin`).
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

/** Every plugin id a package registers, from its source; the grid (the host) is not a plugin. */
export function pluginIds(): Map<string, string> {
  const out = new Map<string, string>(); // id → package folder
  for (const pkg of readdirSync(join(ROOT, 'packages'))) {
    const src = join(ROOT, 'packages', pkg, 'src');
    if (pkg === 'grid' || !existsSync(src)) continue;
    for (const f of readdirSync(src, { recursive: true }) as string[]) {
      if (!/\.ts$/.test(f) || /\.d\.ts$/.test(f)) continue;
      const text = readFileSync(join(src, f), 'utf8');
      const consts = Object.fromEntries([...text.matchAll(/const ([A-Z_]+)\s*=\s*'([a-z-]+)'/g)].map((m) => [m[1]!, m[2]!]));
      for (const m of text.matchAll(/registerPlugin\(\s*(?:'([a-z-]+)'|([A-Z_]+))/g)) {
        const id = m[1] ?? consts[m[2]!];
        if (id) out.set(id, pkg);
      }
    }
  }
  return out;
}

/** The demo's gallery tabs: id and the `plugins` string of each. */
function tabs(file: string): { id: string; plugins?: string | undefined }[] {
  const text = readFileSync(join(ROOT, file), 'utf8');
  return [...text.matchAll(/\{ id: '([a-z-]+)', label: '[^']*'(?:, plugins: '([^']*)')?/g)].map((m) => ({ id: m[1]!, plugins: m[2] }));
}

const DEMOS = { html: 'examples/html/index.html', react: 'examples/react/src/PluginGallery.tsx' } as const;

describe('SR-LAW-12: every plugin is in both demos', () => {
  const ids = pluginIds();
  it('finds the plugins', () => {
    expect(ids.size).toBeGreaterThanOrEqual(12);
    expect([...ids.keys()]).toEqual(expect.arrayContaining(['numfmt', 'styles', 'visibility', 'tables', 'compare', 'review']));
  });
  for (const [demo, file] of Object.entries(DEMOS)) {
    const list = tabs(file), text = readFileSync(join(ROOT, file), 'utf8');
    const all = (list.find((t) => t.id === 'all')?.plugins ?? '').split(/\s+/).filter(Boolean);
    it.each([...ids])(`${demo}: %s is imported, has its own tab, and is on All plugins`, (id, pkg) => {
      expect(text, `${file} imports @sheetpane/${pkg}`).toMatch(new RegExp(`from '@sheetpane/${pkg}(/[a-z]+)?'|import '@sheetpane/${pkg}(/[a-z]+)?'`));
      expect(list.some((t) => t.id !== 'all' && (t.plugins ?? '').split(/\s+/).includes(id)), `${file} has a tab for ${id}`).toBe(true);
      expect(all, `${file}: the All plugins tab lists ${id}`).toContain(id);
    });
  }
});
