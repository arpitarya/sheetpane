// The built packages, as a host installs them (SR-BUILD decision 8): every package packed by
// `pnpm pack` (workspace:* rewritten), all the tarballs installed with npm into an empty folder
// outside the workspace (`--legacy-peer-deps`: a host's own peers — Playwright, Vitest for
// @sheetpane/testing — are not downloaded; the packages' peers on each other are installed
// explicitly), then each one used from plain Node — its main entry imported (SR-LAW-8:
// every package imports with no DOM), a `/check` entry run on a CSV (W-54), a bin-only package's
// bin syntax-checked. No source is read.
// Usage: node scripts/smoke-built.mjs   (after `pnpm -r build`)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const shell = process.platform === 'win32'; // pnpm and npm are .cmd shims on Windows
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', shell, stdio: ['ignore', 'pipe', 'inherit'] });
const tmp = mkdtempSync(join(tmpdir(), 'sheetpane-smoke-'));
const tarballs = join(tmp, 'tarballs'), host = join(tmp, 'host');

const pkgs = [];
for (const dir of readdirSync(join(root, 'packages'))) {
  const f = join(root, 'packages', dir, 'package.json');
  if (!existsSync(f)) continue;
  const p = JSON.parse(readFileSync(f, 'utf8'));
  if (p.private) continue;
  const out = run('pnpm', ['pack', '--pack-destination', tarballs], join(root, 'packages', dir)).trim().split('\n').pop().trim();
  pkgs.push({ p, tgz: out });
}
mkdirSync(host, { recursive: true });
writeFileSync(join(host, 'package.json'), JSON.stringify({ name: 'smoke-host', private: true, type: 'module' }));
run('npm', ['install', '--no-audit', '--no-fund', '--legacy-peer-deps', '--prefer-offline', '--loglevel=error', ...pkgs.map((x) => x.tgz)], host);

let failed = 0;
for (const { p } of pkgs) {
  const exp = p.publishConfig?.exports ?? p.exports;
  try {
    if (exp && (typeof exp === 'string' || exp['.'])) {
      execFileSync(process.execPath, ['--input-type=module', '-e', `const m = await import(${JSON.stringify(p.name)}); if (!Object.keys(m).length) throw new Error('no exports');`], { cwd: host, stdio: ['ignore', 'pipe', 'pipe'] });
      console.log(`✓ ${p.name}@${p.version} imports`);
      // a DOM-free `/check` entry (W-54): imports and checks a CSV in plain Node
      if (typeof exp === 'object' && exp['./check']) {
        const spec = `${p.name}/check`;
        execFileSync(process.execPath, ['--input-type=module', '-e', `const { check } = await import(${JSON.stringify(spec)}); const e = await check(new TextEncoder().encode('Units\\n-1\\n'), { name: 'u.csv', columns: { Units: { min: 0 } } }); if (e.length !== 1 || e[0].range !== 'A2') throw new Error(JSON.stringify(e));`], { cwd: host, stdio: ['ignore', 'pipe', 'pipe'] });
        console.log(`✓ ${spec}@${p.version} imports and checks`);
      }
    } else {
      for (const bin of Object.values(p.bin ?? {})) execFileSync(process.execPath, ['--check', join(host, 'node_modules', p.name, bin)]);
      console.log(`✓ ${p.name}@${p.version} bin parses`);
    }
  } catch (e) {
    failed++;
    console.error(`✗ ${p.name}@${p.version}: ${String(e.stderr || e.message).trim().split('\n').slice(0, 4).join(' | ')}`);
  }
}
process.exit(failed ? 1 : 0);
