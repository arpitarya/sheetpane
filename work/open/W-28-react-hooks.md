---
type: Handoff
name: W-28
description: "Arpit asked on 2026-10-18 for React hooks that follow the sheet: selection, typing, changes, errors, events, column rules. Shipped as a package or as recipes, per W-25's ruling."
item: W-28
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-28 — React hooks for the grid

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Arpit's W-25 ruling: `@sheetpane/react` package, or recipes | the shape of this item | ⏳ W-25 |
| 2 | Write the hooks over the store's `subscribe` / `getSnapshot` | React state that always matches the sheet | ⏳ |
| 3 | Use them in the W-09 React demo | proof in a real app | ⏳ |

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
| 1 · shape | W-25's ruling applied: (a) `packages/react` → `@sheetpane/react`, React a peer dependency, no runtime dependency, SR-LAW-4 Consequences rewritten; or (b) recipes in the grid README and `examples/react/`, no package | ⏳ |
| 2 · hooks | `useWorkbook`, `useSelection`, `useCellEdit`, `useChanges`, `useErrors`, `useSheetpaneEvent`, `useColumnRules`, or the set W-25 rules; each on `useSyncExternalStore`; listeners removed on unmount | ⏳ |
| 3 · versions | React 19; React 18 too if W-25 rules it (hooks are fine in 18; the element needs a `ref` there) | ⏳ |
| 4 · demo | the W-09 React app uses every hook | ⏳ |
| 5 · tests | each hook re-renders on the store change it follows and on no other; StrictMode double-mount is safe | ⏳ |

## Blockers

Waiting on **W-25** (package or recipes), **W-26** (the events) and **W-01**
(the store on the element).

## Record affected

(a): a new component record for `@sheetpane/react`, and SR-LAW-4's
Consequences. (b): **no SR affected**.

## Hazards

- **(a) overrules a ruling.** "No framework wrappers in v1" (SR-LAW-4
  Consequences) only changes with Arpit's ruling in W-25, never by this item.
- **Snapshots must be stable.** `getSnapshot` returning a new object every
  call makes React loop. Use selectors, or memoise.

## Reference

- [W-25](W-25-research-events-rules-hooks.md) · [W-26](W-26-edit-events.md) · [W-27](W-27-host-column-rules.md) · [W-09](W-09-demo-apps.md) · [`../reference/specs/react/react-useSyncExternalStore.md`](../reference/specs/react/react-useSyncExternalStore.md)
