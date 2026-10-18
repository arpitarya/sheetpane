// W-40 — stable error codes. Scans every package's src for a throw, a console
// warning or error, and a rules-engine note without a registered SP code; checks
// docs/ERRORS.md has an entry per code and its generated index is current; and
// checks no code ever issued has left the registry (test/error-codes.lock.json is
// append-only: a new code is added there, a dead one is marked `retired`).
//
// Rewrite the doc's index after adding a code:
//   SP_WRITE_ERRORS_DOC=1 pnpm exec vitest run --project repo test/error-codes.test.ts
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { CODES, codeOf, codeUrl, ERRORS_DOC_URL, spError, spMessage, type SpCode } from '@sheetpane/export';
import { checkDocument } from '../packages/grid/src/pane/rules.ts';

const root = join(import.meta.dirname, '..');
const DOC = join(root, 'docs', 'ERRORS.md');
const LOCK: string[] = JSON.parse(readFileSync(join(import.meta.dirname, 'error-codes.lock.json'), 'utf8'));
const codes = Object.keys(CODES) as SpCode[];

// Another session owns these; they are not shipped packages' error paths.
const SKIP = new Set(['fixtures', 'testing']);
/** Which ranges a package may raise (the registry file itself is excluded). */
const RANGES: Record<string, RegExp> = {
  import: /^SP-1/, export: /^SP-2/, grid: /^SP-[346]/,
  numfmt: /^SP-51/, formulas: /^SP-52/, styles: /^SP-53/, validation: /^SP-54/, condfmt: /^SP-55/, images: /^SP-56/, charts: /^SP-57/, comments: /^SP-58/,
  mcp: /^SP-7/,
};

/** A throw whose expression starts like this carries a code by construction. */
const CODED = [
  'spError(', // the helper: `code` and `spCode`
  'new ExportError(', // typed reason → EXPORT_SP_CODES
  'new ImportError(', // typed reason → importSpCode
  'cfbRefusal(', // returns an ImportError
  'tooBig(', // returns an ImportError
];

/** Genuine internal re-throws: each names its reason. Matched on the file and the start of the thrown expression. */
const ALLOW_THROW: { file: string; expr: string; reason: string }[] = [
  { file: 'packages/export/src/deflate.ts', expr: 'e;', reason: 'rethrows an ExportError (guarded by instanceof), which already carries its code' },
  { file: 'packages/import/src/xlsx.ts', expr: 'e;', reason: 'mapZipError: an error that is not an ExportError is an internal failure, rethrown unchanged' },
  { file: 'packages/formulas/src/model.ts', expr: 'e;', reason: 'loadEngine rethrows the engine failure after clearing its cache; the caller logs SP-5202 or SP-5201' },
];
const ALLOW_CONSOLE: { file: string; expr: string; reason: string }[] = [];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

/** Comments blanked out (newlines kept, so line numbers hold); `//` after `:` (a URL) is not a comment. */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1');
}

const pkgs = readdirSync(join(root, 'packages')).filter((d) => !SKIP.has(d) && existsSync(join(root, 'packages', d, 'src')));
const files = pkgs.flatMap((pkg) => walk(join(root, 'packages', pkg, 'src')).map((path) => ({ pkg, path, rel: relative(root, path), src: code(readFileSync(path, 'utf8')) })));
const lineOf = (src: string, i: number) => src.slice(0, i).split('\n').length;

