---
type: Handoff
name: W-27
description: "Arpit asked on 2026-10-18 for a way to check, per column and title, whether what a user types is correct. Built as host-supplied column rules plus a validate callback. Design settled by W-25."
item: W-27
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-27 — Column rules: check what a user types, by column title

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Read the title row and match each host rule to its column | rules written as "Email", not "D" | ✅ |
| 2 | Check values as they are typed, when saved, and once when the file opens | bad data found early, including data already in the file | ✅ |
| 3 | Send every failure into the one error list | the host's rules show up in `<sheetpane-errors>` like any other error | ✅ |
| 4 | Refuse or flag, as the host chooses | strict forms or review-and-fix, same component | ✅ |

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
| 1 · rules | every rule in the verdict's vocabulary, as plain JSON; each failure's message names the rule | ✅ `required`, `type` (text/number/integer/date/boolean), `min`, `max`, `minLength`, `maxLength`, `pattern`, `oneOf`, `unique`, `message`, `severity`, `onInvalid` as plain JSON; each message names the column and the rule (`Age: must be at least 18 (min)`); `expected` is the rule in words — tests |
| 2 · function | `validate(ctx, signal)` sync or async; `ctx.rowValues` keyed by title for cross-column checks; stale async results dropped through `AbortSignal` | ✅ `validate(ctx, signal)` sync or async; `ctx.rowValues` keyed by title and the row asked again on any edit in it; a newer check aborts the older and its stale result is dropped — tests |
| 3 · phases | `input` shows an outline and a tooltip and stores nothing; `commit` flags or blocks per `onInvalid`; `load` checks every row, timed as the verdict rules | ✅ `input` after 150 ms: an outline (`aria-invalid`), a tooltip and a cell-bar message, nothing stored; `commit` flags or blocks; `load` checks every row in 8 ms slices with progress in the status line — tests |
| 4 · errors | failures become errors through the plugin host's `validate` hook, `author: "host"`, resolving themselves when the cell passes (verdict decision 10); they show in `<sheetpane-errors>` and survive `setErrors()` like any other error | ✅ a built-in `validate` provider (`host-rules`), `author: "host"`, `type: 'column-rule'`; resolves itself when the cell passes, reopens when it fails; shown in `<sheetpane-errors>`; survives `setErrors()` (adopted by content, not doubled) — tests |
| 5 · block | `block` cancels through W-26's `sheetpane-beforechange`; a refused value is never stored (L6) | ✅ `block` (per rule or element-wide `on-invalid`) refuses inside the element's `beforechange` gate; never stored, no change event, `sheetpane-editcancel {reason: 'blocked', message}`; an async result can only flag — tests |
| 6 · headers | a missing or duplicate title is handled as the verdict rules; the policy is shown, never silent | ✅ a missing title → one `note`; a duplicated title → the first column wins plus one `note`; the file loads anyway; titles trimmed and case-insensitive, an exact title first; `header-row` honoured — tests |
| 7 · scale | a 250,000-row file with four rules loads without freezing the page; the measurement and the machine are written here | ✅ Arpit's MacBook, headless Chromium 156, load ≈ 5: 250,000 rows × four rules — read 250 ms, all rows checked in 1.3 s over 79 painted frames, longest gap 44 ms |
| 8 · filter | `<sheetpane-errors>`' author filter (W-18 DoD 5) includes "host" | ✅ "Column rules" in the author filter; host rows read-only ("Column rule") — test |
| 9 · tests | the four-column example (Name, Email, Age, Status): typing, saving, loading, async, block vs flag, missing header — in a real browser | ✅ `packages/grid/test/rules.test.ts`, 17 tests in Chromium: Name, Email, Age, Status — typing, saving, loading, async, block vs flag, missing header |
| 10 · docs | README section with the four-column example; W-01's component record gains the properties | ✅ grid README "Column rules" with the four-column example; [SR-GRID](../../records/0105_GRID.md) decisions 17 (auto-resolve widened to `host`) and 22–22c; SR-ERRORS decision 3 |
## Blockers

None.

## Record affected

**[SR-GRID](../../records/0105_GRID.md)** decisions 17 and 22–22c; [SR-ERRORS](../../records/0106_ERRORS.md) decision 3.

## Hazards

- **Rules changing at runtime** vs the frozen plugin set: follow the verdict's ruling
  exactly.
- **A host rule must never edit a cell.** It only reports, so the review stays
  auditable.
- **`pattern` comes from the host.** A catastrophic regex could freeze the
  page. Bound it (time or input length), or document the risk.

## Reference

- the [events-and-rules verdict](../compare/grid-events-and-host-rules.compare.md) · W-14 (closed — [SR-GRID](../../records/0105_GRID.md)) · [W-18](W-18-validation.md) · [W-26](W-26-edit-events.md) · W-02 (closed — [SR-ERRORS](../../records/0106_ERRORS.md))
