// Writes llms.txt and llms-full.txt (W-38, llmstxt.org): an agent given the repository or
// node_modules/@sheetpane/grid reads sheetpane's public contract without crawling.
// llms.txt is an index of links; llms-full.txt inlines the package READMEs, the laws and the
// component records — never work/ or archive/ (SR-WORK-ARCHIVE). Deterministic, no dependencies.
// Links are absolute GitHub URLs pinned to the release tag (`main` before the first release),
// so they work from node_modules and the web; when a docs site exists, change BASE only.
// Usage: node scripts/build-llms.mjs [--check]   (just llms)
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const version = JSON.parse(readFileSync(join(root, 'packages/grid/package.json'), 'utf8')).version;
const ref = version === '0.0.0' ? 'main' : `v${version}`;
export const BASE = `https://github.com/arpitarya/sheetpane/blob/${ref}`;
const read = (p) => readFileSync(join(root, p), 'utf8');
const url = (p) => `${BASE}/${p}`;
const titleOf = (p) => (/^#\s+(.+)$/m.exec(read(p))?.[1] ?? p).replace(/[`*]/g, '');
const descOf = (p) => (/^description:\s*"?([^"\n]+)"?$/m.exec(read(p))?.[1] ?? '').trim();
const PKGS = ['grid', 'export', 'import', 'numfmt', 'formulas', 'styles', 'validation', 'condfmt', 'images', 'charts', 'comments', 'visibility', 'tables', 'fixtures', 'testing', 'skills', 'mcp']; // create-sheetpane is internal — not listed (the decider, 2026-10-19)
const PLUGINS = ['numfmt', 'formulas', 'styles', 'validation', 'condfmt', 'images', 'charts', 'comments', 'visibility', 'tables'];
const records = readdirSync(join(root, 'records')).filter((f) => /^\d{4}_.*\.md$/.test(f)).sort();
const LAWS = records.filter((f) => /^000\d_|^0010_|^0011_/.test(f));
const COMPONENTS = records.filter((f) => /^01\d\d_/.test(f) && !f.includes('CREATE')); // SR-CREATE: internal (the decider, 2026-10-19)
const skills = readdirSync(join(root, 'packages/skills/skills')).sort();
const pkgReadme = (p) => `packages/${p}/README.md`;
const line = (path, title, note) => `- [${title}](${url(path)})${note ? `: ${note}` : ''}`;
const recordNote = (f) => descOf(`records/${f}`);
const recName = (f) => /^name:\s*(\S+)/m.exec(read(`records/${f}`))?.[1] ?? f;

