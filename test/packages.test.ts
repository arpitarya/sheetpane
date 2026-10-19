// Package-level checks the laws owe (testing verdict decision 10):
// B-023 publishable + lockstep (SR-LAW-8), B-012 no framework peer (SR-LAW-4),
// B-015 no font shipped (SR-LAW-5), the runtime-dependency allow-list (SR-LAW-2),
// and no network call but the three reads (SR-LAW-11).
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const dirs = readdirSync(join(root, 'packages')).filter((d) => statSync(join(root, 'packages', d)).isDirectory());
const manifests = dirs.map((d) => ({ dir: d, p: JSON.parse(readFileSync(join(root, 'packages', d, 'package.json'), 'utf8')) }));
const rootManifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const FRAMEWORKS = ['react', 'react-dom', 'vue', '@angular/core', 'svelte', 'preact', 'solid-js', 'lit'];
// SR-LAW-2 + plugins verdict decision 8: the only third-party runtime dependencies in the project.
const ALLOWED_RUNTIME = new Set(['numfmt', '@ironcalc/wasm']);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('SR-LAW-8 — every package is publishable, in lockstep (B-023)', () => {
  it('the root is the private monorepo root', () => {
    expect(rootManifest.private).toBe(true);
  });
  it.each(manifests)('$dir is a public @sheetpane package with types and ESM exports', ({ dir, p }) => {
    expect(p.private, dir).toBeFalsy();
    // The one exception to the scope (W-43): `npm create sheetpane` runs the package named
    // `create-sheetpane`, so the scaffolder cannot be `@sheetpane/create-sheetpane`. It ships its
    // CLI and the app templates, no build and no dependency (SR-BUILD decision 7).
    if (dir === 'create-sheetpane') {
      expect(p.name).toBe('create-sheetpane');
      expect(p.license).toBe('MIT');
      expect(p.type).toBe('module');
      expect(p.files).toEqual(['bin', 'templates']);
      expect(p.bin).toEqual({ 'create-sheetpane': './bin/create-sheetpane.mjs' });
      expect(p.dependencies ?? {}).toEqual({});
      return;
    }
    expect(p.name).toBe(`@sheetpane/${dir}`);
    expect(p.license).toBe('MIT');
    expect(p.type).toBe('module');
    // @sheetpane/fixtures also ships its files, which url() reaches from src/ and dist/ alike;
    // @sheetpane/skills ships Markdown and an installer, no build (SR-BUILD decision 7)
    if (dir === 'skills') {
      expect(p.files).toEqual(['skills', 'entry', 'bin']);
      expect(p.bin).toEqual({ 'sheetpane-skills': './bin/sheetpane-skills.mjs' });
      expect(p.dependencies ?? {}).toEqual({});
      return;
    }
    // @sheetpane/grid also ships custom-elements.json at its root, where the `customElements` field points (W-37)
    expect(p.files).toEqual(dir === 'fixtures' ? ['dist', 'files'] : dir === 'grid' ? ['dist', 'custom-elements.json'] : ['dist']);
    for (const [entry, target] of Object.entries<any>(p.exports)) {
      if (typeof target === 'string') continue; // a stylesheet
      expect(target.types, `${dir} ${entry}`).toMatch(/^\.\/dist\/.*\.d\.ts$/);
      expect(target.import, `${dir} ${entry}`).toMatch(/^\.\/dist\/.*\.js$/);
    }
  });
  it('every package carries the same version (lockstep)', () => {
    expect(new Set(manifests.map(({ p }) => p.version)).size).toBe(1);
  });
  it.each(manifests)('$dir pins its @sheetpane/* dependencies through workspace:*', ({ p }) => {
    for (const k of ['dependencies', 'peerDependencies', 'devDependencies']) {
      for (const [n, v] of Object.entries<string>(p[k] ?? {})) if (n.startsWith('@sheetpane/')) expect(v).toBe('workspace:*');
    }
  });
});

