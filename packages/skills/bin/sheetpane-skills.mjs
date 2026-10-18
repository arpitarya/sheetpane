#!/usr/bin/env node
// sheetpane-skills — copies @sheetpane/skills into a host repository, for Claude Code,
// Kiro and Codex (W-35). None of the three reads skills from node_modules, so the files
// have to land where each tool looks. Plain Node >= 20, no dependencies, no postinstall:
// nothing is written until a person runs this.
//
// Write rules:
//   - only under .claude/, .kiro/, .agents/, inside the marked block of CLAUDE.md / AGENTS.md /
//     .codex/config.toml, and the one `sheetpane` key of .mcp.json / .kiro/settings/mcp.json;
//   - a file (or block) changed since this tool wrote it is never overwritten without --force;
//   - every path written is listed in .sheetpane-skills.json, and `uninstall` removes exactly those.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MANIFEST = '.sheetpane-skills.json';
export const START = '<!-- sheetpane:start -->';
export const END = '<!-- sheetpane:end -->';
export const TOML_START = '# sheetpane:start';
export const TOML_END = '# sheetpane:end';
export const TOOLS = ['claude', 'kiro', 'codex'];
/** The MCP server entry (W-39) each tool's config gets. */
export const SERVER = { command: 'npx', args: ['-y', '@sheetpane/mcp'] };
const SERVER_TOML = `${TOML_START}\n[mcp_servers.sheetpane]\ncommand = "npx"\nargs = ["-y", "@sheetpane/mcp"]\n${TOML_END}`;
export const GROUPS = ['host', 'contributor'];

/** Where each tool looks. Keys of the manifest are POSIX paths relative to the host root. */
const LAYOUT = {
  claude: { skills: '.claude/skills', files: [['entry/claude-agent.md', '.claude/agents/sheetpane-integrator.md']], block: ['entry/claude.md', 'CLAUDE.md'], mcp: ['json', '.mcp.json'], detect: ['.claude', 'CLAUDE.md'] },
  kiro: { skills: '.kiro/skills', files: [['entry/kiro-steering.md', '.kiro/steering/sheetpane.md'], ['entry/kiro-agent.json', '.kiro/agents/sheetpane-integrator.json']], block: null, mcp: ['json', '.kiro/settings/mcp.json'], detect: ['.kiro'] },
  codex: { skills: '.agents/skills', files: [], block: ['entry/agents.md', 'AGENTS.md'], mcp: ['toml', '.codex/config.toml'], detect: ['.agents', 'AGENTS.md'] },
};

const HELP = `sheetpane-skills — install sheetpane's agent skills into this repository

Usage
  npx sheetpane-skills install   [tools] [options]
  npx sheetpane-skills uninstall [options]

Tools (default: every tool whose folder or entry file already exists here)
  --claude          .claude/skills/, .claude/agents/sheetpane-integrator.md, a block in CLAUDE.md,
                    the sheetpane MCP server in .mcp.json
  --kiro            .kiro/skills/, .kiro/steering/sheetpane.md, .kiro/agents/sheetpane-integrator.json,
                    the sheetpane MCP server in .kiro/settings/mcp.json
  --codex           .agents/skills/, a block in AGENTS.md, the sheetpane MCP server in
                    .codex/config.toml (Codex reads it in trusted projects)
  --all             all three

Options
  --skip <list>     leave out a group or skill: contributor | host | <skill-name>, comma-separated
  --only <list>     install only these groups or skills (same words as --skip)
  --skills-only     copy the skill folders; write no CLAUDE.md / AGENTS.md block, steering, agent file or MCP entry
  --no-mcp          leave the MCP server (@sheetpane/mcp, run with npx) out of the tools' config
  --dry-run         list every path and what would happen to it; write nothing
  --force           overwrite (or remove) files changed since they were installed
  --cwd <dir>       the repository root (default: the current directory)
  -h, --help        this text

Only the marked block (${START} … ${END}) of CLAUDE.md and AGENTS.md, the
marked block of .codex/config.toml and the "sheetpane" key of an MCP JSON file are
ever edited. What was written is listed in ${MANIFEST}; \`uninstall\` removes exactly that.
`;

// ── small pure helpers (tested with path.win32 as well) ─────────────────────

