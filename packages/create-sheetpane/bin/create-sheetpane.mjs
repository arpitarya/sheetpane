#!/usr/bin/env node
// create-sheetpane — `npm create sheetpane` (W-43): a working host app with the sheet and its
// errors panel, a sample workbook and rules file, one test and, when asked, the agent skills
// and the MCP server. Plain Node >= 20, no dependencies; prompts through node:readline.
//
// What it does, in order:
//   1. copies templates/_shared/ then templates/<template>/ into an empty (or new) folder,
//      `_gitignore` → `.gitignore` (npm never publishes a .gitignore);
//   2. fills the placeholders: the project name, and the sheetpane version — this package's own,
//      since every sheetpane package is released at one version (lockstep);
//   3. unless --no-install: installs with the chosen package manager, then runs
//      `sheetpane-skills install --all` (W-35) as asked — host skills or all, the MCP server (W-39) or not.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** The sheetpane version every template pins: this package's own (lockstep, SR-LAW-8). */
export const VERSION = JSON.parse(readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')).version;

/** The templates, in the order the prompt lists them. `entry` is the file a newcomer edits first. */
export const TEMPLATES = {
  vanilla: { title: 'plain TypeScript (Vite)', label: 'Vanilla — Vite + TypeScript, no framework', entry: 'index.html', url: 'http://127.0.0.1:5173' },
  react: { title: 'React 19 (Vite)', label: 'React 19 — Vite', entry: 'src/App.tsx', url: 'http://127.0.0.1:5173' },
  next: { title: 'Next.js (App Router)', label: 'Next.js — App Router, the sheet on the client only', entry: 'app/review.tsx', url: 'http://127.0.0.1:3000' },
  vue: { title: 'Vue 3 (Vite)', label: 'Vue 3 — Vite', entry: 'src/App.vue', url: 'http://127.0.0.1:5173' },
  angular: { title: 'Angular', label: 'Angular — a standalone component', entry: 'src/app/app.ts', url: 'http://127.0.0.1:4200', node: '^22.22.3 || ^24.15.0 || >=26.0.0' },
  svelte: { title: 'Svelte 5 (Vite)', label: 'Svelte 5 — Vite', entry: 'src/App.svelte', url: 'http://127.0.0.1:5173' },
};
export const SKILLS = ['all', 'host', 'none'];
export const PMS = ['npm', 'pnpm', 'yarn'];

const HELP = `create-sheetpane — a working sheetpane app in one command

Usage
  npm create sheetpane@latest [dir] [-- options]
  pnpm create sheetpane [dir] [options]
  yarn create sheetpane [dir] [options]

Options
  --template <t>          ${Object.keys(TEMPLATES).join(' | ')}
  --skills <s>            all | host | none — the agent skills for Claude Code, Kiro and Codex
                          (host: the skills for using sheetpane; all: also the two for contributing to it)
  --mcp, --no-mcp         register the sheetpane MCP server (@sheetpane/mcp) with those tools, or not
  --pm <pm>               npm | pnpm | yarn (default: the one running this)
  --no-install            copy the files only; install and add the skills yourself
  -y, --yes               no questions: the defaults for anything not given
                          (dir sheetpane-app, template vanilla, skills host, MCP on)
  -h, --help              this text

The folder must be new or empty. Nothing outside it is written.
`;

/** Parses the command line. Unknown arguments are errors (exit 2). */
export function parseArgs(argv) {
  const o = { dir: undefined, template: undefined, skills: undefined, mcp: undefined, pm: undefined, install: true, yes: false, help: false, errors: [] };
  const value = (a, i) => { const v = argv[i]; if (v === undefined || v.startsWith('-')) { o.errors.push(`${a} needs a value`); return undefined; } return v; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const eq = /^(--[a-z-]+)=(.*)$/.exec(a);
    const [flag, inline] = eq ? [eq[1], eq[2]] : [a, undefined];
    if (flag === '--template' || flag === '-t') o.template = inline ?? value(a, ++i);
    else if (flag === '--skills') o.skills = inline ?? value(a, ++i);
    else if (flag === '--pm') o.pm = inline ?? value(a, ++i);
    else if (a === '--mcp') o.mcp = true;
    else if (a === '--no-mcp') o.mcp = false;
    else if (a === '--no-install') o.install = false;
    else if (a === '--install') o.install = true;
    else if (a === '-y' || a === '--yes') o.yes = true;
    else if (a === '-h' || a === '--help') o.help = true;
    else if (a.startsWith('-')) o.errors.push(`unknown option: ${a}`);
    else if (o.dir === undefined) o.dir = a;
    else o.errors.push(`a second folder: ${a}`);
  }
  if (o.template !== undefined && !Object.hasOwn(TEMPLATES, o.template)) o.errors.push(`unknown template: ${o.template} (one of ${Object.keys(TEMPLATES).join(', ')})`);
  if (o.skills !== undefined && !SKILLS.includes(o.skills)) o.errors.push(`--skills is all, host or none, not ${o.skills}`);
  if (o.pm !== undefined && !PMS.includes(o.pm)) o.errors.push(`--pm is npm, pnpm or yarn, not ${o.pm}`);
  return o;
}

/** The package manager that ran us (`npm create`, `pnpm create`, `yarn create`), else npm. */
export function detectPm(userAgent = process.env.npm_config_user_agent ?? '') {
  const name = /^(\w+)\//.exec(userAgent)?.[1];
  return PMS.includes(name) ? name : 'npm';
}

/** A valid npm package name from a folder name. */
export function toPackageName(dir) {
  const n = path.basename(path.resolve(dir)).trim().toLowerCase().replace(/[^a-z0-9._~-]+/g, '-').replace(/^[._-]+/, '').replace(/-+$/, '');
  return n || 'sheetpane-app';
}

/** How each package manager runs a script and a local bin. */
export const pmCommands = (pm) => ({
  install: pm === 'yarn' ? ['yarn', []] : [pm, ['install']],
  run: pm === 'npm' ? 'npm run' : pm,
  exec: pm === 'npm' ? 'npx' : pm === 'pnpm' ? 'pnpm exec' : 'yarn',
  bin: (name, args) => (pm === 'npm' ? ['npx', ['--no', name, ...args]] : pm === 'pnpm' ? ['pnpm', ['exec', name, ...args]] : ['yarn', [name, ...args]]),
});

/** The `sheetpane-skills` arguments for a choice, or undefined for `none`. */
export function skillsArgs(skills, mcp) {
  if (skills === 'none') return undefined;
  return ['install', '--all', ...(skills === 'host' ? ['--skip', 'contributor'] : []), ...(mcp ? [] : ['--no-mcp'])];
}

/** True when `version` satisfies `range` — only the `^x.y.z` / `>=x.y.z` alternatives the templates use. */
export function nodeOk(range, version = process.versions.node) {
  const v = version.replace(/^v/, '').split('.').map(Number);
  const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  return range.split('||').some((alt) => {
    const m = /^\s*(\^|>=)(\d+)\.(\d+)\.(\d+)\s*$/.exec(alt);
    if (!m) return false;
    const min = [Number(m[2]), Number(m[3]), Number(m[4])];
    return cmp(v, min) >= 0 && (m[1] === '>=' || v[0] === min[0]);
  });
}

const isText = (buf) => !buf.includes(0);

/** Copies `from` into `to`, `_gitignore` → `.gitignore`, filling `vars` in every text file. Returns the files written. */
export function copyTemplate(from, to, vars) {
  const written = [];
  const walk = (src, dst) => {
    mkdirSync(dst, { recursive: true });
    for (const e of readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, e.name), d = path.join(dst, e.name === '_gitignore' ? '.gitignore' : e.name);
      if (e.isDirectory()) { walk(s, d); continue; }
      const buf = readFileSync(s);
      if (isText(buf)) writeFileSync(d, fill(buf.toString('utf8'), vars)); else copyFileSync(s, d);
      written.push(d);
    }
  };
  walk(from, to);
  return written;
}
/** Replaces every `__SHEETPANE_<KEY>__` with `vars[KEY]`. */
export const fill = (text, vars) => text.replace(/__SHEETPANE_([A-Z]+)__/g, (m, k) => (Object.hasOwn(vars, k) ? vars[k] : m));

