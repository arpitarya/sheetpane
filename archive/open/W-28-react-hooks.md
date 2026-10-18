---
type: Handoff
name: W-28
description: "Arpit asked on 2026-10-18 for React hooks that follow the sheet: selection, typing, changes, errors, events, column rules. Shipped as a package or as recipes, per the verdict's ruling."
item: W-28
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-28 — React hooks for the grid

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Arpit's ruling: `@sheetpane/react` package, or recipes | the shape of this item | ✅ |
| 2 | Write the hooks over the store's `subscribe` / `getSnapshot` | React state that always matches the sheet | ✅ |
| 3 | Use them in the React demo (`examples/react/`) | proof in a real app | ✅ |

**Arpit, 2026-10-18:** *"Can you create some React hooks … helpful whenever
somebody is editing something or which cell they are on."*

**Model:** Sonnet — small, and each hook is checkable in a React test.

## Goal

```tsx
const sheet = useRef(null);
const { column, value } = useSelection(sheet);    // "Email: asha@…"
const { count } = useChanges(sheet);              // "3 changes"
useColumnRules(sheet, { Age: { type: 'number', min: 18 } });
useSheetpaneEvent(sheet, 'sheetpane-beforechange', e => { /* refuse */ });
return <sheetpane-excel ref={sheet} src="people.xlsx" mode="edit" pane="r1" />;
```

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · shape | **recipes** in the grid README and `examples/react/`, no package (Arpit, 2026-10-18; verdict decision 15) | ✅ recipes, no package: [`examples/react/src/sheetpane-hooks.ts`](../../examples/react/src/sheetpane-hooks.ts) to copy, and the grid README's "React hooks (recipes)"; SR-LAW-4's no-wrappers ruling stands |
| 2 · hooks | `useWorkbook`, `useSelection`, `useCellEdit`, `useChanges`, `useErrors`, `useSheetpaneEvent`, `useColumnRules`, or the set the verdict names; each on `useSyncExternalStore`; listeners removed on unmount | ✅ `useWorkbook`, `useSelection`, `useCellEdit`, `useChanges`, `useErrors`, `useSheetpaneEvent`, `useColumnRules`, plus the shared `useSheetpane(ref, select, fallback, equal)`; each on `useSyncExternalStore` with a memoised `subscribe` and a version-cached, equality-kept selection; listeners removed on unmount; `useColumnRules` clears the pane's rules on unmount even after the element left the DOM |
| 3 · versions | React 19; React 18 too per verdict decision 15 (hooks are fine in 18; the element needs a `ref` there) | ✅ React 19 (the demo and the tests run 19.3.1); the hooks use only `useSyncExternalStore`, `useRef`, `useEffect`, `useCallback` and take a `ref`, so React 18 works as the verdict says (not run on 18) |
| 4 · demo | the React demo (`examples/react/`) uses every hook | ✅ `examples/react` uses every hook in a review strip under the sheet, a "Check columns" toggle for `useColumnRules`, and a `useSheetpaneEvent` refusal; `demo-check` drives them in Chromium (selection strip, three rule errors by title, removed on uncheck) |
| 5 · tests | each hook re-renders on the store change it follows and on no other; StrictMode double-mount is safe | ✅ `examples/react/test/hooks.test.ts` (vitest project `react-recipes`, 7 tests): each hook re-renders on its change and not on an unrelated one; StrictMode double-mount leaves one listener; unmount removes listeners and rules |
## Blockers

None.

## Record affected

**No SR affected** (recipes; SR-LAW-4 stands). The test project is added to `vitest.config.ts`.

## Hazards

- **(a) overrules a ruling.** "No framework wrappers in v1" (SR-LAW-4
  Consequences) only changes when the verdict's reopen-trigger fires (two real host apps copy the recipes), never by this item.
- **Snapshots must be stable.** `getSnapshot` returning a new object every
  call makes React loop. Use selectors, or memoise.

## Reference

- the [events-and-rules verdict](../compare/grid-events-and-host-rules.compare.md) · [W-26](W-26-edit-events.md) · [W-27](W-27-host-column-rules.md) · W-09 (closed — `examples/react/`, [SR-BUILD](../../records/0102_BUILD.md) decision 11) · [`../reference/specs/react/react-useSyncExternalStore.md`](../reference/specs/react/react-useSyncExternalStore.md)
