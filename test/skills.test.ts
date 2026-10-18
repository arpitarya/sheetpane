// W-35: the agent skills stay true to the code (the drift check), and the installer writes only
// what it says and takes back exactly that. W-45: check-rules gives checkDocument's verdicts, the
// hooks go in and come out like the MCP entry, and the Claude Code plugin is what the script writes.
import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';
import { checkRules, frontmatter, fromKey, hookGroup, hookPaths, main, putBlock, dropBlock, toKey, START, END, SERVER, TOML_START } from '../packages/skills/bin/sheetpane-skills.mjs';
import { checkDocument } from '../packages/grid/src/pane/rules.js';
import { filesUnder, outputs as pluginFiles, PLUGIN_DIR } from '../scripts/build-plugin.mjs';

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
  it('there are 25, each in its own folder', () => {
    // 23 from W-35, plus the W-45 commands sheetpane-rules and sheetpane-test
    expect(skills).toHaveLength(25);
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
        // an unquoted YAML scalar ends at ": " or " #" — Claude Code then drops every key (claude plugin validate)
        const raw = /^description:\s*(.*)$/m.exec(s.text)![1]!;
        if (!/^(['"]).*\1$/.test(raw)) expect(raw).not.toMatch(/: | #/);
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
        const hook = { claude: '.claude/settings.json', kiro: '.kiro/hooks/sheetpane-rules.json', codex: '.codex/hooks.json' }[tool]!;
        expect(readFileSync(join(d, hook), 'utf8')).toContain(`check-rules --hook ${tool}`);
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

describe('check-rules (W-45 DoD 2): the verdicts of @sheetpane/grid\'s checkDocument, without importing it', () => {
  const fixture = JSON.parse(readFileSync(join(root, 'packages/fixtures/files/showcase.rules.json'), 'utf8'));
  const sheet = (x: unknown) => ({ version: 1, sheets: { S: x } });
  const docs: unknown[] = [
    fixture, null, [], 'rules', 5, {}, { version: 2, sheets: {} }, { version: '1', sheets: {} },
    { version: 1 }, { version: 1, sheets: [] }, { $schema: 'x', version: 1, sheets: {}, extra: true },
    { version: 1, sheets: { S: 5, T: [] } }, sheet({ foo: 1, headerRow: 0 }), sheet({ headerRow: '2' }), sheet({ headerRow: 2.5 }),
    sheet({ columns: { A: 'x', B: { tpye: 'text', type: 'money', pattern: '(', oneOf: 'a', noneOf: {} } } }),
    sheet({ columns: { A: { pattern: '^ok$', oneOf: [1, 'b', true], required: true, message: 'm', note: 'n', severity: 'warning', onInvalid: 'block' } } }),
    sheet({ cells: { ZZZZ1: {}, A0: {}, 'A1:B': {}, XFE1: {}, A1048577: {}, B2: 'x', ' C3 ': {}, '$A$1:$B$2': { equals: 'Item' }, 'A1:B2:C3': {}, XFD1048576: {} } }),
    { version: 1, sheets: { '*': { columns: { Email: { pattern: '^[^@]+@[^@]+$', unique: true } } }, Accounts: { headerRow: 2, cells: { B1: { equals: 'Q3' } } } } },
  ];
  it('the same problems — code, sheet, found and message — for good and broken documents; the showcase file is clean', () => {
    for (const doc of docs) expect(checkRules(doc), JSON.stringify(doc)).toEqual(checkDocument(doc).problems);
    expect(checkRules(fixture)).toEqual([]);
    expect(new Set(docs.flatMap((d) => checkRules(d).map((p) => p.code)))).toEqual(new Set(['SP-6010', 'SP-6012', 'SP-6013', 'SP-6014', 'SP-6015', 'SP-6016', 'SP-6017', 'SP-6018', 'SP-6019', 'SP-6020', 'SP-6021']));
  });

  const run = async (argv: string[], stdin?: string) => { const out: string[] = [], err: string[] = []; const code = await main(argv, { out: (x: string) => out.push(x), err: (x: string) => err.push(x), stdin }); return { code, out: out.join('\n'), err: err.join('\n') }; };
  it('the command: one `SP-60xx: message (file)` line per problem; exit 0 clean, 1 a problem, 2 usage or a file it cannot read', async () => {
    const d = mkdtempSync(join(tmpdir(), 'sp-rules-'));
    try {
      writeFileSync(join(d, 'good.rules.json'), JSON.stringify(fixture));
      writeFileSync(join(d, 'bad.rules.json'), JSON.stringify(docs[15]));
      writeFileSync(join(d, 'broken.rules.json'), '{ "version": 1,');
      const good = await run(['check-rules', 'good.rules.json', '--cwd', d]);
      expect(good).toMatchObject({ code: 0, out: 'good.rules.json: no problems' });
      const bad = await run(['check-rules', 'bad.rules.json', '--cwd', d]);
      expect(bad.code).toBe(1);
      expect(bad.out.split('\n').map((l) => l.slice(0, 7))).toEqual(checkDocument(docs[15]).problems.map((p) => p.code));
      expect(bad.out).toContain('SP-6016: Unknown rule word “tpye” for column “B” (bad.rules.json, sheet “S”)');
      // not JSON: SP-6011, as the element reports a file it could not parse
      let why = ''; try { JSON.parse('{ "version": 1,'); } catch (e) { why = (e as Error).message; }
      const broken = await run(['check-rules', 'broken.rules.json', '--cwd', d]);
      expect(broken.code).toBe(1);
      expect(broken.out).toBe(`SP-6011: ${checkDocument({ __error: `broken.rules.json: ${why}` }).problems[0]!.message} (broken.rules.json)`);
      expect((await run(['check-rules', 'missing.rules.json', '--cwd', d])).code).toBe(2);
      expect((await run(['check-rules', '--cwd', d])).code).toBe(2);
      expect((await run(['check-rules', '--hook', 'cursor'])).code).toBe(2);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  it('as a hook: the path from Claude Code\'s input, a Codex patch or the Kiro argument; other files ignored; problems on stderr with exit 2', async () => {
    const d = mkdtempSync(join(tmpdir(), 'sp-hook-'));
    try {
      writeFileSync(join(d, 'q3.rules.json'), JSON.stringify(docs[15]));
      writeFileSync(join(d, 'ok.rules.json'), JSON.stringify(fixture));
      const claude = (f: string) => JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: f, content: '' }, cwd: d });
      const hit = await run(['check-rules', '--hook', 'claude'], claude(join(d, 'q3.rules.json')));
      expect(hit.code).toBe(2);
      expect(hit.out).toBe('');
      expect(hit.err).toContain('SP-6016: Unknown rule word “tpye” for column “B” (q3.rules.json, sheet “S”)');
      expect(await run(['check-rules', '--hook', 'claude'], claude(join(d, 'ok.rules.json')))).toEqual({ code: 0, out: '', err: '' });
      expect((await run(['check-rules', '--hook', 'claude'], claude(join(d, 'app.ts')))).code).toBe(0);
      expect((await run(['check-rules', '--hook', 'claude'], claude(join(d, 'gone.rules.json')))).code).toBe(0); // deleted since
      expect((await run(['check-rules', '--hook', 'claude'], 'not json')).code).toBe(1); // a notice, never a block
      const patch = '*** Begin Patch\n*** Update File: src/app.ts\n@@\n*** Add File: q3.rules.json\n+{}\n*** End Patch\n';
      expect(hookPaths({ tool_name: 'apply_patch', tool_input: { command: patch }, cwd: d })).toEqual({ files: ['src/app.ts', 'q3.rules.json'], cwd: d });
      expect((await run(['check-rules', '--hook', 'codex'], JSON.stringify({ tool_name: 'apply_patch', tool_input: { command: patch }, cwd: d }))).code).toBe(2);
      expect((await run(['check-rules', '--hook', 'kiro', join(d, 'q3.rules.json')], '')).code).toBe(2);
      expect((await run(['check-rules', '--hook', 'kiro', join(d, 'notes.md')], '')).code).toBe(0);
      // the real process: stdin read to the end, stderr and the exit code are what the agent sees
      const bin = join(root, 'packages/skills/bin/sheetpane-skills.mjs');
      const p = spawnSync(process.execPath, [bin, 'check-rules', '--hook', 'claude'], { input: claude(join(d, 'q3.rules.json')), encoding: 'utf8' });
      expect(p.status).toBe(2);
      expect(p.stderr).toContain('SP-6016');
      expect(p.stdout).toBe('');
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});

describe('the hooks (W-45 DoD 3–5, 7)', () => {
  const tmp = () => mkdtempSync(join(tmpdir(), 'sp-skills-'));
  const run = async (argv: string[]) => { const out: string[] = [], err: string[] = []; const code = await main(argv, { out: (x: string) => out.push(x), err: (x: string) => err.push(x) }); return { code, out: out.join('\n'), err: err.join('\n') }; };
  const read = (d: string, f: string) => readFileSync(join(d, f), 'utf8');

  it('merged into .claude/settings.json and .codex/hooks.json keeping every other key, a Kiro hook file; edits refused; uninstall restores the bytes', async () => {
    const d = tmp();
    try {
      const settings = { permissions: { allow: ['Bash(ls)'] }, hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] }], Stop: [] }, model: 'opus' };
      const text = JSON.stringify(settings, null, 2) + '\n';
      mkdirSync(join(d, '.claude'));
      writeFileSync(join(d, '.claude/settings.json'), text);
      expect((await run(['install', '--all', '--cwd', d])).code).toBe(0);
      const s = JSON.parse(read(d, '.claude/settings.json'));
      expect({ ...s, hooks: { ...s.hooks, PostToolUse: s.hooks.PostToolUse.slice(0, 1) } }).toEqual(settings);
      expect(s.hooks.PostToolUse[1]).toEqual(hookGroup('entry/claude-hooks.json').group);
      expect(s.hooks.PostToolUse[1]).toEqual({ matcher: 'Edit|Write|MultiEdit', hooks: [{ type: 'command', command: 'npx --no sheetpane-skills check-rules --hook claude', timeout: 60 }] });
      expect(JSON.parse(read(d, '.codex/hooks.json')).hooks.PostToolUse[0].matcher).toBe('apply_patch');
      const kiro = JSON.parse(read(d, '.kiro/hooks/sheetpane-rules.json'));
      expect(kiro).toMatchObject({ version: 'v1', hooks: [{ trigger: 'PostFileSave', matcher: '\\.rules\\.json$', action: { type: 'command' } }] });
      expect(kiro.hooks[0].action.command).toContain('{{filePath}}');
      expect(Object.keys(JSON.parse(read(d, '.sheetpane-skills.json')).hooks).sort()).toEqual(['.claude/settings.json', '.codex/hooks.json']);
      expect((await run(['install', '--all', '--cwd', d])).out).toContain('Nothing to do');
      // our group edited by hand: refused, kept
      const edited = JSON.parse(read(d, '.claude/settings.json'));
      edited.hooks.PostToolUse[1].matcher = 'Write';
      writeFileSync(join(d, '.claude/settings.json'), JSON.stringify(edited, null, 2) + '\n');
      expect((await run(['install', '--all', '--cwd', d])).code).toBe(1);
      expect((await run(['uninstall', '--cwd', d])).code).toBe(1);
      expect((await run(['uninstall', '--force', '--cwd', d])).code).toBe(0);
      expect(read(d, '.claude/settings.json')).toBe(text);
      expect(existsSync(join(d, '.codex'))).toBe(false);
      expect(existsSync(join(d, '.kiro'))).toBe(false);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });

  it('--no-hooks and --skills-only write none; a settings.json of another shape is refused', async () => {
    const d = tmp();
    try {
      expect((await run(['install', '--all', '--no-hooks', '--cwd', d])).code).toBe(0);
      expect(existsSync(join(d, '.claude/settings.json'))).toBe(false);
      expect(existsSync(join(d, '.codex/hooks.json'))).toBe(false);
      expect(existsSync(join(d, '.kiro/hooks'))).toBe(false);
      expect((await run(['install', '--all', '--skills-only', '--cwd', d])).code).toBe(0);
      expect(existsSync(join(d, '.claude/settings.json'))).toBe(false);
      expect((await run(['uninstall', '--cwd', d])).code).toBe(0);
      mkdirSync(join(d, '.claude'));
      writeFileSync(join(d, '.claude/settings.json'), JSON.stringify({ hooks: { PostToolUse: {} } }));
      const r = await run(['install', '--claude', '--cwd', d]);
      expect(r.code).toBe(1);
      expect(r.out).toMatch(/\.claude\/settings\.json \(sheetpane rules-check hook\) — "hooks" or "hooks.PostToolUse" has a shape/);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
});

describe('the Claude Code plugin (W-45 DoD 6)', () => {
  it('plugins/sheetpane and .claude-plugin/marketplace.json are what scripts/build-plugin.mjs writes (run `just plugin` after changing a skill)', () => {
    for (const [f, text] of Object.entries(pluginFiles)) expect(existsSync(join(root, f)) && readFileSync(join(root, f), 'utf8') === text, `${f} is stale`).toBe(true);
    expect(filesUnder(PLUGIN_DIR)).toEqual(Object.keys(pluginFiles).filter((f) => f.startsWith(`${PLUGIN_DIR}/`)).sort());
  });
  it('the host skills only, the agent, the hook running the bundled check, the MCP server; the marketplace lists it', () => {
    const inPlugin = Object.keys(pluginFiles).flatMap((f) => /\/skills\/([^/]+)\/SKILL\.md$/.exec(f)?.[1] ?? []);
    expect(inPlugin).toEqual(skills.filter((s) => frontmatter(s.text)!.metadata.audience !== 'contributor').map((s) => s.name));
    expect(inPlugin).not.toContain('sheetpane-records');
    const hooks = JSON.parse(pluginFiles[`${PLUGIN_DIR}/hooks/hooks.json`]!);
    expect(hooks.hooks.PostToolUse[0].hooks[0].command).toBe('node "${CLAUDE_PLUGIN_ROOT}/scripts/sheetpane-skills.mjs" check-rules --hook claude');
    expect(JSON.parse(pluginFiles[`${PLUGIN_DIR}/.mcp.json`]!)).toEqual({ mcpServers: { sheetpane: SERVER } });
    const market = JSON.parse(pluginFiles['.claude-plugin/marketplace.json']!);
    expect(market.plugins).toEqual([expect.objectContaining({ name: 'sheetpane', source: './plugins/sheetpane' })]);
    expect(JSON.parse(pluginFiles[`${PLUGIN_DIR}/.claude-plugin/plugin.json`]!).name).toBe('sheetpane');
  });
});
