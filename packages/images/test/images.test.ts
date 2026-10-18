import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createWorkbook, type SheetpaneExcel, type WorkbookStore } from '@sheetpane/grid';
import features from '../../import/test/fixtures/exceljs-features.xlsx?inline';
import { images } from '../src/index.js';
import '../src/index.js';
import { BMP, cellEl, cleanup, EMF, frame, fromDataUrl, GIF, mount, olay, olays, PNG, pictureBook, shadow, SVG, until, type Pic } from './helpers.js';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function open(bytes: Uint8Array, name = 'p.xlsx'): Promise<{ el: SheetpaneExcel; store: WorkbookStore }> {
  const el = mount();
  const store = createWorkbook({ plugins: [images()] });
  el.workbook = store;
  await store.load(bytes, name);
  await frame();
  return { el, store };
}
const rect = (e: Element) => e.getBoundingClientRect();
const imgOf = (o: HTMLElement) => o.querySelector('img');
const px = (n: number) => n * 9525;

describe('anchors against the cells they sit on (DoD 2, 4)', () => {
  it('oneCell: the ExcelJS fixture\'s 2×2 PNG at G6, 40×20 px', async () => {
    const { el } = await open(fromDataUrl(features), 'features.xlsx');
    expect(olays(el)).toHaveLength(1);
    // the fixture hides row 6 (W-49 honours it: 0 px), so the picture's top is where row 7 starts
    const o = olay(el), g7 = cellEl(el, 6, 6);
    expect(cellEl(el, 5, 6)).toBeNull();
    expect(rect(o).left).toBeCloseTo(rect(g7).left, 0);
    expect(rect(o).top).toBeCloseTo(rect(g7).top, 0);
    expect(rect(o).width).toBeCloseTo(40, 0);
    expect(rect(o).height).toBeCloseTo(20, 0);
    expect(shadow(el).querySelector('.olay')!.parentElement!.className).toBe('plug');
  });

  it('twoCell C4:F9 covers exactly those cells; with offsets it starts and ends inside them', async () => {
    const edge: Pic = { name: 'Edge', media: 'a.png', bytes: PNG, at: 'two', from: [2, 0, 3, 0], to: [6, 0, 9, 0] };
    const inset: Pic = { name: 'Inset', media: 'b.png', bytes: PNG, at: 'two', from: [1, px(10), 11, px(6)], to: [3, px(20), 13, px(10)] };
    const { el } = await open(await pictureBook([edge, inset]));
    const [a, b] = olays(el);
    const c4 = rect(cellEl(el, 3, 2)), f9 = rect(cellEl(el, 8, 5));
    expect(rect(a!).left).toBeCloseTo(c4.left, 0);
    expect(rect(a!).top).toBeCloseTo(c4.top, 0);
    expect(rect(a!).right).toBeCloseTo(f9.right, 0);
    expect(rect(a!).bottom).toBeCloseTo(f9.bottom, 0);
    const b12 = rect(cellEl(el, 11, 1)), d14 = rect(cellEl(el, 13, 3));
    expect(rect(b!).left).toBeCloseTo(b12.left + 10, 0);
    expect(rect(b!).top).toBeCloseTo(b12.top + 6, 0);
    expect(rect(b!).right).toBeCloseTo(d14.left + 20, 0);
    expect(rect(b!).bottom).toBeCloseTo(d14.top + 10, 0);
  });

  it('absolute: from the sheet origin (A1\'s top-left), whatever the columns', async () => {
    const { el } = await open(await pictureBook([{ name: 'Abs', media: 'a.png', bytes: PNG, at: 'abs', pos: [px(150), px(60)], ext: [px(64), px(32)] }]));
    const o = olay(el), a1 = rect(cellEl(el, 0, 0));
    expect(rect(o).left - a1.left).toBeCloseTo(150, 0);
    expect(rect(o).top - a1.top).toBeCloseTo(60, 0);
    expect(rect(o).width).toBeCloseTo(64, 0);
    expect(rect(o).height).toBeCloseTo(32, 0);
  });

  it('zoom scales the picture with its cells', async () => {
    const { el } = await open(await pictureBook([{ name: 'P', media: 'a.png', bytes: PNG, at: 'two', from: [2, 0, 3, 0], to: [4, 0, 5, 0] }]));
    const zoom = shadow(el).querySelector('.zoom') as HTMLSelectElement;
    zoom.value = '1.5';
    zoom.dispatchEvent(new Event('change'));
    await frame();
    const o = olay(el), c = rect(cellEl(el, 3, 2)), d = rect(cellEl(el, 4, 3));
    expect(rect(o).left).toBeCloseTo(c.left, 0);
    expect(rect(o).top).toBeCloseTo(c.top, 0);
    expect(rect(o).right).toBeCloseTo(d.right, 0);
    expect(rect(o).bottom).toBeCloseTo(d.bottom, 0);
  });
});

