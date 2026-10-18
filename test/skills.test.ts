// W-35: the agent skills stay true to the code (the drift check), and the installer writes only
// what it says and takes back exactly that.
import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';
import { frontmatter, fromKey, main, putBlock, dropBlock, toKey, START, END, SERVER, TOML_START } from '../packages/skills/bin/sheetpane-skills.mjs';

const root = join(import.meta.dirname, '..');
const SK = join(root, 'packages/skills/skills');
const skills = readdirSync(SK).sort().map((name) => ({ name, text: readFileSync(join(SK, name, 'SKILL.md'), 'utf8') }));

// ── the public API, read from the source ───────────────────────────────────
const src = (f: string) => readFileSync(join(root, 'packages/grid/src', f), 'utf8');
const excelSrc = src('excel/element.ts'), errorsSrc = src('errors/element.ts');
const observed = (s: string) => JSON.parse(/observedAttributes = (\[[^\]]*\])/.exec(s)![1]!.replace(/'/g, '"')) as string[];
const ATTRS = new Set([...observed(excelSrc), ...observed(errorsSrc), 'theme', 'flagging', 'rules-src', 'readonly',
  // HTML's own and the frameworks'
  'id', 'class', 'style', 'slot', 'hidden', 'ref', 'key', 'title', 'aria-label', 'file', 'rules', 'columns', 'validate']);
const members = (s: string) => [...s.matchAll(/^  (?:async |get |set |static )?([a-zA-Z]\w*)\s*\(/gm)].map((m) => m[1]!).filter((n) => !['constructor', 'if', 'for', 'switch'].includes(n));
const MEMBERS = new Set([...members(excelSrc), ...members(errorsSrc),
  // HTMLElement's own, which hosts use on the elements
  'addEventListener', 'removeEventListener', 'setAttribute', 'getAttribute', 'removeAttribute', 'toggleAttribute', 'shadowRoot', 'focus', 'style', 'remove', 'append', 'dispatchEvent', 'click', 'hidden', 'id', 'onclick',
  // properties the elements define with get/set
  'workbook', 'file', 'mode', 'open', 'src', 'theme', 'columns', 'validate', 'onInvalid', 'rules', 'flagging', 'errors', 'errorTypes', 'readOnly']);
const allSrc = readdirSync(join(root, 'packages')).flatMap((p) => { const d = join(root, 'packages', p, 'src'); return existsSync(d) ? walk(d) : []; }).map((f) => readFileSync(f, 'utf8')).join('\n');
const EVENTS = new Set([...allSrc.matchAll(/'(sheetpane-[a-z-]+)'/g)].map((m) => m[1]!));
function walk(d: string): string[] { return readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.ts') ? [join(d, e.name)] : [])); }

describe('the skills (W-35 DoD 2, 6)', () => {
  it('there are 23, each in its own folder', () => {
    expect(skills).toHaveLength(23);
  });
  for (const s of skills) {
    describe(s.name, () => {
      const fm = frontmatter(s.text)!;
      it('frontmatter: the common subset, name = folder, a description of 250 characters or fewer', () => {
        expect(fm).toBeDefined();
        expect(fm.keys.filter((k: string) => !['name', 'description', 'license', 'metadata'].includes(k))).toEqual([]);
        expect(fm.name).toBe(s.name);
        expect(fm.description.length).toBeLessThanOrEqual(250);
        expect(fm.description).toMatch(/\bNot\b|\bnot\b/); // says when not to use it too
      });
      it('200 lines at most', () => expect(s.text.split('\n').length).toBeLessThanOrEqual(200));
      it('every link resolves: repo files on main, sibling skills', () => {
        const bad: string[] = [];
        for (const m of s.text.matchAll(/github\.com\/arpitarya\/sheetpane\/blob\/main\/([^)#\s]+)/g)) if (!existsSync(join(root, m[1]!))) bad.push(m[1]!);
        for (const m of s.text.matchAll(/\]\((\.\.\/[^)#\s]+)\)/g)) if (!existsSync(join(SK, s.name, m[1]!))) bad.push(m[1]!);
        expect(bad).toEqual([]);
      });
      it('names only events, attributes and members the elements have', () => {
        const skillNames = new Set(skills.map((x) => x.name));
        const events = [...s.text.matchAll(/`(sheetpane-[a-z-]+)/g)].map((m) => m[1]!).filter((e) => !skillNames.has(e) && !['sheetpane-excel', 'sheetpane-errors', 'sheetpane-skills', 'sheetpane-integrator'].includes(e));
        expect(events.filter((e) => !EVENTS.has(e)), 'events').toEqual([]);
        const attrs = [...s.text.matchAll(/<sheetpane-(?:excel|errors)\b([^>]*)>/g)].flatMap((m) => [...m[1]!.matchAll(/(?:^|\s)([a-z][\w-]*)(?==|\s|$)/g)].map((a) => a[1]!)).filter((a) => !a.startsWith('onsheetpane-') && !a.startsWith('data-'));
        expect([...new Set(attrs)].filter((a) => !ATTRS.has(a)), 'attributes').toEqual([]);
        const used = [...s.text.matchAll(/\b(?:excel|errors|el|sheet)\.([a-zA-Z]\w*)\b/g)].map((m) => m[1]!);
        // `locator` / `evaluate` are Playwright's, in the testing examples
        expect([...new Set(used)].filter((u) => !MEMBERS.has(u) && !/^(current|value|detail|target|locator|evaluate)$/.test(u)), 'members').toEqual([]);
      });
    });
  }
});

describe('the installer (W-35 DoD 5, 7)', () => {
  const tmp = () => mkdtempSync(join(tmpdir(), 'sp-skills-'));
  const run = async (argv: string[]) => { const out: string[] = [], err: string[] = []; const code = await main(argv, { out: (x: string) => out.push(x), err: (x: string) => err.push(x) }); return { code, out: out.join('\n'), err: err.join('\n') }; };
  const tree = (d: string): string[] => (existsSync(d) ? readdirSync(d, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => toKey(path.relative(d, join(e.parentPath, e.name)))).sort() : []);

  for (const tool of ['claude', 'kiro', 'codex']) {
    it(`--${tool}: installs, a re-run is a no-op, uninstall leaves the repo as it was`, async () => {
      const d = tmp();
      try {
        writeFileSync(join(d, 'README.md'), '# host\n');
        const before = tree(d);
        expect((await run(['install', `--${tool}`, '--cwd', d])).code).toBe(0);
        const dir = { claude: '.claude/skills', kiro: '.kiro/skills', codex: '.agents/skills' }[tool]!;
        expect(existsSync(join(d, dir, 'sheetpane/SKILL.md'))).toBe(true);
        const mcp = { claude: '.mcp.json', kiro: '.kiro/settings/mcp.json', codex: '.codex/config.toml' }[tool]!;
        expect(readFileSync(join(d, mcp), 'utf8')).toContain('@sheetpane/mcp');
        const again = await run(['install', `--${tool}`, '--cwd', d]);
        expect(again.out).toContain('Nothing to do');
        expect((await run(['uninstall', '--cwd', d])).code).toBe(0);
        expect(tree(d)).toEqual(before);
      } finally { rmSync(d, { recursive: true, force: true }); }
    });
  }

  it('--all with no tool folders; a hand-edited file is refused without --force; the marked block keeps the text around it', async () => {
    const d = tmp();
    try {
      writeFileSync(join(d, 'CLAUDE.md'), '# Mine\n\nKeep this.\n');
      expect((await run(['install', '--all', '--cwd', d])).code).toBe(0);
      const claude = readFileSync(join(d, 'CLAUDE.md'), 'utf8');
      expect(claude.startsWith('# Mine\n\nKeep this.\n')).toBe(true);
      expect(claude).toContain(START);
      expect(existsSync(join(d, 'AGENTS.md'))).toBe(true);
      writeFileSync(join(d, '.kiro/skills/sheetpane/SKILL.md'), 'edited by hand');
      const refused = await run(['install', '--all', '--cwd', d]);
      expect(refused.code).toBe(1);
      expect(readFileSync(join(d, '.kiro/skills/sheetpane/SKILL.md'), 'utf8')).toBe('edited by hand');
      expect((await run(['install', '--all', '--force', '--cwd', d])).code).toBe(0);
      expect(readFileSync(join(d, '.kiro/skills/sheetpane/SKILL.md'), 'utf8')).not.toBe('edited by hand');
      // a newer block replaces the old one, the text outside stays
      writeFileSync(join(d, 'CLAUDE.md'), readFileSync(join(d, 'CLAUDE.md'), 'utf8') + '\nAfter the block.\n');
      expect((await run(['uninstall', '--force', '--cwd', d])).code).toBe(0);
      expect(readFileSync(join(d, 'CLAUDE.md'), 'utf8')).toBe('# Mine\n\nKeep this.\n\nAfter the block.\n');
      expect(existsSync(join(d, 'AGENTS.md'))).toBe(false);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  it('--dry-run lists every path and writes nothing; --skip contributor leaves the contributor skills out; no tool → asks for one', async () => {
    const d = tmp();
    try {
      const dry = await run(['install', '--claude', '--dry-run', '--cwd', d]);
      expect(dry.out).toContain('.claude/skills/sheetpane/SKILL.md');
      expect(readdirSync(d)).toEqual([]);
      expect((await run(['install', '--cwd', d])).code).toBe(2);
      mkdirSync(join(d, '.claude'));
      expect((await run(['install', '--skip', 'contributor', '--cwd', d])).code).toBe(0); // detects .claude
      expect(existsSync(join(d, '.claude/skills/sheetpane-records'))).toBe(false);
      expect(existsSync(join(d, '.claude/skills/sheetpane-embed'))).toBe(true);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  it('the MCP server entry (W-39 DoD 9): merged into a config that exists, edits refused, --no-mcp', async () => {
    const d = tmp();
    try {
      const other = { mcpServers: { github: { command: 'gh-mcp' } }, keep: true };
      writeFileSync(join(d, '.mcp.json'), JSON.stringify(other, null, 2) + '\n');
      mkdirSync(join(d, '.codex'));
      writeFileSync(join(d, '.codex/config.toml'), 'model = "o3"\n');
      expect((await run(['install', '--claude', '--codex', '--cwd', d])).code).toBe(0);
      expect(JSON.parse(readFileSync(join(d, '.mcp.json'), 'utf8'))).toEqual({ ...other, mcpServers: { ...other.mcpServers, sheetpane: SERVER } });
      const toml = readFileSync(join(d, '.codex/config.toml'), 'utf8');
      expect(toml.startsWith('model = "o3"\n')).toBe(true);
      expect(toml).toContain(`${TOML_START}\n[mcp_servers.sheetpane]\ncommand = "npx"\nargs = ["-y", "@sheetpane/mcp"]`);
      // an entry edited by hand is refused, and kept
      const edited = JSON.parse(readFileSync(join(d, '.mcp.json'), 'utf8'));
      edited.mcpServers.sheetpane.args.push('--x');
      writeFileSync(join(d, '.mcp.json'), JSON.stringify(edited));
      expect((await run(['uninstall', '--cwd', d])).code).toBe(1);
      expect((await run(['uninstall', '--force', '--cwd', d])).code).toBe(0);
      expect(JSON.parse(readFileSync(join(d, '.mcp.json'), 'utf8'))).toEqual(other);
      expect(readFileSync(join(d, '.codex/config.toml'), 'utf8')).toBe('model = "o3"\n');
      // not a JSON object: refused, nothing written
      writeFileSync(join(d, '.mcp.json'), '{ broken');
      const r = await run(['install', '--claude', '--cwd', d]);
      expect(r.code).toBe(1);
      expect(r.out).toMatch(/\.mcp\.json \(sheetpane MCP server\) — is not a JSON object/);
      expect((await run(['install', '--claude', '--no-mcp', '--cwd', d])).code).toBe(0);
      expect(readFileSync(join(d, '.mcp.json'), 'utf8')).toBe('{ broken');
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  it('block helpers and Windows paths', () => {
    const block = `${START}\nx\n${END}`;
    const { text, prefix } = putBlock('# a\n', block);
    expect(text).toBe(`# a\n\n${block}\n`);
    expect(dropBlock(text, prefix)).toBe('# a\n');
    expect(putBlock(text, `${START}\ny\n${END}`).text).toBe(`# a\n\n${START}\ny\n${END}\n`);
    expect(toKey('.claude\\skills\\a\\SKILL.md', path.win32)).toBe('.claude/skills/a/SKILL.md');
    expect(fromKey('C:\\repo', '.claude/skills/a/SKILL.md', path.win32)).toBe('C:\\repo\\.claude\\skills\\a\\SKILL.md');
  });
});
