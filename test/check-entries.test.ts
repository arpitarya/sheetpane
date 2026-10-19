// W-54 DoD 2 (and W-67 DoD 1, `/static`): the DOM-free entries stay DOM-free. Each entry's import graph is walked from its
// source — relative imports and `@sheetpane/*` ones through their `source` export, `import type`
// left out (erased), every other import kept (verbatimModuleSyntax keeps `import { type X }` as an
// import) — and no file in it may name `customElements`, `document` or `window` as a global, nor
// be an element module. Then both entries are imported here, in Node with no DOM, and run.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const root = join(import.meta.dirname, '..');
const ENTRIES = { '@sheetpane/grid/check': 'packages/grid/src/check.ts', '@sheetpane/validation/check': 'packages/validation/src/check.ts', '@sheetpane/grid/static': 'packages/grid/src/static.ts' };
const BANNED = ['customElements', 'document', 'window'];
/** A banned name used as a global: not a property (`x.document`), an object key or a type member (`document?:`). */
const FREE = new RegExp(String.raw`(?<![.\w$])(${BANNED.join('|')})(?![\w$])(?!\s*\??:)`, 'g');
/** The element modules and the registering entries: none may be reached (the sheet's geometry is pure arithmetic, shared with `/static`). */
const ELEMENT = /^packages\/grid\/src\/(index\.ts|excel\/(?!geometry\.ts$)|errors\/|shared\/dom\.ts|frameworks\/)|^packages\/validation\/src\/(index|ui)\.ts$/;

/** The code with comments, strings and regular expressions blanked, so only code is searched. */
function codeOnly(src: string): string {
  let out = '', i = 0, prev = '';
  const regexAllowed = () => /[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) || prev === '' || /\b(return|typeof|case|in|of|void|delete)$/.test(prev);
  while (i < src.length) {
    const c = src[i]!, d = src[i + 1];
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; out += ' '; continue; }
    if (c === '"' || c === "'" || c === '`') {
      i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') i++;
        else if (c === '`' && src[i] === '$' && src[i + 1] === '{') { // a template's ${…} is code
          let depth = 1, j = i + 2;
          while (j < src.length && depth) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; }
          out += ` ${codeOnly(src.slice(i + 2, j - 1))} `;
          i = j - 1;
        }
        i++;
      }
      i++; out += '""'; prev = '"'; continue;
    }
    if (c === '/' && regexAllowed()) {
      i++;
      let inClass = false;
      while (i < src.length && (src[i] !== '/' || inClass)) { if (src[i] === '\\') i++; else if (src[i] === '[') inClass = true; else if (src[i] === ']') inClass = false; i++; }
      i++; while (/[a-z]/i.test(src[i] ?? '')) i++;
      out += '/r/'; prev = '/'; continue;
    }
    out += c;
    if (!/\s/.test(c)) prev = /[\w$]/.test(c) ? (/[\w$]/.test(prev.slice(-1)) ? prev + c : c) : c;
    i++;
  }
  return out;
}

/** A specifier, resolved: a source file in the repo, or `node:…`, or a third-party name. */
function resolveSpec(from: string, spec: string): string {
  if (spec.startsWith('.')) {
    const p = resolve(dirname(from), spec).replace(/\.js$/, '.ts');
    return existsSync(p) ? p : p.replace(/\.ts$/, '.d.ts');
  }
  const m = /^@sheetpane\/([^/]+)(\/.*)?$/.exec(spec);
  if (m) {
    const pkg = JSON.parse(readFileSync(join(root, 'packages', m[1]!, 'package.json'), 'utf8'));
    const target = pkg.exports[m[2] ? `.${m[2]}` : '.'];
    return join(root, 'packages', m[1]!, typeof target === 'string' ? target : target.source);
  }
  return spec;
}

