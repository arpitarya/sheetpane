// W-57 DoD 3: what @sheetpane/export writes as data validation, conditional formats and dxfs is what this
// package reads back — a fast-check property over generated rules, through the page's DOMParser.
import { describe, it } from 'vitest';
import { roundTrips } from './rules-arb.js';

describe('validation and conditional formats round-trip (W-57 DoD 3, DOMParser)', () => {
  it('read(toXlsx(x)) and read(patchXlsx(upload, x)) give x back', roundTrips, 120_000);
});
