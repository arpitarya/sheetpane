// W-66: the text of a `ref` attribute and the `#sheetpane=<pane>:<Sheet>!<ref>` fragment — read and written
// without touching any other part of a host's fragment (its hash router's path, its own parameters).
import { describe, expect, it } from 'vitest';
import { parseTarget, readLink, writeLink } from '../src/excel/link.js';

describe('parseTarget — the ref attribute (W-66 DoD 1)', () => {
  it('a cell, a range, with or without its sheet; a quoted sheet name', () => {
    expect(parseTarget('B4')).toEqual({ range: { top: 3, left: 1, bottom: 3, right: 1 } });
    expect(parseTarget('Data!B4')).toEqual({ sheet: 'Data', range: { top: 3, left: 1, bottom: 3, right: 1 } });
    expect(parseTarget("'Q3 data'!D8:B4")).toEqual({ sheet: 'Q3 data', range: { top: 3, left: 1, bottom: 7, right: 3 } });
    expect(parseTarget("'It''s'!$A$1")).toEqual({ sheet: "It's", range: { top: 0, left: 0, bottom: 0, right: 0 } });
  });
  it('not a cell: undefined', () => {
    for (const bad of ['', 'B', '4B', 'Data!', '!B4', 'B0', 'XFE1', 'B4:', 'Data!B4!']) expect(parseTarget(bad), bad).toBeUndefined();
  });
});

describe('readLink / writeLink — the URL fragment (W-66 DoD 2)', () => {
  it('an empty fragment gets the link alone; the pane, sheet and ref read back', () => {
    const h = writeLink('', 'q3', { sheet: 'Data', ref: 'F9' });
    expect(h).toBe('sheetpane=q3:Data!F9');
    expect(readLink(`#${h}`, 'q3')).toBe('Data!F9');
    expect(readLink(h, 'q4')).toBeUndefined();
  });
  it('no pane: `<Sheet>!<ref>`; names with spaces, colons, `!` and quotes survive', () => {
    expect(writeLink('', '', { sheet: 'Sheet1', ref: 'B4:D8' })).toBe('sheetpane=Sheet1!B4:D8');
    expect(readLink('sheetpane=Sheet1!B4:D8', '')).toBe('Sheet1!B4:D8');
    for (const sheet of ['Q3 data', 'a!b', "It's", 'x:y', 'Ünïcode ☃']) {
      const h = writeLink('', 'pane one', { sheet, ref: 'C2' });
      expect(h).not.toMatch(/ /);
      const back = readLink(h, 'pane one')!;
      expect(parseTarget(back), `${sheet} → ${h} → ${back}`).toEqual({ sheet, range: { top: 1, left: 2, bottom: 1, right: 2 } });
    }
    expect(readLink('sheetpane=q3:B4', 'q3')).toBe('B4'); // no sheet: the sheet shown
    expect(readLink('sheetpane=q3:B4:D8', 'q3')).toBe('B4:D8');
    expect(readLink('sheetpane=q3:Data!B4:D8', 'q3')).toBe('Data!B4:D8'); // a range's own `:` is not the pane's
  });
  it('a hash router keeps its path: the link goes after `?`, and its own parameters stay', () => {
    expect(writeLink('#/reports/12', 'q3', { sheet: 'Data', ref: 'F9' })).toBe('/reports/12?sheetpane=q3:Data!F9');
    expect(writeLink('#!/reports/12', 'q3', { sheet: 'Data', ref: 'F9' })).toBe('!/reports/12?sheetpane=q3:Data!F9');
    expect(writeLink('#/reports/12?tab=sheet&x=1', 'q3', { sheet: 'Data', ref: 'F9' })).toBe('/reports/12?tab=sheet&x=1&sheetpane=q3:Data!F9');
    expect(readLink('#/reports/12?tab=sheet&sheetpane=q3:Data!F9&x=1', 'q3')).toBe('Data!F9');
    // replaced where the old one stood, never twice
    expect(writeLink('#/r?sheetpane=q3:Data!F9&x=1&sheetpane=q3:Old!B1', 'q3', { sheet: 'Data', ref: 'A2' })).toBe('/r?sheetpane=q3:Data!A2&x=1');
    // removed: the host's fragment exactly as it was
    expect(writeLink('#/reports/12?sheetpane=q3:Data!F9', 'q3', undefined)).toBe('/reports/12');
    expect(writeLink('#/reports/12?tab=1&sheetpane=q3:Data!F9', 'q3', undefined)).toBe('/reports/12?tab=1');
  });
  it('an anchor or the host\'s own parameters: after `&`; two panes keep their own links', () => {
    expect(writeLink('#section-2', 'q3', { sheet: 'Data', ref: 'F9' })).toBe('section-2&sheetpane=q3:Data!F9');
    expect(writeLink('section-2&sheetpane=q3:Data!F9', 'q3', undefined)).toBe('section-2');
    const two = writeLink(writeLink('a=1', 'q3', { sheet: 'Data', ref: 'F9' }), 'q4', { sheet: 'Other', ref: 'A1' });
    expect(two).toBe('a=1&sheetpane=q3:Data!F9&sheetpane=q4:Other!A1');
    expect(readLink(two, 'q3')).toBe('Data!F9');
    expect(readLink(two, 'q4')).toBe('Other!A1');
    expect(writeLink(two, 'q3', undefined)).toBe('a=1&sheetpane=q4:Other!A1');
    expect(writeLink(two, 'q3', { sheet: 'Data', ref: 'G1' })).toBe('a=1&sheetpane=q3:Data!G1&sheetpane=q4:Other!A1');
    // a parameter merely starting with our name is not ours
    expect(readLink('sheetpaneX=1&sheetpane2=q3:A1', 'q3')).toBeUndefined();
  });
});