describe('media (DoD 3)', () => {
  const all: Pic[] = [
    { name: 'png', media: 'a.png', bytes: PNG, at: 'one', from: [0, 0, 0, 0], ext: [px(30), px(30)] },
    { name: 'gif', media: 'b.gif', bytes: GIF, at: 'one', from: [2, 0, 0, 0], ext: [px(30), px(30)] },
    { name: 'svg', media: 'c.svg', bytes: SVG, at: 'one', from: [4, 0, 0, 0], ext: [px(30), px(30)] },
    { name: 'bmp', media: 'd.bmp', bytes: BMP, at: 'one', from: [6, 0, 0, 0], ext: [px(30), px(30)] },
    { name: 'logo', media: 'logo.emf', bytes: EMF, at: 'one', from: [8, 0, 0, 0], ext: [px(80), px(40)] },
  ];

  it('PNG, GIF, SVG and BMP become <img> with a blob: URL once decoded — never inline markup', async () => {
    const create = vi.spyOn(URL, 'createObjectURL');
    const { el } = await open(await pictureBook(all));
    await until(() => olays(el).slice(0, 4).every((o) => imgOf(o)?.src.startsWith('blob:')));
    for (const o of olays(el).slice(0, 4)) {
      const img = imgOf(o)!;
      await until(() => img.complete && img.naturalWidth > 0);
      expect(o.querySelector('svg')).toBeNull();
    }
    expect(create.mock.calls.map((c) => (c[0] as Blob).type).sort()).toEqual(['image/bmp', 'image/gif', 'image/png', 'image/svg+xml']);
    expect(imgOf(olay(el, 4))).toBeNull();
  });

  it('the item shows a frame first and only reads the bytes when asked (lazy)', async () => {
    const el = mount();
    const store = createWorkbook({ plugins: [images()] });
    const part = vi.fn();
    el.workbook = store;
    await store.load(await pictureBook([all[0]!]), 'p.xlsx');
    const book = store.book!;
    const orig = book.part.bind(book);
    book.part = (p) => { part(p); return orig(p); };
    // nothing was read at load; the picture is on screen, so it reads once it intersects
    await frame();
    await until(() => !!imgOf(olay(el)));
    expect(part.mock.calls).toEqual([['xl/media/a.png']]);
  });

  it('a picture scrolled far away is not decoded until it comes near', async () => {
    const far: Pic = { name: 'far', media: 'a.png', bytes: PNG, at: 'one', from: [0, 0, 400, 0], ext: [px(30), px(30)] };
    const create = vi.spyOn(URL, 'createObjectURL');
    const { el } = await open(await pictureBook([far]));
    await new Promise((r) => setTimeout(r, 150));
    expect(create).not.toHaveBeenCalled();
    expect(olay(el).querySelector('.sp-picture-frame')!.getAttribute('data-state')).toBe('pending');
    const sc = shadow(el).querySelector('.scroller') as HTMLElement;
    sc.scrollTop = 400 * 28 - 100;
    sc.dispatchEvent(new Event('scroll'));
    await frame();
    await until(() => create.mock.calls.length === 1);
  });

  it('EMF gets a frame the size of its anchor, labelled with the file name; nothing is read', async () => {
    const { el, store } = await open(await pictureBook(all));
    const o = olay(el, 4);
    expect(o.textContent).toBe('logo.emf — preview unavailable');
    expect(o.querySelector('.sp-picture-frame')!.getAttribute('data-state')).toBe('unavailable');
    expect(rect(o).width).toBeCloseTo(80, 0);
    expect(rect(o).height).toBeCloseTo(40, 0);
    expect(store.book!.sheets[0]!.drawings[4]!.media).toBe('xl/media/logo.emf');
  });

  it('an EMF saved under a .png name is told apart by its header and shows the frame', async () => {
    const { el } = await open(await pictureBook([{ name: 'liar', media: 'logo.png', bytes: EMF, at: 'one', from: [0, 0, 0, 0], ext: [px(50), px(50)] }]));
    await until(() => olay(el).textContent === 'logo.png — preview unavailable');
  });

  it('bytes that are not an image fall back to the labelled frame', async () => {
    const { el } = await open(await pictureBook([{ name: 'bad', media: 'bad.png', bytes: new Uint8Array(40).fill(7), at: 'one', from: [0, 0, 0, 0], ext: [px(50), px(50)] }]));
    await until(() => olay(el).textContent === 'bad.png — preview unavailable');
  });

  it('a picture whose media part is missing shows the frame, not an error', async () => {
    const el = mount();
    const store = createWorkbook({ plugins: [images()] });
    el.workbook = store;
    await store.load(await pictureBook([{ name: 'gone', media: 'a.png', bytes: PNG, at: 'one', from: [0, 0, 0, 0], ext: [px(50), px(50)] }]), 'p.xlsx');
    store.book!.part = async () => undefined;
    await until(() => olays(el).length === 1 && olay(el).querySelector('.sp-picture-frame')?.getAttribute('data-state') === 'missing');
    expect(olay(el).textContent).toBe('a.png — preview unavailable');
  });
});

