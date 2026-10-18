// The StackBlitz starters (W-44): each create-sheetpane template scaffolded by the CLI itself into
// examples/starters/<template>, so an "Open in StackBlitz" link has a runnable folder at the release
// tag. `just starters` writes them; release.mjs reruns it so the tag's starters name that version;
// test/starters.test.ts fails when they are stale. They install from npm, so they run once the
// version is published. Not workspace members: pnpm's `examples/*` is one level deep.
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEMPLATES, main } from '../packages/create-sheetpane/bin/create-sheetpane.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const version = JSON.parse(readFileSync(join(root, 'packages/grid/package.json'), 'utf8')).version;
/** The git ref links pin to: the release tag, or `main` before the first release (as llms.txt). */
export const ref = version === '0.0.0' ? 'main' : `v${version}`;
export const OUT = join(root, 'examples/starters');
/** The StackBlitz URL of one starter. */
export const stackblitz = (t) => `https://stackblitz.com/github/arpitarya/sheetpane/tree/${ref}/examples/starters/${t}`;

/** Every starter, scaffolded into `dir`, plus the index README. */
export async function buildStarters(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const tmp = mkdtempSync(join(tmpdir(), 'sp-starters-'));
  try {
    for (const t of Object.keys(TEMPLATES)) {
      const quiet = { out: () => {}, err: (s) => process.stderr.write(s + '\n') };
      const code = await main([join(tmp, t), '--template', t, '--yes', '--no-install', '--skills', 'none', '--pm', 'npm'], quiet);
      if (code !== 0) throw new Error(`create-sheetpane --template ${t} exited ${code}`);
      cpSync(join(tmp, t), join(dir, t), { recursive: true });
    }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
  const rows = Object.entries(TEMPLATES).map(([t, x]) => `| ${x.label ?? t} | [\`${t}/\`](${t}/) | [Open in StackBlitz](${stackblitz(t)}) |`);
  writeFileSync(join(dir, 'README.md'), `# Starters

Each \`create-sheetpane\` template, scaffolded by the CLI (\`scripts/build-starters.mjs\`, \`just starters\`) —
the same files \`npm create sheetpane@latest -- --template <name>\` writes. Generated: do not edit by hand.

| template | folder | try it |
|---|---|---|
${rows.join('\n')}

The links open this folder at \`${ref}\`; StackBlitz installs \`@sheetpane/*\` ${version} from npm, so a starter runs
once that version is published. Locally: \`npm create sheetpane@latest\` (SR-CREATE).
`);
}

/** Every file under `dir`, relative, with its text. */
export function tree(dir) {
  const out = {};
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else out[relative(dir, p).split('\\').join('/')] = readFileSync(p, 'utf8'); } };
  if (existsSync(dir)) walk(dir);
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await buildStarters(OUT);
  console.log(`starters → ${relative(root, OUT)} (${Object.keys(TEMPLATES).length}, links at ${ref})`);
}
