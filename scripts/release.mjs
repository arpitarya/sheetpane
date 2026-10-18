// Sets one version on every package under packages/ (lockstep, SR-LAW-8). Usage: node scripts/release.mjs 1.2.3
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const v = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(v ?? '')) { console.error('usage: release.mjs <semver>'); process.exit(1); }
const root = new URL('..', import.meta.url).pathname;
for (const dir of readdirSync(join(root, 'packages'))) {
  const f = join(root, 'packages', dir, 'package.json');
  if (!existsSync(f)) continue;
  const p = JSON.parse(readFileSync(f, 'utf8')); p.version = v;
  writeFileSync(f, JSON.stringify(p, null, 2) + '\n');
  console.log(`${p.name} → ${v}`);
}