describe('alt text and the status (DoD 4)', () => {
  it('alt is the picture\'s description, else its name', async () => {
    const { el } = await open(await pictureBook([
      { name: 'Logo', descr: 'Company logo', media: 'a.png', bytes: PNG, at: 'one', from: [0, 0, 0, 0], ext: [px(30), px(30)] },
      { name: 'Picture 2', media: 'b.png', bytes: PNG, at: 'one', from: [2, 0, 0, 0], ext: [px(30), px(30)] },
    ]));
    expect(olays(el).map((o) => o.getAttribute('aria-label'))).toEqual(['Company logo', 'Picture 2']);
    await until(() => olays(el).every((o) => !!imgOf(o)));
    expect(olays(el).map((o) => imgOf(o)!.alt)).toEqual(['Company logo', 'Picture 2']);
  });

  it('the status line counts pictures and the ones that cannot be previewed', async () => {
    const { el } = await open(await pictureBook([
      { name: 'a', media: 'a.png', bytes: PNG, at: 'one', from: [0, 0, 0, 0], ext: [px(30), px(30)] },
      { name: 'b', media: 'logo.emf', bytes: EMF, at: 'one', from: [2, 0, 0, 0], ext: [px(30), px(30)] },
    ]));
    expect(shadow(el).querySelector('.status')!.textContent).toContain('2 pictures · 1 preview unavailable');
  });
});

