// W-36: what each package's published `.d.ts` exports, and the TSDoc each export carries.
// TypeScript 7's JavaScript compiler API is unstable (`typescript/unstable/*`), so this reads the
// built declaration files themselves — what editors, agents and the manifest analyzer read.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

export interface Exported { pkg: string; entry: string; name: string; kind: string; file: string; doc: string | undefined; params: string[]; returnsVoid: boolean; decl: string }

const declRe = (name: string) => new RegExp(String.raw`(\/\*\*(?:(?!\*\/)[\s\S])*\*\/\s*)?(?:export\s+)?(?:declare\s+)?(?:abstract\s+)?(function|class|const|let|var|interface|type|enum)\s+` + name.replace(/\$/g, '\\$') + String.raw`\b([^;{]*)`, 'g');

/** Where an exported name is declared: the file and the name it has there (an alias may differ). */
interface Origin { file: string; orig: string }

// Each file is read once and its exports worked out once. Without this the walk re-read the same
// declarations along every path through the import graph: 109 s, now 0.1 s, the same 513 exports.
const texts = new Map<string, string>();
const read = (file: string): string | undefined => {
  if (!texts.has(file)) texts.set(file, existsSync(file) ? readFileSync(file, 'utf8') : (undefined as unknown as string));
  return texts.get(file);
};
const memo = new Map<string, Map<string, Origin>>();

/** Every exported name reachable from a `.d.ts` file, mapped to its declaration. Follows relative and
 *  `@sheetpane/<pkg>` re-exports, `export *` / `export type *`, aliases, and imported names re-exported. */
function exportsOf(file: string, seen = new Set<string>()): Map<string, Origin> {
  const done = memo.get(file);
  if (done) return done;
  const out = new Map<string, Origin>();
  if (seen.has(file)) return out;
  const text = read(file);
  if (text === undefined) return out;
  // comments out: an @example's `import … from '@sheetpane/…'` is not an import (W-54: grid/check's
  // example imports validation/check, which imports grid/check — a cycle that cut a real re-export)
  const src = text.replace(/\/\*[\s\S]*?\*\//g, '');
  seen.add(file);
  const target = (spec: string) => {
    const pkg = /^@sheetpane\/([\w-]+)(\/[\w-]+)?$/.exec(spec);
    if (!pkg) return resolve(dirname(file), spec.replace(/\.js$/, '.d.ts'));
    const dir = join(file.slice(0, file.lastIndexOf('/packages/') + 10), pkg[1]!);
    if (!pkg[2]) return join(dir, 'dist/index.d.ts');
    // a sub-path entry (`@sheetpane/grid/check`, W-54): its `types` in the package's exports
    const sub = (JSON.parse(read(join(dir, 'package.json')) ?? '{}') as { exports?: Record<string, { types?: string }> }).exports?.[`.${pkg[2]}`]?.types;
    return join(dir, sub ?? `dist${pkg[2]}.d.ts`);
  };
  const names = (list: string) => list.split(',').map((x) => x.trim()).filter(Boolean).map((part) => {
    const [orig, alias] = part.replace(/^type\s+/, '').split(/\s+as\s+/).map((x) => x.trim()) as [string, string?];
    return { orig, alias: alias ?? orig };
  });
  // imported names, so `import { X } from './x.js'; export { X };` resolves to x.d.ts
  const imported = new Map<string, Origin>();
  for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g)) {
    const t = target(m[2]!), sub = exportsOf(t, new Set(seen));
    for (const { orig, alias } of names(m[1]!)) imported.set(alias, sub.get(orig) ?? { file: t, orig });
  }
  for (const m of src.matchAll(/export\s+(type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g)) {
    const t = target(m[3]!), sub = exportsOf(t, new Set(seen));
    for (const { orig, alias } of names(m[2]!)) out.set(alias, sub.get(orig) ?? { file: t, orig });
  }
  for (const m of src.matchAll(/export\s+(?:type\s+)?\*\s+from\s+'([^']+)'/g)) for (const [k, v] of exportsOf(target(m[1]!), new Set(seen))) out.set(k, v);
  for (const m of src.matchAll(/export\s+(?:declare\s+)?(?:abstract\s+)?(?:function|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g)) out.set(m[1]!, { file, orig: m[1]! });
  for (const m of src.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}\s*;/g)) for (const { orig, alias } of names(m[1]!)) out.set(alias, imported.get(orig) ?? { file, orig });
  memo.set(file, out);
  return out;
}

/** A signature's own parameter names — not the names inside a callback or object type it takes. */
function topParams(sig: string): string[] {
  const open = sig.indexOf('(');
  if (open < 0) return [];
  const names: string[] = [];
  let depth = 0, start = open + 1, closed = false;
  const take = (part: string) => { const m = /^\s*(?:\.\.\.)?([A-Za-z_$][\w$]*)\??\s*:/.exec(part); if (m) names.push(m[1]!); };
  for (let i = open + 1; i < sig.length; i++) {
    const ch = sig[i];
    if (ch === '(' || ch === '<' || ch === '[' || ch === '{') depth++;
    else if (ch === '>' && sig[i - 1] === '=') continue; // an arrow, not a closing angle
    else if (ch === ')' || ch === '>' || ch === ']' || ch === '}') { if (depth === 0) { take(sig.slice(start, i)); closed = true; break; } depth--; }
    else if (ch === ',' && depth === 0) { take(sig.slice(start, i)); start = i + 1; }
  }
  if (!closed) take(sig.slice(start)); // the declaration regex stops at a `{`: an object-typed last parameter
  return names;
}

export function walk(root: string, pkgs: string[]): Exported[] {
  const out: Exported[] = [];
  for (const pkg of pkgs) {
    const dir = join(root, 'packages', pkg), manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    for (const [entry, target] of Object.entries<any>(manifest.exports ?? {})) {
      if (typeof target !== 'object' || !target.types) continue;
      const dts = join(dir, target.types);
      for (const [name, { file, orig }] of exportsOf(dts)) {
        const src = read(file) ?? '';
        const m = [...src.matchAll(declRe(orig))][0];
        const doc = m?.[1]?.trim();
        const kind = m?.[2] ?? 'unknown';
        const sig = m?.[3] ?? '';
        const params = kind === 'function' ? topParams(sig) : [];
        const returnsVoid = kind === 'function' && /\)\s*:\s*(void|Promise<void>)\s*$/.test(sig.trim());
        out.push({ pkg, entry, name, kind, file: relative(root, file), doc, params, returnsVoid, decl: sig });
      }
    }
  }
  return out;
}

/** What a doc comment lacks: a summary; `@param` per parameter and `@returns` for a function. */
export function problems(e: Exported, strictFunctions = true): string[] {
  if (!e.doc) return ['no TSDoc'];
  const body = e.doc.replace(/^\/\*\*|\*\/$/g, '').split('\n').map((l) => l.replace(/^\s*\*\s?/, '')).join('\n').trim();
  const summary = body.split(/\n\s*@/)[0]!.trim();
  const out: string[] = [];
  if (!summary) out.push('no summary');
  if (strictFunctions && e.kind === 'function') {
    for (const p of e.params) if (!new RegExp(String.raw`@param\s+${p}\b`).test(body)) out.push(`no @param ${p}`);
    if (!e.returnsVoid && !/@returns?\b/.test(body)) out.push('no @returns');
  }
  return out;
}
