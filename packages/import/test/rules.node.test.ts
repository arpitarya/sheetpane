// W-57 DoD 3: the same round trip in Node, through the built-in XML reader (SR-IMPORT decision 8) —
// the two readers agree on every generated rule.
import { describe, it } from 'vitest';
import { roundTrips } from './rules-arb.js';

describe('validation and conditional formats round-trip (W-57 DoD 3, built-in XML reader)', () => {
  it('read(toXlsx(x)) and read(patchXlsx(upload, x)) give x back', roundTrips, 120_000);
});
