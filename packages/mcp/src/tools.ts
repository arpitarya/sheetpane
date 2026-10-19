// The tools (W-39). Each is deterministic — the same input gives the same output — and computed
// from what ships: the import package, the grid's DOM-free check entry (the pane's own checks,
// W-54), docs/ERRORS.md, the skills and the custom-elements manifest. Read-only: paths come from the agent, nothing is written, no
// network. A bad input is a tool error (`isError: true`), never a crash.
import { readFile, stat } from 'node:fs/promises';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { read, BUILTIN_FORMATS, type ImportedSheet, type ImportedWorkbook } from '@sheetpane/import';
import { check, checkDocument, describeRule, CODES, codeUrl, spMessage, type ColumnRule, type SheetpaneError, type SpCode } from '@sheetpane/grid/check';
import { describeApi } from './api.js';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/** A tool as `tools/list` shows it, plus the function that answers it. */
export interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: Record<string, unknown>) => Promise<string>;
}

/** What `tools/call` returns: text content, and `isError` for a tool error. */
export interface ToolResult { content: { type: 'text'; text: string }[]; isError?: boolean }

/** A tool error: its coded message goes back to the agent, and the server keeps running. */
class ToolError extends Error {
  constructor(readonly spCode: SpCode, detail: string) { super(spMessage(spCode, detail)); }
}

const SCHEMA = 'https://json-schema.org/draft/2020-12/schema';
const MAX_BYTES = 256 * 1024 * 1024;

const str = (args: Record<string, unknown>, k: string, required = true): string | undefined => {
  const v = args[k];
  if (v === undefined && !required) return undefined;
  if (typeof v !== 'string' || !v.trim()) throw new ToolError('SP-7001', `“${k}” must be a non-empty string`);
  return v;
};

// ── workbooks ──────────────────────────────────────────────────────────────

/** A workbook's bytes from a path the agent gives, its absolute path and its file name. */
async function readWorkbook(path: string): Promise<{ abs: string; name: string; bytes: Uint8Array }> {
  const abs = resolve(path);
  let size: number;
  try { size = (await stat(abs)).size; } catch { throw new ToolError('SP-7002', `No file at ${abs}`); }
  if (size > MAX_BYTES) throw new ToolError('SP-7003', `${abs} is ${size} bytes — past the 256 MB this tool reads`);
  return { abs, name: abs.split(/[\\/]/).pop()!, bytes: new Uint8Array(await readFile(abs)) };
}

/** A failed read's code and detail: the reader's refusal keeps its own code (SP-10xx); anything else is this tool's SP-7004. */
function readFailed(e: unknown, abs: string): [SpCode, string] {
  const err = e as Error & { spCode?: SpCode; spDetail?: string };
  return err.spCode ? [err.spCode, err.spDetail ?? err.message] : ['SP-7004', `${abs}: ${err.message}`];
}

/** Reads a workbook from a path the agent gives — `.xlsx` or `.csv`, nothing else (SR-LAW-3). */
export async function loadWorkbook(path: string): Promise<ImportedWorkbook> {
  const { abs, name, bytes } = await readWorkbook(path);
  try { return await read(bytes, { name }); } catch (e) { throw new ToolError(...readFailed(e, abs)); }
}

type Kind = 'empty' | 'text' | 'number' | 'integer' | 'date' | 'boolean';
const DATE_CODE = /[dmyhs]/i;
function isDateCode(code: string | undefined): boolean {
  if (!code || code === 'General') return false;
  const bare = code.replace(/"[^"]*"/g, '').replace(/\\./g, '').replace(/\[[^\]]*\]/g, '').replace(/_./g, '').replace(/\*./g, '');
  return DATE_CODE.test(bare);
}

const a1 = (r: number, c: number) => { let s = '', n = c + 1; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - 1 - m) / 26; } return `${s}${r + 1}`; };

function kindOf(wb: ImportedWorkbook, s: ImportedSheet, r: number, c: number): Kind {
  const v = s.rows[r]?.[c];
  if (v === null || v === undefined || v === '') return 'empty';
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'string') return 'text';
  const xf = s.styleIndex[a1(r, c)];
  if (xf !== undefined) {
    const id = wb.styles.cellXfs[xf]?.numFmtId ?? 0;
    if (isDateCode(wb.styles.numFmts[id] ?? BUILTIN_FORMATS[id])) return 'date';
  }
  return Number.isInteger(v) ? 'integer' : 'number';
}