/** Questions over a line reader: each answer is the next line, Enter takes the default, end of input takes it too. */
function asker(input, output, out) {
  const rl = createInterface({ input, terminal: false });
  const lines = rl[Symbol.asyncIterator]();
  let ended = false;
  const ask = async (question, def) => {
    output.write(`${question}${def !== undefined ? ` (${def})` : ''} `);
    const r = ended ? { done: true } : await lines.next();
    if (r.done) { ended = true; output.write('\n'); }
    const a = r.done ? '' : String(r.value).trim();
    return a === '' ? def : a;
  };
  const choose = async (question, choices, def) => {
    out(question);
    choices.forEach(([k, label], i) => out(`  ${i + 1}. ${k.padEnd(8)} ${label}`));
    for (;;) {
      const a = await ask('›', def);
      const byNum = choices[Number(a) - 1];
      if (byNum) return byNum[0];
      if (choices.some(([k]) => k === a) || ended) return choices.some(([k]) => k === a) ? a : def;
      out(`  pick 1–${choices.length} or a name`);
    }
  };
  return { ask, choose, close: () => rl.close() };
}

/**
 * Runs the CLI. Returns the exit code: 0 done, 1 refused or a step failed, 2 a usage error.
 * @param {string[]} argv the arguments after the command name
 * @param {{ out?: (s: string) => void, err?: (s: string) => void, cwd?: string, input?: NodeJS.ReadableStream, output?: NodeJS.WritableStream,
 *   run?: (cmd: string, args: string[], cwd: string) => number, userAgent?: string, nodeVersion?: string }} [io]
 */
