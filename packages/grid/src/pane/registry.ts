// One store per `pane` id, shared by every element that names it (contract
// verdict decision 1): created by the first element that asks, released when
// the last one disconnects. Elements without a pane get a private store.
import { spMessage } from '@sheetpane/export';
import { pluginsFromIds } from '../plugins/host.js';
import { createWorkbook, type WorkbookStore } from './store.js';

interface Entry { store: WorkbookStore; users: Set<Element>; plugins: string }
const panes = new Map<string, Entry>();
const attached = new WeakMap<WorkbookStore, Element[]>();

/** The store for a pane id; `plugins` (ids) applies only when this call creates it — the set is fixed per pane. */
export function acquirePane(id: string, el: Element, plugins: readonly string[]): WorkbookStore {
  let e = panes.get(id);
  if (!e) {
    e = { store: createWorkbook({ plugins: pluginsFromIds(plugins) }), users: new Set(), plugins: plugins.join(' ') };
    panes.set(id, e);
  } else if (plugins.length && plugins.join(' ') !== e.plugins) {
    console.warn(spMessage('SP-3011', `sheetpane: pane "${id}" already runs plugins "${e.plugins}"; "${plugins.join(' ')}" on a later element is ignored (the set is fixed per pane)`));
  }
  e.users.add(el);
  return e.store;
}

export function releasePane(id: string, el: Element): void {
  const e = panes.get(id);
  if (!e) return;
  e.users.delete(el);
  if (!e.users.size) panes.delete(id);
}

/** Test and host helper: the live store of a pane, if any element holds it. */
export function paneStore(id: string): WorkbookStore | undefined {
  return panes.get(id)?.store;
}

/** Elements attached to a store, in connection order: events nobody owns go out on the first sheet, else the first element. */
export function attach(store: WorkbookStore, el: Element): void {
  const l = attached.get(store) ?? [];
  if (!l.includes(el)) l.push(el);
  attached.set(store, l);
}
export function detach(store: WorkbookStore, el: Element): void {
  const l = attached.get(store);
  if (l) attached.set(store, l.filter((x) => x !== el));
}
export function isPrimary(store: WorkbookStore, el: Element): boolean {
  const l = attached.get(store) ?? [];
  const first = l.find((x) => x.localName === 'sheetpane-excel') ?? l[0];
  return first === el;
}
