// React hooks for sheetpane — recipes, not a package (W-28; events verdict decision 15).
// Copy this file into your app. Each hook takes a `ref` to <sheetpane-excel> and is
// built on `useSyncExternalStore` with a stable selector: a component re-renders only
// when the part of the pane it reads changes. Works in React 19 and React 18.
import { useCallback, useEffect, useRef, useSyncExternalStore, type RefObject } from 'react';
import type { ColumnRules, OnInvalid, SheetpaneError, SheetpaneExcel, ValidateFn, WorkbookStore, ChangeEntry } from '@sheetpane/grid';

export type SheetRef = RefObject<SheetpaneExcel | null>;
const noop = () => {};

/**
 * The primitive the other hooks share: a value selected from the pane's store.
 * `equal` keeps the last value when a new snapshot selects the same thing — that is
 * what stops unrelated store changes from re-rendering the component.
 */
export function useSheetpane<T>(ref: SheetRef, select: (store: WorkbookStore, el: SheetpaneExcel) => T, fallback: T, equal: (a: T, b: T) => boolean = Object.is): T {
  const cache = useRef<{ store?: WorkbookStore; version?: number; value: T }>({ value: fallback });
  // one subscription per element: a new function each render would make React re-subscribe every time
  const subscribe = useCallback((cb: () => void) => {
    const el = ref.current;
    if (!el) return noop;
    // the store can be replaced (a new `pane`, or `workbook =`): a load event re-reads it
    let unsub = el.workbook?.subscribe(cb) ?? noop;
    const relink = () => { unsub(); unsub = el.workbook?.subscribe(cb) ?? noop; cb(); };
    el.addEventListener('sheetpane-load', relink);
    return () => { unsub(); el.removeEventListener('sheetpane-load', relink); };
  }, [ref]);
  const getSnapshot = () => {
    const el = ref.current, store = el?.workbook;
    const c = cache.current;
    if (!el || !store) return c.value;
    const version = store.getSnapshot().version;
    if (c.store === store && c.version === version) return c.value;
    const next = select(store, el);
    c.store = store; c.version = version;
    if (!equal(c.value, next)) c.value = next;
    return c.value;
  };
  return useSyncExternalStore(subscribe, getSnapshot, () => fallback);
}

/** The pane's store (`WorkbookStore`), once the element has one. */
export function useWorkbook(ref: SheetRef): WorkbookStore | undefined {
  return useSheetpane(ref, (s) => s, undefined);
}

export interface SelectionState {
  sheet: string;
  ref: string;
  range: string | undefined;
  /** `{ index, letter, header }` — the header from the element's `header-row`. */
  column: { index: number; letter: string; header: string };
  value: unknown;
  text: string;
}
const sameSelection = (a: SelectionState | undefined, b: SelectionState | undefined) =>
  a === b || (!!a && !!b && a.sheet === b.sheet && a.ref === b.ref && a.range === b.range && a.value === b.value && a.text === b.text && a.column.header === b.column.header);

/** Which cell the user is on, its column and its value: "Email: asha@…". */
export function useSelection(ref: SheetRef): SelectionState | undefined {
  return useSheetpane<SelectionState | undefined>(ref, (s, el) => {
    const sel = s.getSnapshot().selection;
    if (!s.book || !sel.sheet) return undefined;
    return { sheet: sel.sheet, ref: sel.ref, range: sel.range, column: el.column(sel.sheet, sel.ref), value: s.value(sel.sheet, sel.ref), text: s.text(sel.sheet, sel.ref) };
  }, undefined, sameSelection);
}

export interface ChangesState { count: number; changes: ReadonlyMap<string, ChangeEntry>; canUndo: boolean; canRedo: boolean }
/** The changes kept in memory until export: "3 changes", and whether undo / redo can run. */
export function useChanges(ref: SheetRef): ChangesState {
  return useSheetpane<ChangesState>(ref, (s) => {
    const snap = s.getSnapshot();
    return { count: snap.changes.size, changes: snap.changes, canUndo: snap.canUndo, canRedo: snap.canRedo };
  }, EMPTY_CHANGES, (a, b) => a.changes === b.changes && a.canUndo === b.canUndo && a.canRedo === b.canRedo);
}
const EMPTY_CHANGES: ChangesState = { count: 0, changes: new Map(), canUndo: false, canRedo: false };