/** The header row guess: the first of the top ten rows whose filled cells are all text, two or more of them, with a row below it. */
export function guessHeaderRow(s: ImportedSheet): number {
  const top = Math.min(10, s.rows.length - 1);
  for (let r = 0; r < top; r++) {
    const row = s.rows[r] ?? [];
    const filled = row.filter((v) => v !== null && v !== undefined && v !== '');
    if (filled.length >= 2 && filled.every((v) => typeof v === 'string')) return r + 1;
  }
  return 1;
}

interface ColumnInfo { column: string; title: string; type: Kind | 'mixed'; blanks: number; distinct: number; values?: string[] }

/** One column below the header row: its title, inferred type, blanks, and up to 12 distinct values. */
function columnInfo(wb: ImportedWorkbook, s: ImportedSheet, headerRow: number, c: number): ColumnInfo {
  const title = (s.text[headerRow - 1]?.[c] ?? String(s.rows[headerRow - 1]?.[c] ?? '')).trim();
  const kinds = new Set<Kind>();
  const seen = new Set<string>();
  let blanks = 0;
  for (let r = headerRow; r < s.rows.length; r++) {
    const k = kindOf(wb, s, r, c);
    if (k === 'empty') { blanks++; continue; }
    kinds.add(k);
    if (seen.size <= 12) seen.add(s.text[r]?.[c] ?? String(s.rows[r]?.[c]));
  }
  if (kinds.has('integer') && kinds.has('number')) kinds.delete('integer');
  const type: ColumnInfo['type'] = kinds.size === 0 ? 'empty' : kinds.size === 1 ? [...kinds][0]! : 'mixed';
  return { column: a1(0, c).replace(/\d+$/, ''), title, type, blanks, distinct: seen.size > 12 ? 13 : seen.size, ...(seen.size <= 12 ? { values: [...seen].sort() } : {}) };
}

/** The plugins a workbook would use: the feature is in the file, so the plugin shows it. */
function pluginsFor(wb: ImportedWorkbook): string[] {
  const out = new Set<string>();
  const ids = new Set<number>();
  for (const s of wb.sheets) for (const xf of Object.values(s.styleIndex)) ids.add(xf);
  for (const xf of ids) {
    const x = wb.styles.cellXfs[xf];
    if (!x) continue;
    if (x.numFmtId !== 0) out.add('numfmt');
    if (x.fontId !== 0 || x.fillId !== 0 || x.borderId !== 0 || x.alignment) out.add('styles');
  }
  for (const s of wb.sheets) {
    if (Object.keys(s.formulas).length) out.add('formulas');
    if (s.dataValidations.length) out.add('validation');
    if (s.conditionalFormats.length) out.add('condfmt');
    if (s.drawings.some((d) => d.kind === 'picture')) out.add('images');
    if (s.drawings.some((d) => d.kind === 'chart')) out.add('charts');
    if (s.notes.length || s.threadedComments.length) out.add('comments');
  }
  return [...out].sort().map((p) => `@sheetpane/${p}`);
}

/** Sheets, sizes, header-row guess, titles, column types, merges and the plugins it would use. */
export async function inspectWorkbook(path: string): Promise<Record<string, unknown>> {
  const wb = await loadWorkbook(path);
  return {
    file: path,
    format: wb.source,
    ...(wb.delimiter ? { delimiter: wb.delimiter } : {}),
    activeSheet: wb.sheets[wb.activeSheet]?.name,
    plugins: pluginsFor(wb),
    sheets: wb.sheets.map((s) => {
      const cols = s.rows.reduce((m, r) => Math.max(m, r.length), 0);
      const headerRow = guessHeaderRow(s);
      return {
        name: s.name,
        ...(s.hidden ? { hidden: true } : {}),
        rows: s.rows.length,
        columns: cols,
        ...(s.rows.length && cols ? { dimension: `A1:${a1(s.rows.length - 1, cols - 1)}` } : {}),
        headerRow,
        columnsInfo: Array.from({ length: cols }, (_, c) => columnInfo(wb, s, headerRow, c)),
        merges: s.merges ?? [],
        ...(s.freeze.rows || s.freeze.cols ? { freeze: s.freeze } : {}),
        formulas: Object.keys(s.formulas).length,
        dataValidations: s.dataValidations.length,
        conditionalFormats: s.conditionalFormats.length,
        pictures: s.drawings.filter((d) => d.kind === 'picture').length,
        charts: s.drawings.filter((d) => d.kind === 'chart').length,
        notes: s.notes.length + s.threadedComments.length,
      };
    }),
  };
}

// ── rules files (W-33) ─────────────────────────────────────────────────────

