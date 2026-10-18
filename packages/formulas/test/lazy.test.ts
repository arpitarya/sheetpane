// Lazy loading (W-16 DoD 1, 9): importing the package, and loading a workbook
// with no formulas, request no .wasm and touch no WebAssembly API. This file runs
// in its own iframe, so the engine starts unloaded.
import { describe, expect, it } from 'vitest';
import { book, loaded, until } from './helpers.js';

const wasmRequests = () => performance.getEntriesByType('resource').filter((e) => /\.wasm(\?|$)/.test(e.name)).map((e) => e.name);

describe('the engine loads on first use, never on import', () => {
  it('import → no WebAssembly; formula-free workbook → none; first typed formula → one .wasm request', async () => {
    const calls: string[] = [];
    const W = WebAssembly as unknown as Record<string, (...a: unknown[]) => unknown>;
    const originals = new Map<string, (...a: unknown[]) => unknown>();
    for (const name of ['instantiate', 'instantiateStreaming', 'compile', 'compileStreaming']) {
      const orig = W[name]!;
      originals.set(name, orig);
      W[name] = (...a: unknown[]) => { calls.push(name); return orig.apply(WebAssembly, a); };
    }
    try {
      const { formulas, engineLoaded } = await import('../src/index.js');
      await import('../src/ui.js');
      expect(calls).toEqual([]);
      expect(wasmRequests()).toEqual([]);
      expect(engineLoaded()).toBe(false);

      const f = formulas();
      const store = await loaded(await book({ S: [[1, 2], ['a', true]] }), [f]);
      await f.ready();
      store.setCell('S', 'A1', '5');
      await f.ready();
      expect(f.built()).toBe(false);
      expect(calls).toEqual([]);
      expect(wasmRequests()).toEqual([]);

      store.setCell('S', 'C1', '=A1+B1');
      await until(() => store.getSnapshot().derived.get('S!C1')?.value === 7);
      expect(engineLoaded()).toBe(true);
      expect(calls.length).toBeGreaterThan(0);
      await until(() => wasmRequests().length > 0);
      expect(wasmRequests()).toHaveLength(1);
      expect(wasmRequests()[0]).toMatch(/wasm_bg\.wasm/);
    } finally {
      for (const [name, fn] of originals) W[name] = fn;
    }
  });
});
