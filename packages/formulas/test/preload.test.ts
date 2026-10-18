// `formulas({ preload: true })` warms the engine before any derive (W-16 hazard "Size").
import { describe, expect, it } from 'vitest';
import { engineLoaded, formulas } from '../src/index.js';
import { until } from './helpers.js';

describe('preload', () => {
  it('fetches and compiles the .wasm when the plugin is created, before any workbook', async () => {
    expect(engineLoaded()).toBe(false);
    const t0 = performance.now();
    formulas({ preload: true });
    await until(() => engineLoaded());
    const wasm = performance.getEntriesByType('resource').filter((e) => /\.wasm/.test(e.name)) as PerformanceResourceTiming[];
    expect(wasm).toHaveLength(1);
    console.info(`IronCalc .wasm: ${Math.round(wasm[0]!.decodedBodySize / 1024)} KiB, fetched + compiled + initialised in ${Math.round(performance.now() - t0)} ms (dev server, ${navigator.userAgent})`);
  });
});
