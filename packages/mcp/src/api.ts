// describe_api (W-39 DoD 3): a name of the public API → its custom-elements manifest entry (W-37),
// which carries the TSDoc (W-36), and the record that specifies it. Plugins come from a table the
// build writes from each plugin's package.json.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = 'https://github.com/arpitarya/sheetpane/blob/main/';
const RECORD: Record<string, string> = { 'sheetpane-excel': 'records/0105_GRID.md', 'sheetpane-errors': 'records/0106_ERRORS.md' };

/** Reads the first of `dist/<file>` and the workspace copy. */
function data<T>(file: string, workspace: string): T | undefined {
  for (const p of [join(here, file), join(here, workspace)]) if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8')) as T;
  return undefined;
}

interface Entry { name: string; description?: string; summary?: string; [k: string]: unknown }
interface Decl extends Entry { tagName?: string; customElement?: boolean; attributes?: Entry[]; members?: Entry[]; events?: Entry[]; cssProperties?: Entry[]; slots?: Entry[]; cssParts?: Entry[] }
interface Manifest { modules: { path: string; declarations?: Decl[] }[] }
interface PluginInfo { id: string; package: string; description: string; record: string }

let cached: { elements: Decl[]; plugins: PluginInfo[] } | undefined;
function load() {
  if (cached) return cached;
  const m = data<Manifest>('custom-elements.json', '../../grid/custom-elements.json');
  const plugins = data<PluginInfo[]>('plugins.json', '../dist/plugins.json') ?? [];
  cached = { elements: (m?.modules ?? []).flatMap((mod) => mod.declarations ?? []).filter((d) => d.customElement && d.tagName), plugins };
  return cached;
}

const KINDS = [['attributes', 'attribute'], ['members', 'member'], ['events', 'event'], ['cssProperties', 'css-property'], ['slots', 'slot'], ['cssParts', 'css-part']] as const;

/**
 * Looks one name up across the elements and the plugins.
 * @param raw - An element tag, attribute, property, method, event (with or without `on`), `--sp-*` token, slot, part or plugin.
 * @returns Every match with its kind, element, manifest entry and record link; near names when nothing matches.
 */
export function describeApi(raw: string): Record<string, unknown> {
  const { elements, plugins } = load();
  const name = raw.trim().replace(/^<|\/?>$/g, '').replace(/^on(?=sheetpane-)/, '');
  const lower = name.toLowerCase();
  const matches: Record<string, unknown>[] = [];
  for (const d of elements) {
    const record = REPO + (RECORD[d.tagName!] ?? 'records/0105_GRID.md');
    if (d.tagName === lower || d.name === name) {
      matches.push({ kind: 'element', element: d.tagName, class: d.name, summary: d.summary, description: d.description, attributes: d.attributes?.map((a) => a.name), events: d.events?.map((e) => e.name), record });
    }
    for (const [list, kind] of KINDS) {
      for (const e of d[list] ?? []) {
        const hit = e.name === name || (kind === 'attribute' && e.name === lower) || (kind === 'member' && (e as { attribute?: string }).attribute === lower);
        if (hit) {
          const { kind: memberKind, ...rest } = e as Entry & { kind?: string };
          matches.push({ kind, ...(memberKind ? { memberKind } : {}), element: d.tagName, ...rest, record });
        }
      }
    }
  }
  const pid = lower.replace(/^@sheetpane\//, '');
  for (const p of plugins) if (p.id === pid) matches.push({ kind: 'plugin', ...p, use: `<sheetpane-excel plugins="${p.id}"> after import '${p.package}'`, record: REPO + p.record });
  // an element first: `sheetpane-errors` is a tag and an event
  matches.sort((a, b) => Number(b.kind === 'element') - Number(a.kind === 'element'));
  if (matches.length) return { matches };
  if (!elements.length) return { matches: [], error: 'The custom-elements manifest is missing from this install — reinstall @sheetpane/mcp.' };
  const all = new Set<string>([...elements.flatMap((d) => [d.tagName!, ...KINDS.flatMap(([l]) => (d[l] ?? []).map((e) => e.name))]), ...plugins.map((p) => p.package)]);
  // near: a name holding what was asked, or a name (four letters or more, prefix aside) the ask holds
  const near = [...all].filter((n) => { const k = n.toLowerCase(), bare = k.replace(/^--sp-|^sheetpane-|^@sheetpane\//, ''); return (lower.length >= 3 && k.includes(lower)) || (bare.length >= 4 && lower.includes(bare)); }).sort().slice(0, 10);
  return { matches: [], error: `sheetpane has no public name “${raw}”.`, ...(near.length ? { near } : {}) };
}
