// @sheetpane/images — pictures anchored in the sheet, drawn in sheet space through the `overlay`
// hook. View only: patch-mode export leaves the drawing and media parts as they were, so nothing
// is lost and nothing is edited (W-20). Importing is safe in Node: no DOM until an item renders.
import { registerPlugin, type ControlDescriptor, type OverlayItem, type Plugin, type PluginContext, type Geometry } from '@sheetpane/grid';
import { anchorRect, cellAt, refOf } from './anchors.js';
import { fileName, isUnsupportedPath, MediaCache } from './media.js';

export { EMU_PER_PX, emuToPx, pxToEmu, pointToPx, anchorRect, cellAt, colLabel, refOf } from './anchors.js';
export type { Anchor, AnchorPoint, Rect } from './anchors.js';
export { MediaCache, sniff, extensionOf, fileName, isUnsupportedPath } from './media.js';
export type { MediaResult } from './media.js';

type Book = PluginContext['book'];
type Store = PluginContext['store'];
type Drawing = Book['sheets'][number]['drawings'][number];

/** Each workbook gets a number, so item ids never repeat across two loads (the grid caches rendered items by id). */
const generations = new WeakMap<object, number>();
let nextGeneration = 1;
const generationOf = (book: Book): number => {
  let g = generations.get(book);
  if (!g) { g = nextGeneration++; generations.set(book, g); }
  return g;
};

interface StoreState { book: Book | undefined; cache: MediaCache | undefined }

const unavailable = (name: string) => `${name} — preview unavailable`;

const FRAME = 'box-sizing:border-box;width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:4px;overflow:hidden;text-align:center;'
  + 'border:1px dashed var(--sp-line-strong,#CBCBC5);background:var(--sp-sunken,#EFEFEB);color:var(--sp-ink-3,#63666E);font-size:12px;line-height:1.3;word-break:break-all';

/**
 * The picture items of one sheet, with their rectangles in sheet space: one item per `picture` drawing with media
 * and an area (charts and shapes are skipped). Exported for tests and for charts to model on.
 *
 * @param sheet - The sheet's name.
 * @param ctx - The plugin context with the grid's geometry, as the `overlay` hook receives it.
 * @param cache - Returns the media cache the items read their bytes through.
 * @returns The overlay items; `alt` is the drawing's description, else its name.
 */
export function pictureItems(sheet: string, ctx: PluginContext & { geometry: Geometry }, cache: () => MediaCache): OverlayItem[] {
  const s = ctx.book.sheets.find((x) => x.name === sheet);
  if (!s) return [];
  const gen = generationOf(ctx.book);
  const items: OverlayItem[] = [];
  s.drawings.forEach((d, i) => {
    if (d.kind !== 'picture' || !d.media) return;
    const rect = anchorRect(d, ctx.geometry);
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const name = d.name || fileName(d.media);
    items.push({ id: `pic:${gen}:${i}:${d.media}`, sheet, rect, alt: d.descr || name, render: () => renderPicture(d, d.descr || name, rect, sheet, ctx, cache) });
  });
  return items;
}

