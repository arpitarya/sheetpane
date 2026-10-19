import { describe, expect, it } from 'vitest';
import pkg from '../package.json';

// Vite resolves `?raw` against the source tree: these are the files that ship.
const sources = import.meta.glob('../src/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const code = (t: string) => t.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('the package (DoD 1; SR-LAW-2, 5, 11)', () => {
  it('no source names a font (SR-LAW-5)', () => {
    expect(Object.keys(sources).length).toBe(6);
    for (const [file, text] of Object.entries(sources)) expect(code(text), file).not.toMatch(/font-family|fontFamily|<font|rFont/); // a cloned format keeps the fontId the file gave it
  });
  it('the write path is string XML only — no DOMParser, no document — so exportPatch runs in Node too', () => {
    for (const [file, text] of Object.entries(sources)) expect(code(text), file).not.toMatch(/DOMParser|XMLSerializer|\bdocument\b|\bwindow\b/);
  });
  it('nothing goes over the network (SR-LAW-11): no fetch, beacon, socket or XHR', () => {
    for (const [file, text] of Object.entries(sources)) expect(code(text), file).not.toMatch(/\bfetch\s*\(|sendBeacon|WebSocket|XMLHttpRequest|EventSource|\bimport\s*\(/);
  });
  it('no source touches anything at import time; index registers the plugin and nothing else runs', () => {
    for (const [file, text] of Object.entries(sources)) {
      const top = text.split('\n').filter((l) => /^[a-z]/.test(l) && !/^(import|export|const|let|function|async|type|interface|class)\b/.test(l));
      expect(top.filter((l) => !l.startsWith('registerPlugin(')), file).toEqual([]);
    }
    expect(sources['../src/index.ts']).toContain("registerPlugin('review', () => review());");
  });
  it('runtime dependencies: export and skills only; grid is a peer; one entry; the registration module is the side effect', () => {
    expect(pkg.dependencies).toEqual({ '@sheetpane/export': 'workspace:*', '@sheetpane/skills': 'workspace:*' });
    expect(pkg.peerDependencies).toEqual({ '@sheetpane/grid': 'workspace:*' });
    expect(pkg.sideEffects).toEqual(['./dist/index.js', './src/index.ts']);
    expect(Object.keys(pkg.exports)).toEqual(['.']);
    expect(pkg.license).toBe('MIT');
    for (const [file, text] of Object.entries(sources)) {
      const runtime = [...text.matchAll(/^import (?!type\b)[^;]*from '([^']+)'/gm)].map((m) => m[1]);
      for (const r of runtime) expect(r === '@sheetpane/grid' || r === '@sheetpane/export' || r!.startsWith('./'), `${file}: ${r}`).toBe(true);
    }
  });
});