/** A rules file drafted from a sheet's headers and inferred types — always a draft to review. */
export async function draftRules(path: string, sheet?: string): Promise<Record<string, unknown>> {
  const wb = await loadWorkbook(path);
  const pick = sheet === undefined ? wb.sheets : wb.sheets.filter((s) => s.name === sheet);
  if (!pick.length) throw new ToolError('SP-7005', `No sheet is named “${sheet}” — the sheets are ${wb.sheets.map((s) => `“${s.name}”`).join(', ')}`);
  const sheets: Record<string, unknown> = {};
  const notes: string[] = [];
  for (const s of pick) {
    const headerRow = guessHeaderRow(s);
    const cols = s.rows.reduce((m, r) => Math.max(m, r.length), 0);
    const columns: Record<string, ColumnRule> = {};
    for (let c = 0; c < cols; c++) {
      const info = columnInfo(wb, s, headerRow, c);
      if (!info.title) { if (info.type !== 'empty') notes.push(`“${s.name}” column ${info.column} has no title in row ${headerRow} — no rule drafted`); continue; }
      if (columns[info.title]) { notes.push(`“${s.name}” has two columns titled “${info.title}” — only the first gets a rule`); continue; }
      const r: ColumnRule = {};
      if (info.blanks === 0 && info.type !== 'empty') r.required = true;
      if (info.type !== 'empty' && info.type !== 'mixed') r.type = info.type;
      if (info.type === 'text' && info.values && info.values.length >= 2 && info.values.length <= 12 && s.rows.length - headerRow > info.values.length) r.oneOf = info.values;
      if (info.type === 'mixed') notes.push(`“${s.name}” column “${info.title}” mixes types — no type drafted`);
      columns[info.title] = r;
    }
    sheets[s.name] = { ...(headerRow !== 1 ? { headerRow } : {}), columns };
  }
  return {
    draft: true,
    note: 'A draft from the file as it is — review every rule before using it: a column with no blanks today may allow them, and oneOf lists only the values seen.',
    rules: { $schema: 'https://unpkg.com/@sheetpane/grid/rules.schema.json', version: 1, sheets },
    ...(notes.length ? { notes } : {}),
  };
}

/** How many failing cells `check_rules` lists; `findingCount` gives them all. */
const FINDINGS = 50;

/**
 * A rules file checked the way the grid checks it and, given a workbook, checked against it by the
 * pane's own `check()` (W-54, no third copy): the notes about the workbook (a sheet or title the
 * rules name that it lacks, a duplicate title) and the cells that fail.
 */
export async function checkRules(json: unknown, path?: string): Promise<Record<string, unknown>> {
  let doc = json;
  if (typeof json === 'string') {
    try { doc = JSON.parse(json); } catch (e) { return { ok: false, problems: [{ code: 'SP-6011', message: `The rules file is not JSON — ${(e as Error).message}` }] }; }
  }
  const { sheets, problems } = checkDocument(doc);
  const out: { code: string; sheet?: string; found?: string; message: string }[] = problems.map((p) => ({ ...p }));
  const rules: { sheet: string; target: string; rule: string }[] = [];
  for (const [name, d] of sheets) {
    for (const [title, r] of Object.entries(d.columns)) rules.push({ sheet: name, target: `column “${title}”`, rule: describeRule(r) });
    for (const [ref, r] of Object.entries(d.cells)) rules.push({ sheet: name, target: `cell ${ref}`, rule: describeRule(r) });
  }
  let findings: Record<string, unknown> = {};
  if (path !== undefined) {
    const { abs, name, bytes } = await readWorkbook(path);
    let errors: SheetpaneError[];
    try { errors = await check(bytes, { name, rules: doc }); } catch (e) { throw new ToolError(...readFailed(e, abs)); }
    // a note carries its SP code; the rules file's own problems are already listed — the rest are the workbook's
    const own = new Set(problems.map((p) => `${p.code}|${p.message}`));
    for (const e of errors) if (e.code && !own.has(`${e.code}|${e.message}`)) out.push({ code: e.code, sheet: e.sheet, found: e.found, message: e.message });
    const failing = errors.filter((e) => !e.code);
    findings = { findingCount: failing.length, findings: failing.slice(0, FINDINGS).map((e) => ({ sheet: e.sheet, range: e.range, type: e.type, severity: e.severity, found: e.found, expected: e.expected, message: e.message })) };
  }
  return { ok: out.length === 0, problems: out.map((p) => ({ ...p, url: codeUrl(p.code as SpCode) })), rules, ...findings };
}

// ── error codes (W-40) ─────────────────────────────────────────────────────

