import { expect, it } from 'vitest';
import { TOKENS_CSS } from '../src/tokens.js';
it('runs in a real browser engine', () => {
  expect(typeof customElements.define).toBe('function');
  expect(new DOMParser().parseFromString('<a/>', 'application/xml').documentElement.nodeName).toBe('a');
  expect(TOKENS_CSS).toContain('--sp-accent');
});