describe('W-40 — every message in src carries a registered code', () => {
  it('scans every package', () => {
    expect(pkgs).toEqual(expect.arrayContaining(['export', 'import', 'grid', 'numfmt', 'formulas', 'comments', 'charts']));
    expect(files.length).toBeGreaterThan(50);
  });

  it('every throw is coded (or an allow-listed internal re-throw)', () => {
    const bad: string[] = [];
    const used = new Set<(typeof ALLOW_THROW)[number]>();
    let seen = 0;
    for (const f of files) {
      for (const m of f.src.matchAll(/\bthrow\s+/g)) {
        seen++;
        const expr = f.src.slice(m.index + m[0].length, m.index + m[0].length + 200);
        if (CODED.some((c) => expr.startsWith(c))) continue;
        const allow = ALLOW_THROW.find((a) => a.file === f.rel && expr.startsWith(a.expr));
        if (allow) { used.add(allow); continue; }
        bad.push(`${f.rel}:${lineOf(f.src, m.index)} throw ${expr.split('\n')[0]}`);
      }
    }
    expect(seen).toBeGreaterThan(80);
    expect(bad).toEqual([]);
    expect(ALLOW_THROW.filter((a) => !used.has(a)).map((a) => a.file), 'stale allow-list entries').toEqual([]);
  });

  it('every console.warn and console.error starts with spMessage(…) — the code first, the docs link last', () => {
    const bad: string[] = [];
    let seen = 0;
    for (const f of files) {
      for (const m of f.src.matchAll(/\bconsole\.(warn|error)\(\s*/g)) {
        seen++;
        const expr = f.src.slice(m.index + m[0].length, m.index + m[0].length + 200);
        if (expr.startsWith('spMessage(')) continue;
        if (ALLOW_CONSOLE.some((a) => a.file === f.rel && expr.startsWith(a.expr))) continue;
        bad.push(`${f.rel}:${lineOf(f.src, m.index)} ${m[0]}${expr.split('\n')[0]}`);
      }
    }
    expect(seen).toBeGreaterThan(5);
    expect(bad).toEqual([]);
  });

  it('every SP code named in src is registered, and in its package’s range', () => {
    const bad: string[] = [];
    for (const f of files) {
      if (f.rel === 'packages/export/src/codes.ts') continue;
      for (const m of f.src.matchAll(/'(SP-\d{4})'/g)) {
        const c = m[1]!;
        if (!(c in CODES)) bad.push(`${f.rel}:${lineOf(f.src, m.index)} ${c} is not registered`);
        else if (!RANGES[f.pkg]?.test(c)) bad.push(`${f.rel}:${lineOf(f.src, m.index)} ${c} is outside ${f.pkg}'s range`);
        else if (CODES[c as SpCode].retired) bad.push(`${f.rel}:${lineOf(f.src, m.index)} ${c} is retired`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('every live code is raised somewhere (a dead one is marked retired, never removed)', () => {
    const all = files.filter((f) => f.rel !== 'packages/export/src/codes.ts').map((f) => f.src).join('\n');
    expect(codes.filter((c) => !CODES[c].retired && !all.includes(`'${c}'`))).toEqual([]);
  });

  it('every note the rules engine creates names its code (rules.ts)', () => {
    const f = files.find((x) => x.rel === 'packages/grid/src/pane/rules.ts')!;
    // this.note(code, …) — every call passes a literal code or a problem's code
    const calls = [...f.src.matchAll(/this\.note\(([^,]+),/g)].map((m) => m[1]!.trim());
    expect(calls.length).toBeGreaterThan(5);
    expect(calls.filter((a) => !/^'SP-6\d{3}'$/.test(a) && a !== 'p.code')).toEqual([]);
    // the one place a note draft is built carries `code`
    const drafts = [...f.src.matchAll(/severity: 'note'[^}]*\}/g)].map((m) => m[0]);
    expect(drafts.length).toBe(1);
    expect(drafts[0]).toMatch(/\bcode\b/);
    // checkDocument: every problem object names a code
    const body = f.src.slice(f.src.indexOf('export function checkDocument'), f.src.indexOf('export function describeRule'));
    const problems = [...body.matchAll(/\{ (?:code: '(SP-6\d{3})', )?[^{]*?found:/g)];
    expect(problems.length).toBeGreaterThan(10);
    expect(problems.filter((m) => !m[1]).map((m) => m[0])).toEqual([]);
  });

  it('a rules file’s problems each carry a registered 6xxx note code (run, not scanned)', () => {
    const docs: unknown[] = [
      42, { __error: 'HTTP 404' }, { version: 2 }, { version: 1 },
      { version: 1, extra: 1, sheets: { S: 1, T: { bogus: 1, headerRow: 0, columns: { A: 5, B: { typo: 1, type: 'float', pattern: '(', oneOf: 'x' } }, cells: { 'not a ref': {} } } } },
    ];
    const seen = new Set<string>();
    for (const d of docs) for (const p of checkDocument(d).problems) {
      expect(p.code in CODES, p.message).toBe(true);
      expect(CODES[p.code].severity, p.code).toBe('note');
      seen.add(p.code);
    }
    expect([...seen].sort()).toEqual(['SP-6010', 'SP-6011', 'SP-6012', 'SP-6013', 'SP-6014', 'SP-6015', 'SP-6016', 'SP-6017', 'SP-6018', 'SP-6019', 'SP-6020', 'SP-6021']);
  });
});

describe('W-40 — the registry and the helper', () => {
  it('codes are SP- and four digits, in a known range; 4xxx and 7xxx hold none yet', () => {
    for (const c of codes) expect(c).toMatch(/^SP-[1-7]\d{3}$/);
    expect(codes.filter((c) => /^SP-[47]/.test(c))).toEqual([]);
  });
  it('no code ever issued leaves the registry; a new code is added to the lock', () => {
    expect(LOCK.filter((c) => !(c in CODES)), 'removed from the registry — mark it retired instead').toEqual([]);
    expect(codes.filter((c) => !LOCK.includes(c)), 'append the new code to test/error-codes.lock.json').toEqual([]);
    expect(new Set(LOCK).size).toBe(LOCK.length);
  });
  it('titles are short and carry no em dash (the message separator)', () => {
    for (const c of codes) { expect(CODES[c].title.length, c).toBeLessThanOrEqual(60); expect(CODES[c].title, c).not.toMatch(/—/); }
  });
  it('spError and spMessage: the code first, the human text kept, the docs link last', () => {
    const e = spError('SP-3002', 'sheetpane: no plugin "x" is registered');
    expect(e.message).toBe(`SP-3002: Unknown plugin — sheetpane: no plugin "x" is registered (${ERRORS_DOC_URL}#sp-3002)`);
    expect(e).toMatchObject({ code: 'SP-3002', spCode: 'SP-3002', spDetail: 'sheetpane: no plugin "x" is registered' });
    expect(spError('SP-2101', 'x', TypeError)).toBeInstanceOf(TypeError);
    expect(spMessage('SP-3001')).toBe(`SP-3001: Nothing is loaded to export (${codeUrl('SP-3001')})`);
    expect(codeUrl('SP-6023')).toBe('https://github.com/arpitarya/sheetpane/blob/main/docs/ERRORS.md#sp-6023');
    expect(codeOf(e)).toBe('SP-3002');
    expect(codeOf({ code: 'corrupt', spCode: 'SP-1007' })).toBe('SP-1007');
    expect(codeOf({ code: 'SP-6023' })).toBe('SP-6023');
    expect(codeOf({ code: 'SP-9999' })).toBeUndefined();
    expect(codeOf(new Error('x'))).toBeUndefined();
  });
});

// ── docs/ERRORS.md ─────────────────────────────────────────────────────────
const INDEX_START = /<!-- index:start[^>]*-->\n/;
const INDEX_END = '<!-- index:end -->';

/** The generated index: one row per code, in registry order. */
function renderIndex(): string {
  const rows = codes.map((c) => `| [${c}](#${c.toLowerCase()}) | ${CODES[c].title}${CODES[c].retired ? ' (retired)' : ''} | ${CODES[c].severity} |`);
  return ['| code | title | severity |', '|---|---|---|', ...rows].join('\n') + '\n';
}

describe('W-40 — docs/ERRORS.md', () => {
  const doc = readFileSync(DOC, 'utf8');

  it('its index is the one generated from the registry', () => {
    const start = INDEX_START.exec(doc);
    const end = doc.indexOf(INDEX_END);
    expect(start && end > start.index, 'index markers').toBe(true);
    const at = start!.index + start![0].length;
    const want = renderIndex();
    if (process.env.SP_WRITE_ERRORS_DOC && doc.slice(at, end) !== want) writeFileSync(DOC, doc.slice(0, at) + want + doc.slice(end));
    else expect(doc.slice(at, end)).toBe(want);
  });

  it('has exactly one entry per registered code, and none for a code the registry lacks', () => {
    const heads = [...doc.matchAll(/^### (SP-\d{4})$/gm)].map((m) => m[1]!);
    expect(codes.filter((c) => !heads.includes(c)), 'codes with no docs entry').toEqual([]);
    expect(heads.filter((h) => !(h in CODES)), 'docs entries for unknown codes').toEqual([]);
    expect(heads.length).toBe(new Set(heads).size);
  });

  it.each(codes)('%s: title, severity, record, meaning, likely cause, fix', (c) => {
    const from = doc.indexOf(`### ${c}\n`);
    const next = doc.slice(from + 4).search(/^#{2,3} /m);
    const entry = doc.slice(from, next < 0 ? undefined : from + 4 + next);
    const head = entry.split('\n').find((l) => l.startsWith('**'))!;
    expect(head, 'the title line').toBeDefined();
    expect(head.startsWith(`**${CODES[c].title}** · ${CODES[c].severity}`), head).toBe(true);
    if (CODES[c].retired) expect(head).toMatch(/retired/);
    const records = [...head.matchAll(/\]\((\.\.\/records\/[^)]+\.md)\)/g)].map((m) => m[1]!);
    expect(records.length, 'the record it comes from').toBeGreaterThan(0);
    for (const r of records) expect(existsSync(resolve(dirname(DOC), r)), r).toBe(true);
    for (const field of ['Meaning', 'Likely cause', 'Fix']) expect(entry, field).toMatch(new RegExp(`^- \\*\\*${field}:\\*\\* \\S`, 'm'));
  });

  it('names no font family (SR-LAW-5)', () => {
    expect(doc).not.toMatch(/font-family\s*:/);
  });
});