describe('SR-LAW-4 — no UI framework is a dependency or peer (B-012)', () => {
  it.each(manifests)('$dir lists no framework', ({ p }) => {
    const named = [...Object.keys(p.dependencies ?? {}), ...Object.keys(p.peerDependencies ?? {})];
    expect(named.filter((n) => FRAMEWORKS.includes(n))).toEqual([]);
  });
});

describe('SR-LAW-2 — runtime dependencies are only the allowed engines', () => {
  it.each(manifests)('$dir', ({ p }) => {
    const third = Object.keys(p.dependencies ?? {}).filter((n) => !n.startsWith('@sheetpane/'));
    expect(third.filter((n) => !ALLOWED_RUNTIME.has(n))).toEqual([]);
    for (const n of third) expect(p.dependencies[n], n).toMatch(/^\d+\.\d+\.\d+$/); // pinned exactly
  });
});

describe('SR-LAW-5 — no font ships (B-015)', () => {
  // what each package ships as source: src/, for @sheetpane/skills its Markdown and installer,
  // for create-sheetpane its CLI and the app templates (W-43: a scaffolded app sets no font either)
  const shipped = (d: string) => (d === 'skills' ? ['skills', 'entry', 'bin'] : d === 'create-sheetpane' ? ['bin', 'templates'] : ['src']).map((x) => join(root, 'packages', d, x)).filter((x) => existsSync(x));
  const files = dirs.flatMap((d) => shipped(d).flatMap((x) => walk(x)));
  it('no font file, @font-face, web-font URL or named font-family in any package source', () => {
    const bad: string[] = [];
    for (const f of files) {
      if (/\.(woff2?|ttf|otf)$/.test(f)) bad.push(f);
      const s = readFileSync(f, 'utf8');
      if (/@font-face|fonts\.(googleapis|gstatic)/.test(s)) bad.push(f);
      for (const m of s.matchAll(/font-family\s*:\s*([^;}"'`]*)/g)) if (!/^\s*inherit\s*$/.test(m[1]!)) bad.push(`${f}: ${m[0]}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('SR-LAW-11 — the workbook never leaves the browser', () => {
  // the code each package ships: src/ (tests excluded), the CLIs, create-sheetpane's templates;
  // the skills' Markdown is excluded — it shows host code, which is the host's (SR-LAW-11 decision 6)
  const code = (d: string) => (d === 'skills' ? ['entry', 'bin'] : d === 'create-sheetpane' ? ['bin', 'templates'] : ['src']).map((x) => join(root, 'packages', d, x)).filter((x) => existsSync(x));
  const files = dirs.flatMap((d) => code(d).flatMap((x) => walk(x))).filter((f) => /\.(m?[jt]sx?|vue|svelte|html)$/.test(f) && !/\.test\./.test(f));
  const NET = /\bfetch\(|XMLHttpRequest|sendBeacon|\bWebSocket\b|\bEventSource\b|RTCPeerConnection|importScripts|\.submit\s*\(|['"]node:(https?|http2|net|tls|dgram)['"]|['"](undici|axios|node-fetch|got|ky)['"]/g;
  // decision 4: the only reads — the grid's `src` and `rules-src`, and fixtures reading its own files
  const ALLOWED = [
    'packages/fixtures/src/index.ts: fetch(',
    'packages/grid/src/excel/element.ts: fetch(',
    'packages/grid/src/excel/element.ts: fetch(',
  ];
  it('no network call in any package source but the three reads in decision 4', () => {
    const hits: string[] = [];
    for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(NET)) hits.push(`${f.slice(root.length + 1).split('\\').join('/')}: ${m[0].replace(/\s+/g, '')}`);
    expect(hits.sort()).toEqual(ALLOWED);
  });
  it('the reads send nothing: no method but GET, no body', () => {
    const bad: string[] = [];
    for (const f of files) {
      const s = readFileSync(f, 'utf8');
      for (const m of s.matchAll(/\bfetch\s*\(([^;]*)/g)) if (/method\s*:|body\s*:/.test(m[1]!)) bad.push(`${f}: ${m[0]}`);
    }
    expect(bad).toEqual([]);
  });
});
