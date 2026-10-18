// Matchers for Vitest's and Playwright's `expect.extend(matchers)` (W-41 DoD 4).
import { valueAt, type Value, type Values } from './read.js';

/** What an error must match: any of its fields; `ref` may be `B3` or `Sheet1!B3`. */
export interface ErrorMatch { ref?: string; type?: string; severity?: string; status?: string; author?: string; code?: string; message?: string | RegExp }
interface ErrorLike { sheet: string; range: string; type: string; severity: string; status: string; author: string; message: string; code?: string }

const same = (a: Value, b: Value) => a === b || (typeof a === 'number' && typeof b === 'string' && String(a) === b) || (typeof b === 'number' && typeof a === 'string' && a === String(b));

/**
 * Matchers for Vitest's and Playwright's `expect.extend(matchers)`: `toHaveCell` on values
 * `readFile` returned, `toHaveError` on a driver's `errors()`.
 *
 * @example
 * ```ts
 * import { expect } from 'vitest';
 * import { matchers } from '@sheetpane/testing';
 * expect.extend(matchers);
 * // expect(values).toHaveCell('Sheet1!B2', 42);
 * // expect(await sp.errors()).toHaveError({ ref: 'B3', status: 'open' });
 * ```
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0118_TESTING.md
 */
export const matchers = {
  /** `expect(values).toHaveCell('Sheet1!B2', 42)` — a number and its text compare equal. */
  toHaveCell(received: Values, address: string, expected: Value) {
    const got = valueAt(received, address);
    const pass = same(got, expected);
    return { pass, message: () => `expected ${address} ${pass ? 'not ' : ''}to be ${JSON.stringify(expected)}, got ${JSON.stringify(got)}` };
  },
  /** `expect(errors).toHaveError({ ref: 'B3', status: 'open' })`. */
  toHaveError(received: readonly ErrorLike[], match: ErrorMatch) {
    const hit = received.some((e) =>
      (!match.ref || (match.ref.includes('!') ? `${e.sheet}!${e.range}` === match.ref : e.range === match.ref)) &&
      (!match.type || e.type === match.type) && (!match.severity || e.severity === match.severity) && (!match.status || e.status === match.status) &&
      (!match.author || e.author === match.author) && (!match.code || e.code === match.code) &&
      (!match.message || (match.message instanceof RegExp ? match.message.test(e.message) : e.message.includes(match.message))));
    return { pass: hit, message: () => `expected ${hit ? 'no ' : ''}error matching ${JSON.stringify({ ...match, message: String(match.message ?? '') })} among ${received.map((e) => `${e.sheet}!${e.range}`).join(', ') || 'none'}` };
  },
};
