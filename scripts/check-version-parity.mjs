// Every file that holds the release version agrees with every other (SR-BUILD decision 9a).
// Node standard library only; run in CI on every push and in publish.yml before the build.
// The sites: every packages/*/package.json (lockstep), the Claude Code plugin's plugin.json, each
// starter's pinned @sheetpane/* dependencies and its README's `tree/v<version>` links, and the
// `blob/v<version>` links in llms.txt and llms-full.txt. Usage: node scripts/check-version-parity.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const sites = []; // [file, what, version found]

for (const dir of readdirSync(join(root, 'packages'))) {
  const f = `packages/${dir}/package.json`;
  if (existsSync(join(root, f))) sites.push([f, 'version', json(f).version]);
}
sites.push(['plugins/sheetpane/.claude-plugin/plugin.json', 'version', json('plugins/sheetpane/.claude-plugin/plugin.json').version]);
for (const dir of readdirSync(join(root, 'examples/starters'))) {
  const f = `examples/starters/${dir}/package.json`;
  if (!existsSync(join(root, f))) continue;
  const p = json(f);
  for (const [name, v] of Object.entries({ ...p.dependencies, ...p.devDependencies })) {
    if (name.startsWith('@sheetpane/')) sites.push([f, name, v.replace(/^[\^~]/, '')]);
  }
}
const pinned = (f, re) => { for (const m of read(f).matchAll(re)) sites.push([f, m[0], m[1]]); };
pinned('examples/starters/README.md', /\/tree\/v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\//g);
pinned('llms.txt', /\/blob\/v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\//g);
pinned('llms-full.txt', /\/blob\/v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\//g);

const version = sites[0][2];
const off = sites.filter(([, , v]) => v !== version);
for (const [f, what, v] of off) console.error(`✗ ${f}: ${what} is ${v}, expected ${version}`);
if (off.length) {
  console.error(`\n${off.length} of ${sites.length} version sites disagree — run \`node scripts/release.mjs ${version}\` to set them all.`);
  process.exit(1);
}
console.log(`✔ ${sites.length} version sites agree on ${version}`);
