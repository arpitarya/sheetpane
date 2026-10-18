// W-28: the hook recipes against React 19 — each re-renders on the change it follows and on no other.
import { afterEach, describe, expect, it } from 'vitest';
import { act, createElement, StrictMode, useRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import '@sheetpane/grid';
import type { SheetpaneExcel } from '@sheetpane/grid';
import { useCellEdit, useChanges, useColumnRules, useErrors, useSelection, useSheetpaneEvent, useWorkbook, type SheetRef } from '../src/sheetpane-hooks';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const CSV = new TextEncoder().encode('Name,Age,Status\nAda,36,Active\nBo,17,Active\n');
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const until = async (cond: () => boolean, ms = 3000) => { const t0 = performance.now(); while (!cond()) { if (performance.now() - t0 > ms) throw new Error('timed out'); await new Promise((r) => setTimeout(r, 10)); } };

let root: Root | undefined;
afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.replaceChildren(); });

/** Mounts <sheetpane-excel> and a probe component using `use(ref)`; returns the renders the probe saw. */
async function mount<T>(use: (ref: SheetRef) => T, o: { strict?: boolean } = {}) {
  const seen: T[] = [];
  let el!: SheetpaneExcel;
  function Probe({ sheet }: { sheet: SheetRef }) { seen.push(use(sheet)); return null; }
  function App() {
    const sheet = useRef<SheetpaneExcel>(null);
    return createElement('div', null,
      createElement('sheetpane-excel', { ref: (x: SheetpaneExcel | null) => { sheet.current = x; if (x) el = x; }, mode: 'edit', style: { height: '400px', display: 'block' } }),
      createElement(Probe, { sheet }));
  }
  const host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  const tree: ReactNode = createElement(App);
  act(() => root!.render(o.strict ? createElement(StrictMode, null, tree) : tree));
  await act(async () => { await el.load(CSV, 'people.csv'); });
  await act(async () => { await frame(); });
  return { el, seen, store: () => el.workbook! };
}

describe('the hooks (W-28 DoD 2, 5)', () => {
  it('useWorkbook: the pane’s store, once the element has one', async () => {
    const { seen, store } = await mount(useWorkbook);
    expect(seen.at(-1)).toBe(store());
  });

  it('useSelection: re-renders when the cell moves, not when another cell changes', async () => {
    const { seen, store } = await mount(useSelection);
    expect(seen.at(-1)).toMatchObject({ sheet: 'people', ref: 'A1', column: { letter: 'A', header: 'Name' }, text: 'Name' });
    act(() => store().select({ sheet: 'people', ref: 'B3' }));
    expect(seen.at(-1)).toMatchObject({ ref: 'B3', column: { header: 'Age' }, value: '17' });
    const n = seen.length;
    act(() => store().setCell('people', 'C2', 'Inactive')); // not the selected cell
    expect(seen.length).toBe(n);
    act(() => store().setCell('people', 'B3', '18')); // the selected cell's value
    expect(seen.length).toBe(n + 1);
    expect(seen.at(-1)!.value).toBe('18');
  });

  it('useChanges: re-renders on a change and on undo, not on a selection', async () => {
    const { seen, store } = await mount(useChanges);
    expect(seen.at(-1)).toMatchObject({ count: 0, canUndo: false });
    const n = seen.length;
    act(() => store().select({ sheet: 'people', ref: 'B2' }));
    expect(seen.length).toBe(n);
    act(() => store().setCell('people', 'B2', '40'));
    expect(seen.at(-1)).toMatchObject({ count: 1, canUndo: true });
    act(() => store().undo());
    expect(seen.at(-1)).toMatchObject({ count: 0, canRedo: true });
  });

  it('useErrors: re-renders when the review changes, not on a selection', async () => {
    const { seen, store } = await mount(useErrors);
    const n = seen.length;
    act(() => store().select({ sheet: 'people', ref: 'C3' }));
    expect(seen.length).toBe(n);
    act(() => { store().addError({ sheet: 'people', range: 'B3', type: 'wrong-value', severity: 'error', expected: '18' }); });
    expect(seen.at(-1)!.open).toBe(1);
  });

  it('useCellEdit: the draft as typed; idle again after Enter', async () => {
    const { el, seen } = await mount(useCellEdit);
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('input.cell')!;
    await act(async () => { input.focus(); await Promise.resolve(); });
    expect(seen.at(-1)).toMatchObject({ editing: true, ref: 'A1' });
    act(() => { input.value = 'Adele'; input.dispatchEvent(new Event('input')); });
    expect(seen.at(-1)).toMatchObject({ editing: true, draft: 'Adele', column: { header: 'Name' } });
    act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    expect(seen.at(-1)).toEqual({ editing: false });
  });

  it('useSheetpaneEvent: the latest handler, one listener; removed on unmount; StrictMode-safe', async () => {
    const calls: string[] = [];
    const { el } = await mount((ref) => useSheetpaneEvent<{ ref: string; now: unknown }>(ref, 'sheetpane-beforechange', (e) => {
      calls.push(e.detail.ref);
      if (Number(e.detail.now) < 0) e.preventDefault();
    }), { strict: true });
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('input.cell')!;
    const type = (ref: string, v: string) => act(() => { el.workbook!.select({ sheet: 'people', ref }); input.focus(); input.value = v; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    await act(async () => { await frame(); });
    type('B2', '-1');
    expect(calls).toEqual(['B2']); // once, even after StrictMode's double mount
    expect(el.workbook!.value('people', 'B2')).toBe('36'); // refused
    act(() => root!.unmount()); root = undefined;
    el.dispatchEvent(new CustomEvent('sheetpane-beforechange', { detail: { ref: 'Z9', now: 1 } }));
    expect(calls).toEqual(['B2']);
  });

  it('useColumnRules: sets the pane’s rules while mounted (an inline object does not re-check), clears them on unmount', async () => {
    let renders = 0;
    const { el, store } = await mount((ref) => { renders++; return useColumnRules(ref, { Age: { type: 'integer', min: 18 } }); });
    await until(() => store().getErrors().length === 1);
    expect(el.columns).toEqual({ Age: { type: 'integer', min: 18 } });
    expect(store().getErrors()[0]).toMatchObject({ range: 'B3', author: 'host' });
    const configured = store().columnRules;
    act(() => store().select({ sheet: 'people', ref: 'C2' }));
    expect(store().columnRules).toBe(configured); // not set again on an unrelated render
    const pane = store();
    act(() => root!.unmount()); root = undefined;
    await until(() => pane.getErrors().length === 0);
    expect(pane.columnRules.columns).toEqual({});
    expect(renders).toBeGreaterThan(0);
  });
});
