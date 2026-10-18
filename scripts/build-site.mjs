// Builds the live playground (W-44): both demos as a static site in site/ —
// `/` the plain-HTML gallery, `/react/` the React one — with every file the
// HTML import map names copied in (Pages serves the built output, never the
// workspace), the version in both headers, no analytics, no third-party script.
// Run after `just build`:  node scripts/build-site.mjs [outDir]
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = process.argv[2] ?? join(root, 'site');
const version = JSON.parse(readFileSync(join(root, 'packages/grid/package.json'), 'utf8')).version;
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// the HTML gallery: index.html with its version, and each file its import map and attributes point at
const html = join(root, 'examples/html');
let page = readFileSync(join(html, 'index.html'), 'utf8');
page = page.replace('<span class="logo">Your app</span>', `<span class="logo">Your app</span><span class="ver" title="sheetpane version">sheetpane ${version}</span>`);
writeFileSync(join(out, 'index.html'), page);
for (const f of ['sample.xlsx', 'sample.csv']) cpSync(join(html, f), join(out, f));
const refs = new Set([...page.matchAll(/"(\.\/node_modules\/[^"]+)"/g), ...page.matchAll(/'(\.\/node_modules\/[^']+)'/g)].map((m) => m[1]));
const copied = new Set();
for (const ref of refs) {
  // copy the folder a mapped file lives in: a package's dist/ (its chunks and assets) or a fixture
  const rel = ref.slice(2), parts = rel.split('/');
  const pkgDepth = parts[1]?.startsWith('@') ? 3 : 2; // node_modules/@scope/name or node_modules/name
  const pkgRoot = parts.slice(0, pkgDepth).join('/');
  const sub = parts.slice(pkgDepth, -1).join('/'); // dist, files, …
  const from = join(html, pkgRoot, sub), to = join(out, pkgRoot, sub);
  if (copied.has(to) || !existsSync(from)) continue;
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, dereference: true, filter: (p) => !p.endsWith('.map') && !p.endsWith('.d.ts') });
  copied.add(to);
}
writeFileSync(join(out, '.nojekyll'), '');

// the React gallery under /react/, with a relative base so it works at any path
execFileSync('pnpm', ['exec', 'vite', 'build', '--base', './', '--outDir', join(out, 'react'), '--emptyOutDir'], { cwd: join(root, 'examples/react'), stdio: 'inherit', env: { ...process.env, VITE_SHEETPANE_VERSION: version } });
console.log(`site: ${out} — sheetpane ${version}; ${copied.size} folders from node_modules`);
