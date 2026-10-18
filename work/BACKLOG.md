---
type: Queue
description: "The named-but-unclaimed: everything a record, proposal or compare doc says is outstanding and nobody is doing. The list only — its rules live in the record below."
governed_by: SR-WORK-BACKLOG
governed_by_path: records/0052_WORK-backlog.md
---

# BACKLOG — what has been named and is not being done

**This file is the LIST.** Everything else — what the backlog is, what feeds
it, the shape of a row, the five classes, how an item leaves, and the one
obligation it puts on every session — is stated once in
**[SR-WORK-BACKLOG](../records/0052_WORK-backlog.md)** and is not repeated here.

⚠ **Its length is not a signal.** `OPEN-WORK.md`'s length is how much is
pending; this file's length is how honest the records have been. Do not trim
it, and do not read it top-down as a priority order.

**Nothing here is in [`OPEN-WORK.md`](OPEN-WORK.md).**

---

## `unbuilt` — a ratified decision the code does not implement

| id | what is outstanding | named in | what closes it |
|---|---|---|---|

---

## `ungated` — a stated rule nothing mechanically checks

| id | what is outstanding | named in | what closes it |
|---|---|---|---|
| B-001 | The queue's row rules (13–19, 42, 45) are enforced by nothing but the inbox-shape hook | [SR-WORK-OPEN-QUEUE](../records/0051_WORK-open-queue.md) Consequences | a test over `work/OPEN-WORK.md` rows, as a `W-nn` |
| B-002 | `owns:` ↔ Ownership table agreement is unchecked in either direction | [SR-WORK-OWNERSHIP](../records/0058_WORK-ownership.md) decision 2 | a test parsing both, as a `W-nn` |
| B-003 | The registry's decisions 5–8 are enforced by nothing | [SR-WORK-REGISTRY](../records/0060_WORK-registry.md) Consequences | a test over §3, as a `W-nn` |
| B-004 | A `W-nn` that resolves to neither `work/open/` nor `archive/open/` is caught by nobody | [SR-WORK-OPEN-QUEUE](../records/0051_WORK-open-queue.md) Consequences | a test, as a `W-nn` |
| B-005 | A second `archive/` directory anywhere is caught by nobody | [SR-WORK-ARCHIVE](../records/0057_WORK-archive.md) decision 1 | a test, as a `W-nn` |
| B-008 | No check refuses a non-FOSS licence in the dependency tree | [SR-LAW-2](../records/0004_LAW-2-foss-dependencies.md) Consequences | a licence check over the lockfile, run by the guard or CI, in the change that adds `package.json` |

---

## `unmeasured` — a live default, constant or claim with no measurement behind it

| id | what is outstanding | named in | what closes it |
|---|---|---|---|
| B-026 | The largest workbook sheetpane can hold in JavaScript objects before the tab struggles | [SR-LAW-9](../records/0011_LAW-9-memory-is-a-javascript-object.md) Consequences | a measurement on a named machine, recorded in the record that owns the workbook model |
| B-031 | What iOS Safari does when `download()` is called: saves the `.xlsx` / `.csv` or opens it in a tab. Untested; SR-DOWNLOAD's 30-second revoke margin stays until it is measured. Arpit, 2026-10-18: not testing now (was W-09 DoD 10, W-12 DoD 7) | [SR-DOWNLOAD](../records/0101_DOWNLOAD.md) Consequences | the decider runs `HOST=0.0.0.0 just demo-html`, opens it on an iPhone and presses Export for both files; the result goes into SR-DOWNLOAD Consequences |

---

## `unruled` — a fork named and not decided

| id | what is outstanding | named in | what closes it |
|---|---|---|---|
| B-029 | Dismiss for a workbook-authored error (accept a validation warning for this review) — drawn on the Plugin-Validation board; W-18 keeps such rows read-only | [`work/proposals/dismiss-workbook-errors.md`](proposals/dismiss-workbook-errors.md) | the proposal's graduation trigger, then the decider's ruling and a `W-nn` amending W-18 |
| B-030 | SR-LAW-6's veto command greps for any `fetch(`; the grid's `src` loader fetches the file it is asked to show (a GET, nothing sent, `packages/grid/src/excel/element.ts`) — the command flags it | [SR-LAW-6](../records/0008_LAW-6-edits-in-memory-export-with-changes.md) veto · [SR-GRID](../records/0105_GRID.md) Consequences | the decider rules: narrow the command (e.g. exclude that file), or drop URL loading from W-01 DoD 2 |
| B-033 | Validate the OOXML parts sheetpane writes (threaded comments, VML, styles, formulas) against the ECMA-376 schema; today the tests check well-formedness and structure — an XSD validator would be a new (dev) dependency | [SR-COMMENTS](../records/0112_COMMENTS.md) Consequences | a file sheetpane wrote is repaired by Excel (W-30), or the decider picks a FOSS validator |
| B-032 | A plugin cannot add to a core event's detail (W-18 asked to count skipped rules, W-15 its fallback cells, W-16 its cycles in `sheetpane-load`/`-change`, W-22 its skipped comments on export); today they are `skippedRules()`, `fallbacks()`, `cycles()`, `lastExport` and the status line | [SR-VALIDATION](../records/0108_VALIDATION.md) decision 7 · [SR-NUMFMT](../records/0109_NUMFMT.md) decision 6 · [SR-FORMULAS](../records/0111_FORMULAS.md) · [SR-COMMENTS](../records/0112_COMMENTS.md) | the decider rules whether plugins get a way to add event detail — the plugins verdict's seventh-hook reopen-trigger — or the status line stands |
| B-028 | Live pivot tables — re-aggregating a pivot in the grid when its source cells change; v1 shows the cached cells and asks Excel to refresh on open | [`work/proposals/pivots.md`](proposals/pivots.md) | the proposal's graduation trigger: a host asks for it after W-16 lands, then the decider's ruling and a `W-nn` |
| B-025 | Connect the in-memory workbook to IndexedDB as well — the decider's request, deferred; e.g. behind a button | [SR-LAW-9](../records/0011_LAW-9-memory-is-a-javascript-object.md) Consequences | the decider's ruling rewriting SR-LAW-9 decisions 1–2 (and SR-LAW-6 decision 2) |

---

## `cost` — a consequence accepted deliberately

| id | what is outstanding | named in | what closes it |
|---|---|---|---|
| B-006 | The guard proves a record was touched, never that it is coherent; L0 obligation (iii) is judgment | [SR-LAW-0](../records/0002_LAW-0-authority.md) decision 1a | never graduates; it is the stated price of a mechanical gate |
| B-007 | The `Stop` hook relents after three refusals, so a blocker can be walked past | [SR-WORK-BLOCKERS](../records/0056_WORK-blockers.md) decision 8 | never graduates; a hook that never relents is a hang |
