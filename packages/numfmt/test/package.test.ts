import { describe, expect, it } from 'vitest';
import pkg from '../package.json';

// Vite resolves `?raw` against the source tree: these are the files that ship.
const sources = import.meta.glob('../src/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('the package (DoD 1; SR-LAW-5)', () => {
  it('no source names a font (SR-LAW-5)', () => {
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(4);
    for (const [file, text] of Object.entries(sources)) expect(text, file).not.toMatch(/font-family|fontFamily/);
  });
  it('the headless entry never imports the UI; the UI imports the entry', () => {
    const imports = (f: string) => [...sources[`../src/${f}.ts`]!.matchAll(/from '(\.[^']+)'/g)].map((m) => m[1]);
    expect(imports('index')).not.toContain('./ui.js');
    expect(imports('fmt')).toEqual([]);
    expect(imports('patch')).toEqual(['./fmt.js']);
    expect(imports('ui')).toContain('./index.js');
  });
  it('no source touches the DOM at import time', () => {
    for (const [file, text] of Object.entries(sources)) {
      // top-level statements that are not declarations, imports or the registration call
      const top = text.split('\n').filter((l) => /^[a-z]/.test(l) && !/^(import|export|const|let|function|async|type|interface)\b/.test(l));
      expect(top.filter((l) => !l.startsWith('registerPlugin(')), file).toEqual([]);
    }
  });
  it('numfmt is pinned exactly; grid is a peer; the registration modules are the side effects', () => {
    expect(pkg.dependencies).toEqual({ '@sheetpane/skills': 'workspace:*', numfmt: '4.0.1' }); // the agent skills ship with every package (W-35)
    expect(pkg.peerDependencies).toEqual({ '@sheetpane/grid': 'workspace:*' });
    expect(pkg.sideEffects).toEqual(['./dist/index.js', './dist/ui.js', './src/index.ts', './src/ui.ts']);
    expect(Object.keys(pkg.exports)).toEqual(['.', './ui']);
    expect(pkg.license).toBe('MIT');
  });
});
