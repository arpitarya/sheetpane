// Packs every package the way `pnpm publish` would and checks the tarball's
// manifest: no `workspace:` specifier left, every exported file present (SR-LAW-8, B-023).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'sheetpane-pack-'));
let failed = 0;
for (const dir of readdirSync(join(root, 'packages'))) {
  const pkg = join(root, 'packages', dir);
  if (!existsSync(join(pkg, 'package.json'))) continue;
  const tgz = execFileSync('pnpm', ['pack', '--pack-destination', out], { cwd: pkg, encoding: 'utf8' }).trim().split('\n').pop();
  const x = join(out, dir); execFileSync('mkdir', ['-p', x]); execFileSync('tar', ['-xzf', tgz, '-C', x]);
  const manifest = readFileSync(join(x, 'package', 'package.json'), 'utf8');
  const problems = [];
  if (manifest.includes('workspace:')) problems.push('a workspace: specifier survived packing');
  const p = JSON.parse(manifest);
  if (manifest.includes('"source"')) problems.push('the source condition (points into src/) survived packing');
  for (const target of Object.values(p.exports)) {
    for (const f of typeof target === 'string' ? [target] : Object.values(target).filter((v) => typeof v === 'string')) {
      // a subpath pattern (`./files/*`) needs its folder; anything else, the file itself
      const want = f.includes('*') ? f.slice(0, f.indexOf('*')) : f;
      if (!existsSync(join(x, 'package', want))) problems.push(`missing ${f}`);
    }
  }
  console.log(`${problems.length ? '✗' : '✓'} ${p.name}@${p.version}${problems.length ? ' — ' + problems.join('; ') : ''}`);
  failed += problems.length;
}
process.exit(failed ? 1 : 0);
