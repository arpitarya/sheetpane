// W-36: every public export carries TSDoc that survives into the published `.d.ts`; each custom
// element documents its attributes, properties, methods and events with one @example; every
// @example code block compiles against the built packages. Run after `just build`.
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { problems, walk } from './tsdoc-walk.ts';

const root = join(import.meta.dirname, '..');
const PKGS = ['export', 'import', 'grid', 'numfmt', 'styles', 'formulas', 'validation', 'condfmt', 'images', 'charts', 'comments', 'fixtures', 'testing'];
const built = PKGS.every((p) => existsSync(join(root, 'packages', p, 'dist')));
const all = built ? walk(root, PKGS) : [];
const unique = [...new Map(all.map((e) => [`${e.file}#${e.name}`, e])).values()];
const ELEMENTS = [['grid', 'SheetpaneExcel'], ['grid', 'SheetpaneErrors']] as const;

describe.skipIf(!built)('TSDoc on the published API (W-36)', () => {
  it('builds keep comments (removeComments stays off)', () => {
    expect(readFileSync(join(root, 'tsconfig.base.json'), 'utf8')).not.toMatch(/"removeComments"\s*:\s*true/);
    expect(readFileSync(join(root, 'packages/grid/dist/excel/element.d.ts'), 'utf8')).toMatch(/\/\*\*/);
  });
  for (const pkg of PKGS) {
    it(`${pkg}: every export has a summary; functions have @param and @returns`, () => {
      const bad = unique.filter((e) => e.pkg === pkg).map((e) => ({ e, p: problems(e) })).filter((x) => x.p.length).map((x) => `${x.e.name} (${x.e.file}): ${x.p.join(', ')}`);
      expect(bad).toEqual([]);
    });
  }
  for (const [pkg, name] of ELEMENTS) {
    it(`<${name}>: attributes, properties, methods, events (@fires) and one @example; @see its record`, () => {
      const e = unique.find((x) => x.pkg === pkg && x.name === name)!;
      expect(e?.doc, name).toBeDefined();
      expect(e.doc).toMatch(/@fires sheetpane-/);
      expect(e.doc).toMatch(/@example/);
      expect(e.doc).toMatch(/@see .*records\/01\d\d_/);
      expect(e.doc).toMatch(/[Aa]ttributes/);
    });
  }
  it('every @example code block type-checks against the built packages', () => {
    const dir = join(root, `test/.tsdoc-examples-${process.pid}`); // per run: parallel runs never share it
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const prelude = `import type { SheetpaneExcel, SheetpaneErrors, WorkbookStore } from '@sheetpane/grid';\ndeclare const excel: SheetpaneExcel; declare const errors: SheetpaneErrors; declare const store: WorkbookStore; declare const bytes: Uint8Array; declare const file: File;\n`;
    let n = 0;
    for (const e of unique) {
      for (const block of (e.doc ?? '').split('@example').slice(1)) {
        const code = /```(?:ts|js|typescript)\n([\s\S]*?)```/.exec(block.replace(/^\s*\*\s?/gm, ''))?.[1];
        if (!code) continue;
        writeFileSync(join(dir, `${e.pkg}-${e.name}-${n++}.ts`), `${prelude}${code}\nexport {};\n`);
      }
    }
    const paths: Record<string, string[]> = {};
    for (const p of PKGS) {
      const m = JSON.parse(readFileSync(join(root, 'packages', p, 'package.json'), 'utf8'));
      for (const [entry, t] of Object.entries<any>(m.exports ?? {})) if (typeof t === 'object' && t.types) paths[`@sheetpane/${p}${entry === '.' ? '' : entry.slice(1)}`] = [join(root, 'packages', p, t.types)];
    }
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, noEmit: true, skipLibCheck: true, lib: ['ES2022', 'DOM', 'DOM.Iterable'], types: [], paths }, include: ['*.ts'] }));
    expect(n).toBeGreaterThan(0);
    let out = '';
    try { execFileSync(join(root, 'node_modules/.bin/tsc'), ['-p', join(dir, 'tsconfig.json')], { encoding: 'utf8' }); } catch (err) { out = String((err as { stdout?: string }).stdout ?? err); }
    rmSync(dir, { recursive: true, force: true });
    expect(out).toBe('');
  }, 120_000);
});
