import { describe, expect, it } from 'vitest';
import type { Geometry } from '@sheetpane/grid';
import { anchorRect, cellAt, colLabel, emuToPx, EMU_PER_PX, pointToPx, pxToEmu, refOf } from '../src/index.js';
import { extensionOf, isUnsupportedPath, sniff } from '../src/media.js';
import { BMP, EMF, GIF, PNG, SVG } from './helpers.js';

// 100 px columns, 28 px rows: easy to read.
const g: Geometry = { colX: (c) => c * 100, colWidth: () => 100, rowY: (r) => r * 28, rowHeight: () => 28 };
const px = (n: number) => n * EMU_PER_PX;

describe('EMU ↔ px (W-20 DoD 2)', () => {
  it('9,525 EMU per pixel: 914,400 per inch at 96 px per inch', () => {
    expect(EMU_PER_PX).toBe(914400 / 96);
    expect(emuToPx(381000)).toBe(40);
    expect(emuToPx(190500)).toBe(20);
    expect(pxToEmu(40)).toBe(381000);
  });
});

describe('anchorRect — twoCell, oneCell, absolute', () => {
  it('oneCell: from plus ext; the offset moves the corner, the size is the ext', () => {
    expect(anchorRect({ anchor: 'oneCell', from: { col: 6, colOff: 0, row: 5, rowOff: 0 }, ext: { cx: 381000, cy: 190500 } }, g)).toEqual({ x: 600, y: 140, width: 40, height: 20 });
    expect(anchorRect({ anchor: 'oneCell', from: { col: 1, colOff: px(10), row: 2, rowOff: px(5) }, ext: { cx: px(30), cy: px(12) } }, g)).toEqual({ x: 110, y: 61, width: 30, height: 12 });
  });
  it('twoCell: from to to, each with its offsets — the size follows the cells', () => {
    const r = anchorRect({ anchor: 'twoCell', from: { col: 2, colOff: px(10), row: 3, rowOff: px(4) }, to: { col: 6, colOff: px(20), row: 9, rowOff: 0 } }, g);
    expect(r).toEqual({ x: 210, y: 88, width: 410, height: 164 });
  });
  it('twoCell C4:F9 edge to edge covers exactly those cells', () => {
    expect(anchorRect({ anchor: 'twoCell', from: { col: 2, colOff: 0, row: 3, rowOff: 0 }, to: { col: 6, colOff: 0, row: 9, rowOff: 0 } }, g)).toEqual({ x: 200, y: 84, width: 400, height: 168 });
  });
  it('absolute: pos plus ext from the sheet origin, no geometry involved', () => {
    expect(anchorRect({ anchor: 'absolute', pos: { x: px(120), y: px(45) }, ext: { cx: px(64), cy: px(32) } }, g)).toEqual({ x: 120, y: 45, width: 64, height: 32 });
  });
  it('an offset never reaches past its own cell; a reversed twoCell is normalised', () => {
    expect(pointToPx(g, { col: 1, colOff: px(500), row: 1, rowOff: px(500) })).toEqual({ x: 200, y: 56 });
    expect(pointToPx(g, { col: 1, colOff: -5, row: 1, rowOff: Number.NaN })).toEqual({ x: 100, y: 28 });
    expect(anchorRect({ anchor: 'twoCell', from: { col: 3, colOff: 0, row: 3, rowOff: 0 }, to: { col: 1, colOff: 0, row: 1, rowOff: 0 } }, g)).toEqual({ x: 100, y: 28, width: 200, height: 56 });
  });
  it('an anchor missing what its kind needs has no rectangle', () => {
    expect(anchorRect({ anchor: 'twoCell', from: { col: 0, colOff: 0, row: 0, rowOff: 0 } }, g)).toBeUndefined();
    expect(anchorRect({ anchor: 'oneCell', ext: { cx: 1, cy: 1 } }, g)).toBeUndefined();
    expect(anchorRect({ anchor: 'oneCell', from: { col: 0, colOff: 0, row: 0, rowOff: 0 } }, g)).toBeUndefined();
    expect(anchorRect({ anchor: 'absolute', ext: { cx: 1, cy: 1 } }, g)).toBeUndefined();
  });
  it('uneven columns: the grid\'s own widths are what a twoCell spans', () => {
    const w = [64, 89, 40, 120];
    const uneven: Geometry = { colX: (c) => w.slice(0, c).reduce((a, b) => a + b, 0), colWidth: (c) => w[c] ?? 64, rowY: (r) => r * 28, rowHeight: () => 28 };
    expect(anchorRect({ anchor: 'twoCell', from: { col: 1, colOff: 0, row: 0, rowOff: 0 }, to: { col: 3, colOff: px(10), row: 1, rowOff: 0 } }, uneven)).toEqual({ x: 64, y: 0, width: 89 + 40 + 10, height: 28 });
  });
});

describe('cell references', () => {
  it('cellAt finds the cell under a point; colLabel/refOf make A1 refs', () => {
    expect(cellAt(g, 0, 0)).toEqual({ col: 0, row: 0 });
    expect(cellAt(g, 99.9, 27.9)).toEqual({ col: 0, row: 0 });
    expect(cellAt(g, 100, 28)).toEqual({ col: 1, row: 1 });
    expect(cellAt(g, 730, 400)).toEqual({ col: 7, row: 14 });
    expect(cellAt(g, -5, -5)).toEqual({ col: 0, row: 0 });
    expect([0, 25, 26, 51, 52, 701, 702, 16383].map(colLabel)).toEqual(['A', 'Z', 'AA', 'AZ', 'BA', 'ZZ', 'AAA', 'XFD']);
    expect(refOf(8, 3)).toBe('D9');
  });
});

describe('media: what the bytes are', () => {
  it('sniffs PNG, GIF, BMP, SVG by their headers, whatever the file is called', () => {
    expect(sniff(PNG, 'a.jpg')).toEqual({ mime: 'image/png' });
    expect(sniff(GIF, 'a.png')).toEqual({ mime: 'image/gif' });
    expect(sniff(BMP, 'a.bmp')).toEqual({ mime: 'image/bmp' });
    expect(sniff(SVG, 'a.svg')).toEqual({ mime: 'image/svg+xml' });
    expect(sniff(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]), 'a.jpeg')).toEqual({ mime: 'image/jpeg' });
  });
  it('EMF, WMF and TIFF are not drawn; by name or by header', () => {
    expect(sniff(EMF, 'logo.png')).toEqual({ format: 'emf' });
    expect(sniff(Uint8Array.from([0xd7, 0xcd, 0xc6, 0x9a, 0, 0]), 'a.wmf')).toEqual({ format: 'wmf' });
    expect(sniff(Uint8Array.from([0x49, 0x49, 0x2a, 0]), 'a.tif')).toEqual({ format: 'tiff' });
    expect(['a.emf', 'xl/media/b.WMF', 'c.tiff', 'd'].map(isUnsupportedPath)).toEqual([true, true, true, true]);
    expect(['a.png', 'a.JPG', 'a.jpeg', 'a.gif', 'a.svg', 'a.bmp'].map(isUnsupportedPath)).toEqual([false, false, false, false, false, false]);
    expect(extensionOf('xl/media/Image1.PNG')).toBe('png');
  });
});