export interface ErrorsState { errors: readonly SheetpaneError[]; open: number }
/** The review: every error, and how many are open. */
export function useErrors(ref: SheetRef): ErrorsState {
  return useSheetpane<ErrorsState>(ref, (s) => {
    const errors = s.getSnapshot().errors;
    return { errors, open: errors.filter((e) => e.status === 'open').length };
  }, EMPTY_ERRORS, (a, b) => a.errors === b.errors);
}
const EMPTY_ERRORS: ErrorsState = { errors: [], open: 0 };

/**
 * Any sheetpane event, with the latest handler and one listener for the element's life.
 * The handler may call `e.preventDefault()` on the cancellable ones (`sheetpane-beforechange`, `sheetpane-editstart`).
 */
export function useSheetpaneEvent<D = unknown>(ref: SheetRef, name: `sheetpane-${string}`, handler: (e: CustomEvent<D>) => void): void {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = (e: Event) => latest.current(e as CustomEvent<D>);
    el.addEventListener(name, on);
    return () => el.removeEventListener(name, on);
  }, [ref, name]);
}

export interface CellEditState { editing: boolean; sheet?: string; ref?: string; draft?: string; column?: { index: number; letter: string; header: string } }
const IDLE: CellEditState = { editing: false };
const edits = new WeakMap<SheetpaneExcel, { state: CellEditState; listeners: Set<() => void> }>();
/** Whether the user is typing in a cell, where, and the draft so far (nothing is stored until Enter, Tab or blur). */
export function useCellEdit(ref: SheetRef): CellEditState {
  const subscribe = useCallback((cb: () => void) => {
    const el = ref.current;
    if (!el) return noop;
    let src = edits.get(el);
    if (!src) {
      const s = { state: IDLE, listeners: new Set<() => void>() };
      const set = (state: CellEditState) => { s.state = state; for (const l of s.listeners) l(); };
      type D = { sheet: string; ref: string; column: CellEditState['column']; value?: unknown; draft?: string };
      el.addEventListener('sheetpane-editstart', (e) => { const d = (e as CustomEvent<D>).detail; queueMicrotask(() => { if (!e.defaultPrevented) set({ editing: true, sheet: d.sheet, ref: d.ref, column: d.column, draft: String(d.value ?? '') }); }); });
      el.addEventListener('sheetpane-input', (e) => { const d = (e as CustomEvent<D>).detail; set({ editing: true, sheet: d.sheet, ref: d.ref, column: d.column, draft: d.draft ?? '' }); });
      for (const end of ['sheetpane-change', 'sheetpane-editcancel', 'sheetpane-select', 'focusout']) el.addEventListener(end, () => { if (s.state.editing) set(IDLE); });
      edits.set(el, (src = s));
    }
    src.listeners.add(cb);
    const mine = src;
    return () => { mine.listeners.delete(cb); };
  }, [ref]);
  return useSyncExternalStore(subscribe, () => (ref.current && edits.get(ref.current)?.state) ?? IDLE, () => IDLE);
}

/**
 * Column rules by title for the pane, set while the component is mounted (W-27).
 * `columns` is compared by value, so an inline object does not re-check every row on each render.
 * Returns the `load` phase's progress while it runs.
 */
export function useColumnRules(ref: SheetRef, columns: ColumnRules, o: { validate?: ValidateFn; onInvalid?: OnInvalid } = {}): { checking: boolean; done: number; total: number } {
  const key = JSON.stringify(columns);
  const validate = useRef(o.validate);
  validate.current = o.validate;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.columns = JSON.parse(key) as ColumnRules;
    el.validate = o.validate ? (ctx, signal) => validate.current!(ctx, signal) : undefined;
    if (o.onInvalid) el.onInvalid = o.onInvalid;
    const store = el.workbook;
    return () => {
      el.columns = {}; el.validate = undefined;
      // on unmount React has already removed the element (and it let go of its store): clear the pane's rules there
      if (!el.isConnected) store?.setColumnRules({});
    };
  }, [ref, key, !!o.validate, o.onInvalid]);
  return useSheetpane(ref, (s) => {
    const p = s.ruleProgress;
    return p ? { checking: true, done: p.done, total: p.total } : NOT_CHECKING;
  }, NOT_CHECKING, (a, b) => a.checking === b.checking && a.done === b.done && a.total === b.total);
}
const NOT_CHECKING = { checking: false, done: 0, total: 0 };