let errorsDoc: string | undefined;
/** docs/ERRORS.md as shipped in this package's dist (copied at build), else the repo's. */
function errorsText(): string {
  if (errorsDoc !== undefined) return errorsDoc;
  for (const p of [join(here, 'ERRORS.md'), join(here, '../../../docs/ERRORS.md')]) if (existsSync(p)) return (errorsDoc = readFileSync(p, 'utf8').replace(/\r\n/g, '\n')); // a Windows checkout has CRLF
  throw new ToolError('SP-7007', 'docs/ERRORS.md is missing from this install');
}

/** The docs entry for an SP code: title, severity, meaning, likely cause, fix and link. */
export function explainCode(code: string): Record<string, unknown> {
  const c = code.trim().toUpperCase().replace(/^SP(\d)/, 'SP-$1');
  if (!(c in CODES)) {
    const near = Object.keys(CODES).filter((k) => k.slice(0, 5) === c.slice(0, 5)).slice(0, 8);
    throw new ToolError('SP-7006', `${code} is not a sheetpane code. Codes look like SP-1001${near.length ? `; nearby: ${near.join(', ')}` : ''}`);
  }
  const info = CODES[c as SpCode];
  const text = errorsText();
  const start = text.indexOf(`\n### ${c}\n`);
  const body = start < 0 ? '' : text.slice(start + 1, text.indexOf('\n### ', start + 5) < 0 ? text.indexOf('\n---', start) : Math.min(...[text.indexOf('\n### ', start + 5), text.indexOf('\n---', start)].filter((i) => i > 0)));
  const field = (label: string) => new RegExp(String.raw`- \*\*${label}:\*\* (.*)`).exec(body)?.[1]?.trim();
  return {
    code: c,
    title: info.title,
    severity: info.severity,
    ...(info.retired ? { retired: true } : {}),
    meaning: field('Meaning'),
    cause: field('Likely cause'),
    fix: field('Fix'),
    url: codeUrl(c as SpCode),
  };
}

// ── skills (W-35) ──────────────────────────────────────────────────────────

interface Skill { name: string; description: string; path: string }
let skillList: Skill[] | undefined;
function skills(): Skill[] {
  if (skillList) return skillList;
  const root = join(dirname(require.resolve('@sheetpane/skills/package.json')), 'skills');
  skillList = readdirSync(root).sort().map((name) => {
    const text = readFileSync(join(root, name, 'SKILL.md'), 'utf8');
    const description = /^description:\s*(.*)$/m.exec(text)?.[1]?.replace(/^["']|["']$/g, '').trim() ?? '';
    return { name, description, path: `node_modules/@sheetpane/skills/skills/${name}/SKILL.md` };
  });
  return skillList;
}

const STOP = new Set(['a', 'an', 'the', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'with', 'how', 'do', 'i', 'my', 'is', 'it', 'use', 'using', 'sheetpane', 'not', 'when', 'what', 'into', 'from', 'this', 'that', 'want', 'need', 'can']);
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9.]+/).filter((w) => w.length > 1 && !STOP.has(w)).map((w) => w.replace(/(ing|es|s)$/, ''));

