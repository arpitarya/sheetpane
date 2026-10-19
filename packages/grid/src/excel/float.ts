// Every dropdown, menu and pop-up card is drawn in the top layer and kept wholly inside the viewport
// (SR-LAW-13): no scroll box, `overflow: hidden` parent or stacking context can cut it off or cover it.
// Each is laid out where its markup puts it (under its cell, under its button); that spot, relative to the
// box it was laid out in, is remembered, and on every frame the card is placed there in the viewport —
// moved in from the right and bottom edges, and above its anchor when there is no room below.

/** What is floated: every menu, list and pop-up card the element draws — always a `.card`, never a button of the same name. */
export const FLOATS = ['ctxmenu', 'dlmenu', 'moremenu', 'hidmenu', 'fmenu', 'menu', 'szpop', 'callout', 'composer', 'help'].map((c) => `.card.${c}`).join(',');

/** The gap kept from the viewport's edges, px. */
export const EDGE = 8;

interface Home { parent: HTMLElement; dx: number; dy: number; anchor: number }
const homes = new WeakMap<HTMLElement, Home>();

/** The viewport's size, without scroll bars. */
const viewport = (): { w: number; h: number } => {
  const d = document.documentElement;
  return { w: d.clientWidth || innerWidth, h: d.clientHeight || innerHeight };
};

/** The least height a card keeps where it opened, scrolling inside, before it is moved up instead, px. */
export const MIN_H = 160;

/**
 * Where a card of size `w` × `h` goes, wanting `x`, `y` (viewport px), inside a viewport `vw` × `vh`. Moved in
 * from the right and left edges. When it runs past the bottom: above its anchor if `anchor` (the height of
 * what it hangs under) is given and it fits there; else it stays where it opened and scrolls inside, if
 * `MIN_H` or more is left below; else it moves up, scrolling inside if still too tall. It never covers
 * what opened it unless the viewport leaves no other room. Pure, so it is tested alone.
 */
export function placeInViewport(x: number, y: number, w: number, h: number, vw: number, vh: number, anchor = 0, edge = EDGE): { x: number; y: number; maxH?: number } {
  if (x + w > vw - edge) x = vw - edge - w;
  if (x < edge) x = edge;
  if (y < edge) y = edge;
  if (y + h <= vh - edge) return { x, y };
  if (anchor && y - anchor - h >= edge) return { x, y: y - anchor - h };
  const below = vh - edge - y;
  if (below >= MIN_H) return { x, y, maxH: below };
  const top = Math.max(edge, vh - edge - h);
  return top + h > vh - edge ? { x, y: top, maxH: vh - edge - top } : { x, y: top };
}

/** Lifts one card into the top layer and places it inside the viewport; a hidden card leaves the top layer. */
export function floatInViewport(el: HTMLElement): void {
  const open = el.matches(':popover-open');
  if (!el.isConnected || el.hidden || getComputedStyle(el).display === 'none' && !open) { if (open) el.hidePopover(); return; }
  let home = homes.get(el);
  if (!home) {
    const parent = el.offsetParent as HTMLElement | null;
    if (!parent) return;
    const r = el.getBoundingClientRect(), p = parent.getBoundingClientRect();
    home = { parent, dx: r.left - p.left, dy: r.top - p.top, anchor: Number(el.dataset.anchorH ?? 0) || 0 };
    homes.set(el, home);
    el.setAttribute('popover', 'manual');
    el.classList.add('sp-float');
  }
  if (!el.matches(':popover-open')) { try { el.showPopover(); } catch { return; } }
  const p = home.parent.getBoundingClientRect(), v = viewport();
  el.style.maxHeight = '';
  const at = placeInViewport(p.left + home.dx, p.top + home.dy, el.offsetWidth, el.offsetHeight, v.w, v.h, home.anchor);
  el.style.left = `${Math.round(at.x)}px`;
  el.style.top = `${Math.round(at.y)}px`;
  if (at.maxH !== undefined) el.style.maxHeight = `${at.maxH}px`;
}

/** Floats every card under `root`. */
export function floatAll(root: ParentNode): void {
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(FLOATS))) floatInViewport(el);
}
