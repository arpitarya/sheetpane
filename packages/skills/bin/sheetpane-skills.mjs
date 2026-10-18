#!/usr/bin/env node
// sheetpane-skills — copies @sheetpane/skills into a host repository, for Claude Code,
// Kiro and Codex (W-35). None of the three reads skills from node_modules, so the files
// have to land where each tool looks. Plain Node >= 20, no dependencies, no postinstall:
// nothing is written until a person runs this.
//
// `check-rules` (W-45) checks a sheetpane rules file the way @sheetpane/grid's checkDocument does,
// without importing it (this package has no dependencies); the agents' hooks call it after an edit.
//
// Write rules:
//   - only under .claude/, .kiro/, .agents/, inside the marked block of CLAUDE.md / AGENTS.md /
//     .codex/config.toml, the one `sheetpane` key of .mcp.json / .kiro/settings/mcp.json, and the
//     one PostToolUse group (found by its exact command) of .claude/settings.json / .codex/hooks.json;
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
// `hook`: a hooks.json-shaped entry file whose one PostToolUse group is merged into the tool's JSON
// config; `hookFiles`: hook files copied whole (W-45).
const LAYOUT = {
  claude: { skills: '.claude/skills', files: [['entry/claude-agent.md', '.claude/agents/sheetpane-integrator.md']], hookFiles: [], block: ['entry/claude.md', 'CLAUDE.md'], mcp: ['json', '.mcp.json'], hook: ['entry/claude-hooks.json', '.claude/settings.json'], detect: ['.claude', 'CLAUDE.md'] },
  kiro: { skills: '.kiro/skills', files: [['entry/kiro-steering.md', '.kiro/steering/sheetpane.md'], ['entry/kiro-agent.json', '.kiro/agents/sheetpane-integrator.json']], hookFiles: [['entry/kiro-hook-rules.json', '.kiro/hooks/sheetpane-rules.json']], block: null, mcp: ['json', '.kiro/settings/mcp.json'], hook: null, detect: ['.kiro'] },
  codex: { skills: '.agents/skills', files: [], hookFiles: [], block: ['entry/agents.md', 'AGENTS.md'], mcp: ['toml', '.codex/config.toml'], hook: ['entry/codex-hooks.json', '.codex/hooks.json'], detect: ['.agents', 'AGENTS.md'] },
};
const HOOK_FILES = new Set(Object.values(LAYOUT).flatMap((l) => l.hookFiles.map(([, dst]) => dst)));
/** The hook tools `check-rules --hook` reads input from. */
export const HOOK_TOOLS = ['claude', 'codex', 'kiro'];

