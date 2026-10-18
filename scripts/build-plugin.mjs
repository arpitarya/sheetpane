// Writes the Claude Code plugin plugins/sheetpane/ and the repository's marketplace file
// .claude-plugin/marketplace.json (W-45), from @sheetpane/skills — so the plugin cannot drift
// from the skills the installer copies. A plugin cannot point at files outside its own folder
// (Claude Code refuses a component path that leaves the plugin root, and an installed plugin is a
// copy), so the files are generated here and test/skills.test.ts fails when one is stale.
//
// What goes in: the host skills (not the two contributor skills), the sheetpane-integrator
// agent, the rules-check hook (running a bundled copy of the sheetpane-skills bin, so the plugin
// works before the project installs sheetpane), and the @sheetpane/mcp server.
// Usage: node scripts/build-plugin.mjs   (just plugin)
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { frontmatter, SERVER } from '../packages/skills/bin/sheetpane-skills.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SK = join(root, 'packages/skills');
export const PLUGIN_DIR = 'plugins/sheetpane';
const pkg = JSON.parse(readFileSync(join(SK, 'package.json'), 'utf8'));
const read = (p) => readFileSync(join(SK, p), 'utf8');
const json = (x) => JSON.stringify(x, null, 2) + '\n';
const AUTHOR = { name: 'Arpit Arya', url: 'https://github.com/arpitarya' };
const DESCRIPTION = 'sheetpane in Claude Code: skills to embed, load, export, rule, theme and test the sheet; the sheetpane-integrator agent; a hook that checks each *.rules.json; the @sheetpane/mcp server.';

/** The host skills: every skill whose metadata.audience is not `contributor`. */
const skills = readdirSync(join(SK, 'skills')).sort().filter((name) => frontmatter(read(`skills/${name}/SKILL.md`))?.metadata.audience !== 'contributor');

/** Every file this script writes, by path from the repository root, with its text. */
export const outputs = {
  '.claude-plugin/marketplace.json': json({
    name: 'sheetpane',
    description: 'sheetpane — .xlsx and .csv files as two in-sync web components — for coding agents.',
    owner: AUTHOR,
    plugins: [{ name: 'sheetpane', source: `./${PLUGIN_DIR}`, description: DESCRIPTION }],
  }),
  [`${PLUGIN_DIR}/.claude-plugin/plugin.json`]: json({
    name: 'sheetpane',
    version: pkg.version,
    description: DESCRIPTION,
    author: AUTHOR,
    homepage: 'https://github.com/arpitarya/sheetpane',
    repository: 'https://github.com/arpitarya/sheetpane',
    license: pkg.license,
    keywords: ['sheetpane', 'xlsx', 'csv', 'web-components', 'spreadsheet'],
  }),
  [`${PLUGIN_DIR}/.mcp.json`]: json({ mcpServers: { sheetpane: SERVER } }),
  [`${PLUGIN_DIR}/agents/sheetpane-integrator.md`]: read('entry/claude-agent.md'),
  [`${PLUGIN_DIR}/hooks/hooks.json`]: json({
    description: 'After Claude edits a *.rules.json, checks it as <sheetpane-excel> will and feeds the SP-60xx problems back.',
    hooks: {
      PostToolUse: [{
        matcher: 'Edit|Write|MultiEdit',
        hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/scripts/sheetpane-skills.mjs" check-rules --hook claude', timeout: 60 }],
      }],
    },
  }),
  [`${PLUGIN_DIR}/scripts/sheetpane-skills.mjs`]: read('bin/sheetpane-skills.mjs'),
  ...Object.fromEntries(skills.map((s) => [`${PLUGIN_DIR}/skills/${s}/SKILL.md`, read(`skills/${s}/SKILL.md`)])),
};

/** Every file under `dir`, as POSIX paths from the repository root. */
export function filesUnder(dir) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  return walk(abs).map((f) => relative(root, f).split(sep).join('/')).sort();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  // a skill removed from the package leaves the plugin too
  for (const f of filesUnder(PLUGIN_DIR)) if (!(f in outputs)) rmSync(join(root, f));
  for (const [f, text] of Object.entries(outputs)) {
    const abs = join(root, f);
    mkdirSync(dirname(abs), { recursive: true });
    if (!existsSync(abs) || readFileSync(abs, 'utf8') !== text) writeFileSync(abs, text);
  }
  // empty skill folders left by a removed skill
  const sk = join(root, PLUGIN_DIR, 'skills');
  for (const d of readdirSync(sk)) if (readdirSync(join(sk, d)).length === 0) rmSync(join(sk, d), { recursive: true });
  console.log(`${PLUGIN_DIR}: ${skills.length} skills, the agent, the hook, the MCP server; .claude-plugin/marketplace.json`);
}
