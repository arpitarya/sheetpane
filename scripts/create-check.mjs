// W-43 DoD 5: every `create-sheetpane` template, scaffolded as a user would get it and installed
// from `pnpm pack` tarballs (as demo-packed does, SR-LAW-8), then built and its one test run.
// Usage: node scripts/create-check.mjs [template …]   (default: all six; needs `just build` first)
// SP_KEEP_TMP=1 keeps the temp folder.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const ALL = ['vanilla', 'react', 'next', 'vue', 'angular', 'svelte'];
const want = process.argv.slice(2);
for (const t of want) if (!ALL.includes(t)) { console.error(`create-check: unknown template ${t} (one of ${ALL.join(', ')})`); process.exit(2); }
const templates = want.length ? want : ALL;
const tmp = mkdtempSync(join(tmpdir(), 'sheetpane-create-'));

// 1. every package as npm would publish it
const tarballs = {};
let cli;
for (const dir of readdirSync(join(root, 'packages'))) {
  const pkg = join(root, 'packages', dir);
  if (!existsSync(join(pkg, 'package.json'))) continue;
  const name = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')).name;
  const tgz = execFileSync('pnpm', ['pack', '--pack-destination', tmp], { cwd: pkg, encoding: 'utf8' }).trim().split('\n').pop();
  if (name === 'create-sheetpane') {
    // the scaffolder runs from its own tarball, so a file missing from `files` fails here
    const x = join(tmp, 'create-sheetpane'); mkdirSync(x);
    execFileSync('tar', ['-xzf', tgz, '-C', x]);
    cli = join(x, 'package', 'bin', 'create-sheetpane.mjs');
  } else tarballs[name] = `file:${tgz}`;
}

// 2. each template: scaffold, point @sheetpane/* at the tarballs, install, add the skills, build, test
const env = { ...process.env, CI: '1', NEXT_TELEMETRY_DISABLED: '1', NG_CLI_ANALYTICS: 'false' };
const step = (label, cmd, args, cwd) => {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd, env, stdio: 'inherit' });
  const s = ((Date.now() - t0) / 1000).toFixed(1);
  if (r.status !== 0) throw new Error(`${label} failed (${cmd} ${args.join(' ')}, exit ${r.status}) after ${s}s`);
  return `${label} ${s}s`;
};
const results = [];
for (const t of templates) {
  const dir = join(tmp, `app-${t}`);
  const times = [];
  try {
    console.log(`\n── ${t} ──`);
    times.push(step('scaffold', 'node', [cli, `app-${t}`, '--template', t, '--yes', '--no-install', '--skills', 'none', '--pm', 'pnpm'], tmp));
    const pj = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    for (const k of ['dependencies', 'devDependencies']) for (const n of Object.keys(pj[k] ?? {})) if (n.startsWith('@sheetpane/')) {
      if (!tarballs[n]) throw new Error(`${n} is not a package of this repo`);
      pj[k][n] = tarballs[n];
    }
    pj.pnpm = { ...(pj.pnpm ?? {}), overrides: tarballs };
    writeFileSync(join(dir, 'package.json'), JSON.stringify(pj, null, 2));
    times.push(step('install', 'pnpm', ['install', '--ignore-workspace', '--prefer-offline'], dir));
    // DoD 4: what the CLI runs after installing, here from the tarballs — the skills and the MCP entry
    times.push(step('skills', 'pnpm', ['exec', 'sheetpane-skills', 'install', '--all', '--skip', 'contributor'], dir));
    for (const f of ['.claude/skills/sheetpane/SKILL.md', '.mcp.json', 'AGENTS.md']) if (!existsSync(join(dir, f))) throw new Error(`skills: ${f} was not written`);
    times.push(step('browsers', 'pnpm', ['exec', 'playwright', 'install', 'chromium'], dir));
    times.push(step('build', 'pnpm', ['run', 'build'], dir));
    times.push(step('test', 'pnpm', ['exec', 'playwright', 'test'], dir));
    results.push({ t, ok: true, times });
  } catch (e) {
    results.push({ t, ok: false, times, why: e.message });
  }
}

console.log('\ncreate-check:');
for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.t.padEnd(8)} ${r.times.join(' · ')}${r.ok ? '' : ` — ${r.why}`}`);
if (process.env.SP_KEEP_TMP) console.log(`kept ${tmp}`); else rmSync(tmp, { recursive: true, force: true });
process.exit(results.every((r) => r.ok) ? 0 : 1);