/** A manifest key (always `/`) from a path relative to the root, on any platform. */
export function toKey(rel, p = path) { return rel.split(p.sep).join('/'); }
/** The absolute path of a manifest key under `root`, on any platform. */
export function fromKey(root, key, p = path) { return p.join(root, ...key.split('/')); }
/** True when `key` stays inside the root (no `..`, not absolute). */
export function safeKey(key) { return !key.split('/').some((s) => s === '..' || s === '') && !/^[A-Za-z]:/.test(key) && !key.startsWith('/'); }

export const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

/** Parses `--flag value` / `--flag` lists. */
export function parseArgs(argv) {
  const o = { cmd: undefined, tools: new Set(), skip: [], only: [], skillsOnly: false, noMcp: false, dryRun: false, force: false, cwd: undefined, help: false, errors: [] };
  const list = (v) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === 'install' || a === 'uninstall') { if (o.cmd) o.errors.push(`two commands: ${o.cmd} and ${a}`); o.cmd = a; }
    else if (a === '--claude' || a === '--kiro' || a === '--codex') o.tools.add(a.slice(2));
    else if (a === '--all') TOOLS.forEach((t) => o.tools.add(t));
    else if (a === '--skip' || a === '--only') { const v = argv[++i]; if (!v || v.startsWith('--')) o.errors.push(`${a} needs a value`); else o[a.slice(2)].push(...list(v)); }
    else if (a.startsWith('--skip=') || a.startsWith('--only=')) o[a.slice(2, 6)].push(...list(a.slice(7)));
    else if (a === '--skills-only') o.skillsOnly = true;
    else if (a === '--no-mcp') o.noMcp = true;
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--force') o.force = true;
    else if (a === '--cwd') { const v = argv[++i]; if (!v) o.errors.push('--cwd needs a directory'); else o.cwd = v; }
    else if (a.startsWith('--cwd=')) o.cwd = a.slice(6);
    else if (a === '-h' || a === '--help') o.help = true;
    else o.errors.push(`unknown argument: ${a}`);
  }
  return o;
}