/** The skills whose names and descriptions share the most words with the task — no model. */
export function findSkill(task: string): Record<string, unknown> {
  const want = new Set(words(task));
  if (!want.size) throw new ToolError('SP-7001', 'Describe the task in a few words, e.g. "validate columns from a JSON file"');
  const scored = skills().map((s) => {
    // a "Not for…" clause names what the skill is not for: its words do not count
    const own = s.description.split(/\bNot\b/)[0]!;
    const hay = words(`${s.name.replace(/^sheetpane-?/, '')} ${own}`);
    const nameWords = new Set(words(s.name.replace(/^sheetpane-?/, '').replace(/-/g, ' ')));
    let score = 0;
    for (const w of new Set(hay)) if (want.has(w)) score += nameWords.has(w) ? 3 : 1;
    return { ...s, score };
  }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const best = scored.slice(0, 3);
  return best.length
    ? { matches: best.map(({ name, description, path, score }) => ({ name, path, description, score })) }
    : { matches: [], hint: 'No skill matched. Start with the "sheetpane" skill — it routes to the rest.', start: skills().find((s) => s.name === 'sheetpane')?.path };
}

// ── the list ───────────────────────────────────────────────────────────────

const pathProp = { type: 'string', description: 'Path to an .xlsx or .csv file, absolute or relative to where the server runs.' };

/** The tools, in the order `tools/list` gives them. */
export const TOOLS: Tool[] = [
  {
    name: 'describe_api',
    title: 'Describe sheetpane API',
    description: 'Look up one name of sheetpane\'s public API — an element (sheetpane-excel), attribute, property, method, event (sheetpane-change), CSS custom property (--sp-*), slot, CSS part or plugin — and get its entry from the custom-elements manifest, its TSDoc and the record that specifies it. Use this before writing an attribute or event name instead of guessing.',
    inputSchema: { $schema: SCHEMA, type: 'object', properties: { name: { type: 'string', description: 'The name to look up, e.g. "flagging", "sheetpane-export", "--sp-accent", "exportFile", "@sheetpane/charts".' } }, required: ['name'], additionalProperties: false },
    run: async (a) => JSON.stringify(describeApi(str(a, 'name')!), null, 2),
  },
  {
    name: 'inspect_workbook',
    title: 'Inspect a workbook',
    description: 'Read an .xlsx or .csv file and report its sheets, sizes, header-row guess, column titles, inferred column types (text, number, integer, date, boolean, mixed), blanks, distinct values, merges, and which @sheetpane plugins the file would use. Read-only.',
    inputSchema: { $schema: SCHEMA, type: 'object', properties: { path: pathProp }, required: ['path'], additionalProperties: false },
    run: async (a) => JSON.stringify(await inspectWorkbook(str(a, 'path')!), null, 2),
  },
  {
    name: 'draft_rules',
    title: 'Draft a rules file',
    description: 'Draft a sheetpane rules file (the JSON <sheetpane-excel rules-src> loads) from a workbook: one rule per titled column — required where the column has no blanks, its inferred type, and oneOf for a text column with 2–12 distinct values. Always a draft for a person to review.',
    inputSchema: { $schema: SCHEMA, type: 'object', properties: { path: pathProp, sheet: { type: 'string', description: 'Only this sheet; every sheet when omitted.' } }, required: ['path'], additionalProperties: false },
    run: async (a) => JSON.stringify(await draftRules(str(a, 'path')!, str(a, 'sheet', false)), null, 2),
  },
  {
    name: 'check_rules',
    title: 'Check a rules file',
    description: 'Check a sheetpane rules file exactly as the grid does (unknown keys and rule words, bad types, patterns, ranges, version), and list each rule in words. With a workbook path, also run the rules over the workbook as the pane does on load: the sheets and column titles the rules name that the workbook lacks, and the cells that fail (the first 50; findingCount counts them all).',
    inputSchema: { $schema: SCHEMA, type: 'object', properties: { rules: { description: 'The rules file: its JSON text, or the parsed object.', type: ['string', 'object'] }, path: pathProp }, required: ['rules'], additionalProperties: false },
    run: async (a) => {
      if (a.rules === undefined) throw new ToolError('SP-7001', '“rules” is required: the rules file\'s JSON text or object');
      return JSON.stringify(await checkRules(a.rules, str(a, 'path', false)), null, 2);
    },
  },
  {
    name: 'explain_code',
    title: 'Explain an SP code',
    description: 'Explain a sheetpane error code (SP-1001 … SP-6025) from its docs entry: title, severity, meaning, likely cause, fix and the link to the docs.',
    inputSchema: { $schema: SCHEMA, type: 'object', properties: { code: { type: 'string', description: 'The code, e.g. "SP-1002".', pattern: '^[Ss][Pp]-?\\d{4}$' } }, required: ['code'], additionalProperties: false },
    run: async (a) => JSON.stringify(explainCode(str(a, 'code')!), null, 2),
  },
  {
    name: 'find_skill',
    title: 'Find the sheetpane skill',
    description: 'Name the sheetpane agent skill for a task (embedding, React, column rules, a rules file, theming, testing, plugins…) by matching its words against the skills\' names and descriptions. Returns up to three, best first, with the SKILL.md path to read.',
    inputSchema: { $schema: SCHEMA, type: 'object', properties: { task: { type: 'string', description: 'The task in a few words.' } }, required: ['task'], additionalProperties: false },
    run: async (a) => JSON.stringify(findSkill(str(a, 'task')!), null, 2),
  },
];

/** Runs one tool. A ToolError or a failed read is the tool's error, never the server's. */
export async function callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const tool = TOOLS.find((t) => t.name === name)!;
  try {
    return { content: [{ type: 'text', text: await tool.run(args ?? {}) }] };
  } catch (e) {
    return { content: [{ type: 'text', text: e instanceof ToolError ? e.message : `${name} failed: ${(e as Error).message}` }], isError: true };
  }
}
