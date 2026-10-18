// W-37: custom-elements.json is the elements' contract in machine form, so it cannot drift: its
// attributes are what each element observes (plus `theme`, read by CSS — see below), its events are
// what the element sources dispatch, its CSS properties are the tokens; the committed manifest and
// framework typings are what scripts/build-manifest.mjs writes today; each framework typing
// type-checks a usage (test/types — real React; Vue, Svelte and Solid against stubs, not installed).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error — a plain .mjs script without types
import { cssProperties, elementSources, generate } from '../scripts/build-manifest.mjs';

const root = join(import.meta.dirname, '..');
const GRID = join(root, 'packages/grid');
const tsc = join(root, 'node_modules/.bin/tsc');
const src = (p: string) => readFileSync(join(GRID, 'src', `${p}.ts`), 'utf8');
const observed = (s: string) => JSON.parse(/observedAttributes = (\[[^\]]*\])/.exec(s)![1]!.replace(/'/g, '"')) as string[];

interface Decl { tagName: string; name: string; attributes: { name: string; fieldName?: string; type: { text: string } }[]; members: { kind: string; name: string }[]; events: { name: string; type: { text: string } }[]; cssProperties: { name: string; default: string }[]; cssParts: { name: string }[]; slots: { name: string }[] }
const committed = JSON.parse(readFileSync(join(GRID, 'custom-elements.json'), 'utf8')) as { schemaVersion: string; modules: { path: string; declarations: Decl[]; exports: { kind: string; name: string }[] }[] };
const elements = (elementSources() as { tag: string; name: string; path: string }[]).map((e) => ({ ...e, src: src(e.path), decl: committed.modules.find((m) => m.path === `dist/${e.path}.js`)?.declarations[0] }));

// Attributes the element reads without observing them: `theme` is styled by `:host([theme=…])` alone
// (SR-GRID decision 15a), so it is in the manifest and in no observedAttributes list. Each one must
// show up in an attribute selector, or it would do nothing.
const READ_BY_CSS = ['theme'];

let files: Record<string, string> = {};
let dts = '';
beforeAll(() => {
  // the declarations as the build emits them, without needing a build first (`just check` tests before it builds)
  dts = mkdtempSync(join(tmpdir(), 'sp-manifest-'));
  execFileSync(tsc, ['-p', join(GRID, 'tsconfig.build.json'), '--emitDeclarationOnly', '--declarationMap', 'false', '--outDir', dts], { encoding: 'utf8' });
  files = generate({ dts });
}, 120_000);
afterAll(() => { if (dts) rmSync(dts, { recursive: true, force: true }); });

describe('custom-elements.json (W-37)', () => {
  it('is Custom Elements Manifest 2.1.0, one module per element, each exporting its class and its tag', () => {
    expect(committed.schemaVersion).toBe('2.1.0');
    expect(elements.map((e) => e.tag)).toEqual(['sheetpane-excel', 'sheetpane-errors']);
    for (const e of elements) {
      expect(e.decl, e.tag).toBeDefined();
      expect(e.decl!.tagName).toBe(e.tag);
      const exp = committed.modules.find((m) => m.path === `dist/${e.path}.js`)!.exports;
      expect(exp.map((x) => `${x.kind}:${x.name}`)).toEqual([`js:${e.name}`, `custom-element-definition:${e.tag}`]);
    }
  });
  it('package.json points at it and ships it', () => {
    const p = JSON.parse(readFileSync(join(GRID, 'package.json'), 'utf8'));
    expect(p.customElements).toBe('custom-elements.json');
    expect(p.files).toContain('custom-elements.json');
    expect(p['web-types']).toBe('./dist/web-types.json');
  });
  for (const e of elements) {
    describe(`<${e.tag}>`, () => {
      it('attributes = observedAttributes + the ones read by CSS alone', () => {
        const names = e.decl!.attributes.map((a) => a.name);
        expect(names.filter((n) => !observed(e.src).includes(n)).sort()).toEqual(READ_BY_CSS);
        expect(observed(e.src).filter((n) => !names.includes(n))).toEqual([]);
        for (const n of READ_BY_CSS) expect(src('tokens'), n).toContain(`[${n}=`);
      });
      it('every attribute mirrored by a property names it (fieldName), and that field exists', () => {
        for (const a of e.decl!.attributes.filter((x) => x.fieldName)) expect(e.decl!.members.some((m) => m.kind === 'field' && m.name === a.fieldName), a.name).toBe(true);
      });
      it('events = the sheetpane-* names its source dispatches', () => {
        const fired = [...new Set([...e.src.matchAll(/fire\(this, '(sheetpane-[\w-]+)'/g)].map((m) => m[1]!))].sort();
        expect(e.decl!.events.map((x) => x.name).sort()).toEqual(fired);
        for (const ev of e.decl!.events) expect(ev.type.text, ev.name).toMatch(/^CustomEvent<\{.*\}>$|^CustomEvent<Record<string, never>>$/);
      });
      it('members include every property and method its TSDoc lists', () => {
        const doc = /\/\*\*([\s\S]*?)\*\/\s*export class/.exec(e.src)![1]!;
        const listed = (label: string) => [...(new RegExp(`${label}: ([\\s\\S]*?)\\.\\n`).exec(doc)?.[1] ?? '').matchAll(/`(\w+)/g)].map((m) => m[1]!);
        const names = e.decl!.members.map((m) => m.name);
        expect(listed('Properties').filter((n) => !names.includes(n))).toEqual([]);
        expect(listed('Methods').filter((n) => !names.includes(n))).toEqual([]);
      });
      it('CSS parts and slots = the part="…" and <slot name="…"> in its source', () => {
        expect(e.decl!.cssParts.map((p) => p.name).sort()).toEqual([...new Set([...e.src.matchAll(/part="([\w-]+)"/g)].map((m) => m[1]!))].sort());
        expect(e.decl!.slots.map((s) => s.name).sort()).toEqual([...e.src.matchAll(/<slot name="([\w-]+)"/g)].map((m) => m[1]!).sort());
      });
      it('cssProperties = every token in tokens.ts with its default, plus the var() fallbacks', () => {
        const tokens = /export const TOKENS = \{([\s\S]*?)\} as const/.exec(src('tokens'))![1]!;
        const want = [...tokens.matchAll(/(?:'([\w-]+)'|(\w+)):\s*'([^']*)'/g)].map((m) => ({ name: `--sp-${m[1] ?? m[2]}`, default: m[3]! }));
        const got = e.decl!.cssProperties.map((p) => ({ name: p.name, default: p.default }));
        expect(got.slice(0, want.length)).toEqual(want);
        expect(got.slice(want.length).map((p) => p.name)).toEqual(['--sp-cell-font-size']);
        expect(cssProperties()).toHaveLength(got.length);
      });
    });
  }
  it('the committed manifest and framework typings are what the generator writes now (run the grid build)', () => {
    for (const [rel, text] of Object.entries(files)) {
      if (rel.startsWith('dist/')) continue; // built output, not committed
      expect(readFileSync(join(GRID, rel), 'utf8') === text, `${rel} is stale — run \`pnpm --filter @sheetpane/grid build\``).toBe(true);
    }
  });
  it('the editor data names the same tags, attributes and properties', () => {
    const html = JSON.parse(files['dist/vscode.html-custom-data.json']!);
    const wt = JSON.parse(files['dist/web-types.json']!);
    const css = JSON.parse(files['dist/vscode.css-custom-data.json']!);
    for (const e of elements) {
      const tag = html.tags.find((t: { name: string }) => t.name === e.tag);
      expect(tag.attributes.map((a: { name: string }) => a.name)).toEqual(e.decl!.attributes.map((a) => a.name));
      expect(tag.attributes.find((a: { name: string }) => a.name === 'theme').values.map((v: { name: string }) => v.name)).toEqual(['light', 'dark', 'auto']);
      const el = wt.contributions.html.elements.find((x: { name: string }) => x.name === e.tag);
      expect(el.js.events.map((x: { name: string }) => x.name)).toEqual(e.decl!.events.map((x) => x.name));
    }
    expect(css.properties.map((p: { name: string }) => p.name)).toEqual(elements[0]!.decl!.cssProperties.map((p) => p.name));
  });
});

describe('framework typings type-check a usage (W-37 DoD 3, 5)', () => {
  it('React 19 (real @types/react), Vue, Svelte, Solid (stubs) — test/types', () => {
    let out = '';
    try { execFileSync(tsc, ['-p', join(root, 'test/types/tsconfig.json')], { encoding: 'utf8' }); } catch (err) { out = String((err as { stdout?: string }).stdout ?? err); }
    expect(out).toBe('');
  }, 120_000);
});
