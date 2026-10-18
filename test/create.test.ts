// W-43: `npm create sheetpane` — every template scaffolds whole (no placeholder left, a .gitignore,
// the folder's name), a non-empty folder is refused, a usage error exits 2, and the install and
// skills commands are the ones asked for. The templates' own install, build and test are
// `just create-check` (scripts/create-check.mjs), which needs the network.
import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { detectPm, main, nodeOk, parseArgs, skillsArgs, TEMPLATES, toPackageName, VERSION } from '../packages/create-sheetpane/bin/create-sheetpane.mjs';

const root = join(import.meta.dirname, '..');
const TPL = join(root, 'packages/create-sheetpane/templates');
const names = Object.keys(TEMPLATES);
const tmp = () => mkdtempSync(join(tmpdir(), 'sp-create-'));
const files = (d: string): string[] => readdirSync(d, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));
async function run(argv: string[], io: Parameters<typeof main>[1] = {}) {
  const out: string[] = [], err: string[] = [];
  const code = await main(argv, { out: (s) => out.push(s), err: (s) => err.push(s), ...io });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

describe('the templates (W-43 DoD 2, 3, 6)', () => {
  it('one folder per template, and the shared one', () => {
    expect(readdirSync(TPL).sort()).toEqual(['_shared', ...names].sort());
  });
  it.each(names)('%s pins every dependency exactly; sheetpane at the lockstep placeholder', (t) => {
    const p = JSON.parse(readFileSync(join(TPL, t, 'package.json'), 'utf8'));
    for (const k of ['dependencies', 'devDependencies']) {
      for (const [n, v] of Object.entries<string>(p[k] ?? {})) {
        if (n.startsWith('@sheetpane/')) expect(v, n).toBe('__SHEETPANE_VERSION__');
        else expect(v, `${t}: ${n}`).toMatch(/^\d+\.\d+\.\d+$/);
      }
    }
    expect(p.dependencies['@sheetpane/grid']).toBeDefined();
    expect(Object.keys(p.devDependencies)).toEqual(expect.arrayContaining(['@sheetpane/fixtures', '@sheetpane/testing', '@playwright/test']));
    for (const s of ['dev', 'build', 'preview', 'test']) expect(p.scripts[s], s).toBeTruthy();
  });
  it.each(names)('%s renders both elements on one pane, the pop-up, the sample and the rules file', (t) => {
    const src = files(join(TPL, t)).filter((f) => /\.(html|ts|tsx|vue|svelte)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(src).toMatch(/<sheetpane-excel pane="review"[^>]*src="\/showcase\.xlsx"[^>]*rules-src="\/showcase\.rules\.json"/);
    expect(src).toMatch(/<sheetpane-errors pane="review"/);
    expect(src).toMatch(/<sheetpane-excel [^>]*pane="review"[^>]*display="popup"/);
    expect(src).toContain("import '@sheetpane/grid'");
    const typing = { react: '@sheetpane/grid/jsx', next: '@sheetpane/grid/jsx', vue: '@sheetpane/grid/vue', svelte: '@sheetpane/grid/svelte' }[t];
    if (typing) expect(src).toContain(`import type {} from '${typing}'`);
    if (t === 'angular') expect(src).toContain('CUSTOM_ELEMENTS_SCHEMA');
    if (t === 'vue') expect(readFileSync(join(TPL, t, 'vite.config.ts'), 'utf8')).toContain('isCustomElement');
    if (t === 'next') expect(readFileSync(join(TPL, t, 'app/page.tsx'), 'utf8')).toMatch(/'use client'[\s\S]*ssr: false/);
  });
});

describe('create-sheetpane (W-43 DoD 1, 4)', () => {
  it.each(names)('--template %s --yes --no-install: the files, filled in', async (t) => {
    const d = tmp();
    try {
      const r = await run([`my-${t}-app`, '--template', t, '--yes', '--no-install', '--pm', 'npm'], { cwd: d, nodeVersion: '24.15.0' });
      expect(r.code, r.err).toBe(0);
      const app = join(d, `my-${t}-app`);
      const all = files(app);
      for (const f of all) expect(readFileSync(f, 'utf8'), f).not.toMatch(/__[A-Z][A-Z_]*__/);
      expect(existsSync(join(app, '.gitignore'))).toBe(true);
      expect(all.some((f) => f.endsWith('_gitignore'))).toBe(false);
      const p = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'));
      expect(p.name).toBe(`my-${t}-app`);
      expect(p.dependencies['@sheetpane/grid']).toBe(VERSION);
      for (const f of ['scripts/sample.mjs', 'e2e/review.spec.ts', 'playwright.config.ts', 'README.md']) expect(existsSync(join(app, f)), f).toBe(true);
      expect(readFileSync(join(app, 'README.md'), 'utf8')).toContain('sheetpane-skills install');
      expect(r.out).toContain(`cd my-${t}-app`);
      expect(r.out).toContain('npx sheetpane-skills install --all --skip contributor'); // --no-install: the skills are a next step
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  it('refuses a folder that is not empty, and writes nothing', async () => {
    const d = tmp();
    try {
      mkdirSync(join(d, 'app'));
      writeFileSync(join(d, 'app', 'keep.txt'), 'mine');
      const r = await run(['app', '--yes', '--no-install'], { cwd: d });
      expect(r.code).toBe(1);
      expect(r.err).toMatch(/not empty/);
      expect(readdirSync(join(d, 'app'))).toEqual(['keep.txt']);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  it('an empty existing folder is fine', async () => {
    const d = tmp();
    try {
      mkdirSync(join(d, 'empty'));
      expect((await run(['empty', '--yes', '--no-install'], { cwd: d })).code).toBe(0);
      expect(existsSync(join(d, 'empty', 'index.html'))).toBe(true);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  it('usage errors exit 2: an unknown template, option or value', async () => {
    for (const argv of [['x', '--template', 'ember', '--yes'], ['x', '--frobnicate'], ['x', '--skills', 'some'], ['x', '--pm', 'bun'], ['x', 'y']]) {
      const r = await run(argv, { cwd: tmpdir() });
      expect(r.code, argv.join(' ')).toBe(2);
      expect(r.err).toMatch(/create-sheetpane:/);
    }
    expect((await run(['--help'])).code).toBe(0);
  });

  it('installs, then adds the skills as asked — with the package manager asked for', async () => {
    const cases: [string[], string[][]][] = [
      [['--pm', 'npm', '--skills', 'all', '--mcp'], [['npm', 'install'], ['npx', '--no', 'sheetpane-skills', 'install', '--all']]],
      [['--pm', 'pnpm', '--skills', 'host', '--no-mcp'], [['pnpm', 'install'], ['pnpm', 'exec', 'sheetpane-skills', 'install', '--all', '--skip', 'contributor', '--no-mcp']]],
      [['--pm', 'yarn', '--skills', 'none'], [['yarn']]],
    ];
    for (const [flags, want] of cases) {
      const d = tmp();
      try {
        const ran: string[][] = [];
        const r = await run(['app', '--template', 'react', '--yes', ...flags], { cwd: d, run: (cmd, args, cwd) => { expect(cwd).toBe(join(d, 'app')); ran.push([cmd, ...args]); return 0; } });
        expect(r.code, r.err).toBe(0);
        expect(ran).toEqual(want);
      } finally { rmSync(d, { recursive: true, force: true }); }
    }
  });

  it('a failed install is reported, exit 1', async () => {
    const d = tmp();
    try {
      const r = await run(['app', '--yes', '--pm', 'npm'], { cwd: d, run: () => 1 });
      expect(r.code).toBe(1);
      expect(r.err).toMatch(/npm install` failed/);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  it('asks for what the flags left out', async () => {
    const d = tmp();
    try {
      const input = new PassThrough();
      input.end(['my app', '3', '2', 'n', ''].join('\n') + '\n'); // folder, next, all skills, no MCP
      const ran: string[][] = [];
      const r = await run(['--pm', 'pnpm'], { cwd: d, input, output: new PassThrough(), run: (cmd, args) => { ran.push([cmd, ...args]); return 0; } });
      expect(r.code, r.err).toBe(0);
      expect(JSON.parse(readFileSync(join(d, 'my app', 'package.json'), 'utf8')).name).toBe('my-app');
      expect(existsSync(join(d, 'my app', 'app', 'page.tsx'))).toBe(true);
      expect(ran.at(-1)).toEqual(['pnpm', 'exec', 'sheetpane-skills', 'install', '--all', '--no-mcp']);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  it('the small parts', () => {
    expect(detectPm('pnpm/10.28.2 npm/? node/v24.15.0 darwin arm64')).toBe('pnpm');
    expect(detectPm('yarn/4.5.0 npm/? node/v22')).toBe('yarn');
    expect(detectPm('')).toBe('npm');
    expect(toPackageName('/x/My Sheet App')).toBe('my-sheet-app');
    expect(toPackageName('/x/.hidden')).toBe('hidden');
    expect(skillsArgs('none', true)).toBeUndefined();
    expect(parseArgs(['--template=vue', '--skills=host']).template).toBe('vue');
    expect(nodeOk('^22.22.3 || ^24.15.0 || >=26.0.0', '24.13.0')).toBe(false);
    expect(nodeOk('^22.22.3 || ^24.15.0 || >=26.0.0', '22.22.3')).toBe(true);
    expect(nodeOk('^22.22.3 || ^24.15.0 || >=26.0.0', '27.0.0')).toBe(true);
  });

  it('the version is the lockstep one', () => {
    expect(VERSION).toBe(JSON.parse(readFileSync(join(root, 'packages/grid/package.json'), 'utf8')).version);
  });
});
