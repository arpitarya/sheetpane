// Registration (plugins verdict decisions 2–3, 5): a package registers its id on
// import; only plugins a pane lists are enabled; the set is fixed per pane.
import { spError } from '@sheetpane/export';
import { SINGLE_PROVIDER, SLOTS, type ControlDescriptor, type Plugin, type StyleSubset } from './types.js';

export type PluginFactory = () => Plugin | Plugin[];
const registry = new Map<string, PluginFactory>();

/** Called by a plugin package when it is imported, e.g. `registerPlugin('numfmt', () => numfmt())`. */
export function registerPlugin(id: string, factory: PluginFactory): void {
  registry.set(id, factory);
}

export function registeredPluginIds(): string[] {
  return [...registry.keys()];
}

/** The plugins a `plugins="numfmt formulas"` attribute names; an unknown id throws, naming it. */
export function pluginsFromIds(ids: readonly string[]): Plugin[] {
  return ids.flatMap((id) => {
    const f = registry.get(id);
    if (!f) throw spError('SP-3002', `sheetpane: no plugin "${id}" is registered — import its package before the element connects`);
    const p = f();
    return Array.isArray(p) ? p : [p];
  });
}

/** Checks a plugin set and returns it with `decorate` providers in `after` order. Throws on any rule broken. */
export function checkPlugins(list: readonly Plugin[]): Plugin[] {
  const ids = new Set<string>();
  for (const p of list) {
    if (!p || typeof p.id !== 'string' || !Array.isArray(p.provides)) throw spError('SP-3003', 'sheetpane: a plugin is an object with an id and a provides list');
    if (ids.has(p.id)) throw spError('SP-3004', `sheetpane: plugin "${p.id}" is listed twice`);
    ids.add(p.id);
    for (const h of p.provides) if (typeof (p as unknown as Record<string, unknown>)[h] !== 'function') throw spError('SP-3005', `sheetpane: plugin "${p.id}" provides "${h}" but has no ${h}() function`);
  }
  for (const hook of SINGLE_PROVIDER) {
    const providers = list.filter((p) => p.provides.includes(hook));
    if (providers.length > 1) throw spError('SP-3006', `sheetpane: "${hook}" has one provider per pane — ${providers.map((p) => p.id).join(' and ')} both provide it`);
  }
  const controls = new Set<string>();
  for (const c of list.flatMap((p) => p.controls ?? [])) {
    if (controls.has(c.id)) throw spError('SP-3007', `sheetpane: two controls share the id "${c.id}"`);
    if (!SLOTS.includes(c.slot)) throw spError('SP-3008', `sheetpane: control "${c.id}" names an unknown slot "${c.slot}"`);
    controls.add(c.id);
  }
  // decorate order: a plugin comes after every plugin it names in `after`.
  const deco = list.filter((p) => p.provides.includes('decorate'));
  const ordered: Plugin[] = [];
  const visit = (p: Plugin, path: string[]) => {
    if (ordered.includes(p)) return;
    if (path.includes(p.id)) throw spError('SP-3009', `sheetpane: decorate order loops: ${[...path, p.id].join(' → ')}`);
    for (const a of p.after ?? []) { const dep = deco.find((d) => d.id === a); if (dep) visit(dep, [...path, p.id]); }
    ordered.push(p);
  };
  deco.forEach((p) => visit(p, []));
  return [...list.filter((p) => !p.provides.includes('decorate')), ...ordered];
}

/** Merges `decorate` results in order, later winning per property; `font-family` is refused (SR-LAW-5). */
export function mergeDecorations(results: { id: string; style: StyleSubset | undefined }[]): StyleSubset {
  const out: StyleSubset = {};
  for (const { id, style } of results) {
    if (!style) continue;
    if (Object.keys(style).some((k) => k.toLowerCase() === 'font-family' || k === 'fontFamily')) {
      throw spError('SP-3010', `sheetpane: plugin "${id}" returned font-family from decorate — the host's font is the font (SR-LAW-5)`);
    }
    Object.assign(out, style);
  }
  return out;
}

export function controlsFor(list: readonly Plugin[], slot: ControlDescriptor['slot'], mode: 'view' | 'edit'): ControlDescriptor[] {
  const all = list.flatMap((p) => (p.controls ?? []).filter((c) => c.slot === slot && (c.mode === 'both' || c.mode === mode)));
  const groups = [...new Set(all.map((c) => c.group))];
  return groups.flatMap((g) => all.filter((c) => c.group === g));
}