/** `name`, `description` and `metadata.audience` from a SKILL.md's frontmatter (no YAML parser: the subset we write). */
export function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return undefined;
  const out = { keys: [], metadata: {} };
  let inMeta = false;
  for (const line of m[1].split(/\r?\n/)) {
    const top = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (top) { out.keys.push(top[1]); inMeta = top[1] === 'metadata'; if (!inMeta) out[top[1]] = unquote(top[2]); continue; }
    const sub = /^\s+([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (sub && inMeta) out.metadata[sub[1]] = unquote(sub[2]);
  }
  return out;
}
const unquote = (s) => (/^(['"]).*\1$/.test(s.trim()) ? s.trim().slice(1, -1) : s.trim());

/** The skills this package carries: `{ name, audience, files: [relative POSIX paths] }`. */
export function listSkills(root = PKG_ROOT) {
  const dir = path.join(root, 'skills');
  return readdirSync(dir).filter((d) => statSync(path.join(dir, d)).isDirectory()).sort().map((name) => {
    const fm = frontmatter(readFileSync(path.join(dir, name, 'SKILL.md'), 'utf8')) ?? { metadata: {} };
    return { name, audience: fm.metadata.audience === 'contributor' ? 'contributor' : 'host', files: walk(path.join(dir, name)).map((f) => toKey(path.relative(path.join(dir, name), f))).sort() };
  });
}
function walk(d) { return readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; }); }

/** Replaces the marked block in `text`, or appends one. Returns the new text and how it was placed. */
export function putBlock(text, block, [start, end] = [START, END]) {
  const s = text.indexOf(start), e = text.indexOf(end);
  if (s >= 0 && e > s) return { text: text.slice(0, s) + block + text.slice(e + end.length), prefix: null };
  if (text === '') return { text: block + '\n', prefix: '' };
  const prefix = text.endsWith('\n\n') ? '' : text.endsWith('\n') ? '\n' : '\n\n';
  return { text: text + prefix + block + '\n', prefix };
}
/** The current marked block in `text`, or undefined. */
export function getBlock(text, [start, end] = [START, END]) {
  const s = text.indexOf(start), e = text.indexOf(end);
  return s >= 0 && e > s ? text.slice(s, e + end.length) : undefined;
}
/** Removes the marked block and what `putBlock` added around it (`prefix` and the trailing newline). */
export function dropBlock(text, prefix, [start, end] = [START, END]) {
  const s = text.indexOf(start), e = text.indexOf(end);
  if (s < 0 || e < s) return text;
  let a = s, b = e + end.length;
  if (prefix !== null && prefix !== undefined) {
    if (text.slice(b, b + 1) === '\n') b += 1;
    if (prefix && text.slice(a - prefix.length, a) === prefix) a -= prefix.length;
  }
  return text.slice(0, a) + text.slice(b);
}

// ── the plan ─────────────────────────────────────────────────────────────────

function readManifest(root) {
  const f = path.join(root, MANIFEST);
  if (!existsSync(f)) return { version: 1, files: {}, blocks: {}, servers: {}, dirs: [] };
  const m = JSON.parse(readFileSync(f, 'utf8'));
  return { version: 1, files: m.files ?? {}, blocks: m.blocks ?? {}, servers: m.servers ?? {}, dirs: m.dirs ?? [] };
}

// ── the MCP entry (W-39): one key of a JSON config, or a marked block of TOML ─

const TOML = [TOML_START, TOML_END];
/** A JSON config's text, parsed; `undefined` when absent, `null` when it is not a JSON object. */
function readJson(text) {
  if (text === undefined || text.trim() === '') return undefined;
  try { const v = JSON.parse(text); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; }
}
/** The entry as it stands in the file now: what the sha in the manifest is taken of. */
function currentServer(kind, text) {
  if (kind === 'toml') return text === undefined ? undefined : getBlock(text, TOML);
  const j = readJson(text);
  const e = j?.mcpServers?.sheetpane;
  return e === undefined ? undefined : JSON.stringify(e);
}
/** Plans the MCP entry for one tool: write · same · update · refuse. */
function planServer(root, man, tool, force) {
  const [kind, key] = LAYOUT[tool].mcp;
  const text = readOr(fromKey(root, key));
  const want = kind === 'toml' ? SERVER_TOML : JSON.stringify(SERVER);
  if (kind === 'json' && readJson(text) === null) return { key, kind: 'server', format: kind, action: 'refuse', tool, why: 'is not a JSON object — fix it, or add the server by hand' };
  if (kind === 'toml' && text !== undefined && getBlock(text, TOML) === undefined && /^\s*\[mcp_servers\.sheetpane\]/m.test(text)) return { key, kind: 'server', format: kind, action: 'refuse', tool, why: 'already names [mcp_servers.sheetpane] outside the sheetpane block' };
  const cur = currentServer(kind, text), known = man.servers[key];
  let action;
  if (cur === undefined) action = 'write';
  else if (cur === want) action = 'same';
  else if (known && sha(cur) === known.sha) action = 'update';
  else action = force ? 'update' : 'refuse';
  return { key, kind: 'server', format: kind, action, tool, content: want, created: text === undefined, why: action === 'refuse' ? (known ? 'the sheetpane server entry was edited since it was installed' : 'already has a sheetpane server entry sheetpane-skills did not write') : undefined };
}
/** Writes the entry into the file, keeping everything else in it. */
function putServer(abs, r) {
  const text = readOr(abs);
  if (r.format === 'toml') return putBlock(text ?? '', r.content, TOML);
  const j = readJson(text) ?? {};
  j.mcpServers = { ...(j.mcpServers ?? {}), sheetpane: SERVER };
  return { text: JSON.stringify(j, null, 2) + '\n', prefix: null };
}
/** Takes the entry out, and the file too when install made it and nothing else is left. */
function dropServer(abs, format, rec) {
  const text = readFileSync(abs, 'utf8');
  if (format === 'toml') {
    const next = dropBlock(text, rec.prefix, TOML);
    if (rec.created && next.trim() === '') unlinkSync(abs); else writeFileSync(abs, next);
    return;
  }
  const j = readJson(text);
  if (!j?.mcpServers) return;
  delete j.mcpServers.sheetpane;
  if (Object.keys(j.mcpServers).length === 0) delete j.mcpServers;
  if (rec.created && Object.keys(j).length === 0) unlinkSync(abs); else writeFileSync(abs, JSON.stringify(j, null, 2) + '\n');
}
const readOr = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : undefined);

/** Picks the skills `--skip` / `--only` leave. Unknown words are an error. */
export function selectSkills(skills, skip, only) {
  const known = new Set([...GROUPS, ...skills.map((s) => s.name)]);
  const bad = [...skip, ...only].filter((w) => !known.has(w));
  if (bad.length) throw new Error(`unknown group or skill: ${bad.join(', ')} (groups: ${GROUPS.join(', ')})`);
  const hit = (s, words) => words.includes(s.name) || words.includes(s.audience);
  return skills.filter((s) => (!only.length || hit(s, only)) && !hit(s, skip));
}

/** The tools to install for: the flags, else those whose folder or entry file exists. */
export function detectTools(root, flags) {
  if (flags.size) return [...flags];
  return TOOLS.filter((t) => LAYOUT[t].detect.some((d) => existsSync(path.join(root, d))));
}

/**
 * Everything install would do, without doing it: one row per path with an action —
 * `write` (new) · `update` (ours, unchanged since, now different) · `same` · `refuse`
 * (changed since we wrote it, or not ours) · `remove` (ours, no longer selected).
 */
export function planInstall(root, { tools, skills, skillsOnly, noMcp = false, force, pkgRoot = PKG_ROOT }) {
  const man = readManifest(root);
  const rows = [];
  const want = new Map(); // key -> { content, tool }
  for (const t of tools) {
    for (const s of skills) for (const f of s.files) want.set(`${LAYOUT[t].skills}/${s.name}/${f}`, { content: readFileSync(path.join(pkgRoot, 'skills', s.name, ...f.split('/')), 'utf8'), tool: t });
    if (!skillsOnly) for (const [src, dst] of LAYOUT[t].files) want.set(dst, { content: readFileSync(path.join(pkgRoot, ...src.split('/')), 'utf8'), tool: t });
  }
  for (const [key, w] of want) {
    const cur = readOr(fromKey(root, key));
    const known = man.files[key];
    let action;
    if (cur === undefined) action = 'write';
    else if (cur === w.content) action = 'same';
    else if (known && sha(cur) === known.sha) action = 'update';
    else action = force ? 'update' : 'refuse';
    rows.push({ key, kind: 'file', action, tool: w.tool, content: w.content, why: action === 'refuse' ? (known ? 'changed since it was installed' : 'exists and was not written by sheetpane-skills') : undefined });
  }
  // files we wrote earlier for these tools that are no longer wanted
  for (const [key, rec] of Object.entries(man.files)) {
    if (want.has(key) || !tools.includes(rec.tool)) continue;
    if (skillsOnly && !key.startsWith(`${LAYOUT[rec.tool].skills}/`)) continue; // --skills-only leaves the entry files alone
    const cur = readOr(fromKey(root, key));
    if (cur === undefined) rows.push({ key, kind: 'file', action: 'forget', tool: rec.tool });
    else if (sha(cur) === rec.sha || force) rows.push({ key, kind: 'file', action: 'remove', tool: rec.tool });
    else rows.push({ key, kind: 'file', action: 'keep', tool: rec.tool, why: 'no longer installed, but changed since — left in place' });
  }
  if (!skillsOnly) {
    for (const t of tools) {
      if (!LAYOUT[t].block) continue;
      const [src, dst] = LAYOUT[t].block;
      const block = readFileSync(path.join(pkgRoot, ...src.split('/')), 'utf8').trim();
      if (!block.startsWith(START) || !block.endsWith(END)) throw new Error(`${src} must sit between ${START} and ${END}`);
      const text = readOr(fromKey(root, dst)) ?? '';
      const cur = getBlock(text), known = man.blocks[dst];
      let action;
      if (cur === undefined) action = 'write';
      else if (cur === block) action = 'same';
      else if (known && sha(cur) === known.sha) action = 'update';
      else action = force ? 'update' : 'refuse';
      rows.push({ key: dst, kind: 'block', action, tool: t, content: block, created: !existsSync(fromKey(root, dst)), why: action === 'refuse' ? (known ? 'the sheetpane block was edited since it was installed' : 'holds a sheetpane block sheetpane-skills did not write') : undefined });
    }
    if (!noMcp) for (const t of tools) rows.push(planServer(root, man, t, force));
  }
  return { rows, manifest: man };
}

/** Applies a plan (only when nothing is refused). Returns the manifest written. */
function applyInstall(root, { rows, manifest }) {
  const m = structuredClone(manifest);
  const dirs = new Set(m.dirs);
  const mk = (abs) => {
    const missing = [];
    for (let d = path.dirname(abs); !existsSync(d) && d !== root && d.startsWith(root); d = path.dirname(d)) missing.push(d);
    for (const d of missing.reverse()) { mkdirSync(d); dirs.add(toKey(path.relative(root, d))); }
  };
  for (const r of rows) {
    const abs = fromKey(root, r.key);
    if (r.kind === 'file') {
      if (r.action === 'write' || r.action === 'update') { mk(abs); writeFileSync(abs, r.content); }
      if (r.action === 'write' || r.action === 'update' || r.action === 'same') m.files[r.key] = { sha: sha(r.content), tool: r.tool };
      if (r.action === 'remove') { unlinkSync(abs); delete m.files[r.key]; }
      if (r.action === 'forget') delete m.files[r.key];
    } else if (r.kind === 'block') {
      const text = readOr(abs) ?? '';
      const had = m.blocks[r.key];
      if (r.action === 'write' || r.action === 'update') {
        const put = putBlock(text, r.content);
        writeFileSync(abs, put.text);
        m.blocks[r.key] = { sha: sha(r.content), tool: r.tool, created: had ? had.created : r.created, prefix: had ? had.prefix : put.prefix };
      } else if (r.action === 'same') m.blocks[r.key] = had ?? { sha: sha(r.content), tool: r.tool, created: false, prefix: null };
    } else if (r.kind === 'server') {
      const had = m.servers[r.key];
      if (r.action === 'write' || r.action === 'update') {
        mk(abs);
        const put = putServer(abs, r);
        writeFileSync(abs, put.text);
        m.servers[r.key] = { sha: sha(r.content), tool: r.tool, format: r.format, created: had ? had.created : r.created, prefix: had ? had.prefix : put.prefix };
      } else if (r.action === 'same') m.servers[r.key] = had ?? { sha: sha(r.content), tool: r.tool, format: r.format, created: false, prefix: null };
    }
  }
  m.dirs = [...dirs].sort();
  return m;
}

/** Everything uninstall would do. */
export function planUninstall(root, { force }) {
  const man = readManifest(root);
  const rows = [];
  for (const [key, rec] of Object.entries(man.files)) {
    if (!safeKey(key)) { rows.push({ key, kind: 'file', action: 'keep', why: 'not a path inside the repository' }); continue; }
    const cur = readOr(fromKey(root, key));
    if (cur === undefined) rows.push({ key, kind: 'file', action: 'forget' });
    else if (sha(cur) === rec.sha || force) rows.push({ key, kind: 'file', action: 'remove' });
    else rows.push({ key, kind: 'file', action: 'refuse', why: 'changed since it was installed' });
  }
  for (const [key, rec] of Object.entries(man.blocks)) {
    const text = readOr(fromKey(root, key));
    const cur = text === undefined ? undefined : getBlock(text);
    if (cur === undefined) rows.push({ key, kind: 'block', action: 'forget' });
    else if (sha(cur) === rec.sha || force) rows.push({ key, kind: 'block', action: 'remove', rec });
    else rows.push({ key, kind: 'block', action: 'refuse', why: 'the sheetpane block was edited since it was installed' });
  }
  for (const [key, rec] of Object.entries(man.servers)) {
    const cur = currentServer(rec.format, readOr(fromKey(root, key)));
    if (cur === undefined) rows.push({ key, kind: 'server', action: 'forget' });
    else if (sha(cur) === rec.sha || force) rows.push({ key, kind: 'server', action: 'remove', rec });
    else rows.push({ key, kind: 'server', action: 'refuse', why: 'the sheetpane server entry was edited since it was installed' });
  }
  return { rows, manifest: man };
}

function applyUninstall(root, { rows, manifest }) {
  for (const r of rows) {
    const abs = fromKey(root, r.key);
    if (r.kind === 'file' && r.action === 'remove') unlinkSync(abs);
    if (r.kind === 'block' && r.action === 'remove') {
      const next = dropBlock(readFileSync(abs, 'utf8'), r.rec.prefix);
      if (r.rec.created && next.trim() === '') unlinkSync(abs); else writeFileSync(abs, next);
    }
    if (r.kind === 'server' && r.action === 'remove') dropServer(abs, r.rec.format, r.rec);
  }
  // folders install made, deepest first, only when empty
  for (const d of [...manifest.dirs].sort((a, b) => b.split('/').length - a.split('/').length || b.localeCompare(a))) {
    const abs = fromKey(root, d);
    if (existsSync(abs) && readdirSync(abs).length === 0) rmdirSync(abs);
  }
  unlinkSync(path.join(root, MANIFEST));
}

const SIGN = { write: '+', update: '~', same: '=', refuse: '!', remove: '-', forget: '?', keep: '!' };
const describe = (r) => `  ${SIGN[r.action]} ${r.action.padEnd(7)} ${r.key}${r.kind === 'block' ? ' (sheetpane block)' : r.kind === 'server' ? ' (sheetpane MCP server)' : ''}${r.why ? ` — ${r.why}` : ''}`;

// ── the command ──────────────────────────────────────────────────────────────

/**
 * Runs the CLI. Returns the exit code; prints through `out` / `err`.
 * @param {string[]} argv the arguments after the command name
 * @param {{ out?: (s: string) => void, err?: (s: string) => void, cwd?: string, pkgRoot?: string }} [io]
 */
export async function main(argv, io = {}) {
  const out = io.out ?? ((s) => process.stdout.write(s + '\n'));
  const err = io.err ?? ((s) => process.stderr.write(s + '\n'));
  const o = parseArgs(argv);
  if (o.help || (!o.cmd && !o.errors.length)) { out(HELP); return o.help ? 0 : 1; }
  if (o.errors.length) { err(o.errors.map((e) => `sheetpane-skills: ${e}`).join('\n') + '\n\n' + 'Run `sheetpane-skills --help`.'); return 2; }
  const root = path.resolve(o.cwd ?? io.cwd ?? process.cwd());
  if (!existsSync(root) || !statSync(root).isDirectory()) { err(`sheetpane-skills: no directory ${root}`); return 2; }
  const pkgRoot = io.pkgRoot ?? PKG_ROOT;

  if (o.cmd === 'uninstall') {
    if (!existsSync(path.join(root, MANIFEST))) { out(`sheetpane-skills: nothing to uninstall (no ${MANIFEST} in ${root})`); return 0; }
    const plan = planUninstall(root, o);
    out(`${o.dryRun ? 'Would uninstall' : 'Uninstalling'} from ${root}:`);
    plan.rows.forEach((r) => out(describe(r)));
    const refused = plan.rows.filter((r) => r.action === 'refuse');
    if (refused.length) { err(`\nsheetpane-skills: ${refused.length} path(s) changed since install — nothing removed. Re-run with --force to remove them anyway.`); return 1; }
    if (!o.dryRun) applyUninstall(root, plan);
    out(o.dryRun ? '\n(dry run: nothing removed)' : `\nRemoved ${plan.rows.filter((r) => r.action === 'remove').length} path(s) and ${MANIFEST}.`);
    return 0;
  }

  const tools = detectTools(root, o.tools);
  if (!tools.length) { err(`sheetpane-skills: no .claude/, .kiro/, .agents/, CLAUDE.md or AGENTS.md in ${root} — name a tool: --claude, --kiro, --codex or --all.`); return 2; }
  let skills;
  try { skills = selectSkills(listSkills(pkgRoot), o.skip, o.only); }
  catch (e) { err(`sheetpane-skills: ${e.message}`); return 2; }
  const plan = planInstall(root, { tools, skills, skillsOnly: o.skillsOnly, noMcp: o.noMcp, force: o.force, pkgRoot });
  out(`${o.dryRun ? 'Would install' : 'Installing'} ${skills.length} skill(s) for ${tools.join(', ')} in ${root}:`);
  plan.rows.forEach((r) => out(describe(r)));
  const refused = plan.rows.filter((r) => r.action === 'refuse');
  if (refused.length) { err(`\nsheetpane-skills: ${refused.length} path(s) would overwrite a change — nothing written. Re-run with --force to overwrite.`); return 1; }
  const changed = plan.rows.filter((r) => r.action !== 'same' && r.action !== 'keep');
  if (o.dryRun) { out('\n(dry run: nothing written)'); return 0; }
  const next = applyInstall(root, plan);
  const mf = path.join(root, MANIFEST);
  const text = JSON.stringify({ version: 1, note: 'Written by sheetpane-skills; `npx sheetpane-skills uninstall` removes exactly these paths.', ...next }, null, 2) + '\n';
  if (readOr(mf) !== text) writeFileSync(mf, text);
  out(changed.length ? `\nDone: ${changed.length} path(s) changed; the list is in ${MANIFEST}.` : '\nNothing to do: everything is already installed.');
  return 0;
}

// Run when called as a program (directly or through @sheetpane/grid's forwarding bin, which calls main()).
const self = fileURLToPath(import.meta.url);
let invoked = '';
try { invoked = process.argv[1] ? realpathSync(process.argv[1]) : ''; } catch { /* not a file */ }
if (invoked === self) process.exitCode = await main(process.argv.slice(2));