/** Every file the entry loads at run time, and what each imports from outside the repo. */
function graph(entry: string): { files: string[]; external: string[] } {
  const files = new Set<string>(), external = new Set<string>();
  const visit = (f: string) => {
    if (files.has(f)) return;
    files.add(f);
    const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const specs = [
      ...[...code.matchAll(/^\s*(?:import|export)\s+(type\s+)?(?:[\w$*{},\s]+?\s+from\s+)?['"]([^'"]+)['"]/gm)].filter((x) => !x[1]).map((x) => x[2]!),
      ...[...code.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((x) => x[1]!),
    ];
    for (const s of specs) {
      const r = resolveSpec(f, s);
      if (r.startsWith(root)) visit(r); else external.add(r);
    }
  };
  visit(join(root, entry));
  return { files: [...files].map((f) => relative(root, f).split('\\').join('/')).sort(), external: [...external].sort() };
}

describe('W-54 DoD 2 — the check entries import no DOM', () => {
  it('the code scanner sees code only: comments, strings and regular expressions are blanked', () => {
    expect(codeOnly('a = "document"; // window\n/* customElements */ b = /window/g; c = `x${document}`')).toMatch(/document/);
    expect(codeOnly('a = "document"; // window\n/* customElements */ b = /win"dow/g; c = 1')).not.toMatch(/document|window|customElements/);
    expect(codeOnly('const x = a / b / c; window')).toMatch(/window/);
  });

  for (const [name, entry] of Object.entries(ENTRIES)) {
    it(`${name}: its whole import graph names no customElements, document or window, and holds no element`, () => {
      const { files, external } = graph(entry);
      expect(files).toContain(entry);
      expect(files.filter((f) => ELEMENT.test(f))).toEqual([]);
      expect(external).toEqual([]); // the graph is the repo's own code: no Node built-in, no third party
      const hits: string[] = [];
      for (const f of files) for (const m of codeOnly(readFileSync(join(root, f), 'utf8')).matchAll(FREE)) hits.push(`${f}: ${m[1]}`);
      expect(hits).toEqual([]);
    });
  }

  it('the walk is not vacuous: from the main grid entry it reaches the elements and finds `document`', () => {
    const { files } = graph('packages/grid/src/index.ts');
    expect(files).toContain('packages/grid/src/excel/element.ts');
    expect(files).toContain('packages/grid/src/pane/store.ts');
    expect(codeOnly(readFileSync(join(root, 'packages/grid/src/excel/element.ts'), 'utf8'))).toMatch(new RegExp(FREE.source)); // not FREE itself: test() moves a global regex's lastIndex
  });

  it('both entries import and run in Node with no DOM: a column rule, an async validate, a rules file', async () => {
    expect((globalThis as { customElements?: unknown }).customElements).toBeUndefined();
    expect((globalThis as { document?: unknown }).document).toBeUndefined();
    const grid = await import('../packages/grid/src/check.ts');
    const val = await import('../packages/validation/src/check.ts');
    const csv = new TextEncoder().encode('Account,Units\nAC-10001,5\nAC-1x,7\nAC-10003,-2\n');
    const errors = await grid.check(csv, {
      name: 'h.csv',
      columns: { Account: { pattern: '^AC-\\d{5}$' } },
      validate: async (ctx, signal) => { await new Promise((r) => setTimeout(r, 1)); return !signal.aborted && ctx.column.header === 'Units' && Number(ctx.value) < 0 ? { message: 'negative units' } : null; },
      rules: '{ "version": 1, "sheets": { "Nope": {} } }',
    });
    expect(errors.map((e) => [e.range, e.type, e.severity, e.message])).toEqual([
      ['A1', 'column-rule', 'note', 'No sheet is named “Nope” — its rules are not checked'],
      ['A3', 'column-rule', 'error', 'Account: does not match the expected format (pattern)'],
      ['B4', 'column-rule', 'error', 'negative units'],
    ]);
    expect(errors.every((e) => e.v === 1 && e.author === 'host' && e.status === 'open' && /^ERR-\d{4}$/.test(e.id))).toBe(true);
    // the validation entry: the plugin on, nothing registered by importing it
    expect(grid.registeredPluginIds()).not.toContain('validation');
    expect(typeof val.validation).toBe('function');
    expect(await val.check(csv, { name: 'h.csv' })).toEqual([]); // a CSV holds no <dataValidations>
  }, 30_000); // the first import transforms both graphs from source: seconds on a loaded machine

  it('W-67 DoD 1: /static renders a loaded workbook to one <table> in Node; SP-3017, SP-3018', async () => {
    const { loadWorkbook, renderStatic } = await import('../packages/grid/src/static.ts');
    const book = await loadWorkbook(new TextEncoder().encode('Account,Units\nAC-1,5\n<b>,-2\n'), { name: 'h.csv', columns: { Units: { min: 0 } } });
    const html = renderStatic(book);
    expect(html.startsWith('<table ') && html.endsWith('</table>')).toBe(true);
    expect(html).toContain('data-sp-range="A1:B3"');
    expect(html).toContain('&lt;b&gt;');
    expect(html).toMatch(/data-sp-ref="B3" data-sp-mark="error"/);
    expect(html).not.toMatch(/<script|font-family|url\(/i);
    expect(() => renderStatic({} as never)).toThrow(/^SP-3017: /);
    expect(() => renderStatic(book, { sheet: 'Nope' })).toThrow(/^SP-3018: /);
    expect(() => renderStatic(book, { range: 'h!A1' })).toThrow(/^SP-3018: /);
    expect(() => renderStatic(book, { range: 'A1:XFD1048576' })).toThrow(/^SP-3018: /);
  }, 30_000);

  it('a refusal keeps the reader’s code; bytes are required (SP-3016)', async () => {
    const { check } = await import('../packages/grid/src/check.ts');
    await expect(check(new TextEncoder().encode('PK\u0003\u0004 not a zip'), { name: 'x.xlsx' })).rejects.toThrow(/^SP-10\d\d: /);
    await expect(check('q3.xlsx' as unknown as Uint8Array)).rejects.toThrow(/^SP-3016: /);
  });
});