export async function main(argv, io = {}) {
  const out = io.out ?? ((s) => process.stdout.write(s + '\n'));
  const err = io.err ?? ((s) => process.stderr.write(s + '\n'));
  const run = io.run ?? ((cmd, args, cwd) => spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' }).status ?? 1);
  const o = parseArgs(argv);
  if (o.help) { out(HELP); return 0; }
  if (o.errors.length) { err(o.errors.map((e) => `create-sheetpane: ${e}`).join('\n') + '\n\nRun `npm create sheetpane@latest -- --help`.'); return 2; }

  const cwd = io.cwd ?? process.cwd();
  // questions only at a terminal (or a given input); piped or in CI, the defaults are used
  if (!o.yes && (io.input || process.stdin.isTTY)) {
    const q = asker(io.input ?? process.stdin, io.output ?? process.stdout, out);
    try {
      o.dir ??= await q.ask('Project folder:', 'sheetpane-app');
      o.template ??= await q.choose('Template:', Object.entries(TEMPLATES).map(([k, t]) => [k, t.label]), 'vanilla');
      o.skills ??= await q.choose('Agent skills (Claude Code, Kiro, Codex):', [['host', 'the skills for using sheetpane'], ['all', 'those, and the two for contributing to sheetpane'], ['none', 'no skills']], 'host');
      if (o.skills !== 'none') o.mcp ??= /^y/i.test(await q.ask('Register the sheetpane MCP server with those tools? [y/n]', 'y'));
    } finally { q.close(); }
  } else if (!o.yes) out('create-sheetpane: no terminal to ask at — using the defaults for what the flags leave out (--help lists them).');
  const dir = o.dir ?? 'sheetpane-app';
  const template = o.template ?? 'vanilla';
  const skills = o.skills ?? 'host';
  const mcp = o.mcp ?? true;
  const pm = o.pm ?? detectPm(io.userAgent);
  const cmds = pmCommands(pm);

  const target = path.resolve(cwd, dir);
  if (existsSync(target) && (!statSync(target).isDirectory() || readdirSync(target).length > 0)) {
    err(`create-sheetpane: ${target} is not empty — pick a new folder.`);
    return 1;
  }
  const name = toPackageName(target);
  const t = TEMPLATES[template];
  const vars = { NAME: name, VERSION, TEMPLATE: template, FRAMEWORK: t.title, ENTRY: t.entry, URL: t.url, RUN: cmds.run, EXEC: cmds.exec, PM: pm };
  copyTemplate(path.join(PKG_ROOT, 'templates', '_shared'), target, vars);
  copyTemplate(path.join(PKG_ROOT, 'templates', template), target, vars);
  out(`\nCreated ${name} (${t.title}) in ${target}, sheetpane ${VERSION}.`);
  if (t.node && !nodeOk(t.node, io.nodeVersion)) out(`\nNote: the ${t.title} template needs Node ${t.node}; this is ${io.nodeVersion ?? process.versions.node}. Upgrade Node before you build.`);

  const rel = path.relative(cwd, target);
  const cdTo = rel === '' ? '.' : rel.startsWith('..') ? target : rel;
  const sk = skillsArgs(skills, mcp);
  const show = ([c, a]) => [c, ...a.filter((x) => x !== '--no')].join(' ');
  const skillsLine = sk && show(cmds.bin('sheetpane-skills', sk));
  if (o.install) {
    out(`\nInstalling with ${pm}…`);
    const [cmd, args] = cmds.install;
    if (run(cmd, args, target) !== 0) { err(`create-sheetpane: \`${[cmd, ...args].join(' ')}\` failed in ${target}. Fix it and run it again; the files are in place.`); return 1; }
    if (sk) {
      out(`\nAdding the agent skills${mcp ? ' and the MCP server' : ''}…`);
      const [bc, ba] = cmds.bin('sheetpane-skills', sk);
      if (run(bc, ba, target) !== 0) { err(`create-sheetpane: \`${skillsLine}\` failed; run it again in ${target}.`); return 1; }
    }
  }
  out('\nNext:');
  if (cdTo !== '.') out(`  cd ${cdTo.includes(' ') ? JSON.stringify(cdTo) : cdTo}`);
  if (!o.install) out(`  ${[cmds.install[0], ...cmds.install[1]].join(' ')}`);
  if (!o.install && skillsLine) out(`  ${skillsLine}      # the agent skills${mcp ? ' and the MCP server' : ''}`);
  out(`  ${cmds.run} dev         # ${t.url}`);
  out(`  ${cmds.run} test        # one Playwright test on @sheetpane/testing (first time: ${show(cmds.bin('playwright', ['install', 'chromium']))})`);
  if (!sk) out(`\nAn AI coding agent? ${show(cmds.bin('sheetpane-skills', ['install', '--all']))} adds sheetpane's skills for Claude Code, Kiro and Codex.`);
  return 0;
}

// Run when called as a program.
const self = fileURLToPath(import.meta.url);
let invoked = '';
try { invoked = process.argv[1] ? realpathSync(process.argv[1]) : ''; } catch { /* not a file */ }
if (invoked === self) process.exitCode = await main(process.argv.slice(2));
