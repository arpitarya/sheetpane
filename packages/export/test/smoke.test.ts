import { expect, it } from 'vitest';
it('runs in Node', () => expect(typeof process.versions.node).toBe('string'));