describe('Edit: a click selects the cell under the picture (DoD 4)', () => {
  it('in Edit the cell under the click point is selected; in View nothing changes', async () => {
    const { el, store } = await open(await pictureBook([{ name: 'P', media: 'a.png', bytes: PNG, at: 'two', from: [2, 0, 3, 0], to: [6, 0, 9, 0] }]));
    await until(() => !!imgOf(olay(el)));
    const o = olay(el);
    const at = (cell: HTMLElement) => { const r = cell.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const fire = (cell: HTMLElement) => { const p = at(cell); o.querySelector('.sp-picture')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, clientX: p.x, clientY: p.y })); };
    store.select({ sheet: 'Pics', ref: 'A1' });
    fire(cellEl(el, 5, 4));
    expect(store.getSnapshot().selection.ref).toBe('A1');
    store.setMode('edit');
    fire(cellEl(el, 5, 4));
    expect(store.getSnapshot().selection).toMatchObject({ sheet: 'Pics', ref: 'E6' });
    fire(cellEl(el, 8, 5));
    expect(store.getSnapshot().selection.ref).toBe('F9');
  });

  it('a real pointer click lands on the picture and selects the cell under it', async () => {
    const { el, store } = await open(await pictureBook([{ name: 'P', media: 'a.png', bytes: PNG, at: 'two', from: [2, 0, 3, 0], to: [6, 0, 9, 0] }]));
    await until(() => !!imgOf(olay(el)));
    store.setMode('edit');
    await frame();
    const img = imgOf(olay(el))!, target = rect(cellEl(el, 6, 3));
    await userEvent.click(img, { position: { x: target.left - rect(img).left + 5, y: target.top - rect(img).top + 5 } });
    expect(store.getSnapshot().selection.ref).toBe('D7');
  });
});

describe('memory: object URLs are revoked (DoD 3, 6)', () => {
  it('loading another workbook revokes every URL made for the first, once', async () => {
    const create = vi.spyOn(URL, 'createObjectURL');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const one = await pictureBook([
      { name: 'a', media: 'a.png', bytes: PNG, at: 'one', from: [0, 0, 0, 0], ext: [px(30), px(30)] },
      { name: 'a2', media: 'a.png', bytes: PNG, at: 'one', from: [3, 0, 0, 0], ext: [px(30), px(30)] },
      { name: 'b', media: 'b.gif', bytes: GIF, at: 'one', from: [6, 0, 0, 0], ext: [px(30), px(30)] },
    ]);
    const { el, store } = await open(one);
    await until(() => olays(el).every((o) => !!imgOf(o)));
    expect(create).toHaveBeenCalledTimes(2); // two parts, three pictures: one URL per part
    expect(revoke).not.toHaveBeenCalled();
    const made = create.mock.results.map((r) => r.value as string);
    const first = imgOf(olay(el))!;
    await store.load(await pictureBook([{ name: 'c', media: 'c.png', bytes: PNG, at: 'one', from: [0, 0, 0, 0], ext: [px(40), px(40)] }]), 'two.xlsx');
    expect(revoke.mock.calls.map((c) => c[0]).sort()).toEqual([...made].sort());
    await frame();
    await until(() => create.mock.calls.length === 3 && olays(el).length === 1 && !!imgOf(olay(el)));
    // the new workbook's picture is a new element with a live URL, not the cached old one
    const now = imgOf(olay(el))!;
    expect(now).not.toBe(first);
    expect(made).not.toContain(now.src);
    expect(revoke).toHaveBeenCalledTimes(2);
  });

  it('a workbook with no pictures after one with pictures leaves no layer items and no live URLs', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const { el, store } = await open(await pictureBook([{ name: 'a', media: 'a.png', bytes: PNG, at: 'one', from: [0, 0, 0, 0], ext: [px(30), px(30)] }]));
    await until(() => !!imgOf(olay(el)));
    await store.load(await pictureBook([]), 'empty.xlsx');
    await frame();
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(olays(el)).toHaveLength(0);
  });

  it('a decode that finishes after the workbook went makes no URL', async () => {
    const create = vi.spyOn(URL, 'createObjectURL');
    const el = mount();
    const store = createWorkbook({ plugins: [images()] });
    el.workbook = store;
    await store.load(await pictureBook([{ name: 'a', media: 'a.png', bytes: PNG, at: 'one', from: [0, 0, 0, 0], ext: [px(30), px(30)] }]), 'p.xlsx');
    const book = store.book!;
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const orig = book.part.bind(book);
    book.part = async (p) => { await gate; return orig(p); };
    await frame();
    await store.load(await pictureBook([]), 'e.xlsx');
    release();
    await new Promise((r) => setTimeout(r, 100));
    expect(create).not.toHaveBeenCalled();
  });
});