const HELP = `sheetpane-skills — install sheetpane's agent skills into this repository, and check rules files

Usage
  npx sheetpane-skills install   [tools] [options]
  npx sheetpane-skills uninstall [options]
  npx sheetpane-skills check-rules <file.rules.json …>
  npx sheetpane-skills check-rules --hook claude|codex|kiro [file]

Tools (default: every tool whose folder or entry file already exists here)
  --claude          .claude/skills/, .claude/agents/sheetpane-integrator.md, a block in CLAUDE.md,
                    the sheetpane MCP server in .mcp.json, a PostToolUse hook in .claude/settings.json
  --kiro            .kiro/skills/, .kiro/steering/sheetpane.md, .kiro/agents/sheetpane-integrator.json,
                    the sheetpane MCP server in .kiro/settings/mcp.json, .kiro/hooks/sheetpane-rules.json
  --codex           .agents/skills/, a block in AGENTS.md, the sheetpane MCP server in
                    .codex/config.toml, a PostToolUse hook in .codex/hooks.json (Codex reads both
                    in trusted projects; review the hook once with /hooks)
  --all             all three

Options
  --skip <list>     leave out a group or skill: contributor | host | <skill-name>, comma-separated
  --only <list>     install only these groups or skills (same words as --skip)
  --skills-only     copy the skill folders; write no CLAUDE.md / AGENTS.md block, steering, agent file,
                    MCP entry or hook
  --no-mcp          leave the MCP server (@sheetpane/mcp, run with npx) out of the tools' config
  --no-hooks        leave out the hooks that run check-rules after the agent edits a *.rules.json
  --dry-run         list every path and what would happen to it; write nothing
  --force           overwrite (or remove) files changed since they were installed
  --cwd <dir>       the repository root (default: the current directory)
  -h, --help        this text

check-rules
  Checks each rules file as <sheetpane-excel> does when it loads one: one line per problem,
  \`SP-60xx: message (file)\`. Exit 0 clean, 1 a problem, 2 a usage or read error.
  --hook <tool>     run as that agent's hook: the path comes from the hook's JSON on stdin (Claude
                    Code tool_input.file_path, Codex apply_patch) or the argument (Kiro {{filePath}});
                    anything but *.rules.json is ignored; problems go to stderr with exit 2, which
                    the agent reads.

Only the marked block (${START} … ${END}) of CLAUDE.md and AGENTS.md, the
marked block of .codex/config.toml, the "sheetpane" key of an MCP JSON file and the one
sheetpane hook group of .claude/settings.json / .codex/hooks.json are ever edited. What was
written is listed in ${MANIFEST}; \`uninstall\` removes exactly that.
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
  const o = { cmd: undefined, tools: new Set(), skip: [], only: [], skillsOnly: false, noMcp: false, noHooks: false, dryRun: false, force: false, cwd: undefined, help: false, hook: undefined, files: [], errors: [] };
  const list = (v) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === 'install' || a === 'uninstall' || a === 'check-rules') { if (o.cmd) o.errors.push(`two commands: ${o.cmd} and ${a}`); o.cmd = a; }
    else if (a === '--claude' || a === '--kiro' || a === '--codex') o.tools.add(a.slice(2));
    else if (a === '--all') TOOLS.forEach((t) => o.tools.add(t));
    else if (a === '--skip' || a === '--only') { const v = argv[++i]; if (!v || v.startsWith('--')) o.errors.push(`${a} needs a value`); else o[a.slice(2)].push(...list(v)); }
    else if (a.startsWith('--skip=') || a.startsWith('--only=')) o[a.slice(2, 6)].push(...list(a.slice(7)));
    else if (a === '--skills-only') o.skillsOnly = true;
    else if (a === '--no-mcp') o.noMcp = true;
    else if (a === '--no-hooks') o.noHooks = true;
    else if (a === '--hook' || a.startsWith('--hook=')) { const v = a === '--hook' ? argv[++i] : a.slice(7); if (!HOOK_TOOLS.includes(v)) o.errors.push(`--hook needs one of ${HOOK_TOOLS.join(', ')}`); else o.hook = v; }
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--force') o.force = true;
    else if (a === '--cwd') { const v = argv[++i]; if (!v) o.errors.push('--cwd needs a directory'); else o.cwd = v; }
    else if (a.startsWith('--cwd=')) o.cwd = a.slice(6);
    else if (a === '-h' || a === '--help') o.help = true;
    else if (o.cmd === 'check-rules' && !a.startsWith('-')) o.files.push(a);
    else o.errors.push(`unknown argument: ${a}`);
  }
  if (o.cmd !== 'check-rules' && o.hook) o.errors.push('--hook belongs to check-rules');
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
  if (!existsSync(f)) return { version: 1, files: {}, blocks: {}, servers: {}, hooks: {}, dirs: [] };
  const m = JSON.parse(readFileSync(f, 'utf8'));
  return { version: 1, files: m.files ?? {}, blocks: m.blocks ?? {}, servers: m.servers ?? {}, hooks: m.hooks ?? {}, dirs: m.dirs ?? [] };
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

// ── the rules-check hook (W-45): one PostToolUse group of a JSON hooks config ──
// JSON holds no comment to mark ours, so our group is the one whose handler runs our exact command.

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
/** The PostToolUse group an entry file (hooks.json shape) carries, and the command that identifies it. */
export function hookGroup(src, pkgRoot = PKG_ROOT) {
  const group = JSON.parse(readFileSync(path.join(pkgRoot, ...src.split('/')), 'utf8')).hooks.PostToolUse[0];
  return { group, command: group.hooks[0].command };
}
const ours = (g, command) => isObj(g) && Array.isArray(g.hooks) && g.hooks.some((h) => isObj(h) && h.command === command);
/** Our group as it stands in the config text now (what the manifest's sha is taken of), or undefined. */
function currentHook(text, command) {
  const list = readJson(text)?.hooks?.PostToolUse;
  const g = Array.isArray(list) ? list.find((x) => ours(x, command)) : undefined;
  return g === undefined ? undefined : JSON.stringify(g);
}
/** Plans the hook for one tool: write · same · update · refuse. */
function planHook(root, man, tool, force, pkgRoot) {
  const [src, key] = LAYOUT[tool].hook;
  const { group, command } = hookGroup(src, pkgRoot);
  const text = readOr(fromKey(root, key));
  const j = readJson(text);
  const row = { key, kind: 'hook', tool, content: JSON.stringify(group), command, created: text === undefined };
  if (j === null) return { ...row, action: 'refuse', why: 'is not a JSON object — fix it, or add the hook by hand' };
  if (j && j.hooks !== undefined && (!isObj(j.hooks) || (j.hooks.PostToolUse !== undefined && !Array.isArray(j.hooks.PostToolUse)))) return { ...row, action: 'refuse', why: '"hooks" or "hooks.PostToolUse" has a shape sheetpane-skills does not edit — add the hook by hand' };
  const known = man.hooks[key];
  const match = known?.command ?? command; // a newer version may run another command: find the one we wrote
  const cur = currentHook(text, match) ?? (match === command ? undefined : currentHook(text, command));
  let action;
  if (cur === undefined) action = 'write';
  else if (cur === row.content) action = 'same';
  else if (known && sha(cur) === known.sha) action = 'update';
  else action = force ? 'update' : 'refuse';
  return { ...row, match, action, why: action === 'refuse' ? (known ? 'the sheetpane hook was edited since it was installed' : 'already has a sheetpane hook sheetpane-skills did not write') : undefined };
}
/** Puts our group into the config text, keeping every other key and group. */
function putHook(abs, r) {
  const j = readJson(readOr(abs)) ?? {};
  if (!isObj(j.hooks)) j.hooks = {};
  if (!Array.isArray(j.hooks.PostToolUse)) j.hooks.PostToolUse = [];
  const list = j.hooks.PostToolUse;
  const i = list.findIndex((g) => ours(g, r.match ?? r.command));
  if (i >= 0) list[i] = JSON.parse(r.content); else list.push(JSON.parse(r.content));
  return JSON.stringify(j, null, 2) + '\n';
}
/** Takes our group out, the emptied `PostToolUse` / `hooks` keys, and the file when install made it and nothing is left. */
function dropHook(abs, rec) {
  const j = readJson(readFileSync(abs, 'utf8'));
  if (!isObj(j?.hooks) || !Array.isArray(j.hooks.PostToolUse)) return;
  j.hooks.PostToolUse = j.hooks.PostToolUse.filter((g) => !ours(g, rec.command));
  if (j.hooks.PostToolUse.length === 0) delete j.hooks.PostToolUse;
  if (Object.keys(j.hooks).length === 0) delete j.hooks;
  if (rec.created && Object.keys(j).length === 0) unlinkSync(abs); else writeFileSync(abs, JSON.stringify(j, null, 2) + '\n');
}

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
export function planInstall(root, { tools, skills, skillsOnly, noMcp = false, noHooks = false, force, pkgRoot = PKG_ROOT }) {
  const man = readManifest(root);
  const rows = [];
  const want = new Map(); // key -> { content, tool }
  for (const t of tools) {
    for (const s of skills) for (const f of s.files) want.set(`${LAYOUT[t].skills}/${s.name}/${f}`, { content: readFileSync(path.join(pkgRoot, 'skills', s.name, ...f.split('/')), 'utf8'), tool: t });
    if (!skillsOnly) for (const [src, dst] of [...LAYOUT[t].files, ...(noHooks ? [] : LAYOUT[t].hookFiles)]) want.set(dst, { content: readFileSync(path.join(pkgRoot, ...src.split('/')), 'utf8'), tool: t });
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
    if (noHooks && HOOK_FILES.has(key)) continue; // --no-hooks leaves an installed hook alone, as --no-mcp does the server
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
    if (!noHooks) for (const t of tools) if (LAYOUT[t].hook) rows.push(planHook(root, man, t, force, pkgRoot));
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
    } else if (r.kind === 'hook') {
      const had = m.hooks[r.key];
      if (r.action === 'write' || r.action === 'update') {
        mk(abs);
        writeFileSync(abs, putHook(abs, r));
        m.hooks[r.key] = { sha: sha(r.content), tool: r.tool, command: r.command, created: had ? had.created : r.created };
      } else if (r.action === 'same') m.hooks[r.key] = had ?? { sha: sha(r.content), tool: r.tool, command: r.command, created: false };
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
  for (const [key, rec] of Object.entries(man.hooks)) {
    const cur = currentHook(readOr(fromKey(root, key)), rec.command);
    if (cur === undefined) rows.push({ key, kind: 'hook', action: 'forget' });
    else if (sha(cur) === rec.sha || force) rows.push({ key, kind: 'hook', action: 'remove', rec });
    else rows.push({ key, kind: 'hook', action: 'refuse', why: 'the sheetpane hook was edited since it was installed' });
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
    if (r.kind === 'hook' && r.action === 'remove') dropHook(abs, r.rec);
  }
  // folders install made, deepest first, only when empty
  for (const d of [...manifest.dirs].sort((a, b) => b.split('/').length - a.split('/').length || b.localeCompare(a))) {
    const abs = fromKey(root, d);
    if (existsSync(abs) && readdirSync(abs).length === 0) rmdirSync(abs);
  }
  unlinkSync(path.join(root, MANIFEST));
}

const SIGN = { write: '+', update: '~', same: '=', refuse: '!', remove: '-', forget: '?', keep: '!' };
const describe = (r) => `  ${SIGN[r.action]} ${r.action.padEnd(7)} ${r.key}${r.kind === 'block' ? ' (sheetpane block)' : r.kind === 'server' ? ' (sheetpane MCP server)' : r.kind === 'hook' ? ' (sheetpane rules-check hook)' : ''}${r.why ? ` — ${r.why}` : ''}`;

// ── check-rules (W-45): the rules file checked as @sheetpane/grid's checkDocument does ──
// A copy of its document checks, codes and messages (packages/grid/src/pane/rules.ts, SR-GRID
// decision 22d) — this package has no dependencies. test/skills.test.ts holds the two equal.

const RULE_WORDS = new Set(['required', 'type', 'min', 'max', 'minLength', 'maxLength', 'pattern', 'oneOf', 'noneOf', 'equals', 'unique', 'message', 'note', 'severity', 'onInvalid']);
const RULE_TYPES = new Set(['text', 'number', 'integer', 'date', 'boolean']);
const A1 = /^\$?([A-Za-z]{1,3})\$?([1-9][0-9]{0,6})$/;
/** An A1 cell inside Excel's limits (XFD1048576), as @sheetpane/export's parseRef reads it. */
function isRef(ref) {
  const m = A1.exec(ref.trim());
  if (!m) return false;
  let col = 0;
  for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return col - 1 < 16_384 && Number(m[2]) - 1 < 1_048_576;
}
/** "B2" or "A1:J1", as @sheetpane/export's parseRange reads it. */
const isRange = (range) => { const [a, b = a] = range.split(':'); return isRef(a ?? '') && isRef(b ?? ''); };

/**
 * The problems of a parsed rules file: `{ code, sheet?, found, message }`, the same list
 * `checkDocument` gives. A file that could not be read is `{ __error: why }`, as the element passes it.
 */
export function checkRules(doc) {
  const problems = [];
  if (!isObj(doc)) return [{ code: 'SP-6010', found: typeof doc, message: 'The rules file is not a JSON object — no rule from it is checked' }];
  if ('__error' in doc) return [{ code: 'SP-6011', found: String(doc.__error), message: `The rules file could not be read — ${String(doc.__error)}` }];
  if (doc.version !== 1) return [{ code: 'SP-6012', found: String(doc.version), message: `Rules file version ${JSON.stringify(doc.version)} is not one this grid reads (1) — no rule from it is checked` }];
  for (const k of Object.keys(doc)) if (!['$schema', 'version', 'sheets'].includes(k)) problems.push({ code: 'SP-6013', found: k, message: `Unknown key “${k}” in the rules file` });
  if (!isObj(doc.sheets)) { problems.push({ code: 'SP-6014', found: 'sheets', message: 'The rules file has no “sheets” object' }); return problems; }
  const rule = (r, where, sheet) => {
    if (!isObj(r)) { problems.push({ code: 'SP-6015', sheet, found: where, message: `The rule for ${where} is not an object` }); return; }
    for (const k of Object.keys(r)) if (!RULE_WORDS.has(k)) problems.push({ code: 'SP-6016', sheet, found: k, message: `Unknown rule word “${k}” for ${where}` });
    if (r.type !== undefined && !RULE_TYPES.has(String(r.type))) problems.push({ code: 'SP-6017', sheet, found: String(r.type), message: `Unknown type “${String(r.type)}” for ${where} (text, number, integer, date, boolean)` });
    if (r.pattern !== undefined) { try { new RegExp(String(r.pattern)); } catch (e) { problems.push({ code: 'SP-6018', sheet, found: String(r.pattern), message: `The pattern for ${where} is not a regular expression (${e.message}) — it is not tested` }); } }
    for (const k of ['oneOf', 'noneOf']) if (r[k] !== undefined && !Array.isArray(r[k])) problems.push({ code: 'SP-6019', sheet, found: k, message: `“${k}” for ${where} is not a list` });
  };
  for (const [name, s] of Object.entries(doc.sheets)) {
    if (!isObj(s)) { problems.push({ code: 'SP-6015', sheet: name, found: name, message: `The rules for sheet “${name}” are not an object` }); continue; }
    for (const k of Object.keys(s)) if (!['headerRow', 'columns', 'cells'].includes(k)) problems.push({ code: 'SP-6013', sheet: name, found: k, message: `Unknown key “${k}” in sheet “${name}”` });
    if (s.headerRow !== undefined && !(typeof s.headerRow === 'number' && s.headerRow >= 1)) problems.push({ code: 'SP-6020', sheet: name, found: String(s.headerRow), message: `“headerRow” in sheet “${name}” is not a row number` });
    if (isObj(s.columns)) for (const [t, r] of Object.entries(s.columns)) rule(r, `column “${t}”`, name);
    if (isObj(s.cells)) for (const [ref, r] of Object.entries(s.cells)) {
      if (!isRange(ref)) { problems.push({ code: 'SP-6021', sheet: name, found: ref, message: `“${ref}” in sheet “${name}” is not a cell or a range` }); continue; }
      rule(r, `cell ${ref}`, name);
    }
  }
  return problems;
}

/** Reads and checks one rules file. `undefined` when it cannot be read at all (the error is in `why`). */
export function checkRulesFile(abs, shown = abs) {
  let text;
  try { text = readFileSync(abs, 'utf8'); } catch (e) { return { problems: undefined, why: e.code === 'ENOENT' ? 'no such file' : e.message, missing: e.code === 'ENOENT' }; }
  let doc;
  try { doc = JSON.parse(text.replace(/^\uFEFF/, '')); } catch (e) { doc = { __error: `${shown}: ${e.message}` }; } // as the element reports a fetch it could not parse
  return { problems: checkRules(doc) };
}

/**
 * The files an agent's hook input names (W-45): Claude Code's `tool_input.file_path`; the paths
 * a Codex `apply_patch` adds, updates or moves to (`tool_input.command` is the patch); a top-level
 * `filePath` / `file_path`. Relative paths are against the input's `cwd`.
 */
export function hookPaths(input) {
  const files = [];
  if (!isObj(input)) return { files, cwd: undefined };
  const ti = isObj(input.tool_input) ? input.tool_input : {};
  if (typeof ti.file_path === 'string') files.push(ti.file_path);
  if (typeof ti.command === 'string' && input.tool_name === 'apply_patch') for (const m of ti.command.matchAll(/^\*\*\* (?:Add File|Update File|Move to): (.+?)\s*$/gm)) files.push(m[1]);
  for (const k of ['filePath', 'file_path']) if (typeof input[k] === 'string') files.push(input[k]);
  return { files: [...new Set(files)], cwd: typeof input.cwd === 'string' ? input.cwd : undefined };
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

const RULES_FILE = /\.rules\.json$/;
/** `SP-60xx: message (file)`, naming the sheet when the message does not. */
const problemLine = (p, file) => `${p.code}: ${p.message} (${file}${p.sheet !== undefined && !p.message.includes(`“${p.sheet}”`) ? `, sheet “${p.sheet}”` : ''})`;

/** `check-rules`: plain (one line per problem, exit 1) or as an agent's hook (stderr, exit 2). */
async function checkRulesCommand(o, io, out, err) {
  let base = path.resolve(o.cwd ?? io.cwd ?? process.cwd());
  let files = o.files;
  if (o.hook && !files.length) {
    let input;
    try { const raw = io.stdin ?? (await readStdin()); input = raw.trim() ? JSON.parse(raw) : {}; }
    catch (e) { err(`sheetpane-skills check-rules: the ${o.hook} hook input is not JSON (${e.message})`); return 1; }
    const h = hookPaths(input);
    files = h.files;
    if (h.cwd) base = path.resolve(base, h.cwd);
  }
  if (o.hook) files = files.filter((f) => RULES_FILE.test(f)); // a hook fires on every edit: only rules files are ours
  else if (!files.length) { err('sheetpane-skills check-rules: name a rules file, e.g. `npx sheetpane-skills check-rules sheetpane.rules.json`'); return 2; }
  let found = 0, unreadable = 0;
  const lines = [];
  for (const f of files) {
    const rel = path.relative(base, f);
    const shown = path.isAbsolute(f) && rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel : f; // as typed, or inside the project
    const r = checkRulesFile(path.resolve(base, f), shown);
    if (!r.problems) {
      if (o.hook && r.missing) continue; // deleted or moved since the edit: nothing to check
      unreadable++;
      err(`sheetpane-skills check-rules: cannot read ${shown} — ${r.why}`);
      continue;
    }
    found += r.problems.length;
    for (const p of r.problems) lines.push(problemLine(p, shown));
    if (!r.problems.length && !o.hook) out(`${shown}: no problems`);
  }
  if (o.hook) {
    if (!found) return unreadable ? 1 : 0;
    err([...lines, `${found} problem(s) in the sheetpane rules file — fix them (the sheetpane-rules-file skill lists the words; the codes are in sheetpane's docs/ERRORS.md) and save it again.`].join('\n'));
    return 2; // Claude Code and Codex read stderr back to the agent on exit 2; Kiro on any non-zero
  }
  lines.forEach((l) => out(l));
  return unreadable ? 2 : found ? 1 : 0;
}

