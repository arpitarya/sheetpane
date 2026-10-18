---
type: Handoff
name: W-07
description: "Research filed 2026-10-18 for Arpit's components (W-01, W-02): how the elements share one in-memory workbook wherever the host places them, and the shape of an error."
item: W-07
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-fable-5-1)"
ball: cowork
---

# W-07 — Research: one in-memory workbook for every element, and what an error is

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Design the in-memory workbook every element reads, wherever it sits on the page | the view, edit and error components always in step | ✅ |
| 2 | Define what an error records, so a review can be audited later | an error a host can save and reload | ✅ |
| 3 | Define the DOM events the host listens to | the host saves drafts, switches tabs, exports | ✅ |
| 4 | Arpit picks a shape from the compare doc | W-01 and W-02 share one contract | ✅ 2026-10-18 — "resolve all the blockers" |

**Arpit, 2026-10-18:** *"Two independent components, but will be linked behind
the scenes."* · *"It should always be linked."* · *"If you are editing the
Excel, it should keep it in the memory so that when we export it, it should
export with the latest values."*

**Model:** Cowork — a reading-and-weighing task with no code (SR-WORK-OPEN-QUEUE rule 37a).

**Closed 2026-10-18.** Verdict: [`work/compare/workbook-and-error-contract.compare.md`](../compare/workbook-and-error-contract.compare.md). Arpit ruled *"resolve all the blockers"*; the verdict was drafted in-session and is his to override — the reopen-trigger is in the doc.

## Goal

A compare doc, `work/compare/workbook-and-error-contract.compare.md`, with a
verdict and a proposed schema, that W-01 and W-02 both build from — within L6
(every change in memory), L7 (one source, always in sync), L9 (memory is a
JavaScript object) and L4 (DOM-only contract).

## The questions

1. **How elements find their workbook.** A module-level registry keyed by the
   `pane="…"` attribute; a workbook object set as a property; an ancestor
   `<sheetpane-provider>` element; or a combination. Mount order must not
   matter; two elements on different parts of the page must share.
2. **The store.** A framework-free store (subscribe / snapshot) inside the
   package — L4 keeps frameworks out of the contract; B-014 decides whether
   one may run inside.
3. **What is shared.** The prototype shares: mode, sheet, selected cell,
   whether the form is open, errors, **cell changes**, filter, and the form's
   draft. Which are workbook data (L7 says synced), which are per-element UI
   state — and B-021 (selection, scroll) to put to Arpit.
4. **The error schema.** Versioned; stable id; sheet; A1 range (cell or whole
   row); type; severity; **found = the uploaded value**; expected; message;
   `cellChanged`; status; author; createdAt.
5. **Events and methods.** Names and payloads for change, errors, select,
   mode, reveal and export (`sheetpane-*` working names); `export()`; how a host
   loads saved errors back.
6. **Rulings to put to Arpit.** B-021, B-022; deleting an error that changed a
   cell — keep or revert; undo/redo for cell edits — in scope?

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · doc | the compare doc exists with verdict, options, matrix, consequences, references, reopen-trigger | ✅ |
| 2 · schema | the proposed error type, element attributes, methods and events in the doc, with one worked example in plain HTML | ✅ |
| 3 · ruling | Arpit picks; the pick is written into W-01, W-02 and the compare doc | ✅ |

## Blockers

None.

## Record affected

**No SR affected** — the verdict feeds W-01's and W-02's records.

## Hazards

- **No private copies.** L7 decision 2 forbids an element keeping its own copy
  of workbook data or errors — a cache that can drift is a violation.

## Reference

- The laws: [SR-LAW-4](../../records/0006_LAW-4-web-component.md) ·
  [SR-LAW-6](../../records/0008_LAW-6-edits-in-memory-export-with-changes.md) ·
  [SR-LAW-7](../../records/0009_LAW-7-surfaces-always-in-sync.md) ·
  [SR-LAW-9](../../records/0011_LAW-9-memory-is-a-javascript-object.md).
- [`../reference/specs/web/mdn-using-custom-elements.md`](../reference/specs/web/mdn-using-custom-elements.md).
- [`../reference/specs/react/react-useSyncExternalStore.md`](../reference/specs/react/react-useSyncExternalStore.md) — the subscribe/snapshot store shape, framework aside.
- [`../reference/design/README.md`](../reference/design/README.md) — boards
  `Main`, `Host-Tab-Edit`, `Host-Linked-Tabs`; `Sheetpane` and `Errors` show the
  prototype's shared keys in `renderVals()`.