function renderPicture(d: Drawing, alt: string, rect: OverlayItem['rect'], sheet: string, ctx: PluginContext & { geometry: Geometry }, cache: () => MediaCache): HTMLElement {
  const media = d.media!, file = fileName(media);
  const root = document.createElement('div');
  root.className = 'sp-picture';
  root.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden';
  root.dataset.media = media;
  const frame = (text: string, state: string): HTMLElement => {
    const f = document.createElement('div');
    f.className = 'sp-picture-frame';
    f.dataset.state = state;
    f.style.cssText = FRAME;
    f.textContent = text;
    return f;
  };
  const show = (el: HTMLElement) => root.replaceChildren(el);

  // Edit: a click on a picture selects the cell under it, so that cell can still be flagged.
  root.addEventListener('click', (e) => {
    if (ctx.store.getSnapshot().mode !== 'edit') return;
    const r = root.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = rect.x + ((e.clientX - r.left) / r.width) * rect.width, y = rect.y + ((e.clientY - r.top) / r.height) * rect.height;
    const c = cellAt(ctx.geometry, x, y);
    ctx.store.select({ sheet, ref: refOf(c.row, c.col) });
  });

  // EMF, WMF and the like are known by name: a labelled frame, nothing read.
  if (isUnsupportedPath(media)) { show(frame(unavailable(file), 'unavailable')); return root; }

  // Everything else: a frame now, the bytes when the picture first scrolls near the screen.
  show(frame(file, 'pending'));
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    void cache().get(media).then((m) => {
      if (m.kind === 'unsupported') return show(frame(unavailable(file), 'unavailable'));
      if (m.kind === 'missing') return show(frame(unavailable(file), 'missing'));
      const img = document.createElement('img');
      img.alt = alt;
      img.decoding = 'async';
      img.draggable = false;
      img.style.cssText = 'display:block;width:100%;height:100%;object-fit:fill;user-select:none';
      img.addEventListener('load', () => show(img), { once: true });
      img.addEventListener('error', () => show(frame(unavailable(file), 'unavailable')), { once: true });
      img.src = m.url;
    });
  };
  if (typeof IntersectionObserver === 'undefined') queueMicrotask(start);
  else {
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: '300px' });
    io.observe(root);
  }
  return root;
}

const picturesOn = (book: Book | undefined, sheet: string): Drawing[] =>
  book?.sheets.find((s) => s.name === sheet)?.drawings.filter((d) => d.kind === 'picture' && d.media) ?? [];

const status: ControlDescriptor = {
  id: 'images-status', slot: 'status', group: 'images', label: 'Pictures', mode: 'both',
  text: (snap, sel) => {
    const pics = picturesOn(snap.book, sel.sheet);
    if (!pics.length) return '';
    const bad = pics.filter((d) => isUnsupportedPath(d.media!)).length;
    return `${pics.length} ${pics.length === 1 ? 'picture' : 'pictures'}${bad ? ` · ${bad} preview unavailable` : ''}`;
  },
};

/**
 * The pictures plugin: draws each picture anchored in the sheet through the `overlay` hook, view only. Bytes are
 * read only when a picture nears the viewport; PNG, JPEG, GIF, BMP, WebP and SVG show through `<img>`, and EMF, WMF,
 * TIFF or a missing part show a labelled "preview unavailable" frame. In Edit a click on a picture selects the cell
 * under it. Export copies the drawings unchanged. One instance serves one pane; its object URLs are revoked when
 * that pane loads another workbook. Importing this module registers it as `images`.
 *
 * @returns The plugin (`id: 'images'`), with a status count of the sheet's pictures.
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0107_IMAGES.md
 * @example
 * ```ts
 * import { createWorkbook } from '@sheetpane/grid';
 * import { images } from '@sheetpane/images';
 *
 * const book = createWorkbook({ plugins: [images()] });
 * await book.load(bytes, 'catalogue.xlsx');
 * ```
 * @example
 * ```ts
 * import '@sheetpane/images'; // registers `images`
 * excel.setAttribute('plugins', 'images');
 * ```
 */
export function images(): Plugin {
  const states = new WeakMap<Store, StoreState>();
  const stateFor = (store: Store): StoreState => {
    let st = states.get(store);
    if (!st) {
      const s: StoreState = { book: store.book, cache: undefined };
      st = s;
      states.set(store, s);
      // A replaced workbook (or a failed load) frees every object URL made for the old one.
      store.subscribe(() => {
        if (s.book === store.book) return;
        s.cache?.revoke();
        s.book = store.book;
        s.cache = undefined;
      });
    }
    return st;
  };
  return {
    id: 'images',
    provides: ['overlay'],
    controls: [status],
    overlay(sheet, ctx) {
      const st = stateFor(ctx.store);
      if (st.book !== ctx.book) { st.cache?.revoke(); st.book = ctx.book; st.cache = undefined; }
      const book = ctx.book;
      return pictureItems(sheet, ctx, () => {
        // A picture that decodes after its workbook went gets a closed cache and shows the missing frame.
        if (st.book !== book) { const dead = new MediaCache(book); dead.revoke(); return dead; }
        return (st.cache ??= new MediaCache(book));
      });
    },
  };
}

registerPlugin('images', () => images());
