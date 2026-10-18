import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { shiftFormula as exportShift } from '@sheetpane/export';
import pkg from '../package.json';
import { shiftFormula } from '../src/index.js';

// Spelled in pieces so the L5 veto stays clean over this file too.
const FAMILY = 'font' + '-family';
const FACE = '@font' + '-face';
const CAMEL = 'font' + 'Family';
// Vite resolves `?raw` against the source tree: these are the files that ship.
const sources = import.meta.glob('../src/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('the package (DoD 1; SR-LAW-5)', () => {
  it('the L5 veto: no font family, no font face, no font file anywhere in the source, the tests or the README', () => {
    const files = {
      ...sources,
      ...import.meta.glob('./**/*.ts', { query: '?raw', import: 'default', eager: true }),
      ...import.meta.glob('../README.md', { query: '?raw', import: 'default', eager: true }),
    } as Record<string, string>;
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(4);
    expect(Object.keys(files).length).toBeGreaterThanOrEqual(9);
    const veto = new RegExp(`${FACE}|\\.(woff2?|ttf|otf)\\b|fonts\\.(googleapis|gstatic)|${CAMEL}|${FAMILY}`, 'i');
    for (const [path, text] of Object.entries(files)) expect(text.split('\n').filter((l) => veto.test(l)), path).toEqual([]);
  });
  it('the headless entry never imports the UI; the UI imports the entry', () => {
    const imports = (f: string) => [...sources[`../src/${f}.ts`]!.matchAll(/from '(\.[^']+)'/g)].map((m) => m[1]);
    expect(imports('index')).not.toContain('./ui.js');
    expect(imports('evaluate')).not.toContain('./ui.js');
    expect(imports('rules')).toEqual([]);
    expect(imports('ui')).toContain('./index.js');
  });
  it('no source touches the DOM at import time', () => {
    for (const [file, text] of Object.entries(sources)) {
      // top-level statements that are not declarations, imports or the registration call
      const top = text.split('\n').filter((l) => /^[a-z]/.test(l) && !/^(import|export|const|let|function|async|type|interface)\b/.test(l));
      expect(top.filter((l) => !l.startsWith('registerPlugin(')), file).toEqual([]);
      for (const l of text.split('\n').filter((x) => /^(const|let|export const) /.test(x))) expect(l, file).not.toMatch(/\b(document|window|customElements|getComputedStyle)\b/);
    }
  });
  it('no runtime dependency; grid and styles are peers; the registration modules are the side effects', () => {
    expect(pkg.dependencies).toEqual({ '@sheetpane/skills': 'workspace:*' }); // the agent skills ship with every package (W-35)
    expect(pkg.peerDependencies).toEqual({ '@sheetpane/grid': 'workspace:*', '@sheetpane/styles': 'workspace:*' });
    expect(pkg.sideEffects).toEqual(['./dist/index.js', './dist/ui.js', './src/index.ts', './src/ui.ts']);
    expect(Object.keys(pkg.exports)).toEqual(['.', './ui']);
    expect(Object.keys(pkg.publishConfig.exports)).toEqual(['.', './ui']);
    expect(pkg.license).toBe('MIT');
    // the source imports only its peers
    for (const [file, text] of Object.entries(sources)) {
      for (const m of text.matchAll(/from '([^.][^']*)'/g)) expect(['@sheetpane/grid', '@sheetpane/styles'], file).toContain(m[1]);
    }
  });
});

describe('shiftFormula agrees with @sheetpane/export’s', () => {
  it('on hand-picked formulas', () => {
    for (const [f, dr, dc] of [['A1+$B2', 1, 2], ['SUM(A1:B3)*$C$1', 3, 1], ['"A1"&A1', 1, 1], ["'My Sheet'!A1>B$2", 2, 0], ['A:A', 0, 2], ['1:1', 4, 0], ['A1', -1, 0], ['LOG10(A1)', 1, 1]] as const) {
      expect(shiftFormula(f, dr, dc), f).toBe(exportShift(f, dr, dc));
    }
  });
  it('on generated formulas', () => {
    const ref = fc.tuple(fc.boolean(), fc.constantFrom('A', 'B', 'Z', 'AA', 'XFD'), fc.boolean(), fc.integer({ min: 1, max: 1048576 })).map(([ac, c, ar, r]) => `${ac ? '$' : ''}${c}${ar ? '$' : ''}${r}`);
    const piece = fc.oneof(ref, fc.constantFrom('+', '*', '>', '(', ')', ',', 'SUM(', '"x"', ' ', 'Sheet2!', ':', '1.5'));
    fc.assert(fc.property(fc.array(piece, { maxLength: 12 }), fc.integer({ min: -5, max: 5 }), fc.integer({ min: -5, max: 5 }), (parts, dr, dc) => {
      const f = parts.join('');
      expect(shiftFormula(f, dr, dc)).toBe(exportShift(f, dr, dc));
    }), { numRuns: 300 });
  });
});
