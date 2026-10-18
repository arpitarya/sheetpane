import { inject } from 'vitest';
import { toCsv, toXlsx } from '@sheetpane/export';
import { SAMPLE_BOOK, SAMPLE_CSV_SHEET } from '../../export/test/fixtures/sample.js';
import '../src/index.js';
import type { SheetpaneExcel } from '../src/index.js';

export const sampleXlsx = () => toXlsx(SAMPLE_BOOK);
export const sampleCsv = () => new TextEncoder().encode(toCsv(SAMPLE_CSV_SHEET).text);

export const frame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

export async function until(cond: () => boolean, ms = 3000): Promise<void> {
  const t0 = performance.now();
  while (!cond()) {
    if (performance.now() - t0 > ms) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** Mounts a sheet with the design sample loaded. */
export async function mountExcel(attrs: Record<string, string> = {}, data?: Uint8Array, name = 'Client holdings — Q3 2026.xlsx'): Promise<SheetpaneExcel> {
  const el = document.createElement('sheetpane-excel');
  el.style.height = '600px';
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  await el.load(data ?? (await sampleXlsx()), name);
  await frame();
  return el;
}

export const shadow = (el: Element) => el.shadowRoot!;
export const cellEl = (el: Element, r: number, c: number) => shadow(el).getElementById(`c${r}_${c}`) as HTMLElement | null;

export function cleanup(): void {
  document.body.replaceChildren();
}

declare module 'vitest' { export interface ProvidedContext { timingBudgets: boolean } }
/** True off CI: wall-clock budgets are asserted on a developer machine and only reported on a shared runner (SR-BUILD 6). */
export const budgets = inject('timingBudgets');