const index = [
  '# sheetpane',
  '',
  `> View, edit and review .xlsx and .csv files inside any web page: two web components — <sheetpane-excel> (the sheet, View or Edit) and <sheetpane-errors> (the review list) — kept in sync through one in-memory workbook per \`pane\`, an export that writes every change into a copy of the upload, eight optional plugins, column rules and a JSON rules file. Nothing is uploaded. Version ${version}.`,
  '',
  'Every rule lives in one standing record; READMEs and skills point to them. The full text of everything below is in llms-full.txt.',
  '',
  '## Start',
  line('README.md', 'sheetpane', 'what it is, the packages, try it'),
  line(pkgReadme('grid'), '@sheetpane/grid', 'the elements: attributes, properties, events, column rules, rules file, React hooks, styling'),
  line('docs/ARCHITECTURE.md', 'Architecture', 'packages, elements, the one workbook, the flows'),
  line('CHANGELOG.md', 'Changelog', 'what changed, breaking changes first'),
  '',
  '## Try it',
  `- [Live playground](https://arpitarya.github.io/sheetpane/): the plugin gallery in plain HTML; \`/react/\` in React (deployed from each release)`,
  line('examples/starters/README.md', 'Starters', 'one starter app per framework, with an Open in StackBlitz link'),
  '',
  '## Elements',
  line(`records/${COMPONENTS.find((f) => f.includes('GRID'))}`, 'SR-GRID', 'the sheet, the store, the plugin host, events, rules, test hooks'),
  line(`records/${COMPONENTS.find((f) => f.includes('ERRORS'))}`, 'SR-ERRORS', 'the error list and the New error form'),
  line('packages/grid/custom-elements.json', 'custom-elements.json', 'both elements as a Custom Elements Manifest: attributes, properties, methods, events with payload types, slots, parts, --sp-* properties'),
  line(`${pkgReadme('grid')}#vue-svelte-solid-angular`, 'Vue, Svelte, Solid, Angular', 'the elements in each framework; typings @sheetpane/grid/jsx, /vue, /svelte, /solid'),
  line(pkgReadme('import'), '@sheetpane/import', 'read .xlsx / .csv into a JavaScript workbook'),
  line(pkgReadme('export'), '@sheetpane/export', 'write .xlsx / .csv, patch the original, download()'),
  '',
  '## Plugins',
  ...PLUGINS.map((p) => line(pkgReadme(p), `@sheetpane/${p}`, titleOf(pkgReadme(p)) === `@sheetpane/${p}` ? (/^\*\*(.+?)\*\*/m.exec(read(pkgReadme(p)))?.[1] ?? '') : titleOf(pkgReadme(p)))),
  '',
  '## Rules and errors',
  line(`${pkgReadme('grid')}#column-rules`.replace('#', '#'), 'Column rules', 'checks by column title in code'),
  line(`${pkgReadme('grid')}#rules-file`.replace('#', '#'), 'Rules file', 'valid and invalid values as JSON, rules-src, flagging="off"'),
  line('packages/grid/rules.schema.json', 'rules.schema.json', 'the rules file\'s JSON Schema'),
  line('docs/ERRORS.md', 'Error codes', 'every SP-xxxx code: meaning, cause, fix'),
  '',
  '## Testing and tooling',
  line(pkgReadme('testing'), '@sheetpane/testing', 'Playwright and Vitest helpers for host apps'),
  line(pkgReadme('fixtures'), '@sheetpane/fixtures', 'known workbooks with a manifest'),
  '',
  '## Skills',
  line(pkgReadme('skills'), '@sheetpane/skills', 'npx sheetpane-skills install — skills for Claude Code, Kiro and Codex'),
  line(pkgReadme('mcp'), '@sheetpane/mcp', 'npx -y @sheetpane/mcp — an MCP server: describe the API, inspect a workbook, draft and check a rules file, explain an SP code, find a skill'),
  ...skills.map((s) => line(`packages/skills/skills/${s}/SKILL.md`, s, (/^description:\s*(.+)$/m.exec(read(`packages/skills/skills/${s}/SKILL.md`))?.[1] ?? '').trim())),
  '',
  '## Records',
  line('records/README.md', 'The register', 'every record, its state and what it owns'),
  ...[...LAWS, ...COMPONENTS].map((f) => line(`records/${f}`, recName(f), recordNote(f))),
  '',
].join('\n');

const section = (path) => `\n\n---\n\n<!-- source: ${path} (${url(path)}) -->\n\n${read(path).replace(/^---\n[\s\S]*?\n---\n/, '').trim()}\n`;
const fullParts = ['README.md', ...PKGS.map(pkgReadme).filter((p) => existsSync(join(root, p))), 'docs/ARCHITECTURE.md', 'docs/GLOSSARY.md', 'docs/ERRORS.md', ...LAWS.map((f) => `records/${f}`), ...COMPONENTS.map((f) => `records/${f}`)];
const full = `# sheetpane — the full public contract\n\n> Everything llms.txt links to, inlined: the package READMEs, the docs, the laws and the component records. Version ${version}; links pinned to ${ref}.\n${fullParts.map(section).join('')}`;

export const outputs = { 'llms.txt': `${index}\n`, 'llms-full.txt': full };
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const [name, text] of Object.entries(outputs)) {
    const p = join(root, name);
    if (check) { if (!existsSync(p) || readFileSync(p, 'utf8') !== text) { console.error(`${name} is stale — run \`just llms\``); stale++; } }
    else writeFileSync(p, text);
  }
  const kb = Math.round(Buffer.byteLength(outputs['llms-full.txt']) / 1024);
  console.log(`llms.txt ${Math.round(Buffer.byteLength(outputs['llms.txt']) / 1024)} KB · llms-full.txt ${kb} KB${kb > 200 ? ' — over 200 KB: consider one file per package' : ''}`);
  process.exitCode = stale ? 1 : 0;
}
