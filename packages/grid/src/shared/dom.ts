// Small DOM helpers shared by the elements.

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The element names register only where `customElements` exists — importing in Node is safe (SR-LAW-8). */
export function define(name: string, ctor: CustomElementConstructor): void {
  const reg = (globalThis as { customElements?: CustomElementRegistry }).customElements;
  if (reg && !reg.get(name)) reg.define(name, ctor);
}

/** A base class that is `HTMLElement` in a browser and a plain class in Node, so the module imports anywhere. */
export const ElementBase: typeof HTMLElement = (typeof HTMLElement !== 'undefined' ? HTMLElement : class {}) as typeof HTMLElement;

const svg = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON = {
  sheet: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/>'),
  view: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>'),
  find: svg('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'),
  download: svg('<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  flag: svg('<path d="M5 21V4h11l-2 4 2 4H5"/>'),
  prev: svg('<path d="M15 6l-6 6 6 6"/>'),
  next: svg('<path d="M9 6l6 6-6 6"/>'),
  undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
  redo: svg('<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>'),
  upload: svg('<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>'),
  freeze: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/>'),
  chevron: svg('<path d="M6 9l6 6 6-6"/>'),
};

/** Fires a bubbling, composed `sheetpane-*` event (contract verdict: DOM events only). */
export function fire<T>(el: EventTarget, name: string, detail: T, cancelable = false): boolean {
  return el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true, cancelable }));
}