// ── the command ──────────────────────────────────────────────────────────────

/**
 * Runs the CLI. Returns the exit code; prints through `out` / `err`.
 * @param {string[]} argv the arguments after the command name
 * @param {{ out?: (s: string) => void, err?: (s: string) => void, cwd?: string, pkgRoot?: string, stdin?: string }} [io] — `stdin`: a hook's input, instead of reading the process's
 */
export async function main(argv, io = {}) {
  const out = io.out ?? ((s) => process.stdout.write(s + '\n'));
  const err = io.err ?? ((s) => process.stderr.write(s + '\n'));
  const o = parseArgs(argv);
  if (o.help || (!o.cmd && !o.errors.length)) { out(HELP); return o.help ? 0 : 1; }
  if (o.errors.length) { err(o.errors.map((e) => `sheetpane-skills: ${e}`).join('\n') + '\n\n' + 'Run `sheetpane-skills --help`.'); return 2; }
  if (o.cmd === 'check-rules') return checkRulesCommand(o, io, out, err);
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
  const plan = planInstall(root, { tools, skills, skillsOnly: o.skillsOnly, noMcp: o.noMcp, noHooks: o.noHooks, force: o.force, pkgRoot });
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
  if (changed.some((r) => r.kind === 'hook' && r.tool === 'codex')) out('Codex runs a project hook only once you review and trust it: open /hooks in Codex.');
  return 0;
}

// Run when called as a program (directly or through @sheetpane/grid's forwarding bin, which calls main()).
const self = fileURLToPath(import.meta.url);
let invoked = '';
try { invoked = process.argv[1] ? realpathSync(process.argv[1]) : ''; } catch { /* not a file */ }
if (invoked === self) process.exitCode = await main(process.argv.slice(2));
