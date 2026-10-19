// The host's region in an error's card and list row (W-68): `renderDetail(error)`
// fills a `part="detail"` box after the message. A string is text, never HTML; a
// Node is the host's own. The hook runs again only when the error changes or the
// hook is replaced — a list re-drawn for another error reuses what it returned.
// Beside it, who accepted an error, when and why (W-69), drawn the same in both.
import { spMessage } from '@sheetpane/export';
import { copyError, type RenderDetail, type SheetpaneError } from '../pane/types.js';
import { esc } from './dom.js';

/** The region's class; `part="detail"` names it to the host. */
export const DETAIL_CLASS = 'xdetail';
/** Hidden while empty; the host's font and colours, never ours (SR-LAW-5). */
export const DETAIL_CSS = `.${DETAIL_CLASS}{font:inherit;color:inherit;overflow-wrap:anywhere;min-width:0}.${DETAIL_CLASS}:empty{display:none}`;

// errors are immutable in a snapshot: one JSON text per object
const keys = new WeakMap<SheetpaneError, string>();
const keyOf = (e: SheetpaneError) => { let k = keys.get(e); if (k === undefined) { k = JSON.stringify(e); keys.set(e, k); } return k; };

/** One element's detail region: the hook, and what it last drew for the one error shown. */
export class DetailRegion {
  private fn: RenderDetail | undefined;
  private gen = 0;
  private shown: { key: string; node: Node | null } | undefined;

  /** The host's hook; anything but a function turns the region off. */
  get render(): RenderDetail | undefined { return this.fn; }
  set render(f: RenderDetail | undefined) { this.fn = typeof f === 'function' ? f : undefined; this.gen++; this.shown = undefined; }

  /** The region's markup, where the element draws it — nothing while no hook is set. */
  html(): string { return this.fn ? `<div class="${DETAIL_CLASS}" part="detail"></div>` : ''; }

  /** Puts what the hook returns for `e` into the region under `root`; calls the hook only when `e` or the hook changed. */
  sync(root: ParentNode | null | undefined, e: SheetpaneError | undefined): void {
    const slot = root?.querySelector<HTMLElement>(`.${DETAIL_CLASS}`);
    if (!slot || !e || !this.fn) { this.shown = undefined; return; }
    const key = `${this.gen}|${keyOf(e)}`;
    if (this.shown?.key !== key) this.shown = { key, node: this.make(e) };
    const node = this.shown.node;
    if (node ? slot.childNodes.length !== 1 || slot.firstChild !== node : slot.childNodes.length) slot.replaceChildren(...(node ? [node] : []));
  }

  private make(e: SheetpaneError): Node | null {
    let out: unknown;
    try { out = this.fn!(copyError(e)); } catch (err) { console.error(spMessage('SP-3017', `renderDetail threw for ${e.id}; nothing is shown for it`), err); return null; }
    if (out === null || out === undefined || out === '') return null;
    if (typeof (out as Node).nodeType !== 'number') return document.createTextNode(String(out)); // a string is text, never HTML
    const node = out as Node;
    if (node.nodeType !== 11) return node; // DocumentFragment: its children move on the first insert, so keep them in a box
    const box = document.createElement('div');
    box.style.display = 'contents';
    box.append(node);
    return box;
  }
}

/** Whether an event started inside the host's region — its clicks and keys are the host's, not the element's. */
export const inDetail = (t: EventTarget | null): boolean => !!(t as Element | null)?.closest?.(`.${DETAIL_CLASS}`);

/** Who accepted an error, when, and why (W-69) — in the list's open row and the sheet's error card; nothing for any other status. */
export function acceptedHtml(e: SheetpaneError): string {
  if (e.status !== 'accepted') return '';
  const at = e.acceptedAt ? new Date(e.acceptedAt) : undefined;
  const when = at && !Number.isNaN(at.getTime()) ? at.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  return `<div class="acceptance"><span class="xs faint">${esc(['Accepted' + (e.acceptedBy ? ` by ${e.acceptedBy}` : ''), when].filter(Boolean).join(' · '))}</span><span>${esc(e.reason ?? '')}</span></div>`;
}
