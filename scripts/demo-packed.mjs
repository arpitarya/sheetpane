// W-09 DoD 6 (SR-LAW-8): install both demos from `pnpm pack` tarballs — as a host
// would from npm, with no workspace link — then run the same browser check.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const tmp = mkdtempSync(join(tmpdir(), 'sheetpane-demo-'));
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });
const tarballs = {};
for (const pkg of ['export', 'import', 'grid', 'numfmt', 'styles', 'formulas', 'validation', 'condfmt', 'images', 'charts', 'comments', 'visibility', 'tables', 'compare', 'fixtures']) {
  const out = run('pnpm', ['pack', '--pack-destination', tmp], join(root, 'packages', pkg)).trim().split('\n').pop();
  tarballs[`@sheetpane/${pkg}`] = `file:${out}`;
}
const dirs = {};
for (const app of ['html', 'react']) {
  const dir = join(tmp, app);
  cpSync(join(root, 'examples', app), dir, { recursive: true, filter: (p) => !/node_modules|[/\\]dist([/\\]|$)/.test(p) });
  const pj = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  for (const k of Object.keys(pj.dependencies)) if (tarballs[k]) pj.dependencies[k] = tarballs[k];
  pj.pnpm = { overrides: tarballs };
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pj, null, 2));
  run('pnpm', ['install', '--prefer-offline', '--ignore-workspace'], dir);
  if (app === 'react') run('pnpm', ['exec', 'vite', 'build'], dir);
  dirs[app] = app === 'react' ? join(dir, 'dist') : dir;
}
console.log(`installed from tarballs in ${tmp}`);
try {
  process.stdout.write(run('node', [join(root, 'scripts', 'demo-check.mjs'), dirs.html, dirs.react], root));
} catch (e) {
  process.stdout.write(String(e.stdout ?? ''));
  process.exitCode = 1;
} finally {
  if (!process.env.SP_KEEP_TMP) rmSync(tmp, { recursive: true, force: true });
}
