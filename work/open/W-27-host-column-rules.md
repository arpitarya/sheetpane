---
type: Handoff
name: W-27
description: "Arpit asked on 2026-10-18 for a way to check, per column and title, whether what a user types is correct. Built as host-supplied column rules plus a validate callback. Design settled by W-25."
item: W-27
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-27 — Column rules: check what a user types, by column title

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Read the title row and match each host rule to its column | rules written as "Email", not "D" | ✅ settled 2026-10-18 — the verdict |
| 2 | Check values as they are typed, when saved, and once when the file opens | bad data found early, including data already in the file | ⏳ |
| 3 | Send every failure into the one error list | the host's rules show up in `<sheetpane-errors>` like any other error | ⏳ |
| 4 | Refuse or flag, as the host chooses | strict forms or review-and-fix, same component | ⏳ |

**Arpit, 2026-10-18:** *"This is the column, this is the title, and this is
what they're typing in the cell, whether that is correct or not."*

**Model:** Opus — timing (typing, async checks, 250,000 rows on load) is where
a near-miss hides.

## Goal

The column-rules design in the verdict's verdict. Starting point: the
`headerRow` / `columns` / `onInvalid` / `validate` proposal in
the [events-and-rules verdict](../compare/grid-events-and-host-rules.compare.md).

```ts
excel.columns = { 'Age': { type: 'number', min: 18, max: 99 }, 'Status': { oneOf: ['Active', 'Inactive'] } };
excel.validate = async (ctx, signal) =>
  ctx.column.header === 'Email' && await api.taken(ctx.value, { signal })
    ? { severity: 'error', message: 'Email already used' } : null;
```

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · rules | every rule in the verdict's vocabulary, as plain JSON; each failure's message names the rule | ⏳ |
| 2 · function | `validate(ctx, signal)` sync or async; `ctx.rowValues` keyed by title for cross-column checks; stale async results dropped through `AbortSignal` | ⏳ |
| 3 · phases | `input` shows an outline and a tooltip and stores nothing; `commit` flags or blocks per `onInvalid`; `load` checks every row, timed as the verdict rules | ⏳ |
| 4 · errors | failures become errors through the plugin host's `validate` hook, `author: "host"`, resolving themselves when the cell passes (verdict decision 10); they show in `<sheetpane-errors>` and survive `setErrors()` like any other error | ⏳ |
| 5 · block | `block` cancels through W-26's `sheetpane-beforechange`; a refused value is never stored (L6) | ⏳ |
| 6 · headers | a missing or duplicate title is handled as the verdict rules; the policy is shown, never silent | ⏳ |
| 7 · scale | a 250,000-row file with four rules loads without freezing the page; the measurement and the machine are written here | ⏳ |
| 8 · filter | `<sheetpane-errors>`' author filter (W-18 DoD 5) includes "host" | ⏳ |
| 9 · tests | the four-column example (Name, Email, Age, Status): typing, saving, loading, async, block vs flag, missing header — in a real browser | ⏳ |
| 10 · docs | README section with the four-column example; W-01's component record gains the properties | ⏳ |

## Blockers

Waiting on **W-26** (`beforechange` for `block`). The `validate` hook
(W-14, closed → SR-GRID decision 17) and the error list (W-02, closed →
SR-ERRORS) have landed.

## Record affected

[SR-GRID](../../records/0105_GRID.md): the properties, the host provider on `validate`, and decision 17's auto-resolve widened to `host`; all in the same change.

## Hazards

- **Rules changing at runtime** vs the frozen plugin set: follow the verdict's ruling
  exactly.
- **A host rule must never edit a cell.** It only reports, so the review stays
  auditable.
- **`pattern` comes from the host.** A catastrophic regex could freeze the
  page. Bound it (time or input length), or document the risk.

## Reference

- the [events-and-rules verdict](../compare/grid-events-and-host-rules.compare.md) · W-14 (closed — [SR-GRID](../../records/0105_GRID.md)) · [W-18](W-18-validation.md) · [W-26](W-26-edit-events.md) · W-02 (closed — [SR-ERRORS](../../records/0106_ERRORS.md))
